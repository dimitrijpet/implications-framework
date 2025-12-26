/**
 * VisionAdapter.js
 * 
 * Abstract interface for vision/image analysis.
 * Implementations: ClaudeVisionAdapter, GPT4VisionAdapter (future)
 * 
 * This adapter handles:
 * - Analyzing screenshots to identify UI elements
 * - Extracting structured data from images
 * - Providing element descriptions and suggested selectors
 * 
 * The vision adapter receives a screenshot and returns structured
 * information about the UI elements it can identify.
 * 
 * @abstract
 */
export class VisionAdapter {
  /**
   * Create a new VisionAdapter
   * @param {Object} config - Configuration options
   * @param {string} [config.model] - Model identifier
   * @param {number} [config.maxTokens=4096] - Max tokens for response
   * @param {number} [config.temperature=0.1] - Response temperature
   */
  constructor(config = {}) {
    if (new.target === VisionAdapter) {
      throw new Error('VisionAdapter is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      maxTokens: 4096,
      temperature: 0.1,
      ...config
    };
  }

  /**
   * Analyze screenshot and extract UI elements
   * 
   * @param {string} screenshotBase64 - Base64 encoded PNG image
   * @param {Object} options - Analysis options
   * @param {string} [options.context] - Additional context about the page
   * @param {string} [options.pageTitle] - Page title for context
   * @param {string} [options.pageUrl] - Page URL for context
   * @param {string[]} [options.focusElements] - Element types to focus on
   * @param {boolean} [options.includeCoordinates=false] - Include bounding boxes
   * @returns {Promise<VisionResult>}
   * 
   * @typedef {Object} VisionResult
   * @property {UIElement[]} elements - Detected UI elements
   * @property {string} rawResponse - Raw LLM response (for debugging)
   * @property {number} tokensUsed - Tokens consumed
   * @property {string} pageDescription - Overall page description
   * @property {string[]} suggestedScreenNames - Suggested names for this screen
   * 
   * @typedef {Object} UIElement
   * @property {string} name - camelCase element name (e.g., 'submitButton')
   * @property {string} type - Element type: button, input, link, text, dropdown, etc.
   * @property {string} label - Human-readable label
   * @property {string} purpose - What this element does
   * @property {SelectorSuggestion[]} selectors - Suggested selectors, ordered by preference
   * @property {BoundingBox} [bounds] - Element position (if includeCoordinates=true)
   * @property {Object} [attributes] - Detected attributes (placeholder, aria-label, etc.)
   * @property {boolean} isInteractive - Whether element can be interacted with
   * @property {string} [inputType] - For inputs: text, email, password, etc.
   * 
   * @typedef {Object} SelectorSuggestion
   * @property {string} type - Selector type: css, xpath, data-testid, text, role
   * @property {string} value - The selector value
   * @property {number} confidence - Confidence score 0-1
   * 
   * @typedef {Object} BoundingBox
   * @property {number} x - X coordinate
   * @property {number} y - Y coordinate
   * @property {number} width - Element width
   * @property {number} height - Element height
   * 
   * @example
   * const result = await vision.analyzeScreenshot(screenshotBase64, {
   *   pageTitle: 'Login Page',
   *   focusElements: ['button', 'input']
   * });
   * console.log('Found', result.elements.length, 'elements');
   */
  async analyzeScreenshot(screenshotBase64, options = {}) {
    throw new Error('VisionAdapter.analyzeScreenshot() must be implemented by subclass');
  }

  /**
   * Compare two screenshots and identify changes
   * 
   * @param {string} beforeBase64 - Before screenshot (base64)
   * @param {string} afterBase64 - After screenshot (base64)
   * @param {Object} options - Comparison options
   * @returns {Promise<ComparisonResult>}
   * 
   * @typedef {Object} ComparisonResult
   * @property {UIElement[]} added - Elements that appeared
   * @property {UIElement[]} removed - Elements that disappeared
   * @property {ElementChange[]} changed - Elements that changed
   * @property {string} summary - Natural language summary of changes
   * 
   * @typedef {Object} ElementChange
   * @property {UIElement} element - The element that changed
   * @property {string} changeType - Type of change: text, visibility, position, style
   * @property {string} before - Previous value
   * @property {string} after - New value
   */
  async compareScreenshots(beforeBase64, afterBase64, options = {}) {
    throw new Error('VisionAdapter.compareScreenshots() must be implemented by subclass');
  }

  /**
   * Extract text content from screenshot
   * 
   * @param {string} screenshotBase64 - Base64 encoded image
   * @param {Object} options - Extraction options
   * @param {boolean} [options.structured=false] - Return structured text with positions
   * @returns {Promise<TextExtractionResult>}
   * 
   * @typedef {Object} TextExtractionResult
   * @property {string} text - All extracted text
   * @property {TextBlock[]} [blocks] - Structured text blocks (if structured=true)
   * 
   * @typedef {Object} TextBlock
   * @property {string} text - Text content
   * @property {string} type - Block type: heading, paragraph, label, button, etc.
   * @property {BoundingBox} [bounds] - Position
   */
  async extractText(screenshotBase64, options = {}) {
    throw new Error('VisionAdapter.extractText() must be implemented by subclass');
  }

  /**
   * Validate if an element exists in the screenshot
   * 
   * @param {string} screenshotBase64 - Base64 encoded image
   * @param {string} elementDescription - Natural language description
   * @param {Object} options - Validation options
   * @returns {Promise<ValidationResult>}
   * 
   * @typedef {Object} ValidationResult
   * @property {boolean} found - Whether element was found
   * @property {number} confidence - Confidence score 0-1
   * @property {UIElement} [element] - Element details if found
   * @property {string} explanation - Why it was/wasn't found
   */
  async validateElement(screenshotBase64, elementDescription, options = {}) {
    throw new Error('VisionAdapter.validateElement() must be implemented by subclass');
  }

/**
 * Updated buildPrompt for VisionAdapter.js
 * 
 * Supports web (Playwright) and mobile (Appium) platforms
 * with appropriate selector strategies for each.
 */

buildPrompt(options = {}) {
  const { domElements = [], platform = 'web' } = options;
  
  // Determine if mobile platform
  const isMobile = platform === 'android' || platform === 'ios';
  const hasDom = Array.isArray(domElements) && domElements.length > 0;
  
  let domSection = '';
  if (hasDom) {
    console.log(`   📦 Building prompt with ${domElements.length} DOM elements (${platform})`);
    
    // Format DOM elements for the prompt - include pre-computed selectors for mobile
    const domSummary = domElements.slice(0, 60).map(el => {
      const parts = [`<${el.tag || el.type}>`];
      
      // Show the best pre-computed selector if available (from AppiumAdapter)
      if (isMobile && el.selectors && el.selectors.length > 0) {
        const bestSelector = el.selectors[0];
        parts.push(`SELECTOR="${bestSelector.value}" (${bestSelector.type}, ${Math.round(bestSelector.confidence * 100)}%)`);
        if (bestSelector.warning) parts.push(`⚠️ ${bestSelector.warning}`);
      }
      
      // Still show identifiers for context
      if (el.testId) parts.push(`testId="${el.testId}"`);
      if (el.text) parts.push(`text="${el.text.substring(0, 40)}"`);
      if (el.ariaLabel && el.ariaLabel !== el.testId) parts.push(`label="${el.ariaLabel}"`);
      if (el.selectorStrategy) parts.push(`[${el.selectorStrategy}]`);
      if (el.isVisible === false) parts.push(`[HIDDEN]`);
      
      return parts.join(' | ');
    }).join('\n');
    
    domSection = `
═══════════════════════════════════════════════════════════════
${isMobile ? 'MOBILE APP ELEMENTS - SELECTORS PRE-COMPUTED!' : 'DOM ELEMENTS'}:
═══════════════════════════════════════════════════════════════
${domSummary}

${isMobile ? `
████████████████████████████████████████████████████████████████
██ CRITICAL: USE THE PRE-COMPUTED SELECTORS SHOWN ABOVE!      ██
██ Do NOT invent new selectors - copy the SELECTOR= values    ██
████████████████████████████████████████████████████████████████

The SELECTOR= values above have been analyzed for uniqueness.
For each element, your "selectors" array should use these values EXACTLY.

Examples of what to return:
- If you see SELECTOR="~loginButton" → return { "value": "~loginButton", ... }
- If you see SELECTOR="$$('~content')[0]" → return { "value": "$$('~content')[0]", ... }
- If you see SELECTOR="android=new UiSelector().text(\\"Login\\")" → return that exact string
` : `
CRITICAL: Use the ACTUAL attributes from above for selectors!
- If data-testid exists → use getByTestId('value')
- If role exists → use getByRole('role', { name: 'aria-label or text' })
- If placeholder exists → use getByPlaceholder('exact value')
`}
═══════════════════════════════════════════════════════════════
`;
  } else {
    console.log(`   ⚠️ No DOM elements available - using visual-only analysis`);
  }

  // Build the selector format section based on platform
  const selectorFormatSection = isMobile ? `
SELECTOR FORMAT FOR MOBILE:
Your selectors array for each element should look like:
{
  "selectors": [
    { "type": "accessibilityId", "value": "<COPY FROM SELECTOR= ABOVE>", "confidence": 0.95 }
  ]
}

Copy the SELECTOR= value EXACTLY as shown. Examples:
✅ "value": "~manageBookings"
✅ "value": "$$('~content')[2]"  
✅ "value": "android=new UiSelector().text(\\"MANAGE\\")"
❌ "value": "~content-desc/label=\\"text\\"" (WRONG FORMAT!)
❌ "value": "~content" (too generic, use indexed version)
` : `
WEB SELECTOR PRIORITY:
1. getByTestId('data-testid-value') - if data-testid exists in DOM
2. getByRole('role', { name: 'accessible name' }) - use actual role from DOM
3. getByPlaceholder('exact placeholder') - MUST match DOM exactly
4. getByLabel('label text') - if aria-label exists
5. getByText('visible text') - for links/buttons with text
`;

  return `You are analyzing a ${isMobile ? 'MOBILE APP' : 'WEB PAGE'} screenshot for ${isMobile ? 'Appium' : 'Playwright'} test automation.

YOUR TASK: Match visible UI elements to the ${isMobile ? 'page source data' : 'DOM data'} below.
${domSection}
${selectorFormatSection}

For EACH element return:
{
  "name": "camelCaseName",
  "type": "button|input|text|image|nav|icon|list|section",
  "label": "Visible text or description",
  "purpose": "What this element does",
  "isInteractive": true/false,
  "isVisible": true/false,
  "visibilityReason": "only if hidden",
  "inputType": null,
  "selectors": [
    { "type": "accessibilityId", "value": "<USE SELECTOR= FROM ABOVE>", "confidence": 0.95 }
  ],
  "bounds": null,
  "attributes": {}
}

Return JSON:
{
  "screenName": "PascalCaseScreenName",
  "pageDescription": "One sentence description",
  "platform": "${platform}",
  "elements": [...],
  "visibleElements": ["element names visible in screenshot"],
  "hiddenElements": ["element names in hierarchy but not visible"],
  "suggestedScreenNames": ["Option1", "Option2"]
}`;
}

  parseResponse(response) {
  // Try to extract JSON from the response
  let jsonStr = response;
  
  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  // Try to find JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    
    // Extract visibility arrays from response
    const visibleElements = parsed.visibleElements || [];
    const hiddenElements = parsed.hiddenElements || [];
    
    // Also check individual element isVisible flags as fallback
    const normalizedElements = this.normalizeElements(parsed.elements || []);
    
    // If Claude didn't return visibility arrays, build them from element flags
    const finalVisibleElements = visibleElements.length > 0 
      ? visibleElements 
      : normalizedElements.filter(el => el.isVisible !== false).map(el => el.name);
    
    const finalHiddenElements = hiddenElements.length > 0 
      ? hiddenElements 
      : normalizedElements.filter(el => el.isVisible === false).map(el => el.name);
    
    console.log(`   👁️ Visibility: ${finalVisibleElements.length} visible, ${finalHiddenElements.length} hidden`);
    if (finalHiddenElements.length > 0) {
      console.log(`   🙈 Hidden elements: ${finalHiddenElements.join(', ')}`);
    }
    
    return {
      pageDescription: parsed.pageDescription || '',
      suggestedScreenNames: parsed.suggestedScreenNames || [],
      elements: normalizedElements,
      visibleElements: finalVisibleElements,
      hiddenElements: finalHiddenElements,
      rawResponse: response,
      tokensUsed: 0
    };
  } catch (e) {
    console.error('Failed to parse vision response:', e.message);
    console.error('Response was:', response.substring(0, 500));
    
    return {
      pageDescription: '',
      suggestedScreenNames: [],
      elements: [],
      visibleElements: [],
      hiddenElements: [],
      rawResponse: response,
      tokensUsed: 0,
      parseError: e.message
    };
  }
}

