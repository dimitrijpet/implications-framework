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