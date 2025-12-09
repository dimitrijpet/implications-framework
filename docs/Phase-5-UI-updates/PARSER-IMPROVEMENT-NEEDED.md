# Parser Improvement: Handling Spread & MergeWithBase

## 🎯 The Problem

Current parser shows placeholder text for screens that use `ImplicationHelper.mergeWithBase()`:
```javascript
// Current output
bookingDetailsScreen
Screen validation defined  // ❌ Placeholder

// Should show
bookingDetailsScreen
Accepted booking shows cancel button
✅ Visible (4): btnCancelBooking, statusLabel, statusText, btnCancelBooking
❌ Hidden (7): btnClose, btnCheckOut, btnDecline...
```

---

## 🔍 What We're Parsing

### Pattern in Implication Files
```javascript
// AcceptedBookingImplications.js
static mirrorsOn = {
  UI: {
    dancer: {
      bookingDetailsScreen: [
        ImplicationHelper.mergeWithBase(
          BaseBookingImplications.dancer.bookingDetailsScreen,  // ← Base data
          {
            description: "Accepted booking shows cancel button",
            visible: ['btnCancelBooking'],
            checks: { text: { statusLabel: 'dancerStatusLabel' } }
          },  // ← Overrides
          { parentClass: AcceptedBookingImplications }
        )
      ]
    }
  }
}
```

### Base Structure
```javascript
// BaseBookingImplications.js
class BaseBookingImplications {
  static dancer = {
    bookingDetailsScreen: {
      description: "Base booking details",
      visible: ['statusLabel', 'statusText', 'btnClose'],
      hidden: ['btnCheckOut', 'btnDecline', 'btnCancelRequest', 'btnAccept'],
      checks: {}
    }
  };
}
```

### Merged Result (What We Need)
```javascript
{
  description: "Accepted booking shows cancel button",  // Override
  visible: ['statusLabel', 'statusText', 'btnClose', 'btnCancelBooking'],  // Base + Override
  hidden: ['btnCheckOut', 'btnDecline', 'btnCancelRequest', 'btnAccept'],  // Base
  checks: { text: { statusLabel: 'dancerStatusLabel' } }  // Override
}
```

---

## 🛠️ Solution Strategy

### Phase 1: Detect MergeWithBase Calls
```javascript
function parseScreenValidation(node) {
  if (node?.type === 'CallExpression') {
    // Check if it's mergeWithBase
    if (node.callee?.property?.name === 'mergeWithBase') {
      return parseMergeWithBaseCall(node);
    }
  }
  // ... rest of parsing
}
```

### Phase 2: Extract Arguments
```javascript
function parseMergeWithBaseCall(callNode) {
  const args = callNode.arguments;
  
  // arg[0]: BaseBookingImplications.dancer.bookingDetailsScreen
  const baseReference = args[0];
  
  // arg[1]: { description: "...", visible: [...], ... }
  const overrides = args[1];
  
  // arg[2]: { parentClass: AcceptedBookingImplications }
  const options = args[2];
  
  return {
    baseReference,
    overrides,
    options
  };
}
```

### Phase 3: Resolve Base Reference

**Challenge:** Need to find and parse `BaseBookingImplications.js`
```javascript
async function resolveBaseReference(baseReference, projectPath) {
  // Parse: BaseBookingImplications.dancer.bookingDetailsScreen
  const className = baseReference.object?.object?.name; // BaseBookingImplications
  const platform = baseReference.object?.property?.name; // dancer
  const screen = baseReference.property?.name; // bookingDetailsScreen
  
  // Find the file
  const baseFilePath = await findFile(projectPath, `${className}.js`);
  
  // Parse it
  const baseContent = await fs.readFile(baseFilePath, 'utf-8');
  const baseData = extractStaticProperty(baseContent, platform, screen);
  
  return baseData;
}
```

