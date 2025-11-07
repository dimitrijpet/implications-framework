// packages/web-app/src/components/AddTransitionModal/AddTransitionModal.jsx
// ✨ ENHANCED VERSION with POM Discovery, Method Dropdowns, Smart Args Parsing

import { useState, useEffect } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';

const API_URL = 'http://localhost:3000';

export default function AddTransitionModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  sourceState, 
  targetState,
  projectPath
}) {
const [formData, setFormData] = useState({
  event: '',
  description: '',
  platforms: [],  // ✅ ADD THIS
  hasActionDetails: false,
  imports: [],
  steps: []
});
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // POM Discovery State
  const [availablePOMs, setAvailablePOMs] = useState([]);
  const [loadingPOMs, setLoadingPOMs] = useState(false);
  const [pomDetails, setPomDetails] = useState({});

  // Fetch available POMs when modal opens
  useEffect(() => {
    if (isOpen && projectPath) {
      fetchAvailablePOMs();
    }
  }, [isOpen, projectPath]);

  // Fetch POMs from API
  const fetchAvailablePOMs = async () => {
    setLoadingPOMs(true);
    try {
      const response = await fetch(`${API_URL}/api/poms?projectPath=${encodeURIComponent(projectPath)}`);
      if (response.ok) {
        const data = await response.json();
        
        const transformedPOMs = data.poms.map(pom => {
          const mainClass = pom.classes?.[0];
          
          return {
            className: mainClass?.name || pom.name,
            file: pom.path,
            name: pom.name,
            classes: pom.classes,
            exports: pom.exports
          };
        });
        
        console.log('📦 Transformed POMs:', transformedPOMs);
        setAvailablePOMs(transformedPOMs);
      } else {
        console.error('Failed to fetch POMs:', response.status);
      }
    } catch (error) {
      console.error('Error fetching POMs:', error);
    } finally {
      setLoadingPOMs(false);
    }
  };

  // Fetch POM details
  const fetchPOMDetails = async (pomName) => {
    if (pomDetails[pomName]) {
      return pomDetails[pomName];
    }

    try {
      const response = await fetch(`${API_URL}/api/poms/${pomName}?projectPath=${encodeURIComponent(projectPath)}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`📋 POM Details for ${pomName}:`, data);
        
        setPomDetails(prev => ({
          ...prev,
          [pomName]: data
        }));
        
        return data;
      }
    } catch (error) {
      console.error(`Error fetching POM details for ${pomName}:`, error);
    }
    return null;
  };

  // Reset form when modal opens/closes
  useEffect(() => {
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
          constructor: '',
          selectedPOM: '',
          availableInstances: [],
          selectedInstance: ''
        }
      ]
    }));
  };

  // Handle POM selection
  const handlePOMSelect = async (index, pomName) => {
    console.log(`🔍 Selected POM: ${pomName}`);
    
    const selectedPOM = availablePOMs.find(p => p.className === pomName);
    
    if (selectedPOM) {
      const mainClass = selectedPOM.classes?.[0];
      
      const constructorTemplate = `new ${pomName}(page, ctx.data.lang || 'en', ctx.data.device || 'desktop')`;
      const pathTemplate = selectedPOM.name || selectedPOM.file.replace(/\\/g, '.').replace(/\.js$/, '');
      const varName = pomName.charAt(0).toLowerCase() + pomName.slice(1);
      
      setFormData(prev => ({
        ...prev,
        imports: prev.imports.map((imp, i) => 
          i === index ? {
            ...imp,
            selectedPOM: pomName,
            className: pomName,
            varName: varName,
            path: pathTemplate,
            constructor: constructorTemplate,
            functions: mainClass?.functions || []
          } : imp
        )
      }));
    }
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
          args: [],
          availableMethods: []
        }
      ]
    }));
  };

  // Handle instance selection for step
  const handleStepInstanceSelect = (stepIndex, instanceVarName) => {
    const matchingImport = formData.imports.find(imp => imp.varName === instanceVarName);
    
    if (matchingImport) {
      const availableMethods = matchingImport.functions || [];
      
      setFormData(prev => ({
        ...prev,
        steps: prev.steps.map((step, i) => 
          i === stepIndex ? {
            ...step,
            instance: instanceVarName,
            availableMethods: availableMethods,
            method: '',
            args: []
          } : step
        )
      }));
    }
  };

  // Handle method selection with signature
const handleStepMethodSelect = (stepIndex, methodSignature) => {
  const match = methodSignature.match(/^([^(]+)\(([^)]*)\)/);
  
  if (match) {
    const methodName = match[1];
    const paramsStr = match[2];
    const params = paramsStr ? paramsStr.split(',').map(p => p.trim()) : [];
    
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === stepIndex ? {
          ...step,
          method: methodName,
          signature: methodSignature,
          // ✅ FIX: Strip default values from params!
          args: params.map(p => {
            // Remove default value: "param = 0" → "param"
            const paramName = p.split('=')[0].trim();
            return `ctx.data.${paramName}`;
          })
        } : step
      )
    }));
  }
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

  // ✅ SMART: Update step args with assignment detection
  const handleStepArgsChange = (index, value) => {
    const argsArray = value.split(',').map(arg => {
      arg = arg.trim();
      
      // Detect assignment operator (common mistake)
      if (arg.includes(' = ')) {
        const [varPath, defaultValue] = arg.split(' = ').map(s => s.trim());
        
        // Convert: "ctx.data.field = 0" → "ctx.data.field || 0"
        console.warn(`⚠️ Auto-fixing: "${arg}" → "${varPath} || ${defaultValue}"`);
        return `${varPath} || ${defaultValue}`;
      }
      
      return arg;
    }).filter(arg => arg);
    
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
      const submitData = {
  event: formData.event.trim(),
  platforms: formData.platforms?.length > 0 ? formData.platforms : null,  
        actionDetails: formData.hasActionDetails ? {
          description: formData.description.trim(),
          imports: formData.imports.map(imp => ({
            className: imp.className,
            varName: imp.varName,
            path: imp.path,
            constructor: imp.constructor
          })),
          steps: formData.steps.map(step => ({
            description: step.description,
            instance: step.instance,
            method: step.method,
            args: step.args
          }))
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
                🔗 Add Transition {loadingPOMs && '(Loading POMs...)'}
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
  <label className="block text-sm font-semibold mb-2" style={{ color: defaultTheme.colors.text.primary }}>
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

{/* ✨ ADD THIS: Platform Selection */}
<div>
  <label className="block text-sm font-semibold mb-2" style={{ color: defaultTheme.colors.text.primary }}>
    Available on Platforms
  </label>
  <div className="flex gap-3">
    {['web', 'dancer', 'manager'].map(platform => (
      <label 
        key={platform}
        className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition"
        style={{
          backgroundColor: formData.platforms?.includes(platform) 
            ? `${defaultTheme.colors.accents.blue}20` 
            : defaultTheme.colors.background.tertiary,
          border: `2px solid ${formData.platforms?.includes(platform) 
            ? defaultTheme.colors.accents.blue 
            : defaultTheme.colors.border}`
        }}
      >
        <input
          type="checkbox"
          checked={formData.platforms?.includes(platform) || false}
          onChange={(e) => {
            const newPlatforms = e.target.checked
              ? [...(formData.platforms || []), platform]
              : (formData.platforms || []).filter(p => p !== platform);
            setFormData(prev => ({ ...prev, platforms: newPlatforms }));
          }}
          className="w-4 h-4"
        />
        <span style={{ color: defaultTheme.colors.text.primary }}>
          {platform === 'web' ? '🌐' : '📱'} {platform}
        </span>
      </label>
    ))}
  </div>
  <p className="text-xs mt-1" style={{ color: defaultTheme.colors.text.tertiary }}>
    💡 Leave unchecked to make available on all platforms
  </p>
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

                    {/* POM Dropdown */}
                    <div>
                      <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                        Select POM (Screen Object) *
                      </label>
                      <select
                        value={imp.selectedPOM || ''}
                        onChange={(e) => handlePOMSelect(index, e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{
                          backgroundColor: defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${defaultTheme.colors.border}`
                        }}
                      >
                        <option value="">-- Select a POM --</option>
                        {availablePOMs.map((pom, idx) => (
                          <option key={idx} value={pom.className}>
                            {pom.className} ({pom.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Auto-filled fields */}
                    {imp.selectedPOM && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                              Class Name * (auto-filled)
                            </label>
                            <input
                              type="text"
                              value={imp.className}
                              onChange={(e) => handleImportChange(index, 'className', e.target.value)}
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
                              Variable Name * (auto-filled)
                            </label>
                            <input
                              type="text"
                              value={imp.varName}
                              onChange={(e) => handleImportChange(index, 'varName', e.target.value)}
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
                              Path * (auto-filled)
                            </label>
                            <input
                              type="text"
                              value={imp.path}
                              onChange={(e) => handleImportChange(index, 'path', e.target.value)}
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
                              Constructor * (auto-filled, editable)
                            </label>
                            <input
                              type="text"
                              value={imp.constructor}
                              onChange={(e) => handleImportChange(index, 'constructor', e.target.value)}
                              className="w-full px-3 py-1 rounded text-sm font-mono"
                              style={{
                                backgroundColor: defaultTheme.colors.background.tertiary,
                                color: defaultTheme.colors.text.primary,
                                border: `1px solid ${errors[`import_${index}_constructor`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                              }}
                            />
                          </div>
                        </div>

                        {/* Show available methods count */}
                        {imp.functions && imp.functions.length > 0 && (
                          <p className="text-xs" style={{ color: defaultTheme.colors.accents.green }}>
                            ✓ Found {imp.functions.length} methods in this POM
                          </p>
                        )}
                      </>
                    )}
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

                {/* Steps List */}
                {formData.steps.map((step, index) => (
                  <div 
                    key={index}
                    className="p-3 rounded mb-3"
                    style={{ 
                      backgroundColor: defaultTheme.colors.background.secondary,
                      border: `1px solid ${defaultTheme.colors.border}`
                    }}
                  >
                    {/* Step Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold" style={{ color: defaultTheme.colors.text.secondary }}>
                        Step #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(index)}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: defaultTheme.colors.accents.red + '20',
                          color: defaultTheme.colors.accents.red
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    {/* Description */}
                    <div className="mb-2">
                      <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                        Description *
                      </label>
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                        placeholder="e.g., Fill search form"
                        className="w-full px-3 py-1 rounded text-sm"
                        style={{
                          backgroundColor: defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${errors[`step_${index}_description`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                        }}
                      />
                    </div>

                    {/* Instance */}
                    <div className="mb-2">
                      <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                        Instance *
                      </label>
                      <select
                        value={step.instance}
                        onChange={(e) => handleStepInstanceSelect(index, e.target.value)}
                        className="w-full px-3 py-1 rounded text-sm"
                        style={{
                          backgroundColor: defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${errors[`step_${index}_instance`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`
                        }}
                      >
                        <option value="">-- Select instance --</option>
                        {formData.imports.map((imp, i) => (
                          <option key={i} value={imp.varName}>
                            {imp.varName} ({imp.className})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Method with Signature */}
                    <div className="mb-2">
                      <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                        Method * (with signature)
                      </label>
                      <select
                        value={step.signature || ''}
                        onChange={(e) => handleStepMethodSelect(index, e.target.value)}
                        disabled={!step.instance}
                        className="w-full px-3 py-1 rounded text-sm font-mono"
                        style={{
                          backgroundColor: defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${errors[`step_${index}_method`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                          opacity: !step.instance ? 0.5 : 1
                        }}
                      >
                        <option value="">-- Select method --</option>
                        {step.availableMethods && step.availableMethods.map((method, i) => (
                          <option key={i} value={method.signature}>
                            {method.signature}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ✅ Args Input with Smart Validation */}
                    <div>
                      <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                        Arguments (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={step.args.join(', ')}
                        onChange={(e) => handleStepArgsChange(index, e.target.value)}
                        placeholder="ctx.data.field1, ctx.data.field2 || defaultValue"
                        className="w-full px-3 py-1 rounded text-sm font-mono"
                        style={{
                          backgroundColor: defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${defaultTheme.colors.border}`
                        }}
                      />
                      
                      {/* Helper Text */}
                      <div className="text-xs mt-1" style={{ color: defaultTheme.colors.text.tertiary }}>
                        💡 Use <code className="px-1 rounded" style={{ backgroundColor: defaultTheme.colors.background.secondary }}>||</code> for defaults, not <code className="px-1 rounded" style={{ backgroundColor: defaultTheme.colors.background.secondary }}>=</code>. 
                        Example: <code className="px-1 rounded" style={{ backgroundColor: defaultTheme.colors.background.secondary }}>ctx.data.count || 0</code>
                      </div>
                      
                      {/* Live Warning */}
                      {step.args.some(arg => arg.includes(' = ')) && (
                        <div 
                          className="text-xs mt-2 px-2 py-1 rounded flex items-center gap-2"
                          style={{ 
                            backgroundColor: defaultTheme.colors.accents.yellow + '20',
                            color: defaultTheme.colors.accents.yellow,
                            border: `1px solid ${defaultTheme.colors.accents.yellow}`
                          }}
                        >
                          <span>⚠️</span>
                          <span>
                            Detected <code className="px-1 rounded" style={{ backgroundColor: defaultTheme.colors.accents.yellow + '30' }}>=</code> operator. 
                            Args will be auto-converted to use <code className="px-1 rounded" style={{ backgroundColor: defaultTheme.colors.accents.yellow + '30' }}>||</code> instead.
                          </span>
                        </div>
                      )}
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