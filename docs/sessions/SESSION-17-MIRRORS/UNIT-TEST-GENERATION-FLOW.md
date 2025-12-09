# 📚 UNIT Test Generation Flow & Prerequisites System

## Overview

The UNIT test generator creates **executable action functions** that transition between states. Each generated test:

1. ✅ Loads test data
2. ✅ Validates prerequisites (previous states)
3. ✅ Executes the state-inducing action
4. ✅ Saves state changes with delta
5. ✅ Validates UI implications (mirrorsOn)

---

## 🔄 The Complete Flow

### Phase 1: Definition (Implication File)

```javascript
// apps/cms/tests/implications/pages/CMSPageImplications.js

class CMSPageImplications {
  static xstateConfig = {
    states: {
      filling: {
        meta: {
          status: 'filling',
          requiredFields: ['pageTitle'],
          setup: [{
            testFile: 'FillPage-CMS-UNIT.spec.js',
            actionName: 'fillPage',
            platform: 'cms'
          }]
        },
        on: { 
          SAVE_DRAFT: 'draft',
          PUBLISH_DIRECT: 'published'
        }
      },
      
      draft: {
        meta: {
          status: 'draft',
          requiredFields: ['pageTitle', 'savedAt'],
          setup: [{
            actionName: 'saveDraft',
            platform: 'cms'
          }],
          requires: {
            previousStatus: 'filling'  // ⚠️ MUST come from filling
          }
        },
        on: {
          PUBLISH: 'published'
        }
      },
      
      published: {
        meta: {
          status: 'published',
          requiredFields: ['pageTitle', 'publishedAt', 'pageUrl', 'slug'],
          setup: [{
            actionName: 'publishPage',
            platform: 'cms'
          }],
          requires: {
            previousStatus: 'draft'  // ⚠️ MUST come from draft
          }
        }
      }
    }
  };
  
  static mirrorsOn = {
    UI: {
      CMS: {
        published: [{
          screen: 'editLandingPage',
          description: 'Published page in CMS editor',
          visible: ['viewLiveButton', 'unpublishButton'],
          hidden: ['publishButton'],
          checks: {
            text: {
              status: 'Published',
              pageUrl: '{{pageUrl}}'
            }
          }
        }]
      }
    }
  };
}
```

---

### Phase 2: Generation

**Command:**
```bash
node tools/test-generator/cli.js \
  apps/cms/tests/implications/pages/CMSPageImplications.js \
  --platform cms \
  --state published
```

**What Happens:**

1. **Loads Implication** → Reads CMSPageImplications.js
2. **Extracts Metadata** → Gets `published` state config
3. **Detects Prerequisites** → Finds `requires.previousStatus: 'draft'`
4. **Extracts Delta Fields** → Parses `entry: assign({...})`
5. **Extracts Validations** → Reads `mirrorsOn.UI.CMS.published`
6. **Calculates Paths** → Finds correct import paths
7. **Renders Template** → Fills in unit-test.hbs
8. **Writes File** → Creates PublishPage-CMS-UNIT.spec.js

---

### Phase 3: Generated Test

