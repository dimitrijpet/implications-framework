# System Development Notes

**Last Updated:** October 22, 2025  
**Current Focus:** Testing Host System on Guest Repo (Travel Commerce)

---

## 📚 Terminology

**Host System** = Implications Framework (the testing system we built)
**Guest Repo** = Travel Commerce (the app being tested)

Guest Repo Path: `/home/dimitrij/Projects/cxm/Leclerc-Phase-2-Playwright/`

---

## 🎯 Current Session Goals

1. Run discovery on guest repo
2. Analyze what patterns are found
3. Pick simplest example (StayCards MINIMAL)
4. Generate first implication
5. Test it works

---

## 🧠 Key Insights

- **Module = UNIT** (not section, not page)
- **Scenarios = Data variations** (not states)
- **CMS → Publish → Web** (two-platform testing)
- **Reusable modules** (TitleDescription, PriceDiscount, etc.)

---

## 💡 Features We Need to Add

1. Module pattern detection (High)
2. TestContext for CMS (High)
3. Scenario templates (Medium)
4. Composition support (High)

---

## 📝 Session Log

### Session 12 - Oct 22, 2025
- ✅ Created terminology (Host/Guest)
- ✅ Analyzed guest repo structure
- ⏳ Running discovery scan


🐛 NEW HOST SYSTEM ISSUE #4Title: Visualizer Empty State for CMS-Only Projects
Severity: High
Discovered: Session 12 - First real guest repo test
Status: Documented, workaround existsProblem
When scanning a fresh project (no implications yet), the visualizer shows an empty graph even though discovery successfully found sections and screens.Root Cause
The visualizer was designed for the booking repo which has implications. The graph component requires implications to render nodes.Current Behavior
Discovery finds:
✅ 29 Sections
✅ 41 Screens  
✅ Project Type: CMS

UI shows:
❌ Empty graph
❌ No indication of success
❌ User thinks it failedExpected Behavior
When implications === 0:
1. Show "Fresh Project Detected" view
2. List discovered sections/screens
3. Guide user to create first implication
4. Show config wizard (if no config found)Workaround
Manual code generation (Option B) - create implications by handFix Required
New Components Needed:

FreshProjectView.jsx - Shows sections/screens when no implications
SectionsExplorer.jsx - Browse discovered sections
ConfigWizard.jsx - Help create ai-testing.config.js
GenerateImplicationButton.jsx - Quick start for first implication
Priority: High (affects all fresh repos)
Estimated Effort: 2-3 hours
Blocking: No (workaround exists)


---

# Implications Pattern - Quick Reference

## 🎯 The Three Pillars

### 1. Implications = **PURE RULES** (No POM logic!)
```javascript
// StayCardsModuleImplications.js
class StayCardsModuleImplications {
  static meta = { type, fields, requiredFields }
  static SCENARIOS = { MINIMAL, ROMANTIC, ... }
  static mirrorsOn = { CMS: {...}, Web: {...} }
  static generateModuleData(scenario) { }
}
```

**What it does:**
- Defines what a stay card IS
- Lists valid scenarios
- Specifies UI expectations
- Generates test data

**What it does NOT do:**
- Fill forms (your POMs do that)
- Click buttons (your POMs do that)
- Navigate (your POMs do that)

---

### 2. Your POMs = **ACTIONS** (Unchanged!)
```javascript
// stayCards.section.js (YOUR EXISTING CODE)
class StayCardsSection extends EnhancedBaseSection {
  static SCENARIOS = { ... }
  async fillMultipleModules() { }
  async executeScenario() { }
  async createStayCardPageWithScenario() { }
}
```

**Keep using your code!**
- Don't change anything
- Already works perfectly
- Just wrap it with TestContext

---

### 3. ExpectImplication = **VALIDATOR**
```javascript
// ExpectImplication.js
ExpectImplication.validateImplications(
  StayCardsModuleImplications.mirrorsOn,
  'CMS',
  'stayCardsForm',
  testData,
  page,
  screenObject
);
```

**What it does:**
- Reads mirrorsOn rules
- Validates actual UI matches rules
- Logs results

