// packages/web-app/src/utils/extractDataFlow.js
// 📊 Utility to extract data flow (reads/writes) from transition form data

/**
 * Extract all data reads and writes from transition form data
 * 
 * READS = What data must exist BEFORE this transition runs
 * WRITES = What data this transition CREATES or MODIFIES
 * 
 * @param {Object} formData - The transition form data
 * @returns {Object} { reads: [], writes: [], conditions: [], summary: {} }
 */
export function extractDataFlow(formData) {
  const reads = new Map();
  const writes = new Map();
  const conditions = [];
  
  const addRead = (field, source, required = false) => {
    if (!field || field === 'data') return;
    
    let cleanField = field
      .replace(/^ctx\.data\./, '')
      .replace(/^ctx\./, '')
      .replace(/^testData\./, '');
    
    if (!cleanField || cleanField === 'data') return;
    cleanField = cleanField.replace(/\[\d+\]/g, '[]');
    
    if (reads.has(cleanField)) {
      const existing = reads.get(cleanField);
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      existing.required = existing.required || required;
    } else {
      reads.set(cleanField, { sources: [source], required });
    }
  };
  
  const addWrite = (field, source, type = 'unknown') => {
    if (!field) return;
    const fieldName = typeof field === 'object' ? field.key : field;
    if (!fieldName) return;
    
    writes.set(fieldName, {
      source,
      type,
      persist: typeof field === 'object' ? field.persist !== false : true,
      global: typeof field === 'object' ? field.global === true : false
    });
  };
  
  // 1. Extract from CONDITIONS
  if (formData.conditions?.blocks) {
    formData.conditions.blocks.forEach((block, blockIdx) => {
      if (!block.enabled) return;
      
      if (block.type === 'condition-check' && block.data?.checks) {
        block.data.checks.forEach((check) => {
          if (check.field && check.enabled !== false) {
            addRead(check.field, `condition[${blockIdx}]`, true);
            conditions.push({
              field: check.field,
              operator: check.operator || 'equals',
              value: check.value,
              valueType: check.valueType,
              blockIndex: blockIdx,
              blockLabel: block.label
            });
          }
          
          if (check.valueType === 'variable' && check.value) {
            const varName = check.value.replace(/^\{\{|\}\}$/g, '');
            if (varName) addRead(varName, `condition[${blockIdx}].value`, false);
          }
        });
      }
      
      if (block.type === 'custom-code' && block.code) {
        const ctxMatches = block.code.match(/(?:ctx\.data|testData)\.(\w+(?:\.\w+)*)/g);
        ctxMatches?.forEach(match => {
          const field = match.replace(/^(ctx\.data|testData)\./, '');
          addRead(field, `condition[${blockIdx}].code`, true);
        });
      }
    });
  }
  
  // Legacy requires
  if (formData.requires && typeof formData.requires === 'object') {
    Object.entries(formData.requires).forEach(([key, value]) => {
      addRead(key, 'requires (legacy)', true);
      conditions.push({ field: key, operator: 'equals', value, legacy: true });
    });
  }
  
  // 2. Extract from IMPORTS
  if (formData.imports) {
    formData.imports.forEach((imp, idx) => {
      if (imp.constructor) {
        const ctxMatches = imp.constructor.match(/ctx\.data\.(\w+(?:\.\w+)*)/g);
        ctxMatches?.forEach(match => {
          addRead(match.replace('ctx.data.', ''), `import[${idx}] (${imp.className || 'constructor'})`);
        });
      }
    });
  }
  
  // 3. Extract from STEPS
  if (formData.steps) {
    formData.steps.forEach((step, idx) => {
      const stepLabel = step.description 
        ? `step[${idx}] "${step.description.slice(0, 20)}..."`
        : `step[${idx}]`;
      
      // Args array
      if (Array.isArray(step.args)) {
        step.args.forEach(arg => {
          if (typeof arg === 'string') extractReadsFromString(arg, `${stepLabel}.args`, addRead);
        });
      }
      
      // Args string
      if (typeof step.args === 'string') {
        extractReadsFromString(step.args, `${stepLabel}.args`, addRead);
      }
      
      // Value (fill steps)
      if (step.value && typeof step.value === 'string') {
        extractReadsFromString(step.value, `${stepLabel}.value`, addRead);
      }
      
      // Custom code
      if (step.code && typeof step.code === 'string') {
        extractReadsFromString(step.code, `${stepLabel}.code`, addRead);
      }
      
      // StoreAs = WRITE
      if (step.storeAs) {
        const returnType = step.selectedMethodReturns?.type || 
                          (step.type === 'getText' ? 'string' : 'unknown');
        addWrite(step.storeAs, stepLabel, returnType);
      }
      
      // Step conditions
      if (step.conditions?.blocks) {
        step.conditions.blocks.forEach((block, blockIdx) => {
          if (!block.enabled) return;
          if (block.type === 'condition-check' && block.data?.checks) {
            block.data.checks.forEach(check => {
              if (check.field && check.enabled !== false) {
                addRead(check.field, `${stepLabel}.condition[${blockIdx}]`, true);
              }
            });
          }
        });
      }
    });
  }
  
  // 4. Convert to arrays
  const readsArray = Array.from(reads.entries()).map(([field, data]) => ({
    field,
    ...data,
    isNested: field.includes('.'),
    rootField: field.split('.')[0].replace('[]', ''),
    hasArrayAccess: field.includes('[]')
  }));
  
  const writesArray = Array.from(writes.entries()).map(([field, data]) => ({
    field,
    ...data
  }));
  
  const groupedReads = {};
  readsArray.forEach(read => {
    const root = read.rootField;
    if (!groupedReads[root]) groupedReads[root] = [];
    groupedReads[root].push(read);
  });
  
  return {
    reads: readsArray,
    writes: writesArray,
    conditions,
    grouped: groupedReads,
    summary: {
      totalReads: readsArray.length,
      requiredReads: readsArray.filter(r => r.required).length,
      totalWrites: writesArray.length,
      hasConditions: conditions.length > 0,
      rootFields: Object.keys(groupedReads)
    }
  };
}

