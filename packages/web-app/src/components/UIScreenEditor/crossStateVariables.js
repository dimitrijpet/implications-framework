// packages/web-app/src/components/UIScreenEditor/crossStateVariables.js
// ✅ PHASE 3.6: Cross-State Variable Collection
//
// Collects variables from:
// 1. Previous blocks in current screen (same as before)
// 2. Incoming transition's actionDetails steps (storeAs)
// 3. Incoming transition's imports (varName - the instances)
// 4. Previous states in the chain (if state machine path available)
// 5. TestData / ctx.data fields (from config - no hardcoded defaults!)

/**
 * Collect variables from a transition's actionDetails
 * 
 * @param {Object} transition - Transition object with actionDetails
 * @returns {Array} Variables available from this transition
 */
export function collectVariablesFromTransition(transition) {
  const variables = [];
  
  if (!transition?.actionDetails) {
    if (transition?.event) {
      console.log(`⚠️ Transition ${transition.event} has no actionDetails (discovery format)`);
    }
    return variables;
  }
  
  const { imports = [], steps = [] } = transition.actionDetails;
  
  // 1. Collect imported instances (varName)
  imports.forEach(imp => {
    if (imp.varName) {
      variables.push({
        name: imp.varName,
        type: 'instance',
        source: `Transition: ${transition.event}`,
        sourceType: 'transition-import',
        description: `${imp.className} instance`,
        className: imp.className,
        path: imp.path
      });
    }
  });
  
  // 2. Collect storeAs from steps
  steps.forEach((step, index) => {
    if (step.storeAs) {
      variables.push({
        name: step.storeAs,
        type: 'function-result',
        source: `Transition: ${transition.event}`,
        sourceType: 'transition-step',
        description: `Result of ${step.instance}.${step.method}()`,
        method: step.method,
        instance: step.instance,
        stepIndex: index,
        returnKeys: step.returnKeys || [],
        nested: (step.returnKeys || []).map(key => ({
          name: `${step.storeAs}.${key}`,
          type: 'nested-key',
          parentVariable: step.storeAs,
          key
        }))
      });
    }
  });
  
  return variables;
}

/**
 * Collect variables from state's xstateConfig.meta
 */
export function collectVariablesFromStateMeta(xstateConfig) {
  const variables = [];
  const meta = xstateConfig?.meta || {};
  
  if (meta.availableVariables && Array.isArray(meta.availableVariables)) {
    meta.availableVariables.forEach(varDef => {
      if (typeof varDef === 'string') {
        variables.push({
          name: varDef,
          type: 'declared',
          source: 'State meta',
          sourceType: 'state-meta'
        });
      } else if (varDef.name) {
        variables.push({
          ...varDef,
          source: 'State meta',
          sourceType: 'state-meta'
        });
      }
    });
  }
  
  return variables;
}

/**
 * Trace the state machine path backwards and collect all variables
 */
export function collectVariablesFromStateChain(
  currentStateName,
  allStates,
  transitions,
  maxDepth = 10
) {
  const variables = [];
  const visited = new Set();
  
  function traceBack(stateName, depth) {
    if (depth > maxDepth) return;
    if (visited.has(stateName)) return;
    visited.add(stateName);
    
    const incomingTransitions = transitions.filter(t => 
      t.target === stateName || t.to === stateName
    );
    
    incomingTransitions.forEach(transition => {
      const transVars = collectVariablesFromTransition(transition);
      transVars.forEach(v => {
        v.chainDepth = depth;
        v.fromState = transition.from || transition.source;
        variables.push(v);
      });
      
      const sourceStateName = transition.from || transition.source;
      const sourceState = allStates.get?.(sourceStateName) || allStates[sourceStateName];
      
      if (sourceState) {
        const stateVars = collectVariablesFromState(sourceState, sourceStateName);
        stateVars.forEach(v => {
          v.chainDepth = depth + 1;
          v.fromState = sourceStateName;
          variables.push(v);
        });
        
        traceBack(sourceStateName, depth + 1);
      }
    });
  }
  
  traceBack(currentStateName, 0);
  
  variables.sort((a, b) => (a.chainDepth || 0) - (b.chainDepth || 0));
  
  const seen = new Set();
  return variables.filter(v => {
    if (seen.has(v.name)) return false;
    seen.add(v.name);
    return true;
  });
}

