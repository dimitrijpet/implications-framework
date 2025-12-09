// packages/web-app/src/components/CompositionEditor/CompositionEditor.jsx

import React, { useState, useEffect } from 'react';
import './CompositionEditor.css';

/**
 * CompositionEditor
 * 
 * Visual editor for changing composition patterns in Implication files
 * 
 * Features:
 * - Dropdown for base class selection
 * - Multi-select checkboxes for behaviors
 * - Preview mode (shows changes before writing)
 * - Save/Cancel with confirmation
 * - Loading states
 * 
 * @param {string} filePath - Absolute path to Implication file
 * @param {Object} currentComposition - Current composition from analysis
 * @param {Function} onSave - Callback after successful save
 * @param {Function} onCancel - Callback to exit edit mode
 * @param {Object} theme - Theme colors
 */
export default function CompositionEditor({
  filePath,
  currentComposition,
  onSave,
  onCancel,
  theme
}) {
  
  // State
  const [availableOptions, setAvailableOptions] = useState(null);
  const [selectedBaseClass, setSelectedBaseClass] = useState(currentComposition?.baseClass || null);
  const [selectedBehaviors, setSelectedBehaviors] = useState(
    currentComposition?.behaviors?.map(b => b.name) || []
  );
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  
  // Load available base classes and behaviors
  useEffect(() => {
    loadAvailableOptions();
  }, [filePath]);
  
  const loadAvailableOptions = async () => {
    setIsLoadingOptions(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/implications/available-compositions?filePath=${encodeURIComponent(filePath)}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to load options: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load options');
      }
      
      setAvailableOptions(data);
      
    } catch (err) {
      console.error('Error loading options:', err);
      setError(err.message);
    } finally {
      setIsLoadingOptions(false);
    }
  };
  
  // Handle base class change
  const handleBaseClassChange = (e) => {
    const value = e.target.value;
    setSelectedBaseClass(value === 'none' ? null : value);
    setPreviewData(null); // Clear preview when changing
  };
  
  // Handle behavior toggle
  const handleBehaviorToggle = (behaviorName) => {
    setSelectedBehaviors(prev => {
      if (prev.includes(behaviorName)) {
        return prev.filter(b => b !== behaviorName);
      } else {
        return [...prev, behaviorName];
      }
    });
    setPreviewData(null); // Clear preview when changing
  };
  
  // Preview changes
  const handlePreview = async () => {
    setIsPreviewMode(true);
    setError(null);
    
    try {
      const response = await fetch('/api/implications/update-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          config: {
            baseClass: selectedBaseClass,
            behaviors: selectedBehaviors
          },
          preview: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Preview failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Preview failed');
      }
      
      setPreviewData(data.preview);
      
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.message);
      setIsPreviewMode(false);
    }
  };
  
  // Save changes
  const handleSave = async () => {
    if (!window.confirm('Save composition changes?\n\nA backup will be created automatically.')) {
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch('/api/implications/update-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          config: {
            baseClass: selectedBaseClass,
            behaviors: selectedBehaviors
          },
          preview: false
        })
      });
      
      if (!response.ok) {
        throw new Error(`Save failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Save failed');
      }
      
      console.log('✅ Composition saved successfully!');
      console.log('📦 Backup:', data.backupPath);
      
      // Call onSave callback
      if (onSave) {
        onSave(data);
      }
      
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Check if there are changes
  const hasChanges = () => {
    const currentBehaviorNames = currentComposition?.behaviors?.map(b => b.name) || [];
    const currentBase = currentComposition?.baseClass || null;
    
    const baseChanged = selectedBaseClass !== currentBase;
    const behaviorsChanged = 
      selectedBehaviors.length !== currentBehaviorNames.length ||
      selectedBehaviors.some(b => !currentBehaviorNames.includes(b)) ||
      currentBehaviorNames.some(b => !selectedBehaviors.includes(b));
    
    return baseChanged || behaviorsChanged;
  };
  
  // Render loading state
  if (isLoadingOptions) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: theme.colors.text.secondary
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <div>Loading available options...</div>
      </div>
    );
  }
  
  // Render error state
  if (error && !availableOptions) {
    return (
      <div style={{
        padding: '24px',
        background: `${theme.colors.accents.red}20`,
        border: `2px solid ${theme.colors.accents.red}`,
        borderRadius: '12px',
        color: theme.colors.accents.red
      }}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>❌ Error</div>
        <div style={{ marginBottom: '16px' }}>{error}</div>
        <button
          onClick={loadAvailableOptions}
          style={{
            padding: '8px 16px',
            background: theme.colors.accents.red,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  
  // Main render
  return (
    <div className="composition-editor" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '16px',
        borderBottom: `2px solid ${theme.colors.border}`
      }}>
        <div>
          <div style={{
            fontSize: '20px',
            fontWeight: 700,
            color: theme.colors.primary,
            marginBottom: '4px'
          }}>
            ✏️ Edit Composition
          </div>
          <div style={{
            fontSize: '13px',
            color: theme.colors.text.tertiary
          }}>
            Change base class and behaviors
          </div>
        </div>
        
        {hasChanges() && (
          <div style={{
            padding: '6px 12px',
            background: `${theme.colors.accents.orange}20`,
            border: `1px solid ${theme.colors.accents.orange}`,
            borderRadius: '6px',
            color: theme.colors.accents.orange,
            fontSize: '12px',
            fontWeight: 600
          }}>
            ⚠️ Unsaved Changes
          </div>
        )}
      </div>
      
      {/* Base Class Selection */}
      <div>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: 600,
          color: theme.colors.text.primary
        }}>
          📦 Base Class
        </label>
        
        <select
          value={selectedBaseClass || 'none'}
          onChange={handleBaseClassChange}
          style={{
            width: '100%',
            padding: '12px',
            background: theme.colors.background.tertiary,
            color: theme.colors.text.primary,
            border: `2px solid ${theme.colors.border}`,
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="none">None (Standalone)</option>
          {availableOptions?.baseClasses?.map(baseClass => (
            <option key={baseClass} value={baseClass}>
              {baseClass}
            </option>
          ))}
        </select>
        
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: theme.colors.text.tertiary,
          fontStyle: 'italic'
        }}>
          💡 Base class provides shared screen definitions via ImplicationHelper.mergeWithBase()
        </div>
      </div>
      
      {/* Behaviors Selection */}
      <div>
        <label style={{
          display: 'block',
          marginBottom: '12px',
          fontSize: '14px',
          fontWeight: 600,
          color: theme.colors.text.primary
        }}>
          🧩 Behaviors ({selectedBehaviors.length} selected)
        </label>
        
        <div style={{
          maxHeight: '300px',
          overflowY: 'auto',
          background: theme.colors.background.tertiary,
          border: `2px solid ${theme.colors.border}`,
          borderRadius: '8px',
          padding: '12px'
        }}>
          {availableOptions?.behaviors?.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.text.tertiary
            }}>
              No behaviors available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {availableOptions?.behaviors?.map(behavior => (
                <label
                  key={behavior}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    background: selectedBehaviors.includes(behavior)
                      ? `${theme.colors.primary}20`
                      : theme.colors.background.secondary,
                    border: `1px solid ${
                      selectedBehaviors.includes(behavior)
                        ? theme.colors.primary
                        : theme.colors.border
                    }`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 
                    selectedBehaviors.includes(behavior)
                      ? `${theme.colors.primary}30`
                      : theme.colors.background.tertiary
                  }
                  onMouseOut={(e) => e.currentTarget.style.background = 
                    selectedBehaviors.includes(behavior)
                      ? `${theme.colors.primary}20`
                      : theme.colors.background.secondary
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedBehaviors.includes(behavior)}
                    onChange={() => handleBehaviorToggle(behavior)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{
                    flex: 1,
                    fontSize: '13px',
                    fontWeight: selectedBehaviors.includes(behavior) ? 600 : 400,
                    color: theme.colors.text.primary
                  }}>
                    {behavior}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: theme.colors.text.tertiary,
          fontStyle: 'italic'
        }}>
          💡 Behaviors are composed via spread operators (...BehaviorImplications.mirrorsOn.UI)
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: `${theme.colors.accents.red}20`,
          border: `1px solid ${theme.colors.accents.red}`,
          borderRadius: '8px',
          color: theme.colors.accents.red,
          fontSize: '13px',
          fontWeight: 600
        }}>
          ⚠️ {error}
        </div>
      )}
      
      {/* Preview Panel */}
      {isPreviewMode && previewData && (
        <div style={{
          padding: '16px',
          background: theme.colors.background.secondary,
          border: `2px solid ${theme.colors.primary}`,
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 600,
            color: theme.colors.primary,
            marginBottom: '12px'
          }}>
            👁️ Preview Changes
          </div>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '13px'
          }}>
            {/* Module System */}
            <div>
              <span style={{ color: theme.colors.text.secondary }}>Module System: </span>
              <span style={{ 
                fontWeight: 600,
                color: theme.colors.text.primary,
                fontFamily: 'monospace'
              }}>
                {previewData.changes.moduleSystem}
              </span>
            </div>
            
            {/* Added Imports */}
            {previewData.changes.imports.added.length > 0 && (
              <div>
                <div style={{ 
                  color: theme.colors.accents.green,
                  fontWeight: 600,
                  marginBottom: '6px'
                }}>
                  ➕ Adding Imports:
                </div>
                {previewData.changes.imports.added.map((imp, i) => (
                  <div key={i} style={{
                    padding: '6px 10px',
                    background: `${theme.colors.accents.green}15`,
                    border: `1px solid ${theme.colors.accents.green}`,
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: theme.colors.accents.green
                  }}>
                    {imp}
                  </div>
                ))}
              </div>
            )}
            
            {/* Removed Imports */}
            {previewData.changes.imports.removed.length > 0 && (
              <div>
                <div style={{ 
                  color: theme.colors.accents.red,
                  fontWeight: 600,
                  marginBottom: '6px'
                }}>
                  ➖ Removing Imports:
                </div>
                {previewData.changes.imports.removed.map((imp, i) => (
                  <div key={i} style={{
                    padding: '6px 10px',
                    background: `${theme.colors.accents.red}15`,
                    border: `1px solid ${theme.colors.accents.red}`,
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: theme.colors.accents.red,
                    textDecoration: 'line-through'
                  }}>
                    {imp}
                  </div>
                ))}
              </div>
            )}
            
            {/* MergeWithBase Changes */}
            {previewData.changes.mergeWithBase !== 'No changes' && (
              <div>
                <div style={{ 
                  color: theme.colors.accents.blue,
                  fontWeight: 600,
                  marginBottom: '6px'
                }}>
                  🔄 MergeWithBase:
                </div>
                <div style={{
                  padding: '6px 10px',
                  background: `${theme.colors.accents.blue}15`,
                  border: `1px solid ${theme.colors.accents.blue}`,
                  borderRadius: '4px',
                  color: theme.colors.accents.blue
                }}>
                  {previewData.changes.mergeWithBase}
                </div>
              </div>
            )}
            
            {/* Spread Operators */}
            {previewData.changes.spreadOperators.length > 0 && (
              <div>
                <div style={{ 
                  color: theme.colors.accents.purple,
                  fontWeight: 600,
                  marginBottom: '6px'
                }}>
                  📋 Spread Operators:
                </div>
                {previewData.changes.spreadOperators.map((op, i) => (
                  <div key={i} style={{
                    padding: '6px 10px',
                    background: `${theme.colors.accents.purple}15`,
                    border: `1px solid ${theme.colors.accents.purple}`,
                    borderRadius: '4px',
                    color: theme.colors.accents.purple
                  }}>
                    {op}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={() => setIsPreviewMode(false)}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              background: theme.colors.background.tertiary,
              color: theme.colors.text.secondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Close Preview
          </button>
        </div>
      )}
      
      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        paddingTop: '16px',
        borderTop: `2px solid ${theme.colors.border}`
      }}>
        <button
          onClick={handlePreview}
          disabled={!hasChanges() || isSaving}
          style={{
            flex: 1,
            padding: '12px',
            background: hasChanges() 
              ? theme.colors.accents.blue
              : theme.colors.background.tertiary,
            color: hasChanges() ? 'white' : theme.colors.text.tertiary,
            border: 'none',
            borderRadius: '8px',
            cursor: hasChanges() ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          className="hover:brightness-110"
        >
          👁️ Preview Changes
        </button>
        
        <button
          onClick={handleSave}
          disabled={!hasChanges() || isSaving}
          style={{
            flex: 1,
            padding: '12px',
            background: hasChanges() 
              ? theme.colors.primary
              : theme.colors.background.tertiary,
            color: hasChanges() ? 'white' : theme.colors.text.tertiary,
            border: 'none',
            borderRadius: '8px',
            cursor: hasChanges() ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          className="hover:brightness-110"
        >
          {isSaving ? '⏳ Saving...' : '💾 Save Changes'}
        </button>
        
        <button
          onClick={onCancel}
          disabled={isSaving}
          style={{
            flex: 1,
            padding: '12px',
            background: theme.colors.background.tertiary,
            color: theme.colors.text.secondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          className="hover:brightness-110"
        >
          ✕ Cancel
        </button>
      </div>
      
      {/* Info Box */}
      <div style={{
        padding: '12px 16px',
        background: `${theme.colors.accents.blue}10`,
        border: `1px solid ${theme.colors.accents.blue}`,
        borderRadius: '8px',
        fontSize: '12px',
        color: theme.colors.text.secondary
      }}>
        <div style={{ fontWeight: 600, marginBottom: '4px', color: theme.colors.accents.blue }}>
          💡 How it works:
        </div>
        <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
          <li>Changes modify the actual file via AST manipulation</li>
          <li>A timestamped backup is created automatically</li>
          <li>Preview shows exact changes before writing</li>
          <li>Refresh the page after saving to see updates</li>
        </ul>
      </div>
    </div>
  );
}