# UI Validation - Quick Reference Card

## ⚡ TL;DR

Generated UNIT tests now automatically validate UI using `mirrorsOn` definitions. No extra work needed!

## 📋 What You Need

### In Your Implication
```javascript
static mirrorsOn = {
  UI: {
    CMS: {           // ← Platform key (CMS, Web, dancer, clubApp)
      published: {   // ← State name
        screen: 'editLandingPage',
        visible: ['viewLiveButton', 'unpublishButton'],
        hidden: ['publishButton'],
        checks: {
          text: {
            status: 'Published',
            pageUrl: '{{pageUrl}}'  // ← From testData
          }
        }
      }
    }
  }
};
```

## 🎯 What Gets Generated

```javascript
test("Execute published transition", async ({ page }) => {
  await publishPage(testDataPath, { page });
  
  // ✨ AUTO-GENERATED VALIDATION
  await test.step('Validate published State UI (cms)', async () => {
    const ctx = TestContext.load(CMSPageImplications, testDataPath);
    
    await ExpectImplication.validateImplications(
      CMSPageImplications.mirrorsOn.UI.CMS.published,
      ctx.data,
      page
    );
  });
});
```

## 🔑 Platform Keys

| Generator Platform | mirrorsOn Key | Example |
|-------------------|---------------|---------|
| `web` | `Web` | `mirrorsOn.UI.Web` |
| `cms` | `CMS` | `mirrorsOn.UI.CMS` |
| `dancer` | `dancer` | `mirrorsOn.UI.dancer` |
| `manager` | `clubApp` | `mirrorsOn.UI.clubApp` |

## ✅ What's Validated

| Type | What It Checks | Example |
|------|---------------|---------|
| **visible** | Element is visible | `['saveButton', 'publishButton']` |
| **hidden** | Element is NOT visible | `['deleteButton']` |
| **text** | Text content matches | `{ status: 'Published' }` |
| **placeholders** | Values from testData | `{ pageUrl: '{{pageUrl}}' }` |

## 📝 Screen Structure

```javascript
screenName: {
  screen: 'ScreenObjectName',    // Screen object to use
  
  visible: [                     // Must be visible
    'element1',
    'element2'
  ],
  
  hidden: [                      // Must be hidden
    'element3'
  ],
  
  checks: {
    text: {                      // Text checks
      elementName: 'Expected Text',
      otherElement: '{{fieldFromTestData}}'
    }
  }
}
```

## 🎨 Examples

### Simple Screen
```javascript
draft: {
  screen: 'editPage',
  visible: ['editButton', 'publishButton'],
  checks: {
    text: {
      status: 'Draft'
    }
  }
}
```

### Complex Screen
```javascript
published: {
  screen: 'editPage',
  visible: ['viewLiveButton', 'unpublishButton', 'archiveButton'],
  hidden: ['publishButton', 'deleteButton'],
  checks: {
    text: {
      status: 'Published',
      pageTitle: '{{pageTitle}}',
      pageUrl: '{{pageUrl}}'
    }
  }
}
```

### Mobile Screen
```javascript
accepted: {
  screen: 'bookingDetailScreen',
  visible: ['btnViewDetails', 'btnCancel', 'statusBadge'],
  checks: {
    text: {
      statusBadge: 'Accepted',
      guestName: '{{guestName}}'
    }
  }
}
```

## 🔧 Generate Tests

```bash
# Single state
node cli.js generate:unit \
  --impl path/to/CMSPageImplications.js \
  --platform cms \
  --state published

# All states
node cli.js generate:unit \
  --impl path/to/CMSPageImplications.js \
  --platform cms
```

## ✨ Features

- ✅ **Automatic** - No manual validation code
- ✅ **Platform-specific** - Only validates relevant screens
- ✅ **State-specific** - Only validates target state
- ✅ **Descriptive** - Comments show what's validated
- ✅ **Smart imports** - Correct relative paths
- ✅ **Test steps** - Better reporting

## 🐛 Common Issues

### Validation not generated?
**Check:** Does `mirrorsOn.UI.{PlatformKey}.{stateName}` exist?

### Wrong platform key?
**Fix:** Use correct mapping (cms → CMS, web → Web)

### Import path wrong?
**Fix:** Ensure generator gets full path to Implication file

### Validation failing?
**Check:** Screen objects properly defined, testData has fields

## 💡 Pro Tips

1. **Start simple** - Add visible/hidden first, then text checks
2. **Use placeholders** - `{{fieldName}}` pulls from testData
3. **Group by screen** - One screen object per state/screen
4. **Test incrementally** - Add validations one at a time
5. **Reuse screens** - Same screen can appear in multiple states

## 📊 Validation Summary Format

Generated comments show:
```
// editLandingPage
// Visible: viewLiveButton, unpublishButton... (4), Hidden: publishButton (1), Text: status, pageUrl (2)
```

This tells you:
- Screen name: `editLandingPage`
- 4 visible elements
- 1 hidden element
- 2 text checks

## 🎯 Best Practices

### DO ✅
- Define mirrorsOn for all states
- Use descriptive element names
- Group related validations
- Test validation locally first
- Keep screen objects updated

### DON'T ❌
- Hard-code test data values (use placeholders)
- Mix platforms in one screen
- Over-validate (only critical elements)
- Forget to regenerate after changes

## 📚 See Also

- **Full Guide:** UI-VALIDATION-GUIDE.md
- **Flow Diagram:** VALIDATION-FLOW-DIAGRAM.md
- **Session Summary:** SESSION-SUMMARY.md
- **Template:** unit-test.hbs
- **Generator:** UnitTestGenerator.js

## 🚀 Quick Start

1. Add `mirrorsOn` to your Implication
2. Run generator
3. Review generated test
4. Run test
5. ✅ Done!

---

**Version:** 1.0  
**Last Updated:** October 24, 2025  

Keep this card handy when writing Implications! 📌
