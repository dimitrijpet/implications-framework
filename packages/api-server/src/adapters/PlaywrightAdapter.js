/**
 * PlaywrightAdapter.js
 * 
 * Browser automation using Playwright.
 * Implements the BrowserAdapter interface.
 */

import { chromium } from 'playwright';
import { BrowserAdapter } from './BrowserAdapter.js';

export class PlaywrightAdapter extends BrowserAdapter {
  constructor(config = {}) {
    super(config);
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Launch browser instance
   */
  async launch(options = {}) {
    const launchOptions = {
      headless: options.headless ?? this.config.headless ?? true,
      timeout: options.timeout ?? this.config.timeout ?? 30000
    };

    this.browser = await chromium.launch(launchOptions);
    this.context = await this.browser.newContext({
      viewport: this._parseViewport(this.config.viewport)
    });
    this.page = await this.context.newPage();
    this._setOpen(true);
    
    return this;
  }

  /**
   * Navigate to URL and capture page data
   */
  async scanPage(url, options = {}) {
    const {
      waitForNetwork = true,
      waitTimeout = 10000,
      captureDom = true
    } = options;

    if (!this.isOpen()) {
      await this.launch();
    }

    // Navigate to URL
    await this.page.goto(url, {
      waitUntil: waitForNetwork ? 'networkidle' : 'domcontentloaded',
      timeout: waitTimeout
    });

    // Small delay for any final renders
    await this.page.waitForTimeout(500);

    // Capture screenshot
    const screenshotBuffer = await this.page.screenshot({
      type: 'png',
      fullPage: false
    });
    const screenshot = screenshotBuffer.toString('base64');

    // Get page info
    const title = await this.page.title();
    const finalUrl = this.page.url();

    // Optionally capture DOM
    let dom = null;
    if (captureDom) {
      dom = await this.page.content();
    }

    return {
      screenshot,
      dom,
      url: finalUrl,
      title,
      timestamp: Date.now()
    };
  }

  /**
   * Find element by selector
   */
  async findElement(selector, options = {}) {
    const { timeout = 5000, visible = true } = options;

    try {
      const locator = this.page.locator(selector);
      if (visible) {
        await locator.waitFor({ state: 'visible', timeout });
      }
      return locator.first();
    } catch (e) {
      return null;
    }
  }

  /**
   * Find multiple elements
   */
  async findElements(selector, options = {}) {
    const locator = this.page.locator(selector);
    return locator.all();
  }

  /**
   * Execute JavaScript in browser context
   */
  async execute(fn, ...args) {
    return this.page.evaluate(fn, ...args);
  }

  /**
   * Take a screenshot
   */
  async screenshot(options = {}) {
    const {
      fullPage = false,
      type = 'png',
      quality
    } = options;

    const screenshotOptions = { type, fullPage };
    if (quality && type !== 'png') {
      screenshotOptions.quality = quality;
    }

    const buffer = await this.page.screenshot(screenshotOptions);
    return buffer.toString('base64');
  }

  /**
   * Navigate to URL
   */
  async goto(url, options = {}) {
    const { waitUntil = 'networkidle' } = options;
    await this.page.goto(url, { waitUntil });
  }

  /**
   * Get current URL
   */
  async currentUrl() {
    return this.page.url();
  }

  /**
   * Get page title
   */
  async getTitle() {
    return this.page.title();
  }

  /**
   * Get page HTML content
   */
  async getContent() {
    return this.page.content();
  }

  /**
   * Wait for condition
   */
  async waitFor(condition, options = {}) {
    const { timeout = 30000 } = options;

    if (typeof condition === 'string') {
      await this.page.waitForSelector(condition, { timeout });
    } else if (typeof condition === 'function') {
      await this.page.waitForFunction(condition, { timeout });
    }
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this._setOpen(false);
    }
  }

  /**
   * Get adapter type
   */
  getAdapterType() {
    return 'playwright';
  }

  /**
   * Parse viewport string to object
   * @private
   */
  _parseViewport(viewport) {
    if (typeof viewport === 'object') return viewport;
    if (typeof viewport === 'string') {
      const [width, height] = viewport.split('x').map(Number);
      return { width: width || 1920, height: height || 1080 };
    }
    return { width: 1920, height: 1080 };
  }
}

export default PlaywrightAdapter;