### Phase 4: Merge Objects
```javascript
function mergeScreenData(baseData, overrides) {
  return {
    description: overrides.description || baseData.description,
    visible: [...(baseData.visible || []), ...(overrides.visible || [])],
    hidden: [...(baseData.hidden || []), ...(overrides.hidden || [])],
    checks: {
      visible: [...(baseData.checks?.visible || []), ...(overrides.checks?.visible || [])],
      hidden: [...(baseData.checks?.hidden || []), ...(overrides.checks?.hidden || [])],
      text: { ...baseData.checks?.text, ...overrides.checks?.text }
    }
  };
}
```

---

## 📁 Implementation Files

### 1. Add to `astParser.js`
```javascript
/**
 * Parse mergeWithBase function calls
 */
export async function parseMergeWithBase(callNode, projectPath, discoveredFiles) {
  // Implementation here
}

/**
 * Find and parse base implication file
 */
async function resolveBaseImplication(className, projectPath) {
  // Implementation here
}

/**
 * Extract static property from parsed class
 */
function extractStaticProperty(ast, propertyPath) {
  // propertyPath: ['dancer', 'bookingDetailsScreen']
  // Implementation here
}
```

### 2. Update `extractUIImplications`
```javascript
export function extractUIImplications(content, projectPath, discoveredFiles) {
  // ... existing code
  
  // When parsing screen:
  if (screenProp.value?.type === 'ArrayExpression') {
    screenProp.value.elements.forEach(async (validationNode, idx) => {
      
      // ✅ NEW: Check if it's mergeWithBase
      if (validationNode.type === 'CallExpression' &&
          validationNode.callee?.property?.name === 'mergeWithBase') {
        const screenData = await parseMergeWithBase(validationNode, projectPath, discoveredFiles);
        screens.push({ name: screenName, ...screenData });
      } else {
        const screenData = parseScreenValidation(validationNode);
        screens.push({ name: screenName, ...screenData });
      }
    });
  }
}
```

---

## 🧪 Test Cases

### Test 1: Simple Override
```javascript
mergeWithBase(
  BaseBookingImplications.dancer.screen1,
  { description: "New desc" }
)
// Expected: Base visible/hidden + new description
```

### Test 2: Array Concatenation
```javascript
mergeWithBase(
  BaseBookingImplications.dancer.screen1,
  { visible: ['newButton'] }
)
// Expected: Base visible + ['newButton']
```

### Test 3: Deep Object Merge
```javascript
mergeWithBase(
  BaseBookingImplications.dancer.screen1,
  { checks: { text: { newElement: 'newValue' } } }
)
// Expected: Base checks.text + { newElement: 'newValue' }
```

---

## ⚠️ Edge Cases to Handle

1. **Nested mergeWithBase calls** (unlikely but possible)
2. **Missing base file** (fallback to override-only data)
3. **Circular references** (A extends B extends A)
4. **Multiple inheritance** (rare but check for it)
5. **Spread operators** in overrides (`...baseData.visible`)

---

## 🎯 Success Criteria

✅ All 12 screens show complete data
✅ Visible/hidden elements match actual implications
✅ Text checks are displayed
✅ Descriptions are accurate
✅ No "Screen validation defined" placeholders

---

## 📊 Priority

**CRITICAL** - This is essential for the framework to work generically with any project.

Without this, users can't see what their UI implications actually test.

---

## 🚀 Implementation Time Estimate

- **Phase 1 (Detection):** 30 minutes
- **Phase 2 (Base Resolution):** 1 hour
- **Phase 3 (Merging):** 45 minutes
- **Phase 4 (Testing):** 1 hour

**Total:** ~3-4 hours of focused work

---

## 📝 Next Steps for Session 2

1. Implement `parseMergeWithBase()` function
2. Add base file resolution logic
3. Update `extractUIImplications()` to use it
4. Test with AcceptedBookingImplications
5. Verify all 12 screens show correctly
6. Remove debug logs
7. Document the pattern

**This should be the FIRST task in Session 2!**