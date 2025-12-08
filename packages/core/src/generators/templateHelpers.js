// packages/core/src/generators/templateHelpers.js
// ENHANCED with Phase 3.7: order, navigation, blocks support

/**
 * Template Helpers for Handlebars
 * 
 * Provides utility functions for template rendering including:
 * - String transformations (PascalCase, camelCase, snake_case)
 * - UI validation data preparation
 * - String utilities (contains, replace)
 * - NEW: Ordered screens with blocks support (Phase 3.7)
 */

/**
 * Convert to PascalCase
 * Usage: "btn_calendar_day" → "BtnCalendarDay"
 */
export function toPascalCase(str) {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .split(/[-_.\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert to camelCase
 * Usage: "btn_calendar_day" → "btnCalendarDay"
 */
export function toCamelCase(str) {
  if (!str || typeof str !== 'string') return '';
  
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert to snake_case
 * Usage: "BtnCalendarDay" → "btn_calendar_day"
 */
export function toSnakeCase(str) {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Check if string contains substring
 * Usage: contains("manager.logged_in", ".") → true
 */
export function containsHelper(str, substring) {
  if (!str || !substring) return false;
  return String(str).includes(String(substring));
}

/**
 * Replace string
 * Usage: replace("manager.logged_in", ".", " = { ") → "manager = { logged_in"
 */
export function replaceHelper(str, search, replace) {
  if (!str) return '';
  return String(str).replace(new RegExp(search, 'g'), replace);
}

/**
 * Handlebars helper wrapper for PascalCase
 */
export function pascalCaseHelper(str) {
  return toPascalCase(str);
}

/**
 * Handlebars helper wrapper for camelCase
 */
export function camelCaseHelper(str) {
  return toCamelCase(str);
}

/**
 * Handlebars helper wrapper for snake_case
 */
export function snakeCaseHelper(str) {
  return toSnakeCase(str);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXISTING FUNCTION - prepareValidationScreens (unchanged for backward compat)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Helper: Prepare UI Validation Data for Template
 * 
 * This processes mirrorsOn screens and separates:
 * - Regular fields (direct POM properties)
 * - Function calls (need to be called and stored)
 * - Which checks reference which functions
 * 
 * @param {object} mirrorsOnUI - mirrorsOn.UI object
 * @param {string} platform - Platform key (web, dancer, clubApp, etc.)
 * @param {object} testData - Test data for resolving function parameters
 * @returns {Array} Array of validation screen objects
 */
export function prepareValidationScreens(mirrorsOnUI, platform, testData) {
  // ✅ DEFENSIVE: Check all inputs
  if (!mirrorsOnUI || typeof mirrorsOnUI !== 'object') {
    console.warn('⚠️  prepareValidationScreens: mirrorsOnUI is null or invalid');
    return [];
  }

  if (!platform) {
    console.warn('⚠️  prepareValidationScreens: platform is null');
    return [];
  }

  const platformScreens = mirrorsOnUI[platform];
  
  if (!platformScreens || typeof platformScreens !== 'object') {
    console.warn(`⚠️  prepareValidationScreens: No screens for platform ${platform}`);
    return [];
  }

  const validationScreens = [];

  for (const [screenKey, screenDef] of Object.entries(platformScreens)) {
    // ✅ FIX: Handle BOTH array and object formats
    let screen;
    
    if (Array.isArray(screenDef)) {
      // Old format: ResultsWrapper: [{ visible: [...] }]
      if (screenDef.length === 0) {
        console.warn(`⚠️  Screen ${screenKey} array is empty, skipping`);
        continue;
      }
      screen = screenDef[0];
    } else if (typeof screenDef === 'object' && screenDef !== null) {
      // New format: ResultsWrapper: { visible: [...] }
      screen = screenDef;
      console.log(`   ✅ ${screenKey}: using object format (not array)`);
    } else {
      console.warn(`⚠️  Screen ${screenKey} is invalid type: ${typeof screenDef}, skipping`);
      continue;
    }
    
    // ✅ DEFENSIVE: Check if screen exists
    if (!screen || typeof screen !== 'object') {
      console.warn(`⚠️  Screen ${screenKey} definition is null or invalid, skipping`);
      continue;
    }
    
    // Extract functions (with safety)
    const functions = screen.functions || {};
    const functionNames = Object.keys(functions);
    
    // Process visible checks (with safety)
    const visibleAll = [
      ...(Array.isArray(screen.visible) ? screen.visible : []),
      ...(Array.isArray(screen.checks?.visible) ? screen.checks.visible : [])
    ];
    
    const visibleRegularFields = [];
    const visibleFunctions = [];
    
    visibleAll.forEach(field => {
      if (functionNames.includes(field)) {
        visibleFunctions.push(field);
      } else {
        visibleRegularFields.push(field);
      }
    });
    
    // Process hidden checks (with safety)
    const hiddenAll = [
      ...(Array.isArray(screen.hidden) ? screen.hidden : []),
      ...(Array.isArray(screen.checks?.hidden) ? screen.checks.hidden : [])
    ];
    
    const hiddenRegularFields = [];
    const hiddenFunctions = [];
    
    hiddenAll.forEach(field => {
      if (functionNames.includes(field)) {
        hiddenFunctions.push(field);
      } else {
        hiddenRegularFields.push(field);
      }
    });
    
    // Process text checks (with safety)
    const textChecks = [];
    const textChecksRaw = screen.checks?.text || {};
    
    for (const [fieldName, expectedText] of Object.entries(textChecksRaw)) {
      textChecks.push({
        fieldName,
        expectedText,
        isFunction: functionNames.includes(fieldName)
      });
    }
    
    // Prepare function data with resolved parameters
    const functionsWithParams = [];
    
    for (const [funcName, funcData] of Object.entries(functions)) {
      // ✅ DEFENSIVE: Check if funcData exists
      if (!funcData || typeof funcData !== 'object') {
        console.warn(`⚠️  Function ${funcName} data is invalid, skipping`);
        continue;
      }
      
      const parameterValues = [];
      
      // Resolve parameters from testData (with safety)
      const parameters = funcData.parameters || {};
      
      for (const [paramName, paramValue] of Object.entries(parameters)) {
        let resolvedValue = paramValue;
        
        // Check if it's a template reference like {{email}}
        if (typeof paramValue === 'string' && paramValue.startsWith('{{') && paramValue.endsWith('}}')) {
          const fieldName = paramValue.slice(2, -2); // Remove {{ and }}
          resolvedValue = testData?.[fieldName] || paramValue; // Fallback to original if not found
          
          // Wrap in quotes if string
          if (typeof resolvedValue === 'string') {
            resolvedValue = `'${resolvedValue}'`;
          }
        } else if (typeof paramValue === 'string') {
          // Wrap plain strings in quotes
          resolvedValue = `'${paramValue}'`;
        } else if (typeof paramValue === 'number') {
          // Numbers stay as-is
          resolvedValue = paramValue;
        }
        
        parameterValues.push(resolvedValue);
      }
      
      functionsWithParams.push({
        name: funcName,
        signature: funcData.signature || `${funcName}()`,
        parameterValues
      });
    }
    
    // Build screen validation object
    validationScreens.push({
      screenKey,
      platformKey: platform,
      pomClassName: screen.screen && typeof screen.screen === 'string' 
        ? toPascalCase(screen.screen.replace(/\./g, '')) 
        : null,
      
      // ✅ ADD: Extract POM path and instance
      pomPath: screen._pomSource?.path || 
             (screen.screen ? `screenObjects/${screen.screen}.js` : null),
      pomInstance: screen.instance || null,
      
      // Functions
      hasFunctions: functionsWithParams.length > 0,
      functions: functionsWithParams,
      
      // Regular fields
      hasRegularFields: (visibleRegularFields.length + hiddenRegularFields.length) > 0,
      visibleRegularFields,
      hiddenRegularFields,
      
      // Function checks
      hasFunctionChecks: (visibleFunctions.length + hiddenFunctions.length) > 0,
      visibleFunctions,
      hiddenFunctions,
      
      // Text checks
      hasTextChecks: textChecks.length > 0,
      textChecks
    });
  }

  return validationScreens;
}


/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NEW FUNCTION - Phase 3.7: Ordered Screens with Blocks Support
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Prepares screens for validation with:
 * - Screen ordering (order field)
 * - Per-screen navigation
 * - Block-based assertions (or fallback to legacy visible/hidden)
 * 
 * @param {object} mirrorsOnUI - mirrorsOn.UI object  
 * @param {string} platform - Platform key (web, dancer, clubApp, etc.)
 * @param {object} options - Additional options
 * @param {string} options.implFilePath - Path to implication file (for path calculation)
 * @param {boolean} options.isPlaywright - Whether this is Playwright (vs Appium)
 * @returns {object} { hasOrderedScreens, orderedScreens, usesBlocks }
 */
export function prepareOrderedScreensWithBlocks(mirrorsOnUI, platform, options = {}) {
  const result = {
    hasOrderedScreens: false,
    orderedScreens: [],
    usesBlocks: false,
    usesLegacy: false
  };
  
  // ✅ DEFENSIVE: Check all inputs
  if (!mirrorsOnUI || typeof mirrorsOnUI !== 'object') {
    console.warn('⚠️  prepareOrderedScreensWithBlocks: mirrorsOnUI is null or invalid');
    return result;
  }

  if (!platform) {
    console.warn('⚠️  prepareOrderedScreensWithBlocks: platform is null');
    return result;
  }

  const platformScreens = mirrorsOnUI[platform];
  
  if (!platformScreens || typeof platformScreens !== 'object') {
    console.warn(`⚠️  prepareOrderedScreensWithBlocks: No screens for platform ${platform}`);
    return result;
  }

  console.log(`\n🔄 prepareOrderedScreensWithBlocks for platform: ${platform}`);
  console.log(`   Found ${Object.keys(platformScreens).length} screen(s)`);

  const screens = [];

  for (const [screenKey, screenDef] of Object.entries(platformScreens)) {
    // ✅ Handle both array and object formats
    let screen;
    
    if (Array.isArray(screenDef)) {
      if (screenDef.length === 0) continue;
      screen = screenDef[0];
    } else if (typeof screenDef === 'object' && screenDef !== null) {
      screen = screenDef;
    } else {
      continue;
    }
    
    if (!screen || typeof screen !== 'object') continue;

    // ═══════════════════════════════════════════════════════════
    // Extract screen metadata
    // ═══════════════════════════════════════════════════════════
    
    const order = typeof screen.order === 'number' ? screen.order : 999;
    const hasBlocks = Array.isArray(screen.blocks) && screen.blocks.length > 0;
    const hasNavigation = screen.navigation && 
                          (screen.navigation.pomName || screen.navigation.method);
    
    console.log(`   📺 ${screenKey}: order=${order}, blocks=${hasBlocks}, nav=${hasNavigation}`);
    
    // Track if we're using blocks or legacy
    if (hasBlocks) result.usesBlocks = true;
    else result.usesLegacy = true;

    // ═══════════════════════════════════════════════════════════
    // Process navigation (if present)
    // ═══════════════════════════════════════════════════════════
    
    let navigation = null;
    
    if (hasNavigation) {
      const nav = screen.navigation;
      
      // Build instance name from POM name
      const instanceName = nav.pomName 
        ? toCamelCase(nav.pomName)
        : 'navigationScreen';
      
      // Resolve args (convert {{ctx.data.x}} → ctx.data.x)
      const resolvedArgs = (nav.args || []).map(arg => {
        if (typeof arg === 'string') {
          // {{ctx.data.agencyName}} → ctx.data.agencyName
          if (arg.startsWith('{{') && arg.endsWith('}}')) {
            return arg.slice(2, -2);
          }
          // ctx.data.x stays as-is
          if (arg.startsWith('ctx.data.')) {
            return arg;
          }
          // Literal string → wrap in quotes
          return `'${arg}'`;
        }
        return String(arg);
      });
      
      navigation = {
        pomName: nav.pomName,
        pomPath: nav.pomPath || null,  // May be set by discovery
        method: nav.method,
        args: nav.args || [],
        resolvedArgs: resolvedArgs,
        instanceName: instanceName,
        // For require path calculation
        className: nav.pomName ? toPascalCase(nav.pomName) : null
      };
      
      console.log(`      🧭 Navigation: ${navigation.instanceName}.${navigation.method}(${resolvedArgs.join(', ')})`);
    }

    // ═══════════════════════════════════════════════════════════
    // Process blocks (if present) OR fallback to legacy
    // ═══════════════════════════════════════════════════════════
    
    let processedBlocks = [];
    let legacyAssertions = null;
    
    if (hasBlocks) {
      // ✅ NEW: Process blocks array
      processedBlocks = processBlocks(screen.blocks, screenKey, options);
    } else {
      // ✅ LEGACY: Use visible/hidden/checks
      legacyAssertions = {
        visible: screen.visible || [],
        hidden: screen.hidden || [],
        checks: screen.checks || {}
      };
    }

    // ═══════════════════════════════════════════════════════════
    // Build screen object
    // ═══════════════════════════════════════════════════════════
    
    screens.push({
      // Identity
      screenKey,
      order,
      
      // POM info
      pomClassName: screen.screen ? toPascalCase(screen.screen.replace(/\./g, '')) : toPascalCase(screenKey),
      pomPath: screen._pomSource?.path || screen.screen || null,
      pomInstance: screen.instance || toCamelCase(screenKey),
      
      // Navigation (Phase 3.7)
      hasNavigation: !!navigation,
      navigation,
      
      // Blocks (Phase 3.7) vs Legacy
      hasBlocks,
      blocks: processedBlocks,
      
      // Legacy fallback
      hasLegacyAssertions: !!legacyAssertions,
      legacyAssertions,
      
      // Platform
      platformKey: platform,
      isPlaywright: options.isPlaywright !== false
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Sort by order
  // ═══════════════════════════════════════════════════════════
  
  screens.sort((a, b) => a.order - b.order);
  
  // Add 1-indexed position for display
  screens.forEach((screen, index) => {
    screen.position = index + 1;
    screen.totalScreens = screens.length;
  });

  result.hasOrderedScreens = screens.length > 0;
  result.orderedScreens = screens;
  
  console.log(`   ✅ Prepared ${screens.length} ordered screen(s)`);
  console.log(`   📊 Uses blocks: ${result.usesBlocks}, Uses legacy: ${result.usesLegacy}`);
  
  return result;
}


/**
 * Process blocks array into executable steps
 * 
 * Block types:
 * - ui-assertion: Generate expect() calls for visible/hidden
 * - function-call: Generate await instance.method(args)
 * - custom-code: Insert code directly
 * 
 * @param {Array} blocks - Array of block objects
 * @param {string} screenKey - Screen key for context
 * @param {object} options - Processing options
 * @returns {Array} Processed blocks ready for template
 */
function processBlocks(blocks, screenKey, options = {}) {
  if (!Array.isArray(blocks)) return [];
  
  const processed = [];
  
  // Filter enabled blocks and sort by order
  const enabledBlocks = blocks
    .filter(block => block.enabled !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  for (const block of enabledBlocks) {
    const blockType = block.type || 'ui-assertion';
    
    switch (blockType) {
      case 'ui-assertion': {
        // ═══════════════════════════════════════════════════════════
        // UI Assertion Block - visible/hidden checks
        // ═══════════════════════════════════════════════════════════
        const assertions = [];
        
        // Process visible fields
        if (Array.isArray(block.visible)) {
          for (const field of block.visible) {
            assertions.push({
              type: 'visible',
              field: field,
              locator: `${toCamelCase(screenKey)}.${field}`,
              expectMethod: options.isPlaywright !== false ? 'toBeVisible' : 'toBeDisplayed',
              timeout: block.timeout || 30000
            });
          }
        }
        
        // Process hidden fields
        if (Array.isArray(block.hidden)) {
          for (const field of block.hidden) {
            assertions.push({
              type: 'hidden',
              field: field,
              locator: `${toCamelCase(screenKey)}.${field}`,
              expectMethod: options.isPlaywright !== false ? 'toBeHidden' : 'not.toBeDisplayed',
              timeout: block.timeout || 30000
            });
          }
        }
        
        // Process text checks
        if (block.checks?.text && typeof block.checks.text === 'object') {
          for (const [field, expectedText] of Object.entries(block.checks.text)) {
            assertions.push({
              type: 'text',
              field: field,
              locator: `${toCamelCase(screenKey)}.${field}`,
              expectedText: expectedText,
              expectMethod: options.isPlaywright !== false ? 'toHaveText' : 'toHaveText',
              timeout: block.timeout || 30000
            });
          }
        }
        
        if (assertions.length > 0) {
          processed.push({
            blockType: 'ui-assertion',
            order: block.order || 0,
            description: block.description || `UI assertions for ${screenKey}`,
            assertions,
            assertionCount: assertions.length
          });
        }
        break;
      }
      
      case 'function-call': {
        // ═══════════════════════════════════════════════════════════
        // Function Call Block - await instance.method(args)
        // ═══════════════════════════════════════════════════════════
        if (!block.method) {
          console.warn(`⚠️  function-call block missing method in ${screenKey}`);
          continue;
        }
        
        // Resolve args
        const resolvedArgs = (block.args || []).map(arg => {
          if (typeof arg === 'string') {
            if (arg.startsWith('{{') && arg.endsWith('}}')) {
              return arg.slice(2, -2); // {{ctx.data.x}} → ctx.data.x
            }
            if (arg.startsWith('ctx.data.')) {
              return arg;
            }
            return `'${arg}'`; // Literal string
          }
          return String(arg);
        });
        
        processed.push({
          blockType: 'function-call',
          order: block.order || 0,
          description: block.description || `Call ${block.method}`,
          instance: block.instance || toCamelCase(screenKey),
          method: block.method,
          args: block.args || [],
          resolvedArgs,
          argsString: resolvedArgs.join(', '),
          storeAs: block.storeAs || null,
          awaitResult: block.await !== false
        });
        break;
      }
      
      case 'custom-code': {
        // ═══════════════════════════════════════════════════════════
        // Custom Code Block - insert code directly
        // ═══════════════════════════════════════════════════════════
        if (!block.code) {
          console.warn(`⚠️  custom-code block missing code in ${screenKey}`);
          continue;
        }
        
        processed.push({
          blockType: 'custom-code',
          order: block.order || 0,
          description: block.description || 'Custom code',
          code: block.code,
          // Indent each line for proper formatting
          formattedCode: block.code.split('\n').map(line => `  ${line}`).join('\n')
        });
        break;
      }
      
      default:
        console.warn(`⚠️  Unknown block type: ${blockType} in ${screenKey}`);
    }
  }
  
  return processed;
}


/**
 * Resolve template variable in navigation args
 * 
 * Converts:
 * - "{{ctx.data.agencyName}}" → "ctx.data.agencyName"
 * - "ctx.data.agencyName" → "ctx.data.agencyName"  
 * - "literal" → "'literal'"
 * 
 * @param {string} arg - Argument string
 * @returns {string} Resolved argument
 */
export function resolveNavigationArg(arg) {
  if (typeof arg !== 'string') return String(arg);
  
  // Template variable: {{ctx.data.x}} → ctx.data.x
  if (arg.startsWith('{{') && arg.endsWith('}}')) {
    return arg.slice(2, -2);
  }
  
  // Already a context reference
  if (arg.startsWith('ctx.data.') || arg.startsWith('result.data.')) {
    return arg;
  }
  
  // Literal string - wrap in quotes
  return `'${arg}'`;
}