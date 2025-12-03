// packages/web-app/src/pages/Visualizer.jsx (COMPLETE REPLACEMENT - FIXED)

import { useState, useEffect, useRef } from 'react';
import StateGraph from '../components/StateGraph/StateGraph';
import StateDetailModal from '../components/StateGraph/StateDetailModal';
import { buildGraphFromDiscovery } from '../utils/graphBuilder';
import { defaultTheme } from '../config/visualizerTheme';
import StatsPanel from '../components/StatsPanel/StatsPanel';
import IssuePanel from '../components/IssuePanel/IssuePanel';
import StateRegistryPanel from '../components/StateRegistry/StateRegistryPanel';
import AddStateModal from '../components/AddStateModal/AddStateModal';
import AddTransitionModal from '../components/AddTransitionModal/AddTransitionModal';
import { initializeFromDiscovery } from '../utils/requiresColors.js';
// ADD THIS LINE after the other imports:
import TagsPanel, { useTagConfig } from '../components/TagsPanel/TagsPanel';
const API_URL = 'http://localhost:3000';



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
const [transitionMode, setTransitionMode] = useState({ enabled: false, source: null });
const transitionModeRef = useRef(transitionMode);

useEffect(() => {
  if (discoveryResult) {
    initializeFromDiscovery(discoveryResult);
  }
}, [discoveryResult]);

// âœ… Keep ref in sync with state
useEffect(() => {
  transitionModeRef.current = transitionMode;
}, [transitionMode]);
const [showTransitionModal, setShowTransitionModal] = useState(false);
const [transitionModalData, setTransitionModalData] = useState({ source: null, target: null });
  const [needsInit, setNeedsInit] = useState(false);
const [initChecked, setInitChecked] = useState(false);
const [initLoading, setInitLoading] = useState(false);
const [initSuccess, setInitSuccess] = useState(false);
const [initError, setInitError] = useState(null);
const [createdFiles, setCreatedFiles] = useState([]);
  const [showScreenGroups, setShowScreenGroups] = useState(false);
  const [savedLayout, setSavedLayout] = useState(null);
const [isSavingLayout, setIsSavingLayout] = useState(false);
const [tagsPanelCollapsed, setTagsPanelCollapsed] = useState(false);
  const { tagConfig, setTagConfig, activeFilters, setActiveFilters } = useTagConfig(projectPath);
  const [discoveredTags, setDiscoveredTags] = useState({});



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
    setDiscoveredTags({});
  };

  // ADD THIS FUNCTION after handleClearCache
const checkInitialization = async (path) => {
  try {
    const response = await fetch(`${API_URL}/api/init/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: path })
    });
    
    if (!response.ok) {
      console.error('Init check failed');
      setInitChecked(true);
      setNeedsInit(true);
      return false;
    }
    
    const result = await response.json();
    const { initialized, missing } = result;
    
    console.log('ðŸ” Init check:', { initialized, missing });
    
    // âœ… If initialized, just return true - don't show banner
    if (initialized) {
      setNeedsInit(false);
      setInitChecked(false);
      return true;
    }
    
    // âŒ Not initialized - show banner
    setNeedsInit(true);
    setInitChecked(true);
    
    return false;
  } catch (error) {
    console.error('Init check failed:', error);
    setInitChecked(true);
    setNeedsInit(true);
    return false;
  }
};

const handleInitialize = async () => {
  setInitLoading(true);
  setInitError(null);

  try {
    console.log('ðŸš€ Initializing project:', projectPath);
    
    const response = await fetch(`${API_URL}/api/init/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath,
        force: false
      })
    });

    if (!response.ok) {
      const error = await response.json();
      
      // âœ… If already initialized, show the error but don't treat as failure
      if (error.error?.includes('already initialized')) {
        setInitError(error.error);
        setInitLoading(false);
        return; // Stay on the banner, let user choose
      }
      
      throw new Error(error.error || 'Initialization failed');
    }

    const result = await response.json();
    console.log('âœ… Initialization complete:', result);
    
    setInitSuccess(true);
    setCreatedFiles(result.files || []);
    setNeedsInit(false);
    
    // Auto-scan after 2 seconds
    setTimeout(() => {
      setInitSuccess(false);
      handleScan();
    }, 2000);

  } catch (err) {
    console.error('âŒ Initialization failed:', err);
    setInitError(err.message);
  } finally {
    setInitLoading(false);
  }
};

