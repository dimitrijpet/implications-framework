// packages/web-app/src/components/UIScreenEditor/DataAssertionContent.jsx
// Data Assertion Block - Compare stored variables, ctx.data fields, and literals

import { useState, useMemo } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';

const OPERATORS = [
  { value: 'equals', label: '= equals', description: 'Exact match' },
  { value: 'notEquals', label: '≠ not equals', description: 'Not equal' },
  { value: 'contains', label: '⊃ contains', description: 'String/array contains' },
  { value: 'notContains', label: '⊅ not contains', description: 'Does not contain' },
  { value: 'greaterThan', label: '> greater than', description: 'Numeric comparison' },
  { value: 'lessThan', label: '< less than', description: 'Numeric comparison' },
  { value: 'greaterOrEqual', label: '≥ greater or equal', description: 'Numeric comparison' },
  { value: 'lessOrEqual', label: '≤ less or equal', description: 'Numeric comparison' },
  { value: 'matches', label: '~ matches', description: 'Regex pattern match' },
  { value: 'startsWith', label: '^ starts with', description: 'String starts with' },
  { value: 'endsWith', label: '$ ends with', description: 'String ends with' },
  { value: 'isDefined', label: '? is defined', description: 'Value exists', unary: true },
  { value: 'isUndefined', label: '∅ is undefined', description: 'Value does not exist', unary: true },
  { value: 'isTruthy', label: '✓ is truthy', description: 'Boolean true-ish', unary: true },
  { value: 'isFalsy', label: '✗ is falsy', description: 'Boolean false-ish', unary: true },
  { value: "toBeTrue", label: "✔ is true", description: "Boolean true", unary: true }, 
  { value: "toBeFalse", label: "✘ is false", description: "Boolean false", unary: true },
  { value: 'lengthEquals', label: '# length equals', description: 'Array/string length' },
  { value: 'lengthGreaterThan', label: '#> length greater than', description: 'Array/string length' },
];

/**
 * VariableSelector - Dropdown + custom input for selecting variables
 */
function VariableSelector({ 
  value, 
  onChange, 
  storedVariables = [], 
  testDataSchema = [],
  allowLiteral = true,
  placeholder = 'Select or type...',
  theme 
}) {
  const [mode, setMode] = useState(() => {
    if (!value) return 'select';
    if (value.startsWith('{{') || value.startsWith('result.')) return 'stored';
    if (value.startsWith('ctx.data.')) return 'context';
    return 'literal';
  });

  // Build suggestions
  const storedSuggestions = useMemo(() => {
    return storedVariables.map(v => ({
      value: `{{${v.name || v.path}}}`,
      label: v.name || v.path,
      source: v.source || v.fromState || 'stored',
      keys: v.keys || []
    }));
  }, [storedVariables]);

  const contextSuggestions = useMemo(() => {
    if (!testDataSchema?.length) {
      return [
        { value: 'ctx.data.status', label: 'status' },
        { value: 'ctx.data.lang', label: 'lang' },
        { value: 'ctx.data.device', label: 'device' },
      ];
    }
    return testDataSchema.slice(0, 20).map(field => ({
      value: `ctx.data.${field.name || field}`,
      label: field.name || field
    }));
  }, [testDataSchema]);

  return (
    <div className="flex-1">
      {/* Mode selector */}
      <div className="flex gap-1 mb-1">
        <button
          type="button"
          onClick={() => { setMode('stored'); onChange(''); }}
          className="px-2 py-0.5 rounded text-xs transition"
          style={{
            background: mode === 'stored' ? theme.colors.accents.yellow : theme.colors.background.tertiary,
            color: mode === 'stored' ? 'black' : theme.colors.text.tertiary
          }}
        >
          💾 Stored
        </button>
        <button
          type="button"
          onClick={() => { setMode('context'); onChange(''); }}
          className="px-2 py-0.5 rounded text-xs transition"
          style={{
            background: mode === 'context' ? theme.colors.accents.blue : theme.colors.background.tertiary,
            color: mode === 'context' ? 'white' : theme.colors.text.tertiary
          }}
        >
          📋 ctx.data
        </button>
        {allowLiteral && (
          <button
            type="button"
            onClick={() => { setMode('literal'); onChange(''); }}
            className="px-2 py-0.5 rounded text-xs transition"
            style={{
              background: mode === 'literal' ? theme.colors.accents.green : theme.colors.background.tertiary,
              color: mode === 'literal' ? 'white' : theme.colors.text.tertiary
            }}
          >
            ✏️ Literal
          </button>
        )}
      </div>

      {/* Input based on mode */}
      {mode === 'stored' && (
        <div className="space-y-1">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 rounded text-sm"
            style={{
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.accents.yellow}`,
              color: theme.colors.accents.yellow
            }}
          >
            <option value="">-- Select stored variable --</option>
            {storedSuggestions.map((s, i) => (
              <option key={i} value={s.value}>
                {s.label} ({s.source})
              </option>
            ))}
          </select>
          {/* Allow custom input too */}
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="{{variableName}} or result.field"
            className="w-full px-2 py-1 rounded text-xs font-mono"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.accents.yellow
            }}
          />
        </div>
      )}

      {mode === 'context' && (
        <div className="space-y-1">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 rounded text-sm"
            style={{
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.accents.blue}`,
              color: theme.colors.accents.blue
            }}
          >
            <option value="">-- Select ctx.data field --</option>
            {contextSuggestions.map((s, i) => (
              <option key={i} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ctx.data.field.path"
            className="w-full px-2 py-1 rounded text-xs font-mono"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.accents.blue
            }}
          />
        </div>
      )}

      {mode === 'literal' && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="'string' or 123 or true"
          className="w-full px-2 py-1.5 rounded text-sm font-mono"
          style={{
            background: theme.colors.background.tertiary,
            border: `1px solid ${theme.colors.accents.green}`,
            color: theme.colors.accents.green
          }}
        />
      )}
    </div>
  );
}

