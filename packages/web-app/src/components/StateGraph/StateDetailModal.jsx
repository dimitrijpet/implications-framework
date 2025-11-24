// packages/web-app/src/components/StateGraph/StateDetailModal.jsx
// ✨ ENHANCED VERSION v2.0 - Full Transition Edit Support
// Changes: Replaced simple prompts with full AddTransitionModal for editing

import { useEffect, useState } from 'react';
import { getStatusIcon, getStatusColor, getPlatformStyle, defaultTheme } from '../../config/visualizerTheme';
import SuggestionsPanel from '../SuggestionsPanel/SuggestionsPanel';
import { useSuggestions } from '../../hooks/useSuggestions';
import UIScreenEditor from '../UIScreenEditor/UIScreenEditor';
import DynamicContextFields from '../DynamicContextFields/DynamicContextFields';
import GenerateTestsButton from '../GenerateTestsButton/GenerateTestsButton';
import AddTransitionModal from '../AddTransitionModal/AddTransitionModal'; // ✅ NEW IMPORT

function transformPlatformsData(platforms) {
  if (!platforms) return { UI: {} };
  
  const transformed = { UI: {} };
  
  Object.entries(platforms).forEach(([platformName, platformData]) => {
    transformed.UI[platformName] = {};
    
    if (platformData.screens && Array.isArray(platformData.screens)) {
      platformData.screens.forEach(screen => {
        transformed.UI[platformName][screen.name] = [screen];
      });
    } else {
      transformed.UI[platformName] = platformData;
    }
  });
  
  return transformed;
}

