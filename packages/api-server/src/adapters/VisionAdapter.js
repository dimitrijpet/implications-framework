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
   * Build the analysis prompt
   * 
   * @protected
   * @param {Object} options - Options passed to analyzeScreenshot
   * @returns {string} - Prompt text
   */
  buildPrompt(options = {}) {
    const {
      context = '',
      pageTitle = '',
      pageUrl = '',
      focusElements = [],
      includeCoordinates = false
    } = options;

    let prompt = `Analyze this screenshot of a web page and identify all interactive UI elements.

For each element, provide:
1. A camelCase name (e.g., "submitButton", "emailInput")
2. The element type (button, input, link, dropdown, checkbox, etc.)
3. A human-readable label
4. What the element does (its purpose)
5. Suggested selectors in order of preference:
   - data-testid if visible
   - ARIA attributes
   - CSS selectors
   - Text content
   - XPath as last resort

Return a JSON object with this structure:
{
  "pageDescription": "Brief description of the page",
  "suggestedScreenNames": ["ScreenName1", "ScreenName2"],
  "elements": [
    {
      "name": "camelCaseName",
      "type": "button|input|link|dropdown|checkbox|radio|text|image|form|container",
      "label": "Human readable label",
      "purpose": "What this element does",
      "isInteractive": true/false,
      "inputType": "text|email|password|number|etc (for inputs)",
      "selectors": [
        { "type": "data-testid", "value": "[data-testid='example']", "confidence": 0.95 },
        { "type": "css", "value": ".submit-btn", "confidence": 0.8 },
        { "type": "text", "value": "Submit", "confidence": 0.7 }
      ]${includeCoordinates ? `,
      "bounds": { "x": 100, "y": 200, "width": 120, "height": 40 }` : ''}
    }
  ]
}`;

    if (pageTitle) {
      prompt += `\n\nPage title: "${pageTitle}"`;
    }

    if (pageUrl) {
      prompt += `\nPage URL: ${pageUrl}`;
    }

    if (context) {
      prompt += `\n\nAdditional context: ${context}`;
    }

    if (focusElements.length > 0) {
      prompt += `\n\nFocus on these element types: ${focusElements.join(', ')}`;
    }

    prompt += `\n\nIMPORTANT:
- Be thorough but only include visible, meaningful elements
- Prefer data-testid selectors when visible in the DOM
- For inputs, always include the inputType
- Use camelCase for all element names
- Return ONLY valid JSON, no markdown or explanation`;

    return prompt;
  }

  /**
   * Parse the vision model response into structured data
   * 
   * @protected
   * @param {string} response - Raw response from vision model
   * @returns {VisionResult} - Parsed result
   */
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
      
      return {
        pageDescription: parsed.pageDescription || '',
        suggestedScreenNames: parsed.suggestedScreenNames || [],
        elements: this.normalizeElements(parsed.elements || []),
        rawResponse: response,
        tokensUsed: 0 // Will be set by implementation
      };
    } catch (e) {
      console.error('Failed to parse vision response:', e.message);
      console.error('Response was:', response.substring(0, 500));
      
      return {
        pageDescription: '',
        suggestedScreenNames: [],
        elements: [],
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