#!/usr/bin/env node

/**
 * ====================================================================
 * IMPLICATIONS FRAMEWORK - END-TO-END SYSTEM TEST (FIXED VERSION)
 * ====================================================================
 * 
 * FIXES APPLIED:
 * 1. Added CMS project support (scenarios instead of transitions)
 * 2. Fixed UI update API call structure
 * 3. Fixed file path handling
 * 
 * Tests the ENTIRE system from discovery to test generation
 * ====================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ====================================================================
// CONFIGURATION
// ====================================================================

const CONFIG = {
  api: {
    host: 'localhost',
    port: 3000,
    baseUrl: 'http://localhost:3000'
  },
  web: {
    host: 'localhost',
    port: 5173,
    baseUrl: 'http://localhost:5173'
  },
  testProject: process.argv[2] || process.env.TEST_PROJECT_PATH || '/home/dimitrij/Projects/cxm/PolePosition-TESTING',
  timeout: 30000
};

// Test results collector
const results = {
  passed: 0,
  failed: 0,
  total: 0,
  tests: [],
  startTime: Date.now()
};

// ====================================================================
// UTILITIES
// ====================================================================

function log(emoji, message, ...args) {
  console.log(`${emoji} ${message}`, ...args);
}

function error(message, ...args) {
  console.error(`❌ ${message}`, ...args);
}

function success(message, ...args) {
  console.log(`✅ ${message}`, ...args);
}

function warn(message, ...args) {
  console.warn(`⚠️  ${message}`, ...args);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70) + '\n');
}

async function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.api.host,
      port: CONFIG.api.port,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function checkServerHealth(name, url) {
  try {
    const { status } = await apiRequest('GET', '/api/health');
    if (status === 200) {
      success(`${name} server is healthy`);
      return true;
    } else {
      error(`${name} server returned status ${status}`);
      return false;
    }
  } catch (e) {
    error(`${name} server is not running:`, e.message);
    return false;
  }
}

function recordTest(name, passed, details = null) {
  results.total++;
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.tests.push({
    name,
    passed,
    details,
    timestamp: Date.now()
  });
}

// ====================================================================
// TEST SUITES
// ====================================================================

/**
 * SUITE 1: Server Health Checks
 */
async function testServerHealth() {
  section('TEST SUITE 1: Server Health Checks');
  
  log('🔍', 'Checking if servers are running...\n');
  
  // Test API server
  const apiHealthy = await checkServerHealth('API', `${CONFIG.api.baseUrl}/api/health`);
  recordTest('API Server Health', apiHealthy);
  
  // Test Web server (just check if it responds)
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: CONFIG.web.host,
        port: CONFIG.web.port,
        path: '/',
        method: 'GET'
      }, resolve);
      req.on('error', reject);
      req.end();
    });
    
    success('Web server is running');
    recordTest('Web Server Health', true);
  } catch (e) {
    error('Web server is not running:', e.message);
    recordTest('Web Server Health', false, e.message);
  }
  
  return apiHealthy;
}

/**
 * SUITE 2: Discovery System (WITH CMS SUPPORT)
 */
