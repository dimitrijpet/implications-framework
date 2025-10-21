# State Registry System - Design Specification

**Version:** 1.0  
**Status:** 📋 Planned (Session 4)  
**Priority:** 🔴 Critical

---

## 🎯 Problem Statement

### Current Issue

Guest projects use **different naming conventions** for states in transitions vs. class names:
```javascript
// Transition uses lowercase
static xstateConfig = {
  on: {
    ACCEPT: 'accepted'  // ❌ Lowercase
  }
}

// But class name is PascalCase
class AcceptedBookingImplications { }  // ✅ PascalCase
```

**Result:** All transitions are broken (detected as errors by analyzer)

---

### Why This Matters

1. **State machine doesn't work** - Transitions point to non-existent states
2. **Analysis reports false positives** - 11 "broken transition" errors
3. **Not generic** - Framework assumes specific naming pattern
4. **User confusion** - Why are my transitions broken?

---

## 💡 Solution: Configurable State Registry

A flexible mapping system that:
- **Discovers** naming patterns automatically
- **Maps** short names to full class names
- **Validates** transitions using registry
- **Configures** via user settings

---

## 🏗️ Architecture

### 1. Config File (`ai-testing.config.js`)
```javascript
module.exports = {
  projectName: 'PolePosition Testing',
  projectType: 'booking',
  
  // ✅ NEW: State Registry Configuration
  stateRegistry: {
    // Strategy: 'auto', 'explicit', or 'pattern'
    strategy: 'auto',
    
    // Auto-discovery pattern
    pattern: '{Status}BookingImplications',
    
    // Explicit mappings (optional, overrides auto-discovery)
    mappings: {
      'accepted': 'AcceptedBookingImplications',
      'rejected': 'RejectedBookingImplications',
      'pending': 'PendingBookingImplications'
    },
    
    // Status prefixes to extract
    statusPrefixes: [
      'Accepted', 'Rejected', 'Pending', 'Standby',
      'Created', 'CheckedIn', 'CheckedOut', 'Completed',
      'Cancelled', 'Missed', 'Invited'
    ],
    
    // Case sensitivity
    caseSensitive: false
  },
  
  paths: {
    implications: './tests/implications',
    baseImplications: './tests/implications/BaseBookingImplications.js'
  }
};
```

---

