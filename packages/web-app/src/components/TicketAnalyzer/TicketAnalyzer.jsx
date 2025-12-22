/**
 * TicketAnalyzer - Fixed version
 */

import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

export default function TicketAnalyzer({ projectPath, theme, onSelectState, onClose: externalClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const [ticketText, setTicketText] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [llmStatus, setLlmStatus] = useState({ available: false, checking: true });
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/llm/status`)
      .then(r => r.json())
      .then(data => setLlmStatus({ available: data.available, model: data.model, checking: false }))
      .catch(() => setLlmStatus({ available: false, checking: false }));
  }, []);

  const analyzeTicket = async () => {
    if (!ticketText.trim()) {
      setError('Please enter ticket text');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch(`${API_URL}/api/llm/analyze-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, ticketText, projectPath })
      });

      if (!response.ok) throw new Error((await response.json()).error);
      setAnalysis(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyCode = async (text, index) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const viewState = (status) => {
    // This opens the state detail modal in Visualizer
    if (onSelectState) {
      onSelectState(status);
    }
    // Keep modal open so user can view multiple states
  };

  const closeAndNavigate = (status) => {
    if (onSelectState) onSelectState(status);
    setIsOpen(false);
  };

  // Keyboard: Cmd+T
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        setIsOpen(o => !o);
      }
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 16px',
          background: theme.colors.background.tertiary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          color: theme.colors.text.secondary,
          cursor: 'pointer', fontSize: '14px'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = theme.colors.accents.purple; e.currentTarget.style.color = 'white'; }}
        onMouseLeave={e => { e.currentTarget.style.background = theme.colors.background.tertiary; e.currentTarget.style.color = theme.colors.text.secondary; }}
      >
        🎫 Analyze Ticket
        <kbd style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '11px' }}>⌘T</kbd>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '3vh', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)'
      }}
      onClick={e => e.target === e.currentTarget && setIsOpen(false)}
    >
      <div style={{
        width: '95%', maxWidth: '1000px', maxHeight: '94vh', overflow: 'auto',
        background: theme.colors.background.primary, borderRadius: '16px',
        border: `2px solid ${theme.colors.accents.purple}`,
        boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: theme.colors.background.secondary, position: 'sticky', top: 0, zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🎫</span>
            <div>
              <h2 style={{ margin: 0, color: theme.colors.text.primary, fontSize: '18px' }}>Ticket Analyzer</h2>
              <p style={{ margin: 0, color: theme.colors.text.tertiary, fontSize: '12px' }}>AI analyzes your ticket against existing tests</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px',
              background: llmStatus.available ? `${theme.colors.accents.green}20` : `${theme.colors.accents.red}20`,
              color: llmStatus.available ? theme.colors.accents.green : theme.colors.accents.red
            }}>
              {llmStatus.available ? `✓ ${llmStatus.model}` : '✗ AI Offline'}
            </span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: theme.colors.text.tertiary, cursor: 'pointer', fontSize: '24px' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Input */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <input
              placeholder="Ticket ID"
              value={ticketId}
              onChange={e => setTicketId(e.target.value)}
              style={{
                width: '120px', padding: '10px 14px',
                background: theme.colors.background.secondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px', color: theme.colors.text.primary, fontSize: '14px'
              }}
            />
            <button
              onClick={analyzeTicket}
              disabled={isAnalyzing || !llmStatus.available}
              style={{
                padding: '10px 20px',
                background: isAnalyzing ? theme.colors.background.tertiary : theme.colors.accents.purple,
                border: 'none', borderRadius: '8px', color: 'white',
                fontSize: '14px', fontWeight: 'bold', cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                opacity: isAnalyzing || !llmStatus.available ? 0.6 : 1
              }}
            >
              {isAnalyzing ? '⏳ Analyzing...' : '🔍 Analyze'}
            </button>
          </div>

          <textarea
            placeholder="Paste your ticket description here..."
            value={ticketText}
            onChange={e => setTicketText(e.target.value)}
            style={{
              width: '100%', minHeight: '80px', padding: '12px 16px',
              background: theme.colors.background.secondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px', color: theme.colors.text.primary,
              fontSize: '14px', resize: 'vertical', fontFamily: 'inherit'
            }}
          />

          {error && (
            <div style={{ marginTop: '12px', padding: '12px', background: `${theme.colors.accents.red}15`, borderRadius: '8px', color: theme.colors.accents.red }}>
              ❌ {error}
            </div>
          )}

          {/* Results */}
          {analysis && (
            <Results analysis={analysis} theme={theme} onViewState={viewState} onCopy={copyCode} copiedIndex={copiedIndex} />
          )}
        </div>
      </div>
    </div>
  );
}

