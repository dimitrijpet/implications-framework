// packages/web-app/src/components/UIScreenEditor/UIScreenEditor.jsx
// ✨ COMPLETE REFACTOR with Source Attribution + Dropdown Integration
import { useMemo, useState, useEffect } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';
import AddScreenModal from './AddScreenModal';
import CopyScreenDialog from './CopyScreenDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import POMFieldSelector from './POMFieldSelector';
import FieldAutocomplete from './FieldAutocomplete';
import FunctionSelector from './FunctionSelector';
import ElementList from '../SourceAttribution/ElementList';
import SourceLegend from '../SourceAttribution/SourceLegend';
import BlockList from './BlockList';
import { migrateToBlocksFormat, blocksToLegacyFormat, isLegacyFormat } from './blockUtils';
import { collectVariablesFromUIValidations } from './collectVariablesFromUIValidations';
import useProjectConfig from '../../hooks/useProjectConfig';
// ✅ ADD these imports
import PlatformSectionWithOrdering from './PlatformSectionWithOrdering';
import { screensObjectToArray, screensArrayToObject } from './screenOrderingUtils';

import { 
  collectVariablesFromTransition, 
  collectVariablesFromState,
  testDataSchemaToVariables  // ✅ ADD THIS IMPORT
} from './crossStateVariables';

const INDEX_OPTIONS = [
  { value: '', label: '(none)' },
  { value: 'all', label: 'all' },
  { value: 'any', label: 'any' },
  { value: 'first', label: 'first' },
  { value: 'last', label: 'last' },
  { value: 'custom', label: 'index...' },
];

// ============================================
// Helper Functions (outside component)
// ============================================

/**
 * Normalize screens to array format
 * Handles: arrays, objects with screen arrays, single objects
 */
const normalizeScreens = (screens) => {
  if (!screens) return [];
  if (Array.isArray(screens)) return screens;
  
  // If it's an object, flatten to array
  if (typeof screens === 'object') {
    return Object.entries(screens).flatMap(([name, screenArray]) => {
      if (Array.isArray(screenArray)) {
        return screenArray.map(screen => ({ 
          ...screen,
          screenName: name 
        }));
      } else if (typeof screenArray === 'object' && screenArray !== null) {
        return [{ 
          ...screenArray,
          screenName: name 
        }];
      } else {
        return [];
      }
    });
  }
  
  return [];
};



function getPlatformIcon(platformName) {
  const icons = {
    web: '🌐',
    cms: '📝',
    dancer: '💃',
    manager: '👔',
    mobile: '📱',
    ios: '🍎',
    android: '🤖'
  };
  // Return matching icon or default
  return icons[platformName?.toLowerCase()] || '📱';
}

function getContextFields(screen) {
  const fields = [];
  
  const allElements = [
    ...(screen.visible || []),
    ...(screen.hidden || []),
    ...(screen.checks?.visible || []),
    ...(screen.checks?.hidden || [])
  ];
  
  allElements.forEach(el => {
    const matches = el.match(/\{\{(\w+)\}\}/g);
    if (matches) {
      matches.forEach(match => {
        const fieldName = match.replace(/\{\{|\}\}/g, '');
        if (!fields.includes(fieldName)) {
          fields.push(fieldName);
        }
      });
    }
  });
  
  return fields;
}

// ============================================
// Main Component
// ============================================

export default function UIScreenEditor({ 
  state, 
  projectPath, 
  theme, 
  onSave, 
  onCancel,
  incomingTransitions = [],
  allStates = {},
  allTransitions = []
}) {
   // ✅ ADD: Load platforms from config
  const { platforms: configPlatforms, loading: platformsLoading } = useProjectConfig(projectPath);
  
  const [editMode, setEditMode] = useState(false);
  const [editedUI, setEditedUI] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [editedScreens, setEditedScreens] = useState(new Set());
  const [isLoadingMergedData, setIsLoadingMergedData] = useState(false);
  
  // ✅ NEW: Available POM screens for dropdown
  const [availablePOMScreens, setAvailablePOMScreens] = useState([]);
  const [isLoadingPOMScreens, setIsLoadingPOMScreens] = useState(false);
  // ✅ NEW: Test data schema from config
const [testDataSchema, setTestDataSchema] = useState([]);

  // Modal states
  const [addScreenModal, setAddScreenModal] = useState({
    isOpen: false,
    platformName: '',
    platformDisplayName: ''
  });

  const [copyScreenDialog, setCopyScreenDialog] = useState({
    isOpen: false,
    screen: null,
    platformName: '',
    platformDisplayName: ''
  });

  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    isOpen: false,
    screen: null,
    platformName: '',
    platformDisplayName: '',
    screenIndex: -1
  });

  const parseFieldWithIndex = (fieldStr) => {
  const match = fieldStr.match(/^(.+)\[(\d+|last|all|any)\]$/);
  if (!match) {
    return { field: fieldStr, indexType: '', customIndex: '' };
  }
  const idx = match[2];
  if (idx === '0') {
    return { field: match[1], indexType: 'first', customIndex: '' };
  } else if (['last', 'all', 'any'].includes(idx)) {
    return { field: match[1], indexType: idx, customIndex: '' };
  } else {
    return { field: match[1], indexType: 'custom', customIndex: idx };
  }
};

// Build field string with index
const buildFieldWithIndex = (field, indexType, customIndex) => {
  if (!indexType || indexType === '') return field;
  if (indexType === 'first') return `${field}[0]`;
  if (indexType === 'custom') return `${field}[${customIndex}]`;
  return `${field}[${indexType}]`;
};

const storedVariables = useMemo(() => {
  const variables = [];
  
  // 1. Variables from incoming transitions' actionDetails
  if (incomingTransitions.length > 0) {
    incomingTransitions.forEach(transition => {
      const transVars = collectVariablesFromTransition(transition);
      transVars.forEach(v => {
        if (!variables.some(existing => existing.name === v.name)) {
          variables.push(v);
        }
      });
    });
  }
  
  // 2. Try to extract from state's setup metadata
  const setup = state?.meta?.setup || state?.xstateConfig?.meta?.setup;
  if (setup) {
    const setupArray = Array.isArray(setup) ? setup : [setup];
    setupArray.forEach(s => {
      if (s.actionDetails) {
        const setupVars = collectVariablesFromTransition({ 
          event: s.actionName || 'SETUP',
          actionDetails: s.actionDetails 
        });
        setupVars.forEach(v => {
          if (!variables.some(existing => existing.name === v.name)) {
            variables.push(v);
          }
        });
      }
    });
  }
  
  // 3. Variables from previous states in chain (if available)
  if (Object.keys(allStates).length > 0 && allTransitions.length > 0) {
    const stateName = state?.id || state?.meta?.status;
    if (stateName) {
      const incoming = allTransitions.filter(t => 
        (t.target || t.to || '').toLowerCase() === stateName.toLowerCase()
      );
      
      incoming.forEach(t => {
        const sourceStateName = t.from || t.source;
        const sourceState = allStates[sourceStateName];
        if (sourceState) {
          const stateVars = collectVariablesFromState(sourceState, sourceStateName);
          stateVars.forEach(v => {
            if (!variables.some(existing => existing.name === v.name)) {
              v.fromState = sourceStateName;
              variables.push(v);
            }
          });
        }
      });
    }
  }
  // 4. Test data fields from config
  const testDataVars = testDataSchemaToVariables(testDataSchema);
  testDataVars.forEach(v => {
    if (!variables.some(existing => existing.name === v.name)) {
      variables.push(v);
    }
  });
  
  // ✅ 5. NEW: Variables from UI validations (storeAs)
  const uiVars = collectVariablesFromUIValidations(state);
  uiVars.forEach(v => {
    if (!variables.some(existing => existing.name === v.name)) {
      variables.push(v);
    }
  });
  
  // ✅ 6. NEW: Variables from previous states' UI validations
  if (Object.keys(allStates).length > 0 && allTransitions.length > 0) {
    const stateName = state?.id || state?.meta?.status;
    if (stateName) {
      const incoming = allTransitions.filter(t => 
        (t.target || t.to || '').toLowerCase() === stateName.toLowerCase()
      );
      
      incoming.forEach(t => {
        const sourceStateName = t.from || t.source;
        const sourceState = allStates[sourceStateName];
        if (sourceState) {
          const sourceUIVars = collectVariablesFromUIValidations(sourceState);
          sourceUIVars.forEach(v => {
            if (!variables.some(existing => existing.name === v.name)) {
              v.fromState = sourceStateName;
              variables.push(v);
            }
          });
        }
      });
    }
  }
  
  console.log(`💾 UIScreenEditor: Computed ${variables.length} available variables`, variables);
  
  return variables;
}, [state, incomingTransitions, allStates, allTransitions, testDataSchema]);

