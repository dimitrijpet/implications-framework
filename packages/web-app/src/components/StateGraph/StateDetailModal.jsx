// packages/web-app/src/components/StateGraph/StateDetailModal.jsx
// ✨ COMPLETE VERSION - All Features Restored + Full Transition Editing
// Features:
// - TestDataPanel, TestDataLinker, CompositionViewerWithEdit
// - Full UIScreenEditor with smart diffing
// - Full AddTransitionModal for editing transitions
// - DynamicContextFields with add/delete
// - GenerateTestsButton with discoveryResult

import { useEffect, useState } from 'react';
import { getStatusIcon, getStatusColor, getPlatformStyle, defaultTheme } from '../../config/visualizerTheme';
import SuggestionsPanel from '../SuggestionsPanel/SuggestionsPanel';
import { useSuggestions } from '../../hooks/useSuggestions';
import UIScreenEditor from '../UIScreenEditor/UIScreenEditor';
import DynamicContextFields from '../DynamicContextFields/DynamicContextFields';
import GenerateTestsButton from '../GenerateTestsButton/GenerateTestsButton';
import TestDataPanel from '../TestDataPanel/TestDataPanel';
import TestDataLinker from '../TestDataLinker/TestDataLinker';
import CompositionViewerWithEdit from '../CompositionViewer/CompositionViewerWithEdit';
import AddTransitionModal from '../AddTransitionModal/AddTransitionModal';

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

