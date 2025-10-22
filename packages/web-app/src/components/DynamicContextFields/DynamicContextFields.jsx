// packages/web-app/src/components/DynamicContextFields/DynamicContextFields.jsx

import React, { useState } from 'react';
import './DynamicContextFields.css';

/**
 * DynamicContextFields - Generic context field editor
 * 
 * This component makes the system work with ANY project by dynamically
 * rendering whatever fields exist in the xstate context.
 * 
 * No more hardcoded booking fields! 🎉
 * 
 * @param {Object} contextData - Context fields from xstate config
 * @param {Function} onFieldChange - Callback: (fieldName, newValue) => void
 * @param {Object} theme - Theme colors
 * @param {boolean} editable - Whether fields can be edited
 * @param {boolean} compact - Compact display mode
 */
export default function DynamicContextFields({ 
  contextData = {}, 
  onFieldChange,
  theme,
  editable = true,
  compact = false
}) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState(null);

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

  // ========================================
  // EDIT HANDLERS
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
  console.log('💾 saveEdit called!');
  console.log('Field:', fieldName);
  console.log('Type:', type);
  console.log('Edit value:', editValue);
  console.log('onFieldChange exists?', typeof onFieldChange);
  
  if (!onFieldChange) {
    console.error('❌ onFieldChange is not defined!');
    return;
  }
  
    let parsedValue;
    
    try {
      // Parse based on type
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
    parsedValue = editValue;  // String
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

      // Call the parent's change handler
      onFieldChange(fieldName, parsedValue);
      
      // Clear edit state
      setEditingField(null);
      setEditValue('');
      setEditError(null);
      
    } catch (error) {
      setEditError(`Invalid ${type}: ${error.message}`);
    }
  };

  // Handle Enter key to save
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
        <div 
          className="field-value-display group"
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
            position: 'relative'
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
          
          {editable && (
            <span 
              className="edit-hint"
              style={{ 
                color: theme.colors.text.tertiary, 
                fontSize: '11px',
                marginLeft: '12px',
                opacity: 0,
                transition: 'opacity 0.2s'
              }}
            >
              ✏️ Edit
            </span>
          )}
        </div>
      );
    }

    // ✏️ EDIT MODE
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Input based on type */}
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
        
        {/* Error message */}
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
        
        {/* Save/Cancel buttons */}
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
        
        {/* Helper text */}
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

  if (fields.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: theme.colors.text.tertiary,
        background: `${theme.colors.background.tertiary}60`,
        borderRadius: '12px',
        border: `1px dashed ${theme.colors.border}`
      }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          No Context Fields
        </div>
        <div style={{ fontSize: '13px', opacity: 0.7 }}>
          This state machine has no context defined
        </div>
      </div>
    );
  }

  return (
    <div className="dynamic-context-fields" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: compact ? '12px' : '16px' 
    }}>
      {fields.map(([fieldName, fieldValue]) => {
        const type = detectFieldType(fieldValue);
        const typeColor = getTypeColor(type);
        const typeIcon = getTypeIcon(type);

        return (
          <div key={fieldName} className="context-field-group">
            {/* Field Label */}
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
              
              {/* Type badge */}
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
            
            {/* Field Value/Input */}
            {renderFieldInput(fieldName, fieldValue, type)}
          </div>
        );
      })}
    </div>
  );
}