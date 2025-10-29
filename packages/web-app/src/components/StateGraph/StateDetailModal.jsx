// packages/web-app/src/components/StateGraph/StateDetailModal.jsx
// COMPLETE VERSION with Add/Delete Context Fields + Auto-Suggestions

import { useEffect, useState } from 'react';
import { getStatusIcon, getStatusColor, getPlatformStyle, defaultTheme } from '../../config/visualizerTheme';
import SuggestionsPanel from '../SuggestionsPanel/SuggestionsPanel';
import { useSuggestions } from '../../hooks/useSuggestions';
import UIScreenEditor from '../UIScreenEditor/UIScreenEditor';
import DynamicContextFields from '../DynamicContextFields/DynamicContextFields';
import GenerateTestsButton from '../GenerateTestsButton/GenerateTestsButton';
import TestDataPanel from '../TestDataPanel/TestDataPanel';
import TestDataLinker from '../TestDataLinker/TestDataLinker';

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

export default function StateDetailModal({ state, onClose, theme = defaultTheme, projectPath }) {
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedState, setEditedState] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Context state
  const [contextData, setContextData] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextChanges, setContextChanges] = useState({});
  
  // NEW: Context field suggestions
  const [suggestedFields, setSuggestedFields] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
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

  // NEW: Load mirrorsOn suggestions when edit mode is enabled
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
        setContextData({}); // Set empty to show "no context" message
      }
    } catch (error) {
      console.error('❌ Error loading context:', error);
      setContextData({}); // Set empty on error
    } finally {
      setLoadingContext(false);
    }
  };

  // NEW: Load suggestions from mirrorsOn
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
    console.log('🔄 handleContextChange:', fieldName, newValue);
    
    // Update local context data
    setContextData(prev => ({
      ...prev,
      [fieldName]: newValue
    }));
    
    // Track changes for save
    setContextChanges(prev => ({
      ...prev,
      [fieldName]: newValue
    }));
    
    // Mark as having changes
    setHasChanges(true);
  };

  // NEW: Add context field handler
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

      // Reload context data to show new field
      await loadContextData();
      
      // Reload suggestions (field is no longer missing)
      await loadMirrorsOnSuggestions();

      // Show success message
      alert(`✅ Added field "${fieldName}" to context!`);
      
    } catch (error) {
      console.error('❌ Error adding field:', error);
      alert(`❌ Failed to add field: ${error.message}`);
    }
  };

  // NEW: Delete context field handler
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

      // Update local context data (remove field)
      setContextData(prev => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
      
      // Also remove from context changes if it was pending
      setContextChanges(prev => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });

      // Reload suggestions (field might now be missing again)
      await loadMirrorsOnSuggestions();

      // Show success message
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
    const event = prompt('Enter event name (e.g., CANCEL):');
    if (!event) return;
    
    const target = prompt('Enter target state name (e.g., rejected):');
    if (!target) return;

    setEditedState(prev => ({
      ...prev,
      transitions: [...(prev.transitions || []), { event, target }]
    }));
    setHasChanges(true);
  };

  const handleRemoveTransition = (index) => {
    setEditedState(prev => ({
      ...prev,
      transitions: prev.transitions.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
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
    
    // Check if there are metadata changes (compare with original state)
    const hasMetadataChanges = JSON.stringify(editedState.meta) !== JSON.stringify(state.meta) ||
                               JSON.stringify(editedState.transitions) !== JSON.stringify(state.transitions);
    
    // 1. Save metadata (ONLY if changed)
    if (hasMetadataChanges) {
      console.log('1️⃣ Saving metadata changes...');
      const metadataResponse = await fetch('http://localhost:3000/api/implications/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.files.implication,
          metadata: editedState.meta,
          transitions: editedState.transitions
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
      setContextChanges({});
      setIsEditMode(false);
      
      // Reload context to sync
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

  const handleUIUpdate = async (uiData) => {
  console.log('💾 handleUIUpdate received:', uiData);
  
  try {
    const response = await fetch('http://localhost:3000/api/implications/update-ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: state.files.implication,
        uiData: uiData  // Pass full platforms object
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

  const handleFieldsSelected = async (fields) => {
  console.log('✅ User selected fields:', fields);
  
  // Add each field to context
  for (const field of fields) {
    await fetch('/api/implications/add-context-field', {
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
  
  // Reload context
  await fetchContextData();
  
  alert(`✅ Added ${fields.length} fields to context!`);
};

const handleAnalysisComplete = (analysis) => {
  console.log('📊 Analysis complete:', analysis);
  // Optional: Store analysis for later use
};

  // ========================================
  // RENDER
  // ========================================

  return (
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
        {/* ========================================
            HEADER
            ======================================== */}
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

        {/* ========================================
            CONTENT
            ======================================== */}
        <div className="p-6 space-y-8">

        <div className="mb-6">
  <h3 className="text-xl font-bold mb-3">
    🧠 Intelligent Field Suggestions
  </h3>
  
 <TestDataLinker
    stateName={state.name}
    projectPath={projectPath}
    implicationPath={state.files.implication}  // ← ADD THIS!
    theme={theme}
    existingContext={contextData}
    onFieldsSelected={handleFieldsSelected}
    onAnalysisComplete={handleAnalysisComplete}
  />
</div>
          
          {/* ========================================
              CONTEXT SECTION
              ======================================== */}
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
                
                {loadingSuggestions && (
                  <span 
                    className="text-sm"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    Loading suggestions...
                  </span>
                )}
              </div>
              
              {/* DynamicContextFields Component - ENHANCED */}
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

          {/* ========================================
    TEST DATA REQUIREMENTS SECTION - NEW!
    ======================================== */}
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
          
          {/* ========================================
              METADATA SECTION - COLLAPSIBLE
              ======================================== */}
          <details 
            className="mb-8" 
            open={!contextData || Object.keys(contextData || {}).length === 0}
          >
            <summary 
              className="cursor-pointer text-2xl font-bold mb-4 flex items-center gap-2 hover:opacity-80 transition"
              style={{ color: theme.colors.accents.blue }}
            >
              ⚙️ Advanced Metadata
              <span 
                className="text-sm font-normal"
                style={{ color: theme.colors.text.tertiary }}
              >
                (Legacy fields from previous project)
              </span>
            </summary>
            
          <DynamicMetadataGrid 
  metadata={currentState.meta}
  theme={theme}
  editable={false}  // ← Always false!
  onChange={handleMetadataChange}
/>
          </details>
          
{/* ========================================
    UI SCREENS SECTION - ALWAYS SHOW
    ======================================== */}
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
      // ✅ Initialize empty structure if missing
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
          
          {/* ========================================
              TRANSITIONS SECTION
              ======================================== */}
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
                    onRemove={() => handleRemoveTransition(index)}
                  />
                ))}
              </div>
            </div>
          )}

          // Inside the modal, add the button section (after transitions section):


{/* ✨ ADD THIS SECTION HERE ✨ */}
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
          />
        </div>
        {/* ✨ END NEW SECTION ✨ */}
          
          {/* ========================================
              SUGGESTIONS PANEL
              ======================================== */}
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
          
          {/* ========================================
              FILES SECTION
              ======================================== */}
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
  );
}

// ========================================
// HELPER COMPONENTS
// ========================================

function DynamicMetadataGrid({ metadata, theme, platformStyle, editable, onChange }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <div 
        className="glass p-8 rounded-lg text-center"
        style={{ color: theme.colors.text.tertiary }}
      >
        <div className="text-4xl mb-2">📋</div>
        <div>No metadata available</div>
      </div>
    );
  }

  const fieldGroups = categorizeFields(metadata);

  return (
    <div className="space-y-6">
      {Object.entries(fieldGroups).map(([category, fields]) => (
        <div key={category}>
          <h4 
            className="text-sm font-semibold uppercase tracking-wide mb-3"
            style={{ color: theme.colors.text.tertiary }}
          >
            {category}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(([key, value]) => (
              <EditableMetadataField 
                key={key}
                fieldName={key}
                value={value}
                theme={theme}
                platformStyle={platformStyle}
                editable={editable}
                onChange={(newValue) => onChange(key, newValue)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditableMetadataField({ fieldName, value, theme, platformStyle, editable, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  
  useEffect(() => {
    setEditValue(value);
  }, [value]);
  
  const displayName = fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
  
  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };
  
  const editableFields = ['status', 'triggerAction', 'triggerButton', 'afterButton', 'previousButton', 'notificationKey', 'statusCode', 'statusNumber', 'platform', 'actionName'];
  const canEdit = editable && editableFields.includes(fieldName) && !isEditing;
  
  return (
    <div className="glass p-4 rounded-lg relative group">
      <div 
        className="text-sm mb-1"
        style={{ color: theme.colors.text.tertiary }}
      >
        {displayName}
      </div>
      
      {isEditing ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={editValue === null || editValue === undefined ? '' : editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            autoFocus
            className="flex-1 px-2 py-1 rounded"
            style={{
              background: theme.colors.background.tertiary,
              border: `2px solid ${theme.colors.accents.blue}`,
              color: theme.colors.text.primary
            }}
          />
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

function TransitionCard({ transition, theme, editable, onRemove }) {
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