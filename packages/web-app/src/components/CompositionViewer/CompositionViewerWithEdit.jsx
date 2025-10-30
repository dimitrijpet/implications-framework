// packages/web-app/src/components/CompositionViewer/CompositionViewerWithEdit.jsx
// ENHANCED VERSION with Edit Mode

import React, { useState } from 'react';
import CompositionEditor from '../CompositionEditor/CompositionEditor';

/**
 * CompositionViewerWithEdit
 * 
 * Displays composition with ability to edit
 * 
 * Props from existing CompositionViewer:
 * - compositionData: Analysis result from backend
 * - theme: Theme object
 * - implicationPath: Path to the file
 * 
 * New props:
 * - onCompositionUpdated: Callback after successful save
 */
export default function CompositionViewerWithEdit({
  compositionData,
  theme,
  implicationPath,
  onCompositionUpdated
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Handle successful save
  const handleSave = (saveResult) => {
    console.log('✅ Composition saved:', saveResult);
    setIsEditMode(false);
    
    // Notify parent to refresh
    if (onCompositionUpdated) {
      onCompositionUpdated(saveResult);
    }
  };
  
  // Handle cancel
  const handleCancel = () => {
    if (window.confirm('Discard unsaved changes?')) {
      setIsEditMode(false);
    }
  };
  
  // Toggle edit mode
  const handleEditToggle = () => {
    setIsEditMode(true);
  };
  
  // If in edit mode, show editor
  if (isEditMode) {
    return (
      <CompositionEditor
        filePath={implicationPath}
        currentComposition={compositionData}
        onSave={handleSave}
        onCancel={handleCancel}
        theme={theme}
      />
    );
  }
  
  // Otherwise, show viewer with Edit button
  return (
    <div style={{ position: 'relative' }}>
      {/* Edit Button (top-right) */}
      <button
        onClick={handleEditToggle}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          padding: '8px 16px',
          background: theme.colors.primary,
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s',
          zIndex: 10
        }}
        className="hover:brightness-110"
        title="Edit composition patterns"
      >
        ✏️ Edit Composition
      </button>
      
      {/* Original Viewer Content */}
      <div style={{ paddingTop: '40px' }}>
        {renderCompositionCards(compositionData, theme)}
      </div>
    </div>
  );
}

/**
 * Render composition cards (your existing viewer logic)
 * This should be replaced with your actual CompositionViewer rendering
 */
function renderCompositionCards(compositionData, theme) {
  if (!compositionData) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: theme.colors.text.tertiary
      }}>
        No composition data available
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Base Class Card */}
      {compositionData.baseClass && (
        <div style={{
          padding: '16px',
          background: `${theme.colors.accents.purple}15`,
          border: `2px solid ${theme.colors.accents.purple}`,
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 600,
            color: theme.colors.accents.purple,
            marginBottom: '8px'
          }}>
            📦 Extends Base Class
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            color: theme.colors.text.primary,
            marginBottom: '8px'
          }}>
            {compositionData.baseClass.className || compositionData.baseClass}
          </div>
          
          {/* Show additional base class info */}
          {compositionData.baseClass.screensUsed && (
            <div style={{
              fontSize: '12px',
              color: theme.colors.text.secondary,
              marginTop: '8px'
            }}>
              <div>Path: {compositionData.baseClass.relativePath}</div>
              <div>Screens Used: {compositionData.baseClass.screensUsed.length}</div>
              <div>Total Merges: {compositionData.baseClass.totalMerges}</div>
            </div>
          )}
        </div>
      )}
      
      {/* Behaviors Card */}
      {compositionData.behaviors && compositionData.behaviors.length > 0 && (
        <div style={{
          padding: '16px',
          background: `${theme.colors.accents.blue}15`,
          border: `2px solid ${theme.colors.accents.blue}`,
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 600,
            color: theme.colors.accents.blue,
            marginBottom: '12px'
          }}>
            🧩 Composes Behaviors ({compositionData.behaviors.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {compositionData.behaviors.map((behavior, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 12px',
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.accents.blue}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.colors.text.primary
                }}
              >
                {behavior.name || behavior}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* No Composition Card */}
      {!compositionData.baseClass && (!compositionData.behaviors || compositionData.behaviors.length === 0) && (
        <div style={{
          padding: '24px',
          background: theme.colors.background.secondary,
          border: `2px dashed ${theme.colors.border}`,
          borderRadius: '12px',
          textAlign: 'center',
          color: theme.colors.text.tertiary
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Standalone Implication
          </div>
          <div style={{ fontSize: '13px' }}>
            No base class or behaviors detected
          </div>
        </div>
      )}
    </div>
  );
}