export default function StateDetailModal({ state, onClose, theme = defaultTheme, projectPath, discoveryResult, }) {
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedState, setEditedState] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Context state
  const [contextData, setContextData] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextChanges, setContextChanges] = useState({});
  
  // Context field suggestions
  const [suggestedFields, setSuggestedFields] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // ✅ NEW: Transition modal state
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionMode, setTransitionMode] = useState('create'); // 'create' | 'edit'
  const [editingTransition, setEditingTransition] = useState(null);
  const [editingTransitionIndex, setEditingTransitionIndex] = useState(null);
  
  // Get suggestions for metadata
  const { analysis, loading: suggestionsLoading } = useSuggestions(projectPath);

  useEffect(() => {
    if (state) {
      setEditedState(JSON.parse(JSON.stringify(state)));
    }
  }, [state]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (hasChanges) {
          if (window.confirm('You have unsaved changes. Close anyway?')) {
            setIsEditMode(false);
            setHasChanges(false);
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, hasChanges]);

  // Load context data when modal opens
  useEffect(() => {
    if (state?.files?.implication) {
      loadContextData();
    }
  }, [state?.files?.implication]);

  // Load mirrorsOn suggestions when edit mode is enabled
  useEffect(() => {
    if (state?.files?.implication && isEditMode) {
      loadMirrorsOnSuggestions();
    }
  }, [state?.files?.implication, isEditMode]);

  if (!state) return null;
  
  const currentState = isEditMode ? editedState : state;
  if (!currentState) return null;
  
  const statusColor = getStatusColor(currentState.name, theme);
  const statusIcon = getStatusIcon(currentState.name, theme);
  const platformStyle = getPlatformStyle(currentState.meta?.platform, theme);

  // ========================================
  // CONTEXT HANDLERS
  // ========================================

  const loadContextData = async () => {
    setLoadingContext(true);
    try {
      const response = await fetch(
        `http://localhost:3000/api/implications/context-schema?filePath=${encodeURIComponent(state.files.implication)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Loaded context data:', data.context);
        setContextData(data.context);
      } else {
        console.error('Failed to load context:', await response.text());
        setContextData({});
      }
    } catch (error) {
      console.error('❌ Error loading context:', error);
      setContextData({});
    } finally {
      setLoadingContext(false);
    }
  };

  const loadMirrorsOnSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const response = await fetch(
        `http://localhost:3000/api/implications/extract-mirrorson-variables?filePath=${encodeURIComponent(state.files.implication)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('💡 Loaded mirrorsOn suggestions:', data.missingFromContext);
        setSuggestedFields(data.missingFromContext || []);
      } else {
        console.error('Failed to load suggestions:', await response.text());
        setSuggestedFields([]);
      }
    } catch (error) {
      console.error('❌ Error loading suggestions:', error);
      setSuggestedFields([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleContextChange = (fieldName, newValue) => {
    console.log('📝 handleContextChange:', fieldName, newValue);
    
    setContextData(prev => ({
      ...prev,
      [fieldName]: newValue
    }));
    
    setContextChanges(prev => ({
      ...prev,
      [fieldName]: newValue
    }));
    
    setHasChanges(true);
  };

  const handleAddContextField = async (fieldName, initialValue, fieldType) => {
    console.log('➕ Adding context field:', { fieldName, initialValue, fieldType });
    
    try {
      const response = await fetch('http://localhost:3000/api/implications/add-context-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.files.implication,
          fieldName,
          initialValue,
          fieldType
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add field');
      }

      const result = await response.json();
      console.log('✅ Field added:', result);

      await loadContextData();
      await loadMirrorsOnSuggestions();

      alert(`✅ Added field "${fieldName}" to context!`);
      
    } catch (error) {
      console.error('❌ Error adding field:', error);
      alert(`❌ Failed to add field: ${error.message}`);
    }
  };

  const handleDeleteContextField = async (fieldName) => {
    console.log('🗑️ Deleting context field:', fieldName);
    
    try {
      const response = await fetch('http://localhost:3000/api/implications/delete-context-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.files.implication,
          fieldName
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete field');
      }

      const result = await response.json();
      console.log('✅ Field deleted:', result);

      setContextData(prev => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
      
      setContextChanges(prev => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });

      await loadMirrorsOnSuggestions();

      alert(`✅ Deleted field "${fieldName}" from context!`);
      
    } catch (error) {
      console.error('❌ Error deleting field:', error);
      alert(`❌ Failed to delete field: ${error.message}`);
    }
  };

  // ========================================
  // EDIT MODE HANDLERS
  // ========================================

  const handleEditToggle = () => {
    if (isEditMode) {
      if (hasChanges) {
        if (!window.confirm('You have unsaved changes. Discard them?')) {
          return;
        }
      }
      setEditedState(JSON.parse(JSON.stringify(state)));
      setContextChanges({});
      setHasChanges(false);
    } else {
      if (!editedState) {
        setEditedState(JSON.parse(JSON.stringify(state)));
      }
    }
    setIsEditMode(!isEditMode);
  };

  const handleMetadataChange = (field, value) => {
    setEditedState(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  // ========================================
  // ✅ ENHANCED TRANSITION HANDLERS
  // ========================================

  const handleAddTransition = () => {
    // ✅ Open full modal in create mode
    setTransitionMode('create');
    setEditingTransition(null);
    setEditingTransitionIndex(null);
    setShowTransitionModal(true);
  };

const handleEditTransition = async (transition, index) => {
  console.log('✏️ Editing transition:', transition);
  
  try {
    console.log('📡 Fetching full transition data...');
    
    const response = await fetch(
      `http://localhost:3000/api/implications/get-transition?` + 
      `filePath=${encodeURIComponent(state.files.implication)}&` +
      `event=${encodeURIComponent(transition.event)}`
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Full transition data:', data.transition);
      
      // ✅ FIX: Build COMPLETE data object BEFORE setting state
      const fullTransitionData = {
        event: transition.event,
        target: data.transition.target || transition.target,
        platforms: data.transition.platforms,        // ← From API
        actionDetails: data.transition.actionDetails // ← From API
      };
      
      console.log('📦 Setting editingTransition:', fullTransitionData);
      
      // ✅ Set ALL state in correct order
      setTransitionMode('edit');
      setEditingTransition(fullTransitionData);  // Full data!
      setEditingTransitionIndex(index);
      setShowTransitionModal(true);  // Open modal LAST
      
    } else {
      console.warn('⚠️ Could not fetch full data, using basic transition');
      setTransitionMode('edit');
      setEditingTransition(transition);
      setEditingTransitionIndex(index);
      setShowTransitionModal(true);
    }
  } catch (error) {
    console.error('❌ Error fetching transition:', error);
    setTransitionMode('edit');
    setEditingTransition(transition);
    setEditingTransitionIndex(index);
    setShowTransitionModal(true);
  }
};

  const handleRemoveTransition = async (index) => {
    const transition = currentState.transitions[index];
    
    if (!window.confirm(`Delete transition "${transition.event}"?`)) {
      return;
    }

    console.log('🗑️ Deleting transition:', transition);

    try {
      const response = await fetch('http://localhost:3000/api/implications/delete-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFile: state.files.implication,
          event: transition.event
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete transition');
      }

      console.log('✅ Transition deleted from file');

      // Update local state
      setEditedState(prev => ({
        ...prev,
        transitions: prev.transitions.filter((_, i) => i !== index)
      }));
      
      setHasChanges(true);

      // Refresh discovery
      if (window.refreshDiscovery) {
        console.log('🔄 Refreshing discovery...');
        await window.refreshDiscovery();
      }

      alert('✅ Transition deleted successfully!');

    } catch (error) {
      console.error('❌ Delete failed:', error);
      alert(`❌ Failed to delete transition: ${error.message}`);
    }
  };

  // ✅ NEW: Handle transition modal submit
  const handleTransitionSubmit = async (transitionData) => {
    console.log('💾 Saving transition:', transitionMode, transitionData);

    try {
      if (transitionMode === 'create') {
        // ✅ CREATE MODE: Use add-transition endpoint
        // Note: This is called from visualizer, not from detail modal
        // So we shouldn't reach here. But keeping for safety.
        console.warn('⚠️ Create mode called from detail modal - should use visualizer');
        alert('Please use the graph to create transitions');
        return;
        
      } else {
        // ✅ EDIT MODE: Use update-transition endpoint
        const response = await fetch('http://localhost:3000/api/implications/update-transition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceFile: state.files.implication,
            oldEvent: editingTransition.event,
            newEvent: transitionData.event,
            newTarget: transitionData.target || editingTransition.target,
            platform: transitionData.platform,
            actionDetails: transitionData.actionDetails
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update transition');
        }

        console.log('✅ Transition updated in file');

        // Update local state
        setEditedState(prev => ({
          ...prev,
          transitions: prev.transitions.map((t, i) => 
            i === editingTransitionIndex 
              ? {
                  event: transitionData.event,
                  target: transitionData.target || editingTransition.target,
                  platform: transitionData.platform,
                  actionDetails: transitionData.actionDetails
                }
              : t
          )
        }));
        
        setHasChanges(true);

        // Refresh discovery
        if (window.refreshDiscovery) {
          console.log('🔄 Refreshing discovery...');
          await window.refreshDiscovery();
        }

        alert('✅ Transition updated successfully!');
      }

      setShowTransitionModal(false);

    } catch (error) {
      console.error('❌ Save failed:', error);
      alert(`❌ Failed to save transition: ${error.message}`);
    }
  };

  // ========================================
  // SUGGESTION HANDLERS
  // ========================================

  const handleSuggestionApply = (actionType, value) => {
    console.log('🎯 Suggestion apply:', actionType, value);
    
    switch(actionType) {
      case 'triggerButton':
        handleMetadataChange('triggerButton', value);
        break;
      case 'addField':
        const currentFields = editedState.meta.requiredFields || [];
        if (!currentFields.includes(value)) {
          handleMetadataChange('requiredFields', [...currentFields, value]);
        }
        break;
      case 'addAllFields':
        const existingFields = editedState.meta.requiredFields || [];
        const newFields = [...new Set([...existingFields, ...value])];
        handleMetadataChange('requiredFields', newFields);
        break;
      case 'addSetup':
        const currentSetup = editedState.meta.setup || [];
        if (!currentSetup.includes(value)) {
          handleMetadataChange('setup', [...currentSetup, value]);
        }
        break;
      case 'addAllSetup':
        handleMetadataChange('setup', value);
        break;
      default:
        console.warn('Unknown action type:', actionType);
    }
  };

const handleSave = async () => {
  setIsSaving(true);
  
  try {
    console.log('💾 Starting save process...');
    console.log('📦 Context changes to save:', contextChanges);
    
    // ✅ FIXED: Only check metadata changes, NOT transitions
    // Transitions are handled separately via dedicated modals/endpoints
    const hasMetadataChanges = JSON.stringify(editedState.meta) !== JSON.stringify(state.meta);
    
    // ✅ REMOVED: Don't compare transitions here anymore
    // const hasTransitionChanges = JSON.stringify(editedState.transitions) !== JSON.stringify(state.transitions);
    
    // 1. Save metadata (ONLY if changed)
    if (hasMetadataChanges) {
      console.log('1️⃣ Saving metadata changes...');
      const metadataResponse = await fetch('http://localhost:3000/api/implications/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.files.implication,
          metadata: editedState.meta
          // ✅ REMOVED: transitions: editedState.transitions
          // Transitions should NEVER be sent to update-metadata!
          // They are managed via /add-transition, /update-transition, /delete-transition
        })
      });

      if (!metadataResponse.ok) {
        const result = await metadataResponse.json();
        throw new Error(result.error || 'Failed to save metadata');
      }
      
      console.log('✅ Metadata saved');
    } else {
      console.log('⏭️ No metadata changes, skipping metadata save');
    }
    
    // 2. Save context changes (if any)
    if (Object.keys(contextChanges).length > 0) {
      console.log('2️⃣ Saving context changes...');
      
      const contextResponse = await fetch('http://localhost:3000/api/implications/update-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.files.implication,
          contextUpdates: contextChanges
        })
      });
      
      if (!contextResponse.ok) {
        const result = await contextResponse.json();
        throw new Error(result.error || 'Failed to save context');
      }
      
      console.log('✅ Context saved');
    } else {
      console.log('⏭️ No context changes, skipping context save');
    }
    
    // Check if anything was actually saved
    if (!hasMetadataChanges && Object.keys(contextChanges).length === 0) {
      alert('ℹ️ No changes to save');
      setIsSaving(false);
      return;
    }
      
    // Success!
    alert('✅ Changes saved successfully!');
    setHasChanges(false);
    setIsEditMode(false);
    setContextChanges({});
    
    // Reload to show updated data
    window.location.reload();
    
  } catch (error) {
    console.error('❌ Save failed:', error);
    alert(`❌ Save failed: ${error.message}`);
  } finally {
    setIsSaving(false);
  }
};

  // ========================================
  // UI EDITOR HANDLERS
  // ========================================

  const handleUIUpdate = async (uiData) => {
    console.log('💾 handleUIUpdate received:', uiData);
    
    try {
      const response = await fetch('http://localhost:3000/api/implications/update-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.files.implication,
          uiData: uiData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update UI');
      }

      console.log('✅ UI updated successfully');
      alert('✅ UI screens updated!');
      
      if (window.refreshDiscovery) {
        await window.refreshDiscovery();
      }
      
    } catch (error) {
      console.error('❌ UI update failed:', error);
      alert(`❌ Failed to update UI: ${error.message}`);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('Discard unsaved changes?')) {
        setEditedState(JSON.parse(JSON.stringify(state)));
        setContextChanges({});
        setHasChanges(false);
        setIsEditMode(false);
      }
    } else {
      setIsEditMode(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
          style={{
            backgroundColor: theme.colors.background.primary,
            border: `2px solid ${statusColor}`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 px-6 py-4 border-b backdrop-blur-sm"
            style={{
              backgroundColor: `${theme.colors.background.primary}f0`,
              borderColor: statusColor
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{statusIcon}</span>
                <div>
                  <h2
                    className="text-2xl font-bold"
                    style={{ color: statusColor }}
                  >
                    {currentState.name}
                  </h2>
                  {currentState.meta?.status && (
                    <p
                      className="text-sm"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Status: {currentState.meta.status}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!isEditMode ? (
                  <button
                    onClick={handleEditToggle}
                    className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                    style={{
                      background: theme.colors.accents.blue,
                      color: 'white'
                    }}
                  >
                    ✏️ Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={!hasChanges || isSaving}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                      style={{
                        background: hasChanges ? theme.colors.accents.green : theme.colors.background.tertiary,
                        color: 'white',
                        opacity: (!hasChanges || isSaving) ? 0.5 : 1
                      }}
                    >
                      {isSaving ? '⏳ Saving...' : '💾 Save'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                      style={{
                        background: theme.colors.accents.red,
                        color: 'white',
                        opacity: isSaving ? 0.5 : 1
                      }}
                    >
                      ✕ Cancel
                    </button>
                  </>
                )}
                
                <button
                  onClick={onClose}
                  className="text-3xl font-bold px-3 py-1 rounded-lg transition"
                  style={{
                    color: theme.colors.accents.red,
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.accents.red}20`}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Metadata Section */}
            {currentState.meta && Object.keys(currentState.meta).length > 0 && (
              <div>
                <h2
                  className="text-2xl font-bold mb-4"
                  style={{ color: theme.colors.accents.purple }}
                >
                  📊 Metadata
                </h2>
                
                {(() => {
                  const groups = categorizeFields(currentState.meta);
                  
                  return Object.entries(groups).map(([groupName, fields]) => (
                    <div key={groupName} className="mb-4">
                      <h3
                        className="text-lg font-semibold mb-2"
                        style={{ color: theme.colors.text.secondary }}
                      >
                        {groupName}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {fields.map(([key, value]) => (
                          <MetadataField
                            key={key}
                            fieldName={key}
                            value={value}
                            theme={theme}
                            platformStyle={platformStyle}
                            canEdit={isEditMode}
                            onSave={(newValue) => handleMetadataChange(key, newValue)}
                          />
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Context Section */}
            {contextData && (
              <div>
                <h2
                  className="text-2xl font-bold mb-4"
                  style={{ color: theme.colors.accents.yellow }}
                >
                  🔧 Context Data
                </h2>
                
                {loadingContext ? (
                  <p style={{ color: theme.colors.text.secondary }}>Loading...</p>
                ) : Object.keys(contextData).length === 0 ? (
                  <p style={{ color: theme.colors.text.secondary }}>No context fields defined</p>
                ) : (
                  <DynamicContextFields
                    contextData={contextData}
                    onChange={handleContextChange}
                    onAddField={handleAddContextField}
                    onDeleteField={handleDeleteContextField}
                    suggestedFields={suggestedFields}
                    isEditMode={isEditMode}
                    theme={theme}
                  />
                )}
              </div>
            )}

            {/* UI Coverage Section */}
            {currentState.platforms && Object.keys(currentState.platforms).length > 0 && (
              <div>
                <h2
                  className="text-2xl font-bold mb-4"
                  style={{ color: theme.colors.accents.green }}
                >
                  🖥️ UI Coverage
                </h2>
                
                <UIScreenEditor
                  platforms={currentState.platforms}
                  onUpdate={handleUIUpdate}
                  isEditMode={isEditMode}
                  theme={theme}
                />
              </div>
            )}

            {/* Transitions Section */}
            {currentState.transitions && currentState.transitions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className="text-2xl font-bold"
                    style={{ color: theme.colors.accents.green }}
                  >
                    🔄 Transitions ({currentState.transitions.length})
                  </h2>
                  
                  {isEditMode && (
                    <button
                      onClick={handleAddTransition}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                      style={{
                        background: theme.colors.accents.green,
                        color: 'white'
                      }}
                    >
                      ➕ Add Transition
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {currentState.transitions.map((transition, index) => (
                    <TransitionCard
                      key={index}
                      transition={transition}
                      theme={theme}
                      editable={isEditMode}
                      onEdit={() => handleEditTransition(transition, index)}
                      onRemove={() => handleRemoveTransition(index)}
                    />
                  ))}
                </div>
              </div>
            )}

         {/* Test Generation Section */}
<div>
  <h2
    className="text-2xl font-bold mb-4"
    style={{ color: theme.colors.accents.blue }}
  >
    🧪 Test Generation
  </h2>
  <GenerateTestsButton 
    state={state} 
    projectPath={projectPath}
    discoveryResult={discoveryResult}  // ← ADD THIS
  />
</div>
            {/* Suggestions Panel */}
            {isEditMode && analysis && !suggestionsLoading && (
              <div>
                <h2
                  className="text-2xl font-bold mb-4"
                  style={{ color: theme.colors.accents.yellow }}
                >
                  💡 Suggestions
                </h2>
                
                <SuggestionsPanel
                  analysis={analysis}
                  currentState={editedState}
                  onApply={handleSuggestionApply}
                  theme={theme}
                />
              </div>
            )}

            {/* Files Section */}
            {currentState.files && (
              <div>
                <h2
                  className="text-2xl font-bold mb-4"
                  style={{ color: theme.colors.text.secondary }}
                >
                  📁 Files
                </h2>
                
                <div className="space-y-3">
                  {currentState.files.implication && (
                    <FileCard
                      label="Implication"
                      path={currentState.files.implication}
                      theme={theme}
                    />
                  )}
                  {currentState.files.test && (
                    <FileCard
                      label="Unit Test"
                      path={currentState.files.test}
                      theme={theme}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ NEW: Full Transition Edit Modal */}
      {showTransitionModal && (
        <AddTransitionModal
          isOpen={showTransitionModal}
          onClose={() => setShowTransitionModal(false)}
          onSubmit={handleTransitionSubmit}
          sourceState={state}
          targetState={null}
          projectPath={projectPath}
          mode={transitionMode}
          initialData={editingTransition}
        />
      )}
    </>
  );
}

// ========================================
// HELPER COMPONENTS
// ========================================

function MetadataField({ fieldName, value, theme, platformStyle, canEdit, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  return (
    <div
      className="glass p-4 rounded-lg relative group"
      style={{
        border: `1px solid ${theme.colors.border}`
      }}
    >
      <div
        className="text-sm mb-2 font-semibold"
        style={{ color: theme.colors.text.tertiary }}
      >
        {fieldName}
      </div>
      
      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={JSON.stringify(editValue)}
            onChange={(e) => {
              try {
                setEditValue(JSON.parse(e.target.value));
              } catch {
                setEditValue(e.target.value);
              }
            }}
            className="w-full px-3 py-2 rounded"
            style={{
              backgroundColor: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border}`
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-2 py-1 rounded font-semibold transition hover:brightness-110"
              style={{ background: theme.colors.accents.green, color: 'white' }}
            >
              ✓
            </button>
            <button
              onClick={handleCancel}
              className="px-2 py-1 rounded font-semibold transition hover:brightness-110"
              style={{ background: theme.colors.accents.red, color: 'white' }}
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="font-semibold"
            style={{ color: theme.colors.text.primary }}
          >
            {renderValue(value, fieldName, theme, platformStyle)}
          </div>
          
          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition px-2 py-1 rounded text-sm font-semibold"
              style={{ background: theme.colors.accents.blue, color: 'white' }}
            >
              ✏️
            </button>
          )}
        </>
      )}
    </div>
  );
}

function categorizeFields(metadata) {
  const groups = {
    'Core': [],
    'Buttons': [],
    'Platform': [],
    'Setup': [],
    'Other': []
  };
  
  const coreFields = ['status', 'triggerAction', 'statusCode', 'statusNumber'];
  const buttonFields = ['triggerButton', 'afterButton', 'previousButton'];
  const platformFields = ['platform', 'platforms', 'notificationKey'];
  const setupFields = ['setup', 'allSetups', 'actionName', 'requires', 'requiredFields'];
  
  Object.entries(metadata).forEach(([key, value]) => {
    if (key === 'uiCoverage' || key === 'xstateContext') return;
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) return;
    
    if (coreFields.includes(key)) {
      groups['Core'].push([key, value]);
    } else if (buttonFields.includes(key)) {
      groups['Buttons'].push([key, value]);
    } else if (platformFields.includes(key)) {
      groups['Platform'].push([key, value]);
    } else if (setupFields.includes(key)) {
      groups['Setup'].push([key, value]);
    } else {
      groups['Other'].push([key, value]);
    }
  });
  
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) delete groups[key];
  });
  
  return groups;
}

