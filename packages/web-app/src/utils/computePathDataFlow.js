// packages/web-app/src/utils/computePathDataFlow.js
// Utility to compute cumulative data context along a path of states

/**
 * Extract template variables like {{club.user.name}} from mirrorsOn UI blocks
 */
function extractUITemplateVariables(mirrorsOn) {
  const variables = new Set();
  
  if (!mirrorsOn?.UI) return Array.from(variables);
  
  // Regex to find {{variable}} patterns
  const templateRegex = /\{\{([^}]+)\}\}/g;
  
  // Deep scan the UI object for template strings
  const scanValue = (value) => {
    if (typeof value === 'string') {
      let match;
      // Reset regex lastIndex for each string
      templateRegex.lastIndex = 0;
      while ((match = templateRegex.exec(value)) !== null) {
        variables.add(match[1].trim());
      }
    } else if (Array.isArray(value)) {
      value.forEach(scanValue);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(scanValue);
    }
  };
  
  scanValue(mirrorsOn.UI);
  
  return Array.from(variables);
}

/**
 * Extract required fields from transition's requires block
 */
function extractRequiresFields(transition) {
  const fields = new Set();
  
  // From requires object
  if (transition.requires && typeof transition.requires === 'object') {
    Object.keys(transition.requires).forEach(key => fields.add(key));
  }
  
  // From conditions blocks
  if (transition.conditions?.blocks) {
    for (const block of transition.conditions.blocks) {
      if (block.type === 'condition-check' && block.data?.checks) {
        for (const check of block.data.checks) {
          if (check.field) {
            fields.add(check.field);
          }
        }
      }
    }
  }
  
  return Array.from(fields);
}

/**
 * Extract storeAs variables from action steps
 */
function extractProducedVariables(transition) {
  const produced = new Set();
  
  const steps = transition.actionDetails?.steps || [];
  for (const step of steps) {
    if (step.storeAs) {
      produced.add(step.storeAs);
    }
  }
  
  return Array.from(produced);
}

/**
 * Extract required fields from action steps (parameters that reference data)
 */
function extractStepRequirements(transition) {
  const required = new Set();
  
  // Pattern 1: {{variable}} templates
  const templateRegex = /\{\{([^}]+)\}\}/g;
  
  // Pattern 2: ctx.data.X references
  const ctxDataRegex = /ctx\.data\.([a-zA-Z0-9_.\[\]]+)/g;
  
  const steps = transition.actionDetails?.steps || [];
  
  for (const step of steps) {
    // Deep scan for both patterns
    const scanValue = (value) => {
      if (typeof value === 'string') {
        // Find {{variable}} patterns
        templateRegex.lastIndex = 0;
        let match;
        while ((match = templateRegex.exec(value)) !== null) {
          required.add(match[1].trim());
        }
        
        // Find ctx.data.X patterns
        ctxDataRegex.lastIndex = 0;
        while ((match = ctxDataRegex.exec(value)) !== null) {
          required.add(match[1].trim());
        }
      } else if (Array.isArray(value)) {
        value.forEach(scanValue);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(scanValue);
      }
    };
    
    // Scan all step properties
    if (step.params) scanValue(step.params);
    if (step.value) scanValue(step.value);
    if (step.args) scanValue(step.args);
    if (step.argsArray) scanValue(step.argsArray);
    if (step.locatorArgs) scanValue(step.locatorArgs);
  }
  
  return Array.from(required);
}

/**
 * Compute the cumulative data flow for a path through the state machine
 * 
 * @param {Array} path - Array of state IDs in order
 * @param {Array} allTransitions - All transitions from discoveryResult.transitions
 * @param {Object} allStates - Map of stateId -> state data (with xstateConfig, mirrorsOn)
 * @returns {Object} Cumulative data flow analysis
 */
