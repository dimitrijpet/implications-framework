// packages/web-app/src/components/SuggestionsPanel/SuggestionsPanel.jsx

import { useState, useEffect } from 'react';
import './SuggestionsPanel.css';

export default function SuggestionsPanel({ 
  analysis, 
  currentInput, 
  onApply, 
  theme,
  isOpen = true,
  mode = 'add'  // 'add' or 'edit'
}) {
  const [expanded, setExpanded] = useState({
    buttons: true,
    fields: true,
    setup: true
  });

  if (!analysis || analysis.noData) {
    return (
      <div 
        className="suggestions-panel no-data"
        style={{
          background: `${theme.colors.background.tertiary}80`,
          border: `1px solid ${theme.colors.border}`
        }}
      >
        <div style={{ color: theme.colors.text.tertiary, textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💡</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            No patterns detected yet
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>
            Scan a project with multiple states to see smart suggestions
          </div>
        </div>
      </div>
    );
  }

  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="suggestions-panel" style={{ marginTop: '24px' }}>
      {/* Header */}
      <div className="suggestions-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>💡</span>
          <h3 style={{ 
            margin: 0, 
            color: theme.colors.primary,
            fontSize: '16px',
            fontWeight: 600
          }}>
            Smart Suggestions
          </h3>
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: theme.colors.text.tertiary 
        }}>
          {mode === 'edit' 
            ? 'Suggestions based on other states'
            : `Based on ${analysis.totalStates} states`
          }
        </div>
      </div>

      {/* Button Patterns */}
      {analysis.buttons && !analysis.buttons.noData && (
        <SuggestionSection
          title="🔘 Button Naming"
          expanded={expanded.buttons}
          onToggle={() => toggleSection('buttons')}
          theme={theme}
        >
          <ButtonSuggestions 
            data={analysis.buttons}
            currentInput={currentInput}
            onApply={onApply}
            theme={theme}
            mode={mode}
          />
        </SuggestionSection>
      )}

      {/* Required Fields */}
      {analysis.fields && !analysis.fields.noData && (
        <SuggestionSection
          title="📋 Required Fields"
          expanded={expanded.fields}
          onToggle={() => toggleSection('fields')}
          theme={theme}
        >
          <FieldSuggestions 
            data={analysis.fields}
            onApply={onApply}
            theme={theme}
            mode={mode}
          />
        </SuggestionSection>
      )}

      {/* Setup Actions */}
      {analysis.setup && !analysis.setup.noData && (
        <SuggestionSection
          title="⚙️ Setup Actions"
          expanded={expanded.setup}
          onToggle={() => toggleSection('setup')}
          theme={theme}
        >
          <SetupSuggestions 
            data={analysis.setup}
            onApply={onApply}
            theme={theme}
            mode={mode}
          />
        </SuggestionSection>
      )}

      {/* Platform Distribution */}
      {analysis.platforms && (
        <div 
          className="platform-info"
          style={{
            marginTop: '16px',
            padding: '12px',
            background: `${theme.colors.background.tertiary}60`,
            borderRadius: '8px',
            fontSize: '12px',
            color: theme.colors.text.tertiary
          }}
        >
          <strong>Platform Distribution:</strong>{' '}
          {analysis.platforms.distribution.map((p, i) => (
            <span key={p.platform}>
              {p.platform} ({p.percentage})
              {i < analysis.platforms.distribution.length - 1 && ', '}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Collapsible Section Component
function SuggestionSection({ title, expanded, onToggle, children, theme }) {
  return (
    <div 
      className="suggestion-section"
      style={{
        marginBottom: '16px',
        background: `${theme.colors.background.tertiary}80`,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      <button
        className="section-header"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          color: theme.colors.text.primary,
          fontWeight: 600,
          fontSize: '14px'
        }}
      >
        <span>{title}</span>
        <span style={{ 
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)'
        }}>
          ▼
        </span>
      </button>
      
      {expanded && (
        <div 
          className="section-content"
          style={{
            padding: '16px',
            borderTop: `1px solid ${theme.colors.border}`
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Button Suggestions Component
function ButtonSuggestions({ data, currentInput, onApply, theme, mode }) {
  const { convention, mostCommon, topVerbs, examples } = data;

  // Generate smart suggestions based on state name
  const generateSuggestions = () => {
    if (!currentInput?.stateName) return [];
    
    const suggestions = [];
    const stateName = currentInput.stateName;
    const parts = stateName.split('_');
    
    // Get the last word as potential object
    const object = parts[parts.length - 1]?.toUpperCase() || 'BOOKING';
    
    // Top verbs + object
    if (topVerbs && topVerbs.length > 0) {
      topVerbs.slice(0, 3).forEach(({ verb }) => {
        if (convention.pattern === 'VERB_OBJECT') {
          suggestions.push({
            value: `${verb}_${object}`,
            confidence: convention.confidence
          });
        } else if (convention.pattern === 'SINGLE_VERB') {
          suggestions.push({
            value: verb,
            confidence: convention.confidence
          });
        }
      });
    }
    
    return suggestions;
  };

  const suggestions = generateSuggestions();

  return (
    <div>
      {/* Pattern Info */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        background: `${theme.colors.primary}15`,
        borderRadius: '6px'
      }}>
        <div style={{ 
          fontSize: '13px', 
          color: theme.colors.text.secondary,
          marginBottom: '8px'
        }}>
          <strong>Detected Pattern:</strong> {convention.pattern}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: theme.colors.text.tertiary 
        }}>
          Confidence: {(convention.confidence * 100).toFixed(0)}%
        </div>
        {examples && examples.length > 0 && (
          <div style={{ 
            fontSize: '12px', 
            color: theme.colors.text.tertiary,
            marginTop: '8px'
          }}>
            Examples: {examples.join(', ')}
          </div>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && currentInput?.stateName && (
        <div>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600,
            color: theme.colors.text.primary,
            marginBottom: '12px'
          }}>
            Suggested for "{currentInput.stateName}":
          </div>
          
          {suggestions.map((suggestion, index) => (
            <div 
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                marginBottom: '8px',
                background: theme.colors.background.secondary,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`
              }}
            >
              <div>
                <div style={{ 
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: theme.colors.text.primary,
                  fontWeight: 600
                }}>
                  {suggestion.value}
                </div>
                <div style={{ 
                  fontSize: '11px',
                  color: theme.colors.text.tertiary,
                  marginTop: '2px'
                }}>
                  {(suggestion.confidence * 100).toFixed(0)}% match
                </div>
              </div>
              
              <button
                onClick={() => onApply('triggerButton', suggestion.value)}
                style={{
                  padding: '6px 12px',
                  background: theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
              >
                {mode === 'edit' ? 'Replace' : 'Apply'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Most Common Buttons */}
      {mostCommon && Object.keys(mostCommon).length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600,
            color: theme.colors.text.primary,
            marginBottom: '8px'
          }}>
            Most Common:
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px' 
          }}>
            {Object.entries(mostCommon).map(([button, freq]) => (
              <span
                key={button}
                style={{
                  padding: '4px 8px',
                  background: theme.colors.background.secondary,
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: theme.colors.text.secondary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                {button} ({(freq * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Field Suggestions Component - IMPROVED VERSION
function FieldSuggestions({ data, onApply, theme, mode }) {
  const { required, context, all, mostCommon, commonCombinations } = data;

  // Use required fields if available, fallback to mostCommon
  const requiredFields = required || mostCommon || [];
  const contextFields = context || [];

  // Fields with >50% usage from required fields
  const highConfidenceFields = requiredFields.filter(f => 
    parseFloat(f.frequency) > 0.5
  );

  return (
    <div>
      {/* Required Fields Section */}
      {requiredFields.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600,
            color: theme.colors.text.primary,
            marginBottom: '4px'
          }}>
            Required Fields:
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: theme.colors.text.tertiary,
            marginBottom: '12px'
          }}>
            From meta.requiredFields
          </div>
          
          {highConfidenceFields.length > 0 ? (
            <>
              {highConfidenceFields.map((field) => (
                <div 
                  key={field.field}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    marginBottom: '8px',
                    background: theme.colors.background.secondary,
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      color: theme.colors.text.primary,
                      fontWeight: 600
                    }}>
                      {field.field}
                    </div>
                    <div style={{ 
                      fontSize: '11px',
                      color: theme.colors.text.tertiary,
                      marginTop: '2px'
                    }}>
                      Used in {field.percentage} of states
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onApply('addField', field.field)}
                    style={{
                      padding: '6px 12px',
                      background: theme.colors.accents.green,
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                  >
                    {mode === 'edit' ? 'Add' : 'Add'}
                  </button>
                </div>
              ))}
              
              {/* Apply All Button */}
              {highConfidenceFields.length > 1 && (
                <button
                  onClick={() => onApply('addAllFields', highConfidenceFields.map(f => f.field))}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: `${theme.colors.accents.green}20`,
                    color: theme.colors.accents.green,
                    border: `2px solid ${theme.colors.accents.green}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  ✓ Add All Common Fields
                </button>
              )}
            </>
          ) : (
            <div style={{ 
              fontSize: '12px', 
              color: theme.colors.text.tertiary,
              fontStyle: 'italic',
              padding: '8px'
            }}>
              No highly common required fields detected
            </div>
          )}
        </div>
      )}

      {/* Context Fields Section */}
      {contextFields.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600,
            color: theme.colors.text.primary,
            marginBottom: '4px'
          }}>
            Context Fields:
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: theme.colors.text.tertiary,
            marginBottom: '8px'
          }}>
            From xstateConfig.entry (read-only reference)
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px' 
          }}>
            {contextFields.slice(0, 10).map((field) => (
              <span
                key={field.field}
                style={{
                  padding: '4px 8px',
                  background: `${theme.colors.accents.blue}20`,
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: theme.colors.accents.blue,
                  border: `1px solid ${theme.colors.accents.blue}40`
                }}
              >
                {field.field} ({field.percentage})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* All Fields */}
      {requiredFields.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600,
            color: theme.colors.text.primary,
            marginBottom: '8px'
          }}>
            All Required Fields:
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px' 
          }}>
            {requiredFields.map((field) => (
              <span
                key={field.field}
                style={{
                  padding: '4px 8px',
                  background: theme.colors.background.secondary,
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: theme.colors.text.secondary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                {field.field} ({field.percentage})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Common Combinations */}
      {commonCombinations && commonCombinations.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600,
            color: theme.colors.text.primary,
            marginBottom: '8px'
          }}>
            Common Combinations:
          </div>
          {commonCombinations.map((combo, index) => (
            <div 
              key={index}
              style={{
                padding: '8px',
                background: `${theme.colors.primary}10`,
                borderRadius: '4px',
                fontSize: '11px',
                marginBottom: '6px',
                color: theme.colors.text.secondary
              }}
            >
              {combo.fields.join(' + ')} ({(combo.frequency * 100).toFixed(0)}%)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Setup Suggestions Component - IMPROVED VERSION
function SetupSuggestions({ data, onApply, theme, mode }) {
  const { mostCommon } = data;

  // Actions with >60% usage
  const highConfidenceActions = mostCommon?.filter(s => 
    parseFloat(s.frequency) > 0.6
  ) || [];

  return (
    <div>
      {highConfidenceActions.length > 0 ? (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600,
            color: theme.colors.text.primary,
            marginBottom: '12px'
          }}>
            Recommended Setup:
          </div>
          
          {highConfidenceActions.map((action) => (
            <div 
              key={action.action}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                marginBottom: '8px',
                background: theme.colors.background.secondary,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: theme.colors.text.primary,
                  fontWeight: 600
                }}>
                  {action.action}
                </div>
                <div style={{ 
                  fontSize: '11px',
                  color: theme.colors.text.tertiary,
                  marginTop: '2px'
                }}>
                  Used in {action.percentage} of states
                </div>
              </div>
              
              <button
                onClick={() => onApply('addSetup', action.action)}
                style={{
                  padding: '6px 12px',
                  background: theme.colors.accents.blue,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
              >
                {mode === 'edit' ? 'Add' : 'Add'}
              </button>
            </div>
          ))}

          {/* Apply All Button */}
          {highConfidenceActions.length > 1 && (
            <button
              onClick={() => onApply('addAllSetup', highConfidenceActions.map(s => s.action))}
              style={{
                width: '100%',
                padding: '10px',
                background: `${theme.colors.accents.blue}20`,
                color: theme.colors.accents.blue,
                border: `2px solid ${theme.colors.accents.blue}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '8px'
              }}
            >
              ✓ {mode === 'edit' ? 'Replace with Common Setup' : 'Add All Common Setup'}
            </button>
          )}
        </div>
      ) : (
        <div style={{ 
          fontSize: '12px', 
          color: theme.colors.text.tertiary,
          fontStyle: 'italic',
          padding: '8px',
          marginBottom: '16px'
        }}>
          No highly common setup actions detected
        </div>
      )}

      {/* All Actions */}
      {mostCommon && mostCommon.length > 0 && (
        <div>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600,
            color: theme.colors.text.primary,
            marginBottom: '8px'
          }}>
            All Setup Actions:
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px' 
          }}>
            {mostCommon.map((action) => (
              <span
                key={action.action}
                style={{
                  padding: '4px 8px',
                  background: theme.colors.background.secondary,
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: theme.colors.text.secondary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                {action.action} ({action.percentage})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}