// packages/web-app/src/components/UIScreenEditor/UIAssertionContent.jsx
// ✅ ENHANCED: AssertionsSection now supports function arguments AND index modes for methods
//
// Features:
// - Visible/Hidden: Index selector (first, last, all, any, nth)
// - Text/Contains checks: Index selector for field
// - Truthy/Falsy: Index selector (for array-returning functions)
// - Custom assertions: Index selector for function/locator
// - ✅ NEW: Function arguments support with variable suggestions
// - ✅ NEW: Type field (locator vs method) for assertions
// - ✅ NEW: Index mode for methods with index params (title(nth) with [all])
// - Timeout configuration

import { useState, useEffect, useMemo, useRef } from 'react';
import usePOMData from '../../hooks/usePOMData';

// ═══════════════════════════════════════════════════════════
// INDEX OPTIONS & HELPERS
// ═══════════════════════════════════════════════════════════
const INDEX_OPTIONS = [
  { value: '', label: '(none)', description: 'Single element' },
  { value: 'first', label: 'first', description: 'First element [0]' },
  { value: 'last', label: 'last', description: 'Last element' },
  { value: 'any', label: 'any', description: 'At least one must match' },
  { value: 'all', label: 'all', description: 'All elements must match' },
  { value: 'custom', label: 'nth...', description: 'Specific index number' },
  { value: 'variable', label: '{{var}}', description: 'Use a variable' },  // ✅ ADD THIS
];

// ✅ NEW: Check if parameter name is an index-type parameter
const isIndexParameter = (paramName) => {
  if (!paramName) return false;
  const indexPatterns = /^(nth|index|idx|i|n|num|number|position|pos)$/i;
  return indexPatterns.test(paramName);
};

// ✅ NEW: Check if a function takes an index parameter as first arg
const hasIndexParameter = (funcInfo) => {
  if (!funcInfo?.parameters?.length) return false;
  const firstParam = funcInfo.parameters[0];
  return isIndexParameter(firstParam.name);
};

// ✅ NEW: Get the index parameter name from a function
const getIndexParamName = (funcInfo) => {
  if (!funcInfo?.parameters?.length) return null;
  const firstParam = funcInfo.parameters[0];
  if (isIndexParameter(firstParam.name)) {
    return firstParam.name;
  }
  return null;
};

/**
 * Parse field name to extract index notation
 * "element[all]" → { field: "element", indexType: "all", customIndex: "" }
 */
const parseFieldWithIndex = (fieldStr) => {
  if (!fieldStr) return { field: '', indexType: '', customIndex: '' };
  
  // Check for variable pattern: field[{{varName}}]
  const varMatch = fieldStr.match(/^(.+)\[\{\{([^}]+)\}\}\]$/);
  if (varMatch) {
    return { field: varMatch[1], indexType: 'variable', customIndex: varMatch[2] };
  }
  
  const match = fieldStr.match(/^(.+)\[(\d+|first|last|all|any)\]$/);
  if (!match) {
    return { field: fieldStr, indexType: '', customIndex: '' };
  }
  
  const idx = match[2];
  if (idx === '0') {
    return { field: match[1], indexType: 'first', customIndex: '' };
  } else if (idx === 'first') {
    return { field: match[1], indexType: 'first', customIndex: '' };
  } else if (['last', 'all', 'any'].includes(idx)) {
    return { field: match[1], indexType: idx, customIndex: '' };
  } else {
    return { field: match[1], indexType: 'custom', customIndex: idx };
  }
};

/**
 * Build field string with index notation
 */
const buildFieldWithIndex = (field, indexType, customIndex) => {
  if (!field) return '';
  if (!indexType || indexType === '') return field;
  if (indexType === 'first') return `${field}[first]`;
  if (indexType === 'variable') return `${field}[{{${customIndex}}}]`;  // ✅ ADD THIS
  if (indexType === 'custom') return `${field}[${customIndex || '0'}]`;
  return `${field}[${indexType}]`;
};

/**
 * Get display label for index
 */
