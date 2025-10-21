# Next Steps - Session 2 Roadmap

## 🎯 Session 2 Goals

Transform the **read-only visualizer** into a **full editing system** with state creation, metadata editing, and file generation.

---

## 🚨 CRITICAL: Fix Parser First

**MUST BE DONE FIRST** - Everything else depends on this!

### Task: Parse `ImplicationHelper.mergeWithBase()`

**Why Critical:**
- 80% of screens use this pattern
- Can't show accurate UI implications without it
- Blocks understanding of what tests actually validate

**Implementation Steps:**

1. **Detect mergeWithBase calls** (30 min)
```javascript
   function parseScreenValidation(node) {
     if (node?.type === 'CallExpression' && 
         node.callee?.property?.name === 'mergeWithBase') {
       return parseMergeWithBaseCall(node);
     }
   }
```

2. **Extract base reference** (45 min)
```javascript
   function parseMergeWithBaseCall(callNode) {
     const [baseRef, overrides, options] = callNode.arguments;
     
     // Parse: BaseBookingImplications.dancer.bookingDetailsScreen
     const className = baseRef.object?.object?.name;
     const platform = baseRef.object?.property?.name;
     const screen = baseRef.property?.name;
     
     return { className, platform, screen, overrides };
   }
```

3. **Find and parse base file** (1 hour)
```javascript
   async function resolveBaseImplication(className, projectPath) {
     // Find BaseBookingImplications.js
     const baseFile = await findFile(projectPath, `${className}.js`);
     
     // Parse it
     const baseContent = await fs.readFile(baseFile, 'utf-8');
     const baseData = extractStaticProperty(baseContent, [platform, screen]);
     
     return baseData;
   }
```

4. **Merge base + overrides** (30 min)
```javascript
   function mergeScreenData(baseData, overrides) {
     return {
       description: overrides.description || baseData.description,
       visible: [...(baseData.visible || []), ...(overrides.visible || [])],
       hidden: [...(baseData.hidden || []), ...(overrides.hidden || [])],
       checks: mergeChecks(baseData.checks, overrides.checks)
     };
   }
```

5. **Test with AcceptedBookingImplications** (45 min)
   - Verify all 12 screens show full data
   - Check visible/hidden element counts match
   - Validate text checks appear

**Success Criteria:**
✅ All screens show descriptions
✅ Visible/hidden elements displayed accurately
✅ Text checks visible
✅ No "Screen validation defined" placeholders

**Priority:** 🔴 CRITICAL - Do this FIRST in Session 2!

**See:** PARSER-IMPROVEMENT-NEEDED.md for detailed implementation

---

## 🛠️ Phase 2: Editing Modes

### Mode Switcher Component

**Create:** `packages/web-app/src/components/ModeSelector.jsx`
```javascript
const modes = [
  { id: 'view', label: 'View', icon: '👁️' },
  { id: 'add-state', label: 'Add State', icon: '➕' },
  { id: 'add-transition', label: 'Add Transition', icon: '🔗' },
  { id: 'edit', label: 'Edit', icon: '✏️' }
];

function ModeSelector({ currentMode, onModeChange }) {
  return (
    <div className="mode-selector">
      {modes.map(mode => (
        <button
          key={mode.id}
          className={currentMode === mode.id ? 'active' : ''}
          onClick={() => onModeChange(mode.id)}
        >
          {mode.icon} {mode.label}
        </button>
      ))}
    </div>
  );
}
```

**Integration:**
- Add to Visualizer.jsx header
- Update graph interactions based on mode
- Show mode-specific instructions

---

## ✏️ Phase 3: Inline Metadata Editing

### Editable Field Component

**Create:** `packages/web-app/src/components/EditableField.jsx`
```javascript
function EditableField({ label, value, onChange, type = 'text' }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  
  if (!isEditing) {
    return (
      <div className="field-view">
        <label>{label}</label>
        <span>{value}</span>
        <button onClick={() => setIsEditing(true)}>✏️</button>
      </div>
    );
  }
  
  return (
    <div className="field-edit">
      <label>{label}</label>
      {type === 'text' && (
        <input 
          value={editValue} 
          onChange={(e) => setEditValue(e.target.value)}
        />
      )}
      {type === 'array' && (
        <TagInput value={editValue} onChange={setEditValue} />
      )}
      <button onClick={() => {
        onChange(editValue);
        setIsEditing(false);
      }}>✅</button>
      <button onClick={() => setIsEditing(false)}>❌</button>
    </div>
  );
}
```

