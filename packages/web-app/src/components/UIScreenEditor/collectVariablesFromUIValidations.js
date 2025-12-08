// ═══════════════════════════════════════════════════════════════════════════
// packages/web-app/src/components/UIScreenEditor/collectVariablesFromUIValidations.js
// 
// Extracts variables that will be stored via `storeAs` in UI validations
// These should be available in:
//   1. Transition conditions (for conditional flows)
//   2. Later states' UI validations (for cross-state comparisons)
//
// USAGE:
//   import { collectVariablesFromUIValidations } from './collectVariablesFromUIValidations';
//   const uiVars = collectVariablesFromUIValidations(state);
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract storeAs variables from a state's UI validations
 * 
 * @param {Object} state - The state object
 * @returns {Array} Array of variable descriptors
 * 
 * Example output:
 * [
 *   { name: 'originalPrice', path: 'originalPrice', source: 'ui-storeAs', type: 'value', fromScreen: 'BookingScreen' },
 *   { name: 'canSubmit', path: 'canSubmit', source: 'ui-storeAs', type: 'boolean', fromScreen: 'FormScreen' }
 * ]
 */
export function collectVariablesFromUIValidations(state) {
  const variables = [];
  
  if (!state) return variables;
  
  // Get UI coverage from either location
  const uiCoverage = state.uiCoverage || state.meta?.uiCoverage;
  if (!uiCoverage?.platforms) return variables;
  
  // Iterate through all platforms
  for (const [platformName, platformData] of Object.entries(uiCoverage.platforms)) {
    const screens = platformData.screens || {};
    
    // Iterate through all screens
    for (const [screenName, screenDef] of Object.entries(screens)) {
      // Handle both array and object formats
      const screen = Array.isArray(screenDef) ? screenDef[0] : screenDef;
      if (!screen) continue;
      
      // ═══════════════════════════════════════════════════════════
      // Check BLOCKS format (new)
      // ═══════════════════════════════════════════════════════════
      if (screen.blocks && Array.isArray(screen.blocks)) {
        for (const block of screen.blocks) {
          if (block.type === 'ui-assertion' && block.data?.assertions) {
            extractFromAssertions(block.data.assertions, screenName, platformName, variables);
          }
          
          // Also check function-call blocks with storeAs
          if (block.type === 'function-call' && block.data?.storeAs) {
            variables.push({
              name: block.data.storeAs,
              path: block.data.storeAs,
              source: 'ui-storeAs',
              type: 'value', // function calls return values
              fromScreen: screenName,
              fromPlatform: platformName,
              fromBlock: block.label || 'function-call'
            });
          }
        }
      }
      
      // ═══════════════════════════════════════════════════════════
      // Check LEGACY format (assertions array directly on screen)
      // ═══════════════════════════════════════════════════════════
      if (screen.assertions && Array.isArray(screen.assertions)) {
        extractFromAssertions(screen.assertions, screenName, platformName, variables);
      }
      
      // ═══════════════════════════════════════════════════════════
      // Check FUNCTIONS with storeAs (legacy format)
      // ═══════════════════════════════════════════════════════════
      if (screen.functions && typeof screen.functions === 'object') {
        for (const [funcName, funcData] of Object.entries(screen.functions)) {
          if (funcData?.storeAs) {
            variables.push({
              name: funcData.storeAs,
              path: funcData.storeAs,
              source: 'ui-storeAs',
              type: 'value',
              fromScreen: screenName,
              fromPlatform: platformName,
              fromFunction: funcName
            });
          }
        }
      }
    }
  }
  
  return variables;
}

/**
 * Helper to extract variables from an assertions array
 */
