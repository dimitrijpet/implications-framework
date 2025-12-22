// packages/web-app/src/components/StateGraph/PathDataFlowPanel.jsx
// Visualizes cumulative data flow for paths leading to a state

import { useState, useMemo } from 'react';
import { computePathDataFlow, findAllPaths } from '../../utils/computePathDataFlow';

/**
 * PathDataFlowPanel - Shows all paths to a state and their data requirements
 */
export default function PathDataFlowPanel({
  currentState,
  allTransitions,
  allStates,
  startState: providedStartState = 'initial',
  theme,
  loadedTestData
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Auto-detect start state if provided one doesn't exist
  const startState = useMemo(() => {
    if (!allTransitions?.length) return providedStartState;
    
    const fromStates = new Set(allTransitions.map(t => t.from.toLowerCase()));
    const toStates = new Set(allTransitions.map(t => t.to.toLowerCase()));
    
    // Check if provided start state exists
    if (fromStates.has(providedStartState.toLowerCase())) {
      return providedStartState;
    }
    
    // Try common alternatives
    const alternatives = ['init', 'initial', 'start', 'home', 'landing_page', 'landing'];
    for (const alt of alternatives) {
      if (fromStates.has(alt.toLowerCase())) {
        console.log(`🔄 Auto-detected start state: "${alt}" (instead of "${providedStartState}")`);
        return alt;
      }
    }
    
    // Find states with no incoming transitions (root states)
    const rootStates = [...fromStates].filter(s => !toStates.has(s));
    if (rootStates.length > 0) {
      console.log(`🔄 Auto-detected root state: "${rootStates[0]}"`);
      return rootStates[0];
    }
    
    return providedStartState;
  }, [allTransitions, providedStartState]);

  // Build testData keys set for validation
  const testDataKeys = useMemo(() => {
    if (!loadedTestData?.keys) return new Set();
    return new Set(loadedTestData.keys);
  }, [loadedTestData]);

  // Build root keys set (for partial matches like "club" matching "club.name")
  const testDataRootKeys = useMemo(() => {
    if (!loadedTestData?.rootKeys) return new Set();
    return new Set(loadedTestData.rootKeys);
  }, [loadedTestData]);

  // Check if a field is available in testData
  const isFieldAvailable = (field) => {
    if (!field) return false;
    
    // Direct match
    if (testDataKeys.has(field)) return true;
    
    // Root field match (e.g., "club.name" -> check if "club" exists)
    const rootField = field.split(/[.\[]/)[0];
    if (testDataRootKeys.has(rootField)) return true;
    
    // Check nested path exists
    if (testDataKeys.has(rootField)) return true;
    
    return false;
  };

  // Find all paths from start to current state
  const pathAnalysis = useMemo(() => {
    console.log('🔍 PathDataFlowPanel DEBUG:');
    console.log('   currentState?.meta?.status:', currentState?.meta?.status);
    console.log('   allTransitions?.length:', allTransitions?.length);
    console.log('   startState:', startState);
    
    if (!currentState?.meta?.status || !allTransitions?.length) {
      console.log('   ❌ EARLY RETURN: missing status or transitions');
      return null;
    }

    const targetState = currentState.meta.status;
    
    if (targetState.toLowerCase() === startState.toLowerCase()) {
      console.log('   ❌ EARLY RETURN: target is start state');
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

    // Find common requirements across all paths
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

  if (!pathAnalysis || pathAnalysis.paths.length === 0) {
    return null;
  }

  const selectedAnalysis = pathAnalysis.analyses[selectedPathIndex] || pathAnalysis.analyses[0];

  // Count available vs missing fields
  const availableCount = selectedAnalysis.initialRequired.filter(f => isFieldAvailable(f)).length;
  const missingCount = selectedAnalysis.initialRequired.length - availableCount;

  return (
    <div 
      className="rounded-xl overflow-hidden"
      style={{ 
        background: theme.colors.background.secondary,
        border: `1px solid ${theme.colors.border}`
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:brightness-110 transition"
        style={{ background: `${theme.colors.accents.purple}15` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🛤️</span>
          <span 
            className="font-bold"
            style={{ color: theme.colors.accents.purple }}
          >
            Path Analysis
          </span>
          <span 
            className="text-sm px-2 py-0.5 rounded-full"
            style={{ 
              background: theme.colors.background.tertiary,
              color: theme.colors.text.secondary 
            }}
          >
            {pathAnalysis.paths.length} path{pathAnalysis.paths.length !== 1 ? 's' : ''} to this state
          </span>
          
          {/* Show validation status if testData loaded */}
          {loadedTestData && selectedAnalysis.initialRequired.length > 0 && (
            <span 
              className="text-sm px-2 py-0.5 rounded-full font-semibold"
              style={{ 
                background: missingCount === 0 
                  ? `${theme.colors.accents.green}20`
                  : `${theme.colors.accents.orange}20`,
                color: missingCount === 0 
                  ? theme.colors.accents.green
                  : theme.colors.accents.orange
              }}
            >
              {missingCount === 0 
                ? '✓ All data available' 
                : `⚠️ ${missingCount} missing`}
            </span>
          )}
        </div>
        
        <span style={{ color: theme.colors.text.secondary }}>
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* TestData Status Banner */}
          {loadedTestData ? (
            <div 
              className="p-3 rounded-lg text-sm"
              style={{ 
                background: `${theme.colors.accents.blue}10`,
                border: `1px solid ${theme.colors.accents.blue}30`
              }}
            >
              <div className="flex items-center gap-2">
                <span>📊</span>
                <span style={{ color: theme.colors.text.secondary }}>
                  Validating against: <strong style={{ color: theme.colors.accents.blue }}>{loadedTestData.fileName}</strong>
                </span>
                <span 
                  className="px-2 py-0.5 rounded text-xs"
                  style={{ 
                    background: theme.colors.background.tertiary,
                    color: theme.colors.text.tertiary 
                  }}
                >
                  {loadedTestData.keys.length} fields
                </span>
              </div>
            </div>
          ) : (
            <div 
              className="p-3 rounded-lg text-sm"
              style={{ 
                background: `${theme.colors.accents.yellow}10`,
                border: `1px solid ${theme.colors.accents.yellow}30`
              }}
            >
              <span style={{ color: theme.colors.accents.yellow }}>
                💡 Select a testData file above to validate requirements
              </span>
            </div>
          )}

          {/* Path Selector */}
          {pathAnalysis.paths.length > 1 && (
            <div>
              <label 
                className="text-sm font-semibold mb-2 block"
                style={{ color: theme.colors.text.secondary }}
              >
                Select Path:
              </label>
              <div className="flex flex-wrap gap-2">
                {pathAnalysis.analyses.map((analysis, idx) => {
                  const isEasiest = analysis.index === pathAnalysis.easiest?.index;
                  const pathAvailable = analysis.initialRequired.filter(f => isFieldAvailable(f)).length;
                  const pathMissing = analysis.initialRequired.length - pathAvailable;
                  const canRun = loadedTestData && pathMissing === 0;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedPathIndex(idx)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
                      style={{
                        background: selectedPathIndex === idx 
                          ? theme.colors.accents.purple
                          : theme.colors.background.tertiary,
                        color: selectedPathIndex === idx 
                          ? 'white'
                          : theme.colors.text.primary,
                        border: `2px solid ${
                          canRun ? theme.colors.accents.green :
                          selectedPathIndex === idx ? theme.colors.accents.purple : 
                          'transparent'
                        }`
                      }}
                    >
                      Path {idx + 1}
                      {isEasiest && ' ⭐'}
                      {canRun && ' ✓'}
                      <span 
                        className="ml-1 text-xs opacity-70"
                      >
                        ({analysis.initialRequired.length} req)
                      </span>
                    </button>
                  );
                })}
              </div>
              <p 
                className="text-xs mt-1"
                style={{ color: theme.colors.text.tertiary }}
              >
                ⭐ = Easiest path (fewest requirements) | ✓ = Can run with loaded testData
              </p>
            </div>
          )}

          {/* Path Visualization */}
          <div>
            <h4 
              className="font-semibold mb-2"
              style={{ color: theme.colors.text.primary }}
            >
              Path: {selectedAnalysis.path.join(' → ')}
            </h4>
            
            <div 
              className="flex items-center gap-1 flex-wrap p-3 rounded-lg"
              style={{ background: theme.colors.background.tertiary }}
            >
              {selectedAnalysis.path.map((state, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span 
                    className="px-2 py-1 rounded text-sm font-mono"
                    style={{ 
                      background: idx === 0 
                        ? `${theme.colors.accents.green}30`
                        : idx === selectedAnalysis.path.length - 1
                          ? `${theme.colors.accents.purple}30`
                          : theme.colors.background.secondary,
                      color: theme.colors.text.primary
                    }}
                  >
                    {state}
                  </span>
                  
                  {idx < selectedAnalysis.path.length - 1 && (
                    <span 
                      className="text-xs px-1"
                      style={{ color: theme.colors.accents.blue }}
                    >
                      {selectedAnalysis.pathTransitions[idx]?.event || '→'}
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Requirements Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Required at Start */}
            <div 
              className="p-3 rounded-lg"
              style={{ background: theme.colors.background.tertiary }}
            >
              <h4 
                className="font-semibold mb-2 flex items-center gap-2"
                style={{ color: theme.colors.text.primary }}
              >
                📥 Required at Start 
                <span 
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ 
                    background: theme.colors.background.secondary,
                    color: theme.colors.text.secondary 
                  }}
                >
                  {selectedAnalysis.initialRequired.length}
                </span>
              </h4>
              
              {selectedAnalysis.initialRequired.length === 0 ? (
                <div 
                  className="text-sm"
                  style={{ color: theme.colors.accents.green }}
                >
                  ✨ No testData required!
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {selectedAnalysis.initialRequired.map(field => {
                    const available = loadedTestData ? isFieldAvailable(field) : null;
                    
                    return (
                      <span 
                        key={field}
                        className="px-2 py-0.5 rounded text-xs font-mono"
                        style={{ 
                          background: available === null
                            ? `${theme.colors.accents.blue}20`
                            : available
                              ? `${theme.colors.accents.green}20`
                              : `${theme.colors.accents.red}20`,
                          color: available === null
                            ? theme.colors.accents.blue
                            : available
                              ? theme.colors.accents.green
                              : theme.colors.accents.red,
                          border: `1px solid ${
                            available === null
                              ? theme.colors.accents.blue
                              : available
                                ? theme.colors.accents.green
                                : theme.colors.accents.red
                          }40`
                        }}
                        title={
                          available === null
                            ? 'Load testData to validate'
                            : available
                              ? '✓ Found in testData'
                              : '✗ Missing from testData'
                        }
                      >
                        {available !== null && (available ? '✓ ' : '✗ ')}
                        {field}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Available at End */}
            <div 
              className="p-3 rounded-lg"
              style={{ background: theme.colors.background.tertiary }}
            >
              <h4 
                className="font-semibold mb-2 flex items-center gap-2"
                style={{ color: theme.colors.text.primary }}
              >
                📤 Produced Along Path
                <span 
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ 
                    background: theme.colors.background.secondary,
                    color: theme.colors.text.secondary 
                  }}
                >
                  {selectedAnalysis.finalContext.length}
                </span>
              </h4>
              
              {selectedAnalysis.finalContext.length === 0 ? (
                <div 
                  className="text-sm"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  No variables stored
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {selectedAnalysis.finalContext.map(field => (
                    <span 
                      key={field}
                      className="px-2 py-0.5 rounded text-xs font-mono"
                      style={{ 
                        background: `${theme.colors.accents.yellow}20`,
                        color: theme.colors.accents.yellow
                      }}
                    >
                      💾 {field}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

{/* Issues - Only show when we have testData to properly validate */}
{(() => {
  // Without testData loaded, issues are misleading (they don't account for initial data)
  if (!loadedTestData) return null;
  
  // Filter issues: remove "requires data not yet available: X, Y, Z" if ALL are in testData
  const filteredIssues = selectedAnalysis.issues.filter(issue => {
    const msg = issue.message || issue;
    
    // Check for "requires data not yet available: field1, field2, ..." pattern
    const match = msg.match(/requires data not yet available:\s*(.+)$/i);
    if (match) {
      const fieldsStr = match[1];
      const fields = fieldsStr.split(',').map(f => f.trim());
      const missingFields = fields.filter(f => !isFieldAvailable(f));
      
      if (missingFields.length === 0) {
        return false;
      }
      
      issue._missingFields = missingFields;
    }
    return true;
  });
  
  if (filteredIssues.length === 0) return null;
  
  return (
    <div 
      className="p-3 rounded-lg"
      style={{ 
        background: `${theme.colors.accents.orange}10`,
        border: `1px solid ${theme.colors.accents.orange}30`
      }}
    >
      <h4 
        className="font-semibold mb-2"
        style={{ color: theme.colors.accents.orange }}
      >
        ⚠️ Missing from testData ({filteredIssues.length})
      </h4>
      <ul className="space-y-1">
        {filteredIssues.map((issue, idx) => {
          const msg = issue.message || issue;
          
          if (issue._missingFields && issue._missingFields.length > 0) {
            const match = msg.match(/Transition "([^"]+)" requires/);
            const transitionName = match ? match[1] : 'Transition';
            return (
              <li 
                key={idx}
                className="text-sm"
                style={{ color: theme.colors.text.secondary }}
              >
                • <strong>{transitionName}</strong> needs: {issue._missingFields.join(', ')}
              </li>
            );
          }
          
          return (
            <li 
              key={idx}
              className="text-sm"
              style={{ color: theme.colors.text.secondary }}
            >
              • {msg}
            </li>
          );
        })}
      </ul>
    </div>
  );
})()}
          {/* Step-by-step Details Toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm font-semibold"
            style={{ color: theme.colors.accents.blue }}
          >
            {showDetails ? '▼ Hide' : '▶ Show'} step-by-step details
          </button>

          {showDetails && (
            <div className="space-y-2">
              {selectedAnalysis.pathTransitions.map((pt, idx) => {
                const stateCtx = selectedAnalysis.stateContexts[pt.from];
                return (
                  <div 
                    key={idx}
                    className="p-3 rounded-lg text-sm"
                    style={{ 
                      background: theme.colors.background.tertiary,
                      borderLeft: `3px solid ${theme.colors.accents.blue}`
                    }}
                  >
                    <div className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                      {pt.from} 
                      <span style={{ color: theme.colors.accents.blue }}> —{pt.event}→ </span>
                      {pt.to}
                    </div>
                    
                    {stateCtx?.required?.length > 0 && (
                      <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
                        Requires: {stateCtx.required.map(f => {
                          const avail = loadedTestData ? isFieldAvailable(f) : null;
                          return (
                            <span 
                              key={f}
                              className="mr-1"
                              style={{ 
                                color: avail === null 
                                  ? theme.colors.text.secondary 
                                  : avail 
                                    ? theme.colors.accents.green 
                                    : theme.colors.accents.red 
                              }}
                            >
                              {avail !== null && (avail ? '✓' : '✗')}{f}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    
                    {stateCtx?.produced?.length > 0 && (
                      <div className="text-xs" style={{ color: theme.colors.accents.yellow }}>
                        Produces: {stateCtx.produced.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Common Requirements */}
          {pathAnalysis.commonRequired.length > 0 && pathAnalysis.paths.length > 1 && (
            <div 
              className="p-3 rounded-lg"
              style={{ 
                background: `${theme.colors.accents.blue}10`,
                border: `1px solid ${theme.colors.accents.blue}30`
              }}
            >
              <h4 
                className="font-semibold mb-1"
                style={{ color: theme.colors.accents.blue }}
              >
                💡 Common to all paths:
              </h4>
              <p 
                className="text-sm"
                style={{ color: theme.colors.text.secondary }}
              >
                These fields are required regardless of which path: {' '}
                <span className="font-mono">
                  {pathAnalysis.commonRequired.map((f, i) => {
                    const avail = loadedTestData ? isFieldAvailable(f) : null;
                    return (
                      <span 
                        key={f}
                        style={{ 
                          color: avail === null 
                            ? theme.colors.text.primary 
                            : avail 
                              ? theme.colors.accents.green 
                              : theme.colors.accents.red 
                        }}
                      >
                        {i > 0 ? ', ' : ''}
                        {avail !== null && (avail ? '✓' : '✗')}{f}
                      </span>
                    );
                  })}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}