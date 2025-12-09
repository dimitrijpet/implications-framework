# Troubleshooting Guide

Common issues and solutions for the Implications Framework.

---

## 🔧 Installation Issues

### pnpm not found

**Problem:** `pnpm: command not found`

**Solution:**
```bash
# Install pnpm globally
npm install -g pnpm

# Verify
pnpm --version
```

### Node version too old

**Problem:** `error This project requires Node.js >=18`

**Solution:**
```bash
# Check current version
node --version

# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node 18+
nvm install 18
nvm use 18

# Verify
node --version
```

### Dependencies fail to install

**Problem:** Errors during `pnpm install`

**Solution:**
```bash
# Clear cache
pnpm store prune

# Remove lock file
rm pnpm-lock.yaml

# Reinstall
pnpm install
```

---

## 🚀 Server Issues

### Port 3001 already in use

**Problem:** `Error: listen EADDRINUSE: address already in use :::3001`

**Solution:**
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or change port in api-server/src/index.js
const PORT = process.env.PORT || 3002;
```

### Port 5173 already in use

**Problem:** `Port 5173 is in use, trying another one...`

**Solution:**
```bash
# Vite will automatically use next available port (5174, 5175, etc.)
# Or kill the process:
lsof -i :5173
kill -9 <PID>
```

### API server won't start

**Problem:** Server crashes immediately

**Solution:**
```bash
# Check for syntax errors
cd packages/api-server
node src/index.js

# Check dependencies
pnpm install

# Check Node version
node --version  # Should be 18+
```

### CORS errors in browser

**Problem:** `Access-Control-Allow-Origin` errors

**Solution:**
Already configured in `api-server/src/index.js`:
```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

If still seeing errors:
1. Ensure API server is running on port 3001
2. Ensure web app is on port 5173
3. Check browser console for actual error

---

## 🔍 Discovery Issues

### No implications found

**Problem:** "No implications found in project"

**Checklist:**
```bash
# 1. Verify path is correct
ls /your/project/path

# 2. Check for Implications files
find /your/project/path -name "*Implications.js"

# 3. Check file contents have required patterns
grep -r "xstateConfig\|mirrorsOn" /your/project/path
```

**Common causes:**
- Wrong path (relative vs absolute)
- Files don't end with `Implications.js`
- Files missing `static xstateConfig` or `static mirrorsOn`
- Files are in ignored folders (node_modules, dist, build)

### Discovery very slow

**Problem:** Takes 30+ seconds to scan

**Expected times:**
- <100 files: 1-2 seconds
- 100-500 files: 2-5 seconds
- 500-1000 files: 5-10 seconds
- 1000+ files: 10-20 seconds

**If slower:**
```bash
# Check file count
find /your/project/path -name "*.js" | wc -l

# Check if scanning unnecessary folders
# node_modules, dist, build are automatically ignored
```

**Solution:**
- First scan is always slower (no cache)
- Second scan should be 3-5x faster
- Consider excluding more folders if needed

### Parse errors in console

**Problem:** `Error parsing file: /path/to/file.js`

**Solution:**
```bash
# 1. Check file syntax
node /path/to/file.js

# 2. Check for JSX without proper config
# Parser already has JSX plugin enabled

# 3. Check for experimental syntax
# May need to add plugins to Babel config
```

### Missing base files

**Problem:** Console shows "Base file not found"

**Checklist:**
1. Verify `BaseBookingImplications.js` exists
2. Check file name matches exactly (case-sensitive)
3. Ensure file is in project path
4. Check file has proper structure:
```javascript
class BaseBookingImplications {
  static dancer = {
    screenName: {
      visible: [...],
      hidden: [...]
    }
  }
}
```

---

## 📊 Visualization Issues

### Graph not showing

**Problem:** Blank graph area

**Checklist:**
1. Check browser console for errors
2. Verify discovery completed successfully
3. Check if there are stateful implications
4. Look for Cytoscape errors

**Solution:**
```javascript
// Check in browser console:
console.log(discoveryResult)

// Should show:
// - files.implications: array with items
// - transitions: array with items
```

### Nodes not clickable

**Problem:** Clicking nodes does nothing

**Solution:**
```bash
# Check browser console for:
# - "Node clicked: <className>"
# - "Implication found: <className>"

# If missing, check:
# 1. Graph data structure
# 2. Event handler attachment
# 3. Modal component loaded
```

### Graph connections missing

**Problem:** Nodes visible but no edges

**Checklist:**
1. Implications have `static xstateConfig`
2. xstateConfig has `on:` property
3. Transitions reference valid state names

