// packages/web-app/src/components/UIScreenEditor/BlockRenderer.jsx
// ✅ PHASE 3: Updated to use POM-integrated content components
//
// Changes:
// - FunctionCallContent now has autocomplete for instance/method/storeAs
// - UIAssertionContent now has field picker from POM locators

import { useState } from 'react';
import { BLOCK_TYPES, BLOCK_TYPE_META } from './blockUtils';
import FunctionCallContent from './FunctionCallContent';
import UIAssertionContent from './UIAssertionContent';
import DataAssertionContent from './DataAssertionContent';
import BlockConditionsEditor from './BlockConditionsEditor';

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
 * - instanceName: Current instance name
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
  storedVariables = [],
  testDataSchema = []  // ✅ ADD THIS
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
            storedVariables={storedVariables}
          />
        );
      
      // ↓↓↓ ADD THIS ENTIRE CASE ↓↓↓
      case BLOCK_TYPES.DATA_ASSERTION:
        return (
          <DataAssertionContent
            block={block}
            onChange={(updated) => onUpdate(updated)}
            theme={theme}
            storedVariables={storedVariables}
            editMode={editMode}
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

     {/* Conditions Badge (collapsed state, view mode) */}
{!block.expanded && !editMode && block.conditions?.blocks?.length > 0 && (
  <div 
    className="px-3 py-1 flex items-center gap-2 text-xs"
    style={{ 
      background: `${theme.colors.accents.purple}10`,
      borderTop: `1px solid ${theme.colors.border}`
    }}
  >
    <span>🔒</span>
    <span style={{ color: theme.colors.accents.purple }}>
      {block.conditions.blocks.reduce((sum, b) => sum + (b.data?.checks?.length || 0), 0)} condition(s)
    </span>
  </div>
)}

{/* Block Content (when expanded) */}
{block.expanded && (
  <div className="p-3 space-y-3">
    {/* ✅ NEW: Conditions Editor (only in edit mode) */}
    {editMode && (
      <BlockConditionsEditor
        conditions={block.conditions}
        onChange={(newConditions) => onUpdate({ conditions: newConditions })}
        theme={theme}
        availableFields={testDataSchema}
        storedVariables={storedVariables}
        collapsed={!block.conditions?.blocks?.length}
      />
    )}
    
    {/* Conditions Badge (expanded state, view mode) */}
    {!editMode && block.conditions?.blocks?.length > 0 && (
      <div 
        className="p-2 rounded flex items-center gap-2 text-xs"
        style={{ 
          background: `${theme.colors.accents.purple}10`,
          border: `1px solid ${theme.colors.accents.purple}30`
        }}
      >
        <span>🔒</span>
        <span style={{ color: theme.colors.accents.purple }}>
          {block.conditions.blocks.reduce((sum, b) => sum + (b.data?.checks?.length || 0), 0)} condition(s)
        </span>
        <span style={{ color: theme.colors.text.tertiary }}>
          ({block.conditions.mode === 'any' ? 'ANY' : 'ALL'} must match)
        </span>
      </div>
    )}
    
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
  let summary = '';
  
  switch (block.type) {
    case BLOCK_TYPES.UI_ASSERTION: {
      const parts = [];
      const v = block.data?.visible?.length || 0;
      const h = block.data?.hidden?.length || 0;
      const t = Object.keys(block.data?.checks?.text || {}).length + 
                Object.keys(block.data?.checks?.contains || {}).length;
      if (v) parts.push(`${v} visible`);
      if (h) parts.push(`${h} hidden`);
      if (t) parts.push(`${t} text`);
      summary = parts.join(', ') || 'Empty';
      break;
    }
    
    case BLOCK_TYPES.CUSTOM_CODE: {
      const lines = (block.code || '').split('\n').length;
      summary = `${lines} line${lines !== 1 ? 's' : ''}`;
      break;
    }
    
    case BLOCK_TYPES.FUNCTION_CALL: {
      const { instance, method, storeAs } = block.data || {};
      if (instance && method) {
        summary = storeAs ? `${storeAs} = ${instance}.${method}()` : `${instance}.${method}()`;
      } else {
        summary = 'Not configured';
      }
      break;
    }
    
    case BLOCK_TYPES.DATA_ASSERTION: {
      const count = block.assertions?.length || 0;
      summary = `${count} assertion${count !== 1 ? 's' : ''}`;
      break;
    }
    
    default:
      summary = '';
  }
  
  // ✅ ADD: Append conditions indicator
  const conditionCount = block.conditions?.blocks?.reduce(
    (sum, b) => sum + (b.data?.checks?.length || 0), 0
  ) || 0;
  
  if (conditionCount > 0) {
    summary += summary ? ` • 🔒${conditionCount}` : `🔒${conditionCount} conditions`;
  }
  
  return summary;
}

/**
 * Custom Code Block Content
 */
function CustomCodeContent({ block, editMode, theme, onUpdate }) {
  const [localCode, setLocalCode] = useState(block.code || '');

  // Debounced update
  const handleCodeChange = (e) => {
    const newCode = e.target.value;
    setLocalCode(newCode);
    onUpdate({ code: newCode });
  };

  return (
    <div className="space-y-3">
      {/* Code Editor */}
      <div>
        <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
          Code Snippet
        </label>
        <textarea
          value={localCode}
          onChange={handleCodeChange}
          disabled={!editMode}
          placeholder="// Your code here..."
          rows={6}
          className="w-full px-3 py-2 rounded font-mono text-sm resize-y"
          style={{
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary,
            minHeight: '100px'
          }}
        />
      </div>

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={block.wrapInTestStep ?? false}
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
            placeholder="Step name"
            className="px-2 py-1 rounded text-sm"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text.primary,
              width: '200px'
            }}
          />
        )}
      </div>

      {/* Dependencies (POMs to import) */}
      <div>
        <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
          Dependencies (POMs to import)
        </label>
        <input
          type="text"
          value={(block.dependencies?.poms || []).join(', ')}
          onChange={(e) => onUpdate({ 
            dependencies: { 
              ...block.dependencies,
              poms: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            }
          })}
          disabled={!editMode}
          placeholder="e.g., detailsWrapper, flightActions"
          className="w-full px-2 py-1.5 rounded text-sm"
          style={{
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary
          }}
        />
      </div>

      {/* Preview */}
      {block.wrapInTestStep && (
        <div 
          className="p-2 rounded font-mono text-xs"
          style={{ 
            background: theme.colors.background.primary,
            color: theme.colors.text.tertiary
          }}
        >
          <div>
            <span style={{ color: theme.colors.accents.blue }}>await</span>
            {' test.'}
            <span style={{ color: theme.colors.accents.purple }}>step</span>
            {'('}
            <span style={{ color: theme.colors.accents.green }}>'{block.testStepName || 'Step'}'</span>
            {', async () => {'}
          </div>
          <div style={{ paddingLeft: '16px', color: theme.colors.text.secondary }}>
            {'// ...code'}
          </div>
          <div>{'});'}</div>
        </div>
      )}
    </div>
  );
}