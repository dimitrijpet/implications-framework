# 🚀 Implementation Guide - How to Use the Generator

**Date:** October 24, 2025  
**Purpose:** Practical guide to integrate and use the UNIT test generator in your project

---

## 📁 Where to Put It

### Option A: Standalone Tool (Recommended for Testing)

```
your-project/
├── tools/                           ← NEW
│   └── test-generator/              ← NEW
│       ├── package.json
│       ├── UnitTestGenerator.js
│       ├── TemplateEngine.js
│       ├── templates/
│       │   └── unit-test.hbs
│       └── cli.js                   ← NEW (we'll create this)
│
└── tests/
    ├── implications/
    │   └── bookings/
    │       └── status/
    │           ├── AcceptedBookingImplications.js
    │           └── AcceptBooking-Web-UNIT.spec.js  ← Generated
    └── utils/
        ├── TestContext.js
        └── TestPlanner.js
```

**Pros:**
- ✅ Isolated from test code
- ✅ Easy to update
- ✅ Can version separately
- ✅ Easy to test

---

### Option B: Integrated Tool

```
your-project/
└── tests/
    ├── generators/                  ← NEW
    │   ├── package.json
    │   ├── UnitTestGenerator.js
    │   ├── TemplateEngine.js
    │   └── templates/
    │       └── unit-test.hbs
    │
    ├── implications/
    │   └── bookings/
    │       └── status/
    │           ├── AcceptedBookingImplications.js
    │           └── AcceptBooking-Web-UNIT.spec.js  ← Generated
    └── utils/
        ├── TestContext.js
        └── TestPlanner.js
```

**Pros:**
- ✅ Close to test code
- ✅ Same repo
- ✅ Easier imports

---

## 🎯 Recommended: Option A (Standalone Tool)

Let's go with **Option A** for now. Easier to test and iterate.

---

## 📦 Step-by-Step Setup

### Step 1: Create the Tool Directory

```bash
cd your-project
mkdir -p tools/test-generator/templates
```

### Step 2: Copy the Files

```bash
# Copy generator files
cp /path/to/UnitTestGenerator.js tools/test-generator/
cp /path/to/TemplateEngine.js tools/test-generator/
cp /path/to/unit-test.hbs tools/test-generator/templates/

# Create package.json
cd tools/test-generator
npm init -y
npm install handlebars xstate
```

### Step 3: Create CLI Tool

**File:** `tools/test-generator/cli.js`

```javascript
#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const UnitTestGenerator = require('./UnitTestGenerator');

// Parse arguments
const args = process.argv.slice(2);

function printUsage() {
  console.log(`
🎯 UNIT Test Generator CLI

USAGE:
  node cli.js <implication-file> [options]

ARGUMENTS:
  <implication-file>    Path to Implication file

OPTIONS:
  --platform <name>     Platform: web, cms, dancer, manager
                        Default: web
  
  --preview             Preview without writing file
  
  --output <dir>        Output directory
                        Default: same directory as Implication file

EXAMPLES:
  # Generate web test
  node cli.js ../../tests/implications/bookings/status/AcceptedBookingImplications.js
  
  # Generate dancer test
  node cli.js ../../tests/implications/bookings/status/AcceptedBookingImplications.js --platform dancer
  
  # Preview only
  node cli.js ../../tests/implications/bookings/status/AcceptedBookingImplications.js --preview
