// packages/web-app/src/components/UIScreenEditor/UIScreenEditor.jsx
// COMPLETE FILE with POM Integration

import { useState } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';
import AddScreenModal from './AddScreenModal';
import CopyScreenDialog from './CopyScreenDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import POMFieldSelector from './POMFieldSelector';  // For screen-level POM selection
import FieldAutocomplete from './FieldAutocomplete';  // ✅ NEW - For element-level field selection

export default function UIScreenEditor({ 
  state, 
  projectPath,  // ✅ NEW PROP
  onSave, 
  onCancel, 
  theme = defaultTheme 
}) {
  console.log('🎨 UIScreenEditor received:', { 
    state, 
    projectPath,  // ✅ LOG IT
    hasUiCoverage: !!state?.uiCoverage,
    hasMeta: !!state?.meta,
    platforms: state?.uiCoverage?.platforms || state?.meta?.uiCoverage?.platforms
  });
  
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
    const platforms = state?.uiCoverage?.platforms || state?.meta?.uiCoverage?.platforms;
    console.log('🔄 initializeEditedUI - platforms:', platforms);
    if (!platforms) return null;
    return JSON.parse(JSON.stringify(platforms));
  };
  
  const uiData = state?.uiCoverage?.platforms || state?.meta?.uiCoverage?.platforms;
  console.log('🖼️ UI Data for rendering:', uiData);
  console.log('🖼️ Edit mode:', editMode);
  console.log('🖼️ Edited UI:', editedUI);

  const handleEnterEditMode = () => {
    setEditedUI(initializeEditedUI());
    setEditMode(true);
  };

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
  const platforms = editMode ? editedUI : (state?.uiCoverage?.platforms || state?.meta?.uiCoverage?.platforms || {});
  const platformNames = Object.keys(platforms);

  if (platformNames.length === 0 && !editMode) {
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
        <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '24px' }}>
          This state doesn't have any UI screen validations yet
        </div>
        <button
          onClick={() => {
            setEditedUI({
              web: {
                displayName: 'Web',
                count: 0,
                screens: []
              }
            });
            setEditMode(true);
          }}
          className="px-4 py-2 rounded font-semibold transition hover:brightness-110"
          style={{ 
            background: theme.colors.accents.blue,
            color: 'white'
          }}
        >
          Add First Screen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '24px' }}>🖥️</span>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: theme.colors.text.primary }}>
            UI Screens
          </h3>
        </div>

        {!editMode ? (
          <button
            onClick={handleEnterEditMode}
            className="px-4 py-2 rounded font-semibold transition hover:brightness-110"
            style={{ 
              background: theme.colors.accents.blue,
              color: 'white'
            }}
          >
            ✏️ Edit State
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSaveChanges}
              disabled={!hasChanges}
              className="px-4 py-2 rounded font-semibold transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                background: theme.colors.accents.green,
                color: 'white'
              }}
            >
              💾 Save Changes
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 rounded font-semibold transition hover:brightness-110"
              style={{ 
                background: theme.colors.background.tertiary,
                color: theme.colors.text.secondary,
                border: `1px solid ${theme.colors.border}`
              }}
            >
              ✕ Cancel
            </button>
          </div>
        )}
      </div>

      {/* Platforms */}
      {platformNames.map(platformName => {
        const platformData = platforms[platformName];
        
        return (
          <PlatformSection
            key={platformName}
            platformName={platformName}
            platformData={platformData}
            editMode={editMode}
            projectPath={projectPath}  // ✅ PASS projectPath
            onChange={(updated) => {
              if (editMode) {
                setEditedUI(prev => ({
                  ...prev,
                  [platformName]: updated
                }));
                setHasChanges(true);
              }
            }}
            onOpenAddScreenModal={() => {
              setAddScreenModal({
                isOpen: true,
                platformName,
                platformDisplayName: platformData.displayName || platformName
              });
            }}
            onOpenCopyDialog={(screen) => {
              setCopyScreenDialog({
                isOpen: true,
                screen,
                platformName,
                platformDisplayName: platformData.displayName || platformName
              });
            }}
            onOpenDeleteDialog={(screen, index) => {
              setDeleteConfirmDialog({
                isOpen: true,
                screen,
                platformName,
                platformDisplayName: platformData.displayName || platformName,
                screenIndex: index
              });
            }}
            theme={theme}
          />
        );
      })}

      {/* Modals */}
      {addScreenModal.isOpen && (
        <AddScreenModal
          isOpen={addScreenModal.isOpen}
          platformName={addScreenModal.platformName}
          platformDisplayName={addScreenModal.platformDisplayName}
          existingScreens={getAllScreens()}
          onClose={() => setAddScreenModal({ isOpen: false, platformName: '', platformDisplayName: '' })}
          onAdd={(newScreen) => {
            handleAddScreen(addScreenModal.platformName, newScreen);
            setAddScreenModal({ isOpen: false, platformName: '', platformDisplayName: '' });
          }}
          theme={theme}
        />
      )}

      {copyScreenDialog.isOpen && (
        <CopyScreenDialog
          isOpen={copyScreenDialog.isOpen}
          screen={copyScreenDialog.screen}
          sourcePlatform={copyScreenDialog.platformName}
          sourcePlatformDisplayName={copyScreenDialog.platformDisplayName}
          availablePlatforms={getAvailablePlatforms()}
          onClose={() => setCopyScreenDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '' })}
          onCopy={(targetPlatform, newName) => {
            handleCopyScreen(
              copyScreenDialog.platformName,
              copyScreenDialog.screen,
              targetPlatform,
              newName
            );
            setCopyScreenDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '' });
          }}
          theme={theme}
        />
      )}

      {deleteConfirmDialog.isOpen && (
        <DeleteConfirmDialog
          isOpen={deleteConfirmDialog.isOpen}
          screen={deleteConfirmDialog.screen}
          platformDisplayName={deleteConfirmDialog.platformDisplayName}
          onClose={() => setDeleteConfirmDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '', screenIndex: -1 })}
          onConfirm={() => {
            handleDeleteScreen(deleteConfirmDialog.platformName, deleteConfirmDialog.screenIndex);
            setDeleteConfirmDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '', screenIndex: -1 });
          }}
          theme={theme}
        />
      )}
    </div>
  );
}
// ============================================
// PART 2: PlatformSection Component
// ============================================

