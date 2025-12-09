# 📚 API Reference

Complete API documentation for the UNIT Test Generator.

---

## UnitTestGenerator Class

### Constructor

```javascript
const UnitTestGenerator = require('./UnitTestGenerator');

const generator = new UnitTestGenerator(options);
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options.templatePath` | string | `'templates/unit-test.hbs'` | Path to Handlebars template |
| `options.outputDir` | string | `null` | Output directory for generated tests |
| `options.utilsPath` | string | `null` | Custom path to utils directory |

**Example:**
```javascript
const generator = new UnitTestGenerator({
  outputDir: 'tests/generated',
  utilsPath: 'tests/custom-utils'
});
```

---

### generate()

Generate UNIT test(s) from an Implication class.

```javascript
const result = generator.generate(implFilePath, options);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `implFilePath` | string | Yes | Path to Implication file |
| `options.platform` | string | No | Platform: `'web'`, `'cms'`, `'dancer'`, `'manager'` (default: `'web'`) |
| `options.state` | string | No | Target state (for multi-state). If omitted, generates all states |
| `options.preview` | boolean | No | Return code without writing file (default: `false`) |

**Returns:**

Single state:
```javascript
{
  code: string,        // Generated test code
  fileName: string,    // Test file name
  filePath: string     // Full path to written file (or null if preview)
}
```

Multi-state (when `options.state` omitted):
```javascript
[
  { code, fileName, filePath },
  { code, fileName, filePath },
  // ... one per state
]
```

**Examples:**

```javascript
// Generate single state
const result = generator.generate('MyImplications.js', {
  platform: 'web',
  state: 'approved'
});

console.log('Generated:', result.filePath);

// Generate all states
const results = generator.generate('MyImplications.js', {
  platform: 'web'
});

console.log('Generated', results.length, 'tests');

// Preview without writing
const result = generator.generate('MyImplications.js', {
  platform: 'web',
  state: 'approved',
  preview: true
});

console.log(result.code);  // Print generated code
```

---

## TemplateEngine Class

### Constructor

```javascript
const TemplateEngine = require('./TemplateEngine');

const engine = new TemplateEngine(options);
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options.templateDir` | string | `'templates'` | Directory containing templates |

---

### render()

Render a Handlebars template with context.

```javascript
const code = engine.render(templateName, context);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateName` | string | Yes | Template file name (e.g., `'unit-test.hbs'`) |
| `context` | object | Yes | Template context data |

**Returns:** `string` - Rendered template

**Example:**
```javascript
const code = engine.render('unit-test.hbs', {
  implClassName: 'MyImplications',
  actionName: 'approve',
  targetStatus: 'approved',
  // ... more context
});
```

---

## TestPlanner Class

### checkOrThrow()

Validate prerequisites and throw if not met.

```javascript
TestPlanner.checkOrThrow(ImplicationClass, testData, options);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ImplicationClass` | class | Yes | Implication class |
| `testData` | object | Yes | Current test data |
| `options.verbose` | boolean | No | Print success message (default: `true`) |

**Returns:** `object` - Analysis result

**Throws:** Error if prerequisites not met

**Example:**
```javascript
const MyImplications = require('./MyImplications');

try {
  TestPlanner.checkOrThrow(MyImplications, ctx.data);
  console.log('✅ Prerequisites met');
} catch (error) {
  console.error('❌ Prerequisites not met:', error.message);
  process.exit(1);
}
```

---

### analyze()

Analyze prerequisites without throwing.

```javascript
const analysis = planner.analyze(ImplicationClass, testData);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ImplicationClass` | class | Yes | Implication class |
| `testData` | object | Yes | Current test data |

**Returns:**

```javascript
{
  ready: boolean,           // Can the test run?
  currentStatus: string,    // Current data status
  targetStatus: string,     // Target status
  missing: string[],        // Missing fields
  chain: object[],          // Execution chain
  nextStep: object|null,    // Next step to execute
  stepsRemaining: number    // Steps remaining
}
```

**Example:**
```javascript
const planner = new TestPlanner({ verbose: false });
const analysis = planner.analyze(MyImplications, ctx.data);

if (!analysis.ready) {
  console.log('Missing fields:', analysis.missing);
  console.log('Next step:', analysis.nextStep);
}
```

---

## TestContext Class

### load()

Load test data from file.

```javascript
const ctx = TestContext.load(ImplicationClass, filePath);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ImplicationClass` | class | Yes | Implication class |
| `filePath` | string | Yes | Path to test data JSON |

**Returns:** `TestContext` instance

**Example:**
```javascript
const ctx = TestContext.load(MyImplications, 'tests/data/test.json');
console.log('Loaded:', ctx.data);
```

---

### executeAndSave()

Execute an action and save changes.

```javascript
await ctx.executeAndSave(label, testFile, actionFn);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `label` | string | Yes | Change description |
| `testFile` | string | Yes | Test file name |
| `actionFn` | function | Yes | Async function returning `{ delta }` |

**Returns:** `Promise<TestContext>` - Updated context