export default function StateDetailModal({ 
  state, 
  onClose, 
  theme = defaultTheme, 
  projectPath,
  discoveryResult
}) {
  // Edit mode state
  const [editedScreens, setEditedScreens] = useState(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedState, setEditedState] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Context state
  const [contextData, setContextData] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextChanges, setContextChanges] = useState({});
  
  // Composition state
  const [compositionData, setCompositionData] = useState(null);
  const [isLoadingComposition, setIsLoadingComposition] = useState(false);
  
  // Context field suggestions
  const [suggestedFields, setSuggestedFields] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Transition editing state
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionMode, setTransitionMode] = useState('create');
  const [editingTransition, setEditingTransition] = useState(null);
  const [editingTransitionIndex, setEditingTransitionIndex] = useState(null);
  
  // Get suggestions for metadata
  const { analysis, loading: suggestionsLoading } = useSuggestions(projectPath);

  // Initialize edited state from props
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

  // Load composition when modal opens
  useEffect(() => {
    if (state?.files?.implication) {
      loadComposition();
    }
  }, [state?.files?.implication]);

  if (!state) return null;
  
  const currentState = isEditMode ? editedState : state;
  if (!currentState) return null;
  
  const statusColor = getStatusColor(currentState.name, theme);
  const statusIcon = getStatusIcon(currentState.name, theme);
  const platformStyle = getPlatformStyle(currentState.meta?.platform, theme);

  // ========================================
  // DATA LOADING FUNCTIONS
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

  const loadComposition = async () => {
    if (!state?.files?.implication) {
      console.warn('⚠️ No implication file path');
      return;
    }
    
    setIsLoadingComposition(true);
    try {
      console.log('🔍 Loading composition for:', state.files.implication);
      
      const response = await fetch(
        `http://localhost:3000/api/implications/analyze-composition?filePath=${encodeURIComponent(state.files.implication)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to analyze composition');
      }
      
      console.log('✅ Composition loaded:', data.composition);
      setCompositionData(data.composition);
      
    } catch (error) {
      console.error('❌ Failed to load composition:', error);
      setCompositionData(null);
    } finally {
      setIsLoadingComposition(false);
    }
  };

  // ========================================
  // CONTEXT HANDLERS
  // ========================================

  const handleContextChange = (fieldName, newValue) => {
    console.log('🔄 handleContextChange:', fieldName, newValue);
    
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
  // TRANSITION HANDLERS
  // ========================================

  const handleAddTransition = () => {
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
        
        const fullTransitionData = {
          event: transition.event,
          target: data.transition.target || transition.target,
          platforms: data.transition.platforms,
          actionDetails: data.transition.actionDetails
        };
        
        console.log('📦 Setting editingTransition:', fullTransitionData);
        
        setTransitionMode('edit');
        setEditingTransition(fullTransitionData);
        setEditingTransitionIndex(index);
        setShowTransitionModal(true);
        
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

      setEditedState(prev => ({
        ...prev,
        transitions: prev.transitions.filter((_, i) => i !== index)
      }));
      
      setHasChanges(true);

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

  const handleTransitionSubmit = async (transitionData) => {
    console.log('💾 Saving transition:', transitionMode, transitionData);

    try {
      if (transitionMode === 'create') {
        console.warn('⚠️ Create mode called from detail modal - should use visualizer');
        alert('Please use the graph to create transitions');
        return;
        
      } else {
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

  // ========================================
  // SAVE HANDLER
  // ========================================

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      console.log('💾 Starting save process...');
      console.log('📦 Context changes to save:', contextChanges);
      
      const hasMetadataChanges = JSON.stringify(editedState.meta) !== JSON.stringify(state.meta);
      
      if (hasMetadataChanges) {
        console.log('1️⃣ Saving metadata changes...');
        const metadataResponse = await fetch('http://localhost:3000/api/implications/update-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: state.files.implication,
            metadata: editedState.meta
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
      
      if (!hasMetadataChanges && Object.keys(contextChanges).length === 0) {
        alert('ℹ️ No changes to save');
        setIsSaving(false);
        return;
      }
      
      alert('✅ Changes saved successfully!');
      setHasChanges(false);
      setContextChanges({});
      setIsEditMode(false);
      
      await loadContextData();
      
    } catch (error) {
      console.error('❌ Save failed:', error);
      alert(`❌ Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ========================================
  // UI EDITOR HANDLERS
  // ========================================

  const handleUIUpdate = async (uiData, editedScreensSet) => {
    console.log('💾 handleUIUpdate received:', uiData);
    console.log('✏️ Edited screens:', editedScreensSet ? Array.from(editedScreensSet) : 'none');
    
    try {
      const filteredUI = {};
      
      for (const [platformName, platformData] of Object.entries(uiData)) {
        filteredUI[platformName] = {
          name: platformData.name,
          screens: {}
        };
        
        for (const [screenName, screenData] of Object.entries(platformData.screens || {})) {
          const screenKey = `${platformName}.${screenName}`;
          
          // Skip numeric keys (corrupted data)
          if (/^\d+$/.test(screenName)) {
            console.warn(`⚠️ Skipping corrupted numeric screen key: ${screenName}`);
            continue;
          }
          
          // Skip screens not edited by user (if tracking is available)
          if (editedScreensSet && !editedScreensSet.has(screenKey)) {
            console.log(`⏭️ Skipping ${screenKey} - not edited by user`);
            continue;
          }
          
          filteredUI[platformName].screens[screenName] = screenData;
          console.log(`✅ Including screen ${screenKey}`);
        }
      }
      
      console.log('✅ Filtered UI:', filteredUI);
      
      const response = await fetch('http://localhost:3000/api/implications/update-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.files.implication,
          uiData: filteredUI
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update UI');
      }

      alert('✅ UI screens updated successfully!');
    } catch (error) {
      console.error('❌ UI update failed:', error);
      alert(`❌ Failed to update UI: ${error.message}`);
    }
  };

  const handleCompositionUpdated = async (saveResult) => {
    console.log('✅ Composition updated:', saveResult);
    
    try {
      await loadComposition();
      await loadMirrorsOnSuggestions();
      alert('✅ Composition updated and refreshed!');
    } catch (error) {
      console.error('Failed to refresh after composition update:', error);
      alert('⚠️ Changes saved but failed to refresh display. Please reload.');
    }
  };

  const handleFieldsSelected = async (fields) => {
    console.log('✅ User selected fields:', fields);
    
    for (const field of fields) {
      await fetch('http://localhost:3000/api/implications/add-context-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.files.implication,
          fieldName: field.field,
          initialValue: null,
          fieldType: typeof field.value
        })
      });
    }
    
    await loadContextData();
    alert(`✅ Added ${fields.length} fields to context!`);
  };

  const handleAnalysisComplete = (analysis) => {
    console.log('📊 Analysis complete:', analysis);
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
          style={{ 
            background: theme.colors.background.primary,
            border: `2px solid ${statusColor}`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div 
            className="sticky top-0 z-10 p-6 border-b"
            style={{ 
              background: `${statusColor}15`,
              borderColor: statusColor
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">{statusIcon}</span>
                  <h2 
                    className="text-3xl font-bold"
                    style={{ color: statusColor }}
                  >
                    {currentState.name}
                  </h2>
                  {platformStyle && (
                    <span 
                      className="px-3 py-1 rounded-full text-sm font-semibold"
                      style={{ 
                        background: `${platformStyle.color}20`,
                        color: platformStyle.color,
                        border: `2px solid ${platformStyle.color}`
                      }}
                    >
                      {platformStyle.icon} {currentState.meta?.platform || 'web'}
                    </span>
                  )}
                </div>
                {currentState.meta?.status && (
                  <div 
                    className="text-lg font-semibold"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    Status: {currentState.meta.status}
                  </div>
                )}
              </div>
              
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition hover:brightness-110"
                style={{ 
                  background: theme.colors.background.tertiary,
                  color: theme.colors.text.primary
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleEditToggle}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                style={{ 
                  background: isEditMode ? theme.colors.accents.red : theme.colors.accents.blue,
                  color: 'white'
                }}
              >
                {isEditMode ? '❌ Cancel Edit' : '✏️ Edit State'}
              </button>
              
              {isEditMode && (
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                  style={{ 
                    background: hasChanges ? theme.colors.accents.green : theme.colors.background.tertiary,
                    color: hasChanges ? 'white' : theme.colors.text.tertiary,
                    opacity: hasChanges ? 1 : 0.5,
                    cursor: hasChanges ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isSaving ? '💾 Saving...' : '💾 Save Changes'}
                </button>
              )}
              
              {hasChanges && (
                <span 
                  className="px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ 
                    background: `${theme.colors.accents.orange}20`,
                    color: theme.colors.accents.orange
                  }}
                >
                  ⚠️ Unsaved Changes
                </span>
              )}
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-6 space-y-8">

            {/* INTELLIGENT FIELD SUGGESTIONS */}
            <div>
              <h3 
                className="text-xl font-bold mb-3"
                style={{ color: theme.colors.accents.blue }}
              >
                🧠 Intelligent Field Suggestions
              </h3>
              
              <TestDataLinker
                stateName={state.name}
                projectPath={projectPath}
                implicationPath={state.files.implication}
                theme={theme}
                existingContext={contextData}
                onFieldsSelected={handleFieldsSelected}
                onAnalysisComplete={handleAnalysisComplete}
              />
            </div>
            
            {/* CONTEXT FIELDS */}
            {(contextData || loadingContext) && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 
                      className="text-2xl font-bold mb-1"
                      style={{ color: theme.colors.accents.blue }}
                    >
                      📦 Context Fields
                      {contextData && Object.keys(contextData).length > 0 && (
                        <span 
                          className="text-base font-normal ml-3"
                          style={{ color: theme.colors.text.tertiary }}
                        >
                          ({Object.keys(contextData).length} {Object.keys(contextData).length === 1 ? 'field' : 'fields'})
                        </span>
                      )}
                    </h2>
                    <div 
                      className="text-sm"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Data accumulated through workflow (from xstateConfig.context)
                    </div>
                  </div>
                </div>
                
                {loadingContext ? (
                  <div 
                    className="glass p-8 rounded-lg text-center"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    <div className="text-4xl mb-2">⏳</div>
                    <div>Loading context fields...</div>
                  </div>
                ) : contextData ? (
                  <DynamicContextFields
                    contextData={contextData}
                    onFieldChange={handleContextChange}
                    onFieldAdd={isEditMode ? handleAddContextField : null}
                    onFieldDelete={isEditMode ? handleDeleteContextField : null}
                    suggestedFields={isEditMode ? suggestedFields : []}
                    theme={theme}
                    editable={isEditMode}
                    compact={false}
                  />
                ) : (
                  <div 
                    className="glass p-8 rounded-lg text-center"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    <div className="text-4xl mb-2">📭</div>
                    <div className="font-semibold mb-1">No Context Fields</div>
                    <div className="text-sm">This state machine has no context defined</div>
                  </div>
                )}
              </div>
            )}

            {/* TEST DATA REQUIREMENTS */}
            <div>
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: theme.colors.accents.purple }}
              >
                📊 Test Data Requirements
              </h2>
              
              <TestDataPanel
                state={currentState}
                projectPath={projectPath}
                theme={theme}
              />
            </div>
            
            {/* COMPOSITION ARCHITECTURE */}
            <div>
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: theme.colors.accents.purple }}
              >
                🧩 Composition Architecture
              </h2>
              
              {!state?.files?.implication ? (
                <div 
                  className="p-8 rounded-lg text-center"
                  style={{ 
                    background: theme.colors.background.secondary,
                    color: theme.colors.text.tertiary 
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📂</div>
                  <div>No implication file path available</div>
                </div>
              ) : isLoadingComposition ? (
                <div 
                  className="p-8 rounded-lg text-center"
                  style={{ 
                    background: theme.colors.background.secondary,
                    color: theme.colors.text.tertiary 
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏳</div>
                  <div>Loading composition...</div>
                </div>
              ) : compositionData ? (
                <CompositionViewerWithEdit
                  compositionData={compositionData}
                  theme={theme}
                  implicationPath={state.files.implication}
                  onCompositionUpdated={handleCompositionUpdated}
                />
              ) : (
                <div 
                  className="p-8 rounded-lg text-center"
                  style={{ 
                    background: theme.colors.background.secondary,
                    color: theme.colors.text.tertiary 
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
                  <div className="font-semibold mb-2">Failed to load composition</div>
                  <button
                    onClick={loadComposition}
                    className="mt-4 px-4 py-2 rounded-lg font-semibold hover:brightness-110 transition"
                    style={{
                      background: theme.colors.accents.blue,
                      color: 'white'
                    }}
                  >
                    🔄 Retry
                  </button>
                </div>
              )}
            </div>
            
            {/* UI SCREENS */}
            <div>
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: theme.colors.accents.purple }}
              >
                📱 UI Screens
              </h2>
              
              <UIScreenEditor
                state={{
                  ...currentState,
                  filePath: state.files.implication,
                  uiCoverage: currentState.uiCoverage || {
                    platforms: currentState.meta?.uiCoverage?.platforms || {}
                  }
                }}
                projectPath={projectPath}
                theme={theme}
                onSave={handleUIUpdate}
                onCancel={() => console.log('UI edit cancelled')}
              />
            </div>

            {/* TRANSITIONS */}
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
                
                <div className="space-y-2">
                  {currentState.transitions.map((transition, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded flex items-center justify-between group"
                      style={{ 
                        background: `${theme.colors.background.tertiary}80`,
                        border: `1px solid ${theme.colors.border}`
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="px-2 py-1 rounded text-xs font-mono"
                          style={{ 
                            background: theme.colors.accents.blue,
                            color: 'white'
                          }}
                        >
                          {transition.event}
                        </span>
                        <span style={{ color: theme.colors.text.secondary }}>→</span>
                        <span style={{ color: theme.colors.text.primary }}>
                          {transition.target}
                        </span>
                      </div>
                      
                      {isEditMode && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => handleEditTransition(transition, idx)}
                            className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
                            style={{
                              background: theme.colors.accents.blue,
                              color: 'white'
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleRemoveTransition(idx)}
                            className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
                            style={{
                              background: theme.colors.accents.red,
                              color: 'white'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TEST GENERATION */}
            <div>
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: theme.colors.accents.green }}
              >
                🧪 Test Generation
              </h2>
              
              <GenerateTestsButton 
                state={state} 
                projectPath={projectPath}
                theme={theme}
                discoveryResult={discoveryResult}
              />
            </div>
            
            {/* SUGGESTIONS PANEL */}
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
            
            {/* FILES */}
            {currentState.files && (
              <div>
                <h2 
                  className="text-2xl font-bold mb-4"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  📁 Files
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentState.files.implication && (
                    <FileCard
                      label="Implication File"
                      path={currentState.files.implication}
                      theme={theme}
                    />
                  )}
                  {currentState.files.screen && (
                    <FileCard
                      label="Screen File"
                      path={currentState.files.screen}
                      theme={theme}
                    />
                  )}
                  {currentState.files.section && (
                    <FileCard
                      label="Section File"
                      path={currentState.files.section}
                      theme={theme}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transition Edit Modal */}
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