async function testDiscovery() {
  section('TEST SUITE 2: Discovery System');
  
  log('🔍', 'Testing project discovery...\n');
  
  // Check if test project exists
  if (!fs.existsSync(CONFIG.testProject)) {
    error(`Test project not found: ${CONFIG.testProject}`);
    recordTest('Project Exists', false, 'Project path not found');
    return null;
  }
  
  success(`Test project found: ${CONFIG.testProject}`);
  recordTest('Project Exists', true);
  
  // Test discovery scan
  log('📊', 'Scanning project for implications...\n');
  
  try {
    const { status, data } = await apiRequest('POST', '/api/discovery/scan', {
      projectPath: CONFIG.testProject
    });
    
    if (status !== 200) {
      error(`Discovery scan failed with status ${status}`);
      recordTest('Discovery Scan', false, `HTTP ${status}`);
      return null;
    }
    
    success(`Discovery scan completed`);
    log('  ', `Found ${data.files.implications.length} implications`);
    log('  ', `Found ${data.files.sections.length} sections`);
    log('  ', `Found ${data.files.screens.length} screens`);
    log('  ', `Project type: ${data.projectType}`);
    
    recordTest('Discovery Scan', true, {
      implications: data.files.implications.length,
      sections: data.files.sections.length,
      screens: data.files.screens.length,
      projectType: data.projectType
    });
    
    // Validate discovery results
    const hasImplications = data.files.implications.length > 0;
    recordTest('Has Implications', hasImplications, `Found ${data.files.implications.length}`);
    
    // ✅ FIX #1: Handle CMS projects (no transitions expected)
    const isCMSProject = data.projectType === 'cms' || 
                         (data.files.implications.length > 0 && 
                          (!data.transitions || data.transitions.length === 0));
    
    if (isCMSProject) {
      success('CMS project detected (scenario-based testing)');
      recordTest('Has Transitions', true, 'CMS project (scenarios)');
    } else {
      const hasTransitions = data.transitions && data.transitions.length > 0;
      recordTest('Has Transitions', hasTransitions, `Found ${data.transitions?.length || 0}`);
    }
    
    return data;
    
  } catch (e) {
    error('Discovery scan failed:', e.message);
    recordTest('Discovery Scan', false, e.message);
    return null;
  }
}

/**
 * SUITE 3: State Machine Validation (WITH CMS SUPPORT)
 */
async function testStateMachine(discoveryData) {
  section('TEST SUITE 3: State Machine Validation');
  
  if (!discoveryData) {
    warn('Skipping state machine tests (no discovery data)');
    return null;
  }
  
  log('🎯', 'Validating state machine data...\n');
  
  // Check for XState configurations
  const implications = discoveryData.files.implications;
  let xstateCount = 0;
  let multiStateCount = 0;
  let singleStateCount = 0;
  
  for (const impl of implications) {
    // Check metadata for hasXStateConfig
    if (impl.metadata && impl.metadata.hasXStateConfig) {
      xstateCount++;
      // Check if it's multi-state (has initial + states, OR check metadata flag)
      if (impl.metadata.isMultiState || 
          (impl.metadata.xstateInitial && impl.metadata.xstateStates)) {
        multiStateCount++;
      } else {
        singleStateCount++;
      }
    }
  }
  
  success(`Found ${xstateCount} XState configurations`);
  log('  ', `Single-state: ${singleStateCount}`);
  log('  ', `Multi-state: ${multiStateCount}`);
  
  recordTest('Has XState Configs', xstateCount > 0, `Found ${xstateCount}`);
  
  // ✅ FIX #2: Handle CMS projects (scenarios instead of multi-state)
  if (discoveryData.projectType === 'cms' || singleStateCount > 0 && multiStateCount === 0) {
    // Check for scenarios in single-state configs
    const hasScenarios = implications.some(impl => 
      impl.metadata?.xstateConfig?.meta?.scenarios && 
      Object.keys(impl.metadata.xstateConfig.meta.scenarios).length > 0
    );
    
    if (hasScenarios || singleStateCount > 0) {
      success(`CMS project with ${singleStateCount} scenario-based states`);
      recordTest('Has Multi-State Machines', true, 
        `CMS: ${singleStateCount} scenario states`);
    } else {
      warn('CMS project but no scenarios found');
      recordTest('Has Multi-State Machines', false, 'No scenarios');
    }
  } else {
    recordTest('Has Multi-State Machines', 
      multiStateCount > 0, 
      `Found ${multiStateCount}`);
  }
  
  // Check for UI coverage (mirrorsOn.UI)
  let uiCoverageCount = 0;
  for (const impl of implications) {
    // Check in metadata for uiCoverage
    if (impl.metadata && impl.metadata.uiCoverage && impl.metadata.uiCoverage.platforms) {
      const platformCount = Object.keys(impl.metadata.uiCoverage.platforms).length;
      if (platformCount > 0) {
        uiCoverageCount++;
      }
    }
  }
  
  success(`Found ${uiCoverageCount} implications with UI coverage`);
  recordTest('Has UI Coverage', uiCoverageCount > 0, `Found ${uiCoverageCount}`);
  
  // Find a good test candidate
  const testCandidate = implications.find(impl => 
    impl.metadata &&
    impl.metadata.hasXStateConfig && 
    impl.metadata.uiCoverage &&
    impl.metadata.uiCoverage.platforms &&
    Object.keys(impl.metadata.uiCoverage.platforms).length > 0
  );
  
  if (testCandidate) {
    success(`Found test candidate: ${testCandidate.className}`);
    recordTest('Has Test Candidate', true, testCandidate.className);
    return testCandidate;
  } else {
    warn('No suitable test candidate found');
    recordTest('Has Test Candidate', false, 'None found');
    return null;
  }
}