```javascript
// apps/cms/tests/implications/pages/PublishPage-CMS-UNIT.spec.js

const { test, expect } = require('@playwright/test');
const TestContext = require('../../../../../tests/implications/utils/TestContext');
const CMSPageImplications = require('./CMSPageImplications.js');
const TestPlanner = require('../../../../../tests/implications/utils/TestPlanner');
const ExpectImplication = require('../../../../../tests/implications/utils/ExpectImplication');

/**
 * ✅ EXPORTED FUNCTION - Transition to published state
 */
const publishPage = async (testDataPath, options = {}) => {
  const { page } = options;
  
  // ────────────────────────────────────────────────────────
  // STEP 1: Load TestData
  // ────────────────────────────────────────────────────────
  const ctx = TestContext.load(CMSPageImplications, testDataPath);
  
  console.log('\n🎯 Starting: Transition to published state');
  console.log('   Target Status: published');
  console.log('   Current Status: ' + (ctx.data.status || 'Unknown'));
  
  // ────────────────────────────────────────────────────────
  // STEP 2: Prerequisites Check (CRITICAL!)
  // ────────────────────────────────────────────────────────
  console.log('ℹ️  No prerequisites required for this state');
  
  // ────────────────────────────────────────────────────────
  // STEP 3: Navigate to Screen & Perform Action
  // ────────────────────────────────────────────────────────
  
  // TODO: Navigate to the screen where you perform this action
  // TODO: Perform the state-inducing action
  
  console.log('   ⚠️  TODO: Implement action logic');
  console.log('   📝 Add your navigation and action code here');
  
  // ────────────────────────────────────────────────────────
  // STEP 4: Save Changes (Delta)
  // ────────────────────────────────────────────────────────
  return ctx.executeAndSave(
    'published State',
    'PublishPage-CMS-UNIT.spec.js',
    async () => {
      const delta = {};
      
      // ✨ Generated delta from entry: assign
      delta['status'] = 'published';
      delta['publishedAt'] = options.publishedAt || new Date().toISOString();
      delta['slug'] = options.slug;
      delta['pageUrl'] = options.pageUrl;
      
      return { delta };
    }
  );
};

// ═══════════════════════════════════════════════════════════
// OPTIONAL TEST REGISTRATION
// ═══════════════════════════════════════════════════════════

const shouldSkipRegistration = process.env.SKIP_UNIT_TEST_REGISTRATION === 'true';

if (!shouldSkipRegistration) {
  test.describe("UNIT: published State Transition", () => {
    test.setTimeout(120000);
    
    const testDataPath = process.env.TEST_DATA_PATH || "tests/data/shared.json";
    
    test("Execute published transition", async ({ page }) => {
      await publishPage(testDataPath, { page });
      
      // ✅ Validate UI implications (mirrorsOn)
      await test.step('Validate published State UI (cms)', async () => {
        const ctx = TestContext.load(CMSPageImplications, testDataPath);
        
        // Published page in CMS editor
        // Visible: viewLiveButton, unpublishButton, archiveButton, pageTitle (4)
        // Hidden: publishButton (1)
        await ExpectImplication.validateImplications(
          CMSPageImplications.mirrorsOn.UI.CMS.published,
          ctx.data,
          page
        );
      });
    });
  });
}

module.exports = { publishPage };
```

---

## 🎯 Prerequisites System

### How Prerequisites Work

The system uses **TestPlanner** to validate prerequisites before running tests.

#### Example: Sequential States

```
empty → filling → draft → published
```

**To reach `published`:**
1. Must first be in `draft` state
2. Which requires `filling` state
3. Which requires `empty` state

### TestPlanner Analysis

```javascript
// What TestPlanner does:

const TestPlanner = require('../utils/TestPlanner');

// 1. Build prerequisite chain
const chain = TestPlanner.buildPrerequisiteChain(
  CMSPageImplications,
  'published'
);

// Returns:
// [
//   { status: 'empty', testFile: 'CreatePage-CMS-UNIT.spec.js', ... },
//   { status: 'filling', testFile: 'FillPage-CMS-UNIT.spec.js', ... },
//   { status: 'draft', testFile: 'SaveDraft-CMS-UNIT.spec.js', ... },
//   { status: 'published', testFile: 'PublishPage-CMS-UNIT.spec.js', ... }
// ]

// 2. Check what's missing
const analysis = TestPlanner.analyzeState(testDataPath, CMSPageImplications);

// Returns:
// {
//   ready: false,
//   currentStatus: 'empty',
//   targetStatus: 'published',
//   missingSteps: [
//     { status: 'filling', testFile: 'FillPage-CMS-UNIT.spec.js', ... },
//     { status: 'draft', testFile: 'SaveDraft-CMS-UNIT.spec.js', ... },
//     { status: 'published', testFile: 'PublishPage-CMS-UNIT.spec.js', ... }
//   ]
// }

// 3. Throw error if not ready
TestPlanner.checkOrThrow(CMSPageImplications, testData);
// ❌ Throws: "published state not ready! Run these UNIT tests first: ..."
```

---

## 📝 Implementation Steps for Developer

### Step 1: Fill in the TODO sections

