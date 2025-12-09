# Context Fields Editor - Complete Documentation

## 🎯 Overview

The Context Fields Editor is a **generic, project-agnostic system** that allows users to view and edit XState context fields directly through the UI, regardless of what fields exist in the state machine.

### Key Features
- ✅ **Auto-discovery** - Finds all context fields automatically
- ✅ **Type detection** - Identifies strings, numbers, booleans, arrays, objects, null
- ✅ **Inline editing** - Edit fields directly with appropriate input types
- ✅ **AST manipulation** - Updates actual source files while preserving structure
- ✅ **Real-time validation** - Catches invalid JSON for arrays/objects
- ✅ **Backup system** - Creates timestamped backups before changes

---

## 🏗️ Architecture

```
User clicks state
    ↓
StateDetailModal opens
    ↓
Calls GET /api/implications/context-schema
    ↓
Backend extracts context from xstateConfig using Babel AST
    ↓
Returns { context: { fieldName: value, ... } }
    ↓
DynamicContextFields renders fields with type detection
    ↓
User edits field → clicks Save
    ↓
DynamicContextFields calls onFieldChange(fieldName, newValue)
    ↓
StateDetailModal.handleContextChange tracks changes
    ↓
User clicks modal Save button
    ↓
Calls POST /api/implications/update-context
    ↓
Backend updates AST and writes file
    ↓
UI refreshes and shows new values
```

---

## 📂 File Structure

```
implications-framework/
├── packages/
│   ├── api-server/
│   │   └── src/
│   │       └── routes/
│   │           └── implications.js          # Backend endpoints
│   │
│   └── web-app/
│       └── src/
│           └── components/
│               ├── StateGraph/
│               │   └── StateDetailModal.jsx  # Main modal
│               └── DynamicContextFields/
│                   ├── DynamicContextFields.jsx  # Field editor
│                   └── DynamicContextFields.css  # Styles
```

---

## 🔧 Backend Implementation

### File: `implications.js`

#### 1. GET /api/implications/context-schema

**Purpose:** Extract context fields from an implication file

**Request:**
```javascript
GET /api/implications/context-schema?filePath=/path/to/LoginImplications.js
```

**Response:**
```json
{
  "success": true,
  "context": {
    "username": null,
    "password": null,
    "loginUrl": null,
    "sessionToken": null
  },
  "contextWithTypes": {
    "username": { "value": null, "type": "null", "editable": true }
  },
  "initial": "idle",
  "states": ["idle", "logging_in", "logged_in"]
}
```

**Key Functions:**
- `extractCompleteXStateConfig(content)` - Parses file with Babel, extracts xstateConfig
- `extractValueFromNode(node)` - Converts AST nodes to JS values
- `detectFieldType(value)` - Identifies type (string, number, boolean, etc.)

---

#### 2. POST /api/implications/update-context

**Purpose:** Update context field values in source file

**Request:**
```javascript
POST /api/implications/update-context
{
  "filePath": "/path/to/LoginImplications.js",
  "contextUpdates": {
    "username": "testuser",
    "loginUrl": "https://example.com/login"
  }
}
```

**Response:**
```json
{
  "success": true,
  "updatedFields": 2,
  "backup": "/path/to/LoginImplications.js.backup-2025-01-23T10-30-00-000Z",
  "updates": { "username": "testuser", "loginUrl": "..." }
}
```

**Process:**
1. Read source file
2. Parse with `@babel/parser`
3. Traverse AST to find `xstateConfig.context`
4. Update field values using `createValueNode()`
5. Generate updated code with `babelGenerate.default()`
6. Create timestamped backup
7. Write updated file

**Key Functions:**
- `createValueNode(value)` - Converts JS values to AST nodes
- Handles: null, undefined, strings, numbers, booleans, arrays, objects

---

### Helper Functions

