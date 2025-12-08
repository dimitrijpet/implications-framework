// packages/web-app/src/hooks/useCrossStateVariables.js
// ✅ PHASE 3.6: Hook for collecting variables across states
//
// Usage:
// const { variables, variablesByCategory } = useCrossStateVariables({
//   blocks,
//   currentBlockIndex,
//   incomingTransition,
//   stateName,
//   projectPath
// });

import { useState, useEffect, useMemo } from 'react';
import {
  collectAllVariables,
  formatVariablesForAutocomplete,
  getIncomingTransitions
} from '../components/UIScreenEditor/crossStateVariables';
import usePOMData from './usePOMData';

/**
 * Hook to collect and manage cross-state variables
 */
export default function useCrossStateVariables({
  blocks = [],
  currentBlockIndex = -1,
  incomingTransition = null,
  stateConfig = null,
  stateName = null,
  projectPath = null,
  allTransitions = [],
  allStates = {},
  testDataSchema = null
}) {
  const { getMethodReturnKeys } = usePOMData(projectPath);
  
  // Collect all variables
  const collectedVariables = useMemo(() => {
    return collectAllVariables({
      blocks,
      currentBlockIndex,
      incomingTransition,
      stateConfig,
      allTransitions,
      allStates,
      getMethodReturnKeys,
      testDataSchema
    });
  }, [
    blocks,
    currentBlockIndex,
    incomingTransition,
    stateConfig,
    allTransitions,
    allStates,
    getMethodReturnKeys,
    testDataSchema
  ]);
  
  // Format for autocomplete
  const autocompleteOptions = useMemo(() => {
    return formatVariablesForAutocomplete(collectedVariables.all);
  }, [collectedVariables]);
  
  // Group by category for display
  const variablesByCategory = useMemo(() => {
    const grouped = {};
    
    collectedVariables.all.forEach(v => {
      const category = v.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(v);
    });
    
    return grouped;
  }, [collectedVariables]);
  
  // Summary counts
  const summary = useMemo(() => ({
    total: collectedVariables.all.length,
    fromBlocks: collectedVariables.fromPreviousBlocks.length,
    fromTransition: collectedVariables.fromIncomingTransition.length,
    fromPreviousStates: collectedVariables.fromPreviousStates.length,
    fromTestData: collectedVariables.fromTestData.length
  }), [collectedVariables]);
  
  return {
    // Raw collected data
    variables: collectedVariables.all,
    fromPreviousBlocks: collectedVariables.fromPreviousBlocks,
    fromIncomingTransition: collectedVariables.fromIncomingTransition,
    fromPreviousStates: collectedVariables.fromPreviousStates,
    fromTestData: collectedVariables.fromTestData,
    
    // Formatted for UI
    autocompleteOptions,
    variablesByCategory,
    
    // Summary
    summary,
    
    // Helper to check if a variable exists
    hasVariable: (name) => collectedVariables.all.some(v => v.name === name),
    
    // Helper to get variable info
    getVariable: (name) => collectedVariables.all.find(v => v.name === name)
  };
}

/**
 * Simplified hook for just getting available variables at a block position
 * Used by BlockRenderer to pass to block content components
 */
export function useBlockVariables(blocks, blockIndex, getMethodReturnKeys) {
  return useMemo(() => {
    const variables = [];
    
    for (let i = 0; i < blockIndex; i++) {
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
            name: `${variable.name}.${key}`,
            type: 'nested-key',
            parentVariable: variable.name,
            key
          }));
        }
      }
      
      variables.push(variable);
    }
    
    return variables;
  }, [blocks, blockIndex, getMethodReturnKeys]);
}