```javascript
const publishPage = async (testDataPath, options = {}) => {
  const { page } = options;
  const ctx = TestContext.load(CMSPageImplications, testDataPath);
  
  // ✅ STEP 1: Navigate to the page
  await page.goto(`/cms/pages/${ctx.data.pageId}/edit`);
  await page.waitForLoadState('networkidle');
  
  // ✅ STEP 2: Click the publish button
  await page.getByRole('button', { name: 'PUBLISH' }).click();
  
  // ✅ STEP 3: Wait for confirmation
  await expect(page.locator('.success-message')).toBeVisible();
  await expect(page.locator('.success-message')).toContainText('Published');
  
  // ✅ STEP 4: Capture the published URL
  const publishedUrl = await page.locator('#published-url').textContent();
  const slug = publishedUrl.split('/').pop();
  
  // ✅ STEP 5: Save the delta with captured data
  return ctx.executeAndSave(
    'published State',
    'PublishPage-CMS-UNIT.spec.js',
    async () => {
      return { 
        delta: {
          status: 'published',
          publishedAt: new Date().toISOString(),
          slug: slug,
          pageUrl: publishedUrl
        }
      };
    }
  );
};
```

### Step 2: Run the test

```bash
# Run just this test
npx playwright test PublishPage-CMS-UNIT.spec.js

# Or use the exported function
node -e "
const { publishPage } = require('./PublishPage-CMS-UNIT.spec.js');
publishPage('tests/data/my-page.json', { page: ... });
"
```

### Step 3: Validation automatically runs

The test registration includes validation:

```javascript
test("Execute published transition", async ({ page }) => {
  // 1. Executes the action
  await publishPage(testDataPath, { page });
  
  // 2. Validates UI automatically
  await test.step('Validate published State UI (cms)', async () => {
    const ctx = TestContext.load(CMSPageImplications, testDataPath);
    
    // This checks:
    // ✅ viewLiveButton is visible
    // ✅ unpublishButton is visible
    // ✅ publishButton is hidden
    // ✅ status text says "Published"
    // ✅ pageUrl is displayed correctly
    await ExpectImplication.validateImplications(
      CMSPageImplications.mirrorsOn.UI.CMS.published,
      ctx.data,
      page
    );
  });
});
```

---

## 🔗 Chaining Tests

### Sequential Execution

```javascript
// tests/flows/create-and-publish-page.spec.js

const { test } = require('@playwright/test');
const { fillPage } = require('../implications/pages/FillPage-CMS-UNIT.spec.js');
const { saveDraft } = require('../implications/pages/SaveDraft-CMS-UNIT.spec.js');
const { publishPage } = require('../implications/pages/PublishPage-CMS-UNIT.spec.js');

const testDataPath = 'tests/data/my-page.json';

test.describe('Complete Page Publishing Flow', () => {
  test('Create → Draft → Publish', async ({ page }) => {
    // Step 1: Fill the page
    await fillPage(testDataPath, { 
      page,
      pageTitle: 'My Awesome Page'
    });
    
    // Step 2: Save as draft
    await saveDraft(testDataPath, { page });
    
    // Step 3: Publish
    await publishPage(testDataPath, { page });
    
    // All validations run automatically! ✅
  });
});
```

---

## 🎨 Key Features

### 1. Smart Import Paths ✅

Generator automatically calculates correct paths:

```javascript
// From: apps/cms/tests/implications/pages/
// To:   tests/implications/utils/
// Path: ../../../../../tests/implications/utils/TestContext
```

### 2. Delta Extraction ✅

Automatically extracts fields from `entry: assign({...})`:

```javascript
// Source (Implication):
entry: assign({
  status: 'published',
  publishedAt: ({ event }) => event.publishedAt || new Date().toISOString(),
  slug: ({ event }) => event.slug,
  pageUrl: ({ event }) => event.pageUrl
})

// Generated (Test):
delta['status'] = 'published';
delta['publishedAt'] = options.publishedAt || new Date().toISOString();
delta['slug'] = options.slug;
delta['pageUrl'] = options.pageUrl;
```

### 3. Validation Generation ✅

Automatically creates validation blocks from mirrorsOn:

```javascript
// Source (Implication):
mirrorsOn: {
  UI: {
    CMS: {
      published: [{
        screen: 'editLandingPage',
        visible: ['viewLiveButton', 'unpublishButton'],
        hidden: ['publishButton']
      }]
    }
  }
}

// Generated (Test):
await test.step('Validate published State UI (cms)', async () => {
  await ExpectImplication.validateImplications(
    CMSPageImplications.mirrorsOn.UI.CMS.published,
    ctx.data,
    page
  );
});
```