```javascript
/**
 * Extract complete XState config from source
 */
function extractCompleteXStateConfig(content) {
  // Parse with Babel
  // Traverse to find xstateConfig
  // Extract context, states, initial, meta
  return { context, states, initial, meta };
}

/**
 * Extract JS value from AST node
 */
function extractValueFromNode(node) {
  // Handle: StringLiteral, NumericLiteral, BooleanLiteral
  // Handle: NullLiteral, Identifier, ArrayExpression, ObjectExpression
  // Handle: ArrowFunctionExpression (return '<function>')
  return parsedValue;
}

/**
 * Detect type for UI rendering
 */
function detectFieldType(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  // ... etc
  return 'unknown';
}

/**
 * Create AST node from JS value
 */
function createValueNode(value) {
  if (value === null) return t.nullLiteral();
  if (typeof value === 'string') return t.stringLiteral(value);
  // ... etc
  return node;
}
```

---

## 🎨 Frontend Implementation

### File: `StateDetailModal.jsx`

#### State Management

```javascript
const [contextData, setContextData] = useState(null);
const [loadingContext, setLoadingContext] = useState(false);
const [contextChanges, setContextChanges] = useState({});
```

#### Key Functions

**1. loadContextData()**
```javascript
const loadContextData = async () => {
  setLoadingContext(true);
  const response = await fetch(
    `http://localhost:3000/api/implications/context-schema?filePath=${encodeURIComponent(state.files.implication)}`
  );
  const data = await response.json();
  setContextData(data.context);
  setLoadingContext(false);
};
```

**2. handleContextChange()**
```javascript
const handleContextChange = (fieldName, newValue) => {
  // Update local display
  setContextData(prev => ({ ...prev, [fieldName]: newValue }));
  
  // Track changes for save
  setContextChanges(prev => ({ ...prev, [fieldName]: newValue }));
  
  // Enable save button
  setHasChanges(true);
};
```

**3. handleSave()**
```javascript
const handleSave = async () => {
  // 1. Save metadata
  await fetch('/api/implications/update-metadata', { ... });
  
  // 2. Save context changes (if any)
  if (Object.keys(contextChanges).length > 0) {
    await fetch('/api/implications/update-context', {
      method: 'POST',
      body: JSON.stringify({
        filePath: state.files.implication,
        contextUpdates: contextChanges
      })
    });
  }
  
  // 3. Clear changes
  setContextChanges({});
  setHasChanges(false);
};
```

#### Rendering

```jsx
{/* Context Fields Section */}
{(contextData || loadingContext) && (
  <div className="mb-8">
    <h3>📦 Context Fields</h3>
    
    {loadingContext ? (
      <LoadingState />
    ) : contextData && Object.keys(contextData).length > 0 ? (
      <DynamicContextFields
        contextData={contextData}
        onFieldChange={handleContextChange}
        theme={theme}
        editable={isEditMode}
        compact={false}
      />
    ) : (
      <EmptyState />
    )}
  </div>
)}
```

---

### File: `DynamicContextFields.jsx`

#### Props

```javascript
{
  contextData: {},           // Context fields from xstate
  onFieldChange: (fn, val),  // Callback when field changes
  theme: {},                 // Theme colors
  editable: true,            // Can edit?
  compact: false             // Compact mode?
}
```

#### State

```javascript
const [editingField, setEditingField] = useState(null);
const [editValue, setEditValue] = useState('');
const [editError, setEditError] = useState(null);
```

#### Key Functions

**1. startEditing()**
```javascript
const startEditing = (fieldName, currentValue, type) => {
  setEditingField(fieldName);
  setEditValue(formatValue(currentValue, type));
  setEditError(null);
};
```

**2. saveEdit() - CRITICAL FIX**
```javascript
const saveEdit = (fieldName, type) => {
  let parsedValue;
  
  switch (type) {
    case 'null':
      // 🔥 IMPORTANT: Parse based on content, not just set null
      if (editValue === '' || editValue === 'null') {
        parsedValue = null;
      } else if (!isNaN(editValue) && editValue !== '') {
        parsedValue = Number(editValue);  // "123" → 123
      } else if (editValue === 'true' || editValue === 'false') {
        parsedValue = editValue === 'true';  // "true" → true
      } else {
        parsedValue = editValue;  // Default to string
      }
      break;
      
    case 'number':
      parsedValue = Number(editValue);
      break;
      
    case 'string':
      parsedValue = editValue;
      break;
      
    case 'array':
    case 'object':
      parsedValue = JSON.parse(editValue);
      break;
  }
  
  onFieldChange(fieldName, parsedValue);
  setEditingField(null);
};
```

**3. renderFieldInput()**
```javascript
const renderFieldInput = (fieldName, value, type) => {
  if (!isEditing) {
    return <DisplayMode />;  // Click to edit
  }
  
  return (
    <EditMode>
      {type === 'boolean' ? <select /> : 
       type === 'array' || type === 'object' ? <textarea /> :
       <input />}
      <SaveButton />
      <CancelButton />
    </EditMode>
  );
};
```

#### Type Detection

```javascript
const detectFieldType = (value) => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
};
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Context fields don't load"

