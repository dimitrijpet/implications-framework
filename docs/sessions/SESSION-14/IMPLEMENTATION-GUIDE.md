# 🎯 Context Field Management - Complete Implementation Guide

## 📋 Overview

This guide walks you through implementing **Add/Delete Context Fields** with **Auto-Suggestions** for both StateDetailModal and AddStateModal.

### ✨ New Features
1. **➕ Add new context fields** with type selector
2. **🗑️ Delete existing fields** with confirmation  
3. **💡 Auto-suggest from mirrorsOn** - detects {{variables}} in UI checks
4. **🎨 Pattern-based suggestions** - suggests common fields from existing states
5. **🔄 Unified experience** - same component in both modals

---

## 📦 Files to Update

### Frontend (3 files)
1. ✅ `packages/web-app/src/components/DynamicContextFields/DynamicContextFields.jsx`
2. ✅ `packages/web-app/src/components/StateGraph/StateDetailModal.jsx`
3. ✅ `packages/web-app/src/components/AddStateModal/AddStateModal.jsx`

### Backend (1 file)
4. ✅ `packages/api-server/src/routes/implications.js`

---

## 🚀 Step-by-Step Implementation

### STEP 1: Replace DynamicContextFields.jsx

**File:** `packages/web-app/src/components/DynamicContextFields/DynamicContextFields.jsx`

**Action:** Replace entire file with `DynamicContextFields-Enhanced.jsx`

**What's new:**
- `onFieldAdd` prop - callback to add new fields
- `onFieldDelete` prop - callback to delete fields
- `suggestedFields` prop - array of suggested fields to add
- Add Field Form with validation
- Delete button on each field (shows on hover)
- Suggested fields banner with "Add All" button
- Type selector: null, string, number, boolean, array, object

**Key changes:**
```jsx
<DynamicContextFields
  contextData={contextData}
  onFieldChange={handleContextChange}
  onFieldAdd={handleAddField}           // NEW
  onFieldDelete={handleDeleteField}      // NEW
  suggestedFields={suggestions}          // NEW
  theme={theme}
  editable={isEditMode}
/>
```

---

### STEP 2: Add Backend Endpoints

**File:** `packages/api-server/src/routes/implications.js`

**Action:** Add 3 new endpoints from `implications-backend-additions.js`

**Endpoints to add:**

#### 2.1 Add Context Field
```javascript
router.post('/add-context-field', async (req, res) => {
  // Adds new field to xstateConfig.context
  // Creates backup
  // Returns success + backup path
});
```

#### 2.2 Delete Context Field
```javascript
router.post('/delete-context-field', async (req, res) => {
  // Removes field from xstateConfig.context
  // Creates backup
  // Returns success + backup path
});
```

#### 2.3 Extract mirrorsOn Variables
```javascript
router.get('/extract-mirrorson-variables', async (req, res) => {
  // Parses mirrorsOn to find {{variable}} patterns
  // Compares with existing context
  // Returns missing fields as suggestions
});
```

**Helper function:**
```javascript
function createValueNode(value) {
  // Converts JS value to Babel AST node
  // Handles: null, string, number, boolean, array, object
}
```

**Where to add:**
- Find the existing `/update-context` endpoint
- Add these 3 new endpoints right after it
- Copy the `createValueNode` helper function too

---

### STEP 3: Update StateDetailModal.jsx

**File:** `packages/web-app/src/components/StateGraph/StateDetailModal.jsx`

**Action:** Add new handlers and update DynamicContextFields usage

**Changes needed:**

#### 3.1 Add new state
```javascript
const [suggestedFields, setSuggestedFields] = useState([]);
const [loadingSuggestions, setLoadingSuggestions] = useState(false);
```

#### 3.2 Add loadMirrorsOnSuggestions function
```javascript
const loadMirrorsOnSuggestions = async () => {
  // Fetches from /extract-mirrorson-variables
  // Sets suggestedFields state
};
```

#### 3.3 Add effect to load suggestions
```javascript
useEffect(() => {
  if (state?.files?.implication && isEditMode) {
    loadMirrorsOnSuggestions();
  }
}, [state?.files?.implication, isEditMode]);
```

#### 3.4 Add handleAddContextField
```javascript
const handleAddContextField = async (fieldName, initialValue, fieldType) => {
  // Calls /add-context-field endpoint
  // Reloads context data
  // Reloads suggestions
  // Shows success message
};
```

#### 3.5 Add handleDeleteContextField
```javascript
const handleDeleteContextField = async (fieldName) => {
  // Calls /delete-context-field endpoint
  // Updates local state
  // Reloads suggestions
  // Shows success message
};
```