function renderValue(value, fieldName, theme, platformStyle) {
  if (value === null || value === undefined) {
    return (
      <span
        className="px-2 py-1 rounded text-sm font-semibold"
        style={{
          background: `${theme.colors.accents.red}20`,
          color: theme.colors.accents.red
        }}
      >
        ⚠️ Not Set
      </span>
    );
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span
          className="px-2 py-1 rounded text-sm"
          style={{
            background: `${theme.colors.accents.red}15`,
            color: theme.colors.accents.red
          }}
        >
          Empty Array
        </span>
      );
    }
    
    if (fieldName === 'requiredFields') {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((field, i) => (
            <span
              key={i}
              className="px-2 py-1 rounded text-xs font-mono"
              style={{
                background: `${theme.colors.accents.purple}40`,
                color: theme.colors.accents.purple
              }}
            >
              {field}
            </span>
          ))}
        </div>
      );
    }
    
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((item, i) => (
          <span
            key={i}
            className="px-2 py-1 rounded text-xs font-mono"
            style={{
              background: `${theme.colors.background.tertiary}`,
              color: theme.colors.text.primary
            }}
          >
            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </span>
        ))}
      </div>
    );
  }
  
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return (
        <span
          className="px-2 py-1 rounded text-sm"
          style={{
            background: `${theme.colors.accents.red}15`,
            color: theme.colors.accents.red
          }}
        >
          Empty Object
        </span>
      );
    }
    
    return (
      <div
        className="text-xs space-y-1 mt-1 p-3 rounded font-mono"
        style={{
          background: theme.colors.background.tertiary,
          maxHeight: '200px',
          overflowY: 'auto'
        }}
      >
        {entries.map(([k, v], i) => (
          <div key={i} className="flex gap-2">
            <span
              className="font-semibold"
              style={{ color: theme.colors.accents.blue }}
            >
              {k}:
            </span>
            <span style={{ color: theme.colors.text.primary }}>
              {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  
  if (value === '') {
    return (
      <span
        className="px-2 py-1 rounded text-sm"
        style={{
          background: `${theme.colors.accents.red}15`,
          color: theme.colors.accents.red
        }}
      >
        Empty String
      </span>
    );
  }
  
  if (fieldName === 'platform' && platformStyle) {
    return (
      <span style={{ color: platformStyle.color }}>
        {platformStyle.icon} {value}
      </span>
    );
  }
  
  if (fieldName.toLowerCase().includes('button')) {
    return (
      <span
        className="font-mono px-2 py-1 rounded"
        style={{
          background: `${theme.colors.accents.blue}20`,
          color: theme.colors.accents.blue
        }}
      >
        {value}
      </span>
    );
  }
  
  return String(value);
}

function FileCard({ label, path, theme }) {
  return (
    <div className="glass p-4 rounded-lg">
      <div
        className="text-sm mb-1"
        style={{ color: theme.colors.text.tertiary }}
      >
        {label}
      </div>
      <div
        className="font-mono text-sm break-all"
        style={{ color: theme.colors.text.secondary }}
      >
        {path}
      </div>
    </div>
  );
}

function TransitionCard({ transition, theme, editable, onEdit, onRemove }) {
  return (
    <div className="glass p-4 rounded-lg flex items-center gap-4 group relative">
      <span
        className="font-mono font-bold px-4 py-2 rounded-lg"
        style={{ background: theme.colors.accents.blue }}
      >
        {transition.event}
      </span>
      <span
        className="text-2xl"
        style={{ color: theme.colors.text.tertiary }}
      >
        →
      </span>
      <span
        className="font-bold text-lg cursor-pointer hover:underline"
        style={{ color: theme.colors.accents.blue }}
      >
        {getStatusIcon(transition.target)} {transition.target}
      </span>
      
      {/* ✅ NEW: Edit button */}
      {editable && onEdit && (
        <button
          onClick={onEdit}
          className="absolute top-2 right-12 opacity-0 group-hover:opacity-100 transition px-2 py-1 rounded text-sm font-semibold"
          style={{ background: theme.colors.accents.blue, color: 'white' }}
        >
          ✏️ Edit
        </button>
      )}
      
      {editable && onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition px-2 py-1 rounded text-sm font-semibold"
          style={{ background: theme.colors.accents.red, color: 'white' }}
        >
          🗑️ Remove
        </button>
      )}
    </div>
  );
}