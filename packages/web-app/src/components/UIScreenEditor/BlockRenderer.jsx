// packages/web-app/src/components/UIScreenEditor/BlockRenderer.jsx
// Renders a single block based on its type

import { useState } from 'react';
import { BLOCK_TYPES, BLOCK_TYPE_META } from './blockUtils';

/**
 * BlockRenderer - Renders a single block with collapse/expand, enable/disable
 * 
 * Props:
 * - block: The block object to render
 * - editMode: Whether editing is enabled
 * - theme: Theme object
 * - onUpdate: (updates) => void - Update block properties
 * - onDelete: () => void - Delete this block
 * - onDuplicate: () => void - Duplicate this block
 * - dragHandleProps: Props for drag handle (from @dnd-kit)
 * - pomName: Current POM name for field autocomplete
 * - projectPath: Project path for API calls
 * - storedVariables: Available stored variables
 */
export default function BlockRenderer({
  block,
  editMode,
  theme,
  onUpdate,
  onDelete,
  onDuplicate,
  dragHandleProps = {},
  pomName,
  instanceName,
  projectPath,
  storedVariables = []
}) {
  const meta = BLOCK_TYPE_META[block.type] || {};
  const colorKey = meta.color || 'blue';
  const color = theme.colors.accents[colorKey] || theme.colors.accents.blue;

  // Render different content based on block type
  const renderBlockContent = () => {
    switch (block.type) {
      case BLOCK_TYPES.UI_ASSERTION:
        return (
          <UIAssertionContent 
            block={block} 
            editMode={editMode} 
            theme={theme}
            onUpdate={onUpdate}
            pomName={pomName}
            instanceName={instanceName}
            projectPath={projectPath}
            storedVariables={storedVariables}
          />
        );
      
      case BLOCK_TYPES.CUSTOM_CODE:
        return (
          <CustomCodeContent 
            block={block} 
            editMode={editMode} 
            theme={theme}
            onUpdate={onUpdate}
          />
        );
      
      case BLOCK_TYPES.FUNCTION_CALL:
        return (
          <FunctionCallContent 
            block={block} 
            editMode={editMode} 
            theme={theme}
            onUpdate={onUpdate}
            pomName={pomName}
            projectPath={projectPath}
          />
        );
      
      default:
        return (
          <div className="text-sm" style={{ color: theme.colors.text.tertiary }}>
            Unknown block type: {block.type}
          </div>
        );
    }
  };

  return (
    <div 
      className={`rounded-lg overflow-hidden transition-all ${!block.enabled ? 'opacity-50' : ''}`}
      style={{ 
        background: theme.colors.background.secondary,
        border: `1px solid ${block.expanded ? color : theme.colors.border}`,
        boxShadow: block.expanded ? `0 0 0 1px ${color}30` : 'none'
      }}
    >
      {/* Block Header */}
      <div 
        className="flex items-center gap-2 p-3 cursor-pointer select-none"
        style={{ 
          background: block.expanded ? `${color}15` : 'transparent',
          borderBottom: block.expanded ? `1px solid ${color}40` : 'none'
        }}
      >
        {/* Drag Handle (only in edit mode) */}
        {editMode && (
          <div 
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/10 transition"
            title="Drag to reorder"
          >
            <span style={{ color: theme.colors.text.tertiary }}>⋮⋮</span>
          </div>
        )}

        {/* Block Icon & Type */}
        <span style={{ fontSize: '18px' }}>{meta.icon}</span>
        
        {/* Block Label (editable in edit mode) */}
        <div className="flex-1 min-w-0">
          {editMode ? (
            <input
              type="text"
              value={block.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="w-full px-2 py-1 rounded text-sm font-semibold bg-transparent border border-transparent hover:border-gray-600 focus:border-blue-500 focus:outline-none"
              style={{ color: theme.colors.text.primary }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span 
              className="font-semibold text-sm truncate block"
              style={{ color: theme.colors.text.primary }}
            >
              {block.label}
            </span>
          )}
        </div>

        {/* Block Type Badge */}
        <span 
          className="px-2 py-0.5 rounded text-xs font-medium shrink-0"
          style={{ 
            background: `${color}30`,
            color: color
          }}
        >
          {meta.label}
        </span>

        {/* Summary (collapsed state) */}
        {!block.expanded && (
          <span 
            className="text-xs truncate max-w-[200px]"
            style={{ color: theme.colors.text.tertiary }}
          >
            {getBlockSummary(block)}
          </span>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {editMode && (
            <>
              {/* Enable/Disable Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ enabled: !block.enabled });
                }}
                className="p-1.5 rounded transition hover:bg-white/10"
                title={block.enabled ? 'Disable block' : 'Enable block'}
              >
                <span style={{ color: block.enabled ? theme.colors.accents.green : theme.colors.text.tertiary }}>
                  {block.enabled ? '✓' : '○'}
                </span>
              </button>

              {/* Duplicate */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate?.();
                }}
                className="p-1.5 rounded transition hover:bg-white/10"
                title="Duplicate block"
              >
                <span style={{ color: theme.colors.text.tertiary }}>⧉</span>
              </button>

              {/* Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Delete this block?')) {
                    onDelete?.();
                  }
                }}
                className="p-1.5 rounded transition hover:bg-red-500/20"
                title="Delete block"
              >
                <span style={{ color: theme.colors.accents.red }}>✕</span>
              </button>
            </>
          )}

          {/* Expand/Collapse */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ expanded: !block.expanded });
            }}
            className="p-1.5 rounded transition hover:bg-white/10"
          >
            <span 
              className="transition-transform inline-block"
              style={{ 
                color: theme.colors.text.tertiary,
                transform: block.expanded ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
            >
              ▼
            </span>
          </button>
        </div>
      </div>

      {/* Block Content (when expanded) */}
      {block.expanded && (
        <div className="p-3">
          {renderBlockContent()}
        </div>
      )}
    </div>
  );
}

/**
 * Get a brief summary of block content for collapsed state
 */
function getBlockSummary(block) {
  switch (block.type) {
    case BLOCK_TYPES.UI_ASSERTION: {
      const parts = [];
      const v = block.data.visible?.length || 0;
      const h = block.data.hidden?.length || 0;
      const t = Object.keys(block.data.checks?.text || {}).length + 
                Object.keys(block.data.checks?.contains || {}).length;
      if (v > 0) parts.push(`${v} visible`);
      if (h > 0) parts.push(`${h} hidden`);
      if (t > 0) parts.push(`${t} text`);
      return parts.join(', ') || 'Empty';
    }
    
    case BLOCK_TYPES.CUSTOM_CODE: {
      const lines = (block.code || '').split('\n').length;
      return `${lines} line${lines !== 1 ? 's' : ''}`;
    }
    
    case BLOCK_TYPES.FUNCTION_CALL: {
      return block.data.method 
        ? `${block.data.instance || 'this'}.${block.data.method}()`
        : 'No method selected';
    }
    
    default:
      return '';
  }
}

// ============================================
// Block Type Content Components
// ============================================

/**
 * UI Assertion Block Content
 * Shows visible/hidden elements, text checks in a compact format
 */
function UIAssertionContent({ block, editMode, theme, onUpdate, pomName, instanceName, projectPath, storedVariables }) {
  const data = block.data || {};
  
  const updateData = (key, value) => {
    onUpdate({
      data: { ...data, [key]: value }
    });
  };

  const updateChecks = (checkType, value) => {
    onUpdate({
      data: {
        ...data,
        checks: { ...data.checks, [checkType]: value }
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Visible Elements */}
      <CompactElementList
        title="Visible"
        icon="✅"
        elements={data.visible || []}
        color={theme.colors.accents.green}
        editMode={editMode}
        theme={theme}
        onChange={(els) => updateData('visible', els)}
      />

      {/* Hidden Elements */}
      <CompactElementList
        title="Hidden"
        icon="❌"
        elements={data.hidden || []}
        color={theme.colors.accents.red}
        editMode={editMode}
        theme={theme}
        onChange={(els) => updateData('hidden', els)}
      />

      {/* Text Checks */}
      <CompactTextChecks
        textChecks={data.checks?.text || {}}
        containsChecks={data.checks?.contains || {}}
        editMode={editMode}
        theme={theme}
        storedVariables={storedVariables}
        onTextChange={(checks) => updateChecks('text', checks)}
        onContainsChange={(checks) => updateChecks('contains', checks)}
      />

      {/* Truthy */}
      {(data.truthy?.length > 0 || editMode) && (
        <CompactElementList
          title="Truthy"
          icon="✓"
          elements={data.truthy || []}
          color={theme.colors.accents.blue}
          editMode={editMode}
          theme={theme}
          onChange={(els) => updateData('truthy', els)}
        />
      )}

      {/* Falsy */}
      {(data.falsy?.length > 0 || editMode) && (
        <CompactElementList
          title="Falsy"
          icon="✗"
          elements={data.falsy || []}
          color={theme.colors.accents.orange}
          editMode={editMode}
          theme={theme}
          onChange={(els) => updateData('falsy', els)}
        />
      )}

      {/* Assertions */}
      {(data.assertions?.length > 0 || editMode) && (
        <CompactAssertionsList
          assertions={data.assertions || []}
          editMode={editMode}
          theme={theme}
          onChange={(assertions) => updateData('assertions', assertions)}
        />
      )}
    </div>
  );
}

/**
 * Custom Code Block Content
 * Simple textarea for now, will upgrade to CodeMirror in Phase 3
 */
function CustomCodeContent({ block, editMode, theme, onUpdate }) {
  return (
    <div className="space-y-3">
      {/* Code Editor */}
      <div>
        <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
          Code
        </label>
        <textarea
          value={block.code || ''}
          onChange={(e) => onUpdate({ code: e.target.value })}
          disabled={!editMode}
          placeholder="// Enter your Playwright code here..."
          className="w-full h-32 px-3 py-2 rounded font-mono text-sm resize-y"
          style={{
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary
          }}
        />
      </div>

      {/* Test Step Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={block.wrapInTestStep ?? true}
            onChange={(e) => onUpdate({ wrapInTestStep: e.target.checked })}
            disabled={!editMode}
            className="rounded"
          />
          <span style={{ color: theme.colors.text.secondary }}>Wrap in test.step()</span>
        </label>

        {block.wrapInTestStep && (
          <input
            type="text"
            value={block.testStepName || ''}
            onChange={(e) => onUpdate({ testStepName: e.target.value })}
            disabled={!editMode}
            placeholder="Step name..."
            className="flex-1 px-2 py-1 rounded text-sm"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text.primary
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Function Call Block Content
 */
function FunctionCallContent({ block, editMode, theme, onUpdate, pomName, projectPath }) {
  const data = block.data || {};

  const updateData = (key, value) => {
    onUpdate({
      data: { ...data, [key]: value }
    });
  };

  return (
    <div className="space-y-3">
      {/* Instance & Method */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
            Instance
          </label>
          <input
            type="text"
            value={data.instance || ''}
            onChange={(e) => updateData('instance', e.target.value)}
            disabled={!editMode}
            placeholder="e.g., detailsWrapper"
            className="w-full px-2 py-1.5 rounded text-sm font-mono"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text.primary
            }}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
            Method
          </label>
          <input
            type="text"
            value={data.method || ''}
            onChange={(e) => updateData('method', e.target.value)}
            disabled={!editMode}
            placeholder="e.g., verifyVisible"
            className="w-full px-2 py-1.5 rounded text-sm font-mono"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text.primary
            }}
          />
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data.await ?? true}
            onChange={(e) => updateData('await', e.target.checked)}
            disabled={!editMode}
            className="rounded"
          />
          <span style={{ color: theme.colors.text.secondary }}>await</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>Store as:</span>
          <input
            type="text"
            value={data.storeAs || ''}
            onChange={(e) => updateData('storeAs', e.target.value)}
            disabled={!editMode}
            placeholder="variableName"
            className="px-2 py-1 rounded text-sm font-mono"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.accents.yellow,
              width: '150px'
            }}
          />
        </div>
      </div>

      {/* Preview */}
      <div 
        className="p-2 rounded font-mono text-xs"
        style={{ 
          background: theme.colors.background.primary,
          color: theme.colors.accents.purple
        }}
      >
        {data.storeAs && <span style={{ color: theme.colors.accents.yellow }}>{`const ${data.storeAs} = `}</span>}
        {data.await && <span style={{ color: theme.colors.accents.blue }}>await </span>}
        <span>{data.instance || 'instance'}</span>
        <span style={{ color: theme.colors.text.tertiary }}>.</span>
        <span style={{ color: theme.colors.accents.green }}>{data.method || 'method'}</span>
        <span style={{ color: theme.colors.text.tertiary }}>()</span>
      </div>
    </div>
  );
}

// ============================================
// Compact Sub-Components
// ============================================

function CompactElementList({ title, icon, elements, color, editMode, theme, onChange }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (!newValue.trim()) return;
    onChange([...elements, newValue.trim()]);
    setNewValue('');
    setIsAdding(false);
  };

  const handleRemove = (idx) => {
    onChange(elements.filter((_, i) => i !== idx));
  };

  if (elements.length === 0 && !editMode) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold" style={{ color }}>
          {icon} {title} ({elements.length})
        </span>
        {editMode && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs px-2 py-0.5 rounded transition hover:brightness-110"
            style={{ background: `${color}30`, color }}
          >
            + Add
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {elements.map((el, idx) => (
          <span 
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono"
            style={{ background: `${color}20`, color }}
          >
            {el}
            {editMode && (
              <button onClick={() => handleRemove(idx)} className="hover:text-red-400">×</button>
            )}
          </span>
        ))}

        {isAdding && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="element..."
              autoFocus
              className="px-2 py-0.5 rounded text-xs font-mono w-32"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${color}`,
                color: theme.colors.text.primary
              }}
            />
            <button onClick={handleAdd} className="text-xs" style={{ color: theme.colors.accents.green }}>✓</button>
            <button onClick={() => { setIsAdding(false); setNewValue(''); }} className="text-xs" style={{ color: theme.colors.accents.red }}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactTextChecks({ textChecks, containsChecks, editMode, theme, storedVariables, onTextChange, onContainsChange }) {
  const allChecks = [
    ...Object.entries(textChecks).map(([k, v]) => ({ key: k, value: v, type: 'exact' })),
    ...Object.entries(containsChecks).map(([k, v]) => ({ key: k, value: v, type: 'contains' }))
  ];

  if (allChecks.length === 0 && !editMode) return null;

  const color = theme.colors.accents.yellow;

  // Helper to render template values
  const renderValue = (text) => {
    if (typeof text !== 'string') return text;
    const hasTemplate = /\{\{([^}]+)\}\}/.test(text);
    if (hasTemplate) {
      return text.split(/(\{\{[^}]+\}\})/).map((part, i) => {
        if (part.match(/^\{\{[^}]+\}\}$/)) {
          return (
            <span key={i} className="px-1 py-0.5 rounded mx-0.5" style={{ background: `${theme.colors.accents.purple}30`, color: theme.colors.accents.purple }}>
              {part}
            </span>
          );
        }
        return part;
      });
    }
    return `"${text}"`;
  };

  const handleRemove = (key, type) => {
    if (type === 'exact') {
      const updated = { ...textChecks };
      delete updated[key];
      onTextChange(updated);
    } else {
      const updated = { ...containsChecks };
      delete updated[key];
      onContainsChange(updated);
    }
  };

  return (
    <div>
      <span className="text-xs font-semibold" style={{ color }}>
        📝 Text Checks ({allChecks.length})
      </span>
      <div className="mt-1 space-y-1">
        {allChecks.map(({ key, value, type }) => (
          <div 
            key={key}
            className="flex items-center gap-2 p-1.5 rounded text-xs"
            style={{ background: `${color}15` }}
          >
            <span className="font-mono" style={{ color }}>{key}</span>
            <span 
              className="px-1 py-0.5 rounded text-[10px]"
              style={{ 
                background: type === 'exact' ? theme.colors.accents.blue : theme.colors.accents.purple,
                color: 'white'
              }}
            >
              {type === 'exact' ? '=' : '⊃'}
            </span>
            <span className="flex-1 truncate" style={{ color: theme.colors.text.secondary }}>
              {renderValue(value)}
            </span>
            {editMode && (
              <button onClick={() => handleRemove(key, type)} className="text-red-400 hover:text-red-300">×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactAssertionsList({ assertions, editMode, theme, onChange }) {
  if (assertions.length === 0 && !editMode) return null;

  const color = theme.colors.accents.yellow;

  return (
    <div>
      <span className="text-xs font-semibold" style={{ color }}>
        🔍 Assertions ({assertions.length})
      </span>
      <div className="mt-1 space-y-1">
        {assertions.map((assertion, idx) => (
          <div 
            key={idx}
            className="flex items-center gap-2 p-1.5 rounded text-xs font-mono"
            style={{ background: `${color}15`, color }}
          >
            <span>{assertion.fn}()</span>
            <span style={{ color: theme.colors.text.tertiary }}>{assertion.expect}</span>
            {assertion.value !== undefined && (
              <span style={{ color: theme.colors.accents.green }}>{String(assertion.value)}</span>
            )}
            {editMode && (
              <button 
                onClick={() => onChange(assertions.filter((_, i) => i !== idx))}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}