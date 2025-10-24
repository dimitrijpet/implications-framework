# UI Validation in UNIT Tests - Implementation Guide

## 🎯 Overview

We've added **automatic UI validation** to our generated UNIT tests. Now, after executing a state-inducing action, the test automatically validates that the UI matches the `mirrorsOn` implications defined in your Implication class.

## ✨ What Changed

### 1. **Template Updates** (`unit-test.hbs`)

#### Added ExpectImplication Import
```handlebars
{{#if hasValidation}}
const ExpectImplication = require('{{expectImplicationPath}}');
{{/if}}
```

#### Added Validation Block in Test Registration
```handlebars
test("{{description}}", async ({ page }) => {
  // Execute the action
  await {{../actionName}}(testDataPath, { page });
  
  {{#if ../hasValidation}}
  // Validate UI implications (mirrorsOn)
  await test.step('Validate {{../targetStatus}} State UI ({{../platform}})', async () => {
    const ExpectImplication = require('{{../expectImplicationPath}}');
    const ctx = TestContext.load({{../implClassName}}, testDataPath);
    
    {{#each ../screenValidations}}
    // {{screenName}}
    // {{summary}}
    await ExpectImplication.validateImplications(
      {{../../implClassName}}.mirrorsOn.UI.{{../../platformKey}}.{{screenName}},
      ctx.data,
      page
    );
    
    {{/each}}
  });
  {{/if}}
});
```

### 2. **Generator Updates** (`UnitTestGenerator.js`)

#### New Methods Added

##### `_extractScreenValidations(metadata, platform, targetStatus)`
Extracts screen validations from `mirrorsOn.UI` for the target platform and state.

**Logic:**
1. Gets the platform key (e.g., 'cms' → 'CMS', 'web' → 'Web')
2. For multi-state machines: extracts screens for the target state only
3. For single-state machines: extracts all screens
4. Builds summaries for each screen showing what's validated

**Returns:**
```javascript
[
  {
    screenName: 'editLandingPage',
    summary: 'Visible: viewLiveButton, unpublishButton... (4), Hidden: publishButton (1), Text: status, pageUrl (2)'
  },
  // ... more screens
]
```

##### `_buildScreenSummary(screenData)`
Creates a descriptive summary of what's being validated for a screen.

**Example Output:**
- `"Visible: saveButton, publishButton (2), Hidden: archiveButton (1)"`
- `"Text: status, pageTitle (2)"`
- `"Visible: pageContent (1), Text: pageTitle (1)"`

##### `_getPlatformKeyForMirrorsOn(platform)`
Maps generator platform names to mirrorsOn keys.

**Mapping:**
```javascript
{
  'web': 'Web',
  'cms': 'CMS',
  'mobile-dancer': 'dancer',
  'mobile-manager': 'clubApp'
}
```

#### Context Fields Added

```javascript
{
  // Paths
  expectImplicationPath: '../../utils/ExpectImplication',
  
  // Validation
  hasValidation: true,              // Whether to include validation
  screenValidations: [...],          // Array of screen validations
  platformKey: 'CMS'                 // Platform key for mirrorsOn
}
```

## 📝 Generated Test Example

### Input: CMSPageImplications - Published State

```javascript
// CMSPageImplications.js
static mirrorsOn = {
  UI: {
    CMS: {
      published: {
        screen: 'editLandingPage',
        visible: ['viewLiveButton', 'unpublishButton', 'archiveButton', 'pageTitle'],
        hidden: ['publishButton'],
        checks: {
          text: {
            status: 'Published',
            pageUrl: '{{pageUrl}}'
          }
        }
      }
    }
  }
};
```

### Output: PublishPage-CMS-UNIT.spec.js

```javascript
const { test, expect } = require('@playwright/test');
const TestContext = require('../../utils/TestContext');
const CMSPageImplications = require('./CMSPageImplications.js');
const TestPlanner = require('../../utils/TestPlanner');
const ExpectImplication = require('../../utils/ExpectImplication');

// ... exported function ...

if (!shouldSkipRegistration) {
  test.describe("UNIT: published State Transition", () => {
    test.setTimeout(120000);
    
    const testDataPath = process.env.TEST_DATA_PATH || "tests/data/shared.json";
    
    test("Execute published transition", async ({ page }) => {
      // Execute the action
      await publishPage(testDataPath, { page });
      
      // Validate UI implications (mirrorsOn)
      await test.step('Validate published State UI (cms)', async () => {
        const ExpectImplication = require('../../utils/ExpectImplication');
        const ctx = TestContext.load(CMSPageImplications, testDataPath);
        
        // published
        // Visible: viewLiveButton, unpublishButton... (4), Hidden: publishButton (1), Text: status, pageUrl (2)
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

## 🎨 Features

### ✅ Platform-Specific Validation
Only validates screens for the test's platform:
- CMS test → Only validates `mirrorsOn.UI.CMS` screens
- Web test → Only validates `mirrorsOn.UI.Web` screens
- Mobile test → Only validates `mirrorsOn.UI.dancer` or `mirrorsOn.UI.clubApp`

### ✅ Explicit Screen Listing
Each screen is listed separately with descriptive comments:
```javascript
// editLandingPage
// Visible: viewLiveButton (4), Hidden: publishButton (1), Text: status (2)
await ExpectImplication.validateImplications(...)