### 4. Multi-Platform Support ✅

Same Implication, different platforms:

```javascript
setup: [
  {
    platform: 'cms',
    actionName: 'publishPage',
    testFile: 'PublishPage-CMS-UNIT.spec.js'
  },
  {
    platform: 'web',
    actionName: 'viewPublishedPage',
    testFile: 'ViewPage-Web-UNIT.spec.js'
  }
]
```

Generate both:
```bash
# CMS test
node cli.js CMSPageImplications.js --platform cms --state published

# Web test
node cli.js CMSPageImplications.js --platform web --state published
```

---

## 🚀 Best Practices

### 1. Define Prerequisites Clearly

```javascript
meta: {
  status: 'published',
  requires: {
    previousStatus: 'draft'  // ✅ Clear dependency
  }
}
```

### 2. Use Descriptive Action Names

```javascript
setup: [{
  actionName: 'publishPage',  // ✅ Clear what it does
  platform: 'cms'
}]
```

### 3. Extract All Delta Fields

```javascript
entry: assign({
  status: 'published',
  publishedAt: ({ event }) => event.publishedAt,
  slug: ({ event }) => event.slug,
  pageUrl: ({ event }) => event.pageUrl
  // ✅ All fields that change
})
```

### 4. Define UI Validations

```javascript
mirrorsOn: {
  UI: {
    CMS: {
      published: [{
        screen: 'editLandingPage',
        visible: ['viewLiveButton'],  // ✅ What should appear
        hidden: ['publishButton'],     // ✅ What should hide
        checks: {
          text: {
            status: 'Published'  // ✅ What text to verify
          }
        }
      }]
    }
  }
}
```

---

## 📊 Complete Example: Booking System

```javascript
// AcceptedBookingImplications.js

class AcceptedBookingImplications {
  static xstateConfig = {
    meta: {
      status: 'Accepted',
      requires: {
        previousStatus: 'pending'  // ⚠️ Must come from pending
      },
      setup: [
        {
          platform: 'web',
          actionName: 'acceptBooking',
          testFile: 'AcceptBooking-Web-UNIT.spec.js'
        },
        {
          platform: 'manager',
          actionName: 'acceptBooking',
          testFile: 'AcceptBooking-Manager-UNIT.spec.js'
        }
      ],
      requiredFields: ['clubName', 'dancerName', 'bookingTime']
    },
    
    on: {
      UNDO: 'pending',
      CANCEL: 'rejected'
    },
    
    entry: assign({
      status: 'Accepted',
      acceptedAt: ({ event }) => event.acceptedAt,
      acceptedBy: ({ event }) => event.managerName
    })
  };
  
  static mirrorsOn = {
    UI: {
      web: {
        Accepted: [{
          screen: 'bookingDetails',
          visible: ['undoButton', 'acceptedBadge'],
          hidden: ['acceptButton'],
          checks: {
            text: {
              status: 'Accepted',
              acceptedBy: '{{managerName}}'
            }
          }
        }]
      }
    }
  };
}
```

**Generate tests:**
```bash
# Web test
node cli.js AcceptedBookingImplications.js --platform web

# Mobile test
node cli.js AcceptedBookingImplications.js --platform manager
```

**Use in flow:**
```javascript
const { createBooking } = require('./CreateBooking-Web-UNIT.spec.js');
const { acceptBooking } = require('./AcceptBooking-Web-UNIT.spec.js');

test('Accept booking flow', async ({ page }) => {
  // Step 1: Create (pending state)
  await createBooking(testDataPath, { page });
  
  // Step 2: Accept (accepted state)
  await acceptBooking(testDataPath, { page });
  
  // ✅ Prerequisites validated
  // ✅ UI validated
  // ✅ Delta saved
});
```

---

## 🎯 Summary

The generated tests are **production-ready action functions** that:

1. ✅ **Load state** from TestContext
2. ✅ **Validate prerequisites** with TestPlanner
3. ✅ **Execute actions** (you fill in the TODO)
4. ✅ **Save changes** with delta tracking
5. ✅ **Validate UI** automatically from mirrorsOn

**You just need to:**
- Fill in the navigation code
- Fill in the action code
- Capture any dynamic data (URLs, IDs, etc.)

**Everything else is automatic!** 🚀