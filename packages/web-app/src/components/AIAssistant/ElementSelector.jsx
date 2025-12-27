// packages/web-app/src/components/AIAssistant/ElementSelector.jsx

import { useState, useMemo } from 'react';

const API_URL = 'http://localhost:3000';

export default function ElementSelector({ 
  elements = [], 
  patterns = {},
  compoundMethods = [],
  screenshot,
  onElementsChange,
  onRescan,
  theme 
}) {
  console.log('🔍 ElementSelector props:', {
    elementsCount: elements.length,
    patterns,
    compoundMethodsCount: compoundMethods?.length,
    hasCompoundMethods: compoundMethods && compoundMethods.length > 0
  });
  const [selectedIds, setSelectedIds] = useState(() => 
    new Set(elements.map((_, i) => i))
  );
  const [editingId, setEditingId] = useState(null);
  const [localElements, setLocalElements] = useState(elements);
  const [rescanPrompt, setRescanPrompt] = useState('');
  const [rescanning, setRescanning] = useState(false);
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'flat'
  const [expandedGroups, setExpandedGroups] = useState(new Set(['unique', 'compound']));

  // Sync when elements prop changes
  useMemo(() => {
    setLocalElements(elements);
    setSelectedIds(new Set(elements.map((_, i) => i)));
  }, [elements]);

  // Group elements: unique vs covered by compound methods
  const groupedElements = useMemo(() => {
    const repeatedPrefixes = new Set(
      (patterns?.repeatedLabels || []).map(r => r.prefix.toLowerCase())
    );
    
    const unique = [];
    const coveredByCompound = [];
    
    localElements.forEach((el, idx) => {
      const labelPrefix = (el.label || '').split(',')[0].trim().toLowerCase();
      const isRepeated = repeatedPrefixes.has(labelPrefix);
      const hasGoodSelector = el._domMatched && el.selectorStrategy !== 'xpath-fallback';
      
      if (isRepeated && !hasGoodSelector) {
        coveredByCompound.push({ ...el, _idx: idx });
      } else {
        unique.push({ ...el, _idx: idx });
      }
    });
    
    return { unique, coveredByCompound };
  }, [localElements, patterns]);

  const toggleElement = (index) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIds(newSelected);
    
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

  const toggleGroup = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const types = [...new Set(localElements.map(el => el.type))];
  const selectedCount = selectedIds.size;
  const hasCompoundMethods = compoundMethods && compoundMethods.length > 0;

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
          {/* View mode toggle */}
          {hasCompoundMethods && (
            <div style={{
              display: 'flex',
              background: theme.colors.background.tertiary,
              borderRadius: '4px',
              overflow: 'hidden',
              marginRight: '8px'
            }}>
              <button
                onClick={() => setViewMode('grouped')}
                style={{
                  padding: '4px 10px',
                  background: viewMode === 'grouped' ? theme.colors.accents.purple : 'transparent',
                  border: 'none',
                  fontSize: '11px',
                  color: viewMode === 'grouped' ? 'white' : theme.colors.text.secondary,
                  cursor: 'pointer'
                }}
              >
                📦 Grouped
              </button>
              <button
                onClick={() => setViewMode('flat')}
                style={{
                  padding: '4px 10px',
                  background: viewMode === 'flat' ? theme.colors.accents.purple : 'transparent',
                  border: 'none',
                  fontSize: '11px',
                  color: viewMode === 'flat' ? 'white' : theme.colors.text.secondary,
                  cursor: 'pointer'
                }}
              >
                📋 Flat
              </button>
            </div>
          )}
          
          <button onClick={selectAll} style={filterBtnStyle(theme, false)}>All</button>
          <button onClick={selectNone} style={filterBtnStyle(theme, false)}>None</button>
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

      {/* Elements display */}
      <div style={{
        maxHeight: '500px',
        overflowY: 'auto',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px'
      }}>
        {viewMode === 'grouped' && hasCompoundMethods ? (
          <>
            {/* Compound Methods Section */}
            <GroupHeader
              title="🧩 Smart Compound Locators"
              subtitle={`${compoundMethods.length} methods covering ${groupedElements.coveredByCompound.length} elements`}
              expanded={expandedGroups.has('compound')}
              onToggle={() => toggleGroup('compound')}
              theme={theme}
              color={theme.colors.accents.purple}
            />
            
            {expandedGroups.has('compound') && (
              <div style={{ 
                background: `${theme.colors.accents.purple}05`,
                borderBottom: `1px solid ${theme.colors.border}`
              }}>
                {compoundMethods.filter(m => !m.isDynamic).map((method, idx) => (
                  <CompoundMethodRow
                    key={idx}
                    method={method}
                    coveredElements={groupedElements.coveredByCompound.filter(el => {
                      const prefix = (el.label || '').split(',')[0].trim();
                      return method.note?.includes(el.name) || 
                             method.description?.includes(prefix);
                    })}
                    theme={theme}
                  />
                ))}
              </div>
            )}

            {/* Unique Elements Section */}
            <GroupHeader
              title="✨ Unique Locators"
              subtitle={`${groupedElements.unique.length} elements with reliable selectors`}
              expanded={expandedGroups.has('unique')}
              onToggle={() => toggleGroup('unique')}
              theme={theme}
              color={theme.colors.accents.green}
            />
            
            {expandedGroups.has('unique') && groupedElements.unique.map((element) => (
              <ElementRow
                key={element._idx}
                element={element}
                index={element._idx}
                selected={selectedIds.has(element._idx)}
                editing={editingId === element._idx}
                theme={theme}
                onToggle={() => toggleElement(element._idx)}
                onEdit={() => setEditingId(editingId === element._idx ? null : element._idx)}
                onUpdate={(updates) => updateElement(element._idx, updates)}
                onDelete={() => deleteElement(element._idx)}
              />
            ))}

            {/* Covered elements (collapsed by default) */}
            {groupedElements.coveredByCompound.length > 0 && (
              <>
                <GroupHeader
                  title="🔄 Covered by Compound Methods"
                  subtitle={`${groupedElements.coveredByCompound.length} elements (use methods above instead)`}
                  expanded={expandedGroups.has('covered')}
                  onToggle={() => toggleGroup('covered')}
                  theme={theme}
                  color={theme.colors.text.tertiary}
                  muted
                />
                
                {expandedGroups.has('covered') && groupedElements.coveredByCompound.map((element) => (
                  <ElementRow
                    key={element._idx}
                    element={element}
                    index={element._idx}
                    selected={selectedIds.has(element._idx)}
                    editing={editingId === element._idx}
                    theme={theme}
                    onToggle={() => toggleElement(element._idx)}
                    onEdit={() => setEditingId(editingId === element._idx ? null : element._idx)}
                    onUpdate={(updates) => updateElement(element._idx, updates)}
                    onDelete={() => deleteElement(element._idx)}
                    muted
                  />
                ))}
              </>
            )}
          </>
        ) : (
          // Flat view - original behavior
          localElements.map((element, idx) => (
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
          ))
        )}
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

// Group header component
function GroupHeader({ title, subtitle, expanded, onToggle, theme, color, muted }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '12px 16px',
        background: muted ? theme.colors.background.tertiary : `${color}10`,
        borderBottom: `1px solid ${theme.colors.border}`,
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div>
        <div style={{
          fontWeight: 600,
          fontSize: '14px',
          color: muted ? theme.colors.text.tertiary : color
        }}>
          {expanded ? '▼' : '▶'} {title}
        </div>
        <div style={{
          fontSize: '11px',
          color: theme.colors.text.tertiary,
          marginTop: '2px'
        }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

// Compound method row
function CompoundMethodRow({ method, coveredElements, theme }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div style={{
      borderBottom: `1px solid ${theme.colors.border}`,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '10px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}
      >
        <span style={{
          fontSize: '12px',
          color: theme.colors.text.tertiary,
          marginTop: '2px'
        }}>
          {expanded ? '▼' : '▶'}
        </span>
        
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '13px',
            color: theme.colors.accents.purple,
            fontWeight: 600
          }}>
            {method.name}({method.params.map(p => p.name).join(', ')})
          </div>
          <div style={{
            fontSize: '11px',
            color: theme.colors.text.secondary,
            marginTop: '4px'
          }}>
            {method.description}
          </div>
          {method.note && (
            <div style={{
              fontSize: '10px',
              color: theme.colors.text.tertiary,
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              📍 {method.note}
            </div>
          )}
        </div>
        
        <span style={{
          padding: '2px 8px',
          background: `${theme.colors.accents.purple}20`,
          borderRadius: '4px',
          fontSize: '10px',
          color: theme.colors.accents.purple
        }}>
          {method.locatorType}
        </span>
      </div>
      
      {expanded && (
        <div style={{
          padding: '0 16px 12px 40px',
          background: `${theme.colors.background.tertiary}50`
        }}>
          {/* Parameters */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: theme.colors.text.tertiary,
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Parameters
            </div>
            {method.params.map((param, idx) => (
              <div key={idx} style={{
                fontSize: '11px',
                color: theme.colors.text.secondary,
                marginLeft: '8px'
              }}>
                <code style={{ color: theme.colors.accents.blue }}>{param.name}</code>
                <span style={{ color: theme.colors.text.tertiary }}> : {param.type}</span>
                <span style={{ marginLeft: '8px', color: theme.colors.text.tertiary }}>
                  — {param.description}
                </span>
              </div>
            ))}
          </div>
          
          {/* Template */}
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: theme.colors.text.tertiary,
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Selector Template
            </div>
            <code style={{
              display: 'block',
              padding: '8px',
              background: '#1a1a2e',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#e0e0e0',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {method.template}
            </code>
          </div>
          
          {/* Usage example */}
          <div style={{ marginTop: '8px' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: theme.colors.text.tertiary,
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Usage Example
            </div>
            <code style={{
              display: 'block',
              padding: '8px',
              background: '#1a1a2e',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#a0e0a0'
            }}>
              {generateUsageExample(method)}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

function generateUsageExample(method) {
  const exampleValues = {
    section: '"Evening"',
    status: '"Pending"',
    type: '"Evening"',
    timeRange: '"4:00pm - 12:00am"',
    index: '0',
    parts: '["Accepted", "1/10"]'
  };
  
  const args = method.params.map(p => exampleValues[p.name] || `"${p.name}"`).join(', ');
  return `await screen.${method.name}(${args});`;
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
  onDelete,
  muted = false
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
    onEdit();
  };

  const selectorQuality = element._domMatched 
    ? (element.selectorStrategy === 'xpath-fallback' ? 'warning' : 'good')
    : 'bad';

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: `1px solid ${theme.colors.border}`,
      background: selected 
        ? `${theme.colors.accents.green}08`
        : theme.colors.background.secondary,
      opacity: muted ? 0.6 : 1,
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

        {/* Selector quality indicator */}
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: selectorQuality === 'good' 
            ? theme.colors.accents.green 
            : selectorQuality === 'warning'
            ? theme.colors.accents.yellow
            : theme.colors.accents.red,
          flexShrink: 0
        }} title={
          selectorQuality === 'good' ? 'Reliable selector' :
          selectorQuality === 'warning' ? 'XPath fallback - may be fragile' :
          'No DOM match - unreliable'
        } />

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

        {/* Strategy badge */}
        {element.selectorStrategy && (
          <span style={{
            padding: '2px 6px',
            background: element.selectorStrategy === 'xpath-fallback'
              ? `${theme.colors.accents.yellow}20`
              : `${theme.colors.accents.green}20`,
            borderRadius: '4px',
            fontSize: '9px',
            color: element.selectorStrategy === 'xpath-fallback'
              ? theme.colors.accents.yellow
              : theme.colors.accents.green,
            flexShrink: 0
          }}>
            {element.selectorStrategy}
          </span>
        )}

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
    icon: '⭐',
    section: '◻️'
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
    select: theme.colors.accents.pink,
    section: theme.colors.border
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