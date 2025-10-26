# 🐕 SESSION 19: Dogfooding & Testing Plan

**Goal:** Test the Implications Framework on YOUR real guest project to identify what needs optimization for GENERIC repo support.

**Critical Focus:** System must work on ANY guest repo structure, not just our examples.

---

## 🎯 Testing Philosophy

### The GENERIC Test
```
If the system makes assumptions about:
  ❌ File paths
  ❌ Directory structure
  ❌ Domain names (bookings, CMS, etc.)
  ❌ Class naming patterns
  ❌ Import conventions
  
Then it will FAIL on guest repos!
```

### What We're Testing
1. **Discovery** - Can it find implications in ANY structure?
2. **Extraction** - Can it read ANY implication file?
3. **Generation** - Does it adapt to ANY project structure?
4. **Paths** - Are paths calculated correctly for ANY layout?
5. **Generic-ness** - Does it assume domain-specific things?

---

## 📋 Test Plan Structure

```
Phase 1: Discovery Testing (15 min)
   ↓
Phase 2: Visualization Testing (10 min)
   ↓
Phase 3: Generation Testing (30 min)
   ↓
Phase 4: Generated Code Testing (30 min)
   ↓
Phase 5: Observations & Feedback (15 min)

Total: ~1.5-2 hours
```

---

## 🧪 Phase 1: Discovery Testing (15 min)

### Goal
Test if the system can DISCOVER your real project structure without hardcoded assumptions.

### Your Project Info
- **Path:** `/home/dimitrij/Projects/cxm/PolePosition-TESTING/`
- **Implications:** In `tests/implications/bookings/status/`
- **Structure:** Your actual production structure

### Test Steps

1. **Start the web app**
   ```bash
   cd /path/to/implications-framework
   cd packages/web-app
   npm run dev
   ```

2. **Open http://localhost:3000**

3. **Run Discovery**
   - Click "Scan Project"
   - Enter path: `/home/dimitrij/Projects/cxm/PolePosition-TESTING/`
   - Click "Discover"

### 🔍 Observation Checklist

Record your observations:

**Discovery Results:**
- [yes ] Did it find your implications?
- [128 screens 4 platforms ] How many files did it find?
- [yes ] Did it find files in the right directories?
- [ no] Any files missed? (list them)
- [ no] Any errors in console?

**Structure Recognition:**
- [yes ] Did it understand your directory structure?
- [ yes] Did it correctly identify implication types?
- [ yes] Did it recognize your platforms (web/mobile/cms)?
- [ yes] Any assumptions about directory names?

**Extraction Quality:**
- [yes ] Did it extract xstateConfig correctly?
- [ yes] Did it extract mirrorsOn correctly?
- [ yes] Did it extract meta.setup correctly?
- [ no] Any parsing errors?

**Errors/Issues Found:**
```
1. 
2. 
3. 
```

**Things That Worked Well:**
```
1. Found the project, didn't have any context fields from xstate but it had advanced metadata
2. 
3. 
```

---

## 🎨 Phase 2: Visualization Testing (10 min)

### Goal
Test if the state machine visualizer adapts to YOUR state definitions.

### Test Steps

1. **View State Machine**
   - Select one of your implications
   - View the state machine graph
   - Interact with the visualization

### 🔍 Observation Checklist

