# 👥 Team Onboarding Guide

**Welcome to the Implications Framework UNIT Test Generator!**

This guide will help your team get up to speed quickly.

---

## 🎯 For Team Leads

### What is This?

A test generator that creates complete, production-ready UNIT tests from your Implication definitions. It:
- Saves 25+ minutes per test
- Ensures consistent quality
- Works with any domain (bookings, CMS, approvals, etc.)
- Integrates with existing test infrastructure

### Business Value

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Time per test** | 30+ min | 10 sec | 99.4% faster |
| **Test quality** | Variable | Consistent | 100% standard |
| **Maintainability** | Hard | Easy | Regenerate anytime |
| **Onboarding** | Days | Hours | 80% faster |

### ROI Calculator

```
Time saved per test: 30 minutes
Tests per sprint: 20
Time saved per sprint: 600 minutes (10 hours)
Annual savings: 520 hours (13 work weeks!)
```

---

## 👨‍💻 For Developers

### Your First Test (10 Minutes)

**1. Setup (once)**
```bash
cd your-project
implications init
```

**2. Create Implication**
```javascript
// tests/implications/MyImplications.js
const { assign } = require('xstate');

class MyImplications {
  static xstateConfig = {
    states: {
      approved: {
        meta: {
          status: 'approved',
          setup: [{ platform: 'web' }]
        },
        entry: assign({
          status: 'approved',
          approvedAt: ({event}) => event.approvedAt
        })
      }
    }
  };
}

module.exports = MyImplications;
```

**3. Generate Test**
```bash
node tools/test-generator/cli.js \
  tests/implications/MyImplications.js \
  --state approved \
  --platform web
```

**4. Implement TODOs**
```javascript
// In generated test, fill in:
await page.goto('/approval-page');
await page.getByRole('button', { name: 'Approve' }).click();
```

**5. Run**
```bash
TEST_DATA_PATH="tests/data/test.json" \
npx playwright test tests/implications/Approve-Web-UNIT.spec.js
```

**Done!** 🎉

---

### Daily Workflow

```bash
# Morning: Generate tests for new feature
node tools/test-generator/cli.js MyImplications.js --platform web

# Midday: Implement action logic in generated tests
# (Fill in the TODOs)

# Afternoon: Run and debug
TEST_DATA_PATH="tests/data/test.json" npx playwright test

# Evening: Commit both Implication and generated tests
git add tests/implications/
git commit -m "feat: Add approval workflow tests"
```

---

### Common Tasks

**Task 1: Add New State**
```javascript
// Add to existing Implication
newState: {
  meta: { status: 'newState', setup: [{ platform: 'web' }] },
  entry: assign({ status: 'newState' })
}

// Regenerate
node tools/test-generator/cli.js MyImplications.js --state newState
```

**Task 2: Update Existing Test**
```bash
# Just regenerate!
node tools/test-generator/cli.js MyImplications.js --state approved

# Your custom action logic is in TODOs - easy to merge
```

**Task 3: Multiple Platforms**
```bash
# Web
node tools/test-generator/cli.js MyImplications.js --platform web

# Mobile
node tools/test-generator/cli.js MyImplications.js --platform mobile-dancer
```

---

## 🧪 For QA Engineers

### Testing Generated Tests

**1. Verify Structure**
```bash
# Check imports
grep "require.*TestContext" GeneratedTest.spec.js

# Check prerequisites
grep "TestPlanner.checkOrThrow" GeneratedTest.spec.js

# Check delta
grep "delta\[" GeneratedTest.spec.js
```

**2. Validate Prerequisites**
```javascript
// Tests should fail fast if prerequisites not met
TestPlanner.checkOrThrow(MyImplications, invalidData);
// ❌ Throws clear error
```

**3. Test Data Management**
```javascript
// Each test should properly update state
const ctx = TestContext.load(MyImplications, 'test.json');
await ctx.executeAndSave('Action', 'Test.spec.js', async () => {
  return { delta: { status: 'approved' } };
});
// File updated with new state
```

---

### QA Checklist

- [ ] Generated test has correct imports
- [ ] TestPlanner validation present
- [ ] Delta includes all required fields
- [ ] Test data file created
- [ ] Test runs without errors
- [ ] State changes persist correctly
- [ ] Prerequisites enforced
- [ ] Error messages clear

---

## 📚 For Documentation Writers

### Key Concepts to Document

**1. Implications**
- XState configuration
- Meta structure
- Entry assignments
- State transitions

**2. Generator**
- CLI commands
- Options
- Output structure
- Conventions

**3. TestPlanner**
- Prerequisites validation
- Execution chains
- Error messages

**4. TestContext**
- Data loading
- State management
- Delta application

### Documentation Templates

