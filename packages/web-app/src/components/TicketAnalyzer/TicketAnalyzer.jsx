/**
 * TicketAnalyzer - Paste a ticket, get test recommendations
 * 
 * Features:
 * - Paste ticket text (JIRA, GitHub, Slack)
 * - AI analyzes requirements
 * - Shows existing test coverage
 * - Recommends what to add
 * - Can generate validation blocks or new states
 */

import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

export default function TicketAnalyzer({ projectPath, theme, onNavigateToState }) {
  const [isOpen, setIsOpen] = useState(false);
  const [ticketText, setTicketText] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [llmStatus, setLlmStatus] = useState({ available: false, checking: true });

  // Check LLM status on mount
  useEffect(() => {
    checkLlmStatus();
  }, []);

  const checkLlmStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/llm/status`);
      const data = await response.json();
      setLlmStatus({ available: data.available, model: data.model, checking: false });
    } catch (err) {
      setLlmStatus({ available: false, checking: false, error: err.message });
    }
  };

  const analyzeTicket = async () => {
    if (!ticketText.trim()) {
      setError('Please enter ticket text to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch(`${API_URL}/api/llm/analyze-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticketId || 'TICKET',
          ticketText: ticketText,
          projectPath: projectPath
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Keyboard shortcut: Ctrl+T or Cmd+T
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: theme.colors.background.tertiary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          color: theme.colors.text.secondary,
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = theme.colors.accents.purple;
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = theme.colors.background.tertiary;
          e.currentTarget.style.color = theme.colors.text.secondary;
        }}
      >
        <span>🎫</span>
        <span>Analyze Ticket</span>
        <kbd style={{
          padding: '2px 6px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '4px',
          fontSize: '11px'
        }}>⌘T</kbd>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '5vh',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          background: theme.colors.background.primary,
          borderRadius: '16px',
          border: `2px solid ${theme.colors.accents.purple}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: theme.colors.background.secondary
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🎫</span>
            <div>
              <h2 style={{ 
                margin: 0, 
                color: theme.colors.text.primary,
                fontSize: '20px'
              }}>
                Ticket Analyzer
              </h2>
              <p style={{ 
                margin: 0, 
                color: theme.colors.text.tertiary,
                fontSize: '13px'
              }}>
                Paste ticket text → Get test recommendations
              </p>
            </div>
          </div>
          
          {/* LLM Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '4px 12px',
              borderRadius: '20px',
              background: llmStatus.available 
                ? `${theme.colors.accents.green}20` 
                : `${theme.colors.accents.red}20`,
              color: llmStatus.available 
                ? theme.colors.accents.green 
                : theme.colors.accents.red,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{llmStatus.checking ? '⏳' : llmStatus.available ? '✓' : '✗'}</span>
              {llmStatus.checking ? 'Checking...' : llmStatus.available ? `AI: ${llmStatus.model}` : 'AI Offline'}
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colors.text.tertiary,
                cursor: 'pointer',
                fontSize: '24px',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Input Section */}
          <div style={{ marginBottom: '24px' }}>
            {/* Ticket ID */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px',
                color: theme.colors.text.secondary,
                fontSize: '13px'
              }}>
                Ticket ID (optional)
              </label>
              <input
                type="text"
                placeholder="SC-14500, JIRA-123, etc."
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                style={{
                  width: '200px',
                  padding: '8px 12px',
                  background: theme.colors.background.secondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  color: theme.colors.text.primary,
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Ticket Text */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px',
                color: theme.colors.text.secondary,
                fontSize: '13px'
              }}>
                Ticket Description / Requirements
              </label>
              <textarea
                placeholder={`Paste your ticket here...

