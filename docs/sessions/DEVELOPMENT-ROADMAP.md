# Implications Framework - Development Roadmap

**Last Updated:** October 22, 2025  
**Current Status:** 65% Complete  
**Next Priority:** Context Field Editing

---

## 🎯 PRIORITY 1: Context Field Editing (CRITICAL)

**Status:** Not Started  
**Effort:** 3 hours  
**User Request:** YES ✅  
**Impact:** HIGH

### Goal
Replace static metadata display with editable context fields as the PRIMARY interface. Users can view AND edit the actual state machine data.

### Implementation Plan

#### Part 1: UI Restructure (1 hour)

**Move Context to Top:**
```jsx
// StateDetailModal.jsx - NEW PRIMARY SECTION

{/* 📦 Context Fields - PRIMARY SECTION */}
<div className="glass p-6 rounded-lg">
  <h2>State Context ({Object.keys(context).length} fields)</h2>
  
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {Object.entries(context).map(([key, value]) => (
      <EditableContextField
        key={key}
        name={key}
        value={value}
        type={inferType(value)}
        onChange={(newValue) => updateContextField(key, newValue)}
        disabled={!editMode}
      />
    ))}
  </div>
  
  <button onClick={saveContext}>💾 Save Changes</button>
</div>

{/* Move old metadata to collapsed "Advanced" section */}
<CollapsibleSection title="⚙️ Advanced Metadata">
  {/* status, triggerAction, etc */}
</CollapsibleSection>
```

**Create EditableContextField Component:**
```jsx
function EditableContextField({ name, value, type, onChange, disabled }) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  
  const handleSave = () => {
    onChange(localValue);
    setEditing(false);
  };
  
  return (
    <div className="field-container">
      <label className="font-mono text-sm">{name}</label>
      {editing ? (
        <>
          <input
            type={type === 'number' ? 'number' : 'text'}
            value={localValue === null ? '' : localValue}
            onChange={(e) => setLocalValue(e.target.value)}
          />
          <button onClick={handleSave}>✅</button>
          <button onClick={() => setEditing(false)}>❌</button>
        </>
      ) : (
        <>
          <div className="value">{formatValue(value, type)}</div>
          <button onClick={() => setEditing(true)}>✏️</button>
        </>
      )}
    </div>
  );
}
```

#### Part 2: Backend API (1.5 hours)

**Add Update Context Endpoint:**
```javascript
// packages/api-server/src/routes/implications.js

router.post('/update-context', async (req, res) => {
  try {
    const { filePath, contextUpdates } = req.body;
    // contextUpdates = { username: "admin", loginUrl: "https://..." }
    
    console.log('🔄 Updating context:', { filePath, updates: Object.keys(contextUpdates) });
    
    // Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse with Babel
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['classProperties', 'objectRestSpread'],
    });
    
    let contextFound = false;
    
    // Traverse and update context
    traverse.default(ast, {
      ClassProperty(path) {
        if (path.node.key?.name === 'xstateConfig' && path.node.static) {
          const configValue = path.node.value;
          
          if (configValue?.type === 'ObjectExpression') {
            // Find context property
            const contextProperty = configValue.properties.find(
              p => p.key?.name === 'context'
            );
            
            if (contextProperty?.value?.type === 'ObjectExpression') {
              contextFound = true;
              
              // Update each field in contextUpdates
              Object.entries(contextUpdates).forEach(([key, value]) => {
                const field = contextProperty.value.properties.find(
                  p => p.key?.name === key
                );
                
                if (field) {
                  // Update existing field
                  field.value = createValueNode(value);
                  console.log(`  ✅ Updated ${key}: ${value}`);
                } else {
                  // Add new field
                  contextProperty.value.properties.push({
                    type: 'ObjectProperty',
                    key: { type: 'Identifier', name: key },
                    value: createValueNode(value)
                  });
                  console.log(`  ➕ Added ${key}: ${value}`);
                }
              });
            }
          }
        }
      }
    });
    
    if (!contextFound) {
      return res.status(400).json({ error: 'No context found in xstateConfig' });
    }
    
    // Generate updated code
    const { code: newCode } = (babelGenerate.default || babelGenerate)(ast, {
      retainLines: true,
      comments: true
    });
    
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;
    await fs.copy(filePath, backupPath);
    
    // Write updated file
    await fs.writeFile(filePath, newCode, 'utf-8');
    
    console.log('✅ Context updated successfully');
    
    res.json({
      success: true,
      updated: Object.keys(contextUpdates),
      backup: backupPath
    });
    
  } catch (error) {
    console.error('❌ Update context failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Create AST node from value
function createValueNode(value) {
  if (value === null) {
    return { type: 'NullLiteral' };
  }
  if (typeof value === 'string') {
    return { type: 'StringLiteral', value };
  }
  if (typeof value === 'number') {
    return { type: 'NumericLiteral', value };
  }
  if (typeof value === 'boolean') {
    return { type: 'BooleanLiteral', value };
  }
  return { type: 'NullLiteral' };
}
```

