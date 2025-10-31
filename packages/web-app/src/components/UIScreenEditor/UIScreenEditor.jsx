// packages/web-app/src/components/UIScreenEditor/UIScreenEditor.jsx
// ✨ COMPLETE REFACTOR with Source Attribution
import { useMemo, useState } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';
import AddScreenModal from './AddScreenModal';
import CopyScreenDialog from './CopyScreenDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import POMFieldSelector from './POMFieldSelector';
import FieldAutocomplete from './FieldAutocomplete';
import FunctionSelector from './FunctionSelector';
import ElementList from '../SourceAttribution/ElementList';
import SourceLegend from '../SourceAttribution/SourceLegend';

export default function UIScreenEditor({ state, projectPath, theme, onSave, onCancel }) {
  const [editMode, setEditMode] = useState(false);
  const [editedUI, setEditedUI] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [modifiedScreens, setModifiedScreens] = useState(new Set());

  // Modal states
  const [addScreenModal, setAddScreenModal] = useState({
    isOpen: false,
    platformName: '',
    platformDisplayName: ''
  });

  const [copyScreenDialog, setCopyScreenDialog] = useState({
    isOpen: false,
    screen: null,
    platformName: '',
    platformDisplayName: ''
  });

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
    if (!platforms) return null;
    return JSON.parse(JSON.stringify(platforms));
  };

  const handleEnterEditMode = () => {
    setEditedUI(initializeEditedUI());
    setEditMode(true);
  };

  const handleAddScreen = (platformName, screenName, screenData) => {
    setEditedUI(prev => ({
      ...prev,
      [platformName]: {
        ...prev[platformName],
        screens: [
          ...(prev[platformName]?.screens || []),
          screenData[0] || screenData
        ]
      }
    }));
    setHasChanges(true);
  };

  const handleDeleteScreen = (platformName, screenIndex) => {
    setEditedUI(prev => {
      if (!prev || !prev[platformName]) return prev;
      
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
  };

  const handleCopyScreen = (sourcePlatform, sourceScreen, targetPlatform, newName) => {
    const newScreen = {
      ...JSON.parse(JSON.stringify(sourceScreen)),
      name: newName,
      originalName: newName
    };

    setEditedUI(prev => {
      if (!prev || !prev[targetPlatform]) return prev;
      
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

  const getAvailablePlatforms = () => {
    if (!editedUI) return [];
    return Object.entries(editedUI).map(([name, data]) => ({
      name,
      displayName: data.displayName || name
    }));
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
            ✏️ Edit UI
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSaveChanges}
              disabled={!hasChanges}
              className="px-4 py-2 rounded font-semibold transition hover:brightness-110 disabled:opacity-50"
              style={{ 
                background: theme.colors.accents.green,
                color: 'white'
              }}
            >
              ✅ Save Changes
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 rounded font-semibold transition hover:brightness-110"
              style={{ 
                background: theme.colors.accents.red,
                color: 'white'
              }}
            >
              ❌ Cancel
            </button>
          </div>
        )}
      </div>

      {/* Platforms List */}
      <div className="space-y-4">
        {platformNames.map(platformName => {
          const platformData = platforms[platformName];
          const screens = platformData.screens || [];

          return (
            <PlatformSection
              key={platformName}
              platformName={platformName}
              platformData={platformData}
              screens={screens}
              editMode={editMode}
              projectPath={projectPath}
              theme={theme}
              onScreenUpdate={(screenIndex, updatedScreen) => {
                setEditedUI(prev => {
                  if (!prev || !prev[platformName]) return prev;
                  
                  const platform = prev[platformName];
                  const updatedScreens = [...platform.screens];
                  updatedScreens[screenIndex] = updatedScreen;
                  
                  return {
                    ...prev,
                    [platformName]: {
                      ...platform,
                      screens: updatedScreens
                    }
                  };
                });
                setHasChanges(true);
                setModifiedScreens(prev => new Set(prev).add(`${platformName}-${screenIndex}`));
              }}
              onAddScreen={() => {
                setAddScreenModal({
                  isOpen: true,
                  platformName,
                  platformDisplayName: platformData.displayName || platformName
                });
              }}
              onDeleteScreen={(screenIndex) => {
                const screen = screens[screenIndex];
                setDeleteConfirmDialog({
                  isOpen: true,
                  screen,
                  platformName,
                  platformDisplayName: platformData.displayName || platformName,
                  screenIndex
                });
              }}
              onCopyScreen={(screen) => {
                setCopyScreenDialog({
                  isOpen: true,
                  screen,
                  platformName,
                  platformDisplayName: platformData.displayName || platformName
                });
              }}
            />
          );
        })}
      </div>

      {/* Modals */}
      <AddScreenModal
        isOpen={addScreenModal.isOpen}
        platformName={addScreenModal.platformName}
        platformDisplayName={addScreenModal.platformDisplayName}
        existingScreens={addScreenModal.platformName ? (platforms[addScreenModal.platformName]?.screens || []) : []}
        onAdd={(platformName, screenName, newScreen) => {
          handleAddScreen(platformName, screenName, newScreen);
          setAddScreenModal({ isOpen: false, platformName: '', platformDisplayName: '' });
        }}
        onClose={() => setAddScreenModal({ isOpen: false, platformName: '', platformDisplayName: '' })}
        theme={theme}
      />

      <CopyScreenDialog
        isOpen={copyScreenDialog.isOpen}
        screen={copyScreenDialog.screen}
        sourcePlatform={copyScreenDialog.platformName}
        availablePlatforms={getAvailablePlatforms()}
        onCopy={handleCopyScreen}
        onClose={() => setCopyScreenDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '' })}
        theme={theme}
      />

      <DeleteConfirmDialog
        isOpen={deleteConfirmDialog.isOpen}
        screen={deleteConfirmDialog.screen}
        platformDisplayName={deleteConfirmDialog.platformDisplayName}
        onConfirm={() => {
          handleDeleteScreen(deleteConfirmDialog.platformName, deleteConfirmDialog.screenIndex);
          setDeleteConfirmDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '', screenIndex: -1 });
        }}
        onClose={() => setDeleteConfirmDialog({ isOpen: false, screen: null, platformName: '', platformDisplayName: '', screenIndex: -1 })}
        theme={theme}
      />
    </div>
  );
}

