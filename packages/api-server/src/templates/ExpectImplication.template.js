// tests/ai-testing/utils/ExpectImplication.js
// ✅ CROSS-PLATFORM: Playwright + WebdriverIO/Appium support
// ✅ UPDATED: Enhanced variable resolution + ctx.data storage option
// ✅ NEW: Support for methods with index parameters (indexMode)
// 
// CROSS-PLATFORM NOTES:
// - Playwright: .count(), .nth(), .first(), .last(), .all(), toBeVisible()
// - WebdriverIO: Array access, .length, toBeDisplayed(), getText(), getValue()

const { expect } = require('@playwright/test');

class ExpectImplication {
  // ═══════════════════════════════════════════════════════════
  // STORED VALUES - For cross-step data passing (storeAs)
  // ═══════════════════════════════════════════════════════════
  static _capturedValues = {};
  
  /**
   * Store a value for later use
   * @param {string} key - Variable name
   * @param {*} value - Value to store
   * @param {Object} options - Storage options
   * @param {Object} options.testData - If provided, also store in testData for persistence
   * @param {boolean} options.persist - If true and testData provided, value survives test runs
   */
  static storeValue(key, value, options = {}) {
    // Always store in capturedValues (available within current test)
    this._capturedValues[key] = value;
    
    const preview = typeof value === 'object' 
      ? JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? '...' : '')
      : value;
    console.log(`      💾 Stored: ${key} = ${preview}`);
    