**Example working structure:**
```javascript
static xstateConfig = {
  on: {
    ACCEPT: 'accepted',  // Creates edge to AcceptedBookingImplications
    REJECT: 'rejected'   // Creates edge to RejectedBookingImplications
  }
}
```

**Debug:**
```javascript
// Check in browser console:
console.log(discoveryResult.transitions)

// Should show array like:
// [{ from: 'PendingBookingImplications', to: 'accepted', event: 'ACCEPT' }]
```

---

## 🖥️ UI Issues

### Stats not showing

**Problem:** Stats dashboard blank or shows zeros

**Checklist:**
1. Discovery completed successfully
2. Stats component receiving data
3. Calculations working correctly

**Debug:**
```javascript
// In browser console:
console.log(discoveryResult.files.implications.length)  // Should be > 0
console.log(discoveryResult.transitions.length)         // Should be > 0
```

### UI Coverage empty

**Problem:** "No UI coverage" despite having mirrorsOn

**Checklist:**
1. File has `static mirrorsOn` property
2. mirrorsOn has `UI` property
3. Parser completed successfully
4. No parse errors in console

**Debug:**
```bash
# Check in server console:
# Should see: "✅ Found mirrorsOn!"
# Should see: "✅ UI is an object, platforms: X"
# Should see: "📊 Platform X has Y parsed screens"
```

### Modal won't close

**Problem:** ESC key doesn't close detail modal

**Solution:**
- Click outside modal (on dark background)
- Click red X button in top-right
- Refresh page if stuck

---

## 🎨 Display Issues

### Colors not showing

**Problem:** Graph nodes all same color

**Solution:**
- Check theme configuration in `visualizerTheme.js`
- Verify status names match theme keys
- Clear browser cache

### Text overlapping

**Problem:** Labels overlapping nodes or edges

**Solution:**
- Zoom in/out with mouse wheel
- Adjust graph layout algorithm in `StateGraph.jsx`
- Use different Cytoscape layout (dagre, circle, grid)

### Dark theme not working

**Problem:** Seeing light theme

**Solution:**
- Check browser inspector for CSS conflicts
- Verify theme variables loading
- Clear browser cache
- Check Tailwind CSS compilation

---

## 💾 Cache Issues

### Cache not working

**Problem:** Every discovery takes 10 seconds

**Debug:**
```bash
# Check server console for:
# "💾 Cache HIT: BaseBookingImplications.dancer.screenName"

# Should see 9 cache hits per discovery
# If not, check:
# 1. Cache object created in discoveryService.js
# 2. Cache passed through call stack
# 3. No errors in resolveBaseImplication()
```

### Stale cache data

**Problem:** Old data showing after file changes

**Solution:**
- Restart API server (cache is in-memory)
- Click "🔍 Refresh" button
- Scan project again

---

## 🔨 Build Issues

### Vite build fails

**Problem:** Errors during `pnpm build`

**Solution:**
```bash
# Check for TypeScript errors
cd packages/web-app
pnpm build

# Check for missing dependencies
pnpm install

# Check Node version
node --version  # Should be 18+
```

### Import errors

**Problem:** `Cannot find module` errors

**Solution:**
```bash
# Check file exists
ls packages/web-app/src/path/to/file.jsx

# Check import path (case-sensitive)
# Correct: import Component from './Component'
# Wrong:   import Component from './component'

# For absolute imports, check vite.config.js
```

---

## 🐛 Common Errors

### "Cannot read property of undefined"

**Likely causes:**
1. Data not loaded yet
2. Optional chaining needed (`object?.property`)
3. Missing null checks

**Solution:**
```javascript
// Before
const value = data.property.nested;

// After
const value = data?.property?.nested ?? 'default';
```

### "Maximum call stack size exceeded"

**Likely causes:**
1. Circular reference in data
2. Infinite loop in rendering
3. Recursive function without base case

**Solution:**
- Check browser console for stack trace
- Look for circular dependencies
- Add logging to find infinite loop

### "Network Error" when scanning

**Likely causes:**
1. API server not running
2. Wrong API URL
3. CORS issue

**Solution:**
```bash
# 1. Check API server running
curl http://localhost:3001/health

# 2. Check API URL in web-app
# Should be: http://localhost:3001

# 3. Check CORS config in api-server
```

---

## 📞 Getting Help

### Before Asking for Help

Gather this information:
1. **Error message** (exact text from console)
2. **Browser console** (any errors?)
3. **Server console** (any errors?)
4. **Steps to reproduce** (what did you do?)
5. **Environment** (Node version, OS, browser)

### Where to Look

1. **Browser Console:** F12 → Console tab
2. **Server Console:** Terminal running API server
3. **Network Tab:** F12 → Network (check API calls)
4. **Project Files:** Check file structure

