// packages/web-app/src/components/AddTransitionModal/DataFlowSummary.jsx
// 📊 Visual summary of data flow through a transition

import { useMemo, useState } from 'react';
import { extractDataFlow, validateDataFlow } from '../../utils/extractDataFlow';

export default function DataFlowSummary({ 
  formData, 
  testDataSchema = [], 
  availableFromPriorStates = [],
  theme 
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSources, setShowSources] = useState(false);
  
  const dataFlow = useMemo(() => extractDataFlow(formData), [formData]);
  
  const validation = useMemo(() => {
    const allAvailable = [
      ...testDataSchema,
      ...availableFromPriorStates.map(v => v.name || v.field || v)
    ];
    return validateDataFlow(dataFlow, allAvailable, availableFromPriorStates);
  }, [dataFlow, testDataSchema, availableFromPriorStates]);
  
  const hasContent = dataFlow.reads.length > 0 || dataFlow.writes.length > 0;
  if (!hasContent) return null;
  
  const hasIssues = validation.missing.length > 0;
  
  return (
    <div 
      className="rounded-lg overflow-hidden"
      style={{ 
        backgroundColor: theme.colors.background.tertiary,
        border: `1px solid ${hasIssues ? theme.colors.accents.orange : theme.colors.border}`
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:brightness-110 transition"
        style={{ backgroundColor: theme.colors.background.secondary }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-semibold" style={{ color: theme.colors.text.primary }}>
            Data Flow
          </span>
          
          <div className="flex gap-2 ml-2">
            {dataFlow.reads.length > 0 && (
              <span 
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${theme.colors.accents.blue}20`, color: theme.colors.accents.blue }}
              >
                📥 {dataFlow.reads.length}
              </span>
            )}
            {dataFlow.writes.length > 0 && (
              <span 
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${theme.colors.accents.green}20`, color: theme.colors.accents.green }}
              >
                📤 {dataFlow.writes.length}
              </span>
            )}
            {hasIssues && (
              <span 
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${theme.colors.accents.orange}20`, color: theme.colors.accents.orange }}
              >
                ⚠️ {validation.missing.length}
              </span>
            )}
          </div>
        </div>
        
        <span style={{ color: theme.colors.text.tertiary, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </button>
      
      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Toggle for sources */}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showSources}
              onChange={(e) => setShowSources(e.target.checked)}
              className="rounded"
            />
            <span style={{ color: theme.colors.text.tertiary }}>Show sources</span>
          </label>
          
          {/* READS Section */}
          {dataFlow.reads.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span>📥</span>
                <span className="text-sm font-semibold" style={{ color: theme.colors.accents.blue }}>
                  REQUIRES ({dataFlow.reads.length})
                </span>
              </div>
              
              <div className="space-y-1">
                {dataFlow.reads.map((read, i) => {
                  const isValid = validation.valid.some(v => v.field === read.field);
                  const isMissing = validation.missing.some(v => v.field === read.field);
                  const isStored = validation.fromStored.some(v => v.field === read.field);
                  const isWarning = validation.warnings.some(v => v.field === read.field);
                  
                  return (
                    <div 
                      key={i}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-sm"
                      style={{ backgroundColor: theme.colors.background.primary }}
                    >
                      {/* Status Icon */}
                      <span>
                        {read.required && '🔒'}
                        {!read.required && '  '}
                      </span>
                      
                      {/* Field Name */}
                      <span 
                        className="font-mono flex-1"
                        style={{ color: theme.colors.text.primary }}
                      >
                        {read.field}
                      </span>
                      
                      {/* Source (if enabled) */}
                      {showSources && (
                        <span 
                          className="text-xs truncate max-w-[200px]"
                          style={{ color: theme.colors.text.tertiary }}
                          title={read.sources.join(', ')}
                        >
                          ← {read.sources[0]}
                        </span>
                      )}
                      
                      {/* Validation Status */}
                      {isValid && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ backgroundColor: `${theme.colors.accents.green}20`, color: theme.colors.accents.green }}
                        >
                          ✓ data
                        </span>
                      )}
                      {isStored && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ backgroundColor: `${theme.colors.accents.yellow}20`, color: theme.colors.accents.yellow }}
                        >
                          💾 stored
                        </span>
                      )}
                      {isWarning && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ backgroundColor: `${theme.colors.accents.cyan}20`, color: theme.colors.accents.cyan }}
                        >
                          ? config
                        </span>
                      )}
                      {isMissing && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ backgroundColor: `${theme.colors.accents.orange}20`, color: theme.colors.accents.orange }}
                        >
                          ⚠️ missing
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* WRITES Section */}
          {dataFlow.writes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span>📤</span>
                <span className="text-sm font-semibold" style={{ color: theme.colors.accents.green }}>
                  PRODUCES ({dataFlow.writes.length})
                </span>
              </div>
              
              <div className="space-y-1">
                {dataFlow.writes.map((write, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-sm"
                    style={{ backgroundColor: theme.colors.background.primary }}
                  >
                    <span>{write.persist ? '💾' : '⏳'}</span>
                    
                    <span 
                      className="font-mono flex-1"
                      style={{ color: theme.colors.accents.yellow }}
                    >
                      {write.field}
                    </span>
                    
                    <span 
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: theme.colors.background.tertiary, color: theme.colors.text.tertiary }}
                    >
                      {write.type}
                    </span>
                    
                    {showSources && (
                      <span 
                        className="text-xs truncate max-w-[150px]"
                        style={{ color: theme.colors.text.tertiary }}
                      >
                        ← {write.source}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Missing Fields Warning */}
          {validation.missing.length > 0 && (
            <div 
              className="p-3 rounded-lg"
              style={{ 
                backgroundColor: `${theme.colors.accents.orange}15`,
                border: `1px solid ${theme.colors.accents.orange}40`
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span>⚠️</span>
                <span className="text-sm font-semibold" style={{ color: theme.colors.accents.orange }}>
                  {validation.missing.length} field{validation.missing.length !== 1 ? 's' : ''} not found in testData
                </span>
              </div>
              <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
                Add these to your testData.json or ai-testing.config.js schema:
                <span className="font-mono ml-1">
                  {validation.missing.map(m => m.field).join(', ')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}