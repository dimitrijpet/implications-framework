// packages/web-app/src/utils/computePathDataFlow.js
// Utility to compute cumulative data context along a path of states

import { extractDataFlow } from './extractDataFlow';

/**
 * Compute the cumulative data flow for a path through the state machine
 * 
 * @param {Array} path - Array of state IDs in order, e.g. ['initial', 'logged_in', 'club_selected']
 * @param {Array} allTransitions - All transitions from discoveryResult.transitions
 * @param {Object} allStates - Map of stateId -> state data (with xstateConfig)
 * @returns {Object} Cumulative data flow analysis
 */
export function computePathDataFlow(path, allTransitions, allStates = {}) {
  if (!path || path.length === 0) {
    return {
      initialRequired: [],
      stateContexts: {},
      finalContext: [],
      pathTransitions: [],
      issues: []
    };
  }

  const stateContexts = {};
  const pathTransitions = [];
  const issues = [];
  
  // Track what's available at each point
  let cumulativeAvailable = new Set();
  let allRequired = new Set();

  // Process each transition in the path
  for (let i = 0; i < path.length - 1; i++) {
    const fromState = path[i];
    const toState = path[i + 1];
    
    // Find the transition between these states
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
    
    // Build formData-like structure for extractDataFlow
    const formData = buildFormDataFromTransition(transition);
    const dataFlow = extractDataFlow(formData);
    
    // Track what this transition REQUIRES
    const requiredFields = dataFlow.reads.map(r => r.field);
    const producedFields = dataFlow.writes.map(w => w.field);
    
    // Check for missing requirements
    const missingAtThisPoint = [];
    requiredFields.forEach(field => {
      const rootField = field.split(/[.\[]/)[0];
      // Check if available (either exact match or root field match)
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
    
    // Add produced fields to cumulative available
    producedFields.forEach(field => cumulativeAvailable.add(field));
    
    // Store context for this state
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
  
  // Final state context (no outgoing transition in path)
  const lastState = path[path.length - 1];
  stateContexts[lastState] = {
    availableBefore: new Set(cumulativeAvailable),
    required: [],
    produced: [],
    missing: [],
    transition: null
  };
  
  // Compute initial required (fields needed at start that aren't produced along the way)
  const initialRequired = Array.from(allRequired).filter(field => {
    // Check if this field is produced by any transition in the path
    return !pathTransitions.some(pt => {
      const formData = buildFormDataFromTransition(pt.transition);
      const flow = extractDataFlow(formData);
      return flow.writes.some(w => w.field === field || field.startsWith(w.field + '.'));
    });
  });
  
  return {
    initialRequired,
    stateContexts,
    finalContext: Array.from(cumulativeAvailable),
    pathTransitions,
    issues,
    summary: {
      pathLength: path.length,
      transitionCount: pathTransitions.length,
      totalRequired: allRequired.size,
      initialRequired: initialRequired.length,
      totalProduced: cumulativeAvailable.size,
      issueCount: issues.length
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
  
  // First try: find in allTransitions array
  const directTransition = allTransitions?.find(t => {
    const tFrom = normalizeState(t.from);
    const tTo = normalizeState(t.to);
    return tFrom === fromNorm && tTo === toNorm;
  });
  
  // Also check in source state's xstateConfig.on for richer data
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
  
  // Prefer the one with actionDetails, or merge them
  if (stateTransition?.actionDetails) {
    return stateTransition;
  }
  
  if (directTransition) {
    // If direct has actionDetails, use it; otherwise use stateTransition if available
    if (directTransition.actionDetails) {
      return directTransition;
    }
    // Merge: use directTransition as base, add actionDetails from stateTransition
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
 * Build formData structure from transition for extractDataFlow
 */
function buildFormDataFromTransition(transition) {
  const actionDetails = transition.actionDetails || {};
  
  return {
    event: transition.event,
    platform: transition.platforms?.[0] || actionDetails.platform || 'web',
    requires: transition.requires || {},
    conditions: transition.conditions || null,
    imports: actionDetails.imports || [],
    steps: actionDetails.steps || [],
    hasActionDetails: !!transition.actionDetails
  };
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
 * @param {string} startState - Starting state ID
 * @param {string} endState - Target state ID
 * @param {Array} allTransitions - All transitions
 * @param {number} maxDepth - Maximum path length to search
 * @returns {Array} Array of paths, each path is array of state IDs
 */
export function findAllPaths(startState, endState, allTransitions, maxDepth = 10) {
  const paths = [];
  const queue = [[startState]];
  
  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currentState = currentPath[currentPath.length - 1];
    
    if (currentPath.length > maxDepth) continue;
    
    if (currentState.toLowerCase() === endState.toLowerCase()) {
      paths.push(currentPath);
      continue;
    }
    
    // Find all outgoing transitions from current state
    const outgoing = allTransitions?.filter(t => 
      t.from.toLowerCase() === currentState.toLowerCase()
    ) || [];
    
    for (const transition of outgoing) {
      const nextState = transition.to;
      
      // Avoid cycles
      if (currentPath.some(s => s.toLowerCase() === nextState.toLowerCase())) {
        continue;
      }
      
      queue.push([...currentPath, nextState]);
    }
  }
  
  return paths;
}

/**
 * Analyze multiple paths and compare their data requirements
 * @param {Array} paths - Array of paths from findAllPaths
 * @param {Array} allTransitions - All transitions
 * @param {Object} allStates - State map
 * @returns {Object} Comparison of path requirements
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
  
  // Find common requirements across all paths
  const allInitialRequired = pathAnalyses.map(p => new Set(p.initialRequired));
  const commonRequired = allInitialRequired.length > 0
    ? Array.from(allInitialRequired[0]).filter(field =>
        allInitialRequired.every(set => set.has(field))
      )
    : [];
  
  // Find path with fewest requirements
  const easiestPath = pathAnalyses.reduce((min, curr) => 
    curr.initialRequired.length < min.initialRequired.length ? curr : min
  , pathAnalyses[0]);
  
  // Find path with most issues
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

export default {
  computePathDataFlow,
  findAllPaths,
  comparePathRequirements
};