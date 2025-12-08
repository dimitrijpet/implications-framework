// packages/web-app/src/components/UIScreenEditor/DraggableScreenList.jsx
// ✨ Drag-and-drop screen reordering with navigation support
import { useState } from 'react';
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
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Individual sortable screen item
 */
function SortableScreenItem({ 
  screen, 
  index,
  editMode, 
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onCopy,
  theme,
  children 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: screen.name || screen.screenName || `screen-${index}`,
    disabled: !editMode
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto'
  };

  const screenName = screen.name || screen.screenName || screen.originalName || 'Unnamed';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg overflow-hidden"
      {...attributes}
    >
      <div 
        style={{ 
          background: theme.colors.background.secondary,
          border: `1px solid ${isDragging ? theme.colors.accents.blue : theme.colors.border}`
        }}
        className="rounded-lg"
      >
        {/* Header with drag handle */}
        <div className="flex items-center">
          {/* Drag Handle - only in edit mode */}
          {editMode && (
            <div
              {...listeners}
              className="px-2 py-3 cursor-grab active:cursor-grabbing flex items-center"
              style={{ 
                background: theme.colors.background.tertiary,
                borderRight: `1px solid ${theme.colors.border}`
              }}
              title="Drag to reorder"
            >
              <span style={{ color: theme.colors.text.tertiary, fontSize: '16px' }}>⋮⋮</span>
            </div>
          )}
          
          {/* Screen header button */}
          <button
            onClick={onToggleExpand}
            className="flex-1 p-3 flex items-center justify-between hover:brightness-105 transition"
            style={{ background: 'transparent' }}
          >
            <div className="flex items-center gap-3">
              {/* Order badge */}
              <span 
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ 
                  background: theme.colors.accents.blue,
                  color: 'white'
                }}
              >
                {index + 1}
              </span>
              
              <span style={{ fontSize: '20px' }}>📄</span>
              
              <div className="text-left">
                <div style={{ fontSize: '16px', fontWeight: 600, color: theme.colors.text.primary }}>
                  {screenName}
                </div>
                {screen.description && (
                  <div style={{ fontSize: '13px', color: theme.colors.text.tertiary }}>
                    {screen.description}
                  </div>
                )}
              </div>
              
              {/* Navigation badge */}
              {screen.navigation && screen.navigation.method && (
                <span 
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ 
                    background: `${theme.colors.accents.cyan || theme.colors.accents.blue}30`,
                    color: theme.colors.accents.cyan || theme.colors.accents.blue
                  }}
                >
                  🧭 has navigation
                </span>
              )}
              
              {/* Block count badge */}
              {screen.blocks && screen.blocks.length > 0 && (
                <span 
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ 
                    background: `${theme.colors.accents.purple}30`,
                    color: theme.colors.accents.purple
                  }}
                >
                  🧱 {screen.blocks.length} blocks
                </span>
              )}
            </div>
            
            <span 
              className="transition-transform"
              style={{ 
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                color: theme.colors.text.tertiary
              }}
            >
              ▼
            </span>
          </button>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="p-3 pt-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Drag overlay preview
 */
function DragOverlayContent({ screen, theme }) {
  const screenName = screen?.name || screen?.screenName || 'Screen';
  
  return (
    <div 
      className="rounded-lg p-3 shadow-2xl"
      style={{ 
        background: theme.colors.background.secondary,
        border: `2px solid ${theme.colors.accents.blue}`,
        opacity: 0.9
      }}
    >
      <div className="flex items-center gap-3">
        <span style={{ fontSize: '20px' }}>📄</span>
        <span style={{ fontWeight: 600, color: theme.colors.text.primary }}>
          {screenName}
        </span>
      </div>
    </div>
  );
}

/**
 * Main DraggableScreenList component
 */
export default function DraggableScreenList({
  screens,
  editMode,
  projectPath,
  theme,
  storedVariables,
  expandedScreens,
  onToggleExpand,
  onScreensReorder,
  onScreenUpdate,
  onScreenDelete,
  onScreenCopy,
  renderScreenContent
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (active.id !== over?.id) {
      // ✅ FIX: Use callback form to get CURRENT screens value
      // This avoids stale closure issues
      onScreensReorder((currentScreens) => {
        console.log('🎯 DragEnd - currentScreens:', currentScreens);
        
        const oldIndex = currentScreens.findIndex(s => 
          (s.name || s.screenName || `screen-${currentScreens.indexOf(s)}`) === active.id
        );
        const newIndex = currentScreens.findIndex(s => 
          (s.name || s.screenName || `screen-${currentScreens.indexOf(s)}`) === over.id
        );

        console.log('🎯 DragEnd - oldIndex:', oldIndex, 'newIndex:', newIndex);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(currentScreens, oldIndex, newIndex).map((screen, idx) => ({
            ...screen,
            order: idx
          }));
          console.log('🎯 DragEnd - reordered result:', reordered);
          return reordered;
        }
        return currentScreens;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeScreen = activeId 
    ? screens.find(s => (s.name || s.screenName) === activeId)
    : null;

  // Generate unique IDs for sortable context
  const screenIds = screens.map((s, idx) => s.name || s.screenName || `screen-${idx}`);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={screenIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {screens.map((screen, idx) => {
            const screenId = screen.name || screen.screenName || `screen-${idx}`;
            const isExpanded = expandedScreens.has(screenId);

            return (
              <SortableScreenItem
                key={screenId}
                screen={screen}
                index={idx}
                editMode={editMode}
                isExpanded={isExpanded}
                onToggleExpand={() => onToggleExpand(screenId)}
                onUpdate={(updates) => onScreenUpdate(screenId, updates)}
                onDelete={() => onScreenDelete(screenId)}
                onCopy={() => onScreenCopy(screen)}
                theme={theme}
              >
                {renderScreenContent(screen, idx, isExpanded)}
              </SortableScreenItem>
            );
          })}
        </div>
      </SortableContext>

      {/* Drag overlay */}
      <DragOverlay>
        {activeScreen ? (
          <DragOverlayContent screen={activeScreen} theme={theme} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}