#### Part 3: Integration (30 min)

**Wire up Visualizer:**
```javascript
const handleContextUpdate = async (contextUpdates) => {
  try {
    const response = await fetch(`${API_URL}/api/implications/update-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: selectedState.files.implication,
        contextUpdates
      })
    });
    
    if (!response.ok) throw new Error('Update failed');
    
    alert('✅ Context updated!');
    
    // Re-scan to reload data
    handleScan();
    
  } catch (error) {
    alert(`❌ ${error.message}`);
  }
};
```

### Files to Modify
1. `packages/web-app/src/components/StateGraph/StateDetailModal.jsx` - UI
2. `packages/api-server/src/routes/implications.js` - API endpoint
3. `packages/web-app/src/pages/Visualizer.jsx` - Handler

### Success Criteria
- ✅ Context fields shown at top of modal
- ✅ Click field to edit
- ✅ Type validation (string, number, boolean, null)
- ✅ Save updates file with backup
- ✅ Changes visible after re-scan

---

## 🎯 PRIORITY 2: Test Generation (Original Phase 4)

**Status:** 30% Complete  
**Effort:** 5 hours  
**User Request:** No  
**Impact:** HIGH

### Goal
Auto-generate test files from implication definitions.

### What to Build

#### Part 1: Template System (2 hours)

**Create Templates:**
```handlebars
{{! packages/api-server/templates/unit-test.hbs }}
// Auto-generated test for {{stateName}}
// Generated: {{timestamp}}

const { test, expect } = require('@playwright/test');
const TestContext = require('../../../core/TestContext');
const {{className}} = require('../../../implications/{{filePath}}');

