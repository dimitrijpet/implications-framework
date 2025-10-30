// packages/web-app/src/components/UIScreenEditor/UIScreenEditor.jsx
// ✨ ENHANCED with Function Support + Parameters!
// COMPLETE FILE - All existing functionality preserved + NEW function features
import { useMemo } from 'react';
import { useState } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';
import AddScreenModal from './AddScreenModal';
import CopyScreenDialog from './CopyScreenDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import POMFieldSelector from './POMFieldSelector';
import FieldAutocomplete from './FieldAutocomplete';
import FunctionSelector from './FunctionSelector';  // ✨ NEW!

export default function UIScreenEditor({ state, projectPath, theme, onSave, onCancel }) {
  console.log('🚨🚨🚨 UIScreenEditor TOP OF FUNCTION:', {
    state,
    uiCoverage: state?.uiCoverage,
    platforms: state?.uiCoverage?.platforms,
    platformKeys: Object.keys(state?.uiCoverage?.platforms || {})
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
    
    // 🐛 DEBUG: Check if functions exist in platforms
    if (platforms?.web?.screens) {
      platforms.web.screens.forEach(screen => {
        if (screen.functions) {
          console.log('  📦 Screen', screen.originalName, 'has', Object.keys(screen.functions).length, 'functions:', Object.keys(screen.functions));
        }
      });
    }
    
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
const handleAddScreen = (platformName, screenName, screenData) => {
  console.log('✅ handleAddScreen received:', { platformName, screenName, screenData });
  
  setEditedUI(prev => ({  // ✅ CORRECT!
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


  // Handler: Delete Screen
  const handleDeleteScreen = (platformName, screenIndex) => {
    setEditedUI(prev => {
      // ✅ Safety check
      if (!prev || !prev[platformName]) {
        console.error('❌ Platform not found:', platformName);
        return prev;
      }
      
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
      // ✅ Safety check
      if (!prev || !prev[targetPlatform]) {
        console.error('❌ Target platform not found:', targetPlatform);
        return prev;
      }
      
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
                  // ✅ Safety check: ensure platform exists
                  if (!prev || !prev[platformName]) {
                    console.error('❌ Platform not found in editedUI:', platformName);
                    return prev;
                  }
                  
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
  onAdd={(platformName, screenName, newScreen) => {  // ✅ Accept 3 params
    console.log('✅ Modal callback: Adding', screenName, 'to', platformName);
    handleAddScreen(platformName, screenName, newScreen);  // ✅ Pass 3 params
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
// PART 2: PlatformSection Component (UNCHANGED)
// ============================================

function PlatformSection({ platformName, platformData, onScreenUpdate, editable, theme }) {
  // ✅ Convert screens object to array
  const screenArray = useMemo(() => {  // ← Changed from React.useMemo
    if (!platformData?.screens) return [];
    
    // If already an array, use it
    if (Array.isArray(platformData.screens)) {
      return platformData.screens;
    }
    
    // If it's an object, flatten all screen arrays
    const allScreens = [];
    Object.entries(platformData.screens).forEach(([screenName, screenDefs]) => {
      if (Array.isArray(screenDefs)) {
        screenDefs.forEach(def => {
          allScreens.push({
            ...def,
            originalName: screenName,  // Preserve original screen name
            name: def.name || screenName
          });
        });
      }
    });
    
    return allScreens;
  }, [platformData]);
  
  // Now use screenArray.map() as before
  return (
    <div>
      {screenArray.map((screen, idx) => (
        <ScreenCard 
          key={idx} 
          screen={screen} 
          onUpdate={onScreenUpdate}
          editable={editable}
          theme={theme}
        />
      ))}
    </div>
  );
}

// ============================================
// PART 3: ScreenCard Component (ENHANCED!)
// ============================================

function ScreenCard({ screen, screenIndex, editMode, projectPath, theme, onUpdate, onDelete, onCopy }) {
  console.log('🔍 ScreenCard received:', JSON.stringify(screen, null, 2));  // ← ADD THIS LINE
  const [isExpanded, setIsExpanded] = useState(false);
  const [pomName, setPomName] = useState(screen.screen || '');
  const [instanceName, setInstanceName] = useState(null);

  // ✅ FIXED: Extract and MERGE element arrays from BOTH formats
  // Old format: screen.visible / screen.hidden (at root)
  // New format: screen.checks.visible / screen.checks.hidden (nested)
  const topLevelVisible = screen.visible || [];
  const topLevelHidden = screen.hidden || [];
  const checksVisible = screen.checks?.visible || [];
  const checksHidden = screen.checks?.hidden || [];
  
  // Merge and dedupe - single list from both locations
  const allVisibleElements = [...new Set([...topLevelVisible, ...checksVisible])];
  const allHiddenElements = [...new Set([...topLevelHidden, ...checksHidden])];
  
  const textChecks = screen.checks?.text || {};
  const functions = screen.functions || {};
  
  console.log('🎯 ScreenCard data extraction:', {
    screenName: screen.originalName || screen.name,
    topLevelVisible: topLevelVisible.length,
    checksVisible: checksVisible.length,
    mergedVisible: allVisibleElements.length,
    topLevelHidden: topLevelHidden.length,
    checksHidden: checksHidden.length,
    mergedHidden: allHiddenElements.length,
    visibleElements: allVisibleElements,
    hiddenElements: allHiddenElements
  });

  const updateScreen = (updates) => {
    onUpdate({ ...screen, ...updates });
  };

  const handlePOMChange = (selectedPOM, selectedInstance) => {
    console.log('🔄 POM changed:', { selectedPOM, selectedInstance });
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
          
          {/* POM Selector - ALWAYS SHOW */}
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

          {/* ✅ Visible Elements - MERGED from both formats */}
          {(allVisibleElements.length > 0 || editMode) && (
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
                console.log('✅ Updating visible elements:', newElements);
                // Update BOTH locations for full compatibility
                updateScreen({ 
                  visible: newElements,  // Top-level for old format
                  checks: { 
                    ...screen.checks, 
                    visible: newElements  // Nested for new format
                  } 
                });
              }}
              theme={theme}
            />
          )}

          {/* ❌ Hidden Elements - MERGED from both formats */}
          {(allHiddenElements.length > 0 || editMode) && (
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
                console.log('❌ Updating hidden elements:', newElements);
                // Update BOTH locations for full compatibility
                updateScreen({ 
                  hidden: newElements,  // Top-level for old format
                  checks: { 
                    ...screen.checks, 
                    hidden: newElements  // Nested for new format
                  } 
                });
              }}
              theme={theme}
            />
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

          {/* ✨ Functions Section */}
          {(Object.keys(functions).length > 0 || editMode) && (
            <FunctionSection
              functions={functions}
              editMode={editMode}
              pomName={pomName}
              projectPath={projectPath}
              contextFields={getContextFields(screen)}
              onChange={(newFunctions) => {
                console.log('✨ Updating functions:', newFunctions);
                updateScreen({ functions: newFunctions });
              }}
              theme={theme}
            />
          )}

          {/* Action Buttons (Delete/Copy) */}
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
// PART 4: ElementSection Component (UNCHANGED)
// ============================================

function ElementSection({ title, elements, color, editMode, pomName, instanceName, projectPath, functions = {}, onChange, theme }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newElement, setNewElement] = useState('');
  const [fieldValidation, setFieldValidation] = useState(null);
  
  // 🐛 DEBUG: Log functions received
  console.log('🔍 ElementSection received:', {
    title,
    functionsCount: Object.keys(functions).length,
    functionNames: Object.keys(functions),
    pomName,
    instanceName
  });

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
// PART 5: TextChecksSection Component (UNCHANGED)
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
// ✨ PART 6: NEW FunctionSection Component
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
        {/* Existing Functions */}
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

        {/* Add Function Form */}
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
  // Extract context fields from various sources
  const fields = [];
  
  // From visible/hidden elements that use {{}} syntax
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