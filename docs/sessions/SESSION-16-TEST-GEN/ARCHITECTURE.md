# 🏗️ Implications Framework - Technical Architecture

**Version:** 2.0  
**Date:** October 23, 2025  
**Status:** Phase 1 Design - Ready to Build

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Core Concepts](#core-concepts)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Integration Patterns](#integration-patterns)
6. [Platform Boundaries](#platform-boundaries)
7. [XState Integration](#xstate-integration)
8. [API Design](#api-design)
9. [File Generation](#file-generation)
10. [Security & Validation](#security--validation)

---

## 📊 System Overview

### The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│                   IMPLICATIONS FRAMEWORK                    │
│                  (Declarative Testing DSL)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐   ┌──────────────────┐
        │   HOST SYSTEM    │   │   GUEST PROJECT  │
        │  (Framework)     │   │   (Your App)     │
        └──────────────────┘   └──────────────────┘
```

**The Framework is a CODE GENERATOR and TEST ORCHESTRATOR that:**
- Reads declarative Implication files (single source of truth)
- Generates UNIT tests, validation tests, scenarios
- Orchestrates test execution with shared state
- Validates UI across multiple platforms
- Manages test data with XState transitions

**It does NOT contain test code - it GENERATES test code for your project!**

---

## 🎯 Core Concepts

### 1. Implications Files

**What they are:**
Declarative files that define everything about a state in your system.

**What they contain:**

```javascript
class AcceptedBookingImplications {
  
  // 1. XState Configuration
  static xstateConfig = {
    meta: {
      status: "Accepted",
      requiredFields: [...],
      setup: { testFile, actionName, platform }
    },
    on: {
      UNDO: 'pending',
      CANCEL: 'rejected'
    },
    entry: assign({ status: 'Accepted', ... })
  }
  
  // 2. Validation & Data
  static validateTestData(testData) { ... }
  static createTestData(overrides) { ... }
  
  // 3. Actions that trigger this state
  static triggeredBy = [
    {
      platform: "web",
      action: async (testDataPath, options) => { ... }
    }
  ]
  
  // 4. UI Validation Rules
  static mirrorsOn = {
    UI: {
      dancer: {
        bookingDetailsScreen: [
          {
            screen: (app) => app.bookingDetailsScreen,
            prerequisites: [...],
            checks: {
              visible: ['btnCancelBooking'],
              hidden: ['btnAccept'],
              text: { statusLabel: 'Accepted' }
            }
          }
        ]
      }
    }
  }
}
```

**Why they're powerful:**
- Single source of truth
- Machine-readable (code generation)
- Human-readable (documentation)
- Multi-platform support
- Type-safe with validation

---

### 2. State Machine (XState)

**Purpose:** Model your application state transitions as a formal state machine.

**How it works:**

```javascript
// Auto-built from Implications files
const machine = BookingStateMachine.build();

// States:
// - created
// - pending
// - accepted
// - rejected
// - checked_in
// - checked_out
// etc.

// Transitions:
// created --REQUEST--> pending
// pending --ACCEPT--> accepted
// pending --REJECT--> rejected
// accepted --UNDO--> pending
// etc.
```

**Benefits:**
- Prevents invalid transitions
- Validates test readiness
- Generates test scenarios
- Documents system behavior
- Guards protect business rules

---

### 3. TestContext (Data Management)

**Purpose:** Manage shared test data across test files with change tracking.

**Pattern:**

```javascript
// Load existing data
const ctx = TestContext.load(AcceptedBookingImplications, testDataPath);

// Execute action and save changes
await ctx.executeAndSave(
  'Accepted 3 bookings',
  'AcceptBooking-Web-UNIT.spec.js',
  async () => ({
    delta: {
      'bookings[0]': { status: 'Accepted', acceptedAt: now },
      'bookings[1]': { status: 'Accepted', acceptedAt: now },
      'bookings[2]': { status: 'Accepted', acceptedAt: now }
    }
  })
);
```

**Features:**
- Change tracking (changelog)
- Delta updates (only changed fields)
- State validation (via Implications)
- Smart data access (getBooking, getDancer, etc.)
- Backup/restore support

---

### 4. ExpectImplication (Validation Engine)

**Purpose:** Validate UI state against Implication definitions.

**How it works:**

```javascript
await ExpectImplication.validateSingleImplication(
  implication,
  testData,
  app,
  {
    skipAnalysis: false,     // Run TestPlanner?
    throwOnNotReady: true,   // Fail if prerequisites missing?
    verbose: true            // Print analysis?
  }
);
```

**What it does:**
1. ✅ Runs TestPlanner analysis (checks readiness)
2. ✅ Executes prerequisites (navigation, setup)
3. ✅ Gets screen object
4. ✅ Validates visible elements
5. ✅ Validates hidden elements
6. ✅ Validates text values
7. ✅ Runs custom expect functions

**Platform support:**
- Playwright (web, cms)
- Appium/WebdriverIO (dancer, manager)

---

### 5. TestPlanner (Readiness Checker)

**Purpose:** Check if test can run, show missing prerequisites, suggest next steps.

**What it analyzes:**

```javascript
const analysis = planner.analyze(implication, testData);

// Returns:
{
  ready: false,
  currentStatus: 'Created',
  targetStatus: 'Accepted',
  missing: [
    { field: 'requestedBy', required: true, current: undefined }
  ],
  chain: [
    { status: 'Created', ... },
    { status: 'Pending', ... },  // ← Need this first
    { status: 'Accepted', ... }  // ← Target
  ],
  nextStep: {
    status: 'Pending',
    actionName: 'requestBooking',
    testFile: 'PendingBooking-Dancer-UNIT.spec.js',
    platform: 'dancer'
  },
  stepsRemaining: 1
}
```

**Benefits:**
- Prevents test failures (missing data)
- Shows clear path to target
- Suggests exact next step
- Validates state transitions
- Educational (shows dependencies)

---

## 🔧 Component Architecture

### Layer 1: Guest Project (Your App)

```
tests/
├── implications/
│   ├── bookings/
│   │   ├── status/
│   │   │   ├── CreatedBookingImplications.js
│   │   │   ├── PendingBookingImplications.js
│   │   │   ├── AcceptedBookingImplications.js
│   │   │   └── ...
│   │   ├── CreatedBooking-Web-UNIT.spec.js
│   │   ├── PendingBooking-Dancer-UNIT.spec.js
│   │   └── AcceptBooking-Web-UNIT.spec.js
│   └── ...
├── utils/
│   ├── TestContext.js
│   ├── ExpectImplication.js
│   └── TestPlanner.js
├── xstate/
│   └── machines/
│       ├── BookingStateMachine.js
│       ├── simulate.js
│       ├── validate.js
│       └── visualize.js
└── web/ or mobile/
    └── screenObjects/
```

**What the guest provides:**
- Implication files (declarative definitions)
- Screen objects (locators)
- Config files (credentials, URLs)

---

### Layer 2: Core Framework

```
packages/
├── core/
│   ├── src/
│   │   ├── generators/
│   │   │   ├── UnitTestGenerator.js
│   │   │   ├── XStateScenarioGenerator.js
│   │   │   ├── ValidationTestGenerator.js
│   │   │   └── OrchestrationGenerator.js
│   │   ├── discovery/
│   │   │   ├── ImplicationDiscovery.js
│   │   │   ├── PatternExtractor.js
│   │   │   └── DependencyAnalyzer.js
│   │   ├── xstate/
│   │   │   ├── MachineBuilder.js
│   │   │   ├── PathGenerator.js
│   │   │   └── GuardAnalyzer.js
│   │   └── utils/
│   │       ├── TemplateEngine.js
│   │       ├── FileWriter.js
│   │       └── Validator.js
│   └── templates/
│       ├── unit-test.hbs
│       ├── validation-test.hbs
│       ├── orchestration.hbs
│       └── xstate-scenario.hbs
```

**What the framework provides:**
- Discovery (scan implications)
- Analysis (TestPlanner, dependencies)
- Generation (code from templates)
- Validation (test readiness)

---

### Layer 3: API Server

```
packages/api-server/
├── src/
│   ├── routes/
│   │   ├── discovery.js      # Scan project
│   │   ├── generate.js       # Generate tests
│   │   ├── xstate.js         # State machine ops
│   │   ├── validation.js     # Validate readiness
│   │   └── init.js           # Project setup
│   ├── services/
│   │   ├── GeneratorService.js
│   │   ├── DiscoveryService.js
│   │   ├── XStateService.js
│   │   └── ValidationService.js
│   └── index.js
```

**API endpoints:**

```
POST /api/generate/unit-test
POST /api/generate/all-unit-tests
POST /api/generate/xstate-scenarios
POST /api/generate/validation-tests
POST /api/generate/orchestration

GET  /api/discovery/scan
GET  /api/xstate/machine
POST /api/xstate/simulate
GET  /api/validation/check-readiness
```

---

### Layer 4: Web UI

```
packages/web-app/
├── src/
│   ├── pages/
│   │   ├── Visualizer.jsx        # State machine graph
│   │   ├── TestBuilder.jsx       # Visual test builder
│   │   ├── TestRunner.jsx        # Execute tests
│   │   └── Dashboard.jsx         # Overview
│   ├── components/
│   │   ├── StateMachine.jsx      # Cytoscape graph
│   │   ├── StateDetails.jsx      # Implication details
│   │   ├── TestPreview.jsx       # Preview generated code
│   │   ├── TestGenerator.jsx     # Generation UI
│   │   └── ReadinessChecker.jsx  # TestPlanner UI
│   └── App.jsx
```

**User workflows:**
1. Scan project → See state machine
2. Click state → See details
3. Click "Generate Test" → Preview code
4. Click "Save" → Write file to disk
5. Click "Run Test" → Execute and stream output

---

## 🔄 Data Flow

### Flow 1: Project Scan

```
User                Web UI              API Server           Discovery
 │                    │                    │                    │
 │─ Enter path ─────→│                    │                    │
 │                    │─ POST /scan ─────→│                    │
 │                    │                    │─ scanProject() ──→│
 │                    │                    │                    │─ Find files
 │                    │                    │                    │─ Parse AST
 │                    │                    │                    │─ Extract data
 │                    │                    │                    │
 │                    │                    │←─ implications ────│
 │                    │                    │─ build graph ─────→│
 │                    │←─ graph data ──────│                    │
 │←─ render graph ────│                    │                    │
```

**Data returned:**

```json
{
  "implications": [
    {
      "name": "AcceptedBookingImplications",
      "path": "tests/implications/bookings/status/AcceptedBookingImplications.js",
      "xstateConfig": { "meta": {...}, "on": {...}, "entry": {...} },
      "mirrorsOn": { "UI": {...} },
      "triggeredBy": [...]
    }
  ],
  "stateRegistry": {
    "accepted": {
      "status": "Accepted",
      "transitions": { "UNDO": "pending", "CANCEL": "rejected" },
      "requiredFields": [...],
      "setup": {...}
    }
  },
  "graph": {
    "nodes": [...],
    "edges": [...]
  }
}
```

---

### Flow 2: Generate UNIT Test

```
User                Web UI              API Server           Generator
 │                    │                    │                    │
 │─ Click state ────→│                    │                    │
 │─ "Generate" ─────→│                    │                    │
 │                    │─ POST /generate ─→│                    │
 │                    │  { implName }      │                    │
 │                    │                    │─ load Impl ───────→│
 │                    │                    │                    │─ validate
 │                    │                    │                    │─ template
 │                    │                    │                    │─ generate
 │                    │                    │←─ code ────────────│
 │                    │←─ preview ─────────│                    │
 │←─ show modal ──────│                    │                    │
 │                    │                    │                    │
 │─ "Save" ──────────→│                    │                    │
 │                    │─ POST /generate ─→│                    │
 │                    │  { save: true }    │                    │
 │                    │                    │─ writeFile() ─────→│
 │                    │←─ success ─────────│                    │
 │←─ confirmation ────│                    │                    │
```

**Generated file:**

```javascript
// Auto-generated: AcceptBooking-Web-UNIT.spec.js
// Generated at: 2025-10-23T15:30:00Z
// From: AcceptedBookingImplications

const { test } = require('@playwright/test');
const AcceptedBookingImplications = require('./AcceptedBookingImplications');
const TestContext = require('../../../../utils/TestContext');
const ExpectImplication = require('../../../../utils/ExpectImplication');

// ... (full test code)
```

---

### Flow 3: Test Execution with Validation

```
Test File           TestContext         XState Actor        ExpectImplication
 │                    │                    │                    │
 │─ load() ─────────→│                    │                    │
 │                    │─ read JSON ───────→│                    │
 │                    │─ create actor ────→│                    │
 │←─ ctx ─────────────│                    │                    │
 │                    │                    │                    │
 │─ validate ────────────────────────────────────────────────→│
 │                    │                    │                    │─ TestPlanner
 │                    │                    │                    │─ Check ready
 │                    │                    │                    │
 │                    │                    │                    │  ✅ Ready
 │                    │                    │                    │
 │                    │                    │                    │─ Prerequisites
 │                    │                    │                    │─ Navigate
 │                    │                    │                    │
 │                    │                    │                    │─ Get screen
 │                    │                    │                    │─ Check visible
 │                    │                    │                    │─ Check hidden
 │                    │                    │                    │─ Check text
 │                    │                    │                    │
 │←─ validation passed ───────────────────────────────────────│
 │                    │                    │                    │
 │─ execute action ──→│                    │                    │
 │                    │─ send event ──────→│                    │
 │                    │                    │─ transition ──────→│
 │                    │                    │─ assign context ──→│
 │                    │←─ new snapshot ────│                    │
 │←─ updated ctx ─────│                    │                    │
 │                    │                    │                    │
 │─ save() ──────────→│                    │                    │
 │                    │─ write JSON ───────→│                    │
 │←─ saved ───────────│                    │                    │
```

**TestData file (JSON):**

```json
{
  "_original": {
    "clubName": "Test Club",
    "bookings": [
      {
        "id": "b1",
        "status": "Accepted",
        "requestedBy": "Dancer1",
        "acceptedBy": "Manager1",
        "requestedAt": "2025-10-23T10:00:00Z",
        "acceptedAt": "2025-10-23T11:00:00Z"
      }
    ]
  },
  "_changeLog": [
    {
      "index": 0,
      "type": "INIT",
      "label": "Initial State",
      "timestamp": "2025-10-23T09:00:00Z",
      "delta": {}
    },
    {
      "index": 1,
      "type": "CHANGE",
      "label": "Created Booking",
      "unitTest": "CreatedBooking-Web-UNIT.spec.js",
      "timestamp": "2025-10-23T10:00:00Z",
      "delta": {
        "status": "Created",
        "bookings": [{ "id": "b1", "status": "Created" }]
      }
    },
    {
      "index": 2,
      "type": "CHANGE",
      "label": "Requested Booking",
      "unitTest": "PendingBooking-Dancer-UNIT.spec.js",
      "timestamp": "2025-10-23T10:30:00Z",
      "delta": {
        "bookings[0]": {
          "status": "Pending",
          "requestedBy": "Dancer1",
          "requestedAt": "2025-10-23T10:00:00Z"
        }
      }
    },
    {
      "index": 3,
      "type": "CHANGE",
      "label": "Accepted Booking",
      "unitTest": "AcceptBooking-Web-UNIT.spec.js",
      "timestamp": "2025-10-23T11:00:00Z",
      "delta": {
        "bookings[0]": {
          "status": "Accepted",
          "acceptedBy": "Manager1",
          "acceptedAt": "2025-10-23T11:00:00Z"
        }
      }
    }
  ]
}
```

---

## 🔗 Integration Patterns

### Pattern 1: Implication Inheritance

**Base Class:**

```javascript
class BaseBookingImplications {
  static dancer = {
    bookingDetailsScreen: {
      screen: (app) => app.bookingDetailsScreen,
      prerequisites: [...],
      alwaysVisible: ['statusLabel', 'statusText'],
      sometimesVisible: ['btnAccept', 'btnDecline', 'btnCancel']
    }
  }
}
```

**Status-Specific Class:**

```javascript
class AcceptedBookingImplications {
  static mirrorsOn = {
    UI: {
      dancer: {
        bookingDetailsScreen: [
          ImplicationHelper.mergeWithBase(
            BaseBookingImplications.dancer.bookingDetailsScreen,
            {
              description: "Accepted shows cancel button",
              visible: ['btnCancel'],
              hidden: ['btnAccept', 'btnDecline']
            },
            { parentClass: AcceptedBookingImplications }
          )
        ]
      }
    }
  }
}
```

**Result after merge:**

```javascript
{
  screen: (app) => app.bookingDetailsScreen,
  prerequisites: [...],
  parentClass: AcceptedBookingImplications,
  checks: {
    visible: ['statusLabel', 'statusText', 'btnCancel'],
    hidden: ['btnAccept', 'btnDecline']
  }
}
```

---

### Pattern 2: Multi-Platform Actions

**Implication defines multiple platforms:**

```javascript
class AcceptedBookingImplications {
  static triggeredBy = [
    {
      description: "Accept via web",
      platform: "web",
      action: async (testDataPath, options) => {
        const { acceptBooking } = require('./AcceptBooking-Web-UNIT.spec.js');
        return acceptBooking(testDataPath, options);
      }
    },
    {
      description: "Accept via mobile manager",
      platform: "manager",
      action: async (testDataPath, options) => {
        const { acceptBooking } = require('./AcceptBooking-Manager-UNIT.spec.js');
        return acceptBooking(testDataPath, options);
      }
    }
  ]
}
```

**Generator creates platform-specific tests:**

```
AcceptBooking-Web-UNIT.spec.js          (Playwright)
AcceptBooking-Manager-UNIT.spec.js      (Appium)
```

**User chooses which to run:**

```bash
# Web version
TEST_DATA_PATH="data.json" npx playwright test AcceptBooking-Web-UNIT.spec.js

# Mobile version
TEST_DATA_PATH="data.json" npx wdio AcceptBooking-Manager-UNIT.spec.js
```

---

### Pattern 3: Lazy Loading (Mobile)

**Problem:** Mobile dependencies (Appium) shouldn't load for web-only tests.

**Solution:** MobileAppsLoader

```javascript
class MobileAppsLoader {
  static getMobileApps() {
    if (!_cache) {
      // Only load when first called
      const AppD = require("../mobile/android/dancer/screenObjects/App.js");
      const AppM = require("../mobile/android/manager/screenObjects/App.js");
      _cache = { appD: new AppD("en"), appM: new AppM("en") };
    }
    return _cache;
  }
}
```

**Usage in Implications:**

```javascript
class NotificationsImplications {
  static getActionsD() {
    if (!this._actionsD) {
      const ActionsD = require("../mobile/android/dancer/actions/Actions.js");
      this._actionsD = new ActionsD(config, null);
    }
    return this._actionsD;
  }
}
```

**Benefits:**
- Web tests don't load Appium
- Mobile tests don't fail on missing APK config
- Faster test initialization
- Cleaner dependency management

---

## 🚧 Platform Boundaries

### The Critical Rule

```
❌ CANNOT MIX IN SAME TEST:
   Playwright (web) + Appium (dancer, manager)

✅ CAN MIX IN SAME TEST:
   Playwright (web) + Playwright (cms)

✅ CAN COORDINATE ACROSS TESTS:
   Test 1 (Playwright) → writes testData.json
   Test 2 (Appium) → reads testData.json
```

### Why?

**Playwright and Appium are different test runners:**
- Different drivers (Chromium vs Appium)
- Different element APIs (page.locator vs $)
- Different expect libraries
- Cannot run in same process

### Solution: Shared TestData Files

```javascript
// Test 1: Web (Playwright)
test('Create bookings', async ({ page }) => {
  const ctx = TestContext.load(CreatedBookingImplications, testDataPath);
  await createBookings(page, ctx.data);
  await ctx.save(testDataPath);  // ✅ Write to file
});

// Test 2: Mobile Dancer (Appium) - separate runner!
it('Request bookings', async () => {
  const ctx = TestContext.load(PendingBookingImplications, testDataPath);
  await requestBookings(ctx.data);  // ✅ Read from file
  await ctx.save(testDataPath);
});
```

**Orchestration:**

```javascript
// 01-SETUP.spec.js (Playwright)
test.describe.serial('Complete Flow', () => {
  test('Step 1: Create (web)', async () => {
    execSync(`TEST_DATA_PATH="${path}" npx playwright test Create-Web-UNIT.spec.js`);
  });
  
  test('Step 2: Request (dancer)', async () => {
    execSync(`TEST_DATA_PATH="${path}" npx wdio Pending-Dancer-UNIT.spec.js`);
  });
  
  test('Step 3: Accept (web)', async () => {
    execSync(`TEST_DATA_PATH="${path}" npx playwright test Accept-Web-UNIT.spec.js`);
  });
});
```

---

## 🎮 XState Integration

### State Machine Building

**Auto-build from Implications:**

```javascript
class BookingStateMachine {
  static implicationClasses = [
    CreatedBookingImplications,
    PendingBookingImplications,
    AcceptedBookingImplications,
    RejectedBookingImplications,
    // ... add more as you migrate
  ];
  
  static build() {
    const states = {};
    
    this.implicationClasses.forEach(ImplClass => {
      const stateName = this._getStateName(ImplClass);
      
      states[stateName] = {
        on: ImplClass.xstateConfig.on || {},
        entry: ImplClass.xstateConfig.entry,
        exit: ImplClass.xstateConfig.exit,
        meta: {
          ...ImplClass.xstateConfig.meta,
          ImplicationClass: ImplClass
        }
      };
    });
    
    return createMachine({
      id: 'booking',
      initial: 'created',
      context: { /* default values */ },
      states
    });
  }
}
```

---

### Transition Validation

**Before test runs:**

```javascript
// Check if transition is valid
const currentState = 'pending';
const event = 'ACCEPT';

const machine = BookingStateMachine.machine;
const nextState = machine.transition(currentState, { type: event });

if (!nextState.changed) {
  throw new Error(`Invalid transition: ${currentState} + ${event}`);
}

// ✅ Valid, proceed with test
```

---

### Guard Evaluation

**Define guards in Implications:**

```javascript
static xstateConfig = {
  on: {
    ACCEPT: {
      target: 'accepted',
      guard: ({ context, event }) => {
        // Only allow if bookings exist and are pending
        return context.bookings?.some(b => b.status === 'Pending');
      }
    }
  }
}
```

**Generator checks guards:**

```javascript
const canTransition = machine.transition(currentState, event).changed;

if (!canTransition) {
  const guard = machine.states[currentState].on[event].guard;
  const guardResult = guard(context, event);
  
  throw new Error(
    `Guard prevented transition: ${currentState} + ${event}\n` +
    `Guard result: ${guardResult}`
  );
}
```

---

### Path Generation

**Generate test for each path:**

```javascript
class XStateScenarioGenerator {
  static generatePathTests(machine) {
    const { createActor } = require('xstate');
    const paths = this._getAllPaths(machine);
    
    const tests = paths.map(path => ({
      name: `Path: ${path.description}`,
      steps: path.steps.map(step => ({
        state: step.state,
        event: step.event,
        action: this._getActionForTransition(step)
      }))
    }));
    
    return tests;
  }
}
```

**Generated test:**

```javascript
test('Path: Created → Pending → Accepted', async () => {
  // Step 1: Created → Pending
  await requestBooking(testDataPath, { bookingIndex: 0 });
  
  // Step 2: Pending → Accepted
  await acceptBooking(testDataPath, { bookingIndex: 0 });
  
  // Validate final state
  const ctx = TestContext.load(AcceptedBookingImplications, testDataPath);
  expect(ctx.data.bookings[0].status).toBe('Accepted');
});
```

---

### State Coverage

**Ensure every state is tested:**

```javascript
const allStates = Object.keys(machine.states);

allStates.forEach(targetState => {
  test(`Reach state: ${targetState}`, async () => {
    // Find shortest path to this state
    const path = findShortestPath(machine, 'created', targetState);
    
    // Execute each step
    for (const step of path) {
      await step.action(testDataPath);
    }
    
    // Validate reached target
    const ctx = TestContext.load(targetState.ImplicationClass, testDataPath);
    expect(ctx.data.status).toBe(targetState);
  });
});
```

---

## 🔌 API Design

### Core Endpoints

#### POST /api/generate/unit-test

**Generate a UNIT test from an Implication.**

**Request:**
```json
{
  "projectPath": "/path/to/guest-project",
  "implName": "AcceptedBookingImplications",
  "options": {
    "platform": "web",
    "preview": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "filePath": "tests/implications/bookings/AcceptBooking-Web-UNIT.spec.js",
  "content": "// Auto-generated...",
  "preview": true
}
```

---

#### POST /api/generate/all-unit-tests

**Generate UNIT tests for all Implications.**

**Request:**
```json
{
  "projectPath": "/path/to/guest-project",
  "filter": {
    "platform": "web",
    "status": ["pending", "accepted"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "path": "PendingBooking-Web-UNIT.spec.js",
      "status": "created"
    },
    {
      "path": "AcceptBooking-Web-UNIT.spec.js",
      "status": "created"
    }
  ]
}
```

---

#### POST /api/generate/xstate-scenarios

**Generate test scenarios from state machine.**

**Request:**
```json
{
  "projectPath": "/path/to/guest-project",
  "type": "paths",  // or "states" or "events"
  "options": {
    "maxPaths": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "scenarios": [
    {
      "name": "Path: Created → Pending → Accepted",
      "steps": [
        { "state": "created", "event": "REQUEST", "action": "requestBooking" },
        { "state": "pending", "event": "ACCEPT", "action": "acceptBooking" }
      ]
    }
  ],
  "filePath": "tests/scenarios/booking-paths.spec.js"
}
```

---

#### POST /api/validation/check-readiness

**Check if test can run (TestPlanner).**

**Request:**
```json
{
  "projectPath": "/path/to/guest-project",
  "implName": "AcceptedBookingImplications",
  "testDataPath": "tests/data/shared.json"
}
```

**Response:**
```json
{
  "ready": false,
  "currentStatus": "Created",
  "targetStatus": "Accepted",
  "missing": [
    {
      "field": "requestedBy",
      "required": true,
      "current": null
    }
  ],
  "chain": [
    { "status": "Created", "complete": true },
    { "status": "Pending", "complete": false },
    { "status": "Accepted", "complete": false }
  ],
  "nextStep": {
    "status": "Pending",
    "actionName": "requestBooking",
    "testFile": "PendingBooking-Dancer-UNIT.spec.js",
    "platform": "dancer"
  },
  "stepsRemaining": 1
}
```

---

### Real-time Updates

**WebSocket for test execution:**

```javascript
// Client
const ws = new WebSocket('ws://localhost:3000/api/test-runner');

ws.send(JSON.stringify({
  action: 'run',
  testFile: 'AcceptBooking-Web-UNIT.spec.js',
  testDataPath: 'tests/data/shared.json'
}));

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'output') {
    console.log(data.text);  // Real-time test output
  }
  
  if (data.type === 'complete') {
    console.log('Test finished:', data.result);
  }
};
```

---

## 📝 File Generation

### Template System (Handlebars)

**Template file: `unit-test.hbs`**

```handlebars
// Auto-generated: {{testFileName}}
// Generated at: {{timestamp}}
// From: {{implClassName}}

const { test{{#if isPlaywright}}, expect{{/if}} } = require('{{testFramework}}');
const {{implClassName}} = require('./{{implClassName}}.js');
const TestContext = require('../../../../utils/TestContext.js');
const ExpectImplication = require('../../../../utils/ExpectImplication.js');

{{#if hasMultipleActions}}
// Multiple platform actions available:
{{#each triggeredBy}}
// - {{description}} ({{platform}})
{{/each}}
{{/if}}

test.describe('UNIT: {{statusLabel}}', () => {
  test.setTimeout(120000);
  
  let ctx, {{#if isPlaywright}}page, {{/if}}app;
  
  test.beforeAll(async ({{#if isPlaywright}}{ browser }{{/if}}) => {
    const testDataPath = process.env.TEST_DATA_PATH;
    ctx = TestContext.load({{implClassName}}, testDataPath);
    
    {{#if isPlaywright}}
    page = await browser.newPage();
    app = new App(page, 'en');
    {{else}}
    app = new App('en');
    {{/if}}
  });
  
  test('Execute transition: {{previousStatus}} → {{targetStatus}}', async () => {
    // Check prerequisites
    await ExpectImplication.validateSingleImplication(
      { parentClass: {{implClassName}} },
      ctx.data,
      app,
      { throwOnNotReady: true }
    );
    
    // Execute action
    const action = {{implClassName}}.triggeredBy[{{actionIndex}}].action;
    await action(testDataPath, { {{#if isPlaywright}}page{{/if}} });
    
    // Validate implications
    {{#each platforms}}
    await test.step('Validate {{name}} UI', async () => {
      for (const [screenName, implications] of Object.entries(
        {{../implClassName}}.mirrorsOn.UI.{{key}}
      )) {
        for (const implication of implications) {
          await ExpectImplication.validateSingleImplication(
            implication,
            ctx.data,
            app,
            { skipAnalysis: true }
          );
        }
      }
    });
    {{/each}}
  });
  
  test.afterAll(async () => {
    {{#if isPlaywright}}
    if (page) await page.close();
    {{/if}}
  });
});
```

**Data passed to template:**

```javascript
{
  testFileName: 'AcceptBooking-Web-UNIT.spec.js',
  timestamp: '2025-10-23T15:30:00Z',
  implClassName: 'AcceptedBookingImplications',
  statusLabel: 'Accepted',
  previousStatus: 'Pending',
  targetStatus: 'Accepted',
  isPlaywright: true,
  testFramework: '@playwright/test',
  hasMultipleActions: false,
  actionIndex: 0,
  triggeredBy: [
    { description: 'Accept booking via web', platform: 'web' }
  ],
  platforms: [
    { name: 'Dancer', key: 'dancer' },
    { name: 'Manager', key: 'clubApp' },
    { name: 'Web', key: 'web' }
  ]
}
```

---

### File Writing Strategy

**1. Check if file exists:**
```javascript
if (fs.existsSync(targetPath)) {
  // Backup existing file
  const backupPath = `${targetPath}.backup-${Date.now()}`;
  fs.copyFileSync(targetPath, backupPath);
}
```

**2. Write new file:**
```javascript
fs.writeFileSync(targetPath, generatedContent);
```

**3. Validate generated code:**
```javascript
try {
  require(targetPath);  // Try to load it
  console.log('✅ Generated file is valid JavaScript');
} catch (error) {
  console.error('❌ Generated file has syntax errors');
  // Restore backup
}
```

---

## 🔒 Security & Validation

### Input Validation

**All user inputs validated:**

```javascript
// API endpoint
app.post('/api/generate/unit-test', async (req, res) => {
  const schema = Joi.object({
    projectPath: Joi.string().required(),
    implName: Joi.string().pattern(/^[A-Z][a-zA-Z]*Implications$/).required(),
    options: Joi.object({
      platform: Joi.string().valid('web', 'dancer', 'manager'),
      preview: Joi.boolean()
    })
  });
  
  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  
  // Proceed with validated input
});
```

---

### Path Traversal Prevention

**Validate paths:**

```javascript
const path = require('path');

function validateProjectPath(userPath) {
  const resolved = path.resolve(userPath);
  const allowed = path.resolve(process.cwd(), 'projects');
  
  if (!resolved.startsWith(allowed)) {
    throw new Error('Path traversal detected');
  }
  
  return resolved;
}
```

---

### Code Injection Prevention

**Sanitize generated code:**

```javascript
function sanitizeImplicationName(name) {
  // Only allow valid JavaScript identifiers
  if (!/^[A-Z][a-zA-Z0-9]*Implications$/.test(name)) {
    throw new Error('Invalid Implication name');
  }
  return name;
}
```

---

### File System Safety

**Atomic writes:**

```javascript
const tmp = require('tmp');

async function safeWrite(targetPath, content) {
  // Write to temp file first
  const tmpFile = tmp.fileSync();
  fs.writeFileSync(tmpFile.name, content);
  
  // Validate
  try {
    require(tmpFile.name);
  } catch (error) {
    tmpFile.removeCallback();
    throw new Error('Generated code is invalid');
  }
  
  // Move to target (atomic)
  fs.renameSync(tmpFile.name, targetPath);
}
```

---

## 📊 Performance Considerations

### Caching Strategy

**Cache parsed Implications:**

```javascript
class ImplicationCache {
  static _cache = new Map();
  
  static get(filePath) {
    const mtime = fs.statSync(filePath).mtimeMs;
    const cached = this._cache.get(filePath);
    
    if (cached && cached.mtime === mtime) {
      return cached.data;  // Cache hit
    }
    
    // Cache miss - parse file
    const data = this._parse(filePath);
    this._cache.set(filePath, { mtime, data });
    return data;
  }
}
```

---

### Lazy Loading

**Load Implications on demand:**

```javascript
// Don't load all Implications at startup
class ImplicationRegistry {
  static _registry = new Map();
  
  static get(name) {
    if (!this._registry.has(name)) {
      const ImplClass = require(`./path/to/${name}.js`);
      this._registry.set(name, ImplClass);
    }
    return this._registry.get(name);
  }
}
```

---

### Parallel Generation

**Generate multiple tests in parallel:**

```javascript
const testPromises = implications.map(async (impl) => {
  return await generateUnitTest(impl);
});

const results = await Promise.all(testPromises);
```

---

## 🎯 Summary

### What Makes This Architecture Special

1. **Declarative** - Define once in Implications, use everywhere
2. **Type-Safe** - Validation at every step
3. **Platform-Aware** - Respects Appium/Playwright boundaries
4. **XState-Powered** - Formal state machine modeling
5. **Auto-Generated** - Minimal manual test writing
6. **Self-Documenting** - Code is the documentation
7. **Change-Tracked** - Full test data history
8. **Readiness-Checked** - TestPlanner prevents failures

### Key Innovation

**The Implications file is the single source of truth for:**
- State machine definition (XState)
- UI validation rules (ExpectImplication)
- Test generation metadata (Generator)
- Data requirements (TestContext)
- Prerequisites (TestPlanner)

**This enables:**
- Fast test writing (90% less code)
- Consistent patterns (generated from templates)
- Comprehensive coverage (all platforms validated)
- Clear dependencies (TestPlanner shows path)
- Maintainable tests (change once, update everywhere)

---

**Next Steps:**
- Read PHASE-1-PLAN.md for simple overview
- Read SYSTEM-OVERVIEW.md for complete picture
- Read COMPONENT-GUIDE.md for detailed explanations

**Version:** 2.0  
**Status:** Ready to Build  
**License:** Proprietary

---

*Architecture designed and documented: October 23, 2025*