    // ✅ Also store in testData if provided (persists via ctx.save())
    if (options.testData && options.persist !== false) {
      options.testData[key] = value;
      console.log(`      💾 Also stored in testData (will persist)`);
    }
  }
  
  static getValue(key) {
    return this._capturedValues[key];
  }
  
  static clearCapturedValues() {
    this._capturedValues = {};
    console.log('🗑️  Cleared captured values');
  }
  
  static getCapturedValues() {
    return { ...this._capturedValues };
  }

  /**
   * Get a random index from 0 to max-1
   * @param {number} max - Upper bound (exclusive)
   * @returns {number} Random index
   */
  static _getRandomIndex(max) {
    const randomIndex = Math.floor(Math.random() * max);
    console.log(`      🎲 Random index: ${randomIndex} (of ${max})`);
    return randomIndex;
  }

  // ═══════════════════════════════════════════════════════════
  // Get nested value - checks captured values first, then obj
  // ✅ ENHANCED: Better array indexing support
  // ═══════════════════════════════════════════════════════════
  static getNestedValue(obj, path) {
    if (!path) return undefined;
    
    // ✅ Handle array indexing in path: "passengers[0].name" → ["passengers", "0", "name"]
    const normalizedPath = path
      .replace(/\[(\d+)\]/g, '.$1')  // Convert [0] to .0
      .replace(/\[["']([^"']+)["']\]/g, '.$1');  // Convert ['key'] to .key
    
    const parts = normalizedPath.split('.').filter(p => p);
    
    if (parts.length === 0) return undefined;
    
    const firstPart = parts[0];
    
    // ✅ Check captured values FIRST (highest priority)
    if (this._capturedValues[firstPart] !== undefined) {
      let current = this._capturedValues[firstPart];
      for (let i = 1; i < parts.length; i++) {
        if (current === null || current === undefined) return undefined;
        current = current[parts[i]];
      }
      if (current !== undefined) {
        return current;
      }
    }
    
    // ✅ Check if the FULL path exists as a captured value
    if (this._capturedValues[path] !== undefined) {
      return this._capturedValues[path];
    }
    
    // ✅ Then check testData/obj
    if (!obj) return undefined;
    
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (!current.hasOwnProperty(part) && !(part in current)) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  // ═══════════════════════════════════════════════════════════
  // Resolve {{variable}} template syntax
  // ✅ ENHANCED: Better error messages + captured values priority
  // ═══════════════════════════════════════════════════════════
  static resolveTemplate(value, testData = {}) {
    if (typeof value !== 'string') {
      if (Array.isArray(value)) {
        return value.map(v => this.resolveTemplate(v, testData));
      }
      if (typeof value === 'object' && value !== null) {
        const resolved = {};
        for (const [k, v] of Object.entries(value)) {
          resolved[k] = this.resolveTemplate(v, testData);
        }
        return resolved;
      }
      return value;
    }
    
    // ✅ Full match: entire value is a single {{variable}}
    const fullMatch = value.match(/^\{\{([^}]+)\}\}$/);
    if (fullMatch) {
      const path = fullMatch[1].trim();
      const result = this.getNestedValue(testData, path);
      
      if (result !== undefined) {
        console.log(`      🔄 Resolved {{${path}}} → ${JSON.stringify(result)}`);
        return result;
      }
      
      // ✅ Enhanced error: show what IS available
      console.warn(`      ⚠️  Variable {{${path}}} not found!`);
      this._logAvailableVariables(testData, path);
      return value; // Return original template if not found
    }
    
    // ✅ Partial match: {{var}} embedded in string
    return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const result = this.getNestedValue(testData, trimmedPath);
      
      if (result === undefined || result === null) {
        console.warn(`      ⚠️  Variable {{${trimmedPath}}} not found`);
        return match; // Keep original if not found
      }
      
      console.log(`      🔄 Resolved {{${trimmedPath}}} → ${result}`);
      return String(result);
    });
  }

  /**
   * ✅ Log available variables when resolution fails
   */
  static _logAvailableVariables(testData, attemptedPath) {
    const available = [];
    
    // From captured values
    const capturedKeys = Object.keys(this._capturedValues);
    if (capturedKeys.length > 0) {
      available.push(`   💾 Captured: ${capturedKeys.slice(0, 10).join(', ')}${capturedKeys.length > 10 ? '...' : ''}`);
    }
    
    // From testData
    if (testData) {
      const dataKeys = Object.keys(testData).filter(k => !k.startsWith('_'));
      if (dataKeys.length > 0) {
        available.push(`   📋 testData: ${dataKeys.slice(0, 10).join(', ')}${dataKeys.length > 10 ? '...' : ''}`);
      }
    }
    
    if (available.length > 0) {
      console.warn(`      📦 Available variables:`);
      available.forEach(line => console.warn(line));
    }
    
    // ✅ Suggest fix
    const baseName = attemptedPath.split('.')[0].split('[')[0];
    if (testData && testData[baseName] !== undefined) {
      console.warn(`      💡 "${baseName}" exists in testData - check the nested path`);
    } else if (this._capturedValues[baseName] !== undefined) {
      console.warn(`      💡 "${baseName}" exists in capturedValues - check the nested path`);
    } else {
      console.warn(`      💡 Make sure "${baseName}" was stored with storeAs in a previous step`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Parse field selector for array indexing
  // ✅ ENHANCED: Support variable indexes like field[{{varName}}]
  // ═══════════════════════════════════════════════════════════
  static _parseFieldSelector(fieldName, testData = {}) {
    if (!fieldName) return { field: fieldName, index: null };
    
    // ✅ Check for variable pattern: field[{{varName}}]
    const varMatch = fieldName.match(/^(.+)\[\{\{([^}]+)\}\}\]$/);
    if (varMatch) {
      const field = varMatch[1];
      const varPath = varMatch[2].trim();
      
      // Resolve the variable to get actual index
      const resolvedIndex = this.getNestedValue(testData, varPath);
      
      if (resolvedIndex === undefined || resolvedIndex === null) {
        console.warn(`      ⚠️ Variable index {{${varPath}}} not found, defaulting to 0`);
        return { field, index: 0, variableIndex: varPath };
      }
      
      const numericIndex = parseInt(resolvedIndex, 10);
      if (isNaN(numericIndex)) {
        console.warn(`      ⚠️ Variable {{${varPath}}} = "${resolvedIndex}" is not a number, defaulting to 0`);
        return { field, index: 0, variableIndex: varPath };
      }
      
      console.log(`      🔄 Resolved {{${varPath}}} → ${numericIndex}`);
      return { field, index: numericIndex, variableIndex: varPath };
    }
    
    // Standard patterns: field[0], field[first], field[last], field[all], field[any]
    const match = fieldName.match(/^(.+)\[(\d+|first|last|all|any)\]$/);
    
    if (!match) {
      return { field: fieldName, index: null };
    }
    
    return {
      field: match[1],
      index: match[2] === 'first' ? 'first'
           : match[2] === 'last' ? 'last' 
           : match[2] === 'all' ? 'all'
           : match[2] === 'any' ? 'any'
           : parseInt(match[2], 10)
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Get locator with index support - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _getLocatorForField(screenObject, fieldName, page, isPlaywright, testData = {}) {
    const { field, index, variableIndex } = this._parseFieldSelector(fieldName, testData);
    
    let baseLocator = screenObject[field];
    
    if (!baseLocator) {
      const available = Object.keys(screenObject).filter(k => 
        !k.startsWith('_') && typeof screenObject[k] !== 'function'
      ).slice(0, 15);
      throw new Error(
        `Field "${field}" not found on screen object.\n` +
        `   Available fields: ${available.join(', ')}${available.length >= 15 ? '...' : ''}`
      );
    }
    
    // ═══════════════════════════════════════════════════════════
    // HANDLE METHODS (functions with index parameters)
    // ═══════════════════════════════════════════════════════════
    if (typeof baseLocator === 'function') {
      const fnLength = baseLocator.length; // Number of expected arguments
      
      // Method with index parameter like title(nth), cardLocation(nth)
      if (fnLength > 0 && index !== null && index !== 'all' && index !== 'any') {
        const actualIndex = (index === 'first') ? 0 
                          : (index === 'last') ? -1  // -1 signals "last" to method
                          : index;
        
        console.log(`      🔧 Calling ${field}(${actualIndex}) as method`);
        const locator = baseLocator.call(screenObject, actualIndex);
        return { locator, mode: 'single', field, index, isMethodCall: true };
      }
      
      // Method with params but [all] or [any] - need special handling
      if (fnLength > 0 && (index === 'all' || index === 'any')) {
        console.log(`      🔧 Method ${field}(nth) with [${index}] mode`);
        
        // Find count locator - could be a getter or a locator
        let countLoc = screenObject[`${field}Generic`] || screenObject['cardGeneric'];
        if (typeof countLoc === 'function' && countLoc.length === 0) {
          countLoc = countLoc.call(screenObject);  // Call the getter
        }
        
        return { 
          locator: null,
          mode: index, 
          field, 
          index,
          isMethodCall: true,
          method: baseLocator.bind(screenObject),
          countLocator: countLoc
        };
      }
      
      // Getter function (no params) - call it to get the locator
      baseLocator = baseLocator.call(screenObject);
    }
    
    // Handle async getters (WebdriverIO returns promises from $/$$ )
    if (baseLocator && typeof baseLocator.then === 'function') {
      baseLocator = await baseLocator;
    }
    
    // ═══════════════════════════════════════════════════════════
    // NO INDEX - Return as-is
    // ═══════════════════════════════════════════════════════════
    if (index === null) {
      return { locator: baseLocator, mode: 'single', field, index };
    }
    
    // ═══════════════════════════════════════════════════════════
    // INDEXED ACCESS - Cross-Platform!
    // ═══════════════════════════════════════════════════════════
    if (isPlaywright) {
      // Playwright: native methods
      if (index === 'first') return { locator: baseLocator.first(), mode: 'single', field, index };
      if (index === 'last') return { locator: baseLocator.last(), mode: 'single', field, index };
      if (index === 'all') return { locator: baseLocator, mode: 'all', field, index };
      if (index === 'any') return { locator: baseLocator, mode: 'any', field, index };
      // Numeric index
      return { locator: baseLocator.nth(index), mode: 'single', field, index };
      
    } else {
      // ═══════════════════════════════════════════════════════════
      // WebdriverIO: Array-based access
      // ═══════════════════════════════════════════════════════════
      let elements = baseLocator;
      
      // WebdriverIO $$ returns an array, $ returns single element
      if (!Array.isArray(elements)) {
        // Check if it's array-like (has length property)
        if (elements && typeof elements.length === 'number' && elements.length > 0) {
          elements = Array.from(elements);
        } else {
          // Single element - can't really index it
          console.log(`      ⚠️ ${field} is single element, ignoring index [${index}]`);
          return { locator: baseLocator, mode: 'single', field, index: null };
        }
      }
      
      if (index === 'first') {
        const element = elements[0];
        if (!element) throw new Error(`${field}[first] - no elements found`);
        return { locator: element, mode: 'single', field, index };
      }
      
      if (index === 'last') {
        const element = elements[elements.length - 1];
        if (!element) throw new Error(`${field}[last] - no elements found`);
        return { locator: element, mode: 'single', field, index };
      }
      
      if (index === 'all') {
        return { locator: elements, mode: 'all', field, index };
      }
      
      if (index === 'any') {
        return { locator: elements, mode: 'any', field, index };
      }
      
      // Numeric index
      if (typeof index === 'number') {
        const element = elements[index];
        if (!element) throw new Error(`${field}[${index}] - index out of bounds (${elements.length} elements)`);
        return { locator: element, mode: 'single', field, index };
      }
    }
    
    return { locator: baseLocator, mode: 'single', field, index };
  }

  // ═══════════════════════════════════════════════════════════
  // Get element count - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _getElementCount(locator, isPlaywright) {
    if (isPlaywright) {
      return await locator.count();
    } else {
      // WebdriverIO
      if (Array.isArray(locator)) {
        return locator.length;
      } else if (locator && typeof locator.length === 'number') {
        return locator.length;
      }
      return locator ? 1 : 0;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Get element at index - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static _getElementAtIndex(locator, index, isPlaywright) {
    if (isPlaywright) {
      return locator.nth(index);
    } else {
      // WebdriverIO - locator should be array
      if (Array.isArray(locator)) {
        return locator[index];
      }
      return locator; // Single element
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Get all elements - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _getAllElements(locator, isPlaywright) {
    if (isPlaywright) {
      return await locator.all();
    } else {
      // WebdriverIO - locator should already be array
      if (Array.isArray(locator)) {
        return locator;
      }
      return [locator];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Check visible with array support - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _checkVisibleWithIndex(screenObject, elementName, page, isPlaywright, testData = {}) {
    const result = await this._getLocatorForField(
      screenObject, elementName, page, isPlaywright, testData
    );
    
    const { locator, mode, field, index, isMethodCall, method, countLocator } = result;
    const indexLabel = index !== null ? `[${index}]` : '';
    
    if (mode === 'single') {
      if (isPlaywright) {
        await expect(locator).toBeVisible({ timeout: 10000 });
      } else {
        // WebdriverIO
        if (!locator) throw new Error(`${field}${indexLabel} - element not found`);
        await expect(locator).toBeDisplayed();
      }
      console.log(`      ✓ ${field}${indexLabel} is visible`);
      
    } else if (mode === 'all') {
      // ═══════════════════════════════════════════════════════════
      // [all] MODE - Check ALL elements are visible
      // ═══════════════════════════════════════════════════════════
      if (isMethodCall && method) {
        // Method-based iteration: title(0), title(1), title(2)...
        let count = 10; // Default
        
        if (countLocator) {
          count = await this._getElementCount(countLocator, isPlaywright);
        }
        
        if (count === 0) throw new Error(`${field}[all] - no elements found`);
        
        console.log(`      🔄 Checking ${count} ${field} elements via method...`);
        for (let i = 0; i < count; i++) {
          const elementLocator = method(i);
          if (isPlaywright) {
            await expect(elementLocator).toBeVisible({ timeout: 10000 });
          } else {
            const el = await elementLocator;
            await expect(el).toBeDisplayed();
          }
        }
        console.log(`      ✓ ${field}[all] - all ${count} elements visible`);
        
      } else {
        // Regular locator-based [all]
        const elements = await this._getAllElements(locator, isPlaywright);
        if (elements.length === 0) throw new Error(`${field}[all] - no elements found`);
        
        for (let i = 0; i < elements.length; i++) {
          if (isPlaywright) {
            await expect(elements[i]).toBeVisible({ timeout: 10000 });
          } else {
            await expect(elements[i]).toBeDisplayed();
          }
        }
        console.log(`      ✓ ${field}[all] - all ${elements.length} elements visible`);
      }
      
    } else if (mode === 'any') {
      // ═══════════════════════════════════════════════════════════
      // [any] MODE - Check random element is visible
      // ═══════════════════════════════════════════════════════════
      if (isMethodCall && method) {
        let count = 10;
        if (countLocator) {
          count = await this._getElementCount(countLocator, isPlaywright);
        }
        
        if (count === 0) throw new Error(`${field}[any] - no elements found`);
        
        const randomIdx = this._getRandomIndex(count);
        const elementLocator = method(randomIdx);
        
        if (isPlaywright) {
          await expect(elementLocator).toBeVisible({ timeout: 10000 });
        } else {
          const el = await elementLocator;
          await expect(el).toBeDisplayed();
        }
        console.log(`      ✓ ${field}[any] - element ${randomIdx} (of ${count}) visible`);
        
      } else {
        const count = await this._getElementCount(locator, isPlaywright);
        if (count === 0) throw new Error(`${field}[any] - no elements found`);
        
        const randomIdx = this._getRandomIndex(count);
        const element = this._getElementAtIndex(locator, randomIdx, isPlaywright);
        
        if (isPlaywright) {
          await expect(element).toBeVisible({ timeout: 10000 });
        } else {
          await expect(element).toBeDisplayed();
        }
        console.log(`      ✓ ${field}[any] - element ${randomIdx} (of ${count}) visible`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Check hidden with array support - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _checkHiddenWithIndex(screenObject, elementName, page, isPlaywright, testData = {}) {
    const result = await this._getLocatorForField(
      screenObject, elementName, page, isPlaywright, testData
    );
    
    const { locator, mode, field, index, isMethodCall, method, countLocator } = result;
    const indexLabel = index !== null ? `[${index}]` : '';
    
    if (mode === 'single') {
      if (isPlaywright) {
        const count = await locator.count();
        if (count === 0) {
          console.log(`      ✓ ${field}${indexLabel} doesn't exist (counts as hidden)`);
          return;
        }
        await expect(locator).not.toBeVisible();
      } else {
        // WebdriverIO
        if (!locator) {
          console.log(`      ✓ ${field}${indexLabel} doesn't exist (counts as hidden)`);
          return;
        }
        const exists = await locator.isExisting();
        if (!exists) {
          console.log(`      ✓ ${field}${indexLabel} doesn't exist (counts as hidden)`);
          return;
        }
        await expect(locator).not.toBeDisplayed();
      }
      console.log(`      ✓ ${field}${indexLabel} is hidden`);
      
    } else if (mode === 'all') {
      // ═══════════════════════════════════════════════════════════
      // [all] MODE - Check ALL elements are hidden
      // ═══════════════════════════════════════════════════════════
      if (isMethodCall && method) {
        let count = 10;
        if (countLocator) {
          count = await this._getElementCount(countLocator, isPlaywright);
        }
        
        if (count === 0) {
          console.log(`      ✓ ${field}[all] - no elements exist (counts as hidden)`);
          return;
        }
        
        console.log(`      🔄 Checking ${count} ${field} elements are hidden via method...`);
        for (let i = 0; i < count; i++) {
          const elementLocator = method(i);
          if (isPlaywright) {
            await expect(elementLocator).not.toBeVisible();
          } else {
            const el = await elementLocator;
            const exists = await el.isExisting();
            if (exists) {
              await expect(el).not.toBeDisplayed();
            }
          }
        }
        console.log(`      ✓ ${field}[all] - all ${count} elements are hidden`);
        
      } else {
        const elements = await this._getAllElements(locator, isPlaywright);
        if (elements.length === 0) {
          console.log(`      ✓ ${field}[all] - no elements exist (counts as hidden)`);
          return;
        }
        
        for (let i = 0; i < elements.length; i++) {
          if (isPlaywright) {
            await expect(elements[i]).not.toBeVisible();
          } else {
            const exists = await elements[i].isExisting();
            if (exists) {
              await expect(elements[i]).not.toBeDisplayed();
            }
          }
        }
        console.log(`      ✓ ${field}[all] - all ${elements.length} elements are hidden`);
      }
      
    } else if (mode === 'any') {
      // ═══════════════════════════════════════════════════════════
      // [any] MODE - Check random element is hidden
      // ═══════════════════════════════════════════════════════════
      if (isMethodCall && method) {
        let count = 10;
        if (countLocator) {
          count = await this._getElementCount(countLocator, isPlaywright);
        }
        
        if (count === 0) {
          console.log(`      ✓ ${field}[any] - no elements exist (counts as hidden)`);
          return;
        }
        
        const randomIdx = this._getRandomIndex(count);
        const elementLocator = method(randomIdx);
        
        if (isPlaywright) {
          await expect(elementLocator).not.toBeVisible();
        } else {
          const el = await elementLocator;
          const exists = await el.isExisting();
          if (!exists) {
            console.log(`      ✓ ${field}[any] - element ${randomIdx} doesn't exist (counts as hidden)`);
            return;
          }
          await expect(el).not.toBeDisplayed();
        }
        console.log(`      ✓ ${field}[any] - element ${randomIdx} (of ${count}) is hidden`);
        
      } else {
        const count = await this._getElementCount(locator, isPlaywright);
        if (count === 0) {
          console.log(`      ✓ ${field}[any] - no elements exist (counts as hidden)`);
          return;
        }
        
        const randomIdx = this._getRandomIndex(count);
        const element = this._getElementAtIndex(locator, randomIdx, isPlaywright);
        
        if (isPlaywright) {
          await expect(element).not.toBeVisible();
        } else {
          const exists = await element.isExisting();
          if (!exists) {
            console.log(`      ✓ ${field}[any] - element ${randomIdx} doesn't exist (counts as hidden)`);
            return;
          }
          await expect(element).not.toBeDisplayed();
        }
        console.log(`      ✓ ${field}[any] - element ${randomIdx} (of ${count}) is hidden`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Boolean function checks
  // ═══════════════════════════════════════════════════════════
  static async _checkTruthy(screenObject, functionName) {
    if (typeof screenObject[functionName] !== 'function') {
      throw new Error(`"${functionName}" is not a function on screen object`);
    }
    
    const result = await screenObject[functionName]();
    expect(result, `Expected ${functionName}() to be truthy, got: ${result}`).toBeTruthy();
    console.log(`      ✓ ${functionName}() is truthy (returned: ${result})`);
  }

  static async _checkFalsy(screenObject, functionName) {
    if (typeof screenObject[functionName] !== 'function') {
      throw new Error(`"${functionName}" is not a function on screen object`);
    }
    
    const result = await screenObject[functionName]();
    expect(result, `Expected ${functionName}() to be falsy, got: ${result}`).toBeFalsy();
    console.log(`      ✓ ${functionName}() is falsy (returned: ${result})`);
  }

  // ═══════════════════════════════════════════════════════════
  // Get method element count for indexed methods
  // ═══════════════════════════════════════════════════════════
  static async _getMethodElementCount(screenObject, methodName, isPlaywright) {
    // Common patterns for count methods
    const countMethodPatterns = [
      `${methodName}Count`,
      `get${methodName.charAt(0).toUpperCase() + methodName.slice(1)}Count`,
      `count${methodName.charAt(0).toUpperCase() + methodName.slice(1)}s`,
      `${methodName}sCount`,
    ];
    
    // Try to find a count method
    for (const countMethod of countMethodPatterns) {
      if (typeof screenObject[countMethod] === 'function') {
        const count = await screenObject[countMethod]();
        console.log(`      📊 Found count via ${countMethod}() → ${count}`);
        return count;
      }
    }
    
    // Try generic locator
    const genericLocator = screenObject[`${methodName}Generic`] || 
                          screenObject[`${methodName}s`] || 
                          screenObject[`all${methodName.charAt(0).toUpperCase() + methodName.slice(1)}s`];
    
    if (genericLocator) {
      const loc = typeof genericLocator === 'function' ? await genericLocator.call(screenObject) : genericLocator;
      if (loc) {
        const count = await this._getElementCount(loc, isPlaywright);
        console.log(`      📊 Found count via ${methodName} generic locator → ${count}`);
        return count;
      }
    }
    
    console.warn(`      ⚠️  Could not determine count for ${methodName}. Using default of 10.`);
    return 10;
  }

  // ═══════════════════════════════════════════════════════════
  // Run expectation on a locator - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _runExpectation(locator, expectType, resolvedValue, label, isPlaywright) {
    let result;

    switch (expectType) {
      // ═══════════════════════════════════════════════════════════
      // VALUE GETTERS
      // ═══════════════════════════════════════════════════════════
      case 'getValue': {
        if (isPlaywright) {
          result = await locator.inputValue();
        } else {
          result = await locator.getValue();
        }
        console.log(`         📝 ${label} getValue → "${result}"`);
        break;
      }
      
      case 'getText': {
        if (isPlaywright) {
          result = await locator.textContent();
        } else {
          result = await locator.getText();
        }
        console.log(`         📝 ${label} getText → "${result}"`);
        break;
      }
      
      case 'getCount': {
        result = await this._getElementCount(locator, isPlaywright);
        console.log(`         📝 ${label} getCount → ${result}`);
        break;
      }
      
      case 'getAttribute': {
        result = await locator.getAttribute(String(resolvedValue));
        console.log(`         📝 ${label} getAttribute("${resolvedValue}") → "${result}"`);
        break;
      }

      // ═══════════════════════════════════════════════════════════
      // BOOLEAN CHECKS
      // ═══════════════════════════════════════════════════════════
      case 'isVisible': {
        if (isPlaywright) {
          result = await locator.isVisible();
        } else {
          result = await locator.isDisplayed();
        }
        console.log(`         ${result ? '✅' : '❌'} ${label} isVisible → ${result}`);
        break;
      }
      
      case 'isEnabled': {
        result = await locator.isEnabled();
        console.log(`         ${result ? '✅' : '❌'} ${label} isEnabled → ${result}`);
        break;
      }
      
      case 'isChecked': {
        if (isPlaywright) {
          result = await locator.isChecked();
        } else {
          result = await locator.isSelected();
        }
        console.log(`         ${result ? '✅' : '❌'} ${label} isChecked → ${result}`);
        break;
      }
      
      case 'hasText': {
        let actualText;
        if (isPlaywright) {
          actualText = await locator.textContent();
        } else {
          actualText = await locator.getText();
        }
        result = actualText && actualText.includes(String(resolvedValue));
        console.log(`         ${result ? '✅' : '❌'} ${label} hasText("${resolvedValue}") → ${result}`);
        break;
      }

      // ═══════════════════════════════════════════════════════════
      // PLAYWRIGHT-SPECIFIC ASSERTIONS (with WDIO fallbacks)
      // ═══════════════════════════════════════════════════════════
      case 'toBeVisible': {
        if (isPlaywright) {
          await expect(locator).toBeVisible({ timeout: 10000 });
        } else {
          await expect(locator).toBeDisplayed();
        }
        result = true;
        console.log(`         ✓ ${label} toBeVisible`);
        break;
      }
      
      case 'toBeHidden': {
        if (isPlaywright) {
          await expect(locator).not.toBeVisible();
        } else {
          const exists = await locator.isExisting();
          if (exists) {
            await expect(locator).not.toBeDisplayed();
          }
        }
        result = true;
        console.log(`         ✓ ${label} toBeHidden`);
        break;
      }

      case 'toContainText': {
        if (isPlaywright) {
          await expect(locator).toContainText(String(resolvedValue), { timeout: 10000 });
        } else {
          const text = await locator.getText();
          expect(text).toContain(String(resolvedValue));
        }
        result = true;
        console.log(`         ✓ ${label} toContainText("${resolvedValue}")`);
        break;
      }

      case 'toHaveText': {
        if (isPlaywright) {
          await expect(locator).toHaveText(String(resolvedValue), { timeout: 10000 });
        } else {
          const text = await locator.getText();
          expect(text).toBe(String(resolvedValue));
        }
        result = true;
        console.log(`         ✓ ${label} toHaveText("${resolvedValue}")`);
        break;
      }

      // ═══════════════════════════════════════════════════════════
      // STANDARD VALUE ASSERTIONS
      // ═══════════════════════════════════════════════════════════
      case 'toBe':
      case 'equals': {
        let actualValue;
        if (isPlaywright) {
          actualValue = await locator.textContent();
        } else {
          actualValue = await locator.getText();
        }
        expect(actualValue).toBe(resolvedValue);
        result = true;
        console.log(`         ✓ ${label} toBe "${resolvedValue}"`);
        break;
      }

      case 'toContain': {
        let actualValue;
        if (isPlaywright) {
          actualValue = await locator.textContent();
        } else {
          actualValue = await locator.getText();
        }
        expect(actualValue).toContain(resolvedValue);
        result = true;
        console.log(`         ✓ ${label} contains "${resolvedValue}"`);
        break;
      }

      case 'toMatch': {
        let actualValue;
        if (isPlaywright) {
          actualValue = await locator.textContent();
        } else {
          actualValue = await locator.getText();
        }
        expect(actualValue).toMatch(resolvedValue);
        result = true;
        console.log(`         ✓ ${label} matches "${resolvedValue}"`);
        break;
      }

      case 'toBeTruthy': {
        let actualValue;
        if (isPlaywright) {
          actualValue = await locator.textContent();
        } else {
          actualValue = await locator.getText();
        }
        expect(actualValue).toBeTruthy();
        result = true;
        console.log(`         ✓ ${label} is truthy`);
        break;
      }

      case 'toBeFalsy': {
        let actualValue;
        if (isPlaywright) {
          actualValue = await locator.textContent();
        } else {
          actualValue = await locator.getText();
        }
        expect(actualValue).toBeFalsy();
        result = true;
        console.log(`         ✓ ${label} is falsy`);
        break;
      }

      default:
        throw new Error(`Unknown expectation type for indexed method: ${expectType}`);
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // Handle assertions for methods with indexMode
  // ═══════════════════════════════════════════════════════════
  static async _checkAssertionWithIndexMode(screenObject, assertion, testData = {}) {
    const isPlaywright = screenObject.page !== undefined;
    
    const { 
      fn, 
      type,
      expect: expectType, 
      value, 
      args = [],
      storeAs, 
      persistStoreAs = true,
      indexMode,
      customIndex,
      indexParamName = 'nth'
    } = assertion;

    // Parse the fn to extract base method name and index notation
    const { field: methodName, index: parsedIndex } = this._parseFieldSelector(fn);
    
    // Determine the actual index mode
    const actualIndexMode = indexMode || parsedIndex;
    
    if (!actualIndexMode) {
      return this._checkAssertion(screenObject, assertion, testData);
    }

    const method = screenObject[methodName];
    if (typeof method !== 'function') {
      throw new Error(`"${methodName}" is not a function on screen object`);
    }

    const resolvedArgs = this.resolveTemplate(args, testData);
    const resolvedValue = this.resolveTemplate(value, testData);

    console.log(`      🔢 Index mode: ${methodName}[${actualIndexMode}]`);

    // Helper to run assertion for a single index
    const runForIndex = async (idx) => {
      const fullArgs = [idx, ...resolvedArgs];
      const locator = await method.call(screenObject, ...fullArgs);
      return this._runExpectation(locator, expectType, resolvedValue, `${methodName}(${idx})`, isPlaywright);
    };

    let results = [];

    switch (actualIndexMode) {
      case 'first': {
        const result = await runForIndex(0);
        results = [result];
        console.log(`      ✓ ${methodName}[first] → ${methodName}(0) ${expectType}`);
        break;
      }

      case 'last': {
        const count = await this._getMethodElementCount(screenObject, methodName, isPlaywright);
        const lastIdx = Math.max(0, count - 1);
        const result = await runForIndex(lastIdx);
        results = [result];
        console.log(`      ✓ ${methodName}[last] → ${methodName}(${lastIdx}) ${expectType}`);
        break;
      }

      case 'any': {
        const count = await this._getMethodElementCount(screenObject, methodName, isPlaywright);
        if (count === 0) {
          throw new Error(`${methodName}[any] - no elements found`);
        }
        const randomIdx = this._getRandomIndex(count);
        const result = await runForIndex(randomIdx);
        results = [result];
        console.log(`      ✓ ${methodName}[any] → ${methodName}(${randomIdx}) of ${count} ${expectType}`);
        break;
      }

      case 'all': {
        const count = await this._getMethodElementCount(screenObject, methodName, isPlaywright);
        if (count === 0) {
          throw new Error(`${methodName}[all] - no elements found`);
        }
        console.log(`      🔄 Checking all ${count} ${methodName} elements...`);
        for (let i = 0; i < count; i++) {
          const result = await runForIndex(i);
          results.push(result);
        }
        console.log(`      ✓ ${methodName}[all] - all ${count} elements passed ${expectType}`);
        break;
      }

      default: {
        const idx = typeof actualIndexMode === 'number' 
          ? actualIndexMode 
          : parseInt(customIndex || actualIndexMode, 10);
        const result = await runForIndex(idx);
        results = [result];
        console.log(`      ✓ ${methodName}[${idx}] ${expectType}`);
        break;
      }
    }

    // Store result if requested
    if (storeAs) {
      const valueToStore = results.length === 1 ? results[0] : results;
      this.storeValue(storeAs, valueToStore, {
        testData: persistStoreAs ? testData : null,
        persist: persistStoreAs
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // Advanced assertions with storeAs support - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _checkAssertion(screenObject, assertion, testData = {}) {
    const isPlaywright = screenObject.page !== undefined;
    
    // Check if this is a method with indexMode
    const { fn, type, indexMode } = assertion;
    const { index: parsedIndex } = this._parseFieldSelector(fn);
    
    // If it's a method with index mode, use the special handler
    if (type === 'method' && (indexMode || parsedIndex)) {
      return this._checkAssertionWithIndexMode(screenObject, assertion, testData);
    }

    // Handle locator-type assertions
    if (type === 'locator') {
      return this._checkLocatorAssertion(screenObject, assertion, testData);
    }

    const { expect: expectType, value, params = {}, args = [], storeAs, persistStoreAs = true } = assertion;
    const { field: fnName } = this._parseFieldSelector(fn);

    if (typeof screenObject[fnName] !== 'function') {
      throw new Error(`"${fnName}" is not a function on screen object`);
    }
    
    const resolvedParams = this.resolveTemplate(
      Object.keys(params).length > 0 ? params : {},
      testData
    );
    const resolvedArgs = this.resolveTemplate(args, testData);
    const paramValues = Object.keys(resolvedParams).length > 0 
      ? Object.values(resolvedParams)
      : resolvedArgs;
    const resolvedValue = this.resolveTemplate(value, testData);
    
    let result;
    let passed = true;
    
    try {
      switch (expectType) {
        // ═══════════════════════════════════════════════════════════
        // VALUE GETTERS - CROSS-PLATFORM
        // ═══════════════════════════════════════════════════════════
        case 'getValue': {
          const element = paramValues.length > 0
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          if (isPlaywright) {
            result = await element.inputValue();
          } else {
            result = await element.getValue();
          }
          console.log(`      📝 ${fnName}() getValue → "${result}"`);
          break;
        }
        
        case 'getText': {
          const element = paramValues.length > 0
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          if (isPlaywright) {
            result = await element.textContent();
          } else {
            result = await element.getText();
          }
          console.log(`      📝 ${fnName}() getText → "${result}"`);
          break;
        }
        
        case 'getCount': {
          const element = paramValues.length > 0
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          result = await this._getElementCount(element, isPlaywright);
          console.log(`      📝 ${fnName}() getCount → ${result}`);
          break;
        }
        
        case 'getAttribute': {
          const element = paramValues.length > 0
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          result = await element.getAttribute(String(resolvedValue));
          console.log(`      📝 ${fnName}() getAttribute("${resolvedValue}") → "${result}"`);
          break;
        }
        
        // ═══════════════════════════════════════════════════════════
        // BOOLEAN CHECKS - CROSS-PLATFORM
        // ═══════════════════════════════════════════════════════════
        case 'isVisible': {
          const element = paramValues.length > 0
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          if (isPlaywright) {
            result = await element.isVisible();
          } else {
            result = await element.isDisplayed();
          }
          console.log(`      ${result ? '✅' : '❌'} ${fnName}() isVisible → ${result}`);
          break;
        }
        
        case 'isEnabled': {
          const element = paramValues.length > 0
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          result = await element.isEnabled();
          console.log(`      ${result ? '✅' : '❌'} ${fnName}() isEnabled → ${result}`);
          break;
        }
        
        case 'isChecked': {
          const element = paramValues.length > 0
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          if (isPlaywright) {
            result = await element.isChecked();
          } else {
            result = await element.isSelected();
          }
          console.log(`      ${result ? '✅' : '❌'} ${fnName}() isChecked → ${result}`);
          break;
        }
        
        case 'hasText': {
          const element = paramValues.length > 0
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          let actualText;
          if (isPlaywright) {
            actualText = await element.textContent();
          } else {
            actualText = await element.getText();
          }
          result = actualText && actualText.includes(String(resolvedValue));
          console.log(`      ${result ? '✅' : '❌'} ${fnName}() hasText("${resolvedValue}") → ${result}`);
          break;
        }
        
        // ═══════════════════════════════════════════════════════════
        // STANDARD ASSERTIONS
        // ═══════════════════════════════════════════════════════════
        case 'toBe':
        case 'equals': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBe(resolvedValue);
          result = true;
          console.log(`      ✓ ${fnName}() toBe ${resolvedValue} (got: ${fnResult})`);
          break;
        }
        
        case 'toEqual': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toEqual(resolvedValue);
          result = true;
          console.log(`      ✓ ${fnName}() toEqual ${JSON.stringify(resolvedValue)}`);
          break;
        }
        
        case 'toContain': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toContain(resolvedValue);
          result = true;
          console.log(`      ✓ ${fnName}() contains "${resolvedValue}"`);
          break;
        }

        case 'toContainText': {
          const element = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          if (isPlaywright) {
            await expect(element).toContainText(String(resolvedValue), { timeout: 10000 });
          } else {
            const text = await element.getText();
            expect(text).toContain(String(resolvedValue));
          }
          result = true;
          console.log(`      ✓ ${fnName}() toContainText "${resolvedValue}"`);
          break;
        }
        
        case 'toMatch': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toMatch(resolvedValue);
          result = true;
          console.log(`      ✓ ${fnName}() matches "${resolvedValue}"`);
          break;
        }
        
        case 'toBeTruthy': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBeTruthy();
          result = true;
          console.log(`      ✓ ${fnName}() is truthy (got: ${fnResult})`);
          break;
        }
        
        case 'toBeFalsy': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBeFalsy();
          result = true;
          console.log(`      ✓ ${fnName}() is falsy (got: ${fnResult})`);
          break;
        }
        
        case 'toBeGreaterThan': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBeGreaterThan(resolvedValue);
          result = true;
          console.log(`      ✓ ${fnName}() > ${resolvedValue} (got: ${fnResult})`);
          break;
        }

        case 'toBeGreaterThanOrEqual': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBeGreaterThanOrEqual(resolvedValue);
          result = true;
          console.log(`      ✓ ${fnName}() >= ${resolvedValue} (got: ${fnResult})`);
          break;
        }
        
        case 'toBeLessThan': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBeLessThan(resolvedValue);
          result = true;
          console.log(`      ✓ ${fnName}() < ${resolvedValue} (got: ${fnResult})`);
          break;
        }

        case 'toBeLessThanOrEqual': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBeLessThanOrEqual(resolvedValue);
          result = true;
          console.log(`      ✓ ${fnName}() <= ${resolvedValue} (got: ${fnResult})`);
          break;
        }
        
        case 'toHaveLength': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toHaveLength(resolvedValue);
          result = true;
          console.log(`      ✓ ${fnName}() has length ${resolvedValue}`);
          break;
        }
        
        case 'toBeDefined': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBeDefined();
          result = true;
          console.log(`      ✓ ${fnName}() is defined (got: ${fnResult})`);
          break;
        }

        case 'toBeUndefined': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBeUndefined();
          result = true;
          console.log(`      ✓ ${fnName}() is undefined`);
          break;
        }

        case 'toBeNull': {
          const fnResult = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          expect(fnResult).toBeNull();
          result = true;
          console.log(`      ✓ ${fnName}() is null`);
          break;
        }

        case 'toBeVisible': {
          const element = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          if (isPlaywright) {
            await expect(element).toBeVisible({ timeout: 10000 });
          } else {
            await expect(element).toBeDisplayed();
          }
          result = true;
          console.log(`      ✓ ${fnName}() toBeVisible`);
          break;
        }

        case 'toBeHidden': {
          const element = paramValues.length > 0 
            ? await screenObject[fnName](...paramValues)
            : await screenObject[fnName]();
          
          if (isPlaywright) {
            await expect(element).not.toBeVisible();
          } else {
            const exists = await element.isExisting();
            if (exists) {
              await expect(element).not.toBeDisplayed();
            }
          }
          result = true;
          console.log(`      ✓ ${fnName}() toBeHidden`);
          break;
        }
        
        default:
          throw new Error(`Unknown assertion type: ${expectType}`);
      }
      
    } catch (error) {
      passed = false;
      result = false;
      
      const isGetter = ['getValue', 'getText', 'getCount', 'getAttribute'].includes(expectType);
      if (isGetter) {
        console.error(`      ❌ ${fnName}() ${expectType} failed: ${error.message}`);
        throw error;
      }
      
      const isBooleanCheck = ['isVisible', 'isEnabled', 'isChecked', 'hasText'].includes(expectType);
      if (isBooleanCheck && storeAs) {
        console.log(`      ⚠️ ${fnName}() ${expectType} → false (will store)`);
      } else if (!storeAs) {
        console.error(`      ❌ ${fnName}() ${expectType} failed: ${error.message}`);
        throw error;
      } else {
        console.log(`      ⚠️ ${fnName}() ${expectType} failed (storing false): ${error.message}`);
      }
    }
    
    // Store result if storeAs specified
    if (storeAs) {
      this.storeValue(storeAs, result, { 
        testData: persistStoreAs ? testData : null,
        persist: persistStoreAs 
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Handle locator-type assertions - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _checkLocatorAssertion(screenObject, assertion, testData = {}) {
    const isPlaywright = screenObject.page !== undefined;
    const page = screenObject.page || screenObject;
    
    const { fn, expect: expectType, value, storeAs, persistStoreAs = true } = assertion;
    const { field, index } = this._parseFieldSelector(fn);
    
    // Get locator
    let locator = screenObject[field];
    if (!locator) {
      throw new Error(`Locator "${field}" not found on screen object`);
    }
    
    // Handle getter functions
    if (typeof locator === 'function') {
      locator = locator.call(screenObject);
    }
    
    // Handle async
    if (locator && typeof locator.then === 'function') {
      locator = await locator;
    }
    
    // Apply index
    if (index === 'first') {
      locator = isPlaywright ? locator.first() : (Array.isArray(locator) ? locator[0] : locator);
    } else if (index === 'last') {
      locator = isPlaywright ? locator.last() : (Array.isArray(locator) ? locator[locator.length - 1] : locator);
    } else if (index === 'all') {
      return this._checkLocatorAssertionForAll(screenObject, locator, assertion, testData, field, isPlaywright);
    } else if (index === 'any') {
      const count = await this._getElementCount(locator, isPlaywright);
      if (count === 0) {
        throw new Error(`${field}[any] - no elements found`);
      }
      const randomIdx = this._getRandomIndex(count);
      locator = this._getElementAtIndex(locator, randomIdx, isPlaywright);
    } else if (typeof index === 'number') {
      locator = this._getElementAtIndex(locator, index, isPlaywright);
    }
    
    const resolvedValue = this.resolveTemplate(value, testData);
    const indexLabel = index !== null ? `[${index}]` : '';
    
    const result = await this._runExpectation(locator, expectType, resolvedValue, `${field}${indexLabel}`, isPlaywright);
    
    if (storeAs) {
      this.storeValue(storeAs, result, {
        testData: persistStoreAs ? testData : null,
        persist: persistStoreAs
      });
    }
    
    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // Handle [all] index for locator assertions - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _checkLocatorAssertionForAll(screenObject, locator, assertion, testData, field, isPlaywright) {
    const { expect: expectType, value, storeAs, persistStoreAs = true } = assertion;
    const resolvedValue = this.resolveTemplate(value, testData);
    
    const elements = await this._getAllElements(locator, isPlaywright);
    if (elements.length === 0) {
      throw new Error(`${field}[all] - no elements found`);
    }
    
    console.log(`      🔄 Checking all ${elements.length} ${field} elements...`);
    
    const results = [];
    for (let i = 0; i < elements.length; i++) {
      const result = await this._runExpectation(
        elements[i], 
        expectType, 
        resolvedValue, 
        `${field}[${i}]`,
        isPlaywright
      );
      results.push(result);
    }
    
    console.log(`      ✓ ${field}[all] - all ${elements.length} elements passed ${expectType}`);
    
    if (storeAs) {
      this.storeValue(storeAs, results, {
        testData: persistStoreAs ? testData : null,
        persist: persistStoreAs
      });
    }
    
    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // Execute functions with storeAs support
  // ═══════════════════════════════════════════════════════════
  static async _executeFunctions(functions, screenObject, testData = {}) {
    if (!functions || Object.keys(functions).length === 0) return;
    
    console.log(`   ⚡ Executing ${Object.keys(functions).length} function(s)...`);
    
    for (const [funcName, funcConfig] of Object.entries(functions)) {
      try {
        const { parameters = {}, params = {}, storeAs, persistStoreAs = true, signature } = funcConfig;
        const funcParams = Object.keys(parameters).length > 0 ? parameters : params;
        
        const fn = screenObject[funcName];
        if (typeof fn !== 'function') {
          console.warn(`      ⚠️  Function ${funcName} not found, skipping...`);
          continue;
        }
        
        const resolvedParams = this.resolveTemplate(funcParams, testData);
        const paramValues = Object.values(resolvedParams);
        
        console.log(`      ▶ ${signature || funcName}(${paramValues.map(v => JSON.stringify(v)).join(', ')})`);
        
        const result = paramValues.length > 0
          ? await fn.call(screenObject, ...paramValues)
          : await fn.call(screenObject);
        
        if (storeAs) {
          this.storeValue(storeAs, result, {
            testData: persistStoreAs ? testData : null,
            persist: persistStoreAs
          });
        } else {
          console.log(`      ✅ ${funcName} completed`);
        }
      } catch (error) {
        console.error(`      ❌ ${funcName} failed: ${error.message}`);
        throw error;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // BLOCK-AWARE VALIDATION
  // ═══════════════════════════════════════════════════════════
  
  static async validateImplications(screenDef, testData, screenObject) {
    if (!screenDef || (Array.isArray(screenDef) && screenDef.length === 0)) {
      console.log('   ⚠️  No screen definition to validate');
      return;
    }
    
    const def = Array.isArray(screenDef) ? screenDef[0] : screenDef;
    
    // Check for blocks array - process in order!
    if (def.blocks && Array.isArray(def.blocks) && def.blocks.length > 0) {
      console.log(`\n   🧱 Block-based validation (${def.blocks.length} blocks)`);
      console.log('   ' + '─'.repeat(47));
      return this._validateBlocks(def.blocks, testData, screenObject, def);
    }
    
    // Legacy format
    console.log(`\n   🔍 Validating screen: ${def.name || 'unnamed'} (legacy format)`);
    console.log('   ' + '─'.repeat(47));
    return this._validateLegacy(def, testData, screenObject);
  }

  static async _validateBlocks(blocks, testData, screenObject, screenDef) {
    const isPlaywright = screenObject.page !== undefined;
    const page = screenObject.page || screenObject;
    
    const sortedBlocks = [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    console.log(`   Processing ${sortedBlocks.length} blocks in order...\n`);
    
    for (let i = 0; i < sortedBlocks.length; i++) {
      const block = sortedBlocks[i];
      
      if (block.enabled === false) {
        console.log(`   ⏭️  [${i}] Skipping disabled: ${block.label}`);
        continue;
      }
      
      console.log(`   📦 [${i}] ${block.type}: ${block.label}`);
      
      try {
        switch (block.type) {
          case 'ui-assertion':
            await this._executeUIAssertionBlock(block, testData, screenObject, page, isPlaywright);
            break;
            
          case 'custom-code':
            await this._executeCustomCodeBlock(block, testData, screenObject, page);
            break;
            
          case 'function-call':
            await this._executeFunctionCallBlock(block, testData, screenObject);
            break;

          case 'data-assertion':
            await this._executeDataAssertionBlock(block, testData, screenObject);
            break;
            
          default:
            console.warn(`      ⚠️  Unknown block type: ${block.type}`);
        }
        
        console.log(`      ✅ Block passed\n`);
        
      } catch (error) {
        console.error(`      ❌ Block failed: ${error.message}\n`);
        throw error;
      }
    }
    
    console.log(`   ✅ All ${sortedBlocks.length} blocks validated`);
    console.log('   ' + '─'.repeat(47));
  }

  // ═══════════════════════════════════════════════════════════
  // Execute UI Assertion block - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _executeUIAssertionBlock(block, testData, screenObject, page, isPlaywright) {
    const data = block.data || {};
    
    // Visible checks
    if (data.visible && data.visible.length > 0) {
      console.log(`      ✅ Checking ${data.visible.length} visible...`);
      for (const elementName of data.visible) {
        await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright, testData);
      }
    }
    
    // Hidden checks
    if (data.hidden && data.hidden.length > 0) {
      console.log(`      ❌ Checking ${data.hidden.length} hidden...`);
      for (const elementName of data.hidden) {
        await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright, testData);
      }
    }
    
    // Text checks (exact) - CROSS-PLATFORM with [all]/[any] support
    const textChecks = data.checks?.text || {};
    if (Object.keys(textChecks).length > 0) {
      console.log(`      📝 Checking ${Object.keys(textChecks).length} exact text...`);
      for (const [elementName, expectedText] of Object.entries(textChecks)) {
        const result = await this._getLocatorForField(screenObject, elementName, page, isPlaywright, testData);
        const { locator, mode, field, index, isMethodCall, method, countLocator } = result;
        const resolved = this.resolveTemplate(expectedText, testData);
        
        if (mode === 'all') {
          // Handle method-based [all]
          if (isMethodCall && method) {
            let count = 10;
            if (countLocator) {
              count = await this._getElementCount(countLocator, isPlaywright);
            }
            if (count === 0) {
              throw new Error(`${field}[all] - no elements found for text check`);
            }
            console.log(`      🔄 Checking ${count} ${field} elements have text "${resolved}" via method...`);
            for (let i = 0; i < count; i++) {
              const elementLocator = method(i);
              if (isPlaywright) {
                await expect(elementLocator).toHaveText(String(resolved), { timeout: 10000 });
              } else {
                const el = await elementLocator;
                const text = await el.getText();
                expect(text).toBe(String(resolved));
              }
            }
            console.log(`      ✓ ${field}[all] - all ${count} elements have text "${resolved}"`);
          } else {
            // Regular locator [all]
            const elements = await this._getAllElements(locator, isPlaywright);
            if (elements.length === 0) {
              throw new Error(`${field}[all] - no elements found for text check`);
            }
            console.log(`      🔄 Checking ${elements.length} ${field} elements have text "${resolved}"...`);
            for (let i = 0; i < elements.length; i++) {
              if (isPlaywright) {
                await expect(elements[i]).toHaveText(String(resolved), { timeout: 10000 });
              } else {
                const text = await elements[i].getText();
                expect(text).toBe(String(resolved));
              }
            }
            console.log(`      ✓ ${field}[all] - all ${elements.length} elements have text "${resolved}"`);
          }
          
        } else if (mode === 'any') {
          // Handle [any] mode
          if (isMethodCall && method) {
            let count = 10;
            if (countLocator) {
              count = await this._getElementCount(countLocator, isPlaywright);
            }
            if (count === 0) {
              throw new Error(`${field}[any] - no elements found for text check`);
            }
            let found = false;
            for (let i = 0; i < count; i++) {
              try {
                const elementLocator = method(i);
                let text;
                if (isPlaywright) {
                  text = await elementLocator.textContent();
                } else {
                  const el = await elementLocator;
                  text = await el.getText();
                }
                if (text && text.trim() === String(resolved).trim()) {
                  found = true;
                  console.log(`      ✓ ${field}[any] - element ${i} has text "${resolved}"`);
                  break;
                }
              } catch (e) {
                // Continue
              }
            }
            if (!found) {
              throw new Error(`${field}[any] - none of ${count} elements have text "${resolved}"`);
            }
          } else {
            const elements = await this._getAllElements(locator, isPlaywright);
            if (elements.length === 0) {
              throw new Error(`${field}[any] - no elements found for text check`);
            }
            let found = false;
            for (let i = 0; i < elements.length; i++) {
              try {
                let text;
                if (isPlaywright) {
                  text = await elements[i].textContent();
                } else {
                  text = await elements[i].getText();
                }
                if (text && text.trim() === String(resolved).trim()) {
                  found = true;
                  console.log(`      ✓ ${field}[any] - element ${i} has text "${resolved}"`);
                  break;
                }
              } catch (e) {
                // Continue
              }
            }
            if (!found) {
              throw new Error(`${field}[any] - none of ${elements.length} elements have text "${resolved}"`);
            }
          }
          
        } else {
          // Single element
          if (isPlaywright) {
            await expect(locator).toHaveText(String(resolved), { timeout: 10000 });
          } else {
            const text = await locator.getText();
            expect(text).toBe(String(resolved));
          }
          const indexLabel = index !== null ? `[${index}]` : '';
          console.log(`      ✓ ${field}${indexLabel} = "${resolved}"`);
        }
      }
    }

    // Contains checks - CROSS-PLATFORM with [all]/[any] support
    const containsChecks = data.checks?.contains || {};
    if (Object.keys(containsChecks).length > 0) {
      console.log(`      📝 Checking ${Object.keys(containsChecks).length} contains...`);
      for (const [elementName, expectedText] of Object.entries(containsChecks)) {
        const result = await this._getLocatorForField(screenObject, elementName, page, isPlaywright, testData);
        const { locator, mode, field, index, isMethodCall, method, countLocator } = result;
        const resolved = this.resolveTemplate(expectedText, testData);
        
        if (mode === 'all') {
          // Handle method-based [all]
          if (isMethodCall && method) {
            let count = 10;
            if (countLocator) {
              count = await this._getElementCount(countLocator, isPlaywright);
            }
            if (count === 0) {
              throw new Error(`${field}[all] - no elements found for contains check`);
            }
            console.log(`      🔄 Checking ${count} ${field} elements contain "${resolved}" via method...`);
            for (let i = 0; i < count; i++) {
              const elementLocator = method(i);
              if (isPlaywright) {
                await expect(elementLocator).toContainText(String(resolved), { timeout: 10000 });
              } else {
                const el = await elementLocator;
                const text = await el.getText();
                expect(text).toContain(String(resolved));
              }
            }
            console.log(`      ✓ ${field}[all] - all ${count} elements contain "${resolved}"`);
          } else {
            // Regular locator [all]
            const elements = await this._getAllElements(locator, isPlaywright);
            if (elements.length === 0) {
              throw new Error(`${field}[all] - no elements found for contains check`);
            }
            console.log(`      🔄 Checking ${elements.length} ${field} elements contain "${resolved}"...`);
            for (let i = 0; i < elements.length; i++) {
              if (isPlaywright) {
                await expect(elements[i]).toContainText(String(resolved), { timeout: 10000 });
              } else {
                const text = await elements[i].getText();
                expect(text).toContain(String(resolved));
              }
            }
            console.log(`      ✓ ${field}[all] - all ${elements.length} elements contain "${resolved}"`);
          }
          
        } else if (mode === 'any') {
          // Handle [any] mode
          if (isMethodCall && method) {
            let count = 10;
            if (countLocator) {
              count = await this._getElementCount(countLocator, isPlaywright);
            }
            if (count === 0) {
              throw new Error(`${field}[any] - no elements found for contains check`);
            }
            const randomIdx = this._getRandomIndex(count);
            const elementLocator = method(randomIdx);
            if (isPlaywright) {
              await expect(elementLocator).toContainText(String(resolved), { timeout: 10000 });
            } else {
              const el = await elementLocator;
              const text = await el.getText();
              expect(text).toContain(String(resolved));
            }
            console.log(`      ✓ ${field}[any] - element ${randomIdx} (of ${count}) contains "${resolved}"`);
          } else {
            const count = await this._getElementCount(locator, isPlaywright);
            if (count === 0) {
              throw new Error(`${field}[any] - no elements found for contains check`);
            }
            const randomIdx = this._getRandomIndex(count);
            const element = this._getElementAtIndex(locator, randomIdx, isPlaywright);
            if (isPlaywright) {
              await expect(element).toContainText(String(resolved), { timeout: 10000 });
            } else {
              const text = await element.getText();
              expect(text).toContain(String(resolved));
            }
            console.log(`      ✓ ${field}[any] - element ${randomIdx} (of ${count}) contains "${resolved}"`);
          }
          
        } else {
          // Single element
          if (isPlaywright) {
            await expect(locator).toContainText(String(resolved), { timeout: 10000 });
          } else {
            const text = await locator.getText();
            expect(text).toContain(String(resolved));
          }
          const indexLabel = index !== null ? `[${index}]` : '';
          console.log(`      ✓ ${field}${indexLabel} contains "${resolved}"`);
        }
      }
    }

    // Truthy
    if (data.truthy && data.truthy.length > 0) {
      console.log(`      ✓ Checking ${data.truthy.length} truthy...`);
      for (const funcName of data.truthy) {
        await this._checkTruthy(screenObject, funcName);
      }
    }
    
    // Falsy
    if (data.falsy && data.falsy.length > 0) {
      console.log(`      ✗ Checking ${data.falsy.length} falsy...`);
      for (const funcName of data.falsy) {
        await this._checkFalsy(screenObject, funcName);
      }
    }
    
    // Assertions
    if (data.assertions && data.assertions.length > 0) {
      console.log(`      🔍 Running ${data.assertions.length} assertions...`);
      for (const assertion of data.assertions) {
        await this._checkAssertion(screenObject, assertion, testData);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Execute Custom Code block
  // ═══════════════════════════════════════════════════════════
  static async _executeCustomCodeBlock(block, testData, screenObject, page) {
    const code = block.code || '';
    
    if (!code.trim()) {
      console.log(`      ⚠️  Empty code block, skipping`);
      return;
    }
    
    console.log(`      💻 Executing custom code (${code.split('\n').length} lines)...`);
    
    if (block.wrapInTestStep && block.testStepName) {
      console.log(`      📋 Step: ${block.testStepName}`);
    }
    
    try {
      const asyncFn = new Function(
        'page', 
        'screenObject', 
        'testData', 
        'expect',
        'ExpectImplication',
        `return (async () => { ${code} })();`
      );
      
      await asyncFn(page, screenObject, testData, expect, this);
      console.log(`      ✅ Custom code executed`);
      
    } catch (error) {
      console.error(`      ❌ Custom code error: ${error.message}`);
      throw new Error(`Custom code block "${block.label}" failed: ${error.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Execute Function Call block
  // ═══════════════════════════════════════════════════════════
  static async _executeFunctionCallBlock(block, testData, screenObject) {
    const data = block.data || {};
    const { instance, method, args = [], storeAs, persistStoreAs = true } = data;
    
    if (!method) {
      console.log(`      ⚠️  No method specified, skipping`);
      return;
    }
    
    let target = screenObject;
    if (instance && instance !== 'this' && screenObject[instance]) {
      target = screenObject[instance];
    }
    
    const fn = target[method];
    if (typeof fn !== 'function') {
      throw new Error(`Method "${method}" not found on ${instance || 'screenObject'}`);
    }
    
    const resolvedArgs = args.map(arg => this.resolveTemplate(arg, testData));
    
    console.log(`      ⚡ ${instance || 'screen'}.${method}(${resolvedArgs.map(a => JSON.stringify(a)).join(', ')})`);
    
    const result = data.await !== false
      ? await fn.call(target, ...resolvedArgs)
      : fn.call(target, ...resolvedArgs);
    
    if (storeAs) {
      this.storeValue(storeAs, result, {
        testData: persistStoreAs ? testData : null,
        persist: persistStoreAs
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Execute data-assertion block
  // ═══════════════════════════════════════════════════════════
  static async _executeDataAssertionBlock(block, testData, screenObject) {
    const assertions = block.assertions || [];
    
    if (assertions.length === 0) {
      console.log(`      ⚠️  No assertions in block, skipping`);
      return;
    }
    
    console.log(`      📊 Running ${assertions.length} data assertion(s)...`);
    
    for (const assertion of assertions) {
      const { left, operator, right, message } = assertion;
      
      console.log(`      🔍 Resolving: left="${left}", right="${right}"`);
      
      const leftValue = this.resolveTemplate(left, testData);
      const rightValue = right !== undefined ? this.resolveTemplate(right, testData) : undefined;
      
      console.log(`      ✅ Resolved: left=${JSON.stringify(leftValue)}, right=${JSON.stringify(rightValue)}`);
      
      const label = message || `${left} ${operator} ${right || ''}`;
      
      try {
        switch (operator) {
          case 'equals':
            expect(leftValue, label).toBe(rightValue);
            break;
            
          case 'notEquals':
            expect(leftValue, label).not.toBe(rightValue);
            break;
            
          case 'contains':
            expect(String(leftValue), label).toContain(String(rightValue));
            break;
            
          case 'notContains':
            expect(String(leftValue), label).not.toContain(String(rightValue));
            break;
            
          case 'greaterThan':
            expect(Number(leftValue), label).toBeGreaterThan(Number(rightValue));
            break;
            
          case 'lessThan':
            expect(Number(leftValue), label).toBeLessThan(Number(rightValue));
            break;
            
          case 'greaterOrEqual':
            expect(Number(leftValue), label).toBeGreaterThanOrEqual(Number(rightValue));
            break;
            
          case 'lessOrEqual':
            expect(Number(leftValue), label).toBeLessThanOrEqual(Number(rightValue));
            break;
            
          case 'matches':
            const regex = typeof rightValue === 'string' && rightValue.startsWith('/') 
              ? new RegExp(rightValue.slice(1, rightValue.lastIndexOf('/')), rightValue.slice(rightValue.lastIndexOf('/') + 1))
              : new RegExp(rightValue);
            expect(String(leftValue), label).toMatch(regex);
            break;
            
          case 'startsWith':
            expect(String(leftValue).startsWith(String(rightValue)), label).toBe(true);
            break;
            
          case 'endsWith':
            expect(String(leftValue).endsWith(String(rightValue)), label).toBe(true);
            break;
            
          case 'isDefined':
            expect(leftValue, label).toBeDefined();
            break;
            
          case 'isUndefined':
            expect(leftValue, label).toBeUndefined();
            break;
            
          case 'isTruthy':
            expect(leftValue, label).toBeTruthy();
            break;
            
          case 'isFalsy':
            expect(leftValue, label).toBeFalsy();
            break;
            
          case 'lengthEquals':
            expect(leftValue?.length, label).toBe(Number(rightValue));
            break;
            
          case 'lengthGreaterThan':
            expect(leftValue?.length, label).toBeGreaterThan(Number(rightValue));
            break;
            
          default:
            console.warn(`      ⚠️  Unknown operator: ${operator}`);
            continue;
        }
        
        console.log(`      ✓ ${label}`);
        
      } catch (error) {
        console.error(`      ❌ ${label}`);
        console.error(`         Left:  ${JSON.stringify(leftValue)}`);
        console.error(`         Right: ${JSON.stringify(rightValue)}`);
        throw error;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Legacy validation (existing behavior)
  // ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
  // Legacy validation - CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  static async _validateLegacy(def, testData, screenObject) {
    const isPlaywright = screenObject.page !== undefined;
    const page = screenObject.page || screenObject;
    
    // Prerequisites
    if (def.prerequisites && def.prerequisites.length > 0) {
      console.log(`   🔧 Running ${def.prerequisites.length} prerequisites...`);
      for (const prereq of def.prerequisites) {
        console.log(`      ${prereq.description}`);
        await prereq.setup(testData, page);
      }
      console.log('   ✅ Prerequisites completed');
    }

    // Functions
    if (def.functions && Object.keys(def.functions).length > 0) {
      await this._executeFunctions(def.functions, screenObject, testData);
    }
    
    // Visible
    if (def.visible && def.visible.length > 0) {
      console.log(`   ✅ Checking ${def.visible.length} visible elements...`);
      for (const elementName of def.visible) {
        await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright, testData);
      }
    }
    
    // Hidden
    if (def.hidden && def.hidden.length > 0) {
      console.log(`   ✅ Checking ${def.hidden.length} hidden elements...`);
      for (const elementName of def.hidden) {
        await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright, testData);
      }
    }

    // Truthy
    if (def.truthy && def.truthy.length > 0) {
      console.log(`   ✅ Checking ${def.truthy.length} truthy functions...`);
      for (const functionName of def.truthy) {
        await this._checkTruthy(screenObject, functionName);
      }
    }

    // Falsy
    if (def.falsy && def.falsy.length > 0) {
      console.log(`   ✅ Checking ${def.falsy.length} falsy functions...`);
      for (const functionName of def.falsy) {
        await this._checkFalsy(screenObject, functionName);
      }
    }

    // Assertions
    if (def.assertions && def.assertions.length > 0) {
      console.log(`   ✅ Running ${def.assertions.length} assertions...`);
      for (const assertion of def.assertions) {
        await this._checkAssertion(screenObject, assertion, testData);
      }
    }
    
    // Legacy checks object
    if (def.checks) {
      console.log('   🔍 Running additional checks...');
      
      // Visible checks
      if (def.checks.visible?.length > 0) {
        for (const elementName of def.checks.visible) {
          await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright, testData);
        }
      }
      
      // Hidden checks
      if (def.checks.hidden?.length > 0) {
        for (const elementName of def.checks.hidden) {
          await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright, testData);
        }
      }
      
      // Text checks (exact) - CROSS-PLATFORM
      if (def.checks.text && Object.keys(def.checks.text).length > 0) {
        console.log(`      📝 Checking ${Object.keys(def.checks.text).length} exact text...`);
        for (const [elementName, expectedText] of Object.entries(def.checks.text)) {
          const { locator, mode, field, index } = await this._getLocatorForField(screenObject, elementName, page, isPlaywright, testData);
          const finalText = this.resolveTemplate(expectedText, testData);
          
          if (mode === 'all') {
            const elements = await this._getAllElements(locator, isPlaywright);
            if (elements.length === 0) {
              throw new Error(`${field}[all] - no elements found for text check`);
            }
            console.log(`      🔄 Checking ${elements.length} ${field} elements have text "${finalText}"...`);
            for (let i = 0; i < elements.length; i++) {
              if (isPlaywright) {
                await expect(elements[i]).toHaveText(String(finalText), { timeout: 10000 });
              } else {
                const text = await elements[i].getText();
                expect(text).toBe(String(finalText));
              }
            }
            console.log(`      ✓ ${field}[all] - all ${elements.length} elements have text "${finalText}"`);
            
          } else if (mode === 'any') {
            const count = await this._getElementCount(locator, isPlaywright);
            if (count === 0) {
              throw new Error(`${field}[any] - no elements found for text check`);
            }
            const randomIdx = this._getRandomIndex(count);
            const element = this._getElementAtIndex(locator, randomIdx, isPlaywright);
            if (isPlaywright) {
              await expect(element).toHaveText(String(finalText), { timeout: 10000 });
            } else {
              const text = await element.getText();
              expect(text).toBe(String(finalText));
            }
            console.log(`      ✓ ${field}[any] - element ${randomIdx} (of ${count}) has text "${finalText}"`);
            
          } else {
            if (isPlaywright) {
              await expect(locator).toHaveText(String(finalText), { timeout: 10000 });
            } else {
              const text = await locator.getText();
              expect(text).toBe(String(finalText));
            }
            const indexLabel = index !== null ? `[${index}]` : '';
            console.log(`      ✓ ${field}${indexLabel} has text "${finalText}"`);
          }
        }
      }
      
      // Contains checks - CROSS-PLATFORM
      if (def.checks.contains && Object.keys(def.checks.contains).length > 0) {
        console.log(`      📝 Checking ${Object.keys(def.checks.contains).length} contains...`);
        for (const [elementName, expectedText] of Object.entries(def.checks.contains)) {
          const { locator, mode, field, index } = await this._getLocatorForField(screenObject, elementName, page, isPlaywright, testData);
          const finalText = this.resolveTemplate(expectedText, testData);
          
          if (mode === 'all') {
            const elements = await this._getAllElements(locator, isPlaywright);
            if (elements.length === 0) {
              throw new Error(`${field}[all] - no elements found for contains check`);
            }
            console.log(`      🔄 Checking ${elements.length} ${field} elements contain "${finalText}"...`);
            for (let i = 0; i < elements.length; i++) {
              if (isPlaywright) {
                await expect(elements[i]).toContainText(String(finalText), { timeout: 10000 });
              } else {
                const text = await elements[i].getText();
                expect(text).toContain(String(finalText));
              }
            }
            console.log(`      ✓ ${field}[all] - all ${elements.length} elements contain "${finalText}"`);
            
          } else if (mode === 'any') {
            const count = await this._getElementCount(locator, isPlaywright);
            if (count === 0) {
              throw new Error(`${field}[any] - no elements found for contains check`);
            }
            const randomIdx = this._getRandomIndex(count);
            const element = this._getElementAtIndex(locator, randomIdx, isPlaywright);
            if (isPlaywright) {
              await expect(element).toContainText(String(finalText), { timeout: 10000 });
            } else {
              const text = await element.getText();
              expect(text).toContain(String(finalText));
            }
            console.log(`      ✓ ${field}[any] - element ${randomIdx} (of ${count}) contains "${finalText}"`);
            
          } else {
            if (isPlaywright) {
              await expect(locator).toContainText(String(finalText), { timeout: 10000 });
            } else {
              const text = await locator.getText();
              expect(text).toContain(String(finalText));
            }
            const indexLabel = index !== null ? `[${index}]` : '';
            console.log(`      ✓ ${field}${indexLabel} contains "${finalText}"`);
          }
        }
      }
    }
    
    // Custom expect
    if (def.expect && typeof def.expect === 'function') {
      console.log('   🎯 Running custom expect function...');
      await def.expect(testData, page);
      console.log('   ✅ Custom expect passed');
    }
    
    console.log(`   ✅ All validations passed for ${def.name || 'screen'}`);
    console.log('   ' + '─'.repeat(47));
  }
}

module.exports = ExpectImplication;