🎯 COMPREHENSIVE AUTO-RUNNER FIX PLAN

📋 CORE INTENTION
What We're Solving:
Enable intelligent auto-execution of multi-platform test flows where the system:

Builds complete prerequisite chains (including cross-platform)
Groups prerequisites by platform segments
Auto-executes same-platform segments
Pauses at platform boundaries with instructions
Intelligently selects default paths when forks exist


🎬 DESIRED USER EXPERIENCE
Example: BookingAccepted Test (clubApp)
Current behavior: ❌
❌ Cross-platform prerequisites detected
   Run these commands manually...
   [exits immediately]
Desired behavior: ✅
🔍 Analyzing prerequisites for booking_accepted...

📊 Prerequisite Chain (4 segments):

Segment 1 (web): ❌ NOT COMPLETE
  • initial → logged_in → club_selected → booking_created

Segment 2 (dancer): ❌ NOT COMPLETE
  • booking_created → booking_pending (via REQUEST_BOOKING - default)

Segment 3 (clubApp): ❌ NOT COMPLETE
  • booking_pending → booking_standby

Segment 4 (clubApp): ✅ CURRENT TEST
  • booking_standby → booking_accepted

⚡ Auto-Execution Plan:
1. Run Segment 1 (web) - 4 tests, ~60 seconds
2. Run Segment 2 (dancer) - 1 test, ~15 seconds
3. Run Segment 3 (clubApp) - 1 test, ~15 seconds
4. Continue with current test

⏱️  Starting auto-execution in 10 seconds...
Press any key to review/modify plan

🔧 IMPLEMENTATION PLAN
Phase 1: Add Default Flags ✅
File: Implication files (manual update)
Changes:
javascript// BookingCreatedImplications.js
on: {
  REQUEST_BOOKING: {
    target: "booking_pending",
    platforms: ["dancer"],
    isDefault: true,  // ✅ ADD THIS
    actionDetails: { ... }
  },
  
  INVITE_DANCER: {
    target: "booking_pending",
    platforms: ["web", "clubApp"],
    // isDefault: false (omit or explicit)
    actionDetails: { ... }
  }
}
Why: Tells system which path to prefer when multiple options exist

Phase 2: Store viaEvent During Generation ✅
File: UnitTestGenerator.js
Changes:
javascript// In _extractMetadata() or _buildContext()
setup: [{
  testFile: 'BookingPendingViaBookingCreated-REQUESTBOOKING-Dancer-UNIT.spec.js',
  actionName: 'bookingPendingViaBookingCreated',
  platform: 'dancer',
  viaEvent: 'REQUEST_BOOKING'  // ✅ ADD THIS (from this.currentTransition.event)
}]
Why: Preserves which event triggered this state for explicit test identification

Phase 3: Platform Segment Grouping 🆕
File: TestPlanner.js
New Method:
javascript/**
 * Group chain into platform segments
 * 
 * A segment = consecutive steps on same platform
 * 
 * @param {Array} chain - Full prerequisite chain
 * @returns {Array} Array of segments
 */
_groupChainByPlatform(chain) {
  const segments = [];
  let currentSegment = null;
  
  for (const step of chain) {
    // Start new segment if platform changes
    if (!currentSegment || currentSegment.platform !== step.platform) {
      currentSegment = {
        platform: step.platform,
        steps: [],
        complete: true  // Assume complete until we find incomplete step
      };
      segments.push(currentSegment);
    }
    
    currentSegment.steps.push(step);
    
    // If any step incomplete, segment is incomplete
    if (!step.complete) {
      currentSegment.complete = false;
    }
  }
  
  return segments;
}
Example Output:
javascript[
  {
    platform: 'web',
    steps: [initial, logged_in, club_selected, booking_created],
    complete: false
  },
  {
    platform: 'dancer', 
    steps: [booking_pending],
    complete: false
  },
  {
    platform: 'clubApp',
    steps: [booking_standby, booking_accepted],
    complete: false
  }
]