`);
}

// Parse options
const options = {
  platform: 'web',
  preview: false,
  output: null
};

let implPath = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help' || arg === '-h') {
    printUsage();
    process.exit(0);
  } else if (arg === '--platform') {
    options.platform = args[++i];
  } else if (arg === '--preview') {
    options.preview = true;
  } else if (arg === '--output') {
    options.output = args[++i];
  } else if (!implPath) {
    implPath = arg;
  }
}

if (!implPath) {
  console.error('❌ Error: Implication file required\n');
  printUsage();
  process.exit(1);
}

// Resolve path
const implFullPath = path.resolve(process.cwd(), implPath);

if (!fs.existsSync(implFullPath)) {
  console.error(`❌ Error: File not found: ${implFullPath}`);
  process.exit(1);
}

// Set output directory
if (!options.output) {
  options.output = path.dirname(implFullPath);
}

console.log('\n🎯 UNIT Test Generator');
console.log('═'.repeat(60));
console.log(`Implication: ${implFullPath}`);
console.log(`Platform: ${options.platform}`);
console.log(`Output: ${options.output}`);
console.log(`Preview: ${options.preview ? 'YES' : 'NO'}`);
console.log('═'.repeat(60) + '\n');

// Generate
try {
  const generator = new UnitTestGenerator({
    outputDir: options.output
  });
  
  const result = generator.generate(implFullPath, {
    platform: options.platform,
    preview: options.preview
  });
  
  console.log('✅ SUCCESS!\n');
  console.log('📊 Results:');
  console.log(`   File: ${result.fileName}`);
  
  if (!options.preview) {
    console.log(`   Path: ${result.filePath}`);
    console.log(`   Size: ${result.code.length} chars`);
    console.log(`\n💡 Generated test file written to disk`);
  } else {
    console.log(`   Size: ${result.code.length} chars`);
    console.log('\n📝 Preview:\n');
    console.log('─'.repeat(60));
    const lines = result.code.split('\n');
    console.log(lines.slice(0, 50).join('\n'));
    if (lines.length > 50) {
      console.log('─'.repeat(60));
      console.log(`... ${lines.length - 50} more lines ...`);
    }
  }
  
  console.log('\n✅ Done!\n');
  
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
}
```

### Step 4: Make CLI Executable

```bash
chmod +x tools/test-generator/cli.js
```

### Step 5: Add npm Scripts (Optional)

**File:** `tools/test-generator/package.json`

```json
{
  "name": "test-generator",
  "version": "1.0.0",
  "description": "UNIT test generator for Implications framework",
  "main": "UnitTestGenerator.js",
  "bin": {
    "gen-test": "./cli.js"
  },
  "scripts": {
    "gen": "node cli.js"
  },
  "dependencies": {
    "handlebars": "^4.7.8",
    "xstate": "^5.0.0"
  }
}
```

---

## 🎮 How to Use It

### Method 1: Direct CLI

```bash
cd your-project

# Generate web test for AcceptedBooking
node tools/test-generator/cli.js \
  tests/implications/bookings/status/AcceptedBookingImplications.js \
  --platform web

# Preview without writing
node tools/test-generator/cli.js \
  tests/implications/bookings/status/AcceptedBookingImplications.js \
  --preview

# Generate dancer test
node tools/test-generator/cli.js \
  tests/implications/bookings/status/AcceptedBookingImplications.js \
  --platform dancer

# Custom output directory
node tools/test-generator/cli.js \
  tests/implications/bookings/status/AcceptedBookingImplications.js \
  --output tests/implications/bookings/generated/
```

---

### Method 2: npm Script (if installed globally)

```bash
cd tools/test-generator
npm link

# Now from anywhere:
cd your-project
gen-test tests/implications/bookings/status/AcceptedBookingImplications.js
```

---

### Method 3: Programmatic (in scripts)

**File:** `tools/generate-all-tests.js`

```javascript
const path = require('path');
const fs = require('fs');
const UnitTestGenerator = require('./test-generator/UnitTestGenerator');

// Find all Implications files
function findImplications(dir) {
  const files = [];
  
  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.name.endsWith('Implications.js')) {
        files.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return files;
}

// Generate tests for all Implications
const implications = findImplications('./tests/implications');

console.log(`\n🎯 Found ${implications.length} Implication files\n`);

const generator = new UnitTestGenerator();

implications.forEach((implPath, i) => {
  console.log(`\n[${i + 1}/${implications.length}] Generating: ${path.basename(implPath)}`);
  
  try {
    const outputDir = path.dirname(implPath);
    
    const result = generator.generate(implPath, {
      platform: 'web',  // Default to web
      preview: false
    });
    
    // Write to same directory as Implication
    fs.writeFileSync(
      path.join(outputDir, result.fileName),
      result.code
    );
    
    console.log(`   ✅ Generated: ${result.fileName}`);
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
});

console.log(`\n✅ Complete! Generated ${implications.length} tests\n`);
```