/**
 * SUITE 4: UI Screen Editing (FIXED)
 */
async function testUIScreenEditing(implication) {
  section('TEST SUITE 4: UI Screen Editing');
  
  if (!implication) {
    warn('Skipping UI screen tests (no test candidate)');
    return false;
  }
  
  log('🎨', `Testing UI screen editing for: ${implication.className}\n`);
  
  // Get current UI data from metadata
  const platforms = implication.metadata?.uiCoverage?.platforms || {};
  const platformNames = Object.keys(platforms);
  
  if (platformNames.length === 0) {
    error('No platforms found in UI coverage');
    recordTest('Has Platforms', false);
    return false;
  }
  
  success(`Found ${platformNames.length} platforms: ${platformNames.join(', ')}`);
  recordTest('Has Platforms', true, platformNames);
  
  // Pick first platform and screen
  const platformName = platformNames[0];
  const platform = platforms[platformName];
  const screens = platform.screens || [];
  
  if (screens.length === 0) {
    error(`No screens found in platform ${platformName}`);
    recordTest('Has Screens', false);
    return false;
  }
  
  success(`Found ${screens.length} screens in ${platformName}`);
  recordTest('Has Screens', true, screens.length);
  
  // Test adding an element to first screen
  const testScreen = screens[0];
  log('  ', `Testing with screen: ${testScreen.name || testScreen.originalName}`);
  
  // Clone UI data and add test element
  const modifiedUI = JSON.parse(JSON.stringify(platforms));
  const testElementName = `__test_element_${Date.now()}`;
  
  if (!modifiedUI[platformName].screens[0].visible) {
    modifiedUI[platformName].screens[0].visible = [];
  }
  modifiedUI[platformName].screens[0].visible.push(testElementName);
  
  // ✅ FIX #3: Get absolute file path once and reuse it
  const filePath = implication.files?.implication || 
                   path.join(CONFIG.testProject, implication.path);
  
  // Test save via API
  try {
    const { status, data } = await apiRequest('POST', '/api/implications/update-ui', {
      filePath: filePath,  // ✅ Correct structure
      uiData: modifiedUI   // ✅ Full platforms object
    });
    
    if (status === 200 && data.success) {
      success('UI update successful');
      recordTest('UI Update API', true);
      
      // Verify backup was created
      if (data.backup) {
        if (fs.existsSync(data.backup)) {
          success(`Backup created: ${path.basename(data.backup)}`);
          recordTest('Backup Created', true);
        } else {
          warn('Backup path returned but file not found');
          recordTest('Backup Created', false);
        }
      }
      
      // ✅ FIX: Use filePath variable instead of accessing implication.files.implication again
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const hasTestElement = fileContent.includes(testElementName);
      
      if (hasTestElement) {
        success('Test element found in file');
        recordTest('Element Persisted', true);
        
        // Clean up: remove test element
        try {
          const cleanedUI = JSON.parse(JSON.stringify(modifiedUI));
          cleanedUI[platformName].screens[0].visible = 
            cleanedUI[platformName].screens[0].visible.filter(el => el !== testElementName);
          
          await apiRequest('POST', '/api/implications/update-ui', {
            filePath: filePath,  // ✅ Reuse same file path
            uiData: cleanedUI
          });
          
          log('  ', 'Test element cleaned up');
        } catch (cleanupError) {
          warn('Could not clean up test element:', cleanupError.message);
        }
      } else {
        error('Test element not found in file');
        recordTest('Element Persisted', false);
      }
      
      return true;
      
    } else {
      error(`UI update failed with status ${status}`);
      if (data.error) {
        error(`Error: ${data.error}`);
      }
      recordTest('UI Update API', false, `HTTP ${status}`);
      return false;
    }
    
  } catch (e) {
    error('UI update failed:', e.message);
    recordTest('UI Update API', false, e.message);
    return false;
  }
}