### Update StateDetailModal
```javascript
<DynamicMetadataGrid 
  metadata={state.meta} 
  theme={theme}
  editable={mode === 'edit'}
  onChange={handleMetadataChange}
/>

function handleMetadataChange(field, newValue) {
  setSelectedState(prev => ({
    ...prev,
    meta: {
      ...prev.meta,
      [field]: newValue
    }
  }));
  
  // Mark as dirty
  setHasChanges(true);
}
```

### Save Changes

**Create:** Save button in modal
```javascript
async function handleSave() {
  try {
    await apiClient.post('/api/implications/update', {
      filePath: state.files.implication,
      metadata: state.meta
    });
    
    alert('✅ Changes saved!');
    setHasChanges(false);
  } catch (error) {
    alert('❌ Save failed: ' + error.message);
  }
}
```

**Backend Endpoint:** `packages/api-server/src/routes/implications.js`
```javascript
router.post('/update', async (req, res) => {
  const { filePath, metadata } = req.body;
  
  // Read file
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Parse AST
  const ast = parse(content, { /* ... */ });
  
  // Update xstateConfig.meta
  traverse(ast, {
    ClassProperty(path) {
      if (path.node.key?.name === 'xstateConfig') {
        // Update meta fields
        updateMetaFields(path.node.value, metadata);
      }
    }
  });
  
  // Generate code back
  const newContent = generate(ast).code;
  
  // Backup original
  await fs.copy(filePath, `${filePath}.backup`);
  
  // Write updated file
  await fs.writeFile(filePath, newContent);
  
  res.json({ success: true });
});
```

---

## ➕ Phase 4: Create New State

### Create State Modal

**Create:** `packages/web-app/src/components/CreateStateModal.jsx`
```javascript
function CreateStateModal({ onClose, onCreate, discoveryResult }) {
  const [formData, setFormData] = useState({
    stateName: '',
    status: '',
    triggerButton: '',
    platform: 'mobile-manager',
    requiredFields: [],
    copyFrom: null  // Optional: copy from existing state
  });
  
  const existingStates = discoveryResult.files.implications.map(
    imp => imp.metadata.className
  );
  
  return (
    <div className="modal">
      <h2>➕ Create New State</h2>
      
      <input 
        placeholder="State Name (e.g., Approved)"
        value={formData.stateName}
        onChange={(e) => setFormData({...formData, stateName: e.target.value})}
      />
      
      <input 
        placeholder="Status (e.g., Approved)"
        value={formData.status}
        onChange={(e) => setFormData({...formData, status: e.target.value})}
      />
      
      <select 
        value={formData.platform}
        onChange={(e) => setFormData({...formData, platform: e.target.value})}
      >
        <option value="mobile-manager">📲 Manager App</option>
        <option value="mobile-dancer">📱 Dancer App</option>
        <option value="web">🌐 Web</option>
      </select>
      
      <label>
        Copy structure from existing state:
        <select 
          value={formData.copyFrom || ''}
          onChange={(e) => setFormData({...formData, copyFrom: e.target.value})}
        >
          <option value="">None (blank template)</option>
          {existingStates.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </label>
      
      <TagInput 
        label="Required Fields"
        value={formData.requiredFields}
        onChange={(fields) => setFormData({...formData, requiredFields: fields})}
      />
      
      <div className="actions">
        <button onClick={() => onCreate(formData)}>✅ Create</button>
        <button onClick={onClose}>❌ Cancel</button>
      </div>
    </div>
  );
}
```

### Generate Implication File

**Backend:** `packages/api-server/src/services/generatorService.js`
```javascript
import Handlebars from 'handlebars';
import fs from 'fs-extra';

export async function generateImplication(data) {
  // Load template
  const templatePath = path.join(__dirname, '../../../templates/implication.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);
  
  // Generate code
  const code = template(data);
  
  // Determine file path
  const fileName = `${data.stateName}BookingImplications.js`;
  const filePath = path.join(
    data.projectPath, 
    'tests/implications/bookings/status',
    fileName
  );
  
  // Write file
  await fs.writeFile(filePath, code);
  
  return filePath;
}
```

**Template:** `packages/templates/implication.hbs`
```handlebars
// Auto-generated by Implications Framework

const { assign } = require('xstate');
{{#if copyFrom}}
const {{copyFrom}} = require('./{{copyFrom}}.js');
{{/if}}

class {{stateName}}BookingImplications {
  
  static xstateConfig = {
    meta: {
      status: "{{status}}",
      triggerAction: "{{status}}",
      
      requires: {
        previousStatus: "{{previousStatus}}",
        data: {}
      },
      
      setup: {
        testFile: "tests/implications/bookings/status/{{stateName}}-UNIT.spec.js",
        actionName: "{{actionName}}",
        platform: "{{platform}}"
      },
      
      requiredFields: [
        {{#each requiredFields}}
        "{{this}}"{{#unless @last}},{{/unless}}
        {{/each}}
      ],
      
      triggerButton: "{{triggerButton}}",
      afterButton: null,
      previousButton: null,
      
      notificationKey: "{{status}}"
    },
    
    on: {
      // TODO: Add transitions
    },
    
    entry: assign({
      status: "{{status}}",
      statusLabel: '{{status}}',
      statusCode: '{{status}}'
    })
  };
  
  static mirrorsOn = {
    description: "{{status}} booking status updates",
    
    UI: {
      // TODO: Add UI implications
    }
  };
}

module.exports = {{stateName}}BookingImplications;
```

