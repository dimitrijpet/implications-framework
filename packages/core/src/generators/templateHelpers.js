/**
 * Helper: Prepare UI Validation Data for Template
 * 
 * This processes mirrorsOn screens and separates:
 * - Regular fields (direct POM properties)
 * - Function calls (need to be called and stored)
 * - Which checks reference which functions
 */

function prepareValidationScreens(mirrorsOnUI, platform, testData) {
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
      // ✅ FIX: Convert "passengers.field" → "PassengersField"
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

/**
 * Helper: Convert to PascalCase
 */
function toPascalCase(str) {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .split(/[-_.\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Handlebars helper: Convert to PascalCase
 */
function pascalCaseHelper(str) {
  return toPascalCase(str);
}

export {
  prepareValidationScreens,
  pascalCaseHelper
};