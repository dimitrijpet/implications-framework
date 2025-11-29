// packages/web-app/src/components/UIScreenEditor/variableUtils.js
// Utilities for collecting and managing stored variables across blocks
//
// QA Pattern: Variables stored in earlier blocks should be available in later blocks
// Example: Block 1 stores "flightData", Block 2+ can use {{flightData}} or {{flightData.price}}

/**
 * Collect all stored variables from blocks UP TO a certain index
 * This ensures each block only sees variables from PREVIOUS blocks
 * 
 * @param {Array} blocks - All blocks in order
 * @param {number} upToIndex - Collect variables from blocks before this index (-1 for all)
 * @param {Function} getMethodReturnKeys - Function to get return keys for a method
 * @returns {Array} Array of variable objects with metadata
 * 
 * Example return:
 * [
 *   { 
 *     name: 'flightData', 
 *     source: 'Function 1',
 *     sourceBlockId: 'blk_func_123',
 *     type: 'function-result',
 *     returnKeys: ['index', 'price', 'flightNumber'],  // If known
 *     nested: [
 *       { name: 'flightData.index', type: 'nested-key' },
 *       { name: 'flightData.price', type: 'nested-key' },
 *       { name: 'flightData.flightNumber', type: 'nested-key' }
 *     ]
 *   }
 * ]
 */
export function collectStoredVariables(blocks, upToIndex = -1, getMethodReturnKeys = null) {
  const variables = [];
  const maxIndex = upToIndex === -1 ? blocks.length : upToIndex;
  
  for (let i = 0; i < maxIndex; i++) {
    const block = blocks[i];
    
    // Only function-call blocks can store variables
    if (block.type !== 'function-call') continue;
    if (!block.enabled) continue; // Skip disabled blocks
    
    const storeAs = block.data?.storeAs;
    if (!storeAs) continue;
    
    const variable = {
      name: storeAs,
      source: block.label || `Block ${i + 1}`,
      sourceBlockId: block.id,
      sourceMethod: block.data?.method,
      sourceInstance: block.data?.instance,
      type: 'function-result',
      blockOrder: block.order,
      returnKeys: [],
      nested: []
    };
    
    // Try to get return keys if we have the function
    if (getMethodReturnKeys && block.data?.instance && block.data?.method) {
      const keys = getMethodReturnKeys(block.data.instance, block.data.method);
      if (keys && keys.length > 0) {
        variable.returnKeys = keys;
        variable.nested = keys.map(key => ({
          name: `${storeAs}.${key}`,
          type: 'nested-key',
          parentVariable: storeAs,
          key: key
        }));
      }
    }
    
    variables.push(variable);
  }
  
  return variables;
}

/**
 * Flatten variables for simple autocomplete
 * Returns array of strings: ['flightData', 'flightData.index', 'flightData.price', ...]
 */
export function flattenVariables(variables) {
  const flat = [];
  
  for (const v of variables) {
    flat.push(v.name);
    if (v.nested) {
      for (const nested of v.nested) {
        flat.push(nested.name);
      }
    }
  }
  
  return flat;
}

/**
 * Get variable suggestions for autocomplete dropdown
 * Returns objects with value, label, description for AutocompleteInput
 */
export function getVariableSuggestions(variables) {
  const suggestions = [];
  
  for (const v of variables) {
    // Add the main variable
    suggestions.push({
      value: `{{${v.name}}}`,
      label: v.name,
      description: `from ${v.source}`,
      icon: '💾',
      type: 'stored-variable',
      category: 'Variables'
    });
    
    // Add nested keys if available
    if (v.nested && v.nested.length > 0) {
      for (const nested of v.nested) {
        suggestions.push({
          value: `{{${nested.name}}}`,
          label: nested.name,
          description: `${nested.key} from ${v.source}`,
          icon: '📎',
          type: 'nested-variable',
          category: 'Variables'
        });
      }
    }
  }
  
  return suggestions;
}

/**
 * Format a variable reference for display
 * Highlights the {{variable}} parts in a string
 */
export function parseVariableReferences(text) {
  if (typeof text !== 'string') return [{ type: 'text', value: String(text) }];
  
  const parts = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: text.slice(lastIndex, match.index)
      });
    }
    
    // Add the variable reference
    parts.push({
      type: 'variable',
      value: match[0],       // {{variableName}}
      name: match[1],        // variableName
      isNested: match[1].includes('.')
    });
    
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      value: text.slice(lastIndex)
    });
  }
  
  return parts.length > 0 ? parts : [{ type: 'text', value: text }];
}

/**
 * Validate that all variable references in a value exist
 * Returns { valid: boolean, missing: string[] }
 */
export function validateVariableReferences(value, availableVariables) {
  if (typeof value !== 'string') return { valid: true, missing: [] };
  
  const flatVars = flattenVariables(availableVariables);
  const regex = /\{\{([^}]+)\}\}/g;
  const missing = [];
  let match;
  
  while ((match = regex.exec(value)) !== null) {
    const varName = match[1];
    if (!flatVars.includes(varName)) {
      missing.push(varName);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Get TestData field suggestions
 * This would connect to your test data schema
 * 
 * @param {Object} testDataSchema - Schema of available test data fields
 * @returns {Array} Suggestions for autocomplete
 */
export function getTestDataSuggestions(testDataSchema = null) {
  // Default common fields - in future this comes from actual schema
  const commonFields = [
    { name: 'agencyName', description: 'Selected agency name' },
    { name: 'flightType', description: 'one-way, round-trip, multi-city' },
    { name: 'locations', description: 'Origin/destination array' },
    { name: 'noOfPax', description: 'Number of passengers' },
    { name: 'lang', description: 'Language code' },
    { name: 'device', description: 'desktop, mobile, tablet' },
    { name: 'dates', description: 'Travel dates' },
    { name: 'passengers', description: 'Passenger details array' },
  ];
  
  // If we have actual schema, use that
  if (testDataSchema && typeof testDataSchema === 'object') {
    return Object.entries(testDataSchema).map(([key, info]) => ({
      value: `{{ctx.data.${key}}}`,
      label: `ctx.data.${key}`,
      description: info.description || key,
      icon: '📋',
      type: 'test-data',
      category: 'Test Data'
    }));
  }
  
  // Otherwise use common fields
  return commonFields.map(field => ({
    value: `{{ctx.data.${field.name}}}`,
    label: `ctx.data.${field.name}`,
    description: field.description,
    icon: '📋',
    type: 'test-data',
    category: 'Test Data'
  }));
}

/**
 * Combine all variable sources into one suggestions list
 * Groups by category for nice dropdown display
 */
export function getAllVariableSuggestions(storedVariables, testDataSchema = null) {
  const stored = getVariableSuggestions(storedVariables);
  const testData = getTestDataSuggestions(testDataSchema);
  
  return [
    ...stored,
    ...testData
  ];
}