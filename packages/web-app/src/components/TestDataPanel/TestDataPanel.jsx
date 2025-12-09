// packages/web-app/src/components/TestDataPanel/TestDataPanel.jsx

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, ArrowRight, FileJson } from 'lucide-react';

/**
 * TestDataPanel - Shows test data requirements for a state
 * 
 * Displays:
 * - Required context fields (inputs)
 * - Entry data (outputs)
 * - Data flow information
 */
export default function TestDataPanel({ state, projectPath, contextData, theme }) {
  
  // Transform contextData from contextWithTypes format
  const hasContext = contextData && Object.keys(contextData).length > 0;
  
  if (!contextData) {
    return (
      <div className="p-6 border rounded-lg" style={{ 
        background: theme.colors.background.secondary 
      }}>
        <div style={{ color: theme.colors.text.tertiary }}>
          Loading test data requirements...
        </div>
      </div>
    );
  }

  // Map contextWithTypes to old format for compatibility
  const context = hasContext 
    ? Object.fromEntries(
        Object.entries(contextData).map(([key, fieldData]) => [
          key, 
          fieldData.value
        ])
      )
    : {};

  const allContextFields = Object.entries(context);
  const missingValues = allContextFields.filter(([_, value]) => 
    value === null || value === undefined || value === ''
  );
  const isReady = hasContext && missingValues.length === 0;

  return (
    <div className="space-y-4">
      
      {/* Readiness Summary */}
      <div className="border-2 rounded-lg p-5" style={{ 
        background: isReady ? `${theme.colors.accents.green}10` : `${theme.colors.accents.orange}10`,
        borderColor: isReady ? theme.colors.accents.green : theme.colors.accents.orange
      }}>
        <div className="flex items-start gap-3">
          <div className="text-3xl">
            {isReady ? '✅' : '⚠️'}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-2" style={{ 
              color: isReady ? theme.colors.accents.green : theme.colors.accents.orange 
            }}>
              {isReady ? 'Ready for Testing!' : 'Action Required'}
            </h3>
            
            {isReady ? (
              <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                All required context fields have values. You can generate and run tests!
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  {missingValues.length === 0 ? (
                    'Add context fields to this state before running tests.'
                  ) : (
                    <>
                      <span className="font-semibold">{missingValues.length}</span> field{missingValues.length !== 1 ? 's' : ''} need{missingValues.length === 1 ? 's' : ''} values in your testData.json:
                    </>
                  )}
                </div>
                {missingValues.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {missingValues.map(([fieldName]) => (
                      <span 
                        key={fieldName}
                        className="text-xs px-2 py-1 rounded font-mono"
                        style={{ 
                          background: theme.colors.background.primary,
                          color: theme.colors.text.primary
                        }}
                      >
                        {fieldName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Required Context Section */}
      <div className="border rounded-lg p-5" style={{ 
        background: theme.colors.background.secondary 
      }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="text-2xl">📥</div>
          <h3 className="text-lg font-bold" style={{ color: theme.colors.text.primary }}>
            Required Context (Inputs)
          </h3>
        </div>

        {hasContext ? (
          <div className="space-y-3">
            {Object.entries(contextData).map(([key, fieldData]) => (
              <div 
                key={key}
                className="flex items-center justify-between p-3 rounded"
                style={{ 
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                <div>
                  <div className="font-mono font-semibold" style={{ color: theme.colors.text.primary }}>
                    {key}
                  </div>
                  <div className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                    Type: {fieldData.type}
                    {fieldData.source && ` • Source: ${fieldData.source}`}
                  </div>
                </div>
                <span 
                  className="text-xs px-2 py-1 rounded"
                  style={{ 
                    background: `${theme.colors.accents.green}20`,
                    color: theme.colors.accents.green
                  }}
                >
                  Required
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: theme.colors.text.tertiary }}>
            No context fields defined
          </div>
        )}
      </div>

      {loadedTestData && loadedTestData.data?.status && (
  <>
    <button
      onClick={() => {
        if (window.cytoscapeGraph?.highlightPathTo) {
          window.cytoscapeGraph.highlightPathTo(loadedTestData.data.status);
        }
      }}
      className="px-3 py-1.5 rounded-lg text-sm font-semibold transition hover:brightness-110"
      style={{
        background: defaultTheme.colors.accents.purple,
        color: 'white'
      }}
      title="Show path from initial to current testData status"
    >
      🛤️ Show Path
    </button>
    
    <button
      onClick={() => {
        if (window.cytoscapeGraph?.clearPathHighlight) {
          window.cytoscapeGraph.clearPathHighlight();
        }
      }}
      className="px-3 py-1.5 rounded-lg text-sm font-semibold transition hover:brightness-110"
      style={{
        background: defaultTheme.colors.background.tertiary,
        color: defaultTheme.colors.text.secondary,
        border: `1px solid ${defaultTheme.colors.border}`
      }}
      title="Clear path highlight"
    >
      👁️ Show All
    </button>
  </>
)}

      {/* Entry Data (Outputs) */}
<div className="border rounded-lg p-5" style={{ 
  background: theme.colors.background.secondary 
}}>
  <div className="flex items-center gap-2 mb-4">
    <div className="text-2xl">📤</div>
    <h3 className="text-lg font-bold" style={{ color: theme.colors.text.primary }}>
      State Output (What This State Creates)
    </h3>
  </div>

  {/* TODO: Get entry data from backend */}
  <div className="text-sm" style={{ color: theme.colors.text.tertiary }}>
    Entry data extraction coming soon
  </div>
</div>
    </div>
    
  );

  
}

/**
 * FieldDisplay - Shows a single field with type info and status
 */
function FieldDisplay({ name, value, theme, type, onFillSuggestion }) {
  const valueType = typeof value === 'object' && value !== null 
    ? (Array.isArray(value) ? 'array' : 'object')
    : typeof value;

  const typeColor = type === 'input' 
    ? theme.colors.accents.blue 
    : theme.colors.accents.green;

  // Determine field status
  const isEmpty = value === null || value === undefined;
  const isEmptyString = value === '';
  const isEmptyObject = typeof value === 'object' && value !== null && 
                        !Array.isArray(value) && Object.keys(value).length === 0;
  const needsAttention = isEmpty || isEmptyString || isEmptyObject;

  // Get smart suggestion for this field
  const suggestion = getSmartSuggestion(name, valueType);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border" style={{ 
      background: theme.colors.background.primary,
      borderColor: needsAttention ? theme.colors.accents.orange : theme.colors.background.tertiary
    }}>
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {needsAttention ? (
          <AlertCircle className="w-5 h-5" style={{ color: theme.colors.accents.orange }} />
        ) : (
          <CheckCircle className="w-5 h-5" style={{ color: typeColor }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Field Header */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-mono font-semibold" style={{ color: theme.colors.text.primary }}>
            {name}
          </span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ 
            background: `${typeColor}20`,
            color: typeColor 
          }}>
            {valueType}
          </span>
          {needsAttention && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ 
              background: `${theme.colors.accents.orange}20`,
              color: theme.colors.accents.orange 
            }}>
              needs value
            </span>
          )}
        </div>

        {/* Current Value */}
        <div className="text-sm font-mono mb-2" style={{ color: theme.colors.text.secondary }}>
          {value === null && <span style={{ color: theme.colors.text.tertiary }}>null</span>}
          {value === undefined && <span style={{ color: theme.colors.text.tertiary }}>undefined</span>}
          {isEmptyString && <span style={{ color: theme.colors.text.tertiary }}>""</span>}
          {typeof value === 'string' && value !== '' && `"${value}"`}
          {typeof value === 'number' && value}
          {typeof value === 'boolean' && String(value)}
          {typeof value === 'object' && value !== null && !isEmptyObject && (
            <pre className="text-xs mt-1 overflow-x-auto">
              {JSON.stringify(value, null, 2)}
            </pre>
          )}
          {isEmptyObject && <span style={{ color: theme.colors.text.tertiary }}>{'{}'}</span>}
        </div>

        {/* Guidance Section */}
        {needsAttention && (
          <div className="space-y-2">
            {/* Warning Message */}
            <div className="text-xs p-2 rounded" style={{ 
              background: `${theme.colors.accents.orange}10`,
              color: theme.colors.text.secondary
            }}>
              <div className="font-semibold mb-1" style={{ color: theme.colors.accents.orange }}>
                ⚠️ Action Required
              </div>
              <div>
                This field must be filled in your <code className="text-xs px-1 rounded" style={{
                  background: theme.colors.background.tertiary
                }}>testData.json</code> file before running tests.
              </div>
            </div>

            {/* Smart Suggestions */}
            {suggestion && (
              <div className="text-xs p-2 rounded" style={{ 
                background: `${theme.colors.accents.blue}10`,
                color: theme.colors.text.secondary
              }}>
                <div className="font-semibold mb-1" style={{ color: theme.colors.accents.blue }}>
                  💡 Suggestion
                </div>
                <div className="mb-2">{suggestion.description}</div>
                {suggestion.example && (
                  <div className="font-mono text-xs p-1.5 rounded" style={{ 
                    background: theme.colors.background.primary
                  }}>
                    {suggestion.example}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get smart suggestion for a field based on its name and type
 * Uses GENERIC patterns only - no project-specific values
 */
function getSmartSuggestion(fieldName, type) {
  const name = fieldName.toLowerCase();
  
  // Pattern: *Name fields (generic)
  if (name.includes('name') && !name.includes('file') && !name.includes('user')) {
    return {
      description: `A name identifier for ${fieldName}`,
      example: '"Example Name"'
    };
  }
  
  // Pattern: *Id fields (generic)
  if (name.includes('id') && !name.includes('valid')) {
    return {
      description: `A unique identifier for ${fieldName}`,
      example: '"example-id"'
    };
  }
  
  // Pattern: config (generic)
  if (name === 'config' || name.endsWith('config')) {
    return {
      description: 'Configuration object for test environment',
      example: '{ device: "desktop", lang: "en", ... }'
    };
  }
  
  // Pattern: *Date fields (generic)
  if (name.includes('date') && !name.includes('update') && !name.includes('created')) {
    return {
      description: 'Date value (check your project\'s date format)',
      example: '"YYYY-MM-DD" or "DD/MM/YYYY"'
    };
  }
  
  // Pattern: *Time/*At fields (generic)
  if (name.endsWith('time') || name.endsWith('at')) {
    return {
      description: 'Timestamp value',
      example: '"2025-01-01T12:00:00Z"'
    };
  }
  
  // Pattern: *Count/*Number fields (generic)
  if (name.includes('count') || name.includes('number') || name.endsWith('num')) {
    return {
      description: 'Numeric value',
      example: '0'
    };
  }
  
  // Pattern: is*/has* boolean fields (generic)
  if (name.startsWith('is') || name.startsWith('has') || name.startsWith('can')) {
    return {
      description: 'Boolean flag',
      example: 'true or false'
    };
  }
  
  // Pattern: status (generic)
  if (name === 'status') {
    return {
      description: 'Current state identifier',
      example: '"initial"'
    };
  }
  
  // Pattern: *Url/*Path fields (generic)
  if (name.includes('url') || name.includes('path') || name.includes('link')) {
    return {
      description: 'URL or path string',
      example: '"https://example.com" or "/path/to/resource"'
    };
  }
  
  // Type-based generic suggestions
  if (type === 'string') {
    return {
      description: `String value for ${fieldName}`,
      example: '"example-value"'
    };
  }
  
  if (type === 'number') {
    return {
      description: `Numeric value for ${fieldName}`,
      example: '0'
    };
  }
  
  if (type === 'boolean') {
    return {
      description: `Boolean value for ${fieldName}`,
      example: 'true or false'
    };
  }
  
  if (type === 'array') {
    return {
      description: `Array of values for ${fieldName}`,
      example: '[]'
    };
  }
  
  if (type === 'object') {
    return {
      description: `Object containing ${fieldName} data`,
      example: '{}'
    };
  }
  
  return null;
}