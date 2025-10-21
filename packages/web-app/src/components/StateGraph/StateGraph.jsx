import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { defaultTheme, getPlatformStyle } from '../../config/visualizerTheme';

cytoscape.use(dagre);

export default function StateGraph({ graphData, onNodeClick, selectedNode, theme = defaultTheme }) {
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
            'background-color': 'data(color)',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#fff',
            'text-outline-color': '#000',
            'text-outline-width': 2,
            'font-size': '14px',
            'font-weight': 'bold',
            'width': theme.graph.nodeWidth + 'px',
            'height': theme.graph.nodeHeight + 'px',
            'border-width': theme.graph.borderWidth,
            'border-color': 'data(platformColor)',
            'shadow-blur': theme.graph.shadowBlur,
            'shadow-color': 'data(platformColor)',
            'shadow-opacity': 0.8,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
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
      if (onNodeClick) {
        onNodeClick(node.data());
      }
    });
    
    // Hover effect for multi-platform nodes
    cy.on('mouseover', 'node', function(evt) {
      const node = evt.target;
      const allPlatforms = node.data('allPlatforms');
      
      if (allPlatforms && allPlatforms.length > 1) {
        // Show tooltip or highlight effect
        node.style('border-width', theme.graph.multiBorderWidth + 2);
      }
    });
    
    cy.on('mouseout', 'node', function(evt) {
      const node = evt.target;
      const allPlatforms = node.data('allPlatforms');
      
      if (allPlatforms && allPlatforms.length > 1) {
        node.style('border-width', theme.graph.multiBorderWidth);
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