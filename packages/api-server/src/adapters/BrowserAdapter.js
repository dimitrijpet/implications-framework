/**
 * BrowserAdapter.js
 * 
 * Abstract interface for browser automation.
 * Implementations: VibiumAdapter, PlaywrightAdapter (future)
 * 
 * This adapter handles:
 * - Launching a headless browser
 * - Navigating to URLs
 * - Capturing screenshots
 * - Extracting DOM content
 * - Executing JavaScript in the browser context
 * 
 * @abstract
 */
export class BrowserAdapter {
  /**
   * Create a new BrowserAdapter
   * @param {Object} config - Configuration options
   * @param {boolean} [config.headless=true] - Run in headless mode
   * @param {number} [config.timeout=30000] - Default timeout in ms
   * @param {string} [config.viewport] - Viewport size (e.g., '1920x1080')
   */
  constructor(config = {}) {
    if (new.target === BrowserAdapter) {
      throw new Error('BrowserAdapter is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      headless: true,
      timeout: 30000,
      viewport: '1920x1080',
      ...config
    };
    
    this._isOpen = false;
  }

  /**
   * Launch browser instance
   * 
   * @param {Object} options - Launch options
   * @param {boolean} [options.headless=true] - Run headless
   * @param {number} [options.timeout] - Timeout for operations
   * @param {string} [options.viewport] - Viewport dimensions
   * @returns {Promise<this>} - Returns this for chaining
   * 
   * @example
   * const browser = new VibiumAdapter();
   * await browser.launch({ headless: true });
   */
  async launch(options = {}) {
    throw new Error('BrowserAdapter.launch() must be implemented by subclass');
  }

  /**
   * Navigate to URL and capture page data
   * 
   * @param {string} url - URL to scan
   * @param {Object} options - Scan options
   * @param {boolean} [options.waitForNetwork=true] - Wait for network idle
   * @param {number} [options.waitTimeout=10000] - Max wait time
   * @param {boolean} [options.captureDom=true] - Include DOM HTML
   * @returns {Promise<ScanResult>}
   * 
   * @typedef {Object} ScanResult
   * @property {string} screenshot - Base64 encoded PNG image
   * @property {string} [dom] - HTML content (if captureDom=true)
   * @property {string} url - Final URL (after any redirects)
   * @property {string} title - Page title
   * @property {number} timestamp - Unix timestamp when scanned
   * 
   * @example
   * const result = await browser.scanPage('https://example.com');
   * console.log('Screenshot size:', result.screenshot.length);
   * console.log('Page title:', result.title);
   */
  async scanPage(url, options = {}) {
    throw new Error('BrowserAdapter.scanPage() must be implemented by subclass');
  }

  /**
   * Find element by selector
   * 
   * @param {string} selector - CSS selector, XPath, or adapter-specific selector
   * @param {Object} options - Find options
   * @param {number} [options.timeout] - Max wait time for element
   * @param {boolean} [options.visible=true] - Wait for element to be visible
   * @returns {Promise<Element|null>} - Element handle or null if not found
   * 
   * @example
   * const button = await browser.findElement('[data-testid="submit"]');
   * if (button) {
   *   await button.click();
   * }
   */
  async findElement(selector, options = {}) {
    throw new Error('BrowserAdapter.findElement() must be implemented by subclass');
  }

  /**
   * Find multiple elements by selector
   * 
   * @param {string} selector - CSS selector, XPath, or adapter-specific selector
   * @param {Object} options - Find options
   * @returns {Promise<Element[]>} - Array of element handles
   * 
   * @example
   * const buttons = await browser.findElements('button');
   * console.log('Found', buttons.length, 'buttons');
   */
  async findElements(selector, options = {}) {
    throw new Error('BrowserAdapter.findElements() must be implemented by subclass');
  }

  /**
   * Execute JavaScript in browser context
   * 
   * @param {Function|string} fn - Function or string to execute
   * @param {...any} args - Arguments to pass to the function
   * @returns {Promise<any>} - Result of execution
   * 
   * @example
   * // Get all buttons with their text
   * const buttons = await browser.execute(() => {
   *   return Array.from(document.querySelectorAll('button'))
   *     .map(b => ({ text: b.textContent, id: b.id }));
   * });
   */
  async execute(fn, ...args) {
    throw new Error('BrowserAdapter.execute() must be implemented by subclass');
  }

  /**
   * Take a screenshot of the current page
   * 
   * @param {Object} options - Screenshot options
   * @param {boolean} [options.fullPage=false] - Capture full page
   * @param {string} [options.encoding='base64'] - Output encoding
   * @param {string} [options.type='png'] - Image type (png, jpeg, webp)
   * @param {number} [options.quality] - Quality for jpeg/webp (0-100)
   * @returns {Promise<string>} - Screenshot as base64 string
   * 
   * @example
   * const screenshot = await browser.screenshot({ fullPage: true });
   */
  async screenshot(options = {}) {
    throw new Error('BrowserAdapter.screenshot() must be implemented by subclass');
  }

  /**
   * Navigate to a URL
   * 
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   * @param {string} [options.waitUntil='networkidle'] - Wait condition
   * @returns {Promise<void>}
   */
  async goto(url, options = {}) {
    throw new Error('BrowserAdapter.goto() must be implemented by subclass');
  }

  /**
   * Get the current page URL
   * 
   * @returns {Promise<string>} - Current URL
   */
  async currentUrl() {
    throw new Error('BrowserAdapter.currentUrl() must be implemented by subclass');
  }

  /**
   * Get the page title
   * 
   * @returns {Promise<string>} - Page title
   */
  async getTitle() {
    throw new Error('BrowserAdapter.getTitle() must be implemented by subclass');
  }

  /**
   * Get page HTML content
   * 
   * @returns {Promise<string>} - HTML content
   */
  async getContent() {
    throw new Error('BrowserAdapter.getContent() must be implemented by subclass');
  }

  /**
   * Wait for a condition
   * 
   * @param {string|Function} condition - Selector or predicate function
   * @param {Object} options - Wait options
   * @param {number} [options.timeout=30000] - Max wait time
   * @returns {Promise<void>}
   */
  async waitFor(condition, options = {}) {
    throw new Error('BrowserAdapter.waitFor() must be implemented by subclass');
  }

  /**
   * Close browser and cleanup resources
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * await browser.close();
   */
  async close() {
    throw new Error('BrowserAdapter.close() must be implemented by subclass');
  }

  /**
   * Check if browser is currently open
   * 
   * @returns {boolean} - true if browser is open
   */
  isOpen() {
    return this._isOpen;
  }

  /**
   * Get browser adapter type/name
   * 
   * @returns {string} - Adapter name (e.g., 'vibium', 'playwright')
   */
  getAdapterType() {
    throw new Error('BrowserAdapter.getAdapterType() must be implemented by subclass');
  }

  /**
   * Get adapter capabilities
   * 
   * @returns {Object} - Capabilities object
   * @property {boolean} canScreenshot - Can take screenshots
   * @property {boolean} canExecuteJs - Can execute JavaScript
   * @property {boolean} canExtractDom - Can extract DOM
   * @property {boolean} hasAiLocators - Has AI-powered locators
   * @property {boolean} hasSelfHealing - Has self-healing selectors
   */
  getCapabilities() {
    return {
      canScreenshot: true,
      canExecuteJs: true,
      canExtractDom: true,
      hasAiLocators: false,
      hasSelfHealing: false
    };
  }

  /**
   * Set protected flag for browser state
   * @protected
   */
  _setOpen(isOpen) {
    this._isOpen = isOpen;
  }
}

export default BrowserAdapter;