test.describe('{{displayName}} - {{action}}', () => {
  
  test('should transition from {{previousState}} to {{stateName}}', async ({ page }) => {
    // Load test data
    const ctx = TestContext.load('{{testDataPath}}', {{className}});
    
    // Execute action
    await {{actionName}}(page, ctx);
    
    // Validate state
    await ExpectImplication.validate({{className}}, ctx, page);
    
    // Check context fields
    {{#each requiredFields}}
    expect(ctx.data.{{this}}).toBeDefined();
    {{/each}}
  });
  
  test('should display correct UI elements', async ({ page }) => {
    const ctx = TestContext.load('{{testDataPath}}', {{className}});
    
    {{#each uiElements}}
    await expect(page.locator('{{this}}')).toBeVisible();
    {{/each}}
  });
  
});
```

#### Part 2: Generator Service (2 hours)

```javascript
// packages/api-server/src/services/generatorService.js

export async function generateUnitTest(implication, options = {}) {
  const metadata = implication.metadata;
  
  // Prepare template data
  const templateData = {
    stateName: metadata.status,
    className: metadata.className,
    displayName: metadata.status || metadata.className,
    action: metadata.triggerAction || 'transition',
    actionName: metadata.setup?.actionName || 'performAction',
    requiredFields: metadata.requiredFields || [],
    uiElements: extractUIElements(metadata.uiCoverage),
    testDataPath: `test-data/${metadata.status}.json`,
    filePath: implication.path,
    timestamp: new Date().toISOString(),
    previousState: metadata.requires?.previousStatus || 'unknown'
  };
  
  // Load template
  const templatePath = path.join(__dirname, '../templates/unit-test.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);
  
  // Generate code
  const code = template(templateData);
  
  // Determine output path
  const testFileName = `${metadata.status}-UNIT.spec.js`;
  const outputPath = path.join(
    options.projectPath,
    'tests/generated',
    testFileName
  );
  
  return { code, outputPath, metadata: templateData };
}
```

#### Part 3: UI Integration (1 hour)

**Add to StateDetailModal:**
```jsx
<button onClick={() => handleGenerateTests(state)}>
  🧪 Generate Tests
</button>

// Handler in Visualizer
const handleGenerateTests = async (state) => {
  const response = await fetch(`${API_URL}/api/generator/unit-test`, {
    method: 'POST',
    body: JSON.stringify({
      implicationPath: state.files.implication,
      projectPath: projectPath
    })
  });
  
  const result = await response.json();
  
  // Show preview modal
  setGeneratedCode(result.code);
  setShowPreviewModal(true);
};
```

### Files to Create
1. `packages/api-server/src/templates/unit-test.hbs`
2. `packages/api-server/src/services/generatorService.js`
3. `packages/api-server/src/routes/generator.js`
4. `packages/web-app/src/components/CodePreviewModal.jsx`

### Success Criteria
- ✅ Generate UNIT test from implication
- ✅ Preview generated code
- ✅ Save to file with one click
- ✅ Tests are runnable with Playwright

---

## 🎯 PRIORITY 3: Enhanced State Creation

**Status:** 60% Complete  
**Effort:** 3 hours  
**User Request:** No  
**Impact:** MEDIUM

### Improvements Needed

1. **Visual State Creator** (2 hours)
   - Canvas-based UI
   - Drag to place state
   - Click to edit
   - Visual transition drawing

2. **Smart Defaults** (30 min)
   - Auto-detect pattern from neighbors
   - Suggest field names based on similar states
   - Copy structure from selected state

3. **Better Validation** (30 min)
   - Check duplicate state names
   - Validate transition targets exist
   - Show preview before creation

---

## 🎯 PRIORITY 4: Backup Management

**Status:** 0% Complete  
**Effort:** 2 hours  
**User Request:** No  
**Impact:** LOW

### Features

1. **Backup Browser** (1.5 hours)
   ```jsx
   <BackupManager filePath={state.files.implication}>
     <BackupList>
       <BackupItem timestamp="2025-10-22T10:30:00Z" />
       <BackupItem timestamp="2025-10-22T10:15:00Z" />
     </BackupList>
     <BackupActions>
       <button>Compare</button>
       <button>Restore</button>
       <button>Delete</button>
     </BackupActions>
   </BackupManager>
   ```

2. **Auto-Cleanup** (30 min)
   - Keep only last 10 backups per file
   - Delete backups older than 7 days
   - Configurable in settings

---

## 🎯 PRIORITY 5: Advanced Graph Features

**Status:** 40% Complete  
**Effort:** 4 hours  
**User Request:** No  
**Impact:** MEDIUM

### Features

1. **Layout Options** (2 hours)
   - Hierarchical (dagre)
   - Circular (cytoscape-circular)
   - Force-directed (cytoscape-cose)
   - Manual (drag nodes, save positions)

2. **Filtering** (1 hour)
   - Filter by pattern (booking/cms)
   - Filter by platform
   - Search by name
   - Hide/show transitions

3. **Mini-map** (1 hour)
   - Overview panel
   - Navigate large graphs
   - Current viewport indicator

---

## 🎯 PRIORITY 6: Test Runner (Original Phase 6)

**Status:** 0% Complete  
**Effort:** 6 hours  
**User Request:** No  
**Impact:** HIGH

### Features

1. **Test Execution** (3 hours)
   - Run tests from UI
   - Live output streaming via WebSocket
   - Stop/restart controls

2. **Results Viewer** (2 hours)
   - Pass/fail status
   - Error messages
   - Screenshots on failure
   - Video playback

3. **Test History** (1 hour)
   - Previous run results
   - Trends over time
   - Compare runs

---

## 📊 Progress Tracking

### Phase Completion

| Phase | Status | Progress | Priority |
|-------|--------|----------|----------|
| Phase 1: Foundation | ✅ Complete | 100% | - |
| Phase 2: Discovery | ✅ Complete | 100% | - |
| Phase 3: Analysis | ✅ Complete | 100% | - |
| Phase 4: Generation | 🚧 In Progress | 30% | P2 |
| Phase 5: Visualization | ✅ Complete | 95% | P1 (editing) |
| Phase 6: Test Runner | 📋 Not Started | 0% | P6 |
| Phase 7: Polish | 📋 Not Started | 0% | Last |

### Feature Completion

| Feature | Status | Priority |
|---------|--------|----------|
| Context Viewing | ✅ Done | - |
| Context Editing | 📋 Next | P1 |
| Transition Adding | ✅ Done | - |
| Transition Editing | 📋 Later | P3 |
| Test Generation | 📋 Next | P2 |
| State Creation | 🚧 Partial | P3 |
| Backup Management | 📋 Later | P4 |
| Graph Layouts | 📋 Later | P5 |
| Test Runner | 📋 Later | P6 |

---

## 🎯 Recommended Development Order

### Next 3 Sessions

**Session 12: Context Field Editing (3 hours)**
- Implement editable context fields
- API endpoint for updates
- Type validation
- Result: Complete CRUD for state machines

**Session 13: Test Generation Part 1 (3 hours)**
- Create templates system
- Build generator service
- Generate UNIT tests
- Result: Auto-generate basic tests

**Session 14: Test Generation Part 2 (2 hours)**
- Add test preview UI
- Generate VALIDATION tests
- Batch generation
- Result: Complete test generation system

### After That

**Option A: Production Focus**
- Polish UI/UX
- Add comprehensive docs
- Create video tutorials
- Deploy to production

**Option B: Feature Expansion**
- Test runner
- Advanced graph features
- Multi-project support
- Backup management

---

## 🎓 Technical Debt

### Known Issues

1. **Pattern Analysis Returns 0 Fields**
   - Context fields not being analyzed
   - Need to integrate with patterns service

2. **No Undo/Redo**
   - All edits are destructive (except backups)
   - Consider implementing command pattern

3. **No Field Type Inference**
   - All context fields treated as generic
   - Should detect: email, url, date, etc.

4. **Large Graphs Performance**
   - 100+ nodes get slow
   - Need virtualization or lazy loading

### Refactoring Needed

1. **State Management**
   - Currently using React useState everywhere
   - Consider Zustand or Redux for complex state

2. **API Client**
   - Direct fetch calls in components
   - Create centralized API service

3. **Type Safety**
   - Add TypeScript
   - Generate types from schemas

---

## 💡 Future Ideas (Not Prioritized)

- Import/export state machines (JSON)
- Visual diff between versions
- Collaborative editing (multi-user)
- AI-assisted test generation
- Integration with CI/CD
- Mobile app for viewing
- Plugins system
- Custom themes
- Dark mode
- Keyboard shortcuts

---

## 📈 Success Metrics

### Definition of Done

**Minimum Viable Product (MVP):**
- ✅ Discover and visualize state machines
- ✅ View state details
- 🚧 Edit state definitions (90% done - just context editing left!)
- ❌ Generate tests
- ❌ Run tests

**Production Ready:**
- 🚧 All MVP features (one feature away!)
- ❌ Comprehensive docs
- ❌ Video tutorials
- ❌ Example projects
- ❌ Deployment guide

**Complete Vision:**
- All above +
- Test runner
- Advanced features
- Plugins
- Community

### Current Status: **80% to MVP, 60% to Production Ready**

---

*Roadmap Version: 2.0*  
*Last Updated: October 22, 2025*  
*Next Review: After Session 12*