  /**
   * Normalize element data to ensure consistent structure
   * 
   * @protected
   * @param {Object[]} elements - Raw elements from parsing
   * @returns {UIElement[]} - Normalized elements
   */
  normalizeElements(elements) {
  return elements.map((el, index) => ({
    name: el.name || `element${index}`,
    type: el.type || 'unknown',
    label: el.label || el.name || '',
    purpose: el.purpose || '',
    isInteractive: el.isInteractive ?? this.isInteractiveType(el.type),
    isVisible: el.isVisible !== false,  // ✅ ADD - default true if not specified
    visibilityReason: el.visibilityReason || null,  // ✅ ADD
    inputType: el.inputType || null,
    selectors: this.normalizeSelectors(el.selectors || []),
    bounds: el.bounds || null,
    attributes: el.attributes || {}
  }));
}

  /**
   * Normalize selector suggestions
   * 
   * @protected
   * @param {Object[]} selectors - Raw selectors
   * @returns {SelectorSuggestion[]} - Normalized selectors
   */
  normalizeSelectors(selectors) {
    return selectors.map(sel => ({
      type: sel.type || 'css',
      value: sel.value || '',
      confidence: typeof sel.confidence === 'number' ? sel.confidence : 0.5
    })).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Determine if element type is typically interactive
   * 
   * @protected
   * @param {string} type - Element type
   * @returns {boolean}
   */
  isInteractiveType(type) {
    const interactiveTypes = [
      'button', 'input', 'link', 'dropdown', 'select',
      'checkbox', 'radio', 'textarea', 'switch', 'toggle',
      'tab', 'menu', 'menuitem', 'slider', 'datepicker'
    ];
    return interactiveTypes.includes(type?.toLowerCase());
  }

  /**
   * Get the vision adapter type/name
   * 
   * @returns {string} - Adapter name (e.g., 'claude-vision', 'gpt4-vision')
   */
  getAdapterType() {
    throw new Error('VisionAdapter.getAdapterType() must be implemented by subclass');
  }

  /**
   * Get adapter capabilities
   * 
   * @returns {Object} - Capabilities object
   * @property {boolean} canAnalyzeScreenshots - Can analyze screenshots
   * @property {boolean} canCompareScreenshots - Can compare two screenshots
   * @property {boolean} canExtractText - Can extract text from images
   * @property {boolean} canValidateElements - Can validate element presence
   * @property {boolean} supportsCoordinates - Can provide element coordinates
   */
  getCapabilities() {
    return {
      canAnalyzeScreenshots: true,
      canCompareScreenshots: false,
      canExtractText: true,
      canValidateElements: true,
      supportsCoordinates: true
    };
  }

  /**
   * Check if adapter is properly configured
   * 
   * @returns {Object} - Configuration status
   * @property {boolean} configured - Whether adapter is ready to use
   * @property {string[]} missing - List of missing configuration items
   */
  checkConfiguration() {
    throw new Error('VisionAdapter.checkConfiguration() must be implemented by subclass');
  }
}

export default VisionAdapter;