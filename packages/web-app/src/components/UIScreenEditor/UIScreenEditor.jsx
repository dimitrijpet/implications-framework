// packages/web-app/src/components/UIScreenEditor/UIScreenEditor.jsx
import { useState } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';
import AddScreenModal from './AddScreenModal';
import CopyScreenDialog from './CopyScreenDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';

export default function UIScreenEditor({ state, onSave, onCancel, theme = defaultTheme }) {
  const [editMode, setEditMode] = useState(false);
  const [editedUI, setEditedUI] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [modifiedScreens, setModifiedScreens] = useState(new Set());

  // Modal state for Add Screen
  const [addScreenModal, setAddScreenModal] = useState({
    isOpen: false,
    platformName: '',
    platformDisplayName: ''
  });

  // Modal state for Copy Screen
  const [copyScreenDialog, setCopyScreenDialog] = useState({
    isOpen: false,
    screen: null,
    platformName: '',
    platformDisplayName: ''
  });

  // Modal state for Delete Confirmation
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    isOpen: false,
    screen: null,
    platformName: '',
    platformDisplayName: '',
    screenIndex: -1
  });

  // Initialize edited state
  const initializeEditedUI = () => {
    if (!state?.uiCoverage?.platforms) return null;
    return JSON.parse(JSON.stringify(state.uiCoverage.platforms));
  };

  const handleEnterEditMode = () => {
    setEditedUI(initializeEditedUI());
    setEditMode(true);
  };

  // ✅ FIXED: Add null check for editedUI
  const getAllScreens = () => {
    if (!editedUI) return [];
    
    const screens = [];
    Object.entries(editedUI).forEach(([platformName, platformData]) => {
      if (platformData.screens) {
        platformData.screens.forEach(screen => {
          screens.push({
            ...screen,
            platform: platformName
          });
        });
      }
    });
    return screens;
  };

  // Get available platforms for copy dialog
  const getAvailablePlatforms = () => {
    if (!editedUI) return [];
    
    return Object.entries(editedUI).map(([name, data]) => ({
      name,
      displayName: data.displayName || name
    }));
  };

  // Handler: Add Screen
  const handleAddScreen = (platformName, newScreen) => {
    setEditedUI(prev => {
      const platform = prev[platformName];
      return {
        ...prev,
        [platformName]: {
          ...platform,
          screens: [...(platform.screens || []), newScreen],
          count: (platform.count || 0) + 1
        }
      };
    });
    setHasChanges(true);
    console.log('✅ Screen added:', newScreen.originalName);
  };

  // Handler: Delete Screen
  const handleDeleteScreen = (platformName, screenIndex) => {
    setEditedUI(prev => {
      const platform = prev[platformName];
      return {
        ...prev,
        [platformName]: {
          ...platform,
          screens: platform.screens.filter((_, i) => i !== screenIndex),
          count: platform.count - 1
        }
      };
    });
    setHasChanges(true);
    console.log('🗑️ Screen deleted');
  };

  // Handler: Copy Screen
  const handleCopyScreen = (sourcePlatform, sourceScreen, targetPlatform, newName) => {
    const newScreen = {
      ...JSON.parse(JSON.stringify(sourceScreen)),
      name: newName,
      originalName: newName
    };

    setEditedUI(prev => {
      const platform = prev[targetPlatform];
      return {
        ...prev,
        [targetPlatform]: {
          ...platform,
          screens: [...(platform.screens || []), newScreen],
          count: (platform.count || 0) + 1
        }
      };
    });
    setHasChanges(true);
    console.log(`📋 Screen copied: ${sourceScreen.originalName} → ${newName}`);
  };

  const handleCancelEdit = () => {
    if (hasChanges && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    setEditMode(false);
    setEditedUI(null);
    setHasChanges(false);
  };

  const handleSaveChanges = async () => {
    console.log('💾 Saving UI changes:', editedUI);
    
    try {
      if (onSave) {
        await onSave(editedUI);
      }
      
      setEditMode(false);
      setHasChanges(false);
      setEditedUI(null);
      
    } catch (error) {
      console.error('❌ Save failed, staying in edit mode');
    }
  };

  // Get platforms data
  const platforms = editMode ? editedUI : state?.uiCoverage?.platforms || {};
  const platformNames = Object.keys(platforms);

  if (platformNames.length === 0) {
    return (
      <div 
        className="p-8 text-center rounded-lg"
        style={{ 
          background: `${theme.colors.background.tertiary}40`,
          border: `1px dashed ${theme.colors.border}`,
          color: theme.colors.text.tertiary
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖥️</div>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          No UI Coverage
        </div>
        <div style={{ fontSize: '14px', opacity: 0.8 }}>
          This state doesn't have any UI screen validations yet
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold" style={{ color: theme.colors.accents.purple }}>
            🖥️ UI Screen Editor
          </h3>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.tertiary }}>
            {editMode 
              ? 'Edit screen validations and elements'
              : `${platformNames.length} platform${platformNames.length !== 1 ? 's' : ''} • ${getTotalScreenCount(platforms)} screens`
            }
          </p>
        </div>

        <div className="flex gap-2">
          {!editMode ? (
            <button
              onClick={handleEnterEditMode}
              className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
              style={{ 
                background: theme.colors.accents.blue,
                color: 'white'
              }}
            >
              ✏️ Edit UI
            </button>
          ) : (
            <>
              <button
                onClick={handleSaveChanges}
                disabled={!hasChanges}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  hasChanges 
                    ? 'hover:brightness-110' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
                style={{ 
                  background: hasChanges ? theme.colors.accents.green : theme.colors.background.tertiary,
                  color: 'white'
                }}
              >
                💾 Save Changes
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                style={{ 
                  background: theme.colors.background.tertiary,
                  color: theme.colors.text.primary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                ❌ Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Unsaved Changes Badge */}
      {hasChanges && (
        <div 
          className="mb-4 p-3 rounded-lg flex items-center gap-2"
          style={{ 
            background: `${theme.colors.accents.yellow}20`,
            border: `2px solid ${theme.colors.accents.yellow}`
          }}
        >
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <span style={{ color: theme.colors.accents.yellow, fontWeight: 600 }}>
            You have unsaved changes
          </span>
        </div>
      )}
{/* Platform Sections */}
<div className="space-y-4">
  {platformNames.map(platformName => (
    <PlatformSection
      key={platformName}
      platformName={platformName}
      platformData={platforms[platformName]}
      editMode={editMode}
      onChange={(newData) => {
        console.log('🔄 Platform data changed:', platformName, newData);
        setEditedUI(prev => ({
          ...prev,
          [platformName]: newData
        }));
        setHasChanges(true);
        console.log('✅ hasChanges set to true');
      }}
      onOpenAddScreen={() => {
        setAddScreenModal({
          isOpen: true,
          platformName,
          platformDisplayName: platforms[platformName].displayName || platformName
        });
      }}
      // ✅ ADD THESE TWO:
      onOpenCopyDialog={(screen) => {
        setCopyScreenDialog({
          isOpen: true,
          screen,
          platformName,
          platformDisplayName: platforms[platformName].displayName || platformName
        });
      }}
      onOpenDeleteDialog={(screen, screenIndex) => {
        setDeleteConfirmDialog({
          isOpen: true,
          screen,
          platformName,
          platformDisplayName: platforms[platformName].displayName || platformName,
          screenIndex
        });
      }}
      theme={theme}
    />
  ))}
</div>

      {/* ✅ ADD MODALS HERE */}
      <AddScreenModal
        isOpen={addScreenModal.isOpen}
        onClose={() => setAddScreenModal({ 
          isOpen: false, 
          platformName: '', 
          platformDisplayName: '' 
        })}
        onAdd={handleAddScreen}
        platformName={addScreenModal.platformName}
        platformDisplayName={addScreenModal.platformDisplayName}
        existingScreens={getAllScreens()}
      />

      <CopyScreenDialog
        isOpen={copyScreenDialog.isOpen}
        onClose={() => setCopyScreenDialog({ 
          isOpen: false, 
          screen: null, 
          platformName: '', 
          platformDisplayName: '' 
        })}
        onCopy={handleCopyScreen}
        screen={copyScreenDialog.screen}
        sourcePlatformName={copyScreenDialog.platformName}
        sourcePlatformDisplayName={copyScreenDialog.platformDisplayName}
        availablePlatforms={getAvailablePlatforms()}
        allScreens={getAllScreens()}
      />

      <DeleteConfirmDialog
        isOpen={deleteConfirmDialog.isOpen}
        onClose={() => setDeleteConfirmDialog({ 
          isOpen: false, 
          screen: null, 
          platformName: '', 
          platformDisplayName: '', 
          screenIndex: -1 
        })}
        onConfirm={() => handleDeleteScreen(
          deleteConfirmDialog.platformName, 
          deleteConfirmDialog.screenIndex
        )}
        screenName={deleteConfirmDialog.screen?.originalName}
        platformDisplayName={deleteConfirmDialog.platformDisplayName}
      />
    </div>
  );
}
// Platform Section Component
function PlatformSection({ 
  platformName, 
  platformData, 
  editMode, 
  onChange, 
  onOpenAddScreen,
  onOpenCopyDialog,     // ✅ ADD THIS
  onOpenDeleteDialog,   // ✅ ADD THIS
  theme 
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const getPlatformIcon = (name) => {
    const icons = {
      web: '🌐',
      dancer: '💃',
      clubApp: '📱',
      mobile: '📲'
    };
    return icons[name] || '🖥️';
  };

  const getPlatformColor = (name) => {
    const colors = {
      web: theme.colors.accents.blue,
      dancer: theme.colors.accents.pink,
      clubApp: theme.colors.accents.purple,
      mobile: theme.colors.accents.green
    };
    return colors[name] || theme.colors.accents.blue;
  };

  const color = getPlatformColor(platformName);
  const icon = getPlatformIcon(platformName);
  const screenCount = platformData?.screens?.length || 0;

  return (
    <div 
      className="rounded-lg border overflow-hidden"
      style={{ 
        background: `${theme.colors.background.tertiary}80`,
        borderColor: isExpanded ? color : theme.colors.border,
        borderWidth: isExpanded ? '2px' : '1px'
      }}
    >
      {/* Platform Header */}
      <div 
        className="p-4 flex items-center justify-between"
        style={{ background: `${color}10` }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 hover:opacity-80 transition flex-1"
        >
          <span style={{ fontSize: '24px' }}>{icon}</span>
          <div className="text-left">
            <div className="font-bold text-lg" style={{ color }}>
              {platformName.charAt(0).toUpperCase() + platformName.slice(1)}
            </div>
            <div className="text-sm" style={{ color: theme.colors.text.tertiary }}>
              {screenCount} screen{screenCount !== 1 ? 's' : ''}
            </div>
          </div>
          
          <span 
            className="text-2xl transition-transform ml-2"
            style={{ 
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              color: theme.colors.text.tertiary
            }}
          >
            ▼
          </span>
        </button>

        {editMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenAddScreen();
            }}
            className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110 ml-2"
            style={{ background: color, color: 'white' }}
          >
            ➕ Add Screen
          </button>
        )}
      </div>

      {/* Screens */}
      {isExpanded && platformData?.screens && (
        <div className="p-4 space-y-3">
          {platformData.screens.map((screen, index) => (
            <ScreenCard
              key={index}
              screen={screen}
              index={index}
              platformName={platformName}
              platformDisplayName={platformData.displayName || platformName}
              editMode={editMode}
              onChange={(newScreen) => {
                const newScreens = [...platformData.screens];
                newScreens[index] = newScreen;
                onChange({ ...platformData, screens: newScreens });
              }}
              onDelete={() => {
                if (window.confirm(`Delete screen "${screen.name}"?`)) {
                  const newScreens = platformData.screens.filter((_, i) => i !== index);
                  onChange({ ...platformData, screens: newScreens });
                }
              }}
              // ✅ FIXED: Use the props passed down from parent
              onCopy={(screen) => onOpenCopyDialog(screen)}
              onDeleteConfirm={() => onOpenDeleteDialog(screen, index)}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Screen Card Component
// Screen Card Component
function ScreenCard({ 
  screen, 
  index, 
  platformName,
  platformDisplayName,
  editMode, 
  onChange, 
  onDelete,
  onCopy,              // ← ADD THIS
  onDeleteConfirm,     // ← ADD THIS
  onMarkModified, 
  theme 
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const topLevelVisible = screen.visible || [];
  const checksVisible = screen.checks?.visible || [];
  const allVisible = [...topLevelVisible, ...checksVisible];

  const topLevelHidden = screen.hidden || [];
  const checksHidden = screen.checks?.hidden || [];
  const allHidden = [...topLevelHidden, ...checksHidden];

  const textChecks = screen.checks?.text || {};

  const updateScreen = (updates) => {
    const updatedScreen = { ...screen, ...updates };
    console.log('🔄 Screen updated:', updatedScreen);
    onChange(updatedScreen);
    
    if (onMarkModified) {
      const screenId = `${platformName}.${screen.originalName || screen.name}.${index}`;
      onMarkModified(screenId);
    }
  };

  return (
    <div 
      className="rounded-lg border"
      style={{ 
        background: theme.colors.background.secondary,
        borderColor: theme.colors.border
      }}
    >
      {/* Screen Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '18px' }}>📄</span>
          <div className="font-semibold" style={{ color: theme.colors.text.primary }}>
            {screen.name}
          </div>
          {screen.description && (
            <div 
              className="text-xs italic px-2 py-0.5 rounded max-w-md truncate"
              style={{ 
                background: `${theme.colors.accents.blue}20`,
                color: theme.colors.accents.blue
              }}
              title={screen.description}
            >
              {screen.description}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stats */}
          <div className="flex gap-2 text-xs">
            {allVisible.length > 0 && (
              <span 
                className="px-2 py-1 rounded font-semibold"
                style={{ background: `${theme.colors.accents.green}20`, color: theme.colors.accents.green }}
              >
                ✅ {allVisible.length}
              </span>
            )}
            {allHidden.length > 0 && (
              <span 
                className="px-2 py-1 rounded font-semibold"
                style={{ background: `${theme.colors.accents.red}20`, color: theme.colors.accents.red }}
              >
                ❌ {allHidden.length}
              </span>
            )}
            {Object.keys(textChecks).length > 0 && (
              <span 
                className="px-2 py-1 rounded font-semibold"
                style={{ background: `${theme.colors.accents.yellow}20`, color: theme.colors.accents.yellow }}
              >
                📝 {Object.keys(textChecks).length}
              </span>
            )}
          </div>
          <span 
            className="text-lg transition-transform"
            style={{ 
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              color: theme.colors.text.tertiary
            }}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Screen Details */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3">
          {/* Element sections... (keeping your existing code) */}
          {(topLevelVisible.length > 0 || editMode) && (
            <ElementSection
              title="✅ Visible (top-level)"
              elements={topLevelVisible}
              color={theme.colors.accents.green}
              editMode={editMode}
              onChange={(newElements) => {
                updateScreen({ visible: newElements });
              }}
              theme={theme}
            />
          )}

          {(checksVisible.length > 0 || editMode) && (
            <ElementSection
              title="✅ Visible (checks)"
              elements={checksVisible}
              color={theme.colors.accents.green}
              editMode={editMode}
              onChange={(newElements) => {
                updateScreen({ 
                  checks: { 
                    ...screen.checks, 
                    visible: newElements 
                  } 
                });
              }}
              theme={theme}
            />
          )}

          {(topLevelHidden.length > 0 || editMode) && (
            <ElementSection
              title="❌ Hidden (top-level)"
              elements={topLevelHidden}
              color={theme.colors.accents.red}
              editMode={editMode}
              onChange={(newElements) => {
                updateScreen({ hidden: newElements });
              }}
              theme={theme}
            />
          )}

          {(checksHidden.length > 0 || editMode) && (
            <ElementSection
              title="❌ Hidden (checks)"
              elements={checksHidden}
              color={theme.colors.accents.red}
              editMode={editMode}
              onChange={(newElements) => {
                updateScreen({ 
                  checks: { 
                    ...screen.checks, 
                    hidden: newElements 
                  } 
                });
              }}
              theme={theme}
            />
          )}

          {(Object.keys(textChecks).length > 0 || editMode) && (
            <TextChecksSection
              textChecks={textChecks}
              editMode={editMode}
              onChange={(newTextChecks) => {
                updateScreen({ 
                  checks: { 
                    ...screen.checks, 
                    text: newTextChecks 
                  } 
                });
              }}
              theme={theme}
            />
          )}

          {/* Edit Actions */}
          {editMode && (
            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: theme.colors.border }}>
              {/* Copy Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCopy) {
                    onCopy(screen);  // ← Use onCopy prop
                  }
                }}
                className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110"
                style={{ 
                  background: theme.colors.background.tertiary,
                  color: theme.colors.text.primary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                📋 Copy Screen
              </button>
              
              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDeleteConfirm) {
                    onDeleteConfirm();  // ← Use onDeleteConfirm prop
                  }
                }}
                className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110"
                style={{ 
                  background: `${theme.colors.accents.red}20`,
                  color: theme.colors.accents.red,
                  border: `1px solid ${theme.colors.accents.red}40`
                }}
              >
                🗑️ Delete Screen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Element Section Component (keep your existing code)
function ElementSection({ title, elements, color, editMode, onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newElement, setNewElement] = useState('');

  const handleAddElement = () => {
    if (!newElement.trim()) return;
    
    if (elements.includes(newElement.trim())) {
      alert('Element already exists!');
      return;
    }
    
    onChange([...elements, newElement.trim()]);
    setNewElement('');
    setIsAdding(false);
  };

  const handleRemoveElement = (index) => {
    onChange(elements.filter((_, i) => i !== index));
  };

  return (
    <div 
      className="p-3 rounded"
      style={{ background: `${color}10`, border: `1px solid ${color}40` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color }}>
          {title} ({elements.length})
        </div>
        
        {editMode && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
            style={{ background: color, color: 'white' }}
          >
            ➕ Add
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {elements.map((element, i) => (
          <div
            key={i}
            className="group relative px-2 py-1 rounded text-xs font-mono flex items-center gap-1"
            style={{ 
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border}`
            }}
          >
            {element}
            
            {editMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveElement(i);
                }}
                className="opacity-0 group-hover:opacity-100 transition ml-1 text-red-400 hover:text-red-300"
                title="Remove"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        
        {isAdding && (
          <div className="flex gap-1">
            <input
              type="text"
              value={newElement}
              onChange={(e) => setNewElement(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddElement();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewElement('');
                }
              }}
              placeholder="element-name"
              autoFocus
              className="px-2 py-1 rounded text-xs font-mono"
              style={{
                background: theme.colors.background.secondary,
                border: `2px solid ${color}`,
                color: theme.colors.text.primary,
                width: '120px'
              }}
            />
            <button
              onClick={handleAddElement}
              className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
              style={{ background: theme.colors.accents.green, color: 'white' }}
            >
              ✓
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewElement('');
              }}
              className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
              style={{ background: theme.colors.accents.red, color: 'white' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      
      {elements.length === 0 && !isAdding && (
        <div className="text-xs italic" style={{ color: theme.colors.text.tertiary }}>
          No elements
        </div>
      )}
    </div>
  );
}

// Text Checks Section Component (keep your existing code)
function TextChecksSection({ textChecks, editMode, onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleAddCheck = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    
    if (textChecks[newKey.trim()]) {
      alert('Key already exists!');
      return;
    }
    
    onChange({
      ...textChecks,
      [newKey.trim()]: newValue.trim()
    });
    
    setNewKey('');
    setNewValue('');
    setIsAdding(false);
  };

  const handleRemoveCheck = (key) => {
    const { [key]: removed, ...rest } = textChecks;
    onChange(rest);
  };

  const handleEditCheck = (key) => {
    setEditingKey(key);
    setEditValue(textChecks[key]);
  };

  const handleSaveEdit = (oldKey) => {
    if (!editValue.trim()) return;
    
    const { [oldKey]: removed, ...rest } = textChecks;
    onChange({
      ...rest,
      [oldKey]: editValue.trim()
    });
    
    setEditingKey(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  return (
    <div 
      className="p-3 rounded"
      style={{ 
        background: `${theme.colors.accents.yellow}10`,
        border: `1px solid ${theme.colors.accents.yellow}40`
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div 
          className="font-semibold"
          style={{ color: theme.colors.accents.yellow }}
        >
          📝 Text Checks ({Object.keys(textChecks).length})
        </div>
        
        {editMode && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
            style={{ background: theme.colors.accents.yellow, color: 'white' }}
          >
            ➕ Add
          </button>
        )}
      </div>

      <div className="space-y-2">
        {Object.entries(textChecks).map(([key, value], i) => (
          <div 
            key={i}
            className="group flex items-center gap-2 text-sm"
          >
            <span 
              className="px-2 py-1 rounded font-mono"
              style={{ 
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary
              }}
            >
              {key}
            </span>
            <span style={{ color: theme.colors.text.tertiary }}>→</span>
            
            {editingKey === key ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(key);
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  autoFocus
                  className="flex-1 px-2 py-1 rounded text-xs"
                  style={{
                    background: theme.colors.background.secondary,
                    border: `2px solid ${theme.colors.accents.yellow}`,
                    color: theme.colors.text.primary
                  }}
                />
                <button
                  onClick={() => handleSaveEdit(key)}
                  className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
                  style={{ background: theme.colors.accents.green, color: 'white' }}
                >
                  ✓
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
                  style={{ background: theme.colors.accents.red, color: 'white' }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <span style={{ color: theme.colors.accents.yellow }}>
                  "{value}"
                </span>
                
                {editMode && (
                  <div className="opacity-0 group-hover:opacity-100 transition flex gap-1 ml-auto">
                    <button
                      onClick={() => handleEditCheck(key)}
                      className="text-blue-400 hover:text-blue-300 text-xs"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleRemoveCheck(key)}
                      className="text-red-400 hover:text-red-300 text-xs"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        
        {isAdding && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCheck();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewKey('');
                  setNewValue('');
                }
              }}
              placeholder="element"
              autoFocus
              className="px-2 py-1 rounded text-xs font-mono"
              style={{
                background: theme.colors.background.secondary,
                border: `2px solid ${theme.colors.accents.yellow}`,
                color: theme.colors.text.primary,
                width: '100px'
              }}
            />
            <span style={{ color: theme.colors.text.tertiary }}>→</span>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCheck();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewKey('');
                  setNewValue('');
                }
              }}
              placeholder="expected text"
              className="flex-1 px-2 py-1 rounded text-xs"
              style={{
                background: theme.colors.background.secondary,
                border: `2px solid ${theme.colors.accents.yellow}`,
                color: theme.colors.text.primary
              }}
            />
            <button
              onClick={handleAddCheck}
              className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
              style={{ background: theme.colors.accents.green, color: 'white' }}
            >
              ✓
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewKey('');
                setNewValue('');
              }}
              className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
              style={{ background: theme.colors.accents.red, color: 'white' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      
      {Object.keys(textChecks).length === 0 && !isAdding && (
        <div className="text-xs italic" style={{ color: theme.colors.text.tertiary }}>
          No text checks
        </div>
      )}
    </div>
  );
}

function getTotalScreenCount(platforms) {
  return Object.values(platforms).reduce(
    (sum, platform) => sum + (platform?.screens?.length || 0),
    0
  );
}