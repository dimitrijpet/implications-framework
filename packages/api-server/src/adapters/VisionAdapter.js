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
    
    // Format DOM elements for the prompt
    const domSummary = domElements.slice(0, 60).map(el => {
      const parts = [`<${el.tag}>`];
      if (el.testId) parts.push(`${isMobile ? 'accessibility-id' : 'data-testid'}="${el.testId}"`);
      if (el.role) parts.push(`role="${el.role}"`);
      if (el.ariaLabel) parts.push(`${isMobile ? 'content-desc/label' : 'aria-label'}="${el.ariaLabel}"`);
      if (el.id) parts.push(`id="${el.id}"`);
      if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
      if (el.inputType) parts.push(`type="${el.inputType}"`);
      if (el.text) parts.push(`text="${el.text.substring(0, 50)}"`);
      if (!isMobile && el.href) parts.push(`href="${el.href.substring(0, 50)}"`);
      if (el.isVisible === false) parts.push(`[HIDDEN IN DOM]`);
      if (el.bounds) parts.push(`bounds=[${el.bounds.x},${el.bounds.y}]`);
      return parts.join(' | ');
    }).join('\n');
    
    domSection = `
═══════════════════════════════════════════════════════════════
${isMobile ? 'MOBILE APP' : 'DOM'} ELEMENTS (USE THESE FOR ACCURATE SELECTORS):
═══════════════════════════════════════════════════════════════
${domSummary}

CRITICAL: Use the ACTUAL attributes from above for selectors!
${isMobile ? `
- If accessibility-id/name exists → use ~accessibilityId (cross-platform best)
- If resource-id exists (Android) → use android=resourceId("value")
- If content-desc/label exists → use accessibility locator
- Fallback to XPath with text content
` : `
- If data-testid exists → use getByTestId('value')
- If type="search" → use getByRole('searchbox', { name: '...' })
- If role exists → use getByRole('role', { name: 'aria-label or text' })
- If placeholder exists → use getByPlaceholder('exact value')
- If aria-label exists → use getByLabel('value')
`}
═══════════════════════════════════════════════════════════════
`;
  } else {
    console.log(`   ⚠️ No DOM elements available - using visual-only analysis`);
  }

  // Platform-specific selector guidance
  const selectorGuidance = isMobile ? `
MOBILE SELECTOR PRIORITY (${platform}):
${platform === 'android' ? `
1. ~accessibilityId - content-desc attribute (best for cross-platform)
2. android=new UiSelector().resourceId("com.app:id/button_login") - resource-id
3. android=new UiSelector().text("Login") - by text
4. android=new UiSelector().className("android.widget.Button") - by class
5. XPath: //android.widget.Button[@text="Login"] - fallback
` : `
1. ~accessibilityId - name attribute (best for cross-platform)
2. -ios predicate string:name == "Login" - by name
3. -ios predicate string:label == "Login" - by label
4. -ios class chain:**/XCUIElementTypeButton[\`label == "Login"\`]
5. XPath: //XCUIElementTypeButton[@label="Login"] - fallback
`}