### Useful Commands
```bash
# Check all services status
pnpm --filter api-server dev &  # Run in background
pnpm --filter web-app dev       # Run in foreground

# Check processes
ps aux | grep node

# Check ports
lsof -i :3001
lsof -i :5173

# Full reset
killall node
rm -rf node_modules
pnpm install
```

---

## ✅ Still Stuck?

If none of these solutions work:

1. **Restart everything:**
```bash
# Kill all Node processes
killall node

# Clear everything
rm -rf node_modules
rm pnpm-lock.yaml

# Reinstall
pnpm install

# Start fresh
pnpm --filter api-server dev
pnpm --filter web-app dev
```

2. **Check documentation:**
- [Quick Start](QUICK-START.md)
- [System Overview](../../SYSTEM-OVERVIEW.md)
- [Session Notes](../sessions/)

3. **Contact the team** with:
- Error messages
- Console logs
- Steps to reproduce
- Environment details

---

*Last updated: October 21, 2025*

---

## 🆕 Add State Feature Issues (Session 7)

### Modal not visible

**Problem:** Click "Add State" button, nothing happens

**Symptoms:**
- Console logs "Modal rendering" but screen stays normal
- No visual change
- Modal appears to be mounted (React DevTools shows it)

**Debug checklist:**
```javascript
// 1. Check if modal state is updating
console.log('showAddStateModal:', showAddStateModal);  // Should be true

// 2. Check if component renders
// In AddStateModal.jsx:
console.log('Modal render, isOpen:', isOpen);  // Should log

// 3. Check browser Elements tab
// Should see:
<div class="modal-overlay">...</div>
```

**Solutions:**

**Solution 1: CSS z-index**
```css
/* Ensure high z-index */
.modal-overlay {
  position: fixed;
  z-index: 99999;  /* Very high */
}
```

**Solution 2: CSS file not loaded**
```javascript
// Verify import exists
import './AddStateModal.css';  // Must be present
```

**Solution 3: Position absolute vs fixed**
```css
/* Must be fixed, not absolute */
.modal-overlay {
  position: fixed;  /* ✅ Correct */
  /* position: absolute;  ❌ Wrong */
}
```

---

### Fields not pre-filling when copying

**Problem:** Select state from dropdown, fields stay empty

**Symptoms:**
- Dropdown works
- No fields populate
- Console may show 500 error
- `copyPreview` stays null

**Debug checklist:**
```javascript
// 1. Check network request
// DevTools Network tab:
GET /api/implications/get-state-details?stateId=rejected
Status: 200 ✅ or 500 ❌

// 2. Check server logs
🔍 Getting details for state: rejected
📄 Found file: .../RejectedBookingImplications.js
✅ Extracted details: { platform: '...', ... }

// 3. Check response data
console.log('Copy preview:', copyPreview);
// Should be object with fields
```

**Common Causes & Solutions:**

**Cause 1: glob not imported**
```javascript
// ❌ Missing import
import express from 'express';

// ✅ Add this
import { glob } from 'glob';
```

**Cause 2: traverse.default not used**
```javascript
// ❌ Wrong
traverse(ast, { ... });

// ✅ Correct
traverse.default(ast, { ... });
```

**Cause 3: Wrong file found**
```bash
# Server logs show:
📄 Found file: .../PostRejectedImplications.js  # ❌ Wrong

# Should be:
📄 Found file: .../RejectedBookingImplications.js  # ✅ Correct
```

**Solution:** Update glob patterns to prioritize BookingImplications:
```javascript
const patterns = [
  `${projectPath}/**/bookings/**/${stateNamePascal}BookingImplications.js`,  // Most specific
  `${projectPath}/**/${stateNamePascal}BookingImplications.js`,
  `${projectPath}/**/*${stateNamePascal}*Implications.js`,  // Fallback
];
```

**Cause 4: AST parsing error**
```javascript
// Check if xstateConfig exists in file
static xstateConfig = {  // Must be present
  meta: { ... }
}
```

---

### New state not showing in graph after re-scan

**Problem:** File created successfully, but re-scan doesn't show new node

**Symptoms:**
- File exists in filesystem
- Re-scan completes
- Graph shows same number of nodes
- Console shows "Filtered to X stateful implications"

**Debug checklist:**
```bash
# 1. Check file was created
ls /path/to/project/tests/implications/bookings/status/
# Should see: ReviewingBookingImplications.js

# 2. Check file structure
cat ReviewingBookingImplications.js
# Should have:
static xstateConfig = {
  meta: {
    status: "...",  # Must have status
  }
}

# 3. Check discovery logs
📦 Discovery result: { ... }
✅ Filtered to 6 stateful implications (from 26 total)
# Should be 7 now, not 6
```

