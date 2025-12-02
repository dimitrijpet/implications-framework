// packages/api-server/src/routes/init.js
// Updated: 2025-11-27 - Added run-test.js, package.json script, v4.2 TestPlanner

import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
// At the top of init.js, add:
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  return `// tests/ai-testing/utils/ExpectImplication.js
// ✅ UPDATED: Block-order-aware validation
// 
// WHAT CHANGED:
// - validateImplications() now checks for \`blocks\` array first
// - If blocks exist, processes them IN ORDER via validateBlocks()
// - Each block type has its own handler
// - Falls back to legacy format if no blocks

const { expect } = require('@playwright/test');

class ExpectImplication {
  // ═══════════════════════════════════════════════════════════
  // STORED VALUES - For cross-step data passing (storeAs)
  // ═══════════════════════════════════════════════════════════
  static _capturedValues = {};
  
  static storeValue(key, value) {
    this._capturedValues[key] = value;
    const preview = typeof value === 'object' 
      ? JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? '...' : '')
      : value;
    console.log(\`      💾 Stored: \${key} = \${preview}\`);
  }
  
  static getValue(key) {
    return this._capturedValues[key];
  }
  
  static clearCapturedValues() {
    this._capturedValues = {};
    console.log('🗑️  Cleared captured values');
  }
  
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
    
    if (this._capturedValues[firstPart] !== undefined) {
      let current = this._capturedValues[firstPart];
      for (let i = 1; i < parts.length; i++) {
        if (current === null || current === undefined) return undefined;
        current = current[parts[i]];
      }
      return current;
    }
    
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
  // Boolean function checks
  // ═══════════════════════════════════════════════════════════
  static async _checkTruthy(screenObject, functionName) {
    if (typeof screenObject[functionName] !== 'function') {
      throw new Error(\`"\${functionName}" is not a function on screen object\`);
    }
    
    const result = await screenObject[functionName]();
    expect(result, \`Expected \${functionName}() to be truthy, got: \${result}\`).toBeTruthy();
    console.log(\`      ✓ \${functionName}() is truthy (returned: \${result})\`);
  }

  static async _checkFalsy(screenObject, functionName) {
    if (typeof screenObject[functionName] !== 'function') {
      throw new Error(\`"\${functionName}" is not a function on screen object\`);
    }
    
    const result = await screenObject[functionName]();
    expect(result, \`Expected \${functionName}() to be falsy, got: \${result}\`).toBeFalsy();
    console.log(\`      ✓ \${functionName}() is falsy (returned: \${result})\`);
  }

  // ═══════════════════════════════════════════════════════════
  // Advanced assertions
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
        expect(result).toBe(resolvedValue);
        console.log(\`      ✓ \${fn}() toBe \${resolvedValue} (got: \${result})\`);
        break;
      case 'toEqual':
        expect(result).toEqual(resolvedValue);
        console.log(\`      ✓ \${fn}() toEqual \${JSON.stringify(resolvedValue)}\`);
        break;
      case 'toBeGreaterThan':
        expect(result).toBeGreaterThan(resolvedValue);
        console.log(\`      ✓ \${fn}() > \${resolvedValue} (got: \${result})\`);
        break;
      case 'toBeLessThan':
        expect(result).toBeLessThan(resolvedValue);
        console.log(\`      ✓ \${fn}() < \${resolvedValue} (got: \${result})\`);
        break;
      case 'toContain':
        expect(result).toContain(resolvedValue);
        console.log(\`      ✓ \${fn}() contains "\${resolvedValue}"\`);
        break;
      case 'toBeTruthy':
        expect(result).toBeTruthy();
        console.log(\`      ✓ \${fn}() is truthy\`);
        break;
      case 'toBeFalsy':
        expect(result).toBeFalsy();
        console.log(\`      ✓ \${fn}() is falsy\`);
        break;
      case 'toHaveLength':
        expect(result).toHaveLength(resolvedValue);
        console.log(\`      ✓ \${fn}() has length \${resolvedValue}\`);
        break;
      default:
        throw new Error(\`Unknown assertion type: \${expectType}\`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Execute functions with storeAs support
  // ═══════════════════════════════════════════════════════════
  static async _executeFunctions(functions, screenObject, testData = {}) {
    if (!functions || Object.keys(functions).length === 0) return;
    
    console.log(\`   ⚡ Executing \${Object.keys(functions).length} function(s)...\`);
    
    for (const [funcName, funcConfig] of Object.entries(functions)) {
      try {
        const { parameters = {}, params = {}, storeAs, signature } = funcConfig;
        const funcParams = Object.keys(parameters).length > 0 ? parameters : params;
        
        const fn = screenObject[funcName];
        if (typeof fn !== 'function') {
          console.warn(\`      ⚠️  Function \${funcName} not found, skipping...\`);
          continue;
        }
        
        const resolvedParams = this.resolveTemplate(funcParams, testData);
        const paramValues = Object.values(resolvedParams);
        
        console.log(\`      ▶ \${signature || funcName}(\${paramValues.map(v => JSON.stringify(v)).join(', ')})\`);
        
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
  // ✅ NEW: BLOCK-AWARE VALIDATION
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Main validation entry point
   * ✅ NOW CHECKS FOR BLOCKS FIRST
   */
  static async validateImplications(screenDef, testData, screenObject) {
    if (!screenDef || (Array.isArray(screenDef) && screenDef.length === 0)) {
      console.log('   ⚠️  No screen definition to validate');
      return;
    }
    
    const def = Array.isArray(screenDef) ? screenDef[0] : screenDef;
    
    // ✅ NEW: Check for blocks array - process in order!
    if (def.blocks && Array.isArray(def.blocks) && def.blocks.length > 0) {
      console.log(\`\\n   🧱 Block-based validation (\${def.blocks.length} blocks)\`);
      console.log('   ' + '─'.repeat(47));
      return this._validateBlocks(def.blocks, testData, screenObject, def);
    }
    
    // Legacy format - use existing logic
    console.log(\`\\n   🔍 Validating screen: \${def.name || 'unnamed'} (legacy format)\`);
    console.log('   ' + '─'.repeat(47));
    return this._validateLegacy(def, testData, screenObject);
  }

  /**
   * ✅ NEW: Process blocks IN ORDER
   * This is the key method that enables:
   * - hidden check → custom code → visible check
   */
  static async _validateBlocks(blocks, testData, screenObject, screenDef) {
    const isPlaywright = screenObject.page !== undefined;
    const page = screenObject.page || screenObject;
    
    // Sort blocks by order field
    const sortedBlocks = [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    console.log(\`   Processing \${sortedBlocks.length} blocks in order...\\n\`);
    
    for (let i = 0; i < sortedBlocks.length; i++) {
      const block = sortedBlocks[i];
      
      // Skip disabled blocks
      if (block.enabled === false) {
        console.log(\`   ⏭️  [\${i}] Skipping disabled: \${block.label}\`);
        continue;
      }
      
      console.log(\`   📦 [\${i}] \${block.type}: \${block.label}\`);
      
      try {
        switch (block.type) {
          case 'ui-assertion':
            await this._executeUIAssertionBlock(block, testData, screenObject, page, isPlaywright);
            break;
            
          case 'custom-code':
            await this._executeCustomCodeBlock(block, testData, screenObject, page);
            break;
            
          case 'function-call':
            await this._executeFunctionCallBlock(block, testData, screenObject);
            break;
            
          default:
            console.warn(\`      ⚠️  Unknown block type: \${block.type}\`);
        }
        
        console.log(\`      ✅ Block passed\\n\`);
        
      } catch (error) {
        console.error(\`      ❌ Block failed: \${error.message}\\n\`);
        throw error;
      }
    }
    
    console.log(\`   ✅ All \${sortedBlocks.length} blocks validated\`);
    console.log('   ' + '─'.repeat(47));
  }

  /**
   * ✅ NEW: Execute UI Assertion block
   */
  static async _executeUIAssertionBlock(block, testData, screenObject, page, isPlaywright) {
    const data = block.data || {};
    
    // Visible checks
    if (data.visible && data.visible.length > 0) {
      console.log(\`      ✅ Checking \${data.visible.length} visible...\`);
      for (const elementName of data.visible) {
        await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
      }
    }
    
    // Hidden checks
    if (data.hidden && data.hidden.length > 0) {
      console.log(\`      ❌ Checking \${data.hidden.length} hidden...\`);
      for (const elementName of data.hidden) {
        await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
      }
    }
    
    // Text checks (exact)
    const textChecks = data.checks?.text || {};
    if (Object.keys(textChecks).length > 0) {
      console.log(\`      📝 Checking \${Object.keys(textChecks).length} exact text...\`);
      for (const [elementName, expectedText] of Object.entries(textChecks)) {
        const { locator } = await this._getLocatorForField(screenObject, elementName, page, isPlaywright);
        const resolved = this.resolveTemplate(expectedText, testData);
        await expect(locator).toHaveText(String(resolved), { timeout: 10000 });
        console.log(\`      ✓ \${elementName} = "\${resolved}"\`);
      }
    }
    
    // Contains checks
    const containsChecks = data.checks?.contains || {};
    if (Object.keys(containsChecks).length > 0) {
      console.log(\`      📝 Checking \${Object.keys(containsChecks).length} contains...\`);
      for (const [elementName, expectedText] of Object.entries(containsChecks)) {
        const { locator } = await this._getLocatorForField(screenObject, elementName, page, isPlaywright);
        const resolved = this.resolveTemplate(expectedText, testData);
        await expect(locator).toContainText(String(resolved), { timeout: 10000 });
        console.log(\`      ✓ \${elementName} contains "\${resolved}"\`);
      }
    }
    
    // Truthy
    if (data.truthy && data.truthy.length > 0) {
      console.log(\`      ✓ Checking \${data.truthy.length} truthy...\`);
      for (const funcName of data.truthy) {
        await this._checkTruthy(screenObject, funcName);
      }
    }
    
    // Falsy
    if (data.falsy && data.falsy.length > 0) {
      console.log(\`      ✗ Checking \${data.falsy.length} falsy...\`);
      for (const funcName of data.falsy) {
        await this._checkFalsy(screenObject, funcName);
      }
    }
    
    // Assertions
    if (data.assertions && data.assertions.length > 0) {
      console.log(\`      🔍 Running \${data.assertions.length} assertions...\`);
      for (const assertion of data.assertions) {
        await this._checkAssertion(screenObject, assertion, testData);
      }
    }
  }

  /**
   * ✅ NEW: Execute Custom Code block
   * ⚠️  This uses eval/Function - be careful with untrusted input!
   */
  static async _executeCustomCodeBlock(block, testData, screenObject, page) {
    const code = block.code || '';
    
    if (!code.trim()) {
      console.log(\`      ⚠️  Empty code block, skipping\`);
      return;
    }
    
    console.log(\`      💻 Executing custom code (\${code.split('\\n').length} lines)...\`);
    
    // Wrap in test.step if configured
    if (block.wrapInTestStep && block.testStepName) {
      console.log(\`      📋 Step: \${block.testStepName}\`);
    }
    
    try {
      // Create async function with context
      // Available variables: page, screenObject, testData, expect, ExpectImplication
      const asyncFn = new Function(
        'page', 
        'screenObject', 
        'testData', 
        'expect',
        'ExpectImplication',
        \`return (async () => { \${code} })();\`
      );
      
      await asyncFn(page, screenObject, testData, expect, this);
      console.log(\`      ✅ Custom code executed\`);
      
    } catch (error) {
      console.error(\`      ❌ Custom code error: \${error.message}\`);
      throw new Error(\`Custom code block "\${block.label}" failed: \${error.message}\`);
    }
  }

  /**
   * ✅ NEW: Execute Function Call block
   */
  static async _executeFunctionCallBlock(block, testData, screenObject) {
    const data = block.data || {};
    const { instance, method, args = [], storeAs } = data;
    
    if (!method) {
      console.log(\`      ⚠️  No method specified, skipping\`);
      return;
    }
    
    // Get the instance (could be screenObject itself or a property)
    let target = screenObject;
    if (instance && instance !== 'this' && screenObject[instance]) {
      target = screenObject[instance];
    }
    
    const fn = target[method];
    if (typeof fn !== 'function') {
      throw new Error(\`Method "\${method}" not found on \${instance || 'screenObject'}\`);
    }
    
    // Resolve args
    const resolvedArgs = args.map(arg => this.resolveTemplate(arg, testData));
    
    console.log(\`      ⚡ \${instance || 'screen'}.\${method}(\${resolvedArgs.map(a => JSON.stringify(a)).join(', ')})\`);
    
    const result = data.await !== false
      ? await fn.call(target, ...resolvedArgs)
      : fn.call(target, ...resolvedArgs);
    
    if (storeAs) {
      this.storeValue(storeAs, result);
    }
  }

  /**
   * Legacy validation (existing behavior)
   */
  static async _validateLegacy(def, testData, screenObject) {
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
    
    // Prerequisites
    if (def.prerequisites && def.prerequisites.length > 0) {
      console.log(\`   🔧 Running \${def.prerequisites.length} prerequisites...\`);
      for (const prereq of def.prerequisites) {
        console.log(\`      \${prereq.description}\`);
        await prereq.setup(testData, page);
      }
      console.log('   ✅ Prerequisites completed');
    }

    // Functions (with storeAs)
    if (def.functions && Object.keys(def.functions).length > 0) {
      await this._executeFunctions(def.functions, screenObject, testData);
    }
    
    // Visible
    if (def.visible && def.visible.length > 0) {
      console.log(\`   ✅ Checking \${def.visible.length} visible elements...\`);
      for (const elementName of def.visible) {
        await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
      }
    }
    
    // Hidden
    if (def.hidden && def.hidden.length > 0) {
      console.log(\`   ✅ Checking \${def.hidden.length} hidden elements...\`);
      for (const elementName of def.hidden) {
        await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
      }
    }

    // Truthy
    if (def.truthy && def.truthy.length > 0) {
      console.log(\`   ✅ Checking \${def.truthy.length} truthy functions...\`);
      for (const functionName of def.truthy) {
        await this._checkTruthy(screenObject, functionName);
      }
    }

    // Falsy
    if (def.falsy && def.falsy.length > 0) {
      console.log(\`   ✅ Checking \${def.falsy.length} falsy functions...\`);
      for (const functionName of def.falsy) {
        await this._checkFalsy(screenObject, functionName);
      }
    }

    // Assertions
    if (def.assertions && def.assertions.length > 0) {
      console.log(\`   ✅ Running \${def.assertions.length} assertions...\`);
      for (const assertion of def.assertions) {
        await this._checkAssertion(screenObject, assertion, testData);
      }
    }
    
    // Legacy checks object
    if (def.checks) {
      console.log('   🔍 Running additional checks...');
      
      if (def.checks.visible?.length > 0) {
        for (const elementName of def.checks.visible) {
          await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
        }
      }
      
      if (def.checks.hidden?.length > 0) {
        for (const elementName of def.checks.hidden) {
          await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
        }
      }
      
      if (def.checks.text && Object.keys(def.checks.text).length > 0) {
        for (const [elementName, expectedText] of Object.entries(def.checks.text)) {
          const element = await getElement(elementName);
          const finalText = this.resolveTemplate(expectedText, testData);
          await expect(element).toHaveText(finalText, { timeout: 10000 });
          console.log(\`      ✓ \${elementName} has text: "\${finalText}"\`);
        }
      }
      
      if (def.checks.contains && Object.keys(def.checks.contains).length > 0) {
        for (const [elementName, expectedText] of Object.entries(def.checks.contains)) {
          const element = await getElement(elementName);
          const finalText = this.resolveTemplate(expectedText, testData);
          await expect(element).toContainText(finalText, { timeout: 10000 });
          console.log(\`      ✓ \${elementName} contains: "\${finalText}"\`);
        }
      }
    }
    
    // Custom expect
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
// ai-testing.config.js

module.exports = {
  projectName: "${projectName}",
  projectRoot: __dirname,
  
  // Paths
  utilsPath: "tests/ai-testing/utils",
  outputPath: "tests/implications",
  testDataPath: "tests/data/shared.json",
  
  // Test runner configuration
  testRunner: "playwright",
  playwrightConfig: "playwright.config.ts",           // Main Playwright config
  playwrightImplConfig: "playwright.impl.config.js",  // Implications-specific config
  
  // Platforms supported
  platforms: ["web"],
  
  // Data handling mode: "stateful" (delta files) or "stateless" (fresh each time)
  testDataMode: "stateful",
  
  // Pattern matching for discovery
  patterns: {
    implications: ["tests/implications/**/*Implications.js"],
    tests: ["tests/implications/**/*.spec.js"],
    screenObjects: ["tests/screenObjects/**/*.js", "apps/**/screenObjects/**/*.js"]
  },
  
  // Generation options
  generation: {
    skipTestRegistration: false,
    autoValidateUI: true,
    extractActions: true,
    useFixtures: true,  // Use ({ page }) pattern instead of manual context
  },
  
  // Session-only fields (not persisted to shared.json)
  sessionOnlyFields: ["_tempData", "_sessionToken"],
  
  // Platform prerequisites (login requirements per platform)
  platformPrerequisites: {
    web: {
      check: (data) => data.manager?.logged_in === true,
      state: 'manager_logged_in',
      implClass: 'LoggedInImplications',
      file: 'tests/implications/login/LoggedInViaInitial-LOGIN-Web-UNIT.spec.js',
      actionName: 'loggedInViaInitial'
    }
    // Add more platforms as needed:
    // dancer: { ... },
    // clubApp: { ... }
  },
  
  // Base URL for tests (can also use .env TARGET_URL)
  baseURL: process.env.TARGET_URL || "http://localhost:3000"
};
`;
}


