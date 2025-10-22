# Dogfooding Plan: Testing Our System with CMS Pattern

**Version:** 1.0  
**Created:** October 22, 2025  
**Purpose:** Test our implications framework by using it to build CMS testing infrastructure  
**Status:** Ready to Execute

---

## 🎯 The Core Strategy

### The Experiment

```
┌─────────────────────────────────────────────────────────┐
│  Dogfooding Cycle                                        │
├─────────────────────────────────────────────────────────┤
│  1. Create CMSPageImplications.js manually              │
│     → Write it by hand using booking pattern            │
│                                                          │
│  2. Scan with our host system                           │
│     → See what it finds, what it misses                 │
│                                                          │
│  3. Document all gaps                                   │
│     → What breaks, what's confusing, what's missing     │
│                                                          │
│  4. Fix the host system                                 │
│     → Based on real pain points we discovered           │
│                                                          │
│  5. Delete CMSPageImplications.js                       │
│     → Start fresh                                       │
│                                                          │
│  6. Recreate using host system                          │
│     → Use Add State, edit transitions, etc              │
│                                                          │
│  7. Compare results                                     │
│     → Did we get the same file? ✅ or ❌                │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Background: Why This Matters

### What We Learned from CMS Implementation

During Session 11, we built a complete CMS testing system:
- StayCardsModuleImplications
- TestContext integration
- ExpectImplication validation
- TestSetup with App.js

**Key Insight:** Everything CAN be modeled with XState!

```javascript
// CMS Page Lifecycle
empty → filling → draft → published → archived
```

### The XState Pattern (Universal)

**From Booking System:**
```javascript
AcceptedBookingImplications {
  xstateConfig: {
    entry: assign({
      status: 'Accepted',
      acceptedAt: ({event}) => event.acceptedAt,
      acceptedBy: ({event}) => event.userName
    }),
    on: {
      UNDO: 'pending',
      CANCEL: 'rejected'
    }
  }
}
```

**For CMS System:**
```javascript
PublishedPageImplications {
  xstateConfig: {
    entry: assign({
      status: 'published',
      publishedAt: ({event}) => event.publishedAt,
      pageUrl: ({event}) => event.pageUrl,
      slug: ({event}) => event.slug
    }),
    on: {
      UNPUBLISH: 'draft',
      ARCHIVE: 'archived'
    }
  }
}
```

**Same pattern, different domain!**

---

## 🧪 Test Execution Plan

### Phase 1: Create Manual Example (30 minutes)

**Deliverable:** `CMSPageImplications.js`

```javascript
// apps/cms/tests/implications/pages/CMSPageImplications.js

const { assign } = require('xstate');

class CMSPageImplications {
  static xstateConfig = {
    initial: 'empty',
    
    context: {
      pageTitle: null,
      scenario: null,
      modules: [],
      sections: [],
      slug: null,
      savedAt: null,
      publishedAt: null,
      pageUrl: null,
      cmsUrl: null
    },
    
    states: {
      empty: {
        meta: {
          description: 'Fresh page, nothing filled',
          requiredFields: []
        },
        on: { START_FILLING: 'filling' }
      },
      
      filling: {
        meta: {
          description: 'User is filling form',
          requiredFields: ['pageTitle']
        },
        entry: assign({
          status: 'filling',
          pageTitle: ({event}) => event.pageTitle,
          scenario: ({event}) => event.scenario,
          modules: ({event}) => event.modules,
          sections: ({event}) => event.sections
        }),
        on: { 
          SAVE_DRAFT: 'draft',
          PUBLISH_DIRECT: 'published'
        }
      },
      
      draft: {
        meta: {
          description: 'Saved but not published',
          requiredFields: ['pageTitle', 'savedAt']
        },
        entry: assign({
          status: 'draft',
          savedAt: ({event}) => event.savedAt,
          cmsUrl: ({event}) => event.cmsUrl
        }),
        on: {
          EDIT: 'filling',
          PUBLISH: 'published',
          DELETE: 'deleted'
        }
      },
      
      published: {
        meta: {
          description: 'Live on web',
          requiredFields: ['pageTitle', 'publishedAt', 'pageUrl']
        },
        entry: assign({
          status: 'published',
          publishedAt: ({event}) => event.publishedAt,
          slug: ({event}) => event.slug,
          pageUrl: ({event}) => event.pageUrl
        }),
        on: {
          UNPUBLISH: 'draft',
          ARCHIVE: 'archived'
        }
      },
      
      archived: {
        meta: {
          description: 'Removed from live',
          requiredFields: ['archivedAt']
        },
        entry: assign({
          status: 'archived',
          archivedAt: ({event}) => event.archivedAt
        })
      },
      
      deleted: {
        meta: {
          description: 'Permanently removed'
        },
        entry: assign({
          status: 'deleted',
          deletedAt: ({event}) => event.deletedAt
        })
      }
    }
  };
  