const handleReInitialize = async () => {
  setInitLoading(true);
  setInitError(null);

  try {
    console.log('ðŸ”„ Re-initializing project with force:', projectPath);
    
    const response = await fetch(`${API_URL}/api/init/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath,
        force: true  // âœ… This is the key difference
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Re-initialization failed');
    }

    const result = await response.json();
    console.log('âœ… Re-initialization complete:', result);
    
    setInitSuccess(true);
    setCreatedFiles(result.files || []);
    setNeedsInit(false);
    
    // Auto-scan after 2 seconds
    setTimeout(() => {
      setInitSuccess(false);
      handleScan();
    }, 2000);

  } catch (err) {
    console.error('âŒ Re-initialization failed:', err);
    setInitError(err.message);
  } finally {
    setInitLoading(false);
  }
};

const loadGraphLayout = async () => {
  // âœ¨ ADD VALIDATION
  if (!projectPath) {
    console.log('â­ï¸  Skipping layout load - no projectPath yet');
    return;
  }
  
  try {
    console.log('ðŸ“‚ Loading saved graph layout...');
    console.log('ðŸ“ Project path:', projectPath);
    
    const response = await fetch(
      `${API_URL}/api/implications/graph/layout?projectPath=${encodeURIComponent(projectPath)}`
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('âŒ Backend error:', errorData);
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.layout) {
      console.log('âœ… Layout loaded:', data.layout);
      
      // âœ… CRITICAL: Store in window globals (Session 21 pattern)
      window.__savedGraphLayout = data.layout;
      window.__savedGraphLayoutVersion = Date.now();
      
      setSavedLayout(data.layout);
    } else {
      console.log('â„¹ï¸  No saved layout found');
      setSavedLayout(null);
    }
  } catch (error) {
    console.error('âŒ Load layout failed:', error);
  }
};

// âœ¨ Load saved layout when graph data or project changes
useEffect(() => {
  // âœ… Only load when BOTH exist
  if (graphData && projectPath && projectPath.trim() !== '') {
    console.log('ðŸ”„ Loading layout:', {
      projectPath,
      hasGraphData: !!graphData,
      nodeCount: graphData.nodes?.length || 0
    });
    loadGraphLayout();
  } else {
    console.log('â­ï¸  Skipping layout load:', {
      hasGraphData: !!graphData,
      hasProjectPath: !!projectPath,
      projectPathValue: projectPath
    });
  }
}, [graphData, projectPath]);

useEffect(() => {
  if (graphData?.discoveredTags) {
    setDiscoveredTags(graphData.discoveredTags);
    console.log('🏷️ Discovered tags:', graphData.discoveredTags);
  }
}, [graphData]);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 3. ADD SAVE LAYOUT FUNCTION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const saveGraphLayout = async () => {
  if (!projectPath) return;
  
  if (!window.cytoscapeGraph) {
    alert('âš ï¸ Graph not ready yet. Please wait and try again.');
    return;
  }
  
  setIsSavingLayout(true);
  
  try {
    let layout;
    
    // Try using getLayout() if it exists
    if (typeof window.cytoscapeGraph.getLayout === 'function') {
      console.log('ðŸ’¾ Using getLayout() method...');
      layout = window.cytoscapeGraph.getLayout();
      layout.screenGroupsEnabled = showScreenGroups;
    } else {
      // Fallback: manual extraction
      console.log('ðŸ’¾ Manually extracting positions...');
      const positions = {};
      
      if (typeof window.cytoscapeGraph.nodes === 'function') {
  window.cytoscapeGraph.nodes().forEach(node => {
    const type = node.data('type');
    if (type === 'screen_group' || type === 'group_box') return;
    const pos = node.position();
    positions[node.id()] = { x: pos.x, y: pos.y };
  });
} else {
        throw new Error('Cytoscape graph not fully initialized');
      }
      
      layout = { positions, screenGroupsEnabled: showScreenGroups };
    }
    
    console.log(`ðŸ’¾ Saving ${Object.keys(layout.positions).length} node positions`);
    
    const response = await fetch(`${API_URL}/api/implications/graph/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, layout })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    await response.json();
    console.log('âœ… Layout saved to file!');
    
    // âœ… CRITICAL: Update window globals (Session 21 pattern)
    window.__savedGraphLayout = layout;
    window.__savedGraphLayoutVersion = Date.now();
    
    setSavedLayout(layout);
    alert('âœ… Graph layout saved! It will be loaded automatically next time.');
    
  } catch (error) {
    console.error('âŒ Save layout failed:', error);
    alert('âŒ Failed to save: ' + error.message);
  } finally {
    setIsSavingLayout(false);
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4. ADD RESET LAYOUT FUNCTION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const resetGraphLayout = async () => {
  if (!projectPath) return;
  
  const confirmed = confirm('Reset graph layout to default?\n\nThis will delete your saved positions.');
  if (!confirmed) return;
  
  try {
    console.log('ðŸ—‘ï¸  Resetting graph layout...');
    
    const response = await fetch(
  `${API_URL}/api/implications/graph/layout?projectPath=${encodeURIComponent(projectPath)}`,
  { method: 'DELETE' }
);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('âœ… Layout reset!');
      
      // âœ… CRITICAL: Clear window globals (Session 21 pattern)
      delete window.__savedGraphLayout;
      delete window.__savedGraphLayoutVersion;
      delete window.__lastAppliedVersion;
      
      setSavedLayout(null);
      
      // Re-run dagre layout
      if (window.cytoscapeGraph) {
        window.cytoscapeGraph.relayout();
      }
      
      alert('âœ… Layout reset to default!');
    }
  } catch (error) {
    console.error('âŒ Reset layout failed:', error);
    alert('âŒ Failed to reset layout: ' + error.message);
  }
};

