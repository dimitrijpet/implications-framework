import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { defaultTheme, getPlatformStyle } from '../../config/visualizerTheme';
function getNodeColor(ele) {
  const status = ele.data('status') || ele.id();
  const colors = {
    'pending': '#f59e0b',
    'accepted': '#10b981',
    'rejected': '#ef4444',
    'cancelled': '#6b7280',
    'completed': '#3b82f6'
  };
  return colors[status.toLowerCase()] || '#8b5cf6';
}

cytoscape.use(dagre);

export default function StateGraph({ graphData, onNodeClick, selectedNode, theme, transitionMode = false, transitionSource = null }) {

  const containerRef = useRef(null);
  const cyRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current || !graphData) return;
    
    const cy = cytoscape({
      container: containerRef.current,
      
      elements: [
        ...graphData.nodes,
        ...graphData.edges,
      ],
      
      style: [
        // Base node style
        {
          selector: 'node',
    style: {
      'background-color': (ele) => getNodeColor(ele),
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'color': '#ffffff',
      'font-size': '14px',
      'font-weight': 'bold',
      'text-outline-width': 2,
      'text-outline-color': (ele) => getNodeColor(ele),
      'width': 80,
      'height': 80,
      'border-width': (ele) => {
        if (transitionMode && ele.id() === transitionSource) {
          return 6; // Thick border for source in transition mode
        }
        return ele.id() === selectedNode ? 4 : 2;
      },
      'border-color': (ele) => {
        if (transitionMode && ele.id() === transitionSource) {
          return theme.colors.accents.orange; // Orange for selected source
        }
        return ele.id() === selectedNode ? theme.colors.accents.blue : getNodeColor(ele);
      },
      'border-opacity': 1
    }
  },

        
        // Multi-platform nodes (green dashed border)
        {
          selector: 'node[borderStyle="multi"]',
          style: {
            'border-width': theme.graph.multiBorderWidth,
            'border-style': 'dashed',
            'border-color': theme.graph.multiBorderColor,
            'border-opacity': 1
          }
        },
        
        // Highlighted (selected) node
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 8,
            'border-color': '#fff',
            'border-style': 'solid'
          }
        },
        
        // Edge style
        {
          selector: 'edge',
          style: {
            'width': theme.graph.edgeWidth,
            'line-color': 'data(platformColor)',
            'target-arrow-color': 'data(platformColor)',
            'target-arrow-shape': 'triangle',
            'target-arrow-size': theme.graph.arrowSize,
            'arrow-scale': 2,
            'curve-style': 'bezier',
            'control-point-step-size': 60,
            'label': 'data(label)',
            'font-size': '12px',
            'text-background-color': theme.colors.background.secondary,
            'text-background-opacity': 0.9,
            'text-background-padding': '4px',
            'color': '#fff',
            'text-rotation': 'autorotate',
            'text-margin-y': 0
          }
        }
      ],
      
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 100,
        rankSep: 150,
        padding: 50,
        animate: true,
        animationDuration: 500
      },
      
      minZoom: 0.3,
      maxZoom: 3,
    });
    
    // Node click handler
    cy.on('tap', 'node', (event) => {
  const node = event.target;
  const nodeData = node.data();
  
  if (transitionMode) {
    console.log(transitionSource ? '👉 Select target state' : '👆 Source state selected');
  }
  
  onNodeClick(nodeData);
});
    
    // Hover effect for multi-platform nodes
    cy.on('mouseover', 'node', () => {
  if (cyRef.current) {
    const container = cyRef.current.container();
    container.style.cursor = transitionMode ? 'crosshair' : 'pointer';
  }
});
    
    cy.on('mouseout', 'node', () => {
  if (cyRef.current) {
    const container = cyRef.current.container();
    container.style.cursor = transitionMode ? 'crosshair' : 'default';
  }
});
    
    cyRef.current = cy;
    
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [graphData, onNodeClick, theme]);
  
  // Update selected node styling
  useEffect(() => {
    if (!cyRef.current || !selectedNode) return;
    
    cyRef.current.nodes().removeClass('highlighted');
    cyRef.current.getElementById(selectedNode).addClass('highlighted');
  }, [selectedNode]);
  
  // Expose graph controls
  useEffect(() => {
    if (!cyRef.current) return;
    
    window.cytoscapeGraph = {
      fit: () => cyRef.current.fit(null, 50),
      resetZoom: () => {
        cyRef.current.zoom(1);
        cyRef.current.center();
      },
      relayout: () => {
        cyRef.current.layout({
          name: 'dagre',
          rankDir: 'LR',
          nodeSep: 100,
          rankSep: 150,
          padding: 50,
          animate: true,
          animationDuration: 600
        }).run();
      }
    };
  }, []);
  
  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '600px',
        background: `linear-gradient(135deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.primary} 100%)`,
        borderRadius: '16px',
        border: `2px solid ${theme.colors.border}`,
        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)',
      }} 
    />
  );
}