// packages/web-app/src/components/AddTransitionModal/ConditionCodeContent.jsx
// UI for custom-code condition blocks - JavaScript that returns true/false

import { useState, useMemo } from 'react';

/**
 * ConditionCodeContent - Renders the content of a custom-code condition block
 * 
 * Features:
 * - Code editor with syntax highlighting colors
 * - Available variables hint
 * - Description field
 * - Code preview
 */
export default function ConditionCodeContent({
  block,
  editMode,
  theme,
  onUpdate,
  storedVariables = [],
  testDataSchema = []
}) {
  const [localCode, setLocalCode] = useState(block.code || '');

  // Merge available variables for hint display
  const availableVars = useMemo(() => {
    const vars = [];
    
    // Test data fields
    testDataSchema.forEach(field => {
      const name = field.name || field.key || field;
      vars.push({ name: `testData.${name}`, source: 'testData' });
    });
    
    // Stored variables from transitions
    storedVariables.forEach(v => {
      vars.push({ name: v.name, source: 'stored', keys: v.keys });
    });
    
    return vars;
  }, [testDataSchema, storedVariables]);

  // Handle code change with debounce-like behavior
  const handleCodeChange = (e) => {
    const newCode = e.target.value;
    setLocalCode(newCode);
    onUpdate({ code: newCode });
  };

  // Handle description change
  const handleDescriptionChange = (e) => {
    onUpdate({ description: e.target.value });
  };

  // Insert variable at cursor
  const handleInsertVariable = (varName) => {
    const textarea = document.getElementById(`code-${block.id}`);
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = localCode.substring(0, start) + varName + localCode.substring(end);
      setLocalCode(newCode);
      onUpdate({ code: newCode });
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + varName.length, start + varName.length);
      }, 0);
    }
  };

  return (
    <div className="space-y-3">
      {/* Description */}
      <div>
        <label 
          className="text-xs font-semibold mb-1 block" 
          style={{ color: theme.colors.text.tertiary }}
        >
          Description (optional)
        </label>
        <input
          type="text"
          value={block.description || ''}
          onChange={handleDescriptionChange}
          disabled={!editMode}
          placeholder="What does this condition check?"
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary
          }}
        />
      </div>

      {/* Available Variables Hint */}
      {editMode && availableVars.length > 0 && (
        <div 
          className="p-2 rounded"
          style={{ 
            background: `${theme.colors.accents.cyan}10`,
            border: `1px solid ${theme.colors.accents.cyan}30`
          }}
        >
          <div className="flex items-center gap-1 mb-1.5">
            <span>📦</span>
            <span 
              className="text-xs font-semibold"
              style={{ color: theme.colors.accents.cyan }}
            >
              Available variables (click to insert):
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableVars.slice(0, 10).map((v, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleInsertVariable(v.name)}
                className="px-2 py-1 rounded text-xs font-mono transition hover:brightness-110"
                style={{
                  background: v.source === 'stored' 
                    ? `${theme.colors.accents.yellow}20`
                    : theme.colors.background.tertiary,
                  color: v.source === 'stored'
                    ? theme.colors.accents.yellow
                    : theme.colors.text.secondary,
                  border: `1px solid ${v.source === 'stored' 
                    ? theme.colors.accents.yellow 
                    : theme.colors.border}40`
                }}
              >
                {v.source === 'stored' ? '💾 ' : ''}{v.name}
              </button>
            ))}
            {availableVars.length > 10 && (
              <span 
                className="text-xs px-2 py-1"
                style={{ color: theme.colors.text.tertiary }}
              >
                +{availableVars.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Code Editor */}
      <div>
        <label 
          className="text-xs font-semibold mb-1 block" 
          style={{ color: theme.colors.text.tertiary }}
        >
          Condition Code <span style={{ color: theme.colors.accents.red }}>*</span>
        </label>
        <div 
          className="relative rounded overflow-hidden"
          style={{ border: `1px solid ${theme.colors.border}` }}
        >
          {/* Line numbers gutter */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-8 text-right pr-2 pt-2 select-none"
            style={{ 
              background: theme.colors.background.tertiary,
              borderRight: `1px solid ${theme.colors.border}`,
              color: theme.colors.text.tertiary,
              fontSize: '12px',
              fontFamily: 'monospace',
              lineHeight: '1.5'
            }}
          >
            {localCode.split('\n').map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          
          {/* Code textarea */}
          <textarea
            id={`code-${block.id}`}
            value={localCode}
            onChange={handleCodeChange}
            disabled={!editMode}
            placeholder="// Return true if condition is met&#10;return testData.field === expectedValue;"
            rows={6}
            className="w-full px-3 py-2 font-mono text-sm resize-y"
            style={{
              background: theme.colors.background.primary,
              color: theme.colors.text.primary,
              border: 'none',
              paddingLeft: '40px',
              minHeight: '120px',
              lineHeight: '1.5'
            }}
            spellCheck={false}
          />
        </div>
        
        {/* Helper text */}
        <div 
          className="mt-1.5 text-xs flex items-center gap-2"
          style={{ color: theme.colors.text.tertiary }}
        >
          <span>💡</span>
          <span>
            Must return <code className="px-1 rounded" style={{ background: theme.colors.background.tertiary }}>true</code> or 
            <code className="px-1 rounded ml-1" style={{ background: theme.colors.background.tertiary }}>false</code>. 
            Access test data via <code className="px-1 rounded" style={{ background: theme.colors.background.tertiary }}>testData.fieldName</code>
          </span>
        </div>
      </div>

      {/* Code Preview */}
      <div>
        <label 
          className="text-xs font-semibold mb-1 block" 
          style={{ color: theme.colors.text.tertiary }}
        >
          Generated Check
        </label>
        <div 
          className="p-3 rounded font-mono text-xs overflow-x-auto"
          style={{ 
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border}`
          }}
        >
          <div style={{ color: theme.colors.text.tertiary }}>
            {'// Condition: '}{block.label}
          </div>
          <div>
            <span style={{ color: theme.colors.accents.purple }}>const</span>
            <span style={{ color: theme.colors.text.primary }}> conditionMet </span>
            <span style={{ color: theme.colors.accents.blue }}>=</span>
            <span style={{ color: theme.colors.text.primary }}> (() </span>
            <span style={{ color: theme.colors.accents.blue }}>=&gt;</span>
            <span style={{ color: theme.colors.text.primary }}> {'{'}</span>
          </div>
          {localCode.split('\n').map((line, i) => (
            <div key={i} style={{ paddingLeft: '16px', color: theme.colors.text.secondary }}>
              {line || ' '}
            </div>
          ))}
          <div style={{ color: theme.colors.text.primary }}>{'})();'}</div>
          <div className="mt-1">
            <span style={{ color: theme.colors.accents.purple }}>if</span>
            <span style={{ color: theme.colors.text.primary }}> (</span>
            <span style={{ color: theme.colors.accents.red }}>!</span>
            <span style={{ color: theme.colors.text.primary }}>conditionMet) </span>
            <span style={{ color: theme.colors.accents.purple }}>return</span>
            <span style={{ color: theme.colors.text.primary }}> </span>
            <span style={{ color: theme.colors.accents.blue }}>null</span>
            <span style={{ color: theme.colors.text.primary }}>;</span>
            <span style={{ color: theme.colors.text.tertiary }}> // Skip this transition</span>
          </div>
        </div>
      </div>

      {/* Validation Warning */}
      {!localCode.includes('return') && (
        <div 
          className="flex items-center gap-2 p-2 rounded text-xs"
          style={{
            background: `${theme.colors.accents.yellow}15`,
            border: `1px solid ${theme.colors.accents.yellow}40`,
            color: theme.colors.accents.yellow
          }}
        >
          <span>⚠️</span>
          <span>Code should include a <code className="px-1 rounded" style={{ background: theme.colors.background.tertiary }}>return</code> statement</span>
        </div>
      )}
    </div>
  );
}