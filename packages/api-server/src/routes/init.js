// packages/api-server/src/routes/init.js

import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

/**
 * POST /api/init/check
 * 
 * Check if a project is initialized with the ai-testing structure
 */
router.post('/check', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    console.log(`\n🔍 Checking initialization for: ${projectPath}`);
    
    // Check for required files in NEW structure
    const checks = {
      testContext: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestContext.js')),
      expectImplication: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js')),
      testPlanner: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js')),
      config: await fileExists(path.join(projectPath, 'ai-testing.config.js'))
    };
    
    const initialized = Object.values(checks).every(Boolean);
    const missing = Object.entries(checks)
      .filter(([_, exists]) => !exists)
      .map(([name, _]) => name);
    
    console.log(`   ${initialized ? '✅' : '⚠️'} Initialized: ${initialized}`);
    if (!initialized) {
      console.log(`   Missing: ${missing.join(', ')}`);
    }
    
    res.json({
      initialized,
      checks,
      missing,
      structure: 'tests/ai-testing/'  // New structure!
    });
    
  } catch (error) {
    console.error('Error checking initialization:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/init/setup
 * 
 * Initialize a project with the ai-testing structure
 */
router.post('/setup', async (req, res) => {
  try {
    const { projectPath, force = false } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    console.log(`\n🚀 Initializing project: ${projectPath}`);
    console.log(`   Force: ${force}`);
    
    // Check if already initialized
    if (!force) {
      const existingCheck = await checkIfInitialized(projectPath);
      if (existingCheck.initialized) {
        return res.status(400).json({
          error: 'Project already initialized. Use force=true to overwrite.',
          existing: existingCheck
        });
      }
    }
    
    // Perform initialization
    const result = await initializeProject(projectPath, force);
    
    console.log(`   ✅ Initialization complete!`);
    
    res.json({
      success: true,
      message: 'Project initialized successfully',
      ...result
    });
    
  } catch (error) {
    console.error('Error during initialization:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkIfInitialized(projectPath) {
  const checks = {
    testContext: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestContext.js')),
    expectImplication: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js')),
    testPlanner: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js')),
    config: await fileExists(path.join(projectPath, 'ai-testing.config.js'))
  };
  
  const initialized = Object.values(checks).every(Boolean);
  
  return { initialized, checks };
}

async function initializeProject(projectPath, force) {
  const createdFiles = [];
  
  // 1. Create directory structure
  console.log('   📁 Creating directories...');
  const dirsToCreate = [
    'tests/ai-testing',
    'tests/ai-testing/utils',
    'tests/ai-testing/config'
  ];
  
  for (const dir of dirsToCreate) {
    const dirPath = path.join(projectPath, dir);
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`      ✅ ${dir}/`);
  }
  
  // 2. Create TestContext.js
  console.log('   📝 Creating TestContext.js...');
  const testContextPath = path.join(projectPath, 'tests/ai-testing/utils/TestContext.js');
  await fs.writeFile(testContextPath, getTestContextTemplate());
  createdFiles.push('tests/ai-testing/utils/TestContext.js');
  console.log(`      ✅ TestContext.js`);
  
  // 3. Create ExpectImplication.js
  console.log('   📝 Creating ExpectImplication.js...');
  const expectImplicationPath = path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js');
  await fs.writeFile(expectImplicationPath, getExpectImplicationTemplate());
  createdFiles.push('tests/ai-testing/utils/ExpectImplication.js');
  console.log(`      ✅ ExpectImplication.js`);
  
  // 4. Create TestPlanner.js
  console.log('   📝 Creating TestPlanner.js...');
  const testPlannerPath = path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js');
  await fs.writeFile(testPlannerPath, getTestPlannerTemplate());
  createdFiles.push('tests/ai-testing/utils/TestPlanner.js');
  console.log(`      ✅ TestPlanner.js`);
  
  // 5. Create ai-testing.config.js
  console.log('   ⚙️  Creating ai-testing.config.js...');
  const configPath = path.join(projectPath, 'ai-testing.config.js');
  await fs.writeFile(configPath, getConfigTemplate(projectPath));
  createdFiles.push('ai-testing.config.js');
  console.log(`      ✅ ai-testing.config.js`);
  
  // 6. Create README.md
  console.log('   📖 Creating README.md...');
  const readmePath = path.join(projectPath, 'tests/ai-testing/README.md');
  await fs.writeFile(readmePath, getReadmeTemplate());
  createdFiles.push('tests/ai-testing/README.md');
  console.log(`      ✅ README.md`);
  
  return {
    filesCreated: createdFiles,
    structure: 'tests/ai-testing/'
  };
}

// ═══════════════════════════════════════════════════════════
// FILE TEMPLATES
// ═══════════════════════════════════════════════════════════

function getTestContextTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/TestContext.js

/**
 * TestContext - Manages test data and state transitions
 * 
 * This class handles:
 * - Loading test data from JSON files
 * - Tracking state changes (delta)
 * - Validating prerequisites
 * - Saving updated state back to disk
 */
class TestContext {
  constructor(ImplicationClass, testData) {
    this.ImplicationClass = ImplicationClass;
    this.data = testData;
    this.changeLog = [];
  }
  
  /**
   * Load test data from JSON file
   */
  static load(ImplicationClass, testDataPath) {
    const fs = require('fs');
    const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
    return new TestContext(ImplicationClass, testData);
  }
  
  /**
   * Execute action and save changes
   */
  async executeAndSave(label, testFile, deltaFn) {
    const { delta } = await deltaFn();
    
    // Apply delta to data
    for (const [key, value] of Object.entries(delta)) {
      this.data[key] = value;
    }
    
    // Log change
    this.changeLog.push({
      label,
      testFile,
      delta,
      timestamp: new Date().toISOString()
    });
    
    return this;
  }
  
  /**
   * Save updated data back to file
   */
  save(testDataPath) {
    const fs = require('fs');
    fs.writeFileSync(testDataPath, JSON.stringify(this.data, null, 2));
  }
}

module.exports = TestContext;
`;
}

function getExpectImplicationTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/ExpectImplication.js

/**
 * ExpectImplication - Validates UI state against implications
 * 
 * This class handles:
 * - Validating visible elements
 * - Validating hidden elements
 * - Checking text content with variable substitution
 * - Running custom expect functions
 */
class ExpectImplication {
  /**
   * Validate implications for a screen
   */
  static async validateImplications(screenDef, testData, page) {
    if (!screenDef || screenDef.length === 0) {
      console.log('   ⚠️  No screen definition to validate');
      return;
    }
    
    const def = Array.isArray(screenDef) ? screenDef[0] : screenDef;
    
    // Validate visible elements
    if (def.visible && def.visible.length > 0) {
      console.log(\`   ✅ Checking \${def.visible.length} visible elements...\`);
      for (const element of def.visible) {
        // TODO: Add your element validation logic
        console.log(\`      ✓ \${element} should be visible\`);
      }
    }
    
    // Validate hidden elements
    if (def.hidden && def.hidden.length > 0) {
      console.log(\`   ✅ Checking \${def.hidden.length} hidden elements...\`);
      for (const element of def.hidden) {
        // TODO: Add your element validation logic
        console.log(\`      ✓ \${element} should be hidden\`);
      }
    }
    
    // Run custom expect function
    if (def.expect && typeof def.expect === 'function') {
      console.log('   ✅ Running custom expect function...');
      await def.expect(testData, page);
    }
  }
}

module.exports = ExpectImplication;
`;
}

function getTestPlannerTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/TestPlanner.js

/**
 * TestPlanner - Validates prerequisites before running tests
 * 
 * This class handles:
 * - Checking if test data is in correct state
 * - Validating required fields exist
 * - Throwing helpful errors when prerequisites not met
 */
class TestPlanner {
  /**
   * Check if prerequisites are met, throw if not
   */
  static checkOrThrow(ImplicationClass, testData) {
    const xstateConfig = ImplicationClass.xstateConfig;
    const meta = xstateConfig.meta || {};
    
    // Check previous status
    if (meta.requires?.previousStatus) {
      const expected = meta.requires.previousStatus;
      const actual = testData.status;
      
      if (actual !== expected) {
        throw new Error(
          \`❌ Prerequisites not met!\\n\` +
          \`   Expected status: \${expected}\\n\` +
          \`   Actual status: \${actual}\\n\\n\` +
          \`   You need to run the test that induces "\${expected}" state first.\`
        );
      }
    }
    
    // Check required fields
    if (meta.requiredFields && meta.requiredFields.length > 0) {
      const missing = [];
      
      for (const field of meta.requiredFields) {
        if (!testData.hasOwnProperty(field)) {
          missing.push(field);
        }
      }
      
      if (missing.length > 0) {
        throw new Error(
          \`❌ Missing required fields: \${missing.join(', ')}\\n\` +
          \`   Required: \${meta.requiredFields.join(', ')}\`
        );
      }
    }
    
    console.log('   ✅ Prerequisites check passed');
  }
}

module.exports = TestPlanner;
`;
}

function getConfigTemplate(projectPath) {
  const projectName = path.basename(projectPath);
  
  return `// Auto-generated by Implications Framework
// Location: ai-testing.config.js

module.exports = {
  // Project info
  projectName: "${projectName}",
  projectRoot: __dirname,
  
  // Framework paths
  utilsPath: "tests/ai-testing/utils",
  outputPath: "tests/implications",
  
  // Test configuration
  testRunner: "playwright", // or "appium", "cypress"
  platforms: ["web"], // Add your platforms: "web", "mobile-dancer", etc.
  
  // Data management
  testDataMode: "stateful", // or "stateless"
  testDataPath: "tests/data/shared.json",
  
  // Patterns
  patterns: {
    implications: [
      "tests/implications/**/*Implications.js"
    ],
    tests: [
      "tests/**/*.spec.js"
    ]
  },
  
  // Generation options
  generation: {
    skipTestRegistration: false,
    autoValidateUI: true,
    extractActions: true
  }
};
`;
}

function getReadmeTemplate() {
  return `# AI Testing Framework

This directory contains the auto-generated testing utilities for the Implications Framework.

## Structure

\`\`\`
tests/ai-testing/
├── utils/
│   ├── TestContext.js       # Test data management
│   ├── ExpectImplication.js # UI validation
│   └── TestPlanner.js       # Prerequisites checking
├── config/
│   └── (future: custom configs)
└── README.md                # This file
\`\`\`

## Files

### TestContext.js
Manages test data and state transitions. Handles loading data from JSON files and saving changes (delta).

### ExpectImplication.js
Validates UI state against implications. Checks visible/hidden elements and runs custom validations.

### TestPlanner.js
Validates prerequisites before running tests. Ensures test data is in the correct state.

## Usage

These files are automatically imported in generated tests:

\`\`\`javascript
const TestContext = require('../ai-testing/utils/TestContext');
const ExpectImplication = require('../ai-testing/utils/ExpectImplication');
const TestPlanner = require('../ai-testing/utils/TestPlanner');
\`\`\`

## Configuration

Main configuration file: \`ai-testing.config.js\` (project root)

## Generated by

Implications Framework - Auto-generated on ${new Date().toISOString()}
`;
}

export default router;