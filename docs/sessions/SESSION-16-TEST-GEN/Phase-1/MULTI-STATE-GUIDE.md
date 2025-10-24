# 🎯 Multi-State Machine Support - Usage Guide

**Updated:** October 24, 2025  
**Feature:** Generate tests for multi-state machines (like CMSPageImplications)

---

## 🆕 What's New

The generator now supports **BOTH**:
1. ✅ **Single-state Implications** (AcceptedBookingImplications)
2. ✅ **Multi-state Implications** (CMSPageImplications)

---

## 📊 Two Types of Implications

### Type 1: Single-State (Booking-style)

```javascript
class AcceptedBookingImplications {
  static xstateConfig = {
    meta: {                    // ← meta at ROOT
      status: "Accepted",
      requiredFields: [...],
      setup: [...]
    },
    entry: assign({...}),
    on: { UNDO: 'pending' }
  };
}
```

**Generator behavior:** Generates ONE test for the "Accepted" state

---

### Type 2: Multi-State (CMS-style)

```javascript
class CMSPageImplications {
  static xstateConfig = {
    initial: 'empty',          // ← has initial + states
    states: {
      empty: {
        meta: {                // ← meta INSIDE each state
          status: 'empty',
          setup: [...]
        },
        on: { START_FILLING: 'filling' }
      },
      filling: {
        meta: { status: 'filling', setup: [...] },
        entry: assign({...}),
        on: { SAVE_DRAFT: 'draft' }
      },
      published: {
        meta: { status: 'published', setup: [...] },
        entry: assign({...}),
        on: { UNPUBLISH: 'draft' }
      }
      // ... more states
    }
  };
}
```

**Generator behavior:** 
- **Without `--state`:** Generates tests for ALL states (empty, filling, published, etc.)
- **With `--state`:** Generates test for SPECIFIC state only

---

## 🎮 How to Use

### For Single-State (No Change)

```bash
# Works as before
node tools/test-generator/cli.js \
  tests/implications/bookings/AcceptedBookingImplications.js
  
# Output: AcceptBooking-Web-UNIT.spec.js
```

---

### For Multi-State: Generate ALL States

```bash
# Generate test for EVERY state in the machine
node tools/test-generator/cli.js \
  apps/cms/tests/implications/pages/CMSPageImplications.js

# Output:
# - CreatePage-CMS-UNIT.spec.js      (empty state)
# - FillPage-CMS-UNIT.spec.js        (filling state)
# - SaveDraft-CMS-UNIT.spec.js       (draft state)
# - PublishPage-CMS-UNIT.spec.js     (published state)
# - ArchivePage-CMS-UNIT.spec.js     (archived state)
```

**Perfect for:** Initial setup, generating complete test suite

---

### For Multi-State: Generate SPECIFIC State

```bash
# Generate ONLY the "published" state test
node tools/test-generator/cli.js \
  apps/cms/tests/implications/pages/CMSPageImplications.js \
  --state published

# Output: PublishPage-CMS-UNIT.spec.js
```

**Perfect for:** 
- Regenerating one specific test after changes
- Testing iteratively
- Avoiding overwriting tests you've customized

---

## 💡 Examples

### Example 1: Your CMSPageImplications

```bash
cd /home/dimitrij/Projects/cxm/Leclerc-Phase-2-Playwright

# Generate ALL CMS page tests
node tools/test-generator/cli.js \
  apps/cms/tests/implications/pages/CMSPageImplications.js \
  --platform cms

# Output:
✨ Multi-state machine detected
📋 Found 7 states: empty, filling, draft, published, editing_published, archived, deleted

🎯 Generating for state: empty
   ✅ Written: .../CreatePage-CMS-UNIT.spec.js

🎯 Generating for state: filling
   ✅ Written: .../FillPage-CMS-UNIT.spec.js

🎯 Generating for state: draft
   ✅ Written: .../SaveDraft-CMS-UNIT.spec.js

🎯 Generating for state: published
   ✅ Written: .../PublishPage-CMS-UNIT.spec.js

... etc ...

✅ Generated 5 test(s)
```

---

### Example 2: Just the "published" Test

```bash
# Only generate test for publishing a page
node tools/test-generator/cli.js \
  apps/cms/tests/implications/pages/CMSPageImplications.js \
  --state published \
  --platform cms

# Output: PublishPage-CMS-UNIT.spec.js
```

