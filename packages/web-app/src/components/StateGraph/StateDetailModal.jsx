// packages/web-app/src/components/StateGraph/StateDetailModal.jsx (REFACTORED WITH CONTEXT)
import { useEffect, useState } from 'react';
import { getStatusIcon, getStatusColor, getPlatformStyle, defaultTheme } from '../../config/visualizerTheme';
import SuggestionsPanel from '../SuggestionsPanel/SuggestionsPanel';
import { useSuggestions } from '../../hooks/useSuggestions';
import UIScreenEditor from '../UIScreenEditor/UIScreenEditor';

export default function StateDetailModal({ state, onClose, theme = defaultTheme, projectPath }) {
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedState, setEditedState] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Get suggestions
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

  if (!state) return null;
  
  const currentState = isEditMode ? editedState : state;
  if (!currentState) return null;
  
  const statusColor = getStatusColor(currentState.name, theme);
  const statusIcon = getStatusIcon(currentState.name, theme);
  const platformStyle = getPlatformStyle(currentState.meta?.platform, theme);

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (isEditMode) {
      if (hasChanges) {
        if (!window.confirm('You have unsaved changes. Discard them?')) {
          return;
        }
      }
      setEditedState(JSON.parse(JSON.stringify(state)));
      setHasChanges(false);
    } else {
      if (!editedState) {
        setEditedState(JSON.parse(JSON.stringify(state)));
      }
    }
    setIsEditMode(!isEditMode);
  };

  // Handle metadata field change
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

  // Handle transition changes
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

  // Handle suggestion applies
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

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/implications/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.files.implication,
          metadata: editedState.meta,
          transitions: editedState.transitions
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save');
      }
      
      const updatedState = {
        ...state,
        meta: { ...editedState.meta },
        transitions: [...editedState.transitions]
      };
      
      Object.assign(state, updatedState);
      setEditedState(JSON.parse(JSON.stringify(updatedState)));
      
      setHasChanges(false);
      setIsEditMode(false);
      
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
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">✅</span>
          <div>
            <div style="font-size: 14px; font-weight: bold;">Changes Saved!</div>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">Backup: ${result.backup.split('/').pop()}</div>
          </div>
        </div>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'all 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
      
      if (window.refreshSingleState) {
        setTimeout(() => {
          window.refreshSingleState(state.files.implication);
        }, 500);
      } else if (window.refreshDiscovery) {
        setTimeout(() => {
          window.refreshDiscovery();
        }, 1000);
      }
      
    } catch (error) {
      console.error('❌ Save failed:', error);
      alert(`❌ Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-50 overflow-y-auto backdrop-blur-sm detail-panel-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
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
      }}
    >
      <div className="min-h-screen px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div 
            className={`glass rounded-2xl p-8 border ${hasChanges ? 'border-yellow-500' : ''}`}
            style={{ 
              borderColor: hasChanges ? '#eab308' : theme.colors.border,
              borderWidth: hasChanges ? '3px' : '1px',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)'
            }}
          >
            
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="text-6xl">{statusIcon}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-4xl font-bold text-white mb-2">{currentState.displayName}</h2>
                    {hasChanges && (
                      <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-300 text-sm font-bold">
                        ⚠️ Unsaved Changes
                      </span>
                    )}
                  </div>
                  <span 
                    className={`status-badge status-${currentState.name} text-base`}
                    style={{ 
                      background: `${statusColor}20`,
                      color: statusColor
                    }}
                  >
                    {currentState.name}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                {!isEditMode ? (
                  <button 
                    onClick={handleEditToggle}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition"
                  >
                    ✏️ Edit
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={handleSave}
                      disabled={!hasChanges || isSaving}
                      className={`px-6 py-3 rounded-lg font-bold transition ${
                        hasChanges && !isSaving
                          ? 'bg-green-600 hover:bg-green-500 text-white'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isSaving ? '💾 Saving...' : '💾 Save'}
                    </button>
                    <button 
                      onClick={handleEditToggle}
                      className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-bold transition"
                    >
                      ❌ Cancel
                    </button>
                  </>
                )}
                
                <button 
                  onClick={() => {
                    if (hasChanges) {
                      if (window.confirm('You have unsaved changes. Close anyway?')) {
                        onClose();
                      }
                    } else {
                      onClose();
                    }
                  }}
                  className="text-red-400 hover:text-red-300 text-3xl font-bold px-4 py-2 rounded-lg hover:bg-red-900/20 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Show Suggestions Panel in Edit Mode */}
            {isEditMode && !suggestionsLoading && analysis && (
              <div className="mb-8">
                <SuggestionsPanel
                  analysis={analysis}
                  currentInput={{ stateName: currentState.name }}
                  onApply={handleSuggestionApply}
                  theme={theme}
                  mode="edit"
                />
              </div>
            )}
            
            {/* ✅ NEW: Context Fields Section */}
            {currentState.xstateContext && Object.keys(currentState.xstateContext).length > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.purple }}>
                  📦 Context Fields
                </h3>
                <div className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
                  Data accumulated through workflow (from xstateConfig.context)
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(currentState.xstateContext).map(([key, value]) => (
                    <ContextFieldCard 
                      key={key}
                      fieldName={key}
                      value={value}
                      isRequired={currentState.meta?.requiredFields?.includes(key)}
                      theme={theme}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Metadata Grid */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.blue }}>
                📋 Metadata
              </h3>
              
              <DynamicMetadataGrid 
                metadata={currentState.meta} 
                theme={theme}
                platformStyle={platformStyle}
                editable={isEditMode}
                onChange={handleMetadataChange}
              />
            </div>
            
            {/* Files */}
            {currentState.files && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.green }}>
                  📂 Files
                </h3>
                
                <div className="space-y-3">
                  <FileCard 
                    label="Implication File" 
                    path={currentState.files.implication}
                    theme={theme}
                  />
                  {currentState.files.test && (
                    <FileCard 
                      label="Test File" 
                      path={currentState.files.test}
                      theme={theme}
                    />
                  )}
                </div>
              </div>
            )}
            
            {/* Transitions */}
            {currentState.transitions && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold" style={{ color: theme.colors.accents.yellow }}>
                    🔄 Transitions ({currentState.transitions.length})
                  </h3>
                  
                  {isEditMode && (
                    <button
                      onClick={handleAddTransition}
                      className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110"
                      style={{ 
                        background: theme.colors.accents.green,
                        color: 'white'
                      }}
                    >
                      ➕ Add Transition
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {currentState.transitions.length > 0 ? (
                    currentState.transitions.map((t, i) => (
                      <TransitionCard 
                        key={i}
                        transition={t}
                        theme={theme}
                        editable={isEditMode}
                        onRemove={() => handleRemoveTransition(i)}
                      />
                    ))
                  ) : (
                    <div className="glass p-4 rounded-lg text-center" style={{ color: theme.colors.text.tertiary }}>
                      No transitions
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* UI Coverage Section */}
            {currentState.uiCoverage && currentState.uiCoverage.total > 0 && (
              <div className="mb-8">
                <UIScreenEditor
                  state={currentState}
                  onSave={async (updatedUI) => {
                    console.log('💾 Saving UI changes to file...');
                    
                    try {
                      const response = await fetch('http://localhost:3001/api/implications/update-ui', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          filePath: currentState.files.implication,
                          uiData: updatedUI
                        })
                      });

                      const result = await response.json();
                      if (!response.ok) {
                        throw new Error(result.error || 'Failed to save UI changes');
                      }
                      console.log('✅ UI changes saved!');
                      
                      const updatedState = {
                        ...currentState,
                        uiCoverage: {
                          ...currentState.uiCoverage,
                          platforms: updatedUI
                        }
                      };
                      
                      Object.assign(state, updatedState);
                      if (editedState) {
                        setEditedState(JSON.parse(JSON.stringify(updatedState)));
                      }
                      
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
                        z-index: 99999;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                      `;
                      notification.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 12px;">
                          <span style="font-size: 24px;">✅</span>
                          <div>
                            <div style="font-size: 14px; font-weight: bold;">UI Changes Saved!</div>
                            <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">Backup: ${result.backup?.split('/').pop() || 'created'}</div>
                          </div>
                        </div>
                      `;
                      document.body.appendChild(notification);
                      
                      setTimeout(() => {
                        notification.style.opacity = '0';
                        notification.style.transform = 'translateX(100%)';
                        notification.style.transition = 'all 0.3s ease-out';
                        setTimeout(() => notification.remove(), 300);
                      }, 3000);
                      
                      if (window.refreshSingleState) {
                        setTimeout(() => {
                          window.refreshSingleState(currentState.files.implication);
                        }, 500);
                      }
                      
                    } catch (error) {
                      console.error('❌ Save UI changes failed:', error);
                      alert(`❌ Failed to save: ${error.message}`);
                      throw error;
                    }
                  }}
                  theme={theme}
                />
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ✅ NEW: Context Field Card Component
// ============================================

function ContextFieldCard({ fieldName, value, isRequired, theme }) {
  const hasValue = value !== null && value !== undefined;
  
  return (
    <div 
      className="glass p-4 rounded-lg border"
      style={{
        borderColor: isRequired 
          ? theme.colors.accents.red + '40'
          : theme.colors.border
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-mono" style={{ color: theme.colors.text.secondary }}>
          {fieldName}
        </div>
        {isRequired && (
          <span 
            className="text-xs px-2 py-0.5 rounded font-semibold"
            style={{ 
              background: theme.colors.accents.red + '20',
              color: theme.colors.accents.red
            }}
          >
            REQUIRED
          </span>
        )}
      </div>
      
      <div className="font-semibold" style={{ color: theme.colors.text.primary }}>
        {hasValue ? (
          <span className="font-mono text-sm">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        ) : (
          <span 
            className="text-sm px-2 py-1 rounded"
            style={{ 
              background: theme.colors.accents.yellow + '20',
              color: theme.colors.accents.yellow
            }}
          >
            Not set
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Keep all your existing helper components below
// (DynamicMetadataGrid, EditableMetadataField, categorizeFields, 
//  renderValue, FileCard, TransitionCard, etc.)
// ============================================

function DynamicMetadataGrid({ metadata, theme, platformStyle, editable, onChange }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <div className="glass p-4 rounded-lg text-center" style={{ color: theme.colors.text.tertiary }}>
        No metadata available
      </div>
    );
  }
  
  const fieldGroups = categorizeFields(metadata);
  
  return (
    <div className="space-y-6">
      {Object.entries(fieldGroups).map(([category, fields]) => (
        <div key={category}>
          <h4 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: theme.colors.text.tertiary }}>
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
      <div className="text-sm mb-1" style={{ color: theme.colors.text.tertiary }}>
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
          <div className="font-semibold" style={{ color: theme.colors.text.primary }}>
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
    if (key === 'uiCoverage') return;
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
      <div className="text-sm mb-1" style={{ color: theme.colors.text.tertiary }}>
        {label}
      </div>
      <div className="font-mono text-sm break-all" style={{ color: theme.colors.text.secondary }}>
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
      <span className="text-2xl" style={{ color: theme.colors.text.tertiary }}>→</span>
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