function extractReadsFromString(str, source, addRead) {
  if (!str || typeof str !== 'string') return;
  
  const ctxMatches = str.match(/ctx\.data\.(\w+(?:\.\w+)*(?:\[\d+\])?(?:\.\w+)*)/g);
  ctxMatches?.forEach(match => addRead(match.replace('ctx.data.', ''), source));
  
  const templateMatches = str.match(/\{\{(\w+(?:\.\w+)*)\}\}/g);
  templateMatches?.forEach(match => addRead(match.replace(/\{\{|\}\}/g, ''), `${source} (stored var)`));
  
  const testDataMatches = str.match(/testData\.(\w+(?:\.\w+)*)/g);
  testDataMatches?.forEach(match => addRead(match.replace('testData.', ''), source));
}

export function validateDataFlow(dataFlow, testDataSchema = [], availableFromPriorStates = []) {
  const schemaFields = new Set();
  testDataSchema.forEach(f => {
    const name = typeof f === 'string' ? f : (f.key || f.name || '');
    if (name) schemaFields.add(name);
  });
  
  const storedVars = new Set();
  availableFromPriorStates.forEach(v => {
    const name = typeof v === 'string' ? v : (v.name || v.field || '');
    if (name) storedVars.add(name);
  });
  
  dataFlow.writes.forEach(w => storedVars.add(w.field));
  
  const valid = [], missing = [], warnings = [], fromStored = [];
  
  dataFlow.reads.forEach(read => {
    if (schemaFields.has(read.field) || schemaFields.has(read.rootField)) {
      valid.push({ ...read, source: 'testData' });
    } else if (storedVars.has(read.field) || storedVars.has(read.rootField)) {
      fromStored.push({ ...read, source: 'stored' });
    } else if (['lang', 'device', 'config', 'status', 'baseUrl'].some(p => read.field.toLowerCase().includes(p))) {
      warnings.push({ ...read, message: `'${read.field}' looks like a config field` });
    } else {
      missing.push(read);
    }
  });
  
  return { valid, missing, warnings, fromStored };
}

export default extractDataFlow;