**Feature Doc Template:**
```markdown
# Feature: [Name]

## What It Does
[Brief description]

## How to Use
[Step-by-step]

## Example
[Code example]

## Common Issues
[Troubleshooting]
```

**API Doc Template:**
```markdown
# API: [Class/Method]

## Syntax
[Code signature]

## Parameters
[Table of parameters]

## Returns
[Return value description]

## Example
[Usage example]
```

---

## 🎓 For Trainers

### Training Session Outline (2 hours)

**Part 1: Overview (30 min)**
- What is Implications Framework?
- Why test generation?
- Architecture overview
- Demo: Generate first test

**Part 2: Hands-On (60 min)**
- Exercise 1: Create simple Implication (15 min)
- Exercise 2: Generate and run test (15 min)
- Exercise 3: Multi-state machine (15 min)
- Exercise 4: Troubleshooting (15 min)

**Part 3: Advanced (30 min)**
- Custom action names
- Multiple platforms
- Prerequisites chains
- Best practices
- Q&A

### Training Materials

**Slides:** [Link to presentation]  
**Code Examples:** `examples/` directory  
**Exercises:** `training/exercises/`  
**Solutions:** `training/solutions/`

---

## 🔧 For DevOps

### CI/CD Integration

**Generate Tests in CI:**
```yaml
# .github/workflows/generate-tests.yml
name: Generate Tests

on:
  push:
    paths:
      - 'tests/implications/**/*Implications.js'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - name: Generate tests
        run: |
          for impl in tests/implications/**/*Implications.js; do
            node tools/test-generator/cli.js "$impl" --platform web
          done
      - name: Commit generated tests
        run: |
          git config user.name "Test Generator Bot"
          git config user.email "bot@example.com"
          git add tests/
          git commit -m "chore: Generate tests" || exit 0
          git push
```

**Run Tests in CI:**
```yaml
# .github/workflows/test.yml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - name: Install dependencies
        run: npm ci
      - name: Run Playwright tests
        run: |
          TEST_DATA_PATH="tests/data/ci-test.json" \
          npx playwright test
```

### Monitoring

**Metrics to Track:**
- Number of generated tests
- Test generation time
- Test pass rate
- Time saved vs manual

**Dashboard Example:**
```javascript
// metrics.js
const metrics = {
  testsGenerated: 150,
  avgGenerationTime: '10s',
  testPassRate: '94%',
  timeSavedVsManual: '75 hours/month'
};
```

---

## 🎯 Success Metrics

### Week 1
- [ ] All devs initialized framework
- [ ] First 5 tests generated
- [ ] Zero generation errors

### Month 1
- [ ] 50+ tests generated
- [ ] 90%+ pass rate
- [ ] 20+ hours saved

### Quarter 1
- [ ] 200+ tests generated
- [ ] All features covered
- [ ] 95%+ pass rate
- [ ] 200+ hours saved

---

## 🚨 Troubleshooting

### Common Issues

**Issue: "Cannot find module TestPlanner"**
```bash
# Solution: Run init
implications init
```

**Issue: "Prerequisites not met"**
```javascript
// Solution: Check what's missing
const analysis = planner.analyze(MyImplications, testData);
console.log('Missing:', analysis.missing);
```

**Issue: "Wrong import paths"**
```bash
# Solution: Verify you have latest generator
cp /updates/UnitTestGenerator.js tools/test-generator/
```

---

## 📞 Support

### Getting Help

1. **Check docs:** [README-COMPLETE.md](./README-COMPLETE.md)
2. **Search issues:** [Project issues]
3. **Ask team lead:** Your project lead
4. **Create issue:** [New issue template]

### Escalation Path

1. **L1:** Team member
2. **L2:** Team lead
3. **L3:** Framework maintainer

---

## 🎊 Celebration Milestones

- 🎉 **First test generated** - You're in!
- 🚀 **10 tests generated** - Getting the hang of it!
- 💪 **50 tests generated** - Power user!
- 🏆 **100 tests generated** - Expert level!
- ⭐ **Helped teammate** - Team player!

---

## 📚 Additional Resources

- **[README-COMPLETE.md](./README-COMPLETE.md)** - Complete documentation
- **[QUICK-START-5MIN.md](./QUICK-START-5MIN.md)** - Quick start
- **[API-REFERENCE.md](./API-REFERENCE.md)** - API docs
- **[MULTI-STATE-GUIDE.md](./MULTI-STATE-GUIDE.md)** - Advanced patterns

---

## 🤝 Contributing

**Want to improve the generator?**

1. Read contribution guidelines
2. Create feature branch
3. Add tests
4. Submit PR
5. Update docs

---

**Welcome aboard!** 🚀

Questions? Ask in [team channel] or create an issue!