function extractFromAssertions(assertions, screenName, platformName, variables) {
  // Getter types that return actual values
  const GETTER_TYPES = ['getValue', 'getText', 'getCount', 'getAttribute'];
  // Boolean check types that return true/false
  const BOOLEAN_TYPES = ['isVisible', 'isEnabled', 'isChecked', 'hasText'];
  
  for (const assertion of assertions) {
    if (!assertion.storeAs) continue;
    
    // Determine type based on expect
    let varType = 'boolean'; // default for pass/fail assertions
    
    if (GETTER_TYPES.includes(assertion.expect)) {
      varType = 'value';
    } else if (BOOLEAN_TYPES.includes(assertion.expect)) {
      varType = 'boolean';
    }
    
    // Avoid duplicates
    if (!variables.some(v => v.name === assertion.storeAs)) {
      variables.push({
        name: assertion.storeAs,
        path: assertion.storeAs,
        source: 'ui-storeAs',
        type: varType,
        expectType: assertion.expect,
        fromScreen: screenName,
        fromPlatform: platformName,
        fromAssertion: assertion.fn
      });
    }
  }
}

/**
 * Collect ALL available variables for a state, including:
 * - Variables from incoming transitions (actionDetails.storeAs, etc.)
 * - Variables from test data schema
 * - Variables from UI validations (storeAs)
 * 
 * @param {Object} options
 * @param {Object} options.state - Current state
 * @param {Array} options.incomingTransitions - Transitions leading to this state
 * @param {Object} options.allStates - Map of all states
 * @param {Array} options.allTransitions - All transitions
 * @param {Array} options.testDataSchema - Test data schema fields
 * @returns {Array} Combined array of all available variables
 */
export function collectAllAvailableVariables({
  state,
  incomingTransitions = [],
  allStates = {},
  allTransitions = [],
  testDataSchema = [],
  // Optional: existing collector functions
  collectVariablesFromTransition,
  collectVariablesFromState,
  testDataSchemaToVariables
}) {
  const variables = [];
  const seen = new Set();
  
  const addVar = (v) => {
    if (!seen.has(v.name)) {
      seen.add(v.name);
      variables.push(v);
    }
  };
  
  // 1. Variables from incoming transitions
  if (collectVariablesFromTransition) {
    incomingTransitions.forEach(transition => {
      const transVars = collectVariablesFromTransition(transition);
      transVars.forEach(addVar);
    });
  }
  
  // 2. Variables from previous states in chain
  if (collectVariablesFromState && Object.keys(allStates).length > 0) {
    const stateName = state?.id || state?.meta?.status;
    if (stateName) {
      const incoming = allTransitions.filter(t => 
        (t.target || t.to || '').toLowerCase() === stateName.toLowerCase()
      );
      
      incoming.forEach(t => {
        const sourceStateName = t.from || t.source;
        const sourceState = allStates[sourceStateName];
        if (sourceState) {
          // Get variables stored in source state
          const stateVars = collectVariablesFromState(sourceState, sourceStateName);
          stateVars.forEach(v => {
            v.fromState = sourceStateName;
            addVar(v);
          });
          
          // ✅ NEW: Also get storeAs from source state's UI validations
          const uiVars = collectVariablesFromUIValidations(sourceState);
          uiVars.forEach(v => {
            v.fromState = sourceStateName;
            addVar(v);
          });
        }
      });
    }
  }
  
  // 3. Variables from test data schema
  if (testDataSchemaToVariables) {
    const testDataVars = testDataSchemaToVariables(testDataSchema);
    testDataVars.forEach(addVar);
  }
  
  // 4. ✅ NEW: Variables from current state's UI validations
  // (in case user wants to reference earlier screen's storeAs in later screen)
  const currentUIVars = collectVariablesFromUIValidations(state);
  currentUIVars.forEach(addVar);
  
  return variables;
}

// ═══════════════════════════════════════════════════════════════════════════
// Export for use in UIScreenEditor, AddTransitionModal, etc.
// ═══════════════════════════════════════════════════════════════════════════
export default {
  collectVariablesFromUIValidations,
  collectAllAvailableVariables
};