#### 3.6 Update DynamicContextFields props
```javascript
<DynamicContextFields
  contextData={contextData}
  onFieldChange={handleContextChange}
  onFieldAdd={isEditMode ? handleAddContextField : null}      // NEW
  onFieldDelete={isEditMode ? handleDeleteContextField : null} // NEW
  suggestedFields={isEditMode ? suggestedFields : []}         // NEW
  theme={theme}
  editable={isEditMode}
  compact={false}
/>
```

**See:** `StateDetailModal-Integration.jsx` for complete code

---

### STEP 4: Update AddStateModal.jsx (Optional but Recommended)

**File:** `packages/web-app/src/components/AddStateModal/AddStateModal.jsx`

**Action:** Add context field management to state creation

**Why:** So users can define context when creating a state (not just editing)

**Changes needed:**

#### 4.1 Add contextFields to formData
```javascript
const [formData, setFormData] = useState({
  // ... existing fields ...
  contextFields: {}  // NEW
});
```

#### 4.2 Add context suggestions
```javascript
const [contextSuggestions, setContextSuggestions] = useState([]);

useEffect(() => {
  if (analysis?.fields?.context) {
    // Extract common context fields from pattern analysis
    const suggestions = analysis.fields.context
      .filter(f => parseFloat(f.frequency) > 0.3)
      .map(f => ({
        name: f.field,
        reason: `Used in ${f.percentage} of existing states`,
        from: 'patterns'
      }));
    setContextSuggestions(suggestions);
  }
}, [analysis]);
```

#### 4.3 Add handlers
```javascript
const handleAddContextField = (fieldName, initialValue, fieldType) => {
  setFormData(prev => ({
    ...prev,
    contextFields: {
      ...prev.contextFields,
      [fieldName]: initialValue
    }
  }));
};

const handleChangeContextField = (fieldName, newValue) => {
  setFormData(prev => ({
    ...prev,
    contextFields: {
      ...prev.contextFields,
      [fieldName]: newValue
    }
  }));
};

const handleDeleteContextField = (fieldName) => {
  setFormData(prev => {
    const updated = { ...prev.contextFields };
    delete updated[fieldName];
    return { ...prev, contextFields: updated };
  });
};
```

#### 4.4 Add Context section to form
```jsx
{(mode === 'custom' || showAdvanced) && (
  <div className="mb-6">
    <h3>📦 Context Fields</h3>
    <p>Define state data (optional - can add later)</p>
    
    <DynamicContextFields
      contextData={formData.contextFields}
      onFieldChange={handleChangeContextField}
      onFieldAdd={handleAddContextField}
      onFieldDelete={handleDeleteContextField}
      suggestedFields={contextSuggestions}
      theme={theme}
      editable={true}
    />
  </div>
)}
```

#### 4.5 Update create-state endpoint
Backend needs to include context when generating file:
```javascript
// In /create-state endpoint
const context = req.body.context || {};

// In template:
static xstateConfig = {
  context: ${JSON.stringify(context, null, 2)},
  // ...
}
```

**See:** `AddStateModal-Integration.jsx` for complete code

---

## ✅ Testing Checklist

### Context Field Editing (StateDetailModal)
- [ ] Can view existing context fields
- [ ] Can edit field values (click to edit, save/cancel)
- [ ] Edit mode shows add/delete buttons
- [ ] View mode hides add/delete buttons

### Add New Field
- [ ] Click "➕ Add Context Field" button shows form
- [ ] Can enter field name (validates JS identifier)
- [ ] Can select type (null, string, number, boolean, array, object)
- [ ] Shows error for invalid names (duplicates, reserved keywords)
- [ ] Enter key adds field, Escape cancels
- [ ] Field appears immediately after adding
- [ ] Creates backup file

### Delete Field
- [ ] Hover over field shows "🗑️" button
- [ ] Click delete shows confirmation dialog
- [ ] Confirm removes field immediately
- [ ] Cancel keeps field
- [ ] Creates backup file

### Auto-Suggestions from mirrorsOn
- [ ] Suggestions banner appears when fields missing
- [ ] Shows fields used in UI checks but not in context
- [ ] Shows reason (e.g., "Used in mirrorsOn checks")
- [ ] Click individual field adds that field
- [ ] Click "Add All" adds all suggested fields
- [ ] Suggestions disappear after adding fields

### Pattern-Based Suggestions (AddStateModal)
- [ ] Shows common fields from existing states
- [ ] Shows usage percentage
- [ ] Can add suggested fields
- [ ] Suggestions update when pattern analysis loads

### State Creation with Context (AddStateModal)
- [ ] Context section appears in custom/advanced mode
- [ ] Can add fields before creating state
- [ ] Can edit/delete fields before creating state
- [ ] Created state file includes context
- [ ] Copying state also copies context

---

## 🎨 User Experience Flow

### Scenario 1: Editing Existing State