// REPLACE the entire handleScan function (lines 64-113) with this:
const handleScan = async () => {
  setLoading(true);
  setError(null);
  setInitChecked(false);
  setNeedsInit(false);
  setInitSuccess(false);
  setInitError(null);
  
  try {
    console.log('ðŸ” Starting discovery scan...');
    
    // First, check if project is initialized
    const isInitialized = await checkInitialization(projectPath);
    
    if (!isInitialized) {
      console.log('âš ï¸  Project needs initialization');
      setLoading(false);
      return; // Stop here, show init banner
    }
    
    // Pro``ject is initialized, proceed with scan
    console.log('âœ… Project is initialized, scanning...');

    const response = await fetch(`${API_URL}/api/discovery/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Discovery scan failed');
    }

    const result = await response.json();
    
    // Save all data
    setDiscoveryResult(result);
    setAnalysisResult(result.analysis || null);
    setStateRegistry(result.stateRegistry || null);

    await loadGraphLayout();  // âœ¨ Load saved layout
    
    // Build graph data
    if (result.files?.implications) {
      const graph = buildGraphFromDiscovery(result);
      setGraphData(graph);
      await loadGraphLayout();
      // Save to localStorage
      localStorage.setItem('lastProjectPath', projectPath);
      localStorage.setItem('lastDiscoveryResult', JSON.stringify(result));
      localStorage.setItem('lastAnalysisResult', JSON.stringify(result.analysis || null));
      localStorage.setItem('lastStateRegistry', JSON.stringify(result.stateRegistry || null));
      localStorage.setItem('lastGraphData', JSON.stringify(graph));
    }
    
    console.log('âœ… Scan complete');
    console.log('   - States:', result.files?.implications?.length || 0);
    console.log('   - Issues:', result.analysis?.issues?.length || 0);
    console.log('   - Mappings:', result.stateRegistry?.mappings ? Object.keys(result.stateRegistry.mappings).length : 0);
    
  } catch (err) {
    console.error('âŒ Scan failed:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  const handleRefreshSingleState = async (filePath) => {
  console.log('âš¡ Fast refresh for:', filePath.split('/').pop());
  
  try {
    // Re-parse just this one file
    const response = await fetch(`${API_URL}/api/discovery/parse-single-file`, {
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
      
      console.log('âœ… Fast refresh complete');
      return updated;
    });
    
  } catch (error) {
    console.error('âŒ Fast refresh error:', error);
    // Fallback to full scan
    handleScan();
  }
};



  // âœ… Expose refresh function globally for StateDetailModal
useEffect(() => {
  // Expose refresh functions globally
  window.refreshDiscovery = handleScan;
  window.refreshSingleState = handleRefreshSingleState; // 
    
    return () => {
      delete window.refreshDiscovery;
    };
  }, [projectPath]);  // âœ… FIXED: Dependency array
  
  // Handle node click in graph
const handleNodeClick = (nodeData) => {
  setSelectedNodeId(nodeData.id);
  console.log('🖱️ Node clicked:', nodeData);
  
  if (!discoveryResult) {
    console.warn('⚠️ No discovery result available');
    return;
  }
  
  // Find the implication
  let implication = null;
  
  if (nodeData.metadata?.className) {
    console.log('🔍 Looking up by className:', nodeData.metadata.className);
    implication = discoveryResult.files.implications.find(
      imp => imp.metadata.className === nodeData.metadata.className
    );
  }
  
  if (!implication) {
    console.log('🔍 Fallback: Looking up by extracted name:', nodeData.id);
    implication = discoveryResult.files.implications.find(
      imp => extractStateName(imp.metadata.className) === nodeData.id
    );
  }
  
  if (!implication) {
    console.error('❌ Implication not found for:', nodeData.id);
    alert(`Could not find implication for "${nodeData.id}"`);
    return;
  }
  
  console.log('✅ Found implication:', implication.metadata.className);
  const metadata = implication.metadata;
  
  if (!metadata.hasXStateConfig) {
    console.warn('⚠️ This implication has no xstateConfig:', nodeData.id);
    alert(`"${nodeData.id}" doesn't have xstateConfig metadata`);
    return;
  }
  
  // ✅ FIX: Match transitions by status (not className!)
  const stateTransitions = (discoveryResult.transitions || [])
    .filter(t => {
      // Transitions use status field, not className
      const matchByStatus = t.from === metadata.status;
      const matchByNodeId = t.from === nodeData.id;
      const matchByClassName = t.from === metadata.className;
      
      console.log(`  Checking transition ${t.event}:`, {
        from: t.from,
        matchByStatus,
        matchByNodeId,
        matchByClassName
      });
      
      return matchByStatus || matchByNodeId || matchByClassName;
    })
    .map(t => ({
      event: t.event,
      target: t.to,
      platforms: t.platforms
    }));
  
  console.log(`✅ Found ${stateTransitions.length} transitions for ${metadata.status}`);
  
  // Build state object for modal
  const state = {
    id: nodeData.id,
    name: nodeData.id,
    displayName: metadata.status || nodeData.label,
    className: metadata.className,
    meta: {
      status: metadata.status,
      triggerAction: metadata.triggerAction,
      triggerButton: metadata.triggerButton,
      afterButton: metadata.afterButton,
      previousButton: metadata.previousButton,
      platform: metadata.platform,
      platforms: metadata.platforms,
      notificationKey: metadata.notificationKey,
      statusCode: metadata.statusCode,
      statusNumber: metadata.statusNumber,
      requiredFields: metadata.requiredFields,
      requires: metadata.requires,
      setup: metadata.setup,
      xstateContext: metadata.xstateContext || {},
      uiCoverage: metadata.uiCoverage || { total: 0, platforms: {} },
      xstateConfig: metadata.xstateConfig || null
    },
    transitions: stateTransitions,
    files: {
      implication: `${projectPath}/${implication.path}`,
      test: (Array.isArray(metadata.setup) 
        ? metadata.setup[0]?.testFile 
        : metadata.setup?.testFile) || ''
    },
  };
  
  console.log('✅ Selected state with full metadata:', state);
  console.log('🔍 transitions:', state.transitions);
  
  setSelectedState(state);
};


  
  const closeDetail = () => {
    setSelectedState(null);
    setSelectedNodeId(null);
  };

  // Handler for creating state
  const handleCreateState = async (formData) => {
  try {
    const response = await fetch(`${API_URL}/api/implications/create-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,                        // âœ… All form fields (stateName, status, etc.)
        projectPath: projectPath            // âœ… Add the project path from state!
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('âœ… State created:', result);
    
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
    notification.textContent = `âœ… Created ${result.fileName}! Re-scan to see it.`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
    
    setShowAddStateModal(false);
    
  } catch (error) {
    console.error('âŒ Create failed:', error);
    throw error;
  }
};

const handleTransitionModeClick = async (nodeData) => {
  const currentMode = transitionModeRef.current;
  
  if (!currentMode.enabled) return;
  
  if (!currentMode.source) {
    // First click - select source
    console.log('ðŸŽ¯ Source selected:', nodeData.id);
    console.log('ðŸ“Š Source data:', nodeData);
    
    setTransitionMode({ 
      enabled: true, 
      source: { id: nodeData.id, files: nodeData.files } 
    });
    
  } else {
    // Second click - select target, open modal
    console.log('ðŸ‘‰ Target selected:', nodeData.id);
    console.log('ðŸ“Š Target data:', nodeData);
    
    const sourceFile = currentMode.source.files?.implication;
    const targetFile = nodeData.files?.implication;
    
    console.log('ðŸ“¤ Files:', { sourceFile, targetFile });
    
    if (!sourceFile || !targetFile) {
      alert('âŒ Could not find file paths for states');
      setTransitionMode({ enabled: false, source: null });
      return;
    }
    
    // âœ¨ NEW: Open modal instead of prompt
    setTransitionModalData({
      source: { 
        id: currentMode.source.id, 
        file: sourceFile 
      },
      target: { 
        id: nodeData.id, 
        file: targetFile 
      }
    });
    setShowTransitionModal(true);
  }
};

const handleTransitionSubmit = async (formData) => {
  try {
    const response = await fetch(`${API_URL}/api/implications/add-transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sourceFile: transitionModalData.source.file,
        targetFile: transitionModalData.target.file,
        event: formData.event,
        platform: formData.platform,
        actionDetails: formData.actionDetails
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to add transition');
    }
    
    // Success notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 z-[100000] px-6 py-4 rounded-lg shadow-lg';
    notification.style.backgroundColor = defaultTheme.colors.accents.green;
    notification.style.color = 'white';
    notification.innerHTML = `
      <div class="font-bold">âœ… Transition Added!</div>
      <div class="text-sm mt-1">${formData.event}: ${transitionModalData.source.id} â†’ ${transitionModalData.target.id}</div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
    
    // Re-scan to update graph
    handleScan();
    
    // Reset transition mode
    setTransitionMode({ enabled: false, source: null });
    
  } catch (error) {
    console.error('âŒ Add transition failed:', error);
    throw error; // Let modal handle the error
  }
};

// 3. ADD THESE HELPER FUNCTIONS
const enableTransitionMode = () => {
  setTransitionMode({ enabled: true, source: null });
  console.log('ðŸ”— Transition mode enabled - click two nodes to connect');
};

const disableTransitionMode = () => {
  setTransitionMode({ enabled: false, source: null });
  console.log('ðŸ‘ï¸ View mode enabled');
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
                😈 - The Imp - State Machine Viewer
              </h1>
              <p className="text-sm mt-1" style={{ color: defaultTheme.colors.text.tertiary }}>
                Interactive implication visualization & documentation
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
                    ðŸ—‘ï¸ Clear
                  </button>
                  
                  {/* Mode Buttons */}
                  <div className="flex gap-2 ml-2 pl-2 border-l" style={{ borderColor: defaultTheme.colors.border }}>
                    <button
                      onClick={() => {
                        console.log('ðŸ”˜ Add State button clicked');
                        setShowAddStateModal(true);
                      }}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                      style={{
                        background: defaultTheme.colors.accents.green,
                        color: 'white'
                      }}
                    >
                      âž• Add State
                    </button>       
                    <button
                      onClick={() => {
                        if (transitionMode.enabled) {
                          disableTransitionMode();
                        } else {
                          enableTransitionMode();
                        }
                      }}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                      style={{
                        background: transitionMode.enabled ? defaultTheme.colors.accents.orange : defaultTheme.colors.background.tertiary,
                        color: transitionMode.enabled ? 'white' : defaultTheme.colors.text.primary,
                        border: `2px solid ${transitionMode.enabled ? defaultTheme.colors.accents.orange : defaultTheme.colors.border}`
                      }}
                    >
                      {transitionMode.enabled ? 'âœ“ Adding Transition...' : 'ðŸ”— Add Transition'}
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
                ðŸ”„ Refresh
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
                {loading ? 'â³ Scanning...' : 'ðŸ” Scan Project'}
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
                âŒ {error}
              </div>
            )}
          </div>
        </div>
      </header>



      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Initialization Warning Banner */}
{initChecked && needsInit && !initSuccess && (
  <div 
    className="glass rounded-xl p-6 mb-6 border-2 border-dashed"
    style={{ 
      borderColor: initError?.includes('already initialized') 
        ? defaultTheme.colors.accents.blue 
        : defaultTheme.colors.accents.yellow,
      backgroundColor: initError?.includes('already initialized')
        ? `${defaultTheme.colors.accents.blue}10`
        : `${defaultTheme.colors.accents.yellow}10`
    }}
  >
    <div className="flex items-start gap-4">
      <div className="text-4xl">
        {initError?.includes('already initialized') ? 'â„¹ï¸' : 'âš ï¸'}
      </div>
      <div className="flex-1">
        <h3 
          className="text-xl font-bold mb-2" 
          style={{ 
            color: initError?.includes('already initialized')
              ? defaultTheme.colors.accents.blue
              : defaultTheme.colors.accents.yellow 
          }}
        >
          {initError?.includes('already initialized') 
            ? 'Project Already Initialized' 
            : 'Project Setup Required'}
        </h3>
        
        {initError?.includes('already initialized') ? (
          <>
            <p className="text-sm mb-3" style={{ color: defaultTheme.colors.text.secondary }}>
              This project already has the core utilities. You can re-initialize to update or reset them.
            </p>
            
            <div className="space-y-2 mb-4">
              <p className="text-xs font-semibold" style={{ color: defaultTheme.colors.text.primary }}>
                Existing files will be backed up:
              </p>
              <div className="grid gap-2">
                <div className="flex items-center gap-2 text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                  <span>âœ“</span>
                  <code className="font-mono">tests/implications/utils/TestContext.js</code>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                  <span>âœ“</span>
                  <code className="font-mono">tests/implications/utils/ExpectImplication.js</code>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                  <span>âœ“</span>
                  <code className="font-mono">ai-testing.config.js</code>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setInitError(null);
                  setNeedsInit(false);
                  setInitChecked(false);
                }}
                className="px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                style={{
                  backgroundColor: defaultTheme.colors.background.tertiary,
                  color: defaultTheme.colors.text.primary,
                  border: `1px solid ${defaultTheme.colors.border}`
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={handleReInitialize}
                disabled={initLoading}
                className="px-6 py-3 rounded-lg font-bold text-sm transition-all"
                style={{
                  backgroundColor: initLoading 
                    ? defaultTheme.colors.background.tertiary 
                    : defaultTheme.colors.accents.orange,
                  color: 'white',
                  cursor: initLoading ? 'not-allowed' : 'pointer',
                  opacity: initLoading ? 0.6 : 1
                }}
              >
                {initLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">â³</span>
                    Re-initializing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>ðŸ”„</span>
                    Re-Initialize (Overwrite)
                  </span>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm mb-3" style={{ color: defaultTheme.colors.text.secondary }}>
              This project needs core utilities to support test generation and management.
            </p>
            
            <div className="space-y-2 mb-4">
              <p className="text-xs font-semibold" style={{ color: defaultTheme.colors.text.primary }}>
                What will be created:
              </p>
              <div className="grid gap-2">
                <div className="flex items-center gap-2 text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                  <span>ðŸ“„</span>
                  <code className="font-mono">tests/implications/utils/TestContext.js</code>
                  <span className="text-xs opacity-60">- Data management</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                  <span>ðŸ“„</span>
                  <code className="font-mono">tests/implications/utils/ExpectImplication.js</code>
                  <span className="text-xs opacity-60">- Validation engine</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                  <span>âš™ï¸</span>
                  <code className="font-mono">ai-testing.config.js</code>
                  <span className="text-xs opacity-60">- Configuration</span>
                </div>
              </div>
            </div>

            {initError && !initError.includes('already initialized') && (
              <div className="mb-4 p-3 rounded" style={{ backgroundColor: `${defaultTheme.colors.accents.red}15` }}>
                <p className="text-sm" style={{ color: defaultTheme.colors.accents.red }}>
                  âŒ {initError}
                </p>
              </div>
            )}

            <button
              onClick={handleInitialize}
              disabled={initLoading}
              className="px-6 py-3 rounded-lg font-bold text-sm transition-all"
              style={{
                backgroundColor: initLoading ? defaultTheme.colors.background.tertiary : defaultTheme.colors.accents.blue,
                color: 'white',
                cursor: initLoading ? 'not-allowed' : 'pointer',
                opacity: initLoading ? 0.6 : 1
              }}
            >
              {initLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">â³</span>
                  Initializing Project...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>ðŸš€</span>
                  Initialize Project
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  </div>
)}

{/* Screen Grouping Toggle */}
{graphData && graphData.screenGroups && Object.keys(graphData.screenGroups).length > 0 && (
  <button 
    className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-90"
    style={{
      background: showScreenGroups 
        ? defaultTheme.colors.accents.green 
        : `${defaultTheme.colors.background.tertiary}`,
      color: defaultTheme.colors.text.primary,
      border: `1px solid ${defaultTheme.colors.border}`
    }}
    onClick={() => setShowScreenGroups(!showScreenGroups)}
    title="Group states by screen"
  >
    <span>ðŸ“º</span> {showScreenGroups ? 'Hide' : 'Show'} Screen Groups
  </button>
)}

{/* Success Banner */}
{initSuccess && (
  <div 
    className="glass rounded-xl p-6 mb-6 border-2"
    style={{ 
      borderColor: defaultTheme.colors.accents.green,
      backgroundColor: `${defaultTheme.colors.accents.green}15`
    }}
  >
    <div className="flex items-start gap-4">
      <div className="text-4xl">âœ…</div>
      <div className="flex-1">
        <h3 className="text-xl font-bold mb-2" style={{ color: defaultTheme.colors.accents.green }}>
          Setup Complete!
        </h3>
        <p className="text-sm mb-3" style={{ color: defaultTheme.colors.text.secondary }}>
          Your project is now ready for test generation and management.
        </p>
        
        <div className="space-y-1">
          <p className="text-xs font-semibold mb-2" style={{ color: defaultTheme.colors.text.primary }}>
            Created Files:
          </p>
          {createdFiles.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs" style={{ color: defaultTheme.colors.accents.green }}>
              <span>âœ…</span>
              <code className="font-mono">{file}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}

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

        {/* Transition Mode Controls */}
        <div className="mode-controls" style={{ marginBottom: '16px' }}>
          <button
            onClick={enableTransitionMode}
            disabled={transitionMode.enabled}
            style={{
              padding: '8px 16px',
              marginRight: '8px',
              background: transitionMode.enabled ? '#3b82f6' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: transitionMode.enabled ? 'default' : 'pointer'
            }}
          >
            🔗 Add Transition Mode
            {transitionMode.enabled && transitionMode.source && ' (Select target)'}
            {transitionMode.enabled && !transitionMode.source && ' (Select source)'}
          </button>
          
          {transitionMode.enabled && (
            <button
              onClick={disableTransitionMode}
              style={{
                padding: '8px 16px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ❌ Cancel
            </button>
          )}
        </div>

        {/* ✅ TAGS PANEL - Goes HERE, ABOVE the graph section! */}
        {graphData && Object.keys(discoveredTags).length > 0 && (
          <TagsPanel
            discoveredTags={discoveredTags}
            tagConfig={tagConfig}
            onTagConfigChange={setTagConfig}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            theme={defaultTheme}
            collapsed={tagsPanelCollapsed}
            onToggleCollapse={() => setTagsPanelCollapsed(!tagsPanelCollapsed)}
          />
        )}
        
        {/* Graph - NO changes needed inside here! */}
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
                {Object.keys(activeFilters).length > 0 && (
                  <span style={{ color: defaultTheme.colors.accents.blue, marginLeft: '8px' }}>
                    | 🔍 Filtered: {Object.keys(activeFilters).length} tags
                  </span>
                )}
              </p>
            </div>
            
            {/* Graph Controls - keep as-is */}
            {graphData && (
              <div className="flex gap-2">
                <button onClick={() => window.cytoscapeGraph?.fit()}>
                  <span>🎯</span> Fit
                </button>
                <button onClick={() => window.cytoscapeGraph?.resetZoom()}>
                  <span>🔍</span> Reset
                </button>
                <button onClick={() => window.cytoscapeGraph?.relayout()}>
                  <span>🔄</span> Layout
                </button>
                
                <button 
                  onClick={saveGraphLayout}
                  disabled={isSavingLayout}
                  title="Save current graph layout"
                  style={{
                    background: savedLayout 
                      ? defaultTheme.colors.accents.green 
                      : defaultTheme.colors.background.tertiary,
                    opacity: isSavingLayout ? 0.6 : 1
                  }}
                >
                  <span>{isSavingLayout ? '⏳' : savedLayout ? '✅' : '💾'}</span>
                  {isSavingLayout ? 'Saving...' : 'Save Layout'}
                </button>
                
                {savedLayout && (
                  <button 
                    onClick={resetGraphLayout}
                    title="Reset to default layout"
                  >
                    <span>🔄</span> Reset
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* StateGraph - just add the two new props */}
          {graphData ? (
            <StateGraph
  graphData={graphData}
  onNodeClick={(nodeData) => {
    const currentMode = transitionModeRef.current;
    
    if (currentMode.enabled) {
      handleTransitionModeClick(nodeData);
    } else {
      handleNodeClick(nodeData);
    }
  }}
  selectedNodeId={selectedNodeId}
  theme={defaultTheme}
  showScreenGroups={showScreenGroups}
  screenGroups={graphData.screenGroups}
  savedLayout={savedLayout}
  onLayoutChange={(layout) => {}}
  tagConfig={tagConfig}
activeFilters={activeFilters}
projectPath={projectPath}
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
    projectPath={projectPath}
    discoveryResult={discoveryResult}  // â† ADD THIS LINE
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
<AddTransitionModal
        isOpen={showTransitionModal}
        onClose={() => {
          setShowTransitionModal(false);
          setTransitionMode({ enabled: false, source: null });
        }}
        onSubmit={handleTransitionSubmit}
        sourceState={transitionModalData.source}
        targetState={transitionModalData.target}
        projectPath={projectPath}
      />
    
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