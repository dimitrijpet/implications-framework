// packages/web-app/src/components/AddTransitionModal/StepConditions.jsx
// Compact conditions UI for individual action steps

import { useState } from 'react';
import ConditionBlockList from './ConditionBlockList';

/**
 * Collapsible conditions section for a single step
 * Allows configuring when a step should run based on previous step results
 */
export default function StepConditions({
  conditions,
  onChange,
  stepIndex,
  availableVariables = [],
  testDataSchema = [],
  requiresSuggestions = [],
  theme
}) {
  const [isExpanded, setIsExpanded] = useState(
    // Auto-expand if has conditions
    conditions?.blocks?.length > 0
  );

  const hasConditions = conditions?.blocks?.length > 0;
  const blockCount = conditions?.blocks?.length || 0;

  return (
    <div 
      className="mt-3 rounded overflow-hidden"
      style={{ 
        border: `1px solid ${hasConditions ? theme.colors.accents.purple + '50' : theme.colors.border}`,
        backgroundColor: hasConditions ? `${theme.colors.accents.purple}05` : 'transparent'
      }}
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-left transition hover:brightness-110"
        style={{
          backgroundColor: hasConditions 
            ? `${theme.colors.accents.purple}15` 
            : theme.colors.background.tertiary,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: theme.colors.accents.purple }}>
            {hasConditions ? '🔒' : '🔓'}
          </span>
          <span 
            className="text-xs font-medium"
            style={{ color: theme.colors.text.secondary }}
          >
            Step Conditions
          </span>
          {hasConditions && (
            <span 
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ 
                backgroundColor: theme.colors.accents.purple + '30',
                color: theme.colors.accents.purple 
              }}
            >
              {blockCount} {blockCount === 1 ? 'condition' : 'conditions'}
            </span>
          )}
          {!hasConditions && (
            <span 
              className="text-xs"
              style={{ color: theme.colors.text.tertiary }}
            >
              (optional)
            </span>
          )}
        </div>
        <span 
          className="text-xs transition-transform"
          style={{ 
            color: theme.colors.text.tertiary,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          ▼
        </span>
      </button>

      {/* Content - collapsible */}
      {isExpanded && (
        <div className="p-3 border-t" style={{ borderColor: theme.colors.border }}>
          {availableVariables.length === 0 && !hasConditions ? (
            // No variables available yet
            <div 
              className="text-xs text-center py-3 rounded"
              style={{ 
                backgroundColor: theme.colors.background.secondary,
                color: theme.colors.text.tertiary 
              }}
            >
              <p>💡 Add a <strong>Store As</strong> value to previous steps</p>
              <p className="mt-1">to use their results in conditions here.</p>
            </div>
          ) : (
            <>
              {/* Help text */}
              <p 
                className="text-xs mb-3"
                style={{ color: theme.colors.text.tertiary }}
              >
                This step will only run if these conditions pass:
              </p>
              
              {/* Reuse ConditionBlockList */}
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
            </>
          )}
        </div>
      )}
    </div>
  );
}