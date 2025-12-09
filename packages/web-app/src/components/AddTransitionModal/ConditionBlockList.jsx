// packages/web-app/src/components/AddTransitionModal/ConditionBlockList.jsx
// Main container for condition blocks with drag & drop

import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import ConditionBlockRenderer from './ConditionBlockRenderer';
import {
  CONDITION_BLOCK_TYPES,
  CONDITION_BLOCK_TYPE_META,
  createConditionCheckBlock,
  createConditionCodeBlock,
  sortConditionBlocks,
  reindexConditionBlockOrders,
  updateConditionBlock,
  deleteConditionBlock,
  addConditionBlockAtPosition,
  duplicateConditionBlock,
  migrateRequiresToConditions
} from './conditionBlockUtils';

/**
 * SortableConditionBlock - Wrapper that makes a condition block draggable
 */
function SortableConditionBlock({
  block,
  editMode,
  theme,
  onUpdate,
  onDelete,
  onDuplicate,
  testDataSchema,
  storedVariables,
  requiresSuggestions
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ConditionBlockRenderer
        block={block}
        editMode={editMode}
        theme={theme}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        dragHandleProps={editMode ? { ...attributes, ...listeners } : {}}
        testDataSchema={testDataSchema}
        storedVariables={storedVariables}
        requiresSuggestions={requiresSuggestions}
      />
    </div>
  );
}

/**
 * ConditionBlockList - Main container for transition condition blocks
 * 
 * Props:
 * - conditions: { mode: 'all'|'any', blocks: [...] }
 * - onChange: (newConditions) => void
 * - editMode: boolean
 * - theme: Theme object
 * - testDataSchema: Test data fields for autocomplete
 * - storedVariables: Available stored variables from transitions
 * - requiresSuggestions: Quick add suggestions from previously used
 * - legacyRequires: Old-style requires object (for migration display)
 */