export function computePathDataFlow(path, allTransitions, allStates = {}) {
  if (!path || path.length === 0) {
    return {
      initialRequired: [],
      stateContexts: {},
      finalContext: [],
      pathTransitions: [],
      issues: [],
      uiRequirements: []
    };
  }

  const stateContexts = {};
  const pathTransitions = [];
  const issues = [];
  
  let cumulativeAvailable = new Set();
  let allRequired = new Set();
  let allUIRequired = new Set();

  // Process each transition in the path
  for (let i = 0; i < path.length - 1; i++) {
    const fromState = path[i];
    const toState = path[i + 1];
    
    const transition = findTransition(fromState, toState, allTransitions, allStates);
    
    if (!transition) {
      issues.push({
        type: 'missing_transition',
        from: fromState,
        to: toState,
        message: `No transition found from "${fromState}" to "${toState}"`
      });
      continue;
    }
    
    pathTransitions.push({
      from: fromState,
      to: toState,
      event: transition.event,
      transition
    });
    
    // Extract requirements from transition
    const requiresFields = extractRequiresFields(transition);
    const stepRequirements = extractStepRequirements(transition);
    const producedFields = extractProducedVariables(transition);
    
    const requiredFields = [...new Set([...requiresFields, ...stepRequirements])];
    
    const missingAtThisPoint = [];
    requiredFields.forEach(field => {
      const rootField = field.split(/[.\[]/)[0];
      const isAvailable = cumulativeAvailable.has(field) || 
                          cumulativeAvailable.has(rootField) ||
                          isCommonConfigField(field);
      
      if (!isAvailable) {
        missingAtThisPoint.push(field);
        allRequired.add(field);
      }
    });
    
    if (missingAtThisPoint.length > 0) {
      issues.push({
        type: 'missing_data',
        at: fromState,
        transition: transition.event,
        fields: missingAtThisPoint,
        message: `Transition "${transition.event}" requires data not yet available: ${missingAtThisPoint.join(', ')}`
      });
    }
    
    producedFields.forEach(field => cumulativeAvailable.add(field));
    
    stateContexts[fromState] = {
      availableBefore: new Set(cumulativeAvailable),
      required: requiredFields,
      produced: producedFields,
      missing: missingAtThisPoint,
      transition: {
        event: transition.event,
        to: toState
      }
    };
  }
  
  // Process the final state - extract UI template requirements
  const lastState = path[path.length - 1];
  const lastStateData = allStates[lastState] || allStates[lastState.toLowerCase()];
  
  // Extract UI template variables from the target state's mirrorsOn
  const uiTemplateVars = lastStateData?.mirrorsOn 
    ? extractUITemplateVariables(lastStateData.mirrorsOn)
    : [];
  
  // Check which UI vars are missing
  uiTemplateVars.forEach(field => {
    const rootField = field.split(/[.\[]/)[0];
    const isAvailable = cumulativeAvailable.has(field) || 
                        cumulativeAvailable.has(rootField) ||
                        isCommonConfigField(field);
    
    if (!isAvailable) {
      allRequired.add(field);
      allUIRequired.add(field);
    }
  });
  
  stateContexts[lastState] = {
    availableBefore: new Set(cumulativeAvailable),
    required: [],
    produced: [],
    missing: [],
    transition: null,
    uiRequires: uiTemplateVars
  };
  
  // Filter initialRequired to exclude fields produced during path
  const initialRequired = Array.from(allRequired).filter(field => {
    // Check if this field is produced anywhere in the path
    return !pathTransitions.some(pt => {
      const produced = extractProducedVariables(pt.transition);
      return produced.some(p => p === field || field.startsWith(p + '.'));
    });
  });
  
  return {
    initialRequired,
    stateContexts,
    finalContext: Array.from(cumulativeAvailable),
    pathTransitions,
    issues,
    uiRequirements: Array.from(allUIRequired),
    summary: {
      pathLength: path.length,
      transitionCount: pathTransitions.length,
      totalRequired: allRequired.size,
      initialRequired: initialRequired.length,
      totalProduced: cumulativeAvailable.size,
      issueCount: issues.length,
      uiRequirementsCount: allUIRequired.size
    }
  };
}

/**
 * Find transition between two states
 */
function findTransition(fromState, toState, allTransitions, allStates) {
  const normalizeState = (s) => s?.toLowerCase().replace(/[_-]/g, '');
  const fromNorm = normalizeState(fromState);
  const toNorm = normalizeState(toState);
  
  // First try to find from allStates (has full actionDetails)
  const sourceState = allStates[fromState] || allStates[fromState.toLowerCase()];
  let stateTransition = null;
  
  if (sourceState?.xstateConfig?.on) {
    const transitions = sourceState.xstateConfig.on;
    
    for (const [event, config] of Object.entries(transitions)) {
      const configs = Array.isArray(config) ? config : [config];
      
      for (const singleConfig of configs) {
        const target = typeof singleConfig === 'string' ? singleConfig : singleConfig?.target;
        if (normalizeState(target) === toNorm) {
          stateTransition = {
            from: fromState,
            to: toState,
            event,
            platforms: singleConfig?.platforms,
            actionDetails: singleConfig?.actionDetails,
            requires: singleConfig?.requires,
            conditions: singleConfig?.conditions
          };
          break;
        }
      }
      if (stateTransition) break;
    }
  }
  
  // If we found one with actionDetails, use it
  if (stateTransition?.actionDetails) {
    return stateTransition;
  }
  
  // Try direct transition from allTransitions
  const directTransition = allTransitions?.find(t => {
    const tFrom = normalizeState(t.from);
    const tTo = normalizeState(t.to);
    return tFrom === fromNorm && tTo === toNorm;
  });
  
  if (directTransition) {
    if (directTransition.actionDetails) {
      return directTransition;
    }
    if (stateTransition) {
      return {
        ...directTransition,
        actionDetails: stateTransition.actionDetails,
        requires: stateTransition.requires || directTransition.requires,
        conditions: stateTransition.conditions || directTransition.conditions
      };
    }
    return directTransition;
  }
  
  return stateTransition || null;
}

/**
 * Check if field is a common config field (always available)
 */
function isCommonConfigField(field) {
  const commonFields = new Set([
    'lang', 'device', 'baseUrl', 'config', 'status', 'environment',
    'platform', 'timeout', 'retries'
  ]);
  const rootField = field.split(/[.\[]/)[0];
  return commonFields.has(rootField);
}

/**
 * Find all possible paths between two states (BFS)
 */
export function findAllPaths(startState, endState, allTransitions, maxDepth = 10) {
  const paths = [];
  const normalizeState = (s) => s?.toLowerCase().replace(/[_-]/g, '');
  const endNorm = normalizeState(endState);
  const startNorm = normalizeState(startState);
  
  // Handle case where start equals end
  if (startNorm === endNorm) {
    return [[startState]];
  }
  
  const queue = [[startState]];
  
  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currentState = currentPath[currentPath.length - 1];
    const currentNorm = normalizeState(currentState);
    
    if (currentPath.length > maxDepth) continue;
    
    if (currentNorm === endNorm) {
      paths.push(currentPath);
      continue;
    }
    
    // Find outgoing transitions
    const outgoing = allTransitions?.filter(t => 
      normalizeState(t.from) === currentNorm
    ) || [];
    
    for (const transition of outgoing) {
      const nextState = transition.to;
      const nextNorm = normalizeState(nextState);
      
      // Avoid cycles
      if (currentPath.some(s => normalizeState(s) === nextNorm)) {
        continue;
      }
      
      queue.push([...currentPath, nextState]);
    }
  }
  
  return paths;
}

/**
 * Analyze multiple paths and compare their data requirements
 */
export function comparePathRequirements(paths, allTransitions, allStates) {
  const pathAnalyses = paths.map((path, index) => {
    const analysis = computePathDataFlow(path, allTransitions, allStates);
    return {
      pathIndex: index,
      path,
      ...analysis
    };
  });
  
  const allInitialRequired = pathAnalyses.map(p => new Set(p.initialRequired));
  const commonRequired = allInitialRequired.length > 0
    ? Array.from(allInitialRequired[0]).filter(field =>
        allInitialRequired.every(set => set.has(field))
      )
    : [];
  
  const easiestPath = pathAnalyses.reduce((min, curr) => 
    curr.initialRequired.length < min.initialRequired.length ? curr : min
  , pathAnalyses[0]);
  
  const problematicPath = pathAnalyses.reduce((max, curr) =>
    curr.issues.length > max.issues.length ? curr : max
  , pathAnalyses[0]);
  
  return {
    pathCount: paths.length,
    pathAnalyses,
    commonRequired,
    easiestPath: easiestPath ? {
      path: easiestPath.path,
      requiredCount: easiestPath.initialRequired.length,
      issueCount: easiestPath.issues.length
    } : null,
    problematicPath: problematicPath?.issues.length > 0 ? {
      path: problematicPath.path,
      requiredCount: problematicPath.initialRequired.length,
      issueCount: problematicPath.issues.length,
      issues: problematicPath.issues
    } : null
  };
}