import { useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { defaultTheme, getPlatformStyle } from '../../config/visualizerTheme';

// ============================================
// UTILITY FUNCTIONS
// ============================================

function normalizeHexColor(color) {
  if (!color) return '#8b5cf6';
  if (color.length === 9 && color.startsWith('#')) {
    return color.substring(0, 7);
  }
  return color;
}

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

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(139, 92, 246, ${alpha})`;
  hex = hex.replace('#', '');
  if (hex.length < 6) return `rgba(139, 92, 246, ${alpha})`;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================
// BOUNDING BOX CALCULATION
// ============================================

function calculateBoundingBox(cy, nodeIds, padding = 40) {
  if (!nodeIds || nodeIds.length === 0) return null;
  
  const nodes = cy.nodes().filter(n => nodeIds.includes(n.id()) && n.data('type') === 'state');
  if (nodes.length === 0) return null;
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  nodes.forEach(node => {
    const pos = node.position();
    const width = node.width() || 80;
    const height = node.height() || 80;
    
    minX = Math.min(minX, pos.x - width / 2);
    minY = Math.min(minY, pos.y - height / 2);
    maxX = Math.max(maxX, pos.x + width / 2);
    maxY = Math.max(maxY, pos.y + height / 2);
  });
  
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    padding: padding, // Store for reference
  };
}

// ============================================
// GROUP BOX MANAGEMENT
// ============================================

function createOrUpdateGroupBoxes(cy, tagGroups, theme) {
  // Remove existing group boxes
  cy.nodes('[type="group_box"]').remove();
  
  // Calculate initial bounds to determine size ordering
  const groupsWithBounds = Object.entries(tagGroups)
    .map(([key, group]) => {
      const bounds = calculateBoundingBox(cy, group.nodeIds, 40); // Base padding
      if (!bounds) return null;
      const area = bounds.width * bounds.height;
      return { key, ...group, area };
    })
    .filter(g => g !== null)
    .sort((a, b) => b.area - a.area); // Largest first
  
  // Now recalculate with staggered padding (larger groups get more padding)
  const BASE_PADDING = 35;
  const PADDING_STEP = 15; // Each layer adds this much padding
  
  const sortedGroups = groupsWithBounds.map((group, index) => {
    // Larger groups (lower index after sort) get more padding
    const padding = BASE_PADDING + (index * PADDING_STEP);
    const bounds = calculateBoundingBox(cy, group.nodeIds, padding);
    return { ...group, bounds };
  }).filter(g => g.bounds !== null);
  
  // Create group box nodes (largest/outermost first = lowest z-index)
  sortedGroups.forEach((group, index) => {
    const { bounds, key, label, color, style } = group;
    const normalizedColor = normalizeHexColor(color);
    
    // z-index: larger boxes go behind (lower z)
    const zIndex = -1000 + index;
    
    cy.add({
      group: 'nodes',
      data: {
        id: `groupbox_${key}`,
        label: label,
        type: 'group_box',
        groupStyle: style,
        groupColor: normalizedColor,
        bounds: bounds,
        zIndex: zIndex,
      },
      position: {
        x: bounds.centerX,
        y: bounds.centerY,
      },
      locked: true,
      grabbable: false,
      selectable: false,
      classes: `group-box group-box-${style}`,
    });
  });
  
  // Update sizes after adding
  cy.nodes('[type="group_box"]').forEach(node => {
    const bounds = node.data('bounds');
    if (bounds) {
      node.style({
        'width': bounds.width,
        'height': bounds.height,
      });
    }
  });
}

// ============================================
// LAYOUT PERSISTENCE
// ============================================

function getLayoutStorageKey(projectPath) {
  return `graphLayout:${projectPath || 'default'}`;
}

function saveLayoutToStorage(cy, projectPath) {
  const positions = {};
  cy.nodes('[type="state"]').forEach(node => {
    const pos = node.position();
    positions[node.id()] = { x: pos.x, y: pos.y };
  });
  
  const layout = {
    positions,
    savedAt: Date.now(),
  };
  
  try {
    localStorage.setItem(getLayoutStorageKey(projectPath), JSON.stringify(layout));
    console.log(`💾 Saved ${Object.keys(positions).length} node positions`);
  } catch (e) {
    console.warn('Failed to save layout to localStorage:', e);
  }
  
  return layout;
}

function loadLayoutFromStorage(projectPath) {
  try {
    const saved = localStorage.getItem(getLayoutStorageKey(projectPath));
    if (saved) {
      const layout = JSON.parse(saved);
      console.log(`📂 Loaded layout with ${Object.keys(layout.positions || {}).length} positions`);
      return layout;
    }
  } catch (e) {
    console.warn('Failed to load layout from localStorage:', e);
  }
  return null;
}

function applyLayoutToGraph(cy, layout) {
  if (!layout?.positions) return false;
  
  let appliedCount = 0;
  cy.nodes('[type="state"]').forEach(node => {
    const savedPos = layout.positions[node.id()];
    if (savedPos) {
      node.position(savedPos);
      appliedCount++;
    }
  });
  
  console.log(`📍 Applied ${appliedCount} saved positions`);
  return appliedCount > 0;
}

// ============================================
// REGISTER DAGRE
// ============================================
cytoscape.use(dagre);

// ============================================
// MAIN COMPONENT
// ============================================

export default function StateGraph({
  graphData,
  onNodeClick,
  selectedNodeId,  // This is passed but you're using "selectedNode"
  theme,
  showScreenGroups,
  screenGroups,
  savedLayout,
  onLayoutChange,
  tagConfig,
  activeFilters,
  projectPath,
  loadedTestData,
  transitionMode = { enabled: false, source: null }  // ← ADD DEFAULT
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const tagGroupsRef = useRef({});
  const debounceRef = useRef(null);
  
  // Debounced function to update group boxes after drag
  const updateGroupBoxesDebounced = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      if (cyRef.current && Object.keys(tagGroupsRef.current).length > 0) {
        createOrUpdateGroupBoxes(cyRef.current, tagGroupsRef.current, theme);
      }
    }, 50);
  }, [theme]);
  
  // Main effect to build graph
  useEffect(() => {
    if (!containerRef.current || !graphData) return;
    
    // ========================================
    // BUILD ELEMENTS (NO compound nodes!)
    // ========================================
    let elements = {
      nodes: graphData.nodes.map(n => ({
        ...n,
        data: { ...n.data, parent: undefined } // Remove any parent relationships
      })),
      edges: [...graphData.edges]
    };

// ========================================
// TAG FILTERING
// ========================================
const filterKeys = Object.keys(activeFilters || {});
if (filterKeys.length > 0) {
  elements.nodes = elements.nodes.filter(node => {
    const nodeTags = node.data.tags || {};
    return Object.entries(nodeTags).some(([cat, val]) => {
      // ✅ Handle both array and string values
      const values = Array.isArray(val) ? val : [val];
      return values.some(v => {
        const key = `${cat}:${v}`;
        return activeFilters[key];
      });
    });
  });
      
      const visibleIds = new Set(elements.nodes.map(n => n.data.id));
      elements.edges = elements.edges.filter(e => 
        visibleIds.has(e.data.source) && visibleIds.has(e.data.target)
      );
    }

    // ========================================
    // COLLECT TAG GROUPS (but don't create compound nodes!)
    // ========================================
    const tagGroups = {};
    Object.entries(tagConfig || {}).forEach(([key, config]) => {
      if (config?.style && config.style !== 'none') {
        const parts = key.split(':');
        const value = parts.slice(1).join(':');
        tagGroups[key] = { 
          nodeIds: [], 
          color: normalizeHexColor(config.color) || '#8b5cf6', 
          label: value,
          style: config.style
        };
      }
    });

// Map nodes to their tag groups
if (Object.keys(tagGroups).length > 0) {
  elements.nodes.forEach(node => {
    const nodeTags = node.data.tags || {};
    Object.entries(nodeTags).forEach(([category, value]) => {
      // ✅ Handle both array and string values
      const values = Array.isArray(value) ? value : [value];
      values.forEach(v => {
        const key = `${category}:${v}`;
        if (tagGroups[key]) {
          tagGroups[key].nodeIds.push(node.data.id);
        }
      });
    });
  });
}
    
    // Store for later use
    tagGroupsRef.current = tagGroups;

    // ========================================
    // CREATE CYTOSCAPE INSTANCE
    // ========================================
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...elements.nodes, ...elements.edges],
      
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
    'z-index': 10,
    'border-width': 2,
    'border-color': (ele) => ele.data('color') || getNodeColorFallback(ele),
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
            'z-index': 10,
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
        
        // ============================================
        // GROUP BOXES (background rectangles)
        // ============================================
        {
          selector: 'node.group-box',
          style: {
            'shape': 'roundrectangle',
            'background-opacity': 0,
            'border-width': 0,
            'label': 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': 10,
            'font-size': '13px',
            'font-weight': '600',
            'z-index': (ele) => ele.data('zIndex') || -1000,
            'events': 'no', // Don't capture mouse events
          }
        },
        
        // Group box - solid border
        {
          selector: 'node.group-box-solid',
          style: {
            'background-opacity': 0,
            'border-width': 3,
            'border-color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'border-style': 'solid',
            'border-opacity': 0.6,
            'color': (ele) => ele.data('groupColor') || '#8b5cf6',
          }
        },
        
        // Group box - dashed border
        {
          selector: 'node.group-box-dashed',
          style: {
            'background-opacity': 0,
            'border-width': 2,
            'border-color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'border-style': 'dashed',
            'border-opacity': 0.5,
            'color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'font-size': '12px',
          }
        },
        
        // Group box - filled
        {
          selector: 'node.group-box-filled',
          style: {
            'background-color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'background-opacity': 0.15,
            'border-width': 2,
            'border-color': (ele) => ele.data('groupColor') || '#8b5cf6',
            'border-style': 'solid',
            'border-opacity': 0.5,
            'color': '#ffffff',
            'text-outline-width': 2,
            'text-outline-color': (ele) => ele.data('groupColor') || '#8b5cf6',
          }
        },
        
        // ============================================
        // EDGES
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
            'z-index': 5,
         'label': (ele) => {
  const event = ele.data('label');
  const platforms = ele.data('platforms');
  const requiresLabel = ele.data('requiresLabel');
  const conditionsLabel = ele.data('conditionsLabel');  // ← ADD
  
  let label = event;
  if (platforms && platforms.length > 0) {
    const badges = platforms.map(p => p === 'web' ? '🌐' : '📱').join('');
    label += ` ${badges}`;
  }
  if (requiresLabel) {
    label += `\n${requiresLabel}`;
  }
  if (conditionsLabel) {  // ← ADD
    label += `\n${conditionsLabel}`;
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
        
        // Conditional edges (with requires)
        {
          selector: 'edge[?hasRequires]',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [8, 4],
            'line-color': (ele) => ele.data('requiresColor') || '#A855F7',
            'target-arrow-color': (ele) => ele.data('requiresColor') || '#A855F7',
            'color': (ele) => ele.data('requiresColor') || '#A855F7',
          }
        },
        {
  selector: 'edge[?hasConditions]',
  style: {
    'line-style': 'dashed',
    'line-dash-pattern': [6, 3],
    'line-color': '#22c55e',  // Green for conditions
    'target-arrow-color': '#22c55e',
  }
},
        {
  selector: '.dimmed',
  style: {
    'opacity': 0.2
  }
},
{
  selector: '.path-highlighted',
  style: {
    'opacity': 1
  }
},
{
  selector: '.path-node',
  style: {
    'border-width': 4,
    'border-color': '#a855f7', // purple
    'border-style': 'solid',
    'background-opacity': 1,
    'z-index': 999
  }
},
{
  selector: '.path-edge',
  style: {
    'line-color': '#a855f7',
    'target-arrow-color': '#a855f7',
    'width': 4,
    'z-index': 998
  }
}

        
      ],
      
      layout: { name: 'preset' }, // Start with preset, run dagre after
      
      minZoom: 0.3,
      maxZoom: 3,
    });
    
    // ========================================
    // LAYOUT: Try saved positions first, else dagre
    // ========================================
    const savedPositions = loadLayoutFromStorage(projectPath);
    const hasAppliedSaved = savedPositions ? applyLayoutToGraph(cy, savedPositions) : false;
    
    if (!hasAppliedSaved) {
      // Run dagre layout
      cy.layout({
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 100,
        rankSep: 150,
        padding: 50,
        animate: false,
      }).run();
    }
    
    // ========================================
    // CREATE GROUP BOXES after layout, then auto-fit
    // ========================================
    setTimeout(() => {
      if (Object.keys(tagGroups).length > 0) {
        createOrUpdateGroupBoxes(cy, tagGroups, theme);
      }
      // Auto-fit to show everything
      cy.fit(null, 50);
    }, 100);
    
    // ========================================
    // EVENT HANDLERS
    // ========================================
    
   // Node click
cy.on('tap', 'node', (event) => {
  const node = event.target;
  const nodeData = node.data();
  
  // Ignore group boxes
  if (nodeData.type === 'group_box' || nodeData.type === 'screen_group') {
    return;
  }
  
  onNodeClick(nodeData);
});

// Cursor changes
cy.on('mouseover', 'node', (event) => {
  const nodeData = event.target.data();
  if (cyRef.current) {
    const container = cyRef.current.container();
    if (nodeData.type === 'group_box' || nodeData.type === 'screen_group') {
      container.style.cursor = 'default';
    } else {
      container.style.cursor = transitionMode?.enabled ? 'crosshair' : 'pointer';
    }
  }
});

cy.on('mouseout', 'node', () => {
  if (cyRef.current) {
    cyRef.current.container().style.cursor = transitionMode?.enabled ? 'crosshair' : 'default';
  }
});
    
    // ========================================
    // DRAG HANDLING - Update group boxes & save positions
    // ========================================
    cy.on('drag', 'node[type="state"]', () => {
      updateGroupBoxesDebounced();
    });
    
    cy.on('dragfree', 'node[type="state"]', () => {
      // Save layout after drag ends
      saveLayoutToStorage(cy, projectPath);
      // Final update of group boxes
      updateGroupBoxesDebounced();
    });
    
    cyRef.current = cy;
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [graphData, onNodeClick, theme, showScreenGroups, screenGroups, transitionMode, tagConfig, activeFilters, projectPath, updateGroupBoxesDebounced]);
  
  // ========================================
  // UPDATE SELECTED NODE STYLING
  // ========================================
useEffect(() => {
    if (!cyRef.current || !selectedNodeId) return;
    cyRef.current.nodes().removeClass('highlighted');
    cyRef.current.getElementById(selectedNodeId).addClass('highlighted');
  }, [selectedNodeId]);
  
  // ========================================
  // EXPOSE GRAPH CONTROLS
  // ========================================
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
        
        // Update group boxes after layout, then auto-fit
        setTimeout(() => {
  if (cyRef.current && containerRef.current) {  // ✅ Add this check
    if (Object.keys(tagGroups).length > 0) {
      createOrUpdateGroupBoxes(cyRef.current, tagGroups, theme);
    }
    cyRef.current.fit(null, 50);
  }
}, 100);
      },
      saveLayout: () => saveLayoutToStorage(cyRef.current, projectPath),
      clearLayout: () => {
        localStorage.removeItem(getLayoutStorageKey(projectPath));
        console.log('🗑️ Layout cleared');
      },
      getLayout: () => {
        const positions = {};
        cyRef.current.nodes('[type="state"]').forEach(node => {
          const pos = node.position();
          positions[node.id()] = { x: pos.x, y: pos.y };
        });
        return { positions };
      },
      // Access to cy instance
      nodes: () => cyRef.current.nodes(),
      edges: () => cyRef.current.edges(),
    };
  }, [projectPath, theme]);

  // Highlight path to a target state
useEffect(() => {
  if (!cyRef.current) return;
  
  const cy = cyRef.current;
  
  // Define the highlight function
  const highlightPathTo = (targetStatus) => {
    console.log('🎯 Highlighting path to:', targetStatus);
    
    // Reset all styles first
    cy.elements().removeClass('path-highlighted path-node path-edge dimmed');
    
    // Find the target node
    const targetNode = cy.nodes().filter(node => {
      const nodeId = node.id().toLowerCase();
      const target = targetStatus.toLowerCase();
      return nodeId === target || nodeId.includes(target);
    }).first();
    
    if (!targetNode || targetNode.length === 0) {
      console.warn('Target node not found:', targetStatus);
      return;
    }
    
    // Find initial node
    const initialNode = cy.nodes().filter(node => {
      const nodeId = node.id().toLowerCase();
      return nodeId === 'initial' || nodeId.includes('initial');
    }).first();
    
    if (!initialNode || initialNode.length === 0) {
      console.warn('Initial node not found');
      return;
    }
    
    // Use Dijkstra to find shortest path
    const dijkstra = cy.elements().dijkstra({
      root: initialNode,
      directed: true
    });
    
    const pathToTarget = dijkstra.pathTo(targetNode);
    
    if (pathToTarget && pathToTarget.length > 0) {
      console.log(`✅ Found path with ${pathToTarget.length} elements`);
      
      // Dim all elements
      cy.elements().addClass('dimmed');
      
      // Highlight path elements
      pathToTarget.removeClass('dimmed').addClass('path-highlighted');
      pathToTarget.nodes().addClass('path-node');
      pathToTarget.edges().addClass('path-edge');
      
      // Fit view to path
      cy.fit(pathToTarget, 50);
    } else {
      console.warn('No path found to target');
    }
  };
  
  // Clear highlights
  const clearPathHighlight = () => {
    cy.elements().removeClass('path-highlighted path-node path-edge dimmed');
  };
  
  // Expose globally
  window.cytoscapeGraph = window.cytoscapeGraph || {};
  window.cytoscapeGraph.highlightPathTo = highlightPathTo;
  window.cytoscapeGraph.clearPathHighlight = clearPathHighlight;
  
  return () => {
    if (window.cytoscapeGraph) {
      delete window.cytoscapeGraph.highlightPathTo;
      delete window.cytoscapeGraph.clearPathHighlight;
    }
  };
}, [cyRef.current]);

// Auto-highlight when testData status changes
useEffect(() => {
  if (!loadedTestData?.data?.status || !cyRef.current) return;
  
  const status = loadedTestData.data.status;
  
  // Don't highlight if status is 'initial'
  if (status === 'initial') {
    if (window.cytoscapeGraph?.clearPathHighlight) {
      window.cytoscapeGraph.clearPathHighlight();
    }
    return;
  }
  
  // Small delay to ensure graph is ready
  const timer = setTimeout(() => {
    if (window.cytoscapeGraph?.highlightPathTo) {
      window.cytoscapeGraph.highlightPathTo(status);
    }
  }, 300);
  
  return () => clearTimeout(timer);
}, [loadedTestData?.data?.status]);

// Clear highlights when testData is cleared
useEffect(() => {
  if (!loadedTestData && window.cytoscapeGraph?.clearPathHighlight) {
    window.cytoscapeGraph.clearPathHighlight();
  }
}, [loadedTestData]);
// Update node styling for selection and transition mode
useEffect(() => {
  if (!cyRef.current) return;
  const cy = cyRef.current;
  
  // Reset all borders first
  cy.nodes('[type="state"]').forEach(node => {
    const baseColor = node.data('color') || getNodeColorFallback(node);
    node.style({
      'border-width': 2,
      'border-color': baseColor
    });
  });
  
  // Highlight selected node
  if (selectedNodeId) {
    const selectedNode = cy.getElementById(selectedNodeId);
    if (selectedNode.length) {
      selectedNode.style({
        'border-width': 4,
        'border-color': theme.colors.accents.blue
      });
    }
  }
  
  // Highlight transition source
  if (transitionMode?.enabled && transitionMode?.source?.id) {
    const sourceNode = cy.getElementById(transitionMode.source.id);
    if (sourceNode.length) {
      sourceNode.style({
        'border-width': 6,
        'border-color': theme.colors.accents.orange
      });
    }
  }
}, [selectedNodeId, transitionMode, theme]);
  
  // ========================================
  // RENDER
  // ========================================
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