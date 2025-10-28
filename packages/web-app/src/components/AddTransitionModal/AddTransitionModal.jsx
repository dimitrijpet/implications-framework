// packages/web-app/src/components/AddTransitionModal/AddTransitionModal.jsx

import { useState } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';

export default function AddTransitionModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  sourceState, 
  targetState 
}) {
  const [formData, setFormData] = useState({
    event: '',
    description: '',
    hasActionDetails: false,
    imports: [],
    steps: []
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens/closes
  useState(() => {
    if (isOpen) {
      setFormData({
        event: '',
        description: '',
        hasActionDetails: false,
        imports: [],
        steps: []
      });
      setErrors({});
    }
  }, [isOpen]);

  // Add new import
  const handleAddImport = () => {
    setFormData(prev => ({
      ...prev,
      imports: [
        ...prev.imports,
        {
          className: '',
          varName: '',
          path: '',
          constructor: ''
        }
      ]
    }));
  };

  // Update import field
  const handleImportChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      imports: prev.imports.map((imp, i) => 
        i === index ? { ...imp, [field]: value } : imp
      )
    }));
  };

  // Remove import
  const handleRemoveImport = (index) => {
    setFormData(prev => ({
      ...prev,
      imports: prev.imports.filter((_, i) => i !== index)
    }));
  };

  // Add new step
  const handleAddStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          description: '',
          instance: '',
          method: '',
          args: []
        }
      ]
    }));
  };

  // Update step field
  const handleStepChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, [field]: value } : step
      )
    }));
  };

  // Update step args (comma-separated string)
  const handleStepArgsChange = (index, value) => {
    const argsArray = value.split(',').map(arg => arg.trim()).filter(arg => arg);
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, args: argsArray } : step
      )
    }));
  };

  // Remove step
  const handleRemoveStep = (index) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.event.trim()) {
      newErrors.event = 'Event name is required';
    } else if (!/^[A-Z_]+$/.test(formData.event)) {
      newErrors.event = 'Event name must be UPPERCASE_WITH_UNDERSCORES';
    }

    if (formData.hasActionDetails) {
      if (!formData.description.trim()) {
        newErrors.description = 'Description is required when adding action details';
      }

      // Validate imports
      formData.imports.forEach((imp, index) => {
        if (!imp.className.trim()) {
          newErrors[`import_${index}_className`] = 'Class name is required';
        }
        if (!imp.varName.trim()) {
          newErrors[`import_${index}_varName`] = 'Variable name is required';
        }
        if (!imp.path.trim()) {
          newErrors[`import_${index}_path`] = 'Path is required';
        }
        if (!imp.constructor.trim()) {
          newErrors[`import_${index}_constructor`] = 'Constructor is required';
        }
      });

      // Validate steps
      formData.steps.forEach((step, index) => {
        if (!step.description.trim()) {
          newErrors[`step_${index}_description`] = 'Step description is required';
        }
        if (!step.instance.trim()) {
          newErrors[`step_${index}_instance`] = 'Instance name is required';
        }
        if (!step.method.trim()) {
          newErrors[`step_${index}_method`] = 'Method name is required';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Build submission data
      const submitData = {
        event: formData.event.trim(),
        actionDetails: formData.hasActionDetails ? {
          description: formData.description.trim(),
          imports: formData.imports,
          steps: formData.steps
        } : null
      };

      await onSubmit(submitData);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl mx-4 my-8 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ 
          backgroundColor: defaultTheme.colors.background.secondary,
          border: `2px solid ${defaultTheme.colors.border}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 px-6 py-4 border-b"
          style={{ 
            backgroundColor: defaultTheme.colors.background.secondary,
            borderColor: defaultTheme.colors.border 
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 
                className="text-2xl font-bold"
                style={{ color: defaultTheme.colors.accents.blue }}
              >
                🔗 Add Transition
              </h2>
              <p 
                className="text-sm mt-1"
                style={{ color: defaultTheme.colors.text.secondary }}
              >
                <span style={{ color: defaultTheme.colors.accents.green }}>
                  {sourceState?.id || 'source'}
                </span>
                {' → '}
                <span style={{ color: defaultTheme.colors.accents.blue }}>
                  {targetState?.id || 'target'}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-3xl font-bold px-3 py-1 rounded-lg transition"
              style={{ 
                color: defaultTheme.colors.accents.red,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = `${defaultTheme.colors.accents.red}20`}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ×
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Event Name */}
          <div>
            <label 
              className="block text-sm font-semibold mb-2"
              style={{ color: defaultTheme.colors.text.primary }}
            >
              Event Name *
            </label>
            <input
              type="text"
              value={formData.event}
              onChange={(e) => setFormData(prev => ({ ...prev, event: e.target.value.toUpperCase() }))}
              placeholder="e.g., SUBMIT_SEARCH, SELECT_AGENCY"
              className="w-full px-4 py-2 rounded-lg font-mono"
              style={{
                backgroundColor: defaultTheme.colors.background.tertiary,
                color: defaultTheme.colors.text.primary,
                border: `1px solid ${errors.event ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
              }}
            />
            {errors.event && (
              <p className="text-sm mt-1" style={{ color: defaultTheme.colors.accents.red }}>
                {errors.event}
              </p>
            )}
          </div>

          {/* Action Details Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="hasActionDetails"
              checked={formData.hasActionDetails}
              onChange={(e) => setFormData(prev => ({ ...prev, hasActionDetails: e.target.checked }))}
              className="w-5 h-5 cursor-pointer"
            />
            <label 
              htmlFor="hasActionDetails"
              className="text-sm font-semibold cursor-pointer"
              style={{ color: defaultTheme.colors.text.primary }}
            >
              ✨ Add Action Details (generate executable code)
            </label>
          </div>

          {/* Action Details Section */}
          {formData.hasActionDetails && (
            <div 
              className="p-4 rounded-lg space-y-6"
              style={{ 
                backgroundColor: defaultTheme.colors.background.tertiary,
                border: `1px solid ${defaultTheme.colors.border}`
              }}
            >
              {/* Description */}
              <div>
                <label 
                  className="block text-sm font-semibold mb-2"
                  style={{ color: defaultTheme.colors.text.primary }}
                >
                  Action Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Select agency from search bar"
                  className="w-full px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: defaultTheme.colors.background.secondary,
                    color: defaultTheme.colors.text.primary,
                    border: `1px solid ${errors.description ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                  }}
                />
                {errors.description && (
                  <p className="text-sm mt-1" style={{ color: defaultTheme.colors.accents.red }}>
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Screen Objects / Imports */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label 
                    className="text-sm font-semibold"
                    style={{ color: defaultTheme.colors.text.primary }}
                  >
                    📦 Screen Objects
                  </label>
                  <button
                    type="button"
                    onClick={handleAddImport}
                    className="px-3 py-1 rounded text-sm font-semibold transition"
                    style={{
                      backgroundColor: defaultTheme.colors.accents.green,
                      color: 'white'
                    }}
                  >
                    + Add Import
                  </button>
                </div>

                {formData.imports.map((imp, index) => (
                  <div 
                    key={index}
                    className="p-3 rounded-lg mb-3 space-y-2"
                    style={{ 
                      backgroundColor: defaultTheme.colors.background.secondary,
                      border: `1px solid ${defaultTheme.colors.border}`
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold" style={{ color: defaultTheme.colors.text.secondary }}>
                        Import #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImport(index)}
                        className="text-sm px-2 py-1 rounded"
                        style={{ color: defaultTheme.colors.accents.red }}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                          Class Name *
                        </label>
                        <input
                          type="text"
                          value={imp.className}
                          onChange={(e) => handleImportChange(index, 'className', e.target.value)}
                          placeholder="SearchBarWrapper"
                          className="w-full px-3 py-1 rounded text-sm"
                          style={{
                            backgroundColor: defaultTheme.colors.background.tertiary,
                            color: defaultTheme.colors.text.primary,
                            border: `1px solid ${errors[`import_${index}_className`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                          Variable Name *
                        </label>
                        <input
                          type="text"
                          value={imp.varName}
                          onChange={(e) => handleImportChange(index, 'varName', e.target.value)}
                          placeholder="searchBarWrapper"
                          className="w-full px-3 py-1 rounded text-sm"
                          style={{
                            backgroundColor: defaultTheme.colors.background.tertiary,
                            color: defaultTheme.colors.text.primary,
                            border: `1px solid ${errors[`import_${index}_varName`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                          Path (relative to screenObjects) *
                        </label>
                        <input
                          type="text"
                          value={imp.path}
                          onChange={(e) => handleImportChange(index, 'path', e.target.value)}
                          placeholder="searchBar.wrapper"
                          className="w-full px-3 py-1 rounded text-sm"
                          style={{
                            backgroundColor: defaultTheme.colors.background.tertiary,
                            color: defaultTheme.colors.text.primary,
                            border: `1px solid ${errors[`import_${index}_path`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                          Constructor *
                        </label>
                        <input
                          type="text"
                          value={imp.constructor}
                          onChange={(e) => handleImportChange(index, 'constructor', e.target.value)}
                          placeholder="new SearchBarWrapper(page, ctx.data.lang || 'en', ctx.data.device || 'desktop')"
                          className="w-full px-3 py-1 rounded text-sm font-mono"
                          style={{
                            backgroundColor: defaultTheme.colors.background.tertiary,
                            color: defaultTheme.colors.text.primary,
                            border: `1px solid ${errors[`import_${index}_constructor`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {formData.imports.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: defaultTheme.colors.text.secondary }}>
                    No screen objects added. Click "+ Add Import" to add one.
                  </p>
                )}
              </div>

              {/* Action Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label 
                    className="text-sm font-semibold"
                    style={{ color: defaultTheme.colors.text.primary }}
                  >
                    🎬 Action Steps
                  </label>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="px-3 py-1 rounded text-sm font-semibold transition"
                    style={{
                      backgroundColor: defaultTheme.colors.accents.blue,
                      color: 'white'
                    }}
                  >
                    + Add Step
                  </button>
                </div>

                {formData.steps.map((step, index) => (
                  <div 
                    key={index}
                    className="p-3 rounded-lg mb-3 space-y-2"
                    style={{ 
                      backgroundColor: defaultTheme.colors.background.secondary,
                      border: `1px solid ${defaultTheme.colors.border}`
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold" style={{ color: defaultTheme.colors.text.secondary }}>
                        Step #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(index)}
                        className="text-sm px-2 py-1 rounded"
                        style={{ color: defaultTheme.colors.accents.red }}
                      >
                        Remove
                      </button>
                    </div>

                    <div>
                      <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                        Description *
                      </label>
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                        placeholder="Open agency selector"
                        className="w-full px-3 py-1 rounded text-sm"
                        style={{
                          backgroundColor: defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${errors[`step_${index}_description`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                          Instance *
                        </label>
                        <input
                          type="text"
                          value={step.instance}
                          onChange={(e) => handleStepChange(index, 'instance', e.target.value)}
                          placeholder="searchBarWrapper"
                          className="w-full px-3 py-1 rounded text-sm font-mono"
                          style={{
                            backgroundColor: defaultTheme.colors.background.tertiary,
                            color: defaultTheme.colors.text.primary,
                            border: `1px solid ${errors[`step_${index}_instance`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                          Method *
                        </label>
                        <input
                          type="text"
                          value={step.method}
                          onChange={(e) => handleStepChange(index, 'method', e.target.value)}
                          placeholder="functionSelectAgency"
                          className="w-full px-3 py-1 rounded text-sm font-mono"
                          style={{
                            backgroundColor: defaultTheme.colors.background.tertiary,
                            color: defaultTheme.colors.text.primary,
                            border: `1px solid ${errors[`step_${index}_method`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                          Args (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={step.args.join(', ')}
                          onChange={(e) => handleStepArgsChange(index, e.target.value)}
                          placeholder="ctx.data.agencyName"
                          className="w-full px-3 py-1 rounded text-sm font-mono"
                          style={{
                            backgroundColor: defaultTheme.colors.background.tertiary,
                            color: defaultTheme.colors.text.primary,
                            border: `1px solid ${defaultTheme.colors.border}`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {formData.steps.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: defaultTheme.colors.text.secondary }}>
                    No action steps added. Click "+ Add Step" to add one.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div 
              className="p-4 rounded-lg"
              style={{ 
                backgroundColor: `${defaultTheme.colors.accents.red}20`,
                border: `1px solid ${defaultTheme.colors.accents.red}`
              }}
            >
              <p style={{ color: defaultTheme.colors.accents.red }}>
                ❌ {errors.submit}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t" style={{ borderColor: defaultTheme.colors.border }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 rounded-lg font-semibold transition flex-1"
              style={{
                backgroundColor: defaultTheme.colors.background.tertiary,
                color: defaultTheme.colors.text.primary,
                border: `1px solid ${defaultTheme.colors.border}`,
                opacity: loading ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-lg font-bold transition flex-1"
              style={{
                backgroundColor: loading ? defaultTheme.colors.background.tertiary : defaultTheme.colors.accents.green,
                color: 'white',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '⏳ Adding...' : '✅ Add Transition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}