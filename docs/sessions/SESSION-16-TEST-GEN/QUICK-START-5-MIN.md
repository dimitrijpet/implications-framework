# ⚡ Quick Start Guide - 5 Minutes to Your First Test

**Time:** 5 minutes  
**Difficulty:** Easy  
**Prerequisites:** Node.js, Playwright

---

## Step 1: Initialize (30 seconds)

```bash
cd your-project
implications init
```

**Creates:**
- `tests/utils/TestContext.js`
- `tests/utils/TestPlanner.js`
- `tests/utils/ExpectImplication.js`

---

## Step 2: Create Implication (2 minutes)

Create `tests/implications/MyImplications.js`:

```javascript
const { assign } = require('xstate');

class MyImplications {
  static xstateConfig = {
    initial: 'draft',
    states: {
      draft: {
        meta: {
          status: 'draft',
          setup: [{ platform: 'web' }]
        },
        on: { PUBLISH: 'published' }
      },
      
      published: {
        meta: {
          status: 'published',
          setup: [{ platform: 'web' }]
        },
        entry: assign({
          status: 'published',
          publishedAt: ({event}) => event.publishedAt
        })
      }
    }
  };
}

module.exports = MyImplications;
```

---

## Step 3: Generate Test (10 seconds)

```bash
node tools/test-generator/cli.js \
  tests/implications/MyImplications.js \
  --state published \
  --platform web
```

**Output:**
```
✅ Written: tests/implications/Publish-Web-UNIT.spec.js
```

---

## Step 4: Check Generated Test (30 seconds)

```bash
cat tests/implications/Publish-Web-UNIT.spec.js
```

**You'll see:**
- ✅ Complete test structure
- ✅ TestContext integration
- ✅ TestPlanner validation
- ✅ Commented UI examples
- ✅ Delta calculation
- ✅ Ready to implement

---

## Step 5: Implement & Run (2 minutes)

**5a. Fill in TODO:**
```javascript
// In the generated test, uncomment and implement:
await page.goto('/your-page');
await page.getByRole('button', { name: 'Publish' }).click();
```

**5b. Create test data:**
```bash
echo '{"id":"1","status":"draft"}' > tests/data/test.json
```

**5c. Run:**
```bash
TEST_DATA_PATH="tests/data/test.json" \
npx playwright test tests/implications/Publish-Web-UNIT.spec.js
```

---

## 🎉 Done!

**You just:**
- ✅ Initialized the framework
- ✅ Created an Implication
- ✅ Generated a complete test
- ✅ Ran it successfully

**Time:** 5 minutes ⏱️  
**Quality:** Professional-grade ⭐  
**Effort:** Minimal 😊

---

## 🚀 Next Steps

### Generate More Tests
```bash
# Generate all states
node tools/test-generator/cli.js \
  tests/implications/MyImplications.js \
  --platform web
```

### Add More States
```javascript
// In MyImplications.js
archived: {
  meta: {
    status: 'archived',
    setup: [{ platform: 'web' }]
  },
  entry: assign({
    status: 'archived',
    archivedAt: ({event}) => event.archivedAt
  })
}
```

### Customize
```javascript
// Explicit action names and files
setup: [{
  platform: 'web',
  actionName: 'submitForPublication',
  testFile: 'SubmitPublication-Web-UNIT.spec.js'
}]
```

---

## 📚 Learn More

- **[README-COMPLETE.md](./README-COMPLETE.md)** - Full documentation
- **[MULTI-STATE-GUIDE.md](./MULTI-STATE-GUIDE.md)** - Complex state machines
- **[GENERIC-REFACTORING-COMPLETE.md](./GENERIC-REFACTORING-COMPLETE.md)** - How it works

---

**That's it! You're ready to generate tests!** 🎊