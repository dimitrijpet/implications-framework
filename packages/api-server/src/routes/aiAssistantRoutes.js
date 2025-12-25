/**
 * AI Assistant API Routes
 * 
 * Endpoints:
 *   GET  /api/ai-assistant/status           - Check configuration
 *   POST /api/ai-assistant/scan-url         - Scan a URL
 *   POST /api/ai-assistant/analyze-screenshot - Analyze uploaded screenshot
 */

import express from 'express';
import { AIAssistantService } from '../services/ai-assistant/AIAssistantService.js';

const router = express.Router();

// Create service instance (shared across requests)
const aiAssistant = new AIAssistantService();

/**
 * GET /api/ai-assistant/status
 * Check if AI Assistant is properly configured
 */
router.get('/status', (req, res) => {
  try {
    const config = aiAssistant.checkConfiguration();
    
    res.json({
      success: true,
      ...config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-assistant/scan-url
 * Scan a URL and generate POM/locators/transitions
 * 
 * Body:
 *   url: string (required) - URL to scan
 *   screenName: string (optional) - Override screen name
 *   platform: string (optional) - 'web' | 'mobile' (default: 'web')
 *   generateLocators: boolean (optional, default: true)
 *   generatePOM: boolean (optional, default: true)
 *   generateTransitions: boolean (optional, default: true)
 */
router.post('/scan-url', async (req, res) => {
  const { 
    url, 
    screenName, 
    platform = 'web',
    generateLocators = true,
    generatePOM = true,
    generateTransitions = true
  } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required'
    });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL format'
    });
  }

  try {
    console.log(`🔍 AI Assistant: Scanning ${url}`);
    
    const result = await aiAssistant.scanUrl(url, {
      screenName,
      platform,
      generateLocators,
      generatePOM,
      generateTransitions
    });

    // Close browser after scan
    await aiAssistant.close();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ Scan error:', error);
    
    // Ensure browser is closed on error
    try {
      await aiAssistant.close();
    } catch (e) {}

    res.status(500).json({
      success: false,
      error: error.message,
      url
    });
  }
});

/**
 * POST /api/ai-assistant/analyze-screenshot
 * Analyze an uploaded screenshot
 * 
 * Body:
 *   screenshot: string (required) - Base64 encoded PNG
 *   screenName: string (optional) - Override screen name
 *   pageTitle: string (optional) - Page title for context
 *   pageUrl: string (optional) - Page URL for context
 *   platform: string (optional) - 'web' | 'mobile' (default: 'web')
 *   generateLocators: boolean (optional, default: true)
 *   generatePOM: boolean (optional, default: true)
 *   generateTransitions: boolean (optional, default: true)
 */
