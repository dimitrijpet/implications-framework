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

export default router;
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

