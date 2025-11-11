// packages/core/src/generators/templateHelpers.js

/**
 * Template Helpers for Handlebars
 * 
 * Provides utility functions for template rendering including:
 * - String transformations (PascalCase, camelCase, snake_case)
 * - UI validation data preparation
 * - String utilities (contains, replace)
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

  for (const [screenKey, screenArray] of Object.entries(platformScreens)) {
    // ✅ DEFENSIVE: Check if array
    if (!Array.isArray(screenArray)) {
      console.warn(`⚠️  Screen ${screenKey} is not an array, skipping`);
      continue;
    }
    
    if (screenArray.length === 0) {
      console.warn(`⚠️  Screen ${screenKey} array is empty, skipping`);
      continue;
    }

    const screen = screenArray[0]; // Take first screen definition
    
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
  platformKey: platform,  // ✅ ADD THIS LINE!
  pomClassName: screen.screen && typeof screen.screen === 'string' 
    ? toPascalCase(screen.screen.replace(/\./g, '')) 
    : null,
      
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