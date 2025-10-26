# 🏗️ System Architecture - Implications Framework

**Deep Dive into How Everything Works**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Flow](#data-flow)
3. [Component Details](#component-details)
4. [Generation Pipeline](#generation-pipeline)
5. [Template System](#template-system)
6. [Discovery Process](#discovery-process)
7. [Path Resolution](#path-resolution)
8. [UI Validation Extraction](#ui-validation-extraction)

---

## System Overview

### The Big Picture

```
┌──────────────────────────────────────────────────────────────┐
│                         USER LAYER                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Web UI  │  │   CLI    │  │  Direct  │  │  CI/CD   │    │
│  │ (React)  │  │ (NodeJS) │  │   API    │  │ Pipeline │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
        ┌─────────────▼──────────────┐
        │      API SERVER            │
        │      (Express)             │
        │                            │
        │  Routes:                   │
        │  • /generate/unit-test     │
        │  • /discovery/scan         │
        │  • /patterns/analyze       │
        │  • /implications/context   │
        └─────────────┬──────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
   ┌────▼─────┐            ┌─────▼──────┐
   │ Discovery│            │ Generation │
   │ Service  │            │  Service   │
   │          │            │            │
   │ • Scan   │            │ • Context  │
   │ • Parse  │            │ • Render   │
   │ • Analyze│            │ • Write    │
   └────┬─────┘            └─────┬──────┘
        │                        │
        │    ┌───────────────────┘
        │    │
   ┌────▼────▼─────┐
   │  GUEST PROJECT │
   │                │
   │  • Implications│
   │  • Sections    │
   │  • Screens     │
   │  • Tests       │
   └────────────────┘
```

---

## Data Flow

### Generation Request Flow

```
1. USER INPUT
   ↓
   {
     implPath: "/path/to/AcceptedBookingImplications.js",
     platform: "web"
   }

2. API ROUTE (/generate/unit-test)
   ↓
   • Validate params
   • Create UnitTestGenerator
   • Call generator.generate()

3. UNIT TEST GENERATOR
   ↓
   • Load implication class (dynamic require)
   • Extract metadata from xstateConfig
   • Build template context
   • Calculate import paths

4. METADATA EXTRACTION
   ↓
   {
     className: "AcceptedBookingImplications",
     status: "Accepted",
     previousStatus: "pending",
     entry: assign({ ... }),
     mirrorsOn: { UI: { ... } },
     triggeredBy: [...]
   }

5. CONTEXT BUILDING
   ↓
   {
     implClassName: "AcceptedBookingImplications",
     platform: "web",
     targetStatus: "Accepted",
     testContextPath: "../../../ai-testing/utils/TestContext",
     hasUIValidation: true,
     validationScreens: [{
       screenKey: "manageRequestingEntertainers",
       visible: 3,
       hidden: 9
     }],
     deltaFields: [
       { field: "status", value: "'Accepted'" },
       { field: "acceptedAt", value: "options.acceptedAt || now" }
     ]
   }

6. TEMPLATE ENGINE
   ↓
   • Load unit-test.hbs
   • Register 31 helpers
   • Render with context
   • Return generated code

7. FILE WRITER
   ↓
   • Auto-detect output dir: path.dirname(implPath)
   • Generate filename: Accept-Web-UNIT.spec.js
   • Write file
   • Return result

8. API RESPONSE
   ↓
   {
     success: true,
     tests: [{
       fileName: "Accept-Web-UNIT.spec.js",
       filePath: "/full/path/to/Accept-Web-UNIT.spec.js",
       size: 4521
     }]
   }
```

---

## Component Details

### UnitTestGenerator

**Location:** `packages/core/src/generators/UnitTestGenerator.js`

**Responsibilities:**
1. Load implication class dynamically
2. Extract metadata from xstateConfig
3. Build template context
4. Calculate smart import paths
5. Extract delta fields from entry: assign
6. Extract UI validation screens
7. Render template
8. Write file to correct location

**Key Methods:**

```javascript
class UnitTestGenerator {
  // Main entry point
  generate(implFilePath, options) {
    // 1. Load implication
    const ImplClass = this._loadImplication(implFilePath);
    
    // 2. Check if multi-state
    const isMultiState = this._isMultiStateMachine(ImplClass);
    
    // 3. Generate single or multiple
    if (isMultiState && !state) {
      return this._generateMultiState(...);
    } else {
      return this._generateSingleState(...);
    }
  }
  
  // Extract metadata
  _extractMetadata(ImplClass, stateName) {
    const xstate = ImplClass.xstateConfig;
    const stateConfig = stateName ? xstate.states[stateName] : xstate;
    
    return {
      className: ImplClass.name,
      status: stateConfig.meta.status,
      entry: stateConfig.entry,
      mirrorsOn: ImplClass.mirrorsOn,
      triggeredBy: ImplClass.triggeredBy
    };
  }
  
  // Build template context
  _buildContext(metadata, platform) {
    // Extract delta fields
    const deltaFields = this._extractDeltaFields(metadata.entry);
    
    // Extract UI validation
    const uiValidation = this._extractUIValidation(metadata, platform);
    
    // Calculate paths
    const paths = this._calculateImportPaths();
    
    return {
      implClassName: metadata.className,
      platform,
      targetStatus: metadata.status,
      testContextPath: paths.testContext,
      hasUIValidation: uiValidation.hasValidation,
      validationScreens: uiValidation.screens,
      deltaFields,
      // ... more fields
    };
  }
  
  // Extract delta fields from entry: assign
  _extractDeltaFields(entry, targetStatus) {
    if (!entry || typeof entry !== 'object') return [];
    
    const fields = [];
    
    for (const [key, value] of Object.entries(entry)) {
      if (typeof value === 'function') {
        // Function: convert to options.key || default
        fields.push({
          field: key,
          value: `options.${key} || now`,
          isFunction: true
        });
      } else {
        // Static: use value directly
        fields.push({
          field: key,
          value: JSON.stringify(value),
          isFunction: false
        });
      }
    }
    
    return fields;
  }
  
  // Extract UI validation screens
  _extractUIValidation(metadata, platform) {
    const result = { hasValidation: false, screens: [] };
    
    const mirrorsOn = metadata.mirrorsOn;
    if (!mirrorsOn?.UI) return result;
    
    // Get platform key (web → web, mobile-dancer → dancer)
    const platformKey = this._getPlatformKeyForMirrorsOn(platform);
    const platformUI = mirrorsOn.UI[platformKey];
    if (!platformUI) return result;
    
    // Extract screens
    for (const [screenKey, screenDefs] of Object.entries(platformUI)) {
      if (!Array.isArray(screenDefs)) continue;
      
      const screenDef = screenDefs[0];
      
      // Check multiple locations (direct, checks, override)
      const visible = screenDef.visible || 
                      screenDef.checks?.visible || 
                      [];
      const hidden = screenDef.hidden || 
                     screenDef.checks?.hidden || 
                     [];
      
      if (visible.length > 0 || hidden.length > 0) {
        result.screens.push({
          screenKey,
          visible: visible.length,
          hidden: hidden.length
        });
      }
    }
    
    result.hasValidation = result.screens.length > 0;
    return result;
  }
}
```

---

### TemplateEngine

**Location:** `packages/core/src/generators/TemplateEngine.js`

**Responsibilities:**
1. Load Handlebars templates
2. Register custom helpers
3. Render templates with context

**Custom Helpers (31 total):**

```javascript
// String helpers
camelCase     // myVariableName
pascalCase    // MyClassName
kebabCase     // my-file-name
snakeCase     // my_constant_name
uppercase     // MYCONST
lowercase     // myvar

// Logic helpers
eq            // {{ eq a b }}
ne            // {{ ne a b }}
gt            // {{ gt a 5 }}
lt            // {{ lt a 10 }}
and           // {{ and condition1 condition2 }}
or            // {{ or condition1 condition2 }}
not           // {{ not condition }}

// Array helpers
join          // {{ join array ", " }}
length        // {{ length array }}
first         // {{ first array }}
last          // {{ last array }}
slice         // {{ slice array 0 5 }}
includes      // {{ includes array "item" }}

// Object helpers
keys          // {{ keys object }}
values        // {{ values object }}
stringify     // {{ stringify object }}
get           // {{ get object "path.to.key" }}

// Date helpers
formatDate    // {{ formatDate date "YYYY-MM-DD" }}
now           // {{ now }}

// Utility helpers
default       // {{ default value "fallback" }}
json          // {{ json object }}
indent        // {{ indent text 2 }}
```

---

### Discovery Service

**Location:** `packages/core/src/discovery/discoveryService.js`

**Responsibilities:**
1. Scan project directories
2. Find implication files
3. Parse AST with Babel
4. Extract metadata
5. Analyze patterns
6. Cache results

**Process:**

```javascript
async scanProject(projectPath, options) {
  // 1. Find files
  const files = await this._findFiles(projectPath, {
    patterns: ['*Implications.js', '*Section.js', '*Screen.js']
  });
  
  // 2. Parse each file
  const implications = [];
  for (const file of files) {
    const ast = parser.parse(fs.readFileSync(file, 'utf8'));
    const metadata = this._extractFromAST(ast);
    implications.push({ file, ...metadata });
  }
  
  // 3. Analyze patterns
  const patterns = this._analyzePatterns(implications);
  
  // 4. Cache results
  await this._cache.set(projectPath, { implications, patterns });
  
  return { implications, patterns };
}
```

---

## Generation Pipeline

### Step-by-Step Process

**Step 1: Load Implication**
```javascript
// Dynamic require based on file path
process.chdir(projectRoot);
const ImplClass = require(implFilePath);
```

**Step 2: Extract Metadata**
```javascript
const metadata = {
  className: ImplClass.name,
  status: ImplClass.xstateConfig.meta.status,
  entry: ImplClass.xstateConfig.entry,
  mirrorsOn: ImplClass.mirrorsOn,
  triggeredBy: ImplClass.triggeredBy
};
```

**Step 3: Calculate Paths**
```javascript
// From: /project/tests/implications/bookings/status/Accepted.js
// To:   /project/ai-testing/utils/TestContext.js

const implDir = path.dirname(implFilePath);
const projectRoot = this._findProjectRoot(implDir);
const utilsDir = path.join(projectRoot, 'ai-testing/utils');

const relativePath = path.relative(implDir, utilsDir);
// Result: "../../../ai-testing/utils/TestContext"
```

**Step 4: Build Context**
```javascript
const context = {
  // Header
  timestamp: new Date().toISOString(),
  implClassName: "AcceptedBookingImplications",
  platform: "web",
  targetStatus: "Accepted",
  
  // Paths
  testContextPath: "../../../ai-testing/utils/TestContext",
  testPlannerPath: "../../../ai-testing/utils/TestPlanner",
  
  // Function
  actionName: "accept",
  actionDescription: "Transition to Accepted state",
  
  // Delta
  deltaFields: [
    { field: "status", value: "'Accepted'" },
    { field: "acceptedAt", value: "options.acceptedAt || now" }
  ],
  
  // UI Validation
  hasUIValidation: true,
  validationScreens: [{
    screenKey: "manageRequestingEntertainers",
    visible: 3,
    hidden: 9
  }]
};
```

**Step 5: Render Template**
```javascript
const engine = new TemplateEngine();
const code = engine.render('unit-test.hbs', context);
```

**Step 6: Write File**
```javascript
const outputDir = path.dirname(implFilePath);
const fileName = "Accept-Web-UNIT.spec.js";
const filePath = path.join(outputDir, fileName);

fs.writeFileSync(filePath, code);
```

---

## Template System

### Template Structure

```handlebars
{{! Header }}
// Generated at: {{timestamp}}
// From: {{implClassName}}

{{! Imports }}
const { test, expect } = require('@playwright/test');
const TestContext = require('{{testContextPath}}');

{{#if hasUIValidation}}
const ExpectImplication = require('{{testContextPath}}'.replace('/TestContext', '/ExpectImplication'));
{{/if}}

{{! Exported Function }}
const {{actionName}} = async (testDataPath, options = {}) => {
  const ctx = TestContext.load({{implClassName}}, testDataPath);
  
  {{! Prerequisites }}
  TestPlanner.checkOrThrow({{implClassName}}, ctx.data);
  
  {{! Action placeholder }}
  // TODO: Implement action
  
  {{! Save with delta }}
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

{{! Test Registration }}
test.describe("UNIT: {{testDescription}}", () => {
  test("Execute {{actionName}}", async ({ page }) => {
    await {{actionName}}(testDataPath, { page });
    
    {{#if hasUIValidation}}
    {{! UI Validation }}
    await test.step('Validate {{targetStatus}} State UI', async () => {
      const ctx = TestContext.load({{implClassName}}, testDataPath);
      
      {{#each validationScreens}}
      await ExpectImplication.validateImplications(
        {{../implClassName}}.mirrorsOn.UI.{{../platform}}.{{screenKey}},
        ctx.data,
        page
      );
      {{/each}}
    });
    {{/if}}
  });
});

{{! Exports }}
module.exports = { {{actionName}} };
```

---

## Path Resolution

### Smart Path Calculation

**Problem:** Generated test needs to import from utils directory, but location varies.

**Solution:** Calculate relative path from implication to utils.

**Algorithm:**
```javascript
calculateImportPaths() {
  // 1. Get implication directory
  const implDir = path.dirname(implFilePath);
  // /project/tests/implications/bookings/status
  
  // 2. Find project root
  const projectRoot = this._findProjectRoot(implDir);
  // /project
  
  // 3. Find utils directory
  const utilsDir = path.join(projectRoot, 'ai-testing/utils');
  // /project/ai-testing/utils
  
  // 4. Calculate relative path
  const relative = path.relative(implDir, utilsDir);
  // ../../../ai-testing/utils
  
  // 5. Build import paths
  return {
    testContext: path.join(relative, 'TestContext'),
    testPlanner: path.join(relative, 'TestPlanner'),
    expectImplication: path.join(relative, 'ExpectImplication')
  };
}
```

**Finding Project Root:**
```javascript
_findProjectRoot(startDir) {
  let currentDir = startDir;
  
  while (currentDir !== '/') {
    // Check for markers
    if (fs.existsSync(path.join(currentDir, 'package.json')) ||
        fs.existsSync(path.join(currentDir, '.git')) ||
        fs.existsSync(path.join(currentDir, 'ai-testing'))) {
      return currentDir;
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  throw new Error('Could not find project root');
}
```

---

## UI Validation Extraction

### Multi-Level Search

UI elements can be nested in different structures depending on how `ImplicationHelper.mergeWithBase()` works.

**Possible Structures:**

```javascript
// Structure 1: Direct
{
  visible: ['btn1', 'btn2'],
  hidden: ['btn3']
}

// Structure 2: Inside checks
{
  checks: {
    visible: ['btn1', 'btn2'],
    hidden: ['btn3']
  }
}

// Structure 3: Inside override
{
  override: {
    visible: ['btn1', 'btn2'],
    hidden: ['btn3']
  }
}
```

**Extraction Logic:**
```javascript
_extractUIValidation(metadata, platform) {
  const screenDef = screenDefs[0];
  
  // Check all possible locations
  const visible = screenDef.visible ||           // Direct
                  screenDef.checks?.visible ||   // In checks
                  screenDef.override?.visible || // In override
                  [];
  
  const hidden = screenDef.hidden ||
                 screenDef.checks?.hidden ||
                 screenDef.override?.hidden ||
                 [];
  
  // Ensure arrays
  if (!Array.isArray(visible)) visible = [];
  if (!Array.isArray(hidden)) hidden = [];
  
  // Only add if has elements
  if (visible.length > 0 || hidden.length > 0) {
    result.screens.push({
      screenKey,
      visible: visible.length,
      hidden: hidden.length
    });
  }
}
```

---

## Platform Mapping

### Platform Keys

Different platforms map to different mirrorsOn.UI keys:

```javascript
_getPlatformKeyForMirrorsOn(platform) {
  const mapping = {
    'web': 'web',                      // Direct match
    'cms': 'cms',                      // Direct match
    'mobile-dancer': 'dancer',         // Shortened
    'mobile-manager': 'clubApp'        // Different name
  };
  
  return mapping[platform] || platform;
}
```

**Why?** The UI implications use shortened keys:
```javascript
mirrorsOn: {
  UI: {
    dancer: { ... },     // Not 'mobile-dancer'
    clubApp: { ... },    // Not 'mobile-manager'
    web: { ... }         // Direct match
  }
}
```

---

## Error Handling

### Common Errors and Solutions

**Error: Cannot find module**
```javascript
try {
  const ImplClass = require(implFilePath);
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    throw new Error(`Could not load implication: ${implFilePath}\n` +
                   `Make sure the file exists and all dependencies are installed.`);
  }
  throw error;
}
```

**Error: No xstateConfig**
```javascript
if (!ImplClass.xstateConfig) {
  throw new Error(`${ImplClass.name} is missing static xstateConfig. ` +
                 `Make sure it's an Implication class.`);
}
```

**Error: Template not found**
```javascript
if (!fs.existsSync(templatePath)) {
  throw new Error(`Template not found: ${templatePath}\n` +
                 `Expected location: packages/core/src/generators/templates/`);
}
```

---

## Performance Optimizations

### Caching Strategy

```javascript
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }
  
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}
```

### Template Precompilation

```javascript
class TemplateEngine {
  constructor() {
    this.compiledTemplates = new Map();
  }
  
  render(templateName, context) {
    // Check cache
    if (!this.compiledTemplates.has(templateName)) {
      const source = fs.readFileSync(templatePath, 'utf8');
      const compiled = Handlebars.compile(source);
      this.compiledTemplates.set(templateName, compiled);
    }
    
    const template = this.compiledTemplates.get(templateName);
    return template(context);
  }
}
```

---

**This architecture enables:**
- ✅ Universal code generation
- ✅ Pattern-aware adaptation
- ✅ Smart path resolution
- ✅ Automatic UI validation
- ✅ Multi-platform support
- ✅ Template-driven flexibility

**Next:** See COMPLETE-DOCUMENTATION.md for usage examples!
