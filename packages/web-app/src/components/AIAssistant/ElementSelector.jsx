// packages/web-app/src/components/AIAssistant/ElementSelector.jsx

import { useState, useMemo } from 'react';

const API_URL = 'http://localhost:3000';

export default function ElementSelector({ 
  elements = [], 
  screenshot,
  onElementsChange,
  onRescan,
  theme 
}) {
  const [selectedIds, setSelectedIds] = useState(() => 
    new Set(elements.map((_, i) => i))
  );
  const [editingId, setEditingId] = useState(null);
  const [localElements, setLocalElements] = useState(elements);
  const [rescanPrompt, setRescanPrompt] = useState('');
  const [rescanning, setRescanning] = useState(false);

  // Sync when elements prop changes
  useMemo(() => {
    setLocalElements(elements);
    setSelectedIds(new Set(elements.map((_, i) => i)));
  }, [elements]);

  const toggleElement = (index) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIds(newSelected);
    
    // Notify parent of selected elements
    if (onElementsChange) {
      const selected = localElements.filter((_, i) => newSelected.has(i));
      onElementsChange(selected);
    }
  };

  const selectAll = () => {
    const all = new Set(localElements.map((_, i) => i));
    setSelectedIds(all);
    if (onElementsChange) {
      onElementsChange(localElements);
    }
  };

  const selectNone = () => {
    setSelectedIds(new Set());
    if (onElementsChange) {
      onElementsChange([]);
    }
  };

  const selectByType = (type) => {
    const matching = new Set(
      localElements
        .map((el, i) => el.type === type ? i : null)
        .filter(i => i !== null)
    );
    setSelectedIds(matching);
    if (onElementsChange) {
      onElementsChange(localElements.filter((_, i) => matching.has(i)));
    }
  };

  const updateElement = (index, updates) => {
    const newElements = [...localElements];
    newElements[index] = { ...newElements[index], ...updates };
    setLocalElements(newElements);
    
    if (onElementsChange && selectedIds.has(index)) {
      const selected = newElements.filter((_, i) => selectedIds.has(i));
      onElementsChange(selected);
    }
  };

  const deleteElement = (index) => {
    const newElements = localElements.filter((_, i) => i !== index);
    setLocalElements(newElements);
    
    // Update selected IDs
    const newSelected = new Set();
    selectedIds.forEach(id => {
      if (id < index) newSelected.add(id);
      else if (id > index) newSelected.add(id - 1);
    });
    setSelectedIds(newSelected);
    
    if (onElementsChange) {
      onElementsChange(newElements.filter((_, i) => newSelected.has(i)));
    }
  };

  const handleRescan = async () => {
    if (!onRescan) return;
    
    setRescanning(true);
    try {
      await onRescan(rescanPrompt);
      setRescanPrompt('');
    } finally {
      setRescanning(false);
    }
  };

  // Get unique types for filter buttons
  const types = [...new Set(localElements.map(el => el.type))];
  const selectedCount = selectedIds.size;

  return (
    <div>
      {/* Header with selection controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 600,
          color: theme.colors.text.primary 
        }}>
          🎯 {selectedCount}/{localElements.length} elements selected
        </div>
        
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={selectAll}
            style={filterBtnStyle(theme, false)}
          >
            All
          </button>
          <button
            onClick={selectNone}
            style={filterBtnStyle(theme, false)}
          >
            None
          </button>
          {types.map(type => (
            <button
              key={type}
              onClick={() => selectByType(type)}
              style={filterBtnStyle(theme, false)}
            >
              {getTypeIcon(type)} {type}
            </button>
          ))}
        </div>
      </div>

      {/* Elements list */}
      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px'
      }}>
        {localElements.map((element, idx) => (
          <ElementRow
            key={idx}
            element={element}
            index={idx}
            selected={selectedIds.has(idx)}
            editing={editingId === idx}
            theme={theme}
            onToggle={() => toggleElement(idx)}
            onEdit={() => setEditingId(editingId === idx ? null : idx)}
            onUpdate={(updates) => updateElement(idx, updates)}
            onDelete={() => deleteElement(idx)}
          />
        ))}
      </div>

      {/* Rescan section */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: `${theme.colors.accents.blue}10`,
        borderRadius: '8px'
      }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: theme.colors.text.primary,
          marginBottom: '8px'
        }}>
          🔍 Scan for More Elements
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={rescanPrompt}
            onChange={(e) => setRescanPrompt(e.target.value)}
            placeholder="Focus on... (e.g., 'navigation links', 'form inputs', 'footer')"
            style={{
              flex: 1,
              padding: '10px 12px',
              background: theme.colors.background.secondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              color: theme.colors.text.primary,
              fontSize: '13px'
            }}
          />
          <button
            onClick={handleRescan}
            disabled={rescanning}
            style={{
              padding: '10px 16px',
              background: rescanning 
                ? theme.colors.background.tertiary 
                : theme.colors.accents.blue,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: rescanning ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              whiteSpace: 'nowrap'
            }}
          >
            {rescanning ? '⏳' : '🔍'} Rescan
          </button>
        </div>
        
        <div style={{
          marginTop: '8px',
          fontSize: '11px',
          color: theme.colors.text.tertiary
        }}>
          💡 Quick prompts: 
          {['navigation', 'buttons', 'inputs', 'links', 'images'].map(prompt => (
            <button
              key={prompt}
              onClick={() => setRescanPrompt(`Focus on ${prompt}`)}
              style={{
                marginLeft: '6px',
                padding: '2px 6px',
                background: theme.colors.background.tertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '3px',
                fontSize: '10px',
                color: theme.colors.text.secondary,
                cursor: 'pointer'
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Individual element row component
function ElementRow({ 
  element, 
  index, 
  selected, 
  editing, 
  theme, 
  onToggle, 
  onEdit, 
  onUpdate,
  onDelete 
}) {
  const [localName, setLocalName] = useState(element.name);
  const [localSelector, setLocalSelector] = useState(
    element.selectors?.[0]?.value || ''
  );

  const saveEdits = () => {
    onUpdate({
      name: localName,
      selectors: [{
        ...element.selectors?.[0],
        value: localSelector
      }]
    });
    onEdit(); // Close editing
  };

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: `1px solid ${theme.colors.border}`,
      background: selected 
        ? `${theme.colors.accents.green}08`
        : theme.colors.background.secondary,
      transition: 'background 0.2s'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          style={{ 
            width: '18px', 
            height: '18px',
            cursor: 'pointer'
          }}
        />

        {/* Type icon */}
        <span style={{
          width: '28px',
          height: '28px',
          borderRadius: '4px',
          background: getTypeColor(element.type, theme),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          flexShrink: 0
        }}>
          {getTypeIcon(element.type)}
        </span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Element name"
                style={{
                  padding: '6px 8px',
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.accents.blue}`,
                  borderRadius: '4px',
                  color: theme.colors.text.primary,
                  fontSize: '13px',
                  fontWeight: 600
                }}
              />
              <input
                type="text"
                value={localSelector}
                onChange={(e) => setLocalSelector(e.target.value)}
                placeholder="Selector"
                style={{
                  padding: '6px 8px',
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  color: theme.colors.text.primary,
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={saveEdits}
                  style={{
                    padding: '4px 10px',
                    background: theme.colors.accents.green,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  ✓ Save
                </button>
                <button
                  onClick={onEdit}
                  style={{
                    padding: '4px 10px',
                    background: theme.colors.background.tertiary,
                    color: theme.colors.text.secondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{
                fontWeight: 600,
                color: theme.colors.text.primary,
                fontSize: '13px'
              }}>
                {element.name}
              </div>
              <div style={{
                fontSize: '11px',
                color: theme.colors.text.tertiary,
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {element.selectors?.[0]?.value || 'No selector'}
              </div>
            </>
          )}
        </div>

        {/* Type badge */}
        <span style={{
          padding: '2px 8px',
          background: `${theme.colors.accents.blue}20`,
          borderRadius: '4px',
          fontSize: '10px',
          color: theme.colors.accents.blue,
          flexShrink: 0
        }}>
          {element.type}
        </span>

        {/* Actions */}
        {!editing && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={onEdit}
              style={{
                padding: '4px 8px',
                background: theme.colors.background.tertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                fontSize: '11px',
                color: theme.colors.text.secondary,
                cursor: 'pointer'
              }}
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={onDelete}
              style={{
                padding: '4px 8px',
                background: `${theme.colors.accents.red}15`,
                border: `1px solid ${theme.colors.accents.red}30`,
                borderRadius: '4px',
                fontSize: '11px',
                color: theme.colors.accents.red,
                cursor: 'pointer'
              }}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getTypeIcon(type) {
  const icons = {
    button: '🔘',
    input: '📝',
    link: '🔗',
    text: '📄',
    image: '🖼️',
    checkbox: '☑️',
    select: '📋',
    heading: '📰',
    nav: '🧭',
    icon: '⭐'
  };
  return icons[type] || '◻️';
}

function getTypeColor(type, theme) {
  const colors = {
    button: theme.colors.accents.blue,
    input: theme.colors.accents.green,
    link: theme.colors.accents.purple,
    text: theme.colors.accents.yellow,
    image: theme.colors.accents.orange,
    checkbox: theme.colors.accents.cyan,
    select: theme.colors.accents.pink
  };
  return `${colors[type] || theme.colors.border}30`;
}

function filterBtnStyle(theme, active) {
  return {
    padding: '4px 10px',
    background: active ? theme.colors.accents.purple : theme.colors.background.tertiary,
    border: `1px solid ${active ? theme.colors.accents.purple : theme.colors.border}`,
    borderRadius: '4px',
    fontSize: '11px',
    color: active ? 'white' : theme.colors.text.secondary,
    cursor: 'pointer'
  };
}