### 2. State Registry Service
```javascript
// packages/core/src/StateRegistry.js

export class StateRegistry {
  constructor(config) {
    this.config = config.stateRegistry || {};
    this.registry = new Map(); // short name → full class name
    this.reverseRegistry = new Map(); // full class name → short name
  }
  
  /**
   * Build registry from discovery result
   */
  async build(discoveryResult) {
    const strategy = this.config.strategy || 'auto';
    
    switch (strategy) {
      case 'explicit':
        this.buildFromExplicitMappings();
        break;
      
      case 'pattern':
        this.buildFromPattern(discoveryResult);
        break;
      
      case 'auto':
      default:
        this.buildAuto(discoveryResult);
        break;
    }
    
    console.log(`✅ State Registry built: ${this.registry.size} mappings`);
    return this;
  }
  
  /**
   * Auto-discover mappings from class names
   */
  buildAuto(discoveryResult) {
    const { implications } = discoveryResult.files;
    
    implications.forEach(impl => {
      const className = impl.metadata.className;
      const shortName = this.extractShortName(className);
      
      if (shortName) {
        this.register(shortName, className);
      }
    });
  }
  
  /**
   * Use explicit mappings from config
   */
  buildFromExplicitMappings() {
    const mappings = this.config.mappings || {};
    
    Object.entries(mappings).forEach(([short, full]) => {
      this.register(short, full);
    });
  }
  
  /**
   * Use pattern from config
   */
  buildFromPattern(discoveryResult) {
    const pattern = this.config.pattern;
    if (!pattern) {
      throw new Error('Pattern strategy requires stateRegistry.pattern in config');
    }
    
    const { implications } = discoveryResult.files;
    const regex = this.patternToRegex(pattern);
    
    implications.forEach(impl => {
      const className = impl.metadata.className;
      const match = className.match(regex);
      
      if (match && match[1]) {
        const shortName = match[1].toLowerCase();
        this.register(shortName, className);
      }
    });
  }
  
  /**
   * Convert pattern to regex
   * E.g., '{Status}BookingImplications' → /^(\w+)BookingImplications$/
   */
  patternToRegex(pattern) {
    const escaped = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace('{Status}', '(\\w+)');
    return new RegExp(`^${escaped}$`);
  }
  
  /**
   * Extract short name from class name
   */
  extractShortName(className) {
    const prefixes = this.config.statusPrefixes || [];
    
    // Try to match known prefixes
    for (const prefix of prefixes) {
      if (className.startsWith(prefix)) {
        return this.config.caseSensitive 
          ? prefix 
          : prefix.toLowerCase();
      }
    }
    
    // Fallback: remove 'Implications' suffix and lowercase
    return className
      .replace(/Implications$/, '')
      .replace(/Booking$/, '')
      .toLowerCase();
  }
  
  /**
   * Register a mapping
   */
  register(shortName, fullClassName) {
    const key = this.config.caseSensitive ? shortName : shortName.toLowerCase();
    
    this.registry.set(key, fullClassName);
    this.reverseRegistry.set(fullClassName, shortName);
    
    console.log(`  📌 Mapped: "${key}" → "${fullClassName}"`);
  }
  
  /**
   * Resolve a state name to full class name
   */
  resolve(stateName) {
    if (!stateName) return null;
    
    const key = this.config.caseSensitive ? stateName : stateName.toLowerCase();
    
    // Check registry first
    if (this.registry.has(key)) {
      return this.registry.get(key);
    }
    
    // Check if it's already a full class name
    if (this.reverseRegistry.has(stateName)) {
      return stateName;
    }
    
    // Try capitalized version
    const capitalized = stateName.charAt(0).toUpperCase() + stateName.slice(1);
    if (this.registry.has(capitalized)) {
      return this.registry.get(capitalized);
    }
    
    return null;
  }
  
  /**
   * Get short name from full class name
   */
  getShortName(fullClassName) {
    return this.reverseRegistry.get(fullClassName);
  }
  
  /**
   * Get all mappings
   */
  getAllMappings() {
    return Array.from(this.registry.entries()).map(([short, full]) => ({
      shortName: short,
      fullClassName: full
    }));
  }
  
  /**
   * Validate if a state exists
   */
  exists(stateName) {
    return this.resolve(stateName) !== null;
  }
}
```

---

### 3. Integration with Analyzer
```javascript
// packages/analyzer/src/rules/BrokenTransitionRule.js

export class BrokenTransitionRule extends BaseRule {
  analyze(implication, context) {
    const issues = [];
    const className = implication.metadata.className;
    
    // ✅ Get state registry from context
    const registry = context.stateRegistry;
    
    // Find outgoing transitions
    const outgoing = context.transitions.filter(t => t.from === className);
    
    outgoing.forEach(transition => {
      // ✅ Resolve using registry
      const resolvedTarget = registry.resolve(transition.to);
      
      // Check if resolved target exists
      const targetExists = context.implications.some(
        i => i.metadata.className === resolvedTarget
      );
      
      if (!resolvedTarget) {
        issues.push(this.createIssue({
          severity: IssueSeverity.ERROR,
          type: IssueType.BROKEN_TRANSITION,
          stateName: className,
          title: 'Unresolvable Transition',
          message: `${className} has transition "${transition.event}" to "${transition.to}", which cannot be resolved to any known state.`,
          suggestions: [
            new Suggestion({
              action: 'check-registry',
              title: 'Check State Registry',
              description: 'Verify state registry configuration and mappings',
              autoFixable: false
            }),
            new Suggestion({
              action: 'add-mapping',
              title: 'Add Custom Mapping',
              description: `Add mapping for "${transition.to}" in config`,
              autoFixable: false,
              data: { targetName: transition.to }
            })
          ]
        }));
      }
      else if (!targetExists) {
        issues.push(this.createIssue({
          severity: IssueSeverity.ERROR,
          type: IssueType.BROKEN_TRANSITION,
          stateName: className,
          title: 'Broken Transition',
          message: `${className} has transition "${transition.event}" to "${transition.to}" (resolves to "${resolvedTarget}"), but that state doesn't exist.`,
          suggestions: [
            new Suggestion({
              action: 'create-state',
              title: `Create ${resolvedTarget}`,
              description: 'Generate missing state class',
              autoFixable: true,
              data: { className: resolvedTarget }
            }),
            new Suggestion({
              action: 'fix-target',
              title: 'Fix Target State',
              description: 'Update transition to reference existing state',
              autoFixable: false,
              data: {
                currentTarget: transition.to,
                resolvedTarget: resolvedTarget,
                possibleTargets: this.suggestSimilarStates(resolvedTarget, context)
              }
            })
          ]
        }));
      }
    });
    
    return issues;
  }
}
```

---

### 4. Integration with Discovery
```javascript
// packages/api-server/src/routes/discovery.js