/**
 * DataAssertionContent - Main component for data assertion blocks
 */
export default function DataAssertionContent({ 
  block, 
  onChange, 
  theme = defaultTheme,
  storedVariables = [],
  testDataSchema = [],
  editMode = true
}) {
  const assertions = block.assertions || [];

 const updateAssertion = (index, field, value) => {
  const newAssertions = [...assertions];
  newAssertions[index] = { ...newAssertions[index], [field]: value };
  onChange({ assertions: newAssertions });  // ← Only pass { assertions }
};

const addAssertion = () => {
  onChange({
    assertions: [
      ...assertions,
      { left: '', operator: 'equals', right: '', message: '' }
    ]
  });
};

const removeAssertion = (index) => {
  onChange({
    assertions: assertions.filter((_, i) => i !== index)
  });
};

const duplicateAssertion = (index) => {
  const newAssertions = [...assertions];
  newAssertions.splice(index + 1, 0, { ...assertions[index] });
  onChange({ assertions: newAssertions });
};

  // Generate preview code for an assertion
  const getPreviewCode = (assertion) => {
    const { left, operator, right } = assertion;
    if (!left) return '// Select left operand';
    
    const leftCode = left.startsWith('{{') 
      ? `storedVars.${left.replace(/[{}]/g, '')}`
      : left;
    const rightCode = right?.startsWith('{{')
      ? `storedVars.${right.replace(/[{}]/g, '')}`
      : right;

    switch (operator) {
      case 'equals':
        return `expect(${leftCode}).toBe(${rightCode});`;
      case 'notEquals':
        return `expect(${leftCode}).not.toBe(${rightCode});`;
      case 'contains':
        return `expect(${leftCode}).toContain(${rightCode});`;
      case 'notContains':
        return `expect(${leftCode}).not.toContain(${rightCode});`;
      case 'greaterThan':
        return `expect(Number(${leftCode})).toBeGreaterThan(Number(${rightCode}));`;
      case 'lessThan':
        return `expect(Number(${leftCode})).toBeLessThan(Number(${rightCode}));`;
      case 'greaterOrEqual':
        return `expect(Number(${leftCode})).toBeGreaterThanOrEqual(Number(${rightCode}));`;
      case 'lessOrEqual':
        return `expect(Number(${leftCode})).toBeLessThanOrEqual(Number(${rightCode}));`;
      case 'matches':
        return `expect(${leftCode}).toMatch(${rightCode});`;
      case 'startsWith':
        return `expect(${leftCode}.startsWith(${rightCode})).toBe(true);`;
      case 'endsWith':
        return `expect(${leftCode}.endsWith(${rightCode})).toBe(true);`;
      case 'isDefined':
        return `expect(${leftCode}).toBeDefined();`;
      case 'isUndefined':
        return `expect(${leftCode}).toBeUndefined();`;
      case 'isTruthy':
        return `expect(${leftCode}).toBeTruthy();`;
      case 'isFalsy':
        return `expect(${leftCode}).toBeFalsy();`;
      case 'toBeTrue':
        return `expect(${leftCode}).toBe(true);`;
      case 'toBeFalse':
        return `expect(${leftCode}).toBe(false);`;
      case 'lengthEquals':
        return `expect(${leftCode}.length).toBe(${rightCode});`;
      case 'lengthGreaterThan':
        return `expect(${leftCode}.length).toBeGreaterThan(${rightCode});`;
      default:
        return `// Unknown operator: ${operator}`;
    }
  };

  const isUnaryOperator = (operator) => {
    return OPERATORS.find(o => o.value === operator)?.unary || false;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <span 
            className="font-semibold text-sm"
            style={{ color: theme.colors.accents.purple }}
          >
            Data Assertions ({assertions.length})
          </span>
        </div>
        
        {editMode && (
          <button
            type="button"
            onClick={addAssertion}
            className="px-3 py-1 rounded text-xs font-semibold transition hover:brightness-110"
            style={{
              background: theme.colors.accents.green,
              color: 'white'
            }}
          >
            + Add Assertion
          </button>
        )}
      </div>

      {/* Info box */}
      <div 
        className="p-2 rounded text-xs"
        style={{ 
          background: `${theme.colors.accents.purple}15`,
          border: `1px solid ${theme.colors.accents.purple}30`,
          color: theme.colors.text.secondary
        }}
      >
        💡 Compare stored variables from previous steps, ctx.data fields, or literal values
      </div>

      {/* Assertions list */}
      {assertions.length === 0 ? (
        <div 
          className="p-4 rounded text-center text-sm"
          style={{ 
            background: theme.colors.background.tertiary,
            color: theme.colors.text.tertiary
          }}
        >
          No assertions yet. Click "+ Add Assertion" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {assertions.map((assertion, index) => (
            <div
              key={index}
              className="p-3 rounded-lg space-y-2"
              style={{
                background: theme.colors.background.secondary,
                border: `1px solid ${theme.colors.border}`
              }}
            >
              {/* Assertion header */}
              <div className="flex items-center justify-between">
                <span 
                  className="text-xs font-semibold"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  Assertion #{index + 1}
                </span>
                
                {editMode && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => duplicateAssertion(index)}
                      className="px-2 py-0.5 rounded text-xs transition hover:brightness-110"
                      style={{
                        background: theme.colors.background.tertiary,
                        color: theme.colors.text.secondary
                      }}
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAssertion(index)}
                      className="px-2 py-0.5 rounded text-xs transition hover:brightness-110"
                      style={{
                        background: `${theme.colors.accents.red}20`,
                        color: theme.colors.accents.red
                      }}
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              {/* Main assertion row */}
              <div className="flex gap-2 items-start">
                {/* Left operand */}
                <div className="flex-1">
                  <label 
                    className="text-xs mb-1 block"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    Left Value
                  </label>
                  <VariableSelector
                    value={assertion.left}
                    onChange={(v) => updateAssertion(index, 'left', v)}
                    storedVariables={storedVariables}
                    testDataSchema={testDataSchema}
                    allowLiteral={false}
                    theme={theme}
                  />
                </div>

                {/* Operator */}
                <div style={{ width: '160px' }}>
                  <label 
                    className="text-xs mb-1 block"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    Operator
                  </label>
                  <select
                    value={assertion.operator || 'equals'}
                    onChange={(e) => updateAssertion(index, 'operator', e.target.value)}
                    disabled={!editMode}
                    className="w-full px-2 py-1.5 rounded text-sm"
                    style={{
                      background: theme.colors.background.tertiary,
                      border: `1px solid ${theme.colors.accents.purple}`,
                      color: theme.colors.accents.purple
                    }}
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Right operand (hidden for unary operators) */}
                {!isUnaryOperator(assertion.operator) && (
                  <div className="flex-1">
                    <label 
                      className="text-xs mb-1 block"
                      style={{ color: theme.colors.text.tertiary }}
                    >
                      Right Value
                    </label>
                    <VariableSelector
                      value={assertion.right}
                      onChange={(v) => updateAssertion(index, 'right', v)}
                      storedVariables={storedVariables}
                      testDataSchema={testDataSchema}
                      allowLiteral={true}
                      theme={theme}
                    />
                  </div>
                )}
              </div>

              {/* Optional message */}
              <div>
                <label 
                  className="text-xs mb-1 block"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  Error Message (optional)
                </label>
                <input
                  type="text"
                  value={assertion.message || ''}
                  onChange={(e) => updateAssertion(index, 'message', e.target.value)}
                  disabled={!editMode}
                  placeholder="Custom error message if assertion fails"
                  className="w-full px-2 py-1 rounded text-sm"
                  style={{
                    background: theme.colors.background.tertiary,
                    border: `1px solid ${theme.colors.border}`,
                    color: theme.colors.text.primary
                  }}
                />
              </div>

              {/* Code preview */}
              <div 
                className="p-2 rounded font-mono text-xs"
                style={{ 
                  background: theme.colors.background.primary,
                  color: theme.colors.accents.cyan
                }}
              >
                {getPreviewCode(assertion)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available variables hint */}
      {storedVariables.length > 0 && (
        <div 
          className="p-2 rounded text-xs"
          style={{ 
            background: `${theme.colors.accents.yellow}10`,
            border: `1px solid ${theme.colors.accents.yellow}30`
          }}
        >
          <div 
            className="font-semibold mb-1"
            style={{ color: theme.colors.accents.yellow }}
          >
            💾 Available Stored Variables:
          </div>
          <div className="flex flex-wrap gap-1">
            {storedVariables.map((v, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded font-mono"
                style={{
                  background: theme.colors.background.tertiary,
                  color: theme.colors.accents.yellow
                }}
              >
                {`{{${v.name || v.path}}}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export operators for use in code generation
export { OPERATORS };