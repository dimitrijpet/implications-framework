// packages/web-app/src/components/StateGraph/StateDetailModal.jsx (COMPLETE REPLACEMENT)

import { useEffect, useState } from 'react';
import { getStatusIcon, getStatusColor, getPlatformStyle, defaultTheme } from '../../config/visualizerTheme';

export default function StateDetailModal({ state, onClose, theme = defaultTheme, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [editedState, setEditedState] = useState(state);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Reset when state changes
  useEffect(() => {
    setEditedState(state);
    setEditMode(false);
    setHasChanges(false);
  }, [state]);
  
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (hasChanges && !window.confirm('You have unsaved changes. Close anyway?')) {
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, hasChanges]);
  
  if (!state) return null;
  
  const statusColor = getStatusColor(state.name, theme);
  const statusIcon = getStatusIcon(state.name, theme);
  const platformStyle = getPlatformStyle(editedState.meta.platform, theme);
  
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
  
  // Handle transition add
  const handleAddTransition = (event, target) => {
    setEditedState(prev => ({
      ...prev,
      transitions: [
        ...prev.transitions,
        { event, target }
      ]
    }));
    setHasChanges(true);
  };
  
  // Handle transition remove
  const handleRemoveTransition = (index) => {
    setEditedState(prev => ({
      ...prev,
      transitions: prev.transitions.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  };
  
  // Save changes
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('http://localhost:3000/api/implications/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: editedState.files.implication,
          metadata: editedState.meta,
          transitions: editedState.transitions
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Save successful:', result);
      
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
      notification.textContent = '✅ Changes saved! Backup created: ' + result.backup.split('/').pop();
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 5000);
      
      setHasChanges(false);
      setEditMode(false);
      
      if (onSave) onSave(editedState);
      
    } catch (error) {
      console.error('❌ Save failed:', error);
      alert(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  // Cancel editing
  const handleCancel = () => {
    if (hasChanges && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    setEditedState(state);
    setEditMode(false);
    setHasChanges(false);
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-50 overflow-y-auto backdrop-blur-sm detail-panel-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (hasChanges && !window.confirm('You have unsaved changes. Close anyway?')) {
            return;
          }
          onClose();
        }
      }}
    >
      <div className="min-h-screen px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div 
            className="glass rounded-2xl p-8 border"
            style={{ 
              borderColor: hasChanges ? theme.colors.accents.yellow : theme.colors.border,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)'
            }}
          >
            
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="text-6xl">{statusIcon}</div>
                <div>
                  <h2 className="text-4xl font-bold text-white mb-2">{state.displayName}</h2>
                  <span 
                    className={`status-badge status-${state.name} text-base`}
                    style={{ 
                      background: `${statusColor}20`,
                      color: statusColor
                    }}
                  >
                    {state.name}
                  </span>
                  
                  {hasChanges && (
                    <span 
                      className="ml-3 px-3 py-1 rounded text-sm font-bold"
                      style={{ 
                        background: `${theme.colors.accents.yellow}20`,
                        color: theme.colors.accents.yellow
                      }}
                    >
                      ⚠️ Unsaved Changes
                    </span>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                {!editMode ? (
                  <>
                    <button 
                      onClick={() => setEditMode(true)}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                      style={{ 
                        background: theme.colors.accents.blue,
                        color: 'white'
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      onClick={onClose}
                      className="text-red-400 hover:text-red-300 text-3xl font-bold px-4 py-2 rounded-lg hover:bg-red-900/20 transition"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={handleSave}
                      disabled={!hasChanges || saving}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        background: theme.colors.accents.green,
                        color: 'white'
                      }}
                    >
                      {saving ? '⏳ Saving...' : '💾 Save'}
                    </button>
                    <button 
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110 disabled:opacity-50"
                      style={{ 
                        background: theme.colors.background.tertiary,
                        color: theme.colors.text.primary
                      }}
                    >
                      ❌ Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Metadata Grid */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.blue }}>
                📋 Metadata
              </h3>
              
              <DynamicMetadataGrid 
                metadata={editedState.meta} 
                theme={theme}
                platformStyle={platformStyle}
                editable={editMode}
                onChange={handleMetadataChange}
              />
            </div>
            
            {/* Files */}
            {editedState.files && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.green }}>
                  📂 Files
                </h3>
                
                <div className="space-y-3">
                  <FileCard 
                    label="Implication File" 
                    path={editedState.files.implication}
                    theme={theme}
                  />
                  {editedState.files.test && (
                    <FileCard 
                      label="Test File" 
                      path={editedState.files.test}
                      theme={theme}
                    />
                  )}
                </div>
              </div>
            )}
            
            {/* Transitions */}
            {editedState.transitions && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold" style={{ color: theme.colors.accents.yellow }}>
                    🔄 Transitions ({editedState.transitions.length})
                  </h3>
                  
                  {editMode && (
                    <button
                      onClick={() => {
                        const event = prompt('Enter event name (e.g., ACCEPT, REJECT):');
                        if (!event) return;
                        const target = prompt('Enter target state name:');
                        if (!target) return;
                        handleAddTransition(event.toUpperCase(), target);
                      }}
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
                  {editedState.transitions.length > 0 ? (
                    editedState.transitions.map((t, i) => (
                      <TransitionCard 
                        key={i}
                        transition={t}
                        theme={theme}
                        editable={editMode}
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
            
            {/* UI Coverage */}
            {editedState.uiCoverage && editedState.uiCoverage.total > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.pink }}>
                  🖥️ UI Coverage ({editedState.uiCoverage.total} screens)
                </h3>
                
                <UICoverageSection 
                  platforms={editedState.uiCoverage.platforms}
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
// Dynamic Metadata Grid (with edit support)
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

// ============================================
// Editable Metadata Field
// ============================================

function EditableMetadataField({ fieldName, value, theme, platformStyle, editable, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  
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
  
  // Editable fields (simple string fields only)
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
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyPress={(e) => {
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

// ============================================
// Helper Functions (unchanged)
// ============================================

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

function UICoverageSection({ platforms, theme }) {
  return (
    <div className="space-y-4">
      {Object.entries(platforms).map(([platformName, data]) => (
        <PlatformCard 
          key={platformName}
          platformName={platformName}
          data={data}
          theme={theme}
        />
      ))}
    </div>
  );
}

function PlatformCard({ platformName, data, theme }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const platformStyle = getPlatformStyle(platformName, theme);
  
  return (
    <div className="glass-light rounded-lg border" style={{ borderColor: theme.colors.border }}>
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{platformStyle.icon}</span>
          <span className="font-bold text-xl">{platformStyle.name}</span>
          <span className="text-sm" style={{ color: theme.colors.text.tertiary }}>
            ({data.count} screen{data.count !== 1 ? 's' : ''})
          </span>
        </div>
        
        <span 
          className="text-2xl transition-transform"
          style={{ 
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            color: theme.colors.text.tertiary
          }}
        >
          ▼
        </span>
      </div>
      
      {isExpanded && (
        <div className="p-4 pt-0 space-y-3">
          {data.screens.map((screen, idx) => (
            <ScreenCard 
              key={idx}
              screen={screen}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenCard({ screen, theme }) {
  const visibleElements = [...(screen.visible || []), ...(screen.checks?.visible || [])];
  const hiddenElements = [...(screen.hidden || []), ...(screen.checks?.hidden || [])];
  const textChecks = screen.checks?.text || {};
  
  return (
    <div className="glass-light p-4 rounded-lg border" style={{ borderColor: theme.colors.border }}>
      <div className="font-semibold text-lg mb-1" style={{ color: theme.colors.accents.blue }}>
        {screen.name}
      </div>
      
      {screen.description && (
        <div className="text-sm mb-3 italic" style={{ color: theme.colors.text.secondary }}>
          {screen.description}
        </div>
      )}
      
      <div className="space-y-2 text-sm">
        {visibleElements.length > 0 && (
          <div className="p-2 rounded" style={{ background: `${theme.colors.accents.green}10` }}>
            <span className="font-semibold" style={{ color: theme.colors.accents.green }}>
              ✅ Visible ({visibleElements.length}):
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {visibleElements.slice(0, 10).map((e, i) => (
                <span 
                  key={i}
                  className="font-mono px-2 py-0.5 rounded text-xs"
                  style={{ 
                    background: theme.colors.background.tertiary,
                    color: theme.colors.text.primary
                  }}
                >
                  {e}
                </span>
              ))}
              {visibleElements.length > 10 && (
                <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                  +{visibleElements.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {hiddenElements.length > 0 && (
          <div className="p-2 rounded" style={{ background: `${theme.colors.accents.red}10` }}>
            <span className="font-semibold" style={{ color: theme.colors.accents.red }}>
              ❌ Hidden ({hiddenElements.length}):
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {hiddenElements.slice(0, 10).map((e, i) => (
                <span 
                  key={i}
                  className="font-mono px-2 py-0.5 rounded text-xs"
                  style={{ 
                    background: theme.colors.background.tertiary,
                    color: theme.colors.text.primary
                  }}
                >
                  {e}
                </span>
              ))}
              {hiddenElements.length > 10 && (
                <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                  +{hiddenElements.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {Object.keys(textChecks).length > 0 && (
          <div className="p-2 rounded" style={{ background: `${theme.colors.accents.yellow}10` }}>
            <span className="font-semibold" style={{ color: theme.colors.accents.yellow }}>
              📝 Text Checks ({Object.keys(textChecks).length}):
            </span>
            <div className="mt-1 space-y-1 ml-2">
              {Object.entries(textChecks).slice(0, 5).map(([el, val], i) => (
                <div key={i} className="text-xs flex items-center gap-2">
                  <span 
                    className="font-mono px-2 py-0.5 rounded"
                    style={{ background: theme.colors.background.tertiary }}
                  >
                    {el}
                  </span>
                  <span style={{ color: theme.colors.text.tertiary }}>→</span>
                  <span style={{ color: theme.colors.accents.yellow }}>"{val}"</span>
                </div>
              ))}
              {Object.keys(textChecks).length > 5 && (
                <div className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                  +{Object.keys(textChecks).length - 5} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}