# How to Start Session 2 - Complete Guide

## 🎯 Preparation Checklist

Before starting the new conversation, complete these steps:

---

## ✅ Step 1: Save All Documents

Create a `docs/` folder in your project:
```bash
cd /path/to/implications-framework
mkdir -p docs/session-1
```

Save these documents:
```bash
# Copy from Claude's responses into files
docs/session-1/SESSION-1-SUMMARY.md
docs/session-1/PARSER-IMPROVEMENT-NEEDED.md
docs/session-1/VISUALIZATION-GUIDE.md
docs/session-1/METADATA-EXTRACTION-GUIDE.md
docs/session-1/NEXT-STEPS.md
docs/session-1/SESSION-2-START-GUIDE.md (this file)
```

---

## ✅ Step 2: Update Project Knowledge

### Add to Claude Project

1. Open your Claude Project settings
2. Navigate to "Project Knowledge"
3. **Add these key files:**
```
docs/session-1/SESSION-1-SUMMARY.md
docs/session-1/PARSER-IMPROVEMENT-NEEDED.md
docs/session-1/NEXT-STEPS.md
```

4. **Add the System Rules file:**
```
SYSTEM-RULES.md (the one with "Implications Framework - System Rules")
```

5. **Add key source files:**
```
packages/web-app/src/pages/Visualizer.jsx
packages/web-app/src/components/StateGraph/StateDetailModal.jsx
packages/api-server/src/services/astParser.js
packages/api-server/src/services/discoveryService.js
packages/core/src/patterns/implications.js
```

### Why These Files?

- **SESSION-1-SUMMARY.md** - Context of what we built
- **PARSER-IMPROVEMENT-NEEDED.md** - First task for Session 2
- **NEXT-STEPS.md** - Roadmap and priorities
- **SYSTEM-RULES.md** - Core principles and patterns
- **Source files** - Current implementation state

---

## ✅ Step 3: Commit Current State
```bash
git add .
git commit -m "Session 1 complete: Visualization system with discovery and UI extraction

Features:
- Dark theme with platform-based styling
- Dynamic metadata extraction from xstateConfig.meta
- UI coverage extraction from mirrorsOn.UI
- Interactive state graph with Cytoscape
- Full-screen detail modal with all metadata
- Collapsible platform sections
- Red warnings for null/missing fields
- Generic field rendering (adapts to any project)

Known limitations:
- ImplicationHelper.mergeWithBase() not parsed (shows placeholders)
- Some Cytoscape style warnings (cosmetic only)

Next: Session 2 - Fix parser, add editing features"

git push
```

---

## ✅ Step 4: Create Session 2 Prompt

Copy this **exact prompt** for starting Session 2:
```
I'm continuing development of the Implications Framework from Session 1.

**Context:**
- We built a state machine visualizer with dark theme and platform-aware styling
- Discovery system extracts metadata from xstateConfig.meta and mirrorsOn.UI
- Graph shows 5 stateful implications with 11 transitions
- UI coverage displays 12 screens across 3 platforms
- All screens show up but some show "Screen validation defined" placeholder

**Current Status:**
✅ Visualization system working
✅ Metadata extraction working for literals
✅ UI coverage detection working
✅ Dynamic field rendering working
❌ Parser doesn't handle ImplicationHelper.mergeWithBase()

**First Task (CRITICAL):**
Fix the parser to handle `ImplicationHelper.mergeWithBase()` pattern. This is blocking accurate UI screen data display.

See PARSER-IMPROVEMENT-NEEDED.md in Project Knowledge for full details.

**Reference Files in Project Knowledge:**
- SESSION-1-SUMMARY.md (what we built)
- PARSER-IMPROVEMENT-NEEDED.md (detailed fix plan)
- NEXT-STEPS.md (Session 2 roadmap)
- SYSTEM-RULES.md (core principI'm continuing development of the Implications Framework from Session 1.

**Context:**
- We built a state machine visualizer with dark theme and platform-aware styling
- Discovery system extracts metadata from xstateConfig.meta and mirrorsOn.UI
- Graph shows 5 stateful implications with 11 transitions
- UI coverage displays 12 screens across 3 platforms
- All screens show up but some sles)
- Source files (current implementation)

**What I need:**
Start with the parser fix. Guide me through implementing `parseMergeWithBaseCall()` to:
1. Detect mergeWithBase function calls
2. Extract base reference (BaseBookingImplications.dancer.screen)
3. Find and parse base file
4. Merge base data with overrides
5. Return complete screen data

Let's begin with step 1: Detecting mergeWithBase calls.
```

---

## ✅ Step 5: Start New Claude Conversation

