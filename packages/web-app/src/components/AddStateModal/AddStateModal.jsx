// packages/web-app/src/components/AddStateModal/AddStateModal.jsx

import React, { useState, useEffect } from 'react';
import './AddStateModal.css';

export default function AddStateModal({ isOpen, onClose, onCreate, existingStates, theme }) {
  console.log('🎭 AddStateModal render:', { 
    isOpen, 
    existingStatesCount: existingStates?.length,
    hasTheme: !!theme 
  });
  const [mode, setMode] = useState('quick'); // 'quick' or 'custom'
  const [formData, setFormData] = useState({
    stateName: '',
    platform: 'web',
    copyFrom: '',
    // Advanced fields (hidden by default)
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
  const [errors, setErrors] = useState({});
  const [copyPreview, setCopyPreview] = useState(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        stateName: '',
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

  const loadCopyPreview = async (stateId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/implications/get-state-details?stateId=${stateId}`);
      const data = await response.json();
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
      console.error('Failed to load copy preview:', error);
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = () => {
    if (!validateForm()) return;
    
    onCreate({
      ...formData,
      displayName: formData.stateName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    });
  };

  if (!isOpen) {
  console.log('❌ Modal isOpen=false, not rendering');
  return null;
}

 console.log('✅ Modal rendering with isOpen=true');

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
        {/* Header */}
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

        {/* Mode Toggle */}
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

        {/* Form Content */}
        <div className="modal-body">
          
          {/* State Name - Always visible */}
          <div className="form-group">
            <label style={{ color: theme.colors.text.primary }}>
              State Name <span style={{ color: theme.colors.accents.red }}>*</span>
            </label>
            <input
              type="text"
              value={formData.stateName}
              onChange={(e) => setFormData({ ...formData, stateName: e.target.value.toLowerCase() })}
              placeholder="e.g., reviewing_booking"
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${errors.stateName ? theme.colors.accents.red : theme.colors.border}`
              }}
            />
            {errors.stateName && (
              <span className="error-message" style={{ color: theme.colors.accents.red }}>
                {errors.stateName}
              </span>
            )}
            <span className="helper-text" style={{ color: theme.colors.text.tertiary }}>
              Use lowercase letters and underscores only
            </span>
          </div>

       {/* QUICK MODE */}
{mode === 'quick' && (
  <>
    {/* Copy From Dropdown */}
    <div className="form-group">
      <label style={{ color: theme.colors.text.primary }}>
        Copy from <span style={{ color: theme.colors.accents.red }}>*</span>
      </label>
      <select
        value={formData.copyFrom}
        onChange={(e) => setFormData({ ...formData, copyFrom: e.target.value })}
        style={{
          background: theme.colors.background.tertiary,
          color: theme.colors.text.primary,
          border: `1px solid ${theme.colors.border}`
        }}
      >
        <option value="">Select state to copy...</option>
        {existingStates?.map(state => (
          <option key={state.id} value={state.id}>
            {state.uiCoverage.totalScreens > 0 ? '⭐' : '📋'} {state.id} ({state.platform}, {state.uiCoverage.totalScreens} screens)
          </option>
        ))}
      </select>
    </div>

    {/* 🔥 SHOW ALL EDITABLE FIELDS WHEN COPIED */}
    {formData.copyFrom && copyPreview && (
      <>
        <div style={{ 
          padding: '12px', 
          background: `${theme.colors.accents.green}15`,
          border: `1px solid ${theme.colors.accents.green}60`,
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <div style={{ color: theme.colors.accents.green, fontWeight: 600, marginBottom: '4px' }}>
            ✨ Copied from "{formData.copyFrom}" - Edit any fields below
          </div>
        </div>

        {/* Display Name */}
        <div className="form-group">
          <label style={{ color: theme.colors.text.primary }}>
            Display Name
          </label>
          <input
            type="text"
            value={formData.displayName || formData.stateName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="e.g., Reviewing Booking"
            style={{
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border}`
            }}
          />
        </div>

        {/* Platform Override */}
        <div className="form-group">
          <label style={{ color: theme.colors.text.primary }}>
            Platform
          </label>
          <div className="platform-radio-group">
            {['web', 'mobile-dancer', 'mobile-manager'].map(platform => (
              <label key={platform} className="radio-label">
                <input
                  type="radio"
                  value={platform}
                  checked={formData.platform === platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                />
                <span style={{ color: theme.colors.text.primary }}>
                  {platform === 'web' ? '🌐' : '📱'} {platform}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Trigger Button */}
        <div className="form-group">
          <label style={{ color: theme.colors.text.primary }}>
            Trigger Button
          </label>
          <input
            type="text"
            value={formData.triggerButton}
            onChange={(e) => setFormData({ ...formData, triggerButton: e.target.value.toUpperCase() })}
            placeholder="e.g., REVIEW_BOOKING"
            style={{
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border}`
            }}
          />
        </div>

        {/* After Button */}
        <div className="form-group">
          <label style={{ color: theme.colors.text.primary }}>
            After Button
          </label>
          <input
            type="text"
            value={formData.afterButton || ''}
            onChange={(e) => setFormData({ ...formData, afterButton: e.target.value })}
            placeholder="e.g., UNDO"
            style={{
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border}`
            }}
          />
        </div>

        {/* Previous Button */}
        <div className="form-group">
          <label style={{ color: theme.colors.text.primary }}>
            Previous Button
          </label>
          <input
            type="text"
            value={formData.previousButton || ''}
            onChange={(e) => setFormData({ ...formData, previousButton: e.target.value })}
            style={{
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border}`
            }}
          />
        </div>

        {/* Status Code */}
        <div className="form-group">
          <label style={{ color: theme.colors.text.primary }}>
            Status Code
          </label>
          <input
            type="text"
            value={formData.statusCode || ''}
            onChange={(e) => setFormData({ ...formData, statusCode: e.target.value })}
            style={{
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border}`
            }}
          />
        </div>

        {/* Status Number */}
        <div className="form-group">
          <label style={{ color: theme.colors.text.primary }}>
            Status Number
          </label>
          <input
            type="number"
            value={formData.statusNumber || ''}
            onChange={(e) => setFormData({ ...formData, statusNumber: e.target.value })}
            style={{
              background: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border}`
            }}
          />
        </div>

        {/* Setup Actions (read-only for now) */}
        <div className="form-group">
          <label style={{ color: theme.colors.text.primary }}>
            Setup Actions <span style={{ fontSize: '12px', opacity: 0.7 }}>(from copied state)</span>
          </label>
          <div style={{ 
            padding: '10px', 
            background: theme.colors.background.tertiary,
            borderRadius: '6px',
            fontSize: '14px',
            color: theme.colors.text.secondary
          }}>
            {formData.setupActions?.length > 0 
              ? formData.setupActions.join(', ')
              : 'None'
            }
          </div>
        </div>

        {/* Required Fields (read-only for now) */}
        <div className="form-group">
          <label style={{ color: theme.colors.text.primary }}>
            Required Fields <span style={{ fontSize: '12px', opacity: 0.7 }}>(from copied state)</span>
          </label>
          <div style={{ 
            padding: '10px', 
            background: theme.colors.background.tertiary,
            borderRadius: '6px',
            fontSize: '14px',
            color: theme.colors.text.secondary
          }}>
            {formData.requiredFields?.length > 0 
              ? formData.requiredFields.join(', ')
              : 'None'
            }
          </div>
        </div>
      </>
    )}

    {/* If NO copy selected yet, show helper */}
    {!formData.copyFrom && (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: theme.colors.text.tertiary,
        fontSize: '14px'
      }}>
        👆 Select a state to copy from above
      </div>
    )}
  </>
)}

          {/* CUSTOM MODE */}
          {mode === 'custom' && (
            <>
              {/* Platform Selection */}
              <div className="form-group">
                <label style={{ color: theme.colors.text.primary }}>
                  Platform <span style={{ color: theme.colors.accents.red }}>*</span>
                </label>
                <div className="platform-radio-group">
                  {['web', 'mobile-dancer', 'mobile-manager'].map(platform => (
                    <label key={platform} className="radio-label">
                      <input
                        type="radio"
                        value={platform}
                        checked={formData.platform === platform}
                        onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                      />
                      <span style={{ color: theme.colors.text.primary }}>
                        {platform === 'web' ? '🌐' : '📱'} {platform}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Trigger Button */}
              <div className="form-group">
                <label style={{ color: theme.colors.text.primary }}>
                  Trigger Button
                </label>
                <input
                  type="text"
                  value={formData.triggerButton}
                  onChange={(e) => setFormData({ ...formData, triggerButton: e.target.value.toUpperCase() })}
                  placeholder="e.g., REVIEW_BOOKING"
                  style={{
                    background: theme.colors.background.tertiary,
                    color: theme.colors.text.primary,
                    border: `1px solid ${theme.colors.border}`
                  }}
                />
                <span className="helper-text" style={{ color: theme.colors.text.tertiary }}>
                  Button text in UPPERCASE
                </span>
              </div>

              {/* Advanced Options Toggle */}
              <button
                className="advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ color: theme.colors.primary }}
              >
                ⚙️ {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </button>

              {/* Advanced Fields */}
              {showAdvanced && (
                <div className="advanced-section">
                  <div className="form-group">
                    <label>After Button</label>
                    <input
                      type="text"
                      value={formData.afterButton}
                      onChange={(e) => setFormData({ ...formData, afterButton: e.target.value })}
                      style={{
                        background: theme.colors.background.tertiary,
                        color: theme.colors.text.primary,
                        border: `1px solid ${theme.colors.border}`
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Previous Button</label>
                    <input
                      type="text"
                      value={formData.previousButton}
                      onChange={(e) => setFormData({ ...formData, previousButton: e.target.value })}
                      style={{
                        background: theme.colors.background.tertiary,
                        color: theme.colors.text.primary,
                        border: `1px solid ${theme.colors.border}`
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Status Code</label>
                    <input
                      type="text"
                      value={formData.statusCode}
                      onChange={(e) => setFormData({ ...formData, statusCode: e.target.value })}
                      style={{
                        background: theme.colors.background.tertiary,
                        color: theme.colors.text.primary,
                        border: `1px solid ${theme.colors.border}`
                      }}
                    />
                  </div>

                  {/* Add more advanced fields as needed */}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
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
            disabled={mode === 'quick' && !formData.copyFrom}
            style={{
              background: theme.colors.primary,
              opacity: (mode === 'quick' && !formData.copyFrom) ? 0.5 : 1
            }}
          >
            Create State
          </button>
        </div>
      </div>
    </div>
  );
}