Phase 4: Smart Transition Selection 🆕
File: TestPlanner.js
New Method:
javascript/**
 * Find the transition to use when building chain
 * 
 * Priority:
 * 1. Explicit viaEvent from target test
 * 2. isDefault flag on transition
 * 3. Same-platform preference
 * 4. First available
 * 
 * @param {Object} sourceImplication - Source state Implication class
 * @param {string} targetStatus - Target state
 * @param {string} currentPlatform - Current test platform
 * @param {Object} options - { explicitEvent, preferSamePlatform }
 * @returns {Object} Selected transition
 */
_selectTransition(sourceImplication, targetStatus, currentPlatform, options = {}) {
  const { explicitEvent, preferSamePlatform = true } = options;
  
  const xstateConfig = sourceImplication.xstateConfig || {};
  const transitions = xstateConfig.on || {};
  
  // Find all transitions to target
  const candidates = Object.entries(transitions)
    .filter(([event, config]) => {
      const target = typeof config === 'string' ? config : config.target;
      return target === targetStatus;
    })
    .map(([event, config]) => ({
      event,
      config: typeof config === 'string' ? { target: config } : config
    }));
  
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  
  // Priority 1: Explicit event
  if (explicitEvent) {
    const match = candidates.find(c => c.event === explicitEvent);
    if (match) return match;
  }
  
  // Priority 2: Default flag
  const defaultCandidate = candidates.find(c => c.config.isDefault === true);
  if (defaultCandidate) return defaultCandidate;
  
  // Priority 3: Same platform
  if (preferSamePlatform) {
    const samePlatform = candidates.find(c => 
      c.config.platforms?.includes(currentPlatform)
    );
    if (samePlatform) return samePlatform;
  }
  
  // Priority 4: First available
  return candidates[0];
}

Phase 5: Update buildPrerequisiteChain 🔄
File: TestPlanner.js
Changes to existing method:
javascriptbuildPrerequisiteChain(ImplicationClass, currentStatus, targetStatus, visited, isOriginalTarget, testData, options = {}) {
  const { explicitEvent } = options;  // ✅ ADD THIS
  
  // ... existing code ...
  
  // When building chain for previousStatus:
  if (meta.requires?.previousStatus) {
    const previousStatus = meta.requires.previousStatus;
    const prevImplClassName = this.stateRegistry[previousStatus];
    
    if (prevImplClassName && !visited.has(previousStatus)) {
      const prevImplPath = this.findImplicationFile(prevImplClassName);
      const PrevImplClass = require(prevImplPath);
      
      // ✅ SELECT WHICH TRANSITION TO USE
      const transition = this._selectTransition(
        PrevImplClass,
        targetStatus,
        meta.platform,
        { explicitEvent }  // ✅ Pass explicit event if available
      );
      
      // ✅ BUILD CHAIN USING SELECTED TRANSITION
      const prevChain = this.buildPrerequisiteChain(
        PrevImplClass,
        currentStatus,
        previousStatus,
        visited,
        false,
        testData,
        { explicitEvent: transition?.event }  // ✅ Propagate event choice
      );
      
      chain.push(...prevChain);
    }
  }
  
  // ... rest of existing code ...
}

