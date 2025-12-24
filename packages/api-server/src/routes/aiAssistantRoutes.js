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

export default router;