---

## 📂 File Structure

```
apps/
├── cms/tests/
│   ├── implications/cms/
│   │   └── modules/
│   │       └── StayCardsModuleImplications.js    ← NEW (rules only)
│   │
│   ├── screenObjects/sections/
│   │   └── stayCards.section.js                  ← YOURS (keep using)
│   │
│   ├── specs/pages/stayCards/
│   │   └── CreateStayCard-UNIT.spec.js           ← NEW (thin wrapper)
│   │
│   └── utils/
│       ├── TestContext.js                        ← NEW (data tracking)
│       └── ExpectImplication.js                  ← NEW (validator)
│
└── test-data/cms/
    └── stay-cards.json                           ← Generated data
```

---

## 🚀 How Tests Work

### Pattern:
```javascript
test('Create stay card', async ({ page }) => {
  // 1. Load implications (rules)
  const ctx = TestContext.load(StayCardsModuleImplications, path);
  
  // 2. Use YOUR existing POMs
  const stayCards = new StayCardsSection(page);
  await stayCards.executeScenario(ctx.data.scenario, ...);
  
  // 3. Validate with implications
  await ExpectImplication.validateImplications(
    StayCardsModuleImplications.mirrorsOn,
    'CMS',
    'stayCardsForm',
    ctx.data,
    page,
    stayCards
  );
});
```

---

## 💾 Test Data Format

```json
{
  "_original": {
    "scenario": "MINIMAL",
    "modules": [
      { "title": "Paris Getaway", "imageAlt": "Paris cityscape" }
    ],
    "pageTitle": "Stay Cards MINIMAL - [REMOVE] 123456"
  },
  "_changeLog": [
    {
      "index": 0,
      "type": "INIT",
      "label": "Initial State",
      "timestamp": "2025-10-22T...",
      "delta": {}
    },
    {
      "index": 1,
      "type": "UPDATE",
      "label": "Create stay card page",
      "timestamp": "2025-10-22T...",
      "delta": {
        "status": "Published",
        "pageUrl": "https://...",
        "publishedAt": "2025-10-22T..."
      }
    }
  ]
}
```

---

## 🔍 mirrorsOn Structure

```javascript
static mirrorsOn = {
  CMS: {
    screen: 'stayCardsForm',
    checks: {
      visible: ['titleInput', 'imageAltInput'],
      enabled: ['titleInput'],
      text: { 'pageTitle': '{{pageTitle}}' },
      value: { 'titleInput': '{{modules[0].title}}' }
    }
  },
  
  Web: {
    screen: 'stayCard',
    checks: {
      visible: ['cardContainer', 'cardTitle'],
      contains: { 'cardTitle': '{{modules[0].title}}' }
    }
  }
};
```

---

## ✅ Benefits

1. **Separation of concerns**
   - Rules in implications
   - Actions in POMs
   - Validation in ExpectImplication

2. **Data-driven**
   - Tests accept any data
   - Same test for all scenarios

3. **Reusable**
   - Same implications for multiple sections
   - Same validator for CMS and Web

4. **Trackable**
   - TestContext tracks all changes
   - ChangeLog shows history

5. **Discoverable**
   - Host system can scan implications
   - Auto-generate visualizations

---

## 🎯 Next Steps

1. **Copy files** to your repo
2. **Run test** - see it work with YOUR POMs
3. **Add more implications** - DestinationCards, PromotionCards
4. **Add web validation** - Create Web test using same data
5. **Update host system** - Add CMS support to visualizer

---

## 📊 Comparison

### Before (Section-based):
```javascript
// Test is coupled to implementation
const stayCards = new StayCardsSection(page);
const data = stayCards.createMinimal();
// Data is lost after test
```

### After (Implications-based):
```javascript
// Test uses rules + POMs
const ctx = TestContext.load(Implications, path);
const stayCards = new StayCardsSection(page);
await stayCards.executeScenario(ctx.data.scenario);
// Data persists for web validation
```

---

*Pattern inspired by PolePosition-TESTING booking repository*
*Adapted for CMS (stateless) workflows*

