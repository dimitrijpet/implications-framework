// tests/ai-testing/utils/ExpectImplication.js
// ✅ UPDATED: Block-order-aware validation
// 
// WHAT CHANGED:
// - validateImplications() now checks for `blocks` array first
// - If blocks exist, processes them IN ORDER via validateBlocks()
// - Each block type has its own handler
// - Falls back to legacy format if no blocks

const { expect } = require('@playwright/test');

class ExpectImplication {
  // ═══════════════════════════════════════════════════════════
  // STORED VALUES - For cross-step data passing (storeAs)
  // ═══════════════════════════════════════════════════════════
  static _capturedValues = {};
  
  static storeValue(key, value) {
    this._capturedValues[key] = value;
    const preview = typeof value === 'object' 
      ? JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? '...' : '')
      : value;
    console.log(`      💾 Stored: ${key} = ${preview}`);
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

  // ═══════════════════════════════════════════════════════════
  // Get nested value - checks captured values first, then obj
  // ═══════════════════════════════════════════════════════════
  static getNestedValue(obj, path) {
    if (!path.includes('.')) {
      if (this._capturedValues[path] !== undefined) {
        return this._capturedValues[path];
      }
      return obj?.[path];
    }
    
    const parts = path.split('.');
    const firstPart = parts[0];
    
    if (this._capturedValues[firstPart] !== undefined) {
      let current = this._capturedValues[firstPart];
      for (let i = 1; i < parts.length; i++) {
        if (current === null || current === undefined) return undefined;
        current = current[parts[i]];
      }
      return current;
    }
    
    let current = obj;
    for (const part of parts) {
      if (!current || !current.hasOwnProperty(part)) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  // ═══════════════════════════════════════════════════════════
  // Resolve {{variable}} template syntax
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
    
    const fullMatch = value.match(/^\{\{([^}]+)\}\}$/);
    if (fullMatch) {
      const path = fullMatch[1].trim();
      const result = this.getNestedValue(testData, path);
      if (result !== undefined) {
        console.log(`      🔄 Resolved {{${path}}} → ${JSON.stringify(result)}`);
        return result;
      }
      console.warn(`      ⚠️  Variable {{${path}}} not found`);
      return value;
    }
    
    return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const result = this.getNestedValue(testData, trimmedPath);
      
      if (result === undefined || result === null) {
        console.warn(`      ⚠️  Variable {{${trimmedPath}}} not found`);
        return match;
      }
      
      console.log(`      🔄 Resolved {{${trimmedPath}}} → ${result}`);
      return String(result);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Parse field selector for array indexing
  // ═══════════════════════════════════════════════════════════
  static _parseFieldSelector(fieldName) {
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
  // Get locator with index support
  // ═══════════════════════════════════════════════════════════
static async _getLocatorForField(screenObject, fieldName, page, isPlaywright) {
  const { field, index } = this._parseFieldSelector(fieldName);
  
  let baseLocator = screenObject[field];
  
  // DEBUG: What type is this?
  console.log(`      🔍 DEBUG: ${field} type = ${typeof baseLocator}, isFunction = ${typeof baseLocator === 'function'}`);
  if (baseLocator && typeof baseLocator.count === 'function') {
    console.log(`      🔍 DEBUG: ${field} has .count() - is a locator`);
  } else {
    console.log(`      🔍 DEBUG: ${field} missing .count() - NOT a locator!`);
    console.log(`      🔍 DEBUG: ${field} value =`, baseLocator);
  }
    
    if (!baseLocator) {
      throw new Error(`Field "${field}" not found on screen object. Check that the getter exists in your POM.`);
    }
    
    if (index === null) {
      return { locator: baseLocator, mode: 'single', field, index };
    } else if (index === 'first') {
      return { locator: baseLocator.first(), mode: 'single', field, index };
    } else if (index === 'last') {
      return { locator: baseLocator.last(), mode: 'single', field, index };
    } else if (index === 'all') {
      return { locator: baseLocator, mode: 'all', field, index };
    } else if (index === 'any') {
      return { locator: baseLocator, mode: 'any', field, index };
    } else {
      return { locator: baseLocator.nth(index), mode: 'single', field, index };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Check visible with array support
  // ═══════════════════════════════════════════════════════════
  static async _checkVisibleWithIndex(screenObject, elementName, page, isPlaywright) {
    const { locator, mode, field, index } = await this._getLocatorForField(
      screenObject, elementName, page, isPlaywright
    );
    
    const indexLabel = index !== null ? `[${index}]` : '';
    
    if (mode === 'single') {
      if (isPlaywright) {
        await expect(locator).toBeVisible({ timeout: 10000 });
      } else {
        await expect(locator).toBeDisplayed();
      }
      console.log(`      ✓ ${field}${indexLabel} is visible`);
      
    } else if (mode === 'all') {
      const elements = await locator.all();
      if (elements.length === 0) {
        throw new Error(`${field}[all] - no elements found`);
      }
      for (let i = 0; i < elements.length; i++) {
        await expect(elements[i]).toBeVisible({ timeout: 10000 });
      }
      console.log(`      ✓ ${field}[all] - all ${elements.length} elements are visible`);
      
    } else if (mode === 'any') {
      const count = await locator.count();
      if (count === 0) {
        throw new Error(`${field}[any] - no elements found`);
      }
      await expect(locator.first()).toBeVisible({ timeout: 10000 });
      console.log(`      ✓ ${field}[any] - at least one of ${count} elements is visible`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Check hidden with array support
  // ═══════════════════════════════════════════════════════════
  static async _checkHiddenWithIndex(screenObject, elementName, page, isPlaywright) {
    const { locator, mode, field, index } = await this._getLocatorForField(
      screenObject, elementName, page, isPlaywright
    );
    
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
        const exists = await locator.isExisting();
        if (!exists) {
          console.log(`      ✓ ${field}${indexLabel} doesn't exist (counts as hidden)`);
          return;
        }
        await expect(locator).not.toBeDisplayed();
      }
      console.log(`      ✓ ${field}${indexLabel} is hidden`);
      
    } else if (mode === 'all') {
      const elements = await locator.all();
      if (elements.length === 0) {
        console.log(`      ✓ ${field}[all] - no elements exist (counts as hidden)`);
        return;
      }
      for (let i = 0; i < elements.length; i++) {
        await expect(elements[i]).not.toBeVisible();
      }
      console.log(`      ✓ ${field}[all] - all ${elements.length} elements are hidden`);
      
    } else if (mode === 'any') {
      const count = await locator.count();
      if (count === 0) {
        console.log(`      ✓ ${field}[any] - no elements exist (counts as hidden)`);
        return;
      }
      await expect(locator.first()).not.toBeVisible();
      console.log(`      ✓ ${field}[any] - at least one element is hidden`);
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
  // Advanced assertions
  // ═══════════════════════════════════════════════════════════
/**
 * Advanced assertions with storeAs support
 * 
 * @param {Object} screenObject - The POM screen object
 * @param {Object} assertion - Assertion config { fn, expect, value?, storeAs?, params? }
 * @param {Object} testData - Test data for template resolution
 */
static async _checkAssertion(screenObject, assertion, testData = {}) {
  const { fn, expect: expectType, value, params = {}, storeAs, tolerance } = assertion;
  
  if (typeof screenObject[fn] !== 'function') {
    throw new Error(`"${fn}" is not a function on screen object`);
  }
  
  const resolvedParams = this.resolveTemplate(params, testData);
  const paramValues = Object.values(resolvedParams);
  const resolvedValue = this.resolveTemplate(value, testData);
  
  let result;
  let passed = true;
  
  try {
    switch (expectType) {
      // ═══════════════════════════════════════════════════════════
      // VALUE GETTERS - Return actual value (for storeAs)
      // ═══════════════════════════════════════════════════════════
      case 'getValue': {
        const element = paramValues.length > 0
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        result = await element.inputValue();
        console.log(`      📝 ${fn}() getValue → "${result}"`);
        break;
      }
      
      case 'getText': {
        const element = paramValues.length > 0
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        result = await element.textContent();
        console.log(`      📝 ${fn}() getText → "${result}"`);
        break;
      }
      
      case 'getCount': {
        const element = paramValues.length > 0
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        result = await element.count();
        console.log(`      📝 ${fn}() getCount → ${result}`);
        break;
      }
      
      case 'getAttribute': {
        const element = paramValues.length > 0
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        result = await element.getAttribute(String(resolvedValue));
        console.log(`      📝 ${fn}() getAttribute("${resolvedValue}") → "${result}"`);
        break;
      }
      
      // ═══════════════════════════════════════════════════════════
      // BOOLEAN CHECKS - Return true/false (for storeAs)
      // ═══════════════════════════════════════════════════════════
      case 'isVisible': {
        const element = paramValues.length > 0
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        result = await element.isVisible();
        console.log(`      ${result ? '✅' : '❌'} ${fn}() isVisible → ${result}`);
        break;
      }
      
      case 'isEnabled': {
        const element = paramValues.length > 0
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        result = await element.isEnabled();
        console.log(`      ${result ? '✅' : '❌'} ${fn}() isEnabled → ${result}`);
        break;
      }
      
      case 'isChecked': {
        const element = paramValues.length > 0
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        result = await element.isChecked();
        console.log(`      ${result ? '✅' : '❌'} ${fn}() isChecked → ${result}`);
        break;
      }
      
      case 'hasText': {
        const element = paramValues.length > 0
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        const actualText = await element.textContent();
        result = actualText.includes(String(resolvedValue));
        console.log(`      ${result ? '✅' : '❌'} ${fn}() hasText("${resolvedValue}") → ${result}`);
        break;
      }
      
      // ═══════════════════════════════════════════════════════════
      // STANDARD ASSERTIONS - Pass/fail, can store boolean result
      // ═══════════════════════════════════════════════════════════
      case 'toBe':
      case 'equals': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toBe(resolvedValue);
        result = true;
        console.log(`      ✓ ${fn}() toBe ${resolvedValue} (got: ${fnResult})`);
        break;
      }
      
      case 'toEqual': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toEqual(resolvedValue);
        result = true;
        console.log(`      ✓ ${fn}() toEqual ${JSON.stringify(resolvedValue)}`);
        break;
      }
      
      case 'toBeGreaterThan': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toBeGreaterThan(resolvedValue);
        result = true;
        console.log(`      ✓ ${fn}() > ${resolvedValue} (got: ${fnResult})`);
        break;
      }
      
      case 'toBeGreaterThanOrEqual': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toBeGreaterThanOrEqual(resolvedValue);
        result = true;
        console.log(`      ✓ ${fn}() >= ${resolvedValue} (got: ${fnResult})`);
        break;
      }
      
      case 'toBeLessThan': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toBeLessThan(resolvedValue);
        result = true;
        console.log(`      ✓ ${fn}() < ${resolvedValue} (got: ${fnResult})`);
        break;
      }
      
      case 'toBeLessThanOrEqual': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toBeLessThanOrEqual(resolvedValue);
        result = true;
        console.log(`      ✓ ${fn}() <= ${resolvedValue} (got: ${fnResult})`);
        break;
      }
      
      case 'toContain': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toContain(resolvedValue);
        result = true;
        console.log(`      ✓ ${fn}() contains "${resolvedValue}"`);
        break;
      }
      
      case 'toMatch': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toMatch(resolvedValue);
        result = true;
        console.log(`      ✓ ${fn}() matches "${resolvedValue}"`);
        break;
      }
      
      case 'toBeTruthy': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toBeTruthy();
        result = true;
        console.log(`      ✓ ${fn}() is truthy (got: ${fnResult})`);
        break;
      }
      
      case 'toBeFalsy': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toBeFalsy();
        result = true;
        console.log(`      ✓ ${fn}() is falsy (got: ${fnResult})`);
        break;
      }
      
