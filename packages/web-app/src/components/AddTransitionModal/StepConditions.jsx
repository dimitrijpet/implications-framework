// packages/web-app/src/components/AddTransitionModal/StepConditions.jsx
// Step-level conditions component - collapsible conditions for individual action steps

import { useState, useEffect } from 'react';
import ConditionBlockList from './ConditionBlockList';

export default function StepConditions({
  conditions,
  onChange,
  stepIndex,
  availableVariables = [],
  testDataSchema = [],
  requiresSuggestions = [],
  theme
}) {
  // Auto-expand if has conditions
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    if (conditions?.blocks?.length > 0) {
      setIsExpanded(true);
    }
  }, [conditions]);

  const hasConditions = conditions?.blocks?.length > 0;
  const conditionCount = conditions?.blocks?.length || 0;

  return (
    <div 
      className="mt-3 rounded-lg"
      style={{ 
        backgroundColor: `${theme.colors.background.primary}50`,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'visible',  // Allow dropdowns to overflow
      }}
    >
      {/* Collapse Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-left transition-colors rounded-lg"
        style={{
          backgroundColor: hasConditions 
            ? `${theme.colors.accents.purple}15`
            : 'transparent',
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '14px' }}>
            {hasConditions ? '🔒' : '🔓'}
          </span>
          <span 
            className="text-sm font-medium"
            style={{ color: theme.colors.text.secondary }}
          >
            Step Conditions
            {hasConditions && (
              <span 
                className="ml-2 px-1.5 py-0.5 rounded text-xs"
                style={{ 
                  backgroundColor: theme.colors.accents.purple,
                  color: 'white'
                }}
              >
                {conditionCount}
              </span>
            )}
          </span>
        </div>
        <span 
          className="text-sm transition-transform"
          style={{ 
            color: theme.colors.text.tertiary,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          ▼
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div 
          className="px-3 pb-3 pt-1"
          style={{ overflow: 'visible' }}  // Allow dropdowns to overflow
        >
          {/* Helper text */}
          <p 
            className="text-xs mb-2"
            style={{ color: theme.colors.text.tertiary }}
          >
            💡 Conditions determine if this step runs. Check testData fields
            {availableVariables.length > 0 ? ', previous step results,' : ''} or use custom code.
          </p>
          
          {/* Show available variables from previous steps */}
          {availableVariables.length > 0 && (
            <div 
              className="mb-2 p-2 rounded text-xs"
              style={{ 
                backgroundColor: `${theme.colors.accents.yellow}10`,
                border: `1px solid ${theme.colors.accents.yellow}30`
              }}
            >
              <span style={{ color: theme.colors.accents.yellow }}>
                📦 Available from previous steps:{' '}
                {availableVariables.map(v => `{{${v.name}}}`).join(', ')}
              </span>
            </div>
          )}

          <ConditionBlockList
            conditions={conditions}
            onChange={onChange}
            editMode={true}
            theme={theme}
            testDataSchema={testDataSchema}
            storedVariables={availableVariables}
            requiresSuggestions={requiresSuggestions}
            compact={true}
          />
        </div>
      )}
    </div>
  );
}