---

### Example 3: Preview Before Writing

```bash
# See what will be generated without writing files
node tools/test-generator/cli.js \
  apps/cms/tests/implications/pages/CMSPageImplications.js \
  --state published \
  --preview

# Shows preview of generated code
```

---

## 🎯 State Detection Logic

The generator automatically detects the Implication type:

```javascript
function isMultiState(ImplClass) {
  const config = ImplClass.xstateConfig;
  
  // Has "initial" and "states" → Multi-state
  if (config.initial && config.states) {
    return true;
  }
  
  // Has "meta" at root → Single-state
  if (config.meta) {
    return false;
  }
}
```

**No manual configuration needed!** ✨

---

## 📁 Output File Names

File names are generated from the **action** and **platform**:

### Single-State
```
AcceptedBookingImplications → AcceptBooking-Web-UNIT.spec.js
                           → AcceptBooking-Dancer-UNIT.spec.js
```

### Multi-State
```
CMSPageImplications (empty state)     → CreatePage-CMS-UNIT.spec.js
CMSPageImplications (filling state)   → FillPage-CMS-UNIT.spec.js
CMSPageImplications (draft state)     → SaveDraft-CMS-UNIT.spec.js
CMSPageImplications (published state) → PublishPage-CMS-UNIT.spec.js
```

**Pattern:** `{Action}-{Platform}-UNIT.spec.js`

---

## 🔧 Smart Features

### 1. Skips States Without Setup

```javascript
archived: {
  meta: {
    status: 'archived'
    // No setup! ← Generator skips this state
  }
}
```

**Output:**
```
⏭️  Skipping archived (no setup defined)
```

Only generates tests for **actionable states** (states with `setup` defined).

---

### 2. Extracts Previous State

```javascript
draft: {
  on: {
    PUBLISH: 'published'  // ← draft → published
  }
}

published: {
  meta: {
    // Generator knows: previousStatus = 'draft'
  }
}
```

**Generates prerequisites check automatically!**

---

### 3. State-Specific Delta

```javascript
published: {
  entry: assign({
    status: 'published',
    publishedAt: ({event}) => event.publishedAt,
    pageUrl: ({event}) => event.pageUrl
  })
}
```

**Generates:**
```javascript
const delta = {
  status: 'published',
  publishedAt: now,
  pageUrl: pageUrl
};
```

---

## 🚀 Quick Start for Your Project

### Step 1: Run Generator

```bash
cd /home/dimitrij/Projects/cxm/Leclerc-Phase-2-Playwright

# Generate ALL CMS tests
node tools/test-generator/cli.js \
  apps/cms/tests/implications/pages/CMSPageImplications.js
```

### Step 2: Review Generated Tests

```bash
ls -la apps/cms/tests/implications/pages/*-UNIT.spec.js

# You should see:
# - CreatePage-CMS-UNIT.spec.js
# - FillPage-CMS-UNIT.spec.js
# - SaveDraft-CMS-UNIT.spec.js
# - PublishPage-CMS-UNIT.spec.js
# - etc.
```

### Step 3: Fill in TODOs

Each test has placeholders:

```javascript
// TODO: Navigate to the screen where you perform this action
// TODO: Perform the state-inducing action
```

Fill these in with your actual navigation and action code!

### Step 4: Run Tests

```bash
TEST_DATA_PATH="tests/data/cms-page.json" \
npx playwright test PublishPage-CMS-UNIT.spec.js
```

---

## 🎉 Summary

✅ **Single-state:** Works as before  
✅ **Multi-state:** Automatically detected  
✅ **Generate all:** Omit `--state` flag  
✅ **Generate one:** Use `--state <name>` flag  
✅ **Smart skipping:** Only generates for states with `setup`  
✅ **State-specific:** Each test gets correct delta, prerequisites  

---

## 💡 Pro Tips

1. **Start with all states:** Generate everything first, review what you get
2. **Regenerate selectively:** Use `--state` to regenerate just one test
3. **Preview first:** Always use `--preview` before writing to see what's generated
4. **Version control:** Commit generated tests, they're real code now!

---

**You're ready to generate tests for your CMS pages!** 🚀

Try it now:
```bash
node tools/test-generator/cli.js \
  apps/cms/tests/implications/pages/CMSPageImplications.js \
  --state published
```
