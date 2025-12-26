/**
 * AppiumAdapter.js
 * 
 * Mobile automation adapter using Appium for Android and iOS.
 * Extracts screenshots and XML page source, converting to same format as PlaywrightAdapter.
 * 
 * Prerequisites:
 *   - Appium server running (npx appium or appium desktop)
 *   - Android: Android SDK, emulator or real device
 *   - iOS: Xcode, simulator or real device
 * 
 * Usage:
 *   const adapter = new AppiumAdapter({ platform: 'android' });
 *   await adapter.launch({ deviceName: 'Pixel 6', app: '/path/to/app.apk' });
 *   const { screenshot, dom } = await adapter.scanPage();
 */

import { remote } from 'webdriverio';
import { XMLParser } from 'fast-xml-parser';

export class AppiumAdapter {
  constructor(config = {}) {
    this.driver = null;
    this.platform = config.platform || 'android'; // 'android' | 'ios'
    this.appiumUrl = config.appiumUrl || 'http://localhost:4723';
    this.config = config;
  }

  /**
   * Check if driver is connected
   */
  isOpen() {
    return this.driver !== null && this.driver.sessionId !== null;
  }

  /**
   * Launch Appium session
   * 
   * @param {Object} options - Launch options
   * @param {string} options.deviceName - Device name (e.g., 'Pixel 6', 'iPhone 14')
   * @param {string} options.app - Path to APK/IPA or bundle ID
   * @param {string} options.platformVersion - OS version (e.g., '13.0')
   * @param {string} options.automationName - 'UiAutomator2' (Android) or 'XCUITest' (iOS)
   */
  async launch(options = {}) {
    const {
      deviceName = this.platform === 'android' ? 'Android Emulator' : 'iPhone Simulator',
      app = null,
      platformVersion = null,
      automationName = this.platform === 'android' ? 'UiAutomator2' : 'XCUITest',
      noReset = true,
      fullReset = false,
      ...extraCapabilities
    } = options;

    const capabilities = {
      platformName: this.platform === 'android' ? 'Android' : 'iOS',
      'appium:deviceName': deviceName,
      'appium:automationName': automationName,
      'appium:noReset': noReset,
      'appium:fullReset': fullReset,
      ...extraCapabilities
    };

    // Add app if provided
    if (app) {
      if (app.startsWith('com.') || app.startsWith('io.')) {
        // Bundle ID - app already installed
        if (this.platform === 'android') {
          capabilities['appium:appPackage'] = app;
        } else {
          capabilities['appium:bundleId'] = app;
        }
      } else {
        // Path to APK/IPA
        capabilities['appium:app'] = app;
      }
    }

    // Add platform version if provided
    if (platformVersion) {
      capabilities['appium:platformVersion'] = platformVersion;
    }

    console.log(`📱 Launching Appium session (${this.platform})...`);
    console.log(`   Device: ${deviceName}`);
    console.log(`   App: ${app || 'none specified'}`);

    try {
      this.driver = await remote({
        hostname: new URL(this.appiumUrl).hostname,
        port: parseInt(new URL(this.appiumUrl).port) || 4723,
        path: '/wd/hub',
        capabilities
      });

      console.log(`✅ Appium session started: ${this.driver.sessionId}`);
      return this.driver;

    } catch (error) {
      console.error('❌ Failed to start Appium session:', error.message);
      throw error;
    }
  }