/**
 * Collect variables from a state's UI blocks
 */
export function collectVariablesFromState(stateConfig, stateName) {
  const variables = [];
  
  const ui = stateConfig?.mirrorsOn?.UI || stateConfig?.UI;
  if (!ui) return variables;
  
  Object.entries(ui).forEach(([platform, screens]) => {
    if (!screens || typeof screens !== 'object') return;
    
    Object.entries(screens).forEach(([screenName, screenConfig]) => {
      const configs = Array.isArray(screenConfig) ? screenConfig : [screenConfig];
      
      configs.forEach(config => {
        const blocks = config?.blocks || [];
        
        blocks.forEach(block => {
          if (block.type === 'function-call' && block.data?.storeAs && block.enabled !== false) {
            variables.push({
              name: block.data.storeAs,
              type: 'function-result',
              source: `${stateName} → ${screenName}`,
              sourceType: 'state-block',
              sourceState: stateName,
              sourceScreen: screenName,
              sourcePlatform: platform,
              method: block.data.method,
              instance: block.data.instance,
              returnKeys: block.data.returnKeys || [],
              nested: (block.data.returnKeys || []).map(key => ({
                name: `${block.data.storeAs}.${key}`,
                type: 'nested-key',
                parentVariable: block.data.storeAs,
                key
              }))
            });
          }
        });
      });
    });
  });
  
  return variables;
}

/**
 * Get incoming transitions for a state
 */
export function getIncomingTransitions(stateName, allTransitions) {
  return allTransitions.filter(t => {
    const target = (t.target || t.to || '').toLowerCase();
    return target === stateName.toLowerCase();
  });
}

/**
 * Enrich discovery transitions with actionDetails from source state config
 */
export function enrichTransitionsWithActionDetails(transitions, allStates) {
  return transitions.map(t => {
    const enriched = { ...t };
    
    const sourceState = allStates[t.from];
    
    if (!sourceState) {
      console.log(`⚠️ Source state "${t.from}" not found for transition ${t.event}`);
      return enriched;
    }
    
    const xstateConfig = sourceState.xstateConfig || sourceState.meta?.xstateConfig;
    const on = xstateConfig?.on || {};
    const transitionDef = on[t.event];
    
    if (!transitionDef) {
      console.log(`⚠️ Transition "${t.event}" not found in ${t.from}'s xstateConfig.on`);
      return enriched;
    }
    
    if (Array.isArray(transitionDef)) {
      const variant = transitionDef.find(v => 
        v.target === t.to || v.target?.toLowerCase() === t.to?.toLowerCase()
      );
      if (variant?.actionDetails) {
        enriched.actionDetails = variant.actionDetails;
        console.log(`✅ Found actionDetails for ${t.event} (array variant)`);
      }
    } else if (transitionDef.actionDetails) {
      enriched.actionDetails = transitionDef.actionDetails;
      console.log(`✅ Found actionDetails for ${t.event}`);
    }
    
    return enriched;
  });
}

/**
 * Convert test data schema (from API) to variable format
 * 
 * @param {Array} schema - Schema from /api/config/test-data-schema
 * @returns {Array} Variables in standard format
 */
export function testDataSchemaToVariables(schema = []) {
  if (!Array.isArray(schema) || schema.length === 0) {
    return [];
  }
  
  return schema.map(field => ({
    name: field.name,  // Already prefixed with ctx.data.
    type: 'test-data',
    source: 'Test Data',
    sourceType: 'test-data',
    description: field.description || field.key,
    dataType: field.type,
    values: field.values,  // For enums
    required: field.required
  }));
}

/**
 * Main function: Collect ALL available variables for a screen
 * 
 * @param {Object} options
 * @param {Array} options.blocks - Blocks in current screen
 * @param {number} options.currentBlockIndex - Current block position
 * @param {Object} options.incomingTransition - Transition that led to this state
 * @param {Object} options.stateConfig - Current state's full config
 * @param {Array} options.allTransitions - All transitions
 * @param {Object} options.allStates - All states map
 * @param {Function} options.getMethodReturnKeys - Function to get return keys
 * @param {Array} options.testDataSchema - Schema from API (not hardcoded!)
 * @returns {Object} Categorized variables
 */