// ═══════════════════════════════════════════════════════════════════════════
// UPDATE 3: Add getPlaywrightImplConfigTemplate function (after getConfigTemplate)
// ═══════════════════════════════════════════════════════════════════════════

function getPlaywrightImplConfigTemplate() {
  return `// Auto-generated by Implications Framework
// playwright.impl.config.js - Dedicated config for implications tests

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = {
  testDir: './tests/implications',
  testMatch: '**/*.spec.js',
  
  // Timeouts
  timeout: 120000,
  expect: {
    timeout: 10000
  },
  
  // Execution settings
  fullyParallel: false,  // Prerequisites need sequential execution
  workers: 1,            // Single worker for state consistency
  retries: 0,
  
  // Reporter
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-implications' }]
  ],
  
  // Browser settings
  use: {
    baseURL: process.env.TARGET_URL || 'http://localhost:3000',
    headless: false,
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  
  // Projects (platforms)
  projects: [
    {
      name: 'web',
      use: {
        browserName: 'chromium',
      },
    },
  ],
};
`;
}


// ═══════════════════════════════════════════════════════════════════════════
// UPDATE 4: File-based template loading for TestPlanner
// Replace getTestPlannerTemplate() with this version
// ═══════════════════════════════════════════════════════════════════════════

function getTestPlannerTemplate() {
  // Try to read from template file first
  const templatePaths = [
    path.join(__dirname, '../templates/TestPlanner.template.js'),
    path.join(__dirname, '../../templates/TestPlanner.template.js'),
    path.join(process.cwd(), 'templates/TestPlanner.template.js'),
  ];
  
  for (const templatePath of templatePaths) {
    try {
      if (fsSync.existsSync(templatePath)) {
        console.log(`   📄 Loading TestPlanner template from: ${templatePath}`);
        return fsSync.readFileSync(templatePath, 'utf8');
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  // Fallback to inline template (shortened version - you'd include full content)
  console.log(`   ⚠️ No template file found, using inline fallback`);
  return getTestPlannerInlineTemplate();
}

// Keep the inline template as fallback
function getTestPlannerInlineTemplate() {
  // This would be the full TestPlanner content
  // For now, return a marker that tells you to set up the template file
  return `// ERROR: TestPlanner template file not found!
// 
// Please create: packages/api-server/templates/TestPlanner.template.js
// Copy from: /mnt/project/TestPlanner.js (the working v4.2 version)
//
// This inline fallback is intentionally broken to remind you to set up templates.

throw new Error('TestPlanner template file not configured. See comment above.');
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


export default router;