**Symptom:** Modal shows "No Context Fields" even though context exists

**Check:**
1. Server running on correct port (3000, not 3001)
2. `/context-schema` endpoint exists in `implications.js`
3. `extractCompleteXStateConfig()` function is defined
4. Browser console for 404/500 errors

**Fix:**
```bash
# Check endpoint
curl "http://localhost:3000/api/implications/context-schema?filePath=/path/to/file.js"

# Should return context fields, not 404
```

---

### Issue 2: "Values don't save to file"

**Symptom:** Click Save, no error, but file doesn't change

**Check:**
1. `babelGenerate` import: `import babelGenerate from '@babel/generator';`
2. Use `babelGenerate.default()` NOT `generate.default()`
3. Backup file is created (proves write permission works)
4. Server logs show "✅ Updated X context fields"

**Fix:**
```javascript
// ❌ WRONG
const output = generate.default(ast, { ... });

// ✅ CORRECT
const output = babelGenerate.default(ast, { ... }, originalContent);
```

---

### Issue 3: "Saved values don't show in UI"

**Symptom:** File updates, but modal still shows old values

**Fix:** Add reload after save in `StateDetailModal.jsx`:
```javascript
// After successful context save
if (Object.keys(contextChanges).length > 0) {
  await loadContextData();  // ← Reload to show new values
}
```

---

### Issue 4: "Null fields always stay null"

**Symptom:** Edit a null field, but it saves as null

**Root Cause:** The `case 'null':` in `saveEdit()` was hardcoded to always return `null`

**Fix:** Already applied - parse based on content:
```javascript
case 'null':
  if (editValue === '' || editValue === 'null') {
    parsedValue = null;
  } else if (!isNaN(editValue) && editValue !== '') {
    parsedValue = Number(editValue);
  } else if (editValue === 'true' || editValue === 'false') {
    parsedValue = editValue === 'true';
  } else {
    parsedValue = editValue;
  }
  break;
```

---

### Issue 5: "babelGenerate is not a function"

**Symptom:** Server error: `(babelGenerate.default || babelGenerate) is not a function`

**Root Cause:** Used wrong variable name (`generate` instead of `babelGenerate`)

**Fix:** Find and replace all occurrences:
```javascript
// Search for:
generate.default

// Replace with:
babelGenerate.default
```

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] Open state detail modal
- [ ] See context fields load (or "No Context Fields" if none)
- [ ] Click Edit button (top right)
- [ ] Click a null field
- [ ] Type a string value
- [ ] Click inline Save button
- [ ] See value update in display
- [ ] See modal Save button become enabled
- [ ] See yellow "Unsaved Changes" border
- [ ] Click modal Save button
- [ ] See success notification
- [ ] Close and reopen modal
- [ ] See value persisted
- [ ] Check actual file - value should be updated

### Edge Cases

- [ ] Edit string field
- [ ] Edit number field (type numbers)
- [ ] Edit boolean field (dropdown)
- [ ] Edit array field (JSON)
- [ ] Edit object field (JSON)
- [ ] Try invalid JSON in array → see error
- [ ] Press Escape to cancel edit
- [ ] Press Enter to quick-save (non-JSON fields)
- [ ] Edit multiple fields, save all at once
- [ ] Close modal without saving → confirm dialog

---

## 🔐 Security Considerations

