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
export default function TestDataPanel({ state, projectPath, theme }) {
  const [contextData, setContextData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!state?.files?.implication || !projectPath) {
      return;
    }

    fetchContextData();
  }, [state?.files?.implication, projectPath]);

  const fetchContextData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/context/extract?projectPath=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(state.files.implication)}`
      );

      const data = await response.json();

      if (data.success) {
        setContextData(data);
      } else {
        setError(data.error || 'Failed to extract context');
      }
    } catch (err) {
      console.error('Failed to fetch context:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 border rounded-lg" style={{ 
        background: theme.colors.background.secondary,
        borderColor: theme.colors.background.tertiary 
      }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: theme.colors.accents.blue }}></div>
          <span style={{ color: theme.colors.text.secondary }}>
            Loading test data requirements...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border rounded-lg" style={{ 
        background: `${theme.colors.accents.red}10`,
        borderColor: theme.colors.accents.red 
      }}>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5" style={{ color: theme.colors.accents.red }} />
          <span style={{ color: theme.colors.accents.red }}>
            Failed to load context: {error}
          </span>
        </div>
      </div>
    );
  }

  if (!contextData) {
    return null;
  }

  const hasContext = contextData.hasContext && Object.keys(contextData.context).length > 0;
  const hasEntry = contextData.hasEntry && Object.keys(contextData.entry).length > 0;
  const hasRequiredFields = contextData.requiredFields && contextData.requiredFields.length > 0;

  return (
    <div className="space-y-4">
      
      {/* ========================================
          REQUIRED FIELDS (from meta)
          ======================================== */}
      {hasRequiredFields && (
        <div className="border rounded-lg p-5" style={{ 
          background: `${theme.colors.accents.orange}10`,
          borderColor: theme.colors.accents.orange 
        }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="text-2xl">⚠️</div>
            <h3 className="text-lg font-bold" style={{ color: theme.colors.text.primary }}>
              Required Fields (Must Be Present)
            </h3>
          </div>

          <div className="space-y-2">
            {contextData.requiredFields.map((fieldName) => (
              <div key={fieldName} className="flex items-center gap-2 p-2 rounded" style={{ 
                background: theme.colors.background.primary 
              }}>
                <AlertCircle className="w-4 h-4" style={{ color: theme.colors.accents.orange }} />
                <span className="font-mono font-semibold" style={{ color: theme.colors.text.primary }}>
                  {fieldName}
                </span>
                <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                  (required for this state)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* ========================================
          REQUIRED CONTEXT (INPUTS)
          ======================================== */}
      <div className="border rounded-lg p-5" style={{ 
        background: theme.colors.background.secondary,
        borderColor: theme.colors.background.tertiary 
      }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="text-2xl">📥</div>
          <h3 className="text-lg font-bold" style={{ color: theme.colors.text.primary }}>
            Required Context (Inputs)
          </h3>
        </div>

        {hasContext ? (
          <div className="space-y-3">
            {Object.entries(contextData.context).map(([key, value]) => (
              <FieldDisplay 
                key={key}
                name={key}
                value={value}
                theme={theme}
                type="input"
              />
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: theme.colors.text.tertiary }}>
            No context fields defined
          </div>
        )}
      </div>

      {/* ========================================
          ENTRY DATA (OUTPUTS)
          ======================================== */}
      <div className="border rounded-lg p-5" style={{ 
        background: theme.colors.background.secondary,
        borderColor: theme.colors.background.tertiary 
      }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="text-2xl">📤</div>
          <h3 className="text-lg font-bold" style={{ color: theme.colors.text.primary }}>
            State Output (What This State Creates)
          </h3>
        </div>

        {hasEntry ? (
          <div className="space-y-3">
            {Object.entries(contextData.entry).map(([key, value]) => (
              <FieldDisplay 
                key={key}
                name={key}
                value={value}
                theme={theme}
                type="output"
              />
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: theme.colors.text.tertiary }}>
            No entry data defined
          </div>
        )}
      </div>

      {/* ========================================
          DATA FLOW INFO
          ======================================== */}
      {(hasContext || hasEntry) && (
        <div className="border rounded-lg p-5" style={{ 
          background: `${theme.colors.accents.blue}10`,
          borderColor: theme.colors.accents.blue 
        }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-2xl">🔗</div>
            <h3 className="text-lg font-bold" style={{ color: theme.colors.text.primary }}>
              Data Flow
            </h3>
          </div>

          <div className="space-y-2 text-sm" style={{ color: theme.colors.text.secondary }}>
            {hasContext && (
              <div className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" 
                            style={{ color: theme.colors.accents.blue }} />
                <div>
                  <span className="font-semibold">This state needs:</span>
                  <span className="ml-1">
                    {Object.keys(contextData.context).join(', ')}
                  </span>
                  <div className="text-xs mt-1" style={{ color: theme.colors.text.tertiary }}>
                    These fields must be provided by previous states or test setup
                  </div>
                </div>
              </div>
            )}

            {hasEntry && (
              <div className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" 
                            style={{ color: theme.colors.accents.green }} />
                <div>
                  <span className="font-semibold">This state creates:</span>
                  <span className="ml-1">
                    {Object.keys(contextData.entry).join(', ')}
                  </span>
                  <div className="text-xs mt-1" style={{ color: theme.colors.text.tertiary }}>
                    These fields will be available to subsequent states
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================
          FUTURE: TEMPLATE GENERATION BUTTON
          ======================================== */}
      {/* Placeholder for Phase 2 */}
      <div className="border border-dashed rounded-lg p-4 text-center" style={{ 
        borderColor: theme.colors.background.tertiary 
      }}>
        <FileJson className="w-8 h-8 mx-auto mb-2" 
                  style={{ color: theme.colors.text.tertiary }} />
        <div className="text-sm" style={{ color: theme.colors.text.tertiary }}>
          Template generation coming in Phase 2
        </div>
      </div>
    </div>
  );
}

/**
 * FieldDisplay - Shows a single field with type info
 */
function FieldDisplay({ name, value, theme, type }) {
  const valueType = typeof value === 'object' && value !== null 
    ? (Array.isArray(value) ? 'array' : 'object')
    : typeof value;

  const typeColor = type === 'input' 
    ? theme.colors.accents.blue 
    : theme.colors.accents.green;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ 
      background: theme.colors.background.primary 
    }}>
      <div className="flex-shrink-0">
        {value === null || value === undefined ? (
          <AlertCircle className="w-5 h-5" style={{ color: theme.colors.accents.orange }} />
        ) : (
          <CheckCircle className="w-5 h-5" style={{ color: typeColor }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-mono font-semibold" style={{ color: theme.colors.text.primary }}>
            {name}
          </span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ 
            background: `${typeColor}20`,
            color: typeColor 
          }}>
            {valueType}
          </span>
        </div>

        <div className="text-sm font-mono" style={{ color: theme.colors.text.secondary }}>
          {value === null && 'null'}
          {value === undefined && 'undefined'}
          {typeof value === 'string' && `"${value}"`}
          {typeof value === 'number' && value}
          {typeof value === 'boolean' && String(value)}
          {typeof value === 'object' && value !== null && (
            <pre className="text-xs mt-1 overflow-x-auto">
              {JSON.stringify(value, null, 2)}
            </pre>
          )}
        </div>

        {(value === null || value === undefined) && (
          <div className="text-xs mt-2" style={{ color: theme.colors.accents.orange }}>
            ⚠️ This field needs to be filled in testData
          </div>
        )}
      </div>
    </div>
  );
}