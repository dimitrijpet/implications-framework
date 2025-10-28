/**
 * Helper: Prepare UI Validation Data for Template
 * 
 * This processes mirrorsOn screens and separates:
 * - Regular fields (direct POM properties)
 * - Function calls (need to be called and stored)
 * - Which checks reference which functions
 */

function prepareValidationScreens(mirrorsOnUI, platform, testData) {
  if (!mirrorsOnUI || !mirrorsOnUI[platform]) {
    return [];
  }

  const platformScreens = mirrorsOnUI[platform];
  const validationScreens = [];

  for (const [screenKey, screenArray] of Object.entries(platformScreens)) {
    if (!Array.isArray(screenArray) || screenArray.length === 0) continue;

    const screen = screenArray[0]; // Take first screen definition
    
    // Extract functions
    const functions = screen.functions || {};
    const functionNames = Object.keys(functions);
    
    // Process visible checks
    const visibleAll = [
      ...(screen.visible || []),
      ...(screen.checks?.visible || [])
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
    
    // Process hidden checks
    const hiddenAll = [
      ...(screen.hidden || []),
      ...(screen.checks?.hidden || [])
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
    
    // Process text checks
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
      const parameterValues = [];
      
      // Resolve parameters from testData
      for (const [paramName, paramValue] of Object.entries(funcData.parameters || {})) {
        let resolvedValue = paramValue;
        
        // Check if it's a template reference like {{email}}
        if (typeof paramValue === 'string' && paramValue.startsWith('{{') && paramValue.endsWith('}}')) {
          const fieldName = paramValue.slice(2, -2); // Remove {{ and }}
          resolvedValue = testData[fieldName] || paramValue; // Fallback to original if not found
          
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
        signature: funcData.signature,
        parameterValues
      });
    }
    
    // Build screen validation object
    validationScreens.push({
      screenKey,
      // ✅ FIX: Convert "passengers.field" → "PassengersField"
      pomClassName: screen.screen ? toPascalCase(screen.screen.replace(/\./g, '')) : null,
      
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