// pageListScreen  
// Visible: pageRow, editIcon (2)
await ExpectImplication.validateImplications(...)
```

### ✅ Multi-State Support
For multi-state machines, only validates screens defined for the target state:
- Publishing to 'published' → Only validates `mirrorsOn.UI.CMS.published`
- Not `mirrorsOn.UI.CMS.draft` or other states

### ✅ Smart Import Paths
Automatically calculates correct relative paths for ExpectImplication:
```javascript
// Test at: apps/cms/tests/implications/pages/
// Utils at: apps/cms/tests/utils/
// Import:   ../../utils/ExpectImplication ✓
```

### ✅ Test Step Integration
Validation runs in a dedicated test step for better reporting:
```javascript
await test.step('Validate published State UI (cms)', async () => {
  // All validations here
});
```

## 🔧 Usage

### Generate with Validation

```bash
# Single state
node cli.js generate:unit \
  --impl apps/cms/tests/implications/pages/CMSPageImplications.js \
  --platform cms \
  --state published

# Multiple states (generates all)
node cli.js generate:unit \
  --impl apps/cms/tests/implications/pages/CMSPageImplications.js \
  --platform cms
```

### Verification Checklist

When generating, verify:
- ✅ ExpectImplication is imported at the top
- ✅ Validation block appears after action execution
- ✅ Only platform-specific screens are validated
- ✅ Comments show what's being validated
- ✅ Screen names match your mirrorsOn definition
- ✅ Import paths are correct (../../utils/...)

## 🎯 What's Validated

The `ExpectImplication.validateImplications()` call checks:

1. **Visible Elements** - Elements that should be visible
2. **Hidden Elements** - Elements that should NOT be visible
3. **Text Content** - Text values (with placeholder support)
4. **Prerequisites** - Runs any prerequisite setup if defined

## 💡 Benefits

### For Developers
- **No manual validation code** - Generated automatically
- **Consistent validation** - Same pattern across all tests
- **Self-documenting** - Comments explain what's validated
- **Type-safe** - References actual mirrorsOn objects

### For Test Quality
- **Complete coverage** - All screens validated automatically
- **Platform isolation** - No cross-platform pollution
- **State-specific** - Only validates relevant screens
- **Prerequisites included** - Setup happens automatically

### For Maintenance
- **Single source of truth** - mirrorsOn defines validation
- **Easy updates** - Change mirrorsOn, regenerate tests
- **No duplication** - Validation logic in one place
- **Clear failures** - Test steps show exactly what failed

## 🐛 Troubleshooting

### Validation Not Generated?

**Check:**
1. Does `mirrorsOn.UI` exist in your Implication?
2. Does `mirrorsOn.UI.{PlatformKey}` exist? (CMS, Web, dancer, clubApp)
3. For multi-state: Does `mirrorsOn.UI.{PlatformKey}.{stateName}` exist?
4. Is the platform key correct? ('cms' → 'CMS', 'web' → 'Web')

### Wrong Import Paths?

**Solution:**
Ensure `implFilePath` is set correctly when calling generator:
```javascript
const generator = new UnitTestGenerator();
generator.generate('/full/path/to/CMSPageImplications.js', {
  platform: 'cms',
  state: 'published'
});
```

### Validation Failing at Runtime?

**Check:**
1. ExpectImplication.js exists in utils folder
2. Screen objects are properly defined
3. Test data has required fields
4. Platform detection works (page vs app object)

## 📚 Related Files

- **Template:** `unit-test.hbs` (lines 16-17, 219-240)
- **Generator:** `UnitTestGenerator.js` (lines 337-341, 357, 395-401, 911-1030)
- **Validation Engine:** `ExpectImplication.js` (used at runtime)
- **Example:** `CMSPageImplications.js` (shows mirrorsOn structure)

## 🚀 Next Steps

1. **Test the generation** - Run test-validation-generation.js
2. **Review generated code** - Ensure validation blocks are correct
3. **Run the tests** - Verify validation works at runtime
4. **Update documentation** - Add examples to your team docs
5. **Train team** - Show how to use mirrorsOn for validation

---

**Version:** 1.0  
**Last Updated:** October 24, 2025  
**Author:** Implications Framework Team
