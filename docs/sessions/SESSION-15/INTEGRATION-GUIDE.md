# 🔧 Integration Guide - Adding Init to Web UI

## 📦 What You Have

From this session, you have:
- ✅ `InitializationBanner.jsx` - UI component
- ✅ `init-routes.js` - API endpoints
- ✅ `initService.js` - Shared logic
- ✅ `Visualizer-Updated.jsx` - Updated page

## 🎯 Goal

Integrate initialization functionality into your existing web UI so users can set up projects without leaving the browser.

---

## Step-by-Step Integration

### Step 1: Add initService to API Server

**File:** `packages/api-server/src/services/initService.js`

```bash
# Copy the file
cp initService.js packages/api-server/src/services/
```

**What it does:**
- Analyzes project structure
- Creates directories
- Copies utilities
- Generates config
- Used by both CLI and API

---

### Step 2: Add Init Routes to API Server

**File:** `packages/api-server/src/routes/init.js`

```bash
# Copy the file
cp init-routes.js packages/api-server/src/routes/init.js
```

**Then update server.js:**

```javascript
// packages/api-server/src/server.js

const initRoutes = require('./routes/init');

// Add this line with your other routes
app.use('/api/init', initRoutes);
```

**Routes added:**
- `POST /api/init/check` - Check if project is initialized
- `POST /api/init/setup` - Initialize project

---

### Step 3: Update CLI to Use Shared Service

**File:** `packages/cli/src/commands/init.js`

**Update to import from shared service:**

```javascript
// At the top
const { 
  analyzeProject, 
  createDirectories, 
  copyUtilities, 
  generateConfig, 
  createReadme 
} = require('../../../api-server/src/services/initService');

// Remove duplicate functions
// Now both CLI and API use same logic!
```

---

### Step 4: Add InitializationBanner Component

**File:** `packages/web-app/src/components/InitializationBanner/InitializationBanner.jsx`

```bash
# Create directory and copy
mkdir -p packages/web-app/src/components/InitializationBanner
cp InitializationBanner.jsx packages/web-app/src/components/InitializationBanner/
```

**What it does:**
- Shows when project needs init
- Beautiful 3-state UI (warning/loading/success)
- Handles initialization via API
- Auto-dismisses on success

---

### Step 5: Update Visualizer

**File:** `packages/web-app/src/pages/Visualizer.jsx`

**Option A: Replace entirely**
```bash
cp Visualizer-Updated.jsx packages/web-app/src/pages/Visualizer.jsx
```

**Option B: Add specific changes**

Add imports:
```javascript
import InitializationBanner from '../components/InitializationBanner/InitializationBanner';
```

Add state:
```javascript
const [needsInit, setNeedsInit] = useState(false);
const [initChecked, setInitChecked] = useState(false);
```

Add check function:
```javascript
const checkInitialization = async (path) => {
  try {
    const response = await apiClient.post('/init/check', { 
      projectPath: path 
    });
    const { initialized } = response.data;
    setNeedsInit(!initialized);
    setInitChecked(true);
    return initialized;
  } catch (error) {
    console.error('Init check failed:', error);
    return false;
  }
};
```

Update handleScan:
```javascript
const handleScan = async () => {
  if (!projectPath) {
    alert('Please enter a project path');
    return;
  }
  
  setLoading(true);
  setInitChecked(false);
  
  try {
    // Check initialization first
    const isInitialized = await checkInitialization(projectPath);
    
    if (!isInitialized) {
      setLoading(false);
      return; // Stop, show banner
    }
    
    // Continue with scan...
    const response = await apiClient.post('/discovery/scan', { projectPath });
    // ... rest of scan logic
  } catch (error) {
    console.error('Scan failed:', error);
    alert('Failed to scan project');
  } finally {
    setLoading(false);
  }
};
```

Add handler for init completion:
```javascript
const handleInitComplete = (result) => {
  console.log('✅ Initialization complete:', result);
  setNeedsInit(false);
  setInitChecked(false);
  
  // Auto-scan after init
  setTimeout(() => {
    handleScan();
  }, 1000);
};
```

Add banner to JSX (before the graph):
```javascript
{/* Initialization Banner */}
{initChecked && needsInit && (
  <InitializationBanner
    projectPath={projectPath}
    onInitComplete={handleInitComplete}
    theme={defaultTheme}
  />
)}
```

---

## 🧪 Testing