Phase 6: Enhanced checkOrThrow with Segments 🔄
File: TestPlanner.js
Major update to checkOrThrow:
javascriptstatic async checkOrThrow(ImplicationClass, testData, options = {}) {
  const { page, driver, testDataPath } = options;
  const planner = new TestPlanner({ verbose: true });
  
  const meta = ImplicationClass.xstateConfig?.meta || ImplicationClass.meta;
  const targetStatus = meta.status;
  const currentStatus = this._getCurrentStatus(testData, ImplicationClass);
  const currentPlatform = options.page ? 'web' : meta.platform;
  
  // ✅ Get explicit event from test's meta.setup
  const explicitEvent = meta.setup?.[0]?.viaEvent;
  
  console.log(`\n🔍 TestPlanner: Analyzing ${targetStatus} state`);
  console.log(`   Current: ${currentStatus}`);
  console.log(`   Target: ${targetStatus}`);
  if (explicitEvent) {
    console.log(`   Via Event: ${explicitEvent}`);
  }
  
  // ✅ Build chain with explicit event
  const analysis = planner.analyze(ImplicationClass, testData, { explicitEvent });
  
  // Skip if already at target
  if (targetStatus && currentStatus === targetStatus) {
    console.log(`✅ Already in target state (${targetStatus})\n`);
    return { ready: true, skipped: true };
  }
  
  // ✅ GROUP CHAIN INTO PLATFORM SEGMENTS
  const segments = planner._groupChainByPlatform(analysis.chain);
  
  console.log(`\n📊 Prerequisite Chain (${segments.length} segment${segments.length > 1 ? 's' : ''}):\n`);
  
  segments.forEach((segment, index) => {
    const status = segment.complete ? '✅' : '❌';
    const label = segment.steps.length === 1 && segment.steps[0].isTarget 
      ? 'CURRENT TEST' 
      : segment.complete ? 'COMPLETE' : 'NOT COMPLETE';
    
    console.log(`Segment ${index + 1} (${segment.platform}): ${status} ${label}`);
    
    segment.steps.forEach(step => {
      const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
      console.log(`  ${icon} ${step.status}`);
    });
    console.log('');
  });
  
  // ✅ FIND FIRST INCOMPLETE SEGMENT
  const incompleteSegment = segments.find(s => !s.complete);
  
  if (!incompleteSegment) {
    console.log('✅ All prerequisites satisfied!\n');
    return analysis;
  }
  
  // ✅ CHECK IF INCOMPLETE SEGMENT IS SAME PLATFORM
  if (incompleteSegment.platform === currentPlatform) {
    console.log(`⚡ Auto-executing ${incompleteSegment.platform} segment...\n`);
    
    // Auto-execute steps in this segment
    for (const step of incompleteSegment.steps) {
      if (step.complete || step.isTarget) continue;
      
      console.log(`⚡ Auto-executing prerequisite: ${step.actionName}\n`);
      
      // Execute step (existing auto-execution logic)
      // ... existing code from current checkOrThrow ...
    }
    
    return analysis;
  }
  
  // ✅ INCOMPLETE SEGMENT IS DIFFERENT PLATFORM
  console.log(`\n⚠️  Next segment requires ${incompleteSegment.platform} platform\n`);
  console.log(`💡 RUN THESE COMMANDS:\n`);
  
  // Show commands for all incomplete segments
  let segmentNum = 1;
  for (const segment of segments) {
    if (segment.complete) continue;
    
    console.log(`Segment ${segmentNum} (${segment.platform}):`);
    
    for (const step of segment.steps) {
      if (step.complete || step.isTarget) continue;
      
      if (segment.platform === 'web') {
        console.log(`  npm run test:web -- ${step.testFile}`);
      } else {
        const appType = segment.platform === 'dancer' ? 'dancer' : 'club';
        console.log(`  npm run test:android:local -- -u ${appType} --spec ${step.testFile}`);
      }
    }
    
    console.log('');
    segmentNum++;
  }
  
  throw new Error('Prerequisites not met (cross-platform)');
}
```

---

## 📊 LOGIC FLOW DIAGRAM
```
Test Starts
    ↓
Load ImplicationClass
    ↓
Get explicitEvent from meta.setup[0].viaEvent
    ↓
buildPrerequisiteChain(explicitEvent)
    ↓
  ┌─────────────────────────────┐
  │ For each prerequisite:      │
  │  - Find transitions to it   │
  │  - Use _selectTransition()  │
  │    Priority:                │
  │    1. explicitEvent         │
  │    2. isDefault flag        │
  │    3. Same platform         │
  │    4. First available       │
  └─────────────────────────────┘
    ↓
Full chain built
    ↓
_groupChainByPlatform()
    ↓
  ┌─────────────────────────────┐
  │ Segments created:           │
  │ - Consecutive same platform │
  │ - Track complete status     │
  └─────────────────────────────┘
    ↓
Find first incomplete segment
    ↓
  ┌──────────────┬──────────────┐
  │              │              │
Same Platform  Different Platform
  │              │              
Auto-Execute   Show Commands
  │              Exit
Continue

📝 FILES TO MODIFY
1. Implication Files (Manual)

Add isDefault: true to preferred transitions
Example: BookingCreatedImplications.js

2. UnitTestGenerator.js

Add viaEvent to meta.setup during generation
Line: ~400 in _buildContext() or _extractMetadata()

3. TestPlanner.js

