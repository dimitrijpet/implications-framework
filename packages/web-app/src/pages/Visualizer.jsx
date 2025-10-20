import { useState, useEffect } from 'react';
import StateGraph from '../components/StateGraph/StateGraph';
import NodeDetails from '../components/StateGraph/NodeDetails';
import apiClient from '../api/client';
import { buildGraphFromDiscovery, buildSampleGraph } from '../utils/graphBuilder';

export default function Visualizer() {
  const [graphData, setGraphData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  
  // Load sample graph on mount
  useEffect(() => {
    setGraphData(buildSampleGraph());
  }, []);
  
  const handleScan = async () => {
    if (!projectPath) {
      alert('Please enter a project path');
      return;
    }
    
    setLoading(true);
    try {
      const response = await apiClient.post('/discovery/scan', { projectPath });
      const discovery = response.data.result;
      
      const graph = buildGraphFromDiscovery(discovery);
      setGraphData(graph);
      
      alert(`Found ${discovery.files.implications.length} implications!`);
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Failed to scan project');
    } finally {
      setLoading(false);
    }
  };
  
  const handleNodeClick = (nodeData) => {
    setSelectedNode(nodeData.id);
  };
  
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', backgroundColor: '#F8FAFC' }}>
      {/* Sidebar */}
      <div style={{ 
        width: '350px', 
        backgroundColor: 'white', 
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Controls */}
        <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
            Project Scanner
          </h2>
          <input
            type="text"
            placeholder="/path/to/project"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              marginBottom: '8px',
              fontSize: '14px',
            }}
          />
          <button
            onClick={handleScan}
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Scanning...' : 'Scan Project'}
          </button>
          
          <button
            onClick={() => setGraphData(buildSampleGraph())}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'white',
              color: '#3B82F6',
              border: '1px solid #3B82F6',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Load Sample Graph
          </button>
        </div>
        
        {/* Node Details */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <NodeDetails 
            node={selectedNode ? graphData?.nodes.find(n => n.data.id === selectedNode)?.data : null} 
          />
        </div>
      </div>
      
      {/* Graph */}
      <div style={{ flex: 1, padding: '20px' }}>
        <div style={{ 
          height: '100%', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          {graphData ? (
            <StateGraph 
              graphData={graphData}
              onNodeClick={handleNodeClick}
              selectedNode={selectedNode}
            />
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              color: '#64748B',
            }}>
              <p>Load a graph to visualize</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}