1. **Create new conversation** (don't continue Session 1)
2. **Paste the prompt above**
3. **Reference Project Knowledge** as needed
4. **Keep docs/session-1/ open** for reference

---

## 🎯 Session 2 Flow

### First Hour: Parser Fix
```
You: [Paste prompt above]
Claude: [Guides through mergeWithBase detection]
You: [Implement, test, share results]
Claude: [Next step: extract arguments]
... continue until parser works
```

### Validation
```
After parser fix, test:
✅ Scan project
✅ Click "accepted" state
✅ Check all 12 screens show full data
✅ Verify visible/hidden counts match your implication files
✅ Confirm no "Screen validation defined" placeholders

Share screenshot with Claude to confirm success.
```

### Next Features
Once parser is fixed:
```
You: "Parser working! All screens show full data. What's next?"
Claude: "Great! Let's add editing modes..."
... continue with NEXT-STEPS.md priorities
```

---

## 📋 Quick Reference Card

Keep this handy during Session 2:

### Key Files
```
Parser:     packages/api-server/src/services/astParser.js
Discovery:  packages/api-server/src/services/discoveryService.js
Patterns:   packages/core/src/patterns/implications.js
Modal:      packages/web-app/src/components/StateGraph/StateDetailModal.jsx
Builder:    packages/web-app/src/utils/graphBuilder.js
Theme:      packages/web-app/src/config/visualizerTheme.js
```

### Commands
```bash
# Start development
pnpm dev

# Test API directly
curl -X POST http://localhost:3000/api/discovery/scan \
  -H "Content-Type: application/json" \
  -d '{"projectPath":"/path/to/project"}'

# Check logs
# Server logs in api-server terminal
# Browser console in dev tools
```

### Debug Checklist
```
□ Check server logs for parsing errors
□ Check browser console for frontend errors
□ Verify API response has correct data
□ Confirm graph builder receives data
□ Check modal state object structure
```

---

## 🚨 Common Issues During Transition

### Issue 1: Claude Forgets Context
**Solution:** Reference specific docs
```
"See PARSER-IMPROVEMENT-NEEDED.md section 'Phase 2: Extract Arguments' 
for the implementation we discussed."
```

### Issue 2: Claude Suggests Different Approach
**Solution:** Redirect to agreed plan
```
"We decided in Session 1 to parse in api-server (has Babel), not core. 
See SESSION-1-SUMMARY.md 'Key Patterns' section."
```

### Issue 3: Code Doesn't Match Structure
**Solution:** Share current file
```
"Here's the current astParser.js. The extractUIImplications function 
starts at line 150. Where should parseMergeWithBase be added?"
```

### Issue 4: Testing Confusion
**Solution:** Be specific about test case
```
"Testing with AcceptedBookingImplications.js. The bookingDetailsScreen 
should show:
- Description: 'Accepted booking shows cancel button'
- Visible: 4 elements
- Hidden: 7 elements
Currently shows: 'Screen validation defined'
"
```

---

## 🎯 Success Markers

You'll know Session 2 is going well when:

✅ **Hour 1:** Parser detects mergeWithBase calls
✅ **Hour 2:** Parser extracts base references
✅ **Hour 3:** Parser finds and parses base files
✅ **Hour 4:** Parser merges data correctly
✅ **Hour 5:** All 12 screens show complete data

After parser fix (varies by feature):
✅ Mode switcher appears and works
✅ Fields become editable
✅ Changes save to files
✅ Create state modal works
✅ New files generate correctly

---

## 📊 Metrics to Track

### Code Quality
- Lines of code added
- Functions created
- Tests written (for framework itself)
- Bugs fixed

### Feature Completion
- Parser fix (100% = all screens accurate)
- Editing (100% = all fields editable)
- Creation (100% = generates valid files)
- Transitions (100% = can add/modify)

### User Experience
- Clicks to complete action
- Response time (<1s)
- Error messages (helpful)
- Undo capability (yes/no)

---

## 🎉 When Session 2 is Complete

You'll have:
✅ 100% accurate UI screen data
✅ Inline metadata editing
✅ State creation from templates
✅ Transition creation UI
✅ File generation working
✅ Save/backup system
✅ Professional editing experience

**Then:** Create Session 3 docs and repeat this process!

---

## 💡 Pro Tips

### For Claude
- "Reference PARSER-IMPROVEMENT-NEEDED.md" (be specific)
- "Show me the code for X" (request examples)
- "Where does this fit in the current structure?" (context)
- "Test with AcceptedBookingImplications" (specific test case)

### For You
- Keep docs folder open
- Test frequently
- Commit after each feature
- Take screenshots of progress
- Note any new patterns discovered

### For Efficiency
- Copy-paste code blocks (don't retype)
- Use browser dev tools (inspect issues fast)
- Keep API server logs visible
- Use git diff to review changes
- Create backups before big changes

---

## 🚀 You're Ready!

1. ✅ Documents saved
2. ✅ Project Knowledge updated
3. ✅ Current state committed
4. ✅ Prompt prepared
5. ✅ Reference card handy

**Start Session 2 now with the prepared prompt!**

Good luck! 🎯