      case 'toBeDefined': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toBeDefined();
        result = true;
        console.log(`      ✓ ${fn}() is defined (got: ${fnResult})`);
        break;
      }
      
      case 'toBeNull': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toBeNull();
        result = true;
        console.log(`      ✓ ${fn}() is null`);
        break;
      }
      
      case 'toHaveLength': {
        const fnResult = paramValues.length > 0 
          ? await screenObject[fn](...paramValues)
          : await screenObject[fn]();
        
        expect(fnResult).toHaveLength(resolvedValue);
        result = true;
        console.log(`      ✓ ${fn}() has length ${resolvedValue}`);
        break;
      }
      
      default:
        throw new Error(`Unknown assertion type: ${expectType}`);
    }
    
  } catch (error) {
    passed = false;
    result = false;
    
    // For getters, always throw - they're not "assertions" that can pass/fail
    const isGetter = ['getValue', 'getText', 'getCount', 'getAttribute'].includes(expectType);
    if (isGetter) {
      console.error(`      ❌ ${fn}() ${expectType} failed: ${error.message}`);
      throw error;
    }
    
    // For boolean checks, store the result but don't throw
    const isBooleanCheck = ['isVisible', 'isEnabled', 'isChecked', 'hasText'].includes(expectType);
    if (isBooleanCheck && storeAs) {
      // Don't throw - just store the false result
      console.log(`      ⚠️ ${fn}() ${expectType} → false (will store)`);
    } else if (!storeAs) {
      // No storeAs - throw the error as before
      console.error(`      ❌ ${fn}() ${expectType} failed: ${error.message}`);
      throw error;
    } else {
      // Has storeAs - store false and continue
      console.log(`      ⚠️ ${fn}() ${expectType} failed (storing false): ${error.message}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // STORE RESULT (if storeAs specified)
  // ═══════════════════════════════════════════════════════════
  if (storeAs) {
    this.storeValue(storeAs, result);
  }
}

  // ═══════════════════════════════════════════════════════════
  // Execute functions with storeAs support
  // ═══════════════════════════════════════════════════════════
  static async _executeFunctions(functions, screenObject, testData = {}) {
    if (!functions || Object.keys(functions).length === 0) return;
    
    console.log(`   ⚡ Executing ${Object.keys(functions).length} function(s)...`);
    
    for (const [funcName, funcConfig] of Object.entries(functions)) {
      try {
        const { parameters = {}, params = {}, storeAs, signature } = funcConfig;
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
          this.storeValue(storeAs, result);
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
  // ✅ NEW: BLOCK-AWARE VALIDATION
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Main validation entry point
   * ✅ NOW CHECKS FOR BLOCKS FIRST
   */
  static async validateImplications(screenDef, testData, screenObject) {
    if (!screenDef || (Array.isArray(screenDef) && screenDef.length === 0)) {
      console.log('   ⚠️  No screen definition to validate');
      return;
    }
    
    const def = Array.isArray(screenDef) ? screenDef[0] : screenDef;
    
    // ✅ NEW: Check for blocks array - process in order!
    if (def.blocks && Array.isArray(def.blocks) && def.blocks.length > 0) {
      console.log(`\n   🧱 Block-based validation (${def.blocks.length} blocks)`);
      console.log('   ' + '─'.repeat(47));
      return this._validateBlocks(def.blocks, testData, screenObject, def);
    }
    
    // Legacy format - use existing logic
    console.log(`\n   🔍 Validating screen: ${def.name || 'unnamed'} (legacy format)`);
    console.log('   ' + '─'.repeat(47));
    return this._validateLegacy(def, testData, screenObject);
  }

  /**
   * ✅ NEW: Process blocks IN ORDER
   * This is the key method that enables:
   * - hidden check → custom code → visible check
   */
  static async _validateBlocks(blocks, testData, screenObject, screenDef) {
    const isPlaywright = screenObject.page !== undefined;
    const page = screenObject.page || screenObject;
    
    // Sort blocks by order field
    const sortedBlocks = [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    console.log(`   Processing ${sortedBlocks.length} blocks in order...\n`);
    
    for (let i = 0; i < sortedBlocks.length; i++) {
      const block = sortedBlocks[i];
      
      // Skip disabled blocks
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

  /**
   * ✅ NEW: Execute UI Assertion block
   */
  static async _executeUIAssertionBlock(block, testData, screenObject, page, isPlaywright) {
    const data = block.data || {};
    
    // Visible checks
    if (data.visible && data.visible.length > 0) {
      console.log(`      ✅ Checking ${data.visible.length} visible...`);
      for (const elementName of data.visible) {
        await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
      }
    }
    
    // Hidden checks
    if (data.hidden && data.hidden.length > 0) {
      console.log(`      ❌ Checking ${data.hidden.length} hidden...`);
      for (const elementName of data.hidden) {
        await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
      }
    }
    
    // Text checks (exact)
    const textChecks = data.checks?.text || {};
    if (Object.keys(textChecks).length > 0) {
      console.log(`      📝 Checking ${Object.keys(textChecks).length} exact text...`);
      for (const [elementName, expectedText] of Object.entries(textChecks)) {
        const { locator } = await this._getLocatorForField(screenObject, elementName, page, isPlaywright);
        const resolved = this.resolveTemplate(expectedText, testData);
        await expect(locator).toHaveText(String(resolved), { timeout: 10000 });
        console.log(`      ✓ ${elementName} = "${resolved}"`);
      }
    }
    
    // Contains checks
    const containsChecks = data.checks?.contains || {};
    if (Object.keys(containsChecks).length > 0) {
      console.log(`      📝 Checking ${Object.keys(containsChecks).length} contains...`);
      for (const [elementName, expectedText] of Object.entries(containsChecks)) {
        const { locator } = await this._getLocatorForField(screenObject, elementName, page, isPlaywright);
        const resolved = this.resolveTemplate(expectedText, testData);
        await expect(locator).toContainText(String(resolved), { timeout: 10000 });
        console.log(`      ✓ ${elementName} contains "${resolved}"`);
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

  /**
   * ✅ NEW: Execute Custom Code block
   * ⚠️  This uses eval/Function - be careful with untrusted input!
   */
  static async _executeCustomCodeBlock(block, testData, screenObject, page) {
    const code = block.code || '';
    
    if (!code.trim()) {
      console.log(`      ⚠️  Empty code block, skipping`);
      return;
    }
    
    console.log(`      💻 Executing custom code (${code.split('\n').length} lines)...`);
    
    // Wrap in test.step if configured
    if (block.wrapInTestStep && block.testStepName) {
      console.log(`      📋 Step: ${block.testStepName}`);
    }
    
    try {
      // Create async function with context
      // Available variables: page, screenObject, testData, expect, ExpectImplication
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

  /**
   * ✅ NEW: Execute Function Call block
   */
  static async _executeFunctionCallBlock(block, testData, screenObject) {
    const data = block.data || {};
    const { instance, method, args = [], storeAs } = data;
    
    if (!method) {
      console.log(`      ⚠️  No method specified, skipping`);
      return;
    }
    
    // Get the instance (could be screenObject itself or a property)
    let target = screenObject;
    if (instance && instance !== 'this' && screenObject[instance]) {
      target = screenObject[instance];
    }
    
    const fn = target[method];
    if (typeof fn !== 'function') {
      throw new Error(`Method "${method}" not found on ${instance || 'screenObject'}`);
    }
    
    // Resolve args
    const resolvedArgs = args.map(arg => this.resolveTemplate(arg, testData));
    
    console.log(`      ⚡ ${instance || 'screen'}.${method}(${resolvedArgs.map(a => JSON.stringify(a)).join(', ')})`);
    
    const result = data.await !== false
      ? await fn.call(target, ...resolvedArgs)
      : fn.call(target, ...resolvedArgs);
    
    if (storeAs) {
      this.storeValue(storeAs, result);
    }
  }

  /**
   * Legacy validation (existing behavior)
   */
  static async _validateLegacy(def, testData, screenObject) {
    const isPlaywright = screenObject.page !== undefined;
    const page = screenObject.page || screenObject;
    
    const getElement = async (elementName) => {
      if (screenObject[elementName]) {
        return screenObject[elementName];
      }
      if (isPlaywright) {
        return page.locator(`[data-testid="${elementName}"]`);
      }
      return null;
    };
    
    // Prerequisites
    if (def.prerequisites && def.prerequisites.length > 0) {
      console.log(`   🔧 Running ${def.prerequisites.length} prerequisites...`);
      for (const prereq of def.prerequisites) {
        console.log(`      ${prereq.description}`);
        await prereq.setup(testData, page);
      }
      console.log('   ✅ Prerequisites completed');
    }

    // Functions (with storeAs)
    if (def.functions && Object.keys(def.functions).length > 0) {
      await this._executeFunctions(def.functions, screenObject, testData);
    }
    
    // Visible
    if (def.visible && def.visible.length > 0) {
      console.log(`   ✅ Checking ${def.visible.length} visible elements...`);
      for (const elementName of def.visible) {
        await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
      }
    }
    
    // Hidden
    if (def.hidden && def.hidden.length > 0) {
      console.log(`   ✅ Checking ${def.hidden.length} hidden elements...`);
      for (const elementName of def.hidden) {
        await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
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
      
      if (def.checks.visible?.length > 0) {
        for (const elementName of def.checks.visible) {
          await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
        }
      }
      
      if (def.checks.hidden?.length > 0) {
        for (const elementName of def.checks.hidden) {
          await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
        }
      }
      
      if (def.checks.text && Object.keys(def.checks.text).length > 0) {
        for (const [elementName, expectedText] of Object.entries(def.checks.text)) {
          const element = await getElement(elementName);
          const finalText = this.resolveTemplate(expectedText, testData);
          await expect(element).toHaveText(finalText, { timeout: 10000 });
          console.log(`      ✓ ${elementName} has text: "${finalText}"`);
        }
      }
      
      if (def.checks.contains && Object.keys(def.checks.contains).length > 0) {
        for (const [elementName, expectedText] of Object.entries(def.checks.contains)) {
          const element = await getElement(elementName);
          const finalText = this.resolveTemplate(expectedText, testData);
          await expect(element).toContainText(finalText, { timeout: 10000 });
          console.log(`      ✓ ${elementName} contains: "${finalText}"`);
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
