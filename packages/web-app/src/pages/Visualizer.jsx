// packages/web-app/src/pages/Visualizer.jsx (COMPLETE REPLACEMENT)

import { useState, useEffect } from 'react';
import StateGraph from '../components/StateGraph/StateGraph';
import StateDetailModal from '../components/StateGraph/StateDetailModal';
import { buildGraphFromDiscovery } from '../utils/graphBuilder';
import { defaultTheme } from '../config/visualizerTheme';
import StatsPanel from '../components/StatsPanel/StatsPanel';
import IssuePanel from '../components/IssuePanel/IssuePanel';
import StateRegistryPanel from '../components/StateRegistry/StateRegistryPanel';
import AddStateModal from '../components/AddStateModal/AddStateModal';

export default function Visualizer() {
  // Load from localStorage on mount
  const [projectPath, setProjectPath] = useState(
    localStorage.getItem('lastProjectPath') || '/home/dimitrij/Projects/cxm/PolePosition-TESTING'
  );
  const [discoveryResult, setDiscoveryResult] = useState(() => {
    const saved = localStorage.getItem('lastDiscoveryResult');
    return saved ? JSON.parse(saved) : null;
  });
  const [analysisResult, setAnalysisResult] = useState(() => {
    const saved = localStorage.getItem('lastAnalysisResult');
    return saved ? JSON.parse(saved) : null;
  });
  const [stateRegistry, setStateRegistry] = useState(() => {
    const saved = localStorage.getItem('lastStateRegistry');
    return saved ? JSON.parse(saved) : null;
  });
  const [graphData, setGraphData] = useState(() => {
    const saved = localStorage.getItem('lastGraphData');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [mode, setMode] = useState('view'); // 'view', 'add-transition'
  const [transitionSource, setTransitionSource] = useState(null);
  const [showAddStateModal, setShowAddStateModal] = useState(false);
  
  // Clear cache and reset state
  const handleClearCache = () => {
    localStorage.removeItem('lastProjectPath');
    localStorage.removeItem('lastDiscoveryResult');
    localStorage.removeItem('lastAnalysisResult');
    localStorage.removeItem('lastStateRegistry');
    localStorage.removeItem('lastGraphData');
    
    setDiscoveryResult(null);
    setAnalysisResult(null);
    setStateRegistry(null);
    setGraphData(null);
    setSelectedState(null);
    setSelectedNodeId(null);
  };

  // Scan project and save to localStorage
  const handleScan = async () => {
    setLoading(true);  // ✅ FIXED: Use loading, not isScanning
    setError(null);
    
    try {
      console.log('🔍 Starting discovery scan...');
      
      const response = await fetch('http://localhost:3000/api/discovery/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Discovery scan failed');
      }

      const result = await response.json();
      
      // ✅ FIXED: Save all data
      setDiscoveryResult(result);
      setAnalysisResult(result.analysis || null);  // ✅ FIXED: Was setAnalysis
      setStateRegistry(result.stateRegistry || null);
      
      // ✅ FIXED: Build graph data
      if (result.files?.implications) {
        const graph = buildGraphFromDiscovery(result);
        setGraphData(graph);
        
        // Save to localStorage
        localStorage.setItem('lastProjectPath', projectPath);
        localStorage.setItem('lastDiscoveryResult', JSON.stringify(result));
        localStorage.setItem('lastAnalysisResult', JSON.stringify(result.analysis || null));
        localStorage.setItem('lastStateRegistry', JSON.stringify(result.stateRegistry || null));
        localStorage.setItem('lastGraphData', JSON.stringify(graph));
      }
      
      console.log('✅ Scan complete');
      console.log('   - States:', result.files?.implications?.length || 0);
      console.log('   - Issues:', result.analysis?.issues?.length || 0);
      console.log('   - Mappings:', result.stateRegistry?.mappings ? Object.keys(result.stateRegistry.mappings).length : 0);
      
    } catch (err) {
      console.error('❌ Scan failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);  // ✅ FIXED: Use loading
    }
  };

  const handleRefreshSingleState = async (filePath) => {
  console.log('⚡ Fast refresh for:', filePath.split('/').pop());
  
  try {
    // Re-parse just this one file
    const response = await fetch('http://localhost:3000/api/discovery/parse-single-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });

    if (!response.ok) {
      console.error('Fast refresh failed, falling back to full scan');
      handleScan();
      return;
    }

    const updatedImplication = await response.json();
    
    // Update the specific implication in discoveryResult
    setDiscoveryResult(prev => {
      if (!prev?.files?.implications) return prev;
      
      const updatedImplications = prev.files.implications.map(imp => {
        if (imp.path === updatedImplication.path) {
          return updatedImplication;
        }
        return imp;
      });
      
      const updated = {
        ...prev,
        files: {
          ...prev.files,
          implications: updatedImplications
        }
      };
      
      // Update graph data with new node info
      const graph = buildGraphFromDiscovery(updated);
      setGraphData(graph);
      
      // Save to localStorage
      localStorage.setItem('lastDiscoveryResult', JSON.stringify(updated));
      localStorage.setItem('lastGraphData', JSON.stringify(graph));
      
      console.log('✅ Fast refresh complete');
      return updated;
    });
    
  } catch (error) {
    console.error('❌ Fast refresh error:', error);
    // Fallback to full scan
    handleScan();
  }
};

  // ✅ Expose refresh function globally for StateDetailModal
useEffect(() => {
  // Expose refresh functions globally
  window.refreshDiscovery = handleScan;
  window.refreshSingleState = handleRefreshSingleState; // 
    
    return () => {
      delete window.refreshDiscovery;
    };
  }, [projectPath]);  // ✅ FIXED: Dependency array
  
  // Handle node click in graph
  const handleNodeClick = (nodeData) => {
    setSelectedNodeId(nodeData.id);
    console.log('🖱️ Node clicked:', nodeData);
    
    if (discoveryResult) {
      const implication = discoveryResult.files.implications.find(
        imp => extractStateName(imp.metadata.className) === nodeData.id
      );
      
      if (implication) {
        const metadata = implication.metadata;
        console.log('🔍 Modal data for', nodeData.id, ':', {
  statusCode: metadata.statusCode,
  statusNumber: metadata.statusNumber,
  triggerButton: metadata.triggerButton
});
        
        if (!metadata.hasXStateConfig) {
          console.warn('⚠️ This implication has no xstateConfig:', nodeData.id);
          alert(`"${nodeData.id}" doesn't have xstateConfig metadata`);
          return;
        }
        
        const stateTransitions = (discoveryResult.transitions || [])
          .filter(t => extractStateName(t.from) === nodeData.id)
          .map(t => ({
            event: t.event,
            target: t.to
          }));
        
        const state = {
          name: nodeData.id,
          displayName: metadata.status || nodeData.label,
          meta: {
            status: metadata.status,
            triggerAction: metadata.triggerAction,
            triggerButton: metadata.triggerButton,
            afterButton: metadata.afterButton,
            previousButton: metadata.previousButton,
            notificationKey: metadata.notificationKey,
            statusCode: metadata.statusCode,
            statusNumber: metadata.statusNumber,
            platform: metadata.platform || 'unknown',
            requiredFields: metadata.requiredFields || [],
            requires: metadata.requires || {},
            setup: Array.isArray(metadata.setup) ? metadata.setup[0] : metadata.setup,
            allSetups: Array.isArray(metadata.setup) ? metadata.setup : (metadata.setup ? [metadata.setup] : []),
            actionName: (Array.isArray(metadata.setup) ? metadata.setup[0]?.actionName : metadata.setup?.actionName) || '',
          },
          transitions: stateTransitions,
          files: {
            implication: `${projectPath}/${implication.path}`,
            test: (Array.isArray(metadata.setup) ? metadata.setup[0]?.testFile : metadata.setup?.testFile) || ''
          },
          uiCoverage: metadata.uiCoverage || { total: 0, platforms: {} }
        };
        
        console.log('✅ Selected state with full metadata:', state);
        setSelectedState(state);
      } else {
        console.warn('⚠️ Implication not found for:', nodeData.id);
      }
    }
  };
  
  const closeDetail = () => {
    setSelectedState(null);
    setSelectedNodeId(null);
  };

  // Handler for creating state
  const handleCreateState = async (formData) => {
    try {
      const response = await fetch('http://localhost:3000/api/implications/create-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ State created:', result);
      
      // Show success notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      notification.textContent = `✅ Created ${result.fileName}! Re-scan to see it.`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 5000);
      
      setShowAddStateModal(false);
      
    } catch (error) {
      console.error('❌ Create failed:', error);
      throw error;
    }
  };

  // Handler for transition mode clicks
  const handleTransitionModeClick = async (nodeData) => {
    if (mode !== 'add-transition') {
      return handleNodeClick(nodeData); // Normal click in view mode
    }
    
    // Transition mode logic
    if (!transitionSource) {
      // First click - select source
      setTransitionSource(nodeData);
      console.log('📍 Source selected:', nodeData.id);
    } else {
      // Second click - select target and create transition
      if (transitionSource.id === nodeData.id) {
        alert('❌ Source and target cannot be the same');
        return;
      }
      
      const event = prompt(`Add transition from "${transitionSource.id}" to "${nodeData.id}".\n\nEnter event name (e.g., ACCEPT, REJECT):`);
      
      if (!event) {
        setTransitionSource(null);
        return;
      }
      
      try {
        // Find source implication file
        const sourceImplication = discoveryResult.files.implications.find(
          imp => extractStateName(imp.metadata.className) === transitionSource.id
        );
        
        if (!sourceImplication) {
          throw new Error(`Could not find implication for ${transitionSource.id}`);
        }
        
        const filePath = `${projectPath}/${sourceImplication.path}`;
        
        const response = await fetch('http://localhost:3000/api/implications/add-transition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath,
            event: event.toUpperCase(),
            target: nodeData.id
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Transition added:', result);
        
        // Show success
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          font-weight: bold;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = `✅ Added ${event} → ${nodeData.id}! Re-scan to see it.`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 5000);
        
        setTransitionSource(null);
        setMode('view');
        
      } catch (error) {
        console.error('❌ Add transition failed:', error);
        alert(`Failed: ${error.message}`);
        setTransitionSource(null);
      }
    }
  };
  
  return (
    <div 
      className="min-h-screen"
      style={{ background: defaultTheme.colors.background.primary }}
    >
      {/* Header */}
      <header 
        className="p-6 sticky top-0 z-40"
        style={{
          background: `linear-gradient(135deg, ${defaultTheme.colors.background.secondary}F2 0%, ${defaultTheme.colors.background.primary}F2 100%)`,
          backdropFilter: 'blur(20px)',
          borderBottom: `2px solid ${defaultTheme.colors.accents.blue}`,
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 
                className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"
              >
                🎯 State Machine Viewer
              </h1>
              <p className="text-sm mt-1" style={{ color: defaultTheme.colors.text.tertiary }}>
                Interactive visualization & documentation
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {discoveryResult && (
                <>
                  <button 
                    onClick={handleClearCache}
                    className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-90"
                    style={{ 
                      background: defaultTheme.colors.background.tertiary,
                      color: defaultTheme.colors.text.primary,
                      border: `1px solid ${defaultTheme.colors.border}`
                    }}
                    title="Clear cached data and start fresh"
                  >
                    🗑️ Clear
                  </button>
                  
                  {/* Mode Buttons */}
                  <div className="flex gap-2 ml-2 pl-2 border-l" style={{ borderColor: defaultTheme.colors.border }}>
                    <button
                      onClick={() => {
                        console.log('🔘 Add State button clicked');
                        setShowAddStateModal(true);
                      }}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                      style={{
                        background: defaultTheme.colors.accents.green,
                        color: 'white'
                      }}
                    >
                      ➕ Add State
                    </button>       
                    <button
                      onClick={() => {
                        if (mode === 'add-transition') {
                          setMode('view');
                          setTransitionSource(null);
                        } else {
                          setMode('add-transition');
                        }
                      }}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                      style={{
                        background: mode === 'add-transition' ? defaultTheme.colors.accents.orange : defaultTheme.colors.background.tertiary,
                        color: mode === 'add-transition' ? 'white' : defaultTheme.colors.text.primary,
                        border: `2px solid ${mode === 'add-transition' ? defaultTheme.colors.accents.orange : defaultTheme.colors.border}`
                      }}
                    >
                      {mode === 'add-transition' ? '✓ Adding Transition...' : '🔗 Add Transition'}
                    </button>
                  </div>
                </>
              )}
              
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-90"
                style={{ 
                  background: defaultTheme.colors.accents.blue,
                  color: 'white'
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
          
          {/* Scanner */}
          <div 
            className="p-4 rounded-lg"
            style={{ 
              background: `${defaultTheme.colors.background.tertiary}80`,
              border: `1px solid ${defaultTheme.colors.border}`
            }}
          >
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="/path/to/project"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                className="flex-1 px-4 py-2 rounded-lg"
                style={{
                  background: defaultTheme.colors.background.secondary,
                  border: `2px solid ${defaultTheme.colors.border}`,
                  color: defaultTheme.colors.text.primary
                }}
              />
              <button
                onClick={handleScan}
                disabled={loading}
                className="px-6 py-2 rounded-lg font-semibold transition"
                style={{
                  background: loading ? defaultTheme.colors.background.tertiary : defaultTheme.colors.accents.blue,
                  color: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? '⏳ Scanning...' : '🔍 Scan Project'}
              </button>
            </div>
            
            {error && (
              <div 
                className="mt-3 p-3 rounded"
                style={{ 
                  background: `${defaultTheme.colors.accents.red}20`,
                  color: defaultTheme.colors.accents.red 
                }}
              >
                ❌ {error}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats Panel */}
        {discoveryResult && (
          <div className="mb-6">
            <StatsPanel 
              discoveryResult={discoveryResult}
              theme={defaultTheme}
            />
          </div>
        )}

        {/* State Registry Panel */}
        {stateRegistry && (
          <div className="mb-6">
            <StateRegistryPanel 
              stateRegistry={stateRegistry}
              theme={defaultTheme}
              onRefresh={handleScan}
            />
          </div>
        )}
        
        {/* Graph */}
        <div 
          className="glass rounded-xl p-6 mb-8"
          style={{ border: `1px solid ${defaultTheme.colors.border}` }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: defaultTheme.colors.accents.blue }}>
                📊 Interactive State Graph
              </h2>
              <p className="text-sm" style={{ color: defaultTheme.colors.text.tertiary }}>
                💡 {mode === 'add-transition' ? 'Click source state, then target state' : 'Click nodes to view details | Scroll to zoom | Drag to pan'}
              </p>
            </div>
            
            {/* Graph Controls */}
            {graphData && (
              <div className="flex gap-2">
                <button 
                  className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-90"
                  style={{
                    background: `${defaultTheme.colors.background.tertiary}`,
                    color: defaultTheme.colors.text.primary,
                    border: `1px solid ${defaultTheme.colors.border}`
                  }}
                  onClick={() => window.cytoscapeGraph?.fit()}
                >
                  <span>🎯</span> Fit
                </button>
                <button 
                  className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-90"
                  style={{
                    background: `${defaultTheme.colors.background.tertiary}`,
                    color: defaultTheme.colors.text.primary,
                    border: `1px solid ${defaultTheme.colors.border}`
                  }}
                  onClick={() => window.cytoscapeGraph?.resetZoom()}
                >
                  <span>🔍</span> Reset
                </button>
                <button 
                  className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-90"
                  style={{
                    background: `${defaultTheme.colors.background.tertiary}`,
                    color: defaultTheme.colors.text.primary,
                    border: `1px solid ${defaultTheme.colors.border}`
                  }}
                  onClick={() => window.cytoscapeGraph?.relayout()}
                >
                  <span>🔄</span> Layout
                </button>
              </div>
            )}
          </div>
          
          {graphData ? (
            <StateGraph 
              graphData={graphData}
              onNodeClick={handleTransitionModeClick}
              selectedNode={transitionSource?.id || selectedNodeId}
              theme={defaultTheme}
              transitionMode={mode === 'add-transition'}
              transitionSource={transitionSource?.id}
            />
          ) : (
            <div 
              className="flex items-center justify-center"
              style={{ 
                height: '600px',
                color: defaultTheme.colors.text.tertiary
              }}
            >
              <p>🔍 {discoveryResult ? 'Loading graph...' : 'Scan a project to visualize its state machine'}</p>
            </div>
          )}
        </div>

        {/* Issue Panel */}
        {analysisResult && (
          <div className="mb-8">
            <IssuePanel 
              analysisResult={analysisResult}
              theme={defaultTheme}
              onIssueClick={(issue) => {
                console.log('Issue clicked:', issue);
              }}
            />
          </div>
        )}
      </main>
      
      {/* Detail Modal */}
{selectedState && (
  <StateDetailModal 
    state={selectedState}
    onClose={closeDetail}
    theme={defaultTheme}
    projectPath={projectPath}  // ✅ ADD THIS LINE
  />
)}
      
      {showAddStateModal && (
        <AddStateModal
          isOpen={showAddStateModal}
          onClose={() => setShowAddStateModal(false)}
          onCreate={handleCreateState}
          existingStates={discoveryResult?.files.implications.map(imp => ({
            id: extractStateName(imp.metadata.className),
            className: imp.metadata.className,
            platform: imp.metadata.platform || 'unknown',
            uiCoverage: {
              totalScreens: imp.metadata.uiCoverage?.total || 0
            },
            hasXState: imp.metadata.hasXStateConfig,
            status: imp.metadata.status
          }))
            .filter(state => {
              if (!state.hasXState) return false;
              return state.uiCoverage.totalScreens > 0 || 
                     state.className?.includes('Booking') ||
                     state.status;
            })
            .sort((a, b) => {
              if (b.uiCoverage.totalScreens !== a.uiCoverage.totalScreens) {
                return b.uiCoverage.totalScreens - a.uiCoverage.totalScreens;
              }
              return a.id.localeCompare(b.id);
            })
          || []}
          projectPath={projectPath}
          theme={defaultTheme}
        />
      )}
    </div>
  );
}

// Helper function
function extractStateName(className) {
  if (!className) return 'unknown';
  return className
    .replace(/Implications$/i, '')
    .replace(/Booking$/i, '')
    .replace(/^Booking/i, '')
    .replace(/([A-Z])/g, (match, p1, offset) => {
      return offset > 0 ? '_' + p1.toLowerCase() : p1.toLowerCase();
    });
}