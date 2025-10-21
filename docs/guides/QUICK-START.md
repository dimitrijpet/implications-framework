# Quick Start Guide

Get the Implications Framework visualizer running in 5 minutes.

---

## 📋 Prerequisites

- **Node.js:** v18 or higher
- **pnpm:** v8 or higher
- **Terminal:** Access to command line

Check versions:
```bash
node --version   # Should be v18+
pnpm --version   # Should be v8+
```

---

## 🚀 Installation

### 1. Clone/Navigate to Project
```bash
cd implications-framework
```

### 2. Install Dependencies
```bash
pnpm install
```

This installs all dependencies for all packages (web-app, api-server, cli, core).

**Expected time:** 30-60 seconds

---

## ▶️ Start Development Servers

You need **two terminal windows** running simultaneously.

### Terminal 1: API Server
```bash
pnpm --filter api-server dev
```

**Expected output:**
```
> api-server@1.0.0 dev
> nodemon src/index.js

[nodemon] starting `node src/index.js`
🚀 API Server running on http://localhost:3001
```

### Terminal 2: Web App
```bash
pnpm --filter web-app dev
```

**Expected output:**
```
> web-app@1.0.0 dev
> vite

  VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## 🌐 Open Browser

Navigate to: **http://localhost:5173**

You should see the **State Machine Viewer** interface.

---

## 🔍 Scan Your First Project

### 1. Enter Project Path

In the input field, enter your project's absolute path:
```
/home/user/my-project
```

**Examples:**
- Linux/Mac: `/home/dimitrij/Projects/PolePosition-TESTING`
- Windows: `C:\Users\user\Projects\my-project`

### 2. Click "🔍 Scan Project"

The discovery process will:
1. Find all `.js` files
2. Parse implications, sections, screens
3. Extract transitions
4. Build the graph
5. Calculate statistics

**Expected time:** 2-3 seconds

### 3. View Results

You'll see:
- **Stats Dashboard** at the top (6 metrics)
- **Interactive Graph** in the center
- **State nodes** colored by status
- **Edges** showing transitions

---

## 🎯 What You'll See

### Stats Dashboard (Top)
```
📊 Total States    ⚙️ Stateful       🔗 Transitions
   25                 5                 11
                      20%               2.2 avg

🖥️ UI Screens      📱 Platforms      ✅ Coverage
   12                 3                 100%
   3 platforms        dancer, clubApp,  Excellent
                      web
```

### Interactive Graph (Center)

- **Nodes:** Each state (e.g., PendingBookingImplications)
- **Colors:** Status-based (green=accepted, red=rejected, etc.)
- **Edges:** Transitions between states
- **Layout:** Automatic arrangement

### Click Any Node

Opens full-screen modal with:
- **Metadata:** All fields from xstateConfig.meta
- **Files:** Implication and test file paths
- **Transitions:** Available events
- **UI Coverage:** Screens by platform
  - Visible elements
  - Hidden elements
  - Text checks

---

## 🎨 UI Features

### Stats Cards
- **Hover:** Cards scale up slightly
- **Colors:** Each metric has unique color
- **Coverage:** Highlighted with glow effect

### Graph
- **Zoom:** Mouse wheel or pinch
- **Pan:** Click and drag background
- **Select:** Click any node
- **ESC:** Close detail modal

### Platform Sections
- **Click header:** Expand/collapse
- **Icons:** 📱 (dancer), 📲 (manager), 🌐 (web)
- **Counts:** Number of screens per platform

---

## 🐛 Troubleshooting

### "No implications found"

**Problem:** Scanner didn't find any implication files

**Solutions:**
1. Check project path is correct (absolute path)
2. Ensure files end with `Implications.js`
3. Verify files have `static xstateConfig` or `static mirrorsOn`
4. Check console for errors

### "Discovery taking too long"

**Problem:** Large project or slow file system

**Expected times:**
- Small project (<100 files): 1-2 seconds
- Medium project (100-500 files): 2-5 seconds
- Large project (500-1000 files): 5-10 seconds
- Very large (1000+ files): 10-20 seconds

**Solutions:**
1. Wait patiently (caching helps on second scan)
2. Check if scanning unnecessary folders (node_modules ignored automatically)
3. Look at browser console for progress logs

### "Graph not showing connections"

**Problem:** Transitions not extracted

**Solutions:**
1. Ensure implications have `static xstateConfig`
2. Check xstateConfig has `on:` property with transitions
3. Verify state names match class names
4. Check browser console for parsing errors

### "Port already in use"

**Problem:** Another process using port 3001 or 5173

**Solutions:**
```bash
# Find process using port
lsof -i :3001
lsof -i :5173

# Kill process
kill -9 <PID>

# Or change port in package.json
```

### "Module not found" errors

**Problem:** Dependencies not installed

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules
pnpm install
```

---

## 🎓 Next Steps

### Learn More
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [System Overview](../../SYSTEM-OVERVIEW.md)
- [Session Notes](../sessions/)

### Try These Features
1. **Click different nodes** - See varied metadata
2. **Expand platforms** - View all screens
3. **Check coverage** - See which states have UI tests
4. **Scan different projects** - Test generics

### Coming Soon (Session 3)
- Edit metadata inline
- Create new states
- Generate test files
- Save changes

---

## 💡 Tips

### Performance
- **First scan:** Always slower (no cache)
- **Second scan:** 3-5x faster (with cache)
- **Keep servers running:** Faster iteration

### Project Structure
- Works with any folder structure
- No configuration needed
- Discovers patterns automatically

### Keyboard Shortcuts
- **ESC:** Close modal
- **Ctrl+R:** Refresh discovery
- **Mouse wheel:** Zoom graph

---

## ✅ Success Checklist

- [ ] Both servers running (API + Web)
- [ ] Browser open at localhost:5173
- [ ] Project path entered correctly
- [ ] Discovery completed successfully
- [ ] Stats dashboard showing metrics
- [ ] Graph visible with nodes
- [ ] Can click nodes and see details
- [ ] Platform sections expandable
- [ ] UI screens showing data

---

## 🎉 You're Ready!

The visualizer is now running and ready to explore your test implications.

**Enjoy!** 🚀

---

*Need help? Check [Troubleshooting](TROUBLESHOOTING.md) or contact the team.*