useEffect(() => {
  if (projectPath) {
    fetch(`/api/config/test-data-schema/${encodeURIComponent(projectPath)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.schema) {
          console.log('📋 Loaded test data schema:', data.schema.length, 'fields');
          setTestDataSchema(data.schema);
        }
      })
      .catch(err => console.warn('⚠️ Test data schema fetch failed:', err));
  }
}, [projectPath]);

  // ✅ Fetch POM screens when entering edit mode
  useEffect(() => {
    if (editMode && projectPath) {
      fetchPOMScreens();
    }
  }, [editMode, projectPath]);

  // ✅ NEW: Fetch test data schema from config
useEffect(() => {
  if (projectPath) {
    fetchTestDataSchema();
  }
}, [projectPath]);

const fetchTestDataSchema = async () => {
  try {
    const response = await fetch(
      `/api/config/test-data-schema/${encodeURIComponent(projectPath)}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.schema) {
        console.log('📋 Loaded test data schema:', data.schema.length, 'fields');
        setTestDataSchema(data.schema);
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch test data schema:', error);
  }
};

  const fetchPOMScreens = async () => {
    setIsLoadingPOMScreens(true);
    try {
      console.log('🔍 Fetching POM screens from:', projectPath);
      
      const response = await fetch(
        `/api/discovery/screens?projectPath=${encodeURIComponent(projectPath)}`
      );
      
      if (!response.ok) {
        console.warn('⚠️ POM screens API not available (404)');
        setAvailablePOMScreens([]);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.screens) {
        console.log('✅ Loaded', data.screens.length, 'POM screens');
        setAvailablePOMScreens(data.screens);
      } else {
        setAvailablePOMScreens([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch POM screens:', error);
      setAvailablePOMScreens([]);
    } finally {
      setIsLoadingPOMScreens(false);
    }
  };

  const initializeEditedUI = () => {
    const platforms = state?.uiCoverage?.platforms || state?.meta?.uiCoverage?.platforms;
    if (!platforms) return null;
    
    console.log('🔍 Raw platforms from state:', platforms);
    
    const normalized = {};
    
    Object.entries(platforms).forEach(([platformName, platformData]) => {
      normalized[platformName] = {
        ...platformData,
        screens: normalizeScreens(platformData.screens)
      };
    });
    
    return normalized;
  };

  const handleEnterEditMode = async () => {
    setIsLoadingMergedData(true);
    
    try {
      const response = await fetch(
        `/api/implications/ui-with-source?filePath=${encodeURIComponent(state.filePath)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch merged data');
      }
      
      const { uiData } = await response.json();
      
      console.log('🎯 API returned uiData:', uiData);
      
      const editableUI = {};
      
      for (const [platformName, platformData] of Object.entries(uiData.platforms)) {
        editableUI[platformName] = {
          ...platformData,
          screens: {}
        };
        
        for (const [screenName, screenArray] of Object.entries(platformData.screens)) {
          editableUI[platformName].screens[screenName] = {
            ...(screenArray[0] || {}),
            screenName: screenName
          };
        }
      }
      
      console.log('✅ Editable UI prepared:', editableUI);
      
      setEditedUI(editableUI);
      setEditedScreens(new Set());
      setEditMode(true);
      
    } catch (error) {
      console.error('❌ Failed to load merged data:', error);
      setEditedUI(initializeEditedUI());
      setEditedScreens(new Set());
      setEditMode(true);
    } finally {
      setIsLoadingMergedData(false);
    }
  };

const handleAddScreen = (platformName, screenName, screenData) => {
  console.log('➕ handleAddScreen called:', { platformName, screenName, screenData });
  
  setEditedUI(prev => {
    // ✅ If platform doesn't exist, create it!
    if (!prev || !prev[platformName]) {
      console.log('✨ Creating new platform:', platformName);
      return {
        ...prev,
        [platformName]: {
          displayName: platformName.charAt(0).toUpperCase() + platformName.slice(1),
          screens: {
            [screenName]: screenData
          }
        }
      };
    }
    
    return {
      ...prev,
      [platformName]: {
        ...prev[platformName],
        screens: {
          ...prev[platformName].screens,
          [screenName]: screenData
        }
      }
    };
  });
  
  setHasChanges(true);
  
  const screenKey = `${platformName}.${screenName}`;
  setEditedScreens(prev => {
    const newSet = new Set(prev);
    newSet.add(screenKey);
    return newSet;
  });
};

  const handleDeleteScreen = (platformName, screenName) => {
    setEditedUI(prev => {
      if (!prev || !prev[platformName]) return prev;
      
      const platform = prev[platformName];
      const newScreens = { ...platform.screens };
      delete newScreens[screenName];
      
      return {
        ...prev,
        [platformName]: {
          ...platform,
          screens: newScreens
        }
      };
    });
    setHasChanges(true);
  };

  const handleCopyScreen = (sourcePlatform, sourceScreen, targetPlatform, newName) => {
    const newScreen = {
      ...JSON.parse(JSON.stringify(sourceScreen)),
      screenName: newName
    };

    setEditedUI(prev => {
      if (!prev || !prev[targetPlatform]) return prev;
      
      const platform = prev[targetPlatform];
      return {
        ...prev,
        [targetPlatform]: {
          ...platform,
          screens: {
            ...platform.screens,
            [newName]: newScreen
          }
        }
      };
    });
    setHasChanges(true);
  };

  const handleCancelEdit = () => {
    if (hasChanges && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    setEditMode(false);
    setEditedUI(null);
    setHasChanges(false);
    setEditedScreens(new Set());
  };

  const denormalizeUIForSave = (normalizedUI) => {
    console.log('🔄 Denormalizing UI...');
    console.log('📥 Input:', JSON.stringify(normalizedUI, null, 2));
    
    const denormalized = {};
    
    for (const [platformName, platformData] of Object.entries(normalizedUI)) {
      denormalized[platformName] = {};
      
      // screens is already an object: { "screenName": {...} }
      for (const [screenName, screenData] of Object.entries(platformData.screens || {})) {
        if (!screenName || screenName === 'undefined') {
          console.warn('⚠️ Screen has no name, skipping:', screenData);
          continue;
        }
        
        // Remove UI-specific metadata before saving
        const { name, originalName, index, screenName: _, ...cleanScreenData } = screenData;
        
        // Wrap in array (Implication format expects arrays)
        denormalized[platformName][screenName] = [cleanScreenData];
      }
    }
    
    console.log('📤 Output:', JSON.stringify(denormalized, null, 2));
    return denormalized;
  };

const handleSaveChanges = async () => {
  try {
    console.log('💾 SAVE TRIGGERED!');
    
    // ✅ AUTO-FIX: Add type to assertions before saving
    const fixedUI = JSON.parse(JSON.stringify(editedUI));
    
    for (const [platformName, platformData] of Object.entries(fixedUI)) {
      // ✅ FIX: screens might be directly under platform OR under .screens
      const screens = platformData.screens || platformData;
      
      for (const [screenName, screenData] of Object.entries(screens)) {
        // Skip non-screen properties like 'displayName'
        if (typeof screenData !== 'object' || screenData === null) continue;
        if (screenName === 'displayName' || screenName === 'count') continue;
        
        console.log(`🔧 Processing screen: ${platformName}.${screenName}`);
        
        // Fix blocks
        if (screenData.blocks && Array.isArray(screenData.blocks)) {
          for (const block of screenData.blocks) {
            if (block.type === 'ui-assertion' && block.data?.assertions) {
              console.log(`   📦 Fixing ${block.data.assertions.length} assertions in block ${block.id}`);
              
              block.data.assertions = block.data.assertions.map(assertion => {
                if (assertion.type) {
                  console.log(`   ✓ ${assertion.fn} already has type: ${assertion.type}`);
                  return assertion;
                }
                
                // Infer type from naming patterns
                const baseFn = (assertion.fn || '').replace(/\[.*\]$/, '');
                const methodPatterns = /^(click|get|set|fill|select|wait|scroll|drag|drop|hover|focus|blur|submit|clear|check|uncheck|toggle|open|close|show|hide|enable|disable|validate|verify|assert|is|has|can|should|array)/i;
                
                const inferredType = methodPatterns.test(baseFn) ? 'method' : 'locator';
                console.log(`   + ${assertion.fn} → ${inferredType}`);
                
                return {
                  ...assertion,
                  type: inferredType
                };
              });
            }
          }
        }
        
        // Fix legacy assertions (not in blocks)
        if (screenData.assertions && Array.isArray(screenData.assertions)) {
          screenData.assertions = screenData.assertions.map(assertion => {
            if (assertion.type) return assertion;
            
            const baseFn = (assertion.fn || '').replace(/\[.*\]$/, '');
            const methodPatterns = /^(click|get|set|fill|select|wait|scroll|drag|drop|hover|focus|blur|submit|clear|check|uncheck|toggle|open|close|show|hide|enable|disable|validate|verify|assert|is|has|can|should|array)/i;
            
            return {
              ...assertion,
              type: methodPatterns.test(baseFn) ? 'method' : 'locator'
            };
          });
        }
      }
    }
    
    console.log('✅ Fixed UI ready to save');
    
    if (onSave) {
      await onSave(fixedUI, editedScreens);
    }
    setEditMode(false);
    setHasChanges(false);
    setEditedUI(null);
    setEditedScreens(new Set());
  } catch (error) {
    console.error('❌ Save failed:', error);
  }
};

const getAvailablePlatforms = () => {
  if (configPlatforms && configPlatforms.length > 0) {
    return configPlatforms;
  }
  // Fallback while loading
  return [{ name: 'web', displayName: 'Web' }];
};

  // Get platforms data
  const platforms = editMode ? editedUI : (state?.uiCoverage?.platforms || state?.meta?.uiCoverage?.platforms || {});
  const platformNames = Object.keys(platforms);

  if (platformNames.length === 0 && !editMode) {
    return (
      <div 
        className="p-8 text-center rounded-lg"
        style={{ 
          background: `${theme.colors.background.tertiary}40`,
          border: `1px dashed ${theme.colors.border}`,
          color: theme.colors.text.tertiary
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖥️</div>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          No UI Coverage
        </div>
        <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '24px' }}>
          This state doesn't have any UI screen validations yet
        </div>
        <button
          onClick={() => {
            setEditedUI({
              web: {
                displayName: 'Web',
                count: 0,
                screens: {}
              }
            });
            setEditMode(true);
          }}
          className="px-4 py-2 rounded font-semibold transition hover:brightness-110"
          style={{ 
            background: theme.colors.accents.blue,
            color: 'white'
          }}
        >
          Add First Screen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '24px' }}>🖥️</span>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: theme.colors.text.primary }}>
            UI Screens
          </h3>
            {/* ✅ NEW: Show variables count */}
          {storedVariables.length > 0 && (
            <span 
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ 
                background: `${theme.colors.accents.yellow}20`,
                color: theme.colors.accents.yellow
              }}
              title={`${storedVariables.length} variables available from transitions and test data`}
            >
              💾 {storedVariables.length} variables
            </span>
          )}
        </div>

        {!editMode ? (
          <button
            onClick={handleEnterEditMode}
            disabled={isLoadingMergedData}
            className="px-4 py-2 rounded font-semibold transition hover:brightness-110 disabled:opacity-50"
            style={{ 
              background: theme.colors.accents.blue,
              color: 'white'
            }}
          >
            {isLoadingMergedData ? '⏳ Loading...' : '✏️ Edit UI'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSaveChanges}
              disabled={!hasChanges}
              className="px-4 py-2 rounded font-semibold transition hover:brightness-110 disabled:opacity-50"
              style={{ 
                background: theme.colors.accents.green,
                color: 'white'
              }}
            >
              ✅ Save Changes
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 rounded font-semibold transition hover:brightness-110"
              style={{ 
                background: theme.colors.accents.red,
                color: 'white'
              }}
            >
              ❌ Cancel
            </button>
          </div>
        )}
      </div>

      {/* Platforms List */}
      <div className="space-y-4">
      {platformNames.map(platformName => {
  const platformData = platforms[platformName];

  return (
    <PlatformSectionWithOrdering
      key={platformName}
      platformName={platformName}
      platformData={platformData}
      editMode={editMode}
      projectPath={projectPath}
      theme={theme}
      storedVariables={storedVariables}
      onScreensChange={(newScreens) => {
        console.log('🔄 Platform screens changed:', platformName, newScreens);
        
        setEditedUI(prev => {
          if (!prev || !prev[platformName]) return prev;
          
          return {
            ...prev,
            [platformName]: {
              ...prev[platformName],
              screens: newScreens
            }
          };
        });
        
        setHasChanges(true);
        
        // Mark all screens in this platform as edited
        Object.keys(newScreens).forEach(screenName => {
          const screenKey = `${platformName}.${screenName}`;
          setEditedScreens(prev => {
            const newSet = new Set(prev);
            newSet.add(screenKey);
            return newSet;
          });
        });
      }}
      onAddScreen={() => {
        setAddScreenModal({
          isOpen: true,
          platformName,
          platformDisplayName: platformData.displayName || platformName
        });
      }}
      onDeleteScreen={(screenName) => {
        const screen = platformData.screens?.[screenName]?.[0] || platformData.screens?.[screenName];
        setDeleteConfirmDialog({
          isOpen: true,
          screen,
          platformName,
          platformDisplayName: platformData.displayName || platformName,
          screenName
        });
      }}
      onCopyScreen={(screen) => {
        setCopyScreenDialog({
          isOpen: true,
          screen,
          platformName,
          platformDisplayName: platformData.displayName || platformName
        });
      }}
    />
  );
})}
      </div>

      {/* Modals */}
    <AddScreenModal
        isOpen={addScreenModal.isOpen}
        projectPath={projectPath}
        availablePlatforms={getAvailablePlatforms()}
        existingScreens={platforms}
        onAdd={(platformName, screenName, newScreen) => {
          handleAddScreen(platformName, screenName, newScreen);
          setAddScreenModal({ isOpen: false, platformName: '', platformDisplayName: '' });
        }}
        onClose={() => setAddScreenModal({ isOpen: false, platformName: '', platformDisplayName: '' })}
        theme={theme}
      />

      <CopyScreenDialog
        isOpen={copyScreenDialog.isOpen}
        screen={copyScreenDialog.screen}
        sourcePlatform={copyScreenDialog.platformName}
        availablePlatforms={getAvailablePlatforms()}
        onCopy={handleCopyScreen}
        onClose={() => setCopyScreenDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '' })}
        theme={theme}
      />

<DeleteConfirmDialog
  isOpen={deleteConfirmDialog.isOpen}
  screenName={deleteConfirmDialog.screenName}  // ✅ Use screenName, not screen
  platformDisplayName={deleteConfirmDialog.platformDisplayName}
  onConfirm={() => {
    handleDeleteScreen(deleteConfirmDialog.platformName, deleteConfirmDialog.screenName);
    setDeleteConfirmDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '', screenName: '' });
  }}
  onClose={() => setDeleteConfirmDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '', screenName: '' })}
/>
    </div>
  );
}

// ============================================
// PlatformSection Component (UNCHANGED)
// ============================================

function PlatformSection({ 
  platformName, 
  platformData, 
  screens,
  editMode, 
  projectPath, 
  theme,
  storedVariables = [],  // ✅ ADD THIS
  onScreenUpdate,
  onAddScreen,
  onDeleteScreen,
  onCopyScreen
}) {
  const screenArray = screens || [];

  return (
    <div 
      className="p-4 rounded-lg"
      style={{ 
        background: theme.colors.background.tertiary,
        border: `1px solid ${theme.colors.border}`
      }}
    >
      {/* Platform Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '24px' }}>{getPlatformIcon(platformName)}</span>
          <h4 style={{ fontSize: '16px', fontWeight: 600, color: theme.colors.text.primary }}>
            {platformData.displayName || platformName}
          </h4>
          <span 
            className="px-2 py-1 rounded text-xs"
            style={{ 
              background: theme.colors.background.secondary,
              color: theme.colors.text.tertiary
            }}
          >
            {screenArray.length} {screenArray.length === 1 ? 'screen' : 'screens'}
          </span>
        </div>

        {editMode && (
          <button
            onClick={onAddScreen}
            className="px-3 py-1.5 rounded text-sm font-semibold transition hover:brightness-110"
            style={{ 
              background: theme.colors.accents.blue,
              color: 'white'
            }}
          >
            ➕ Add Screen
          </button>
        )}
      </div>

      {/* Screens */}
      <div className="space-y-3">
        {screenArray.map((screen, idx) => (
      <ScreenCard
  key={idx}
  screen={screen}
  screenIndex={idx}
  editMode={editMode}
  projectPath={projectPath}
  theme={theme}
  storedVariables={storedVariables}  // ✅ ADD THIS
  onUpdate={(updates) => {
    const screenName = screen.screenName || screen.name || screen.originalName;
    const updatedScreen = { ...screen, ...updates };
    onScreenUpdate(screenName, updatedScreen);
  }}
  onDelete={() => {
    const screenName = screen.screenName || screen.name || screen.originalName;
    onDeleteScreen(screenName);
  }}
  onCopy={() => onCopyScreen(screen)}
/>
        ))}

        {screenArray.length === 0 && !editMode && (
          <div 
            className="p-8 text-center rounded"
            style={{ 
              background: theme.colors.background.secondary,
              color: theme.colors.text.tertiary
            }}
          >
            No screens defined
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// ScreenCard Component (UNCHANGED - keeping your version)
// ============================================

function ScreenCard({ screen, editMode, projectPath, onUpdate, onCopy, onDelete, theme, storedVariables = [] }) {
  console.log('🔍 ScreenCard received:', screen.screenName || screen.name, {
    hasBlocks: !!screen.blocks,
    blocksCount: screen.blocks?.length || 0,
    isLegacy: !screen.blocks && (screen.visible?.length > 0 || screen.hidden?.length > 0)
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [pomName, setPomName] = useState(screen.screen || '');
  const [instanceName, setInstanceName] = useState(screen.instance || null);
  const [viewMode, setViewMode] = useState('blocks'); // 'blocks' or 'legacy'

  // Determine if we should show the new block view or legacy view
  const hasBlocks = screen.blocks && screen.blocks.length > 0;
  const hasLegacyData = !hasBlocks && (
    screen.visible?.length > 0 ||
    screen.hidden?.length > 0 ||
    Object.keys(screen.checks || {}).length > 0 ||
    Object.keys(screen.functions || {}).length > 0
  );

  // Handle POM change
  const handlePOMChange = (selectedPOM, selectedInstance) => {
    setPomName(selectedPOM || '');
    setInstanceName(selectedInstance || null);
    
    const pomSource = selectedPOM ? {
      path: `screenObjects/${selectedPOM}.js`,
      name: selectedPOM,
      className: selectedPOM.split('.').pop()
    } : null;
    
    onUpdate({
      screen: selectedPOM || '',
      instance: selectedInstance || null,
      _pomSource: pomSource
    });
  };

  // Handle blocks change
  const handleBlocksChange = (newBlocks) => {
    console.log('📦 Blocks changed:', newBlocks.length, 'blocks');
    onUpdate({ blocks: newBlocks });
  };

  return (
    <div 
      className="rounded-lg overflow-hidden"
      style={{ 
        background: theme.colors.background.secondary,
        border: `1px solid ${theme.colors.border}`
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:brightness-105 transition"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '20px' }}>📄</span>
          <div className="text-left">
            <div style={{ fontSize: '16px', fontWeight: 600, color: theme.colors.text.primary }}>
              {screen.screenName || screen.name || screen.originalName || 'Unnamed Screen'}
            </div>
            {screen.description && (
              <div style={{ fontSize: '13px', color: theme.colors.text.tertiary }}>
                {screen.description}
              </div>
            )}
          </div>
          
          {/* Block count badge */}
          {hasBlocks && (
            <span 
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ 
                background: `${theme.colors.accents.blue}30`,
                color: theme.colors.accents.blue
              }}
            >
              🧱 {screen.blocks.length} blocks
            </span>
          )}
        </div>
        <span 
          className="transition-transform"
          style={{ 
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            color: theme.colors.text.tertiary
          }}
        >
          ▼
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3">
          {/* Source Legend */}
          {screen.sourceInfo && <SourceLegend theme={theme} />}
          
          {/* POM Selector */}
          <POMFieldSelector
            projectPath={projectPath}
            selectedPOM={pomName}
            selectedInstance={instanceName}
            onPOMChange={(selectedPOM) => handlePOMChange(selectedPOM, instanceName)}
            onInstanceChange={(selectedInstance) => handlePOMChange(pomName, selectedInstance)}
            editable={editMode}
            theme={theme}
          />

          {/* View Mode Toggle (only show if we have legacy data AND edit mode) */}
          {hasLegacyData && editMode && (
            <div className="flex items-center gap-2 p-2 rounded" style={{ background: theme.colors.background.tertiary }}>
              <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>View:</span>
              <button
                onClick={() => setViewMode('blocks')}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${viewMode === 'blocks' ? 'ring-2' : ''}`}
                style={{ 
                  background: viewMode === 'blocks' ? theme.colors.accents.blue : 'transparent',
                  color: viewMode === 'blocks' ? 'white' : theme.colors.text.secondary,
                  ringColor: theme.colors.accents.blue
                }}
              >
                🧱 Blocks
              </button>
              <button
                onClick={() => setViewMode('legacy')}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${viewMode === 'legacy' ? 'ring-2' : ''}`}
                style={{ 
                  background: viewMode === 'legacy' ? theme.colors.accents.purple : 'transparent',
                  color: viewMode === 'legacy' ? 'white' : theme.colors.text.secondary,
                  ringColor: theme.colors.accents.purple
                }}
              >
                📋 Legacy
              </button>
            </div>
          )}

          {/* Block-based View (new) */}
          {(viewMode === 'blocks' || !hasLegacyData) && (
            <BlockList
              screen={screen}
              editMode={editMode}
              theme={theme}
              onBlocksChange={handleBlocksChange}
              pomName={pomName}
              instanceName={instanceName}
              projectPath={projectPath}
              storedVariables={storedVariables}
            />
          )}

          {/* Legacy View (existing sections) */}
          {viewMode === 'legacy' && hasLegacyData && (
            <LegacyScreenContent
              screen={screen}
              editMode={editMode}
              theme={theme}
              pomName={pomName}
              instanceName={instanceName}
              projectPath={projectPath}
              storedVariables={storedVariables}
              onUpdate={onUpdate}
            />
          )}

          {/* Action Buttons */}
          {editMode && (
            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: theme.colors.border }}>
              <button
                onClick={onCopy}
                className="flex-1 px-3 py-2 rounded text-sm font-semibold transition hover:brightness-110"
                style={{ background: theme.colors.accents.blue, color: 'white' }}
              >
                📋 Copy Screen
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-2 rounded text-sm font-semibold transition hover:brightness-110"
                style={{ background: theme.colors.accents.red, color: 'white' }}
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * LegacyScreenContent - Renders the old section-based format
 * This preserves backward compatibility and allows viewing old data
 */
function LegacyScreenContent({ screen, editMode, theme, pomName, instanceName, projectPath, storedVariables, onUpdate }) {
  const topLevelVisible = screen.visible || [];
  const topLevelHidden = screen.hidden || [];
  const checksVisible = screen.checks?.visible || [];
  const checksHidden = screen.checks?.hidden || [];
  
  const allVisibleElements = [...new Set([...topLevelVisible, ...checksVisible])];
  const allHiddenElements = [...new Set([...topLevelHidden, ...checksHidden])];
  
  const textChecks = screen.checks?.text || {};
  const functions = screen.functions || {};

  return (
    <div className="space-y-3">
      {/* Visible Elements */}
      {(allVisibleElements.length > 0 || editMode) && (
        editMode ? (
          <ElementSection
            title="✅ Visible Elements"
            elements={allVisibleElements}
            color={theme.colors.accents.green}
            editMode={editMode}
            pomName={pomName}
            instanceName={instanceName}
            projectPath={projectPath}
            functions={functions}
            onChange={(newElements) => onUpdate({ visible: newElements })}
            theme={theme}
            screen={screen}
          />
        ) : (
          <ElementList
            elements={allVisibleElements}
            sourceInfo={screen.sourceInfo?.visible || {}}
            title="Visible Elements"
            icon="✅"
            color={theme.colors.accents.green}
            theme={theme}
            emptyMessage="No visible elements"
          />
        )
      )}

      {/* Hidden Elements */}
      {(allHiddenElements.length > 0 || editMode) && (
        editMode ? (
          <ElementSection
            title="❌ Hidden Elements"
            elements={allHiddenElements}
            color={theme.colors.accents.red}
            editMode={editMode}
            pomName={pomName}
            instanceName={instanceName}
            projectPath={projectPath}
            functions={functions}
            onChange={(newElements) => onUpdate({ hidden: newElements })}
            theme={theme}
            screen={screen}
          />
        ) : (
          <ElementList
            elements={allHiddenElements}
            sourceInfo={screen.sourceInfo?.hidden || {}}
            title="Hidden Elements"
            icon="❌"
            color={theme.colors.accents.red}
            theme={theme}
            emptyMessage="No hidden elements"
          />
        )
      )}

      {/* Text Checks */}
      {(Object.keys(textChecks).length > 0 || Object.keys(screen.checks?.contains || {}).length > 0 || editMode) && (
        <TextChecksSection
          textChecks={textChecks}
          containsChecks={screen.checks?.contains || {}}
          editMode={editMode}
          pomName={pomName}
          instanceName={instanceName}
          projectPath={projectPath}
          storedVariables={storedVariables}
          onChange={(newTextChecks) => onUpdate({ checks: { ...screen.checks, text: newTextChecks } })}
          onContainsChange={(newContainsChecks) => onUpdate({ checks: { ...screen.checks, contains: newContainsChecks } })}
          theme={theme}
        />
      )}

      {/* Functions */}
      {(Object.keys(functions).length > 0 || editMode) && (
        <FunctionSection
          functions={functions}
          editMode={editMode}
          pomName={pomName}
          projectPath={projectPath}
          contextFields={getContextFields(screen)}
          onChange={(newFunctions) => onUpdate({ functions: newFunctions })}
          theme={theme}
        />
      )}

      {/* Truthy */}
      {((screen.truthy && screen.truthy.length > 0) || editMode) && (
        <TruthySection
          truthy={screen.truthy || []}
          editMode={editMode}
          pomName={pomName}
          projectPath={projectPath}
          onChange={(newTruthy) => onUpdate({ truthy: newTruthy })}
          theme={theme}
        />
      )}

      {/* Falsy */}
      {((screen.falsy && screen.falsy.length > 0) || editMode) && (
        <FalsySection
          falsy={screen.falsy || []}
          editMode={editMode}
          pomName={pomName}
          projectPath={projectPath}
          onChange={(newFalsy) => onUpdate({ falsy: newFalsy })}
          theme={theme}
        />
      )}

      {/* Assertions */}
      {(screen.assertions?.length > 0 || editMode) && (
        <AssertionsSection
          assertions={screen.assertions || []}
          editMode={editMode}
          pomName={pomName}
          projectPath={projectPath}
          storedVariables={storedVariables}
          onChange={(newAssertions) => onUpdate({ assertions: newAssertions })}
          theme={theme}
        />
      )}
    </div>
  );
}




// Helper: Parse field name to extract index
const parseFieldWithIndex = (fieldStr) => {
  const match = fieldStr.match(/^(.+)\[(\d+|last|all|any)\]$/);
  if (!match) {
    return { field: fieldStr, indexType: '', customIndex: '' };
  }
  const idx = match[2];
  if (idx === '0') {
    return { field: match[1], indexType: 'first', customIndex: '' };
  } else if (['last', 'all', 'any'].includes(idx)) {
    return { field: match[1], indexType: idx, customIndex: '' };
  } else {
    return { field: match[1], indexType: 'custom', customIndex: idx };
  }
};

// Helper: Build field string with index
const buildFieldWithIndex = (field, indexType, customIndex) => {
  if (!indexType || indexType === '') return field;
  if (indexType === 'first') return `${field}[0]`;
  if (indexType === 'custom') return `${field}[${customIndex}]`;
  return `${field}[${indexType}]`;
};

function ElementSection({ title, elements, color, editMode, pomName, instanceName, projectPath, functions = {}, onChange, theme, screen }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newElement, setNewElement] = useState('');
  const [newIndexType, setNewIndexType] = useState('');
  const [newCustomIndex, setNewCustomIndex] = useState('');
  const [fieldValidation, setFieldValidation] = useState(null);

  const handleAddElement = () => {
    if (!newElement.trim()) return;
    const finalElement = buildFieldWithIndex(newElement.trim(), newIndexType, newCustomIndex);
    if (elements.includes(finalElement)) {
      alert('Element already exists!');
      return;
    }
    onChange([...elements, finalElement]);
    setNewElement('');
    setNewIndexType('');
    setNewCustomIndex('');
    setIsAdding(false);
    setFieldValidation(null);
  };

  const handleRemoveElement = (element) => {
    onChange(elements.filter(el => el !== element));
  };

  const handleUpdateElement = (oldElement, newField, newIdxType, newCustomIdx) => {
    const finalElement = buildFieldWithIndex(newField, newIdxType, newCustomIdx);
    onChange(elements.map(el => el === oldElement ? finalElement : el));
  };

  return (
    <div className="p-3 rounded" style={{ background: `${color}10`, border: `1px solid ${color}40` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color }}>{title} ({elements.length})</div>
        {editMode && !isAdding && (
          <button onClick={() => setIsAdding(true)} className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110" style={{ background: color, color: 'white' }}>➕ Add</button>
        )}
      </div>
      <div className="space-y-2">
        {elements.map((element, idx) => {
          const parsed = parseFieldWithIndex(element);
          return (
            <div key={idx} className="flex items-center gap-2 p-2 rounded" style={{ background: `${color}20` }}>
              <span className="flex-1 font-mono text-sm" style={{ color: theme.colors.text.primary }}>
                {parsed.field}
              </span>
              {parsed.indexType && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: color, color: 'white' }}>
                  [{parsed.indexType === 'first' ? '0' : parsed.indexType === 'custom' ? parsed.customIndex : parsed.indexType}]
                </span>
              )}
              {editMode && (
                <button 
                  onClick={() => handleRemoveElement(element)}
                  className="text-red-400 hover:text-red-300 transition"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        
        {isAdding && (
          <div className="space-y-2 p-2 rounded" style={{ background: `${color}15` }}>
            <div className="flex gap-2">
              {/* Field selector */}
              <div className="flex-1">
                {pomName && projectPath ? (
                  <FieldAutocomplete 
                    projectPath={projectPath}
                    pomName={pomName}
                    instanceName={instanceName}
                    fieldValue={newElement}
                    onFieldChange={setNewElement}
                    onValidationChange={setFieldValidation}
                    placeholder="Select element..."
                    functions={functions}
                  />
                ) : (
                  <input
                    type="text"
                    value={newElement}
                    onChange={(e) => setNewElement(e.target.value)}
                    placeholder="Element name..."
                    className="w-full px-2 py-1 rounded border text-sm"
                    autoFocus
                    style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }}
                  />
                )}
              </div>
              
              {/* Index selector */}
              <select
                value={newIndexType}
                onChange={(e) => setNewIndexType(e.target.value)}
                className="px-2 py-1 rounded border text-sm"
                style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }}
              >
                {INDEX_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              
              {/* Custom index input */}
              {newIndexType === 'custom' && (
                <input
                  type="number"
                  min="0"
                  value={newCustomIndex}
                  onChange={(e) => setNewCustomIndex(e.target.value)}
                  placeholder="0"
                  className="w-16 px-2 py-1 rounded border text-sm"
                  style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }}
                />
              )}
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={handleAddElement}
                disabled={fieldValidation === false || !newElement.trim()}
                className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  background: fieldValidation === false ? '#94a3b8' : color,
                  color: 'white'
                }}
              >
                {fieldValidation === false ? '⚠️ Invalid' : 'Add'}
              </button>
              <button 
                onClick={() => { 
                  setIsAdding(false); 
                  setNewElement('');
                  setNewIndexType('');
                  setNewCustomIndex('');
                  setFieldValidation(null);
                }} 
                className="px-3 py-1 rounded text-sm" 
                style={{ background: theme.colors.background.tertiary, color: theme.colors.text.secondary }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {elements.length === 0 && !isAdding && (
        <div className="text-center py-2 text-sm" style={{ color: theme.colors.text.tertiary }}>No elements</div>
      )}
    </div>
  );
}

function TextChecksSection({ textChecks, containsChecks = {}, editMode, pomName, instanceName, projectPath, storedVariables = [], onChange, onContainsChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSelector, setNewSelector] = useState('');
  const [newExpectedText, setNewExpectedText] = useState('');
  const [matchType, setMatchType] = useState('contains'); // 'exact' or 'contains'
  const [useVariable, setUseVariable] = useState(false);  // ✅ NEW
  const [fieldValidation, setFieldValidation] = useState(null);
  const color = theme.colors.accents.yellow;

  // Combine both for display
  const allChecks = [
    ...Object.entries(textChecks).map(([selector, text]) => ({ selector, text, type: 'exact' })),
    ...Object.entries(containsChecks).map(([selector, text]) => ({ selector, text, type: 'contains' }))
  ];

  const handleAddTextCheck = () => {
    if (!newSelector.trim() || !newExpectedText.trim()) return;
    
    // Check if already exists in either
    if (textChecks[newSelector] || containsChecks[newSelector]) {
      alert('Text check for this selector already exists!');
      return;
    }
    
    // ✅ Wrap in {{}} if using variable
    const finalValue = useVariable ? `{{${newExpectedText}}}` : newExpectedText.trim();
    
    if (matchType === 'exact') {
      onChange({ ...textChecks, [newSelector.trim()]: finalValue });
    } else {
      onContainsChange({ ...containsChecks, [newSelector.trim()]: finalValue });
    }
    
    setNewSelector('');
    setNewExpectedText('');
    setMatchType('contains');
    setUseVariable(false);
    setIsAdding(false);
    setFieldValidation(null);
  };

  const handleRemoveTextCheck = (selector, type) => {
    if (type === 'exact') {
      const updated = { ...textChecks };
      delete updated[selector];
      onChange(updated);
    } else {
      const updated = { ...containsChecks };
      delete updated[selector];
      onContainsChange(updated);
    }
  };

  // ✅ Helper to render value with template highlighting
  const renderValue = (text) => {
    if (typeof text !== 'string') return text;
    
    const hasTemplate = /\{\{([^}]+)\}\}/.test(text);
    if (hasTemplate) {
      return (
        <span>
          {text.split(/(\{\{[^}]+\}\})/).map((part, i) => {
            if (part.match(/^\{\{[^}]+\}\}$/)) {
              return (
                <span 
                  key={i} 
                  className="px-1 py-0.5 rounded mx-0.5 text-xs font-mono"
                  style={{ background: `${theme.colors.accents.purple}30`, color: theme.colors.accents.purple }}
                >
                  {part}
                </span>
              );
            }
            return part;
          })}
        </span>
      );
    }
    return `"${text}"`;
  };

  return (
    <div className="p-3 rounded" style={{ background: `${color}10`, border: `1px solid ${color}40` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color }}>📝 Text Checks ({allChecks.length})</div>
        {editMode && !isAdding && (
          <button onClick={() => setIsAdding(true)} className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110" style={{ background: color, color: 'white' }}>➕ Add</button>
        )}
      </div>
      <div className="space-y-2">
        {allChecks.map(({ selector, text, type }) => (
          <div key={selector} className="p-2 rounded text-sm" style={{ background: `${color}20` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs" style={{ color }}>{selector}</span>
                  <span 
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{ 
                      background: type === 'exact' ? theme.colors.accents.blue : theme.colors.accents.purple,
                      color: 'white'
                    }}
                  >
                    {type === 'exact' ? '= exact' : '⊃ contains'}
                  </span>
                </div>
                <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
                  {renderValue(text)}
                </div>
              </div>
              {editMode && (
                <button onClick={() => handleRemoveTextCheck(selector, type)} className="hover:text-red-500 transition" style={{ color }}>✕</button>
              )}
            </div>
          </div>
        ))}
        
        {isAdding && (
          <div className="space-y-2 p-2 rounded" style={{ background: `${color}15` }}>
            {/* Locator selector */}
            {pomName && projectPath ? (
              <FieldAutocomplete 
                projectPath={projectPath}
                pomName={pomName}
                instanceName={instanceName}
                fieldValue={newSelector}
                onFieldChange={setNewSelector}
                onValidationChange={setFieldValidation}
                placeholder="Select locator for text check..."
              />
            ) : (
              <input 
                type="text" 
                value={newSelector} 
                onChange={(e) => setNewSelector(e.target.value)} 
                placeholder="Selector (select POM first)" 
                className="w-full px-2 py-1 rounded border text-sm" 
                style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }} 
              />
            )}
            
            {/* Match type dropdown */}
            <div className="flex gap-2">
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                className="px-2 py-1 rounded border text-sm"
                style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }}
              >
                <option value="contains">contains</option>
                <option value="exact">exact match</option>
              </select>
              
              {/* ✅ NEW: Toggle between text input and variable dropdown */}
              <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: theme.colors.text.secondary }}>
                <input
                  type="checkbox"
                  checked={useVariable}
                  onChange={(e) => {
                    setUseVariable(e.target.checked);
                    setNewExpectedText('');
                  }}
                  className="rounded"
                />
                Use stored variable
              </label>
            </div>
            
            {/* ✅ NEW: Either dropdown or text input based on toggle */}
            {useVariable ? (
              <div className="flex gap-2 items-center">
                <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'{{'}</span>
                <select
                  value={newExpectedText}
                  onChange={(e) => setNewExpectedText(e.target.value)}
                  className="flex-1 px-2 py-1 rounded border text-sm font-mono"
                  style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.accents.purple }}
                >
                  <option value="">Select variable...</option>
                  {storedVariables.map(v => (
                    <option key={v.path} value={v.path}>{v.path}</option>
                  ))}
                </select>
                <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'}}'}</span>
              </div>
            ) : (
              <input 
                type="text" 
                value={newExpectedText} 
                onChange={(e) => setNewExpectedText(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && handleAddTextCheck()} 
                placeholder="Expected text (e.g., 'Welcome' or type {{variable}})" 
                className="w-full px-2 py-1 rounded border text-sm" 
                style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }} 
              />
            )}
            
            {/* Helper text */}
            {storedVariables.length > 0 && (
              <div className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                💡 {storedVariables.length} stored variable(s) available from transitions
              </div>
            )}
            
            <div className="flex gap-2">
              <button 
                onClick={handleAddTextCheck} 
                disabled={fieldValidation === false || !newSelector.trim() || !newExpectedText.trim()}
                className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110 disabled:opacity-50" 
                style={{ background: fieldValidation === false ? '#94a3b8' : color, color: 'white' }}
              >
                {fieldValidation === false ? '⚠️ Invalid' : 'Add'}
              </button>
              <button 
                onClick={() => { 
                  setIsAdding(false); 
                  setNewSelector(''); 
                  setNewExpectedText(''); 
                  setMatchType('contains');
                  setUseVariable(false);
                  setFieldValidation(null);
                }} 
                className="px-3 py-1 rounded text-sm" 
                style={{ background: theme.colors.background.tertiary, color: theme.colors.text.secondary }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {allChecks.length === 0 && !isAdding && (
        <div className="text-center py-2 text-sm" style={{ color: theme.colors.text.tertiary }}>No text checks</div>
      )}
    </div>
  );
}

function FunctionSection({ functions, editMode, pomName, projectPath, contextFields, onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const color = theme.colors.accents.purple;

  const handleAddFunction = (functionCall) => {
    onChange({ ...functions, [functionCall.name]: functionCall });
    setIsAdding(false);
  };

  const handleRemoveFunction = (funcName) => {
    const updated = { ...functions };
    delete updated[funcName];
    onChange(updated);
  };

  // Toggle storeAs for a function
  const handleToggleStoreAs = (funcName) => {
    const func = functions[funcName];
    const updated = { ...functions };
    
    if (func.storeAs) {
      // Remove storeAs and persistStoreAs
      const { storeAs, persistStoreAs, ...rest } = updated[funcName];
      updated[funcName] = rest;
    } else {
      // Add default storeAs with persistence enabled
      updated[funcName] = {
        ...func,
        storeAs: funcName + 'Result',
        persistStoreAs: true  // ✅ Default to persist
      };
    }
    
    onChange(updated);
  };

  // Update storeAs value
  const handleStoreAsChange = (funcName, newValue) => {
    onChange({
      ...functions,
      [funcName]: {
        ...functions[funcName],
        storeAs: newValue
      }
    });
  };

  // ✅ NEW: Update persistStoreAs value
  const handlePersistStoreAsChange = (funcName, persist) => {
    onChange({
      ...functions,
      [funcName]: {
        ...functions[funcName],
        persistStoreAs: persist
      }
    });
  };

  return (
    <div className="p-3 rounded" style={{ background: `${color}10`, border: `1px solid ${color}40` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color }}>⚡ Functions ({Object.keys(functions).length})</div>
        {editMode && !isAdding && (
          <button onClick={() => setIsAdding(true)} className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110" style={{ background: color, color: 'white' }}>➕ Add Function</button>
        )}
      </div>
      <div className="space-y-2">
        {Object.entries(functions).map(([funcName, funcData]) => (
          <div key={funcName} className="p-2 rounded text-sm" style={{ background: `${color}20` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="font-mono text-xs mb-1 font-bold" style={{ color }}>{funcData.signature || funcName}</div>
                
                {/* Parameters */}
                {funcData.parameters && Object.keys(funcData.parameters).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(funcData.parameters).map(([paramName, paramValue]) => (
                      <div key={paramName} className="text-xs flex items-center gap-2">
                        <span style={{ color: theme.colors.text.tertiary }}>{paramName}:</span>
                        <code className="px-1 py-0.5 rounded" style={{ background: theme.colors.background.primary, color: theme.colors.accents.green }}>
                          {renderTemplateValue(paramValue, theme)}
                        </code>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* ✅ ENHANCED: StoreAs display/edit WITH persistence toggle */}
                {funcData.storeAs && (
                  <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                    <span className="text-yellow-500">💾</span>
                    <span style={{ color: theme.colors.text.tertiary }}>stores as:</span>
                    {editMode ? (
                      <>
                        <input
                          type="text"
                          value={funcData.storeAs}
                          onChange={(e) => handleStoreAsChange(funcName, e.target.value)}
                          className="px-2 py-0.5 rounded text-xs font-mono"
                          style={{ 
                            background: theme.colors.background.primary, 
                            border: `1px solid ${theme.colors.border}`,
                            color: theme.colors.accents.yellow,
                            width: '120px'
                          }}
                        />
                        {/* ✅ NEW: Persistence toggle */}
                        <label 
                          className="flex items-center gap-1 cursor-pointer ml-2 px-2 py-0.5 rounded"
                          style={{ 
                            background: funcData.persistStoreAs !== false 
                              ? `${theme.colors.accents.green}20` 
                              : theme.colors.background.tertiary,
                            color: funcData.persistStoreAs !== false 
                              ? theme.colors.accents.green 
                              : theme.colors.text.tertiary,
                            border: `1px solid ${funcData.persistStoreAs !== false 
                              ? theme.colors.accents.green 
                              : theme.colors.border}`
                          }}
                          title={funcData.persistStoreAs !== false 
                            ? 'Persists to ctx.data (available in later tests)' 
                            : 'Current test only (faster)'}
                        >
                          <input
                            type="checkbox"
                            checked={funcData.persistStoreAs !== false}
                            onChange={(e) => handlePersistStoreAsChange(funcName, e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span className="text-[10px]">persist</span>
                        </label>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-0.5 rounded font-mono" style={{ background: `${theme.colors.accents.yellow}20`, color: theme.colors.accents.yellow }}>
                          {funcData.storeAs}
                        </code>
                        {/* ✅ Show persistence indicator */}
                        {funcData.persistStoreAs !== false ? (
                          <span 
                            className="text-[10px] px-1.5 py-0.5 rounded" 
                            style={{ background: `${theme.colors.accents.green}20`, color: theme.colors.accents.green }}
                            title="Persists to ctx.data"
                          >
                            💾 persist
                          </span>
                        ) : (
                          <span 
                            className="text-[10px] px-1.5 py-0.5 rounded" 
                            style={{ background: theme.colors.background.tertiary, color: theme.colors.text.tertiary }}
                            title="Current test only"
                          >
                            ⚡ temp
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Add storeAs button in edit mode */}
                {editMode && !funcData.storeAs && (
                  <button
                    onClick={() => handleToggleStoreAs(funcName)}
                    className="mt-2 px-2 py-1 rounded text-xs transition hover:brightness-110"
                    style={{ background: `${theme.colors.accents.yellow}30`, color: theme.colors.accents.yellow }}
                  >
                    💾 Add storeAs
                  </button>
                )}
              </div>
              
              {editMode && (
                <div className="flex gap-1">
                  {funcData.storeAs && (
                    <button 
                      onClick={() => handleToggleStoreAs(funcName)} 
                      className="hover:text-yellow-500 transition text-xs"
                      title="Remove storeAs"
                    >
                      🗑️
                    </button>
                  )}
                  <button onClick={() => handleRemoveFunction(funcName)} className="hover:text-red-500 transition" style={{ color }}>✕</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isAdding && (
          <div className="p-3 rounded" style={{ background: `${color}15` }}>
            <FunctionSelector pomName={pomName} projectPath={projectPath} contextFields={contextFields} onAdd={handleAddFunction} onCancel={() => setIsAdding(false)} theme={theme} />
          </div>
        )}
      </div>
      {Object.keys(functions).length === 0 && !isAdding && (
        <div className="text-center py-2 text-sm" style={{ color: theme.colors.text.tertiary }}>No functions</div>
      )}
    </div>
  );
}



// ✅ Helper to render template values with highlighting
function renderTemplateValue(value, theme) {
  if (typeof value !== 'string') {
    return JSON.stringify(value);
  }
  
  // Check for {{variable}} pattern
  const hasTemplate = /\{\{([^}]+)\}\}/.test(value);
  
  if (hasTemplate) {
    return (
      <span>
        {value.split(/(\{\{[^}]+\}\})/).map((part, i) => {
          if (part.match(/^\{\{[^}]+\}\}$/)) {
            return (
              <span 
                key={i} 
                className="px-1 py-0.5 rounded mx-0.5"
                style={{ background: `${theme.colors.accents.yellow}30`, color: theme.colors.accents.yellow }}
              >
                {part}
              </span>
            );
          }
          return part;
        })}
      </span>
    );
  }
  
  return value;
}


// ============================================
// AssertionsSection - Advanced assertions
// ============================================

// ============================================
// ✅ FIXED: TruthySection with Function Dropdown
// ============================================
function TruthySection({ truthy = [], editMode, pomName, projectPath, onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const [availableFunctions, setAvailableFunctions] = useState([]);
  const [newFunc, setNewFunc] = useState('');
  const color = theme.colors.accents.green;

  // ✅ Fetch available functions from POM
  useEffect(() => {
    if (pomName && projectPath && editMode) {
      fetchPOMFunctions();
    }
  }, [pomName, projectPath, editMode]);

  const fetchPOMFunctions = async () => {
    try {
      const response = await fetch(
        `/api/poms/functions?projectPath=${encodeURIComponent(projectPath)}&pomName=${encodeURIComponent(pomName)}`
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableFunctions(data.functions || []);
        console.log(`📦 TruthySection: Loaded ${data.functions?.length || 0} functions from ${pomName}`);
      }
    } catch (error) {
      console.error('Failed to fetch POM functions:', error);
    }
  };

  const handleAdd = () => {
    if (!newFunc || truthy.includes(newFunc)) return;
    onChange([...truthy, newFunc]);
    setNewFunc('');
    setIsAdding(false);
  };

  const handleRemove = (func) => {
    onChange(truthy.filter(f => f !== func));
  };

  // Filter out already-used functions
  const availableForSelection = availableFunctions.filter(f => !truthy.includes(f));

  return (
    <div className="p-3 rounded" style={{ background: `${color}10`, border: `1px solid ${color}40` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color }}>✓ Truthy ({truthy.length})</div>
        {editMode && !isAdding && (
          <button onClick={() => setIsAdding(true)} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: color, color: 'white' }}>➕ Add</button>
        )}
      </div>
      <div className="space-y-1">
        {truthy.map((func, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm font-mono p-2 rounded" style={{ background: `${color}20` }}>
            <span>{func}() → truthy</span>
            {editMode && <button onClick={() => handleRemove(func)} className="text-red-500">✕</button>}
          </div>
        ))}
        {isAdding && (
          <div className="flex gap-2 mt-2">
            {/* ✅ FIXED: Use dropdown instead of text input */}
            {availableFunctions.length > 0 ? (
              <select
                value={newFunc}
                onChange={(e) => setNewFunc(e.target.value)}
                className="flex-1 px-2 py-1 rounded border text-sm font-mono"
                style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }}
              >
                <option value="">Select function...</option>
                {availableForSelection.map(fn => (
                  <option key={fn} value={fn}>{fn}()</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={newFunc}
                onChange={(e) => setNewFunc(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Function name..."
                className="flex-1 px-2 py-1 rounded text-sm font-mono"
                style={{ background: theme.colors.background.primary, border: `1px solid ${theme.colors.border}`, color: theme.colors.text.primary }}
                autoFocus
              />
            )}
            <button 
              onClick={handleAdd} 
              disabled={!newFunc}
              className="px-3 py-1 rounded text-sm font-semibold disabled:opacity-50" 
              style={{ background: color, color: 'white' }}
            >
              Add
            </button>
            <button onClick={() => { setIsAdding(false); setNewFunc(''); }} className="px-3 py-1 rounded text-sm" style={{ background: theme.colors.background.tertiary }}>Cancel</button>
          </div>
        )}
      </div>
      {truthy.length === 0 && !isAdding && (
        <div className="text-center py-2 text-sm" style={{ color: theme.colors.text.tertiary }}>No truthy checks</div>
      )}
    </div>
  );
}

// ============================================
// ✅ FIXED: FalsySection with Function Dropdown
// ============================================
function FalsySection({ falsy = [], editMode, pomName, projectPath, onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const [availableFunctions, setAvailableFunctions] = useState([]);
  const [newFunc, setNewFunc] = useState('');
  const color = theme.colors.accents.red;

  // ✅ Fetch available functions from POM
  useEffect(() => {
    if (pomName && projectPath && editMode) {
      fetchPOMFunctions();
    }
  }, [pomName, projectPath, editMode]);

  const fetchPOMFunctions = async () => {
    try {
      const response = await fetch(
        `/api/poms/functions?projectPath=${encodeURIComponent(projectPath)}&pomName=${encodeURIComponent(pomName)}`
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableFunctions(data.functions || []);
        console.log(`📦 FalsySection: Loaded ${data.functions?.length || 0} functions from ${pomName}`);
      }
    } catch (error) {
      console.error('Failed to fetch POM functions:', error);
    }
  };

  const handleAdd = () => {
    if (!newFunc || falsy.includes(newFunc)) return;
    onChange([...falsy, newFunc]);
    setNewFunc('');
    setIsAdding(false);
  };

  const handleRemove = (func) => {
    onChange(falsy.filter(f => f !== func));
  };

  // Filter out already-used functions
  const availableForSelection = availableFunctions.filter(f => !falsy.includes(f));

  return (
    <div className="p-3 rounded" style={{ background: `${color}10`, border: `1px solid ${color}40` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color }}>✗ Falsy ({falsy.length})</div>
        {editMode && !isAdding && (
          <button onClick={() => setIsAdding(true)} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: color, color: 'white' }}>➕ Add</button>
        )}
      </div>
      <div className="space-y-1">
        {falsy.map((func, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm font-mono p-2 rounded" style={{ background: `${color}20` }}>
            <span>{func}() → falsy</span>
            {editMode && <button onClick={() => handleRemove(func)} className="text-red-500">✕</button>}
          </div>
        ))}
        {isAdding && (
          <div className="flex gap-2 mt-2">
            {/* ✅ FIXED: Use dropdown instead of text input */}
            {availableFunctions.length > 0 ? (
              <select
                value={newFunc}
                onChange={(e) => setNewFunc(e.target.value)}
                className="flex-1 px-2 py-1 rounded border text-sm font-mono"
                style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }}
              >
                <option value="">Select function...</option>
                {availableForSelection.map(fn => (
                  <option key={fn} value={fn}>{fn}()</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={newFunc}
                onChange={(e) => setNewFunc(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Function name..."
                className="flex-1 px-2 py-1 rounded text-sm font-mono"
                style={{ background: theme.colors.background.primary, border: `1px solid ${theme.colors.border}`, color: theme.colors.text.primary }}
                autoFocus
              />
            )}
            <button 
              onClick={handleAdd}
              disabled={!newFunc}
              className="px-3 py-1 rounded text-sm font-semibold disabled:opacity-50" 
              style={{ background: color, color: 'white' }}
            >
              Add
            </button>
            <button onClick={() => { setIsAdding(false); setNewFunc(''); }} className="px-3 py-1 rounded text-sm" style={{ background: theme.colors.background.tertiary }}>Cancel</button>
          </div>
        )}
      </div>
      {falsy.length === 0 && !isAdding && (
        <div className="text-center py-2 text-sm" style={{ color: theme.colors.text.tertiary }}>No falsy checks</div>
      )}
    </div>
  );
}
// Assertion types constant
const ASSERTION_TYPES = [
  { value: 'toBe', label: '=', needsValue: true },
  { value: 'toEqual', label: 'equals', needsValue: true },
  { value: 'toBeGreaterThan', label: '>', needsValue: true },
  { value: 'toBeGreaterThanOrEqual', label: '>=', needsValue: true },
  { value: 'toBeLessThan', label: '<', needsValue: true },
  { value: 'toBeLessThanOrEqual', label: '<=', needsValue: true },
  { value: 'toContain', label: 'contains', needsValue: true },
  { value: 'toMatch', label: 'matches', needsValue: true },
  { value: 'toHaveLength', label: 'length', needsValue: true },
  { value: 'toBeTruthy', label: 'truthy', needsValue: false },
  { value: 'toBeFalsy', label: 'falsy', needsValue: false },
  { value: 'toBeDefined', label: 'defined', needsValue: false },
  { value: 'toBeNull', label: 'null', needsValue: false },
];

function AssertionsSection({ assertions = [], editMode, pomName, projectPath, storedVariables = [], onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const [availableItems, setAvailableItems] = useState({ methods: [], locators: [] });
  const [newAssertion, setNewAssertion] = useState({ 
    fn: '', 
    type: 'method',  // ← NEW: 'method' or 'locator'
    expect: 'toBe', 
    value: '', 
    useVariable: false,
    storeAs: '',
    persistStoreAs: true
  });
  const color = theme.colors.accents.yellow;
  useEffect(() => {
    if (pomName && projectPath) {
      fetchPOMItems();
    }
  }, [pomName, projectPath]);

const fetchPOMItems = async () => {
  try {
    const response = await fetch(
      `/api/poms/functions?projectPath=${encodeURIComponent(projectPath)}&pomName=${encodeURIComponent(pomName)}`
    );
    if (response.ok) {
      const data = await response.json();
      console.log('🔍 API returned:', data);  // ← ADD THIS
      console.log('   Methods:', data.methods?.length || 0);
      console.log('   Locators:', data.locators?.length || 0);
      setAvailableItems({
        methods: data.methods || [],
        locators: data.locators || []
      });
    }
  } catch (error) {
    console.error('Failed to fetch POM items:', error);
  }
};

  const handleAdd = () => {
    if (!newAssertion.fn) return;
    const selectedType = ASSERTION_TYPES.find(t => t.value === newAssertion.expect);
    
    let valueToStore = newAssertion.value;
    
    if (newAssertion.useVariable && newAssertion.value) {
      valueToStore = `{{${newAssertion.value}}}`;
    } else if (selectedType?.needsValue && !isNaN(Number(newAssertion.value))) {
      valueToStore = Number(newAssertion.value);
    }
    
    const assertionToAdd = {
      fn: newAssertion.fn,
      type: newAssertion.type,  // ← SAVE THE TYPE!
      expect: newAssertion.expect,
      ...(selectedType?.needsValue ? { value: valueToStore } : {}),
      ...(newAssertion.storeAs.trim() && { 
        storeAs: newAssertion.storeAs.trim(),
        persistStoreAs: newAssertion.persistStoreAs
      })
    };
    
    onChange([...assertions, assertionToAdd]);
    setNewAssertion({ fn: '', type: 'method', expect: 'toBe', value: '', useVariable: false, storeAs: '', persistStoreAs: true });
    setIsAdding(false);
  };

  const handleRemove = (idx) => {
    onChange(assertions.filter((_, i) => i !== idx));
  };

  const handleUpdateStoreAs = (idx, newStoreAsValue) => {
    const updated = [...assertions];
    if (newStoreAsValue.trim()) {
      updated[idx] = { ...updated[idx], storeAs: newStoreAsValue.trim() };
    } else {
      const { storeAs, persistStoreAs, ...rest } = updated[idx];
      updated[idx] = rest;
    }
    onChange(updated);
  };

  // ✅ NEW: Update persistStoreAs for existing assertion
  const handleUpdatePersistStoreAs = (idx, persist) => {
    const updated = [...assertions];
    updated[idx] = { ...updated[idx], persistStoreAs: persist };
    onChange(updated);
  };

  const getAssertionLabel = (assertion) => {
    const type = ASSERTION_TYPES.find(t => t.value === assertion.expect);
    if (type?.needsValue) {
      const valueDisplay = typeof assertion.value === 'string' && assertion.value.includes('{{')
        ? <code className="px-1 py-0.5 rounded text-xs" style={{ background: `${theme.colors.accents.purple}30`, color: theme.colors.accents.purple }}>{assertion.value}</code>
        : assertion.value;
      return <>{assertion.fn}() {type.label} {valueDisplay}</>;
    }
    return `${assertion.fn}() is ${type?.label || assertion.expect}`;
  };

  
  const selectedType = ASSERTION_TYPES.find(t => t.value === newAssertion.expect);

return (
    <div className="p-3 rounded" style={{ background: `${color}10`, border: `1px solid ${color}40` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color }}>
          🔍 Assertions ({assertions.length})
        </div>
        {editMode && !isAdding && (
          <button 
            onClick={() => setIsAdding(true)} 
            className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110" 
            style={{ background: color, color: 'white' }}
          >
            ➕ Add
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {/* Existing assertions display - add type indicator */}
        {assertions.map((assertion, idx) => (
          <div key={idx} className="p-2 rounded text-sm" style={{ background: `${color}20` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Type badge */}
                <span 
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                  style={{ 
                    background: assertion.type === 'locator' 
                      ? `${theme.colors.accents.blue}30` 
                      : `${theme.colors.accents.purple}30`,
                    color: assertion.type === 'locator' 
                      ? theme.colors.accents.blue 
                      : theme.colors.accents.purple
                  }}
                >
                  {assertion.type === 'locator' ? '📍' : 'ƒ'}
                </span>
                <span className="font-mono">{getAssertionLabel(assertion)}</span>
              </div>
              {editMode && (
                <button onClick={() => handleRemove(idx)} className="text-red-400 hover:text-red-300">✕</button>
              )}
            </div>
            
            {/* ✅ ENHANCED: StoreAs with persistence toggle */}
            {assertion.storeAs ? (
              <div className="flex items-center gap-2 mt-2 ml-2 flex-wrap">
                <span className="text-xs" style={{ color: theme.colors.accents.green }}>💾</span>
                {editMode ? (
                  <>
                    <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>ctx.</span>
                    <input
                      type="text"
                      value={assertion.storeAs}
                      onChange={(e) => handleUpdateStoreAs(idx, e.target.value)}
                      className="px-2 py-0.5 rounded text-xs font-mono"
                      style={{ 
                        background: theme.colors.background.primary, 
                        border: `1px solid ${theme.colors.accents.green}`,
                        color: theme.colors.accents.green,
                        width: '120px'
                      }}
                    />
                    {/* ✅ NEW: Persistence toggle for existing */}
                    <label 
                      className="flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded text-[10px]"
                      style={{ 
                        background: assertion.persistStoreAs !== false 
                          ? `${theme.colors.accents.green}20` 
                          : theme.colors.background.tertiary,
                        color: assertion.persistStoreAs !== false 
                          ? theme.colors.accents.green 
                          : theme.colors.text.tertiary,
                        border: `1px solid ${assertion.persistStoreAs !== false 
                          ? theme.colors.accents.green 
                          : theme.colors.border}`
                      }}
                      title={assertion.persistStoreAs !== false 
                        ? 'Persists to ctx.data' 
                        : 'Current test only'}
                    >
                      <input
                        type="checkbox"
                        checked={assertion.persistStoreAs !== false}
                        onChange={(e) => handleUpdatePersistStoreAs(idx, e.target.checked)}
                        className="w-3 h-3"
                      />
                      persist
                    </label>
                    <button
                      onClick={() => handleUpdateStoreAs(idx, '')}
                      className="text-xs hover:text-red-400"
                      style={{ color: theme.colors.text.tertiary }}
                      title="Remove storeAs"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <code 
                      className="px-2 py-0.5 rounded text-xs font-mono"
                      style={{ background: `${theme.colors.accents.green}20`, color: theme.colors.accents.green }}
                    >
                      → ctx.{assertion.storeAs}
                    </code>
                    {/* ✅ Show persistence indicator */}
                    {assertion.persistStoreAs !== false ? (
                      <span 
                        className="text-[10px] px-1.5 py-0.5 rounded" 
                        style={{ background: `${theme.colors.accents.green}20`, color: theme.colors.accents.green }}
                        title="Persists to ctx.data"
                      >
                        💾
                      </span>
                    ) : (
                      <span 
                        className="text-[10px] px-1.5 py-0.5 rounded" 
                        style={{ background: theme.colors.background.tertiary, color: theme.colors.text.tertiary }}
                        title="Current test only"
                      >
                        ⚡
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : editMode && (
              <button
                onClick={() => handleUpdateStoreAs(idx, `${assertion.fn}Result`)}
                className="mt-2 ml-2 px-2 py-0.5 rounded text-[10px] transition hover:brightness-110"
                style={{ background: `${theme.colors.accents.green}20`, color: theme.colors.accents.green }}
              >
                💾 + storeAs
              </button>
            )}
          </div>
        ))}
        
        {isAdding && (
          <div className="space-y-2 p-2 rounded" style={{ background: `${color}15` }}>
            {/* ✅ FIXED: Categorized dropdown with optgroup */}
            <div className="flex gap-2 items-center">
              <select
                value={newAssertion.fn}
                onChange={(e) => {
                  const selected = e.target.value;
                  // Find which type it is
                  const isLocator = availableItems.locators.some(l => l.name === selected);
                  setNewAssertion({ 
                    ...newAssertion, 
                    fn: selected,
                    type: isLocator ? 'locator' : 'method'
                  });
                }}
                className="flex-1 px-2 py-1 rounded border text-sm font-mono"
                style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }}
              >
                <option value="">Select...</option>
                
                {availableItems.locators?.length > 0 && (
                  <optgroup label="📍 Locators (getters)">
                    {availableItems.locators.map(item => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                
                {availableItems.methods?.length > 0 && (
                  <optgroup label="ƒ Methods (functions)">
                    {availableItems.methods.map(item => (
                      <option key={item.name} value={item.name}>
                        {item.signature}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              
              {/* Show selected type indicator */}
              {newAssertion.fn && (
                <span 
                  className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                  style={{ 
                    background: newAssertion.type === 'locator' 
                      ? `${theme.colors.accents.blue}30` 
                      : `${theme.colors.accents.purple}30`,
                    color: newAssertion.type === 'locator' 
                      ? theme.colors.accents.blue 
                      : theme.colors.accents.purple
                  }}
                >
                  {newAssertion.type === 'locator' ? '📍 locator' : 'ƒ method'}
                </span>
              )}
              
              {/* Assertion type */}
              <select
                value={newAssertion.expect}
                onChange={(e) => setNewAssertion({ ...newAssertion, expect: e.target.value })}
                className="w-28 px-2 py-1 rounded border text-sm"
                style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }}
              >
                {ASSERTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            
            {/* Value input (if needed) */}
            {selectedType?.needsValue && (
              <div className="space-y-2">
                {/* Toggle: literal value vs stored variable */}
                <div className="flex items-center gap-2">
                  <label className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: theme.colors.text.secondary }}>
                    <input
                      type="checkbox"
                      checked={newAssertion.useVariable}
                      onChange={(e) => setNewAssertion({ ...newAssertion, useVariable: e.target.checked, value: '' })}
                      className="rounded"
                    />
                    Use stored variable
                  </label>
                </div>
                
                {newAssertion.useVariable ? (
                  /* Stored variable dropdown */
                  <div className="flex gap-2 items-center">
                    <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'{{'}</span>
                    <select
                      value={newAssertion.value}
                      onChange={(e) => setNewAssertion({ ...newAssertion, value: e.target.value })}
                      className="flex-1 px-2 py-1 rounded border text-sm font-mono"
                      style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.accents.purple }}
                    >
                      <option value="">Select variable...</option>
                      {storedVariables.map(v => (
                        <option key={v.name} value={v.path}>{v.path}</option>
                      ))}
                    </select>
                    <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'}}'}</span>
                  </div>
                ) : (
                  /* Literal value input */
                  <input
                    type="text"
                    value={newAssertion.value}
                    onChange={(e) => setNewAssertion({ ...newAssertion, value: e.target.value })}
                    placeholder="Expected value..."
                    className="w-full px-2 py-1 rounded border text-sm"
                    style={{ background: theme.colors.background.primary, borderColor: theme.colors.border, color: theme.colors.text.primary }}
                  />
                )}
              </div>
            )}
            
            {/* ✅ ENHANCED: StoreAs input with persistence toggle */}
            <div 
              className="p-2 rounded space-y-2"
              style={{ 
                background: `${theme.colors.accents.green}10`,
                border: `1px dashed ${theme.colors.accents.green}40`
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: theme.colors.accents.green }}>
                  💾 Store result as variable (optional)
                </span>
                {/* ✅ NEW: Persistence toggle */}
                {newAssertion.storeAs.trim() && (
                  <label 
                    className="flex items-center gap-1.5 text-xs cursor-pointer px-2 py-0.5 rounded"
                    style={{ 
                      background: newAssertion.persistStoreAs 
                        ? `${theme.colors.accents.green}20` 
                        : theme.colors.background.tertiary,
                      color: newAssertion.persistStoreAs 
                        ? theme.colors.accents.green 
                        : theme.colors.text.tertiary,
                      border: `1px solid ${newAssertion.persistStoreAs 
                        ? theme.colors.accents.green 
                        : theme.colors.border}`
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newAssertion.persistStoreAs}
                      onChange={(e) => setNewAssertion({ ...newAssertion, persistStoreAs: e.target.checked })}
                      className="w-3 h-3"
                    />
                    Persist to ctx.data
                  </label>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono" style={{ color: theme.colors.text.tertiary }}>ctx.</span>
                <input
                  type="text"
                  value={newAssertion.storeAs}
                  onChange={(e) => setNewAssertion({ ...newAssertion, storeAs: e.target.value.replace(/\s/g, '') })}
                  placeholder="variableName"
                  className="flex-1 px-2 py-1 rounded text-sm font-mono"
                  style={{ 
                    background: theme.colors.background.primary, 
                    border: `1px solid ${newAssertion.storeAs ? theme.colors.accents.green : theme.colors.border}`, 
                    color: theme.colors.accents.green 
                  }}
                />
              </div>
              
              {/* ✅ NEW: Helper text showing persistence behavior */}
              {newAssertion.storeAs.trim() && (
                <div className="text-[10px] flex items-center gap-1" style={{ color: theme.colors.text.tertiary }}>
                  {newAssertion.persistStoreAs ? (
                    <>
                      <span style={{ color: theme.colors.accents.green }}>💾</span>
                      <span>Value will be saved to ctx.data (persists across tests)</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Value available in current test only (faster, no file write)</span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Helper text */}
            <div className="text-xs" style={{ color: theme.colors.text.tertiary }}>
              💡 Use stored variables like <code className="px-1 rounded" style={{ background: theme.colors.background.tertiary }}>{`{{flightData.price}}`}</code> from transition actions
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={handleAdd}
                disabled={!newAssertion.fn}
                className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110 disabled:opacity-50"
                style={{ background: color, color: 'white' }}
              >
                Add
              </button>
              <button 
                onClick={() => { setIsAdding(false); setNewAssertion({ fn: '', type: 'method', expect: 'toBe', value: '', useVariable: false, storeAs: '', persistStoreAs: true }); }}
                className="px-3 py-1 rounded text-sm"
                style={{ background: theme.colors.background.tertiary, color: theme.colors.text.secondary }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {assertions.length === 0 && !isAdding && (
          <div className="text-center py-2 text-sm" style={{ color: theme.colors.text.tertiary }}>No assertions</div>
        )}
      </div>
    </div>
  );
}