  /**
   * Scan current screen - capture screenshot and extract DOM
   * 
   * @param {Object} options - Scan options
   * @returns {Object} { screenshot, dom, title, url, timestamp }
   */
  async scanPage(options = {}) {
    const {
      waitTimeout = 2000,
      captureDom = true
    } = options;

    if (!this.isOpen()) {
      throw new Error('No Appium session. Call launch() first.');
    }

    // Wait for screen to stabilize
    await this.driver.pause(waitTimeout);

    // Capture screenshot
    console.log('   📸 Capturing screenshot...');
    const screenshot = await this.driver.takeScreenshot();

    // Get current activity/view controller name
    let title = 'Unknown Screen';
    try {
      if (this.platform === 'android') {
        title = await this.driver.getCurrentActivity();
      } else {
        // iOS doesn't have direct equivalent, try to get from page source
        title = 'iOS Screen';
      }
    } catch (e) {
      console.log('   ⚠️ Could not get screen title:', e.message);
    }

    // Extract DOM from XML page source
    let dom = [];
    if (captureDom) {
      console.log('   📦 Extracting DOM from page source...');
      try {
        const pageSource = await this.driver.getPageSource();
        dom = this.parsePageSource(pageSource);
        console.log(`   📦 Extracted ${dom.length} DOM elements`);
      } catch (e) {
        console.error('   ❌ Failed to extract DOM:', e.message);
      }
    }

    return {
      screenshot,
      dom,
      url: null, // Mobile apps don't have URLs
      title,
      platform: this.platform,
      timestamp: Date.now()
    };
  }

