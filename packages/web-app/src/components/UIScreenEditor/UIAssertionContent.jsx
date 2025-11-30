// packages/web-app/src/components/UIScreenEditor/UIAssertionContent.jsx
// ✅ FIXED: Truthy/Falsy now use functions, not locators
//
// Features:
// - Field picker for visible/hidden from POM locators (getters)
// - Truthy/Falsy from POM functions (methods)
// - Text/Contains checks with template support
// - Custom assertions
// - Timeout configuration

import { useState, useEffect, useMemo } from 'react';
import { MultiSelectInput } from './AutocompleteInput';
import usePOMData from '../../hooks/usePOMData';
import { getVariableSuggestions, getTestDataSuggestions, getAllVariableSuggestions } from './variableUtils';

/**
 * UIAssertionContent - Enhanced with POM field picker
 */
export default function UIAssertionContent({ 
  block, 
  editMode, 
  theme, 
  onUpdate, 
  pomName,
  instanceName,
  projectPath,
  storedVariables = []
}) {
  const data = block.data || {};
  
  // Load POM data - now including getPOMFunctions!
  const { 
    poms, 
    loading: pomsLoading,
    getPOMLocators,
    getPOMFunctions  // ✅ Added
  } = usePOMData(projectPath);

  // State for locator options (for visible/hidden)
  const [locatorOptions, setLocatorOptions] = useState([]);
  const [loadingLocators, setLoadingLocators] = useState(false);
  
  // State for function options (for truthy/falsy/assertions)
  const [functionOptions, setFunctionOptions] = useState([]);

  // Load locators when POM changes
  useEffect(() => {
    const loadLocators = async () => {
      if (!pomName && !instanceName) {
        setLocatorOptions([]);
        return;
      }

      setLoadingLocators(true);
      try {
        const locators = await getPOMLocators(pomName, instanceName);
        setLocatorOptions(locators.map(loc => ({
          value: loc,
          label: loc
        })));
      } catch (err) {
        console.error('Failed to load locators:', err);
        setLocatorOptions([]);
      } finally {
        setLoadingLocators(false);
      }
    };

    loadLocators();
  }, [pomName, instanceName, getPOMLocators]);

  // ✅ Load functions when POM changes (for truthy/falsy/assertions)
  useEffect(() => {
    if (!pomName) {
      setFunctionOptions([]);
      return;
    }

    const functions = getPOMFunctions(pomName);
    setFunctionOptions(functions.map(fn => ({
      value: fn.name,
      label: fn.name,
      description: fn.signature,
      async: fn.async
    })));
  }, [pomName, getPOMFunctions]);

  // Update handlers
  const updateData = (key, value) => {
    onUpdate({
      data: { ...data, [key]: value }
    });
  };

  const updateChecks = (key, value) => {
    onUpdate({
      data: {
        ...data,
        checks: { ...(data.checks || {}), [key]: value }
      }
    });
  };

  // Calculate summary
  const summary = useMemo(() => {
    const visible = data.visible?.length || 0;
    const hidden = data.hidden?.length || 0;
    const textChecks = Object.keys(data.checks?.text || {}).length;
    const containsChecks = Object.keys(data.checks?.contains || {}).length;
    const truthy = data.truthy?.length || 0;
    const falsy = data.falsy?.length || 0;
    const assertions = data.assertions?.length || 0;
    
    return { visible, hidden, textChecks, containsChecks, truthy, falsy, assertions };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Visible/Hidden Fields Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Visible Fields - uses LOCATORS */}
        <div>
          <MultiSelectInput
            values={data.visible || []}
            onChange={(vals) => updateData('visible', vals)}
            options={locatorOptions}
            placeholder="Add visible fields..."
            disabled={!editMode}
            theme={theme}
            label={`👁 Visible (${summary.visible})`}
            color="green"
            loading={loadingLocators}
          />
        </div>

        {/* Hidden Fields - uses LOCATORS */}
        <div>
          <MultiSelectInput
            values={data.hidden || []}
            onChange={(vals) => updateData('hidden', vals)}
            options={locatorOptions}
            placeholder="Add hidden fields..."
            disabled={!editMode}
            theme={theme}
            label={`🚫 Hidden (${summary.hidden})`}
            color="red"
            loading={loadingLocators}
          />
        </div>
      </div>

      {/* Text Checks Section */}
      <TextChecksSection
        textChecks={data.checks?.text || {}}
        containsChecks={data.checks?.contains || {}}
        editMode={editMode}
        theme={theme}
        storedVariables={storedVariables}
        locatorOptions={locatorOptions}
        onTextChange={(val) => updateChecks('text', val)}
        onContainsChange={(val) => updateChecks('contains', val)}
      />

      {/* Truthy/Falsy Section - uses FUNCTIONS */}
      {(editMode || summary.truthy > 0 || summary.falsy > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <MultiSelectInput
              values={data.truthy || []}
              onChange={(vals) => updateData('truthy', vals)}
              options={functionOptions}  // ✅ Changed from locatorOptions
              placeholder="Functions returning true..."
              disabled={!editMode}
              theme={theme}
              label={`✓ Truthy (${summary.truthy})`}
              color="blue"
            />
          </div>
          <div>
            <MultiSelectInput
              values={data.falsy || []}
              onChange={(vals) => updateData('falsy', vals)}
              options={functionOptions}  // ✅ Changed from locatorOptions
              placeholder="Functions returning false..."
              disabled={!editMode}
              theme={theme}
              label={`✗ Falsy (${summary.falsy})`}
              color="orange"
            />
          </div>
        </div>
      )}

      {/* Assertions Section - uses FUNCTIONS */}
      {(editMode || summary.assertions > 0) && (
        <AssertionsSection
          assertions={data.assertions || []}
          editMode={editMode}
          theme={theme}
          functionOptions={functionOptions}  // ✅ Changed from locatorOptions
          locatorOptions={locatorOptions}    // ✅ Also pass locators for flexibility
          onChange={(vals) => updateData('assertions', vals)}
        />
      )}

      {/* Timeout */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold" style={{ color: theme.colors.text.tertiary }}>
          ⏱ Timeout
        </label>
        <input
          type="number"
          value={data.timeout || 30000}
          onChange={(e) => updateData('timeout', parseInt(e.target.value) || 30000)}
          disabled={!editMode}
          className="w-24 px-2 py-1 rounded text-sm"
          style={{
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary
          }}
        />
        <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>ms</span>
      </div>

      {/* Summary Bar */}
      <div 
        className="flex items-center gap-3 p-2 rounded text-xs flex-wrap"
        style={{ 
          background: theme.colors.background.tertiary,
          color: theme.colors.text.tertiary
        }}
      >
        <span>Summary:</span>
        {summary.visible > 0 && (
          <span style={{ color: theme.colors.accents.green }}>
            👁 {summary.visible} visible
          </span>
        )}
        {summary.hidden > 0 && (
          <span style={{ color: theme.colors.accents.red }}>
            🚫 {summary.hidden} hidden
          </span>
        )}
        {(summary.textChecks + summary.containsChecks) > 0 && (
          <span style={{ color: theme.colors.accents.yellow }}>
            📝 {summary.textChecks + summary.containsChecks} text checks
          </span>
        )}
        {(summary.truthy + summary.falsy) > 0 && (
          <span style={{ color: theme.colors.accents.blue }}>
            🔍 {summary.truthy + summary.falsy} boolean checks
          </span>
        )}
        {summary.assertions > 0 && (
          <span style={{ color: theme.colors.accents.purple }}>
            ⚡ {summary.assertions} assertions
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * TextChecksSection - Manages text and contains checks
 */
function TextChecksSection({ 
  textChecks, 
  containsChecks, 
  editMode, 
  theme, 
  storedVariables,
  locatorOptions,
  onTextChange, 
  onContainsChange 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState('contains');

  const allChecks = [
    ...Object.entries(textChecks).map(([k, v]) => ({ key: k, value: v, type: 'text' })),
    ...Object.entries(containsChecks).map(([k, v]) => ({ key: k, value: v, type: 'contains' }))
  ];

  const handleAdd = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    
    if (newType === 'text') {
      onTextChange({ ...textChecks, [newKey]: newValue });
    } else {
      onContainsChange({ ...containsChecks, [newKey]: newValue });
    }
    
    setNewKey('');
    setNewValue('');
    setIsAdding(false);
  };

  const handleRemove = (key, type) => {
    if (type === 'text') {
      const updated = { ...textChecks };
      delete updated[key];
      onTextChange(updated);
    } else {
      const updated = { ...containsChecks };
      delete updated[key];
      onContainsChange(updated);
    }
  };

  // Helper to render template values
  const renderValue = (text) => {
    if (typeof text !== 'string') return String(text);
    const hasTemplate = /\{\{([^}]+)\}\}/.test(text);
    if (hasTemplate) {
      return text.split(/(\{\{[^}]+\}\})/).map((part, i) => {
        if (part.match(/^\{\{[^}]+\}\}$/)) {
          return (
            <span 
              key={i} 
              className="px-1 py-0.5 rounded mx-0.5" 
              style={{ 
                background: `${theme.colors.accents.purple}30`, 
                color: theme.colors.accents.purple 
              }}
            >
              {part}
            </span>
          );
        }
        return part;
      });
    }
    return `"${text}"`;
  };

  const color = theme.colors.accents.yellow;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color }}>
          📝 Text Checks ({allChecks.length})
        </span>
        {editMode && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs px-2 py-1 rounded transition hover:brightness-110"
            style={{ background: `${color}30`, color }}
          >
            + Add Check
          </button>
        )}
      </div>

      {/* Existing Checks */}
      {allChecks.length > 0 && (
        <div className="space-y-1 mb-2">
          {allChecks.map(({ key, value, type }) => (
            <div 
              key={`${type}-${key}`}
              className="flex items-center gap-2 p-2 rounded text-sm"
              style={{ background: `${color}10` }}
            >
              <span className="font-mono" style={{ color }}>{key}</span>
              <span 
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ 
                  background: type === 'text' 
                    ? theme.colors.accents.blue 
                    : theme.colors.accents.purple,
                  color: 'white'
                }}
              >
                {type === 'text' ? 'equals' : 'contains'}
              </span>
              <span 
                className="flex-1 truncate" 
                style={{ color: theme.colors.text.secondary }}
              >
                {renderValue(value)}
              </span>
              {editMode && (
                <button 
                  onClick={() => handleRemove(key, type)}
                  className="text-red-400 hover:text-red-300 transition"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Check Form */}
      {isAdding && (
        <div 
          className="p-3 rounded space-y-2"
          style={{ 
            background: theme.colors.background.tertiary,
            border: `1px solid ${color}40`
          }}
        >
          <div className="flex gap-2">
            {/* Field selector OR type custom */}
            <div className="flex-1">
              <select
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full px-2 py-1.5 rounded text-sm"
                style={{
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              >
                <option value="">Select field or type below...</option>
                {locatorOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="or type field name"
              className="flex-1 px-2 py-1.5 rounded text-sm font-mono"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            />
          </div>

          <div className="flex gap-2">
            {/* Check type */}
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-32 px-2 py-1.5 rounded text-sm"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            >
              <option value="contains">contains</option>
              <option value="text">equals</option>
            </select>

            {/* Value */}
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder='Expected value or {{variable}}'
              className="flex-1 px-2 py-1.5 rounded text-sm"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            />
          </div>

          {/* Variable suggestions - from previous blocks' storeAs */}
          {storedVariables && storedVariables.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                💾 Available variables:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {storedVariables.map(v => (
                  <div key={v.name} className="flex items-center gap-1">
                    {/* Main variable */}
                    <button
                      onClick={() => setNewValue(`{{${v.name}}}`)}
                      className="px-1.5 py-0.5 rounded font-mono text-xs transition hover:brightness-110"
                      style={{ 
                        background: `${theme.colors.accents.yellow}30`,
                        color: theme.colors.accents.yellow
                      }}
                      title={`From: ${v.source}`}
                    >
                      {`{{${v.name}}}`}
                    </button>
                    {/* Nested keys if available */}
                    {v.nested && v.nested.length > 0 && v.nested.map(nested => (
                      <button
                        key={nested.name}
                        onClick={() => setNewValue(`{{${nested.name}}}`)}
                        className="px-1.5 py-0.5 rounded font-mono text-xs transition hover:brightness-110"
                        style={{ 
                          background: `${theme.colors.accents.purple}30`,
                          color: theme.colors.accents.purple
                        }}
                        title={`${nested.key} from ${v.source}`}
                      >
                        {`{{${nested.name}}}`}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          
      {/* TestData suggestions */}
<div className="space-y-1">
  <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
    📋 Test data:
  </span>
  <div className="flex items-center gap-1 flex-wrap">
    {['agencyName', 'flightType', 'locations', 'noOfPax', 'lang', 'device'].map(field => (
      <button
        key={field}
        onClick={() => setNewValue(`{{ctx.data.${field}}}`)}
        className="px-1.5 py-0.5 rounded font-mono text-xs transition hover:brightness-110"
        style={{ 
          background: `${theme.colors.accents.blue}30`,
          color: theme.colors.accents.blue
        }}
      >
        {`{{ctx.data.${field}}}`}
      </button>
    ))}
  </div>
</div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setIsAdding(false); setNewKey(''); setNewValue(''); }}
              className="px-3 py-1 rounded text-sm"
              style={{ color: theme.colors.text.tertiary }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newKey.trim() || !newValue.trim()}
              className="px-3 py-1 rounded text-sm font-semibold transition"
              style={{ 
                background: color,
                color: 'black',
                opacity: (!newKey.trim() || !newValue.trim()) ? 0.5 : 1
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AssertionsSection - Manages custom assertions
 * ✅ FIXED: Now receives both functionOptions AND locatorOptions
 */
function AssertionsSection({ 
  assertions, 
  editMode, 
  theme, 
  functionOptions = [],  // ✅ For function selection
  locatorOptions = [],   // ✅ For property/getter selection
  onChange 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newFn, setNewFn] = useState('');
  const [newExpect, setNewExpect] = useState('toBe');
  const [newValue, setNewValue] = useState('');

  // ✅ Combined options: functions + locators
  const allOptions = useMemo(() => {
    const combined = [
      ...functionOptions.map(f => ({ ...f, category: 'function' })),
      ...locatorOptions.map(l => ({ ...l, category: 'getter' }))
    ];
    // Dedupe by value
    const seen = new Set();
    return combined.filter(opt => {
      if (seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });
  }, [functionOptions, locatorOptions]);

  const handleAdd = () => {
    if (!newFn.trim()) return;
    
    const newAssertion = {
      fn: newFn,
      expect: newExpect,
      ...(newValue && !['toBeTruthy', 'toBeFalsy', 'toBeVisible', 'toBeHidden', 'toBeDefined', 'toBeUndefined', 'toBeNull'].includes(newExpect) && { value: isNaN(newValue) ? newValue : Number(newValue) })
    };
    
    onChange([...assertions, newAssertion]);
    setNewFn('');
    setNewExpect('toBe');
    setNewValue('');
    setIsAdding(false);
  };

  const handleRemove = (idx) => {
    onChange(assertions.filter((_, i) => i !== idx));
  };

  const color = theme.colors.accents.purple;
  
  // Expectations that don't need a value
  const noValueExpectations = ['toBeTruthy', 'toBeFalsy', 'toBeVisible', 'toBeHidden', 'toBeDefined', 'toBeUndefined', 'toBeNull'];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color }}>
          ⚡ Assertions ({assertions.length})
        </span>
        {editMode && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs px-2 py-1 rounded transition hover:brightness-110"
            style={{ background: `${color}30`, color }}
          >
            + Add Assertion
          </button>
        )}
      </div>

      {/* Existing Assertions */}
      {assertions.length > 0 && (
        <div className="space-y-1 mb-2">
          {assertions.map((assertion, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-2 p-2 rounded text-sm font-mono"
              style={{ background: `${color}10` }}
            >
              <span style={{ color: theme.colors.text.tertiary }}>expect(</span>
              <span style={{ color }}>{assertion.fn}()</span>
              <span style={{ color: theme.colors.text.tertiary }}>).</span>
              <span style={{ color: theme.colors.accents.blue }}>{assertion.expect}</span>
              <span style={{ color: theme.colors.text.tertiary }}>(</span>
              {assertion.value !== undefined && (
                <span style={{ color: theme.colors.accents.green }}>
                  {typeof assertion.value === 'string' ? `"${assertion.value}"` : String(assertion.value)}
                </span>
              )}
              <span style={{ color: theme.colors.text.tertiary }}>)</span>
              
              {editMode && (
                <button 
                  onClick={() => handleRemove(idx)}
                  className="ml-auto text-red-400 hover:text-red-300 transition"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Assertion Form */}
      {isAdding && (
        <div 
          className="p-3 rounded space-y-2"
          style={{ 
            background: theme.colors.background.tertiary,
            border: `1px solid ${color}40`
          }}
        >
          <div className="flex gap-2">
            {/* Function selector */}
            <select
              value={newFn}
              onChange={(e) => setNewFn(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded text-sm"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            >
              <option value="">Select function...</option>
              {functionOptions.length > 0 && (
                <optgroup label="Functions">
                  {functionOptions.map(opt => (
                    <option key={`fn-${opt.value}`} value={opt.value}>
                      {opt.label}{opt.async ? ' (async)' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {locatorOptions.length > 0 && (
                <optgroup label="Getters">
                  {locatorOptions.map(opt => (
                    <option key={`get-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* Or type custom */}
            <input
              type="text"
              value={newFn}
              onChange={(e) => setNewFn(e.target.value)}
              placeholder="or type function name"
              className="w-40 px-2 py-1.5 rounded text-sm font-mono"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            />
          </div>

          <div className="flex gap-2">
            {/* Expectation */}
            <select
              value={newExpect}
              onChange={(e) => setNewExpect(e.target.value)}
              className="w-44 px-2 py-1.5 rounded text-sm"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            >
              <optgroup label="Value Matchers">
                <option value="toBe">toBe</option>
                <option value="toEqual">toEqual</option>
                <option value="toContain">toContain</option>
                <option value="toMatch">toMatch</option>
              </optgroup>
              <optgroup label="Number Matchers">
                <option value="toBeGreaterThan">toBeGreaterThan</option>
                <option value="toBeLessThan">toBeLessThan</option>
                <option value="toBeGreaterThanOrEqual">toBeGreaterThanOrEqual</option>
                <option value="toBeLessThanOrEqual">toBeLessThanOrEqual</option>
              </optgroup>
              <optgroup label="Boolean Matchers">
                <option value="toBeTruthy">toBeTruthy</option>
                <option value="toBeFalsy">toBeFalsy</option>
              </optgroup>
              <optgroup label="State Matchers">
                <option value="toBeDefined">toBeDefined</option>
                <option value="toBeUndefined">toBeUndefined</option>
                <option value="toBeNull">toBeNull</option>
              </optgroup>
              <optgroup label="Visibility">
                <option value="toBeVisible">toBeVisible</option>
                <option value="toBeHidden">toBeHidden</option>
              </optgroup>
            </select>

            {/* Value (only for expectations that need it) */}
            {!noValueExpectations.includes(newExpect) && (
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Expected value"
                className="flex-1 px-2 py-1.5 rounded text-sm"
                style={{
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              />
            )}
          </div>

          {/* Preview */}
          <div 
            className="p-2 rounded text-xs font-mono"
            style={{ background: theme.colors.background.primary }}
          >
            <span style={{ color: theme.colors.text.tertiary }}>expect(</span>
            <span style={{ color }}>{newFn || 'fn'}()</span>
            <span style={{ color: theme.colors.text.tertiary }}>).</span>
            <span style={{ color: theme.colors.accents.blue }}>{newExpect}</span>
            <span style={{ color: theme.colors.text.tertiary }}>(</span>
            {newValue && !noValueExpectations.includes(newExpect) && (
              <span style={{ color: theme.colors.accents.green }}>
                {isNaN(newValue) ? `"${newValue}"` : newValue}
              </span>
            )}
            <span style={{ color: theme.colors.text.tertiary }}>)</span>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setIsAdding(false); setNewFn(''); setNewValue(''); }}
              className="px-3 py-1 rounded text-sm"
              style={{ color: theme.colors.text.tertiary }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newFn.trim()}
              className="px-3 py-1 rounded text-sm font-semibold transition"
              style={{ 
                background: color,
                color: 'white',
                opacity: !newFn.trim() ? 0.5 : 1
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}