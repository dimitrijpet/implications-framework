/**
 * AIAssistantService.js
 * 
 * Orchestrates browser/mobile scanning, vision analysis, and code generation.
 * 
 * Flow:
 *   URL/App → PlaywrightAdapter/AppiumAdapter (screenshot) → ClaudeVisionAdapter (elements) → 
 *   llmService (code generation) → Generated POM/Locators/Transitions
 */

import { PlaywrightAdapter } from '../../adapters/PlaywrightAdapter.js';
import { AppiumAdapter } from '../../adapters/AppiumAdapter.js';
import { ClaudeVisionAdapter } from '../../adapters/ClaudeVisionAdapter.js';
import { callLLM, isLLMEnabled } from '../llmservice.js';

/**
 * AI Assistant Service
 * Main entry point for AI-powered test generation
 */
export class AIAssistantService {
  constructor(options = {}) {
    this.browserAdapter = options.browserAdapter || null;
    this.mobileAdapter = options.mobileAdapter || null;
    this.visionAdapter = options.visionAdapter || null;
    
    // Default adapter classes (can be swapped)
    this.BrowserAdapterClass = options.BrowserAdapterClass || PlaywrightAdapter;
    this.MobileAdapterClass = options.MobileAdapterClass || AppiumAdapter;
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
   * Get or create mobile adapter (lazy initialization)
   * @param {string} platform - 'android' or 'ios'
   */
  getMobileAdapter(platform = 'android') {
    if (!this.mobileAdapter || this.mobileAdapter.platform !== platform) {
      this.mobileAdapter = new this.MobileAdapterClass({ platform });
    }
    return this.mobileAdapter;
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
   * Check if platform is mobile
   */
  _isMobilePlatform(platform) {
    return platform === 'android' || platform === 'ios';
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
      platform,
      timestamp: new Date().toISOString(),
      screenshot: null,
      elements: [],
      generated: {},
      errors: [],
      usage: { vision: 0, codegen: 0 },
    };

    try {
      // Step 1: Capture screenshot
      console.log(`📸 Step 1/3: Capturing screenshot (${platform})...`);
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
        domElements: pageData.dom,
        platform,  // Pass platform for selector strategy
        includeCoordinates: false
      });

      result.elements = visionResult.elements;
      result.visibleElements = visionResult.visibleElements;
      result.hiddenElements = visionResult.hiddenElements;
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
        const locatorsResult = await this._generateLocators(result.elements, finalScreenName, platform);
        result.generated.locators = locatorsResult.code;
        result.usage.codegen += locatorsResult.tokens || 0;
      }

      if (generatePOM) {
        const pomResult = await this._generatePOM(result.elements, finalScreenName, platform);
        result.generated.pom = pomResult.code;
        result.usage.codegen += pomResult.tokens || 0;
      }

