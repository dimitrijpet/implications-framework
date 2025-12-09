# 🎯 Implications Framework - Complete Documentation

**Version:** 1.0.0  
**Status:** MVP Working  
**Last Updated:** October 26, 2025

---

## 📋 Table of Contents

1. [What Is This?](#what-is-this)
2. [Quick Start (5 Minutes)](#quick-start-5-minutes)
3. [System Architecture](#system-architecture)
4. [Core Concepts](#core-concepts)
5. [API Reference](#api-reference)
6. [CLI Reference](#cli-reference)
7. [Template System](#template-system)
8. [Discovery Engine](#discovery-engine)
9. [Troubleshooting](#troubleshooting)
10. [Roadmap](#roadmap)

---

## What Is This?

A **code generation framework** that creates implications-based tests for ANY project.

### Key Features

✅ **Universal** - Works with any JavaScript/TypeScript project  
✅ **Pattern-Aware** - Learns YOUR coding style  
✅ **Template-Driven** - Generates code via Handlebars  
✅ **Smart Imports** - Calculates relative paths automatically  
✅ **UI Validation** - Auto-generates ExpectImplication calls  
✅ **Multi-Platform** - Web, Mobile, CMS support  

### What It Does

```
Your Implication Class → Framework → Generated UNIT Test
```

**Input:**
```javascript
class AcceptedBookingImplications {
  static xstateConfig = {
    meta: { status: "Accepted" },
    entry: assign({ status: "Accepted", acceptedAt: ... }),
  };
  static mirrorsOn = {
    UI: { web: { screen: [{ visible: [...], hidden: [...] }] } }
  };
}
```

**Output:**
```javascript
const accept = async (testDataPath, options) => {
  const ctx = TestContext.load(AcceptedBookingImplications, testDataPath);
  TestPlanner.checkOrThrow(AcceptedBookingImplications, ctx.data);
  
  // TODO: Your action logic here
  
  return ctx.executeAndSave('Accepted State', 'Accept-Web-UNIT.spec.js', 
    async () => ({ delta: { status: 'Accepted', acceptedAt: now } })
  );
};

// + UI validation test step
// + Exports for prerequisites
// + Correct imports and paths
```

---

## Quick Start (5 Minutes)

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- An existing project with implications

### Installation

```bash
# Clone the framework
git clone https://github.com/your-org/implications-framework.git
cd implications-framework

# Install dependencies
pnpm install

# Start API server
cd packages/api-server
npm run dev

# In another terminal, start web UI
cd packages/web-app
npm run dev
```

### Generate Your First Test

#### Option 1: Web UI (Easiest)

1. Open http://localhost:5173
2. Click "Scan Project"
3. Select your project directory
4. Choose an implication from the list
5. Select platform (web/mobile)
6. Click "Generate Test" 
7. ✅ Done! Test created in same directory as implication

#### Option 2: CLI

```bash
cd packages/cli

node src/cli.js \
  /path/to/AcceptedBookingImplications.js \
  --platform web
```

#### Option 3: API

```bash
curl -X POST http://localhost:3000/api/generate/unit-test \
  -H "Content-Type: application/json" \
  -d '{
    "implPath": "/path/to/AcceptedBookingImplications.js",
    "platform": "web"
  }'
```

### Verify It Works

Check that the test file was created:
```bash
# Should see: Accept-Web-UNIT.spec.js (or similar)
ls /path/to/your/implications/directory/
```

The generated test will have:
- ✅ Correct imports with relative paths
- ✅ Exported function (e.g., `accept`)
- ✅ Delta fields from `entry: assign`
- ✅ UI validation if `mirrorsOn.UI` exists
- ✅ Test registration with test.describe

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                     USER INTERFACES                      │
├──────────────┬──────────────────┬──────────────────────┤
│   Web UI     │   CLI Tool       │   API Direct         │
│  (React)     │  (Commander)     │   (Curl/Postman)     │
└──────┬───────┴────────┬─────────┴──────────┬───────────┘
       │                │                     │
       └────────────────┴─────────────────────┘
                        │
              ┌─────────▼──────────┐
              │   API Server       │
              │   (Express)        │
              └─────────┬──────────┘
                        │
       ┌────────────────┼────────────────┐
       │                │                │
┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
│  Discovery  │  │  Generator  │  │  Templates │
│  Service    │  │  Service    │  │  (HBS)     │
└─────────────┘  └─────────────┘  └────────────┘
       │                │                │
       └────────────────┴────────────────┘
                        │
              ┌─────────▼──────────┐
              │   GUEST PROJECT    │
              │   (Your Code)      │
              └────────────────────┘
```

### Package Structure

```
implications-framework/
├── packages/
│   ├── web-app/           # React UI (Vite + Tailwind)
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── services/    # API client
│   │   │   └── App.jsx      # Main app
│   │   └── package.json
│   │
│   ├── api-server/        # Express API
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   │   ├── discovery.js
│   │   │   │   ├── generate.js
│   │   │   │   └── patterns.js
│   │   │   └── index.js     # Server entry
│   │   └── package.json
│   │
│   ├── cli/               # Command-line tool
│   │   ├── src/
│   │   │   └── cli.js       # Commander.js CLI
│   │   └── package.json
│   │
│   └── core/              # Shared core logic
│       ├── src/
│       │   ├── generators/
│       │   │   ├── UnitTestGenerator.js
│       │   │   ├── TemplateEngine.js
│       │   │   └── templates/
│       │   │       └── unit-test.hbs
│       │   └── discovery/
│       │       └── discoveryService.js
│       └── package.json
│
├── examples/              # Example projects
│   ├── booking-system/
│   └── cms-system/
│
└── docs/                  # Documentation
    ├── API.md
    └── ARCHITECTURE.md
```

### Technology Stack

**Frontend:**
- React 18
- Vite (build tool)
- Tailwind CSS (styling)
- Cytoscape.js (state machine visualization)
- Axios (API calls)

**Backend:**
- Express.js (API server)
- Babel Parser (AST parsing)
- Handlebars (templating)

**CLI:**
- Commander.js (CLI framework)
- Inquirer.js (interactive prompts)

**Core:**
- XState v5 (state machine definitions)
- Joi/Zod (validation)
- Playwright (test framework target)

---

## Core Concepts

### 1. Implications

**What:** Classes that define state transitions and their UI implications

**Example:**
```javascript
class AcceptedBookingImplications {
  static xstateConfig = {
    meta: {
      status: "Accepted",
      requires: { previousStatus: "pending" }
    },
    entry: assign({
      status: "Accepted",
      acceptedAt: ({ event }) => event.acceptedAt
    })
  };
  
  static mirrorsOn = {
    UI: {
      web: {
        manageRequestingEntertainers: [{
          visible: ['btnUndo', 'btnCheckIn'],
          hidden: ['btnAccept', 'btnReject']
        }]
      }
    }
  };
}
```

**Key Parts:**
- `xstateConfig` - State machine definition (XState v5 format)
- `meta` - Metadata (status, requirements, buttons)
- `entry` - Delta updates when entering state
- `mirrorsOn` - UI implications (what's visible/hidden)

### 2. Two-Mode Operation

#### Simple Mode (CMS)
- **Pattern:** Draft → Published
- **Stateless:** No changeLog
- **Scenarios:** MINIMAL, ROMANTIC, etc.
- **Example:** StayCardsSection

```javascript
class StayCardsSection extends EnhancedBaseSection {
  static SCENARIOS = { 
    MINIMAL: { exactCount: 1 },
    ROMANTIC: { theme: 'romantic' }
  };
}
```

#### Complex Mode (Booking)
- **Pattern:** Multi-state (pending → accepted → checkedIn → checkedOut)
- **Stateful:** Uses TestContext.load() + changeLog
- **Prerequisites:** States depend on previous states
- **Example:** AcceptedBookingImplications

### 3. TestContext

**What:** Manages test data and state transitions

**Stateful Usage (Booking):**
```javascript
// Load existing state
const ctx = TestContext.load(AcceptedBookingImplications, 'data.json');

// Perform action
// ... do something ...

// Save with delta
return ctx.executeAndSave('Accepted State', 'test.spec.js', 
  async () => ({ delta: { status: 'Accepted' } })
);
```

**Stateless Usage (CMS):**
```javascript
// Create fresh data
const testData = AcceptedImplication.createTestData({ scenario: 'ROMANTIC' });
const ctx = new TestContext(testData);
```

### 4. ExpectImplication

**What:** Validates UI state automatically

**Usage:**
```javascript
await ExpectImplication.validateImplications(
  AcceptedBookingImplications.mirrorsOn.UI.web.manageRequestingEntertainers,
  testData,
  page
);
```

**What It Does:**
- Runs prerequisites (navigation)
- Checks visible elements are visible
- Checks hidden elements are hidden
- Runs custom expect functions

### 5. Templates

**What:** Handlebars templates that generate code

**Example Template:**
```handlebars
const { test, expect } = require('@playwright/test');
const TestContext = require('{{testContextPath}}');
const {{implClassName}} = require('./{{implClassName}}.js');

{{#if hasUIValidation}}
const ExpectImplication = require('{{testContextPath}}'.replace('/TestContext', '/ExpectImplication'));
{{/if}}

const {{actionName}} = async (testDataPath, options = {}) => {
  const ctx = TestContext.load({{implClassName}}, testDataPath);
  
  // ... generated code ...
  
  return ctx.executeAndSave('{{targetStatus}} State', '{{testFileName}}',
    async () => {
      const delta = {};
      {{#each deltaFields}}
      delta['{{field}}'] = {{value}};
      {{/each}}
      return { delta };
    }
  );
};

{{#if hasUIValidation}}
await test.step('Validate {{targetStatus}} State UI', async () => {
  {{#each validationScreens}}
  await ExpectImplication.validateImplications(
    {{../implClassName}}.mirrorsOn.UI.{{../platform}}.{{screenKey}},
    ctx.data,
    page
  );
  {{/each}}
});
{{/if}}

module.exports = { {{actionName}} };
```

---

## API Reference

### Base URL
```
http://localhost:3000/api
```

### Endpoints

#### POST /generate/unit-test

Generate a UNIT test from an Implication file.

**Request:**
```json
{
  "implPath": "/path/to/AcceptedBookingImplications.js",
  "platform": "web",
  "state": null
}
```

**Parameters:**
- `implPath` (string, required) - Path to implication file
- `platform` (string, optional) - Platform: 'web', 'cms', 'dancer', 'manager'. Default: 'web'
- `state` (string, optional) - Target state for multi-state machines. Generates all states if null

**Response:**
```json
{
  "success": true,
  "count": 1,
  "tests": [
    {
      "fileName": "Accept-Web-UNIT.spec.js",
      "filePath": "/path/to/Accept-Web-UNIT.spec.js",
      "size": 4521,
      "state": null
    }
  ]
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/generate/unit-test \
  -H "Content-Type: application/json" \
  -d '{
    "implPath": "/home/user/project/AcceptedBookingImplications.js",
    "platform": "web"
  }'
```

---

#### POST /discovery/scan

Scan a project and discover implications, sections, screens.

**Request:**
```json
{
  "projectPath": "/path/to/project",
  "options": {
    "deep": true,
    "cache": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "implications": [...],
  "sections": [...],
  "screens": [...],
  "projectType": "booking",
  "transitions": 11
}
```

---

#### GET /patterns/analyze

Analyze patterns across all implications.

**Query Params:**
- `projectPath` (string, required)

**Response:**
```json
{
  "states": 25,
  "buttons": 5,
  "fields": 7,
  "buttonPatterns": {
    "convention": "SINGLE_VERB",
    "confidence": "1.00"
  }
}
```

---

#### GET /implications/context-schema

Extract context fields from an implication.

**Query Params:**
- `filePath` (string, required)

**Response:**
```json
{
  "fields": [
    { "name": "status", "type": "string", "required": true },
    { "name": "acceptedAt", "type": "date", "required": false }
  ]
}
```

---

## CLI Reference

### Basic Usage

```bash
node packages/cli/src/cli.js <implication-path> [options]
```

### Options

- `--platform <platform>` - Target platform (web, dancer, manager, cms)
- `--state <state>` - Target state for multi-state machines
- `--preview` - Preview without writing files
- `--output <dir>` - Output directory (default: same as implication)

### Examples

**Generate test for web platform:**
```bash
node cli.js ~/project/AcceptedBookingImplications.js --platform web
```

**Generate for specific state:**
```bash
node cli.js ~/project/BookingImplications.js --state accepted --platform web
```

**Preview without writing:**
```bash
node cli.js ~/project/AcceptedBookingImplications.js --preview
```

---

## Template System

### Template Engine

The framework uses Handlebars with **31 custom helpers**.

### Available Helpers

**String Helpers:**
- `camelCase` - Convert to camelCase
- `pascalCase` - Convert to PascalCase
- `kebabCase` - Convert to kebab-case
- `uppercase` - Convert to UPPERCASE
- `lowercase` - Convert to lowercase

**Logic Helpers:**
- `eq` - Equal comparison
- `ne` - Not equal comparison
- `gt` - Greater than
- `lt` - Less than
- `and` - Logical AND
- `or` - Logical OR

**Array Helpers:**
- `join` - Join array with separator
- `length` - Get array length
- `first` - Get first element
- `last` - Get last element

**Object Helpers:**
- `keys` - Get object keys
- `values` - Get object values
- `stringify` - JSON.stringify

### Template Location

Templates are in: `packages/core/src/generators/templates/`

**Current Templates:**
- `unit-test.hbs` - UNIT test generation

### Creating Custom Templates

1. Create `.hbs` file in templates directory
2. Use Handlebars syntax with helpers
3. Register in TemplateEngine.js
4. Use in generator

**Example:**
```handlebars
// my-template.hbs
{{#if hasFeature}}
const {{featureName}} = require('{{featurePath}}');
{{/if}}

const {{camelCase actionName}} = async () => {
  {{#each items}}
  console.log('{{this}}');
  {{/each}}
};

module.exports = { {{camelCase actionName}} };
```

---

## Discovery Engine

### What It Does

Scans your project to find:
- Implication classes
- Section classes
- Screen objects
- Test patterns
- Architecture type (simple vs complex)

### How It Works

```javascript
const discovery = await discoveryService.scanProject({
  projectPath: '/path/to/project',
  options: { deep: true, cache: true }
});
```

**Output:**
```javascript
{
  implications: [
    {
      name: 'AcceptedBookingImplications',
      path: '/path/to/AcceptedBookingImplications.js',
      status: 'Accepted',
      platform: ['web', 'manager'],
      hasUI: true,
      uiScreens: ['manageRequestingEntertainers']
    }
  ],
  screens: [...],
  projectType: 'booking',
  architecture: {
    hasTestContext: true,
    hasExpectImplication: true,
    hasTestPlanner: true
  }
}
```

### Pattern Detection

The discovery engine detects:

**Button Patterns:**
- SINGLE_VERB: 'ACCEPT', 'REJECT'
- VERB_NOUN: 'ACCEPT_BOOKING'
- ACTION_PHRASE: 'Mark as Complete'

**Field Patterns:**
- Required vs optional
- Context fields vs data fields
- Common field names

**Architecture Patterns:**
- Stateful (uses TestContext.load)
- Stateless (uses createTestData)
- Hybrid (supports both)

---

## Troubleshooting

### Issue: Template Not Found

**Error:**
```
Template not found: /path/to/templates/unit-test.hbs
```

**Solution:**
1. Check templates are in `packages/core/src/generators/templates/`
2. File must be named exactly `unit-test.hbs`
3. Run from correct directory

---

### Issue: Wrong Import Paths

**Error:**
```javascript
const TestContext = require('../../../../wrong/path');
```

**Solution:**
The generator auto-calculates paths from the implication file location. If wrong:
1. Check your project structure matches expectations
2. Implication should be in a subdirectory (not root)
3. TestContext should be in `ai-testing/utils/` or similar

---

### Issue: UI Validation Not Generated

**Symptom:**
Test generated but no ExpectImplication calls

**Debug:**
Check console output for:
```
🔍 Extracting UI validation for platform: web
📝 Platform key: web → web
⚠️  No mirrorsOn.UI found
```

**Causes:**
1. No `mirrorsOn.UI` in implication
2. Platform mismatch (looking for 'web' but only 'dancer' exists)
3. No `visible` or `hidden` arrays in screen definitions
4. Arrays nested inside `checks` object (now handled automatically)

**Solution:**
Add mirrorsOn to your implication:
```javascript
static mirrorsOn = {
  UI: {
    web: {
      screenName: [{
        visible: ['btn1', 'btn2'],
        hidden: ['btn3']
      }]
    }
  }
}
```

---

### Issue: File Created in Wrong Location

**Symptom:**
Test created in project root instead of implication directory

**Cause:**
Old API route passing `outputDir` to generator

**Solution:**
Make sure your `generate.js` route does NOT pass `outputDir`:
```javascript
// ✅ Correct
const generator = new UnitTestGenerator({});

// ❌ Wrong
const generator = new UnitTestGenerator({
  outputDir: projectRoot  // Don't do this!
});
```

The generator auto-detects output directory from implication file path.

---

### Issue: Delta Fields Not Extracted

**Symptom:**
Generated test has empty delta object

**Debug:**
Check that `entry: assign` exists in xstateConfig:
```javascript
entry: assign({
  status: "Accepted",
  acceptedAt: ({ event }) => event.acceptedAt
})
```

**Note:**
- Only static values are extracted (e.g., `status: "Accepted"`)
- Functions are converted to `options.fieldName || now`
- Complex logic shows as TODO

---

## Roadmap

### Phase 1: Foundation ✅ DONE
- [x] Monorepo structure
- [x] Basic packages (web-app, api-server, cli, core)
- [x] Package.json for each
- [x] Development tooling

### Phase 2: Discovery ✅ DONE
- [x] Scan guest projects
- [x] Extract implications
- [x] Extract sections
- [x] Extract screens
- [x] Pattern analysis
- [x] Architecture detection

### Phase 3: Templates ✅ DONE
- [x] Handlebars engine
- [x] Custom helpers (31 helpers)
- [x] Unit test template
- [x] Template preview

### Phase 4: Generation ✅ DONE
- [x] UnitTestGenerator
- [x] Smart import paths
- [x] Delta extraction
- [x] UI validation extraction
- [x] Output path detection
- [x] Multi-state support

### Phase 5: Visualization 🚧 IN PROGRESS
- [ ] State machine viewer (Cytoscape.js)
- [ ] Interactive implication builder
- [ ] Drag-drop state editing
- [ ] Visual UI mapping

### Phase 6: Test Management
- [ ] Test runner integration
- [ ] Live test output (WebSocket)
- [ ] TestPlanner integration
- [ ] Test execution dashboard

### Phase 7: Advanced Features
- [ ] Generate implications from UI
- [ ] Auto-detect visible/hidden elements
- [ ] Screen object generation
- [ ] Multi-platform test generation (web + mobile)
- [ ] Test suite orchestration

### Phase 8: Polish
- [ ] Production build optimization
- [ ] Docker support
- [ ] CI/CD integration
- [ ] Comprehensive documentation
- [ ] Video tutorials
- [ ] Example projects

---

## Contributing

### Development Setup

```bash
# Clone repo
git clone https://github.com/your-org/implications-framework.git
cd implications-framework

# Install dependencies
pnpm install

# Start all services
pnpm run dev  # Starts API + Web UI + CLI watch
```

### Testing

```bash
# Run unit tests
pnpm test

# Run e2e tests
pnpm test:e2e

# Test generation on example project
cd examples/booking-system
node ../../packages/cli/src/cli.js ./AcceptedBookingImplications.js
```

### Making Changes

1. Create feature branch
2. Make changes
3. Test with example projects
4. Submit PR

---

## License

MIT

---

## Support

- **Issues:** https://github.com/your-org/implications-framework/issues
- **Discussions:** https://github.com/your-org/implications-framework/discussions
- **Email:** support@implications-framework.io

---

**🎉 You're ready to generate tests!** Start with the Quick Start guide above.