const getIndexLabel = (indexType, customIndex) => {
  if (!indexType) return null;
  if (indexType === 'first') return '[first]';
  if (indexType === 'variable') return `[{{${customIndex}}}]`;  // ✅ ADD THIS
  if (indexType === 'custom') return `[${customIndex}]`;
  return `[${indexType}]`;
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function UIAssertionContent({ 
  block, 
  editMode, 
  theme, 
  onUpdate, 
  pomName,
  pomPath,      // ✅ Is this being passed?
  instanceName,
  projectPath,
  platform,
  storedVariables = []
}) {
  // ✅ ADD THIS DEBUG
  console.log('🔍 UIAssertionContent props:', {
    pomName,
    pomPath,
    instanceName,
    platform
  });
  const data = block.data || {};
  
  // Load POM data
  const { 
    poms, 
    loading: pomsLoading,
    getPOMLocators,
    getPOMLocatorsSync,
    getPOMFunctions
  } = usePOMData(projectPath);

  // State for locator options (for visible/hidden/text checks)
  const [locatorOptions, setLocatorOptions] = useState([]);
  const [loadingLocators, setLoadingLocators] = useState(false);
  
  // State for function options (for truthy/falsy/assertions)
  const [functionOptions, setFunctionOptions] = useState([]);

  // ✅ NEW: State for typed options (with type: 'locator' | 'method')
  const [typedLocatorOptions, setTypedLocatorOptions] = useState([]);

  // Load locators when POM changes
useEffect(() => {
  const loadLocators = async () => {
    if (!pomName || !projectPath) {
      setLocatorOptions([]);
      setTypedLocatorOptions([]);
      return;
    }

    setLoadingLocators(true);
    try {
      // ✅ FIX: Remove API_URL - use relative URL
      let url = `/api/poms/${encodeURIComponent(pomName)}?projectPath=${encodeURIComponent(projectPath)}`;
      
      if (platform) {
        url += `&platform=${encodeURIComponent(platform)}`;
      }
      
      if (pomPath) {
        url += `&pomPath=${encodeURIComponent(pomPath)}`;
      }
      
      console.log('🌐 Fetching POM:', url);
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        console.log('📦 API Response:', data);
        console.log('📦 instancePaths keys:', Object.keys(data.instancePaths || {}));
        console.log('📦 Looking for instanceName:', instanceName);
        
        // ✅ FIX: Use instanceName to get correct locators
        let locatorNames = [];
        
        if (data.instancePaths) {
          if (instanceName && data.instancePaths[instanceName]) {
            // Use specific instance's locators
            locatorNames = data.instancePaths[instanceName];
            console.log(`📍 Using locators from instance "${instanceName}":`, locatorNames.length);
          } else if (data.instancePaths['default']) {
            // Fallback to default
            locatorNames = data.instancePaths['default'];
            console.log(`📍 Using default locators:`, locatorNames.length);
          } else {
            // Last resort: merge all
            locatorNames = Object.values(data.instancePaths).flat();
            console.log(`📍 Using all locators (merged):`, locatorNames.length);
          }
        }

        // Build options
        const options = locatorNames.map(name => ({
          value: name,
          label: name,
          raw: name
        }));

        setLocatorOptions(options);
        setTypedLocatorOptions(options);
        console.log(`✅ Loaded ${options.length} locators for ${pomName} (instance: ${instanceName || 'default'})`);
      } else {
        console.error('Failed to fetch POM:', response.status);
        setLocatorOptions([]);
        setTypedLocatorOptions([]);
      }
    } catch (error) {
      console.error('Error fetching locators:', error);
      setLocatorOptions([]);
      setTypedLocatorOptions([]);
    } finally {
      setLoadingLocators(false);
    }
  };

  loadLocators();
}, [pomName, instanceName, projectPath, platform, pomPath]);

  // Load functions when POM changes
  useEffect(() => {
    if (!pomName) {
      setFunctionOptions([]);
      return;
    }

    const functions = getPOMFunctions(pomName);
    setFunctionOptions(functions.map(fn => ({
      value: fn.name,
      label: fn.name,
      type: 'method',
      description: fn.signature,
      async: fn.async,
      parameters: fn.parameters || [],
      paramNames: fn.paramNames || [],
      returns: fn.returns,
      // ✅ NEW: Flag if this method has an index parameter
      hasIndexParam: hasIndexParameter(fn),
      indexParamName: getIndexParamName(fn)
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
    {/* Visible Fields */}
<MultiSelectWithIndex
  values={data.visible || []}
  onChange={(vals) => updateData('visible', vals)}
  options={locatorOptions}
  placeholder="Add visible fields..."
  disabled={!editMode}
  theme={theme}
  label={`👁 Visible (${summary.visible})`}
  color="green"
  loading={loadingLocators}
  storedVariables={storedVariables}  // ✅ ADD THIS
/>

{/* Hidden Fields */}
<MultiSelectWithIndex
  values={data.hidden || []}
  onChange={(vals) => updateData('hidden', vals)}
  options={locatorOptions}
  placeholder="Add hidden fields..."
  disabled={!editMode}
  theme={theme}
  label={`🚫 Hidden (${summary.hidden})`}
  color="red"
  loading={loadingLocators}
  storedVariables={storedVariables}  // ✅ ADD THIS
/>
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

      {/* Truthy/Falsy Section */}
      {(editMode || summary.truthy > 0 || summary.falsy > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <MultiSelectWithIndex
            values={data.truthy || []}
            onChange={(vals) => updateData('truthy', vals)}
            options={functionOptions}
            placeholder="Functions returning true..."
            disabled={!editMode}
            theme={theme}
            label={`✓ Truthy (${summary.truthy})`}
            color="blue"
            storedVariables={storedVariables}  
          />
          <MultiSelectWithIndex
            values={data.falsy || []}
            onChange={(vals) => updateData('falsy', vals)}
            options={functionOptions}
            placeholder="Functions returning false..."
            disabled={!editMode}
            theme={theme}
            label={`✗ Falsy (${summary.falsy})`}
            color="orange"
            storedVariables={storedVariables}  
          />
        </div>
      )}

      {/* Assertions Section - ✅ NOW WITH TYPE AND INDEX MODE SUPPORT */}
      {(editMode || summary.assertions > 0) && (
        <AssertionsSection
          assertions={data.assertions || []}
          editMode={editMode}
          theme={theme}
          functionOptions={functionOptions}
          locatorOptions={typedLocatorOptions}
          storedVariables={storedVariables}
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

// ═══════════════════════════════════════════════════════════
// MULTI-SELECT WITH INDEX SELECTOR
// Used for: visible, hidden, truthy, falsy
// ═══════════════════════════════════════════════════════════

function MultiSelectWithIndex({
  values = [],
  onChange,
  options = [],
  placeholder = 'Add fields...',
  disabled = false,
  theme,
  label,
  color = 'blue',
  loading = false,
  storedVariables = []  // ✅ ADD THIS
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingItem, setPendingItem] = useState(null);

  const accentColor = theme.colors.accents[color] || theme.colors.accents.blue;

  // Parse all values to extract index info
  const parsedValues = useMemo(() => {
    return values.map(val => ({
      raw: val,
      ...parseFieldWithIndex(val)
    }));
  }, [values]);

  // Filter options (exclude already selected base fields)
  const filteredOptions = useMemo(() => {
    const selectedBaseFields = parsedValues.map(pv => pv.field);
    const available = options.filter(opt => !selectedBaseFields.includes(opt.value));
    if (!query) return available;
    const q = query.toLowerCase();
    return available.filter(opt => 
      opt.label?.toLowerCase().includes(q) ||
      opt.value?.toLowerCase().includes(q)
    );
  }, [options, parsedValues, query]);

  // Add value with index
  const handleAdd = (baseValue, indexType = '', customIndex = '') => {
    const finalValue = buildFieldWithIndex(baseValue, indexType, customIndex);
    const newValues = values.filter(v => {
      const parsed = parseFieldWithIndex(v);
      return parsed.field !== baseValue;
    });
    onChange([...newValues, finalValue]);
    setQuery('');
    setIsOpen(false);
    setPendingItem(null);
  };

  // Remove value
  const handleRemove = (value) => {
    onChange(values.filter(v => v !== value));
  };

  // Update index for existing value
  const handleUpdateIndex = (oldValue, newIndexType, newCustomIndex) => {
    const parsed = parseFieldWithIndex(oldValue);
    const newValue = buildFieldWithIndex(parsed.field, newIndexType, newCustomIndex);
    onChange(values.map(v => v === oldValue ? newValue : v));
    setPendingItem(null);
  };

  // Handle typing custom value
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      setPendingItem({ value: query.trim(), indexType: '', customIndex: '', isEdit: false });
    } else if (e.key === 'Backspace' && !query && values.length > 0) {
      handleRemove(values[values.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setPendingItem(null);
    }
  };

  return (
    <div className="relative">
      {/* Label */}
      {label && (
        <label 
          className="text-xs font-semibold mb-1 block" 
          style={{ color: accentColor }}
        >
          {label}
        </label>
      )}

      {/* Tags Container */}
      <div
        onClick={() => !disabled && setIsOpen(true)}
        className="min-h-[36px] px-2 py-1.5 rounded flex flex-wrap gap-1 items-center cursor-text"
        style={{
          background: theme.colors.background.primary,
          border: `1px solid ${isOpen ? accentColor : theme.colors.border}`
        }}
      >
        {/* Selected Tags with Index Badges */}
        {parsedValues.map((pv) => (
          <span
            key={pv.raw}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono"
            style={{ 
              background: `${accentColor}20`,
              color: accentColor
            }}
          >
            <span>{pv.field}</span>
            
            {pv.indexType ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) {
                    setPendingItem({ 
                      value: pv.raw, 
                      indexType: pv.indexType, 
                      customIndex: pv.customIndex,
                      isEdit: true 
                    });
                  }
                }}
                className="px-1 py-0.5 rounded text-[10px] font-bold hover:brightness-125 transition"
                style={{ 
                  background: accentColor,
                  color: theme.colors.background.primary
                }}
                title="Click to change index"
              >
                {getIndexLabel(pv.indexType, pv.customIndex)}
              </button>
            ) : !disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingItem({ 
                    value: pv.raw, 
                    indexType: '', 
                    customIndex: '',
                    isEdit: true 
                  });
                }}
                className="px-1 py-0.5 rounded text-[10px] opacity-50 hover:opacity-100 transition"
                style={{ 
                  background: `${accentColor}50`,
                  color: theme.colors.background.primary
                }}
                title="Add index"
              >
                [?]
              </button>
            )}
            
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(pv.raw);
                }}
                className="hover:text-red-400 transition opacity-60 hover:opacity-100"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setPendingItem(null);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent text-sm font-mono outline-none"
          style={{ color: theme.colors.text.primary }}
        />

        {loading && (
          <span className="animate-spin" style={{ color: theme.colors.text.tertiary }}>⟳</span>
        )}
      </div>

{/* Index Selector Popup */}
{pendingItem && (
  <IndexSelectorPopup
    item={pendingItem}
    theme={theme}
    accentColor={accentColor}
    storedVariables={storedVariables}  // ✅ ADD THIS
    onSelect={(indexType, customIndex) => {

            const baseField = parseFieldWithIndex(pendingItem.value).field;
            if (pendingItem.isEdit) {
              handleUpdateIndex(pendingItem.value, indexType, customIndex);
            } else {
              handleAdd(baseField, indexType, customIndex);
            }
          }}
          onCancel={() => setPendingItem(null)}
        />
      )}

      {/* Dropdown */}
      {isOpen && !disabled && !pendingItem && filteredOptions.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto"
          style={{
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border}`
          }}
        >
          {filteredOptions.map((option) => (
            <div
              key={option.value}
              onClick={() => setPendingItem({ value: option.value, indexType: '', customIndex: '', isEdit: false })}
              className="px-3 py-2 cursor-pointer transition hover:bg-white/5"
            >
              <span 
                className="text-sm font-mono"
                style={{ color: theme.colors.text.primary }}
              >
                {option.label || option.value}
              </span>
              {option.async && (
                <span 
                  className="ml-2 text-xs px-1 rounded"
                  style={{ background: `${theme.colors.accents.purple}30`, color: theme.colors.accents.purple }}
                >
                  async
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// INDEX SELECTOR POPUP
// ═══════════════════════════════════════════════════════════

function IndexSelectorPopup({ item, theme, accentColor, onSelect, onCancel, storedVariables = [] }) {
  const [indexType, setIndexType] = useState(item.indexType || '');
  const [customIndex, setCustomIndex] = useState(item.customIndex || '');
  
  const baseField = parseFieldWithIndex(item.value).field;

  const handleSelect = (type) => {
    if (type === 'custom' || type === 'variable') {
      setIndexType(type);
      setCustomIndex('');
    } else {
      onSelect(type, '');
    }
  };

  const handleApply = () => {
    if (indexType === 'variable' && customIndex) {
      // Pass variable without {{ }} - buildFieldWithIndex will add them
      onSelect('variable', customIndex);
    } else if (indexType === 'custom' && customIndex) {
      onSelect('custom', customIndex);
    }
  };

  return (
    <div
      className="absolute z-50 mt-1 p-3 rounded-lg shadow-xl"
      style={{
        background: theme.colors.background.secondary,
        border: `1px solid ${accentColor}`,
        minWidth: '280px'
      }}
    >
      <div className="text-xs font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
        {item.isEdit ? 'Change' : 'Select'} index for: 
        <span className="font-mono ml-1" style={{ color: accentColor }}>{baseField}</span>
      </div>
      
      {/* Index type buttons */}
      <div className="flex flex-wrap gap-1 mb-2">
        {INDEX_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className="px-2 py-1 rounded text-xs font-semibold transition"
            style={{ 
              background: indexType === opt.value ? accentColor : `${accentColor}30`,
              color: indexType === opt.value ? theme.colors.background.primary : accentColor
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      
      {/* Custom number input */}
      {indexType === 'custom' && (
        <div className="flex gap-2 mb-2">
          <input
            type="number"
            min="0"
            value={customIndex}
            onChange={(e) => setCustomIndex(e.target.value)}
            placeholder="Index (0, 1, 2...)"
            className="flex-1 px-2 py-1 rounded text-sm"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text.primary
            }}
            autoFocus
          />
          <button
            onClick={handleApply}
            disabled={!customIndex}
            className="px-3 py-1 rounded text-sm font-semibold disabled:opacity-50"
            style={{ background: accentColor, color: theme.colors.background.primary }}
          >
            Apply
          </button>
        </div>
      )}
      
      {/* Variable selector */}
      {indexType === 'variable' && (
        <div className="space-y-2 mb-2">
          <select
            value={customIndex}
            onChange={(e) => setCustomIndex(e.target.value)}
            className="w-full px-2 py-1 rounded text-sm font-mono"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.accents.purple}`,
              color: theme.colors.accents.purple
            }}
            autoFocus
          >
            <option value="">Select variable...</option>
            {storedVariables.map((v, i) => (
              <option key={i} value={v.path || v.name}>
                {v.path || v.name}
              </option>
            ))}
          </select>
          
          {/* Or type custom variable */}
          <input
            type="text"
            value={customIndex}
            onChange={(e) => setCustomIndex(e.target.value)}
            placeholder="Or type: fieldName (e.g., cardIndex)"
            className="w-full px-2 py-1 rounded text-sm font-mono"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.accents.purple
            }}
          />
          
          <button
            onClick={handleApply}
            disabled={!customIndex}
            className="w-full px-3 py-1 rounded text-sm font-semibold disabled:opacity-50"
            style={{ background: accentColor, color: theme.colors.background.primary }}
          >
            Apply
          </button>
        </div>
      )}
      
      {/* Result preview */}
      <div 
        className="p-2 rounded text-xs font-mono mb-2"
        style={{ background: theme.colors.background.primary, color: theme.colors.text.secondary }}
      >
        Result: <span style={{ color: accentColor }}>
          {indexType === 'variable' && customIndex 
            ? `${baseField}[{{${customIndex}}}]`
            : buildFieldWithIndex(baseField, indexType, customIndex) || baseField
          }
        </span>
      </div>
      
      <button
        onClick={onCancel}
        className="text-xs w-full py-1 rounded transition hover:bg-white/10"
        style={{ color: theme.colors.text.tertiary }}
      >
        Cancel
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TEXT CHECKS SECTION
// ═══════════════════════════════════════════════════════════

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
  const [newIndexType, setNewIndexType] = useState('');
  const [newCustomIndex, setNewCustomIndex] = useState('');

  const allChecks = useMemo(() => [
    ...Object.entries(textChecks).map(([k, v]) => ({ 
      key: k, value: v, type: 'text', ...parseFieldWithIndex(k)
    })),
    ...Object.entries(containsChecks).map(([k, v]) => ({ 
      key: k, value: v, type: 'contains', ...parseFieldWithIndex(k)
    }))
  ], [textChecks, containsChecks]);

  const handleAdd = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    
    const finalKey = buildFieldWithIndex(newKey.trim(), newIndexType, newCustomIndex);
    
    if (newType === 'text') {
      onTextChange({ ...textChecks, [finalKey]: newValue });
    } else {
      onContainsChange({ ...containsChecks, [finalKey]: newValue });
    }
    
    resetForm();
  };

  const resetForm = () => {
    setNewKey('');
    setNewValue('');
    setNewIndexType('');
    setNewCustomIndex('');
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

      {allChecks.length > 0 && (
        <div className="space-y-1 mb-2">
          {allChecks.map(({ key, value, type, field, indexType, customIndex }) => (
            <div 
              key={`${type}-${key}`}
              className="flex items-center gap-2 p-2 rounded text-sm"
              style={{ background: `${color}10` }}
            >
              <span className="font-mono" style={{ color }}>{field}</span>
              
              {indexType && (
                <span 
                  className="px-1 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: color, color: theme.colors.background.primary }}
                >
                  {getIndexLabel(indexType, customIndex)}
                </span>
              )}
              
              <span 
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ 
                  background: type === 'text' ? theme.colors.accents.blue : theme.colors.accents.purple,
                  color: 'white'
                }}
              >
                {type === 'text' ? 'equals' : 'contains'}
              </span>
              
              <span className="flex-1 truncate" style={{ color: theme.colors.text.secondary }}>
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

      {isAdding && (
        <div 
          className="p-3 rounded space-y-3"
          style={{ background: theme.colors.background.tertiary, border: `1px solid ${color}40` }}
        >
          <div className="flex gap-2">
            <select
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded text-sm"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            >
              <option value="">Select field...</option>
              {locatorOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="or type field"
              className="flex-1 px-2 py-1.5 rounded text-sm font-mono"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: theme.colors.text.tertiary }}>
              Array Index (optional)
            </label>
            <div className="flex gap-1 flex-wrap items-center">
              {INDEX_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setNewIndexType(opt.value);
                    if (opt.value !== 'custom') setNewCustomIndex('');
                  }}
                  className="px-2 py-1 rounded text-xs font-semibold transition"
                  style={{ 
                    background: newIndexType === opt.value ? color : `${color}30`,
                    color: newIndexType === opt.value ? theme.colors.background.primary : color
                  }}
                >
                  {opt.label}
                </button>
              ))}
              {newIndexType === 'custom' && (
                <input
                  type="number"
                  min="0"
                  value={newCustomIndex}
                  onChange={(e) => setNewCustomIndex(e.target.value)}
                  placeholder="0"
                  className="w-16 px-2 py-1 rounded text-xs"
                  style={{
                    background: theme.colors.background.primary,
                    border: `1px solid ${theme.colors.border}`,
                    color: theme.colors.text.primary
                  }}
                />
              )}
            </div>
          </div>

          <div className="flex gap-2">
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

          {newKey && (
            <div 
              className="p-2 rounded text-xs font-mono"
              style={{ background: theme.colors.background.primary }}
            >
              <span style={{ color }}>{buildFieldWithIndex(newKey, newIndexType, newCustomIndex)}</span>
              <span style={{ color: theme.colors.accents.blue }}> {newType === 'text' ? '→ equals' : '→ contains'} </span>
              <span style={{ color: theme.colors.accents.green }}>"{newValue || '...'}"</span>
            </div>
          )}

          {storedVariables && storedVariables.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>💾 Variables:</span>
              <div className="flex gap-1 flex-wrap">
                {storedVariables.map(v => (
                  <button
                    key={v.name}
                    onClick={() => setNewValue(`{{${v.name}}}`)}
                    className="px-1.5 py-0.5 rounded font-mono text-xs transition hover:brightness-110"
                    style={{ background: `${theme.colors.accents.yellow}30`, color: theme.colors.accents.yellow }}
                  >
                    {`{{${v.name}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-3 py-1 rounded text-sm" style={{ color: theme.colors.text.tertiary }}>
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newKey.trim() || !newValue.trim()}
              className="px-3 py-1 rounded text-sm font-semibold transition"
              style={{ background: color, color: 'black', opacity: (!newKey.trim() || !newValue.trim()) ? 0.5 : 1 }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ✅ ENHANCED ASSERTIONS SECTION WITH TYPE AND INDEX MODE SUPPORT
// ═══════════════════════════════════════════════════════════

function AssertionsSection({ 
  assertions, 
  editMode, 
  theme, 
  functionOptions = [],
  locatorOptions = [],
  storedVariables = [],
  onChange 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newFn, setNewFn] = useState('');
  const [newType, setNewType] = useState('');
  const [newIndexType, setNewIndexType] = useState('');
  const [newCustomIndex, setNewCustomIndex] = useState('');
  const [newExpect, setNewExpect] = useState('toBe');
  const [newValue, setNewValue] = useState('');
  const [newStoreAs, setNewStoreAs] = useState('');
  const [useVariable, setUseVariable] = useState(false);
  const [newArgs, setNewArgs] = useState([]);

  // Get selected function's parameter info
  const selectedFunctionInfo = useMemo(() => {
    if (!newFn) return null;
    return functionOptions.find(f => f.value === newFn);
  }, [newFn, functionOptions]);

  // ✅ NEW: Check if selected function has an index parameter
  const functionHasIndexParam = useMemo(() => {
    return selectedFunctionInfo?.hasIndexParam || false;
  }, [selectedFunctionInfo]);

  // ✅ NEW: Get the index parameter name
  const indexParamName = useMemo(() => {
    return selectedFunctionInfo?.indexParamName || 'nth';
  }, [selectedFunctionInfo]);

  // Initialize args when function is selected
  useEffect(() => {
    if (selectedFunctionInfo?.parameters?.length > 0) {
      // ✅ If function has index param and we're using index mode, skip first param
      const paramsToShow = (functionHasIndexParam && newIndexType) 
        ? selectedFunctionInfo.parameters.slice(1)  // Skip index param
        : selectedFunctionInfo.parameters;
      
      setNewArgs(paramsToShow.map(p => ({
        name: p.name,
        value: p.hasDefault ? String(p.defaultValue || '') : '',
        useVar: false,
        hasDefault: p.hasDefault,
        defaultValue: p.defaultValue
      })));
    } else {
      setNewArgs([]);
    }
  }, [selectedFunctionInfo, functionHasIndexParam, newIndexType]);

  const justUpdatedRef = useRef(false);

  useEffect(() => {
    if (justUpdatedRef.current) {
      justUpdatedRef.current = false;
      return;
    }

    const needsTypeUpdate = assertions.some(a => !a.type);
    if (!needsTypeUpdate) return;
    
    const updated = assertions.map(assertion => {
      if (assertion.type) return assertion;
      
      const baseFn = parseFieldWithIndex(assertion.fn).field;
      
      if (locatorOptions.length > 0) {
        const isLocator = locatorOptions.some(l => l.value === baseFn);
        return { ...assertion, type: isLocator ? 'locator' : 'method' };
      }
      
      const methodPatterns = /^(click|get|set|fill|select|wait|scroll|drag|drop|hover|focus|blur|submit|clear|check|uncheck|toggle|open|close|show|hide|enable|disable|validate|verify|assert|is|has|can|should)/i;
      
      if (methodPatterns.test(baseFn)) {
        return { ...assertion, type: 'method' };
      }
      
      return { ...assertion, type: 'locator' };
    });
    
    justUpdatedRef.current = true;
    onChange(updated);
  }, [assertions, locatorOptions, onChange]);

  // Categorized expectation types
  const EXPECTATION_TYPES = {
    getter: [
      { value: 'getValue', label: '📥 get input value', needsValue: false, returnsValue: true },
      { value: 'getText', label: '📥 get text content', needsValue: false, returnsValue: true },
      { value: 'getCount', label: '📥 get element count', needsValue: false, returnsValue: true },
      { value: 'getAttribute', label: '📥 get attribute', needsValue: true, returnsValue: true },
    ],
    check: [
      { value: 'isVisible', label: '❓ is visible?', needsValue: false, returnsBoolean: true },
      { value: 'isEnabled', label: '❓ is enabled?', needsValue: false, returnsBoolean: true },
      { value: 'isChecked', label: '❓ is checked?', needsValue: false, returnsBoolean: true },
      { value: 'hasText', label: '❓ has text?', needsValue: true, returnsBoolean: true },
    ],
    value: [
      { value: 'toBe', label: 'toBe (===)', needsValue: true },
      { value: 'toEqual', label: 'toEqual (deep)', needsValue: true },
      { value: 'toContain', label: 'toContain', needsValue: true },
      { value: 'toContainText', label: 'toContainText', needsValue: true },
      { value: 'toMatch', label: 'toMatch (regex)', needsValue: true },
      { value: 'toHaveLength', label: 'toHaveLength', needsValue: true },
    ],
    number: [
      { value: 'toBeGreaterThan', label: '> greater than', needsValue: true },
      { value: 'toBeGreaterThanOrEqual', label: '>= greater or equal', needsValue: true },
      { value: 'toBeLessThan', label: '< less than', needsValue: true },
      { value: 'toBeLessThanOrEqual', label: '<= less or equal', needsValue: true },
    ],
    boolean: [
      { value: 'toBeTruthy', label: 'toBeTruthy', needsValue: false },
      { value: 'toBeFalsy', label: 'toBeFalsy', needsValue: false },
    ],
    state: [
      { value: 'toBeDefined', label: 'toBeDefined', needsValue: false },
      { value: 'toBeUndefined', label: 'toBeUndefined', needsValue: false },
      { value: 'toBeNull', label: 'toBeNull', needsValue: false },
    ],
    visibility: [
      { value: 'toBeVisible', label: 'toBeVisible', needsValue: false },
      { value: 'toBeHidden', label: 'toBeHidden', needsValue: false },
    ],
  };

  const allExpectTypes = Object.values(EXPECTATION_TYPES).flat();
  const getExpectType = (value) => allExpectTypes.find(t => t.value === value) || { needsValue: true };
  
  const selectedExpectType = getExpectType(newExpect);
  const noValueExpectations = allExpectTypes.filter(t => !t.needsValue).map(t => t.value);

  // Update argument value
  const handleArgChange = (index, value) => {
    const updated = [...newArgs];
    updated[index] = { ...updated[index], value };
    setNewArgs(updated);
  };

  // Toggle variable mode for argument
  const handleArgVarToggle = (index, useVar) => {
    const updated = [...newArgs];
    updated[index] = { ...updated[index], useVar, value: '' };
    setNewArgs(updated);
  };

  // Insert variable into argument
  const handleInsertVarIntoArg = (index, varTemplate) => {
    const updated = [...newArgs];
    const varName = varTemplate.replace(/[{}]/g, '');
    updated[index] = { ...updated[index], value: varName, useVar: true };
    setNewArgs(updated);
  };

  // Handle selection from dropdown
  const handleSelectItem = (value, type) => {
    setNewFn(value);
    setNewType(type);
    // ✅ Reset index when changing function
    setNewIndexType('');
    setNewCustomIndex('');
  };

  const handleAdd = () => {
    if (!newFn.trim()) return;
    
    // ✅ For methods with index mode, use the index notation on fn name
    const finalFn = (newType === 'method' && functionHasIndexParam && newIndexType)
      ? buildFieldWithIndex(newFn.trim(), newIndexType, newCustomIndex)
      : (newType === 'locator' && newIndexType)
        ? buildFieldWithIndex(newFn.trim(), newIndexType, newCustomIndex)
        : newFn.trim();
    
    // Handle expectation value
    let finalValue = newValue;
    if (useVariable && newValue) {
      finalValue = `{{${newValue}}}`;
    } else if (!isNaN(newValue) && newValue !== '') {
      finalValue = Number(newValue);
    }
    
    // Build args array (excluding index param if using index mode)
    const argsArray = newArgs.map(arg => {
      if (arg.useVar && arg.value) {
        return `{{${arg.value}}}`;
      }
      return arg.value;
    }).filter(v => v !== '');
    
    const finalType = newType || (locatorOptions.some(l => l.value === newFn.trim()) ? 'locator' : 'method');
    
    const newAssertion = {
      fn: finalFn,
      type: finalType,
      expect: newExpect,
      ...(!noValueExpectations.includes(newExpect) && finalValue !== '' && { value: finalValue }),
      ...(newStoreAs.trim() && { storeAs: newStoreAs.trim() }),
      ...(argsArray.length > 0 && { args: argsArray }),
      // ✅ NEW: Store index mode info for methods
      ...(finalType === 'method' && functionHasIndexParam && newIndexType && {
        indexMode: newIndexType,
        ...(newIndexType === 'custom' && { customIndex: newCustomIndex }),
        indexParamName: indexParamName
      })
    };
    
    onChange([...assertions, newAssertion]);
    resetForm();
  };

  const resetForm = () => {
    setNewFn('');
    setNewType('');
    setNewIndexType('');
    setNewCustomIndex('');
    setNewExpect('toBe');
    setNewValue('');
    setNewStoreAs('');
    setUseVariable(false);
    setNewArgs([]);
    setIsAdding(false);
  };

  const handleRemove = (idx) => {
    onChange(assertions.filter((_, i) => i !== idx));
  };

  const handleUpdateStoreAs = (idx, newStoreAsValue) => {
    const updated = [...assertions];
    if (newStoreAsValue.trim()) {
      updated[idx] = { ...updated[idx], storeAs: newStoreAsValue.trim() };
    } else {
      const { storeAs, ...rest } = updated[idx];
      updated[idx] = rest;
    }
    onChange(updated);
  };

  const color = theme.colors.accents.purple;

  // ✅ Helper to render index mode badge
  const renderIndexModeBadge = (assertion) => {
    const parsed = parseFieldWithIndex(assertion.fn);
    if (!parsed.indexType) return null;
    
    return (
      <span 
        className="px-1 py-0.5 rounded text-[10px] font-bold"
        style={{ background: color, color: theme.colors.background.primary }}
      >
        {getIndexLabel(parsed.indexType, parsed.customIndex)}
      </span>
    );
  };

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
          {assertions.map((assertion, idx) => {
            const parsed = parseFieldWithIndex(assertion.fn);
            const expectType = getExpectType(assertion.expect);
            
            return (
              <div 
                key={idx}
                className="p-2 rounded text-sm"
                style={{ background: `${color}10` }}
              >
                {/* Main assertion line */}
                <div className="flex items-center gap-1 font-mono flex-wrap">
                  {/* Type badge */}
                  <span 
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ 
                      background: assertion.type === 'locator' 
                        ? `${theme.colors.accents.blue}30` 
                        : `${theme.colors.accents.purple}30`,
                      color: assertion.type === 'locator' 
                        ? theme.colors.accents.blue 
                        : theme.colors.accents.purple
                    }}
                  >
                    {assertion.type === 'locator' ? '📍' : 'ƒ'}
                  </span>

                  {(expectType.returnsValue || expectType.returnsBoolean) && (
                    <span 
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold mr-1"
                      style={{ 
                        background: expectType.returnsValue ? theme.colors.accents.blue : theme.colors.accents.yellow,
                        color: 'white'
                      }}
                    >
                      {expectType.returnsValue ? '📥' : '❓'}
                    </span>
                  )}
                  
                  <span style={{ color: theme.colors.text.tertiary }}>
                    {expectType.returnsValue || expectType.returnsBoolean ? '' : 'expect('}
                  </span>
                  <span style={{ color }}>{parsed.field}</span>
                  
                  {/* ✅ Index mode badge */}
                  {renderIndexModeBadge(assertion)}
                  
                  {/* Show () for methods */}
                  {assertion.type === 'method' && (
                    <>
                      <span style={{ color: theme.colors.text.tertiary }}>(</span>
                      {/* ✅ Show index mode as first arg if applicable */}
                      {parsed.indexType && (
                        <span 
                          className="px-1 py-0.5 rounded text-[10px]"
                          style={{ background: `${theme.colors.accents.orange}30`, color: theme.colors.accents.orange }}
                        >
                          {parsed.indexType === 'custom' ? parsed.customIndex : parsed.indexType}
                        </span>
                      )}
                      {assertion.args && assertion.args.length > 0 && (
                        <span style={{ color: theme.colors.accents.cyan }}>
                          {parsed.indexType && ', '}
                          {assertion.args.map((arg, i) => (
                            <span key={i}>
                              {i > 0 && ', '}
                              {typeof arg === 'string' && arg.includes('{{') ? (
                                <span 
                                  className="px-1 py-0.5 rounded"
                                  style={{ background: `${theme.colors.accents.yellow}30` }}
                                >
                                  {arg}
                                </span>
                              ) : (
                                typeof arg === 'string' ? `"${arg}"` : String(arg)
                              )}
                            </span>
                          ))}
                        </span>
                      )}
                      <span style={{ color: theme.colors.text.tertiary }}>)</span>
                    </>
                  )}
                  
                  {!(expectType.returnsValue || expectType.returnsBoolean) && (
                    <>
                      <span style={{ color: theme.colors.text.tertiary }}>).</span>
                      <span style={{ color: theme.colors.accents.blue }}>{assertion.expect}</span>
                      <span style={{ color: theme.colors.text.tertiary }}>(</span>
                      {assertion.value !== undefined && (
                        <span style={{ color: theme.colors.accents.green }}>
                          {typeof assertion.value === 'string' && assertion.value.includes('{{') ? (
                            <span 
                              className="px-1 py-0.5 rounded"
                              style={{ background: `${theme.colors.accents.yellow}30` }}
                            >
                              {assertion.value}
                            </span>
                          ) : (
                            typeof assertion.value === 'string' ? `"${assertion.value}"` : String(assertion.value)
                          )}
                        </span>
                      )}
                      <span style={{ color: theme.colors.text.tertiary }}>)</span>
                    </>
                  )}
                  
                  {editMode && (
                    <button 
                      onClick={() => handleRemove(idx)}
                      className="ml-auto text-red-400 hover:text-red-300 transition"
                    >
                      ×
                    </button>
                  )}
                </div>
                
                {/* StoreAs line */}
                {assertion.storeAs ? (
                  <div className="flex items-center gap-2 mt-1 ml-4">
                    <span className="text-xs" style={{ color: theme.colors.accents.green }}>💾</span>
                    {editMode ? (
                      <>
                        <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>ctx.</span>
                        <input
                          type="text"
                          value={assertion.storeAs}
                          onChange={(e) => handleUpdateStoreAs(idx, e.target.value)}
                          className="px-2 py-0.5 rounded text-xs font-mono"
                          style={{ 
                            background: theme.colors.background.primary, 
                            border: `1px solid ${theme.colors.accents.green}`,
                            color: theme.colors.accents.green,
                            width: '120px'
                          }}
                        />
                        <button
                          onClick={() => handleUpdateStoreAs(idx, '')}
                          className="text-xs hover:text-red-400"
                          style={{ color: theme.colors.text.tertiary }}
                          title="Remove storeAs"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <code 
                        className="px-2 py-0.5 rounded text-xs font-mono"
                        style={{ background: `${theme.colors.accents.green}20`, color: theme.colors.accents.green }}
                      >
                        → ctx.{assertion.storeAs}
                      </code>
                    )}
                  </div>
                ) : editMode && (
                  <button
                    onClick={() => handleUpdateStoreAs(idx, `${parsed.field}Result`)}
                    className="mt-1 ml-4 px-2 py-0.5 rounded text-[10px] transition hover:brightness-110"
                    style={{ background: `${theme.colors.accents.green}20`, color: theme.colors.accents.green }}
                  >
                    💾 + storeAs
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Form */}
      {isAdding && (
        <div 
          className="p-3 rounded space-y-3"
          style={{ background: theme.colors.background.tertiary, border: `1px solid ${color}40` }}
        >
          {/* Function/Locator selector */}
          <div className="flex gap-2">
            <select
              value={newFn}
              onChange={(e) => {
                const selectedValue = e.target.value;
                const locator = locatorOptions.find(l => l.value === selectedValue);
                if (locator) {
                  handleSelectItem(selectedValue, 'locator');
                } else {
                  handleSelectItem(selectedValue, 'method');
                }
              }}
              className="flex-1 px-2 py-1.5 rounded text-sm"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            >
              <option value="">Select function/locator...</option>
              
              {locatorOptions.length > 0 && (
                <optgroup label="📍 Locators (getters)">
                  {locatorOptions.map(opt => (
                    <option key={`loc-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              )}
              
              {functionOptions.length > 0 && (
                <optgroup label="ƒ Methods (functions)">
                  {functionOptions.map(opt => (
                    <option key={`fn-${opt.value}`} value={opt.value}>
                      {opt.description || opt.label}{opt.async ? ' (async)' : ''}{opt.hasIndexParam ? ' 🔢' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            
            <input
              type="text"
              value={newFn}
              onChange={(e) => {
                setNewFn(e.target.value);
                setNewType('');
              }}
              placeholder="or type name"
              className="w-32 px-2 py-1.5 rounded text-sm font-mono"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            />
            
            {newType && (
              <span 
                className="flex items-center px-2 py-1 rounded text-xs font-semibold"
                style={{
                  background: newType === 'locator' 
                    ? `${theme.colors.accents.blue}30` 
                    : `${theme.colors.accents.purple}30`,
                  color: newType === 'locator' 
                    ? theme.colors.accents.blue 
                    : theme.colors.accents.purple
                }}
              >
                {newType === 'locator' ? '📍 locator' : 'ƒ method'}
              </span>
            )}
          </div>

          {/* ✅ NEW: Index selector for locators OR methods with index params */}
          {(newType === 'locator' || functionHasIndexParam) && (
            <div 
              className="p-3 rounded space-y-2"
              style={{ 
                background: `${theme.colors.accents.orange}10`,
                border: `1px solid ${theme.colors.accents.orange}40`
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: theme.colors.accents.orange }}>
                  🔢 {functionHasIndexParam ? `Index for "${indexParamName}" parameter` : 'Array Index'}
                </span>
                {functionHasIndexParam && (
                  <span 
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: `${theme.colors.accents.purple}30`, color: theme.colors.accents.purple }}
                  >
                    Method takes index param
                  </span>
                )}
              </div>
              
              <div className="flex gap-1 flex-wrap items-center">
                {INDEX_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setNewIndexType(opt.value);
                      if (opt.value !== 'custom') setNewCustomIndex('');
                    }}
                    className="px-2 py-1 rounded text-xs font-semibold transition"
                    style={{ 
                      background: newIndexType === opt.value 
                        ? theme.colors.accents.orange 
                        : `${theme.colors.accents.orange}30`,
                      color: newIndexType === opt.value 
                        ? theme.colors.background.primary 
                        : theme.colors.accents.orange
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                {newIndexType === 'custom' && (
                  <input
                    type="number"
                    min="0"
                    value={newCustomIndex}
                    onChange={(e) => setNewCustomIndex(e.target.value)}
                    placeholder="0"
                    className="w-16 px-2 py-1 rounded text-xs"
                    style={{
                      background: theme.colors.background.primary,
                      border: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  />
                )}
              </div>
              
              {/* ✅ Explain what each mode does for methods */}
              {functionHasIndexParam && newIndexType && (
                <div 
                  className="text-[10px] p-2 rounded"
                  style={{ background: theme.colors.background.secondary, color: theme.colors.text.tertiary }}
                >
                  {newIndexType === 'all' && (
                    <>
                      <strong>[all]</strong>: Will loop through all elements, calling <code>{newFn}(i)</code> for each
                    </>
                  )}
                  {newIndexType === 'any' && (
                    <>
                      <strong>[any]</strong>: Will pick a random element and call <code>{newFn}(randomIndex)</code>
                    </>
                  )}
                  {newIndexType === 'first' && (
                    <>
                      <strong>[first]</strong>: Will call <code>{newFn}(0)</code>
                    </>
                  )}
                  {newIndexType === 'last' && (
                    <>
                      <strong>[last]</strong>: Will call <code>{newFn}(count - 1)</code>
                    </>
                  )}
                  {newIndexType === 'custom' && (
                    <>
                      <strong>[{newCustomIndex || '?'}]</strong>: Will call <code>{newFn}({newCustomIndex || '?'})</code>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Function arguments (skip index param if using index mode) */}
          {newArgs.length > 0 && (
            <div 
              className="p-3 rounded space-y-2"
              style={{ 
                background: `${theme.colors.accents.cyan}10`,
                border: `1px solid ${theme.colors.accents.cyan}40`
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold" style={{ color: theme.colors.accents.cyan }}>
                  📝 {functionHasIndexParam && newIndexType ? 'Other Arguments' : 'Function Arguments'} ({newArgs.length})
                </span>
              </div>

              {newArgs.map((arg, idx) => (
                <div 
                  key={idx} 
                  className="p-2 rounded space-y-2"
                  style={{ background: theme.colors.background.secondary }}
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className="font-mono text-sm font-bold"
                      style={{ color: theme.colors.accents.cyan }}
                    >
                      {arg.name}
                    </span>
                    {arg.hasDefault && (
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
                    {!arg.hasDefault && (
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

                  {arg.hasDefault && arg.defaultValue !== undefined && (
                    <div className="text-[10px]" style={{ color: theme.colors.text.tertiary }}>
                      Default: <code className="px-1 rounded" style={{ background: theme.colors.background.tertiary }}>
                        {JSON.stringify(arg.defaultValue)}
                      </code>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleArgVarToggle(idx, false)}
                      className="flex-1 px-2 py-1 rounded text-xs font-semibold transition"
                      style={{
                        background: !arg.useVar 
                          ? theme.colors.accents.cyan 
                          : theme.colors.background.tertiary,
                        color: !arg.useVar 
                          ? 'white' 
                          : theme.colors.text.tertiary
                      }}
                    >
                      ✏️ Custom Value
                    </button>
                    <button
                      onClick={() => handleArgVarToggle(idx, true)}
                      className="flex-1 px-2 py-1 rounded text-xs font-semibold transition"
                      style={{
                        background: arg.useVar 
                          ? theme.colors.accents.yellow 
                          : theme.colors.background.tertiary,
                        color: arg.useVar 
                          ? 'black' 
                          : theme.colors.text.tertiary
                      }}
                    >
                      {'{{ }} Variable'}
                    </button>
                  </div>

                  {arg.useVar ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'{{'}</span>
                        <input
                          type="text"
                          value={arg.value}
                          onChange={(e) => handleArgChange(idx, e.target.value)}
                          placeholder="ctx.data.field or variableName"
                          className="flex-1 px-2 py-1 rounded text-sm font-mono"
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
                              onClick={() => handleInsertVarIntoArg(idx, `{{${v.path || v.name}}}`)}
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
                      value={arg.value}
                      onChange={(e) => handleArgChange(idx, e.target.value)}
                      placeholder={arg.hasDefault ? `Leave empty for default` : `Enter ${arg.name}...`}
                      className="w-full px-2 py-1 rounded text-sm"
                      style={{
                        background: theme.colors.background.primary,
                        border: `1px solid ${theme.colors.border}`,
                        color: theme.colors.text.primary
                      }}
                    />
                  )}

                  {arg.value && (
                    <div 
                      className="text-[10px] p-1 rounded font-mono"
                      style={{ background: theme.colors.background.tertiary, color: theme.colors.accents.green }}
                    >
                      → {arg.useVar ? `{{${arg.value}}}` : `"${arg.value}"`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Expectation type */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={newExpect}
              onChange={(e) => {
                setNewExpect(e.target.value);
                const type = getExpectType(e.target.value);
                if (type.returnsValue || type.returnsBoolean) {
                  setNewStoreAs(newFn ? `${newFn}Result` : '');
                }
              }}
              className="w-52 px-2 py-1.5 rounded text-sm"
              style={{
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
            >
              <optgroup label="📥 Getters (for storeAs)">
                {EXPECTATION_TYPES.getter.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="❓ Boolean Checks">
                {EXPECTATION_TYPES.check.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Value Comparisons">
                {EXPECTATION_TYPES.value.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Number Comparisons">
                {EXPECTATION_TYPES.number.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Boolean State">
                {EXPECTATION_TYPES.boolean.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Definition State">
                {EXPECTATION_TYPES.state.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Visibility">
                {EXPECTATION_TYPES.visibility.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
            </select>
            
            {selectedExpectType.needsValue && (
              <div className="flex-1 flex gap-2 items-center">
                {useVariable ? (
                  <>
                    <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'{{'}</span>
                    <select
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded text-sm font-mono"
                      style={{
                        background: theme.colors.background.primary,
                        border: `1px solid ${theme.colors.accents.yellow}`,
                        color: theme.colors.accents.yellow
                      }}
                    >
                      <option value="">Select variable...</option>
                      {storedVariables.map(v => (
                        <option key={v.name || v.path} value={v.path || v.name}>{v.path || v.name}</option>
                      ))}
                    </select>
                    <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'}}'}</span>
                  </>
                ) : (
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder={selectedExpectType.value === 'getAttribute' ? 'attribute name' : 'Expected value'}
                    className="flex-1 px-2 py-1.5 rounded text-sm"
                    style={{
                      background: theme.colors.background.primary,
                      border: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  />
                )}
                
                <label className="text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap" style={{ color: theme.colors.text.tertiary }}>
                  <input
                    type="checkbox"
                    checked={useVariable}
                    onChange={(e) => {
                      setUseVariable(e.target.checked);
                      setNewValue('');
                    }}
                    className="rounded"
                  />
                  use var
                </label>
              </div>
            )}
          </div>

          {/* StoreAs input */}
          <div 
            className="p-2 rounded space-y-2"
            style={{ 
              background: `${theme.colors.accents.green}10`,
              border: `1px dashed ${theme.colors.accents.green}40`
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: theme.colors.accents.green }}>
                💾 Store result as variable (optional)
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono" style={{ color: theme.colors.text.tertiary }}>ctx.</span>
              <input
                type="text"
                value={newStoreAs}
                onChange={(e) => setNewStoreAs(e.target.value.replace(/\s/g, ''))}
                placeholder="variableName"
                className="flex-1 px-2 py-1 rounded text-sm font-mono"
                style={{ 
                  background: theme.colors.background.primary, 
                  border: `1px solid ${newStoreAs ? theme.colors.accents.green : theme.colors.border}`, 
                  color: theme.colors.accents.green 
                }}
              />
            </div>
          </div>

          {/* Preview */}
          <div 
            className="p-2 rounded text-xs font-mono"
            style={{ background: theme.colors.background.primary }}
          >
            <span 
              className="text-[10px] px-1 py-0.5 rounded mr-2"
              style={{
                background: (newType || 'method') === 'locator' 
                  ? `${theme.colors.accents.blue}30` 
                  : `${theme.colors.accents.purple}30`,
                color: (newType || 'method') === 'locator' 
                  ? theme.colors.accents.blue 
                  : theme.colors.accents.purple
              }}
            >
              {(newType || 'method') === 'locator' ? '📍' : 'ƒ'}
            </span>
            
            {/* ✅ Show index mode in preview */}
            {newIndexType && (
              <span 
                className="text-[10px] px-1 py-0.5 rounded mr-2"
                style={{ background: theme.colors.accents.orange, color: 'white' }}
              >
                [{newIndexType === 'custom' ? newCustomIndex : newIndexType}]
              </span>
            )}
            
            {selectedExpectType.returnsValue || selectedExpectType.returnsBoolean ? (
              <>
                <span style={{ color: theme.colors.text.tertiary }}>const result = await </span>
                <span style={{ color }}>{newFn || 'fn'}</span>
                {(newType || 'method') === 'method' && (
                  <>
                    <span style={{ color: theme.colors.text.tertiary }}>(</span>
                    {/* Show index arg for methods */}
                    {functionHasIndexParam && newIndexType && (
                      <span style={{ color: theme.colors.accents.orange }}>
                        {newIndexType === 'custom' ? newCustomIndex : newIndexType === 'first' ? '0' : `<${newIndexType}>`}
                      </span>
                    )}
                    {newArgs.filter(a => a.value).map((arg, i) => (
                      <span key={i}>
                        {(functionHasIndexParam && newIndexType) || i > 0 ? <span style={{ color: theme.colors.text.tertiary }}>, </span> : null}
                        <span style={{ color: arg.useVar ? theme.colors.accents.yellow : theme.colors.accents.green }}>
                          {arg.useVar ? `{{${arg.value}}}` : `"${arg.value}"`}
                        </span>
                      </span>
                    ))}
                    <span style={{ color: theme.colors.text.tertiary }}>)</span>
                  </>
                )}
                {newStoreAs && (
                  <>
                    <br />
                    <span style={{ color: theme.colors.accents.green }}>// → ctx.{newStoreAs} = result</span>
                  </>
                )}
              </>
            ) : (
              <>
                <span style={{ color: theme.colors.text.tertiary }}>expect(</span>
                <span style={{ color }}>{newFn || 'fn'}</span>
                {(newType || 'method') === 'method' && (
                  <>
                    <span style={{ color: theme.colors.text.tertiary }}>(</span>
                    {functionHasIndexParam && newIndexType && (
                      <span style={{ color: theme.colors.accents.orange }}>
                        {newIndexType === 'custom' ? newCustomIndex : newIndexType === 'first' ? '0' : `<${newIndexType}>`}
                      </span>
                    )}
                    {newArgs.filter(a => a.value).map((arg, i) => (
                      <span key={i}>
                        {(functionHasIndexParam && newIndexType) || i > 0 ? <span style={{ color: theme.colors.text.tertiary }}>, </span> : null}
                        <span style={{ color: arg.useVar ? theme.colors.accents.yellow : theme.colors.accents.green }}>
                          {arg.useVar ? `{{${arg.value}}}` : `"${arg.value}"`}
                        </span>
                      </span>
                    ))}
                    <span style={{ color: theme.colors.text.tertiary }}>)</span>
                  </>
                )}
                <span style={{ color: theme.colors.text.tertiary }}>).</span>
                <span style={{ color: theme.colors.accents.blue }}>{newExpect}</span>
                <span style={{ color: theme.colors.text.tertiary }}>(</span>
                {newValue && !noValueExpectations.includes(newExpect) && (
                  <span style={{ color: theme.colors.accents.green }}>
                    {useVariable ? `{{${newValue}}}` : (isNaN(newValue) ? `"${newValue}"` : newValue)}
                  </span>
                )}
                <span style={{ color: theme.colors.text.tertiary }}>)</span>
                {newStoreAs && (
                  <>
                    <br />
                    <span style={{ color: theme.colors.accents.green }}>// → ctx.{newStoreAs} = true/false</span>
                  </>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-3 py-1 rounded text-sm" style={{ color: theme.colors.text.tertiary }}>
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newFn.trim()}
              className="px-3 py-1 rounded text-sm font-semibold transition"
              style={{ background: color, color: 'white', opacity: !newFn.trim() ? 0.5 : 1 }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}