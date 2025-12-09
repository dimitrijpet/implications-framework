# 🎯 Quick Reference - Session 16 to 17

## ⚠️ Three Critical Fixes Needed

### 1. Init Banner Not Showing (5 min)
**File:** `packages/web-app/src/pages/Visualizer.jsx` ~line 541

**Problem:** Banners are inside `{discoveryResult && (...)}`  
**Fix:** Move banners BEFORE this wrapper

```jsx
{/* MOVE THESE OUTSIDE discoveryResult check */}
{initChecked && needsInit && !initSuccess && (
  <div className="glass rounded-xl...">Yellow banner</div>
)}
{initSuccess && (
  <div className="glass rounded-xl...">Green banner</div>
)}

{/* THEN show discovery results */}
{discoveryResult && (
  <StatsPanel ... />
)}
```

---

### 2. Output Path Duplication (10 min)
**File:** `packages/api-server/src/routes/generation.js` (find it)

**Problem:** 
```
/apps/cms/.../tests/implications/bookings/...
            ^^^^^^^^^^^^^^^^^^^^^ duplicated!
```

**Fix:**
```javascript
// WRONG:
const path = join(outputDir, meta.setup.testFile);

// RIGHT:
const path = join(projectPath, meta.setup.testFile);
```

---

### 3. Generate Real Code (30-60 min)
**File:** `packages/core/src/generators/UnitTestGenerator.js`

**Current:** Generates TODOs  
**Wanted:** Extract from `mirrorsOn.triggeredBy` and generate real action calls

**Check first:** Do we already have mirrorsOn generators? Search project!

---

## 🎯 Core Principle: GENERIC

- ❌ No hardcoded domains (bookings, CMS, etc.)
- ✅ Discover patterns from guest code
- ✅ Extract info from implications
- ✅ Adapt to ANY domain

---

## 📋 Current Status

| Item | Status | Next Action |
|------|--------|-------------|
| Init system exists | ✅ Built in Session 15 | Fix banner placement |
| Regex extraction | ✅ Working | Enhance with mirrorsOn |
| Output path | ❌ Duplicated | Fix path join logic |
| Code generation | ⚠️ Skeleton only | Extract actions from implications |
| Generic system | ⚠️ Some hardcoding | Make fully generic |

---

## 🔑 Key Files

- `packages/web-app/src/pages/Visualizer.jsx` - UI (line 541)
- `packages/core/src/generators/UnitTestGenerator.js` - Generator
- `packages/api-server/src/routes/generation.js` - API route
- `packages/api-server/src/templates/unit-test.hbs` - Template

---

## 📞 Start Next Chat With

"Review SESSION-16-SUMMARY-AND-PLAN.md. Let's fix the 3 priorities:
1. Init banner placement (Visualizer.jsx line 541)
2. Output path duplication  
3. Extract mirrorsOn.triggeredBy for real code generation

First check: did we already build mirrorsOn generators in past sessions?"