---

## 🔗 Phase 5: Add Transitions

### Transition Creation Flow

**Mode:** "Add Transition"

**User Action:**
1. Click source state
2. Click target state
3. Fill transition form

**Component:** `packages/web-app/src/components/TransitionForm.jsx`
```javascript
function TransitionForm({ fromState, toState, onSave, onCancel }) {
  const [event, setEvent] = useState('');
  const [platform, setPlatform] = useState('mobile-manager');
  
  return (
    <div className="transition-form">
      <h3>Create Transition</h3>
      <p>{fromState} → {toState}</p>
      
      <input 
        placeholder="Event name (e.g., UNDO)"
        value={event}
        onChange={(e) => setEvent(e.target.value.toUpperCase())}
      />
      
      <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
        <option value="mobile-manager">Manager App</option>
        <option value="mobile-dancer">Dancer App</option>
        <option value="web">Web</option>
      </select>
      
      <div className="actions">
        <button onClick={() => onSave({ event, fromState, toState, platform })}>
          ✅ Add Transition
        </button>
        <button onClick={onCancel}>❌ Cancel</button>
      </div>
    </div>
  );
}
```

### Update Implication File

**Backend:** Update `xstateConfig.on`
```javascript
export async function addTransition(data) {
  const { filePath, event, toState, platform } = data;
  
  const content = await fs.readFile(filePath, 'utf-8');
  const ast = parse(content, { /* ... */ });
  
  traverse(ast, {
    ClassProperty(path) {
      if (path.node.key?.name === 'xstateConfig') {
        // Find 'on' property
        const onProperty = path.node.value.properties.find(
          p => p.key.name === 'on'
        );
        
        // Add new transition
        onProperty.value.properties.push({
          type: 'ObjectProperty',
          key: { type: 'Identifier', name: event },
          value: {
            type: 'ObjectExpression',
            properties: [
              {
                type: 'ObjectProperty',
                key: { type: 'Identifier', name: 'target' },
                value: { type: 'StringLiteral', value: toState }
              },
              {
                type: 'ObjectProperty',
                key: { type: 'Identifier', name: 'meta' },
                value: {
                  type: 'ObjectExpression',
                  properties: [{
                    type: 'ObjectProperty',
                    key: { type: 'Identifier', name: 'platform' },
                    value: { type: 'StringLiteral', value: platform }
                  }]
                }
              }
            ]
          }
        });
      }
    }
  });
  
  const newContent = generate(ast).code;
  await fs.copy(filePath, `${filePath}.backup`);
  await fs.writeFile(filePath, newContent);
}
```

---

## 🧪 Phase 6: Test Generation

### Generate UNIT Test

**Template:** `packages/templates/unit-test.hbs`
```handlebars
// Auto-generated UNIT test for {{stateName}}

const { test, expect } = require('@playwright/test');
const TestContext = require('../../../TestContext');
const {{stateName}}BookingImplications = require('./{{stateName}}BookingImplications');

test.describe('{{stateName}} Booking - Action Tests', () => {
  
  test('should transition booking to {{stateName}}', async ({ page, context }) => {
    // Load test data
    const testData = await TestContext.load('{{previousStatus}}');
    
    // Execute action
    const result = await executeAndSave({
      testDataPath: testData.path,
      implication: {{stateName}}BookingImplications,
      action: async (data) => {
        // TODO: Implement action
        return data;
      }
    });
    
    // Validate state
    expect(result.status).toBe('{{status}}');
    expect(result.statusLabel).toBe('{{status}}');
  });
  
  {{#each requiredFields}}
  test('should require {{this}} field', async () => {
    const testData = {{../stateName}}BookingImplications.createTestData();
    delete testData.{{this}};
    
    expect(() => {
      {{../stateName}}BookingImplications.validateTestData(testData);
    }).toThrow();
  });
  {{/each}}
  
});
```

### Generate VALIDATION Test