router.post('/analyze-screenshot', async (req, res) => {
  const { 
    screenshot,
    screenName,
    pageTitle = '',
    pageUrl = '',
    platform = 'web',
    generateLocators = true,
    generatePOM = true,
    generateTransitions = true
  } = req.body;

  if (!screenshot) {
    return res.status(400).json({
      success: false,
      error: 'Screenshot (base64) is required'
    });
  }

  // Basic validation - check if it looks like base64
  if (screenshot.length < 100) {
    return res.status(400).json({
      success: false,
      error: 'Screenshot appears to be invalid or too small'
    });
  }

  try {
    console.log(`🔍 AI Assistant: Analyzing screenshot`);
    
    const result = await aiAssistant.analyzeScreenshot(screenshot, {
      screenName,
      pageTitle,
      pageUrl,
      platform,
      generateLocators,
      generatePOM,
      generateTransitions
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ Analysis error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-assistant/validate-element
 * Check if an element exists in a screenshot
 * 
 * Body:
 *   screenshot: string (required) - Base64 encoded PNG
 *   elementDescription: string (required) - Natural language description
 */
router.post('/validate-element', async (req, res) => {
  const { screenshot, elementDescription } = req.body;

  if (!screenshot || !elementDescription) {
    return res.status(400).json({
      success: false,
      error: 'Both screenshot and elementDescription are required'
    });
  }

  try {
    const vision = aiAssistant.getVisionAdapter();
    const result = await vision.validateElement(screenshot, elementDescription);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-assistant/compare-screenshots
 * Compare two screenshots and identify changes
 * 
 * Body:
 *   before: string (required) - Base64 encoded PNG (before state)
 *   after: string (required) - Base64 encoded PNG (after state)
 */
router.post('/compare-screenshots', async (req, res) => {
  const { before, after } = req.body;

  if (!before || !after) {
    return res.status(400).json({
      success: false,
      error: 'Both before and after screenshots are required'
    });
  }

  try {
    const vision = aiAssistant.getVisionAdapter();
    const result = await vision.compareScreenshots(before, after);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/**
 * POST /api/ai-assistant/save-to-project
 * Save generated code to project files
 * 
 * Body:
 *   projectPath: string (required) - Path to guest project
 *   screenName: string (required) - Screen name (e.g., "LoginScreen")
 *   fileType: string (required) - 'locators' | 'pom' | 'transitions' | 'all'
 *   code: object (required) - { locators, pom, transitions }
 *   overwrite: boolean (optional) - Overwrite existing files (default: false)
 */
router.post('/save-to-project', async (req, res) => {
  const { 
    projectPath, 
    screenName, 
    fileType = 'all',
    code,
    overwrite = false 
  } = req.body;

  if (!projectPath) {
    return res.status(400).json({ success: false, error: 'projectPath is required' });
  }
  if (!screenName) {
    return res.status(400).json({ success: false, error: 'screenName is required' });
  }
  if (!code) {
    return res.status(400).json({ success: false, error: 'code is required' });
  }

  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    console.log(`💾 Saving ${fileType} for ${screenName} to ${projectPath}`);

    // Determine output directory structure
    // Default: tests/screens/[screenName]/
    const screensDir = path.join(projectPath, 'tests', 'screens', screenName);
    
    // Create directory if it doesn't exist
    await fs.mkdir(screensDir, { recursive: true });

    const savedFiles = [];
    const skippedFiles = [];

    // Helper to save a file
    const saveFile = async (filename, content, type) => {
      if (!content) return;
      
      const filePath = path.join(screensDir, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
        if (!overwrite) {
          skippedFiles.push({ path: filePath, reason: 'File exists (use overwrite: true)' });
          return;
        }
        // Backup existing file
        const backupPath = `${filePath}.backup-${Date.now()}`;
        await fs.copyFile(filePath, backupPath);
        console.log(`  📦 Backed up existing file to ${backupPath}`);
      } catch {
        // File doesn't exist, safe to create
      }

      await fs.writeFile(filePath, content, 'utf-8');
      savedFiles.push({ path: filePath, type });
      console.log(`  ✅ Saved ${type}: ${filePath}`);
    };

    // Save requested file types
    if (fileType === 'all' || fileType === 'locators') {
      await saveFile('locators.js', code.locators, 'locators');
    }
    if (fileType === 'all' || fileType === 'pom') {
      await saveFile(`${screenName}.js`, code.pom, 'pom');
    }
    if (fileType === 'all' || fileType === 'transitions') {
      await saveFile('transitions.js', code.transitions, 'transitions');
    }

    // Create index.js to export everything
    if (savedFiles.length > 0) {
      const indexContent = generateIndexFile(screenName, savedFiles);
      await saveFile('index.js', indexContent, 'index');
    }

    res.json({
      success: true,
      screenName,
      directory: screensDir,
      savedFiles,
      skippedFiles
    });

  } catch (error) {
    console.error('❌ Save failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate index.js that exports all screen files
 */
function generateIndexFile(screenName, savedFiles) {
  const exports = [];
  
  savedFiles.forEach(file => {
    if (file.type === 'locators') {
      exports.push(`export * from './locators.js';`);
    } else if (file.type === 'pom') {
      exports.push(`export { ${screenName} } from './${screenName}.js';`);
    } else if (file.type === 'transitions') {
      exports.push(`export * from './transitions.js';`);
    }
  });

  return `// Auto-generated by AI Assistant
// Screen: ${screenName}
// Generated: ${new Date().toISOString()}

${exports.join('\n')}
`;
}


/**
 * POST /api/ai-assistant/create-implication
 * Create an implication file from scan results using LLM
 */
router.post('/create-implication', async (req, res) => {
  const {
  projectPath,
  screenName,
  status,
  elements,
  platform = 'web',
  entity = '',
  previousState = '',
  triggerEvent = '',
  tags = {},
  outputPath = 'tests/implications'  // ADD THIS
} = req.body;

  if (!projectPath || !screenName || !status || !elements) {
    return res.status(400).json({
      success: false,
      error: 'projectPath, screenName, status, and elements are required'
    });
  }

  const fs = await import('fs/promises');
  const path = await import('path');
  const { generateImplicationFromScan, isLLMEnabled } = await import('../services/llmservice.js');

  try {
    console.log(`🔧 Creating implication: ${screenName} (${status})`);

    // Try to load an example implication for context
    let exampleImplication = '';
    const implicationsDir = path.join(projectPath, outputPath);
    try {
      const files = await fs.readdir(implicationsDir);
      const implFile = files.find(f => f.endsWith('Implications.js'));
      if (implFile) {
        exampleImplication = await fs.readFile(path.join(implicationsDir, implFile), 'utf-8');
        console.log(`  📖 Using ${implFile} as reference`);
      }
    } catch (e) {
      console.log('  ⚠️ No example implication found, using defaults');
    }

    let implicationCode;
    
    if (isLLMEnabled()) {
      // Use LLM to generate proper implication
      console.log('  🤖 Generating with LLM...');
      implicationCode = await generateImplicationFromScan({
        screenName,
        status,
        elements,
        platform,
        entity,
        context: { previousState, triggerEvent, tags },
        exampleImplication
      });
    } else {
      // Fallback to simple template
      console.log('  📝 Using fallback template (LLM disabled)');
      implicationCode = generateImplicationCode({ screenName, status, elements, platform, entity, previousState, triggerEvent, tags });
    }

    // Ensure directory exists
    await fs.mkdir(implicationsDir, { recursive: true });

    const fileName = `${screenName}Implications.js`;
    const filePath = path.join(implicationsDir, fileName);

    // Backup existing file
    let backed = false;
    try {
      await fs.access(filePath);
      const backupPath = `${filePath}.backup-${Date.now()}`;
      await fs.copyFile(filePath, backupPath);
      backed = true;
      console.log(`  📦 Backed up to ${backupPath}`);
    } catch {
      // File doesn't exist
    }

    // Write file
    await fs.writeFile(filePath, implicationCode, 'utf-8');
    console.log(`  ✅ Created ${filePath}`);

    res.json({
      success: true,
      filePath,
      fileName,
      backed,
      screenName,
      status,
      elementsCount: elements.length,
      usedLLM: isLLMEnabled()
    });

  } catch (error) {
    console.error('❌ Create implication failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-assistant/scan-from-state
 * Run prerequisites to reach a state, then scan
 * 
 * Body:
 *   projectPath: string (required) - Path to guest project
 *   targetState: string (required) - State to reach (e.g., "booking_accepted")
 *   platform: string (optional) - 'web' | 'dancer' | 'manager' (default: 'web')
 */
router.post('/scan-from-state', async (req, res) => {
  const {
    projectPath,
    targetState,
    platform = 'web'
  } = req.body;

  if (!projectPath || !targetState) {
    return res.status(400).json({
      success: false,
      error: 'projectPath and targetState are required'
    });
  }

  const fs = await import('fs/promises');
  const fsSync = await import('fs');
  const path = await import('path');
  const { spawn } = await import('child_process');

  try {
    console.log(`🎯 Scan from state: ${targetState} (${platform})`);

    // Load guest project config
    const configPath = path.join(projectPath, 'ai-testing.config.js');
    let config;
    try {
      delete require.cache[require.resolve(configPath)];
      config = require(configPath);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: `Could not load ai-testing.config.js: ${e.message}`
      });
    }

    const testDataPath = config.testDataPath || 'tests/data/shared.json';
    const screenshotPath = path.join(projectPath, 'temp-scan-screenshot.png');
    
    // Find the implication class for the target state
    const stateRegistryPath = path.join(projectPath, 'tests/implications/.state-registry.json');
    let stateRegistry = {};
    try {
      stateRegistry = JSON.parse(await fs.readFile(stateRegistryPath, 'utf-8'));
    } catch (e) {
      console.log('   ⚠️ No state registry found, will try direct path');
    }

    // Find implication file for target state
    const stateInfo = stateRegistry[targetState];
    let implicationPath;
    
    if (stateInfo?.file) {
      implicationPath = stateInfo.file;
    } else {
      // Try to find by pattern
      const implPattern = path.join(projectPath, 'tests/implications/**/*Implications.js');
      const glob = (await import('glob')).glob;
      const files = await glob(implPattern);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        if (content.includes(`status: '${targetState}'`) || content.includes(`status: "${targetState}"`)) {
          implicationPath = file;
          break;
        }
      }
    }

    if (!implicationPath) {
      return res.status(400).json({
        success: false,
        error: `Could not find implication for state: ${targetState}`
      });
    }

    console.log(`   📄 Found implication: ${implicationPath}`);

    // Generate temporary scan script
    const scanScriptContent = generateScanScript({
      implicationPath: path.relative(projectPath, implicationPath),
      testDataPath,
      screenshotPath: 'temp-scan-screenshot.png',
      targetState,
      platform
    });

    const scanScriptPath = path.join(projectPath, 'temp-scan-script.spec.js');
    await fs.writeFile(scanScriptPath, scanScriptContent);
    console.log(`   📝 Created scan script`);

    // Run the scan script
    console.log(`   🚀 Running prerequisites...`);
    
    const result = await new Promise((resolve, reject) => {
      const playwrightConfig = config.playwrightImplConfig || config.playwrightConfig || 'playwright.config.ts';
      
      const proc = spawn('npx', [
        'playwright', 'test', 
        'temp-scan-script.spec.js',
        '--config', playwrightConfig,
        '--reporter', 'list'
      ], {
        cwd: projectPath,
        shell: true,
        env: {
          ...process.env,
          SCAN_MODE: 'true',
          TEST_DATA_PATH: testDataPath
        }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`   ${data.toString().trim()}`);
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    // Clean up scan script
    try {
      await fs.unlink(scanScriptPath);
    } catch (e) {}

    // Check if screenshot was created
    if (!fsSync.default.existsSync(screenshotPath)) {
      return res.status(500).json({
        success: false,
        error: 'Screenshot was not created. Prerequisites may have failed.',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.code
      });
    }

    console.log(`   📸 Screenshot captured`);

    // Read screenshot
    const screenshotBuffer = await fs.readFile(screenshotPath);
    const screenshotBase64 = screenshotBuffer.toString('base64');

    // Clean up screenshot
    try {
      await fs.unlink(screenshotPath);
    } catch (e) {}

    // Analyze with Vision AI
    console.log(`   🧠 Analyzing with Vision AI...`);
    
    const analysisResult = await aiAssistant.analyzeScreenshot(screenshotBase64, {
      screenName: targetState.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\s/g, ''),
      platform,
      generateLocators: true,
      generatePOM: true,
      generateTransitions: true
    });

    // Add state context to result
    res.json({
      ...analysisResult,
      sourceState: targetState,
      platform,
      testDataPath,
      prerequisitesRun: true
    });

  } catch (error) {
    console.error('❌ Scan from state failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate a temporary Playwright script that runs prerequisites and takes screenshot
 */
function generateScanScript({ implicationPath, testDataPath, screenshotPath, targetState, platform }) {
  return `// Auto-generated scan script - DO NOT COMMIT
const { test } = require('@playwright/test');
const path = require('path');

// Load the target implication
const ImplicationClass = require('./${implicationPath.replace(/\\/g, '/')}');
const TestPlanner = require('./tests/ai-testing/utils/TestPlanner');
const TestContext = require('./tests/ai-testing/utils/TestContext');

test.describe('AI Assistant Scan', () => {
  test.setTimeout(180000); // 3 minutes for prerequisites

  test('Run prerequisites and capture screenshot', async ({ page }) => {
    const testDataPath = '${testDataPath}';
    
    console.log('🎯 Target state: ${targetState}');
    console.log('📂 Test data: ' + testDataPath);
    
    // Load current test data
    const ctx = TestContext.load(ImplicationClass, testDataPath);
    
    console.log('📊 Current status:', ctx.data.status);
    
    // Run prerequisites (this is the magic!)
    console.log('⚡ Running prerequisites via TestPlanner...');
    
    await TestPlanner.checkOrThrow(ImplicationClass, ctx.data, {
      page,
      testDataPath
    });
    
    console.log('✅ Prerequisites complete!');
    
    // Wait a moment for any animations/loading
    await page.waitForTimeout(1000);
    
    // Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ 
      path: '${screenshotPath}',
      fullPage: false
    });
    
    console.log('✅ Screenshot saved to ${screenshotPath}');
  });
});
`;
}

/**
 * GET /api/ai-assistant/available-states
 * Get list of available states from a project
 */
router.get('/available-states', async (req, res) => {
  const { projectPath } = req.query;

  if (!projectPath) {
    return res.status(400).json({
      success: false,
      error: 'projectPath query param is required'
    });
  }

  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    // Try state registry first
    const stateRegistryPath = path.join(projectPath, 'tests/implications/.state-registry.json');
    
    try {
      const registry = JSON.parse(await fs.readFile(stateRegistryPath, 'utf-8'));
      const states = Object.entries(registry).map(([status, info]) => ({
        status,
        className: info.className,
        file: info.file,
        platform: info.platform,
        entity: info.entity
      }));

      return res.json({
        success: true,
        source: 'state-registry',
        states: states.sort((a, b) => a.status.localeCompare(b.status))
      });
    } catch (e) {
      // No registry, scan implications
    }

    // Fallback: scan implication files
    const glob = (await import('glob')).glob;
    const implFiles = await glob(path.join(projectPath, 'tests/implications/**/*Implications.js'));
    
    const states = [];
    
    for (const file of implFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        
        // Extract status from xstateConfig
        const statusMatch = content.match(/status:\s*['"]([^'"]+)['"]/);
        const platformMatch = content.match(/platform:\s*['"]([^'"]+)['"]/);
        const entityMatch = content.match(/entity:\s*['"]([^'"]+)['"]/);
        const classMatch = content.match(/class\s+(\w+Implications)/);
        
        if (statusMatch) {
          states.push({
            status: statusMatch[1],
            className: classMatch?.[1] || path.basename(file, '.js'),
            file: path.relative(projectPath, file),
            platform: platformMatch?.[1] || 'unknown',
            entity: entityMatch?.[1] || 'unknown'
          });
        }
      } catch (e) {
        // Skip invalid files
      }
    }

    res.json({
      success: true,
      source: 'file-scan',
      states: states.sort((a, b) => a.status.localeCompare(b.status))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate implication class code from scan results
 */
function generateImplicationCode({ screenName, status, elements, platform, entity, previousState, triggerEvent, tags }) {
  const className = `${screenName}Implications`;
  
  // Build mirrorsOn UI checks from elements - USE DOUBLE QUOTES for selectors
  const uiChecks = elements.map(el => {
    const selector = el.selectors?.[0]?.value || `[data-testid="${el.name}"]`;
    // Escape any double quotes in the selector
    const escapedSelector = selector.replace(/"/g, '\\"');

    if (el.type === 'input') {
      return `        ${el.name}: {
          visible: true,
          selector: "${escapedSelector}"
        }`;
    } else if (el.type === 'button') {
      return `        ${el.name}: {
          visible: true,
          enabled: true,
          selector: "${escapedSelector}"
        }`;
    } else {
      return `        ${el.name}: {
          visible: true,
          selector: "${escapedSelector}"
        }`;
    }
  }).join(',\n');

  // Build transitions from interactive elements
  const transitions = elements
    .filter(el => el.isInteractive && (el.type === 'button' || el.type === 'link'))
    .map(el => {
      const eventName = `CLICK_${el.name.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
      return `      ${eventName}: {
        target: 'next_state', // TODO: Set actual target
        actions: ['click${el.name.charAt(0).toUpperCase() + el.name.slice(1)}']
      }`;
    }).join(',\n');

  // Generate requires array if previousState provided
  const requiresSection = previousState 
    ? `requires: ['${previousState}'],` 
    : '';

  // Generate tags section
  const tagsSection = (tags.screen || tags.group) 
    ? `tags: {
          ${tags.screen ? `screen: '${tags.screen}',` : ''}
          ${tags.group ? `group: '${tags.group}'` : ''}
        },` 
    : '';

  return `// Auto-generated by AI Assistant
// Screen: ${screenName}
// Generated: ${new Date().toISOString()}

import { BaseBookingImplications } from './BaseBookingImplications.js';

export class ${className} extends BaseBookingImplications {
  
  static xstateConfig = {
    meta: {
      status: '${status}',
      ${entity ? `entity: '${entity}',` : ''}
      ${requiresSection}
      ${tagsSection}
      description: 'Auto-generated from AI scan of ${screenName}'
    },
    on: {
${transitions || '      // TODO: Add transitions'}
    }
  };

  static mirrorsOn = {
    UI: {
      ${platform}: {
${uiChecks}
      }
    }
  };

  /**
   * Setup function to reach this state
   */
  static async setup(page, testData) {
    ${previousState ? `// Requires: ${previousState}` : '// TODO: Implement setup steps'}
    ${triggerEvent ? `// Triggered by: ${triggerEvent}` : ''}
  }
}
`;
}

/**
 * GET /api/ai-assistant/available-states
 * Get list of available states from a project
 */
router.get('/available-states', async (req, res) => {
  const { projectPath } = req.query;

  if (!projectPath) {
    return res.status(400).json({
      success: false,
      error: 'projectPath query param is required'
    });
  }

  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    // Try state registry first
    const stateRegistryPath = path.join(projectPath, 'tests/implications/.state-registry.json');
    
    try {
      const registry = JSON.parse(await fs.readFile(stateRegistryPath, 'utf-8'));
      const states = Object.entries(registry).map(([status, info]) => ({
        status,
        className: info.className,
        file: info.file,
        platform: info.platform,
        entity: info.entity
      }));

      return res.json({
        success: true,
        source: 'state-registry',
        states: states.sort((a, b) => a.status.localeCompare(b.status))
      });
    } catch (e) {
      // No registry, scan implications
    }

    // Fallback: scan implication files
    const { glob } = await import('glob');
    const implFiles = await glob(path.join(projectPath, 'tests/implications/**/*Implications.js'));
    
    const states = [];
    
    for (const file of implFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        
        const statusMatch = content.match(/status:\s*['"]([^'"]+)['"]/);
        const platformMatch = content.match(/platforms?:\s*\[?['"]([^'"]+)['"]/);
        const entityMatch = content.match(/entity:\s*['"]([^'"]+)['"]/);
        const classMatch = content.match(/class\s+(\w+Implications)/);
        
        if (statusMatch) {
          states.push({
            status: statusMatch[1],
            className: classMatch?.[1] || path.basename(file, '.js'),
            file: path.relative(projectPath, file),
            platform: platformMatch?.[1] || 'web',
            entity: entityMatch?.[1] || 'unknown'
          });
        }
      } catch (e) {}
    }

    res.json({
      success: true,
      source: 'file-scan',
      states: states.sort((a, b) => a.status.localeCompare(b.status))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Store debug browser session
let debugSession = null;

/**
 * POST /api/ai-assistant/debug-browser/launch
 * Launch a debug browser for manual interaction
 */
router.post('/debug-browser/launch', async (req, res) => {
  const { startUrl } = req.body;

  // Close existing session if any
  if (debugSession) {
    try {
      await debugSession.browser.close();
    } catch (e) {}
    debugSession = null;
  }

  try {
    const { chromium } = await import('playwright');
    
    console.log('🚀 Launching debug browser...');
    
    // Launch visible browser with X11 workaround for Wayland
    const browser = await chromium.launch({
      headless: false,
      channel: 'chrome',  // Use installed Chrome instead of bundled Chromium
      args: [
        '--start-maximized',
        '--disable-gpu-sandbox'
      ],
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ':0',  // Force X11 display
      }
    });

    const context = await browser.newContext({
      viewport: null  // Use full window size
    });
    
    const page = await context.newPage();
    
    // Navigate to start URL if provided
    if (startUrl) {
      await page.goto(startUrl);
    }

    // Store session
    debugSession = {
      browser,
      context,
      page,
      launchedAt: new Date().toISOString(),
      startUrl
    };

    console.log('✅ Debug browser launched');

    res.json({
      success: true,
      status: 'running',
      launchedAt: debugSession.launchedAt,
      startUrl
    });

  } catch (error) {
    console.error('❌ Failed to launch debug browser:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai-assistant/debug-browser/status
 * Check debug browser status
 */
router.get('/debug-browser/status', async (req, res) => {
  if (!debugSession) {
    return res.json({
      success: true,
      status: 'closed',
      running: false
    });
  }

  try {
    // Check if browser is still connected
    const isConnected = debugSession.browser.isConnected();
    
    if (!isConnected) {
      debugSession = null;
      return res.json({
        success: true,
        status: 'closed',
        running: false
      });
    }

    // Get current URL
    const currentUrl = await debugSession.page.url();
    const title = await debugSession.page.title();

    res.json({
      success: true,
      status: 'running',
      running: true,
      launchedAt: debugSession.launchedAt,
      currentUrl,
      pageTitle: title
    });

  } catch (error) {
    debugSession = null;
    res.json({
      success: true,
      status: 'closed',
      running: false
    });
  }
});

/**
 * POST /api/ai-assistant/debug-browser/capture
 * Capture screenshot from debug browser and analyze
 */
router.post('/debug-browser/capture', async (req, res) => {
  const { 
    screenName,
    platform = 'web',
    generateLocators = true,
    generatePOM = true,
    generateTransitions = true
  } = req.body;

  if (!debugSession) {
    return res.status(400).json({
      success: false,
      error: 'No debug browser running. Launch one first.'
    });
  }

  try {
    console.log('📸 Capturing debug browser...');

    // Get current page info
    const currentUrl = await debugSession.page.url();
    const pageTitle = await debugSession.page.title();
    
    // Take screenshot
    const screenshotBuffer = await debugSession.page.screenshot({
      fullPage: false
    });
    const screenshotBase64 = screenshotBuffer.toString('base64');

    console.log(`   URL: ${currentUrl}`);
    console.log(`   Title: ${pageTitle}`);

    // Analyze with Vision AI
    console.log('🧠 Analyzing with Vision AI...');
    
    const result = await aiAssistant.analyzeScreenshot(screenshotBase64, {
      screenName: screenName || pageTitle.replace(/[^a-zA-Z0-9]/g, ''),
      pageTitle,
      pageUrl: currentUrl,
      platform,
      generateLocators,
      generatePOM,
      generateTransitions
    });

    res.json({
      ...result,
      screenshot: screenshotBase64,
      capturedFrom: 'debug-browser',
      capturedUrl: currentUrl,
      capturedTitle: pageTitle
    });

  } catch (error) {
    console.error('❌ Capture failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-assistant/debug-browser/navigate
 * Navigate debug browser to a URL
 */
router.post('/debug-browser/navigate', async (req, res) => {
  const { url } = req.body;

  if (!debugSession) {
    return res.status(400).json({
      success: false,
      error: 'No debug browser running'
    });
  }

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required'
    });
  }

  try {
    await debugSession.page.goto(url);
    const currentUrl = await debugSession.page.url();
    const title = await debugSession.page.title();

    res.json({
      success: true,
      currentUrl,
      pageTitle: title
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-assistant/debug-browser/close
 * Close the debug browser
 */
router.post('/debug-browser/close', async (req, res) => {
  if (!debugSession) {
    return res.json({
      success: true,
      message: 'No browser was running'
    });
  }

  try {
    await debugSession.browser.close();
    debugSession = null;

    res.json({
      success: true,
      message: 'Debug browser closed'
    });

  } catch (error) {
    debugSession = null;
    res.json({
      success: true,
      message: 'Browser closed (with error: ' + error.message + ')'
    });
  }
});

/**
 * POST /api/ai-assistant/rescan
 * Rescan a screenshot with focus on specific elements
 */
router.post('/rescan', async (req, res) => {
  const { 
    screenshot, 
    existingElements = [], 
    focusPrompt = '',
    pageTitle = '',
    pageUrl = ''
  } = req.body;

  if (!screenshot) {
    return res.status(400).json({
      success: false,
      error: 'Screenshot is required'
    });
  }

  try {
    console.log(`🔍 Rescanning with focus: "${focusPrompt}"`);

    const existingNames = existingElements.map(e => e.name).join(', ');
    
    // Call Claude Vision directly with focused prompt
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshot
              }
            },
            {
              type: 'text',
              text: `You are a UI automation expert. Analyze this screenshot and find ADDITIONAL elements.

${focusPrompt ? `🎯 FOCUS ON: ${focusPrompt}` : 'Find ALL interactive elements you can see.'}

⚠️ ALREADY FOUND (DO NOT include these again):
${existingNames || 'none'}

Look VERY carefully for elements that might have been missed:
- Navigation menu items
- Dropdown triggers
- Icon buttons (hamburger menu, search icon, user icon, etc.)
- Footer links
- Social media icons
- Small action buttons
- Breadcrumbs
- Tabs
- Modal triggers
- Images with alt text
- Any clickable element

For EACH NEW element found, provide:
{
  "name": "camelCaseName",
  "type": "button|input|link|text|image|checkbox|select|heading|nav|icon",
  "label": "Visible text or description",
  "purpose": "What this element does",
  "isInteractive": true/false,
  "selectors": [
    { "type": "css", "value": "selector", "confidence": 0.8 }
  ]
}

Return JSON: { "elements": [...], "totalFound": number }

Be THOROUGH - find at least 5-10 additional elements if they exist on the page.`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vision API error: ${error}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse JSON from response
    let parsed;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (e) {
      console.error('Failed to parse vision response:', content);
      parsed = { elements: [] };
    }

    const newElements = parsed.elements || [];
    
    // Filter out any duplicates that slipped through
    const filteredElements = newElements.filter(newEl => 
      !existingElements.some(existing => 
        existing.name?.toLowerCase() === newEl.name?.toLowerCase()
      )
    );

    console.log(`   Found ${filteredElements.length} new elements`);

    res.json({
      success: true,
      elements: filteredElements,
      totalNew: filteredElements.length,
      focusPrompt
    });

  } catch (error) {
    console.error('❌ Rescan failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;