export function collectAllVariables({
  blocks = [],
  currentBlockIndex = -1,
  incomingTransition = null,
  stateConfig = null,
  allTransitions = [],
  allStates = {},
  getMethodReturnKeys = null,
  testDataSchema = []  // ✅ Now expects array from API, no defaults!
}) {
  const result = {
    fromPreviousBlocks: [],
    fromIncomingTransition: [],
    fromPreviousStates: [],
    fromTestData: [],
    all: []
  };
  
  // 1. Collect from previous blocks (same screen)
  if (blocks.length > 0 && currentBlockIndex > 0) {
    for (let i = 0; i < currentBlockIndex; i++) {
      const block = blocks[i];
      if (block.type !== 'function-call') continue;
      if (!block.enabled) continue;
      if (!block.data?.storeAs) continue;
      
      const variable = {
        name: block.data.storeAs,
        type: 'function-result',
        source: block.label || `Block ${i + 1}`,
        sourceType: 'current-screen-block',
        method: block.data.method,
        instance: block.data.instance,
        returnKeys: [],
        nested: []
      };
      
      if (getMethodReturnKeys && block.data.instance && block.data.method) {
        const keys = getMethodReturnKeys(block.data.instance, block.data.method);
        if (keys?.length > 0) {
          variable.returnKeys = keys;
          variable.nested = keys.map(key => ({
            name: `${block.data.storeAs}.${key}`,
            type: 'nested-key',
            parentVariable: block.data.storeAs,
            key
          }));
        }
      }
      
      result.fromPreviousBlocks.push(variable);
    }
  }
  
  // 2. Collect from incoming transition
  if (incomingTransition) {
    result.fromIncomingTransition = collectVariablesFromTransition(incomingTransition);
  }
  
  // 3. Collect from state chain
  if (stateConfig && allTransitions.length > 0 && Object.keys(allStates).length > 0) {
    const stateName = stateConfig.id || stateConfig.meta?.status;
    if (stateName) {
      result.fromPreviousStates = collectVariablesFromStateChain(
        stateName,
        allStates,
        allTransitions
      );
    }
  }
  
  // 4. Convert test data schema to variables (no hardcoded defaults!)
  result.fromTestData = testDataSchemaToVariables(testDataSchema);
  
  // 5. Combine all with priority
  const seen = new Set();
  const addUnique = (vars, category) => {
    vars.forEach(v => {
      if (!seen.has(v.name)) {
        seen.add(v.name);
        result.all.push({ ...v, category });
      }
      (v.nested || []).forEach(nested => {
        if (!seen.has(nested.name)) {
          seen.add(nested.name);
          result.all.push({ ...nested, category });
        }
      });
    });
  };
  
  addUnique(result.fromPreviousBlocks, 'Current Screen');
  addUnique(result.fromIncomingTransition, 'Incoming Transition');
  addUnique(result.fromPreviousStates, 'Previous States');
  addUnique(result.fromTestData, 'Test Data');
  
  return result;
}

/**
 * Format variables for autocomplete UI
 */
export function formatVariablesForAutocomplete(variables) {
  return variables.map(v => {
    let icon = '💾';
    let color = 'yellow';
    
    switch (v.sourceType) {
      case 'current-screen-block':
        icon = '📦';
        color = 'yellow';
        break;
      case 'transition-import':
        icon = '🔧';
        color = 'blue';
        break;
      case 'transition-step':
        icon = '➡️';
        color = 'green';
        break;
      case 'state-block':
        icon = '📍';
        color = 'purple';
        break;
      case 'test-data':
        icon = '📋';
        color = 'blue';
        break;
      case 'nested-key':
        icon = '📎';
        color = 'purple';
        break;
    }
    
    return {
      value: `{{${v.name}}}`,
      label: v.name,
      description: v.description || v.source,
      icon,
      color,
      type: v.type,
      category: v.category || v.source
    };
  });
}