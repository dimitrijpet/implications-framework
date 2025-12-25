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

buildPrompt(options = {}) {
  const { domElements = [] } = options;
  
  // If we have DOM info, use it for accurate selectors
  const hasDom = Array.isArray(domElements) && domElements.length > 0;
  
  let domSection = '';
  if (hasDom) {
    console.log(`   📦 Building prompt with ${domElements.length} DOM elements`);
    
    // Format DOM elements for the prompt
    const domSummary = domElements.slice(0, 50).map(el => {
      const parts = [`<${el.tag}>`];
      if (el.testId) parts.push(`data-testid="${el.testId}"`);
      if (el.role) parts.push(`role="${el.role}"`);
      if (el.ariaLabel) parts.push(`aria-label="${el.ariaLabel}"`);
      if (el.id) parts.push(`id="${el.id}"`);
      if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
      if (el.inputType) parts.push(`type="${el.inputType}"`);
      if (el.text) parts.push(`text="${el.text.substring(0, 50)}"`);
      if (el.href) parts.push(`href="${el.href.substring(0, 50)}"`);
      return parts.join(' | ');
    }).join('\n');
    
    domSection = `
═══════════════════════════════════════════════════════════════
DOM ELEMENTS (ACTUAL HTML - USE THESE FOR ACCURATE SELECTORS):
═══════════════════════════════════════════════════════════════
${domSummary}

CRITICAL: Use the ACTUAL attributes from DOM above for selectors!
- If data-testid exists → use getByTestId('value')
- If type="search" → use getByRole('searchbox', { name: '...' })
- If role exists → use getByRole('role', { name: 'aria-label or text' })
- If placeholder exists → use getByPlaceholder('exact value')
- If aria-label exists → use getByLabel('value')
═══════════════════════════════════════════════════════════════
`;
  } else {
    console.log(`   ⚠️ No DOM elements available - using visual-only analysis`);
  }

  return `You are a senior QA automation engineer analyzing a screenshot for Playwright test automation.

YOUR TASK: Identify ALL testable UI elements on this page. Be EXTREMELY thorough.
${domSection}
MUST FIND (if visible):
✅ Logo and branding elements
✅ ALL navigation links (header, sidebar, footer)
✅ ALL buttons (including icon-only buttons)
✅ ALL form inputs (text, email, password, search, etc.)
✅ ALL dropdowns and select menus
✅ ALL checkboxes and radio buttons
✅ ALL links (navigation, inline, footer)
✅ Search bars and search icons
✅ User profile/account buttons
✅ Menu icons (hamburger, kebab, etc.)
✅ Social media links
✅ Important headings (h1, h2)
✅ Images that might need verification
✅ Tabs and tab panels
✅ Modal triggers
✅ Any clickable or interactive element

${hasDom ? `
SELECTOR PRIORITY (you have DOM data - use it!):
1. getByTestId('data-testid-value') - if data-testid exists in DOM
2. getByRole('searchbox', { name: '...' }) - for type="search" inputs
3. getByRole('role', { name: 'accessible name' }) - use actual role from DOM
4. getByPlaceholder('exact placeholder') - MUST match DOM exactly
5. getByLabel('label text') - if aria-label exists
6. getByText('visible text') - for links/buttons with text
` : `
SELECTOR RULES (no DOM available - must guess from visual):
⚠️ You can ONLY see the screenshot - you CANNOT see HTML attributes!
1. getByRole('button', { name: 'Visible Text' }) - for buttons
2. getByRole('link', { name: 'Link Text' }) - for links  
3. getByRole('textbox', { name: 'Label' }) - for inputs
4. getByPlaceholder('Search...') - if placeholder is visible
5. getByText('Exact Text') - for text elements
`}

For EACH element provide this JSON structure:
{
  "name": "camelCaseName",
  "type": "button|input|link|text|image|checkbox|select|heading|nav|icon",
  "label": "Visible text or aria-label",
  "purpose": "What this element does",
  "isInteractive": true/false,
  "selectors": [
    { "type": "testid", "value": "getByTestId('actual-testid')", "confidence": 0.95 },
    { "type": "role", "value": "getByRole('button', { name: 'Submit' })", "confidence": 0.9 }
  ]
}

Return JSON:
{
  "screenName": "PascalCasePageName",
  "pageDescription": "One sentence description",
  "elements": [...all elements...],
  "suggestedScreenNames": ["Option1", "Option2"]
}`;
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