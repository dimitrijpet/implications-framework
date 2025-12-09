// packages/web-app/src/components/UIScreenEditor/FunctionSelector.jsx
// ✨ NEW Component for selecting functions and mapping parameters

import { useState, useEffect } from 'react';
import { ChevronDown, AlertCircle, FunctionSquare } from 'lucide-react';

/**
 * FunctionSelector Component
 * 
 * Allows users to:
 * 1. Select a function from POM
 * 2. Map parameters to context fields or custom values
 * 3. Validate required parameters
 * 4. Add function call to screen
 */
export default function FunctionSelector({ 
  pomName, 
  projectPath, 
  contextFields = [],
  onAdd, 
  onCancel, 
  theme 
}) {
  const [functions, setFunctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [parameterValues, setParameterValues] = useState({});

  // Load functions when POM is selected
  useEffect(() => {
    if (pomName && projectPath) {
      loadFunctions();
    }
  }, [pomName, projectPath]);

  const loadFunctions = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3000/api/poms/${pomName}?projectPath=${encodeURIComponent(projectPath)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load POM details');
      }

      const data = await response.json();
      console.log('✨ Loaded functions:', data.functions);
      setFunctions(data.functions || []);
    } catch (error) {
      console.error('❌ Error loading functions:', error);
      setFunctions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFunctionSelect = (funcName) => {
    const func = functions.find(f => f.name === funcName);
    setSelectedFunction(func);
    
    // Initialize parameter values with defaults
    const initialParams = {};
    if (func && func.parameters) {
      func.parameters.forEach(param => {
        if (param.hasDefault) {
          initialParams[param.name] = param.defaultValue;
        } else {
          initialParams[param.name] = '';
        }
      });
    }
    setParameterValues(initialParams);
  };

  const handleParameterChange = (paramName, value) => {
    setParameterValues(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const validateAndAdd = () => {
    if (!selectedFunction) {
      alert('Please select a function');
      return;
    }

    // Check required parameters
    const missingParams = selectedFunction.parameters
      .filter(p => !p.hasDefault && !parameterValues[p.name])
      .map(p => p.name);

    if (missingParams.length > 0) {
      alert(`Missing required parameters: ${missingParams.join(', ')}`);
      return;
    }

    // Build function call object
    const functionCall = {
      type: 'function',
      name: selectedFunction.name,
      signature: selectedFunction.signature,
      parameters: parameterValues
    };

    console.log('✨ Adding function call:', functionCall);
    onAdd(functionCall);
  };

  if (!pomName) {
    return (
      <div className="p-4 rounded-lg" style={{
        background: `${theme.colors.accents.orange}20`,
        border: `1px solid ${theme.colors.accents.orange}`
      }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={20} style={{ color: theme.colors.accents.orange }} />
          <span className="font-semibold" style={{ color: theme.colors.text.primary }}>
            No POM Selected
          </span>
        </div>
        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
          Please select a Page Object Model above to add functions
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center" style={{ color: theme.colors.text.tertiary }}>
        <div className="animate-pulse">Loading functions...</div>
      </div>
    );
  }

  if (functions.length === 0) {
    return (
      <div className="p-4 rounded-lg" style={{
        background: `${theme.colors.accents.orange}20`,
        border: `1px solid ${theme.colors.accents.orange}`
      }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={20} style={{ color: theme.colors.accents.orange }} />
          <span className="font-semibold" style={{ color: theme.colors.text.primary }}>
            No Functions Found
          </span>
        </div>
        <div className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
          The selected POM ({pomName}) doesn't have any functions with parameters.
        </div>
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded text-sm"
          style={{ 
            background: theme.colors.background.tertiary, 
            color: theme.colors.text.secondary 
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Function Selector */}
      <div>
        <label className="block text-sm font-semibold mb-2" style={{
          color: theme.colors.text.secondary
        }}>
          <FunctionSquare className="inline mr-1" size={16} />
          Select Function
        </label>
        <select
          value={selectedFunction?.name || ''}
          onChange={(e) => handleFunctionSelect(e.target.value)}
          className="w-full px-3 py-2 rounded border text-sm"
          style={{
            background: theme.colors.background.primary,
            borderColor: theme.colors.border,
            color: theme.colors.text.primary
          }}
        >
          <option value="">Choose a function...</option>
          {functions.map(func => (
            <option key={func.name} value={func.name}>
              {func.signature}
            </option>
          ))}
        </select>
      </div>

      {/* Parameter Mapping */}
      {selectedFunction && selectedFunction.parameters && selectedFunction.parameters.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold" style={{
            color: theme.colors.text.secondary
          }}>
            📝 Map Parameters
          </div>

          {selectedFunction.parameters.map(param => (
            <ParameterInput
              key={param.name}
              param={param}
              value={parameterValues[param.name] || ''}
              contextFields={contextFields}
              onChange={(value) => handleParameterChange(param.name, value)}
              theme={theme}
            />
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t" style={{ borderColor: theme.colors.border }}>
        <button
          onClick={validateAndAdd}
          disabled={!selectedFunction}
          className="flex-1 px-4 py-2 rounded font-semibold transition hover:brightness-110 disabled:opacity-50"
          style={{
            background: theme.colors.accents.purple,
            color: 'white'
          }}
        >
          ✨ Add Function
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded font-semibold transition hover:brightness-110"
          style={{
            background: theme.colors.background.tertiary,
            color: theme.colors.text.secondary
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * ParameterInput Component
 * Handles individual parameter mapping
 */
function ParameterInput({ param, value, contextFields, onChange, theme }) {
  const [mode, setMode] = useState('context'); // 'context' or 'custom'

  // Detect if current value is a context reference
  useEffect(() => {
    if (value && value.startsWith('{{') && value.endsWith('}}')) {
      setMode('context');
    } else if (value && value !== '') {
      setMode('custom');
    }
  }, [value]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'context') {
      onChange('');
    } else {
      onChange(param.defaultValue || '');
    }
  };

  const handleContextSelect = (fieldName) => {
    onChange(`{{${fieldName}}}`);
  };

  const extractFieldFromContext = (contextValue) => {
    const match = contextValue.match(/\{\{(\w+)\}\}/);
    return match ? match[1] : '';
  };

  return (
    <div className="p-3 rounded" style={{
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border}`
    }}>
      {/* Parameter Name & Required Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold" style={{
            color: theme.colors.accents.purple
          }}>
            {param.name}
          </span>
          {param.hasDefault && (
            <span className="text-xs px-2 py-0.5 rounded" style={{
              background: `${theme.colors.accents.blue}20`,
              color: theme.colors.accents.blue
            }}>
              optional
            </span>
          )}
        </div>

        {!param.hasDefault && (
          <span className="text-xs px-2 py-1 rounded font-semibold" style={{
            background: `${theme.colors.accents.red}20`,
            color: theme.colors.accents.red
          }}>
            Required
          </span>
        )}
      </div>

      {/* Default Value Info */}
      {param.hasDefault && param.defaultValue !== undefined && (
        <div className="text-xs mb-2" style={{ color: theme.colors.text.tertiary }}>
          Default: <code className="px-1 rounded" style={{ background: theme.colors.background.tertiary }}>
            {JSON.stringify(param.defaultValue)}
          </code>
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => handleModeChange('context')}
          className="flex-1 px-3 py-1.5 rounded text-sm font-semibold transition"
          style={{
            background: mode === 'context' 
              ? theme.colors.accents.blue 
              : theme.colors.background.tertiary,
            color: mode === 'context' 
              ? 'white' 
              : theme.colors.text.tertiary
          }}
        >
          {'{{ }} From Context'}
        </button>
        
        <button
          onClick={() => handleModeChange('custom')}
          className="flex-1 px-3 py-1.5 rounded text-sm font-semibold transition"
          style={{
            background: mode === 'custom' 
              ? theme.colors.accents.blue 
              : theme.colors.background.tertiary,
            color: mode === 'custom' 
              ? 'white' 
              : theme.colors.text.tertiary
          }}
        >
          ✏️ Custom Value
        </button>
      </div>

      {/* Input Field */}
      {mode === 'context' ? (
        <div className="space-y-2">
          <select
            value={extractFieldFromContext(value)}
            onChange={(e) => handleContextSelect(e.target.value)}
            className="w-full px-3 py-2 rounded border text-sm"
            style={{
              background: theme.colors.background.primary,
              borderColor: theme.colors.border,
              color: theme.colors.text.primary
            }}
          >
            <option value="">Select context field...</option>
            {contextFields.map(field => (
              <option key={field} value={field}>
                {`{{ ${field} }}`}
              </option>
            ))}
          </select>

          {contextFields.length === 0 && (
            <div className="text-xs" style={{ color: theme.colors.accents.orange }}>
              ⚠️ No context fields detected. Add some elements with {'{{}}'} syntax first.
            </div>
          )}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter value..."
          className="w-full px-3 py-2 rounded border text-sm"
          style={{
            background: theme.colors.background.primary,
            borderColor: theme.colors.border,
            color: theme.colors.text.primary
          }}
        />
      )}

      {/* Preview */}
      {value && (
        <div className="mt-2 text-xs p-2 rounded font-mono" style={{
          background: theme.colors.background.tertiary,
          color: theme.colors.accents.green
        }}>
          💡 Will pass: <code>{value}</code>
        </div>
      )}
    </div>
  );
}