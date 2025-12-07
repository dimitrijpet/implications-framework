// packages/web-app/src/utils/extractDataFlow.js
// Utility to extract testData reads and writes from transition formData

/**
 * Safely extract reads from a string value
 * Handles null, undefined, and non-string inputs
 */
function extractReadsFromString(str) {
  if (!str || typeof str !== 'string') return [];
  
  const reads = [];
  const patterns = [
    /ctx\.data\.([a-zA-Z_][\w.[\]]*)/g,      // ctx.data.field
    /testData\.([a-zA-Z_][\w.[\]]*)/g,        // testData.field  
    /\{\{([a-zA-Z_][\w.]*)\}\}/g,             // {{variable}}
  ];
  
  patterns.forEach(pattern => {
    let match;
    // Reset regex lastIndex to avoid issues with global flag
    pattern.lastIndex = 0;
    while ((match = pattern.exec(str)) !== null) {
      const field = match[1];
      // Normalize array access: passengers.adults[0] → passengers.adults[]
      const normalized = field.replace(/\[\d+\]/g, '[]');
      if (!reads.includes(normalized)) {
        reads.push(normalized);
      }
    }
  });
  
  return reads;
}

/**
 * Safely convert a value to string for extraction
 */
function safeStringify(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Get the root field name (first part before any dots or brackets)
 */
function getRootField(field) {
  if (!field || typeof field !== 'string') return '';
  return field.split(/[.\[]/)[0];
}

/**
 * Extract data flow from transition formData
 * @param {Object} formData - The form data from AddTransitionModal
 * @returns {Object} { reads, writes, conditions, grouped, summary }
 */
export function extractDataFlow(formData) {
  if (!formData || typeof formData !== 'object') {
    return {
      reads: [],
      writes: [],
      conditions: [],
      grouped: {},
      summary: {
        totalReads: 0,
        requiredReads: 0,
        totalWrites: 0,
        hasConditions: false
      }
    };
  }

  const reads = [];
  const writes = [];
  const conditions = [];
  
  const addRead = (field, source, required = false) => {
    if (!field || typeof field !== 'string') return;
    
    const existing = reads.find(r => r.field === field);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      if (required) existing.required = true;
    } else {
      reads.push({
        field,
        sources: [source],
        required,
        isNested: field.includes('.'),
        rootField: getRootField(field)
      });
    }
  };
  
  const addWrite = (field, source, type = 'unknown', persist = true, global = false) => {
    if (!field || typeof field !== 'string') return;
    
    if (!writes.find(w => w.field === field)) {
      writes.push({ field, source, type, persist, global });
    }
  };
  
  // 1. Extract from conditions (these are REQUIRED)
  if (formData.conditions?.blocks && Array.isArray(formData.conditions.blocks)) {
    formData.conditions.blocks.forEach((block, blockIdx) => {
      if (!block || !block.enabled) return;
      
      if (block.type === 'condition-check' && block.data?.checks && Array.isArray(block.data.checks)) {
        block.data.checks.forEach((check, checkIdx) => {
          if (check?.field && typeof check.field === 'string') {
            // Remove ctx.data. prefix if present
            const cleanField = check.field.replace(/^ctx\.data\./, '');
            addRead(cleanField, `condition[${blockIdx}].check[${checkIdx}]`, true);
            conditions.push({
              field: cleanField,
              operator: check.operator,
              value: check.value
            });
          }
        });
      } else if (block.type === 'custom-code' && block.data?.code && typeof block.data.code === 'string') {
        // Extract reads from custom code
        const codeReads = extractReadsFromString(block.data.code);
        codeReads.forEach(field => {
          addRead(field, `condition[${blockIdx}].code`, true);
        });
      }
    });
  }
  
  // 2. Extract from legacy requires (also required)
  if (formData.requires && typeof formData.requires === 'object' && !Array.isArray(formData.requires)) {
    Object.keys(formData.requires).forEach(key => {
      if (typeof key === 'string') {
        addRead(key, 'requires', true);
        conditions.push({
          field: key,
          operator: 'equals',
          value: formData.requires[key]
        });
        
        // Also extract from the value if it references ctx.data
        const valueStr = safeStringify(formData.requires[key]);
        const valueReads = extractReadsFromString(valueStr);
        valueReads.forEach(field => {
          addRead(field, `requires.${key}.value`, true);
        });
      }
    });
  }
  
  // 3. Extract from imports (constructors)
  if (formData.imports && Array.isArray(formData.imports)) {
    formData.imports.forEach((imp, impIdx) => {
      if (!imp || typeof imp !== 'object') return;
      
      // Handle constructor - could be string or other format
      if (imp.constructor && typeof imp.constructor === 'string') {
        const constructorReads = extractReadsFromString(imp.constructor);
        constructorReads.forEach(field => {
          addRead(field, `import[${impIdx}].constructor`, false);
        });
      }
      
      // Also check path for any embedded data references
      if (imp.path && typeof imp.path === 'string') {
        const pathReads = extractReadsFromString(imp.path);
        pathReads.forEach(field => {
          addRead(field, `import[${impIdx}].path`, false);
        });
      }
    });
  }
  
  // 4. Extract from steps
  if (formData.steps && Array.isArray(formData.steps)) {
    formData.steps.forEach((step, stepIdx) => {
      if (!step || typeof step !== 'object') return;
      
      const stepSource = `step[${stepIdx}]`;
      
      // Args (array or string)
      if (step.args !== undefined && step.args !== null) {
        let argsArray = [];
        
        if (Array.isArray(step.args)) {
          argsArray = step.args;
        } else if (typeof step.args === 'string') {
          argsArray = [step.args];
        } else {
          // Try to stringify if it's something else
          const strVal = safeStringify(step.args);
          if (strVal) argsArray = [strVal];
        }
        
        argsArray.forEach((arg, argIdx) => {
          const argStr = typeof arg === 'string' ? arg : safeStringify(arg);
          const argReads = extractReadsFromString(argStr);
          argReads.forEach(field => {
            addRead(field, `${stepSource}.args[${argIdx}]`, false);
          });
        });
      }
      
      // ArgsArray (alternative format)
      if (step.argsArray && Array.isArray(step.argsArray)) {
        step.argsArray.forEach((arg, argIdx) => {
          const argStr = typeof arg === 'string' ? arg : safeStringify(arg);
          const argReads = extractReadsFromString(argStr);
          argReads.forEach(field => {
            addRead(field, `${stepSource}.argsArray[${argIdx}]`, false);
          });
        });
      }
      
      // Value (for fill steps)
      if (step.value !== undefined && step.value !== null) {
        const valueStr = typeof step.value === 'string' ? step.value : safeStringify(step.value);
        const valueReads = extractReadsFromString(valueStr);
        valueReads.forEach(field => {
          addRead(field, `${stepSource}.value`, false);
        });
      }
      
      // Code (for custom steps)
      if (step.code && typeof step.code === 'string') {
        const codeReads = extractReadsFromString(step.code);
        codeReads.forEach(field => {
          addRead(field, `${stepSource}.code`, false);
        });
      }
      
      // Selector (might contain data references)
      if (step.selector && typeof step.selector === 'string') {
        const selectorReads = extractReadsFromString(step.selector);
        selectorReads.forEach(field => {
          addRead(field, `${stepSource}.selector`, false);
        });
      }
      
      // StoreAs (WRITES)
      if (step.storeAs) {
        let storeAsKey = null;
        let persist = true;
        let global = false;
        
        if (typeof step.storeAs === 'string') {
          storeAsKey = step.storeAs;
        } else if (typeof step.storeAs === 'object' && step.storeAs !== null) {
          storeAsKey = step.storeAs.key;
          persist = step.storeAs.persist !== false;
          global = step.storeAs.global === true;
        }
        
        if (storeAsKey && typeof storeAsKey === 'string') {
          // Determine type from method if possible
          let type = 'unknown';
          if (step.method && typeof step.method === 'string') {
            const methodLower = step.method.toLowerCase();
            if (methodLower.includes('get')) type = 'getter';
            if (methodLower.includes('text')) type = 'string';
            if (methodLower.includes('count')) type = 'number';
            if (methodLower.includes('list')) type = 'array';
          }
          if (step.type === 'getText') type = 'string';
          
          addWrite(storeAsKey, `${stepSource}.storeAs`, type, persist, global);
        }
      }
      
      // Step conditions (nested)
      if (step.conditions?.blocks && Array.isArray(step.conditions.blocks)) {
        step.conditions.blocks.forEach((block, blockIdx) => {
          if (!block || !block.enabled) return;
          
          if (block.type === 'condition-check' && block.data?.checks && Array.isArray(block.data.checks)) {
            block.data.checks.forEach((check, checkIdx) => {
              if (check?.field && typeof check.field === 'string') {
                const cleanField = check.field.replace(/^ctx\.data\./, '');
                addRead(cleanField, `${stepSource}.condition[${blockIdx}].check[${checkIdx}]`, false);
              }
            });
          } else if (block.type === 'custom-code' && block.data?.code && typeof block.data.code === 'string') {
            const codeReads = extractReadsFromString(block.data.code);
            codeReads.forEach(field => {
              addRead(field, `${stepSource}.condition[${blockIdx}].code`, false);
            });
          }
        });
      }
    });
  }
  
  // 5. Extract from actionDetails if present (for transitions loaded from files)
  if (formData.actionDetails && typeof formData.actionDetails === 'object') {
    // Recursively extract from actionDetails
    const nestedFlow = extractDataFlow({
      imports: formData.actionDetails.imports,
      steps: formData.actionDetails.steps,
      requires: formData.actionDetails.requires,
      conditions: formData.actionDetails.conditions
    });
    
    // Merge nested reads and writes
    nestedFlow.reads.forEach(r => {
      addRead(r.field, `actionDetails.${r.sources[0]}`, r.required);
    });
    nestedFlow.writes.forEach(w => {
      addWrite(w.field, `actionDetails.${w.source}`, w.type, w.persist, w.global);
    });
    nestedFlow.conditions.forEach(c => {
      if (!conditions.find(ec => ec.field === c.field)) {
        conditions.push(c);
      }
    });
  }
  
  // Group reads by root field
  const grouped = {};
  reads.forEach(read => {
    const root = read.rootField;
    if (root) {
      if (!grouped[root]) {
        grouped[root] = [];
      }
      grouped[root].push(read);
    }
  });
  
  return {
    reads,
    writes,
    conditions,
    grouped,
    summary: {
      totalReads: reads.length,
      requiredReads: reads.filter(r => r.required).length,
      totalWrites: writes.length,
      hasConditions: conditions.length > 0
    }
  };
}

/**
 * Validate data flow against testData schema and stored variables
 * @param {Object} dataFlow - Result from extractDataFlow
 * @param {Array} testDataSchema - Schema from config [{ name, key, type, ... }]
 * @param {Array} availableFromPriorStates - Variables from storeAs in prior transitions
 * @returns {Object} { valid, missing, warnings, fromStored }
 */
export function validateDataFlow(dataFlow, testDataSchema = [], availableFromPriorStates = []) {
  if (!dataFlow || !dataFlow.reads) {
    return { valid: [], missing: [], warnings: [], fromStored: [] };
  }

  const schemaFields = new Set();
  const schemaRoots = new Set();
  
  // Build schema lookup
  if (Array.isArray(testDataSchema)) {
    testDataSchema.forEach(field => {
      if (!field) return;
      const key = field.key || (field.name ? field.name.replace(/^ctx\.data\./, '') : null);
      if (key && typeof key === 'string') {
        schemaFields.add(key);
        schemaRoots.add(getRootField(key));
      }
    });
  }
  
  // Build stored variables lookup
  const storedVars = new Set();
  if (Array.isArray(availableFromPriorStates)) {
    availableFromPriorStates.forEach(v => {
      if (!v) return;
      const varName = typeof v === 'string' ? v : (v.name || v.path || v.key);
      if (varName && typeof varName === 'string') {
        storedVars.add(varName);
      }
    });
  }
  
  const valid = [];
  const missing = [];
  const warnings = [];
  const fromStored = [];
  
  // Known config/common fields that shouldn't trigger warnings
  const commonFields = new Set([
    'lang', 'device', 'baseUrl', 'config', 'status', 'environment',
    'platform', 'timeout', 'retries', 'page', 'browser', 'context'
  ]);
  
  dataFlow.reads.forEach(read => {
    if (!read || !read.field) return;
    
    const field = read.field;
    const root = read.rootField || getRootField(field);
    
    // Check if it's in testData schema
    if (schemaFields.has(field) || schemaRoots.has(root)) {
      valid.push({ ...read, source: 'testData' });
    }
    // Check if it's from a stored variable
    else if (storedVars.has(field) || storedVars.has(root)) {
      fromStored.push({ ...read, source: 'stored' });
    }
    // Check if it's a common config field
    else if (commonFields.has(root)) {
      warnings.push({ ...read, reason: 'Looks like config field, verify it exists' });
    }
    // It's missing
    else {
      missing.push({ ...read, reason: 'Not found in testData schema or stored variables' });
    }
  });
  
  return {
    valid,
    missing,
    warnings,
    fromStored
  };
}

export default { extractDataFlow, validateDataFlow };