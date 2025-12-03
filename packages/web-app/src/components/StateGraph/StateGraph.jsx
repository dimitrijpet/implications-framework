import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { defaultTheme, getPlatformStyle } from '../../config/visualizerTheme';

// Normalize hex color - remove alpha channel if present
function normalizeHexColor(color) {
  if (!color) return '#8b5cf6';
  if (color.length === 9 && color.startsWith('#')) {
    return color.substring(0, 7);
  }
  return color;
}

// Fallback color function - only used if node.data.color is missing
function getNodeColorFallback(ele) {
  const id = ele.id() || '';
  const status = ele.data('status') || '';
  const lookup = status || id;
  
  const colors = {
    'pending': '#f59e0b',
    'accepted': '#10b981',
    'rejected': '#ef4444',
    'cancelled': '#6b7280',
    'completed': '#3b82f6',
    'checked_in': '#8b5cf6',
  };
  return colors[lookup.toLowerCase()] || '#8b5cf6';
}

function getScreenGroupColor(screenName, index) {
  const colors = [
    { bg: 'rgba(59, 130, 246, 0.02)', border: 'rgba(59, 130, 246, 0.15)', text: 'rgba(59, 130, 246, 0.6)' },
    { bg: 'rgba(16, 185, 129, 0.02)', border: 'rgba(16, 185, 129, 0.15)', text: 'rgba(16, 185, 129, 0.6)' },
    { bg: 'rgba(168, 85, 247, 0.02)', border: 'rgba(168, 85, 247, 0.15)', text: 'rgba(168, 85, 247, 0.6)' },
    { bg: 'rgba(245, 158, 11, 0.02)', border: 'rgba(245, 158, 11, 0.15)', text: 'rgba(245, 158, 11, 0.6)' },
    { bg: 'rgba(236, 72, 153, 0.02)', border: 'rgba(236, 72, 153, 0.15)', text: 'rgba(236, 72, 153, 0.6)' },
    { bg: 'rgba(6, 182, 212, 0.02)', border: 'rgba(6, 182, 212, 0.15)', text: 'rgba(6, 182, 212, 0.6)' },
  ];
  return colors[index % colors.length];
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(139, 92, 246, ${alpha})`;
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  onLayoutChange = null,
  tagConfig = {},
  activeFilters = {},
}) {

  const containerRef = useRef(null);
  const cyRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current || !graphData) return;
    
    // Build elements
    let elements = {
      nodes: [...graphData.nodes],
      edges: [...graphData.edges]
    };

    // ✅ Tag filtering
    const filterKeys = Object.keys(activeFilters || {});
    if (filterKeys.length > 0) {
      elements.nodes = elements.nodes.filter(node => {
        const nodeTags = node.data.tags || {};
        return Object.entries(nodeTags).some(([cat, val]) => {
          const key = `${cat}:${val}`;
          return activeFilters[key];
        });
      });
      
      const visibleIds = new Set(elements.nodes.map(n => n.data.id));
      elements.edges = elements.edges.filter(e => 
        visibleIds.has(e.data.source) && visibleIds.has(e.data.target)
      );
    }

    // ✅ Tag grouping (only if style !== 'none')
    const tagGroups = {};
    Object.entries(tagConfig || {}).forEach(([key, config]) => {
      if (config?.style && config.style !== 'none') {
        const parts = key.split(':');
        const value = parts.slice(1).join(':');
        tagGroups[key] = { 
          nodeIds: [], 
          color: config.color || '#8b5cf6', 
          label: value,
          style: config.style
        };
      }
    });

    if (Object.keys(tagGroups).length > 0) {
      elements.nodes.forEach(node => {
        const nodeTags = node.data.tags || {};
        Object.entries(nodeTags).forEach(([category, value]) => {
          const key = `${category}:${value}`;
          if (tagGroups[key]) {
            tagGroups[key].nodeIds.push(node.data.id);
          }
        });
      });

      Object.entries(tagGroups).forEach(([key, group]) => {
        if (group.nodeIds.length > 0) {
          elements.nodes.push({
            data: {
              id: `taggroup_${key}`,
              label: group.label,
              type: 'tag_group',
              groupColor: group.color,
            },
            classes: `tag-group tag-group-${group.style}`
          });

          group.nodeIds.forEach(nodeId => {
            const node = elements.nodes.find(n => n.data.id === nodeId);
            if (node && !node.data.parent) {
              node.data.parent = `taggroup_${key}`;
            }
          });
        }
      });
    }

    // Screen groups
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
        // ============================================
        // STATE NODES
        // ============================================
        {
          selector: 'node[type="state"]',
          style: {
            'background-color': (ele) => ele.data('color') || getNodeColorFallback(ele),
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#ffffff',
            'font-size': '14px',
            'font-weight': 'bold',
            'text-outline-width': 2,
            'text-outline-color': (ele) => ele.data('color') || getNodeColorFallback(ele),
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
              if (ele.id() === selectedNode) {
                return theme.colors.accents.blue;
              }
              return ele.data('color') || getNodeColorFallback(ele);
            },
            'border-opacity': 1
          }
        },
        
        // Fallback for nodes without type
        {
          selector: 'node:not([type])',
          style: {
            'background-color': (ele) => ele.data('color') || getNodeColorFallback(ele),
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#ffffff',
            'font-size': '14px',
            'font-weight': 'bold',
            'text-outline-width': 2,
            'text-outline-color': (ele) => ele.data('color') || getNodeColorFallback(ele),
            'width': 80,
            'height': 80,
            'border-width': 2,
            'border-color': (ele) => ele.data('color') || getNodeColorFallback(ele),
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
        
        // Highlighted node
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 8,
            'border-color': '#fff',
            'border-style': 'solid'
          }
        },
        
        // Screen groups
        {
          selector: 'node.screen-group',
          style: {
            'background-color': (ele) => ele.data('groupBgColor'),
            'background-opacity': 0.02,
            'border-width': 1.5,
            'border-color': (ele) => ele.data('groupBorderColor'),
            'border-style': 'dashed',
            'border-opacity': 0.2,
            'label': 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'color': (ele) => ele.data('groupTextColor'),
            'font-size': '14px',
            'font-weight': '300',
            'padding': '30px',
            'text-margin-y': -10,
            'shape': 'roundrectangle'
          }
        },
        
        // Tag group - solid border only (NO fill)
        {
          selector: 'node.tag-group-solid',
          style: {
            'background-opacity': 0,
            'border-width': 2,
            'border-color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'border-style': 'solid',
            'border-opacity': 0.4,
            'label': 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'font-size': '13px',
            'font-weight': '600',
            'text-outline-width': 0,
            'padding': '40px',
            'text-margin-y': -10,
            'shape': 'roundrectangle'
          }
        },
        
        // Tag group - dashed border only (NO fill)
        {
          selector: 'node.tag-group-dashed',
          style: {
            'background-opacity': 0,
            'border-width': 2,
            'border-color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'border-style': 'dashed',
            'border-opacity': 0.4,
            'label': 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'font-size': '12px',
            'font-weight': '500',
            'text-outline-width': 0,
            'padding': '35px',
            'text-margin-y': -8,
            'shape': 'roundrectangle'
          }
        },
        
        // Tag group - filled (50% opacity background)
        {
          selector: 'node.tag-group-filled',
          style: {
            'background-color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'background-opacity': 0.1,
            'border-width': 1,
            'border-color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'border-style': 'solid',
            'border-opacity': 0.5,
            'label': 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'color': '#ffffff',
            'font-size': '13px',
            'font-weight': '600',
            'text-outline-width': 2,
            'text-outline-color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'text-outline-opacity': 0.2,
            'padding': '40px',
            'text-margin-y': -10,
            'shape': 'roundrectangle'
          }
        },
        
        // ============================================
        // EDGES - with requires/conditions support
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
            
            // ✅ Label with event + platform badges + requires
            'label': (ele) => {
              const event = ele.data('label');
              const platforms = ele.data('platforms');
              const requiresLabel = ele.data('requiresLabel');
              
              let label = event;
              
              // Add platform badges
              if (platforms && platforms.length > 0) {
                const badges = platforms.map(p => 
                  p === 'web' ? '🌐' : '📱'
                ).join('');
                label += ` ${badges}`;
              }
              
              // Add requires label on new line
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
        
        // ✅ Conditional edges (with requires) - dashed with custom color
        {
          selector: 'edge[?hasRequires]',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [8, 4],
            'line-color': (ele) => ele.data('requiresColor') || '#A855F7',
            'target-arrow-color': (ele) => ele.data('requiresColor') || '#A855F7',
            'color': (ele) => ele.data('requiresColor') || '#A855F7',
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
    
    // Event handlers
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeData = node.data();
      
      if (nodeData.type === 'screen_group' || nodeData.type === 'tag_group') {
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
        
        if (nodeData.type === 'screen_group' || nodeData.type === 'tag_group') {
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
    
    cyRef.current = cy;
    
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [graphData, onNodeClick, theme, showScreenGroups, screenGroups, transitionMode, transitionSource, selectedNode, tagConfig, activeFilters]);
  
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