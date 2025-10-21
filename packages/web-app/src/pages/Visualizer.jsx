import { useState } from 'react';
import StateGraph from '../components/StateGraph/StateGraph';
import StateDetailModal from '../components/StateGraph/StateDetailModal';
import { buildGraphFromDiscovery } from '../utils/graphBuilder';
import { defaultTheme } from '../config/visualizerTheme';
import StatsPanel from '../components/StatsPanel/StatsPanel';
import IssuePanel from '../components/IssuePanel/IssuePanel';

export default function Visualizer() {
  // All state declarations
  const [projectPath, setProjectPath] = useState('/home/dimitrij/Projects/cxm/PolePosition-TESTING');
  const [discoveryResult, setDiscoveryResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  
  // Handler functions
  const handleNodeClick = (nodeData) => {
    setSelectedNodeId(nodeData.id);
    console.log('🖱️ Node clicked:', nodeData);
    
    if (discoveryResult) {
      const implication = discoveryResult.files.implications.find(
        imp => extractStateName(imp.metadata.className) === nodeData.id
      );
      
      if (implication) {
        const metadata = implication.metadata;
        
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
            implication: implication.path,
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
  
  const handleScan = async () => {
    if (!projectPath.trim()) {
      alert('Please enter a project path');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📡 Scanning:', projectPath);
      
      const response = await fetch('http://localhost:3000/api/discovery/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: projectPath.trim() })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 Discovery result:', data);
      
      const { analysis, ...discoveryResult } = data;
      
      setDiscoveryResult(discoveryResult);
      setAnalysisResult(analysis);
      
      // Build graph data
      const builtGraphData = buildGraphFromDiscovery(discoveryResult);
      setGraphData(builtGraphData);
      console.log('📊 Graph data built:', builtGraphData);
      
      console.log('✅ Scan complete');
      console.log('   - States:', discoveryResult.files?.implications?.length || 0);
      console.log('   - Issues:', analysis?.summary?.total || 0);
      
    } catch (err) {
      console.error('❌ Scan failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const closeDetail = () => {
    setSelectedState(null);
    setSelectedNodeId(null);
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
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 rounded-lg font-semibold transition"
              style={{ 
                background: defaultTheme.colors.accents.blue,
                color: 'white'
              }}
            >
              🔄 Refresh
            </button>
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
                💡 Click nodes to view details | Scroll to zoom | Drag to pan
              </p>
            </div>
            
            {/* Graph Controls */}
            {graphData && (
              <div className="flex gap-2">
                <button 
                  className="px-3 py-1 rounded text-sm font-semibold transition"
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
                  className="px-3 py-1 rounded text-sm font-semibold transition"
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
                  className="px-3 py-1 rounded text-sm font-semibold transition"
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
              onNodeClick={handleNodeClick}
              selectedNode={selectedNodeId}
              theme={defaultTheme}
            />
          ) : (
            <div 
              className="flex items-center justify-center"
              style={{ 
                height: '600px',
                color: defaultTheme.colors.text.tertiary
              }}
            >
              <p>🔍 Scan a project to visualize its state machine</p>
            </div>
          )}
        </div>

         {/* ✅ NEW: Issue Panel */}
  {analysisResult && (
    <div className="mb-8">
      <IssuePanel 
        analysisResult={analysisResult}
        theme={defaultTheme}
        onIssueClick={(issue) => {
          console.log('Issue clicked:', issue);
          // TODO: Jump to state in graph or open modal
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
        />
      )}
    </div>
  );
}

// Helper functions
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