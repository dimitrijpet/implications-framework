// packages/web-app/src/components/StateGraph/PathDataFlowPanel.jsx
// Visualizes cumulative data flow for paths leading to a state

import { useState, useMemo } from 'react';
import { computePathDataFlow, findAllPaths } from '../../utils/computePathDataFlow';

/**
 * PathDataFlowPanel - Shows all paths to a state and their data requirements
 * 
 * Add to StateDetailModal to see:
 * - All paths from 'initial' to current state
 * - What testData each path requires
 * - Which path has fewest requirements
 */
export default function PathDataFlowPanel({
  currentState,
  allTransitions,
  allStates,
  startState = 'initial',
  theme
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Find all paths from start to current state
  const pathAnalysis = useMemo(() => {
    if (!currentState?.meta?.status || !allTransitions?.length) {
      return null;
    }

    const targetState = currentState.meta.status;
    
    // Don't analyze if we're at the start state
    if (targetState.toLowerCase() === startState.toLowerCase()) {
      return null;
    }

    console.log(`🛤️ Finding paths from "${startState}" to "${targetState}"...`);
    
    const paths = findAllPaths(startState, targetState, allTransitions, 8);
    
    console.log(`   Found ${paths.length} paths`);

    if (paths.length === 0) {
      return { paths: [], analyses: [], easiest: null };
    }

    // Analyze each path
    const analyses = paths.map((path, idx) => {
      const analysis = computePathDataFlow(path, allTransitions, allStates);
      return {
        index: idx,
        path,
        ...analysis
      };
    });

    // Find easiest path (fewest initial requirements)
    const easiest = analyses.reduce((min, curr) => 
      curr.initialRequired.length < min.initialRequired.length ? curr : min
    , analyses[0]);

    // Find common requirements
    const allRequired = analyses.map(a => new Set(a.initialRequired));
    const commonRequired = allRequired.length > 0
      ? Array.from(allRequired[0]).filter(field =>
          allRequired.every(set => set.has(field))
        )
      : [];

    return {
      paths,
      analyses,
      easiest,
      commonRequired,
      targetState
    };
  }, [currentState, allTransitions, allStates, startState]);

  // Don't render if no analysis or at start state
  if (!pathAnalysis || pathAnalysis.paths.length === 0) {
    return null;
  }

  const selectedAnalysis = pathAnalysis.analyses[selectedPathIndex];

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: theme.colors.background.tertiary,
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:brightness-110 transition"
        style={{ backgroundColor: theme.colors.background.secondary }}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🛤️</span>
          <span 
            className="font-semibold"
            style={{ color: theme.colors.text.primary }}
          >
            Path Analysis
          </span>
          
          <span
            className="px-2 py-0.5 rounded text-xs font-semibold"
            style={{
              backgroundColor: `${theme.colors.accents.purple}20`,
              color: theme.colors.accents.purple,
            }}
          >
            {pathAnalysis.paths.length} path{pathAnalysis.paths.length !== 1 ? 's' : ''} found
          </span>
          
          {pathAnalysis.commonRequired.length > 0 && (
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{
                backgroundColor: `${theme.colors.accents.blue}20`,
                color: theme.colors.accents.blue,
              }}
            >
              {pathAnalysis.commonRequired.length} common field{pathAnalysis.commonRequired.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <span style={{ color: theme.colors.text.tertiary }}>
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Path selector */}
          <div>
            <label 
              className="text-xs font-semibold mb-2 block"
              style={{ color: theme.colors.text.secondary }}
            >
              Select Path:
            </label>
            <div className="flex flex-wrap gap-2">
              {pathAnalysis.analyses.map((analysis, idx) => {
                const isEasiest = analysis === pathAnalysis.easiest;
                const isSelected = idx === selectedPathIndex;
                
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedPathIndex(idx)}
                    className="px-3 py-1.5 rounded text-xs font-semibold transition"
                    style={{
                      backgroundColor: isSelected
                        ? theme.colors.accents.blue
                        : theme.colors.background.secondary,
                      color: isSelected ? 'white' : theme.colors.text.primary,
                      border: `2px solid ${isEasiest ? theme.colors.accents.green : 'transparent'}`,
                    }}
                  >
                    Path {idx + 1}
                    <span 
                      className="ml-1 opacity-70"
                      style={{ fontSize: '10px' }}
                    >
                      ({analysis.path.length} states, {analysis.initialRequired.length} req)
                    </span>
                    {isEasiest && <span className="ml-1">⭐</span>}
                  </button>
                );
              })}
            </div>
            <p 
              className="text-xs mt-1"
              style={{ color: theme.colors.text.tertiary }}
            >
              ⭐ = Easiest path (fewest testData requirements)
            </p>
          </div>

          {/* Selected path visualization */}
          {selectedAnalysis && (
            <div>
              <h4 
                className="text-sm font-semibold mb-2"
                style={{ color: theme.colors.text.primary }}
              >
                Path {selectedPathIndex + 1}: {selectedAnalysis.path.join(' → ')}
              </h4>
              
              {/* Path flow */}
              <div 
                className="p-3 rounded overflow-x-auto"
                style={{ backgroundColor: theme.colors.background.secondary }}
              >
                <div className="flex items-center gap-2 min-w-max">
                  {selectedAnalysis.path.map((state, idx) => {
                    const stateContext = selectedAnalysis.stateContexts[state];
                    const transition = selectedAnalysis.pathTransitions[idx];
                    const hasMissing = stateContext?.missing?.length > 0;
                    
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        {/* State node */}
                        <div
                          className="px-3 py-2 rounded text-xs font-semibold text-center"
                          style={{
                            backgroundColor: hasMissing 
                              ? `${theme.colors.accents.orange}20`
                              : `${theme.colors.accents.blue}20`,
                            color: hasMissing 
                              ? theme.colors.accents.orange
                              : theme.colors.accents.blue,
                            border: `1px solid ${hasMissing ? theme.colors.accents.orange : theme.colors.accents.blue}40`,
                            minWidth: '80px'
                          }}
                        >
                          {state}
                          {stateContext?.produced?.length > 0 && (
                            <div 
                              className="text-xs mt-1"
                              style={{ color: theme.colors.accents.green, fontSize: '9px' }}
                            >
                              +{stateContext.produced.length} var{stateContext.produced.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        
                        {/* Transition arrow */}
                        {transition && (
                          <div className="flex flex-col items-center">
                            <span 
                              className="text-xs font-mono"
                              style={{ color: theme.colors.text.tertiary }}
                            >
                              {transition.event}
                            </span>
                            <span style={{ color: theme.colors.text.tertiary }}>→</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Requirements summary */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                {/* Initial Required */}
                <div>
                  <h5 
                    className="text-xs font-semibold mb-2 flex items-center gap-1"
                    style={{ color: theme.colors.accents.blue }}
                  >
                    📥 Required at Start ({selectedAnalysis.initialRequired.length})
                  </h5>
                  {selectedAnalysis.initialRequired.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedAnalysis.initialRequired.map((field, idx) => (
                        <code
                          key={idx}
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: theme.colors.background.secondary,
                            color: theme.colors.text.primary,
                          }}
                        >
                          {field}
                        </code>
                      ))}
                    </div>
                  ) : (
                    <p 
                      className="text-xs italic"
                      style={{ color: theme.colors.text.tertiary }}
                    >
                      No testData required! ✨
                    </p>
                  )}
                </div>
                
                {/* Final Context */}
                <div>
                  <h5 
                    className="text-xs font-semibold mb-2 flex items-center gap-1"
                    style={{ color: theme.colors.accents.green }}
                  >
                    📤 Available at End ({selectedAnalysis.finalContext.length})
                  </h5>
                  {selectedAnalysis.finalContext.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedAnalysis.finalContext.slice(0, 10).map((field, idx) => (
                        <code
                          key={idx}
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: `${theme.colors.accents.green}10`,
                            color: theme.colors.accents.green,
                          }}
                        >
                          {field}
                        </code>
                      ))}
                      {selectedAnalysis.finalContext.length > 10 && (
                        <span 
                          className="text-xs"
                          style={{ color: theme.colors.text.tertiary }}
                        >
                          +{selectedAnalysis.finalContext.length - 10} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <p 
                      className="text-xs italic"
                      style={{ color: theme.colors.text.tertiary }}
                    >
                      No variables stored
                    </p>
                  )}
                </div>
              </div>
              
              {/* Issues */}
              {selectedAnalysis.issues.length > 0 && (
                <div 
                  className="mt-4 p-3 rounded"
                  style={{
                    backgroundColor: `${theme.colors.accents.orange}10`,
                    border: `1px solid ${theme.colors.accents.orange}30`,
                  }}
                >
                  <h5 
                    className="text-xs font-semibold mb-2"
                    style={{ color: theme.colors.accents.orange }}
                  >
                    ⚠️ Issues ({selectedAnalysis.issues.length})
                  </h5>
                  <ul className="space-y-1">
                    {selectedAnalysis.issues.map((issue, idx) => (
                      <li 
                        key={idx}
                        className="text-xs"
                        style={{ color: theme.colors.text.secondary }}
                      >
                        • {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Toggle details */}
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="mt-3 text-xs underline"
                style={{ color: theme.colors.text.tertiary }}
              >
                {showDetails ? 'Hide' : 'Show'} step-by-step details
              </button>
              
              {/* Step-by-step details */}
              {showDetails && (
                <div className="mt-3 space-y-2">
                  {selectedAnalysis.pathTransitions.map((pt, idx) => {
                    const stateContext = selectedAnalysis.stateContexts[pt.from];
                    
                    return (
                      <div
                        key={idx}
                        className="p-2 rounded text-xs"
                        style={{ backgroundColor: theme.colors.background.secondary }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ color: theme.colors.accents.blue }}>
                            {pt.from}
                          </span>
                          <span style={{ color: theme.colors.text.tertiary }}>
                            —{pt.event}→
                          </span>
                          <span style={{ color: theme.colors.accents.green }}>
                            {pt.to}
                          </span>
                        </div>
                        
                        {stateContext?.required?.length > 0 && (
                          <div className="ml-4">
                            <span style={{ color: theme.colors.text.tertiary }}>Needs: </span>
                            <span style={{ color: theme.colors.text.primary }}>
                              {stateContext.required.join(', ')}
                            </span>
                          </div>
                        )}
                        
                        {stateContext?.produced?.length > 0 && (
                          <div className="ml-4">
                            <span style={{ color: theme.colors.text.tertiary }}>Produces: </span>
                            <span style={{ color: theme.colors.accents.yellow }}>
                              {stateContext.produced.join(', ')}
                            </span>
                          </div>
                        )}
                        
                        {stateContext?.missing?.length > 0 && (
                          <div className="ml-4">
                            <span style={{ color: theme.colors.accents.orange }}>⚠️ Missing: </span>
                            <span style={{ color: theme.colors.accents.orange }}>
                              {stateContext.missing.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          
          {/* Common requirements hint */}
          {pathAnalysis.commonRequired.length > 0 && (
            <div 
              className="p-3 rounded"
              style={{
                backgroundColor: `${theme.colors.accents.cyan}10`,
                border: `1px solid ${theme.colors.accents.cyan}30`,
              }}
            >
              <h5 
                className="text-xs font-semibold mb-1"
                style={{ color: theme.colors.accents.cyan }}
              >
                💡 Common to all paths:
              </h5>
              <p 
                className="text-xs"
                style={{ color: theme.colors.text.secondary }}
              >
                These fields are required regardless of which path you take:{' '}
                <span style={{ color: theme.colors.text.primary }}>
                  {pathAnalysis.commonRequired.join(', ')}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}