// ============================================
// PlatformSection Component
// ============================================

function PlatformSection({ 
  platformName, 
  platformData, 
  screens,
  editMode, 
  projectPath, 
  theme,
  onScreenUpdate,
  onAddScreen,
  onDeleteScreen,
  onCopyScreen
}) {
  // ✅ Convert screens to array if it's an object
  const screenArray = useMemo(() => {
    if (!screens) return [];
    
    // If already an array, use it
    if (Array.isArray(screens)) {
      return screens;
    }
    
    // If it's an object, flatten all screen arrays
    const allScreens = [];
    Object.entries(screens).forEach(([screenName, screenDefs]) => {
      if (Array.isArray(screenDefs)) {
        screenDefs.forEach(def => {
          allScreens.push({
            ...def,
            originalName: screenName,
            name: def.name || screenName
          });
        });
      } else if (typeof screenDefs === 'object' && screenDefs !== null) {
        // Single screen object
        allScreens.push({
          ...screenDefs,
          originalName: screenName,
          name: screenDefs.name || screenName
        });
      }
    });
    
    return allScreens;
  }, [screens]);

  return (
    <div 
      className="p-4 rounded-lg"
      style={{ 
        background: theme.colors.background.tertiary,
        border: `1px solid ${theme.colors.border}`
      }}
    >
      {/* Platform Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '24px' }}>{getPlatformIcon(platformName)}</span>
          <h4 style={{ fontSize: '16px', fontWeight: 600, color: theme.colors.text.primary }}>
            {platformData.displayName || platformName}
          </h4>
          <span 
            className="px-2 py-1 rounded text-xs"
            style={{ 
              background: theme.colors.background.secondary,
              color: theme.colors.text.tertiary
            }}
          >
            {screenArray.length} {screenArray.length === 1 ? 'screen' : 'screens'}
          </span>
        </div>

        {editMode && (
          <button
            onClick={onAddScreen}
            className="px-3 py-1.5 rounded text-sm font-semibold transition hover:brightness-110"
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
      <div className="space-y-3">
        {screenArray.map((screen, idx) => (
          <ScreenCard
            key={idx}
            screen={screen}
            screenIndex={idx}
            editMode={editMode}
            projectPath={projectPath}
            theme={theme}
            onUpdate={(updates) => onScreenUpdate(idx, { ...screen, ...updates })}
            onDelete={() => onDeleteScreen(idx)}
            onCopy={() => onCopyScreen(screen)}
          />
        ))}

        {screenArray.length === 0 && !editMode && (
          <div 
            className="p-8 text-center rounded"
            style={{ 
              background: theme.colors.background.secondary,
              color: theme.colors.text.tertiary
            }}
          >
            No screens defined
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================
// ScreenCard Component
// ============================================

function ScreenCard({ screen, screenIndex, editMode, projectPath, theme, onUpdate, onDelete, onCopy }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pomName, setPomName] = useState(screen.screen || '');
  const [instanceName, setInstanceName] = useState(null);
  console.log('🔍 ScreenCard DEBUG:', {
    screenName: screen.name || screen.originalName,
    hasSourceInfo: !!screen.sourceInfo,
    sourceInfo: screen.sourceInfo,
    visible: screen.visible,
    hidden: screen.hidden,
    fullScreen: screen
  });

  // Extract and merge element arrays
  const topLevelVisible = screen.visible || [];
  const topLevelHidden = screen.hidden || [];
  const checksVisible = screen.checks?.visible || [];
  const checksHidden = screen.checks?.hidden || [];
  
  const allVisibleElements = [...new Set([...topLevelVisible, ...checksVisible])];
  const allHiddenElements = [...new Set([...topLevelHidden, ...checksHidden])];
  
  const textChecks = screen.checks?.text || {};
  const functions = screen.functions || {};

  const updateScreen = (updates) => {
    onUpdate(updates);
  };

  const handlePOMChange = (selectedPOM, selectedInstance) => {
    setPomName(selectedPOM || '');
    setInstanceName(selectedInstance || null);
    
    updateScreen({
      screen: selectedPOM || '',
      instance: selectedInstance || null
    });
  };

  return (
    <div 
      className="rounded-lg overflow-hidden"
      style={{ 
        background: theme.colors.background.secondary,
        border: `1px solid ${theme.colors.border}`
      }}
    >
      {/* Screen Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:brightness-105 transition"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '20px' }}>📄</span>
          <div className="text-left">
            <div style={{ fontSize: '16px', fontWeight: 600, color: theme.colors.text.primary }}>
              {screen.name || screen.originalName || 'Unnamed Screen'}
            </div>
            {screen.description && (
              <div style={{ fontSize: '13px', color: theme.colors.text.tertiary }}>
                {screen.description}
              </div>
            )}
          </div>
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

      {/* Screen Details */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3">
          
          {/* Show legend if sourceInfo exists */}
          {screen.sourceInfo && (
            <SourceLegend theme={theme} />
          )}
          
          {/* POM Selector */}
          <POMFieldSelector
            projectPath={projectPath}
            pomName={pomName}
            instanceName={instanceName}
            onPOMChange={(selectedPOM) => {
              handlePOMChange(selectedPOM, instanceName);
            }}
            onInstanceChange={(selectedInstance) => {
              handlePOMChange(pomName, selectedInstance);
            }}
            editable={editMode}
            theme={theme}
          />

          {/* Visible Elements - WITH SOURCE ATTRIBUTION */}
          {(allVisibleElements.length > 0 || editMode) && (
            editMode ? (
              <ElementSection
                title="✅ Visible Elements"
                elements={allVisibleElements}
                color={theme.colors.accents.green}
                editMode={editMode}
                pomName={pomName}
                instanceName={instanceName}
                projectPath={projectPath}
                functions={functions}
                onChange={(newElements) => {
                  updateScreen({ 
                    visible: newElements,
                    checks: { 
                      ...screen.checks, 
                      visible: newElements
                    } 
                  });
                }}
                theme={theme}
              />
            ) : (
              <ElementList
                elements={allVisibleElements}
                sourceInfo={screen.sourceInfo?.visible || {}}
                title="Visible Elements"
                icon="✅"
                color={theme.colors.accents.green}
                theme={theme}
                emptyMessage="No visible elements"
              />
            )
          )}

          {/* Hidden Elements - WITH SOURCE ATTRIBUTION */}
          {(allHiddenElements.length > 0 || editMode) && (
            editMode ? (
              <ElementSection
                title="❌ Hidden Elements"
                elements={allHiddenElements}
                color={theme.colors.accents.red}
                editMode={editMode}
                pomName={pomName}
                instanceName={instanceName}
                projectPath={projectPath}
                functions={functions}
                onChange={(newElements) => {
                  updateScreen({ 
                    hidden: newElements,
                    checks: { 
                      ...screen.checks, 
                      hidden: newElements
                    } 
                  });
                }}
                theme={theme}
              />
            ) : (
              <ElementList
                elements={allHiddenElements}
                sourceInfo={screen.sourceInfo?.hidden || {}}
                title="Hidden Elements"
                icon="❌"
                color={theme.colors.accents.red}
                theme={theme}
                emptyMessage="No hidden elements"
              />
            )
          )}

          {/* Text Checks */}
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

          {/* Functions Section */}
          {(Object.keys(functions).length > 0 || editMode) && (
            <FunctionSection
              functions={functions}
              editMode={editMode}
              pomName={pomName}
              projectPath={projectPath}
              contextFields={getContextFields(screen)}
              onChange={(newFunctions) => {
                updateScreen({ functions: newFunctions });
              }}
              theme={theme}
            />
          )}

          {/* Action Buttons */}
          {editMode && (
            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: theme.colors.border }}>
              <button
                onClick={onCopy}
                className="flex-1 px-3 py-2 rounded text-sm font-semibold transition hover:brightness-110"
                style={{ background: theme.colors.accents.blue, color: 'white' }}
              >
                📋 Copy Screen
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-2 rounded text-sm font-semibold transition hover:brightness-110"
                style={{ background: theme.colors.accents.red, color: 'white' }}
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ElementSection Component (for edit mode)
// ============================================

function ElementSection({ title, elements, color, editMode, pomName, instanceName, projectPath, functions = {}, onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newElement, setNewElement] = useState('');
  const [fieldValidation, setFieldValidation] = useState(null);

  const handleAddElement = () => {
    if (!newElement.trim()) return;
    
    if (elements.includes(newElement.trim())) {
      alert('Element already exists!');
      return;
    }
    
    onChange([...elements, newElement.trim()]);
    setNewElement('');
    setIsAdding(false);
    setFieldValidation(null);
  };

  const handleRemoveElement = (element) => {
    onChange(elements.filter(el => el !== element));
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

      <div className="space-y-2">
        {elements.map((element, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2 rounded text-sm"
            style={{ background: `${color}20` }}
          >
            <span className="font-mono" style={{ color: theme.colors.text.primary }}>
              {element}
            </span>
            {editMode && (
              <button
                onClick={() => handleRemoveElement(element)}
                className="hover:text-red-500 transition"
                style={{ color }}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="space-y-2 p-2 rounded" style={{ background: `${color}15` }}>
            {pomName && projectPath ? (
              <div className="space-y-2">
                <FieldAutocomplete 
                  projectPath={projectPath}
                  pomName={pomName}
                  instanceName={instanceName}
                  fieldValue={newElement}
                  onFieldChange={setNewElement}
                  onValidationChange={setFieldValidation}
                  placeholder="Type field name or select from dropdown"
                  functions={functions}
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
              </div>
            ) : (
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
// TextChecksSection Component
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

// ============================================
// FunctionSection Component
// ============================================

function FunctionSection({ functions, editMode, pomName, projectPath, contextFields, onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddFunction = (functionCall) => {
    onChange({
      ...functions,
      [functionCall.name]: functionCall
    });
    setIsAdding(false);
  };

  const handleRemoveFunction = (funcName) => {
    const updated = { ...functions };
    delete updated[funcName];
    onChange(updated);
  };

  const color = theme.colors.accents.purple;

  return (
    <div 
      className="p-3 rounded"
      style={{ background: `${color}10`, border: `1px solid ${color}40` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color }}>
          ⚡ Functions ({Object.keys(functions).length})
        </div>
        
        {editMode && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
            style={{ background: color, color: 'white' }}
          >
            ➕ Add Function
          </button>
        )}
      </div>

      <div className="space-y-2">
        {Object.entries(functions).map(([funcName, funcData]) => (
          <div
            key={funcName}
            className="p-2 rounded text-sm"
            style={{ background: `${color}20` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="font-mono text-xs mb-1 font-bold" style={{ color }}>
                  {funcData.signature || funcName}
                </div>
                {funcData.parameters && Object.keys(funcData.parameters).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(funcData.parameters).map(([paramName, paramValue]) => (
                      <div key={paramName} className="text-xs flex items-center gap-2">
                        <span style={{ color: theme.colors.text.tertiary }}>{paramName}:</span>
                        <code className="px-1 py-0.5 rounded" style={{ 
                          background: theme.colors.background.primary,
                          color: theme.colors.accents.green
                        }}>
                          {paramValue}
                        </code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {editMode && (
                <button
                  onClick={() => handleRemoveFunction(funcName)}
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
          <div className="p-3 rounded" style={{ background: `${color}15` }}>
            <FunctionSelector
              pomName={pomName}
              projectPath={projectPath}
              contextFields={contextFields}
              onAdd={handleAddFunction}
              onCancel={() => setIsAdding(false)}
              theme={theme}
            />
          </div>
        )}
      </div>
      
      {Object.keys(functions).length === 0 && !isAdding && (
        <div className="text-center py-2 text-sm" style={{ color: theme.colors.text.tertiary }}>
          No functions
        </div>
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getPlatformIcon(platformName) {
  const icons = {
    web: '🌐',
    cms: '📝',
    dancer: '💃',
    clubApp: '🎯',
    mobile: '📱'
  };
  return icons[platformName] || '📱';
}

function getContextFields(screen) {
  const fields = [];
  
  const allElements = [
    ...(screen.visible || []),
    ...(screen.hidden || []),
    ...(screen.checks?.visible || []),
    ...(screen.checks?.hidden || [])
  ];
  
  allElements.forEach(el => {
    const matches = el.match(/\{\{(\w+)\}\}/g);
    if (matches) {
      matches.forEach(match => {
        const fieldName = match.replace(/\{\{|\}\}/g, '');
        if (!fields.includes(fieldName)) {
          fields.push(fieldName);
        }
      });
    }
  });
  
  return fields;
}