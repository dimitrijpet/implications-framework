// packages/web-app/src/components/StateDetailModal/StateDetailModal-EXAMPLE.jsx
// EXAMPLE: StateDetailModal with Composition Editing Integrated

import React, { useState, useEffect } from 'react';
import CompositionViewerWithEdit from '../CompositionViewer/CompositionViewerWithEdit';
import './StateDetailModal.css';

/**
 * StateDetailModal - EXAMPLE WITH COMPOSITION EDITING
 * 
 * This example shows how to integrate CompositionViewerWithEdit
 * into your existing StateDetailModal component.
 * 
 * Key additions:
 * 1. compositionData state
 * 2. loadComposition() function
 * 3. handleCompositionUpdated() callback
 * 4. CompositionViewerWithEdit component in render
 */
export default function StateDetailModal({
  state,
  onClose,
  onStateUpdate,
  theme
}) {
  
  // ==========================================
  // EXISTING STATE (your current modal state)
  // ==========================================
  const [contextData, setContextData] = useState(null);
  const [transitionsData, setTransitionsData] = useState(null);
  const [implicationsData, setImplicationsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // ==========================================
  // NEW STATE FOR COMPOSITION
  // ==========================================
  const [compositionData, setCompositionData] = useState(null);
  const [isLoadingComposition, setIsLoadingComposition] = useState(false);
  const [compositionError, setCompositionError] = useState(null);
  
  // ==========================================
  // EXISTING EFFECTS (your current loading)
  // ==========================================
  useEffect(() => {
    if (state) {
      loadStateDetails();
    }
  }, [state]);
  
  const loadStateDetails = async () => {
    setIsLoading(true);
    try {
      // Your existing loading logic
      await Promise.all([
        loadContext(),
        loadTransitions(),
        loadImplications()
      ]);
    } catch (error) {
      console.error('Failed to load state details:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // ==========================================
  // NEW EFFECT FOR COMPOSITION
  // ==========================================
  useEffect(() => {
    if (state?.files?.implication) {
      loadComposition();
    }
  }, [state?.files?.implication]);
  
  // ==========================================
  // NEW FUNCTION: Load Composition Data
  // ==========================================
  const loadComposition = async () => {
    setIsLoadingComposition(true);
    setCompositionError(null);
    
    try {
      const response = await fetch(
        `/api/implications/analyze-composition?filePath=${encodeURIComponent(state.files.implication)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to analyze composition');
      }
      
      console.log('✅ Composition loaded:', data.composition);
      setCompositionData(data.composition);
      
    } catch (error) {
      console.error('❌ Failed to load composition:', error);
      setCompositionError(error.message);
      // Don't set compositionData to null - keep old data if refresh fails
    } finally {
      setIsLoadingComposition(false);
    }
  };
  
  // ==========================================
  // NEW FUNCTION: Handle Composition Updates
  // ==========================================
  const handleCompositionUpdated = async (saveResult) => {
    console.log('✅ Composition updated:', saveResult);
    
    try {
      // Refresh composition data
      await loadComposition();
      
      // Optionally refresh other sections if they might be affected
      // For example, if mirrorsOn changed, implications might show different screens
      // await loadImplications();
      
      // Show success notification (if you have a toast/notification system)
      showSuccessMessage('Composition updated successfully!');
      
      // Optionally notify parent component
      if (onStateUpdate) {
        onStateUpdate(state.name);
      }
      
    } catch (error) {
      console.error('Failed to refresh after composition update:', error);
      showErrorMessage('Changes saved but failed to refresh display. Please reload.');
    }
  };
  
  // ==========================================
  // HELPER FUNCTIONS (add these if you don't have them)
  // ==========================================
  const showSuccessMessage = (message) => {
    // Replace with your notification system
    console.log('✅', message);
    // Example: toast.success(message);
  };
  
  const showErrorMessage = (message) => {
    // Replace with your notification system
    console.error('❌', message);
    // Example: toast.error(message);
  };
  
  // Your existing functions
  const loadContext = async () => { /* ... */ };
  const loadTransitions = async () => { /* ... */ };
  const loadImplications = async () => { /* ... */ };
  
  // ==========================================
  // RENDER
  // ==========================================
  
  if (isLoading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <div style={{ color: theme.colors.text.secondary }}>Loading state details...</div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '1200px',
          maxHeight: '90vh',
          overflow: 'auto',
          background: theme.colors.background.primary,
          borderRadius: '16px',
          padding: '32px'
        }}
      >
        
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          paddingBottom: '16px',
          borderBottom: `2px solid ${theme.colors.border}`
        }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 700,
              color: theme.colors.text.primary,
              marginBottom: '8px'
            }}>
              {state.name}
            </h1>
            <div style={{
              fontSize: '14px',
              color: theme.colors.text.tertiary
            }}>
              State Details
            </div>
          </div>
          
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text.secondary
            }}
          >
            ✕ Close
          </button>
        </div>
        
        {/* YOUR EXISTING SECTIONS */}
        
        {/* Context Section */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: theme.colors.accents.blue,
            marginBottom: '16px'
          }}>
            📊 Context
          </h2>
          {/* Your existing context rendering */}
          {contextData && <div>{/* ... */}</div>}
        </section>
        
        {/* Transitions Section */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: theme.colors.accents.green,
            marginBottom: '16px'
          }}>
            🔄 Transitions
          </h2>
          {/* Your existing transitions rendering */}
          {transitionsData && <div>{/* ... */}</div>}
        </section>
        
        {/* Implications Section */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: theme.colors.accents.orange,
            marginBottom: '16px'
          }}>
            🎯 UI Implications
          </h2>
          {/* Your existing implications rendering */}
          {implicationsData && <div>{/* ... */}</div>}
        </section>
        
        {/* ==========================================
            NEW SECTION: COMPOSITION
            ========================================== */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: theme.colors.accents.purple,
            marginBottom: '16px'
          }}>
            🧩 Composition Architecture
          </h2>
          
          {/* Loading State */}
          {isLoadingComposition && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: theme.colors.background.secondary,
              borderRadius: '12px',
              border: `2px solid ${theme.colors.border}`
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
              <div style={{ color: theme.colors.text.secondary }}>
                Analyzing composition...
              </div>
            </div>
          )}
          
          {/* Error State */}
          {!isLoadingComposition && compositionError && (
            <div style={{
              padding: '24px',
              background: `${theme.colors.accents.red}20`,
              border: `2px solid ${theme.colors.accents.red}`,
              borderRadius: '12px',
              color: theme.colors.accents.red
            }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️ Error</div>
              <div style={{ marginBottom: '16px' }}>{compositionError}</div>
              <button
                onClick={loadComposition}
                style={{
                  padding: '8px 16px',
                  background: theme.colors.accents.red,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Retry
              </button>
            </div>
          )}
          
          {/* Composition Viewer with Edit */}
          {!isLoadingComposition && !compositionError && compositionData && (
            <CompositionViewerWithEdit
              compositionData={compositionData}
              theme={theme}
              implicationPath={state.files.implication}
              onCompositionUpdated={handleCompositionUpdated}
            />
          )}
        </section>
        
        {/* Files Section (if you have one) */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: theme.colors.text.secondary,
            marginBottom: '16px'
          }}>
            📁 Files
          </h2>
          <div style={{
            padding: '16px',
            background: theme.colors.background.secondary,
            borderRadius: '12px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: theme.colors.text.tertiary
          }}>
            {state.files?.implication && (
              <div style={{ marginBottom: '8px' }}>
                <strong>Implication:</strong> {state.files.implication}
              </div>
            )}
            {state.files?.test && (
              <div>
                <strong>Test:</strong> {state.files.test}
              </div>
            )}
          </div>
        </section>
        
      </div>
    </div>
  );
}