Add _groupChainByPlatform() method
Add _selectTransition() method
Update buildPrerequisiteChain() signature and logic
Rewrite checkOrThrow() with segment logic
Lines: Add ~200 new lines


✅ VALIDATION TESTS
After implementation, test these scenarios:

Single platform chain

BookingCreated test (web only)
Should auto-execute: initial → logged_in → club_selected → booking_created


Cross-platform with default

BookingPending test (dancer)
Should use REQUEST_BOOKING (not INVITE_DANCER)
Should show: web steps, then dancer step


Multi-segment

BookingAccepted test (clubApp)
Should group: web → dancer → clubApp
Should show clear segment breakdown


Fork detection

Test with multiple paths
Should prefer isDefault: true




🎯 SUCCESS CRITERIA
✅ System groups prerequisites by platform
✅ Auto-executes same-platform segments
✅ Pauses at platform boundaries with clear instructions
✅ Respects default transition flags
✅ Respects explicit test event choices
✅ Beautiful console output with segment visualization

Ready to implement? 🚀

🎯 PROJECT HANDOFF: Auto-Runner Cross-Platform Fix
📋 QUICK CONTEXT (Read This First)
Project: Implications Framework - Test automation system
Current Status: MVP working for single-platform flows
Problem: Cross-platform test flows exit immediately instead of intelligently guiding execution
Goal: Enable smart auto-execution with platform segment grouping

🏗️ SYSTEM ARCHITECTURE (Essential Understanding)
What Is This System?
Implications Framework = Test generator that creates end-to-end tests from state machine definitions
Key Concept: Tests are generated from Implication files that define:

State transitions (XState-based)
UI expectations (mirrorsOn)
Action details (how to trigger transitions)
Prerequisites (what must happen first)

Core Components
Discovery System (discoveryService.js, astParser.js)
  ↓ Scans guest projects, extracts patterns
  ↓ Builds state registry + cache
  
Generation System (UnitTestGenerator.js, TemplateEngine.js)
  ↓ Generates UNIT tests from Implications
  ↓ Creates test files with real action code
  
Execution System (TestPlanner.js, TestContext.js)
  ↓ Analyzes prerequisites
  ↓ Auto-executes or guides user
  ↓ Tracks state changes with delta

🎯 THE PROBLEM WE'RE SOLVING
Current Behavior (Bad)
User runs: BookingAccepted test (clubApp platform)

System:
❌ Cross-platform prerequisites detected
   Run these commands:
   [lists all commands]
   [exits immediately]

Result: User must manually run 6 commands across 3 platforms
Desired Behavior (Good)
User runs: BookingAccepted test (clubApp platform)

System:
📊 Prerequisite Chain (3 segments):

Segment 1 (web): ❌ NOT COMPLETE
  • initial → logged_in → club_selected → booking_created

Segment 2 (dancer): ❌ NOT COMPLETE
  • booking_created → booking_pending (via REQUEST_BOOKING)

Segment 3 (clubApp): ✅ CURRENT TEST
  • booking_pending → booking_accepted

⚡ Auto-Execution Plan:
1. Run Segment 1 (web) - 4 tests
2. Run Segment 2 (dancer) - 1 test
3. Continue with current test

⏱️  Starting in 10 seconds...

🔑 KEY FILES (Must Understand These)
1. TestPlanner.js
Location: tests/ai-testing/utils/TestPlanner.js
Purpose: Analyzes prerequisites, builds chains, orchestrates execution
Key Methods:

buildPrerequisiteChain() - Recursively builds full dependency chain
checkOrThrow() - Main entry point, decides execute vs exit
detectCrossPlatform() - Identifies platform switches

