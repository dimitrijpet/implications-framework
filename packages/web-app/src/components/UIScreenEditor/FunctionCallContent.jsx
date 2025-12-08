// packages/web-app/src/components/UIScreenEditor/FunctionCallContent.jsx
// ✅ ENHANCED: Full function arguments support with variable suggestions
//
// Features:
// - Instance dropdown with POM search
// - Method dropdown filtered by selected instance/POM
// - ✅ NEW: Function arguments with parameter info from POM discovery
// - ✅ NEW: Variable suggestions (storedVariables + ctx.data.*)
// - storeAs suggestions from method return keys
// - Live code preview with args

import { useState, useEffect, useMemo } from 'react';
import AutocompleteInput from './AutocompleteInput';
import usePOMData from '../../hooks/usePOMData';

/**
 * FunctionCallContent - Enhanced with POM integration + Arguments Support
 * 
 * Props:
 * - block: The block object
 * - editMode: Whether editing is enabled
 * - theme: Theme object
 * - onUpdate: (updates) => void
 * - pomName: Current screen's POM (for default instance)
 * - projectPath: Project path for API calls
 * - storedVariables: Available stored variables for argument suggestions
 */
export default function FunctionCallContent({ 
  block, 
  editMode, 
  theme, 
  onUpdate, 
  pomName,
  projectPath,
  storedVariables = []
}) {
  const data = block.data || {};
  
  // Load POM data
  const { 
    poms, 
    loading: pomsLoading,
    getPOMFunctions,
    getMethodReturnKeys 
  } = usePOMData(projectPath);

  // Local state for method suggestions (with full parameter info)
  const [methodSuggestions, setMethodSuggestions] = useState([]);
  const [returnKeys, setReturnKeys] = useState([]);
  
  // ✅ NEW: Selected method's parameter info
  const [selectedMethodInfo, setSelectedMethodInfo] = useState(null);

  // Transform POMs to autocomplete options
  const instanceOptions = useMemo(() => {
    return poms.map(pom => ({
      value: pom.name,
      label: pom.displayName || pom.name,
      description: pom.path,
      icon: '📦'
    }));
  }, [poms]);

  // Update method suggestions when instance changes
  useEffect(() => {
    if (data.instance) {
      // Find the POM that matches the instance
      const matchingPOM = poms.find(p => 
        p.name === data.instance ||
        p.name.includes(data.instance) ||
        data.instance.includes(p.name)
      );
      
      if (matchingPOM) {
        const functions = getPOMFunctions(matchingPOM.name);
        setMethodSuggestions(functions.map(fn => ({
          value: fn.name,
          label: fn.name,
          description: fn.signature,
          async: fn.async,
          returns: fn.returns,
          parameters: fn.parameters || [],      // ✅ Include parameters
          paramNames: fn.paramNames || []       // ✅ Include param names
        })));
      } else {
        // Try to match by screen's pomName
        if (pomName) {
          const functions = getPOMFunctions(pomName);
          setMethodSuggestions(functions.map(fn => ({
            value: fn.name,
            label: fn.name,
            description: fn.signature,
            async: fn.async,
            returns: fn.returns,
            parameters: fn.parameters || [],
            paramNames: fn.paramNames || []
          })));
        }
      }
    }
  }, [data.instance, poms, pomName, getPOMFunctions]);

  // ✅ NEW: Update selected method info and initialize args when method changes
  useEffect(() => {
    if (data.method && methodSuggestions.length > 0) {
      const methodInfo = methodSuggestions.find(m => m.value === data.method);
      setSelectedMethodInfo(methodInfo || null);
      
      // Initialize args array if method has parameters and args not set
      if (methodInfo?.parameters?.length > 0 && (!data.args || data.args.length === 0)) {
        const initialArgs = methodInfo.parameters.map(p => 
          p.hasDefault ? String(p.defaultValue || '') : ''
        );
        onUpdate({
          data: { ...data, args: initialArgs }
        });
      }
    } else {
      setSelectedMethodInfo(null);
    }
  }, [data.method, methodSuggestions]);

  // Update return keys when method changes
  useEffect(() => {
    if (data.instance && data.method) {
      const keys = getMethodReturnKeys(data.instance, data.method);
      setReturnKeys(keys);
    } else {
      setReturnKeys([]);
    }
  }, [data.instance, data.method, getMethodReturnKeys]);

  // Update handler
  const updateData = (key, value) => {
    onUpdate({
      data: { ...data, [key]: value }
    });
  };

  // Handle instance selection
  const handleInstanceSelect = (option) => {
    // Clear method and args when instance changes
    onUpdate({
      data: { 
        ...data, 
        instance: option.value, 
        method: '',
        args: []
      }
    });
  };

  // Handle method selection
  const handleMethodSelect = (option) => {
    // Initialize args based on method parameters
    const initialArgs = (option.parameters || []).map(p => 
      p.hasDefault ? String(p.defaultValue || '') : ''
    );
    
    onUpdate({
      data: { 
        ...data, 
        method: option.value,
        args: initialArgs,
        // Auto-enable await for async methods
        await: option.async ? true : data.await
      }
    });
  };

  // ✅ NEW: Handle argument value change
  const handleArgChange = (index, value) => {
    const newArgs = [...(data.args || [])];
    newArgs[index] = value;
    updateData('args', newArgs);
  };

  // ✅ NEW: Handle inserting a variable into an argument
  const handleInsertVariable = (index, varTemplate) => {
    const newArgs = [...(data.args || [])];
    newArgs[index] = varTemplate;
    updateData('args', newArgs);
  };

  // storeAs options from return keys
  const storeAsOptions = useMemo(() => {
    if (returnKeys.length === 0) return [];
    
    return [
      { value: `${data.method}Result`, label: `${data.method}Result`, description: 'Full return value' },
      ...returnKeys.map(key => ({
        value: key,
        label: key,
        description: `Destructure: { ${key} }`
      }))
    ];
  }, [returnKeys, data.method]);

  // ✅ NEW: Build common ctx.data suggestions
  const ctxDataSuggestions = useMemo(() => {
    return [
      'ctx.data.booking',
      'ctx.data.dancerName', 
      'ctx.data.clubName',
      'ctx.data.lang',
      'ctx.data.device'
    ];
  }, []);

  return (
    <div className="space-y-3">
      {/* Instance & Method Row */}
      <div className="flex gap-3">
        {/* Instance */}
        <div className="flex-1">
          {editMode ? (
            <AutocompleteInput
              value={data.instance || ''}
              onChange={(val) => updateData('instance', val)}
              options={instanceOptions}
              placeholder="Select POM instance..."
              disabled={!editMode}
              theme={theme}
              label="Instance"
              icon="📦"
              loading={pomsLoading}
              onOptionSelect={handleInstanceSelect}
              emptyMessage="No POMs found"
              allowFreeText={true}
            />
          ) : (
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
                Instance
              </label>
              <div 
                className="px-3 py-1.5 rounded text-sm font-mono"
                style={{ 
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              >
                {data.instance || <span style={{ color: theme.colors.text.tertiary }}>—</span>}
              </div>
            </div>
          )}
        </div>

        {/* Method */}
        <div className="flex-1">
          {editMode ? (
            <AutocompleteInput
              value={data.method || ''}
              onChange={(val) => updateData('method', val)}
              options={methodSuggestions}
              placeholder="Select method..."
              disabled={!editMode || !data.instance}
              theme={theme}
              label="Method"
              icon="⚡"
              onOptionSelect={handleMethodSelect}
              emptyMessage={data.instance ? "No methods found" : "Select instance first"}
              allowFreeText={true}
            />
          ) : (
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
                Method
              </label>
              <div 
                className="px-3 py-1.5 rounded text-sm font-mono"
                style={{ 
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              >
                {data.method || <span style={{ color: theme.colors.text.tertiary }}>—</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ✅ NEW: FUNCTION ARGUMENTS SECTION
          ═══════════════════════════════════════════════════════════ */}
      {selectedMethodInfo?.parameters?.length > 0 && (
        <div 
          className="p-3 rounded space-y-3"
          style={{ 
            background: `${theme.colors.accents.cyan}10`,
            border: `1px solid ${theme.colors.accents.cyan}40`
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: theme.colors.accents.cyan }}>
              📝 Arguments ({selectedMethodInfo.parameters.length})
            </span>
            <span className="text-xs font-mono" style={{ color: theme.colors.text.tertiary }}>
              {selectedMethodInfo.description}
            </span>
          </div>

          {selectedMethodInfo.parameters.map((param, idx) => (
            <ArgumentInput
              key={idx}
              param={param}
              value={data.args?.[idx] || ''}
              onChange={(val) => handleArgChange(idx, val)}
              onInsertVariable={(varTemplate) => handleInsertVariable(idx, varTemplate)}
              editMode={editMode}
              theme={theme}
              storedVariables={storedVariables}
              ctxDataSuggestions={ctxDataSuggestions}
            />
          ))}
        </div>
      )}

      {/* Options Row */}
      <div className="flex items-end gap-4">
        {/* Await checkbox */}
        <label className="flex items-center gap-2 text-sm cursor-pointer py-1.5">
          <input
            type="checkbox"
            checked={data.await ?? true}
            onChange={(e) => updateData('await', e.target.checked)}
            disabled={!editMode}
            className="rounded"
          />
          <span style={{ color: theme.colors.text.secondary }}>await</span>
        </label>

        {/* Store As */}
        <div className="flex-1 max-w-[200px]">
          {editMode ? (
            <AutocompleteInput
              value={data.storeAs || ''}
              onChange={(val) => updateData('storeAs', val)}
              options={storeAsOptions}
              placeholder="variableName"
              disabled={!editMode}
              theme={theme}
              label="Store result as"
              icon="💾"
              emptyMessage="Type variable name"
              allowFreeText={true}
            />
          ) : (
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
                Store result as
              </label>
              <div 
                className="px-3 py-1.5 rounded text-sm font-mono"
                style={{ 
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: data.storeAs ? theme.colors.accents.yellow : theme.colors.text.tertiary
                }}
              >
                {data.storeAs || '—'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Return Keys Hint */}
      {editMode && returnKeys.length > 0 && (
        <div 
          className="flex items-center gap-2 p-2 rounded text-xs"
          style={{ 
            background: `${theme.colors.accents.purple}15`,
            border: `1px solid ${theme.colors.accents.purple}30`
          }}
        >
          <span style={{ color: theme.colors.accents.purple }}>💡</span>
          <span style={{ color: theme.colors.text.secondary }}>
            This method returns: 
          </span>
          <div className="flex gap-1 flex-wrap">
            {returnKeys.map(key => (
              <button
                key={key}
                onClick={() => updateData('storeAs', key)}
                className="px-1.5 py-0.5 rounded font-mono transition hover:brightness-110"
                style={{ 
                  background: `${theme.colors.accents.purple}30`,
                  color: theme.colors.accents.purple
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ✅ NEW: ASSERTION SECTION
          ═══════════════════════════════════════════════════════════ */}
      <AssertionSection
        assertion={data.assertion}
        editMode={editMode}
        theme={theme}
        onChange={(assertion) => updateData('assertion', assertion)}
        storedVariables={storedVariables}
        hasMethod={!!data.method}
      />

      {/* Code Preview */}
      <div 
        className="p-3 rounded font-mono text-sm space-y-1"
        style={{ 
          background: theme.colors.background.primary,
          border: `1px solid ${theme.colors.border}`
        }}
      >
        {/* Line 1: Function call */}
        <div>
          {/* Variable declaration (if storeAs OR if asserting) */}
          {(data.storeAs || data.assertion?.type) && (
            <span style={{ color: theme.colors.accents.yellow }}>
              const {data.storeAs || 'result'} = 
            </span>
          )}
          
          {/* await keyword */}
          {data.await && (
            <span style={{ color: theme.colors.accents.blue }}> await </span>
          )}
          
          {/* Instance */}
          <span style={{ color: theme.colors.text.primary }}>
            {data.instance || <span style={{ color: theme.colors.text.tertiary }}>instance</span>}
          </span>
          
          {/* Dot */}
          <span style={{ color: theme.colors.text.tertiary }}>.</span>
          
          {/* Method */}
          <span style={{ color: theme.colors.accents.green }}>
            {data.method || <span style={{ color: theme.colors.text.tertiary }}>method</span>}
          </span>
          
          {/* Parentheses with args */}
          <span style={{ color: theme.colors.text.tertiary }}>(</span>
          
          {/* Render args */}
          {data.args && data.args.length > 0 && data.args.some(a => a) ? (
            data.args.map((arg, i) => (
              <span key={i}>
                {i > 0 && <span style={{ color: theme.colors.text.tertiary }}>, </span>}
                {arg ? (
                  <span style={{ 
                    color: arg.startsWith('ctx.') || arg.includes('{{') 
                      ? theme.colors.accents.yellow 
                      : theme.colors.accents.green 
                  }}>
                    {arg.includes('{{') ? arg : (
                      arg.startsWith('ctx.') ? arg : `"${arg}"`
                    )}
                  </span>
                ) : (
                  <span style={{ color: theme.colors.text.tertiary }}>...</span>
                )}
              </span>
            ))
          ) : null}
          
          <span style={{ color: theme.colors.text.tertiary }}>);</span>
        </div>

        {/* Line 2: Assertion (if enabled) */}
        {data.assertion?.type && (
          <div>
            <span style={{ color: theme.colors.accents.blue }}>await </span>
            <span style={{ color: theme.colors.accents.purple }}>expect</span>
            <span style={{ color: theme.colors.text.tertiary }}>(</span>
            <span style={{ color: theme.colors.accents.yellow }}>{data.storeAs || 'result'}</span>
            <span style={{ color: theme.colors.text.tertiary }}>).</span>
            <span style={{ color: theme.colors.accents.green }}>{data.assertion.type}</span>
            <span style={{ color: theme.colors.text.tertiary }}>(</span>
            {data.assertion.value !== undefined && data.assertion.value !== '' && (
              <span style={{ 
                color: String(data.assertion.value).includes('{{') 
                  ? theme.colors.accents.yellow 
                  : theme.colors.accents.green 
              }}>
                {typeof data.assertion.value === 'string' && !data.assertion.value.includes('{{')
                  ? `"${data.assertion.value}"`
                  : data.assertion.value}
              </span>
            )}
            <span style={{ color: theme.colors.text.tertiary }}>);</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ✅ NEW: AssertionSection Component
// ═══════════════════════════════════════════════════════════

const ASSERTION_TYPES = [
  // Visibility
  { value: 'toBeVisible', label: '👁 toBeVisible', category: 'visibility', needsValue: false },
  { value: 'toBeHidden', label: '🚫 toBeHidden', category: 'visibility', needsValue: false },
  // Text
  { value: 'toHaveText', label: '📝 toHaveText', category: 'text', needsValue: true },
  { value: 'toContainText', label: '📝 toContainText', category: 'text', needsValue: true },
  // Value
  { value: 'toBe', label: '= toBe', category: 'value', needsValue: true },
  { value: 'toEqual', label: '≡ toEqual', category: 'value', needsValue: true },
  { value: 'toContain', label: '⊃ toContain', category: 'value', needsValue: true },
  { value: 'toMatch', label: '~ toMatch', category: 'value', needsValue: true },
  // Boolean
  { value: 'toBeTruthy', label: '✓ toBeTruthy', category: 'boolean', needsValue: false },
  { value: 'toBeFalsy', label: '✗ toBeFalsy', category: 'boolean', needsValue: false },
  // State
  { value: 'toBeDefined', label: '? toBeDefined', category: 'state', needsValue: false },
  { value: 'toBeNull', label: '∅ toBeNull', category: 'state', needsValue: false },
  // Numeric
  { value: 'toBeGreaterThan', label: '> toBeGreaterThan', category: 'numeric', needsValue: true },
  { value: 'toBeLessThan', label: '< toBeLessThan', category: 'numeric', needsValue: true },
  { value: 'toHaveLength', label: '# toHaveLength', category: 'numeric', needsValue: true },
];

function AssertionSection({
  assertion,
  editMode,
  theme,
  onChange,
  storedVariables = [],
  hasMethod
}) {
  const [isEnabled, setIsEnabled] = useState(!!assertion?.type);
  const [useVariable, setUseVariable] = useState(
    assertion?.value?.toString().includes('{{') || false
  );

  // Sync isEnabled with assertion
  useEffect(() => {
    setIsEnabled(!!assertion?.type);
  }, [assertion?.type]);

  const selectedType = ASSERTION_TYPES.find(t => t.value === assertion?.type);

  const handleToggle = (enabled) => {
    setIsEnabled(enabled);
    if (!enabled) {
      onChange(null);
    } else {
      onChange({ type: 'toBeVisible', value: undefined });
    }
  };

  const handleTypeChange = (type) => {
    const typeInfo = ASSERTION_TYPES.find(t => t.value === type);
    onChange({
      type,
      value: typeInfo?.needsValue ? (assertion?.value || '') : undefined
    });
  };

  const handleValueChange = (value) => {
    onChange({ ...assertion, value });
  };

  const color = theme.colors.accents.purple;

  if (!editMode && !assertion?.type) {
    return null;
  }

  return (
    <div 
      className="p-3 rounded space-y-3"
      style={{ 
        background: isEnabled ? `${color}10` : theme.colors.background.tertiary,
        border: `1px solid ${isEnabled ? `${color}40` : theme.colors.border}`
      }}
    >
      {/* Toggle header */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          {editMode && (
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => handleToggle(e.target.checked)}
              className="rounded"
              disabled={!hasMethod}
            />
          )}
          <span 
            className="text-xs font-semibold"
            style={{ color: isEnabled ? color : theme.colors.text.tertiary }}
          >
            🔍 Assert on result
          </span>
        </label>
        
        {!hasMethod && editMode && (
          <span className="text-[10px]" style={{ color: theme.colors.text.tertiary }}>
            Select a method first
          </span>
        )}
      </div>

      {/* Assertion config (when enabled) */}
      {isEnabled && (
        <div className="space-y-3">
          {/* Type selector */}
          {editMode ? (
            <div className="space-y-2">
              <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                Assertion Type
              </label>
              <select
                value={assertion?.type || 'toBeVisible'}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-1.5 rounded text-sm"
                style={{
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              >
                <optgroup label="👁 Visibility">
                  {ASSERTION_TYPES.filter(t => t.category === 'visibility').map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="📝 Text">
                  {ASSERTION_TYPES.filter(t => t.category === 'text').map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="= Value">
                  {ASSERTION_TYPES.filter(t => t.category === 'value').map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="✓ Boolean">
                  {ASSERTION_TYPES.filter(t => t.category === 'boolean').map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="# Numeric">
                  {ASSERTION_TYPES.filter(t => t.category === 'numeric').map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="? State">
                  {ASSERTION_TYPES.filter(t => t.category === 'state').map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>Type:</span>
              <span 
                className="px-2 py-1 rounded text-xs font-semibold"
                style={{ background: `${color}30`, color }}
              >
                {selectedType?.label || assertion?.type}
              </span>
            </div>
          )}

          {/* Value input (if needed) */}
          {selectedType?.needsValue && (
            <div className="space-y-2">
              <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                Expected Value
              </label>
              
              {editMode && (
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setUseVariable(false)}
                    className="flex-1 px-2 py-1 rounded text-xs font-semibold transition"
                    style={{
                      background: !useVariable ? color : theme.colors.background.secondary,
                      color: !useVariable ? 'white' : theme.colors.text.tertiary
                    }}
                  >
                    ✏️ Literal
                  </button>
                  <button
                    onClick={() => setUseVariable(true)}
                    className="flex-1 px-2 py-1 rounded text-xs font-semibold transition"
                    style={{
                      background: useVariable ? theme.colors.accents.yellow : theme.colors.background.secondary,
                      color: useVariable ? 'black' : theme.colors.text.tertiary
                    }}
                  >
                    {'{{ }} Variable'}
                  </button>
                </div>
              )}

              {editMode ? (
                useVariable ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'{{'}</span>
                      <input
                        type="text"
                        value={(assertion?.value || '').replace(/^\{\{|\}\}$/g, '')}
                        onChange={(e) => handleValueChange(`{{${e.target.value}}}`)}
                        placeholder="variableName"
                        className="flex-1 px-2 py-1.5 rounded text-sm font-mono"
                        style={{
                          background: theme.colors.background.primary,
                          border: `1px solid ${theme.colors.accents.yellow}`,
                          color: theme.colors.accents.yellow
                        }}
                      />
                      <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'}}'}</span>
                    </div>
                    
                    {storedVariables.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px]" style={{ color: theme.colors.text.tertiary }}>
                          Available:
                        </span>
                        {storedVariables.map(v => (
                          <button
                            key={v.name || v.path}
                            onClick={() => handleValueChange(`{{${v.path || v.name}}}`)}
                            className="px-1.5 py-0.5 rounded font-mono text-[10px] transition hover:brightness-110"
                            style={{ 
                              background: `${theme.colors.accents.yellow}30`,
                              color: theme.colors.accents.yellow
                            }}
                          >
                            {v.path || v.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={assertion?.value || ''}
                    onChange={(e) => handleValueChange(e.target.value)}
                    placeholder="Expected value..."
                    className="w-full px-2 py-1.5 rounded text-sm"
                    style={{
                      background: theme.colors.background.primary,
                      border: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  />
                )
              ) : (
                <div 
                  className="px-2 py-1.5 rounded text-sm font-mono"
                  style={{ 
                    background: theme.colors.background.primary,
                    border: `1px solid ${theme.colors.border}`,
                    color: String(assertion?.value).includes('{{') 
                      ? theme.colors.accents.yellow 
                      : theme.colors.text.primary
                  }}
                >
                  {assertion?.value || '—'}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ✅ NEW: ArgumentInput Component
// ═══════════════════════════════════════════════════════════

function ArgumentInput({
  param,
  value,
  onChange,
  onInsertVariable,
  editMode,
  theme,
  storedVariables = [],
  ctxDataSuggestions = []
}) {
  const [useVariable, setUseVariable] = useState(
    value.startsWith('ctx.') || value.includes('{{')
  );

  // Update useVariable when value changes externally
  useEffect(() => {
    setUseVariable(value.startsWith('ctx.') || value.includes('{{'));
  }, [value]);

  const handleModeChange = (isVarMode) => {
    setUseVariable(isVarMode);
    onChange(''); // Clear value when switching modes
  };

  return (
    <div 
      className="p-2 rounded space-y-2"
      style={{ background: theme.colors.background.secondary }}
    >
      {/* Parameter name & badges */}
      <div className="flex items-center gap-2">
        <span 
          className="font-mono text-sm font-bold"
          style={{ color: theme.colors.accents.cyan }}
        >
          {param.name}
        </span>
        {param.hasDefault && (
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ 
              background: `${theme.colors.accents.blue}20`,
              color: theme.colors.accents.blue
            }}
          >
            optional
          </span>
        )}
        {!param.hasDefault && (
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
            style={{ 
              background: `${theme.colors.accents.red}20`,
              color: theme.colors.accents.red
            }}
          >
            required
          </span>
        )}
      </div>

      {/* Default value hint */}
      {param.hasDefault && param.defaultValue !== undefined && (
        <div className="text-[10px]" style={{ color: theme.colors.text.tertiary }}>
          Default: <code className="px-1 rounded" style={{ background: theme.colors.background.tertiary }}>
            {JSON.stringify(param.defaultValue)}
          </code>
        </div>
      )}

      {editMode ? (
        <>
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => handleModeChange(false)}
              className="flex-1 px-2 py-1 rounded text-xs font-semibold transition"
              style={{
                background: !useVariable 
                  ? theme.colors.accents.cyan 
                  : theme.colors.background.tertiary,
                color: !useVariable 
                  ? 'white' 
                  : theme.colors.text.tertiary
              }}
            >
              ✏️ Custom Value
            </button>
            <button
              onClick={() => handleModeChange(true)}
              className="flex-1 px-2 py-1 rounded text-xs font-semibold transition"
              style={{
                background: useVariable 
                  ? theme.colors.accents.yellow 
                  : theme.colors.background.tertiary,
                color: useVariable 
                  ? 'black' 
                  : theme.colors.text.tertiary
              }}
            >
              📦 Variable
            </button>
          </div>

          {/* Input based on mode */}
          {useVariable ? (
            <div className="space-y-2">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="ctx.data.field or {{variableName}}"
                className="w-full px-2 py-1.5 rounded text-sm font-mono"
                style={{
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.accents.yellow}`,
                  color: theme.colors.accents.yellow
                }}
              />
              
              {/* Variable suggestions */}
              <div className="space-y-1">
                {/* Stored variables from previous steps */}
                {storedVariables.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px]" style={{ color: theme.colors.text.tertiary }}>
                      💾 Stored:
                    </span>
                    {storedVariables.map(v => (
                      <button
                        key={v.name || v.path}
                        onClick={() => onInsertVariable(`{{${v.path || v.name}}}`)}
                        className="px-1.5 py-0.5 rounded font-mono text-[10px] transition hover:brightness-110"
                        style={{ 
                          background: `${theme.colors.accents.yellow}30`,
                          color: theme.colors.accents.yellow
                        }}
                      >
                        {`{{${v.path || v.name}}}`}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Common ctx.data fields */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px]" style={{ color: theme.colors.text.tertiary }}>
                    📋 ctx.data:
                  </span>
                  {ctxDataSuggestions.map(field => (
                    <button
                      key={field}
                      onClick={() => onInsertVariable(field)}
                      className="px-1.5 py-0.5 rounded font-mono text-[10px] transition hover:brightness-110"
                      style={{ 
                        background: `${theme.colors.accents.blue}20`,
                        color: theme.colors.accents.blue
                      }}
                    >
                      {field}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={param.hasDefault ? `Leave empty for default` : `Enter ${param.name}...`}
              className="w-full px-2 py-1.5 rounded text-sm"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            />
          )}
        </>
      ) : (
        /* Read-only display */
        <div 
          className="px-2 py-1.5 rounded text-sm font-mono"
          style={{ 
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border}`,
            color: value 
              ? (value.startsWith('ctx.') || value.includes('{{') 
                  ? theme.colors.accents.yellow 
                  : theme.colors.text.primary)
              : theme.colors.text.tertiary
          }}
        >
          {value || (param.hasDefault ? `(default: ${param.defaultValue})` : '—')}
        </div>
      )}

      {/* Preview */}
      {editMode && value && (
        <div 
          className="text-[10px] p-1 rounded font-mono"
          style={{ background: theme.colors.background.tertiary, color: theme.colors.accents.green }}
        >
          → {value.startsWith('ctx.') || value.includes('{{') ? value : `"${value}"`}
        </div>
      )}
    </div>
  );
}