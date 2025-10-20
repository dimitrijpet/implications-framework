import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

// Register dagre layout
cytoscape.use(dagre);

export default function StateGraph({ graphData, onNodeClick, selectedNode }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current || !graphData) return;
    
    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      
      elements: [
        ...graphData.nodes,
        ...graphData.edges,
      ],
      
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#3B82F6',
            'label': 'data(label)',
            'color': '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '14px',
            'font-weight': 'bold',
            'width': '100px',
            'height': '100px',
            'border-width': '3px',
            'border-color': '#1E40AF',
          },
        },
        {
          selector: 'node.booking',
          style: {
            'background-color': '#3B82F6',
          },
        },
        {
          selector: 'node.cms',
          style: {
            'background-color': '#10B981',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#F59E0B',
            'border-color': '#D97706',
            'border-width': '4px',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#CBD5E1',
            'target-arrow-color': '#CBD5E1',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '12px',
            'color': '#64748B',
            'text-background-color': '#fff',
            'text-background-opacity': 1,
            'text-background-padding': '3px',
          },
        },
      ],
      
      layout: {
  name: 'grid',
  rows: 3,
  cols: 4,
  padding: 50,
},
      
      minZoom: 0.3,
      maxZoom: 3,
    });
    
    // Handle node clicks
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      if (onNodeClick) {
        onNodeClick(node.data());
      }
    });
    
    // Store reference
    cyRef.current = cy;
    
    // Cleanup
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [graphData, onNodeClick]);
  
  // Update selected node styling
  useEffect(() => {
    if (!cyRef.current || !selectedNode) return;
    
    cyRef.current.nodes().removeClass('selected');
    cyRef.current.getElementById(selectedNode).addClass('selected');
  }, [selectedNode]);
  
  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: '#F8FAFC',
        borderRadius: '8px',
      }} 
    />
  );
}