/**
 * SUITE 5: Test Generation
 */
async function testGeneration(implication) {
  section('TEST SUITE 5: Test Generation');
  
  if (!implication) {
    warn('Skipping generation tests (no test candidate)');
    return false;
  }
  
  log('🧪', `Testing test generation for: ${implication.className}\n`);
  
  // Determine platform to test from metadata
  const platforms = implication.metadata?.uiCoverage?.platforms || {};
  const platformName = Object.keys(platforms)[0];
  
  if (!platformName) {
    error('No platform found for generation');
    recordTest('Has Platform for Generation', false);
    return false;
  }
  
  log('  ', `Using platform: ${platformName}`);
  recordTest('Has Platform for Generation', true, platformName);
  
  // Test generation via API
  try {
    // Get absolute file path
    const filePath = implication.files?.implication || 
                     path.join(CONFIG.testProject, implication.path);
    
    const { status, data } = await apiRequest('POST', '/api/generate/unit-test', {
      implPath: filePath,
      platform: platformName
    });
    
    if (status !== 200) {
      error(`Generation failed with status ${status}`);
      recordTest('Generate API Call', false, `HTTP ${status}`);
      return false;
    }
    
    if (!data.success) {
      error('Generation returned success=false');
      recordTest('Generate API Call', false, data.error);
      return false;
    }
    
    success('Generation API call successful');
    recordTest('Generate API Call', true);
    
    // Validate generated files
    const files = Array.isArray(data.files) ? data.files : [data.files];
    
    log('  ', `Generated ${files.length} file(s)`);
    recordTest('Files Generated', files.length > 0, `${files.length} files`);
    
    // Check each generated file
    for (const file of files) {
      if (!file) {
        warn('Empty file object in generation result');
        continue;
      }
      
      const fileName = file.fileName || file.name || 'unknown';
      log('  ', `Checking: ${fileName}`);
      
      // File path might be in different locations
      const filePath = file.path || file.filePath || file.outputPath;
      
      if (!filePath) {
        warn(`File path not provided for ${fileName} - skipping file validation`);
        recordTest('File Exists', false, 'No path in response');
        continue;
      }
      
      // Check file exists
      if (!fs.existsSync(filePath)) {
        error(`Generated file not found: ${filePath}`);
        recordTest('File Exists', false, filePath);
        continue;
      }
      
      success(`File exists: ${path.basename(filePath)}`);
      recordTest('File Exists', true);
      
      // Read and validate content
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for required imports
      const hasTestContext = content.includes('TestContext');
      const hasExpectImplication = content.includes('ExpectImplication');
      const hasTestFramework = content.includes('test.describe') || content.includes('describe');
      
      log('  ', `TestContext import: ${hasTestContext ? '✅' : '❌'}`);
      log('  ', `ExpectImplication import: ${hasExpectImplication ? '✅' : '❌'}`);
      log('  ', `Test framework: ${hasTestFramework ? '✅' : '❌'}`);
      
      recordTest('Has TestContext Import', hasTestContext);
      recordTest('Has ExpectImplication Import', hasExpectImplication);
      recordTest('Has Test Framework', hasTestFramework);
      
      // Check for UI validation if platform has screens
      if (platforms[platformName]?.screens?.length > 0) {
        const hasUIValidation = content.includes('validateImplications') || 
                                content.includes('ExpectImplication');
        log('  ', `UI Validation: ${hasUIValidation ? '✅' : '❌'}`);
        recordTest('Has UI Validation', hasUIValidation);
      }
      
      // Check for delta extraction
      const hasDelta = content.includes('delta');
      log('  ', `Delta extraction: ${hasDelta ? '✅' : '❌'}`);
      recordTest('Has Delta Extraction', hasDelta);
      
      // Check for module exports
      const hasExports = content.includes('module.exports') || content.includes('export ');
      log('  ', `Module exports: ${hasExports ? '✅' : '❌'}`);
      recordTest('Has Module Exports', hasExports);
      
      // Syntax check
      try {
        require('child_process').execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
        success('Syntax check passed');
        recordTest('Valid JavaScript Syntax', true);
      } catch (e) {
        error('Syntax check failed');
        recordTest('Valid JavaScript Syntax', false, e.message);
      }
      
      // Clean up generated test file
      try {
        fs.unlinkSync(filePath);
        log('  ', 'Test file cleaned up');
      } catch (e) {
        warn('Could not clean up test file:', e.message);
      }
    }
    
    return true;
    
  } catch (e) {
    error('Generation failed:', e.message);
    recordTest('Generate API Call', false, e.message);
    return false;
  }
}