  static mirrorsOn = {
    UI: {
      Web: {
        published: {
          screen: 'landingPage',
          checks: {
            visible: ['pageContent', 'stayCards'],
            contains: {
              pageTitle: '{{pageTitle}}'
            }
          }
        }
      }
    }
  };
}

module.exports = CMSPageImplications;
```

**Checklist:**
- [ ] File created in correct location
- [ ] XState structure complete
- [ ] assign() functions defined
- [ ] Transitions mapped
- [ ] mirrorsOn for Web only
- [ ] Follows booking pattern

---

### Phase 2: Scan with Host System (15 minutes)

**Goal:** Document EVERYTHING that happens

#### Test Steps:

```bash
# 1. Start host system
cd implications-framework
pnpm dev

# 2. Open visualizer
http://localhost:5173/visualizer

# 3. Scan CMS project
Project Path: /home/dimitrij/Projects/cxm/Leclerc-Phase-2-Playwright/apps/cms/tests
[Scan Project]
```

#### Document:

**What Gets Found?**
- [ ] Does it find CMSPageImplications.js?
- [ ] What type does it classify it as? (booking, module, generic?)
- [ ] Does it extract all states?
- [ ] Does it extract transitions?
- [ ] Does it parse mirrorsOn?

**What the Visualizer Shows?**
- [ ] Graph displays correctly?
- [ ] Nodes labeled properly?
- [ ] Edges show transitions?
- [ ] Colors appropriate?
- [ ] Click node → details work?

**What Breaks?**
- [ ] Errors in console?
- [ ] Missing data?
- [ ] Wrong classifications?
- [ ] UI glitches?

**Screenshots:**
- [ ] Full visualizer view
- [ ] Node detail modal
- [ ] Issue panel (if any)
- [ ] Console logs

---

### Phase 3: Document Gaps (15 minutes)

**Deliverable:** `GAPS-FOUND.md`

#### Template:

```markdown
# Gaps Found in Host System

**Date:** [Date]  
**Test:** CMS Page Implications  

## Critical Issues (Blocks Workflow)

1. **[Issue Title]**
   - What: [Description]
   - Expected: [What should happen]
   - Actual: [What actually happened]
   - Impact: [Why this blocks workflow]
   - Fix: [Proposed solution]

## Usability Issues (Confusing UX)

1. **[Issue Title]**
   - What: [Description]
   - Why confusing: [Explanation]
   - Fix: [Proposed solution]

## Missing Features

1. **[Feature Name]**
   - What's missing: [Description]
   - Why needed: [Justification]
   - Priority: High / Medium / Low

## Nice to Have (Future)

1. **[Enhancement]**
   - Description: [What]
   - Value: [Why]
