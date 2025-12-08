// packages/web-app/src/components/UIScreenEditor/VariableSuggestions.jsx
// ✅ PHASE 3.6: Reusable variable suggestions component
//
// Shows available variables grouped by source:
// - 📦 Current Screen (from previous blocks)
// - ➡️ Incoming Transition (from actionDetails)
// - 📍 Previous States (from state chain)
// - 📋 Test Data (ctx.data fields)

import { useMemo, useState } from 'react';

/**
 * VariableSuggestions - Clickable variable buttons grouped by category
 * 
 * Props:
 * - storedVariables: Array of variable objects from useCrossStateVariables
 * - onSelect: (templateValue) => void - Called when variable is clicked
 * - theme: Theme object
 * - compact: boolean - If true, shows collapsed by default
 * - showTestData: boolean - Whether to show test data section
 * - testDataFields: Array of field names (defaults to common fields)
 */
export default function VariableSuggestions({
  storedVariables = [],
  onSelect,
  theme,
  compact = false,
  showTestData = true,
  testDataFields = ['agencyName', 'flightType', 'locations', 'noOfPax', 'lang', 'device', 'booking', 'dancerName', 'clubName', 'managerName']
}) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  
  // Group variables by sourceType
  const grouped = useMemo(() => {
    const groups = {
      'current-screen-block': {
        label: 'Current Screen',
        icon: '📦',
        color: 'yellow',
        variables: []
      },
      'transition-import': {
        label: 'Transition Instances',
        icon: '🔧',
        color: 'blue',
        variables: []
      },
      'transition-step': {
        label: 'Transition Results',
        icon: '➡️',
        color: 'green',
        variables: []
      },
      'state-block': {
        label: 'Previous States',
        icon: '📍',
        color: 'purple',
        variables: []
      }
    };
    
    storedVariables.forEach(v => {
      const sourceType = v.sourceType || 'current-screen-block';
      if (groups[sourceType]) {
        groups[sourceType].variables.push(v);
      }
    });
    
    // Filter out empty groups
    return Object.entries(groups).filter(([_, g]) => g.variables.length > 0);
  }, [storedVariables]);
  
  // Total count
  const totalCount = storedVariables.length + (showTestData ? testDataFields.length : 0);
  
  if (totalCount === 0) {
    return null;
  }
  
  const renderVariableButton = (v, colorKey) => {
    const color = theme.colors.accents[colorKey] || theme.colors.accents.yellow;
    
    return (
      <div key={v.name} className="flex items-center gap-0.5 flex-wrap">
        {/* Main variable */}
        <button
          onClick={() => onSelect(`{{${v.name}}}`)}
          className="px-1.5 py-0.5 rounded font-mono text-xs transition hover:brightness-125 hover:scale-105"
          style={{ 
            background: `${color}30`,
            color: color
          }}
          title={v.description || `From: ${v.source}`}
        >
          {`{{${v.name}}}`}
        </button>
        
        {/* Nested keys */}
        {v.nested && v.nested.length > 0 && v.nested.map(nested => (
          <button
            key={nested.name}
            onClick={() => onSelect(`{{${nested.name}}}`)}
            className="px-1 py-0.5 rounded font-mono text-[10px] transition hover:brightness-125"
            style={{ 
              background: `${theme.colors.accents.purple}25`,
              color: theme.colors.accents.purple
            }}
            title={`${nested.key} from ${v.source}`}
          >
            .{nested.key}
          </button>
        ))}
      </div>
    );
  };
  
  return (
    <div 
      className="rounded-lg overflow-hidden"
      style={{ 
        background: theme.colors.background.tertiary,
        border: `1px solid ${theme.colors.border}`
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition hover:bg-white/5"
        style={{ color: theme.colors.text.secondary }}
      >
        <span className="flex items-center gap-2">
          <span>💾 Available Variables</span>
          <span 
            className="px-1.5 py-0.5 rounded"
            style={{ 
              background: `${theme.colors.accents.blue}30`,
              color: theme.colors.accents.blue
            }}
          >
            {totalCount}
          </span>
        </span>
        <span
          className="transition-transform"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>
      
      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Grouped stored variables */}
          {grouped.map(([sourceType, group]) => (
            <div key={sourceType}>
              <div 
                className="text-[10px] font-semibold mb-1 flex items-center gap-1"
                style={{ color: theme.colors.text.tertiary }}
              >
                <span>{group.icon}</span>
                <span>{group.label}</span>
                <span className="opacity-50">({group.variables.length})</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {group.variables.map(v => renderVariableButton(v, group.color))}
              </div>
            </div>
          ))}
          
          {/* Test Data */}
          {showTestData && (
            <div>
              <div 
                className="text-[10px] font-semibold mb-1 flex items-center gap-1"
                style={{ color: theme.colors.text.tertiary }}
              >
                <span>📋</span>
                <span>Test Data</span>
                <span className="opacity-50">({testDataFields.length})</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {testDataFields.map(field => (
                  <button
                    key={field}
                    onClick={() => onSelect(`{{ctx.data.${field}}}`)}
                    className="px-1.5 py-0.5 rounded font-mono text-xs transition hover:brightness-125"
                    style={{ 
                      background: `${theme.colors.accents.blue}25`,
                      color: theme.colors.accents.blue
                    }}
                  >
                    ctx.data.{field}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline version for use in form fields
 * Shows just the buttons without the wrapper
 */
export function InlineVariableSuggestions({
  storedVariables = [],
  onSelect,
  theme,
  showTestData = true,
  testDataFields = ['agencyName', 'flightType', 'noOfPax', 'lang']
}) {
  if (storedVariables.length === 0 && !showTestData) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Stored variables */}
      {storedVariables.map(v => (
        <div key={v.name} className="contents">
          <button
            onClick={() => onSelect(`{{${v.name}}}`)}
            className="px-1.5 py-0.5 rounded font-mono text-xs transition hover:brightness-125"
            style={{ 
              background: `${theme.colors.accents.yellow}30`,
              color: theme.colors.accents.yellow
            }}
            title={v.source}
          >
            {v.name}
          </button>
          {v.nested?.map(n => (
            <button
              key={n.name}
              onClick={() => onSelect(`{{${n.name}}}`)}
              className="px-1 py-0.5 rounded font-mono text-[10px] transition hover:brightness-125"
              style={{ 
                background: `${theme.colors.accents.purple}25`,
                color: theme.colors.accents.purple
              }}
            >
              {n.name}
            </button>
          ))}
        </div>
      ))}
      
      {/* Test data - show fewer in inline mode */}
      {showTestData && testDataFields.map(field => (
        <button
          key={field}
          onClick={() => onSelect(`{{ctx.data.${field}}}`)}
          className="px-1.5 py-0.5 rounded font-mono text-xs transition hover:brightness-125"
          style={{ 
            background: `${theme.colors.accents.blue}20`,
            color: theme.colors.accents.blue
          }}
        >
          ctx.data.{field}
        </button>
      ))}
    </div>
  );
}