AVOID GENERIC SELECTORS:
❌ XPath by index: (//Button)[3]
❌ Class-only: android.widget.Button (matches all buttons)
✅ Use accessibility-id when available
✅ Combine class + text: //Button[@text="Submit"]
` : `
WEB SELECTOR PRIORITY (you have DOM data - use it!):
1. getByTestId('data-testid-value') - if data-testid exists in DOM
2. getByRole('searchbox', { name: '...' }) - for type="search" inputs
3. getByRole('role', { name: 'accessible name' }) - use actual role from DOM
4. getByPlaceholder('exact placeholder') - MUST match DOM exactly
5. getByLabel('label text') - if aria-label exists
6. getByText('visible text') - for links/buttons with text

AVOID GENERIC SELECTORS:
❌ getByRole('img') - too generic, matches all images
✅ getByRole('img', { name: 'Company Logo' }) - specific with alt text
❌ getByRole('button') - too generic
✅ getByRole('button', { name: 'Submit' }) - specific with text
`;

  return `You are a senior QA automation engineer analyzing a ${isMobile ? 'MOBILE APP' : 'FULL PAGE'} screenshot for ${isMobile ? 'Appium' : 'Playwright'} test automation.

YOUR TASK: Identify ALL testable UI elements on this ${isMobile ? 'screen' : 'page'} and determine their visibility status.
${domSection}

═══════════════════════════════════════════════════════════════
VISIBILITY DETECTION (CRITICAL!)
═══════════════════════════════════════════════════════════════
Cross-reference the screenshot with ${isMobile ? 'page source' : 'DOM'} data to categorize elements:

VISIBLE elements (can see in screenshot):
- ${isMobile ? 'Buttons, inputs, labels' : 'Navigation links, buttons, inputs'} that are rendered and displayed
- Content that appears on screen

HIDDEN elements (in ${isMobile ? 'hierarchy' : 'DOM'} but NOT visible in screenshot):
- ${isMobile ? 'Off-screen elements, hidden views, collapsed sections' : 'Skip links, clear buttons, collapsed menus'}
- Loading spinners, error messages (not currently shown)
- Modal dialogs, tooltips, dropdowns (collapsed/closed state)
- Elements with zero bounds or visibility=false

For each element, set "isVisible": true or false based on whether you can actually SEE it in the screenshot.

MUST FIND (whether visible or hidden):
✅ ${isMobile ? 'App logo/branding' : 'Logo and branding elements'}
✅ ALL ${isMobile ? 'navigation elements (tabs, hamburger menu, back button)' : 'navigation links (header, sidebar, footer)'}
✅ ALL buttons (including icon-only buttons)
✅ ALL ${isMobile ? 'text inputs, search fields' : 'form inputs (text, email, password, search, etc.)'}
✅ ALL ${isMobile ? 'pickers, spinners' : 'dropdowns and select menus'}
✅ ALL checkboxes, switches, toggles
✅ ${isMobile ? 'List items, cards' : 'Links (navigation, inline, footer)'}
✅ ${isMobile ? 'Tab bars, toolbars' : 'Search bars and search icons'}
✅ ${isMobile ? 'Settings icons, profile buttons' : 'User profile/account buttons'}
✅ Menu icons (hamburger, kebab, etc.)
✅ ${isMobile ? 'Action buttons (FAB, submit)' : 'Important headings (h1, h2)'}
✅ Images that might need verification
✅ Any clickable or interactive element

${selectorGuidance}

For EACH element provide this JSON structure:
{
  "name": "camelCaseName",
  "type": "button|input|link|text|image|checkbox|select|switch|list|nav|icon",
  "label": "Visible text or accessibility label",
  "purpose": "What this element does",
  "isInteractive": true/false,
  "isVisible": true/false,
  "visibilityReason": "only if hidden - explain why",
  "selectors": [
    ${isMobile ? `
    { "type": "accessibilityId", "value": "~loginButton", "confidence": 0.95 },
    { "type": "${platform === 'android' ? 'resourceId' : 'predicate'}", "value": "${platform === 'android' ? 'android=resourceId(\\"com.app:id/login\\")' : '-ios predicate string:name == \\"login\\"'}", "confidence": 0.9 }
    ` : `
    { "type": "testid", "value": "getByTestId('actual-testid')", "confidence": 0.95 },
    { "type": "role", "value": "getByRole('button', { name: 'Submit' })", "confidence": 0.9 }
    `}
  ]
}

Return JSON:
{
  "screenName": "PascalCaseScreenName",
  "pageDescription": "One sentence description",
  "platform": "${platform}",
  "elements": [...all elements...],
  "visibleElements": ["names of elements visible in screenshot"],
  "hiddenElements": ["names of elements in ${isMobile ? 'hierarchy' : 'DOM'} but not visible"],
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