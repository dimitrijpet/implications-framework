// packages/web-app/src/components/AddTransitionModal/ConditionCheckContent.jsx
// UI for condition-check blocks - structured field comparisons

import { useState, useEffect, useMemo } from 'react';
import { 
  OPERATORS, 
  OPERATOR_GROUPS, 
  createEmptyCheck,
  parseValue,
  formatValue 
} from './conditionBlockUtils';

/**
 * ConditionCheckContent - Renders the content of a condition-check block
 * 
 * Features:
 * - Field autocomplete from test data schema
 * - Operator dropdown with grouped options
 * - Value input with type selection
 * - Support for stored variables
 * - Mode toggle (ALL/ANY)
 */
export default function ConditionCheckContent({
  block,
  editMode,
  theme,
  onUpdate,
  testDataSchema = [],
  storedVariables = [],
  requiresSuggestions = []
}) {
  const checks = block.data?.checks || [];
  const mode = block.mode || 'all';

  // Merge test data fields, stored variables, and requires suggestions for autocomplete
  const availableFields = useMemo(() => {
    const fields = [];
    const addedNames = new Set();
    
    // Add test data schema fields
    testDataSchema.forEach(field => {
      const name = field.name || field.key || field;
      if (!addedNames.has(name)) {
        fields.push({
          name,
          source: 'testData',
          type: field.type || 'string'
        });
        addedNames.add(name);
      }
    });
    
    // Add stored variables
    storedVariables.forEach(v => {
      if (!addedNames.has(v.name)) {
        fields.push({
          name: v.name,
          source: 'stored',
          type: v.type || 'any',
          keys: v.keys || []
        });
        addedNames.add(v.name);
      }
    });
    
    // ✅ NEW: Extract field names from requiresSuggestions (these are known testData fields)
    requiresSuggestions.forEach(suggestion => {
      const fieldName = suggestion.key;
      if (fieldName && !addedNames.has(fieldName)) {
        fields.push({
          name: fieldName,
          source: 'testData',
          type: typeof suggestion.value === 'boolean' ? 'boolean' 
              : typeof suggestion.value === 'number' ? 'number' 
              : 'string'
        });
        addedNames.add(fieldName);
      }
    });
    
    return fields;
  }, [testDataSchema, storedVariables, requiresSuggestions]);

  // Handle mode change
  const handleModeChange = (newMode) => {
    onUpdate({ mode: newMode });
  };

  // Handle check update
  const handleCheckUpdate = (checkId, updates) => {
    const newChecks = checks.map(check =>
      check.id === checkId ? { ...check, ...updates } : check
    );
    onUpdate({ data: { ...block.data, checks: newChecks } });
  };

  // Handle check delete
  const handleCheckDelete = (checkId) => {
    const newChecks = checks.filter(c => c.id !== checkId);
    onUpdate({ data: { ...block.data, checks: newChecks } });
  };

  // Handle add check
  const handleAddCheck = () => {
    const newChecks = [...checks, createEmptyCheck()];
    onUpdate({ data: { ...block.data, checks: newChecks } });
  };

  // Handle quick add from suggestions
  const handleQuickAdd = (suggestion) => {
    const newCheck = {
      ...createEmptyCheck(),
      field: suggestion.key,
      value: suggestion.value,
      valueType: typeof suggestion.value === 'boolean' ? 'boolean' 
               : typeof suggestion.value === 'number' ? 'number' 
               : 'string'
    };
    const newChecks = [...checks, newCheck];
    onUpdate({ data: { ...block.data, checks: newChecks } });
  };

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold" style={{ color: theme.colors.text.tertiary }}>
          Match mode:
        </span>
        <div className="flex gap-2">
          <label 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer transition"
            style={{
              background: mode === 'all' ? `${theme.colors.accents.purple}20` : 'transparent',
              border: `1px solid ${mode === 'all' ? theme.colors.accents.purple : theme.colors.border}`
            }}
          >
            <input
              type="radio"
              name={`mode-${block.id}`}
              value="all"
              checked={mode === 'all'}
              onChange={() => handleModeChange('all')}
              disabled={!editMode}
              className="sr-only"
            />
            <span 
              className="text-sm font-semibold"
              style={{ color: mode === 'all' ? theme.colors.accents.purple : theme.colors.text.secondary }}
            >
              ALL must match
            </span>
            <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>(AND)</span>
          </label>
          
          <label 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer transition"
            style={{
              background: mode === 'any' ? `${theme.colors.accents.blue}20` : 'transparent',
              border: `1px solid ${mode === 'any' ? theme.colors.accents.blue : theme.colors.border}`
            }}
          >
            <input
              type="radio"
              name={`mode-${block.id}`}
              value="any"
              checked={mode === 'any'}
              onChange={() => handleModeChange('any')}
              disabled={!editMode}
              className="sr-only"
            />
            <span 
              className="text-sm font-semibold"
              style={{ color: mode === 'any' ? theme.colors.accents.blue : theme.colors.text.secondary }}
            >
              ANY can match
            </span>
            <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>(OR)</span>
          </label>
        </div>
      </div>

      {/* Quick Add Suggestions */}
      {editMode && requiresSuggestions.length > 0 && (
        <div className="p-2 rounded" style={{ background: `${theme.colors.accents.cyan}10` }}>
          <div className="text-xs mb-1.5" style={{ color: theme.colors.text.tertiary }}>
            Quick add from previously used:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {requiresSuggestions
              .filter(s => !checks.some(c => c.field === s.key))
              .slice(0, 6)
              .map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickAdd(suggestion)}
                  className="px-2 py-1 rounded text-xs font-mono transition hover:brightness-110"
                  style={{
                    backgroundColor: suggestion.color || theme.colors.accents.purple,
                    color: '#fff'
                  }}
                >
                  {suggestion.label}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Checks List */}
      <div className="space-y-2">
        {checks.map((check, index) => (
          <CheckRow
            key={check.id}
            check={check}
            index={index}
            editMode={editMode}
            theme={theme}
            availableFields={availableFields}
            storedVariables={storedVariables}
            onUpdate={(updates) => handleCheckUpdate(check.id, updates)}
            onDelete={() => handleCheckDelete(check.id)}
          />
        ))}
      </div>

           {/* Add Check Button */}
      {editMode && (
        <>
          <button
            type="button"
            onClick={handleAddCheck}
            className="w-full py-1.5 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: `${theme.colors.accents.green}20`,
              color: theme.colors.accents.green,
              border: `1px dashed ${theme.colors.accents.green}50`,
            }}
          >
            + Add Check
          </button>
          
          {/* Spacer for dropdown visibility */}
          <div style={{ minHeight: '120px' }} />
        </>
      )}

      

      {/* Empty State */}
      {checks.length === 0 && !editMode && (
        <div 
          className="p-4 rounded text-center text-sm"
          style={{ color: theme.colors.text.tertiary }}
        >
          No checks configured
        </div>
      )}
    </div>
  );
}