Current Issue: Exits immediately when cross-platform detected
2. Implication Files
Location: tests/implications/**/*Implications.js
Purpose: Define state transitions and their metadata
Structure:
javascriptclass BookingCreatedImplications {
  static xstateConfig = {
    meta: {
      status: 'booking_created',
      platform: 'web',
      requires: { previousStatus: 'club_selected' },
      setup: [{ testFile: '...', actionName: '...' }]
    },
    on: {
      REQUEST_BOOKING: {
        target: 'booking_pending',
        platforms: ['dancer'],
        actionDetails: { ... }
      }
    }
  }
}
```

### 3. UnitTestGenerator.js
**Location:** `packages/core/src/generators/UnitTestGenerator.js`
**Purpose:** Generates test files from Implications
**Relevant:** Sets up meta.setup during generation

---

## 🎭 BUSINESS LOGIC (Critical Context)

### Multi-Platform Flow Example

**Real-world flow:** Manager accepts a booking on mobile app

**Prerequisites chain:**
```
initial (web)
  → logged_in (web)           [Manager logs into web]
  → club_selected (web)       [Manager selects club]
  → booking_created (web)     [Manager creates booking slots]
  → booking_pending (dancer)  [Dancer requests booking]  ⚠️ PLATFORM SWITCH
  → booking_accepted (clubApp) [Manager accepts on mobile] 🎯 TARGET
Why it's complex:

Starts on web (manager creates bookings)
Switches to dancer app (dancer requests)
Switches to clubApp (manager accepts)

The Fork Problem
Sometimes multiple paths exist to same state:
javascript// BookingCreatedImplications
on: {
  REQUEST_BOOKING: {
    target: 'booking_pending',
    platforms: ['dancer']
    // Normal flow: Dancer requests
  },
  
  INVITE_DANCER: {
    target: 'booking_pending',
    platforms: ['web']
    // Alternative: Manager invites
  }
}
Question: Which path should auto-runner choose?
Answer: Need isDefault: true flag

🔧 THE SOLUTION (Implementation Plan)
Step 1: Add Default Flags
What: Mark preferred transitions in Implication files
Where: on: section of xstateConfig
Why: Tells system which path to prefer
javascriptREQUEST_BOOKING: {
  target: 'booking_pending',
  isDefault: true,  // ✅ ADD THIS
  // ...
}
Step 2: Store viaEvent
What: Save which event triggered the state
Where: UnitTestGenerator.js in meta.setup
Why: Explicit tests know their path
javascriptsetup: [{
  testFile: '...',
  viaEvent: 'REQUEST_BOOKING'  // ✅ ADD THIS
}]
Step 3: Platform Segment Grouping
What: Group consecutive same-platform steps
Where: New method _groupChainByPlatform() in TestPlanner.js
Why: Enable auto-execution of complete platform segments
javascript// Instead of:
[step1(web), step2(web), step3(dancer), step4(clubApp)]

// Group into:
[
  {platform: 'web', steps: [step1, step2]},
  {platform: 'dancer', steps: [step3]},
  {platform: 'clubApp', steps: [step4]}
]
```

### Step 4: Smart Transition Selection

**What:** Choose correct transition when forks exist
**Where:** New method `_selectTransition()` in TestPlanner.js
**Why:** Intelligent path selection

**Priority:**
1. Explicit event from test (if specified)
2. isDefault flag
3. Same-platform preference
4. First available

### Step 5: Update checkOrThrow

**What:** Rewrite with segment-aware logic
**Where:** TestPlanner.js
**Why:** This is the main execution orchestrator

**Logic:**
```
1. Build chain (with explicit event if available)
2. Group into segments
3. Find first incomplete segment
4. If same platform → auto-execute
5. If different platform → show commands & exit
```

---

## 📊 DATA FLOW (How It All Connects)

### Generation Time
```
User clicks "Generate Test" in UI
  ↓
Frontend enriches transition with actionDetails
  ↓
UnitTestGenerator.generate()
  ↓
Creates: BookingPendingViaBookingCreated-REQUESTBOOKING-Dancer-UNIT.spec.js
Stores: meta.setup[0].viaEvent = 'REQUEST_BOOKING'
```

### Runtime
```
Test file executes
  ↓
Calls: TestPlanner.checkOrThrow(BookingPendingImplications, testData)
  ↓
Reads: meta.setup[0].viaEvent = 'REQUEST_BOOKING'
  ↓
Builds chain using that specific event
  ↓
Groups into platform segments
  ↓
Auto-executes same-platform OR shows cross-platform instructions

⚠️ CRITICAL GOTCHAS (Things That Will Trip You Up)
1. Visited Set Issues
javascript// DON'T share visited set across entity boundaries!
buildPrerequisiteChain(..., visited = new Set()) {
  // visited prevents circular deps
  // BUT: dancer_logged_in and web logged_in are DIFFERENT states
}
2. Entity vs Global Status
javascript// Entity-scoped implications:
meta: { entity: 'booking', status: 'booking_created' }
// Status is: testData.booking.status

