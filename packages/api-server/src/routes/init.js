// packages/api-server/src/routes/init.js

import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

router.post('/check', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    console.log(`\n🔍 Checking initialization for: ${projectPath}`);
    
    const checks = {
      testContext: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestContext.js')),
      expectImplication: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js')),
      testPlanner: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js')),
      config: await fileExists(path.join(projectPath, 'ai-testing.config.js'))
    };
    
    const initialized = Object.values(checks).every(Boolean);
    const missing = Object.entries(checks).filter(([_, exists]) => !exists).map(([name, _]) => name);
    
    console.log(`   ${initialized ? '✅' : '⚠️'} Initialized: ${initialized}`);
    if (!initialized) console.log(`   Missing: ${missing.join(', ')}`);
    
    res.json({ initialized, checks, missing, structure: 'tests/ai-testing/' });
    
  } catch (error) {
    console.error('Error checking initialization:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/setup', async (req, res) => {
  try {
    const { projectPath, force = false } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    console.log(`\n🚀 Initializing project: ${projectPath}`);
    console.log(`   Force: ${force}`);
    
    if (!force) {
      const existingCheck = await checkIfInitialized(projectPath);
      if (existingCheck.initialized) {
        return res.status(400).json({
          error: 'Project already initialized. Use force=true to overwrite.',
          existing: existingCheck
        });
      }
    }
    
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
  
  return { initialized: Object.values(checks).every(Boolean), checks };
}

async function initializeProject(projectPath, force) {
  const createdFiles = [];
  
  console.log('   📁 Creating directories...');
  const dirsToCreate = ['tests/ai-testing', 'tests/ai-testing/utils', 'tests/ai-testing/config'];
  
  for (const dir of dirsToCreate) {
    const dirPath = path.join(projectPath, dir);
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`      ✅ ${dir}/`);
  }
  
  console.log('   📝 Creating utility files...');
  
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/TestContext.js'),
    getTestContextTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/TestContext.js');
  console.log(`      ✅ TestContext.js`);
  
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js'),
    getTestPlannerTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/TestPlanner.js');
  console.log(`      ✅ TestPlanner.js`);
  
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js'),
    getExpectImplicationTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/ExpectImplication.js');
  console.log(`      ✅ ExpectImplication.js`);
  
  console.log('   ⚙️  Creating ai-testing.config.js...');
  await fs.writeFile(
    path.join(projectPath, 'ai-testing.config.js'),
    getConfigTemplate(projectPath)
  );
  createdFiles.push('ai-testing.config.js');
  console.log(`      ✅ ai-testing.config.js`);
  
  console.log('   📖 Creating README.md...');
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/README.md'),
    getReadmeTemplate()
  );
  createdFiles.push('tests/ai-testing/README.md');
  console.log(`      ✅ README.md`);
  
  return { filesCreated: createdFiles, structure: 'tests/ai-testing/' };
}

// COPY FROM DOCUMENT 9 - TestContext.js with delta system + array methods
function getTestContextTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/TestContext.js

/**
 * TestContext - Manages test data and state transitions
 * 
 * This class handles:
 * - Loading test data from JSON files (master or delta)
 * - Automatic delta file creation/management
 * - Providing config for actions (device, lang, etc.)
 * - Tracking state changes (delta)
 * - Validating prerequisites
 * - Saving updated state to delta file (NEVER overwrites master)
 * 
 * FILE STRATEGY:
 * - Master files: *-master.json (read-only, pristine)
 * - Delta files: *-current.json (created automatically, tracks changes)
 * 
 * When you load "flight-booking-master.json":
 * - Checks if "flight-booking-current.json" exists
 * - If yes: loads from current (delta)
 * - If no: loads from master, will save to current
 * - Master file is NEVER modified
 */
class TestContext {
  constructor(ImplicationClass, testData, actualFilePath) {
    this.ImplicationClass = ImplicationClass;
    this.data = testData;
    this.changeLog = [];
    this.actualFilePath = actualFilePath;
    
    this.config = {
      device: testData.device || testData._config?.device || 'desktop',
      lang: testData.lang || testData._config?.lang || 'en',
      carrier: testData.carrier || testData._config?.carrier || 'LCC',
      debugMode: testData.debugMode || testData._config?.debugMode || false,
      baseURL: testData._config?.baseURL,
      ...testData._config
    };
    
    this.wrappers = {};
    this.bookingData = {};
    this.flightData = {};
    
    this.runtime = {
      price: null,
      indexStart: 0,
      orderId: null
    };
  }
  
  static getDeltaPath(inputPath) {
    if (inputPath.includes('-master.')) {
      return inputPath.replace('-master.', '-current.');
    }
    if (inputPath.includes('-current.')) {
      return inputPath;
    }
    return inputPath.replace('.json', '-current.json');
  }
  
  static load(ImplicationClass, testDataPath) {
    const fs = require('fs');
    const path = require('path');
    
    let actualPath = testDataPath;
    let isMasterFile = testDataPath.includes('-master.');
    
    if (isMasterFile) {
      const deltaPath = this.getDeltaPath(testDataPath);
      
      if (fs.existsSync(deltaPath)) {
        actualPath = deltaPath;
        console.log(\`   📂 Loading from delta file: \${path.basename(deltaPath)}\`);
      } else {
        console.log(\`   📂 Loading from master file: \${path.basename(testDataPath)}\`);
        console.log(\`   💡 Will create delta file: \${path.basename(deltaPath)}\`);
      }
    } else {
      console.log(\`   📂 Loading from: \${path.basename(testDataPath)}\`);
    }
    
    const fileData = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
    
    let testData, changeLog;
    
    if (fileData._original) {
      testData = fileData._original;
      changeLog = fileData._changeLog || [];
      
      for (const change of changeLog) {
        for (const [key, value] of Object.entries(change.delta)) {
          testData[key] = value;
        }
      }
      
      console.log(\`   📊 Applied \${changeLog.length} changes from history\`);
      console.log(\`   🎯 Current state: \${testData.status || 'unknown'}\`);
    } else {
      testData = fileData;
      changeLog = [];
      console.log(\`   ✨ Fresh state loaded\`);
    }
    
    const ctx = new TestContext(ImplicationClass, testData, actualPath);
    ctx.changeLog = changeLog;
    ctx.inputPath = testDataPath;
    
    return ctx;
  }
  
  async executeAndSave(label, testFile, deltaFn) {
    const { delta } = await deltaFn();
    
    for (const [key, value] of Object.entries(delta)) {
      this.data[key] = value;
    }
    
    this.changeLog.push({
      label,
      testFile,
      delta,
      timestamp: new Date().toISOString()
    });
    
    return this;
  }
  
  save(testDataPath) {
    const fs = require('fs');
    const path = require('path');
    
    let savePath;
    
    if (testDataPath) {
      savePath = TestContext.getDeltaPath(testDataPath);
    } else if (this.inputPath) {
      savePath = TestContext.getDeltaPath(this.inputPath);
    } else {
      savePath = this.actualFilePath;
    }
    
    const originalData = { ...this.data };
    
    for (let i = this.changeLog.length - 1; i >= 0; i--) {
      const change = this.changeLog[i];
      for (const key of Object.keys(change.delta)) {
        delete originalData[key];
      }
    }
    
    if (this.changeLog.length === 0) {
      // No changes yet
    }
    
    const masterPath = this.inputPath || testDataPath;
    if (masterPath && masterPath.includes('-master.') && fs.existsSync(masterPath)) {
      const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      Object.assign(originalData, masterData);
    }
    
    const output = {
      _original: originalData,
      _changeLog: this.changeLog
    };
    
    fs.writeFileSync(savePath, JSON.stringify(output, null, 2));
    
    const fileName = path.basename(savePath);
    const isMaster = savePath.includes('-master.');
    
    if (isMaster) {
      console.log(\`   ⚠️  WARNING: Saved to master file: \${fileName}\`);
    } else {
      console.log(\`   💾 Saved to delta file: \${fileName}\`);
    }
  }
  
  getBooking(index) {
    if (!this.data.bookings || !this.data.bookings[index]) {
      throw new Error(\`Booking at index \${index} not found\`);
    }
    return this.data.bookings[index];
  }
  
  getBookingsByStatus(status) {
    if (!this.data.bookings) return [];
    return this.data.bookings.filter(b => b.status === status);
  }
  
  getBookingsByIndices(indices) {
    if (!this.data.bookings) return [];
    return indices.map(i => this.getBooking(i));
  }
  
  applyDelta(path, value) {
    if (path.includes('[')) {
      const match = path.match(/^(\\w+)\\[(\\d+)\\]\\.?(.*)$/);
      if (match) {
        const [, arrayName, index, rest] = match;
        if (!this.data[arrayName]) this.data[arrayName] = [];
        if (!this.data[arrayName][index]) this.data[arrayName][index] = {};
        if (rest) {
          this.data[arrayName][index][rest] = value;
        } else {
          this.data[arrayName][index] = { ...this.data[arrayName][index], ...value };
        }
      }
    } else {
      this.data[path] = value;
    }
  }
}

module.exports = TestContext;
`;
}

// COPY FROM DOCUMENT 8 - ExpectImplication.js with prerequisites
function getExpectImplicationTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/ExpectImplication.js

const { expect } = require('@playwright/test');

/**
 * ExpectImplication - Validates UI state against implications
 * 
 * This class handles:
 * - Validating visible elements
 * - Validating hidden elements  
 * - Checking text content with variable substitution
 * - Running custom expect functions
 * - Supporting both Playwright and Appium
 */
class ExpectImplication {
  static async validateImplications(screenDef, testData, page) {
    if (!screenDef || screenDef.length === 0) {
      console.log('   ⚠️  No screen definition to validate');
      return;
    }
    
    const def = Array.isArray(screenDef) ? screenDef[0] : screenDef;
    
    console.log(\`   🔍 Validating screen: \${def.name || 'unnamed'}\`);
    
    // Execute prerequisites FIRST (navigation, setup, etc.)
    if (def.prerequisites && def.prerequisites.length > 0) {
      console.log(\`   🔧 Running \${def.prerequisites.length} prerequisites...\`);
      for (const prereq of def.prerequisites) {
        console.log(\`      \${prereq.description}\`);
        await prereq.setup(testData, page);
      }
      console.log('   ✅ Prerequisites completed');
    }
    
    if (def.visible && def.visible.length > 0) {
      console.log(\`   ✅ Checking \${def.visible.length} visible elements...\`);
      for (const elementSelector of def.visible) {
        try {
          const element = page.locator(\`[data-testid="\${elementSelector}"]\`);
          await expect(element).toBeVisible({ timeout: 10000 });
          console.log(\`      ✓ \${elementSelector} is visible\`);
        } catch (error) {
          console.error(\`      ✗ \${elementSelector} NOT visible: \${error.message}\`);
          throw new Error(\`Visibility check failed for \${elementSelector}\`);
        }
      }
    }
    
    if (def.hidden && def.hidden.length > 0) {
      console.log(\`   ✅ Checking \${def.hidden.length} hidden elements...\`);
      for (const elementSelector of def.hidden) {
        try {
          const element = page.locator(\`[data-testid="\${elementSelector}"]\`);
          const count = await element.count();
          
          if (count === 0) {
            console.log(\`      ✓ \${elementSelector} doesn't exist (counts as hidden)\`);
            continue;
          }
          
          await expect(element).not.toBeVisible();
          console.log(\`      ✓ \${elementSelector} is hidden\`);
        } catch (error) {
          console.error(\`      ✗ \${elementSelector} NOT hidden: \${error.message}\`);
          throw new Error(\`Hidden check failed for \${elementSelector}\`);
        }
      }
    }
    
    if (def.checks) {
      console.log('   🔍 Running additional checks...');
      
      if (def.checks.visible && def.checks.visible.length > 0) {
        console.log(\`   ✅ Checking \${def.checks.visible.length} additional visible elements...\`);
        for (const elementSelector of def.checks.visible) {
          try {
            const element = page.locator(\`[data-testid="\${elementSelector}"]\`);
            await expect(element).toBeVisible({ timeout: 10000 });
            console.log(\`      ✓ \${elementSelector} is visible\`);
          } catch (error) {
            console.error(\`      ✗ \${elementSelector} NOT visible: \${error.message}\`);
            throw new Error(\`Checks.visible failed for \${elementSelector}\`);
          }
        }
      }
      
      if (def.checks.hidden && def.checks.hidden.length > 0) {
        console.log(\`   ✅ Checking \${def.checks.hidden.length} additional hidden elements...\`);
        for (const elementSelector of def.checks.hidden) {
          try {
            const element = page.locator(\`[data-testid="\${elementSelector}"]\`);
            const count = await element.count();
            
            if (count === 0) {
              console.log(\`      ✓ \${elementSelector} doesn't exist (counts as hidden)\`);
              continue;
            }
            
            await expect(element).not.toBeVisible();
            console.log(\`      ✓ \${elementSelector} is hidden\`);
          } catch (error) {
            console.error(\`      ✗ \${elementSelector} NOT hidden: \${error.message}\`);
            throw new Error(\`Checks.hidden failed for \${elementSelector}\`);
          }
        }
      }
      
      if (def.checks.text && Object.keys(def.checks.text).length > 0) {
        console.log(\`   ✅ Checking \${Object.keys(def.checks.text).length} text checks...\`);
        for (const [elementSelector, expectedText] of Object.entries(def.checks.text)) {
          try {
            const element = page.locator(\`[data-testid="\${elementSelector}"]\`);
            
            let finalText = expectedText;
            if (typeof expectedText === 'string' && expectedText.includes('{{')) {
              const variableMatch = expectedText.match(/\\{\\{(\\w+)\\}\\}/);
              if (variableMatch && testData && testData[variableMatch[1]]) {
                finalText = expectedText.replace(/\\{\\{(\\w+)\\}\\}/, testData[variableMatch[1]]);
                console.log(\`      📝 Substituted {{\${variableMatch[1]}}} -> \${testData[variableMatch[1]]}\`);
              }
            }
            
            await expect(element).toHaveText(finalText, { timeout: 10000 });
            console.log(\`      ✓ \${elementSelector} has text: "\${finalText}"\`);
          } catch (error) {
            console.error(\`      ✗ \${elementSelector} text check failed: \${error.message}\`);
            throw new Error(\`Text check failed for \${elementSelector}\`);
          }
        }
      }
    }
    
    if (def.expect && typeof def.expect === 'function') {
      console.log('   🎯 Running custom expect function...');
      await def.expect(testData, page);
      console.log('   ✅ Custom expect passed');
    }
    
    console.log(\`   ✅ All validations passed for \${def.name || 'screen'}\`);
  }
  
  static isPlaywright(element) {
    return element && typeof element.locator === 'function';
  }
}

module.exports = ExpectImplication;
`;
}

// COPY FROM DOCUMENT 10 - TestPlanner.js with recursion (simplified for inline)
function getTestPlannerTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/TestPlanner.js

class TestPlanner {
  static checkOrThrow(ImplicationClass, testData) {
    const xstateConfig = ImplicationClass.xstateConfig;
    const meta = xstateConfig.meta || {};
    
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
module.exports = {
  projectName: "${projectName}",
  projectRoot: __dirname,
  utilsPath: "tests/ai-testing/utils",
  outputPath: "tests/implications",
  testRunner: "playwright",
  platforms: ["web"],
  testDataMode: "stateful",
  testDataPath: "tests/data/shared.json",
  patterns: {
    implications: ["tests/implications/**/*Implications.js"],
    tests: ["tests/**/*.spec.js"]
  },
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

Auto-generated testing utilities for the Implications Framework.

Generated: ${new Date().toISOString()}
`;
}

export default router;