### Test 1: Fresh Project (Should Show Banner)

```bash
# Create test project
mkdir /tmp/test-fresh-project
cd /tmp/test-fresh-project
npm init -y
npm install -D @playwright/test
mkdir tests

# In web UI:
# 1. Enter path: /tmp/test-fresh-project
# 2. Click "Scan"
# Expected: ⚠️ Banner appears "Setup Required"
```

### Test 2: Initialize via UI

```bash
# Continuing from Test 1:
# 3. Click "Initialize Project"
# Expected: ⏳ Shows loading
# Expected: ✅ Shows success with file list
# Expected: Graph appears automatically
```

### Test 3: Already Initialized (Should Skip Banner)

```bash
# Scan the same project again
# Expected: No banner, goes straight to graph
```

### Test 4: Edit After Init

```bash
# Click any node in graph
# Expected: Can edit context fields, UI expectations, etc.
# Expected: All functionality works
```

---

## 🔍 Verification Checklist

After integration, verify:

- [ ] API server starts without errors
- [ ] Init routes respond to requests
- [ ] Web UI loads without errors
- [ ] Banner appears for uninitialized projects
- [ ] Initialize button works
- [ ] Files are created in guest project
- [ ] Success message shows created files
- [ ] Graph loads after initialization
- [ ] Can edit states after init
- [ ] Banner doesn't show for initialized projects

---

## 🐛 Troubleshooting

### Banner Doesn't Appear

**Check:**
```javascript
// In browser console
// Should see: "🔍 Init check: { initialized: false, missing: [...] }"
```

**Fix:**
- Make sure `/api/init/check` endpoint is working
- Check network tab for 404 errors
- Verify initRoutes is registered in server.js

### Initialize Button Does Nothing

**Check:**
```javascript
// In browser console
// Should see: "🚀 Initializing project: /path/to/project"
```

**Fix:**
- Check `/api/init/setup` endpoint exists
- Verify initService can find core package
- Check file permissions on guest project

### Files Not Created

**Check:**
```bash
# In terminal
cd packages/api-server/src/services
node -e "const s = require('./initService'); console.log(s)"
# Should show exported functions
```

**Fix:**
- Verify initService.js is in correct location
- Check that core package has TestContext.js and ExpectImplication.js
- Verify write permissions on target directory

### Core Package Not Found

**Error:** `Could not find @implications/core package`

**Fix:**
```bash
# Make sure core package is built
cd packages/core
pnpm install

# Check that files exist
ls src/TestContext.js src/ExpectImplication.js
```

---

## 📁 Final File Structure

After integration, you should have:

```
implications-framework/
├── packages/
│   ├── web-app/
│   │   └── src/
│   │       ├── components/
│   │       │   └── InitializationBanner/
│   │       │       └── InitializationBanner.jsx    ✅ NEW
│   │       └── pages/
│   │           └── Visualizer.jsx                  🔄 UPDATED
│   │
│   ├── api-server/
│   │   └── src/
│   │       ├── routes/
│   │       │   └── init.js                         ✅ NEW
│   │       ├── services/
│   │       │   └── initService.js                  ✅ NEW
│   │       └── server.js                           🔄 UPDATED
│   │
│   └── cli/
│       └── src/
│           └── commands/
│               └── init.js                         🔄 UPDATED (use shared service)
```

---

## 🎉 Success!

After integration, your users can:

1. Open web UI
2. Enter any project path
3. Click "Scan"
4. If needed, click "Initialize" (in browser!)
5. Automatically see the state graph
6. Edit everything visually

**No terminal. No CLI. Pure UI experience!** 🎨

---

## 🚀 Next Steps

Once integrated:

1. **Test thoroughly** - Try all scenarios
2. **Get user feedback** - See if flow is intuitive
3. **Add analytics** - Track init success rate
4. **Consider enhancements:**
   - Preview what will be created
   - Custom template selection
   - Batch initialization for multiple projects

---

## 📞 Need Help?

**Common issues:**
- Routes not found → Check server.js registration
- Files not created → Check core package location
- Banner not showing → Check init check endpoint

**Review:**
- `SESSION-15-PART-2-WEB-UI-INTEGRATION.md` - Detailed explanation
- `InitializationBanner.jsx` - Component code with comments
- `init-routes.js` - API endpoint implementations

---

*Integration Guide Complete - Your Turn to Integrate! 🔧*