// Global implications:
meta: { status: 'logged_in' }
// Status is: testData.status
3. Filename Parsing
javascript// Test filename format:
// {ActionName}-{EVENT}-{Platform}-UNIT.spec.js
// BookingPendingViaBookingCreated-REQUESTBOOKING-Dancer-UNIT.spec.js

// Parse carefully:
const parts = filename.split('-');
const actionName = parts[0];  // "BookingPendingViaBookingCreated"
const event = parts[1];        // "REQUESTBOOKING"
const platform = parts[2];     // "Dancer"
4. Platform Mapping
javascript// Inconsistent naming!
'dancer' (code) → 'Dancer' (filename) → 'dancer' (platform)
'clubApp' (code) → 'ClubApp' (filename) → 'clubApp' (platform)
'web' (code) → 'Web' (filename) → 'playwright' (runtime detection)

🧪 HOW TO TEST
Test Scenario 1: Single Platform
bash# Reset state
echo '{"status":"initial"}' > tests/data/shared.json

# Run web-only test
npm run test:web -- BookingCreatedViaClubSelected-CREATEBOOKING-Web-UNIT.spec.js

# Expected: Auto-executes initial → logged_in → club_selected → booking_created
Test Scenario 2: Cross-Platform
bash# Reset state
echo '{"status":"initial"}' > tests/data/shared.json

# Run dancer test
npm run test:android:local -- -u dancer --spec BookingPendingViaBookingCreated-REQUESTBOOKING-Dancer-UNIT.spec.js

# Expected: 
# - Groups web steps together
# - Shows commands for web segment
# - Exits with clear instructions
Test Scenario 3: Fork Selection
bash# With isDefault: true on REQUEST_BOOKING
# System should choose that over INVITE_DANCER
# Verify by checking console output for "via REQUEST_BOOKING"

💡 HELPFUL DEBUGGING
Enable Verbose Logging
javascriptconst planner = new TestPlanner({ verbose: true });
Check State Registry
javascript// View all known states
cat tests/implications/.state-registry.json
Inspect Discovery Cache
javascript// See all transitions
cat .implications-framework/cache/discovery-result.json
Add Debug Points
javascript// In buildPrerequisiteChain
console.log('🔍 Building chain:', {
  currentStatus,
  targetStatus,
  explicitEvent,
  visitedStates: Array.from(visited)
});

📚 REFERENCE DOCUMENTS
In Project Knowledge:

SYSTEM-OVERVIEW.md - Complete architecture
TestPlanner.js - Current implementation (has fork/countdown feature already!)
SESSION-2025-01-12-MULTIPLE-PATHS-COMPLETE.md - Multiple paths implementation
UNIT-TEST-GENERATION-ARCHITECTURE-2025-11-11.md - Generation system

Key Insight: Multiple paths feature ALREADY EXISTS but only for choosing between paths to SAME state. We need to extend it for cross-platform prerequisite handling.

🎯 SUCCESS CHECKLIST
Before marking complete, verify:

 isDefault flag added to Implication transitions
 viaEvent stored in meta.setup during generation
 _groupChainByPlatform() method implemented
 _selectTransition() method implemented
 buildPrerequisiteChain() updated to use explicit events
 checkOrThrow() rewritten with segment logic
 Single-platform test auto-executes completely
 Cross-platform test shows grouped commands
 Fork selection prefers isDefault: true
 Console output is beautiful and clear


🚀 STARTING POINT FOR NEW AGENT
First thing to do:

Read this entire document
View TestPlanner.js to understand current implementation
Ask: "Show me an example Implication file with multiple transitions to same state"
Ask: "Walk me through what happens when BookingPendingViaBookingCreated test runs"
Implement Phase 1 (add isDefault flags) in one Implication file
Test to verify understanding before proceeding

Questions to ask me:

"Which Implication files should I update with isDefault flags?"
"Where exactly in UnitTestGenerator should viaEvent be added?"
"Can you show me the exact output format you want for segment display?"


This document contains everything needed to understand and complete the task. 🎯