**Usage:**
```bash
node tools/generate-all-tests.js
```

---

## 📝 Workflow

### Typical Development Flow

1. **Create Implication File**
   ```javascript
   // tests/implications/bookings/status/AcceptedBookingImplications.js
   class AcceptedBookingImplications {
     static xstateConfig = { ... }
   }
   ```

2. **Generate UNIT Test**
   ```bash
   node tools/test-generator/cli.js \
     tests/implications/bookings/status/AcceptedBookingImplications.js
   ```

3. **Review Generated Test**
   - Check prerequisites logic
   - Fill in navigation (TODO)
   - Fill in action (TODO)
   - Verify delta calculation

4. **Run Test**
   ```bash
   TEST_DATA_PATH="tests/data/shared.json" \
   npx playwright test AcceptBooking-Web-UNIT.spec.js
   ```

5. **Iterate**
   - Update Implication if needed
   - Regenerate test
   - Rerun

---

## 🔧 Integration with Existing Tests

### If You Already Have Tests

**Option 1: Generate Side-by-Side**
```
AcceptedBookingImplications.js
AcceptBooking-Web-UNIT.spec.js       ← Your existing test
AcceptBooking-Web-UNIT-GEN.spec.js   ← Generated test (different name)
```

**Option 2: Replace Existing**
```bash
# Backup first
cp AcceptBooking-Web-UNIT.spec.js AcceptBooking-Web-UNIT.spec.js.backup

# Generate (overwrites)
node tools/test-generator/cli.js AcceptedBookingImplications.js
```

**Option 3: Compare and Merge**
```bash
# Generate to temp
node tools/test-generator/cli.js AcceptedBookingImplications.js --output /tmp/

# Compare
diff AcceptBooking-Web-UNIT.spec.js /tmp/AcceptBooking-Web-UNIT.spec.js

# Merge manually
```

---

## 🎯 Quick Start Checklist

- [ ] Create `tools/test-generator/` directory
- [ ] Copy 3 files (Generator, Engine, Template)
- [ ] Create `cli.js`
- [ ] Run `npm install handlebars xstate`
- [ ] Make cli.js executable (`chmod +x`)
- [ ] Test with one Implication:
  ```bash
  node tools/test-generator/cli.js \
    tests/implications/bookings/status/AcceptedBookingImplications.js \
    --preview
  ```
- [ ] Generate actual test (remove --preview)
- [ ] Review generated test
- [ ] Fill in TODOs (navigation, action)
- [ ] Run test
- [ ] Celebrate! 🎉

---

## 💡 Tips

### 1. Start Small
Generate one test first, review it, then batch generate.

### 2. Use Preview First
Always use `--preview` to see what will be generated before writing files.

### 3. Keep Backups
Always backup existing tests before regenerating.

### 4. Customize Template
The template is yours to modify. Edit `templates/unit-test.hbs` to match your style.

### 5. Version Control
Commit generated tests to git. They're real code now!

---

## 🚧 Common Issues

### Issue 1: "Cannot find module"

**Problem:** Dependencies not installed

**Solution:**
```bash
cd tools/test-generator
npm install handlebars xstate
```

### Issue 2: "Template not found"

**Problem:** Wrong template path

**Solution:** Check `templates/unit-test.hbs` exists

### Issue 3: "Invalid Implication"

**Problem:** Implication file doesn't have xstateConfig

**Solution:** Make sure your Implication has `static xstateConfig = { ... }`

### Issue 4: Generated test has errors

**Problem:** Template needs customization

**Solution:** Edit `templates/unit-test.hbs` to match your project structure

---

## 🎉 You're Ready!

**Next steps:**
1. Set up the tool directory
2. Generate your first test
3. Review and customize
4. Generate more tests
5. Profit! 🚀

---

**Need help?** Check:
- `PHASE-1-COMPLETE.md` - Full documentation
- `test-generator-v2.js` - Working example
- `AcceptBooking-Web-UNIT.spec.js` - Example output

**Let's generate some tests!** 💪