export default function ConditionBlockList({
  conditions,
  onChange,
  editMode = true,
  theme,
  testDataSchema = [],
  storedVariables = [],
  requiresSuggestions = [],
  legacyRequires = null,
  compact = false  // ✅ NEW: Compact mode for step conditions
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeId, setActiveId] = useState(null);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get blocks from conditions or initialize empty
  const blocks = useMemo(() => {
    if (conditions?.blocks && Array.isArray(conditions.blocks)) {
      return sortConditionBlocks(conditions.blocks);
    }
    return [];
  }, [conditions]);

  const mode = conditions?.mode || 'all';

  // Get active block for drag overlay
  const activeBlock = useMemo(() => {
    if (!activeId) return null;
    return blocks.find(b => b.id === activeId);
  }, [activeId, blocks]);

  // Check if we have legacy requires to migrate
  const hasLegacyRequires = legacyRequires && Object.keys(legacyRequires).length > 0 && blocks.length === 0;

  // Handle mode change
  const handleModeChange = (newMode) => {
    onChange({ ...conditions, mode: newMode, blocks });
  };

  // Handle blocks change
  const handleBlocksChange = (newBlocks) => {
    onChange({ mode, blocks: newBlocks });
  };

  // Drag handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex(b => b.id === active.id);
    const newIndex = blocks.findIndex(b => b.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(blocks, oldIndex, newIndex);
      const reindexed = reindexConditionBlockOrders(reordered);
      handleBlocksChange(reindexed);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // Block operations
  const handleUpdateBlock = (blockId, updates) => {
    const newBlocks = updateConditionBlock(blocks, blockId, updates);
    handleBlocksChange(newBlocks);
  };

  const handleDeleteBlock = (blockId) => {
    const newBlocks = deleteConditionBlock(blocks, blockId);
    handleBlocksChange(newBlocks);
  };

  const handleDuplicateBlock = (blockId) => {
    const newBlocks = duplicateConditionBlock(blocks, blockId);
    handleBlocksChange(newBlocks);
  };

  const handleAddBlock = (type) => {
    let newBlock;
    switch (type) {
      case CONDITION_BLOCK_TYPES.CONDITION_CHECK:
        newBlock = createConditionCheckBlock({
          label: `Condition ${blocks.filter(b => b.type === type).length + 1}`
        });
        break;
      case CONDITION_BLOCK_TYPES.CUSTOM_CODE:
        newBlock = createConditionCodeBlock({
          label: `Custom Check ${blocks.filter(b => b.type === type).length + 1}`
        });
        break;
      default:
        return;
    }

    const newBlocks = addConditionBlockAtPosition(blocks, newBlock);
    handleBlocksChange(newBlocks);
    setShowAddMenu(false);
  };

  // Handle migration from legacy requires
  const handleMigrateLegacy = () => {
    const migrated = migrateRequiresToConditions(legacyRequires);
    if (migrated) {
      onChange(migrated);
    }
  };

  const hasContent = blocks.length > 0;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {/* Section Header - hide in compact mode */}
      {!compact && (
        <>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '18px' }}>🔒</span>
            <label
              className="text-sm font-semibold"
              style={{ color: theme.colors.text.primary }}
            >
              Transition Conditions
            </label>
            {hasContent && (
              <span 
                className="text-xs px-2 py-0.5 rounded"
                style={{ 
                  background: `${theme.colors.accents.purple}20`,
                  color: theme.colors.accents.purple
                }}
              >
                {blocks.length} block{blocks.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <p
            className="text-xs"
            style={{ color: theme.colors.text.tertiary }}
          >
            Set conditions that must be met in testData for this transition to be selected.
            Leave empty for the default path.
          </p>
        </>
      )}

      {/* Legacy Migration Notice */}
      {hasLegacyRequires && (
        <div 
          className="p-3 rounded-lg"
          style={{
            background: `${theme.colors.accents.yellow}15`,
            border: `1px solid ${theme.colors.accents.yellow}40`
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div 
                className="text-sm font-semibold"
                style={{ color: theme.colors.accents.yellow }}
              >
                ⬆️ Legacy requires detected
              </div>
              <div 
                className="text-xs mt-1"
                style={{ color: theme.colors.text.tertiary }}
              >
                {Object.entries(legacyRequires).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}
              </div>
            </div>
            <button
              type="button"
              onClick={handleMigrateLegacy}
              className="px-3 py-1.5 rounded text-sm font-semibold transition hover:brightness-110"
              style={{
                background: theme.colors.accents.yellow,
                color: 'black'
              }}
            >
              Migrate to Blocks
            </button>
          </div>
        </div>
      )}

      {/* Top-Level Mode Toggle (only if multiple blocks) */}
      {hasContent && blocks.length > 1 && (
        <div 
          className="flex items-center gap-4 p-3 rounded-lg"
          style={{ 
            background: theme.colors.background.tertiary,
            border: `1px solid ${theme.colors.border}`
          }}
        >
          <span className="text-xs font-semibold" style={{ color: theme.colors.text.tertiary }}>
            Block combination:
          </span>
          <div className="flex gap-2">
            <label 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer transition"
              style={{
                background: mode === 'all' ? `${theme.colors.accents.purple}20` : 'transparent',
                border: `1px solid ${mode === 'all' ? theme.colors.accents.purple : theme.colors.border}`
              }}
            >
              <input
                type="radio"
                name="conditions-mode"
                value="all"
                checked={mode === 'all'}
                onChange={() => handleModeChange('all')}
                disabled={!editMode}
                className="sr-only"
              />
              <span 
                className="text-sm font-semibold"
                style={{ color: mode === 'all' ? theme.colors.accents.purple : theme.colors.text.secondary }}
              >
                ALL blocks pass
              </span>
              <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>(AND)</span>
            </label>
            
            <label 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer transition"
              style={{
                background: mode === 'any' ? `${theme.colors.accents.blue}20` : 'transparent',
                border: `1px solid ${mode === 'any' ? theme.colors.accents.blue : theme.colors.border}`
              }}
            >
              <input
                type="radio"
                name="conditions-mode"
                value="any"
                checked={mode === 'any'}
                onChange={() => handleModeChange('any')}
                disabled={!editMode}
                className="sr-only"
              />
              <span 
                className="text-sm font-semibold"
                style={{ color: mode === 'any' ? theme.colors.accents.blue : theme.colors.text.secondary }}
              >
                ANY block passes
              </span>
              <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>(OR)</span>
            </label>
          </div>
        </div>
      )}

      {/* Blocks List with Drag & Drop */}
      {hasContent ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={blocks.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {blocks.map((block) => (
                <SortableConditionBlock
                  key={block.id}
                  block={block}
                  editMode={editMode}
                  theme={theme}
                  onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
                  onDelete={() => handleDeleteBlock(block.id)}
                  onDuplicate={() => handleDuplicateBlock(block.id)}
                  testDataSchema={testDataSchema}
                  storedVariables={storedVariables}
                  requiresSuggestions={requiresSuggestions}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeBlock ? (
              <div style={{ opacity: 0.9 }}>
                <ConditionBlockRenderer
                  block={activeBlock}
                  editMode={false}
                  theme={theme}
                  onUpdate={() => {}}
                  onDelete={() => {}}
                  onDuplicate={() => {}}
                  testDataSchema={testDataSchema}
                  storedVariables={storedVariables}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Empty State - Default Path */
        !hasLegacyRequires && (
          <div 
            className="flex items-center gap-2 px-3 py-2 rounded"
            style={{ 
              backgroundColor: `${theme.colors.accents.green}10`,
              border: `1px solid ${theme.colors.accents.green}30`
            }}
          >
            <span>✓</span>
            <span className="text-xs" style={{ color: theme.colors.accents.green }}>
              Default path - no conditions required
            </span>
          </div>
        )
      )}

      {/* Add Block Button / Menu */}
      {editMode && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-full px-3 py-2 rounded text-sm font-semibold transition hover:brightness-110"
            style={{
              background: `${theme.colors.accents.purple}20`,
              color: theme.colors.accents.purple,
              border: `1px dashed ${theme.colors.accents.purple}50`
            }}
          >
            + Add Condition Block
          </button>

          {/* Add Block Dropdown */}
          {showAddMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAddMenu(false)}
              />
              <div
                className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg shadow-xl overflow-hidden"
                style={{
                  background: theme.colors.background.secondary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                {Object.entries(CONDITION_BLOCK_TYPE_META).map(([type, meta]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleAddBlock(type)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left transition hover:bg-white/5"
                  >
                    <span style={{ fontSize: '20px' }}>{meta.icon}</span>
                    <div>
                      <div
                        className="font-semibold text-sm"
                        style={{ color: theme.colors.text.primary }}
                      >
                        {meta.label}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: theme.colors.text.tertiary }}
                      >
                        {meta.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Status Summary */}
      {hasContent && (
        <div 
          className="flex items-center gap-2 px-3 py-2 rounded"
          style={{ 
            backgroundColor: `${theme.colors.accents.purple}10`,
            border: `1px solid ${theme.colors.accents.purple}30`
          }}
        >
          <span>🔀</span>
          <span className="text-xs" style={{ color: theme.colors.accents.purple }}>
            Conditional path - TestPlanner will select this when {blocks.length} condition block{blocks.length !== 1 ? 's' : ''} {mode === 'all' ? 'ALL pass' : 'ANY passes'}
          </span>
        </div>
      )}
    </div>
  );
}