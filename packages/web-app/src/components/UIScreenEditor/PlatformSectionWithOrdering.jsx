// packages/web-app/src/components/UIScreenEditor/PlatformSectionWithOrdering.jsx
// ✨ Platform Section with Screen Ordering + Navigation Support

import { useState, useMemo } from 'react';
import DraggableScreenList from './DraggableScreenList';
import NavigationEditor from './NavigationEditor';
import BlockList from './BlockList';
import POMFieldSelector from './POMFieldSelector';
import { screensObjectToArray, screensArrayToObject, reorderScreens } from './screenOrderingUtils';

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

export default function PlatformSectionWithOrdering({ 
  platformName, 
  platformData, 
  editMode, 
  projectPath, 
  theme,
  storedVariables = [],
  onScreensChange,  // Called with updated screens object
  onAddScreen,
  onDeleteScreen,
  onCopyScreen
}) {
  // Track which screens are expanded
  const [expandedScreens, setExpandedScreens] = useState(new Set());
  
  // Convert screens to ordered array
  const screensArray = useMemo(() => {
    console.log('📥 PlatformSection input screens:', platformData.screens);
    const arr = screensObjectToArray(platformData.screens);
    console.log('📤 Converted to array:', arr);
    return arr;
  }, [platformData.screens]);

  // Toggle screen expansion
  const handleToggleExpand = (screenId) => {
    setExpandedScreens(prev => {
      const next = new Set(prev);
      if (next.has(screenId)) {
        next.delete(screenId);
      } else {
        next.add(screenId);
      }
      return next;
    });
  };

  // Handle reordering from drag-drop
  // ✅ FIXED: Accepts either direct array or callback function
  const handleScreensReorder = (arrayOrCallback) => {
    if (typeof arrayOrCallback === 'function') {
      // Callback pattern - get current screens and call the function
      const currentScreens = screensObjectToArray(platformData.screens);
      const reorderedArray = arrayOrCallback(currentScreens);
      
      console.log('🔄 Screens reordered (callback):', reorderedArray.map(s => s.name || s.screenName));
      console.log('🔄 Full reordered data:', reorderedArray);
      
      const screensObject = screensArrayToObject(reorderedArray);
      console.log('🔄 Converted back to object:', screensObject);
      onScreensChange(screensObject);
    } else {
      // Direct array pattern (legacy)
      console.log('🔄 Screens reordered (direct):', arrayOrCallback.map(s => s.name || s.screenName));
      console.log('🔄 Full reordered data:', arrayOrCallback);
      
      const screensObject = screensArrayToObject(arrayOrCallback);
      console.log('🔄 Converted back to object:', screensObject);
      onScreensChange(screensObject);
    }
  };

  // Handle individual screen update
  // ✅ FIXED: Get fresh data from platformData.screens to avoid stale closure
  const handleScreenUpdate = (screenId, updates) => {
    console.log('📝 Screen update:', screenId, updates);
    
    // Get FRESH screens data
    const freshScreensArray = screensObjectToArray(platformData.screens);
    
    const updatedArray = freshScreensArray.map(screen => {
      const id = screen.name || screen.screenName;
      if (id === screenId) {
        return { ...screen, ...updates };
      }
      return screen;
    });
    const screensObject = screensArrayToObject(updatedArray);
    onScreensChange(screensObject);
  };

  // Handle navigation change for a screen
  const handleNavigationChange = (screenId, navigation) => {
    console.log('🧭 Navigation change:', screenId, navigation);
    handleScreenUpdate(screenId, { navigation });
  };

  // Handle navigation removal
  const handleNavigationRemove = (screenId) => {
    console.log('🧭 Navigation remove:', screenId);
    // Get FRESH screens data
    const freshScreensArray = screensObjectToArray(platformData.screens);
    
    const updatedArray = freshScreensArray.map(screen => {
      const id = screen.name || screen.screenName;
      if (id === screenId) {
        const { navigation, ...rest } = screen;
        return rest;
      }
      return screen;
    });
    const screensObject = screensArrayToObject(updatedArray);
    onScreensChange(screensObject);
  };

  // Render screen content (blocks, navigation, etc.)
  const renderScreenContent = (screen, index, isExpanded) => {
    if (!isExpanded) return null;

    const screenId = screen.name || screen.screenName;
    const pomName = screen.screen || '';
    const instanceName = screen.instance || null;
    
    console.log('🖥️ Rendering screen content:', { 
      screenId, 
      pomName, 
      instanceName,
      projectPath,
      hasProjectPath: !!projectPath 
    });

    return (
      <div className="space-y-3 pt-3">
        {/* POM Selector */}
<POMFieldSelector
  projectPath={projectPath}
  selectedPOM={pomName}
  selectedInstance={instanceName}
  platform={platformName}  // ✅ ADD THIS
  onPOMChange={(newPom) => handleScreenUpdate(screenId, { screen: newPom })}
  onInstanceChange={(newInstance) => handleScreenUpdate(screenId, { instance: newInstance })}
  editable={editMode}
  theme={theme}
/>

        {/* Navigation Editor */}
        {editMode && (
          <NavigationEditor
            navigation={screen.navigation}
            projectPath={projectPath}
            pomName={pomName}
            instanceName={instanceName}
            storedVariables={storedVariables}
            onChange={(nav) => handleNavigationChange(screenId, nav)}
            onRemove={() => handleNavigationRemove(screenId)}
            theme={theme}
          />
        )}
        
        {/* Show navigation in read mode */}
        {!editMode && screen.navigation && screen.navigation.method && (
          <div 
            className="p-2 rounded text-xs font-mono"
            style={{ 
              background: `${theme.colors.accents.cyan || theme.colors.accents.blue}10`,
              border: `1px solid ${theme.colors.accents.cyan || theme.colors.accents.blue}40`
            }}
          >
            <span style={{ color: theme.colors.text.tertiary }}>🧭 Navigation:</span>{' '}
            <span style={{ color: theme.colors.accents.green }}>
              {screen.navigation.instanceName || screen.navigation.pomName}
            </span>
            <span style={{ color: theme.colors.text.primary }}>.</span>
            <span style={{ color: theme.colors.accents.yellow }}>
              {screen.navigation.method}
            </span>
            <span style={{ color: theme.colors.text.primary }}>(</span>
            <span style={{ color: theme.colors.accents.purple }}>
              {(screen.navigation.args || []).filter(a => a).join(', ')}
            </span>
            <span style={{ color: theme.colors.text.primary }}>)</span>
          </div>
        )}

        {/* Block List */}
        <BlockList
          screen={screen}
          editMode={editMode}
          theme={theme}
          onBlocksChange={(newBlocks) => handleScreenUpdate(screenId, { blocks: newBlocks })}
          pomName={pomName}
          instanceName={instanceName}
          projectPath={projectPath}
          platform={platformName}
          storedVariables={storedVariables}
        />

        {/* Action Buttons */}
        {editMode && (
          <div className="flex gap-2 pt-2 border-t" style={{ borderColor: theme.colors.border }}>
            <button
              onClick={() => onCopyScreen(screen)}
              className="flex-1 px-3 py-2 rounded text-sm font-semibold transition hover:brightness-110"
              style={{ background: theme.colors.accents.blue, color: 'white' }}
            >
              📋 Copy Screen
            </button>
            <button
              onClick={() => onDeleteScreen(screenId)}
              className="px-3 py-2 rounded text-sm font-semibold transition hover:brightness-110"
              style={{ background: theme.colors.accents.red, color: 'white' }}
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>
    );
  };

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
            {screensArray.length} {screensArray.length === 1 ? 'screen' : 'screens'}
          </span>
          
          {/* Drag hint in edit mode */}
          {editMode && screensArray.length > 1 && (
            <span 
              className="px-2 py-1 rounded text-xs"
              style={{ 
                background: `${theme.colors.accents.blue}20`,
                color: theme.colors.accents.blue
              }}
            >
              ⋮⋮ drag to reorder
            </span>
          )}
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

      {/* Screens List with Drag-Drop */}
      {screensArray.length > 0 ? (
        <DraggableScreenList
          screens={screensArray}
          editMode={editMode}
          projectPath={projectPath}
          theme={theme}
          storedVariables={storedVariables}
          expandedScreens={expandedScreens}
          onToggleExpand={handleToggleExpand}
          onScreensReorder={handleScreensReorder}
          onScreenUpdate={handleScreenUpdate}
          onScreenDelete={onDeleteScreen}
          onScreenCopy={onCopyScreen}
          renderScreenContent={renderScreenContent}
        />
      ) : (
        <div 
          className="p-8 text-center rounded"
          style={{ 
            background: theme.colors.background.secondary,
            color: theme.colors.text.tertiary
          }}
        >
          {editMode ? (
            <div>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
              <div>No screens yet. Click "➕ Add Screen" to create one.</div>
            </div>
          ) : (
            'No screens defined'
          )}
        </div>
      )}
    </div>
  );
}