import { StateRegistry } from '../../../core/src/StateRegistry.js';
import { loadConfig } from '../services/configService.js';

router.post('/scan', async (req, res) => {
  const { projectPath } = req.body;
  
  // Load config
  const config = await loadConfig(projectPath);
  
  // Run discovery
  const discoveryResult = await discoverProject(projectPath);
  
  // ✅ Build state registry
  const stateRegistry = new StateRegistry(config);
  await stateRegistry.build(discoveryResult);
  
  // ✅ Run analysis with registry
  const analysisResult = analyzer.analyze(discoveryResult, {
    stateRegistry  // Pass registry to context
  });
  
  // Include registry in response
  res.json({
    ...discoveryResult,
    analysis: analysisResult,
    stateRegistry: {
      mappings: stateRegistry.getAllMappings(),
      strategy: config.stateRegistry?.strategy || 'auto'
    }
  });
});
```

---

## 🎨 UI Components

### 1. State Registry Panel
```jsx
// packages/web-app/src/components/StateRegistry/StateRegistryPanel.jsx

export default function StateRegistryPanel({ stateRegistry, theme }) {
  const [editMode, setEditMode] = useState(false);
  const [mappings, setMappings] = useState(stateRegistry.mappings || []);
  
  return (
    <div className="rounded-xl p-6" style={{ background: theme.colors.background.secondary }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">🗺️ State Registry</h2>
        <button onClick={() => setEditMode(!editMode)}>
          {editMode ? '✅ Done' : '✏️ Edit'}
        </button>
      </div>
      
      <div className="mb-4 text-sm" style={{ color: theme.colors.text.secondary }}>
        Strategy: <strong>{stateRegistry.strategy}</strong>
      </div>
      
      <div className="space-y-2">
        {mappings.map(({ shortName, fullClassName }, index) => (
          <div key={index} className="flex items-center gap-3 p-3 rounded" 
               style={{ background: theme.colors.background.tertiary }}>
            <code className="flex-1 font-mono text-sm">{shortName}</code>
            <span>→</span>
            <code className="flex-1 font-mono text-sm">{fullClassName}</code>
            
            {editMode && (
              <button onClick={() => removeMapping(index)}>
                ❌
              </button>
            )}
          </div>
        ))}
      </div>
      
      {editMode && (
        <div className="mt-4">
          <button onClick={addCustomMapping} className="btn-primary">
            + Add Custom Mapping
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### 2. Settings Page
```jsx
// packages/web-app/src/pages/Settings.jsx

export default function Settings() {
  const [config, setConfig] = useState(null);
  
  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-6">⚙️ Settings</h1>
      
      {/* State Registry Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">State Registry</h2>
        
        <div className="space-y-4">
          <div>
            <label>Strategy</label>
            <select value={config.stateRegistry.strategy}>
              <option value="auto">Auto-discover</option>
              <option value="pattern">Pattern-based</option>
              <option value="explicit">Explicit mappings</option>
            </select>
          </div>
          
          {config.stateRegistry.strategy === 'pattern' && (
            <div>
              <label>Pattern</label>
              <input 
                value={config.stateRegistry.pattern}
                placeholder="{Status}BookingImplications"
              />
            </div>
          )}
          
          <div>
            <label>Case Sensitive</label>
            <input 
              type="checkbox"
              checked={config.stateRegistry.caseSensitive}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
```

---

## 🧪 Test Cases

### Test 1: Auto-Discovery
```javascript
// Input: Class names
const classNames = [
  'AcceptedBookingImplications',
  'RejectedBookingImplications',
  'PendingBookingImplications'
];

// Expected registry:
{
  'accepted': 'AcceptedBookingImplications',
  'rejected': 'RejectedBookingImplications',
  'pending': 'PendingBookingImplications'
}

// Resolution tests:
registry.resolve('accepted')  // → 'AcceptedBookingImplications'
registry.resolve('Accepted')  // → 'AcceptedBookingImplications' (case-insensitive)
registry.resolve('AcceptedBookingImplications')  // → 'AcceptedBookingImplications' (already full)
```

---

### Test 2: Pattern-Based
```javascript
// Config:
{
  strategy: 'pattern',
  pattern: '{Status}BookingImplications'
}

// Input: Class names
const classNames = [
  'AcceptedBookingImplications',
  'RejectedBookingImplications',
  'SomeOtherClass'  // Should be ignored
];

// Expected registry:
{
  'accepted': 'AcceptedBookingImplications',
  'rejected': 'RejectedBookingImplications'
  // 'SomeOtherClass' not included (doesn't match pattern)
}
```

---

### Test 3: Explicit Mappings
```javascript
// Config:
{
  strategy: 'explicit',
  mappings: {
    'accepted': 'AcceptedBookingImplications',
    'rejected': 'RejectedBookingImplications',
    'custom_state': 'MyCustomStateClass'
  }
}

// Resolution tests:
registry.resolve('accepted')  // → 'AcceptedBookingImplications'
registry.resolve('custom_state')  // → 'MyCustomStateClass'
registry.resolve('pending')  // → null (not in mappings)
```

---

## 📊 Success Metrics

- ✅ All transition errors resolved in test project
- ✅ Registry builds in <100ms
- ✅ 100% resolution accuracy
- ✅ Works with any naming convention
- ✅ User can customize mappings
- ✅ Zero breaking changes to existing code

---

## 🚧 Implementation Phases

### Phase 1: Core Registry (2 hours)
- [ ] Create StateRegistry class
- [ ] Implement auto-discovery
- [ ] Implement pattern-based discovery
- [ ] Implement explicit mappings
- [ ] Add resolution logic
- [ ] Unit tests

### Phase 2: Integration (1 hour)
- [ ] Integrate with discovery service
- [ ] Pass registry to analyzer
- [ ] Update BrokenTransitionRule
- [ ] Update IsolatedStateRule
- [ ] Test with real project

### Phase 3: UI (1.5 hours)
- [ ] Create StateRegistryPanel component
- [ ] Add to Visualizer page
- [ ] Settings page for editing
- [ ] Add/remove custom mappings
- [ ] Save to config file

### Phase 4: Testing & Polish (30 min)
- [ ] Test all strategies
- [ ] Test edge cases
- [ ] Error handling
- [ ] Documentation
- [ ] Examples

---

## 🔮 Future Enhancements

### 1. Smart Suggestions
```
❓ Detected transition to "accepted"
   Did you mean:
   1. AcceptedBookingImplications (auto-discovered)
   2. AcceptedApplicationImplications (similar)
   3. Add custom mapping for "accepted"
```

### 2. Migration Tool
```bash
# Auto-fix all broken transitions
implications fix:transitions --auto

# Preview changes
implications fix:transitions --dry-run
```

### 3. Multi-Project Support
```javascript
// Different strategies per project
{
  projects: {
    'booking': { strategy: 'pattern', pattern: '{Status}BookingImplications' },
    'inventory': { strategy: 'auto' },
    'users': { strategy: 'explicit', mappings: {...} }
  }
}
```

---

## 📚 Related Documentation

- `SESSION-3-SUMMARY.md` - Analysis engine that needs registry
- `SYSTEM-OVERVIEW.md` - Overall architecture
- `QUICK-START.md` - User setup guide

---

*Specification Version: 1.0*  
*Created: October 21, 2025*  
*Status: Ready for Session 4 implementation*