**Template:** `packages/templates/validation-test.hbs`
```handlebars
// Auto-generated VALIDATION test for {{stateName}}

const { test } = require('@playwright/test');
const ExpectImplication = require('../../../ExpectImplication');
const TestContext = require('../../../TestContext');
const {{stateName}}BookingImplications = require('./{{stateName}}BookingImplications');

test.describe('{{stateName}} Booking - UI Validation', () => {
  
  {{#each platforms}}
  test.describe('{{name}} Platform', () => {
    
    {{#each screens}}
    test('{{description}}', async ({ page, context }) => {
      // Load test data
      const testData = await TestContext.load('{{../../stateName}}');
      
      // Validate implications
      await ExpectImplication.validateImplications(
        {{../../stateName}}BookingImplications,
        testData,
        page,
        {
          platform: '{{../name}}',
          screen: '{{name}}'
        }
      );
    });
    {{/each}}
    
  });
  {{/each}}
  
});
```

---

## 📊 Phase 7: Dashboard Enhancements

### Statistics Panel

**Create:** `packages/web-app/src/components/StatsPanel.jsx`
```javascript
function StatsPanel({ discoveryResult }) {
  const stats = {
    totalStates: discoveryResult.files.implications.length,
    statefulStates: discoveryResult.files.implications.filter(i => i.metadata.hasXStateConfig).length,
    totalTransitions: discoveryResult.transitions.length,
    totalScreens: discoveryResult.files.implications.reduce(
      (sum, i) => sum + (i.metadata.uiCoverage?.total || 0), 0
    ),
    platforms: new Set(
      discoveryResult.files.implications
        .map(i => i.metadata.platform)
        .filter(Boolean)
    ).size
  };
  
  return (
    <div className="stats-panel">
      <StatCard icon="📊" label="Total States" value={stats.totalStates} />
      <StatCard icon="⚙️" label="Stateful" value={stats.statefulStates} />
      <StatCard icon="🔗" label="Transitions" value={stats.totalTransitions} />
      <StatCard icon="🖥️" label="UI Screens" value={stats.totalScreens} />
      <StatCard icon="📱" label="Platforms" value={stats.platforms} />
    </div>
  );
}
```

### Filter & Search

**Add to Visualizer:**
```javascript
function FilterPanel({ onFilterChange }) {
  return (
    <div className="filters">
      <input 
        placeholder="🔍 Search states..."
        onChange={(e) => onFilterChange({ search: e.target.value })}
      />
      
      <select onChange={(e) => onFilterChange({ platform: e.target.value })}>
        <option value="">All Platforms</option>
        <option value="mobile-manager">📲 Manager</option>
        <option value="mobile-dancer">📱 Dancer</option>
        <option value="web">🌐 Web</option>
      </select>
      
      <select onChange={(e) => onFilterChange({ hasTests: e.target.value })}>
        <option value="">All States</option>
        <option value="true">With Tests</option>
        <option value="false">Without Tests</option>
      </select>
    </div>
  );
}
```

---

## 🎯 Session 2 Priority Order

### Week 1: Parser Fix
1. ✅ Implement mergeWithBase parsing
2. ✅ Test with all 12 screens
3. ✅ Verify accuracy

### Week 2: Editing
4. ✅ Add mode switcher
5. ✅ Implement inline editing
6. ✅ Add save functionality
7. ✅ Test with real files

### Week 3: Creation
8. ✅ Build create state modal
9. ✅ Implement file generation
10. ✅ Add template system
11. ✅ Test generation flow

### Week 4: Advanced
12. ✅ Add transition creation
13. ✅ Generate test files
14. ✅ Build dashboard
15. ✅ Add filters/search

---

## 📚 Documentation Needed

### For Session 2

1. **EDITING-GUIDE.md** - How to use editing features
2. **GENERATION-GUIDE.md** - Template system, generators
3. **API-REFERENCE.md** - All backend endpoints
4. **TESTING-GUIDE.md** - How to test the framework itself

---

## 🎉 Success Metrics for Session 2

✅ Parser handles 100% of screens accurately
✅ Can edit any metadata field inline
✅ Can create new states from templates
✅ Can add transitions visually
✅ Can generate UNIT and VALIDATION tests
✅ Changes save correctly to files
✅ No data loss (backups work)
✅ UI remains fast and responsive

---

## 🚀 Beyond Session 2

### Future Sessions

**Session 3: Multi-Project Support**
- Project switcher
- Recent projects list
- Project templates
- Import/export config

**Session 4: Advanced Features**
- Undo/redo
- Version control integration
- Diff viewer
- Conflict resolution

**Session 5: Collaboration**
- Share projects
- Real-time collaboration
- Comments/annotations
- Review workflow

**Session 6: AI Integration**
- Auto-generate implications from specs
- Suggest missing validations
- Detect test gaps
- Smart templates

---

**Session 2 starts with PARSER FIX!** This is the foundation for everything else. 🎯