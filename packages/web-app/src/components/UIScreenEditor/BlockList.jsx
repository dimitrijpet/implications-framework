// packages/web-app/src/components/UIScreenEditor/BlockList.jsx
// ✅ PHASE 3.5: With storeAs variable collection
//
// Each block receives storedVariables from ALL PREVIOUS blocks
// So Block 3 can use variables stored in Block 1 and Block 2
import BlockConditionsEditor from './BlockConditionsEditor';

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

import BlockRenderer from './BlockRenderer';
import {
  BLOCK_TYPES,
  BLOCK_TYPE_META,
  migrateToBlocksFormat,
  createUIAssertionBlock,
  createCustomCodeBlock,
  createFunctionCallBlock,
  createDataAssertionBlock,  // ← ADD THIS
  addBlockAtPosition,
  deleteBlock,
  duplicateBlock,
  updateBlock,
  setAllBlocksExpanded,
  sortBlocksByOrder,
  reindexBlockOrders
} from './blockUtils';
import { collectStoredVariables } from './variableUtils';
import usePOMData from '../../hooks/usePOMData';

/**
 * SortableBlock - Wrapper that makes a block draggable
 */
function SortableBlock({
  block,
  blockIndex,
  editMode,
  theme,
  onUpdate,
  onDelete,
  onDuplicate,
  pomName,
  instanceName,
  projectPath,
  storedVariables,
  testDataSchema  // ✅ ADD THIS
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
       <BlockRenderer
  block={block}
  editMode={editMode}
  theme={theme}
  onUpdate={onUpdate}
  onDelete={onDelete}
  onDuplicate={onDuplicate}
  pomName={pomName}
  instanceName={instanceName}
  projectPath={projectPath}
  storedVariables={storedVariables}
  testDataSchema={testDataSchema}  // ✅ ADD THIS
  dragHandleProps={editMode ? { ...attributes, ...listeners } : {}}
/>
    </div>
  );
}

/**
 * BlockList - Renders and manages a list of blocks with drag & drop
 * ✅ Now collects storeAs variables and passes them to subsequent blocks
 */
