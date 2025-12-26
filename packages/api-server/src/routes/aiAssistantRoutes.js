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


router.post('/create-implication', async (req, res) => {
  const {
    projectPath,
    screenName,
    screenObjectPath,
    elements,
    status,
    entity,
    previousState,
    triggerEvent,
    platform,
    screenshot,
    outputPath,
    tags
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

    // Determine output directory
    const implicationsDir = path.join(projectPath, outputPath || 'tests/implications');

    // Save screenshot if provided
    let screenshotRelativePath = null;
    if (screenshot) {
      try {
        const screenshotsDir = path.join(projectPath, 'tests/implications/.screenshots');
        await fs.mkdir(screenshotsDir, { recursive: true });
        
        const screenshotFileName = `${status.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
        const screenshotFullPath = path.join(screenshotsDir, screenshotFileName);
        
        // Write base64 screenshot to file
        const buffer = Buffer.from(screenshot, 'base64');
        await fs.writeFile(screenshotFullPath, buffer);
        
        screenshotRelativePath = `tests/implications/.screenshots/${screenshotFileName}`;
        console.log(`  📸 Screenshot saved: ${screenshotRelativePath}`);
      } catch (screenshotError) {
        console.warn(`  ⚠️ Failed to save screenshot: ${screenshotError.message}`);
        // Don't fail the whole request for screenshot issues
      }
    }

    // Try to load an example implication for context
    let exampleImplication = '';
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
  visibleElements: elements.filter(el => el.isVisible !== false).map(el => el.name),
  hiddenElements: elements.filter(el => el.isVisible === false).map(el => el.name),
  platform,
  entity,
  context: { previousState, triggerEvent, tags, screenshot: screenshotRelativePath },
  exampleImplication
});
      
      // If LLM didn't include screenshot, inject it into meta
      if (screenshotRelativePath && !implicationCode.includes('screenshot:')) {
        implicationCode = injectScreenshotIntoMeta(implicationCode, screenshotRelativePath);
      }
    } else {
      // Fallback to simple template
      console.log('  📝 Using fallback template (LLM disabled)');
      implicationCode = generateImplicationCode({ 
        screenName, 
        status, 
        elements, 
        platform, 
        entity, 
        previousState, 
        triggerEvent, 
        tags,
        screenshot: screenshotRelativePath
      });
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
      filePath: path.relative(projectPath, filePath),
      absolutePath: filePath,
      fileName,
      backed,
      screenName,
      status,
      elementsCount: elements.length,
      screenshotPath: screenshotRelativePath,
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
 * Inject screenshot path into xstateConfig.meta if not present
 */
function injectScreenshotIntoMeta(code, screenshotPath) {
  // Find the meta: { block and add screenshot after status
  const metaRegex = /(meta:\s*\{[^}]*status:\s*['"][^'"]+['"],?)/;
  const match = code.match(metaRegex);
  
  if (match) {
    const injection = `${match[1]}\n      screenshot: '${screenshotPath}',`;
    return code.replace(metaRegex, injection);
  }
  
  // Fallback: try to find meta: { and add at the start
  const simpleMetaRegex = /(meta:\s*\{)/;
  if (code.match(simpleMetaRegex)) {
    return code.replace(simpleMetaRegex, `$1\n      screenshot: '${screenshotPath}',`);
  }
  
  return code;
}

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
      fullPage: true
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
 * GET /api/ai-assistant/screenshot
 * Serve a screenshot image by path or status
 */
router.get('/screenshot', async (req, res) => {
  const { projectPath, path: relativePath, status } = req.query;

  if (!projectPath) {
    return res.status(400).json({ success: false, error: 'projectPath required' });
  }

  const fs = await import('fs');
  const path = await import('path');

  let screenshotPath;

  if (relativePath) {
    // Use the exact path from metadata
    screenshotPath = path.join(projectPath, relativePath);
  } else if (status) {
    // Fallback: try to find by status name (case-insensitive)
    const screenshotsDir = path.join(projectPath, 'tests/implications/.screenshots');
    
    try {
      const files = await fs.promises.readdir(screenshotsDir);
      const matchingFile = files.find(f => 
        f.toLowerCase() === `${status.toLowerCase()}.png` ||
        f.toLowerCase() === `${status.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.png`
      );
      
      if (matchingFile) {
        screenshotPath = path.join(screenshotsDir, matchingFile);
      }
    } catch (e) {
      return res.status(404).json({ success: false, error: 'Screenshots directory not found' });
    }
  }

  if (!screenshotPath) {
    return res.status(400).json({ success: false, error: 'path or status required' });
  }

  try {
    await fs.promises.access(screenshotPath);
    res.sendFile(screenshotPath);
  } catch {
    console.log('Screenshot not found:', screenshotPath);
    return res.status(404).json({ success: false, error: 'Screenshot not found', tried: screenshotPath });
  }
});

// Keep the old route for backwards compatibility
router.get('/screenshot/:status', async (req, res) => {
  const { status } = req.params;
  const { projectPath } = req.query;
  
  // Redirect to the new endpoint
  res.redirect(`/api/ai-assistant/screenshot?projectPath=${encodeURIComponent(projectPath)}&status=${encodeURIComponent(status)}`);
});

function generateImplicationCode({ 
  screenName, 
  status, 
  elements, 
  platform, 
  entity, 
  previousState, 
  triggerEvent, 
  tags,
  screenshot 
}) {
  const className = `${screenName}Implications`;
  const instanceName = screenName.charAt(0).toLowerCase() + screenName.slice(1);
  
  // Generate blocks from elements
  const blocks = elements.map((el, idx) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7);
    
    return {
      id: `blk_func_${timestamp}_${random}`,
      type: 'function-call',
      label: `Validate ${el.name} is visible`,
      order: idx,
      expanded: true,
      enabled: true,
      data: {
        instance: instanceName,
        method: `get${el.name.charAt(0).toUpperCase() + el.name.slice(1)}`,
        args: [],
        await: true,
        assertion: { type: 'toBeVisible', not: false }
      }
    };
  });

  const blocksJson = JSON.stringify(blocks, null, 10)
    .replace(/"([^"]+)":/g, '$1:')  // Remove quotes from keys
    .replace(/"/g, "'");            // Use single quotes for strings

  return `// ${className}.js
// Generated by AI Assistant

class ${className} {
  static xstateConfig = {
    meta: {
      status: '${status}',
      statusLabel: '${status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}',
      entity: '${entity || 'unknown'}',
      platform: '${platform || 'web'}',
      platforms: ['${platform || 'web'}'],
      ${screenshot ? `screenshot: '${screenshot}',` : ''}
      ${previousState ? `requires: { previousStatus: '${previousState}' },` : ''}
      ${triggerEvent ? `triggerEvent: '${triggerEvent}',` : ''}
      ${tags?.screen ? `tags: { screen: '${tags.screen}'${tags.group ? `, group: '${tags.group}'` : ''} },` : ''}
      setup: [{
        testFile: 'tests/implications/${status}/${className}-${triggerEvent || 'TRIGGER'}-${platform || 'Web'}-UNIT.spec.js',
        actionName: '${instanceName}Via${previousState ? previousState.replace(/_/g, '').replace(/\b\w/g, c => c.toUpperCase()) : 'Initial'}'
      }],
      requiredFields: []
    },
    on: {
      // Add transitions here
    }
  };

  static mirrorsOn = {
    UI: {
      ${platform || 'web'}: {
        ${screenName}Screen: {
          screen: '${instanceName}.screen.js',
          instance: '${instanceName}',
          blocks: ${blocksJson}
        }
      }
    }
  };
}

module.exports = { ${className} };
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
    
    console.log(`   URL: ${currentUrl}`);
    console.log(`   Title: ${pageTitle}`);

    // ✅ EXTRACT DOM BEFORE SCREENSHOT
    console.log('   📦 Extracting DOM elements...');
    const domElements = await debugSession.page.evaluate(() => {
      const elements = [];
      const selectors = 'button, a, input, select, textarea, [role], [data-testid], img, h1, h2, h3, nav, form, [aria-label], [type="search"]';
      
      document.querySelectorAll(selectors).forEach(el => {
        // Skip invisible elements (except hidden inputs)
        if (el.offsetParent === null && el.tagName !== 'INPUT' && el.type !== 'hidden') return;
        
        // Skip elements inside <head>
        if (el.closest('head')) return;
        
        elements.push({
          tag: el.tagName.toLowerCase(),
          type: el.type || null,
          role: el.getAttribute('role'),
          text: (el.innerText || el.textContent || '').trim().substring(0, 100),
          placeholder: el.placeholder || null,
          ariaLabel: el.getAttribute('aria-label'),
          testId: el.getAttribute('data-testid'),
          name: el.getAttribute('name'),
          id: el.id || null,
          classes: el.className || null,
          href: el.tagName === 'A' ? el.getAttribute('href') : null,
          alt: el.alt || null,
          value: el.tagName === 'INPUT' ? el.value : null,
          inputType: el.tagName === 'INPUT' ? el.type : null,
          isVisible: el.offsetParent !== null || el.type === 'hidden'
        });
      });
      
      return elements;
    });
    console.log(`   📦 Extracted ${domElements.length} DOM elements`);

    // Take screenshot
    const screenshotBuffer = await debugSession.page.screenshot({
      fullPage: true
    });
    const screenshotBase64 = screenshotBuffer.toString('base64');

    // Analyze with Vision AI - NOW WITH DOM!
    console.log('🧠 Analyzing with Vision AI...');
    
    const vision = aiAssistant.getVisionAdapter();
    const visionResult = await vision.analyzeScreenshot(screenshotBase64, {
      pageTitle,
      pageUrl: currentUrl,
      domElements,  // ✅ PASS DOM TO VISION
      includeCoordinates: false
    });

    // Generate code
    console.log('⚡ Generating code...');
    
    const finalScreenName = screenName || 
      visionResult.suggestedScreenNames?.[0] || 
      pageTitle.replace(/[^a-zA-Z0-9]/g, '') || 
      'UnknownScreen';

    const result = {
      success: true,
      elements: visionResult.elements,
      pageDescription: visionResult.pageDescription,
      suggestedScreenNames: visionResult.suggestedScreenNames,
      screenName: finalScreenName,
      generated: {},
      screenshot: screenshotBase64,
      capturedFrom: 'debug-browser',
      capturedUrl: currentUrl,
      capturedTitle: pageTitle,
      domElementsCount: domElements.length  // ✅ Include count for debugging
    };

    // Generate code using the service's methods
    if (generateLocators) {
      const locatorsResult = await aiAssistant._generateLocators(visionResult.elements, finalScreenName);
      result.generated.locators = locatorsResult.code;
    }

    if (generatePOM) {
      const pomResult = await aiAssistant._generatePOM(visionResult.elements, finalScreenName, platform);
      result.generated.pom = pomResult.code;
    }

    if (generateTransitions) {
      const transitionsResult = await aiAssistant._generateTransitions(visionResult.elements, finalScreenName);
      result.generated.transitions = transitionsResult.code;
    }

    res.json(result);

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

/**
 * POST /api/ai-assistant/generate-screen-object
 * Generate screen object code from elements
 */
router.post('/generate-screen-object', async (req, res) => {
  const {
    elements,
    screenName,
    format = 'single',
    platform = 'web',
    style = {}
  } = req.body;

  if (!elements?.length || !screenName) {
    return res.status(400).json({
      success: false,
      error: 'elements and screenName are required'
    });
  }

  try {
    const code = generateScreenObjectCode(elements, screenName, { format, platform, ...style });
    
    res.json({
      success: true,
      code
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-assistant/save-screen-object
 * Save screen object to project
 */
router.post('/save-screen-object', async (req, res) => {
  const {
    projectPath,
    screenName,
    format = 'single',
    platform = 'web',
    outputPath,
    code
  } = req.body;

  if (!projectPath || !screenName || !code) {
    return res.status(400).json({
      success: false,
      error: 'projectPath, screenName, and code are required'
    });
  }

  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    // Determine output directory
    const baseDir = path.join(projectPath, outputPath || 'tests/screenObjects');
    
    // Ensure directory exists
    await fs.mkdir(baseDir, { recursive: true });

    // Generate filename
    const fileName = `${screenName.charAt(0).toLowerCase() + screenName.slice(1)}.screen.js`;
    const filePath = path.join(baseDir, fileName);

    // Write file
    const codeToWrite = typeof code === 'string' ? code : code.single || code.screen;
    await fs.writeFile(filePath, codeToWrite, 'utf-8');

    console.log(`✅ Screen object saved: ${filePath}`);

    res.json({
      success: true,
      filePath: path.relative(projectPath, filePath),
      absolutePath: filePath
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate clean screen object code
 */
function generateScreenObjectCode(elements, screenName, options = {}) {
  const {
    format = 'single',
    platform = 'web',
    includeAssertions = true,
    includeCompoundActions = true
  } = options;

  const className = screenName.endsWith('Screen') ? screenName : `${screenName}Screen`;
  const pageVar = platform === 'web' ? 'page' : 'driver';

  // Generate locators
const locators = elements.map(el => {
  const selector = el.selectors?.[0]?.value || `getByText('${el.label || el.name}')`;
  
  // If it's a getBy* method, use it directly (not wrapped in locator)
  if (selector.startsWith('getBy')) {
    return `  get ${el.name}() {
    return this.${pageVar}.${selector};
  }`;
  }
  
  // Otherwise wrap in locator()
  return `  get ${el.name}() {
    return this.${pageVar}.locator('${selector.replace(/'/g, "\\'")}');
  }`;
}).join('\n\n');

  // Generate actions
  const actions = elements
    .filter(el => el.isInteractive !== false)
    .map(el => {
      const actionName = `click${el.name.charAt(0).toUpperCase() + el.name.slice(1)}`;
      
      if (el.type === 'input') {
        const fillName = `fill${el.name.charAt(0).toUpperCase() + el.name.slice(1)}`;
        return `  async ${fillName}(value) {
    await this.${el.name}.fill(value);
  }`;
      }
      
      if (el.type === 'select') {
        const selectName = `select${el.name.charAt(0).toUpperCase() + el.name.slice(1)}`;
        return `  async ${selectName}(value) {
    await this.${el.name}.selectOption(value);
  }`;
      }
      
      if (el.type === 'button' || el.type === 'link') {
        return `  async ${actionName}() {
    await this.${el.name}.click();
  }`;
      }
      
      return null;
    })
    .filter(Boolean)
    .join('\n\n');

  // Generate assertions
  const assertions = includeAssertions ? elements.map(el => {
    const assertName = `is${el.name.charAt(0).toUpperCase() + el.name.slice(1)}Visible`;
    return `  async ${assertName}() {
    return await this.${el.name}.isVisible();
  }`;
  }).join('\n\n') : '';

  // Build class
  const code = `// ${className}.screen.js
// Generated by AI Assistant

class ${className} {
  constructor(${pageVar}) {
    this.${pageVar} = ${pageVar};
  }

  // ═══════════════════════════════════════════════════
  // LOCATORS
  // ═══════════════════════════════════════════════════

${locators}

  // ═══════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════

${actions}
${includeAssertions ? `
  // ═══════════════════════════════════════════════════
  // ASSERTIONS
  // ═══════════════════════════════════════════════════

${assertions}` : ''}
}

module.exports = ${className};
`;

  return code;
}

export default router;