  /**
   * Parse XML page source into structured DOM elements with hierarchy
   * 
   * @param {string} xmlSource - Raw XML from getPageSource()
   * @returns {Array} Normalized DOM elements with smart selectors
   */
  parsePageSource(xmlSource) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      allowBooleanAttributes: true
    });

    const elements = [];
    
    try {
      const parsed = parser.parse(xmlSource);
      // Extract with hierarchy tracking
      this._extractElementsWithHierarchy(parsed, elements, null, [], 0);
      
      // Post-process: check uniqueness and generate smart selectors
      this._generateSmartSelectors(elements);
      
    } catch (e) {
      console.error('Failed to parse XML:', e.message);
    }

    return elements;
  }

  /**
   * Extract elements with full hierarchy tracking
   * @private
   */
  _extractElementsWithHierarchy(node, elements, parentInfo, path, depth) {
    if (!node || typeof node !== 'object') return;

    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('@_') || key === '#text') continue;

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          this._processNodeWithHierarchy(key, item, elements, parentInfo, [...path, { tag: key, index }], depth, index);
        });
      } else if (typeof value === 'object') {
        this._processNodeWithHierarchy(key, value, elements, parentInfo, [...path, { tag: key, index: 0 }], depth, 0);
      }
    }
  }

  /**
   * Process node with hierarchy context
   * @private
   */
  _processNodeWithHierarchy(tagName, node, elements, parentInfo, path, depth, siblingIndex) {
    if (!node || typeof node !== 'object') return;

    // Extract element data
    const element = this._extractElementData(tagName, node);
    
    // Build hierarchy info
    const hierarchyInfo = {
      depth,
      siblingIndex,
      path: path.map(p => p.tag).join(' > '),
      parent: parentInfo ? {
        testId: parentInfo.testId,
        ariaLabel: parentInfo.ariaLabel,
        text: parentInfo.text,
        type: parentInfo.type
      } : null
    };

    if (element) {
      // Add hierarchy info
      element.hierarchy = hierarchyInfo;
      element.depth = depth;
      
      // Store raw identifiers for uniqueness check
      element._rawIdentifiers = {
        testId: element.testId,
        ariaLabel: element.ariaLabel,
        text: element.text,
        resourceId: node['resource-id'] || node['name'] || ''
      };

      if (element.isInteractive || element.text || element.testId || element.ariaLabel) {
        elements.push(element);
      }
    }

    // Recurse with current element as parent
    const newParentInfo = element || parentInfo;
    this._extractElementsWithHierarchy(node, elements, newParentInfo, path, depth + 1);
  }

  /**
   * Generate smart selectors based on uniqueness analysis
   * @private
   */
  _generateSmartSelectors(elements) {
    // Count occurrences of each identifier
    const testIdCount = {};
    const ariaLabelCount = {};
    const textCount = {};

    for (const el of elements) {
      if (el.testId) {
        testIdCount[el.testId] = (testIdCount[el.testId] || 0) + 1;
      }
      if (el.ariaLabel) {
        ariaLabelCount[el.ariaLabel] = (ariaLabelCount[el.ariaLabel] || 0) + 1;
      }
      if (el.text) {
        textCount[el.text] = (textCount[el.text] || 0) + 1;
      }
    }

    // Generate selectors for each element
    for (const el of elements) {
      el.selectors = [];
      el.selectorStrategy = null;

      const testIdUnique = el.testId && testIdCount[el.testId] === 1;
      const ariaLabelUnique = el.ariaLabel && ariaLabelCount[el.ariaLabel] === 1;
      const textUnique = el.text && textCount[el.text] === 1;

      // Strategy 1: Unique accessibility ID (best)
      if (testIdUnique) {
        el.selectors.push({
          type: 'accessibility',
          value: `~${el.testId}`,
          confidence: 0.95,
          unique: true
        });
        el.selectorStrategy = 'unique-accessibility-id';
      }
      // Strategy 2: Unique content-desc/aria-label
      else if (ariaLabelUnique && el.ariaLabel !== el.testId) {
        el.selectors.push({
          type: 'accessibility',
          value: `~${el.ariaLabel}`,
          confidence: 0.90,
          unique: true
        });
        el.selectorStrategy = 'unique-aria-label';
      }
      // Strategy 3: Chained selector (parent + child)
      else if (el.hierarchy?.parent?.testId && el.testId) {
        const parentId = el.hierarchy.parent.testId;
        const parentUnique = testIdCount[parentId] === 1;
        
        if (parentUnique) {
          el.selectors.push({
            type: 'chained',
            value: `$('~${parentId}').$('~${el.testId}')`,
            confidence: 0.85,
            unique: true,
            parent: parentId,
            child: el.testId
          });
          el.selectorStrategy = 'chained-parent-child';
        }
      }
      // Strategy 4: Indexed selector for repeated elements
      else if (el.testId && testIdCount[el.testId] > 1) {
        // Find index among elements with same testId
        const sameIdElements = elements.filter(e => e.testId === el.testId);
        const index = sameIdElements.indexOf(el);
        
        el.selectors.push({
          type: 'indexed',
          value: `$$('~${el.testId}')[${index}]`,
          confidence: 0.70,
          unique: false,
          index,
          totalCount: testIdCount[el.testId]
        });
        el.selectorStrategy = 'indexed';
      }
      // Strategy 5: Text-based (Android UiSelector)
      else if (textUnique && el.text && el.text.length < 50) {
        if (this.platform === 'android') {
          el.selectors.push({
            type: 'text',
            value: `android=new UiSelector().text("${el.text.replace(/"/g, '\\"')}")`,
            confidence: 0.75,
            unique: true
          });
        } else {
          el.selectors.push({
            type: 'predicate',
            value: `-ios predicate string:label == "${el.text.replace(/"/g, '\\"')}"`,
            confidence: 0.75,
            unique: true
          });
        }
        el.selectorStrategy = 'text-based';
      }
      // Strategy 6: Fallback - non-unique accessibility ID with warning
      else if (el.testId) {
        el.selectors.push({
          type: 'accessibility',
          value: `~${el.testId}`,
          confidence: 0.40,
          unique: false,
          warning: `Shared by ${testIdCount[el.testId]} elements`
        });
        el.selectorStrategy = 'non-unique-warning';
      }
      // Strategy 7: XPath fallback (least preferred)
      else if (el.text) {
        el.selectors.push({
          type: 'xpath',
          value: `//*[contains(@text, "${el.text.substring(0, 30).replace(/"/g, '\\"')}")]`,
          confidence: 0.30,
          unique: false,
          warning: 'XPath is slow and fragile'
        });
        el.selectorStrategy = 'xpath-fallback';
      }

      // Add uniqueness metadata
      el.uniqueness = {
        testIdUnique,
        ariaLabelUnique,
        textUnique,
        testIdCount: el.testId ? testIdCount[el.testId] : 0,
        ariaLabelCount: el.ariaLabel ? ariaLabelCount[el.ariaLabel] : 0
      };
    }
  }

  /**
   * Recursively extract elements from parsed XML
   * @private
   */
  _extractElements(node, elements, depth = 0) {
    if (!node || typeof node !== 'object') return;

    // Process current node if it has attributes
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('@_') || key === '#text') continue;

      if (Array.isArray(value)) {
        // Multiple elements of same type
        value.forEach(item => this._processNode(key, item, elements, depth));
      } else if (typeof value === 'object') {
        this._processNode(key, value, elements, depth);
      }
    }
  }

  /**
   * Process a single XML node
   * @private
   */
  _processNode(tagName, node, elements, depth) {
    if (!node || typeof node !== 'object') return;

    // Skip non-interactive containers at high depth
    const isContainer = ['hierarchy', 'FrameLayout', 'LinearLayout', 'RelativeLayout', 
                         'ConstraintLayout', 'XCUIElementTypeOther', 'XCUIElementTypeCell'].includes(tagName);
    
    // Extract element if it's interactive or has useful attributes
    const element = this._extractElementData(tagName, node);
    
    if (element && (element.isInteractive || element.text || element.testId || element.ariaLabel)) {
      elements.push(element);
    }

    // Recurse into children
    this._extractElements(node, elements, depth + 1);
  }

  /**
   * Extract structured data from a node
   * @private
   */
  _extractElementData(tagName, node) {
    if (this.platform === 'android') {
      return this._extractAndroidElement(tagName, node);
    } else {
      return this._extractIOSElement(tagName, node);
    }
  }

  /**
   * Extract element data from Android XML
   * @private
   * 
   * Android attributes:
   * - resource-id → testId (e.g., "com.app:id/login_button")
   * - content-desc → ariaLabel (accessibility)
   * - text → visible text
   * - class → element type (android.widget.Button)
   * - clickable, enabled, focusable → interactivity
   * - bounds → position "[0,0][100,50]"
   */
  _extractAndroidElement(tagName, node) {
    const resourceId = node['resource-id'] || '';
    const contentDesc = node['content-desc'] || '';
    const text = node['text'] || '';
    const className = node['class'] || tagName;
    const clickable = node['clickable'] === 'true';
    const enabled = node['enabled'] === 'true';
    const focusable = node['focusable'] === 'true';
    const bounds = node['bounds'] || '';
    const index = node['index'] || '0';
    const packageName = node['package'] || '';

    // Skip if no useful identifiers AND not interactive
    if (!resourceId && !contentDesc && !text && !clickable && !focusable) {
      return null;
    }
    
    // Skip generic containers without identifiers
    if (!resourceId && !contentDesc && !text) {
      const skipClasses = ['android.view.View', 'android.view.ViewGroup', 'android.widget.FrameLayout', 
                          'android.widget.LinearLayout', 'android.widget.RelativeLayout'];
      if (skipClasses.includes(className)) {
        return null;
      }
    }

    // Determine element type from class name
    const type = this._androidClassToType(className);

    // Extract just the ID part from resource-id
    const testId = resourceId.includes('/') 
      ? resourceId.split('/').pop() 
      : resourceId;

    // Determine visibility from bounds
    const isVisible = bounds && bounds !== '[0,0][0,0]';

    return {
      tag: type,
      type,
      role: null,
      text: text.substring(0, 100),
      placeholder: null,
      ariaLabel: contentDesc || null,
      testId: testId || null,
      name: null,
      id: testId || null,
      classes: className,
      href: null,
      alt: null,
      value: text || null,
      inputType: type === 'input' ? 'text' : null,
      isVisible,
      isInteractive: clickable || focusable,
      // Mobile-specific
      bounds: this._parseBounds(bounds),
      enabled,
      platform: 'android'
    };
  }

  /**
   * Extract element data from iOS XML
   * @private
   * 
   * iOS attributes:
   * - name → accessibility identifier / testId
   * - label → accessibility label (visible to screen readers)
   * - value → current value
   * - type → element type (XCUIElementTypeButton)
   * - enabled, visible → state
   * - x, y, width, height → bounds
   */
  _extractIOSElement(tagName, node) {
    const name = node['name'] || '';
    const label = node['label'] || '';
    const value = node['value'] || '';
    const type = node['type'] || tagName;
    const enabled = node['enabled'] === 'true' || node['enabled'] === true;
    const visible = node['visible'] === 'true' || node['visible'] === true;

    // Skip if no useful identifiers
    if (!name && !label && !value) {
      return null;
    }

    // Determine element type
    const normalizedType = this._iosTypeToType(type);

    // Extract bounds
    const bounds = {
      x: parseInt(node['x']) || 0,
      y: parseInt(node['y']) || 0,
      width: parseInt(node['width']) || 0,
      height: parseInt(node['height']) || 0
    };

    const isVisible = visible && bounds.width > 0 && bounds.height > 0;

    return {
      tag: normalizedType,
      type: normalizedType,
      role: null,
      text: (label || value).substring(0, 100),
      placeholder: null,
      ariaLabel: label || null,
      testId: name || null,
      name: name || null,
      id: name || null,
      classes: type,
      href: null,
      alt: null,
      value: value || null,
      inputType: normalizedType === 'input' ? 'text' : null,
      isVisible,
      isInteractive: this._isIOSInteractive(type),
      // Mobile-specific
      bounds,
      enabled,
      platform: 'ios'
    };
  }

  /**
   * Convert Android class name to generic type
   * @private
   */
  _androidClassToType(className) {
    const typeMap = {
      'android.widget.Button': 'button',
      'android.widget.ImageButton': 'button',
      'android.widget.TextView': 'text',
      'android.widget.EditText': 'input',
      'android.widget.CheckBox': 'checkbox',
      'android.widget.RadioButton': 'radio',
      'android.widget.Switch': 'switch',
      'android.widget.ToggleButton': 'switch',
      'android.widget.Spinner': 'select',
      'android.widget.ImageView': 'image',
      'android.widget.SeekBar': 'slider',
      'android.widget.ProgressBar': 'progress',
      'android.widget.ScrollView': 'scroll',
      'android.widget.ListView': 'list',
      'android.widget.RecyclerView': 'list',
      'android.view.View': 'view',
    };

    // Check exact match
    if (typeMap[className]) return typeMap[className];

    // Check partial match
    const lower = className.toLowerCase();
    if (lower.includes('button')) return 'button';
    if (lower.includes('edit') || lower.includes('input')) return 'input';
    if (lower.includes('text')) return 'text';
    if (lower.includes('image')) return 'image';
    if (lower.includes('check')) return 'checkbox';
    if (lower.includes('switch') || lower.includes('toggle')) return 'switch';
    if (lower.includes('list') || lower.includes('recycler')) return 'list';

    return 'view';
  }

  /**
   * Convert iOS type to generic type
   * @private
   */
  _iosTypeToType(type) {
    const typeMap = {
      'XCUIElementTypeButton': 'button',
      'XCUIElementTypeTextField': 'input',
      'XCUIElementTypeSecureTextField': 'input',
      'XCUIElementTypeTextView': 'input',
      'XCUIElementTypeStaticText': 'text',
      'XCUIElementTypeImage': 'image',
      'XCUIElementTypeSwitch': 'switch',
      'XCUIElementTypeSlider': 'slider',
      'XCUIElementTypePicker': 'select',
      'XCUIElementTypePickerWheel': 'select',
      'XCUIElementTypeTable': 'list',
      'XCUIElementTypeCollectionView': 'list',
      'XCUIElementTypeCell': 'listitem',
      'XCUIElementTypeCheckBox': 'checkbox',
      'XCUIElementTypeLink': 'link',
      'XCUIElementTypeNavigationBar': 'nav',
      'XCUIElementTypeTabBar': 'tabbar',
      'XCUIElementTypeToolbar': 'toolbar',
      'XCUIElementTypeSearchField': 'search',
      'XCUIElementTypeScrollView': 'scroll',
      'XCUIElementTypeWebView': 'webview',
      'XCUIElementTypeAlert': 'dialog',
      'XCUIElementTypeSheet': 'dialog',
    };

    if (typeMap[type]) return typeMap[type];

    // Fallback
    const lower = type.toLowerCase();
    if (lower.includes('button')) return 'button';
    if (lower.includes('text') || lower.includes('field')) return 'input';
    if (lower.includes('image')) return 'image';
    if (lower.includes('switch')) return 'switch';

    return 'view';
  }

  /**
   * Check if iOS element type is interactive
   * @private
   */
  _isIOSInteractive(type) {
    const interactiveTypes = [
      'XCUIElementTypeButton',
      'XCUIElementTypeTextField',
      'XCUIElementTypeSecureTextField',
      'XCUIElementTypeTextView',
      'XCUIElementTypeSwitch',
      'XCUIElementTypeSlider',
      'XCUIElementTypePicker',
      'XCUIElementTypePickerWheel',
      'XCUIElementTypeCell',
      'XCUIElementTypeLink',
      'XCUIElementTypeSearchField',
      'XCUIElementTypeSegmentedControl',
      'XCUIElementTypeStepper',
      'XCUIElementTypeDatePicker',
    ];
    return interactiveTypes.includes(type);
  }

  /**
   * Parse Android bounds string "[x1,y1][x2,y2]"
   * @private
   */
  _parseBounds(boundsStr) {
    if (!boundsStr) return null;
    
    const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!match) return null;

    const [, x1, y1, x2, y2] = match.map(Number);
    return {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1
    };
  }

  /**
   * Navigate to a screen/activity (Android) or view controller (iOS)
   * Note: This is app-specific, provided for convenience
   */
  async navigateTo(target) {
    if (!this.isOpen()) {
      throw new Error('No Appium session');
    }

    if (this.platform === 'android') {
      // Android: start activity
      await this.driver.startActivity(
        target.appPackage || this.config.appPackage,
        target.activity
      );
    } else {
      // iOS: deep link or button tap required
      // This is app-specific
      console.log('⚠️ iOS navigation requires app-specific implementation');
    }
  }

  /**
   * Tap at coordinates
   */
  async tap(x, y) {
    if (!this.isOpen()) throw new Error('No Appium session');
    
    await this.driver.touchAction({
      action: 'tap',
      x,
      y
    });
  }

  /**
   * Find element by various strategies
   */
  async findElement(selector) {
    if (!this.isOpen()) throw new Error('No Appium session');

    // Try accessibility id first (cross-platform)
    try {
      return await this.driver.$(`~${selector}`);
    } catch (e) {}

    // Try resource-id (Android)
    if (this.platform === 'android') {
      try {
        return await this.driver.$(`android=new UiSelector().resourceId("${selector}")`);
      } catch (e) {}
    }

    // Try XPath as fallback
    try {
      return await this.driver.$(`//*[contains(@text, "${selector}") or contains(@content-desc, "${selector}") or contains(@label, "${selector}")]`);
    } catch (e) {}

    throw new Error(`Element not found: ${selector}`);
  }

  /**
   * Close Appium session
   */
  async close() {
    if (this.driver) {
      console.log('📱 Closing Appium session...');
      try {
        await this.driver.deleteSession();
      } catch (e) {
        console.log('   ⚠️ Session may already be closed');
      }
      this.driver = null;
    }
  }

  /**
   * Get adapter type
   */
  getAdapterType() {
    return `appium-${this.platform}`;
  }
}

export default AppiumAdapter;