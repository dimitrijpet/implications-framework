// packages/web-app/src/components/AddStateModal/AddStateModal.jsx
// COMPLETE VERSION with Context Field Management

import React, { useState, useEffect } from 'react';
import './AddStateModal.css';
import SuggestionsPanel from '../SuggestionsPanel/SuggestionsPanel';
import DynamicContextFields from '../DynamicContextFields/DynamicContextFields';
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
    requiredFields: [],
    contextFields: {}  // NEW: Context fields for the state
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showContextHelp, setShowContextHelp] = useState(false);
  const [errors, setErrors] = useState({});
  const [copyPreview, setCopyPreview] = useState(null);
  
  // NEW: Context field suggestions from pattern analyzer
  const [contextSuggestions, setContextSuggestions] = useState([]);

  // Get pattern analysis for suggestions
  const { analysis, loading: analysisLoading } = useSuggestions(projectPath);

  useEffect(() => {
  if (existingStates && existingStates.length > 0) {
    console.log('🔍 DEBUG: existingStates sample:', existingStates[0]);
    console.log('🔍 Available fields:', Object.keys(existingStates[0]));
  }
}, [existingStates]);

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

  // NEW: Extract context suggestions from pattern analysis
  useEffect(() => {
    if (analysis?.fields?.context) {
      // Convert pattern analyzer context fields to suggestions
      const suggestions = analysis.fields.context
        .filter(f => parseFloat(f.frequency) > 0.3) // Used in 30%+ of states
        .map(f => ({
          name: f.field,
          reason: `Used in ${f.percentage} of existing states`,
          from: 'patterns'
        }));
      
      setContextSuggestions(suggestions);
      console.log('💡 Context suggestions from patterns:', suggestions);
    }
  }, [analysis]);

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
      requiredFields: [],
      contextFields: {}  // Reset context too
    });
    setErrors({});
    setShowAdvanced(false);
    setCopyPreview(null);
    setShowSuggestions(true);
    setShowContextHelp(false);
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
      
      // Auto-fill form from copied state (including context)
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
        requiredFields: data.requiredFields || [],
        contextFields: data.context || {}  // NEW: Copy context too
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

    // Include context in the create payload
    const stateData = {
      ...formData,
      displayName,
      context: formData.contextFields  // Pass context to backend
    };

    console.log('✅ Creating state with context:', stateData);
    onCreate(stateData);
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
  // NEW: CONTEXT FIELD HANDLERS
  // ========================================

  const handleAddContextField = (fieldName, initialValue, fieldType) => {
    console.log('➕ Adding context field to new state:', { fieldName, initialValue, fieldType });
    
    setFormData(prev => ({
      ...prev,
      contextFields: {
        ...prev.contextFields,
        [fieldName]: initialValue
      }
    }));
    
    // Remove from suggestions
    setContextSuggestions(prev => 
      prev.filter(s => s.name !== fieldName)
    );
  };

  const handleChangeContextField = (fieldName, newValue) => {
    console.log('🔄 Changing context field:', { fieldName, newValue });
    
    setFormData(prev => ({
      ...prev,
      contextFields: {
        ...prev.contextFields,
        [fieldName]: newValue
      }
    }));
  };

  const handleDeleteContextField = (fieldName) => {
    console.log('🗑️ Deleting context field:', fieldName);
    
    setFormData(prev => {
      const updated = { ...prev.contextFields };
      delete updated[fieldName];
      
      return {
        ...prev,
        contextFields: updated
      };
    });
    
    // Add back to suggestions if it came from patterns
    const wasSuggested = analysis?.fields?.context?.find(f => f.field === fieldName);
    if (wasSuggested) {
      setContextSuggestions(prev => [
        ...prev,
        {
          name: fieldName,
          reason: `Used in ${wasSuggested.percentage} of existing states`,
          from: 'patterns'
        }
      ]);
    }
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
            MODE TABS
            ======================================== */}
        <div className="mode-tabs" style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '24px',
          borderBottom: `2px solid ${theme.colors.border}`,
          paddingBottom: '2px'
        }}>
          <button
            className={`mode-tab ${mode === 'quick' ? 'active' : ''}`}
            onClick={() => setMode('quick')}
            style={{
              flex: 1,
              padding: '12px',
              background: mode === 'quick' ? theme.colors.primary : 'transparent',
              color: mode === 'quick' ? 'white' : theme.colors.text.secondary,
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >
            ⚡ Quick Copy
          </button>
          <button
            className={`mode-tab ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
            style={{
              flex: 1,
              padding: '12px',
              background: mode === 'custom' ? theme.colors.primary : 'transparent',
              color: mode === 'custom' ? 'white' : theme.colors.text.secondary,
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >
            🔧 Custom Build
          </button>
        </div>
        

        {/* ========================================
            FORM CONTENT
            ======================================== */}
        <div className="modal-body" style={{ marginTop: '16px' }}>
          {/* State Name (always visible) */}
          <FormGroup 
            label="State Name" 
            required 
            error={errors.stateName}
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
                border: `1px solid ${errors.stateName ? theme.colors.accents.red : theme.colors.border}`,
                padding: '10px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
          </FormGroup>

          {/* Display Name (optional) */}
          <FormGroup 
            label="Display Name" 
            helper="Auto-generated if left empty"
            theme={theme}
          >
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              placeholder="e.g., Reviewing Booking"
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

          {/* Mode-specific content */}
          {mode === 'quick' ? (
            <QuickCopyMode
              formData={formData}
              updateField={updateField}
              errors={errors}
              existingStates={existingStates}
              copyPreview={copyPreview}
              onRemoveField={removeField}
              onRemoveSetup={removeSetupAction}
              theme={theme}
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

          {/* ========================================
              NEW: CONTEXT FIELDS SECTION
              ======================================== */}
          {(mode === 'custom' || showAdvanced) && (
            <div className="context-section" style={{ marginTop: '24px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div>
                  <h3 style={{ 
                    fontSize: '16px',
                    fontWeight: 600,
                    color: theme.colors.accents.blue,
                    marginBottom: '4px'
                  }}>
                    📦 Context Fields
                    {Object.keys(formData.contextFields).length > 0 && (
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: 'normal',
                        color: theme.colors.text.tertiary,
                        marginLeft: '8px'
                      }}>
                        ({Object.keys(formData.contextFields).length} {Object.keys(formData.contextFields).length === 1 ? 'field' : 'fields'})
                      </span>
                    )}
                  </h3>
                  <div style={{ 
                    fontSize: '13px', 
                    color: theme.colors.text.secondary 
                  }}>
                    Define state data (optional - can add later)
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowContextHelp(!showContextHelp)}
                  style={{ 
                    color: theme.colors.accents.blue,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = `${theme.colors.accents.blue}15`}
                  onMouseLeave={(e) => e.target.style.background = 'none'}
                >
                  ❓ What are context fields?
                </button>
              </div>
              
              {/* Context Help */}
              {showContextHelp && (
                <div 
                  style={{
                    marginBottom: '16px',
                    padding: '16px',
                    background: `${theme.colors.accents.blue}15`,
                    border: `1px solid ${theme.colors.accents.blue}`,
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: theme.colors.text.primary
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                    💡 Context Fields:
                  </div>
                  <ul style={{ 
                    margin: '0', 
                    paddingLeft: '20px',
                    lineHeight: '1.6'
                  }}>
                    <li>Store data that accumulates through the state machine workflow</li>
                    <li>Used in mirrorsOn checks (e.g., {"{{username}}"} in UI validation)</li>
                    <li>Can be set by entry actions or copied from testData</li>
                    <li>Examples: username, status, sessionToken, acceptedAt</li>
                    <li>Optional now - you can always add them later when editing the state</li>
                  </ul>
                </div>
              )}
              
              {/* DynamicContextFields Component */}
              <DynamicContextFields
                contextData={formData.contextFields}
                onFieldChange={handleChangeContextField}
                onFieldAdd={handleAddContextField}
                onFieldDelete={handleDeleteContextField}
                suggestedFields={contextSuggestions}
                theme={theme}
                editable={true}
                compact={false}
              />
            </div>
          )}

          {/* ========================================
              SUGGESTIONS PANEL
              ======================================== */}
          {showSuggestions && analysis && !analysisLoading && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <h3 style={{ 
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.colors.accents.yellow
                }}>
                  💡 Suggestions
                </h3>
                <button
                  onClick={() => setShowSuggestions(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.colors.text.tertiary,
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px 8px'
                  }}
                >
                  Hide
                </button>
              </div>
              
              <SuggestionsPanel
                analysis={analysis}
                currentState={formData}
                onApply={handleApplySuggestion}
                theme={theme}
              />
            </div>
          )}
        </div>

        {/* ========================================
            FOOTER ACTIONS
            ======================================== */}
        <div className="modal-footer" style={{ 
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: theme.colors.background.tertiary,
              color: theme.colors.text.secondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            style={{
              padding: '10px 20px',
              background: theme.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.filter = 'brightness(1.1)'}
            onMouseLeave={(e) => e.target.style.filter = 'brightness(1)'}
          >
            ✨ Create State
          </button>
        </div>
      </div>
    </div>
  );
}

// ========================================
// HELPER COMPONENTS
// ========================================

function FormGroup({ label, required, helper, error, children, theme }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ 
        display: 'block',
        marginBottom: '6px',
        fontSize: '14px',
        fontWeight: 600,
        color: theme.colors.text.primary
      }}>
        {label}
        {required && <span style={{ color: theme.colors.accents.red, marginLeft: '4px' }}>*</span>}
      </label>
      {children}
      {error && (
        <div style={{ 
          marginTop: '4px',
          fontSize: '12px',
          color: theme.colors.accents.red
        }}>
          ⚠️ {error}
        </div>
      )}
      {helper && !error && (
        <div style={{ 
          marginTop: '4px',
          fontSize: '12px',
          color: theme.colors.text.tertiary,
          fontStyle: 'italic'
        }}>
          {helper}
        </div>
      )}
    </div>
  );
}

function QuickCopyMode({ 
  formData, 
  updateField, 
  errors, 
  existingStates, 
  copyPreview,
  onRemoveField,
  onRemoveSetup,
  theme 
}) {
  return (
    <>
      {/* Copy From Selector */}
      <FormGroup 
        label="Copy From" 
        required
        error={errors.copyFrom}
        helper="Select a state to use as template"
        theme={theme}
      >
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
         <option value="">-- Select a state --</option>
{existingStates?.map((state, index) => {
  const platform = state.meta?.setup?.[0]?.platform || 
                   state.meta?.platform || 
                   'web';
  
  return (
    <option 
      key={`${state.className || state.id}-${index}`}
      value={state.id}
    >
      {state.className || state.name} ({platform})
    </option>
  );
})}
        </select>
      </FormGroup>

      {/* Preview of copied state */}
      {copyPreview && (
        <>
          {/* Platform */}
          <FormGroup label="Platform" theme={theme}>
            <div style={{ 
              padding: '10px', 
              background: theme.colors.background.tertiary,
              borderRadius: '6px',
              color: theme.colors.text.primary
            }}>
              {formData.platform === 'web' ? '🌐' : '📱'} {formData.platform}
            </div>
          </FormGroup>

          {/* Trigger Button */}
          {formData.triggerButton && (
            <FormGroup label="Trigger Button" theme={theme}>
              <div style={{ 
                padding: '10px', 
                background: theme.colors.background.tertiary,
                borderRadius: '6px',
                fontFamily: 'monospace',
                color: theme.colors.text.primary
              }}>
                {formData.triggerButton}
              </div>
            </FormGroup>
          )}

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

          {/* NEW: Context Fields Preview */}
          {Object.keys(formData.contextFields).length > 0 && (
            <FormGroup 
              label="Context Fields" 
              helper="Fields copied from source"
              theme={theme}
            >
              <div style={{ 
                padding: '10px', 
                background: theme.colors.background.tertiary,
                borderRadius: '6px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                alignItems: 'center'
              }}>
                {Object.keys(formData.contextFields).map((field, idx) => (
                  <span 
                    key={idx}
                    style={{
                      padding: '4px 8px',
                      background: theme.colors.accents.purple + '30',
                      border: `1px solid ${theme.colors.accents.purple}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                  >
                    {field}
                  </span>
                ))}
              </div>
            </FormGroup>
          )}
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
            All fields (including context) will be pre-filled and editable
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
        <div style={{ display: 'flex', gap: '12px' }}>
          {['web', 'dancer', 'manager'].map(platform => (
            <label 
              key={platform} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                cursor: 'pointer' 
              }}
            >
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

       {/* ✅ ADD THESE NEW FIELDS: */}
      
      {/* Status Field */}
      <FormGroup label="Status" helper="State status (e.g., initial, active, pending)" theme={theme}>
        <input
          type="text"
          value={formData.status || ''}
          onChange={(e) => updateField('status', e.target.value)}
          placeholder="e.g., initial"
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

      {/* Description Field */}
      <FormGroup label="Description" helper="What this state represents" theme={theme}>
        <textarea
          rows={3}
          value={formData.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="e.g., Initial landing on flight search page"
          style={{
            background: theme.colors.background.tertiary,
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border}`,
            padding: '10px',
            borderRadius: '6px',
            width: '100%',
            resize: 'vertical'
          }}
        />
      </FormGroup>

      {/* Trigger Button
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
      </FormGroup> */}

      {/* Advanced Options Toggle */}
      <button
        type="button"
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
        <div style={{ 
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