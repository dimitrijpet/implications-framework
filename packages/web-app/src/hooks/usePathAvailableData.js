// packages/web-app/src/hooks/usePathAvailableData.js

import { useMemo } from 'react';
import { findAllPaths, computePathDataFlow } from '../utils/computePathDataFlow';

/**
 * Hook to compute what data is available at a given state
 * by analyzing all paths from start to that state
 */
export function usePathAvailableData(
  targetStateId,
  allTransitions,
  allStates,
  startState = 'initial'
) {
  return useMemo(() => {
    if (!targetStateId || !allTransitions?.length) {
      return {
        availableFields: [],
        pathUsed: null,
        allPaths: [],
        analysis: null
      };
    }

    // Don't analyze if we're at start
    if (targetStateId.toLowerCase() === startState.toLowerCase()) {
      return {
        availableFields: [],
        pathUsed: [startState],
        allPaths: [[startState]],
        analysis: null
      };
    }

    // Find all paths to this state
    const paths = findAllPaths(startState, targetStateId, allTransitions, 8);
    
    if (paths.length === 0) {
      console.warn(`⚠️ No path found from "${startState}" to "${targetStateId}"`);
      return {
        availableFields: [],
        pathUsed: null,
        allPaths: [],
        analysis: null
      };
    }

    // Analyze each path
    const analyses = paths.map(path => computePathDataFlow(path, allTransitions, allStates));
    
    // Use the path with fewest issues (or first if tied)
    const bestAnalysis = analyses.reduce((best, curr) => 
      curr.issues.length < best.issues.length ? curr : best
    , analyses[0]);

    // Get the best path
    const bestPathIndex = analyses.indexOf(bestAnalysis);
    const bestPath = paths[bestPathIndex];

    // Collect all variables PRODUCED along the best path
    const availableFields = bestAnalysis.finalContext.map(field => ({
      name: field,
      path: field,
      source: 'path',
      fromPath: bestPath.join(' → ')
    }));

    console.log(`🛤️ Path to "${targetStateId}": ${bestPath.join(' → ')}`);
    console.log(`   📦 Available at state: ${availableFields.length} fields`);

    return {
      availableFields,
      pathUsed: bestPath,
      allPaths: paths,
      analysis: bestAnalysis
    };
  }, [targetStateId, allTransitions, allStates, startState]);
}

export default usePathAvailableData;