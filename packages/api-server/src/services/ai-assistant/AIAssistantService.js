/**
 * AIAssistantService.js
 * 
 * Orchestrates browser scanning, vision analysis, and code generation.
 * 
 * Flow:
 *   URL → PlaywrightAdapter (screenshot) → ClaudeVisionAdapter (elements) → 
 *   llmService (code generation) → Generated POM/Locators/Transitions
 */

import { PlaywrightAdapter } from '../../adapters/PlaywrightAdapter.js';
import { ClaudeVisionAdapter } from '../../adapters/ClaudeVisionAdapter.js';
import { callLLM, isLLMEnabled } from '../llmservice.js';

/**
 * AI Assistant Service
 * Main entry point for AI-powered test generation
 */
export class AIAssistantService {
  constructor(options = {}) {
    this.browserAdapter = options.browserAdapter || null;
    this.visionAdapter = options.visionAdapter || null;
    
    // Default adapter classes (can be swapped)
    this.BrowserAdapterClass = options.BrowserAdapterClass || PlaywrightAdapter;
    this.VisionAdapterClass = options.VisionAdapterClass || ClaudeVisionAdapter;
  }

  /**
   * Get or create browser adapter (lazy initialization)
   */
  getBrowserAdapter() {
    if (!this.browserAdapter) {
      this.browserAdapter = new this.BrowserAdapterClass();
    }
    return this.browserAdapter;
  }

  /**
   * Get or create vision adapter (lazy initialization)
   */
  getVisionAdapter() {
    if (!this.visionAdapter) {
      this.visionAdapter = new this.VisionAdapterClass();
    }
    return this.visionAdapter;
  }