**Example:**
```javascript
await ctx.executeAndSave(
  'Approve Action',
  'Approve-Web-UNIT.spec.js',
  async () => {
    const delta = {
      status: 'approved',
      approvedAt: new Date().toISOString()
    };
    return { delta };
  }
);
```

---

### save()

Save test data to file.

```javascript
ctx.save(filePath);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | No | File path (uses loaded path if omitted) |

**Example:**
```javascript
ctx.save('tests/data/updated-test.json');
```

---

## CLI Commands

### generate

Generate UNIT test(s) from Implication file.

```bash
node tools/test-generator/cli.js <implication-file> [options]
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `implication-file` | string | Yes | Path to Implication file |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--platform <n>` | string | `'web'` | Platform identifier |
| `--state <n>` | string | - | Target state (omit for all) |
| `--output <dir>` | string | Same as impl | Output directory |
| `--utils <path>` | string | Auto-detected | Utils path |
| `--preview` | flag | false | Preview without writing |
| `--help` | flag | - | Show help |

**Examples:**

```bash
# Single state
node tools/test-generator/cli.js \
  tests/implications/MyImplications.js \
  --state approved \
  --platform web

# All states
node tools/test-generator/cli.js \
  tests/implications/MyImplications.js \
  --platform web

# Custom output
node tools/test-generator/cli.js \
  MyImplications.js \
  --output tests/generated \
  --utils tests/custom-utils

# Preview only
node tools/test-generator/cli.js \
  MyImplications.js \
  --preview
```

---

## Implication Metadata

### Required Fields

```javascript
meta: {
  status: 'published',  // REQUIRED: Target status
  setup: [{             // REQUIRED: Platform configuration
    platform: 'web'     // REQUIRED: Platform identifier
  }]
}
```

### Optional Fields

```javascript
meta: {
  status: 'published',
  
  // Optional: Required data fields
  requiredFields: ['field1', 'field2'],
  
  // Optional: State requirements
  requires: {
    previousStatus: 'draft'
  },
  
  setup: [{
    platform: 'web',
    
    // Optional: Explicit action name
    actionName: 'publishPage',
    
    // Optional: Explicit test file name
    testFile: 'PublishPage-Web-UNIT.spec.js',
    
    // Optional: UI hints
    triggerButton: 'PUBLISH'
  }]
}
```

---

## Handlebars Helpers

Template helpers available in `unit-test.hbs`:

### comment

Comment out a line.

```handlebars
{{comment "await page.goto('/admin');"}}
```

**Output:**
```javascript
// await page.goto('/admin');
```

---

### formatDate

Format ISO date string.

```handlebars
{{formatDate timestamp}}
```

---

### capitalize

Capitalize first letter.

```handlebars
{{capitalize "hello"}}  {{!-- Hello --}}
```

---

### lowercase

Convert to lowercase.

```handlebars
{{lowercase "HELLO"}}  {{!-- hello --}}
```

---

### indent

Indent text by N spaces.

```handlebars
{{indent text 4}}
```

---

### pluralize

Pluralize word based on count.

```handlebars
{{pluralize count "test" "tests"}}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_DATA_PATH` | Path to test data file | `'tests/data/shared.json'` |
| `SKIP_UNIT_TEST_REGISTRATION` | Skip test registration | `false` |
| `DEBUG` | Enable debug output | `false` |

**Examples:**

```bash
# Custom test data path
TEST_DATA_PATH="tests/data/my-test.json" \
npx playwright test MyTest.spec.js

# Skip test registration (only export function)
SKIP_UNIT_TEST_REGISTRATION=true \
npx playwright test MyTest.spec.js

# Enable debug
DEBUG=true node tools/test-generator/cli.js ...
```

---

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `ENOENT` | File not found | Check file path exists |
| `INVALID_META` | Invalid metadata | Check Implication meta structure |
| `NO_STATES` | No states found | Ensure xstateConfig has states |
| `MISSING_PLATFORM` | Platform not specified | Add `--platform` or in meta |
| `PREREQUISITES_NOT_MET` | Prerequisites failed | Check TestPlanner output |

---

## Type Definitions

### GeneratorOptions

```typescript
interface GeneratorOptions {
  templatePath?: string;
  outputDir?: string | null;
  utilsPath?: string | null;
}
```

### GenerateOptions

```typescript
interface GenerateOptions {
  platform?: 'web' | 'cms' | 'dancer' | 'manager';
  state?: string;
  preview?: boolean;
}
```

### GenerateResult

```typescript
interface GenerateResult {
  code: string;
  fileName: string;
  filePath: string | null;
}
```

### AnalysisResult

```typescript
interface AnalysisResult {
  ready: boolean;
  currentStatus: string;
  targetStatus: string;
  missing: string[];
  chain: ExecutionStep[];
  nextStep: ExecutionStep | null;
  stepsRemaining: number;
}
```

---

## Version Compatibility

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | >= 14.0.0 | Required |
| Playwright | >= 1.30.0 | Recommended |
| XState | >= 5.0.0 | Required for Implications |
| Handlebars | >= 4.7.0 | Required |

---

## Breaking Changes

### v1.0.0
- Initial release
- No breaking changes

---

**Need more details? Check the [README-COMPLETE.md](./README-COMPLETE.md)** 📚