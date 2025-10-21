// packages/web-app/src/components/AddStateModal/AddStateModal.jsx

import React, { useState, useEffect } from 'react';
import './AddStateModal.css';
import SuggestionsPanel from '../SuggestionsPanel/SuggestionsPanel';
import { useSuggestions } from '../../hooks/useSuggestions';

export default function AddStateModal({ 
  isOpen, 
  onClose, 
  onCreate, 
  existingStates, 
  theme, 
  projectPath 
}) {
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  
  const [mode, setMode] = useState('quick'); // 'quick' or 'custom'
  const [formData, setFormData] = useState({
    stateName: '',
    displayName: '',
    platform: 'web',
    copyFrom: '',
    triggerButton: '',
    afterButton: '',
    previousButton: '',
    statusCode: '',
    statusNumber: '',
    notificationKey: '',
    setupActions: [],
    requiredFields: []
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [errors, setErrors] = useState({});
  const [copyPreview, setCopyPreview] = useState(null);

  // Get pattern analysis for suggestions
  const { analysis, loading: analysisLoading } = useSuggestions(projectPath);

  // ========================================
  // EFFECTS
  // ========================================

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Load copy preview when state selected
  useEffect(() => {
    if (formData.copyFrom) {
      loadCopyPreview(formData.copyFrom);
    } else {
      setCopyPreview(null);
    }
  }, [formData.copyFrom]);

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  const resetForm = () => {
    setFormData({
      stateName: '',
      displayName: '',
      platform: 'web',
      copyFrom: '',
      triggerButton: '',
      afterButton: '',
      previousButton: '',
      statusCode: '',
      statusNumber: '',
      notificationKey: '',
      setupActions: [],
      requiredFields: []
    });
    setErrors({});
    setShowAdvanced(false);
    setCopyPreview(null);
    setShowSuggestions(true);
  };

  const loadCopyPreview = async (stateId) => {
    try {
      console.log('📋 Loading copy preview for:', stateId);
      const response = await fetch(
        `http://localhost:3000/api/implications/get-state-details?stateId=${stateId}`
      );
      const data = await response.json();
      
      console.log('✅ Copy preview loaded:', data);
      setCopyPreview(data);
      
      // Auto-fill form from copied state
      setFormData(prev => ({
        ...prev,
        platform: data.platform || prev.platform,
        triggerButton: data.triggerButton || '',
        afterButton: data.afterButton || '',
        previousButton: data.previousButton || '',
        statusCode: data.statusCode || '',
        statusNumber: data.statusNumber || '',
        notificationKey: data.notificationKey || '',
        setupActions: data.setupActions || [],
        requiredFields: data.requiredFields || []
      }));
    } catch (error) {
      console.error('❌ Failed to load copy preview:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // State name required
    if (!formData.stateName.trim()) {
      newErrors.stateName = 'State name is required';
    } else if (!/^[a-z_]+$/.test(formData.stateName)) {
      newErrors.stateName = 'Use lowercase letters and underscores only';
    }

    // Check if state already exists
    if (existingStates?.some(s => s.id === formData.stateName)) {
      newErrors.stateName = 'A state with this name already exists';
    }

    // Quick mode requires copyFrom
    if (mode === 'quick' && !formData.copyFrom) {
      newErrors.copyFrom = 'Please select a state to copy from';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ========================================
  // EVENT HANDLERS
  // ========================================

  const handleApplySuggestion = (type, value) => {
    console.log('💡 Applying suggestion:', type, value);
    
    switch (type) {
      case 'triggerButton':
        setFormData(prev => ({ ...prev, triggerButton: value }));
        break;
        
      case 'addField':
        setFormData(prev => ({
          ...prev,
          requiredFields: [...new Set([...(prev.requiredFields || []), value])]
        }));
        break;
        
      case 'addAllFields':
        setFormData(prev => ({
          ...prev,
          requiredFields: [...new Set([...(prev.requiredFields || []), ...value])]
        }));
        break;
        
      case 'addSetup':
        setFormData(prev => ({
          ...prev,
          setupActions: [...new Set([...(prev.setupActions || []), value])]
        }));
        break;
        
      case 'addAllSetup':
        setFormData(prev => ({
          ...prev,
          setupActions: [...new Set([...(prev.setupActions || []), ...value])]
        }));
        break;
        
      default:
        console.warn('Unknown apply type:', type);
    }
  };

  const handleCreate = () => {
    if (!validateForm()) {
      console.log('❌ Validation failed:', errors);
      return;
    }
    
    // Generate display name if not provided
    const displayName = formData.displayName || formData.stateName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    console.log('✅ Creating state:', { ...formData, displayName });
    onCreate({ ...formData, displayName });
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const removeField = (fieldName) => {
    setFormData(prev => ({
      ...prev,
      requiredFields: prev.requiredFields.filter(f => f !== fieldName)
    }));
  };

  const removeSetupAction = (action) => {
    setFormData(prev => ({
      ...prev,
      setupActions: prev.setupActions.filter(a => a !== action)
    }));
  };

  // ========================================
  // RENDER
  // ========================================

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content add-state-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          background: theme.colors.background.secondary,
          color: theme.colors.text.primary
        }}
      >
        {/* ========================================
            HEADER
            ======================================== */}
        <div className="modal-header">
          <h2 style={{ color: theme.colors.text.primary }}>
            ➕ Create New State
          </h2>
          <button 
            className="close-button"
            onClick={onClose}
            style={{ color: theme.colors.text.secondary }}
          >
            ✕
          </button>
        </div>

        {/* ========================================
            MODE TOGGLE
            ======================================== */}
        <div className="mode-toggle" style={{ marginBottom: '24px' }}>
          <button
            className={`mode-button ${mode === 'quick' ? 'active' : ''}`}
            onClick={() => setMode('quick')}
            style={{
              background: mode === 'quick' ? theme.colors.primary : 'transparent',
              color: mode === 'quick' ? '#fff' : theme.colors.text.secondary,
              border: `2px solid ${mode === 'quick' ? theme.colors.primary : theme.colors.border}`
            }}
          >
            🚀 Quick Copy
          </button>
          <button
            className={`mode-button ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
            style={{
              background: mode === 'custom' ? theme.colors.primary : 'transparent',
              color: mode === 'custom' ? '#fff' : theme.colors.text.secondary,
              border: `2px solid ${mode === 'custom' ? theme.colors.primary : theme.colors.border}`
            }}
          >
            ✏️ Custom Build
          </button>
        </div>

        {/* ========================================
            FORM BODY
            ======================================== */}
        <div className="modal-body">
          
          {/* STATE NAME - Always visible */}
          <FormGroup 
            label="State Name" 
            required 
            error={errors.stateName}
            helper="Use lowercase letters and underscores only"
            theme={theme}
          >
            <input
              type="text"
              value={formData.stateName}
              onChange={(e) => updateField('stateName', e.target.value.toLowerCase())}
              placeholder="e.g., reviewing_booking"
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${errors.stateName ? theme.colors.accents.red : theme.colors.border}`
              }}
            />
          </FormGroup>

          {/* SUGGESTIONS PANEL TOGGLE */}
          {analysis && !analysis.noData && formData.stateName && (
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setShowSuggestions(!showSuggestions)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.primary,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 0'
                }}
              >
                <span style={{ 
                  transition: 'transform 0.2s',
                  transform: showSuggestions ? 'rotate(90deg)' : 'rotate(0deg)'
                }}>
                  ▶
                </span>
                {showSuggestions ? 'Hide' : 'Show'} Smart Suggestions
              </button>
            </div>
          )}

          {/* SUGGESTIONS PANEL */}
          {showSuggestions && analysis && formData.stateName && (
            <SuggestionsPanel
              analysis={analysis}
              currentInput={formData}
              onApply={handleApplySuggestion}
              theme={theme}
            />
          )}

          {/* MODE-SPECIFIC CONTENT */}
          {mode === 'quick' ? (
            <QuickCopyMode
              formData={formData}
              updateField={updateField}
              existingStates={existingStates}
              copyPreview={copyPreview}
              errors={errors}
              theme={theme}
              onRemoveField={removeField}
              onRemoveSetup={removeSetupAction}
            />
          ) : (
            <CustomBuildMode
              formData={formData}
              updateField={updateField}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              theme={theme}
            />
          )}
        </div>

        {/* ========================================
            FOOTER
            ======================================== */}
        <div className="modal-footer">
          <button
            className="button button-secondary"
            onClick={onClose}
            style={{
              background: 'transparent',
              color: theme.colors.text.secondary,
              border: `1px solid ${theme.colors.border}`
            }}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            onClick={handleCreate}
            disabled={!formData.stateName || (mode === 'quick' && !formData.copyFrom)}
            style={{
              background: theme.colors.primary,
              opacity: (!formData.stateName || (mode === 'quick' && !formData.copyFrom)) ? 0.5 : 1,
              cursor: (!formData.stateName || (mode === 'quick' && !formData.copyFrom)) ? 'not-allowed' : 'pointer'
            }}
          >
            Create State
          </button>
        </div>
      </div>
    </div>
  );
}

// ========================================
// SUB-COMPONENTS
// ========================================

function FormGroup({ label, required, error, helper, children, theme }) {
  return (
    <div className="form-group">
      <label style={{ color: theme?.colors.text.primary || '#fff' }}>
        {label} {required && <span style={{ color: theme?.colors.accents.red || '#ff4444' }}>*</span>}
      </label>
      {children}
      {error && (
        <span className="error-message" style={{ color: theme?.colors.accents.red || '#ff4444' }}>
          {error}
        </span>
      )}
      {helper && !error && (
        <span className="helper-text" style={{ color: theme?.colors.text.tertiary || '#888' }}>
          {helper}
        </span>
      )}
    </div>
  );
}

function QuickCopyMode({ 
  formData, 
  updateField, 
  existingStates, 
  copyPreview, 
  errors, 
  theme,
  onRemoveField,
  onRemoveSetup
}) {
  return (
    <>
      {/* Copy From Dropdown */}
      <FormGroup label="Copy from" required error={errors.copyFrom} theme={theme}>
        <select
          value={formData.copyFrom}
          onChange={(e) => updateField('copyFrom', e.target.value)}
          style={{
            background: theme.colors.background.tertiary,
            color: theme.colors.text.primary,
            border: `1px solid ${errors.copyFrom ? theme.colors.accents.red : theme.colors.border}`,
            padding: '10px',
            borderRadius: '6px',
            width: '100%',
            cursor: 'pointer'
          }}
        >
          <option value="">Select state to copy...</option>
          {existingStates?.map(state => (
            <option key={state.id} value={state.id}>
              {state.uiCoverage.totalScreens > 0 ? '⭐' : '📋'} {state.id} ({state.platform}, {state.uiCoverage.totalScreens} screens)
            </option>
          ))}
        </select>
      </FormGroup>

      {/* Show editable fields when copied */}
      {formData.copyFrom && copyPreview && (
        <>
          {/* Success Banner */}
          <div style={{ 
            padding: '12px', 
            background: `${theme.colors.accents.green}15`,
            border: `1px solid ${theme.colors.accents.green}60`,
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ 
              color: theme.colors.accents.green, 
              fontWeight: 600, 
              marginBottom: '4px',
              fontSize: '14px'
            }}>
              ✨ Copied from "{formData.copyFrom}" - Edit any fields below
            </div>
          </div>

          {/* Platform */}
          <FormGroup label="Platform" theme={theme}>
            <div className="platform-radio-group" style={{ display: 'flex', gap: '12px' }}>
              {['web', 'mobile-dancer', 'mobile-manager'].map(platform => (
                <label key={platform} className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value={platform}
                    checked={formData.platform === platform}
                    onChange={(e) => updateField('platform', e.target.value)}
                  />
                  <span style={{ color: theme.colors.text.primary }}>
                    {platform === 'web' ? '🌐' : '📱'} {platform}
                  </span>
                </label>
              ))}
            </div>
          </FormGroup>

          {/* Trigger Button */}
          <FormGroup label="Trigger Button" theme={theme}>
            <input
              type="text"
              value={formData.triggerButton}
              onChange={(e) => updateField('triggerButton', e.target.value.toUpperCase())}
              placeholder="e.g., REVIEW_BOOKING"
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                padding: '10px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
          </FormGroup>

          {/* After Button */}
          <FormGroup label="After Button" theme={theme}>
            <input
              type="text"
              value={formData.afterButton || ''}
              onChange={(e) => updateField('afterButton', e.target.value)}
              placeholder="e.g., UNDO"
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                padding: '10px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
          </FormGroup>

          {/* Required Fields - with remove option */}
          <FormGroup 
            label="Required Fields" 
            helper="Fields copied from source - click × to remove"
            theme={theme}
          >
            <div style={{ 
              padding: '10px', 
              background: theme.colors.background.tertiary,
              borderRadius: '6px',
              minHeight: '44px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center'
            }}>
              {formData.requiredFields?.length > 0 ? (
                formData.requiredFields.map((field, idx) => (
                  <span 
                    key={idx}
                    style={{
                      padding: '4px 8px',
                      background: theme.colors.primary + '30',
                      border: `1px solid ${theme.colors.primary}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {field}
                    <button
                      onClick={() => onRemoveField(field)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.colors.accents.red,
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '14px',
                        lineHeight: 1
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span style={{ color: theme.colors.text.tertiary, fontSize: '14px' }}>
                  No fields yet
                </span>
              )}
            </div>
          </FormGroup>

          {/* Setup Actions - with remove option */}
          <FormGroup 
            label="Setup Actions" 
            helper="Actions copied from source - click × to remove"
            theme={theme}
          >
            <div style={{ 
              padding: '10px', 
              background: theme.colors.background.tertiary,
              borderRadius: '6px',
              minHeight: '44px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center'
            }}>
              {formData.setupActions?.length > 0 ? (
                formData.setupActions.map((action, idx) => (
                  <span 
                    key={idx}
                    style={{
                      padding: '4px 8px',
                      background: theme.colors.accents.blue + '30',
                      border: `1px solid ${theme.colors.accents.blue}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {action}
                    <button
                      onClick={() => onRemoveSetup(action)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.colors.accents.red,
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '14px',
                        lineHeight: 1
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span style={{ color: theme.colors.text.tertiary, fontSize: '14px' }}>
                  No setup actions yet
                </span>
              )}
            </div>
          </FormGroup>
        </>
      )}

      {/* Helper if no copy selected */}
      {!formData.copyFrom && (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: theme.colors.text.tertiary,
          fontSize: '14px',
          background: `${theme.colors.background.tertiary}60`,
          borderRadius: '8px',
          border: `1px dashed ${theme.colors.border}`
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👆</div>
          <div>Select a state to copy from above</div>
          <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
            All fields will be pre-filled and editable
          </div>
        </div>
      )}
    </>
  );
}

function CustomBuildMode({ 
  formData, 
  updateField, 
  showAdvanced, 
  setShowAdvanced, 
  theme 
}) {
  return (
    <>
      {/* Platform Selection */}
      <FormGroup label="Platform" required theme={theme}>
        <div className="platform-radio-group" style={{ display: 'flex', gap: '12px' }}>
          {['web', 'mobile-dancer', 'mobile-manager'].map(platform => (
            <label key={platform} className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                value={platform}
                checked={formData.platform === platform}
                onChange={(e) => updateField('platform', e.target.value)}
              />
              <span style={{ color: theme.colors.text.primary }}>
                {platform === 'web' ? '🌐' : '📱'} {platform}
              </span>
            </label>
          ))}
        </div>
      </FormGroup>

      {/* Trigger Button */}
      <FormGroup label="Trigger Button" helper="Button text in UPPERCASE" theme={theme}>
        <input
          type="text"
          value={formData.triggerButton}
          onChange={(e) => updateField('triggerButton', e.target.value.toUpperCase())}
          placeholder="e.g., REVIEW_BOOKING"
          style={{
            background: theme.colors.background.tertiary,
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border}`,
            padding: '10px',
            borderRadius: '6px',
            width: '100%'
          }}
        />
      </FormGroup>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        className="advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{ 
          color: theme.colors.primary,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          padding: '8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        ⚙️ {showAdvanced ? 'Hide' : 'Show'} Advanced Options
      </button>

      {/* Advanced Fields */}
      {showAdvanced && (
        <div className="advanced-section" style={{ 
          marginTop: '16px',
          padding: '16px',
          background: `${theme.colors.background.tertiary}60`,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`
        }}>
          <FormGroup label="After Button" theme={theme}>
            <input
              type="text"
              value={formData.afterButton}
              onChange={(e) => updateField('afterButton', e.target.value)}
              placeholder="e.g., UNDO"
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                padding: '10px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
          </FormGroup>

          <FormGroup label="Previous Button" theme={theme}>
            <input
              type="text"
              value={formData.previousButton}
              onChange={(e) => updateField('previousButton', e.target.value)}
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                padding: '10px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
          </FormGroup>

          <FormGroup label="Status Code" theme={theme}>
            <input
              type="text"
              value={formData.statusCode}
              onChange={(e) => updateField('statusCode', e.target.value)}
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                padding: '10px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
          </FormGroup>
        </div>
      )}
    </>
  );
}