# UI Validation Flow - Visual Guide

## 📊 High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Developer writes Implication with mirrorsOn                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  static mirrorsOn = {                                        │
│    UI: {                                                     │
│      CMS: {                                                  │
│        published: {                                          │
│          screen: 'editLandingPage',                          │
│          visible: ['viewLiveButton', ...],                   │
│          hidden: ['publishButton'],                          │
│          checks: { text: { status: 'Published' } }           │
│        }                                                     │
│      }                                                       │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  UnitTestGenerator.generate()                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Load Implication                                         │
│  2. Extract metadata (including mirrorsOn)                   │
│  3. _extractScreenValidations()                              │
│     └─> Parse mirrorsOn.UI.{platform}.{state}              │
│     └─> Build summaries for each screen                     │
│  4. Add to context: hasValidation, screenValidations         │
│  5. Render template with validation blocks                  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Generated UNIT Test                                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  const ExpectImplication = require('...');                   │
│                                                               │
│  test("Execute published transition", async ({ page }) => { │
│    // 1. Execute action                                      │
│    await publishPage(testDataPath, { page });                │
│                                                               │
│    // 2. Validate UI (NEW!)                                  │
│    await test.step('Validate UI', async () => {             │
│      const ctx = TestContext.load(...);                      │
│                                                               │
│      // Published state validation                           │
│      await ExpectImplication.validateImplications(           │
│        CMSPageImplications.mirrorsOn.UI.CMS.published,       │
│        ctx.data,                                             │
│        page                                                  │
│      );                                                      │
│    });                                                       │
│  });                                                         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Test Execution (Runtime)                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. publishPage() executes                                   │
│     └─> Navigates to screen                                 │
│     └─> Clicks publish button                               │
│     └─> Saves delta to testData                             │
│                                                               │
│  2. Validation step executes                                 │
│     └─> Loads testData                                      │
│     └─> ExpectImplication.validateImplications()            │
│         │                                                    │
│         ├─> Check visible elements                          │
│         │   ✓ viewLiveButton visible                        │
│         │   ✓ unpublishButton visible                       │
│         │                                                    │
│         ├─> Check hidden elements                           │
│         │   ✓ publishButton NOT visible                     │
│         │                                                    │
│         └─> Check text content                              │
│             ✓ status = "Published"                          │
│             ✓ pageUrl matches testData.pageUrl              │
│                                                               │
│  3. Test passes ✅                                           │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

```
Implication Definition
        │
        │ mirrorsOn.UI.{platform}.{state}
        │
        ▼
┌─────────────────────┐
│ UnitTestGenerator   │
│                     │
│ _extractScreen      │
│ Validations()       │
└─────────────────────┘
        │
        │ screenValidations: [
        │   {
        │     screenName: 'published',
        │     summary: 'Visible: ... (4), Hidden: ... (1)'
        │   }
        │ ]
        │
        ▼
┌─────────────────────┐
│  Template Engine    │
│                     │
│  unit-test.hbs      │
└─────────────────────┘
        │
        │ Generated code with:
        │ - ExpectImplication import
        │ - Validation test.step
        │ - Screen comments
        │
        ▼
┌─────────────────────┐
│  Generated Test     │
│                     │
│  *-UNIT.spec.js     │
└─────────────────────┘
        │
        │ At runtime
        │
        ▼
┌─────────────────────┐
│ ExpectImplication   │
│                     │
│ validateImplications│
└─────────────────────┘
```

## 🎯 Screen Validation Process

```
Input: CMSPageImplications.mirrorsOn.UI.CMS.published

┌──────────────────────────────────────────────────┐
│ _extractScreenValidations()                      │
├──────────────────────────────────────────────────┤
│                                                   │
│ 1. Get platform key: 'cms' → 'CMS'              │
│                                                   │
│ 2. Get screens for platform:                     │
│    mirrorsOn.UI.CMS                              │
│                                                   │
│ 3. Filter by state (if multi-state):             │
│    mirrorsOn.UI.CMS.published                    │
│                                                   │
│ 4. For each screen, build summary:               │
│    _buildScreenSummary()                         │
│    │                                             │
│    ├─> Count visible elements (4)               │
│    ├─> Count hidden elements (1)                │
│    └─> Count text checks (2)                    │
│                                                   │
│ 5. Return:                                       │
│    [{                                            │
│      screenName: 'published',                    │
│      summary: 'Visible: viewLiveButton... (4),   │
│                Hidden: publishButton (1),        │
│                Text: status, pageUrl (2)'        │
│    }]                                            │
└──────────────────────────────────────────────────┘
```

## 📝 Template Rendering

```
Context Object:
{
  hasValidation: true,
  screenValidations: [{
    screenName: 'published',
    summary: 'Visible: ... (4), Hidden: ... (1)'
  }],
  platformKey: 'CMS',
  implClassName: 'CMSPageImplications',
  targetStatus: 'published',
  platform: 'cms'
}

                │
                ▼

Template (unit-test.hbs):
{{#if hasValidation}}
  await test.step('Validate {{targetStatus}} State UI ({{platform}})', async () => {
    {{#each screenValidations}}
      // {{screenName}}
      // {{summary}}
      await ExpectImplication.validateImplications(
        {{../implClassName}}.mirrorsOn.UI.{{../platformKey}}.{{screenName}},
        ctx.data,
        page
      );
    {{/each}}
  });
{{/if}}

                │
                ▼

Generated Code:
await test.step('Validate published State UI (cms)', async () => {
  // published
  // Visible: viewLiveButton, unpublishButton... (4), Hidden: publishButton (1), Text: status, pageUrl (2)
  await ExpectImplication.validateImplications(
    CMSPageImplications.mirrorsOn.UI.CMS.published,
    ctx.data,
    page
  );
});
```

## 🔍 Platform Key Mapping

```
Generator Platform → mirrorsOn Key

'web'              → 'Web'
'cms'              → 'CMS'
'mobile-dancer'    → 'dancer'
'mobile-manager'   → 'clubApp'

Example:
  platform: 'cms'
  └─> platformKey: 'CMS'
      └─> Reference: ImplClass.mirrorsOn.UI.CMS
```

## 🎭 Multi-State vs Single-State

```
MULTI-STATE MACHINE:
┌────────────────────────────────┐
│ xstateConfig: {                │
│   initial: 'empty',            │
│   states: {                    │
│     empty: { ... },            │
│     filling: { ... },          │
│     draft: { ... },            │
│     published: { ... }         │
│   }                            │
│ }                              │
└────────────────────────────────┘
         │
         │ Generate for 'published' state
         ▼
┌────────────────────────────────┐
│ mirrorsOn.UI.CMS.published     │
│   ↑                            │
│   └─ Only this screen validated│
└────────────────────────────────┘


SINGLE-STATE MACHINE:
┌────────────────────────────────┐
│ xstateConfig: {                │
│   meta: { ... }                │
│   entry: assign(...),          │
│   on: { ... }                  │
│ }                              │
└────────────────────────────────┘
         │
         │ Generate
         ▼
┌────────────────────────────────┐
│ mirrorsOn.UI.CMS               │
│   ↑                            │
│   └─ All screens validated     │
└────────────────────────────────┘
```

## 💡 Example Validation Execution

```
Test executes:
  await publishPage(testDataPath, { page });

State changed:
  testData.status: 'draft' → 'published'
  testData.publishedAt: '2025-10-24T...'
  testData.pageUrl: 'https://...'

Validation step:
  await test.step('Validate published State UI (cms)', async () => {
    
    1. Load testData
       ctx = TestContext.load(CMSPageImplications, testDataPath)
       
    2. Call validateImplications
       ExpectImplication.validateImplications(
         CMSPageImplications.mirrorsOn.UI.CMS.published,
         ctx.data,
         page
       )
       
    3. ExpectImplication checks:
       
       Visible: [viewLiveButton, unpublishButton, archiveButton, pageTitle]
       ✓ await expect(page.locator('[data-testid="viewLiveButton"]')).toBeVisible()
       ✓ await expect(page.locator('[data-testid="unpublishButton"]')).toBeVisible()
       ✓ await expect(page.locator('[data-testid="archiveButton"]')).toBeVisible()
       ✓ await expect(page.locator('[data-testid="pageTitle"]')).toBeVisible()
       
       Hidden: [publishButton]
       ✓ await expect(page.locator('[data-testid="publishButton"]')).toBeHidden()
       
       Text: { status: 'Published', pageUrl: '{{pageUrl}}' }
       ✓ await expect(statusElement).toContainText('Published')
       ✓ await expect(urlElement).toContainText(ctx.data.pageUrl)
       
  });

Result: ✅ All validations passed
```

## 🎨 Visual Comparison

### Before (No Validation)
```
┌────────────────────────┐
│ test("...", async () => { │
│   await publishPage(); │
│ });                    │
└────────────────────────┘
         ↓
    Test passes
    (but no UI checked!)
```

### After (With Validation)
```
┌─────────────────────────────────────┐
│ test("...", async () => {           │
│   await publishPage();              │
│                                     │
│   await test.step('Validate', () => {│
│     ExpectImplication.validate(...);│
│   });                               │
│ });                                 │
└─────────────────────────────────────┘
         ↓
    Test passes
    ✓ Action executed
    ✓ UI validated
    ✓ State confirmed
```

---

**This visual guide shows how the UI validation feature integrates seamlessly into the test generation and execution flow.**