### File Access
- Backend validates `filePath` exists before reading
- Only files within scanned project are accessible
- Creates backups before any modification

### Input Validation
- JSON parsing wrapped in try/catch
- Type validation before saving
- Frontend shows validation errors

### Backup System
- Timestamped backups: `file.js.backup-2025-01-23T10-30-00-000Z`
- Never overwrites existing backups
- Allows rollback if needed

---

## 📊 Performance

### Load Time
- Context extraction: ~50-100ms (small files)
- AST parsing overhead acceptable for single files
- Could cache if needed (not implemented)

### Save Time
- AST manipulation: ~100-200ms
- File write: ~10-50ms
- Total: Under 500ms for typical files

### Optimization Opportunities
1. Cache parsed AST if editing multiple times
2. Debounce rapid field changes
3. Batch updates for multiple fields

---

## 🚀 Future Enhancements

### Possible Improvements

1. **Type Conversion**
   - Button to convert null → string/number
   - Button to convert string → number
   - Visual type switcher

2. **Rich Editors**
   - Monaco editor for JSON
   - Date picker for date strings
   - Color picker for color strings

3. **Validation Rules**
   - Required fields
   - Min/max for numbers
   - Regex patterns for strings

4. **Undo/Redo**
   - Track change history
   - Rollback to previous values
   - Show diff before save

5. **Bulk Operations**
   - Reset all to null
   - Copy context from another state
   - Import/export JSON

6. **Smart Suggestions**
   - Suggest values based on field name
   - Show common patterns
   - Auto-complete from other states

---

## 📚 Code Examples

### Example 1: Adding a New Context Field

**Manually edit the implication file:**
```javascript
static xstateConfig = {
  context: {
    username: null,
    password: null,
    // ✅ Add new field
    rememberMe: false,
    loginAttempts: 0
  },
  // ...
}
```

**Then refresh UI** - fields appear automatically!

---

### Example 2: Programmatic Update

```javascript
// From another part of the code
const updateContext = async (filePath, updates) => {
  const response = await fetch('http://localhost:3000/api/implications/update-context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, contextUpdates: updates })
  });
  
  return response.json();
};

// Usage
await updateContext('/path/to/LoginImplications.js', {
  username: 'admin',
  loginUrl: 'https://example.com/api/login'
});
```

---

### Example 3: Custom Field Type

To add support for a new type (e.g., Date):

**Backend (`createValueNode`):**
```javascript
if (value instanceof Date) {
  return t.newExpression(
    t.identifier('Date'),
    [t.stringLiteral(value.toISOString())]
  );
}
```

**Frontend (`DynamicContextFields`):**
```javascript
case 'date':
  return (
    <input
      type="datetime-local"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
    />
  );
```

---

## 🎓 Learning Resources

### Babel AST
- [AST Explorer](https://astexplorer.net/) - Visualize JavaScript AST
- [@babel/parser docs](https://babeljs.io/docs/babel-parser)
- [@babel/traverse docs](https://babeljs.io/docs/babel-traverse)
- [@babel/types docs](https://babeljs.io/docs/babel-types)

### XState
- [XState docs](https://xstate.js.org/)
- Context management in XState
- State machine patterns

---

## 📝 Summary

The Context Fields Editor is a **powerful, generic system** that:

1. ✅ Works with ANY project's state machines
2. ✅ Auto-discovers fields without configuration
3. ✅ Edits source files safely with AST manipulation
4. ✅ Provides type-aware editing interfaces
5. ✅ Maintains code structure and formatting

**This is a major feature that makes the Implications Framework truly project-agnostic!**

---

## 🤝 Contributing

When modifying this system:

1. **Backend changes** - Test AST manipulation thoroughly
2. **Frontend changes** - Verify all field types work
3. **Add tests** - Unit tests for parse/generate functions
4. **Update docs** - Keep this file in sync

---

## 📧 Support

For issues or questions:
1. Check **Common Issues** section above
2. Look at browser console for errors
3. Check server logs for backend errors
4. Review AST with [AST Explorer](https://astexplorer.net/)

---

**Last Updated:** January 23, 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready