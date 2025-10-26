# 🧠 Generator Intelligence Enhancement Plan

## 🎯 Goal: Generate Production-Quality Code, Not Skeletons

### Current State
```javascript
// What we generate NOW:
// TODO: Navigate to screen
// TODO: Perform action
console.log('⚠️ TODO: Implement action logic');
```

### Desired State
```javascript
// What we SHOULD generate:
const ActionsD = require("../../../mobile/android/dancer/actions/Actions.js");
const actionsD = new ActionsD(config, null);
await actionsD.requestBooking.requestBooking(ctx.data);

const actor = ctx.getBookingActor();
actor.send({
  type: 'REQUEST',
  dancerName: credentials.name,
  requestedAt: new Date().toISOString()
});
```

---

## 📚 Information Sources in Implications

### 1. mirrorsOn.triggeredBy
**Contains:** The actual action calls

```javascript
triggeredBy: [
  {
    action: async (testData) => {
      await actionsD.requestBooking.requestBooking(testData);
    }
  }
]
```

**Extract:**
- Action class: `ActionsD`
- Action method: `requestBooking.requestBooking`
- Import path: (parse from top of file or infer)
- Parameters: `testData`

**Generate:**
```javascript
const ActionsD = require("../../../mobile/android/dancer/actions/Actions.js");
const actionsD = new ActionsD(config, null);
await actionsD.requestBooking.requestBooking(ctx.data);
```

---

### 2. entry: assign
**Contains:** Delta fields and their sources

```javascript
entry: assign({
  status: "Pending",
  requestedAt: ({ event }) => event.requestedAt || new Date().toISOString(),
  requestedBy: ({ event }) => event.dancerName,
  bookings: ({ context, event }) => {
    // complex logic
  }
})
```

**Extract:**
- Static fields: `status: "Pending"`
- Event-based fields: `requestedAt`, `requestedBy`
- Complex transformations: `bookings`

**Generate:**
```javascript
const actor = ctx.getBookingActor();
actor.send({
  type: 'REQUEST',
  requestedAt: new Date().toISOString(),
  dancerName: credentials.name,
  bookingIndices: [0, 1, 2]  // if array operation detected
});
```

---

### 3. meta.setup
**Contains:** Platform and path info

```javascript
setup: {
  testFile: "tests/implications/bookings/status/PendingBooking-Dancer-UNIT.spec.js",
  actionName: "requestBooking",
  platform: "mobile-dancer"
}
```

**Extract:**
- Platform: `mobile-dancer` → import mobile helpers
- Action name: `requestBooking` → function name
- Test file: path info

**Generate platform-specific imports:**
```javascript
// For mobile-dancer:
const App = require("../../../mobile/android/dancer/screenObjects/App.js");
const NavigationActions = require("../../../mobile/android/dancer/actions/NavigationActions.js");

// For web:
const { chromium } = require('@playwright/test');

// For cms:
const CMSPage = require("../../pages/CMSPage.js");
```

---

### 4. meta.requiredFields
**Contains:** Data requirements

```javascript
requiredFields: [
  "dancerName",
  "clubName",
  "bookingTime",
  "bookingType"
]
```

**Generate validation:**
```javascript
// Validate test data
const required = ['dancerName', 'clubName', 'bookingTime', 'bookingType'];
for (const field of required) {
  if (!ctx.data[field]) {
    throw new Error(`Missing required field: ${field}`);
  }
}
```

---

## 🛠️ Implementation Approach

### Phase 1: Extract More Data (10 min)
Update `_loadImplication()` to extract:
- `mirrorsOn.triggeredBy`
- Full `entry: assign` object
- Top-level imports

### Phase 2: Parse Action Calls (20 min)
Create helper to parse:
```javascript
await actionsD.requestBooking.requestBooking(testData);
```

Into:
```javascript
{
  className: 'ActionsD',
  method: 'requestBooking.requestBooking',
  param: 'testData'
}
```

### Phase 3: Parse Assign Fields (20 min)
Extract from `assign({...})`:
- Static values
- Event-based values  
- Context-based values