Example:
"When a dancer cancels an accepted booking, the manager should:
1. See a push notification about the cancellation
2. The booking should be removed from the 'Accepted' list
3. The booking should appear in 'Cancelled' section with timestamp"`}
                value={ticketText}
                onChange={(e) => setTicketText(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '12px 16px',
                  background: theme.colors.background.secondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  color: theme.colors.text.primary,
                  fontSize: '14px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Analyze Button */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={analyzeTicket}
                disabled={isAnalyzing || !llmStatus.available}
                style={{
                  padding: '12px 24px',
                  background: isAnalyzing 
                    ? theme.colors.background.tertiary 
                    : theme.colors.accents.purple,
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (isAnalyzing || !llmStatus.available) ? 0.6 : 1
                }}
              >
                {isAnalyzing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    Analyze Ticket
                  </>
                )}
              </button>

              {!llmStatus.available && !llmStatus.checking && (
                <span style={{ color: theme.colors.accents.red, fontSize: '13px' }}>
                  ⚠️ AI not available. Check your API key in .env
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: `${theme.colors.accents.red}15`,
              border: `1px solid ${theme.colors.accents.red}40`,
              borderRadius: '8px',
              color: theme.colors.accents.red,
              marginBottom: '24px'
            }}>
              ❌ {error}
            </div>
          )}

          {/* Analysis Results */}
          {analysis && (
            <AnalysisResults 
              analysis={analysis} 
              theme={theme} 
              onNavigateToState={onNavigateToState}
              onClose={() => setIsOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Analysis Results Component
 */
function AnalysisResults({ analysis, theme, onNavigateToState, onClose }) {
  const { parsed, existingCoverage, gaps, recommendations, suggestedStates } = analysis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Parsed Understanding */}
      {parsed && (
        <Section title="📋 Understood Requirements" theme={theme}>
          <div style={{ display: 'grid', gap: '12px' }}>
            {parsed.feature && (
              <div>
                <Label theme={theme}>Feature</Label>
                <Value theme={theme}>{parsed.feature}</Value>
              </div>
            )}
            
            {parsed.actors?.length > 0 && (
              <div>
                <Label theme={theme}>Actors</Label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {parsed.actors.map((actor, i) => (
                    <Tag key={i} color={theme.colors.accents.blue}>{actor}</Tag>
                  ))}
                </div>
              </div>
            )}
            
            {parsed.preconditions?.length > 0 && (
              <div>
                <Label theme={theme}>Preconditions</Label>
                <ul style={{ margin: 0, paddingLeft: '20px', color: theme.colors.text.secondary }}>
                  {parsed.preconditions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {parsed.actions?.length > 0 && (
              <div>
                <Label theme={theme}>Actions</Label>
                <ul style={{ margin: 0, paddingLeft: '20px', color: theme.colors.text.secondary }}>
                  {parsed.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {parsed.expectedResults?.length > 0 && (
              <div>
                <Label theme={theme}>Expected Results</Label>
                <ul style={{ margin: 0, paddingLeft: '20px', color: theme.colors.text.secondary }}>
                  {parsed.expectedResults.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Existing Coverage */}
      {existingCoverage?.length > 0 && (
        <Section title="✅ Existing Test Coverage" theme={theme}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {existingCoverage.map((item, i) => (
              <div 
                key={i}
                style={{
                  padding: '12px 16px',
                  background: `${theme.colors.accents.green}10`,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.accents.green}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <span style={{ color: theme.colors.accents.green, marginRight: '8px' }}>✓</span>
                  <span style={{ color: theme.colors.text.primary, fontWeight: '500' }}>
                    {item.status || item.id}
                  </span>
                  {item.description && (
                    <span style={{ color: theme.colors.text.tertiary, marginLeft: '8px' }}>
                      — {item.description}
                    </span>
                  )}
                </div>
                {item.status && onNavigateToState && (
                  <button
                    onClick={() => {
                      onNavigateToState(item.status);
                      onClose();
                    }}
                    style={{
                      padding: '4px 12px',
                      background: theme.colors.accents.green,
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    View →
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Gaps */}
      {gaps?.length > 0 && (
        <Section title="⚠️ Missing Coverage" theme={theme}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gaps.map((gap, i) => (
              <div 
                key={i}
                style={{
                  padding: '12px 16px',
                  background: `${theme.colors.accents.yellow}10`,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.accents.yellow}30`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ color: theme.colors.accents.yellow }}>⚠️</span>
                  <div>
                    <div style={{ color: theme.colors.text.primary, fontWeight: '500' }}>
                      {gap.description || gap.action || gap}
                    </div>
                    {gap.suggestion && (
                      <div style={{ 
                        color: theme.colors.text.tertiary, 
                        fontSize: '13px',
                        marginTop: '4px'
                      }}>
                        💡 {gap.suggestion}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recommendations */}
      {recommendations?.length > 0 && (
        <Section title="💡 Recommendations" theme={theme}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recommendations.map((rec, i) => (
              <div 
                key={i}
                style={{
                  padding: '16px',
                  background: theme.colors.background.secondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    padding: '2px 8px',
                    background: theme.colors.accents.purple,
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    {rec.priority || `#${i + 1}`}
                  </span>
                  <span style={{ 
                    color: theme.colors.text.primary, 
                    fontWeight: '600' 
                  }}>
                    {rec.title || rec.action}
                  </span>
                </div>
                
                {rec.description && (
                  <p style={{ 
                    margin: '0 0 12px 0', 
                    color: theme.colors.text.secondary,
                    fontSize: '14px'
                  }}>
                    {rec.description}
                  </p>
                )}
                
                {rec.code && (
                  <pre style={{
                    margin: 0,
                    padding: '12px',
                    background: theme.colors.background.primary,
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: theme.colors.text.secondary,
                    overflow: 'auto'
                  }}>
                    {rec.code}
                  </pre>
                )}
                
                {rec.targetFile && (
                  <div style={{ 
                    marginTop: '8px',
                    fontSize: '12px',
                    color: theme.colors.text.tertiary
                  }}>
                    📁 Add to: <code>{rec.targetFile}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Suggested New States */}
      {suggestedStates?.length > 0 && (
        <Section title="🆕 Suggested New States" theme={theme}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {suggestedStates.map((state, i) => (
              <div 
                key={i}
                style={{
                  padding: '16px',
                  background: `${theme.colors.accents.blue}10`,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.accents.blue}30`
                }}
              >
                <div style={{ 
                  fontWeight: 'bold', 
                  color: theme.colors.accents.blue,
                  marginBottom: '8px'
                }}>
                  {state.status}
                </div>
                {state.description && (
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    color: theme.colors.text.secondary,
                    fontSize: '14px'
                  }}>
                    {state.description}
                  </p>
                )}
                {state.transitions && (
                  <div style={{ fontSize: '13px', color: theme.colors.text.tertiary }}>
                    Transitions: {state.transitions.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Raw Response (for debugging) */}
      {analysis.raw && (
        <details style={{ marginTop: '12px' }}>
          <summary style={{ 
            cursor: 'pointer', 
            color: theme.colors.text.tertiary,
            fontSize: '12px'
          }}>
            View raw AI response
          </summary>
          <pre style={{
            marginTop: '8px',
            padding: '12px',
            background: theme.colors.background.secondary,
            borderRadius: '8px',
            fontSize: '11px',
            color: theme.colors.text.tertiary,
            overflow: 'auto',
            maxHeight: '200px'
          }}>
            {JSON.stringify(analysis.raw, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Helper Components
 */
function Section({ title, theme, children }) {
  return (
    <div>
      <h3 style={{ 
        margin: '0 0 12px 0', 
        color: theme.colors.text.primary,
        fontSize: '16px',
        fontWeight: '600'
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Label({ theme, children }) {
  return (
    <div style={{ 
      fontSize: '12px', 
      color: theme.colors.text.tertiary,
      marginBottom: '4px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    }}>
      {children}
    </div>
  );
}

function Value({ theme, children }) {
  return (
    <div style={{ 
      color: theme.colors.text.primary,
      fontSize: '15px'
    }}>
      {children}
    </div>
  );
}

function Tag({ color, children }) {
  return (
    <span style={{
      padding: '4px 10px',
      background: `${color}20`,
      color: color,
      borderRadius: '4px',
      fontSize: '13px',
      fontWeight: '500'
    }}>
      {children}
    </span>
  );
}