# Gaps Found: CMS Pattern Testing

**Date:** October 22, 2025  
**Test:** Scanning Leclerc CMS Project  
**Result:** System doesn't support CMS pattern yet

---

## 📊 Test Results

### Scanned Project
- **Path:** `C:\Users\Studio Radost!\Projects\cxm\Leclerc-Phase-2-Playwright`
- **Files:** 487 JavaScript files
- **Found:** 2 implications, 29 sections, 40 screens
- **Project Type:** cms ✅ (correctly detected)

### Visualizer Output
```
Total States: 2
Stateful: 0 (0%)
Transitions: 0
UI Screens: 0
Platforms: 0
Coverage: 0% (No Data)
```

### Graph Display
- **Nodes shown:** 0
- **Expected:** 2 (StayCardsModule, Login)

### Issues Detected
- ❌ 2 "Completely Isolated State" errors
- ⚠️ Wrong analysis (CMS modules shouldn't have transitions)

---

## 🔍 Root Cause Analysis

### Issue 1: No XState Config = Invisible

**What system expects:**
```javascript
class StayCardsModuleImplications {
  static xstateConfig = {
    states: { ... },
    on: { TRANSITION: 'nextState' }
  }
}
```

**What CMS files have:**
```javascript
class StayCardsModuleImplications {
  static SCENARIOS = { MINIMAL, ROMANTIC }
  static mirrorsOn = { CMS, Web }
  // NO xstateConfig!
}
```

**Result:**
- System filters to "stateful" implications
- Files without `xstateConfig` are excluded
- Graph shows 0 nodes

**Location in code:**
```javascript
// packages/web-app/src/pages/Visualizer.jsx
const statefulImplications = discovery.files.implications.filter(
  imp => imp.metadata?.isStateful  // ❌ CMS files fail this check
);
```

---

### Issue 2: Wrong Analysis Rules

**Error shown:**
```
❌ Completely Isolated State
State "StayCardsModuleImplications" has no incoming or outgoing transitions.
```

**Why this is wrong:**
- CMS modules are NOT state machines
- They're data generators (SCENARIOS)
- They don't NEED transitions
- This error assumes booking pattern

**Location in code:**
```javascript
// packages/analyzer/src/rules/IsolatedStateRule.js
// Assumes ALL implications should have transitions
```

---

### Issue 3: UI Extraction Failing

**Console shows:**
```
🔍 Has mirrorsOn, extracting UI... { hasContent: true, hasExtractor: true }
✅ Found mirrorsOn!
📊 Final UI data: { total: 0, platforms: {} }  // ❌ Empty!
```

**Expected:**
```
📊 Final UI data: { 
  total: 2, 
  platforms: { CMS: {...}, Web: {...} }
}
```

**Why failing:**
- Parser finds `mirrorsOn` object
- But extraction returns empty
- Likely structure mismatch (CMS vs Booking)

**CMS mirrorsOn structure:**
```javascript
static mirrorsOn = {
  CMS: {
    screen: 'addLandingPage',
    checks: { visible: [...], hidden: [...] }
  },
  Web: {
    screen: 'landingPage',
    checks: { visible: [...] }
  }
}
```

**Booking mirrorsOn structure:**
```javascript
static mirrorsOn = {
  UI: {
    dancer: { screen: {...} },
    web: { screen: {...} }
  }
}
```

**Location in code:**
```javascript
// packages/api-server/src/services/astParser.js
// extractUIImplications() expects UI.platform structure
// But CMS has platform directly
```

---

## 🎯 Critical Issues (Blocks Workflow)

### 1. ❌ Files Without XState Don't Show in Graph

**Impact:** Can't visualize CMS implications at all

**Fix Required:**
- Make XState optional
- Show ALL implications in graph
- Visual distinction (color) for pattern type

**Estimated Effort:** 2-3 hours

**Priority:** MUST HAVE

---

### 2. ❌ UI Extraction Fails for CMS Pattern

**Impact:** No platform/screen data shown

**Fix Required:**
- Support both mirrorsOn structures:
  - `mirrorsOn.UI.platform` (booking)
  - `mirrorsOn.platform` (CMS)
- Extract from both patterns

**Estimated Effort:** 1-2 hours

**Priority:** MUST HAVE

---

### 3. ❌ Analysis Rules Assume XState

**Impact:** False errors for CMS files

**Fix Required:**
- Detect pattern type (booking vs CMS)
- Skip transition rules for CMS
- Different validation per pattern

**Estimated Effort:** 1-2 hours

**Priority:** MUST HAVE

---

## ⚠️ Usability Issues (Confusing UX)

### 1. "Stateful" Terminology

**Issue:** "Stateful: 0 (0%)" is confusing for CMS

**Why:** CMS files aren't "stateless" - they just use different pattern

**Fix:** Change label to "Workflow-Based" or detect pattern

**Estimated Effort:** 30 minutes

**Priority:** SHOULD HAVE

---

### 2. "Isolated State" Error Wrong for CMS

**Issue:** Error message assumes state machines

**Why:** CMS modules are isolated by design

**Fix:** Pattern-aware error messages

**Estimated Effort:** 1 hour

**Priority:** SHOULD HAVE

---

## 📋 Missing Features

### 1. CMS Pattern Recognition

**What's missing:** System doesn't detect CMS pattern

**Need:** 
- Detect `SCENARIOS` object
- Detect direct mirrorsOn (no UI wrapper)
- Set pattern type in metadata

**Estimated Effort:** 2 hours

**Priority:** SHOULD HAVE

---

### 2. Scenario Visualization

**What's missing:** No way to show SCENARIOS in UI

**Need:**
- Display scenarios in detail modal
- Show data structure per scenario
- Color-code by scenario type

**Estimated Effort:** 2-3 hours

**Priority:** NICE TO HAVE

---

## 🎨 Nice to Have (Future)

### 1. Pattern-Based Colors

**Enhancement:** Different node colors per pattern
- Purple: Booking (XState workflow)
- Green: CMS (module/data)
- Blue: Generic/Custom

**Estimated Effort:** 1 hour

---

### 2. Template Selection

**Enhancement:** "Create CMS Module" vs "Create State Machine"

**Estimated Effort:** 2 hours

---

### 3. CMS-Specific Analysis

**Enhancement:** Rules like "Scenario Coverage" instead of "Transitions"

**Estimated Effort:** 3-4 hours

---

## 🚀 Recommended Fix Order

### Phase 1: Make CMS Visible (2-4 hours)
1. Remove XState requirement for graph display
2. Fix UI extraction for CMS pattern
3. Skip transition analysis for non-XState files

**Result:** CMS files show in graph with correct data

---

### Phase 2: Pattern Detection (2-3 hours)
1. Detect pattern type (booking/CMS/generic)
2. Set metadata.pattern field
3. Pattern-aware visualizer colors
4. Pattern-specific analysis rules

**Result:** System knows what type of file it's looking at

---

### Phase 3: CMS Features (3-4 hours)
1. Display SCENARIOS in UI
2. Show mirrorsOn structure correctly
3. CMS-specific tooltips/docs

**Result:** Full CMS pattern support

---

## 📊 Success Metrics

### Minimum Success (Phase 1)
- [ ] CMS implications show in graph
- [ ] No false "isolated state" errors
- [ ] mirrorsOn data displays correctly

### Good Success (Phase 1 + 2)
- [ ] Pattern type detected automatically
- [ ] Different colors per pattern
- [ ] Pattern-aware validation

### Excellent Success (All Phases)
- [ ] SCENARIOS displayed in UI
- [ ] CMS-specific templates
- [ ] Full documentation

---

## 🎓 Lessons Learned

### 1. XState Not Universal
Initially thought XState could model everything. Reality: some patterns (like CMS modules) are better as pure data generators without state machines.

### 2. Assumptions in Discovery
System assumes all implications follow booking pattern. Need pattern-agnostic discovery that adapts to what it finds.

### 3. Validation Needs Context
Can't apply same validation rules to all files. Need to understand pattern type before validating.

### 4. UI Structure Varies
mirrorsOn structure differs between patterns. Parser needs flexibility to handle multiple structures.

---

## 🎯 Next Steps

1. **Decide:** XState-only or multi-pattern?
2. **Fix Phase 1:** Make CMS visible
3. **Test again:** Rescan and verify
4. **Document:** Update system docs with pattern support

---

*Gap Analysis Version: 1.0*  
*Test Date: October 22, 2025*  
*Status: Ready for fixes*

# Architectural Decision: Workflow vs Content Separation

**Date:** October 22, 2025  
**Context:** Phase 1 of Dogfooding Plan - Creating CMSPageImplications  
**Decision:** Separate page workflow from module content  
**Status:** ✅ Implemented

---

## 🎯 The Issue

Initially created `CMSPageImplications.js` with SCENARIOS:

```javascript
class CMSPageImplications {
  xstateConfig: {
    states: { empty, filling, draft, published }
  }
  
  SCENARIOS: {  // ❌ Wrong place!
    MINIMAL: { modules: [...] },
    ROMANTIC: { modules: [...] }
  }
}
```

**Problem:** Mixing two concerns:
- Page WORKFLOW (empty → published)
- Module CONTENT (StayCards data)

---

## 💡 The Decision

**Separate into two types of implications:**

### 1. Workflow Implications (Page-level)
```javascript
// CMSPageImplications.js
class CMSPageImplications {
  xstateConfig: {
    initial: 'empty',
    context: {
      pageTitle: null,
      publishedAt: null,
      pageUrl: null
      // NO module data!
    },
    states: {
      empty: { on: { START_FILLING: 'filling' } },
      filling: { on: { PUBLISH: 'published' } },
      published: {}
    }
  }
  
  // NO SCENARIOS here!
}
```

### 2. Content Implications (Module-level)
```javascript
// StayCardsModuleImplications.js
class StayCardsModuleImplications {
  // NO xstateConfig! (not a workflow)
  
  SCENARIOS: {
    MINIMAL: { title: '...' },
    ROMANTIC: { theme: 'romantic', ... }
  }
  
  mirrorsOn: {
    CMS: { visible: ['stayCardFields'] },
    Web: { visible: ['stayCardDisplay'] }
  }
}
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  CMSPageImplications (Workflow)                         │
│  XState: empty → filling → draft → published            │
│  Context: pageTitle, publishedAt, pageUrl               │
│  Purpose: Track page lifecycle                          │
└─────────────────────────────────────────────────────────┘
                       │
                       │ Uses during filling state
                       ↓
┌─────────────────────────────────────────────────────────┐
│  Module Implications (Content)                          │
│  - StayCardsModuleImplications                          │
│  - DestinationCardsModuleImplications                   │
│  - PromotionCardsModuleImplications                     │
│                                                          │
│  SCENARIOS: Data variations                             │
│  mirrorsOn: UI expectations                             │
│  Purpose: Define module structure & validation          │
└─────────────────────────────────────────────────────────┘
```

---

## 🧪 How They Work Together

### Test Example:
```javascript
test('Create romantic StayCards page', async ({ page }) => {
  // 1️⃣ Page workflow (CMSPage handles this)
  const pageCtx = TestContext.load(
    CMSPageImplications, 
    'page-data.json'
  );
  
  // Transition: empty → filling
  await pageCtx.transition('START_FILLING', {
    pageTitle: 'Romantic Getaways'
  });
  
  // 2️⃣ Module content (StayCards handles this)
  const moduleData = StayCardsModuleImplications
    .SCENARIOS
    .ROMANTIC;
  
  await app.stayCards.fillMultipleModules(moduleData);
  
  // 3️⃣ Page workflow continues (back to CMSPage)
  await pageCtx.transition('PUBLISH_DIRECT', {
    publishedAt: new Date(),
    pageUrl: 'https://...',
    slug: 'romantic-getaways'
  });
  
  // 4️⃣ Validation uses BOTH
  // Page: Check it's published at correct URL
  await ExpectImplication.validate(
    CMSPageImplications,
    pageCtx.data,
    'Web',
    'published'
  );
  
  // Module: Check StayCards appear correctly
  await ExpectImplication.validate(
    StayCardsModuleImplications,
    moduleData,
    'Web'
  );
});
```

---

## ✅ Benefits of This Approach

### 1. Separation of Concerns
- Page workflow = one file
- Module content = separate files
- Clear responsibilities

### 2. Reusability
```javascript
// Same page workflow, different modules
test('Page with StayCards', () => {
  const module = StayCardsModuleImplications.SCENARIOS.ROMANTIC;
  // ...
});

test('Page with Destinations', () => {
  const module = DestinationCardsModuleImplications.SCENARIOS.EUROPEAN;
  // ...
});
```

### 3. Independent Evolution
- Change page workflow without touching modules
- Add new modules without changing page workflow
- Test page states independently from module content

### 4. Clear Context
```javascript
// CMSPage context (workflow data)
{
  pageTitle: "My Page",
  publishedAt: "2025-10-22T...",
  pageUrl: "https://..."
}

// StayCards data (content data)
{
  modules: [
    { title: "Paris", theme: "romantic", ... }
  ]
}
```

---

## 🎓 Lessons Learned

### What We Did Wrong Initially
- Put SCENARIOS in page implications
- Mixed workflow data with content data
- Made page responsible for module structure

### Why It Was Wrong
- Page doesn't care WHAT modules are used
- Page only cares about its OWN state (draft, published, etc)
- Modules should define their own data structure

### The Correct Model
- **Page = State Machine** (workflow)
- **Module = Data Generator** (content)
- **Test = Orchestrator** (combines both)

---

## 📊 Comparison

### Before (❌ Mixed)
```javascript
CMSPageImplications {
  xstateConfig: { states: {...} }      // Workflow
  SCENARIOS: { ROMANTIC: {...} }       // Content ❌ Wrong!
  context: { modules: [], sections: [] } // Content ❌ Wrong!
}
```

### After (✅ Separated)
```javascript
// Workflow file
CMSPageImplications {
  xstateConfig: { states: {...} }
  context: { pageTitle, publishedAt, pageUrl }  // Page data only
}

// Content file
StayCardsModuleImplications {
  SCENARIOS: { ROMANTIC: {...} }
  mirrorsOn: { ... }
}
```

---

## 🎯 Impact on Host System

### What Changed
**Nothing!** 🎉

The host system worked perfectly. It showed:
- All states from xstateConfig ✅
- All mirrorsOn screens ✅
- All transitions ✅

**This was a USER decision, not a system problem.**

### What We Learned
The system is flexible enough to handle:
- Pure workflow files (CMSPage)
- Pure content files (StayCardsModule)
- Mixed files (if someone wants that)

It doesn't force a pattern - it visualizes what you give it.

---

## 📝 Documentation Needed

### For Users
**Guide:** "Structuring CMS Tests"
- When to use workflow implications
- When to use module implications
- How to combine them in tests

**Example Projects:**
- Full CMS example with both types
- Show test files using both patterns

### For Developers
**Architecture Doc:**
- Workflow vs Content patterns
- When each applies
- How they interact

---

## 🚀 Next Steps

1. ✅ Fixed CMSPageImplications (removed SCENARIOS)
2. ⏭️ Continue Phase 2: Re-scan and test
3. ⏭️ Document in user guide
4. ⏭️ Create StayCardsModule example (without XState)

---

## 🎨 Visual Summary

```
❌ Before: Everything in One File
┌─────────────────────────────┐
│  CMSPageImplications        │
│  ├─ Workflow (XState)       │
│  ├─ SCENARIOS (Content) ❌  │
│  └─ Module data ❌          │
└─────────────────────────────┘

✅ After: Separated Concerns
┌─────────────────────────────┐     ┌──────────────────────────┐
│  CMSPageImplications        │     │  StayCardsModule         │
│  └─ Workflow (XState) ✅    │────▶│  ├─ SCENARIOS ✅         │
│     empty → published       │     │  └─ mirrorsOn ✅         │
└─────────────────────────────┘     └──────────────────────────┘
        Page Lifecycle                    Module Content
```

---

## ✅ Decision Summary

**Question:** Should CMSPage have SCENARIOS?  
**Answer:** No - SCENARIOS belong in module implications

**Question:** Should modules have XState?  
**Answer:** No - modules are data generators, not workflows

**Question:** How do they work together?  
**Answer:** Tests orchestrate: use page workflow + module data

**Status:** ✅ Implemented and documented  
**Impact:** Cleaner architecture, better separation of concerns

---

*Decision Version: 1.0*  
*Date: October 22, 2025*  
*Approved by: Development Team*

# Gaps Found: CMS Pattern Testing

**Date:** October 22, 2025  
**Test:** Scanning Leclerc CMS Project  
**Result:** System doesn't support CMS pattern yet

---

## 📊 Test Results

### Scanned Project
- **Path:** `C:\Users\Studio Radost!\Projects\cxm\Leclerc-Phase-2-Playwright`
- **Files:** 487 JavaScript files
- **Found:** 2 implications, 29 sections, 40 screens
- **Project Type:** cms ✅ (correctly detected)

### Visualizer Output
```
Total States: 2
Stateful: 0 (0%)
Transitions: 0
UI Screens: 0
Platforms: 0
Coverage: 0% (No Data)
```

### Graph Display
- **Nodes shown:** 0
- **Expected:** 2 (StayCardsModule, Login)

### Issues Detected
- ❌ 2 "Completely Isolated State" errors
- ⚠️ Wrong analysis (CMS modules shouldn't have transitions)

---

## 🔍 Root Cause Analysis

### Issue 1: No XState Config = Invisible

**What system expects:**
```javascript
class StayCardsModuleImplications {
  static xstateConfig = {
    states: { ... },
    on: { TRANSITION: 'nextState' }
  }
}
```

**What CMS files have:**
```javascript
class StayCardsModuleImplications {
  static SCENARIOS = { MINIMAL, ROMANTIC }
  static mirrorsOn = { CMS, Web }
  // NO xstateConfig!
}
```

**Result:**
- System filters to "stateful" implications
- Files without `xstateConfig` are excluded
- Graph shows 0 nodes

**Location in code:**
```javascript
// packages/web-app/src/pages/Visualizer.jsx
const statefulImplications = discovery.files.implications.filter(
  imp => imp.metadata?.isStateful  // ❌ CMS files fail this check
);
```

---

### Issue 2: Wrong Analysis Rules

**Error shown:**
```
❌ Completely Isolated State
State "StayCardsModuleImplications" has no incoming or outgoing transitions.
```

**Why this is wrong:**
- CMS modules are NOT state machines
- They're data generators (SCENARIOS)
- They don't NEED transitions
- This error assumes booking pattern

**Location in code:**
```javascript
// packages/analyzer/src/rules/IsolatedStateRule.js
// Assumes ALL implications should have transitions
```

---

### Issue 3: UI Extraction Failing

**Console shows:**
```
🔍 Has mirrorsOn, extracting UI... { hasContent: true, hasExtractor: true }
✅ Found mirrorsOn!
📊 Final UI data: { total: 0, platforms: {} }  // ❌ Empty!
```

**Expected:**
```
📊 Final UI data: { 
  total: 2, 
  platforms: { CMS: {...}, Web: {...} }
}
```

**Why failing:**
- Parser finds `mirrorsOn` object
- But extraction returns empty
- Likely structure mismatch (CMS vs Booking)

**CMS mirrorsOn structure:**
```javascript
static mirrorsOn = {
  CMS: {
    screen: 'addLandingPage',
    checks: { visible: [...], hidden: [...] }
  },
  Web: {
    screen: 'landingPage',
    checks: { visible: [...] }
  }
}
```

**Booking mirrorsOn structure:**
```javascript
static mirrorsOn = {
  UI: {
    dancer: { screen: {...} },
    web: { screen: {...} }
  }
}
```

**Location in code:**
```javascript
// packages/api-server/src/services/astParser.js
// extractUIImplications() expects UI.platform structure
// But CMS has platform directly
```

---

## 🎯 Critical Issues (Blocks Workflow)

### 0. ❌ Modal Fields Hardcoded for Booking Pattern

**Impact:** Can't edit CMS-specific fields

**What's wrong:**
Modal shows hardcoded booking fields:
- Status, Trigger Button, After Button, Platform, etc.

But CMS needs different fields from `context`:
- pageTitle, slug, publishedAt, pageUrl, etc.

**What should happen:**
Modal should be **generic** and read fields from XState:

```javascript
// Read context fields dynamically
Object.keys(xstateConfig.context).forEach(field => {
  // Show editable field in modal
});

// Read meta.requiredFields dynamically
state.meta.requiredFields.forEach(field => {
  // Mark field as required
});

// Read ALL meta properties (not just hardcoded ones)
Object.keys(state.meta).forEach(key => {
  // Display meta property
});
```

**Current code location:**
- `packages/web-app/src/components/StateGraph/StateDetailModal.jsx`
- Hardcoded fields in render()

**Fix Required:**
- Make modal generic
- Read fields from XState structure
- Support ANY context fields
- Support ANY meta properties

**Estimated Effort:** 2-3 hours

**Priority:** MUST HAVE (System can't work for non-booking patterns without this)

---

## 🎯 Critical Issues (Blocks Workflow)

### 1. ❌ Files Without XState Don't Show in Graph

**Impact:** Can't visualize CMS implications at all

**Fix Required:**
- Make XState optional
- Show ALL implications in graph
- Visual distinction (color) for pattern type

**Estimated Effort:** 2-3 hours

**Priority:** MUST HAVE

---

### 2. ❌ UI Extraction Fails for CMS Pattern

**Impact:** No platform/screen data shown

**Fix Required:**
- Support both mirrorsOn structures:
  - `mirrorsOn.UI.platform` (booking)
  - `mirrorsOn.platform` (CMS)
- Extract from both patterns

**Estimated Effort:** 1-2 hours

**Priority:** MUST HAVE

---

### 3. ❌ Analysis Rules Assume XState

**Impact:** False errors for CMS files

**Fix Required:**
- Detect pattern type (booking vs CMS)
- Skip transition rules for CMS
- Different validation per pattern

**Estimated Effort:** 1-2 hours

**Priority:** MUST HAVE

---

## ⚠️ Usability Issues (Confusing UX)

### 1. "Stateful" Terminology

**Issue:** "Stateful: 0 (0%)" is confusing for CMS

**Why:** CMS files aren't "stateless" - they just use different pattern

**Fix:** Change label to "Workflow-Based" or detect pattern

**Estimated Effort:** 30 minutes

**Priority:** SHOULD HAVE

---

### 2. "Isolated State" Error Wrong for CMS

**Issue:** Error message assumes state machines

**Why:** CMS modules are isolated by design

**Fix:** Pattern-aware error messages

**Estimated Effort:** 1 hour

**Priority:** SHOULD HAVE

---

## 📋 Missing Features

### 1. CMS Pattern Recognition

**What's missing:** System doesn't detect CMS pattern

**Need:** 
- Detect `SCENARIOS` object
- Detect direct mirrorsOn (no UI wrapper)
- Set pattern type in metadata

**Estimated Effort:** 2 hours

**Priority:** SHOULD HAVE

---

### 2. Scenario Visualization

**What's missing:** No way to show SCENARIOS in UI

**Need:**
- Display scenarios in detail modal
- Show data structure per scenario
- Color-code by scenario type

**Estimated Effort:** 2-3 hours

**Priority:** NICE TO HAVE

---

## 🎨 Nice to Have (Future)

### 1. Pattern-Based Colors

**Enhancement:** Different node colors per pattern
- Purple: Booking (XState workflow)
- Green: CMS (module/data)
- Blue: Generic/Custom

**Estimated Effort:** 1 hour

---

### 2. Template Selection

**Enhancement:** "Create CMS Module" vs "Create State Machine"

**Estimated Effort:** 2 hours

---

### 3. CMS-Specific Analysis

**Enhancement:** Rules like "Scenario Coverage" instead of "Transitions"

**Estimated Effort:** 3-4 hours

---

## 🚀 Recommended Fix Order

### Phase 1: Make CMS Visible (2-4 hours)
1. Remove XState requirement for graph display
2. Fix UI extraction for CMS pattern
3. Skip transition analysis for non-XState files

**Result:** CMS files show in graph with correct data

---

### Phase 2: Pattern Detection (2-3 hours)
1. Detect pattern type (booking/CMS/generic)
2. Set metadata.pattern field
3. Pattern-aware visualizer colors
4. Pattern-specific analysis rules

**Result:** System knows what type of file it's looking at

---

### Phase 3: CMS Features (3-4 hours)
1. Display SCENARIOS in UI
2. Show mirrorsOn structure correctly
3. CMS-specific tooltips/docs

**Result:** Full CMS pattern support

---

## 📊 Success Metrics

### Minimum Success (Phase 1)
- [ ] CMS implications show in graph
- [ ] No false "isolated state" errors
- [ ] mirrorsOn data displays correctly

### Good Success (Phase 1 + 2)
- [ ] Pattern type detected automatically
- [ ] Different colors per pattern
- [ ] Pattern-aware validation

### Excellent Success (All Phases)
- [ ] SCENARIOS displayed in UI
- [ ] CMS-specific templates
- [ ] Full documentation

---

## 🎓 Lessons Learned

### 1. XState Not Universal
Initially thought XState could model everything. Reality: some patterns (like CMS modules) are better as pure data generators without state machines.

### 2. Assumptions in Discovery
System assumes all implications follow booking pattern. Need pattern-agnostic discovery that adapts to what it finds.

### 3. Validation Needs Context
Can't apply same validation rules to all files. Need to understand pattern type before validating.

### 4. UI Structure Varies
mirrorsOn structure differs between patterns. Parser needs flexibility to handle multiple structures.

---

## 🎯 Next Steps

1. **Decide:** XState-only or multi-pattern?
2. **Fix Phase 1:** Make CMS visible
3. **Test again:** Rescan and verify
4. **Document:** Update system docs with pattern support

---

*Gap Analysis Version: 1.0*  
*Test Date: October 22, 2025*  
*Status: Ready for fixes*