### Phase 4: Update Template (10 min)
Enhance `unit-test.hbs` to use extracted data:
```handlebars
{{#if triggeredBy}}
  {{#each triggeredBy}}
    {{{generateActionCall this}}}
  {{/each}}
{{else}}
  // TODO: Implement action
{{/if}}
```

---

## 🎨 Template Helpers Needed

### 1. generateActionCall
```javascript
Handlebars.registerHelper('generateActionCall', function(triggeredBy) {
  const { className, method, param } = parseAction(triggeredBy.action);
  return `
const ${className} = require("...");
const instance = new ${className}(config, null);
await instance.${method}(ctx.data);
  `.trim();
});
```

### 2. generateEventSend
```javascript
Handlebars.registerHelper('generateEventSend', function(assign) {
  const eventFields = extractEventFields(assign);
  return `
actor.send({
  type: '${eventType}',
  ${eventFields.map(f => `${f}: ...`).join(',\n  ')}
});
  `.trim();
});
```

### 3. platformSpecificImports
```javascript
Handlebars.registerHelper('platformSpecificImports', function(platform) {
  const imports = {
    'mobile-dancer': [
      'const App = require("...");',
      'const NavigationActions = require("...");'
    ],
    'web': [
      'const { chromium } = require("@playwright/test");'
    ],
    'cms': [
      'const CMSPage = require("...");'
    ]
  };
  return imports[platform] || [];
});
```

---

## 🧪 Testing Strategy

### Test Cases:
1. **Simple action** (just a method call)
2. **Complex action** (navigation + selection + action)
3. **Multiple platforms** (mobile, web, cms)
4. **With/without mirrorsOn**

### Validation:
- Generated code is syntactically valid
- Imports are correct
- Variable names don't conflict
- Follows user's code style

---

## 🎯 Success Criteria

Generated test should:
1. ✅ Have real action calls (not TODOs)
2. ✅ Include necessary imports
3. ✅ Use XState actor correctly
4. ✅ Match user's code style
5. ✅ Be runnable with minimal edits

---

## 🚫 Anti-Patterns to Avoid

1. **Hardcoding paths**
   - ❌ `require("../../../mobile/...")`
   - ✅ Calculate relative path from test location

2. **Assuming structure**
   - ❌ Assume all mobile tests use `App.js`
   - ✅ Extract actual imports from existing files

3. **One-size-fits-all**
   - ❌ Single template for all platforms
   - ✅ Platform-specific sections or multiple templates

4. **Over-generation**
   - ❌ Generate complex logic that might be wrong
   - ✅ Generate structure + simple calls, leave complex logic as TODOs

---

## 📝 Pseudo-Code for Enhanced Generator

```javascript
class UnitTestGenerator {
  
  _loadImplication(implFilePath) {
    // Already working with regex
    const meta = extractMeta(code);
    
    // NEW: Extract more
    const mirrorsOn = extractMirrorsOn(code);
    const imports = extractImports(code);
    
    return {
      name: className,
      xstateConfig: { meta },
      mirrorsOn,
      imports
    };
  }
  
  _buildTemplateContext(ImplClass, stateName) {
    const context = {
      // Existing stuff...
      
      // NEW: Enhanced data
      actionCall: this._generateActionCall(ImplClass.mirrorsOn),
      eventFields: this._extractEventFields(ImplClass.xstateConfig.entry),
      platformImports: this._getPlatformImports(ImplClass.xstateConfig.meta.setup.platform)
    };
    
    return context;
  }
  
  _generateActionCall(mirrorsOn) {
    if (!mirrorsOn?.triggeredBy?.[0]) return null;
    
    const action = mirrorsOn.triggeredBy[0].action.toString();
    // Parse: await actionsD.requestBooking.requestBooking(testData);
    
    return {
      className: 'ActionsD',
      instance: 'actionsD',
      method: 'requestBooking.requestBooking',
      import: '../../actions/Actions.js'
    };
  }
}
```

---

## 🔄 Iterative Enhancement

**Week 1:** Extract mirrorsOn, generate basic action calls  
**Week 2:** Add platform-specific imports  
**Week 3:** Extract from entry:assign, generate actor.send()  
**Week 4:** Refine based on user feedback

---

**Remember:** The goal is GENERIC. Don't hardcode for bookings/CMS. Extract patterns!`  