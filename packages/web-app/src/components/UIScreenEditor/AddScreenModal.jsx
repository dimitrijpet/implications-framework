/**
 * AddScreenModal Component
 * 
 * Modal for adding new screens to platforms
 * Features:
 * - Screen name input with real-time validation
 * - Optional description
 * - Template selector (simple, withChecks, full)
 * - Visual feedback for validation state
 */

import React, { useState, useEffect } from 'react';
import { getAllTemplates, createScreenFromTemplate } from '../../utils/screenTemplates';
import { validateScreenName, getValidationHint, isCamelCase } from '../../utils/screenValidation';

export default function AddScreenModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  platformName,
  platformDisplayName,
  existingScreens = []
}) {
  const [screenName, setScreenName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('simple');
  const [validation, setValidation] = useState({ valid: false, errors: [] });
  const [touched, setTouched] = useState(false);

  const templates = getAllTemplates();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setScreenName('');
      setDescription('');
      setSelectedTemplate('simple');
      setValidation({ valid: false, errors: [] });
      setTouched(false);
    }
  }, [isOpen]);

  // Validate on name change
  useEffect(() => {
    if (touched || screenName) {
      const result = validateScreenName(screenName, platformName, existingScreens);
      setValidation(result);
    }
  }, [screenName, platformName, existingScreens, touched]);

  const handleNameChange = (e) => {
    setScreenName(e.target.value);
    setTouched(true);
  };

const handleSubmit = (e) => {
  e.preventDefault();
  
  if (!validation.valid) {
    setTouched(true);
    return;
  }

  const trimmedName = screenName.trim();

  // Create screen from template
  const newScreen = createScreenFromTemplate(
    selectedTemplate,
    trimmedName,
    description.trim()
  );

  // ✅ FIX: Pass screen name as second parameter
  console.log('✅ AddScreenModal: Adding screen', trimmedName, 'to platform', platformName);
  onAdd(platformName, trimmedName, newScreen);
  onClose();
};
  const handleCancel = () => {
    onClose();
  };

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  const hint = getValidationHint(screenName);
  const showError = touched && !validation.valid;
  const showSuccess = touched && validation.valid;
  const showHint = !showError && !showSuccess && screenName;
  const hasWarning = showSuccess && !isCamelCase(screenName);

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleCancel}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            Add Screen to Platform: {platformDisplayName}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Screen Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Screen Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={screenName}
              onChange={handleNameChange}
              onBlur={() => setTouched(true)}
              placeholder="e.g., myNewScreen"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            
            {/* Validation Feedback */}
            {showError && (
              <p className="mt-1 text-sm text-red-400">
                ❌ {validation.errors[0]}
              </p>
            )}
            {showSuccess && !hasWarning && (
              <p className="mt-1 text-sm text-green-400">
                ✓ Valid name
              </p>
            )}
            {hasWarning && (
              <p className="mt-1 text-sm text-yellow-400">
                {hint}
              </p>
            )}
            {showHint && (
              <p className="mt-1 text-sm text-gray-400">
                {hint}
              </p>
            )}
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this screen"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Template Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Template
            </label>
            <div className="space-y-2">
              {templates.map(template => (
                <label 
                  key={template.id}
                  className={`
                    flex items-start p-3 border rounded-md cursor-pointer transition-colors
                    ${selectedTemplate === template.id 
                      ? 'border-blue-500 bg-blue-500 bg-opacity-10' 
                      : 'border-gray-600 bg-gray-900 hover:border-gray-500'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="template"
                    value={template.id}
                    checked={selectedTemplate === template.id}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="mt-0.5 mr-3"
                  />
                  <div>
                    <div className="text-white font-medium">{template.name}</div>
                    <div className="text-sm text-gray-400">{template.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!validation.valid}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${validation.valid
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Add Screen
          </button>
        </div>
      </div>
    </div>
  );
}