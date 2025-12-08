#!/usr/bin/env node
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
        console.warn(`⚠️  Configured playwrightConfig not found: ${config.playwrightConfig}`);
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
        console.warn(`⚠️  Configured appiumConfig not found: ${config.appiumConfig}`);
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
  console.log(`⚠️  Could not detect platform from filename, defaulting to 'web'`);
  return 'web';
}

function extractImplicationClassName(testFile) {
  const filename = path.basename(testFile);
  
  try {
    const content = fs.readFileSync(testFile, 'utf-8');
    const requireMatch = content.match(/(?:const|let|var)\s+(\w+Implications)\s*=\s*require/);
    if (requireMatch) return requireMatch[1];
    
    const pathMatch = content.match(/require\s*\(\s*['"][^'"]*\/(\w+Implications)['"]\s*\)/);
    if (pathMatch) return pathMatch[1];
    
    const statusMatch = content.match(/meta:\s*\{[^}]*status:\s*['"]([\w_]+)['"]/);
    if (statusMatch) {
      return statusMatch[1].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Implications';
    }
  } catch (error) {
    console.error(`⚠️  Could not read test file: ${error.message}`);
  }
  
  const match = filename.match(/^(\w+)Via/);
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
    const found = searchRecursive(basePath, `${className}.js`);
    if (found) return found;
  }
  return null;
}

async function runPreFlightCheck(testFile, implicationClassName) {
  console.log('🚀 Running pre-flight check...');
  console.log(`📄 Test file: ${path.basename(testFile)}`);
  console.log(`📂 Implication file: ${implicationClassName}.js`);
  
  const implFile = findImplicationFile(implicationClassName);
  
  if (!implFile) {
    console.error(`❌ Could not find implication file: ${implicationClassName}.js`);
    console.error(`   Searched in: tests/implications/, tests/ai-testing/implications/`);
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
    console.error(`❌ Pre-flight check failed: ${error.message}`);
    if (error.message.includes('Cannot find module')) {
      console.error(`\n💡 Make sure TestPlanner.js exists at tests/ai-testing/utils/TestPlanner.js`);
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
      args.push(`--config=${playwrightConfig}`);
      console.log(`📄 Using Playwright config: ${playwrightConfig}`);
    } else {
      console.log(`📄 Using Playwright default config detection`);
    }
    args.push(testFile, ...extraArgs);
  } else {
    const appiumConfig = getAppiumConfigPath();
    if (!appiumConfig) {
      console.error(`❌ Could not find Appium/WDIO config file`);
      process.exit(1);
    }
    command = './node_modules/.bin/wdio';
    const userType = platform === 'dancer' ? 'dancer' : 'club';
    args = [appiumConfig, '-u', userType, '--spec', testFile, ...extraArgs];
    console.log(`📄 Using Appium config: ${appiumConfig}`);
  }
  
  console.log(`\n🎬 Spawning ${platform} test runner...`);
  console.log(`   Command: ${command} ${args.join(' ')}\n`);
  
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PREFLIGHT_COMPLETED: 'true', TEST_DATA_PATH: CONFIG.testDataPath }
  });
  
  child.on('close', (code) => process.exit(code || 0));
  child.on('error', (error) => {
    console.error(`❌ Failed to spawn test runner: ${error.message}`);
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
  console.log(`
Multi-Platform Test Runner with PreFlight Check

Usage: npm run test:impl -- <test-file> [options]

Options:
  --skip-preflight    Skip the pre-flight check
  --headed            Run in headed mode (Playwright)
  --project=chromium  Specify Playwright project

Config Detection:
  Playwright: ai-testing.config.js -> playwrightConfig, or auto-detect
  Appium: ai-testing.config.js -> appiumConfig, or auto-detect
`);
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
    console.error(`❌ Test file not found: ${testFile}`);
    process.exit(1);
  }
  
  const platform = detectPlatform(testFile);
  console.log(`\n🎯 Detected platform: ${platform}`);
  
  const implicationClassName = extractImplicationClassName(resolvedTestFile);
  if (!implicationClassName) {
    console.error(`❌ Could not determine Implication class from test file`);
    process.exit(1);
  }
  
  console.log(`📦 Implication class: ${implicationClassName}`);
  
  if (!skipPreflight) {
    await runPreFlightCheck(resolvedTestFile, implicationClassName);
  } else {
    console.log('⏭️  Skipping pre-flight check');
  }
  
  spawnTestRunner(platform, resolvedTestFile, extraArgs);
}

main().catch(error => {
  console.error(`❌ Fatal error: ${error.message}`);
  process.exit(1);
});