function PlatformSection({ 
  platformName, 
  platformData, 
  editMode, 
  projectPath,  // ✅ NEW PROP
  onChange, 
  onOpenAddScreenModal,
  onOpenCopyDialog,
  onOpenDeleteDialog,
  theme 
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const platformIcon = platformName === 'web' ? '🌐' : platformName === 'mobile' ? '📱' : '💻';

  return (
    <div 
      className="rounded-lg border"
      style={{ 
        background: theme.colors.background.secondary,
        borderColor: theme.colors.border
      }}
    >
      {/* Platform Header */}
      <div className="p-3 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          <span style={{ fontSize: '24px' }}>{platformIcon}</span>
          <div>
            <div className="font-semibold" style={{ color: theme.colors.text.primary }}>
              {platformData.displayName || platformName}
            </div>
            <div className="text-xs" style={{ color: theme.colors.text.tertiary }}>
              {platformData.count || 0} screen{platformData.count !== 1 ? 's' : ''}
            </div>
          </div>
          <span 
            className="text-lg transition-transform ml-2"
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
            onClick={onOpenAddScreenModal}
            className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110"
            style={{ 
              background: theme.colors.accents.blue,
              color: 'white'
            }}
          >
            ➕ Add Screen
          </button>
        )}
      </div>

      {/* Screens */}
      {isExpanded && platformData.screens && (
        <div className="p-3 pt-0 grid gap-3">
          {platformData.screens.map((screen, index) => (
            <ScreenCard
              key={`${screen.originalName || screen.name}-${index}`}
              screen={screen}
              index={index}
              platformName={platformName}
              platformDisplayName={platformData.displayName || platformName}
              editMode={editMode}
              projectPath={projectPath}  // ✅ PASS projectPath
              onChange={(updatedScreen) => {
                const newScreens = [...platformData.screens];
                newScreens[index] = updatedScreen;
                onChange({ ...platformData, screens: newScreens });
              }}
              onDelete={() => {
                if (window.confirm(`Delete screen "${screen.name}"?`)) {
                  const newScreens = platformData.screens.filter((_, i) => i !== index);
                  onChange({ ...platformData, screens: newScreens });
                }
              }}
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

// ============================================
// PART 3: ScreenCard Component with POM Integration
// ============================================

function ScreenCard({ 
  screen, 
  index, 
  platformName,
  platformDisplayName,
  editMode, 
  projectPath,  // ✅ NEW PROP
  onChange, 
  onDelete,
  onCopy,
  onDeleteConfirm,
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
          
          {/* 🎯 POM SELECTOR SECTION - NEW! */}
          {editMode && projectPath && (
            <div 
              className="p-3 rounded-lg border-2 border-dashed"
              style={{ 
                borderColor: theme.colors.accents.blue,
                background: `${theme.colors.accents.blue}10`
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: '20px' }}>🔍</span>
                <div className="font-semibold" style={{ color: theme.colors.accents.blue }}>
                  Page Object Model
                </div>
              </div>
              
              <POMFieldSelector 
                projectPath={projectPath}
                screenName={screen.name}
                pomName={screen.pom}
                instanceName={screen.instance}
                onPOMChange={(pom) => {
                  updateScreen({ 
                    pom,
                    instance: null,  // Reset instance when POM changes
                    pomPath: 'tests/screenObjects'  // Default path
                  });
                }}
                onInstanceChange={(instance) => {
                  updateScreen({ instance });
                }}
              />
              
              {screen.pom && (
                <div className="mt-2 text-xs" style={{ color: theme.colors.text.tertiary }}>
                  💡 Fields will be validated against <span className="font-mono">{screen.pom}</span>
                  {screen.instance && <span> → <span className="font-mono">{screen.instance}</span></span>}
                </div>
              )}
            </div>
          )}

          {/* Element Sections */}
          {(topLevelVisible.length > 0 || editMode) && (
            <ElementSection
              title="✅ Visible (top-level)"
              elements={topLevelVisible}
              color={theme.colors.accents.green}
              editMode={editMode}
              projectPath={projectPath}  // ✅ PASS POM context
              pomName={screen.pom}
              instanceName={screen.instance}
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
              projectPath={projectPath}
              pomName={screen.pom}
              instanceName={screen.instance}
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
              projectPath={projectPath}
              pomName={screen.pom}
              instanceName={screen.instance}
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
              projectPath={projectPath}
              pomName={screen.pom}
              instanceName={screen.instance}
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCopy) {
                    onCopy(screen);
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
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDeleteConfirm) {
                    onDeleteConfirm();
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
// ============================================
// PART 3: ElementSection Component with POM Validation
// ============================================

function ElementSection({ 
  title, 
  elements, 
  color, 
  editMode, 
  projectPath,      // ✅ NEW PROPS for POM validation
  pomName,          // ✅
  instanceName,     // ✅
  onChange, 
  theme 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newElement, setNewElement] = useState('');
  const [fieldValidation, setFieldValidation] = useState(null);

  const handleAddElement = () => {
    if (!newElement.trim()) return;
    
    // ✅ CHECK: Block if validation failed
    if (projectPath && pomName && fieldValidation === false) {
      alert('⚠️ Cannot add invalid field!\n\nThis field does not exist in the selected POM.');
      return;
    }
    
    if (elements.includes(newElement.trim())) {
      alert('Element already exists!');
      return;
    }
    
    onChange([...elements, newElement.trim()]);
    setNewElement('');
    setIsAdding(false);
    setFieldValidation(null);
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
            className="px-2 py-1 rounded text-sm font-mono flex items-center gap-1"
            style={{ background: `${color}20`, color }}
          >
            {element}
            {editMode && (
              <button
                onClick={() => handleRemoveElement(i)}
                className="ml-1 hover:text-red-500 transition"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {/* 🎯 ADD ELEMENT WITH POM VALIDATION */}
        {isAdding && (
          <div className="w-full mt-2">
            {projectPath && pomName ? (
              // Use field autocomplete if POM selected (instance optional)
              <div className="space-y-2">
                <FieldAutocomplete 
                  projectPath={projectPath}
                  pomName={pomName}
                  instanceName={instanceName}  // Optional - can be null
                  fieldValue={newElement}
                  onFieldChange={setNewElement}
                  onValidationChange={setFieldValidation}
                  placeholder="Type field name or select from dropdown"
                />
                
                <div className="flex gap-2">
                  <button
                    onClick={handleAddElement}
                    disabled={fieldValidation === false}
                    className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      background: fieldValidation === false ? '#94a3b8' : color, 
                      color: 'white' 
                    }}
                    title={fieldValidation === false ? '⚠️ This field does not exist in the selected POM' : 'Add this field to the list'}
                  >
                    {fieldValidation === false ? '⚠️ Invalid' : 'Add'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewElement('');
                      setFieldValidation(null);
                    }}
                    className="px-3 py-1 rounded text-sm"
                    style={{ background: theme.colors.background.tertiary, color: theme.colors.text.secondary }}
                  >
                    Cancel
                  </button>
                </div>
                
                {fieldValidation === false && newElement && (
                  <div className="text-xs text-amber-600 flex items-center gap-1">
                    ⚠️ This field doesn't exist in {pomName}.{instanceName}
                  </div>
                )}
              </div>
            ) : (
              // Fallback to simple input if POM not selected
              <div className="space-y-2">
                <input
                  type="text"
                  value={newElement}
                  onChange={(e) => setNewElement(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddElement()}
                  placeholder="Element name..."
                  className="w-full px-2 py-1 rounded border text-sm"
                  autoFocus
                  style={{
                    background: theme.colors.background.primary,
                    borderColor: theme.colors.border,
                    color: theme.colors.text.primary
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddElement}
                    className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110"
                    style={{ background: color, color: 'white' }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewElement('');
                    }}
                    className="px-3 py-1 rounded text-sm"
                    style={{ background: theme.colors.background.tertiary, color: theme.colors.text.secondary }}
                  >
                    Cancel
                  </button>
                </div>
                {!pomName && (
                  <div className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                    💡 Select a POM above to get field suggestions
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {elements.length === 0 && !isAdding && (
        <div className="text-center py-2 text-sm" style={{ color: theme.colors.text.tertiary }}>
          No elements
        </div>
      )}
    </div>
  );
}

// ============================================
// PART 4: TextChecksSection Component
// ============================================

function TextChecksSection({ textChecks, editMode, onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSelector, setNewSelector] = useState('');
  const [newExpectedText, setNewExpectedText] = useState('');

  const handleAddTextCheck = () => {
    if (!newSelector.trim() || !newExpectedText.trim()) return;
    
    if (textChecks[newSelector]) {
      alert('Text check for this selector already exists!');
      return;
    }
    
    onChange({
      ...textChecks,
      [newSelector.trim()]: newExpectedText.trim()
    });
    
    setNewSelector('');
    setNewExpectedText('');
    setIsAdding(false);
  };

  const handleRemoveTextCheck = (selector) => {
    const updated = { ...textChecks };
    delete updated[selector];
    onChange(updated);
  };

  const color = theme.colors.accents.yellow;

  return (
    <div 
      className="p-3 rounded"
      style={{ background: `${color}10`, border: `1px solid ${color}40` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color }}>
          📝 Text Checks ({Object.keys(textChecks).length})
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

      <div className="space-y-2">
        {Object.entries(textChecks).map(([selector, expectedText]) => (
          <div
            key={selector}
            className="p-2 rounded text-sm"
            style={{ background: `${color}20` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="font-mono text-xs mb-1" style={{ color }}>
                  {selector}
                </div>
                <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
                  "{expectedText}"
                </div>
              </div>
              {editMode && (
                <button
                  onClick={() => handleRemoveTextCheck(selector)}
                  className="hover:text-red-500 transition"
                  style={{ color }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}

        {isAdding && (
          <div className="space-y-2 p-2 rounded" style={{ background: `${color}15` }}>
            <input
              type="text"
              value={newSelector}
              onChange={(e) => setNewSelector(e.target.value)}
              placeholder="Selector (e.g., data-testid or POM path)"
              className="w-full px-2 py-1 rounded border text-sm"
              style={{
                background: theme.colors.background.primary,
                borderColor: theme.colors.border,
                color: theme.colors.text.primary
              }}
            />
            <input
              type="text"
              value={newExpectedText}
              onChange={(e) => setNewExpectedText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTextCheck()}
              placeholder="Expected text"
              className="w-full px-2 py-1 rounded border text-sm"
              style={{
                background: theme.colors.background.primary,
                borderColor: theme.colors.border,
                color: theme.colors.text.primary
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddTextCheck}
                className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110"
                style={{ background: color, color: 'white' }}
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewSelector('');
                  setNewExpectedText('');
                }}
                className="px-3 py-1 rounded text-sm"
                style={{ background: theme.colors.background.tertiary, color: theme.colors.text.secondary }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      
      {Object.keys(textChecks).length === 0 && !isAdding && (
        <div className="text-center py-2 text-sm" style={{ color: theme.colors.text.tertiary }}>
          No text checks
        </div>
      )}
    </div>
  );
}