  /**
   * Scan a URL and generate POM/locators/transitions
   * 
   * @param {string} url - URL to scan
   * @param {Object} options - Scan options
   * @returns {Promise<ScanResult>}
   */
  async scanUrl(url, options = {}) {
    const {
      generateLocators = true,
      generatePOM = true,
      generateTransitions = true,
      screenName = null,
      platform = 'web'
    } = options;

    const result = {
      success: false,
      url,
      timestamp: new Date().toISOString(),
      screenshot: null,
      elements: [],
      generated: {},
      errors: [],
      usage: { vision: 0, codegen: 0 }
    };

    try {
      // Step 1: Capture screenshot
      console.log('📸 Step 1/3: Capturing screenshot...');
      const browser = this.getBrowserAdapter();
      
      if (!browser.isOpen()) {
        await browser.launch();
      }
      
      const pageData = await browser.scanPage(url);
      result.screenshot = pageData.screenshot;
      result.pageTitle = pageData.title;
      result.pageUrl = pageData.url;
      result.dom = pageData.dom;

      // Step 2: Analyze with vision
      console.log('🧠 Step 2/3: Analyzing screenshot with Claude Vision...');
      const vision = this.getVisionAdapter();
      
      const visionResult = await vision.analyzeScreenshot(pageData.screenshot, {
        pageTitle: pageData.title,
        pageUrl: pageData.url,
        includeCoordinates: false
      });

      result.elements = visionResult.elements;
      result.pageDescription = visionResult.pageDescription;
      result.suggestedScreenNames = visionResult.suggestedScreenNames;
      result.usage.vision = visionResult.tokensUsed || 0;

      // Use suggested screen name or provided one
      const finalScreenName = screenName || 
        visionResult.suggestedScreenNames?.[0] || 
        this._generateScreenName(pageData.title);

      // Step 3: Generate code
      console.log('⚡ Step 3/3: Generating code with DeepSeek...');
      
      if (generateLocators) {
        const locatorsResult = await this._generateLocators(result.elements, finalScreenName);
        result.generated.locators = locatorsResult.code;
        result.usage.codegen += locatorsResult.tokens || 0;
      }

      if (generatePOM) {
        const pomResult = await this._generatePOM(result.elements, finalScreenName, platform);
        result.generated.pom = pomResult.code;
        result.usage.codegen += pomResult.tokens || 0;
      }

      if (generateTransitions) {
        const transitionsResult = await this._generateTransitions(result.elements, finalScreenName);
        result.generated.transitions = transitionsResult.code;
        result.usage.codegen += transitionsResult.tokens || 0;
      }

      result.screenName = finalScreenName;
      result.success = true;
      console.log('✅ Scan complete!');

    } catch (error) {
      console.error('❌ Scan error:', error.message);
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Analyze a screenshot that's already been captured
   * 
   * @param {string} screenshotBase64 - Base64 encoded screenshot
   * @param {Object} options - Analysis options
   * @returns {Promise<AnalysisResult>}
   */
  async analyzeScreenshot(screenshotBase64, options = {}) {
    const {
      generateLocators = true,
      generatePOM = true,
      generateTransitions = true,
      screenName = null,
      pageTitle = '',
      pageUrl = '',
      platform = 'web'
    } = options;

    const result = {
      success: false,
      timestamp: new Date().toISOString(),
      elements: [],
      generated: {},
      errors: [],
      usage: { vision: 0, codegen: 0 }
    };

    try {
      // Analyze with vision
      console.log('🧠 Analyzing screenshot with Claude Vision...');
      const vision = this.getVisionAdapter();
      
      const visionResult = await vision.analyzeScreenshot(screenshotBase64, {
        pageTitle,
        pageUrl,
        includeCoordinates: false
      });

      result.elements = visionResult.elements;
      result.pageDescription = visionResult.pageDescription;
      result.suggestedScreenNames = visionResult.suggestedScreenNames;
      result.usage.vision = visionResult.tokensUsed || 0;

      const finalScreenName = screenName || 
        visionResult.suggestedScreenNames?.[0] || 
        'UnknownScreen';

      // Generate code
      console.log('⚡ Generating code with DeepSeek...');
      
      if (generateLocators) {
        const locatorsResult = await this._generateLocators(result.elements, finalScreenName);
        result.generated.locators = locatorsResult.code;
        result.usage.codegen += locatorsResult.tokens || 0;
      }

      if (generatePOM) {
        const pomResult = await this._generatePOM(result.elements, finalScreenName, platform);
        result.generated.pom = pomResult.code;
        result.usage.codegen += pomResult.tokens || 0;
      }

      if (generateTransitions) {
        const transitionsResult = await this._generateTransitions(result.elements, finalScreenName);
        result.generated.transitions = transitionsResult.code;
        result.usage.codegen += transitionsResult.tokens || 0;
      }

      result.screenName = finalScreenName;
      result.success = true;

    } catch (error) {
      console.error('❌ Analysis error:', error.message);
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Generate locators code
   * @private
   */
  async _generateLocators(elements, screenName) {
    if (!isLLMEnabled()) {
      return { code: this._fallbackLocators(elements, screenName), tokens: 0 };
    }

    const elementsJson = JSON.stringify(elements, null, 2);
    
    const messages = [
      {
        role: 'system',
        content: `You are an expert at writing Playwright locators for test automation.
Generate a JavaScript locators object from the UI elements provided.

Rules:
- Use data-testid selectors when available (highest priority)
- Fall back to role-based selectors (getByRole)
- Then text-based selectors (getByText)
- CSS selectors as last resort
- Use camelCase for all property names
- Include a comment describing each locator

Return ONLY valid JavaScript code, no markdown, no explanation.`
      },
      {
        role: 'user',
        content: `Generate locators for screen "${screenName}" with these elements:

${elementsJson}

Format:
export const ${screenName}Locators = {
  // Element description
  elementName: page => page.locator('[data-testid="..."]'),
};`
      }
    ];

    try {
      const code = await callLLM(messages, { maxTokens: 1500, temperature: 0.2 });
      return { code: this._cleanCodeResponse(code), tokens: 0 };
    } catch (error) {
      console.error('Locators generation error:', error.message);
      return { code: this._fallbackLocators(elements, screenName), tokens: 0 };
    }
  }

  /**
   * Generate POM class
   * @private
   */
  async _generatePOM(elements, screenName, platform) {
    if (!isLLMEnabled()) {
      return { code: this._fallbackPOM(elements, screenName), tokens: 0 };
    }

    const elementsJson = JSON.stringify(elements, null, 2);
    
    const messages = [
      {
        role: 'system',
        content: `You are an expert at writing Page Object Model classes for Playwright test automation.
Generate a clean, well-structured POM class from the UI elements provided.

Rules:
- Extend BasePage if it's a full page, or BaseComponent for reusable sections
- Use getter methods for locators
- Add action methods for interactive elements (click, fill, etc.)
- Add assertion helper methods (isVisible, getText, etc.)
- Use JSDoc comments for all methods
- Follow the async/await pattern
- Keep methods focused and single-purpose

Return ONLY valid JavaScript code, no markdown, no explanation.`
      },
      {
        role: 'user',
        content: `Generate a POM class for screen "${screenName}" (platform: ${platform}) with these elements:

${elementsJson}

Format:
export class ${screenName} {
  constructor(page) {
    this.page = page;
  }
  
  // Locators
  get elementName() {
    return this.page.locator('[data-testid="..."]');
  }
  
  // Actions
  async clickElement() {
    await this.elementName.click();
  }
  
  // Assertions
  async isElementVisible() {
    return this.elementName.isVisible();
  }
}`
      }
    ];

    try {
      const code = await callLLM(messages, { maxTokens: 2000, temperature: 0.2 });
      return { code: this._cleanCodeResponse(code), tokens: 0 };
    } catch (error) {
      console.error('POM generation error:', error.message);
      return { code: this._fallbackPOM(elements, screenName), tokens: 0 };
    }
  }

  /**
   * Generate transition functions
   * @private
   */
  async _generateTransitions(elements, screenName) {
    if (!isLLMEnabled()) {
      return { code: this._fallbackTransitions(elements, screenName), tokens: 0 };
    }

    // Filter to interactive elements
    const interactiveElements = elements.filter(el => el.isInteractive);
    
    if (interactiveElements.length === 0) {
      return { code: '// No interactive elements found', tokens: 0 };
    }

    const elementsJson = JSON.stringify(interactiveElements, null, 2);
    
    const messages = [
      {
        role: 'system',
        content: `You are an expert at writing transition functions for test automation state machines.
Generate action functions that interact with UI elements and potentially change state.

Rules:
- Each function should be async
- Use clear, descriptive function names (e.g., clickSubmitButton, fillEmailInput)
- Accept (page, data) parameters
- Include wait conditions after actions if needed
- Add JSDoc with @param and @returns
- Group related functions together

Return ONLY valid JavaScript code, no markdown, no explanation.`
      },
      {
        role: 'user',
        content: `Generate transition functions for "${screenName}" with these interactive elements:

${elementsJson}

Format:
/**
 * Click the submit button
 * @param {Page} page - Playwright page
 * @param {Object} data - Test data context
 */
export async function clickSubmitButton(page, data) {
  await page.locator('[data-testid="submit"]').click();
  await page.waitForLoadState('networkidle');
}`
      }
    ];

    try {
      const code = await callLLM(messages, { maxTokens: 1500, temperature: 0.2 });
      return { code: this._cleanCodeResponse(code), tokens: 0 };
    } catch (error) {
      console.error('Transitions generation error:', error.message);
      return { code: this._fallbackTransitions(elements, screenName), tokens: 0 };
    }
  }

  /**
   * Clean code response (remove markdown fences)
   * @private
   */
  _cleanCodeResponse(code) {
    // Remove markdown code fences
    let cleaned = code.replace(/```javascript\n?/g, '').replace(/```js\n?/g, '').replace(/```\n?/g, '');
    return cleaned.trim();
  }

  /**
   * Generate screen name from title
   * @private
   */
  _generateScreenName(title) {
    if (!title) return 'UnknownScreen';
    
    // Convert to PascalCase
    return title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
      .substring(0, 30) + 'Screen';
  }

  /**
   * Fallback locators when LLM is unavailable
   * @private
   */
  _fallbackLocators(elements, screenName) {
    const lines = [`export const ${screenName}Locators = {`];
    
    for (const el of elements) {
      const selector = el.selectors?.[0];
      if (selector) {
        lines.push(`  // ${el.label || el.purpose || el.type}`);
        lines.push(`  ${el.name}: page => page.locator('${selector.value}'),`);
      }
    }
    
    lines.push('};');
    return lines.join('\n');
  }

  /**
   * Fallback POM when LLM is unavailable
   * @private
   */
  _fallbackPOM(elements, screenName) {
    const lines = [
      `export class ${screenName} {`,
      '  constructor(page) {',
      '    this.page = page;',
      '  }',
      ''
    ];
    
    for (const el of elements) {
      const selector = el.selectors?.[0];
      if (selector) {
        lines.push(`  // ${el.label || el.type}`);
        lines.push(`  get ${el.name}() {`);
        lines.push(`    return this.page.locator('${selector.value}');`);
        lines.push('  }');
        lines.push('');
      }
    }
    
    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Fallback transitions when LLM is unavailable
   * @private
   */
  _fallbackTransitions(elements, screenName) {
    const lines = [];
    
    const interactive = elements.filter(el => el.isInteractive);
    
    for (const el of interactive) {
      const selector = el.selectors?.[0];
      if (selector) {
        const funcName = `click${el.name.charAt(0).toUpperCase() + el.name.slice(1)}`;
        lines.push(`// ${el.purpose || el.label || el.type}`);
        lines.push(`export async function ${funcName}(page, data) {`);
        lines.push(`  await page.locator('${selector.value}').click();`);
        lines.push('}');
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Close browser adapter
   */
  async close() {
    if (this.browserAdapter?.isOpen()) {
      await this.browserAdapter.close();
    }
  }

  /**
   * Check if all services are configured
   */
  checkConfiguration() {
    const vision = this.getVisionAdapter();
    const visionConfig = vision.checkConfiguration();
    
    return {
      browser: { ready: true, adapter: 'playwright' },
      vision: visionConfig,
      codegen: { ready: isLLMEnabled(), adapter: 'deepseek' },
      allReady: visionConfig.configured && isLLMEnabled()
    };
  }
}

// Export singleton instance for convenience
export const aiAssistant = new AIAssistantService();

export default AIAssistantService;