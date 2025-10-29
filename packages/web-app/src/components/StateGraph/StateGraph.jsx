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

// Generate colors for screen groups
function getScreenGroupColor(screenName, index) {
  const colors = [
    { bg: 'rgba(59, 130, 246, 0.02)', border: 'rgba(59, 130, 246, 0.15)', text: 'rgba(59, 130, 246, 0.9)' },
    { bg: 'rgba(16, 185, 129, 0.02)', border: 'rgba(16, 185, 129, 0.15)', text: 'rgba(16, 185, 129, 0.9)' },
    { bg: 'rgba(168, 85, 247, 0.02)', border: 'rgba(168, 85, 247, 0.15)', text: 'rgba(168, 85, 247, 0.9)' },
    { bg: 'rgba(245, 158, 11, 0.02)', border: 'rgba(245, 158, 11, 0.15)', text: 'rgba(245, 158, 11, 0.9)' },
    { bg: 'rgba(236, 72, 153, 0.02)', border: 'rgba(236, 72, 153, 0.15)', text: 'rgba(236, 72, 153, 0.9)' },
    { bg: 'rgba(6, 182, 212, 0.02)', border: 'rgba(6, 182, 212, 0.15)', text: 'rgba(6, 182, 212, 0.9)' },
  ];
  
  return colors[index % colors.length];
}

cytoscape.use(dagre);

