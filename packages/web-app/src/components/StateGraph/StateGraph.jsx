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
  savedLayout = null,
  onLayoutChange = null
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  
  // Main graph creation - only runs when graphData changes
  useEffect(() => {
    if (!containerRef.current || !graphData) return;
    
    console.log('🔄 StateGraph creating/updating graph');
    
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
        {
          selector: 'node[borderStyle="multi"]',
          style: {
            'border-width': theme.graph.multiBorderWidth,
            'border-style': 'dashed',
            'border-color': theme.graph.multiBorderColor,
            'border-opacity': 1
          }
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 8,
            'border-color': '#fff',
            'border-style': 'solid'
          }
        },
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
// ============================================
        // EDGE STYLE - Default (no requires)
        // ============================================
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
            'line-style': 'solid',
            
            'label': (ele) => {
              const event = ele.data('label');
              const platforms = ele.data('platforms');
              const requiresLabel = ele.data('requiresLabel');
              
              let label = event;
              
              if (platforms && platforms.length > 0) {
                const badges = platforms.map(p => 
                  p === 'web' ? '🌐' : '📱'
                ).join('');
                label += ` ${badges}`;
              }
              
              if (requiresLabel) {
                label += `\n${requiresLabel}`;
              }
              
              return label;
            },
            'font-size': '11px',
            'text-background-color': theme.colors.background.secondary,
            'text-background-opacity': 0.9,
            'text-background-padding': '4px',
            'color': '#fff',
            'text-rotation': 'autorotate',
            'text-margin-y': -10,
            'text-wrap': 'wrap',
            'text-max-width': '200px',
          }
        },
        
        // Conditional edges - dashed line + colored text
        {
          selector: 'edge[?hasRequires]',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [8, 4],
            'color': (ele) => ele.data('requiresColor') || '#A855F7',
          }
        }
      ],
      
      layout: {
        name: 'preset',
        fit: true,
        padding: 50
      },
      
      minZoom: 0.3,
      maxZoom: 3,
    });
    
    // Apply layout
    // Apply layout
const applyLayout = () => {
  if (window.__savedGraphLayout && window.__savedGraphLayout.positions) {
    console.log('📍 Applying saved layout from window global');
    
    cy.nodes().forEach(node => {
      if (node.data('type') === 'screen_group') return;
      
      const savedPos = window.__savedGraphLayout.positions[node.id()];
      if (savedPos) {
        node.position(savedPos);
      }
    });
    
    // Mark as applied
    window.__lastAppliedVersion = window.__savedGraphLayoutVersion;
    
    cy.fit(null, 50);
    console.log('✅ Layout applied!');
  } else {
    // ✨ ONLY run dagre if we've never saved a layout
    // This prevents re-layout when toggling screens
    if (!window.__savedGraphLayoutVersion) {
      console.log('🎨 Running dagre layout (first time, no saved layout)');
      
      cy.layout({
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 100,
        rankSep: 150,
        padding: 50,
        animate: true,
        animationDuration: 500,
        stop: () => {
          console.log('✅ Dagre layout complete');
        }
      }).run();
    } else {
      console.log('⏭️ Skipping dagre - using existing positions');
    }
  }
};
    
    applyLayout();
    
    // Event handlers
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
    window.cytoscapeGraph = cy; 
    
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [graphData]); // Only re-create when graphData changes
  
  // Watch for saved layout version changes
  useEffect(() => {
    if (!cyRef.current) return;
    
    const interval = setInterval(() => {
      if (window.__savedGraphLayoutVersion && 
          window.__savedGraphLayoutVersion !== window.__lastAppliedVersion) {
        
        console.log('📍 New layout version detected:', window.__savedGraphLayoutVersion);
        
        if (window.__savedGraphLayout?.positions) {
          console.log('🔄 Re-applying updated layout...');
          
          cyRef.current.nodes().forEach(node => {
            if (node.data('type') === 'screen_group') return;
            
            const savedPos = window.__savedGraphLayout.positions[node.id()];
            if (savedPos) {
              node.position(savedPos);
            }
          });
          
          cyRef.current.fit(null, 50);
          console.log('✅ Updated layout applied!');
        }
        
        window.__lastAppliedVersion = window.__savedGraphLayoutVersion;
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  // Handle screen groups toggle
  useEffect(() => {
    if (!cyRef.current) return;
    console.log('📺 Screen groups toggled:', showScreenGroups);
  }, [showScreenGroups]);
  
  // Update selected node styling
  useEffect(() => {
    if (!cyRef.current || !selectedNode) return;
    
    cyRef.current.nodes().removeClass('highlighted');
    cyRef.current.getElementById(selectedNode).addClass('highlighted');
  }, [selectedNode]);
  
  // Expose graph controls globally
  useEffect(() => {
  if (!cyRef.current) return;
  
  const interval = setInterval(() => {
    if (window.__savedGraphLayoutVersion && 
        window.__savedGraphLayoutVersion !== window.__lastAppliedVersion) {
      
      console.log('🔄 New layout version detected!');
      
      if (window.__savedGraphLayout?.positions) {
        cyRef.current.nodes().forEach(node => {
          if (node.data('type') === 'screen_group') return;
          
          const savedPos = window.__savedGraphLayout.positions[node.id()];
          if (savedPos) node.position(savedPos);
        });
        
        cyRef.current.fit(null, 50);
      }
      
      window.__lastAppliedVersion = window.__savedGraphLayoutVersion;
    }
  }, 500);
  
  return () => clearInterval(interval);
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