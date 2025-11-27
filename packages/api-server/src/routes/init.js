// packages/api-server/src/routes/init.js
// Updated: 2025-11-27 - Added run-test.js, package.json script, v4.2 TestPlanner

import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// CHECK ENDPOINT - Check if project is initialized
// ═══════════════════════════════════════════════════════════════════════════
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
      implicationsHelper: await fileExists(path.join(projectPath, 'tests/implications/ImplicationsHelper.js')),
      runTest: await fileExists(path.join(projectPath, 'run-test.js')),
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

// ═══════════════════════════════════════════════════════════════════════════
// SETUP ENDPOINT - Initialize project with all files
// ═══════════════════════════════════════════════════════════════════════════
router.post('/setup', async (req, res) => {
  try {
    const { projectPath, force = false, updatePackageJson = true } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    console.log(`\n🚀 Initializing project: ${projectPath}`);
    console.log(`   Force: ${force}`);
    console.log(`   Update package.json: ${updatePackageJson}`);
    
    if (!force) {
      const existingCheck = await checkIfInitialized(projectPath);
      if (existingCheck.initialized) {
        return res.status(400).json({
          error: 'Project already initialized. Use force=true to overwrite.',
          existing: existingCheck
        });
      }
    }
    
    const result = await initializeProject(projectPath, force, updatePackageJson);
    
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

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

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
    implicationsHelper: await fileExists(path.join(projectPath, 'tests/implications/ImplicationsHelper.js')),
    runTest: await fileExists(path.join(projectPath, 'run-test.js')),
    config: await fileExists(path.join(projectPath, 'ai-testing.config.js'))
  };
  
  return { initialized: Object.values(checks).every(Boolean), checks };
}

async function initializeProject(projectPath, force, updatePackageJson) {
  const createdFiles = [];
  
  console.log('   📁 Creating directories...');
  const dirsToCreate = [
    'tests/ai-testing',
    'tests/ai-testing/utils',
    'tests/implications',
    'tests/data'
  ];
  
  for (const dir of dirsToCreate) {
    const dirPath = path.join(projectPath, dir);
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`      ✅ ${dir}/`);
  }
  
  console.log('   📝 Creating utility files...');
  
  // TestContext.js
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/TestContext.js'),
    getTestContextTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/TestContext.js');
  console.log(`      ✅ TestContext.js`);
  
  // TestPlanner.js (v4.2 with requires mismatch)
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js'),
    getTestPlannerTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/TestPlanner.js');
  console.log(`      ✅ TestPlanner.js (v4.2)`);
  
  // ExpectImplication.js
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js'),
    getExpectImplicationTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/ExpectImplication.js');
  console.log(`      ✅ ExpectImplication.js`);
  
  // ImplicationsHelper.js
  await fs.writeFile(
    path.join(projectPath, 'tests/implications/ImplicationsHelper.js'),
    getImplicationsHelperTemplate()
  );
  createdFiles.push('tests/implications/ImplicationsHelper.js');
  console.log(`      ✅ ImplicationsHelper.js`);
  
  // run-test.js (preflight wrapper)
  console.log('   🚀 Creating run-test.js (preflight wrapper)...');
  await fs.writeFile(
    path.join(projectPath, 'run-test.js'),
    getRunTestTemplate()
  );
  createdFiles.push('run-test.js');
  console.log(`      ✅ run-test.js`);
  
  // ai-testing.config.js
  console.log('   ⚙️  Creating ai-testing.config.js...');
  await fs.writeFile(
    path.join(projectPath, 'ai-testing.config.js'),
    getConfigTemplate(projectPath)
  );
  createdFiles.push('ai-testing.config.js');
  console.log(`      ✅ ai-testing.config.js`);
  
  // README.md
  console.log('   📖 Creating README.md...');
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/README.md'),
    getReadmeTemplate()
  );
  createdFiles.push('tests/ai-testing/README.md');
  console.log(`      ✅ README.md`);
  
  // shared.json (default test data)
  const sharedJsonPath = path.join(projectPath, 'tests/data/shared.json');
  if (!await fileExists(sharedJsonPath)) {
    console.log('   📊 Creating default shared.json...');
    await fs.writeFile(sharedJsonPath, getSharedJsonTemplate());
    createdFiles.push('tests/data/shared.json');
    console.log(`      ✅ shared.json`);
  }
  
  // Update package.json if requested
  let packageJsonUpdated = false;
  if (updatePackageJson) {
    console.log('   📦 Updating package.json...');
    packageJsonUpdated = await addPackageJsonScript(projectPath);
    if (packageJsonUpdated) {
      console.log(`      ✅ Added "test:impl" script to package.json`);
    } else {
      console.log(`      ⚠️  Could not update package.json (script may already exist)`);
    }
  }
  
  return { 
    filesCreated: createdFiles, 
    structure: 'tests/ai-testing/',
    packageJsonUpdated
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PACKAGE.JSON SCRIPT ADDITION
// ═══════════════════════════════════════════════════════════════════════════

async function addPackageJsonScript(projectPath) {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    if (!await fileExists(packageJsonPath)) {
      console.log('      ⚠️  package.json not found');
      return false;
    }
    
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    // Check if script already exists
    if (packageJson.scripts['test:impl']) {
      console.log('      ℹ️  test:impl script already exists');
      return false;
    }
    
    // Add the script
    packageJson.scripts['test:impl'] = 'node run-test.js';
    
    // Write back
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    return true;
  } catch (error) {
    console.log(`      ⚠️  Error updating package.json: ${error.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE: run-test.js
// ═══════════════════════════════════════════════════════════════════════════

// In init.js, replace getRunTestTemplate() with:

function getRunTestTemplate() {
  return `#!/usr/bin/env node
/**
 * run-test.js - Multi-Platform Test Runner with PreFlight Check
 * 
 * Usage:
 *   npm run test:impl -- path/to/Test-Web-UNIT.spec.js [options]
 *   npm run test:impl -- path/to/Test-Dancer-UNIT.spec.js [options]
 *   npm run test:impl -- path/to/Test-ClubApp-UNIT.spec.js [options]
 * 
 * Options:
 *   --project=chromium    Playwright project (web only)
 *   --headed              Run in headed mode
 *   --skip-preflight      Skip pre-flight check
 *   -u dancer|club        Appium user type (auto-detected from filename)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONFIG = {
  testDataPath: 'tests/data/shared.json',
  implicationsDir: 'tests/implications',
  platformPatterns: {
    web: ['-Web-', '-Playwright-', '-CMS-'],
    dancer: ['-Dancer-'],
    clubApp: ['-ClubApp-', '-Club-']
  }
};

function getPlaywrightConfigPath() {
  try {
    const configPath = path.join(process.cwd(), 'ai-testing.config.js');
    if (fs.existsSync(configPath)) {
      delete require.cache[require.resolve(configPath)];
      const config = require(configPath);
      if (config.playwrightConfig) {
        const explicitPath = path.join(process.cwd(), config.playwrightConfig);
        if (fs.existsSync(explicitPath)) return explicitPath;
        console.warn(\`⚠️  Configured playwrightConfig not found: \${config.playwrightConfig}\`);
      }
    }
  } catch (e) {}
  
  const commonPaths = [
    'playwright.config.js', 'playwright.config.ts',
    'config/playwright.config.js', 'config/playwright.config.ts',
    'config/frameworks/playwright.config.js', 'config/frameworks/playwright.config.ts'
  ];
  
  for (const configFile of commonPaths) {
    const fullPath = path.join(process.cwd(), configFile);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function getAppiumConfigPath() {
  try {
    const configPath = path.join(process.cwd(), 'ai-testing.config.js');
    if (fs.existsSync(configPath)) {
      delete require.cache[require.resolve(configPath)];
      const config = require(configPath);
      if (config.appiumConfig) {
        const explicitPath = path.join(process.cwd(), config.appiumConfig);
        if (fs.existsSync(explicitPath)) return explicitPath;
        console.warn(\`⚠️  Configured appiumConfig not found: \${config.appiumConfig}\`);
      }
    }
  } catch (e) {}
  
  const commonPaths = [
    'wdio.conf.js', 'wdio.conf.ts', 'appium.config.js',
    'config/wdio.conf.js', 'config/appium.config.js',
    'config/frameworks/appium.config.js', 'config/frameworks/wdio.conf.js'
  ];
  
  for (const configFile of commonPaths) {
    const fullPath = path.join(process.cwd(), configFile);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function detectPlatform(testFile) {
  const filename = path.basename(testFile);
  for (const [platform, patterns] of Object.entries(CONFIG.platformPatterns)) {
    for (const pattern of patterns) {
      if (filename.includes(pattern)) return platform;
    }
  }
  console.log(\`⚠️  Could not detect platform from filename, defaulting to 'web'\`);
  return 'web';
}

function extractImplicationClassName(testFile) {
  const filename = path.basename(testFile);
  
  try {
    const content = fs.readFileSync(testFile, 'utf-8');
    const requireMatch = content.match(/(?:const|let|var)\\s+(\\w+Implications)\\s*=\\s*require/);
    if (requireMatch) return requireMatch[1];
    
    const pathMatch = content.match(/require\\s*\\(\\s*['"][^'"]*\\/(\\w+Implications)['"]\\s*\\)/);
    if (pathMatch) return pathMatch[1];
    
    const statusMatch = content.match(/meta:\\s*\\{[^}]*status:\\s*['"]([\\w_]+)['"]/);
    if (statusMatch) {
      return statusMatch[1].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Implications';
    }
  } catch (error) {
    console.error(\`⚠️  Could not read test file: \${error.message}\`);
  }
  
  const match = filename.match(/^(\\w+)Via/);
  if (match) return match[1] + 'Implications';
  return null;
}

function findImplicationFile(className) {
  const searchPaths = [
    path.join(process.cwd(), 'tests/implications'),
    path.join(process.cwd(), 'tests/ai-testing/implications')
  ];
  
  function searchRecursive(dir, filename) {
    if (!fs.existsSync(dir)) return null;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        const found = searchRecursive(fullPath, filename);
        if (found) return found;
      } else if (item.name === filename) {
        return fullPath;
      }
    }
    return null;
  }
  
  for (const basePath of searchPaths) {
    const found = searchRecursive(basePath, \`\${className}.js\`);
    if (found) return found;
  }
  return null;
}

async function runPreFlightCheck(testFile, implicationClassName) {
  console.log('🚀 Running pre-flight check...');
  console.log(\`📄 Test file: \${path.basename(testFile)}\`);
  console.log(\`📂 Implication file: \${implicationClassName}.js\`);
  
  const implFile = findImplicationFile(implicationClassName);
  
  if (!implFile) {
    console.error(\`❌ Could not find implication file: \${implicationClassName}.js\`);
    console.error(\`   Searched in: tests/implications/, tests/ai-testing/implications/\`);
    process.exit(1);
  }
  
  Object.keys(require.cache).forEach(key => {
    if (key.includes('Implications') || key.includes('TestPlanner') || 
        key.includes('TestContext') || key.includes('/tests/data/')) {
      delete require.cache[key];
    }
  });
  
  try {
    const ImplicationClass = require(implFile);
    const TestPlanner = require('./tests/ai-testing/utils/TestPlanner');
    return await TestPlanner.preFlightCheck(ImplicationClass, CONFIG.testDataPath);
  } catch (error) {
    console.error(\`❌ Pre-flight check failed: \${error.message}\`);
    if (error.message.includes('Cannot find module')) {
      console.error(\`\\n💡 Make sure TestPlanner.js exists at tests/ai-testing/utils/TestPlanner.js\`);
    }
    process.exit(1);
  }
}

function spawnTestRunner(platform, testFile, extraArgs = []) {
  let command, args;
  
  if (platform === 'web') {
    command = 'npx';
    const playwrightConfig = getPlaywrightConfigPath();
    args = ['playwright', 'test'];
    if (playwrightConfig) {
      args.push(\`--config=\${playwrightConfig}\`);
      console.log(\`📄 Using Playwright config: \${playwrightConfig}\`);
    } else {
      console.log(\`📄 Using Playwright default config detection\`);
    }
    args.push(testFile, ...extraArgs);
  } else {
    const appiumConfig = getAppiumConfigPath();
    if (!appiumConfig) {
      console.error(\`❌ Could not find Appium/WDIO config file\`);
      process.exit(1);
    }
    command = './node_modules/.bin/wdio';
    const userType = platform === 'dancer' ? 'dancer' : 'club';
    args = [appiumConfig, '-u', userType, '--spec', testFile, ...extraArgs];
    console.log(\`📄 Using Appium config: \${appiumConfig}\`);
  }
  
  console.log(\`\\n🎬 Spawning \${platform} test runner...\`);
  console.log(\`   Command: \${command} \${args.join(' ')}\\n\`);
  
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PREFLIGHT_COMPLETED: 'true', TEST_DATA_PATH: CONFIG.testDataPath }
  });
  
  child.on('close', (code) => process.exit(code || 0));
  child.on('error', (error) => {
    console.error(\`❌ Failed to spawn test runner: \${error.message}\`);
    process.exit(1);
  });
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let testFile = null, skipPreflight = false;
  const extraArgs = [];
  
  for (const arg of args) {
    if (arg === '--skip-preflight') skipPreflight = true;
    else if (arg.endsWith('.spec.js') || arg.endsWith('.spec.ts')) testFile = arg;
    else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
    else extraArgs.push(arg);
  }
  return { testFile, skipPreflight, extraArgs };
}

function printHelp() {
  console.log(\`
Multi-Platform Test Runner with PreFlight Check

Usage: npm run test:impl -- <test-file> [options]

Options:
  --skip-preflight    Skip the pre-flight check
  --headed            Run in headed mode (Playwright)
  --project=chromium  Specify Playwright project

Config Detection:
  Playwright: ai-testing.config.js -> playwrightConfig, or auto-detect
  Appium: ai-testing.config.js -> appiumConfig, or auto-detect
\`);
}

async function main() {
  const { testFile, skipPreflight, extraArgs } = parseArgs(process.argv);
  
  if (!testFile) {
    console.error('❌ No test file specified');
    console.error('   Usage: npm run test:impl -- path/to/test.spec.js');
    process.exit(1);
  }
  
  const resolvedTestFile = path.resolve(process.cwd(), testFile);
  if (!fs.existsSync(resolvedTestFile)) {
    console.error(\`❌ Test file not found: \${testFile}\`);
    process.exit(1);
  }
  
  const platform = detectPlatform(testFile);
  console.log(\`\\n🎯 Detected platform: \${platform}\`);
  
  const implicationClassName = extractImplicationClassName(resolvedTestFile);
  if (!implicationClassName) {
    console.error(\`❌ Could not determine Implication class from test file\`);
    process.exit(1);
  }
  
  console.log(\`📦 Implication class: \${implicationClassName}\`);
  
  if (!skipPreflight) {
    await runPreFlightCheck(resolvedTestFile, implicationClassName);
  } else {
    console.log('⏭️  Skipping pre-flight check');
  }
  
  spawnTestRunner(platform, resolvedTestFile, extraArgs);
}

main().catch(error => {
  console.error(\`❌ Fatal error: \${error.message}\`);
  process.exit(1);
});
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE: shared.json (default test data)
// ═══════════════════════════════════════════════════════════════════════════

function getSharedJsonTemplate() {
  return JSON.stringify({
    status: 'initial',
    device: 'desktop',
    lang: 'en',
    carrier: 'GDS',
    _config: {
      device: 'desktop',
      lang: 'en'
    }
  }, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE: TestContext.js
// ═══════════════════════════════════════════════════════════════════════════

function getTestContextTemplate() {
  // Read from the actual file content (document index 8)
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/TestContext.js

class TestContext {
  /**
   * Fields that exist in memory but NEVER persist to JSON
   * These are session-only states that reset when the session ends
   * 
   * Loaded from ai-testing.config.js or uses defaults:
   * - 'logged_in' strips dancer.logged_in, club.logged_in, manager.logged_in
   * - 'app_opened' strips dancer.app_opened, etc.
   */
  static _sessionOnlyFields = null;
  
  /**
   * Get session-only fields from config or defaults
   */
  static getSessionOnlyFields() {
    if (this._sessionOnlyFields) return this._sessionOnlyFields;
    
    const fs = require('fs');
    const path = require('path');
    
    // Try to load from config
    try {
      const configPath = path.join(process.cwd(), 'ai-testing.config.js');
      if (fs.existsSync(configPath)) {
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        if (config.sessionOnlyFields && Array.isArray(config.sessionOnlyFields)) {
          console.log('📋 Loaded sessionOnlyFields from ai-testing.config.js');
          this._sessionOnlyFields = config.sessionOnlyFields;
          return this._sessionOnlyFields;
        }
      }
    } catch (e) {
      // Config not found or invalid, use defaults
    }
    
    // Defaults
    this._sessionOnlyFields = ['logged_in', 'app_opened', 'session_ready'];
    return this._sessionOnlyFields;
  }
  
  /**
   * Strip session-only fields from nested objects
   * e.g., removes dancer.logged_in, club.logged_in, etc.
   */
  _stripSessionFieldsFromObject(obj, parentKey = '') {
    if (!obj || typeof obj !== 'object') return;
    
    const sessionFields = TestContext.getSessionOnlyFields();
    
    for (const key of Object.keys(obj)) {
      // Check if this key is a session-only field
      if (sessionFields.includes(key)) {
        console.log(\`   🔒 Stripped session field: \${parentKey ? parentKey + '.' : ''}\${key}\`);
        delete obj[key];
        continue;
      }
      
      // Recurse into nested objects (but not arrays or special objects)
      const value = obj[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Skip internal fields
        if (key.startsWith('_')) continue;
        
        this._stripSessionFieldsFromObject(value, parentKey ? \`\${parentKey}.\${key}\` : key);
      }
    }
  }
  
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
    
    if (!isMasterFile) {
      const baseName = path.basename(testDataPath, '.json');
      const dirName = path.dirname(testDataPath);
      const currentPath = path.join(dirName, \`\${baseName}-current.json\`);
      
      if (fs.existsSync(currentPath)) {
        actualPath = currentPath;
        console.log(\`   📂 Loading from delta file: \${path.basename(currentPath)}\`);
      } else {
        console.log(\`   📂 Loading from: \${path.basename(testDataPath)}\`);
      }
    }
    
    const fileContents = fs.readFileSync(actualPath, 'utf8');
    const data = JSON.parse(fileContents);
    
    if (data._changeLog && data._changeLog.length > 0) {
      const original = data._original || {};
      let current = { ...original };
      
      for (const change of data._changeLog) {
        Object.assign(current, change.delta);
      }
      
      Object.assign(data, current);
      console.log(\`   📊 Applied \${data._changeLog.length} changes from history\`);
      console.log(\`   🎯 Current state: \${data.status}\`);
    } else {
      console.log(\`   ✨ Fresh state loaded\`);
    }
    
    TestContext._transformDates(data);
    console.log('   ✅ Date transformation complete');
    
    const meta = ImplicationClass.xstateConfig?.meta || ImplicationClass.meta;
    
    if (meta?.entity) {
      const entity = meta.entity;
      console.log(\`   🔍 Entity-scoped implication: \${entity}\`);
      
      const entityData = data[entity] || {};
      const entityStatus = entityData.status || data[\`\${entity}.status\`] || null;
      
      if (entityStatus) {
        console.log(\`   ✅ Found entity status: \${entity}.status = \${entityStatus}\`);
        data._entityStatus = entityStatus;
        data._entity = entity;
      } else {
        console.log(\`   ⚠️  Entity \${entity} has no status field\`);
      }
    }
    
    return new TestContext(ImplicationClass, data, testDataPath);
  }

  static _transformDates(obj) {
    const moment = require('moment');
    
    function transform(value, key = '', parentKey = '') {
      if (!value) return value;
      
      if (typeof value === 'string' && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/.test(value)) {
        const momentObj = moment(value);
        console.log(\`   🔄 Transformed \${parentKey ? parentKey + '.' : ''}\${key}: moment object\`);
        return momentObj;
      }
      
      if (Array.isArray(value)) {
        return value.map((item, index) => transform(item, index, key));
      }
      
      if (typeof value === 'object' && value !== null) {
        const result = {};
        for (const [k, v] of Object.entries(value)) {
          result[k] = transform(v, k, parentKey ? \`\${parentKey}.\${key}\` : key);
        }
        return result;
      }
      
      return value;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      obj[key] = transform(value, key);
    }
    
    return obj;
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
    
    const masterPath = this.inputPath || testDataPath;
    if (masterPath && masterPath.includes('-master.') && fs.existsSync(masterPath)) {
      const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      Object.assign(originalData, masterData);
    }
    
    this._stripSessionFieldsFromObject(originalData);
    
    const sessionFields = TestContext.getSessionOnlyFields();
    const cleanedChangeLog = this.changeLog.map(change => {
      const cleanedDelta = { ...change.delta };
      
      for (const key of Object.keys(cleanedDelta)) {
        const fieldName = key.split('.').pop();
        if (sessionFields.includes(fieldName)) {
          delete cleanedDelta[key];
          console.log(\`   🔒 Stripped session field from delta: \${key}\`);
        }
      }
      
      return {
        ...change,
        delta: cleanedDelta
      };
    }).filter(change => Object.keys(change.delta).length > 0);
    
    const output = {
      _original: originalData,
      _changeLog: cleanedChangeLog
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
  
  getFromArray(arrayName, index) {
    if (!this.data[arrayName]) {
      console.warn(\`⚠️  Array '\${arrayName}' does not exist\`);
      return null;
    }
    return this.data[arrayName][index] || null;
  }
  
  setInArray(arrayName, index, value) {
    if (!this.data[arrayName]) {
      this.data[arrayName] = [];
    }
    this.data[arrayName][index] = value;
  }
  
  pushToArray(arrayName, value) {
    if (!this.data[arrayName]) {
      this.data[arrayName] = [];
    }
    this.data[arrayName].push(value);
    return this.data[arrayName].length - 1;
  }
  
  removeFromArray(arrayName, index) {
    if (!this.data[arrayName]) {
      console.warn(\`⚠️  Array '\${arrayName}' does not exist\`);
      return;
    }
    this.data[arrayName].splice(index, 1);
  }

  static getNestedValue(obj, path) {
    if (!path.includes('.')) {
      return obj[path];
    }
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (!current || !current.hasOwnProperty(part)) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }
  
  static setNestedValue(obj, path, value) {
    if (!path.includes('.')) {
      obj[path] = value;
      return;
    }
    
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  async executeAndSave(label, testFile, deltaFn) {
    const { delta } = await deltaFn();
    
    for (const [key, value] of Object.entries(delta)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let obj = this.data;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      } else {
        this.data[key] = value;
      }
    }
    
    this.changeLog.push({
      label,
      testFile,
      delta,
      timestamp: new Date().toISOString()
    });
    
    return this;
  }
}

module.exports = TestContext;
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE: ExpectImplication.js
// ═══════════════════════════════════════════════════════════════════════════

function getExpectImplicationTemplate() {
  // This is the full ExpectImplication from document index 7
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/ExpectImplication.js

const { expect } = require('@playwright/test');

class ExpectImplication {
  // ═══════════════════════════════════════════════════════════
  // STORED VALUES - For cross-step data passing (storeAs)
  // ═══════════════════════════════════════════════════════════
  static _capturedValues = {};
  
  /**
   * Store a value with a key (used by storeAs in actionDetails)
   */
  static storeValue(key, value) {
    this._capturedValues[key] = value;
    const preview = typeof value === 'object' 
      ? JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? '...' : '')
      : value;
    console.log(\`      💾 Stored: \${key} = \${preview}\`);
  }
  
  /**
   * Get a stored value by key
   */
  static getValue(key) {
    return this._capturedValues[key];
  }
  
  /**
   * Clear all captured values (call between tests)
   */
  static clearCapturedValues() {
    this._capturedValues = {};
    console.log('🗑️  Cleared captured values');
  }
  
  /**
   * Get all captured values (for debugging)
   */
  static getCapturedValues() {
    return { ...this._capturedValues };
  }

  // ═══════════════════════════════════════════════════════════
  // Get nested value - checks captured values first, then obj
  // ═══════════════════════════════════════════════════════════
  static getNestedValue(obj, path) {
    if (!path.includes('.')) {
      if (this._capturedValues[path] !== undefined) {
        return this._capturedValues[path];
      }
      return obj?.[path];
    }
    
    const parts = path.split('.');
    const firstPart = parts[0];
    
    // Check if first part is a captured value
    if (this._capturedValues[firstPart] !== undefined) {
      let current = this._capturedValues[firstPart];
      for (let i = 1; i < parts.length; i++) {
        if (current === null || current === undefined) return undefined;
        current = current[parts[i]];
      }
      return current;
    }
    
    // Fall back to obj
    let current = obj;
    for (const part of parts) {
      if (!current || !current.hasOwnProperty(part)) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  // ═══════════════════════════════════════════════════════════
  // Resolve {{variable}} template syntax
  // ═══════════════════════════════════════════════════════════
  static resolveTemplate(value, testData = {}) {
    // Handle non-strings
    if (typeof value !== 'string') {
      if (Array.isArray(value)) {
        return value.map(v => this.resolveTemplate(v, testData));
      }
      if (typeof value === 'object' && value !== null) {
        const resolved = {};
        for (const [k, v] of Object.entries(value)) {
          resolved[k] = this.resolveTemplate(v, testData);
        }
        return resolved;
      }
      return value;
    }
    
    // Check for simple case: entire string is a template
    const fullMatch = value.match(/^\\{\\{([^}]+)\\}\\}$/);
    if (fullMatch) {
      const path = fullMatch[1].trim();
      const result = this.getNestedValue(testData, path);
      if (result !== undefined) {
        console.log(\`      🔄 Resolved {{\${path}}} → \${JSON.stringify(result)}\`);
        return result;
      }
      console.warn(\`      ⚠️  Variable {{\${path}}} not found\`);
      return value;
    }
    
    // Replace all {{...}} in string
    return value.replace(/\\{\\{([^}]+)\\}\\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const result = this.getNestedValue(testData, trimmedPath);
      
      if (result === undefined || result === null) {
        console.warn(\`      ⚠️  Variable {{\${trimmedPath}}} not found\`);
        return match;
      }
      
      console.log(\`      🔄 Resolved {{\${trimmedPath}}} → \${result}\`);
      return String(result);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Parse field selector for array indexing
  // Supports: field, field[0], field[first], field[last], field[all], field[any]
  // ═══════════════════════════════════════════════════════════
  static _parseFieldSelector(fieldName) {
    const match = fieldName.match(/^(.+)\\[(\\d+|first|last|all|any)\\]$/);
    
    if (!match) {
      return { field: fieldName, index: null };
    }
    
    return {
      field: match[1],
      index: match[2] === 'first' ? 'first'
           : match[2] === 'last' ? 'last' 
           : match[2] === 'all' ? 'all'
           : match[2] === 'any' ? 'any'
           : parseInt(match[2], 10)
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Get locator with index support
  // ═══════════════════════════════════════════════════════════
  static async _getLocatorForField(screenObject, fieldName, page, isPlaywright) {
    const { field, index } = this._parseFieldSelector(fieldName);
    
    let baseLocator = screenObject[field];
    
    // Don't fallback to data-testid - the getter should exist in the POM!
    if (!baseLocator) {
      throw new Error(\`Field "\${field}" not found on screen object. Check that the getter exists in your POM.\`);
    }
    
    if (index === null) {
      return { locator: baseLocator, mode: 'single', field, index };
    } else if (index === 'first') {
      return { locator: baseLocator.first(), mode: 'single', field, index };
    } else if (index === 'last') {
      return { locator: baseLocator.last(), mode: 'single', field, index };
    } else if (index === 'all') {
      return { locator: baseLocator, mode: 'all', field, index };
    } else if (index === 'any') {
      return { locator: baseLocator, mode: 'any', field, index };
    } else {
      return { locator: baseLocator.nth(index), mode: 'single', field, index };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Check visible with array support
  // ═══════════════════════════════════════════════════════════
  static async _checkVisibleWithIndex(screenObject, elementName, page, isPlaywright) {
    const { locator, mode, field, index } = await this._getLocatorForField(
      screenObject, elementName, page, isPlaywright
    );
    
    const indexLabel = index !== null ? \`[\${index}]\` : '';
    
    if (mode === 'single') {
      if (isPlaywright) {
        await expect(locator).toBeVisible({ timeout: 10000 });
      } else {
        await expect(locator).toBeDisplayed();
      }
      console.log(\`      ✓ \${field}\${indexLabel} is visible\`);
      
    } else if (mode === 'all') {
      const elements = await locator.all();
      if (elements.length === 0) {
        throw new Error(\`\${field}[all] - no elements found\`);
      }
      for (let i = 0; i < elements.length; i++) {
        await expect(elements[i]).toBeVisible({ timeout: 10000 });
      }
      console.log(\`      ✓ \${field}[all] - all \${elements.length} elements are visible\`);
      
    } else if (mode === 'any') {
      const count = await locator.count();
      if (count === 0) {
        throw new Error(\`\${field}[any] - no elements found\`);
      }
      await expect(locator.first()).toBeVisible({ timeout: 10000 });
      console.log(\`      ✓ \${field}[any] - at least one of \${count} elements is visible\`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Check hidden with array support
  // ═══════════════════════════════════════════════════════════
  static async _checkHiddenWithIndex(screenObject, elementName, page, isPlaywright) {
    const { locator, mode, field, index } = await this._getLocatorForField(
      screenObject, elementName, page, isPlaywright
    );
    
    const indexLabel = index !== null ? \`[\${index}]\` : '';
    
    if (mode === 'single') {
      if (isPlaywright) {
        const count = await locator.count();
        if (count === 0) {
          console.log(\`      ✓ \${field}\${indexLabel} doesn't exist (counts as hidden)\`);
          return;
        }
        await expect(locator).not.toBeVisible();
      } else {
        const exists = await locator.isExisting();
        if (!exists) {
          console.log(\`      ✓ \${field}\${indexLabel} doesn't exist (counts as hidden)\`);
          return;
        }
        await expect(locator).not.toBeDisplayed();
      }
      console.log(\`      ✓ \${field}\${indexLabel} is hidden\`);
      
    } else if (mode === 'all') {
      const elements = await locator.all();
      if (elements.length === 0) {
        console.log(\`      ✓ \${field}[all] - no elements exist (counts as hidden)\`);
        return;
      }
      for (let i = 0; i < elements.length; i++) {
        await expect(elements[i]).not.toBeVisible();
      }
      console.log(\`      ✓ \${field}[all] - all \${elements.length} elements are hidden\`);
      
    } else if (mode === 'any') {
      const count = await locator.count();
      if (count === 0) {
        console.log(\`      ✓ \${field}[any] - no elements exist (counts as hidden)\`);
        return;
      }
      await expect(locator.first()).not.toBeVisible();
      console.log(\`      ✓ \${field}[any] - at least one element is hidden\`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Boolean function checks - truthy
  // ═══════════════════════════════════════════════════════════
  static async _checkTruthy(screenObject, functionName) {
    if (typeof screenObject[functionName] !== 'function') {
      throw new Error(\`"\${functionName}" is not a function on screen object\`);
    }
    
    const result = await screenObject[functionName]();
    expect(result, \`Expected \${functionName}() to be truthy, got: \${result}\`).toBeTruthy();
    console.log(\`      ✓ \${functionName}() is truthy (returned: \${result})\`);
  }

  // ═══════════════════════════════════════════════════════════
  // Boolean function checks - falsy
  // ═══════════════════════════════════════════════════════════
  static async _checkFalsy(screenObject, functionName) {
    if (typeof screenObject[functionName] !== 'function') {
      throw new Error(\`"\${functionName}" is not a function on screen object\`);
    }
    
    const result = await screenObject[functionName]();
    expect(result, \`Expected \${functionName}() to be falsy, got: \${result}\`).toBeFalsy();
    console.log(\`      ✓ \${functionName}() is falsy (returned: \${result})\`);
  }

  // ═══════════════════════════════════════════════════════════
  // Advanced assertions with template resolution
  // ═══════════════════════════════════════════════════════════
  static async _checkAssertion(screenObject, assertion, testData = {}) {
    const { fn, expect: expectType, value, params = {}, tolerance } = assertion;
    
    if (typeof screenObject[fn] !== 'function') {
      throw new Error(\`"\${fn}" is not a function on screen object\`);
    }
    
    const resolvedParams = this.resolveTemplate(params, testData);
    const paramValues = Object.values(resolvedParams);
    
    const result = paramValues.length > 0 
      ? await screenObject[fn](...paramValues)
      : await screenObject[fn]();
    
    const resolvedValue = this.resolveTemplate(value, testData);
    
    switch (expectType) {
      case 'toBe':
      case 'equals':
      case 'strictEquals':
        expect(result).toBe(resolvedValue);
        console.log(\`      ✓ \${fn}() toBe \${resolvedValue} (got: \${result})\`);
        break;
      case 'toEqual':
        expect(result).toEqual(resolvedValue);
        console.log(\`      ✓ \${fn}() toEqual \${JSON.stringify(resolvedValue)} (got: \${JSON.stringify(result)})\`);
        break;
      case 'toBeGreaterThan':
      case 'greaterThan':
        expect(result).toBeGreaterThan(resolvedValue);
        console.log(\`      ✓ \${fn}() > \${resolvedValue} (got: \${result})\`);
        break;
      case 'toBeGreaterThanOrEqual':
      case 'greaterThanOrEqual':
        expect(result).toBeGreaterThanOrEqual(resolvedValue);
        console.log(\`      ✓ \${fn}() >= \${resolvedValue} (got: \${result})\`);
        break;
      case 'toBeLessThan':
      case 'lessThan':
        expect(result).toBeLessThan(resolvedValue);
        console.log(\`      ✓ \${fn}() < \${resolvedValue} (got: \${result})\`);
        break;
      case 'toBeLessThanOrEqual':
      case 'lessThanOrEqual':
        expect(result).toBeLessThanOrEqual(resolvedValue);
        console.log(\`      ✓ \${fn}() <= \${resolvedValue} (got: \${result})\`);
        break;
      case 'toContain':
      case 'contains':
        expect(result).toContain(resolvedValue);
        console.log(\`      ✓ \${fn}() contains "\${resolvedValue}" (got: \${result})\`);
        break;
      case 'toMatch':
      case 'matches':
        expect(result).toMatch(resolvedValue);
        console.log(\`      ✓ \${fn}() matches \${resolvedValue} (got: \${result})\`);
        break;
      case 'toBeDefined':
        expect(result).toBeDefined();
        console.log(\`      ✓ \${fn}() is defined (got: \${result})\`);
        break;
      case 'toBeUndefined':
        expect(result).toBeUndefined();
        console.log(\`      ✓ \${fn}() is undefined\`);
        break;
      case 'toBeNull':
        expect(result).toBeNull();
        console.log(\`      ✓ \${fn}() is null\`);
        break;
      case 'toBeTruthy':
        expect(result).toBeTruthy();
        console.log(\`      ✓ \${fn}() is truthy (got: \${result})\`);
        break;
      case 'toBeFalsy':
        expect(result).toBeFalsy();
        console.log(\`      ✓ \${fn}() is falsy (got: \${result})\`);
        break;
      case 'toHaveLength':
      case 'hasLength':
        expect(result).toHaveLength(resolvedValue);
        console.log(\`      ✓ \${fn}() has length \${resolvedValue} (got: \${result?.length})\`);
        break;
      case 'notEquals':
        expect(result).not.toBe(resolvedValue);
        console.log(\`      ✓ \${fn}() !== \${resolvedValue} (got: \${result})\`);
        break;
      case 'notContains':
        expect(result).not.toContain(resolvedValue);
        console.log(\`      ✓ \${fn}() not contains "\${resolvedValue}" (got: \${result})\`);
        break;
      case 'startsWith':
        expect(String(result).startsWith(resolvedValue)).toBe(true);
        console.log(\`      ✓ \${fn}() starts with "\${resolvedValue}" (got: \${result})\`);
        break;
      case 'endsWith':
        expect(String(result).endsWith(resolvedValue)).toBe(true);
        console.log(\`      ✓ \${fn}() ends with "\${resolvedValue}" (got: \${result})\`);
        break;
      case 'closeTo':
        const tol = tolerance || 0.01;
        expect(Math.abs(Number(result) - Number(resolvedValue))).toBeLessThanOrEqual(tol);
        console.log(\`      ✓ \${fn}() ≈ \${resolvedValue} (got: \${result}, tolerance: \${tol})\`);
        break;
      default:
        throw new Error(\`Unknown assertion type: \${expectType}\`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Execute functions with storeAs support
  // ═══════════════════════════════════════════════════════════
  static async _executeFunctions(functions, screenObject, testData = {}) {
    if (!functions || Object.keys(functions).length === 0) {
      return;
    }
    
    console.log(\`   ⚡ Executing \${Object.keys(functions).length} function(s)...\`);
    
    for (const [funcName, funcConfig] of Object.entries(functions)) {
      try {
        const { parameters = {}, params = {}, storeAs, signature } = funcConfig;
        
        const funcParams = Object.keys(parameters).length > 0 ? parameters : params;
        
        const fn = screenObject[funcName];
        if (typeof fn !== 'function') {
          console.warn(\`      ⚠️  Function \${funcName} not found on screen, skipping...\`);
          continue;
        }
        
        const resolvedParams = this.resolveTemplate(funcParams, testData);
        const paramValues = Object.values(resolvedParams);
        
        const displayName = signature || funcName;
        const paramsDisplay = paramValues.length > 0 
          ? \`(\${paramValues.map(v => JSON.stringify(v)).join(', ')})\`
          : '()';
        
        console.log(\`      ▶ \${displayName}\${paramsDisplay}\`);
        
        const result = paramValues.length > 0
          ? await fn.call(screenObject, ...paramValues)
          : await fn.call(screenObject);
        
        if (storeAs) {
          this.storeValue(storeAs, result);
        } else {
          console.log(\`      ✅ \${funcName} completed\`);
        }
        
      } catch (error) {
        console.error(\`      ❌ \${funcName} failed: \${error.message}\`);
        throw error;
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // Main validation method
  // ═══════════════════════════════════════════════════════════
  static async validateImplications(screenDef, testData, screenObject) {
    if (!screenDef || screenDef.length === 0) {
      console.log('   ⚠️  No screen definition to validate');
      return;
    }
    
    const def = Array.isArray(screenDef) ? screenDef[0] : screenDef;
    
    console.log(\`\\n   🔍 Validating screen: \${def.name || 'unnamed'}\`);
    console.log('   ' + '─'.repeat(47));
    
    const isPlaywright = screenObject.page !== undefined;
    const page = screenObject.page || screenObject;
    
    const getElement = async (elementName) => {
      if (screenObject[elementName]) {
        return screenObject[elementName];
      }
      if (isPlaywright) {
        return page.locator(\`[data-testid="\${elementName}"]\`);
      }
      return null;
    };
    
    const checkText = async (element, elementName, expectedText) => {
      if (isPlaywright) {
        await expect(element).toHaveText(expectedText, { timeout: 10000 });
      } else {
        await expect(element).toHaveText(expectedText);
      }
      console.log(\`      ✓ \${elementName} has text: "\${expectedText}"\`);
    };
    
    // Prerequisites
    if (def.prerequisites && def.prerequisites.length > 0) {
      console.log(\`   🔧 Running \${def.prerequisites.length} prerequisites...\`);
      for (const prereq of def.prerequisites) {
        console.log(\`      \${prereq.description}\`);
        await prereq.setup(testData, page);
      }
      console.log('   ✅ Prerequisites completed');
    }

    // Execute functions (with storeAs) FIRST
    if (def.functions && Object.keys(def.functions).length > 0) {
      await this._executeFunctions(def.functions, screenObject, testData);
    }
    
    // Visible checks
    if (def.visible && def.visible.length > 0) {
      console.log(\`   ✅ Checking \${def.visible.length} visible elements...\`);
      for (const elementName of def.visible) {
        try {
          await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
        } catch (error) {
          console.error(\`      ✗ \${elementName} NOT visible: \${error.message}\`);
          throw new Error(\`Visibility check failed for \${elementName}\`);
        }
      }
    }
    
    // Hidden checks
    if (def.hidden && def.hidden.length > 0) {
      console.log(\`   ✅ Checking \${def.hidden.length} hidden elements...\`);
      for (const elementName of def.hidden) {
        try {
          await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
        } catch (error) {
          console.error(\`      ✗ \${elementName} NOT hidden: \${error.message}\`);
          throw new Error(\`Hidden check failed for \${elementName}\`);
        }
      }
    }

    // Truthy function checks
    if (def.truthy && def.truthy.length > 0) {
      console.log(\`   ✅ Checking \${def.truthy.length} truthy functions...\`);
      for (const functionName of def.truthy) {
        try {
          await this._checkTruthy(screenObject, functionName);
        } catch (error) {
          console.error(\`      ✗ \${functionName}() NOT truthy: \${error.message}\`);
          throw new Error(\`Truthy check failed for \${functionName}()\`);
        }
      }
    }

    // Falsy function checks
    if (def.falsy && def.falsy.length > 0) {
      console.log(\`   ✅ Checking \${def.falsy.length} falsy functions...\`);
      for (const functionName of def.falsy) {
        try {
          await this._checkFalsy(screenObject, functionName);
        } catch (error) {
          console.error(\`      ✗ \${functionName}() NOT falsy: \${error.message}\`);
          throw new Error(\`Falsy check failed for \${functionName}()\`);
        }
      }
    }

    // Advanced assertions
    if (def.assertions && def.assertions.length > 0) {
      console.log(\`   ✅ Running \${def.assertions.length} assertions...\`);
      for (const assertion of def.assertions) {
        try {
          await this._checkAssertion(screenObject, assertion, testData);
        } catch (error) {
          console.error(\`      ✗ Assertion \${assertion.fn}() \${assertion.expect} failed: \${error.message}\`);
          throw new Error(\`Assertion failed: \${assertion.fn}() \${assertion.expect} \${assertion.value ?? ''}\`);
        }
      }
    }
    
    // Legacy: checks object
    if (def.checks) {
      console.log('   🔍 Running additional checks...');
      
      if (def.checks.visible && def.checks.visible.length > 0) {
        for (const elementName of def.checks.visible) {
          await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
        }
      }
      
      if (def.checks.hidden && def.checks.hidden.length > 0) {
        for (const elementName of def.checks.hidden) {
          await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
        }
      }
      
      // Exact text match
      if (def.checks.text && Object.keys(def.checks.text).length > 0) {
        for (const [elementName, expectedText] of Object.entries(def.checks.text)) {
          const element = await getElement(elementName);
          const finalText = this.resolveTemplate(expectedText, testData);
          await checkText(element, elementName, finalText);
        }
      }
      
      // Contains text (partial match)
      if (def.checks.contains && Object.keys(def.checks.contains).length > 0) {
        console.log(\`      Checking \${Object.keys(def.checks.contains).length} text contains...\`);
        for (const [elementName, expectedText] of Object.entries(def.checks.contains)) {
          try {
            const element = await getElement(elementName);
            const finalText = this.resolveTemplate(expectedText, testData);
            
            if (isPlaywright) {
              await expect(element).toContainText(finalText, { timeout: 10000 });
            } else {
              const actualText = await element.getText();
              expect(actualText).toContain(finalText);
            }
            console.log(\`      ✓ \${elementName} contains: "\${finalText}"\`);
          } catch (error) {
            console.error(\`      ✗ \${elementName} does NOT contain expected text: \${error.message}\`);
            throw new Error(\`Contains check failed for \${elementName}\`);
          }
        }
      }
    }
    
    // Custom expect function
    if (def.expect && typeof def.expect === 'function') {
      console.log('   🎯 Running custom expect function...');
      await def.expect(testData, page);
      console.log('   ✅ Custom expect passed');
    }
    
    console.log(\`   ✅ All validations passed for \${def.name || 'screen'}\`);
    console.log('   ' + '─'.repeat(47));
  }
}

module.exports = ExpectImplication;
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE: ImplicationsHelper.js
// ═══════════════════════════════════════════════════════════════════════════

function getImplicationsHelperTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/implications/ImplicationsHelper.js

class ImplicationsHelper {
  
  static mergeWithBase(baseConfig, statusConfig, options = {}) {
    const {
      appendPrerequisites = false,
      parentClass = null
    } = options;
    
    let prerequisites;
    if (statusConfig.prerequisites) {
      if (appendPrerequisites) {
        const basePrereqs = baseConfig.prerequisites || [];
        prerequisites = [...basePrereqs, ...statusConfig.prerequisites];
      } else {
        prerequisites = statusConfig.prerequisites;
      }
    } else {
      prerequisites = baseConfig.prerequisites;
    }
    
    const screen = statusConfig.screen || baseConfig.screen;
    
    const checks = {};
    
    if (statusConfig.text || baseConfig.defaultText) {
      checks.text = {
        ...(baseConfig.defaultText || {}),
        ...(statusConfig.text || {})
      };
    }
    
    const alwaysVisible = baseConfig.alwaysVisible || [];
    const sometimesVisible = baseConfig.sometimesVisible || [];
    const baseVisible = baseConfig.visible || [];
    const baseHidden = baseConfig.hidden || [];
    const statusVisible = statusConfig.visible || [];
    const statusHidden = statusConfig.hidden || [];
    
    let finalVisible = [
      ...alwaysVisible,
      ...sometimesVisible,
      ...baseVisible,
      ...statusVisible
    ];
    
    const finalHidden = [
      ...baseHidden,
      ...statusHidden
    ];
    
    finalVisible = finalVisible.filter(item => !finalHidden.includes(item));
    
    if (finalVisible.length > 0) {
      checks.visible = [...new Set(finalVisible)];
    }
    
    if (finalHidden.length > 0) {
      checks.hidden = [...new Set(finalHidden)];
    }
    
    if (statusConfig.checks) {
      Object.assign(checks, statusConfig.checks);
    }
    
    return {
      screen,
      description: statusConfig.description || baseConfig.description,
      ...(prerequisites && { prerequisites }),
      checks,
      ...(statusConfig.expect && { expect: statusConfig.expect })
    };
  }
}

module.exports = ImplicationsHelper;
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE: ai-testing.config.js
// ═══════════════════════════════════════════════════════════════════════════

function getConfigTemplate(projectPath) {
  const projectName = path.basename(projectPath);
  
  return `// Auto-generated by Implications Framework
module.exports = {
  // ═══════════════════════════════════════════════════════════
  // PROJECT INFO
  // ═══════════════════════════════════════════════════════════
  projectName: "${projectName}",
  projectRoot: __dirname,
  
  // ═══════════════════════════════════════════════════════════
  // PATHS
  // ═══════════════════════════════════════════════════════════
  utilsPath: "tests/ai-testing/utils",
  outputPath: "tests/implications",
  testDataPath: "tests/data/shared.json",
  
  // ═══════════════════════════════════════════════════════════
  // TEST RUNNER CONFIGURATION
  // ═══════════════════════════════════════════════════════════
  testRunner: "playwright",  // 'playwright' | 'webdriverio' | 'cypress'
  testDataMode: "stateful",  // 'stateful' | 'stateless'
  
  // ═══════════════════════════════════════════════════════════
  // PLATFORMS
  // ═══════════════════════════════════════════════════════════
  platforms: ["web"],
  
  // ═══════════════════════════════════════════════════════════
  // DISCOVERY PATTERNS (glob patterns relative to projectRoot)
  // ═══════════════════════════════════════════════════════════
  patterns: {
    implications: ["tests/implications/**/*Implications.js"],
    tests: ["tests/**/*.spec.js"],
    poms: ["tests/screenObjects/**/*.js"]
  },
  
  // ═══════════════════════════════════════════════════════════
  // GENERATION OPTIONS
  // ═══════════════════════════════════════════════════════════
  generation: {
    skipTestRegistration: false,
    autoValidateUI: true,
    extractActions: true
  },

  // ═══════════════════════════════════════════════════════════
  // SESSION & PREREQUISITES - Controls login/auth behavior
  // ═══════════════════════════════════════════════════════════

  /**
   * Session-only fields - NEVER saved to JSON, reset each test run
   * 
   * These fields exist in memory during test execution but are stripped
   * before saving to JSON. This ensures each test session starts fresh.
   * 
   * Examples:
   * - 'logged_in' strips dancer.logged_in, club.logged_in, manager.logged_in
   * - 'app_opened' strips dancer.app_opened, club.app_opened, etc.
   * - 'session_ready' strips any platform's session_ready flag
   */
  sessionOnlyFields: [
    'logged_in',
    'app_opened',
    'session_ready',
  ],

  /**
   * Platform prerequisites - auto-run before any test on that platform
   * 
   * Each platform can define a prerequisite that must be satisfied before
   * running tests. TestPlanner auto-executes these if needed.
   * 
   * Structure:
   * {
   *   check: (data) => boolean,  // Function to check if prerequisite met
   *   state: string,              // State name for this prerequisite
   *   file: string,               // Path to test file that satisfies it
   *   actionName: string          // Function name to call
   * }
   */
  platformPrerequisites: {
    web: {
      check: (data) => data.manager?.logged_in === true,
      state: 'manager_logged_in',
      file: 'tests/implications/login/LoggedInViaInitial-LOGIN-Web-UNIT.spec.js',
      actionName: 'loggedInViaInitial'
    }
    // Add more platforms as needed:
    // dancer: { ... },
    // clubApp: { ... },
    // mobile: { ... }
  }
};
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE: README.md
// ═══════════════════════════════════════════════════════════════════════════

function getReadmeTemplate() {
  return `# AI Testing Framework

Auto-generated testing utilities for the Implications Framework.

## Quick Start

\`\`\`bash
# Run a test with preflight check (interactive requires mismatch fixing)
npm run test:impl -- tests/implications/path/to/Test.spec.js --project=chromium --headed

# Or directly
node run-test.js tests/implications/path/to/Test.spec.js --project=chromium --headed
\`\`\`

## Files Generated

| File | Description |
|------|-------------|
| \`TestContext.js\` | Test data management with delta files |
| \`TestPlanner.js\` | Prerequisite validation with auto-execution (v4.2) |
| \`ExpectImplication.js\` | UI validation engine |
| \`ImplicationsHelper.js\` | Base class merging utilities |
| \`run-test.js\` | Preflight wrapper for interactive requires checking |
| \`ai-testing.config.js\` | Project configuration |

## Features

- **Preflight Requires Check**: Interactive countdown before tests to fix data mismatches
- **Cross-Platform Support**: Auto-execute web/mobile prerequisites
- **Delta Files**: Track state changes without modifying master data
- **Session-Only Fields**: Auto-strip login states between test runs

Generated: ${new Date().toISOString()}
Version: 4.2
`;
}

/**
 * Returns the complete TestPlanner.js template (v4.2)
 * For use in init.js
 */
function getTestPlannerTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/TestPlanner.js
// Version: 4.2 - Multi-Platform, Loop Transitions, Requires Mismatch Detection
// 
// CHANGELOG from v3.0:
// - Fixed _extractEventFromFilename (was breaking uppercase events)
// - Added loop transition support
// - Added _findSetupEntry with requires matching
// - Added requires mismatch warning system
// - Added _clearDataCaches helper
// - Better _selectTransition with requires checking
// - Added PREFLIGHT_COMPLETED environment check
// - Fixed cache clearing on module load

// NUCLEAR CACHE CLEAR - Ensures fresh implication loads
const implCacheKeys = Object.keys(require.cache).filter(k => 
  k.includes('Implications') || k.includes('implications')
);
implCacheKeys.forEach(key => delete require.cache[key]);

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class TestPlanner {
  
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose ?? true,
      config: options.config || null,
      stateRegistry: options.stateRegistry || null
    };
    
    if (!this.options.stateRegistry) {
      this.stateRegistry = this.loadStateRegistry();
    } else {
      this.stateRegistry = this.options.stateRegistry;
    }
  }
  
  loadStateRegistry() {
    try {
      const REGISTRY_PATH = path.join(process.cwd(), 'tests/implications/.state-registry.json');
      
      if (fs.existsSync(REGISTRY_PATH)) {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        if (this.options.verbose) {
          console.log(\`📋 Loaded state registry: \${REGISTRY_PATH}\`);
          console.log(\`   Total entries: \${Object.keys(registry).length}\`);
        }
        return registry;
      }
      
      if (this.options.verbose) {
        console.log('⚠️  No state registry found at:', REGISTRY_PATH);
      }
      return {};
      
    } catch (error) {
      if (this.options.verbose) {
        console.log(\`⚠️  Error loading state registry: \${error.message}\`);
      }
      return {};
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Get current status from testData
  // ═══════════════════════════════════════════════════════════
  static _getCurrentStatus(testData, targetImplication = null) {
    const meta = targetImplication?.xstateConfig?.meta || targetImplication?.meta;
    
    if (meta?.entity) {
      const entity = meta.entity;
      const entityStatus = testData[entity]?.status || null;
      
      if (entityStatus) {
        return entityStatus;
      }
    }
    
    return testData.status || testData._currentStatus || 'initial';
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Find the setup entry for the current test
  // Supports multiple setup entries with different requires
  // ═══════════════════════════════════════════════════════════
  static _findSetupEntry(meta, options = {}) {
    const { currentTestFile, explicitEvent, testData } = options;
    
    if (!meta.setup || meta.setup.length === 0) {
      return null;
    }
    
    // Match by exact test file path (comparing basenames)
    if (currentTestFile) {
      const currentBasename = path.basename(currentTestFile);
      const entry = meta.setup.find(s => {
        if (!s.testFile) return false;
        return path.basename(s.testFile) === currentBasename;
      });
      if (entry) {
        return entry;
      }
    }
    
    // If we have an explicit event, find matching entry
    if (explicitEvent) {
      const entry = meta.setup.find(s => {
        if (!s.testFile) return false;
        const normalizedEvent = explicitEvent.replace(/_/g, '');
        return s.testFile.toUpperCase().includes(normalizedEvent);
      });
      if (entry) return entry;
    }
    
    // Check requires against testData to pick the right path
    if (testData && meta.setup.length > 1) {
      for (const entry of meta.setup) {
        if (entry.requires) {
          let allMet = true;
          
          for (const [field, requiredValue] of Object.entries(entry.requires)) {
            const actualValue = field.includes('.')
              ? field.split('.').reduce((obj, key) => obj?.[key], testData)
              : testData[field];
            
            if (actualValue !== requiredValue) {
              allMet = false;
              break;
            }
          }
          
          if (allMet) {
            return entry;
          }
        }
      }
      
      // Fall back to entry WITHOUT requires (default path)
      const defaultEntry = meta.setup.find(s => !s.requires);
      if (defaultEntry) {
        return defaultEntry;
      }
    }
    
    // Default to first entry
    return meta.setup[0];
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Get previousStatus from setup entry or meta.requires
  // ═══════════════════════════════════════════════════════════
  static _getPreviousStatus(meta, options = {}) {
    const setupEntry = TestPlanner._findSetupEntry(meta, options);
    
    if (setupEntry?.previousStatus) {
      return setupEntry.previousStatus;
    }
    
    return meta.requires?.previousStatus || null;
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Extract event from filename (FIXED!)
  // ═══════════════════════════════════════════════════════════
  static _extractEventFromFilename(testFile) {
    if (!testFile) return null;
    
    const basename = path.basename(testFile);
    // Pattern: SomethingViaSomething-EVENT-Platform-UNIT.spec.js
    const parts = basename.split('-');
    
    if (parts.length < 4) return null;
    
    // EVENT is typically the second part (after XxxViaYyy)
    // Find the part that looks like an event (all caps or camelCase action word)
    const eventPart = parts[1]; // Usually the event
    
    if (!eventPart) return null;
    
    // If already has underscores, return as-is (uppercase)
    if (eventPart.includes('_')) {
      return eventPart.toUpperCase();
    }
    
    // If already all uppercase, return as-is (e.g., REQUESTBOOKING -> REQUEST_BOOKING)
    if (eventPart === eventPart.toUpperCase()) {
      // Insert underscores between word boundaries
      // REQUESTBOOKING -> REQUEST_BOOKING
      const words = [];
      const commonWords = [
        'REQUEST', 'BOOKING', 'CREATE', 'DELETE', 'UPDATE', 'VIEW', 'SELECT',
        'CLICK', 'SUBMIT', 'CANCEL', 'UNDO', 'SAVE', 'LOAD', 'GET', 'SET',
        'ADD', 'REMOVE', 'OPEN', 'CLOSE', 'SIGN', 'LOG', 'SEARCH', 'FILTER',
        'SORT', 'EDIT', 'CONFIRM', 'ACCEPT', 'REJECT', 'APPROVE', 'DENY',
        'FLIGHT', 'AGENCY', 'DETAILS', 'RESULTS', 'FARES', 'LOGIN', 'LOGOUT',
        'IN', 'OUT', 'UP', 'DOWN', 'ON', 'OFF', 'ALL', 'NONE', 'INVITE',
        'DANCER', 'CLUB', 'MANAGER', 'PUBLISH', 'DRAFT'
      ];
      
      let remaining = eventPart;
      
      while (remaining.length > 0) {
        let matched = false;
        
        // Sort by length descending to match longer words first
        for (const word of commonWords.sort((a, b) => b.length - a.length)) {
          if (remaining.startsWith(word)) {
            words.push(word);
            remaining = remaining.slice(word.length);
            matched = true;
            break;
          }
        }
        
        if (!matched) {
          // No known word found, take the rest as-is
          words.push(remaining);
          break;
        }
      }
      
      return words.join('_');
    }
    
    // CamelCase to SNAKE_CASE
    return eventPart
      .replace(/([a-z])([A-Z])/g, '\$1_\$2')
      .toUpperCase();
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Check if two platforms are different
  // ═══════════════════════════════════════════════════════════
  static _isDifferentPlatform(platform1, platform2) {
    const normalize = (p) => {
      if (!p) return 'unknown';
      p = p.toLowerCase();
      if (p === 'playwright' || p === 'web' || p === 'cms') return 'web';
      if (p === 'dancer' || p === 'clubapp' || p === 'club' || p === 'mobile' || p === 'webdriverio') return 'mobile';
      return p;
    };
    
    return normalize(platform1) !== normalize(platform2);
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Clear data-related caches
  // ═══════════════════════════════════════════════════════════
  static _clearDataCaches() {
    Object.keys(require.cache).forEach(key => {
      if (key.includes('/tests/data/') || 
          key.includes('shared') ||
          key.includes('TestContext') ||
          key.includes('Implications.js')) {
        delete require.cache[key];
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Merge _changeLog into data
  // ═══════════════════════════════════════════════════════════
  static _mergeChangeLog(rawData) {
    if (!rawData._changeLog || !rawData._original) {
      return rawData;
    }
    
    const merged = { ...rawData._original };
    
    for (const change of rawData._changeLog) {
      if (change.delta) {
        Object.assign(merged, change.delta);
      }
    }
    
    return merged;
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYZE - Main entry point for prerequisite analysis
  // ═══════════════════════════════════════════════════════════
  analyze(ImplicationClass, testData, options = {}) {
    const xstateConfig = ImplicationClass.xstateConfig || {};
    const meta = xstateConfig.meta || {};
    
    const targetStatus = meta.status;
    const currentStatus = TestPlanner._getCurrentStatus(testData, ImplicationClass);
    
    const previousStatus = TestPlanner._getPreviousStatus(meta, { ...options, testData });
    
    if (this.options.verbose) {
      console.log(\`\\n🔍 TestPlanner: Analyzing \${targetStatus} state\`);
      console.log(\`   Current: \${currentStatus}\`);
      console.log(\`   Target: \${targetStatus}\`);
      if (previousStatus) {
        console.log(\`   Required previous: \${previousStatus}\`);
      }
    }
    
    const chain = this.buildPrerequisiteChain(
      ImplicationClass, 
      currentStatus, 
      targetStatus, 
      new Set(), 
      true, 
      testData, 
      options
    );
    
    const missingFields = this.findMissingFields(meta, testData);
    
    const entityFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && fieldName.endsWith('.status');
    });

    const regularFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && !fieldName.endsWith('.status');
    });
    
    // Check for loop transition
    const isLoopTransition = targetStatus === currentStatus && 
                             previousStatus && 
                             previousStatus !== currentStatus;
    
    const ready = this.isReady(chain, currentStatus, isLoopTransition) && regularFields.length === 0;
    const nextStep = ready ? null : this.findNextStep(chain, currentStatus);
    const stepsRemaining = chain.filter(step => !step.complete).length;
    
    const analysis = {
      ready,
      currentStatus,
      targetStatus,
      previousStatus,
      isLoopTransition,
      missingFields,
      entityFields,
      regularFields,
      chain,
      nextStep,
      stepsRemaining
    };
    
    if (this.options.verbose) {
      console.log(\`   Ready: \${analysis.ready ? '✅' : '❌'}\`);
      if (isLoopTransition) {
        console.log(\`   🔄 Loop transition: \${currentStatus} → ... → \${previousStatus} → \${targetStatus}\`);
      }
      if (!analysis.ready) {
        console.log(\`   Missing steps: \${stepsRemaining}\`);
        if (regularFields.length > 0) {
          console.log(\`   Missing fields: \${regularFields.map(f => typeof f === 'string' ? f : f.field).join(', ')}\`);
        }
        if (entityFields.length > 0) {
          console.log(\`   Entity status fields (auto-resolvable): \${entityFields.map(f => typeof f === 'string' ? f : f.field).join(', ')}\`);
        }
      }
    }
    
    return analysis;
  }

  // ═══════════════════════════════════════════════════════════
  // BUILD PREREQUISITE CHAIN
  // ═══════════════════════════════════════════════════════════
  buildPrerequisiteChain(ImplicationClass, currentStatus, targetStatus, visited = new Set(), isOriginalTarget = true, testData = null, options = {}) {
    // Handle string class names
    if (typeof ImplicationClass === 'string') {
      const implPath = this.findImplicationFile(ImplicationClass);
      if (implPath) {
        this._clearImplicationCache(implPath);
        ImplicationClass = require(implPath);
      }
    }
    
    const chain = [];
    
    const xstateConfig = ImplicationClass.xstateConfig || {};
    const meta = xstateConfig.meta || {};
    
    const previousStatus = TestPlanner._getPreviousStatus(meta, { ...options, testData });
    
    // Check for loop transition
    const isLoopTransition = isOriginalTarget && 
                             previousStatus && 
                             previousStatus !== targetStatus;
    
    // Circular dependency check with loop transition exception
    if (visited.has(targetStatus)) {
      const isLoopPassThrough = options.loopTarget === targetStatus;
      
      if (isLoopPassThrough) {
        if (this.options.verbose) {
          console.log(\`   🔄 Loop prerequisite: \${targetStatus} (first occurrence)\`);
        }
        
        const setupEntry = TestPlanner._findSetupEntry(meta, { ...options, testData });
        
        chain.push({
          status: targetStatus,
          className: ImplicationClass.name,
          actionName: setupEntry?.actionName || meta.setup?.[0]?.actionName || 'unknown',
          testFile: setupEntry?.testFile || meta.setup?.[0]?.testFile || 'unknown',
          platform: setupEntry?.platform || meta.platform || 'unknown',
          complete: currentStatus === targetStatus,
          isCurrent: currentStatus === targetStatus,
          isTarget: false,
          isLoopPrerequisite: true,
          entity: meta.entity,
          previousStatus: previousStatus
        });
        
        return chain;
      }
      
      console.warn(\`⚠️  Circular dependency detected for \${targetStatus}\`);
      return chain;
    }
    
    visited.add(targetStatus);
    
    // Check for direct transition
    const directTransition = this._findDirectTransition(targetStatus, currentStatus);

    if (directTransition && isOriginalTarget && this.options.verbose) {
      console.log(\`   ✅ Direct transition: \${currentStatus} → \${targetStatus} (\${directTransition.event})\`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // GLOBAL STATUS REQUIREMENTS
    // ═══════════════════════════════════════════════════════════
    if (meta.requires && testData) {
      for (const [field, requiredValue] of Object.entries(meta.requires)) {
        if (field === 'previousStatus') continue;
        if (field.startsWith('!')) continue;
        
        // Global status requirement
        if (field === 'status' && typeof requiredValue === 'string' && this.stateRegistry[requiredValue]) {
          const globalStatus = testData.status || testData._currentStatus || 'initial';
          
          if (globalStatus !== requiredValue) {
            if (this.options.verbose) {
              console.log(\`   🔍 Found global status requirement: status must be \${requiredValue}\`);
            }
            
            const globalImplClassName = this.stateRegistry[requiredValue];
            
            if (globalImplClassName && !visited.has(requiredValue)) {
              try {
                const globalImplPath = this.findImplicationFile(globalImplClassName);
                
                if (globalImplPath) {
                  this._clearImplicationCache(globalImplPath);
                  const GlobalImplClass = require(globalImplPath);
                  
                  if (this.options.verbose) {
                    console.log(\`   ⚙️  Building global chain: \${globalStatus} → \${requiredValue}\`);
                  }
                  
                  const globalChain = this.buildPrerequisiteChain(
                    GlobalImplClass,
                    globalStatus,
                    requiredValue,
                    visited,
                    false,
                    testData,
                    { loopTarget: isLoopTransition ? targetStatus : options.loopTarget }
                  );
                  
                  chain.push(...globalChain);
                }
              } catch (error) {
                console.error(\`   ❌ Failed to load \${globalImplClassName}: \${error.message}\`);
                chain.push({
                  status: requiredValue,
                  className: globalImplClassName,
                  actionName: 'FAILED_TO_LOAD',
                  testFile: 'unknown',
                  platform: 'unknown',
                  complete: false,
                  isTarget: false,
                  loadError: error.message
                });
              }
            }
          }
        }
        
        // Entity boolean state requirement (e.g., dancer.logged_in: true)
        if (field.includes('.') && typeof requiredValue === 'boolean') {
          const [entity, statusField] = field.split('.');
          const stateKey = \`\${entity}_\${statusField}\`;
          
          if (this.stateRegistry[stateKey]) {
            const actualValue = testData[entity]?.[statusField];
            
            if (actualValue !== requiredValue) {
              if (this.options.verbose) {
                console.log(\`   🔍 Found entity state requirement: \${entity}.\${statusField} must be \${requiredValue}\`);
              }
              
              const entityImplClassName = this.stateRegistry[stateKey];
              
              if (entityImplClassName && !visited.has(stateKey)) {
                try {
                  const entityImplPath = this.findImplicationFile(entityImplClassName);
                  
                  if (entityImplPath) {
                    this._clearImplicationCache(entityImplPath);
                    const EntityImplClass = require(entityImplPath);
                    const currentEntityStatus = testData[entity]?.status || 'registered';
                    
                    if (this.options.verbose) {
                      console.log(\`   ⚙️  Building \${entity} chain: \${currentEntityStatus} → \${statusField}\`);
                    }

                    const entityChain = this.buildPrerequisiteChain(
                      EntityImplClass,
                      currentEntityStatus,
                      stateKey,
                      visited,
                      false,
                      testData,
                      { loopTarget: isLoopTransition ? targetStatus : options.loopTarget }
                    );
                    
                    chain.push(...entityChain);
                  }
                } catch (error) {
                  console.error(\`   ❌ Failed to load \${entityImplClassName}: \${error.message}\`);
                  chain.push({
                    status: stateKey,
                    className: entityImplClassName,
                    actionName: 'FAILED_TO_LOAD',
                    testFile: 'unknown',
                    platform: 'unknown',
                    complete: false,
                    isTarget: false,
                    loadError: error.message
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // PREVIOUS STATUS CHAIN
    // ═══════════════════════════════════════════════════════════
    if (previousStatus) {
      if (meta.entity && this.options.verbose) {
        console.log(\`   ℹ️  Entity prerequisite: \${meta.entity}.status must be \${previousStatus}\`);
      }
      
      const prevImplClassName = this.stateRegistry[previousStatus];
      
      const canVisitPrevious = !visited.has(previousStatus) || 
                               (options.loopTarget === previousStatus) ||
                               (isLoopTransition && previousStatus !== targetStatus);
      
      if (prevImplClassName && canVisitPrevious) {
        try {
          const prevImplPath = this.findImplicationFile(prevImplClassName);
          
          if (prevImplPath) {
            this._clearImplicationCache(prevImplPath);
            const PrevImplClass = require(prevImplPath);
            
            // Select the right transition if multiple paths exist
            const selectedTransition = this._selectTransition(
              PrevImplClass,
              targetStatus,
              meta.platform,
              { 
                explicitEvent: options?.explicitEvent,
                preferSamePlatform: true,
                testData
              }
            );
            
            const prevChain = this.buildPrerequisiteChain(
              PrevImplClass, 
              currentStatus, 
              previousStatus, 
              visited, 
              false,
              testData,
              { 
                explicitEvent: selectedTransition?.event,
                loopTarget: isLoopTransition ? targetStatus : options.loopTarget
              }
            );
            chain.push(...prevChain);
          } else {
            console.error(\`   ❌ Implication file not found for: \${prevImplClassName}\`);
            chain.push({
              status: previousStatus,
              className: prevImplClassName,
              actionName: 'FILE_NOT_FOUND',
              testFile: 'unknown',
              platform: 'unknown',
              complete: false,
              isTarget: false,
              loadError: 'File not found'
            });
          }
        } catch (error) {
          console.error(\`   ❌ Failed to load \${prevImplClassName}: \${error.message}\`);
          
          chain.push({
            status: previousStatus,
            className: prevImplClassName,
            actionName: this._inferActionName(previousStatus),
            testFile: this._inferTestFile(prevImplClassName, previousStatus),
            platform: this._inferPlatform(previousStatus),
            complete: false,
            isCurrent: false,
            isTarget: false,
            loadError: error.message
          });
        }
      } else if (!prevImplClassName) {
        console.error(\`   ❌ Status "\${previousStatus}" not found in state registry!\`);
        chain.push({
          status: previousStatus,
          className: 'UNKNOWN',
          actionName: 'NOT_IN_REGISTRY',
          testFile: 'unknown',
          platform: 'unknown',
          complete: false,
          isTarget: false,
          loadError: 'Not in state registry'
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ADD CURRENT STATE TO CHAIN
    // ═══════════════════════════════════════════════════════════
    const setupEntry = TestPlanner._findSetupEntry(meta, { ...options, testData });

    chain.push({
      status: targetStatus,
      className: ImplicationClass.name,
      actionName: setupEntry?.actionName || meta.setup?.[0]?.actionName || 'unknown',
      testFile: setupEntry?.testFile || meta.setup?.[0]?.testFile || 'unknown',
      platform: setupEntry?.platform || meta.platform || 'unknown',
      complete: currentStatus === targetStatus && !options.isLoopTransition,
      isCurrent: currentStatus === targetStatus,
      isTarget: isOriginalTarget,
      entity: meta.entity,
      previousStatus: previousStatus,
      ...(directTransition && {
        transitionEvent: directTransition.event,
        transitionFrom: currentStatus
      })
    });
    
    // ═══════════════════════════════════════════════════════════
    // MARK COMPLETED STEPS
    // ═══════════════════════════════════════════════════════════
    const currentIndex = chain.findIndex(step => step.status === currentStatus && !step.isLoopPrerequisite);
    if (currentIndex !== -1 && !options.isLoopTransition) {
      for (let i = 0; i <= currentIndex; i++) {
        chain[i].complete = true;
      }
    }

    // Mark global status steps as complete if we're at that global status
    if (meta.entity && testData) {
      const globalStatus = testData.status || testData._currentStatus || 'initial';
      
      if (this.options.verbose) {
        console.log(\`   🔍 Entity: \${meta.entity}, Entity status: \${currentStatus}, Global status: \${globalStatus}\`);
      }
      
      chain.forEach((step, index) => {
        if (step.entity) return;
        if (step.loadError) return;
        
        if (step.status === globalStatus) {
          if (this.options.verbose) {
            console.log(\`   ✅ Marking \${step.status} as complete (matches global status)\`);
          }
          step.complete = true;
        }
        
        const globalStepIndex = chain.findIndex(s => s.status === globalStatus && !s.entity);
        if (globalStepIndex !== -1 && index < globalStepIndex && !step.entity) {
          step.complete = true;
        }
      });
    }
    
    return chain;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER: Clear implication cache properly
  // ═══════════════════════════════════════════════════════════
  _clearImplicationCache(filePath) {
    try {
      const resolved = require.resolve(filePath);
      delete require.cache[resolved];
    } catch (e) {
      // File not in cache yet, that's fine
    }
    
    Object.keys(require.cache).forEach(key => {
      if (key.includes('Implications') || 
          key.includes('implications') ||
          key.includes('BaseBooking')) {
        delete require.cache[key];
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS: Infer info when we can't load the file
  // ═══════════════════════════════════════════════════════════
  _inferActionName(status) {
    const parts = status.split('_');
    const camelCase = parts.map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('');
    return camelCase + 'Via...';
  }

  _inferTestFile(className, status) {
    const searchDirs = [
      path.join(process.cwd(), 'tests/implications'),
    ];
    
    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      
      const files = this._findFilesMatching(dir, status);
      if (files.length > 0) {
        return files[0];
      }
    }
    
    return 'unknown';
  }

  _findFilesMatching(dir, pattern) {
    const results = [];
    const normalizedPattern = pattern.replace(/_/g, '').toLowerCase();
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          results.push(...this._findFilesMatching(fullPath, pattern));
        } else if (item.name.toLowerCase().includes(normalizedPattern) && item.name.endsWith('.spec.js')) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // Silently handle
    }
    
    return results;
  }

  _inferPlatform(status) {
    const className = this.stateRegistry[status];
    if (!className) return 'unknown';
    
    const testFile = this._inferTestFile(className, status);
    if (testFile && testFile !== 'unknown') {
      if (testFile.includes('-Web-') || testFile.includes('-Playwright-')) return 'web';
      if (testFile.includes('-Dancer-')) return 'dancer';
      if (testFile.includes('-ClubApp-') || testFile.includes('-Club-')) return 'clubApp';
    }
    
    return 'web';
  }

  // ═══════════════════════════════════════════════════════════
  // FIND DIRECT TRANSITION
  // ═══════════════════════════════════════════════════════════
  _findDirectTransition(targetStatus, currentStatus) {
    try {
      const cacheDir = path.join(process.cwd(), '.implications-framework', 'cache');
      const discoveryCache = path.join(cacheDir, 'discovery-result.json');
      
      if (!fs.existsSync(discoveryCache)) {
        return null;
      }
      
      const discovery = JSON.parse(fs.readFileSync(discoveryCache, 'utf-8'));
      
      if (!discovery.transitions) {
        return null;
      }
      
      const transition = discovery.transitions.find(t => {
        const matchesFrom = t.from === currentStatus || 
                           t.from.replace(/_/g, ' ').toLowerCase() === currentStatus.replace(/_/g, ' ').toLowerCase();
        
        const matchesTo = t.to === targetStatus || 
                         t.to.replace(/_/g, ' ').toLowerCase() === targetStatus.replace(/_/g, ' ').toLowerCase();
        
        return matchesFrom && matchesTo;
      });
      
      return transition || null;
      
    } catch (error) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // FIND IMPLICATION FILE
  // ═══════════════════════════════════════════════════════════
  findImplicationFile(className) {
    const searchPaths = [
      path.join(process.cwd(), 'tests/implications'),
      path.join(process.cwd(), 'tests/ai-testing/implications'),
      path.join(__dirname, '..')
    ];
    
    for (const basePath of searchPaths) {
      const filePath = path.join(basePath, \`\${className}.js\`);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
      
      if (fs.existsSync(basePath)) {
        const files = this.findFilesRecursive(basePath, \`\${className}.js\`);
        if (files.length > 0) {
          return files[0];
        }
      }
    }
    
    return null;
  }

  findFilesRecursive(dir, filename) {
    const results = [];
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          results.push(...this.findFilesRecursive(fullPath, filename));
        } else if (item.name === filename) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // Silently handle
    }
    
    return results;
  }
  
  // ═══════════════════════════════════════════════════════════
  // IS READY CHECK
  // ═══════════════════════════════════════════════════════════
  isReady(chain, currentStatus, isLoopTransition = false) {
    const incompleteSteps = chain.filter(step => !step.complete);
    
    if (incompleteSteps.length === 0) {
      return true;
    }
    
    // Loop transition special case
    if (isLoopTransition) {
      const targetStep = incompleteSteps.find(s => s.isTarget);
      
      if (targetStep) {
        const atPreviousStatus = currentStatus === targetStep.previousStatus;
        
        if (atPreviousStatus && incompleteSteps.length === 1) {
          return true;
        }
      }
      
      return false;
    }
    
    // Direct transition ready
    if (incompleteSteps.length === 1 && 
        incompleteSteps[0].isTarget && 
        incompleteSteps[0].transitionEvent) {
      
      const targetStep = incompleteSteps[0];
      
      if (targetStep.transitionFrom) {
        return currentStatus === targetStep.transitionFrom;
      }
      
      return true;
    }
    
    // Only target step remaining
    if (incompleteSteps.length === 1 && incompleteSteps[0].isTarget) {
      return true;
    }
    
    return false;
  }
  
  // ═══════════════════════════════════════════════════════════
  // FIND NEXT STEP
  // ═══════════════════════════════════════════════════════════
  findNextStep(chain, currentStatus) {
    const nextStep = chain.find(step => !step.complete && !step.isTarget);
    
    if (nextStep) {
      return {
        ...nextStep,
        executable: true
      };
    }
    
    return null;
  }
  
  // ═══════════════════════════════════════════════════════════
  // FIND MISSING FIELDS
  // ═══════════════════════════════════════════════════════════
  findMissingFields(meta, testData) {
    const missing = [];
    
    if (meta.requires) {
      for (const [field, requiredValue] of Object.entries(meta.requires)) {
        if (field === 'previousStatus') continue;
        
        if (field === 'status' && typeof requiredValue === 'string' && this.stateRegistry[requiredValue]) {
          continue;
        }
        
        const isNegated = field.startsWith('!');
        const cleanField = isNegated ? field.slice(1) : field;
        
        const actualValue = cleanField.includes('.') 
          ? cleanField.split('.').reduce((obj, key) => obj?.[key], testData)
          : testData[cleanField];
        
        if (typeof requiredValue === 'object' && requiredValue.contains) {
          const valueToCheck = this._resolveValue(requiredValue.contains, testData);
          const arrayContains = Array.isArray(actualValue) && actualValue.includes(valueToCheck);
          
          if ((isNegated && arrayContains) || (!isNegated && !arrayContains)) {
            missing.push({
              field: cleanField,
              required: isNegated 
                ? \`NOT contain "\${valueToCheck}"\` 
                : \`contain "\${valueToCheck}"\`,
              actual: actualValue
            });
          }
        }
        else {
          const matches = actualValue === requiredValue;
          
          if ((isNegated && matches) || (!isNegated && !matches)) {
            missing.push({
              field: cleanField,
              required: isNegated ? \`NOT "\${requiredValue}"\` : requiredValue,
              actual: actualValue
            });
          }
        }
      }
    }
    
    if (meta.requiredFields && meta.requiredFields.length > 0) {
      for (const field of meta.requiredFields) {
        if (!testData.hasOwnProperty(field) || testData[field] === null || testData[field] === undefined) {
          missing.push({ field, required: 'defined', actual: 'missing' });
        }
      }
    }
    
    return missing;
  }

  _resolveValue(pathStr, testData) {
    if (pathStr.startsWith('ctx.data.')) {
      pathStr = pathStr.replace('ctx.data.', '');
    }
    return pathStr.split('.').reduce((obj, key) => obj?.[key], testData);
  }
  
  // ═══════════════════════════════════════════════════════════
  // DETECT CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  detectCrossPlatform(chain, currentPlatform) {
    const crossPlatformSteps = [];
    
    for (const step of chain) {
      if (step.complete) continue;
      if (step.isTarget) continue;
      
      if (TestPlanner._isDifferentPlatform(currentPlatform, step.platform)) {
        crossPlatformSteps.push(step);
      }
    }
    
    return crossPlatformSteps;
  }
  
  // ═══════════════════════════════════════════════════════════
  // PRINT CROSS-PLATFORM MESSAGE
  // ═══════════════════════════════════════════════════════════
  printCrossPlatformMessage(chain, currentPlatform) {
    console.error('\\n' + '═'.repeat(60));
    console.error('⚠️  CROSS-PLATFORM PREREQUISITES DETECTED');
    console.error('═'.repeat(60));
    
    console.error('\\n📊 Cannot auto-execute prerequisites across platforms');
    console.error(\`   Current test platform: \${currentPlatform}\`);
    
    console.error('\\n💡 RUN THESE COMMANDS IN ORDER:\\n');
    
    for (const step of chain) {
      if (step.complete) continue;
      
      const platform = step.platform;
      const emoji = step.isTarget ? '🎯' : '📍';
      
      console.error(\`\${emoji} \${step.status} (\${platform})\`);
      
      if (!step.isTarget) {
        console.error(\`   npm run test:impl -- \${step.testFile}\`);
        console.error('');
      }
    }
    
    console.error('═'.repeat(60) + '\\n');
  }
  
  // ═══════════════════════════════════════════════════════════
  // PRINT NOT READY ERROR
  // ═══════════════════════════════════════════════════════════
  printNotReadyError(analysis) {
    const { currentStatus, targetStatus, chain, nextStep, missingFields, isLoopTransition, previousStatus } = analysis;
    
    console.error('\\n' + '═'.repeat(60));
    console.error('❌ TEST NOT READY - PREREQUISITES NOT MET');
    console.error('═'.repeat(60));
    
    console.error(\`\\n📊 Status:\`);
    console.error(\`   Current: \${currentStatus}\`);
    console.error(\`   Target:  \${targetStatus}\`);
    if (isLoopTransition) {
      console.error(\`   🔄 Loop: needs \${previousStatus} first\`);
    }
    
    if (missingFields.length > 0) {
      console.error(\`\\n❌ Missing Requirements:\`);
      missingFields.forEach(fieldInfo => {
        if (typeof fieldInfo === 'string') {
          console.error(\`   - \${fieldInfo}\`);
        } else {
          console.error(\`   - \${fieldInfo.field}: required=\${fieldInfo.required}, actual=\${fieldInfo.actual}\`);
        }
      });
    }
    
    console.error(\`\\n🗺️  Full Path to Target:\\n\`);
    
    chain.forEach((step, index) => {
      const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
      const label = step.complete ? ' ← Complete' : step.isTarget ? ' ← Target' : '';
      const currentLabel = step.status === currentStatus ? ' (current)' : '';
      
      console.error(\`   \${icon} \${index + 1}. \${step.status}\${currentLabel}\${label}\`);
      
      if (!step.complete && !step.isTarget) {
        console.error(\`      Action: \${step.actionName}\`);
        console.error(\`      Test: \${step.testFile}\`);
      }
      
      if (index < chain.length - 1) {
        console.error('      ↓');
      }
    });
    
    if (nextStep) {
      console.error(\`\\n💡 NEXT STEP: \${nextStep.status}\`);
      console.error(\`   Action: \${nextStep.actionName}\`);
      console.error(\`   Test: \${nextStep.testFile}\`);
    }
    
    console.error('═'.repeat(60) + '\\n');
  }

  // ═══════════════════════════════════════════════════════════
  // GROUP CHAIN BY PLATFORM
  // ═══════════════════════════════════════════════════════════
  _groupChainByPlatform(chain, testData = null, ImplicationClass = null) {
    const segments = [];
    let currentSegment = null;
    
    for (const step of chain) {
      if (!currentSegment || currentSegment.platform !== step.platform) {
        currentSegment = {
          platform: step.platform,
          steps: [],
          complete: true
        };
        segments.push(currentSegment);
      }
      
      currentSegment.steps.push(step);
      
      if (!step.complete) {
        currentSegment.complete = false;
      }
    }
    
    // Re-check segment completeness based on actual requirements
    if (ImplicationClass && testData) {
      const meta = ImplicationClass.xstateConfig?.meta || {};
      
      if (meta.requires) {
        for (const segment of segments) {
          if (!segment.complete) continue;
          
          for (const [field, requiredValue] of Object.entries(meta.requires)) {
            if (field === 'previousStatus') continue;
            if (field.startsWith('!')) continue;
            
            if (field.includes('.')) {
              const actualValue = field.split('.').reduce((obj, key) => obj?.[key], testData);
              
              if (actualValue !== requiredValue) {
                const [entity] = field.split('.');
                
                const hasEntitySteps = segment.steps.some(step => 
                  step.status && (step.status.includes(entity) || step.entity === entity)
                );
                
                if (hasEntitySteps) {
                  segment.complete = false;
                  break;
                }
              }
            }
          }
        }
      }
    }
    
    return segments;
  }

  // ═══════════════════════════════════════════════════════════
  // SELECT TRANSITION (for multi-path)
  // ═══════════════════════════════════════════════════════════
  _selectTransition(sourceImplication, targetStatus, currentPlatform, options = {}) {
    const { explicitEvent, preferSamePlatform = true, testData } = options;
    
    const xstateConfig = sourceImplication.xstateConfig || {};
    const transitions = xstateConfig.on || {};
    
    const candidates = [];
    
    for (const [event, config] of Object.entries(transitions)) {
      const configs = Array.isArray(config) ? config : [config];
      
      for (const singleConfig of configs) {
        const target = typeof singleConfig === 'string' ? singleConfig : singleConfig?.target;
        
        if (!target) continue;
        
        if (target === targetStatus || target.endsWith(\`_\${targetStatus}\`)) {
          const configObj = typeof singleConfig === 'string' ? { target } : singleConfig;
          
          const requirementCheck = this._checkTransitionRequires(configObj.requires, testData);
          
          candidates.push({
            event,
            config: configObj,
            meetsRequirements: requirementCheck.met,
            hasRequirements: !!configObj.requires,
            requirementDetails: requirementCheck
          });
        }
      }
    }
    
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    
    if (this.options.verbose) {
      console.log(\`   🔀 Multiple paths to \${targetStatus}: \${candidates.map(c => c.event).join(', ')}\`);
    }
    
    // Priority 1: Explicit event
    if (explicitEvent) {
      const match = candidates.find(c => c.event === explicitEvent);
      if (match) {
        if (this.options.verbose) console.log(\`   ✅ Using explicit event: \${explicitEvent}\`);
        return match;
      }
    }
    
    // Priority 2: Matching requirements
    const matchingWithRequirements = candidates.find(c => c.hasRequirements && c.meetsRequirements);
    if (matchingWithRequirements) {
      if (this.options.verbose) console.log(\`   ✅ Using transition with matching requires: \${matchingWithRequirements.event}\`);
      return matchingWithRequirements;
    }
    
    // Priority 3: No requirements (default path)
    const noRequirements = candidates.find(c => !c.hasRequirements);
    if (noRequirements) {
      if (this.options.verbose) console.log(\`   ✅ Using default transition (no requires): \${noRequirements.event}\`);
      return noRequirements;
    }
    
    // Priority 4: isDefault flag
    const defaultCandidate = candidates.find(c => c.config.isDefault === true);
    if (defaultCandidate) {
      if (this.options.verbose) console.log(\`   ✅ Using marked default: \${defaultCandidate.event}\`);
      return defaultCandidate;
    }
    
    // Priority 5: Same platform
    if (preferSamePlatform) {
      const samePlatform = candidates.find(c => 
        c.config.platforms?.includes(currentPlatform)
      );
      if (samePlatform) {
        if (this.options.verbose) console.log(\`   ✅ Using same-platform transition: \${samePlatform.event}\`);
        return samePlatform;
      }
    }
    
    if (this.options.verbose) console.log(\`   ⚠️  Using first available: \${candidates[0].event}\`);
    return candidates[0];
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK TRANSITION REQUIRES
  // ═══════════════════════════════════════════════════════════
  _checkTransitionRequires(requires, testData) {
    if (!requires || !testData) {
      return { met: true, checks: [] };
    }
    
    const checks = [];
    let allMet = true;
    
    for (const [field, requiredValue] of Object.entries(requires)) {
      let checkResult = { field, required: requiredValue, met: false };
      
      if (field === 'previousStatus') {
        const changeLog = testData._changeLog || [];
        const visitedStatuses = changeLog.map(entry => entry.status);
        checkResult.met = visitedStatuses.includes(requiredValue);
        checkResult.actual = visitedStatuses;
      }
      else if (field.startsWith('!')) {
        const cleanField = field.slice(1);
        const actualValue = this._getNestedValue(cleanField, testData);
        checkResult.met = actualValue !== requiredValue;
        checkResult.actual = actualValue;
      }
      else if (field.includes('.')) {
        const actualValue = this._getNestedValue(field, testData);
        checkResult.met = actualValue === requiredValue;
        checkResult.actual = actualValue;
      }
      else if (typeof requiredValue === 'object' && requiredValue.contains) {
        const actualValue = testData[field];
        const valueToCheck = this._resolveValue(requiredValue.contains, testData);
        checkResult.met = Array.isArray(actualValue) && actualValue.includes(valueToCheck);
        checkResult.actual = actualValue;
      }
      else {
        const actualValue = testData[field];
        checkResult.met = actualValue === requiredValue;
        checkResult.actual = actualValue;
      }
      
      checks.push(checkResult);
      
      if (!checkResult.met) {
        allMet = false;
      }
    }
    
    return { met: allMet, checks };
  }

  _getNestedValue(pathStr, obj) {
    return pathStr.split('.').reduce((current, key) => current?.[key], obj);
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC: GET PLAYWRIGHT CONFIG PATH
  // ═══════════════════════════════════════════════════════════
  static _getPlaywrightConfigPath() {
    // 1. Check ai-testing.config.js first
    try {
      const configPath = path.join(process.cwd(), 'ai-testing.config.js');
      if (fs.existsSync(configPath)) {
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        if (config.playwrightConfig) {
          const explicitPath = path.join(process.cwd(), config.playwrightConfig);
          if (fs.existsSync(explicitPath)) {
            return explicitPath;
          }
          console.warn(\`⚠️  Configured playwrightConfig not found: \${config.playwrightConfig}\`);
        }
      }
    } catch (e) {
      // Config not found or invalid
    }
    
    // 2. Auto-detect common locations
    const commonPaths = [
      'playwright.config.js',
      'playwright.config.ts',
      'config/playwright.config.js',
      'config/playwright.config.ts',
      'config/frameworks/playwright.config.js',
      'config/frameworks/playwright.config.ts'
    ];
    
    for (const configFile of commonPaths) {
      const fullPath = path.join(process.cwd(), configFile);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // 3. Fallback - let Playwright find it (no --config flag)
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC: PLATFORM PREREQUISITES
  // ═══════════════════════════════════════════════════════════
  static platformPrerequisites = null;

  static _getPlatformPrerequisites() {
    if (this.platformPrerequisites) return this.platformPrerequisites;
    
    try {
      const configPath = path.join(process.cwd(), 'ai-testing.config.js');
      if (fs.existsSync(configPath)) {
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        if (config.platformPrerequisites) {
          console.log('📋 Loaded platformPrerequisites from ai-testing.config.js');
          this.platformPrerequisites = config.platformPrerequisites;
          return this.platformPrerequisites;
        }
      }
    } catch (e) {
      // Config not found or invalid
    }
    
    // Defaults
    this.platformPrerequisites = {
      dancer: {
        check: (data) => data.dancer?.logged_in === true,
        state: 'dancer_logged_in',
        implClass: 'DancerLoggedInImplications',
        file: 'tests/implications/bookings/status/DancerLoggedInViaDancerRegistered-SIGNIN-Dancer-UNIT.spec.js',
        actionName: 'dancerLoggedInViaDancerRegistered'
      },
      clubApp: {
        check: (data) => data.club?.logged_in === true,
        state: 'club_logged_in',
        implClass: 'ClubLoggedInImplications',
        file: 'tests/implications/bookings/status/ClubLoggedInViaClubRegistered-SIGNIN-ClubApp-UNIT.spec.js',
        actionName: 'clubLoggedInViaClubRegistered'
      },
      web: {
        check: (data) => data.manager?.logged_in === true,
        state: 'manager_logged_in',
        implClass: 'LoggedInImplications',
        file: 'tests/implications/bookings/status/LoggedInViaInitial-LOGIN-Web-UNIT.spec.js',
        actionName: 'loggedInViaInitial'
      }
    };
    
    return this.platformPrerequisites;
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC: COUNTDOWN (for preFlightCheck)
  // ═══════════════════════════════════════════════════════════
  static async countdown(seconds, message) {
    console.log(\`\\n⏱️  \${message} in \${seconds} seconds...\`);
    console.log(\`   Press any key to cancel\\n\`);
    
    return new Promise((resolve) => {
      let timeLeft = seconds;
      let cancelled = false;
      
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      
      const onKeypress = () => {
        cancelled = true;
        cleanup();
        console.log('\\n❌ Cancelled by user\\n');
        resolve(false);
      };
      
      process.stdin.once('keypress', onKeypress);
      
      const interval = setInterval(() => {
        if (cancelled) return;
        
        timeLeft--;
        process.stdout.write(\`\\r⏱️  Starting in \${timeLeft} seconds... (press any key to cancel)\`);
        
        if (timeLeft <= 0) {
          cleanup();
          console.log('\\n\\n🚀 Starting auto-execution...\\n');
          resolve(true);
        }
      }, 1000);
      
      const cleanup = () => {
        clearInterval(interval);
        process.stdin.removeListener('keypress', onKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
      };
    });
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC: REQUIRES MISMATCH COUNTDOWN
  // ═══════════════════════════════════════════════════════════
  static async _requiresMismatchCountdown(seconds) {
    return new Promise((resolve) => {
      let timeLeft = seconds;
      let changed = false;
      
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      
      const onKeypress = () => {
        changed = true;
        cleanup();
        resolve(true); // true = change data
      };
      
      process.stdin.once('keypress', onKeypress);
      
      const interval = setInterval(() => {
        if (changed) return;
        
        timeLeft--;
        process.stdout.write(\`\\r⏱️  Continuing in \${timeLeft} seconds... (press any key to CHANGE data)  \`);
        
        if (timeLeft <= 0) {
          cleanup();
          console.log('');
          resolve(false); // false = continue as-is
        }
      }, 1000);
      
      const cleanup = () => {
        clearInterval(interval);
        process.stdin.removeListener('keypress', onKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
      };
    });
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC: EXECUTE TEST IN SUBPROCESS
  // ═══════════════════════════════════════════════════════════
  static executeTestInSubprocess(testFile, platform) {
    const { spawnSync } = require('child_process');
    
    const command = 'node';
    const args = ['run-test.js', testFile, '--skip-preflight'];
    
    console.log(\`   ⚡ Running \${path.basename(testFile)}...\`);
    
    const result = spawnSync(command, args, {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        IS_PREREQUISITE_EXECUTION: 'true'
      }
    });
    
    if (result.status !== 0) {
      throw new Error(\`Test failed with exit code \${result.status}\`);
    }
    
    console.log(\`   ✅ Completed\\n\`);
  }

  // ═══════════════════════════════════════════════════════════
  // REQUIRES MISMATCH WARNING SYSTEM
  // ═══════════════════════════════════════════════════════════
  static _checkCurrentTestRequires(ImplicationClass, testData, options = {}) {
    const meta = ImplicationClass.xstateConfig?.meta || {};
    const { currentTestFile } = options;
    
    const mismatches = [];
    
    // Check setup entry requires
    const setupEntry = this._findSetupEntry(meta, { currentTestFile, testData });
    
    if (setupEntry?.requires) {
      for (const [field, requiredValue] of Object.entries(setupEntry.requires)) {
        if (field === 'previousStatus') continue;
        
        const actualValue = field.includes('.')
          ? field.split('.').reduce((obj, key) => obj?.[key], testData)
          : testData[field];
        
        if (actualValue !== requiredValue) {
          mismatches.push({ field, required: requiredValue, actual: actualValue, source: 'setup' });
        }
      }
    }
    
    // Check transition requires on SOURCE Implication
    if (currentTestFile) {
      const event = this._extractEventFromFilename(currentTestFile);
      const previousStatus = meta.requires?.previousStatus || setupEntry?.previousStatus;
      
      if (event && previousStatus) {
        try {
          const planner = new TestPlanner({ verbose: false });
          const sourceImplClassName = planner.stateRegistry[previousStatus];
          
          if (sourceImplClassName) {
            const sourceImplPath = planner.findImplicationFile(sourceImplClassName);
            
            if (sourceImplPath) {
              delete require.cache[require.resolve(sourceImplPath)];
              const SourceImplClass = require(sourceImplPath);
              
              const transitions = SourceImplClass.xstateConfig?.on || {};
              const transition = transitions[event];
              
              if (transition) {
                const configs = Array.isArray(transition) ? transition : [transition];
                
                for (const singleConfig of configs) {
                  const config = typeof singleConfig === 'string' ? null : singleConfig;
                  
                  if (config?.requires) {
                    const transitionTarget = config.target;
                    const ourTarget = meta.status;
                    
                    if (transitionTarget === ourTarget || transitionTarget?.endsWith(ourTarget)) {
                      for (const [field, requiredValue] of Object.entries(config.requires)) {
                        if (field === 'previousStatus') continue;
                        if (mismatches.some(m => m.field === field)) continue;
                        
                        const actualValue = field.includes('.')
                          ? field.split('.').reduce((obj, key) => obj?.[key], testData)
                          : testData[field];
                        
                        if (actualValue !== requiredValue) {
                          mismatches.push({ 
                            field, 
                            required: requiredValue, 
                            actual: actualValue, 
                            source: 'transition',
                            fromState: previousStatus,
                            event: event
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          // Silently continue
        }
      }
    }
    
    return { hasMismatch: mismatches.length > 0, mismatches };
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC: CHECK OR THROW - With inline same-platform execution
  // ═══════════════════════════════════════════════════════════
  static async checkOrThrow(ImplicationClass, testData, options = {}) {
    const { page, driver, testDataPath } = options;
    
    // If preflight already ran AND we're in a spawned subprocess, skip everything
    if (process.env.PREFLIGHT_COMPLETED === 'true' && process.env.IS_PREREQUISITE_EXECUTION === 'true') {
      console.log('✅ Pre-flight already completed, skipping prerequisite check\\n');
      return { ready: true, skipped: true };
    }
    
    const planner = new TestPlanner({ verbose: true });
    
    const meta = ImplicationClass.xstateConfig?.meta || ImplicationClass.meta;
    const targetStatus = meta.status;
    const platform = meta.platform;

    // ═══════════════════════════════════════════════════════════
    // PLATFORM PREREQUISITES - Skip on recursive calls!
    // ═══════════════════════════════════════════════════════════
    const platformPrereqs = this._getPlatformPrerequisites();
    const prereq = platformPrereqs[platform];
    
    const skipPlatformPrereq = options.skipPlatformPrereq === true || 
                                options.isPrerequisite === true ||
                                process.env.IS_PREREQUISITE_EXECUTION === 'true';
    
    if (prereq && !skipPlatformPrereq && !prereq.check(testData)) {
      console.log(\`\\n🔐 Platform prerequisite not met: \${platform} needs \${prereq.state}\`);
      console.log(\`   Running: \${prereq.actionName}\\n\`);
      
      try {
        process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
        process.env.IS_PREREQUISITE_EXECUTION = 'true';
        
        const testPath = path.join(process.cwd(), prereq.file);
        
        if (!fs.existsSync(testPath)) {
          console.warn(\`   ⚠️  Platform prerequisite file not found: \${prereq.file}\`);
          console.warn(\`   ⚠️  Skipping platform init - make sure login runs first!\\n\`);
        } else {
          delete require.cache[require.resolve(testPath)];
          
          const testModule = require(testPath);
          const actionFn = testModule[prereq.actionName];
          
          if (!actionFn) {
            throw new Error(\`Action \${prereq.actionName} not found in \${prereq.file}\`);
          }
          
          const result = await actionFn(testDataPath, { page, driver, testDataPath });
          
          if (result && result.save) {
            result.save(testDataPath);
          }
          
          if (result && result.data) {
            Object.assign(testData, result.data);
          }
          
          console.log(\`✅ Platform prerequisite \${prereq.state} complete!\\n\`);
        }
        
        delete process.env.SKIP_UNIT_TEST_REGISTRATION;
        delete process.env.IS_PREREQUISITE_EXECUTION;
        
      } catch (error) {
        delete process.env.SKIP_UNIT_TEST_REGISTRATION;
        delete process.env.IS_PREREQUISITE_EXECUTION;
        console.error(\`❌ Platform prerequisite failed: \${error.message}\`);
        throw error;
      }
    }
    
    const currentStatus = this._getCurrentStatus(testData, ImplicationClass);

    const testFile = meta.setup?.[0]?.testFile;
    const viaEvent = testFile ? TestPlanner._extractEventFromFilename(testFile) : null;

    console.log(\`\\n🔍 TestPlanner: Analyzing \${targetStatus} state\`);
    console.log(\`   Current: \${currentStatus}\`);
    console.log(\`   Target: \${targetStatus}\`);
    if (viaEvent) {
      console.log(\`   Via Event: \${viaEvent}\`);
    }
    
    const analysis = planner.analyze(ImplicationClass, testData, { explicitEvent: viaEvent });

    // Already at target?
    if (targetStatus && currentStatus === targetStatus) {
      console.log(\`✅ Already in target state (\${targetStatus}), no action needed\\n\`);
      return { ready: true, skipped: true, currentStatus, targetStatus };
    }

    // ═══════════════════════════════════════════════════════════
    // INLINE SAME-PLATFORM EXECUTION (when page/driver available)
    // ═══════════════════════════════════════════════════════════
    if (!analysis.ready && analysis.chain.length > 0 && (page || driver)) {
      const segments = planner._groupChainByPlatform(analysis.chain, testData, ImplicationClass);
      
      console.log(\`\\n📊 Prerequisite Chain (\${segments.length} segment\${segments.length > 1 ? 's' : ''}):\\n\`);
      
      segments.forEach((segment, index) => {
        const status = segment.complete ? '✅' : '❌';
        const label = segment.steps.length === 1 && segment.steps[0].isTarget 
          ? 'CURRENT TEST' 
          : segment.complete ? 'COMPLETE' : 'NOT COMPLETE';
        
        console.log(\`Segment \${index + 1} (\${segment.platform}): \${status} \${label}\`);
        
        segment.steps.forEach(step => {
          const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
          console.log(\`  \${icon} \${step.status}\`);
        });
        console.log('');
      });
      
      const incompleteSegment = segments.find(s => !s.complete);
      
      if (incompleteSegment) {
        const currentPlatform = page ? 'web' : platform;
        const isSamePlatform = this._isSamePlatform(incompleteSegment.platform, currentPlatform);
        
        if (isSamePlatform) {
          // ═══════════════════════════════════════════════════════════
          // SAME PLATFORM - Execute inline with SAME page/driver!
          // ═══════════════════════════════════════════════════════════
          console.log(\`⚡ Auto-executing \${incompleteSegment.platform} segment inline...\\n\`);
          
          let executedAnySteps = false;
          
          for (const step of incompleteSegment.steps) {
            if (step.isTarget) continue;
            if (step.complete) continue;
            
            let testFilePath = step.testFile;
            let actionName = step.actionName;

            if (!testFilePath || testFilePath === 'unknown') {
              const fullStep = analysis.chain.find(s => s.status === step.status);
              if (fullStep) {
                testFilePath = fullStep.testFile;
                actionName = fullStep.actionName;
              }
            }

            if (!testFilePath || testFilePath === 'unknown') {
              console.error(\`   ⚠️  Cannot execute \${step.status} - test file not found\\n\`);
              continue;
            }

            executedAnySteps = true;
            console.log(\`⚡ Auto-executing prerequisite: \${actionName}\\n\`);

            try {
              process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
              
              const fullTestPath = path.join(process.cwd(), testFilePath);
              delete require.cache[require.resolve(fullTestPath)];
              const testModule = require(fullTestPath);
              
              delete process.env.SKIP_UNIT_TEST_REGISTRATION;
              
              // Find the action function
              let triggerFn = testModule[actionName];
              
              if (!triggerFn) {
                const camelCaseActionName = actionName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                triggerFn = testModule[camelCaseActionName];
                
                if (!triggerFn) {
                  throw new Error(\`Function \${actionName} not exported from \${testFilePath}\`);
                }
              }
              
              // Get current data path (might have delta from previous step)
              const TestContext = require('./TestContext');
              const originalPath = options.testDataPath || testData.__testDataPath || 'tests/data/shared.json';
              const deltaPath = TestContext.getDeltaPath(originalPath);
              const pathToUse = fs.existsSync(deltaPath) ? deltaPath : originalPath;
              
              // Execute with SAME PAGE/DRIVER
              const result = await triggerFn(pathToUse, {
                page: page,
                driver: driver,
                testDataPath: pathToUse,
                isPrerequisite: true
              });
              
              if (result && result.save) {
                result.save(pathToUse);
              }
              
              // Reload data to get updated status
              const finalDeltaPath = TestContext.getDeltaPath(originalPath);
              const reloadedCtx = TestContext.load(ImplicationClass, finalDeltaPath);
              Object.assign(testData, reloadedCtx.data);
              
              console.log(\`   ✅ Completed: \${step.status}\\n\`);
              
            } catch (error) {
              console.error(\`❌ Failed to execute \${actionName}: \${error.message}\\n\`);
              delete process.env.SKIP_UNIT_TEST_REGISTRATION;
              throw error;
            }
          }
          
          if (executedAnySteps) {
            console.log('🔄 Re-checking prerequisites after segment execution...\\n');
            
            // CRITICAL: Skip platform prereq on recursive call!
            return TestPlanner.checkOrThrow(ImplicationClass, testData, {
              ...options,
              skipPlatformPrereq: true
            });
          } else {
            console.log(\`✅ Segment \${incompleteSegment.platform} has no executable steps\\n\`);
            
            // Check if there's a next segment on a different platform
            const currentSegmentIndex = segments.indexOf(incompleteSegment);
            const nextIncomplete = segments.find((s, idx) => 
              !s.complete && idx > currentSegmentIndex
            );
            
            if (nextIncomplete && !this._isSamePlatform(nextIncomplete.platform, currentPlatform)) {
              console.log(\`\\n⚠️  Next segment requires \${nextIncomplete.platform} platform\\n\`);
              
              const isPrerequisiteExecution = options?.isPrerequisite === true || 
                                              process.env.IS_PREREQUISITE_EXECUTION === 'true';
              
              if (isPrerequisiteExecution) {
                console.log('✅ Prerequisite completed - parent test will handle remaining platforms\\n');
                return analysis;
              }
              
              planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
              throw new Error('Prerequisites not met (cross-platform)');
            }
            
            console.log('✅ All same-platform prerequisites satisfied!\\n');
            return analysis;
          }
          
        } else {
          // ═══════════════════════════════════════════════════════════
          // DIFFERENT PLATFORM - Cannot execute inline
          // ═══════════════════════════════════════════════════════════
          const isPrerequisiteExecution = options?.isPrerequisite === true || 
                                          process.env.IS_PREREQUISITE_EXECUTION === 'true';
          
          if (isPrerequisiteExecution) {
            console.log(\`\\n✅ Platform \${currentPlatform} prerequisites complete\\n\`);
            console.log(\`   (Remaining \${incompleteSegment.platform} prerequisites will be handled by parent test)\\n\`);
            return analysis;
          }
          
          console.log(\`\\n⚠️  Next segment requires \${incompleteSegment.platform} platform\\n\`);
          planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
          throw new Error('Prerequisites not met (cross-platform)');
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // FALLBACK: Single step auto-execution (legacy path)
    // ═══════════════════════════════════════════════════════════
    if (!analysis.ready && analysis.nextStep && (page || driver)) {
      const { testFile: stepTestFile, actionName } = analysis.nextStep;
      
      console.log(\`\\n⚡ Auto-executing prerequisite: \${actionName}\\n\`);
      
      try {
        process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
        
        const testPath = path.join(process.cwd(), stepTestFile);
        delete require.cache[require.resolve(testPath)];
        const testModule = require(testPath);
        
        delete process.env.SKIP_UNIT_TEST_REGISTRATION;
        
        let triggerFn = testModule[actionName];
        
        if (!triggerFn) {
          const camelCaseActionName = actionName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          triggerFn = testModule[camelCaseActionName];
          
          if (!triggerFn) {
            throw new Error(\`Function \${actionName} (or \${camelCaseActionName}) not exported from \${stepTestFile}\`);
          }
        }
        
        const TestContext = require('./TestContext');
        const originalPath = options.testDataPath 
          || testData.__testDataPath 
          || process.env.TEST_DATA_PATH 
          || 'tests/data/shared.json';
        
        const deltaPath = TestContext.getDeltaPath(originalPath);
        const pathToUse = fs.existsSync(deltaPath) ? deltaPath : originalPath;
        
        const result = await triggerFn(pathToUse, {
          page: page,
          driver: driver,
          testDataPath: pathToUse,
          isPrerequisite: true
        });
        
        if (result && result.save) {
          result.save(pathToUse);
        }

        const finalDeltaPath = TestContext.getDeltaPath(originalPath);
        const reloadedCtx = TestContext.load(ImplicationClass, finalDeltaPath);
        Object.assign(testData, reloadedCtx.data);
        
        const newCurrentStatus = this._getCurrentStatus(reloadedCtx.data, ImplicationClass);
        
        if (newCurrentStatus === analysis.nextStep.status) {
          console.log(\`✅ Completed prerequisite: \${analysis.nextStep.status}\\n\`);
        }
        
        const newAnalysis = planner.analyze(ImplicationClass, reloadedCtx.data);
        
        if (!newAnalysis.ready && newAnalysis.nextStep) {
          console.log(\`   ⭐ Moving to next prerequisite: \${newAnalysis.nextStep.actionName}\\n\`);
          return TestPlanner.checkOrThrow(ImplicationClass, reloadedCtx.data, {
            ...options,
            testDataPath: finalDeltaPath,
            skipPlatformPrereq: true
          });
        }
        
        if (!newAnalysis.ready) {
          planner.printNotReadyError(newAnalysis);
          throw new Error('Prerequisite chain stuck');
        }
        
        console.log('✅ Prerequisites satisfied!\\n');
        return newAnalysis;
        
      } catch (error) {
        console.error(\`❌ Failed to auto-execute prerequisite: \${error.message}\\n\`);
        delete process.env.SKIP_UNIT_TEST_REGISTRATION;
        planner.printNotReadyError(analysis);
        throw error;
      }
    }
    
    // No page/driver but have nextStep - shouldn't happen in normal flow
    if (!analysis.ready && analysis.nextStep && !page && !driver) {
      planner.printNotReadyError(analysis);
      throw new Error('Prerequisites not met - run with preflight enabled');
    }
    
    if (!analysis.ready) {
      planner.printNotReadyError(analysis);
      throw new Error('Prerequisites not met');
    }
    
    return analysis;
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC: EXECUTE WEB SEGMENT INLINE
  // ═══════════════════════════════════════════════════════════
  static async executeWebSegmentInline(stepsToExecute, testDataPath) {
    const { spawnSync } = require('child_process');
    
    console.log(\`\\n🌐 Running \${stepsToExecute.length} web prerequisites in single browser...\\n\`);
    
    const firstStepDir = path.dirname(path.join(process.cwd(), stepsToExecute[0].testFile));
    const tempFile = path.join(firstStepDir, 'BatchPrereqs-BATCH-Web-UNIT.spec.js');
    
    console.log(\`   📝 Creating batch file: \${tempFile}\`);
    
    const stepCalls = stepsToExecute.map((step, i) => {
      const fullPath = path.join(process.cwd(), step.testFile).replace(/\\\\/g, '/');
      const fnName = step.actionName;
      const camelName = fnName.replace(/_([a-z])/g, g => g[1].toUpperCase());
      
      return \`
    // Step \${i + 1}: \${step.status}
    {
      console.log('\\\\n⚡ Step \${i + 1}: \${fnName} (\${step.status})');
      const mod = require('\${fullPath}');
      const fn = mod['\${fnName}'] || mod['\${camelName}'];
      if (!fn) throw new Error('Function \${fnName} not found');
      
      const TestContext = require('\${path.join(process.cwd(), 'tests/ai-testing/utils/TestContext').replace(/\\\\/g, '/')}');
      const fs = require('fs');
      const deltaPath = TestContext.getDeltaPath('\${testDataPath}');
      const pathToUse = fs.existsSync(deltaPath) ? deltaPath : '\${testDataPath}';
      
      const result = await fn(pathToUse, { page, testDataPath: pathToUse, isPrerequisite: true });
      if (result && result.save) result.save(pathToUse);
      console.log('   ✅ Done: \${step.status}');
    }\`;
    }).join('\\n');
    
    const specContent = \`// Auto-generated batch runner - DELETE IF FOUND
process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
process.env.IS_PREREQUISITE_EXECUTION = 'true';

const { test } = require('@playwright/test');

test('Batch: Execute \${stepsToExecute.length} web prerequisites', async ({ page }) => {
  \${stepCalls}
});
\`;
    
    fs.writeFileSync(tempFile, specContent);
    console.log(\`   ✅ Batch file created (\${specContent.length} bytes)\`);
    
    if (!fs.existsSync(tempFile)) {
      throw new Error('Batch file was not created!');
    }
    console.log(\`   ✅ File verified on disk\`);
    
    try {
      const playwrightConfig = this._getPlaywrightConfigPath();
      const args = ['playwright', 'test', \`"\${tempFile}"\`];
      
      if (playwrightConfig) {
        args.push('--config', playwrightConfig);
        console.log(\`   📄 Using config: \${playwrightConfig}\`);
      } else {
        console.log(\`   📄 Using Playwright default config detection\`);
      }
      
      console.log(\`   🎬 Running: npx \${args.join(' ')}\\n\`);
      
      const result = spawnSync('npx', args, {
        stdio: 'inherit',
        shell: true,
        cwd: process.cwd(),
        env: {
          ...process.env,
          PREFLIGHT_COMPLETED: 'true',
          IS_PREREQUISITE_EXECUTION: 'true',
          SKIP_UNIT_TEST_REGISTRATION: 'true'
        }
      });
      
      if (result.status !== 0) {
        throw new Error(\`Batch prerequisites failed with code \${result.status}\`);
      }
      
      console.log(\`\\n✅ All \${stepsToExecute.length} web prerequisites complete!\\n\`);
      
    } finally {
      try { 
        fs.unlinkSync(tempFile); 
        console.log('   🧹 Cleaned up batch file');
      } catch (e) {}
    }
  }

  // Helper for platform comparison
  static _isSamePlatform(platform1, platform2) {
    const normalize = (p) => {
      if (!p) return 'unknown';
      p = p.toLowerCase();
      if (p === 'playwright' || p === 'web' || p === 'cms') return 'web';
      if (p === 'dancer') return 'dancer';
      if (p === 'clubapp' || p === 'club') return 'clubApp';
      return p;
    };
    
    return normalize(platform1) === normalize(platform2);
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC: PRE-FLIGHT CHECK
  // ═══════════════════════════════════════════════════════════
  static async preFlightCheck(ImplicationClass, testDataPath) {
    try {
      const TestContext = require('./TestContext');
      const ctx = TestContext.load(ImplicationClass, testDataPath);
      
      const planner = new TestPlanner({ verbose: true });
      const meta = ImplicationClass.xstateConfig?.meta || {};
      const currentPlatform = meta.platform || 'web';
      const targetStatus = meta.status;
      const currentTestFile = meta.setup?.[0]?.testFile;
      
      // ═══════════════════════════════════════════════════════════
      // CHECK REQUIRES MISMATCH - Interactive!
      // ═══════════════════════════════════════════════════════════
      const requiresCheck = this._checkCurrentTestRequires(ImplicationClass, ctx.data, { currentTestFile });
      
      if (requiresCheck.hasMismatch) {
        console.log('\\n\\x1b[33m' + '='.repeat(65) + '\\x1b[0m');
        console.log('\\x1b[33m⚠️  TEST DATA MISMATCH DETECTED\\x1b[0m');
        console.log('\\x1b[33m' + '='.repeat(65) + '\\x1b[0m');
        
        if (currentTestFile) {
          console.log('\\x1b[36m📄 Test: ' + path.basename(currentTestFile) + '\\x1b[0m');
        }
        
        console.log('\\n\\x1b[36m📊 This test requires:\\x1b[0m');
        for (const m of requiresCheck.mismatches) {
          let sourceInfo = '';
          if (m.source === 'transition' && m.fromState && m.event) {
            sourceInfo = ' \\x1b[2m(from ' + m.fromState + ' -> ' + m.event + ')\\x1b[0m';
          } else if (m.source === 'setup') {
            sourceInfo = ' \\x1b[2m(setup requirement)\\x1b[0m';
          }
          console.log('     \\x1b[32m' + m.field + ' = ' + JSON.stringify(m.required) + '\\x1b[0m' + sourceInfo);
        }
        
        console.log('\\n\\x1b[36m📊 Your testData has:\\x1b[0m');
        for (const m of requiresCheck.mismatches) {
          console.log('     \\x1b[31m' + m.field + ' = ' + JSON.stringify(m.actual) + ' <- MISMATCH\\x1b[0m');
        }
        
        console.log('\\x1b[33m' + '='.repeat(65) + '\\x1b[0m');
        console.log('\\n\\x1b[36m💡 Options:\\x1b[0m');
        console.log('   \\x1b[32m[Press Key]\\x1b[0m Change testData to match requires');
        console.log('   \\x1b[33m[Wait]\\x1b[0m Continue with current testData (may fail)');
        console.log('');
        
        const shouldChange = await this._requiresMismatchCountdown(10);
        
        if (shouldChange) {
          console.log('\\n\\x1b[32m🔧 Updating testData to match requires:\\x1b[0m\\n');
          
          for (const m of requiresCheck.mismatches) {
            if (m.field.includes('.')) {
              const parts = m.field.split('.');
              let obj = ctx.data;
              for (let i = 0; i < parts.length - 1; i++) {
                if (!obj[parts[i]]) obj[parts[i]] = {};
                obj = obj[parts[i]];
              }
              obj[parts[parts.length - 1]] = m.required;
            } else {
              ctx.data[m.field] = m.required;
            }
            console.log('   \\x1b[32m✅ ' + m.field + ':\\x1b[0m ' + JSON.stringify(m.actual) + ' -> \\x1b[32m' + JSON.stringify(m.required) + '\\x1b[0m');
          }
          
          // Save directly to shared.json
          const originalPath = path.resolve(process.cwd(), testDataPath);
          const originalData = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
          
          for (const m of requiresCheck.mismatches) {
            if (m.field.includes('.')) {
              const parts = m.field.split('.');
              let obj = originalData;
              for (let i = 0; i < parts.length - 1; i++) {
                if (!obj[parts[i]]) obj[parts[i]] = {};
                obj = obj[parts[i]];
              }
              obj[parts[parts.length - 1]] = m.required;
            } else {
              originalData[m.field] = m.required;
            }
          }
          
          fs.writeFileSync(originalPath, JSON.stringify(originalData, null, 2));
          console.log('\\n\\x1b[32m💾 Updated shared.json directly!\\x1b[0m\\n');
        } else {
          console.log('\\n\\x1b[33m▶️  Continuing with original testData...\\x1b[0m\\n');
        }
      }
      
      const currentStatus = this._getCurrentStatus(ctx.data, ImplicationClass);
      
      // Already at target?
      if (currentStatus === targetStatus) {
        console.log(\`✅ Already in target state (\${targetStatus}), test will skip\\n\`);
        return true;
      }
      
      // Analyze prerequisites
      const analysis = planner.analyze(ImplicationClass, ctx.data);
      
      if (analysis.ready) {
        console.log('✅ Pre-flight check passed!\\n');
        return true;
      }
      
      const segments = planner._groupChainByPlatform(analysis.chain, ctx.data, ImplicationClass);
      
      console.log(\`\\n📊 Prerequisite Chain (\${segments.length} segment\${segments.length > 1 ? 's' : ''}):\\n\`);
      
      segments.forEach((segment, index) => {
        const status = segment.complete ? '✅' : '❌';
        const label = segment.steps.length === 1 && segment.steps[0].isTarget 
          ? 'CURRENT TEST' 
          : segment.complete ? 'COMPLETE' : 'NOT COMPLETE';
        
        console.log(\`Segment \${index + 1} (\${segment.platform}): \${status} \${label}\`);
        
        segment.steps.forEach(step => {
          const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
          console.log(\`  \${icon} \${step.status}\`);
        });
        console.log('');
      });
      
      const incompleteSegment = segments.find(s => !s.complete);
      
      if (!incompleteSegment) {
        console.log('✅ Pre-flight check passed!\\n');
        return true;
      }
      
      const isDifferentPlatform = !this._isSamePlatform(incompleteSegment.platform, currentPlatform);
      
      if (isDifferentPlatform) {
        console.log('⚡ Cross-platform execution detected!\\n');
        console.log('💡 AUTO-EXECUTION PLAN:\\n');
        
        const stepsToExecute = incompleteSegment.steps.filter(s => !s.complete && !s.isTarget);
        
        if (stepsToExecute.length === 0) {
          console.log(\`   Segment \${incompleteSegment.platform} has no executable steps\`);
          console.log('✅ Pre-flight check passed!\\n');
          return true;
        }
        
        console.log(\`1. Run \${incompleteSegment.platform} segment (\${stepsToExecute.length} tests):\\n\`);
        stepsToExecute.forEach((step, idx) => {
          const testName = path.basename(step.testFile || 'unknown');
          console.log(\`   \${idx + 1}. \${step.status} - \${testName}\`);
        });
        
        console.log(\`\\n2. Continue with current test (\${currentPlatform})\\n\`);
        
        const shouldProceed = await this.countdown(10, 'Starting auto-execution');
        
        if (!shouldProceed) {
          console.error('❌ Pre-flight check cancelled by user.\\n');
          process.exit(1);
        }
        
        console.log(\`🌐 Executing \${incompleteSegment.platform} segment...\\n\`);
        
        try {
          // Use inline execution for web to preserve session!
          if (incompleteSegment.platform === 'web' || incompleteSegment.platform === 'playwright') {
            await this.executeWebSegmentInline(stepsToExecute, testDataPath);
          } else {
            // Mobile - subprocess per test
            for (const step of stepsToExecute) {
              this.executeTestInSubprocess(step.testFile, incompleteSegment.platform);
            }
          }
          
          console.log(\`✅ \${incompleteSegment.platform} segment complete!\\n\`);
          
          // Wait for files to sync
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Re-check
          this._clearDataCaches();
          
          const deltaPath = TestContext.getDeltaPath(testDataPath);
          const actualPath = fs.existsSync(deltaPath) ? deltaPath : testDataPath;
          const rawData = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
          const mergedData = this._mergeChangeLog(rawData);
          
          console.log(\`   📂 Loaded state: status=\${mergedData.status}\\n\`);
          
          const newAnalysis = planner.analyze(ImplicationClass, mergedData);
          
          if (newAnalysis.ready) {
            console.log('✅ All prerequisites satisfied!\\n');
            return true;
          } else {
            console.error('⚠️  Prerequisites still not met after execution\\n');
            planner.printNotReadyError(newAnalysis);
            console.error('❌ Pre-flight check failed.\\n');
            process.exit(1);
          }
          
        } catch (error) {
          console.error(\`\\n❌ Error during auto-execution: \${error.message}\\n\`);
          console.error('❌ Pre-flight check failed.\\n');
          process.exit(1);
        }
      }
      
      // Same platform - will auto-execute during test
      if (analysis.nextStep) {
        console.log(\`\\n⚠️  Prerequisites missing - will auto-execute during test\\n\`);
        console.log(\`   Next step: \${analysis.nextStep.actionName} (\${analysis.nextStep.status})\`);
        console.log('✅ Pre-flight check passed (auto-execution enabled)\\n');
        return true;
      }
      
      planner.printNotReadyError(analysis);
      console.error('❌ Pre-flight check failed. No path to target state.\\n');
      process.exit(1);
      
    } catch (error) {
      console.error(\`❌ Pre-flight check error: \${error.message}\\n\`);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

module.exports = TestPlanner;
`;
}

export default router;