function Results({ analysis, theme, onViewState, onCopy, copiedIndex }) {
  const { parsed, existingCoverage, llmExistingCoverage, gaps, recommendations } = analysis;

  return (
    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Understanding */}
      {parsed?.feature && (
        <Section title="📋 Understanding" theme={theme}>
          <p style={{ margin: 0, color: theme.colors.text.secondary }}>{parsed.feature}</p>
          {parsed.actors?.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
              {parsed.actors.map((a, i) => <Tag key={i} color={theme.colors.accents.blue}>{a}</Tag>)}
            </div>
          )}
          {parsed.expectedResults?.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <strong style={{ color: theme.colors.text.primary, fontSize: '13px' }}>Expected:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '20px', color: theme.colors.text.secondary, fontSize: '13px' }}>
                {parsed.expectedResults.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Existing Coverage */}
      {existingCoverage?.length > 0 && (
        <Section title="✅ Related States Found" theme={theme}>
          {existingCoverage.map((item, i) => (
            <div key={i} style={{
              padding: '10px 14px', marginBottom: '8px',
              background: `${theme.colors.accents.green}10`, borderRadius: '8px',
              border: `1px solid ${theme.colors.accents.green}30`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ color: theme.colors.accents.green }}>✓</span>
                <strong style={{ color: theme.colors.text.primary, marginLeft: '8px' }}>{item.status}</strong>
                <span style={{ color: theme.colors.text.tertiary, marginLeft: '8px', fontSize: '12px' }}>{item.description}</span>
              </div>
              <button
                onClick={() => onViewState(item.status)}
                style={{
                  padding: '5px 12px', background: theme.colors.accents.green,
                  border: 'none', borderRadius: '4px', color: 'white', fontSize: '12px', cursor: 'pointer'
                }}
              >
                View Details →
              </button>
            </div>
          ))}
        </Section>
      )}

      {/* LLM Analysis */}
      {llmExistingCoverage?.details && (
        <Section title="🔍 AI Analysis of Coverage" theme={theme}>
          <div style={{ padding: '12px', background: theme.colors.background.secondary, borderRadius: '8px', color: theme.colors.text.secondary, fontSize: '14px', lineHeight: '1.5' }}>
            {llmExistingCoverage.details}
          </div>
        </Section>
      )}

      {/* Gaps */}
      {gaps?.length > 0 && (
        <Section title="⚠️ Gaps Found" theme={theme}>
          {gaps.map((gap, i) => (
            <div key={i} style={{
              padding: '12px', marginBottom: '8px',
              background: `${theme.colors.accents.yellow}10`, borderRadius: '8px',
              border: `1px solid ${theme.colors.accents.yellow}30`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag color={gap.severity === 'HIGH' ? theme.colors.accents.red : theme.colors.accents.yellow}>{gap.severity || 'MEDIUM'}</Tag>
                <span style={{ color: theme.colors.text.primary }}>{gap.description}</span>
              </div>
              {gap.targetState && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: theme.colors.text.tertiary }}>
                  📍 {gap.targetState} → {gap.targetPlatform} → {gap.targetScreen}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Recommendations with Code */}
      {recommendations?.length > 0 && (
        <Section title="💡 Recommendations" theme={theme}>
          {recommendations.map((rec, i) => (
            <div key={i} style={{
              marginBottom: '16px', background: theme.colors.background.secondary,
              borderRadius: '8px', border: `1px solid ${theme.colors.border}`, overflow: 'hidden'
            }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Tag color={rec.priority === 'HIGH' ? theme.colors.accents.red : theme.colors.accents.purple}>{rec.priority}</Tag>
                  <span style={{ marginLeft: '8px', color: theme.colors.text.primary, fontWeight: '500' }}>{rec.title}</span>
                </div>
                {rec.code && (
                  <button
                    onClick={() => onCopy(rec.code, i)}
                    style={{
                      padding: '5px 12px',
                      background: copiedIndex === i ? theme.colors.accents.green : theme.colors.accents.purple,
                      border: 'none', borderRadius: '4px', color: 'white', fontSize: '12px', cursor: 'pointer'
                    }}
                  >
                    {copiedIndex === i ? '✓ Copied!' : '📋 Copy'}
                  </button>
                )}
              </div>
              
              {rec.description && (
                <div style={{ padding: '10px 16px', color: theme.colors.text.secondary, fontSize: '13px' }}>
                  {rec.description}
                  {rec.targetFile && <div style={{ marginTop: '4px', color: theme.colors.text.tertiary }}>📁 {rec.targetFile}</div>}
                </div>
              )}
              
              {rec.code && (
                <pre style={{
                  margin: 0, padding: '16px', fontSize: '12px',
                  color: '#a0aec0', background: '#1a1a2e', overflow: 'auto', maxHeight: '200px'
                }}>
                  <code>{rec.code}</code>
                </pre>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* AI Reasoning */}
      {parsed?.analysis && (
        <Section title="💭 AI Reasoning" theme={theme}>
          <div style={{ padding: '12px', background: theme.colors.background.secondary, borderRadius: '8px', color: theme.colors.text.secondary, fontSize: '14px', lineHeight: '1.6' }}>
            {parsed.analysis}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, theme, children }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 10px', color: theme.colors.text.primary, fontSize: '15px', fontWeight: '600' }}>{title}</h3>
      {children}
    </div>
  );
}

function Tag({ color, children }) {
  return (
    <span style={{
      padding: '3px 8px', background: `${color}20`, color,
      borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase'
    }}>
      {children}
    </span>
  );
}