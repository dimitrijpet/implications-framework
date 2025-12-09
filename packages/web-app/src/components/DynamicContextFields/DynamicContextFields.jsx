// packages/web-app/src/components/DynamicContextFields/DynamicContextFields.jsx
// ENHANCED VERSION with Add/Delete functionality

import React, { useState } from 'react';
import './DynamicContextFields.css';

/**
 * DynamicContextFields - Generic context field editor with Add/Delete
 * 
 * NEW FEATURES:
 * ✨ Add new context fields with type selector
 * 🗑️ Delete fields with confirmation
 * 🎯 Auto-suggest from mirrorsOn variables
 * ✅ Validation (no duplicates, valid JS identifiers)
 * 
 * @param {Object} contextData - Context fields from xstate config
 * @param {Function} onFieldChange - Callback: (fieldName, newValue) => void
 * @param {Function} onFieldAdd - NEW: (fieldName, initialValue, type) => void
 * @param {Function} onFieldDelete - NEW: (fieldName) => void
 * @param {Array} suggestedFields - NEW: [{name, reason, from: 'mirrorsOn'}]
 * @param {Object} theme - Theme colors
 * @param {boolean} editable - Whether fields can be edited
 * @param {boolean} compact - Compact display mode
 */
export default function DynamicContextFields({ 
  contextData = {}, 
  onFieldChange,
  onFieldAdd,
  onFieldDelete,
  suggestedFields = [],
  theme,
  editable = true,
  compact = false
}) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState(null);
  
  // Add field state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('null');
  const [addFieldError, setAddFieldError] = useState(null);

  // ========================================
  // FIELD TYPE DETECTION
  // ========================================

  const detectFieldType = (value) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  };

  const formatValue = (value, type) => {
    if (value === null || value === undefined) return 'null';
    if (type === 'array') return JSON.stringify(value, null, 2);
    if (type === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getInitialValueForType = (type) => {
    switch (type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'array': return [];
      case 'object': return {};
      case 'null': 
      default: return null;
    }
  };

  // ========================================
  // VALIDATION
  // ========================================

  const isValidJSIdentifier = (name) => {
    // Must start with letter, $, or _
    // Can contain letters, numbers, $, _
    const pattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    return pattern.test(name);
  };

  const validateFieldName = (name) => {
    if (!name || name.trim() === '') {
      return 'Field name is required';
    }
    
    if (!isValidJSIdentifier(name)) {
      return 'Invalid field name. Must start with letter, $, or _ and contain only letters, numbers, $, _';
    }
    
    if (contextData.hasOwnProperty(name)) {
      return 'Field already exists';
    }
    
    // Reserved JS keywords
    const reserved = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 
                     'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 
                     'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 
                     'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 
                     'void', 'while', 'with', 'yield'];
    if (reserved.includes(name)) {
      return 'Cannot use reserved JavaScript keyword';
    }
    
    return null;
  };

  // ========================================
  // ADD FIELD HANDLERS
  // ========================================

  const handleShowAddForm = () => {
    setShowAddForm(true);
    setNewFieldName('');
    setNewFieldType('null');
    setAddFieldError(null);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewFieldName('');
    setNewFieldType('null');
    setAddFieldError(null);
  };

  const handleAddField = () => {
    const error = validateFieldName(newFieldName);
    if (error) {
      setAddFieldError(error);
      return;
    }

    const initialValue = getInitialValueForType(newFieldType);
    
    if (onFieldAdd) {
      onFieldAdd(newFieldName, initialValue, newFieldType);
    }

    // Reset form
    setShowAddForm(false);
    setNewFieldName('');
    setNewFieldType('null');
    setAddFieldError(null);
  };

  const handleAddSuggestedField = (fieldName) => {
    if (onFieldAdd) {
      onFieldAdd(fieldName, null, 'null');
    }
  };

  const handleAddAllSuggested = () => {
    if (onFieldAdd && suggestedFields.length > 0) {
      suggestedFields.forEach(field => {
        if (!contextData.hasOwnProperty(field.name)) {
          onFieldAdd(field.name, null, 'null');
        }
      });
    }
  };

  // ========================================
  // DELETE FIELD HANDLERS
  // ========================================

  const handleDeleteField = (fieldName) => {
    if (!window.confirm(`Delete field "${fieldName}"?\n\nThis will remove it from the xstateConfig.context.`)) {
      return;
    }

    if (onFieldDelete) {
      onFieldDelete(fieldName);
    }
  };

  // ========================================
  // EDIT HANDLERS (from original)
  // ========================================

  const startEditing = (fieldName, currentValue, type) => {
    if (!editable) return;
    
    setEditingField(fieldName);
    setEditValue(formatValue(currentValue, type));
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
    setEditError(null);
  };

  const saveEdit = (fieldName, type) => {
    if (!onFieldChange) {
      console.error('❌ onFieldChange is not defined!');
      return;
    }
  
    let parsedValue;
    
    try {
      switch (type) {
        case 'number':
          if (editValue === '' || editValue === 'null') {
            parsedValue = null;
          } else {
            parsedValue = Number(editValue);
            if (isNaN(parsedValue)) {
              throw new Error('Invalid number');
            }
          }
          break;
          
        case 'boolean':
          parsedValue = editValue === 'true' || editValue === true;
          break;
          
        case 'null':
          if (editValue === '' || editValue === 'null') {
            parsedValue = null;
          } else if (editValue === 'true' || editValue === 'false') {
            parsedValue = editValue === 'true';
          } else if (!isNaN(editValue) && editValue !== '') {
            parsedValue = Number(editValue);
          } else {
            parsedValue = editValue;
          }
          break;
          
        case 'array':
          parsedValue = JSON.parse(editValue);
          if (!Array.isArray(parsedValue)) {
            throw new Error('Not a valid array');
          }
          break;
          
        case 'object':
          parsedValue = JSON.parse(editValue);
          if (typeof parsedValue !== 'object' || parsedValue === null) {
            throw new Error('Not a valid object');
          }
          break;
          
        case 'string':
        default:
          parsedValue = editValue;
      }

      onFieldChange(fieldName, parsedValue);
      setEditingField(null);
      setEditValue('');
      setEditError(null);
      
    } catch (error) {
      setEditError(`Invalid ${type}: ${error.message}`);
    }
  };

  const handleKeyDown = (e, fieldName, type) => {
    if (e.key === 'Enter' && type !== 'array' && type !== 'object') {
      e.preventDefault();
      saveEdit(fieldName, type);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // ========================================
  // RENDER FUNCTIONS
  // ========================================

  const renderFieldInput = (fieldName, value, type) => {
    const isEditing = editingField === fieldName;

    if (!isEditing) {
      // 📺 DISPLAY MODE
      return (
        <div className="relative group">
          <div 
            className="field-value-display"
            onClick={() => editable && startEditing(fieldName, value, type)}
            style={{
              padding: compact ? '8px 12px' : '12px 16px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              cursor: editable ? 'pointer' : 'default',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: compact ? '38px' : '48px',
              transition: 'all 0.2s ease',
              paddingRight: editable ? '80px' : '16px' // Space for buttons
            }}
          >
            <span style={{ 
              color: value === null || value === undefined 
                ? theme.colors.accents.red 
                : theme.colors.text.primary,
              fontFamily: (type === 'object' || type === 'array') ? 'monospace' : 'inherit',
              fontSize: compact ? '13px' : '14px',
              whiteSpace: 'pre-wrap',
              flex: 1,
              wordBreak: 'break-word'
            }}>
              {value === null || value === undefined ? (
                <span style={{ 
                  color: theme.colors.accents.red,
                  fontWeight: 600 
                }}>
                  ⚠️ Not Set
                </span>
              ) : (
                formatValue(value, type)
              )}
            </span>
          </div>
          
          {/* Hover Actions */}
          {editable && (
            <div 
              className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => startEditing(fieldName, value, type)}
                className="hover:brightness-110 transition"
                style={{
                  padding: '4px 8px',
                  background: theme.colors.accents.blue,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Edit field value"
              >
                ✏️ Edit
              </button>
              
              {onFieldDelete && (
                <button
                  onClick={() => handleDeleteField(fieldName)}
                  className="hover:brightness-110 transition"
                  style={{
                    padding: '4px 8px',
                    background: theme.colors.accents.red,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Delete field"
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    // ✏️ EDIT MODE (same as original)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {type === 'boolean' ? (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, fieldName, type)}
            autoFocus
            style={{
              padding: '10px 12px',
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `2px solid ${theme.colors.primary}`,
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : type === 'object' || type === 'array' ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, fieldName, type)}
            autoFocus
            rows={8}
            placeholder={type === 'array' ? '["item1", "item2"]' : '{ "key": "value" }'}
            style={{
              padding: '10px 12px',
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `2px solid ${theme.colors.primary}`,
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '13px',
              resize: 'vertical',
              outline: 'none'
            }}
          />
        ) : (
          <input
            type={type === 'number' ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, fieldName, type)}
            placeholder={type === 'null' ? 'null' : `Enter ${type}...`}
            autoFocus
            style={{
              padding: '10px 12px',
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `2px solid ${theme.colors.primary}`,
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        )}
        
        {editError && (
          <div style={{
            padding: '8px 12px',
            background: `${theme.colors.accents.red}20`,
            border: `1px solid ${theme.colors.accents.red}`,
            borderRadius: '6px',
            color: theme.colors.accents.red,
            fontSize: '12px',
            fontWeight: 600
          }}>
            ⚠️ {editError}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => saveEdit(fieldName, type)}
            style={{
              flex: 1,
              padding: '10px',
              background: theme.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.filter = 'brightness(1.1)'}
            onMouseOut={(e) => e.target.style.filter = 'brightness(1)'}
          >
            ✓ Save
          </button>
          <button
            onClick={cancelEditing}
            style={{
              flex: 1,
              padding: '10px',
              background: theme.colors.background.tertiary,
              color: theme.colors.text.secondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = theme.colors.background.secondary}
            onMouseOut={(e) => e.target.style.background = theme.colors.background.tertiary}
          >
            ✕ Cancel
          </button>
        </div>
        
        <div style={{
          fontSize: '11px',
          color: theme.colors.text.tertiary,
          fontStyle: 'italic'
        }}>
          {type === 'object' || type === 'array' 
            ? 'Enter valid JSON' 
            : type === 'number'
            ? 'Press Enter to save, Esc to cancel'
            : 'Press Enter to save'}
        </div>
      </div>
    );
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'string': return '📝';
      case 'number': return '🔢';
      case 'boolean': return '☑️';
      case 'array': return '📋';
      case 'object': return '📦';
      case 'null': return '⭘';
      default: return '❓';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'string': return theme.colors.accents.blue;
      case 'number': return theme.colors.accents.purple;
      case 'boolean': return theme.colors.accents.green;
      case 'array': return theme.colors.accents.orange;
      case 'object': return theme.colors.accents.yellow;
      default: return theme.colors.text.tertiary;
    }
  };

  // ========================================
  // MAIN RENDER
  // ========================================

  const fields = Object.entries(contextData);
  const hasSuggestions = suggestedFields.length > 0;

  return (
    <div className="dynamic-context-fields" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: compact ? '12px' : '16px' 
    }}>
      {/* Suggested Fields Banner */}
      {hasSuggestions && editable && onFieldAdd && (
        <div style={{
          padding: '16px',
          background: `${theme.colors.accents.blue}15`,
          border: `2px solid ${theme.colors.accents.blue}`,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: theme.colors.accents.blue,
                marginBottom: '4px'
              }}>
                💡 Suggested Fields from UI Checks
              </div>
              <div style={{ fontSize: '12px', color: theme.colors.text.secondary }}>
                These fields are used in mirrorsOn but not in context
              </div>
            </div>
            
            <button
              onClick={handleAddAllSuggested}
              style={{
                padding: '8px 16px',
                background: theme.colors.accents.blue,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                whiteSpace: 'nowrap'
              }}
              className="hover:brightness-110 transition"
            >
              ✨ Add All ({suggestedFields.length})
            </button>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {suggestedFields.map(field => (
              <button
                key={field.name}
                onClick={() => handleAddSuggestedField(field.name)}
                style={{
                  padding: '6px 12px',
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.accents.blue}`,
                  borderRadius: '6px',
                  color: theme.colors.text.primary,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                className="hover:brightness-110 transition"
                title={field.reason}
              >
                <span style={{ fontWeight: 600 }}>{field.name}</span>
                <span style={{ color: theme.colors.text.tertiary, fontSize: '11px' }}>
                  ({field.from})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing Fields */}
      {fields.length > 0 && fields.map(([fieldName, fieldValue]) => {
        const type = detectFieldType(fieldValue);
        const typeColor = getTypeColor(type);
        const typeIcon = getTypeIcon(type);

        return (
          <div key={fieldName} className="context-field-group">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <label style={{ 
                color: theme.colors.text.primary, 
                fontWeight: 600,
                fontSize: compact ? '13px' : '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {fieldName}
              </label>
              
              <span style={{ 
                fontSize: '11px',
                padding: '3px 8px',
                background: `${typeColor}20`,
                border: `1px solid ${typeColor}`,
                borderRadius: '4px',
                color: typeColor,
                fontWeight: 600,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {typeIcon} {type}
              </span>
            </div>
            
            {renderFieldInput(fieldName, fieldValue, type)}
          </div>
        );
      })}

      {/* Add Field Form */}
      {showAddForm && editable && onFieldAdd && (
        <div style={{
          padding: '16px',
          background: theme.colors.background.secondary,
          border: `2px solid ${theme.colors.primary}`,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 600, 
            color: theme.colors.primary 
          }}>
            ➕ Add New Context Field
          </div>
          
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '13px',
              fontWeight: 600,
              color: theme.colors.text.primary 
            }}>
              Field Name
            </label>
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => {
                setNewFieldName(e.target.value);
                setAddFieldError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddField();
                if (e.key === 'Escape') handleCancelAdd();
              }}
              placeholder="e.g., username, sessionToken, status"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `2px solid ${addFieldError ? theme.colors.accents.red : theme.colors.primary}`,
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            {addFieldError && (
              <div style={{
                marginTop: '6px',
                padding: '6px 10px',
                background: `${theme.colors.accents.red}20`,
                border: `1px solid ${theme.colors.accents.red}`,
                borderRadius: '6px',
                color: theme.colors.accents.red,
                fontSize: '12px'
              }}>
                ⚠️ {addFieldError}
              </div>
            )}
          </div>
          
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '13px',
              fontWeight: 600,
              color: theme.colors.text.primary 
            }}>
              Initial Type
            </label>
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `2px solid ${theme.colors.primary}`,
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="null">Null (to be set later)</option>
              <option value="string">String ("")</option>
              <option value="number">Number (0)</option>
              <option value="boolean">Boolean (false)</option>
              <option value="array">Array ([])</option>
              <option value="object">Object ({})</option>
            </select>
          </div>
          
          <div style={{ 
            fontSize: '12px', 
            color: theme.colors.text.tertiary,
            fontStyle: 'italic',
            padding: '8px',
            background: `${theme.colors.background.tertiary}80`,
            borderRadius: '6px'
          }}>
            💡 Tip: Choose "Null" for fields that will be set by entry actions (like sessionToken, acceptedAt).
            Choose specific types for fields with known values (like status, role).
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAddField}
              style={{
                flex: 1,
                padding: '12px',
                background: theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
              className="hover:brightness-110 transition"
            >
              ✓ Add Field
            </button>
            <button
              onClick={handleCancelAdd}
              style={{
                flex: 1,
                padding: '12px',
                background: theme.colors.background.tertiary,
                color: theme.colors.text.secondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              className="hover:brightness-110 transition"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Field Button */}
      {!showAddForm && editable && onFieldAdd && (
        <button
          onClick={handleShowAddForm}
          style={{
            padding: '16px',
            background: `${theme.colors.primary}15`,
            border: `2px dashed ${theme.colors.primary}`,
            borderRadius: '12px',
            color: theme.colors.primary,
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          className="hover:brightness-110"
        >
          ➕ Add Context Field
        </button>
      )}

      {/* Empty State */}
      {fields.length === 0 && !showAddForm && (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: theme.colors.text.tertiary,
          background: `${theme.colors.background.tertiary}60`,
          borderRadius: '12px',
          border: `1px dashed ${theme.colors.border}`
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔭</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            No Context Fields
          </div>
          <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '16px' }}>
            This state machine has no context defined
          </div>
          {editable && onFieldAdd && (
            <button
              onClick={handleShowAddForm}
              style={{
                padding: '12px 24px',
                background: theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
              className="hover:brightness-110 transition"
            >
              ➕ Add Your First Field
            </button>
          )}
        </div>
      )}
    </div>
  );
}