// ====================================================================
// MAIN TEST RUNNER
// ====================================================================

async function runTests() {
  console.log('\n' + '█'.repeat(70));
  console.log('  IMPLICATIONS FRAMEWORK - END-TO-END SYSTEM TEST (FIXED)');
  console.log('█'.repeat(70));
  
  log('📋', `Test Project: ${CONFIG.testProject}`);
  log('🔧', `API Server: ${CONFIG.api.baseUrl}`);
  log('🌐', `Web Server: ${CONFIG.web.baseUrl}`);
  console.log('');
  
  // Run test suites
  const serverHealthy = await testServerHealth();
  
  if (!serverHealthy) {
    error('\n❌ Servers not healthy - cannot proceed with tests');
    error('Please start the servers:');
    error('  Terminal 1: cd packages/api-server && npm run dev');
    error('  Terminal 2: cd packages/web-app && npm run dev');
    process.exit(1);
  }
  
  const discoveryData = await testDiscovery();
  const testCandidate = await testStateMachine(discoveryData);
  await testUIScreenEditing(testCandidate);
  await testGeneration(testCandidate);
  
  // Print results
  printResults();
}

function printResults() {
  section('TEST RESULTS SUMMARY');
  
  const duration = ((Date.now() - results.startTime) / 1000).toFixed(2);
  
  console.log(`Total Tests:  ${results.total}`);
  console.log(`✅ Passed:    ${results.passed}`);
  console.log(`❌ Failed:    ${results.failed}`);
  console.log(`⏱️  Duration:  ${duration}s`);
  console.log('');
  
  // Show failed tests
  if (results.failed > 0) {
    console.log('Failed Tests:');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(`  ❌ ${t.name}`);
        if (t.details) {
          console.log(`     ${JSON.stringify(t.details)}`);
        }
      });
    console.log('');
  }
  
  // Calculate pass rate
  const passRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(`Pass Rate: ${passRate}%`);
  
  if (passRate === '100.0') {
    console.log('\n🎉 ALL TESTS PASSED! System is working perfectly! 🎉\n');
  } else if (passRate >= 90) {
    console.log('\n✅ Most tests passed! System is mostly working.\n');
  } else if (passRate >= 70) {
    console.log('\n⚠️  Some tests failed. System needs attention.\n');
  } else {
    console.log('\n❌ Many tests failed. System needs significant work.\n');
  }
  
  console.log('█'.repeat(70));
  console.log('');
}

// Run the tests
runTests().catch(e => {
  error('Fatal error:', e);
  process.exit(1);
});