```

#### Example Gaps We Might Find:

**Critical:**
- System expects `bookings/status/` folder structure
- Doesn't recognize non-booking patterns
- Parser fails on CMS-specific structure

**Usability:**
- No visual distinction between patterns (all purple)
- "Add State" button generates booking template only
- No guidance on XState structure

**Missing:**
- CMS pattern templates
- Multi-pattern support in visualizer
- Documentation tooltips

**Nice to Have:**
- Pattern auto-detection
- Template library
- Example files

---

### Phase 4: Prioritize Fixes (15 minutes)

**Deliverable:** `FIX-PRIORITY.md`

#### Framework:

```markdown
# Fix Priority Matrix

## Must Have (Do Now)
Blocks the dogfooding test from completing.

1. [Fix] - Est: [X hours] - Impact: Critical

## Should Have (Do Soon)
Makes workflow significantly easier.

1. [Fix] - Est: [X hours] - Impact: High

## Nice to Have (Later)
Improves experience but not blocking.

1. [Enhancement] - Est: [X hours] - Impact: Medium

## Won't Have (This Cycle)
Good ideas but out of scope.

1. [Feature] - Reason: [Why deferred]
```

#### Decision Criteria:

**Must Have:**
- Prevents test completion
- Causes data loss or errors
- Fundamentally broken

**Should Have:**
- Significantly confusing UX
- Missing core functionality
- High-effort workarounds

**Nice to Have:**
- Minor UX improvements
- Non-essential features
- Cosmetic issues

**Won't Have:**
- Out of scope
- Requires major refactor
- Low value-to-effort ratio

---

### Phase 5: Implement Fixes (2-4 hours)

**Based on priority list from Phase 4**

#### Implementation Strategy:

```
For each "Must Have" fix:
  1. Create feature branch
  2. Write fix
  3. Test incrementally
  4. Document changes
  5. Merge to main
  6. Re-test with CMS example
```

#### Track Progress:

```markdown
# Fix Implementation Log

## Fix 1: [Title]
- Branch: fix/cms-pattern-support
- Status: In Progress / Done
- Commits: [links]
- Testing: [results]

## Fix 2: [Title]
...
```

---

### Phase 6: Delete & Recreate (30 minutes)

**The Ultimate Test!**

#### Steps:

```bash
# 1. Delete manual example
rm apps/cms/tests/implications/pages/CMSPageImplications.js

# 2. Use host system to recreate
Open host system → Visualizer → Add State

# 3. Fill in state machine
- Name: CMSPageImplications
- States: empty, filling, draft, published, archived, deleted
- Transitions: Add all the `on:` configs
- Context: Add all fields
- mirrorsOn: Add Web checks

# 4. Generate file
Click "Generate" → Download CMSPageImplications.js

# 5. Compare
diff original.js generated.js
```

#### Success Criteria:

**Perfect Match (100%):**
- [ ] All states present
- [ ] All transitions correct
- [ ] Context fields match
- [ ] assign() functions identical
- [ ] mirrorsOn structure same
- [ ] File structure matches

**Good Enough (80%):**
- [ ] Core states present
- [ ] Main transitions work
- [ ] Context mostly correct
- [ ] User can edit to finish

**Needs Work (<80%):**
- [ ] Missing states
- [ ] Wrong transitions
- [ ] Broken structure
- [ ] Can't use as-is

---

### Phase 7: Results Analysis (15 minutes)

**Deliverable:** `DOGFOODING-RESULTS.md`

#### Template:

```markdown
# Dogfooding Results

**Date:** [Date]  
**Success Rate:** [X%]  

## What Worked Well

1. [Thing that worked]
   - Why: [Explanation]
   - Keep: [What to maintain]

## What Didn't Work

1. [Thing that failed]
   - Why: [Root cause]
   - Fix: [What to change]

## Lessons Learned

1. [Insight]
2. [Discovery]
3. [Realization]

## Next Steps

1. [Action item]
2. [Action item]

## Recommendations