export default function StateGraph({ 
  graphData, 
  onNodeClick, 
  selectedNode, 
  theme, 
  transitionMode = false, 
  transitionSource = null,
  showScreenGroups = false,
  screenGroups = {},
  savedLayout = null,  // ✨ Saved layout positions
  onLayoutChange = null  // ✨ Callback when layout changes
}) {

  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const layoutAppliedRef = useRef(false);  // ✨ Track if we've applied layout
  
  useEffect(() => {
    if (!containerRef.current || !graphData) return;
    
    // Reset layout applied flag when graph data changes
    layoutAppliedRef.current = false;
    
    // Build elements with compound nodes if screen grouping enabled
    let elements = {
      nodes: [...graphData.nodes],
      edges: [...graphData.edges]
    };

    if (showScreenGroups && screenGroups) {
      let screenIndex = 0;
      
      Object.entries(screenGroups).forEach(([screenName, stateIds]) => {
        if (stateIds.length > 1) {
          const colors = getScreenGroupColor(screenName, screenIndex);
          
          elements.nodes.push({
            data: {
              id: `screen_${screenName}`,
              label: `📺 ${screenName}`,
              type: 'screen_group',
              groupBgColor: colors.bg,
              groupBorderColor: colors.border,
              groupTextColor: colors.text
            },
            classes: 'screen-group'
          });

          stateIds.forEach(stateId => {
            const node = elements.nodes.find(n => n.data.id === stateId);
            if (node) {
              node.data.parent = `screen_${screenName}`;
            }
          });
          
          screenIndex++;
        }
      });
    }
    
    const cy = cytoscape({
      container: containerRef.current,
      
      elements: [
        ...elements.nodes,
        ...elements.edges,
      ],
      
      style: [
        // BASE NODE STYLE
        {
          selector: 'node[type="state"]',
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
                return 6;
              }
              return ele.id() === selectedNode ? 4 : 2;
            },
            'border-color': (ele) => {
              if (transitionMode && ele.id() === transitionSource) {
                return theme.colors.accents.orange;
              }
              return ele.id() === selectedNode ? theme.colors.accents.blue : getNodeColor(ele);
            },
            'border-opacity': 1
          }
        },
        
        // Fallback for nodes without type
        {
          // selector: 'node[!type]',
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
                return 6;
              }
              return ele.id() === selectedNode ? 4 : 2;
            },
            'border-color': (ele) => {
              if (transitionMode && ele.id() === transitionSource) {
                return theme.colors.accents.orange;
              }
              return ele.id() === selectedNode ? theme.colors.accents.blue : getNodeColor(ele);
            },
            'border-opacity': 1
          }
        },
        
        // Multi-platform nodes
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
        
        // SCREEN GROUP NODES - Ultra subtle with color variation
        {
          selector: 'node.screen-group',
          style: {
            'background-color': (ele) => ele.data('groupBgColor'),
            'background-opacity': 0.05,
            'border-width': 1.5,
            'border-color': (ele) => ele.data('groupBorderColor'),
            'border-style': 'dashed',
            'border-opacity': 0.4,
            'label': 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'color': (ele) => ele.data('groupTextColor'),
            'font-size': '18px',
            'font-weight': '400',
            'text-outline-width': 0,
            'text-outline-color': 'transparent',
            'text-background-opacity': 0,
            'padding': '35px',
            'text-margin-y': -12,
            'shape': 'roundrectangle'
          }
        },
        
        // EDGE STYLE
        {
          selector: 'edge',
          style: {
            'width': theme.graph.edgeWidth,
            'line-color': 'data(platformColor)',
            'target-arrow-color': 'data(platformColor)',
            'target-arrow-shape': 'triangle',
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
        name: 'preset',  // ✨ Start with preset (will apply saved or run dagre)
        fit: true,
        padding: 50
      },
      
      minZoom: 0.3,
      maxZoom: 3,
    });
    
    // ✨ CRITICAL: Apply saved layout or run dagre
    if (savedLayout && savedLayout.positions && !layoutAppliedRef.current) {
      console.log('📍 Applying saved layout positions...');
      
      // Apply saved positions
      cy.nodes().forEach(node => {
        const savedPos = savedLayout.positions[node.id()];
        if (savedPos) {
          node.position(savedPos);
        }
      });
      
      // Fit to screen
      cy.fit(null, 50);
      layoutAppliedRef.current = true;
      
      console.log('✅ Saved layout applied');
    } else if (!layoutAppliedRef.current) {
      // Run dagre layout if no saved layout
      console.log('🎨 Running dagre layout...');
      cy.layout({
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 100,
        rankSep: 150,
        padding: 50,
        animate: true,
        animationDuration: 500
      }).run();
      layoutAppliedRef.current = true;
    }
    
    // Node click handler
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeData = node.data();
      
      if (nodeData.type === 'screen_group') {
        return;
      }
      
      if (transitionMode) {
        console.log(transitionSource ? '👉 Select target state' : '👆 Source state selected');
      }
      
      onNodeClick(nodeData);
    });
    
    // Hover effect
    cy.on('mouseover', 'node', (event) => {
      const nodeData = event.target.data();
      
      if (cyRef.current) {
        const container = cyRef.current.container();
        
        if (nodeData.type === 'screen_group') {
          container.style.cursor = 'default';
        } else {
          container.style.cursor = transitionMode ? 'crosshair' : 'pointer';
        }
      }
    });
    
    cy.on('mouseout', 'node', () => {
      if (cyRef.current) {
        const container = cyRef.current.container();
        container.style.cursor = transitionMode ? 'crosshair' : 'default';
      }
    });
    
    // ✨ Track when nodes are dragged
    cy.on('dragfree', 'node', () => {
      if (onLayoutChange) {
        const positions = {};
        cy.nodes().forEach(node => {
          positions[node.id()] = node.position();
        });
        
        onLayoutChange({ positions });
      }
    });
    
    cyRef.current = cy;
    
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [graphData, onNodeClick, theme, showScreenGroups, screenGroups, transitionMode, transitionSource, selectedNode, savedLayout, onLayoutChange]);
  
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
        layoutAppliedRef.current = false;  // Allow re-layout
        cyRef.current.layout({
          name: 'dagre',
          rankDir: 'LR',
          nodeSep: 100,
          rankSep: 150,
          padding: 50,
          animate: true,
          animationDuration: 600
        }).run();
      },
      // Get current layout
      getLayout: () => {
        const positions = {};
        cyRef.current.nodes().forEach(node => {
          positions[node.id()] = node.position();
        });
        return { positions };
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