export default function BlockList({
  screen,
  editMode,
  theme,
  onBlocksChange,
  pomName,
  instanceName,
  projectPath,
  testDataSchema = null,
  storedVariables = []  // ✅ ADD THIS - transition variables from parent
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeId, setActiveId] = useState(null);

  // Get POM data for return keys
  const { getMethodReturnKeys } = usePOMData(projectPath);

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

  // Get blocks - migrate from legacy format if needed
  const blocks = useMemo(() => {
    if (screen.blocks && Array.isArray(screen.blocks)) {
      return sortBlocksByOrder(screen.blocks);
    }
    return migrateToBlocksFormat(screen);
  }, [screen]);

  // ✅ NEW: Collect stored variables for each block position
  // This creates a map: blockIndex -> variables available at that position
const variablesByBlockIndex = useMemo(() => {
  const result = {};
  
  for (let i = 0; i < blocks.length; i++) {
    // Get variables from previous blocks within this screen
    const blockVars = collectStoredVariables(blocks, i, getMethodReturnKeys);
    
    // Start with transition variables (available to ALL blocks)
    const merged = [...storedVariables];
    
    // Add block variables (avoid duplicates)
    blockVars.forEach(bv => {
      if (!merged.some(v => v.name === bv.name)) {
        merged.push(bv);
      }
    });
    
    result[i] = merged;
  }
  
  return result;
}, [blocks, getMethodReturnKeys, storedVariables]);  // ✅ Add storedVariables to deps

  // Get active block for drag overlay
  const activeBlock = useMemo(() => {
    if (!activeId) return null;
    return blocks.find(b => b.id === activeId);
  }, [activeId, blocks]);

  // Check content state
  const hasContent = blocks.length > 0;
  const allExpanded = blocks.every(b => b.expanded);

  // ✅ NEW: Summary of stored variables
  const totalStoredVariables = useMemo(() => {
    const allVars = collectStoredVariables(blocks, -1, getMethodReturnKeys);
    return allVars.length;
  }, [blocks, getMethodReturnKeys]);

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
      const reindexed = reindexBlockOrders(reordered);
      onBlocksChange(reindexed);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // Block operations
  const handleUpdateBlock = (blockId, updates) => {
    const newBlocks = updateBlock(blocks, blockId, updates);
    onBlocksChange(newBlocks);
  };

  const handleDeleteBlock = (blockId) => {
    const newBlocks = deleteBlock(blocks, blockId);
    onBlocksChange(newBlocks);
  };

  const handleDuplicateBlock = (blockId) => {
    const newBlocks = duplicateBlock(blocks, blockId);
    onBlocksChange(newBlocks);
  };

const handleAddBlock = (type) => {
    let newBlock;
    switch (type) {
      case BLOCK_TYPES.UI_ASSERTION:
        newBlock = createUIAssertionBlock({
          label: `UI Check ${blocks.filter(b => b.type === type).length + 1}`
        });
        break;
      case BLOCK_TYPES.CUSTOM_CODE:
        newBlock = createCustomCodeBlock({
          label: `Code Block ${blocks.filter(b => b.type === type).length + 1}`
        });
        break;
      case BLOCK_TYPES.FUNCTION_CALL:
        newBlock = createFunctionCallBlock({
          label: `Function ${blocks.filter(b => b.type === type).length + 1}`,
          instance: instanceName || ''
        });
        break;
      // ↓↓↓ ADD THIS CASE ↓↓↓
      case BLOCK_TYPES.DATA_ASSERTION:
        newBlock = createDataAssertionBlock({
          label: `Data Check ${blocks.filter(b => b.type === type).length + 1}`
        });
        break;
      default:
        return;
    }

    const newBlocks = addBlockAtPosition(blocks, newBlock);
    onBlocksChange(newBlocks);
    setShowAddMenu(false);
  };

  const handleExpandCollapseAll = () => {
    const newExpanded = !allExpanded;
    const newBlocks = setAllBlocksExpanded(blocks, newExpanded);
    onBlocksChange(newBlocks);
  };

  return (
    <div className="space-y-3">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: theme.colors.text.secondary }}>
            🧱 Blocks ({blocks.length})
          </span>

          {hasContent && (
            <button
              onClick={handleExpandCollapseAll}
              className="text-xs px-2 py-1 rounded transition hover:bg-white/10"
              style={{ color: theme.colors.text.tertiary }}
            >
              {allExpanded ? '⊟ Collapse All' : '⊞ Expand All'}
            </button>
          )}
          
          {editMode && hasContent && (
            <span 
              className="text-xs px-2 py-1 rounded"
              style={{ 
                background: `${theme.colors.accents.blue}20`,
                color: theme.colors.accents.blue 
              }}
            >
              ⋮⋮ Drag to reorder
            </span>
          )}

          {/* ✅ NEW: Show stored variables count */}
          {totalStoredVariables > 0 && (
            <span 
              className="text-xs px-2 py-1 rounded"
              style={{ 
                background: `${theme.colors.accents.yellow}20`,
                color: theme.colors.accents.yellow 
              }}
              title="Variables stored by function blocks, available in subsequent blocks"
            >
              💾 {totalStoredVariables} variable{totalStoredVariables !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {editMode && (
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-3 py-1.5 rounded text-sm font-semibold transition hover:brightness-110"
              style={{
                background: theme.colors.accents.blue,
                color: 'white'
              }}
            >
              ➕ Add Block
            </button>

            {/* Add Block Dropdown */}
            {showAddMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowAddMenu(false)}
                />
                <div
                  className="absolute right-0 top-full mt-1 z-20 rounded-lg shadow-xl overflow-hidden min-w-[220px]"
                  style={{
                    background: theme.colors.background.secondary,
                    border: `1px solid ${theme.colors.border}`
                  }}
                >
                  {Object.entries(BLOCK_TYPE_META).map(([type, meta]) => (
                    <button
                      key={type}
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
      </div>

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
{blocks.map((block, index) => (
  <SortableBlock
    key={block.id}
    block={block}
    blockIndex={index}
    editMode={editMode}
    theme={theme}
    onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
    onDelete={() => handleDeleteBlock(block.id)}
    onDuplicate={() => handleDuplicateBlock(block.id)}
    pomName={pomName}
    instanceName={instanceName}
    projectPath={projectPath}
    storedVariables={variablesByBlockIndex[index] || []}
    testDataSchema={testDataSchema}  // ✅ ADD THIS
  />
))}
            </div>
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeBlock ? (
              <div style={{ opacity: 0.9 }}>
                <BlockRenderer
                  block={activeBlock}
                  editMode={false}
                  theme={theme}
                  onUpdate={() => {}}
                  onDelete={() => {}}
                  onDuplicate={() => {}}
                  storedVariables={[]}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Empty State */
        <div
          className="p-8 rounded-lg text-center"
          style={{
            background: theme.colors.background.tertiary,
            border: `2px dashed ${theme.colors.border}`
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🧱</div>
          <div
            className="font-semibold mb-2"
            style={{ color: theme.colors.text.secondary }}
          >
            No validation blocks yet
          </div>
          <div
            className="text-sm mb-4"
            style={{ color: theme.colors.text.tertiary }}
          >
            Add blocks to define what to check on this screen
          </div>

          {editMode && (
            <div className="flex justify-center gap-2 flex-wrap">
              {Object.entries(BLOCK_TYPE_META).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => handleAddBlock(type)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:brightness-110"
                  style={{
                    background: `${theme.colors.accents[meta.color]}30`,
                    color: theme.colors.accents[meta.color],
                    border: `1px solid ${theme.colors.accents[meta.color]}50`
                  }}
                >
                  {meta.icon} {meta.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Migration Notice */}
      {!screen.blocks && hasContent && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-xs"
          style={{
            background: `${theme.colors.accents.yellow}15`,
            border: `1px solid ${theme.colors.accents.yellow}40`,
            color: theme.colors.accents.yellow
          }}
        >
          <span>💡</span>
          <span>
            This screen was migrated from legacy format. Save to update.
          </span>
        </div>
      )}
    </div>
  );
}