- [Strategic decision]
- [Architecture change]
- [Process improvement]
```

---

## 📊 Success Metrics

### Minimum Viable Success

**Goal:** Recreate 80% of CMSPageImplications using host system

**Must Work:**
- [ ] Create file
- [ ] Add states
- [ ] Add transitions
- [ ] Save to disk
- [ ] File is valid JavaScript
- [ ] Can be imported and used

### Ideal Success

**Goal:** Recreate 100% with great UX

**Should Work:**
- [ ] Visual state builder (drag-drop)
- [ ] Template selection (CMS pattern)
- [ ] Inline editing of all fields
- [ ] Context field management
- [ ] mirrorsOn builder
- [ ] Preview before save
- [ ] One-click generation

---

## 🚀 Timeline

### Compressed (Half Day)

```
09:00 - 09:30  Phase 1: Create example
09:30 - 09:45  Phase 2: Scan system
09:45 - 10:00  Phase 3: Document gaps
10:00 - 10:15  Phase 4: Prioritize fixes

--- Break ---

10:30 - 12:30  Phase 5: Implement fixes (Must Have only)
12:30 - 13:00  Phase 6: Delete & recreate
13:00 - 13:15  Phase 7: Analyze results
```

### Standard (Full Day)

```
Morning:
  - Phases 1-4 (planning)
  
Afternoon:
  - Phase 5 (Must Have + Should Have fixes)
  
Evening:
  - Phases 6-7 (test & analyze)
```

### Thorough (Multiple Sessions)

```
Session 1: Phases 1-4 (Discovery)
Session 2: Phase 5 (Must Have fixes)
Session 3: Phase 5 continued (Should Have)
Session 4: Phases 6-7 (Validation)
```

---

## 🎯 Decision Points

### Before Starting

#### Question 1: Pattern Strategy
**Should system support multiple patterns or XState-only?**

**Option A: XState-Only**
- ✅ Simple, unified model
- ✅ Uses XState ecosystem
- ✅ One visualizer approach
- ❌ Requires modeling everything as states

**Option B: Multi-Pattern**
- ✅ Natural for each use case
- ✅ Less cognitive load
- ❌ More complex system
- ❌ Multiple code paths

**Recommendation:** XState-only (everything has states!)

#### Question 2: Template Strategy
**How should templates work?**

**Option A: Pre-built Templates**
```
- BookingWorkflow
- CMSPageWorkflow
- NotificationWorkflow
- GenericWorkflow
```

**Option B: Template Wizard**
```
What type? → Stateful / Content / Generic
Then: Generate appropriate structure
```

**Recommendation:** Pre-built with "Custom" option

#### Question 3: Scope
**What to build in this cycle?**

**Minimum:**
- Parse CMS pattern
- Show in visualizer
- Basic Add State

**Standard:**
- + Templates
- + Better UX
- + Documentation

**Maximum:**
- + Visual builder
- + Inline editing
- + Test generation

**Recommendation:** Standard scope

---

## 📝 Documentation to Create

### User-Facing Docs

1. **Getting Started with CMS Pattern**
   - How CMS pages are state machines
   - Example: empty → published flow
   - When to use this pattern

2. **XState Quick Reference**
   - What is `assign()`?
   - How to define transitions
   - Context vs state

3. **Pattern Library**
   - Booking pattern (example)
   - CMS pattern (example)
   - Generic pattern (template)

### Developer Docs

1. **Discovery Service Enhancement**
   - Multi-pattern detection
   - Generic folder support
   - Parser improvements

2. **Template System**
   - How to add new templates
   - Template structure
   - Customization points

3. **Visualizer Updates**
   - Pattern-based coloring
   - New node types
   - Layout improvements

---

## 🎨 UI/UX Enhancements

### Visual Distinctions

```javascript
// Pattern-based colors
const patternColors = {
  booking: '#9333ea',      // Purple (existing)
  cms: '#10b981',          // Green (new)
  notification: '#f59e0b', // Amber (new)
  generic: '#3b82f6'       // Blue (new)
};