/**
 * CheckRow - Single condition check row
 */
function CheckRow({
  check,
  index,
  editMode,
  theme,
  availableFields,
  storedVariables,
  onUpdate,
  onDelete
}) {
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const operator = OPERATORS[check.operator] || OPERATORS.equals;

  // Filter fields for dropdown
  const filteredFields = useMemo(() => {
    if (!check.field) return availableFields;
    const search = check.field.toLowerCase();
    return availableFields.filter(f => 
      f.name.toLowerCase().includes(search)
    );
  }, [availableFields, check.field]);

  // Handle field selection from dropdown
  const handleFieldSelect = (fieldName) => {
    onUpdate({ field: fieldName });
    setShowFieldDropdown(false);
  };

  // Handle operator change
  const handleOperatorChange = (newOperator) => {
    const newOp = OPERATORS[newOperator];
    const updates = { operator: newOperator };
    
    // Clear value if new operator doesn't need one
    if (!newOp?.needsValue) {
      updates.value = undefined;
    }
    
    onUpdate(updates);
  };

  // Handle value change
  const handleValueChange = (newValue) => {
    const parsed = parseValue(newValue, check.valueType || 'string');
    onUpdate({ value: parsed });
  };

  // Handle value type change
  const handleValueTypeChange = (newType) => {
    onUpdate({ 
      valueType: newType,
      value: newType === 'boolean' ? true : ''
    });
  };

  return (
    <div 
      className="flex items-center gap-2 p-2 rounded"
      style={{ 
        background: theme.colors.background.tertiary,
        border: `1px solid ${theme.colors.border}`
      }}
    >
      {/* Index Badge */}
      <span 
        className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold shrink-0"
        style={{ 
          background: `${theme.colors.accents.purple}30`,
          color: theme.colors.accents.purple
        }}
      >
        {index + 1}
      </span>

      {/* Field Input with Autocomplete */}
      <div className="relative flex-1 min-w-0">
        <input
          type="text"
          value={check.field || ''}
          onChange={(e) => {
            onUpdate({ field: e.target.value });
            setShowFieldDropdown(true);
          }}
          onFocus={() => setShowFieldDropdown(true)}
          onBlur={() => setTimeout(() => setShowFieldDropdown(false), 200)}
          disabled={!editMode}
          placeholder="Field name..."
          className="w-full px-2 py-1.5 rounded text-sm font-mono"
          style={{
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary
          }}
        />
        
        {/* Field Dropdown */}
        {showFieldDropdown && editMode && filteredFields.length > 0 && (
          <div 
            className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto"
            style={{
              background: theme.colors.background.secondary,
              border: `1px solid ${theme.colors.border}`
            }}
          >
            {filteredFields.map((field, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleFieldSelect(field.name)}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/5 transition"
              >
                <span 
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background: field.source === 'stored' 
                      ? `${theme.colors.accents.yellow}30`
                      : `${theme.colors.accents.green}30`,
                    color: field.source === 'stored'
                      ? theme.colors.accents.yellow
                      : theme.colors.accents.green
                  }}
                >
                  {field.source === 'stored' ? '💾' : '📋'}
                </span>
                <span className="font-mono" style={{ color: theme.colors.text.primary }}>
                  {field.name}
                </span>
                {field.type && (
                  <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                    ({field.type})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Operator Dropdown */}
      <select
        value={check.operator || 'equals'}
        onChange={(e) => handleOperatorChange(e.target.value)}
        disabled={!editMode}
        className="px-2 py-1.5 rounded text-sm font-semibold"
        style={{
          background: theme.colors.background.secondary,
          border: `1px solid ${theme.colors.border}`,
          color: theme.colors.accents.purple,
          minWidth: '80px',
          position: 'relative',
  zIndex: 9999,
        }}
      >
        {OPERATOR_GROUPS.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.operators.map(op => (
              <option key={op} value={op}>
                {OPERATORS[op].label} {OPERATORS[op].description}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Value Input (if needed) */}
      {operator.needsValue && (
        <div className="flex items-center gap-1">
          {/* Value Type Selector */}
          <select
            value={check.valueType || 'string'}
            onChange={(e) => handleValueTypeChange(e.target.value)}
            disabled={!editMode}
            className="px-1.5 py-1.5 rounded text-xs"
            style={{
              background: theme.colors.background.secondary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text.secondary,
              position: 'relative',
  zIndex: 9999,
            }}
          >
            <option value="string">text</option>
            <option value="number">num</option>
            <option value="boolean">bool</option>
            <option value="variable">var</option>
            {operator.valueType === 'array' && <option value="array">list</option>}
          </select>

          {/* Value Input based on type */}
          {check.valueType === 'boolean' ? (
            <select
              value={check.value === true ? 'true' : 'false'}
              onChange={(e) => onUpdate({ value: e.target.value === 'true' })}
              disabled={!editMode}
              className="px-2 py-1.5 rounded text-sm font-mono"
              style={{
                background: theme.colors.background.secondary,
                border: `1px solid ${theme.colors.border}`,
                color: check.value ? theme.colors.accents.green : theme.colors.accents.red,
                minWidth: '70px',
                position: 'relative',
  zIndex: 9999,
              }}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : check.valueType === 'variable' ? (
            <VariableSelector
              value={check.value}
              onChange={(v) => onUpdate({ value: v })}
              storedVariables={storedVariables}
              editMode={editMode}
              theme={theme}
            />
          ) : (
            <input
              type={check.valueType === 'number' ? 'number' : 'text'}
              value={check.value ?? ''}
              onChange={(e) => handleValueChange(e.target.value)}
              disabled={!editMode}
              placeholder={check.valueType === 'array' ? 'a, b, c' : 'value'}
              className="px-2 py-1.5 rounded text-sm font-mono"
              style={{
                background: theme.colors.background.secondary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary,
                width: check.valueType === 'array' ? '120px' : '80px'
              }}
            />
          )}
        </div>
      )}

      {/* Delete Button */}
      {editMode && (
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded transition hover:bg-red-500/20"
          title="Remove check"
        >
          <span style={{ color: theme.colors.accents.red }}>✕</span>
        </button>
      )}
    </div>
  );
}

/**
 * VariableSelector - Dropdown for selecting stored variables
 */
function VariableSelector({ value, onChange, storedVariables, editMode, theme }) {
  // Extract variable name from {{name}} format
  const currentVar = value?.replace(/^\{\{|\}\}$/g, '') || '';

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'{{'}</span>
      <select
        value={currentVar}
        onChange={(e) => onChange(e.target.value ? `{{${e.target.value}}}` : '')}
        disabled={!editMode}
        className="px-2 py-1.5 rounded text-sm font-mono"
        style={{
          background: theme.colors.background.secondary,
          border: `1px solid ${theme.colors.border}`,
          color: theme.colors.accents.yellow,
          minWidth: '100px',
          position: 'relative',
  zIndex: 9999,
        }}
      >
        <option value="">Select...</option>
        {storedVariables.map(v => (
          <option key={v.name} value={v.name}>{v.name}</option>
        ))}
      </select>
      <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>{'}}'}</span>
    </div>
  );
}