      if (generateTransitions) {
        const transitionsResult = await this._generateTransitions(result.elements, finalScreenName, platform);
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
   * Scan a mobile app screen
   * 
   * @param {Object} options - Scan options
   * @returns {Promise<ScanResult>}
   */
  async scanMobileApp(options = {}) {
    const {
      platform = 'android',
      deviceName,
      app,
      platformVersion,
      generateLocators = true,
      generatePOM = true,
      generateTransitions = true,
      screenName = null,
    } = options;

    const result = {
      success: false,
      platform,
      timestamp: new Date().toISOString(),
      screenshot: null,
      elements: [],
      generated: {},
      errors: [],
      usage: { vision: 0, codegen: 0 },
    };

    try {
      // Step 1: Capture screenshot from mobile
      console.log(`📱 Step 1/3: Capturing mobile screenshot (${platform})...`);
      const mobile = this.getMobileAdapter(platform);
      
      if (!mobile.isOpen()) {
        await mobile.launch({ deviceName, app, platformVersion });
      }
      
      const pageData = await mobile.scanPage();
      result.screenshot = pageData.screenshot;
      result.pageTitle = pageData.title;
      result.dom = pageData.dom;

      // Step 2: Analyze with vision
      console.log('🧠 Step 2/3: Analyzing screenshot with Claude Vision...');
      const vision = this.getVisionAdapter();

      const visionResult = await vision.analyzeScreenshot(pageData.screenshot, {
        pageTitle: pageData.title,
        domElements: pageData.dom,
        platform,  // 'android' or 'ios' for mobile selectors
        includeCoordinates: false
      });

      result.elements = visionResult.elements;
      result.visibleElements = visionResult.visibleElements;
      result.hiddenElements = visionResult.hiddenElements;
      result.pageDescription = visionResult.pageDescription;
      result.suggestedScreenNames = visionResult.suggestedScreenNames;
      result.usage.vision = visionResult.tokensUsed || 0;

      const finalScreenName = screenName || 
        visionResult.suggestedScreenNames?.[0] || 
        this._generateScreenName(pageData.title);

      // Step 3: Generate code
      console.log('⚡ Step 3/3: Generating code...');
      
      if (generateLocators) {
        const locatorsResult = await this._generateLocators(result.elements, finalScreenName, platform);
        result.generated.locators = locatorsResult.code;
        result.usage.codegen += locatorsResult.tokens || 0;
      }

      if (generatePOM) {
        const pomResult = await this._generatePOM(result.elements, finalScreenName, platform);
        result.generated.pom = pomResult.code;
        result.usage.codegen += pomResult.tokens || 0;
      }

      if (generateTransitions) {
        const transitionsResult = await this._generateTransitions(result.elements, finalScreenName, platform);
        result.generated.transitions = transitionsResult.code;
        result.usage.codegen += transitionsResult.tokens || 0;
      }

      result.screenName = finalScreenName;
      result.success = true;
      console.log('✅ Mobile scan complete!');

    } catch (error) {
      console.error('❌ Mobile scan error:', error.message);
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
      domElements = [],
      platform = 'web'
    } = options;

    const result = {
      success: false,
      platform,
      timestamp: new Date().toISOString(),
      elements: [],
      generated: {},
      errors: [],
      usage: { vision: 0, codegen: 0 }
    };

    try {
      // Analyze with vision
      console.log(`🧠 Analyzing screenshot with Claude Vision (${platform})...`);
      const vision = this.getVisionAdapter();
      
      const visionResult = await vision.analyzeScreenshot(screenshotBase64, {
        pageTitle,
        pageUrl,
        domElements,
        platform,
        includeCoordinates: false
      });

      result.elements = visionResult.elements;
      result.visibleElements = visionResult.visibleElements;
      result.hiddenElements = visionResult.hiddenElements;
      result.pageDescription = visionResult.pageDescription;
      result.suggestedScreenNames = visionResult.suggestedScreenNames;
      result.usage.vision = visionResult.tokensUsed || 0;

      const finalScreenName = screenName || 
        visionResult.suggestedScreenNames?.[0] || 
        'UnknownScreen';

      // Generate code
      console.log('⚡ Generating code...');
      
      if (generateLocators) {
        const locatorsResult = await this._generateLocators(result.elements, finalScreenName, platform);
        result.generated.locators = locatorsResult.code;
        result.usage.codegen += locatorsResult.tokens || 0;
      }

      if (generatePOM) {
        const pomResult = await this._generatePOM(result.elements, finalScreenName, platform);
        result.generated.pom = pomResult.code;
        result.usage.codegen += pomResult.tokens || 0;
      }

      if (generateTransitions) {
        const transitionsResult = await this._generateTransitions(result.elements, finalScreenName, platform);
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
  async _generateLocators(elements, screenName, platform = 'web') {
    if (!isLLMEnabled()) {
      return { code: this._fallbackLocators(elements, screenName, platform), tokens: 0 };
    }

    const isMobile = this._isMobilePlatform(platform);
    const elementsJson = JSON.stringify(elements, null, 2);
    
    const messages = [
      {
        role: 'system',
        content: `You are an expert at writing ${isMobile ? 'Appium' : 'Playwright'} locators for test automation.
Generate a JavaScript locators object from the UI elements provided.

Rules:
${isMobile ? `
- Use accessibility ID selectors when available (highest priority): ~accessibilityId
- For Android: android=new UiSelector().resourceId("...") or .text("...")
- For iOS: -ios predicate string:name == "..." or label == "..."
- XPath as last resort
` : `
- Use data-testid selectors when available (highest priority)
- Fall back to role-based selectors (getByRole)
- Then text-based selectors (getByText)
- CSS selectors as last resort
`}
- Use camelCase for all property names
- Include a comment describing each locator

Return ONLY valid JavaScript code, no markdown, no explanation.`
      },
      {
        role: 'user',
        content: `Generate locators for screen "${screenName}" (platform: ${platform}) with these elements:

${elementsJson}

Format:
export const ${screenName}Locators = {
  // Element description
  elementName: ${isMobile ? `'~accessibilityId'` : `page => page.locator('[data-testid="..."]')`},
};`
      }
    ];

    try {
      const code = await callLLM(messages, { maxTokens: 1500, temperature: 0.2 });
      return { code: this._cleanCodeResponse(code), tokens: 0 };
    } catch (error) {
      console.error('Locators generation error:', error.message);
      return { code: this._fallbackLocators(elements, screenName, platform), tokens: 0 };
    }
  }

  /**
   * Generate POM class
   * @private
   */
  async _generatePOM(elements, screenName, platform = 'web') {
    if (!isLLMEnabled()) {
      return { code: this._fallbackPOM(elements, screenName, platform), tokens: 0 };
    }

    const isMobile = this._isMobilePlatform(platform);
    const elementsJson = JSON.stringify(elements, null, 2);
    
    const messages = [
      {
        role: 'system',
        content: `You are an expert at writing Page Object Model classes for ${isMobile ? 'Appium' : 'Playwright'} test automation.
Generate a clean, well-structured POM class from the UI elements provided.

Rules:
- Use ${isMobile ? 'driver' : 'page'} as the main instance variable
- Use getter methods for locators
- Add action methods for interactive elements (${isMobile ? 'tap' : 'click'}, fill, etc.)
- Add assertion helper methods (isVisible, getText, etc.)
- Use JSDoc comments for all methods
- Follow the async/await pattern
${isMobile ? `- Use Appium/WebDriverIO locator strategies` : `- Use Playwright locator strategies`}

Return ONLY valid JavaScript code, no markdown, no explanation.`
      },
      {
        role: 'user',
        content: `Generate a POM class for screen "${screenName}" (platform: ${platform}) with these elements:

${elementsJson}

Format:
export class ${screenName} {
  constructor(${isMobile ? 'driver' : 'page'}) {
    this.${isMobile ? 'driver' : 'page'} = ${isMobile ? 'driver' : 'page'};
  }
  
  // Locators
  get elementName() {
    return this.${isMobile ? "driver.$('~accessibilityId')" : "page.locator('[data-testid=\"...\"]')"};
  }
  
  // Actions
  async ${isMobile ? 'tapElement' : 'clickElement'}() {
    await this.elementName.${isMobile ? 'click()' : 'click()'};
  }
}`
      }
    ];

    try {
      const code = await callLLM(messages, { maxTokens: 2000, temperature: 0.2 });
      return { code: this._cleanCodeResponse(code), tokens: 0 };
    } catch (error) {
      console.error('POM generation error:', error.message);
      return { code: this._fallbackPOM(elements, screenName, platform), tokens: 0 };
    }
  }

  /**
   * Generate transition functions
   * @private
   */
  async _generateTransitions(elements, screenName, platform = 'web') {
    if (!isLLMEnabled()) {
      return { code: this._fallbackTransitions(elements, screenName, platform), tokens: 0 };
    }

    const isMobile = this._isMobilePlatform(platform);
    const interactiveElements = elements.filter(el => el.isInteractive);
    
    if (interactiveElements.length === 0) {
      return { code: '// No interactive elements found', tokens: 0 };
    }

    const elementsJson = JSON.stringify(interactiveElements, null, 2);
    
    const messages = [
      {
        role: 'system',
        content: `You are an expert at writing transition functions for test automation state machines.
Generate action functions that interact with UI elements using ${isMobile ? 'Appium/WebDriverIO' : 'Playwright'}.

Rules:
- Each function should be async
- Use clear, descriptive function names (e.g., ${isMobile ? 'tapSubmitButton' : 'clickSubmitButton'}, fillEmailInput)
- Accept (${isMobile ? 'driver' : 'page'}, data) parameters
- Include wait conditions after actions if needed
- Add JSDoc with @param and @returns

Return ONLY valid JavaScript code, no markdown, no explanation.`
      },
      {
        role: 'user',
        content: `Generate transition functions for "${screenName}" (platform: ${platform}) with these interactive elements:

${elementsJson}

Format:
/**
 * ${isMobile ? 'Tap' : 'Click'} the submit button
 */
export async function ${isMobile ? 'tap' : 'click'}SubmitButton(${isMobile ? 'driver' : 'page'}, data) {
  await ${isMobile ? "driver.$('~submit').click()" : "page.locator('[data-testid=\"submit\"]').click()"};
}`
      }
    ];

    try {
      const code = await callLLM(messages, { maxTokens: 1500, temperature: 0.2 });
      return { code: this._cleanCodeResponse(code), tokens: 0 };
    } catch (error) {
      console.error('Transitions generation error:', error.message);
      return { code: this._fallbackTransitions(elements, screenName, platform), tokens: 0 };
    }
  }

  /**
   * Clean code response (remove markdown fences)
   * @private
   */
  _cleanCodeResponse(code) {
    let cleaned = code.replace(/```javascript\n?/g, '').replace(/```js\n?/g, '').replace(/```\n?/g, '');
    return cleaned.trim();
  }

  /**
   * Generate screen name from title
   * @private
   */
  _generateScreenName(title) {
    if (!title) return 'UnknownScreen';
    
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
  _fallbackLocators(elements, screenName, platform = 'web') {
    const isMobile = this._isMobilePlatform(platform);
    const lines = [`export const ${screenName}Locators = {`];
    
    for (const el of elements) {
      const selector = el.selectors?.[0];
      if (selector) {
        lines.push(`  // ${el.label || el.purpose || el.type}`);
        if (isMobile) {
          // Mobile: just store selector string
          lines.push(`  ${el.name}: '${selector.value}',`);
        } else {
          // Web: store as function
          lines.push(`  ${el.name}: page => page.locator('${selector.value}'),`);
        }
      }
    }
    
    lines.push('};');
    return lines.join('\n');
  }

  /**
   * Fallback POM when LLM is unavailable
   * @private
   */
  _fallbackPOM(elements, screenName, platform = 'web') {
    const isMobile = this._isMobilePlatform(platform);
    const instanceVar = isMobile ? 'driver' : 'page';
    
    const lines = [
      `export class ${screenName} {`,
      `  constructor(${instanceVar}) {`,
      `    this.${instanceVar} = ${instanceVar};`,
      '  }',
      ''
    ];
    
    for (const el of elements) {
      const selector = el.selectors?.[0];
      if (selector) {
        lines.push(`  // ${el.label || el.type}`);
        lines.push(`  get ${el.name}() {`);
        if (isMobile) {
          lines.push(`    return this.driver.$('${selector.value}');`);
        } else {
          lines.push(`    return this.page.locator('${selector.value}');`);
        }
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
  _fallbackTransitions(elements, screenName, platform = 'web') {
    const isMobile = this._isMobilePlatform(platform);
    const instanceVar = isMobile ? 'driver' : 'page';
    const actionVerb = isMobile ? 'tap' : 'click';
    
    const lines = [];
    const interactive = elements.filter(el => el.isInteractive);
    
    for (const el of interactive) {
      const selector = el.selectors?.[0];
      if (selector) {
        const funcName = `${actionVerb}${el.name.charAt(0).toUpperCase() + el.name.slice(1)}`;
        lines.push(`// ${el.purpose || el.label || el.type}`);
        lines.push(`export async function ${funcName}(${instanceVar}, data) {`);
        if (isMobile) {
          lines.push(`  await ${instanceVar}.$('${selector.value}').click();`);
        } else {
          lines.push(`  await ${instanceVar}.locator('${selector.value}').click();`);
        }
        lines.push('}');
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Close all adapters
   */
  async close() {
    if (this.browserAdapter?.isOpen()) {
      await this.browserAdapter.close();
    }
    if (this.mobileAdapter?.isOpen()) {
      await this.mobileAdapter.close();
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
      mobile: { ready: true, adapter: 'appium' },
      vision: visionConfig,
      codegen: { ready: isLLMEnabled(), adapter: 'deepseek' },
      allReady: visionConfig.configured && isLLMEnabled()
    };
  }
}

export const aiAssistant = new AIAssistantService();

export default AIAssistantService;