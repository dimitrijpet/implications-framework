# 🚀 Quick Reference - Implications Framework

**5-Minute Cheat Sheet**

---

## Generate a Test (3 Ways)

### 1. Web UI (Easiest)
```
1. Open http://localhost:5173
2. Scan → Select implication → Generate
3. Done! ✅
```

### 2. CLI (Fast)
```bash
node cli.js /path/to/AcceptedBookingImplications.js --platform web
```

### 3. API (Automated)
```bash
curl -X POST http://localhost:3000/api/generate/unit-test \
  -H "Content-Type: application/json" \
  -d '{"implPath":"/path/to/impl.js","platform":"web"}'
```

---

## What Gets Generated

```javascript
// ✅ Imports (smart relative paths)
const TestContext = require('../../../ai-testing/utils/TestContext');
const ExpectImplication = require('../../../ai-testing/utils/ExpectImplication');

// ✅ Exported function
const accept = async (testDataPath, options) => {
  const ctx = TestContext.load(AcceptedBookingImplications, testDataPath);
  TestPlanner.checkOrThrow(AcceptedBookingImplications, ctx.data);
  
  // TODO: Your action code here
  
  return ctx.executeAndSave('Accepted State', 'test.spec.js',
    async () => ({ delta: { status: 'Accepted', acceptedAt: now } })
  );
};

// ✅ UI Validation
await test.step('Validate Accepted State UI', async () => {
  await ExpectImplication.validateImplications(
    AcceptedBookingImplications.mirrorsOn.UI.web.screen,
    ctx.data,
    page
  );
});

// ✅ Test Registration
test.describe("UNIT: Accepted State", () => {
  test("Execute transition", async ({ page }) => {
    await accept(testDataPath, { page });
  });
});

module.exports = { accept };
```

---

## File Locations

**Framework:**
```
packages/
├── web-app/           # React UI (port 5173)
├── api-server/        # Express API (port 3000)
├── cli/               # Command-line tool
└── core/              # Generators + Templates
    └── src/generators/
        ├── UnitTestGenerator.js
        ├── TemplateEngine.js
        └── templates/
            └── unit-test.hbs
```

**Your Project:**
```
your-project/
├── tests/
│   └── implications/
│       └── AcceptedBookingImplications.js
│       └── Accept-Web-UNIT.spec.js  ← Generated here!
└── ai-testing/
    └── utils/
        ├── TestContext.js
        ├── ExpectImplication.js
        └── TestPlanner.js
```

---

## Platform Options

```javascript
--platform web              // Web app (Playwright)
--platform cms              // CMS (Playwright)
--platform dancer    // Mobile dancer app (Appium)
--platform manager   // Mobile manager app (Appium)
```

---

## API Endpoints

```
POST   /api/generate/unit-test       # Generate test
POST   /api/discovery/scan           # Scan project
GET    /api/patterns/analyze         # Analyze patterns
GET    /api/implications/context-schema  # Extract fields
```

---

## Implication Structure

```javascript
class AcceptedBookingImplications {
  // ✅ XState config (required)
  static xstateConfig = {
    meta: { 
      status: "Accepted",
      requires: { previousStatus: "pending" }
    },
    entry: assign({
      status: "Accepted",
      acceptedAt: ({ event }) => event.acceptedAt || now
    })
  };
  
  // ✅ UI implications (optional)
  static mirrorsOn = {
    UI: {
      web: {
        screenName: [{
          visible: ['btn1', 'btn2'],
          hidden: ['btn3', 'btn4']
        }]
      }
    }
  };
  
  // ✅ Triggered by (optional)
  static triggeredBy = [{
    platform: "web",
    action: async (testDataPath, options) => {
      const { accept } = require('./Accept-Web-UNIT.spec.js');
      return accept(testDataPath, options);
    }
  }];
}
```

---

## Common Issues

### ❌ Template Not Found
**Fix:** Check `packages/core/src/generators/templates/unit-test.hbs` exists

### ❌ Wrong Import Paths  
**Fix:** Auto-calculated from file location. Check implication is in subdirectory.

### ❌ No UI Validation Generated
**Fix:** Add `mirrorsOn.UI[platform]` with `visible`/`hidden` arrays

### ❌ File in Wrong Location
**Fix:** Don't pass `outputDir` to generator. It auto-detects from implication path.

### ❌ Delta Fields Missing
**Fix:** Add `entry: assign({ ... })` to xstateConfig

---

## Handlebars Helpers

**String:**
`camelCase`, `pascalCase`, `kebabCase`, `uppercase`, `lowercase`

**Logic:**
`eq`, `ne`, `gt`, `lt`, `and`, `or`

**Array:**
`join`, `length`, `first`, `last`

**Object:**
`keys`, `values`, `stringify`

---

## Start Services

```bash
# API Server (port 3000)
cd packages/api-server && npm run dev

# Web UI (port 5173)
cd packages/web-app && npm run dev

# Both at once
pnpm run dev
```

---

## Debug Mode

**Enable debug logging:**
```bash
# API console will show:
🔍 Extracting UI validation for platform: web
📝 Platform key: web → web
✅ Found mirrorsOn.UI.web with 1 screens
📊 manageRequestingEntertainers: visible=3, hidden=9
✅ UI Validation enabled: 1 screens
```

---

## Next Steps

1. ✅ Generate tests for all implications
2. ✅ Test the generated code
3. ✅ Customize templates if needed
4. 🚧 Add visual implication builder (Phase 5)
5. 🚧 Add test runner (Phase 6)

---

**📚 Full Docs:** See COMPLETE-DOCUMENTATION.md  
**🐛 Issues:** Check TROUBLESHOOTING section  
**🎯 Roadmap:** See ROADMAP in docs

**Ready to generate!** 🚀