**Common Causes & Solutions:**

**Cause 1: Missing status field**
```javascript
// ❌ Invalid xstateConfig
static xstateConfig = {
  meta: {
    // status: "...",  // Missing!
  }
}

// ✅ Valid xstateConfig
static xstateConfig = {
  meta: {
    status: "Reviewing",  // Required for "stateful" detection
  }
}
```

**Cause 2: Not registered in state machine**
```javascript
// Check BookingStateMachine.js

// Should have import:
const ReviewingBookingImplications = require('./status/ReviewingBookingImplications.js');

// Should be in states:
states: {
  reviewing_booking: ReviewingBookingImplications.xstateConfig,
}
```

If missing, either:
- Auto-registration failed (check logs)
- Add manually

**Cause 3: Syntax error in generated file**
```bash
# Try to require the file
node -e "require('./ReviewingBookingImplications.js')"

# Should not throw errors
```

**Cause 4: Cache not cleared**
```javascript
// Clear discovery cache
localStorage.clear();
// Re-scan
```

---

### Import errors on server

**Problem:** Server crashes with `glob is not defined` or `traverse is not a function`

**Symptoms:**
```
ReferenceError: glob is not defined
TypeError: traverse is not a function
```

**Solutions:**

**For glob:**
```javascript
// ✅ Add at top of implications.js
import { glob } from 'glob';  // Named import
```

**For traverse:**
```javascript
// ✅ Import correctly
import traverse from '@babel/traverse';

// ✅ Use with .default
traverse.default(ast, {
  ClassProperty(path) {
    // ...
  }
});
```

**For ES modules compatibility:**
```javascript
// Add to package.json
{
  "type": "module"
}

// Or use .mjs extension
implications.mjs
```

---

### Wrong screen count showing (0 instead of 12)

**Problem:** Dropdown shows "rejected (manager, 0 screens)" when it should show 12

**Cause:** Data structure mismatch
```javascript
// ❌ Looking for wrong property
uiCoverage.totalScreens  // Doesn't exist

// ✅ Correct property
uiCoverage.total  // This exists
```

**Solution:**
```javascript
// In Visualizer.jsx
existingStates={discoveryResult?.files.implications.map(imp => ({
  id: extractStateName(imp.metadata.className),
  platform: imp.metadata.platform,
  uiCoverage: {
    totalScreens: imp.metadata.uiCoverage?.total || 0  // ✅ Use .total
  }
}))}
```

---

### Template rendering errors

**Problem:** Generated file has syntax errors or missing fields

**Symptoms:**
```javascript
// Generated code looks wrong:
status: "undefined",
triggerButton: "",
```

**Causes & Solutions:**

**Cause 1: Missing template variables**
```javascript
// ❌ Not passing to template
const code = template({ stateName });

// ✅ Pass all variables
const code = template({
  stateName,
  status,
  triggerButton,
  // ... all fields
});
```

**Cause 2: Helper not registered**
```javascript
// ✅ Register before compiling
Handlebars.registerHelper('camelCase', function(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
});

const template = Handlebars.compile(templateContent);
```

**Cause 3: Conditional not working**
```handlebars
{{! ❌ Wrong }}
{{#if afterButton}}
afterButton: {{afterButton}},
{{/if}}

{{! ✅ Correct }}
{{#if afterButton}}
afterButton: "{{afterButton}}",
{{/if}}
```

---

### Auto-registration fails

**Problem:** File created but not registered in BookingStateMachine.js

**Symptoms:**
- `autoRegistered: false` in response
- No import in state machine
- No entry in states object

**Solutions:**

**Check if state machine file exists:**
```bash
ls /path/to/project/tests/implications/bookings/BookingStateMachine.js
```

**Check logs:**
```
⚠️ Could not auto-register in state machine: [error message]
```

**Manual registration:**
```javascript
// Add to BookingStateMachine.js

// 1. Add import
const ReviewingBookingImplications = require('./status/ReviewingBookingImplications.js');

// 2. Add to states
states: {
  reviewing_booking: ReviewingBookingImplications.xstateConfig,
}
```

---

## Quick Reference

**Modal not visible?**
→ Check z-index, CSS file import, position: fixed

**Fields not filling?**
→ Check glob import, traverse.default, server logs

**State not in graph?**
→ Check status field, state machine registration, file syntax

**Import errors?**
→ Add glob/traverse imports, use .default for traverse

**Wrong screen count?**
→ Use `uiCoverage.total` not `.totalScreens`

---