**Graph Rendering:**
- [ yes] Does the graph show all states?
- [yes ] Are transitions labeled correctly?
- [ this project doesn't have them ] Does it handle multi-state machines?
- [ yes] Does it handle single-state machines?
- [ no] Any layout issues?

**State Details:**
- [yes ] Click on a state - does modal show?
- [ advanced shown, yes] Are metadata fields shown correctly?
- [ yes] Does it show setup information?
- [ yes] Does it show requiredFields?
- [yes ] Does it show mirrorsOn?

**Generic-ness Check:**
- [ don't know - but statuses are named accordingly] Does UI assume "bookings" terminology?
- [ all show as named] Does UI assume specific state names?
- [ yes] Does UI work with your actual state names?
- [dont know ] Any hardcoded labels or assumptions?

**Errors/Issues Found:**
```
1. 
2. 
3. 
```

**Things That Worked Well:**
```
1. 
2. 
3. 
```

---

## ⚙️ Phase 3: Generation Testing (30 min)

### Goal
Test if the system can GENERATE tests for YOUR project structure.

### Test Steps

#### Test 3A: Generate for a Simple State (10 min)

1. **Pick a simple single-state implication**
   - Example: `LoginImplications.js` or similar

2. **Generate Test**
   - Use web UI or CLI:
     ```bash
     node cli.js generate:unit \
       --impl /path/to/your/LoginImplications.js \
       --platform web
     ```

3. **Check Generated File**
   - Where was it written?
   - Is path correct?
   - Open the file

#### Test 3B: Generate for a Multi-State Machine (10 min)

1. **Pick a multi-state implication**
   - Example: `PendingBookingImplications.js`

2. **Generate for One State**
   ```bash
   node cli.js generate:unit \
     --impl /path/to/PendingBookingImplications.js \
     --platform mobile-dancer \
     --state Pending
   ```

3. **Generate for All States**
   ```bash
   node cli.js generate:unit \
     --impl /path/to/PendingBookingImplications.js \
     --platform mobile-dancer
   ```

#### Test 3C: Test Different Platforms (10 min)

1. **Generate for Web**
on accepted it only creates 1 test when there are 2 setups..
🎯 Implications Framework
Dashboard
Projects
Visualizer
⚙️ Settings
🎯 State Machine Viewer
Interactive visualization & documentation

🗑️ Clear
➕ Add State
🔗 Add Transition
🔄 Refresh
/home/dimitrij/Projects/cxm/PolePosition-TESTING/
🔍 Scan Project
📊
Total States
25
⚙️
Stateful
5
20%
🔗
Transitions
11
2.2 avg
🖥️
UI Screens
128
4 platforms
📱
Platforms
4
dancer, clubApp, club, web
✅
Coverage
100%
Excellent
🗺️ State Registry
24 mappings
▶ Expand
Strategy:
auto
🔗 Add Transition Mode
📊 Interactive State Graph
💡 Click nodes to view details | Scroll to zoom | Drag to pan

🎯 Fit
🔍 Reset
🔄 Layout
🔍 Issues Detected
Analysis found 80 issues in your implications

20
Errors
0
Warnings
60
Info
🔍 All
❌ Errors
⚠️ Warnings
ℹ️ Info
Search issues...
Showing 80 of 80 issues
❌ error
Completely Isolated State
in RelogImplications

▶ More
State "RelogImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in NotificationsImplications

▶ More
State "NotificationsImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in Implications

▶ More
State "Implications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in EmailImplications

▶ More
State "EmailImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in DiscoveryImplications

▶ More
State "DiscoveryImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in DancerSettingsImplications

▶ More
State "DancerSettingsImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in BasicDataImplications

▶ More
State "BasicDataImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in BaseDancerImplications

▶ More
State "BaseDancerImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in PostRejectedImplications

▶ More
State "PostRejectedImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in PostCreatedImplications

▶ More
State "PostCreatedImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in PostApprovedImplications

▶ More
State "PostApprovedImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in UnverifiedClubImplications

▶ More
State "UnverifiedClubImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in ClubActionsImplications

▶ More
State "ClubActionsImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in BusinessInvitedImplications

▶ More
State "BusinessInvitedImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in BaseBookingImplications

▶ More
State "BaseBookingImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in EditPhotosImplications

▶ More
State "EditPhotosImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in MissedBookingImplications

▶ More
State "MissedBookingImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in BookingInvitedImplications

▶ More
State "BookingInvitedImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in CheckedOutBookingImplications

▶ More
State "CheckedOutBookingImplications" is completely isolated - it has no incoming or outgoing transitions.

❌ error
Completely Isolated State
in CheckInBookingImplications

▶ More
State "CheckInBookingImplications" is completely isolated - it has no incoming or outgoing transitions.

ℹ️ info
Minimal Override in UI Coverage
in NotificationsImplications

▶ More
NotificationsImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in NotificationsImplications

▶ More
NotificationsImplications.clubApp.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PostRejectedImplications

▶ More
PostRejectedImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PostRejectedImplications

▶ More
PostRejectedImplications.web.lightningFeedPosts extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PostCreatedImplications

▶ More
PostCreatedImplications.web.lightningFeedPosts extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PostApprovedImplications

▶ More
PostApprovedImplications.dancer.socialFeedScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PostApprovedImplications

▶ More
PostApprovedImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PostApprovedImplications

▶ More
PostApprovedImplications.web.lightningFeedPosts extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in BusinessInvitedImplications

▶ More
BusinessInvitedImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in BusinessInvitedImplications

▶ More
BusinessInvitedImplications.dancer.myBookingsAndInvites_upcomingFilter extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in BusinessInvitedImplications

▶ More
BusinessInvitedImplications.web.manageGroups extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in EditPhotosImplications

▶ More
EditPhotosImplications.dancer.profileScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in StandbyBookingImplications

▶ More
StandbyBookingImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in StandbyBookingImplications

▶ More
StandbyBookingImplications.dancer.requestBookingScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in StandbyBookingImplications

▶ More
StandbyBookingImplications.clubApp.toCheckIn extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in StandbyBookingImplications

▶ More
StandbyBookingImplications.clubApp.toCheckOut extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in StandbyBookingImplications

▶ More
StandbyBookingImplications.clubApp.specificBookingScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in StandbyBookingImplications

▶ More
StandbyBookingImplications.clubApp.bookingHistory extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in RejectedBookingImplications

▶ More
RejectedBookingImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in RejectedBookingImplications

▶ More
RejectedBookingImplications.clubApp.toCheckIn extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in RejectedBookingImplications

▶ More
RejectedBookingImplications.clubApp.toCheckOut extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in RejectedBookingImplications

▶ More
RejectedBookingImplications.clubApp.specificBookingScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in RejectedBookingImplications

▶ More
RejectedBookingImplications.clubApp.bookingHistory extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PendingBookingImplications

▶ More
PendingBookingImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PendingBookingImplications

▶ More
PendingBookingImplications.clubApp.toCheckIn extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PendingBookingImplications

▶ More
PendingBookingImplications.clubApp.toCheckOut extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PendingBookingImplications

▶ More
PendingBookingImplications.clubApp.specificBookingScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in PendingBookingImplications

▶ More
PendingBookingImplications.clubApp.bookingHistory extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.dancer.requestBookingScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.dancer.bookingDetailsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.dancer.myBookingsAndInvites_upcomingFilter extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.dancer.myBookingsAndInvites_completedFilter extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.dancer.myBookingsAndInvites_allPastFilter extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.clubApp.toCheckIn extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.clubApp.manageBookings extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.clubApp.specificBookingScreen_and_bookingHistory extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.clubApp.specificBookingScreen_Accepted_All extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.clubApp.specificBookingScreen_Accepted_Missed extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.web.manageRequestingEntertainers extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in MissedBookingImplications

▶ More
MissedBookingImplications.web.dancerModal extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in BookingInvitedImplications

▶ More
BookingInvitedImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in BookingInvitedImplications

▶ More
BookingInvitedImplications.clubApp.toCheckIn extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in BookingInvitedImplications

▶ More
BookingInvitedImplications.clubApp.toCheckOut extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in BookingInvitedImplications

▶ More
BookingInvitedImplications.clubApp.specificBookingScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in BookingInvitedImplications

▶ More
BookingInvitedImplications.clubApp.bookingHistory extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CreatedBookingImplications

▶ More
CreatedBookingImplications.web.bookingCalendar extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CreatedBookingImplications

▶ More
CreatedBookingImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CheckedOutBookingImplications

▶ More
CheckedOutBookingImplications.clubApp.toCheckIn extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CheckedOutBookingImplications

▶ More
CheckedOutBookingImplications.clubApp.toCheckOut extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CheckedOutBookingImplications

▶ More
CheckedOutBookingImplications.clubApp.specificBookingScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CheckedOutBookingImplications

▶ More
CheckedOutBookingImplications.clubApp.bookingHistory extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CheckInBookingImplications

▶ More
CheckInBookingImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CheckInBookingImplications

▶ More
CheckInBookingImplications.web.dancerModal extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CheckInBookingImplications

▶ More
CheckInBookingImplications.clubApp.toCheckIn extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CheckInBookingImplications

▶ More
CheckInBookingImplications.clubApp.specificBookingScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in CheckInBookingImplications

▶ More
CheckInBookingImplications.clubApp.bookingHistory extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in AcceptedBookingImplications

▶ More
AcceptedBookingImplications.dancer.notificationsScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in AcceptedBookingImplications

▶ More
AcceptedBookingImplications.clubApp.specificBookingScreen extends base but only overrides description. Consider adding meaningful overrides or using base directly.

ℹ️ info
Minimal Override in UI Coverage
in AcceptedBookingImplications

▶ More
AcceptedBookingImplications.clubApp.bookingHistory extends base but only overrides description. Consider adding meaningful overrides or using base directly.

✅
accepted
❓ web
Status: Accepted
✕
✏️ Edit State
📦 Context Fields
Data accumulated through workflow (from xstateConfig.context)
🔭
No Context Fields
This state machine has no context defined
⚙️ Advanced Metadata
(Legacy fields from previous project)
Core
Status
Accepted
Trigger Action
Accepted
Status Code
⚠️ Not Set
Status Number
⚠️ Not Set
Buttons
Trigger Button
ACCEPT
After Button
UNDO
Previous Button
PENDING
Platform
Platform
⚠️ Not Set
Notification Key
Accepted
Setup
Required Fields
dancerName
clubName
bookingTime
bookingType
managerName
Requires
previousStatus:
pending
data:
{}
Setup
{"testFile":"tests/implications/bookings/status/AcceptBookings-Web-UNIT.spec.js","actionName":"acceptBooking","platform":"mobile-manager"}
{"testFile":"tests/implications/bookings/status/AcceptBookings-Manager-UNIT.spec.js","actionName":"acceptBooking","platform":"mobile-manager"}
📱 UI Screens
🖥️ UI Screen Editor
3 platforms • 12 screens

✏️ Edit UI

💃
Dancer
6 screens
▼

📄
notificationsScreen
Accepted notification is visible
▼

📄
requestBookingScreen
Accepted booking shows with accepted status
✅ 1
▼

📄
bookingDetailsScreen
Accepted booking shows cancel button
✅ 3
❌ 7
📝 1
▼

📄
myBookingsAndInvites_upcomingFilter
Accepted booking shows in Upcoming
✅ 1
▼

📄
myBookingsAndInvites_completedFilter
Accepted NOT in Completed (until checked out)
❌ 1
▼

📄
myBookingsAndInvites_allPastFilter
Accepted shows in All Past
✅ 1
▼

🌐
Web
1 screen
▼

📄
manageRequestingEntertainers
Accepted shows in Accepted tab
✅ 2
❌ 5
▼

📱
ClubApp
5 screens
▼

📄
toCheckOut
Accepted NOT in To Check Out (until checked in)
✅ 3
❌ 2
▼

📄
manageBookings
Accepted shows in Manage Bookings under 'Accepted'
✅ 2
▼

📄
specificBookingScreen
Accepted shows UNDO button and CHECK IN button
▼

📄
bookingHistory
Accepted shows in booking history
▼

📄
toCheckIn
Accepted booking shows in To Check In
✅ 3
❌ 1
▼
🔄 Transitions (2)
UNDO
→
⏳ pending
CANCEL
→
❌ rejected
// Inside the modal, add the button section (after transitions section):
🧪 Test Generation
🧪 Generate Unit Test
✅
Generated 1 Test(s) Successfully!
Test 1:
📄 File: Accept-Web-UNIT.spec.js
📁 /home/dimitrij/Projects/cxm/PolePosition-TESTING/Accept-Web-UNIT.spec.js
📏 Size: 3925 characters
📋 Copy Code
📁 Files
Implication File
/home/dimitrij/Projects/cxm/PolePosition-TESTING//tests/implications/bookings/status/AcceptedBookingImplications.js
2. **Generate for Mobile**
3. **Generate for CMS** (if applicable)

### 🔍 Observation Checklist

**File Generation:**
- [ yes] Were files created?
- [ yes] Are file paths correct (not duplicated)?
- [ Accept-Web-UNIT eg..] Are file names following conventions?
- [ it created Accept-Web-UNIT inside the root?] Do files appear in expected directories?

**Path Calculation:**
- [ maybe] Are import paths relative and correct?
- [ mostly no - maybe we need just to use one path (from root) in our whole system - when Init is done, save that or write in the ai-config] Did it calculate TestContext path correctly?
- [mostly no ] Did it calculate ExpectImplication path correctly?
- [ mostly no] Did it calculate implication import path correctly?

it created Accept-Web-UNIT.spec.js in root like this:
// ═══════════════════════════════════════════════════════════
// AUTO-GENERATED UNIT TEST
// ═══════════════════════════════════════════════════════════
// Generated at: 2025-10-26T17:06:35.453Z
// From: AcceptedBookingImplications
// Platform: web
// Target Status: Accepted
// ═══════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');
const TestContext = require('tests/implications/utils/TestContext');
const AcceptedBookingImplications = require('./AcceptedBookingImplications.js');
const TestPlanner = require('tests/implications/utils/TestPlanner');


/**
 * ✅ EXPORTED FUNCTION - Transition to Accepted state
 * 
 * This function induces the "Accepted" state by:
 * 1. Loading test data and validating prerequisites
 * 2. Navigating and performing actions
 * 3. Saving the state change with delta
 * 
 * @param {string} testDataPath - Path to testData JSON file
 * @param {object} options - Options
 * @param {Page} options.page - Playwright page object
 * @returns {Promise<TestContext>} Updated context
 */
const accept = async (testDataPath, options = {}) => {
  const { page } = options;
  
  // ────────────────────────────────────────────────────────
  // STEP 1: Load TestData
  // ────────────────────────────────────────────────────────
  const ctx = TestContext.load(AcceptedBookingImplications, testDataPath);
  
  console.log('\n🎯 Starting: Transition to Accepted state');
  console.log('   Target Status: Accepted');
  console.log('   Current Status: ' + (ctx.data.status || 'Unknown'));
  
  // ────────────────────────────────────────────────────────
  // STEP 2: Prerequisites Check (CRITICAL!)
  // ────────────────────────────────────────────────────────
  console.log('ℹ️  No prerequisites required for this state');
  
  // ────────────────────────────────────────────────────────
  // STEP 3: Get Target Entities
  // ────────────────────────────────────────────────────────
  
  // ────────────────────────────────────────────────────────
  // STEP 4: Navigate to Screen & Perform Action
  // ────────────────────────────────────────────────────────
  
  // TODO: Navigate to the screen where you perform this action
  // Example navigation:
  // await navigateTo(screen);
  
  // TODO: Perform the state-inducing action
  // This is where you interact with the UI to trigger the state change
  // Example:
  // await page.getByRole('button', { name: 'ACCEPT' }).click();
  
  console.log('   ⚠️  TODO: Implement action logic');
  console.log('   📝 Add your navigation and action code here');
  
  console.log('\n✅ Action completed');
  
  // ────────────────────────────────────────────────────────
  // STEP 5: Save Changes (Delta)
  // ────────────────────────────────────────────────────────
  return ctx.executeAndSave(
    'Accepted State',
    'Accept-Web-UNIT.spec.js',
    async () => {
      const delta = {};
      const now = new Date().toISOString();
      
      // ✨ Generated delta from entry: assign
            
      return { delta };
    }
  );
};


// ═══════════════════════════════════════════════════════════
// OPTIONAL TEST REGISTRATION
// ═══════════════════════════════════════════════════════════
// Set SKIP_UNIT_TEST_REGISTRATION=true to skip these tests
// and only use the exported function

const shouldSkipRegistration = process.env.SKIP_UNIT_TEST_REGISTRATION === 'true';

if (!shouldSkipRegistration) {
  test.describe("UNIT: Accepted State Transition", () => {
    test.setTimeout(120000);
    
    const testDataPath = process.env.TEST_DATA_PATH || "tests/data/shared.json";
    
    test("Execute Accepted transition", async ({ page }) => {
      await accept(testDataPath, { 
        page
      });
      
    });
    
  });
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = { accept };


**Generic-ness Check:**
- [ no, but it doesn't matter] Does generated code assume "bookings"?
- [ dont know] Does it hardcode any domain-specific paths?
- [ maybe] Does it adapt to your actual class names?
- [maybe ] Does it adapt to your actual method names?

**Platform Handling:**
- [ yes] Web tests use Playwright correctly?
- [ yes] Mobile tests use Appium correctly?
- [ maybe] CMS tests use correct structure?
- [ maybe] Platform-specific imports correct?

**Errors/Issues Found:**
```
1. Path duplication: (describe)
2. Wrong imports: (describe)
3. Hardcoded assumptions: (describe)
4. 
```

**Things That Worked Well:**
```
1. 
2. 
3. 
```

---

## 📝 Phase 4: Generated Code Quality Testing (30 min)

### Goal
Examine WHAT was generated and if it's usable on YOUR project.

### Test Steps

1. **Open a Generated Test File**
2. **Read Through the Code**
3. **Try to Understand It**
4. **Check if It's Runnable**

### 🔍 Observation Checklist

#### Imports Section
- [ yes] Are imports present?
- [ mostly no] Are import paths correct?
- [tries but mostly no ] Does it import YOUR actual classes?
- [ no] Are there any missing imports?
- [ mostly] Any imports that don't exist in your project?

**What's Generated:**
```javascript
// Copy actual imports from generated file
const { test, expect } = require('@playwright/test');
const TestContext = require('tests/implications/utils/TestContext');
const AcceptedBookingImplications = require('./AcceptedBookingImplications.js');
const TestPlanner = require('tests/implications/utils/TestPlanner');
```

**Issues:**
```
1. So it doesn't reference imports properly.. changes the folder where the unit test is created
2
```

---

#### Test Data Setup
- [ mostly no] Does it load TestContext correctly?
- [yes ] Does it use your implication class?
- [ yeah, more or less - const testDataPath = process.env.TEST_DATA_PATH || "tests/data/shared.json";] Does testDataPath make sense?
- [ so so ] Are credentials handled correctly?

**What's Generated:**
```javascript
// Copy actual setup code
```

**Issues:**
```
1. 
2. 
```

---

#### Action Execution
- [ for now just todos] Is there actual action code OR just TODOs?
- [don't know for now ] If TODOs, what would you WANT to see instead?
- [ didnt see anywhere, don't know how to design this properly] Does it attempt to call your actions?
- [ dont know] Are action calls correct?

**What's Generated:**
```javascript
// ────────────────────────────────────────────────────────
  // STEP 1: Load TestData
  // ────────────────────────────────────────────────────────
  const ctx = TestContext.load(AcceptedBookingImplications, testDataPath);
  
  console.log('\n🎯 Starting: Transition to Accepted state');
  console.log('   Target Status: Accepted');
  console.log('   Current Status: ' + (ctx.data.status || 'Unknown'));
  
  // ────────────────────────────────────────────────────────
  // STEP 2: Prerequisites Check (CRITICAL!)
  // ────────────────────────────────────────────────────────
  console.log('ℹ️  No prerequisites required for this state');
  
  // ────────────────────────────────────────────────────────
  // STEP 3: Get Target Entities
  // ────────────────────────────────────────────────────────
  
  // ────────────────────────────────────────────────────────
  // STEP 4: Navigate to Screen & Perform Action
  // ────────────────────────────────────────────────────────
  
  // TODO: Navigate to the screen where you perform this action
  // Example navigation:
  // await navigateTo(screen);
  
  // TODO: Perform the state-inducing action
  // This is where you interact with the UI to trigger the state change
  // Example:
  // await page.getByRole('button', { name: 'ACCEPT' }).click();
```

**What You WANT to See:**
```javascript
// this actually seems ok for now... but we have to handle creating of navigation and adding the actual action so it's created immediately.. (so the transition is the action in the end, that's the poin)
```

**Gap Analysis:**
```
What info does your implication have that could help generate better code?

- 
- 
```
A lot of stuff... you should have all the information about action and almost about navigation and prerequisites that should enable that the test is created```

#### UI Validation
- [ actually no, which sucks since we worked on this really hard] Is ExpectImplication validation present?
- [no ] Does it validate the right screens?
- [no ] Are screen names correct?
- [ no] Does it only validate for the right platform?
on cms we had something like:
if (!shouldSkipRegistration) {
  test.describe("UNIT: filling State Transition", () => {
    test.setTimeout(120000);
    
    const testDataPath = process.env.TEST_DATA_PATH || "test-data/shared.json";
    
    test("Execute filling transition", async ({ page }) => {
      await fillStayCardModule(testDataPath, { 
        page,
        statuIndex: 0
      });
      
      // Validate UI implications (mirrorsOn)
      await test.step('Validate filling State UI (web)', async () => {
        const ctx = TestContext.load(StayCardsModuleImplications, testDataPath);
        
      });
    });
    
  });
}

for one step.. but cmon, what the hell why is this happening

**What's Generated:**
```javascript
// Copy validation code
```

**Issues:**
```
1. 
2. 
```

---

#### Prerequisites Checking
- [ dont know] Does it check prerequisites?
- [ i think no] Are prerequisite states listed correctly?
- [ on cms I guess they do ] Does prerequisite logic make sense?

**What's Generated:**
```javascript
// ────────────────────────────────────────────────────────
  // STEP 2: Prerequisites Check (CRITICAL!)
  // ────────────────────────────────────────────────────────
  console.log('ℹ️  No prerequisites required for this state');

  but on cms it showed:
    
  // ────────────────────────────────────────────────────────
  // STEP 2: Prerequisites Check (CRITICAL!)
  // ────────────────────────────────────────────────────────
  TestPlanner.checkOrThrow(StayCardsModuleImplications, ctx.data);
```

**Issues:**
```
1. 
2. 
```

---

#### Overall Code Quality
- [sure ] Is code readable?
- [yes ] Are comments helpful?
- [yes ] Is structure logical?
- [yes ] Would you use this as-is?
- [ nothing for now] What % needs manual editing?

**Manual Edits Needed (estimate):**
- [ ] 0-10% (nearly perfect)
- [ ] 10-30% (good, minor tweaks)
- [x ] 30-50% (okay, significant edits)
- [ ] 50-80% (mostly skeleton)
- [ ] 80-100% (basically TODOs)

**Most Important Missing Pieces:**
```
1. 
2. 
3. 
```

---

## 🔍 Phase 5: Generic System Analysis (15 min)

### Goal
Identify ALL places where the system makes domain-specific assumptions.

### Test Steps

1. **Review Generated Code Again**
2. **Look for Hardcoded Values**
3. **Check Variable Names**
4. **Review Comments**

### 🔍 Observation Checklist

**Hardcoded Assumptions Found:**

**File Paths:**
```
Example: Does it assume "/apps/cms/" or "/tests/implications/"?
List any hardcoded paths:
1. 
2. 
```

**Domain Terms:**
```
Example: Does it use "booking" or "page" in generated code?
List any domain-specific terms:
1. 
2. 
```

**Class Names:**
```
Example: Does it assume "ActionsD" or "BookingActor"?
List any assumed class names:
1. 
2. 
```

**Method Names:**
```
Example: Does it assume "requestBooking" or "publishPage"?
List any assumed method names:
1. 
2. 
```

**Directory Structure:**
```
Example: Does it assume "mobile/android/dancer/"?
List any structural assumptions:
1. 
2. 
```

**Import Patterns:**
```
Example: Does it assume "../../../mobile/" structure?
List any import assumptions:
1. 
2. 
```

---

## 📊 Consolidated Feedback Form

### Overall System Rating

**Discovery System:**
- Rating: ☐ Excellent x Good ☐ Okay ☐ Needs Work ☐ Broken
- Why?

**Extraction System:**
- Rating: ☐ Excellent x Good  Okay ☐ Needs Work ☐ Broken
- Why?

**Generation System:**
- Rating: ☐ Excellent ☐ Good x Okay ☐ Needs Work ☐ Broken
- Why?

**Path Calculation:**
- Rating: ☐ Excellent ☐ Good ☐ Okay x Needs Work ☐ Broken
- Why?

**Generic-ness:**
- Rating: ☐ Excellent ☐ Good x Okay ☐ Needs Work ☐ Broken
- Why?

---

### Top 5 Issues (Priority Order)

**Issue #1:**
```
Problem: 
Impact: High/Medium/Low
Where: (file/line)
Fix suggestion: 
```

**Issue #2:**
```
Problem: 
Impact: High/Medium/Low
Where: (file/line)
Fix suggestion: 
```

**Issue #3:**
```
Problem: 
Impact: High/Medium/Low
Where: (file/line)
Fix suggestion: 
```

**Issue #4:**
```
Problem: 
Impact: High/Medium/Low
Where: (file/line)
Fix suggestion: 
```

**Issue #5:**
```
Problem: 
Impact: High/Medium/Low
Where: (file/line)
Fix suggestion: 
```

---

### Top 5 Things That Work Well

**Success #1:**
```
What works: 
Why it's good: 
```

**Success #2:**
```
What works: 
Why it's good: 
```

**Success #3:**
```
What works: 
Why it's good: 
```

**Success #4:**
```
What works: 
Why it's good: 
```

**Success #5:**
```
What works: 
Why it's good: 
```

---

### What's Missing From Generated Code?

**Information We Have But Don't Use:**
```
Example: triggeredBy has action calls but we generate TODOs
1. Yeah, we mostly have triggeredBy in our booking system but yeah it generates TODO's we need to standardize this properly
2. 
3. 
```

**Information We Need But Don't Have:**
```
Example: Action class import paths not in implications
1. probably no, it would be useful if we can require that
2. 
3. 
```

**Extraction Improvements Needed:**
```
Example: Extract mirrorsOn.triggeredBy better
1. 
2. 
3. 
```

---

### Generic-ness Score

**How domain-specific is the system? (1-10)**
- 1 = Completely generic, works on any repo
- 10 = Totally hardcoded for your specific project

**Score:** ___ / 10

**Biggest generic-ness issue:**
```

```

**How to make it more generic:**
```

```

---

## 🎯 Success Criteria

A successful dogfooding session means:

1. ✅ We identify ALL domain-specific assumptions
2. ✅ We identify ALL path calculation issues
3. ✅ We identify what extraction is missing
4. ✅ We understand what generated code needs
5. ✅ We have a prioritized fix list

---

## 📝 After Testing: Report Format

When you're done, report back with:

1. **Quick Summary** (2-3 sentences)
So the point is that it reads the implication files more or less properly.. but the point is that this system has to force user to one unified standard.. We still obviously have to decide of that complete standard so the user can input all the stuff that the system needs in order to generate perfect and readable implications files, as well as generated tests from that..

2. **Filled Observation Checklists**
don't know you can ask me more about this

3. **Consolidated Feedback Form**
   - Ratings
   - Top 5 issues
   - Top 5 successes

4. **Code Samples**
   - What was generated
   - What you wanted instead
   - What info exists in implications

---

## 🚀 Getting Started

**Ready to test? Here's the command:**

```bash
# 1. Make sure system is running
cd /path/to/implications-framework/packages/web-app
npm run dev

# 2. Open browser
open http://localhost:3000

# 3. Start with Discovery
# Click "Scan Project"
# Enter: /home/dimitrij/Projects/cxm/PolePosition-TESTING/

# 4. Fill out this document as you go
# 5. Report back with findings!
```

---

## 💡 Tips for Effective Dogfooding

1. **Be Critical** - Don't excuse issues because "it's a prototype"
2. **Document Everything** - Screenshot errors, copy exact messages
3. **Think Generic** - Ask "would this work on a different project?"
4. **Compare** - What does generated code look like vs what you'd write?
5. **Focus on Gaps** - What info exists that we're not using?

---

**Let's find out what needs optimization! 🐕🔍**