// Node shapes by state type
const stateShapes = {
  initial: 'ellipse',
  normal: 'roundrectangle',
  terminal: 'diamond',
  error: 'octagon'
};
```

### Tooltips & Guidance

```
Hover over "Add State" →
  💡 "States represent workflow positions.
      For CMS: empty, filling, draft, published.
      For Booking: pending, accepted, rejected."

Hover over "Transitions" →
  💡 "Transitions are events that move between states.
      Use UPPERCASE: PUBLISH, SAVE_DRAFT, CANCEL"

Hover over "Context" →
  💡 "Context holds accumulated data through the workflow.
      Add fields that persist: pageTitle, publishedAt, etc."
```

### In-App Guide Mode

```
[?] Guide Mode: ON

Shows step-by-step for first-time users:
  1️⃣ "Let's create your first state machine!"
  2️⃣ "Add an initial state (e.g., 'empty')"
  3️⃣ "Add a transition (e.g., START_FILLING)"
  4️⃣ "Define what data this state needs"
  5️⃣ "Generate your file!"
```

---

## 🔄 Iteration Strategy

### If 100% Success
```
1. Document the victory
2. Create tutorial based on experience
3. Move to next pattern (Notifications?)
4. Expand system capabilities
```

### If 80% Success
```
1. Identify the 20% gap
2. Is it a system issue or design issue?
3. Quick fix or needs rethinking?
4. Iterate and test again
```

### If <80% Success
```
1. Root cause analysis
2. Is XState the right model?
3. Should we support multiple patterns?
4. Redesign and retest
```

---

## 🎓 Learning Objectives

### Technical Learnings

- Can our discovery handle multiple patterns?
- Does visualizer work for non-booking flows?
- Are our templates flexible enough?
- Is XState truly universal?

### UX Learnings

- Is the workflow intuitive?
- What's confusing for new users?
- Where do users get stuck?
- What documentation is needed?

### Strategic Learnings

- Should we force XState on everything?
- Or support multiple paradigms?
- What's the right abstraction level?
- How much guidance is enough?

---

## ✅ Completion Checklist

### Before Starting
- [ ] Read this plan thoroughly
- [ ] Understand dogfooding strategy
- [ ] Decide on key questions
- [ ] Estimate time commitment

### During Testing
- [ ] Follow phases in order
- [ ] Document everything
- [ ] Take screenshots
- [ ] Note pain points

### After Testing
- [ ] Complete results document
- [ ] Update host system
- [ ] Retest with improvements
- [ ] Create user documentation

---

## 📚 References

**Related Documents:**
- SESSION-11-SUMMARY.md - CMS implementation details
- SYSTEM-OVERVIEW.md - Architecture
- PHASE_2_AND_5_COMPLETE.md - Current capabilities
- CHANGELOG.md - Version history

**Key Files Created (Session 11):**
- StayCardsModuleImplications.js
- TestContext.js
- ExpectImplication.js
- TestSetup.js
- App.js

**Booking Repo Examples:**
- AcceptedBookingImplications.js
- BaseBookingImplications.js
- AcceptBooking-Web-UNIT.spec.js

---

## 🎯 Success Definition

**We succeed when:**

1. We can scan CMS project and see CMSPageImplications
2. The visualizer shows the state machine correctly
3. We can use "Add State" to create similar files
4. The generated file is usable without manual editing
5. We have documented gaps and fixed critical ones
6. We understand what our system needs to guide users

**We REALLY succeed when:**

A new user can:
1. Open our system
2. See the guide
3. Click "Add State"
4. Choose "CMS Pattern"
5. Fill in a few fields
6. Click "Generate"
7. Get a working implications file

**Without reading documentation or asking for help!**

---

*Plan Version: 1.0*  
*Last Updated: October 22, 2025*  
*Status: Ready to Execute*  
*Estimated Time: 4-8 hours*