1. User clicks state in graph
2. StateDetailModal opens showing context fields
3. User clicks "Edit Mode"
4. 💡 Suggestions banner appears: "Add 2 missing fields from UI checks"
5. User sees fields used in mirrorsOn: `username`, `accountBalance`
6. User clicks "✨ Add All (2)"
7. Both fields added with type `null`
8. User can now edit values or leave as null
9. User clicks "Save"
10. File updates with new context fields

### Scenario 2: Creating New State

1. User clicks "Add State"
2. Fills in basic info (name, platform, button)
3. Clicks "Show Advanced"
4. 📦 Context Fields section appears
5. 💡 Suggestions show: "username (used in 80% of states)"
6. User clicks suggested field to add it
7. Adds custom field manually: `sessionToken` (null)
8. Clicks "Create State"
9. New state file generated with context included

### Scenario 3: Deleting Unused Field

1. User opens state in edit mode
2. Sees field `oldFieldName` that's no longer needed
3. Hovers over field → 🗑️ button appears
4. Clicks delete
5. Confirmation: "Delete field 'oldFieldName'?"
6. Confirms
7. Field removed from file (backup created)
8. Suggestions updated if field was in mirrorsOn

---

## 🔧 Troubleshooting

### Issue: Suggestions not showing
**Check:**
- Is edit mode enabled?
- Does implication have mirrorsOn defined?
- Are {{variables}} used in mirrorsOn?
- Are those variables already in context?

**Fix:** Check browser console for API errors

### Issue: Can't add field
**Check:**
- Is field name valid JS identifier?
- Is field name already in context?
- Is backend endpoint working?

**Fix:** Check server logs, validate field name

### Issue: Delete doesn't work
**Check:**
- Is edit mode enabled?
- Does user confirm deletion?
- Is backend endpoint responding?

**Fix:** Check network tab for 500 errors

### Issue: File not updating
**Check:**
- Is backup file created? (proves write permission works)
- Is Babel generating valid code?
- Is file path correct (absolute vs relative)?

**Fix:** Check server logs for generation errors

---

## 📚 Technical Details

### Validation Rules

**Field Names:**
- Must start with letter, $, or _
- Can contain letters, numbers, $, _
- Cannot be reserved JS keyword
- Cannot duplicate existing field

**Field Types:**
- `null` → Initial value: null
- `string` → Initial value: ""
- `number` → Initial value: 0
- `boolean` → Initial value: false
- `array` → Initial value: []
- `object` → Initial value: {}

### AST Manipulation

**Add Field:**
1. Parse file to AST
2. Traverse to find `xstateConfig.context`
3. Add new `ObjectProperty` node
4. Generate updated code
5. Create backup
6. Write file

**Delete Field:**
1. Parse file to AST
2. Traverse to find field in context
3. Splice from properties array
4. Generate updated code
5. Create backup
6. Write file

**Extract Variables:**
1. Parse file to AST
2. Find `mirrorsOn` property
3. Search for `{{variableName}}` patterns
4. Compare with context fields
5. Return missing variables

---

## 🎉 Benefits

### For Users
- ✨ **Faster workflow** - add fields in seconds, not minutes
- 🎯 **No errors** - validation prevents mistakes
- 💡 **Smart suggestions** - system knows what you need
- 🔄 **Unified experience** - same UI in edit and create

### For System
- 📦 **Consistent structure** - all states have proper context
- 🔍 **Better validation** - can check field completeness
- 🚀 **Easier testing** - context defined upfront
- 📝 **Self-documenting** - fields show what data flows through state

---

## 📞 Support

**Need help?** Check these resources:
- `CONTEXT-FIELD-DOCUMENTATION.md` - Full API reference
- `TESTDATA-CONTEXT-REAL-FLOW.md` - Understand context vs testData
- `SESSION-12-MASTER-PLAN.md` - Original requirements

**Still stuck?** Look at:
- Browser console for frontend errors
- Server terminal for backend errors
- Network tab for API response details

---

## ✅ Completion Checklist

- [ ] Step 1: Replace DynamicContextFields.jsx
- [ ] Step 2: Add 3 backend endpoints to implications.js
- [ ] Step 3: Update StateDetailModal.jsx
- [ ] Step 4: Update AddStateModal.jsx (optional)
- [ ] Test: Can add field in StateDetailModal
- [ ] Test: Can delete field in StateDetailModal
- [ ] Test: Suggestions appear and work
- [ ] Test: Can add context when creating state
- [ ] Test: Backups are created
- [ ] Test: Files update correctly

---

## 🎯 Next Steps After Implementation

Once this is working, consider:

1. **Phase 3: Test Generation**
   - Auto-generate UNIT tests from states
   - Include context setup in generated tests

2. **Phase 4: Progressive Guidance**
   - Context-aware warnings
   - First-time user help
   - Tooltips system

3. **Advanced Features:**
   - Bulk field operations
   - Import/export context
   - Field type inference from usage
   - Rich editors (date picker, color picker)

---

**Ready to implement?** Start with Step 1! 🚀
