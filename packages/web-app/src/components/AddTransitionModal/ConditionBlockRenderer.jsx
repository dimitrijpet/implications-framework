// packages/web-app/src/components/AddTransitionModal/ConditionBlockRenderer.jsx
// Renders a single condition block with collapse/expand, enable/disable

import { 
  CONDITION_BLOCK_TYPES, 
  CONDITION_BLOCK_TYPE_META,
  getConditionBlockSummary
} from './conditionBlockUtils';
import ConditionCheckContent from './ConditionCheckContent';
import ConditionCodeContent from './ConditionCodeContent';

/**
 * ConditionBlockRenderer - Renders a single condition block
 * 
 * Props:
 * - block: The condition block object
 * - editMode: Whether editing is enabled
 * - theme: Theme object
 * - onUpdate: (updates) => void
 * - onDelete: () => void
 * - onDuplicate: () => void
 * - dragHandleProps: Props for drag handle
 * - testDataSchema: Test data fields for autocomplete
 * - storedVariables: Available stored variables
 * - requiresSuggestions: Quick add suggestions
 */
export default function ConditionBlockRenderer({
  block,
  editMode,
  theme,
  onUpdate,
  onDelete,
  onDuplicate,
  dragHandleProps = {},
  testDataSchema = [],
  storedVariables = [],
  requiresSuggestions = []
}) {
  const meta = CONDITION_BLOCK_TYPE_META[block.type] || {};
  const colorKey = meta.color || 'purple';
  const color = theme.colors.accents[colorKey] || theme.colors.accents.purple;

  // Render content based on block type
  const renderContent = () => {
    switch (block.type) {
      case CONDITION_BLOCK_TYPES.CONDITION_CHECK:
        return (
          <ConditionCheckContent
            block={block}
            editMode={editMode}
            theme={theme}
            onUpdate={onUpdate}
            testDataSchema={testDataSchema}
            storedVariables={storedVariables}
            requiresSuggestions={requiresSuggestions}
          />
        );
      
      case CONDITION_BLOCK_TYPES.CUSTOM_CODE:
        return (
          <ConditionCodeContent
            block={block}
            editMode={editMode}
            theme={theme}
            onUpdate={onUpdate}
            testDataSchema={testDataSchema}
            storedVariables={storedVariables}
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
        onClick={() => onUpdate({ expanded: !block.expanded })}
      >
        {/* Drag Handle (only in edit mode) */}
        {editMode && (
          <div 
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/10 transition"
            title="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ color: theme.colors.text.tertiary }}>⋮⋮</span>
          </div>
        )}

        {/* Block Icon */}
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
            {getConditionBlockSummary(block)}
          </span>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {editMode && (
            <>
              {/* Enable/Disable Toggle */}
              <button
                type="button"
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
                type="button"
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
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Delete this condition block?')) {
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
            type="button"
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
          {renderContent()}
        </div>
      )}
    </div>
  );
}