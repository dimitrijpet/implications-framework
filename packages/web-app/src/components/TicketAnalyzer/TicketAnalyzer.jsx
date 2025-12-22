/**
 * TicketAnalyzer - With test scenarios
 */

import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

export default function TicketAnalyzer({ projectPath, theme, onSelectState }) {
  const [isOpen, setIsOpen] = useState(false);
  const [ticketText, setTicketText] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [llmStatus, setLlmStatus] = useState({ available: false });
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/llm/status`)
      .then(r => r.json())
      .then(data => setLlmStatus({ available: data.available, model: data.model }))
      .catch(() => setLlmStatus({ available: false }));
  }, []);

  const analyzeTicket = async () => {
    if (!ticketText.trim()) { setError('Please enter ticket text'); return; }
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

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') { e.preventDefault(); setIsOpen(o => !o); }
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: theme.colors.background.tertiary, border: `1px solid ${theme.colors.border}`, borderRadius: '8px', color: theme.colors.text.secondary, cursor: 'pointer', fontSize: '14px' }}
        onMouseEnter={e => { e.currentTarget.style.background = theme.colors.accents.purple; e.currentTarget.style.color = 'white'; }}
        onMouseLeave={e => { e.currentTarget.style.background = theme.colors.background.tertiary; e.currentTarget.style.color = theme.colors.text.secondary; }}>
        🎫 Analyze Ticket <kbd style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '11px' }}>⌘T</kbd>
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '2vh', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && setIsOpen(false)}>
      <div style={{ width: '95%', maxWidth: '1100px', maxHeight: '96vh', overflow: 'auto', background: theme.colors.background.primary, borderRadius: '16px', border: `2px solid ${theme.colors.accents.purple}`, boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.colors.background.secondary, position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🎫</span>
            <h2 style={{ margin: 0, color: theme.colors.text.primary, fontSize: '17px' }}>Ticket Analyzer</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ padding: '4px 10px', borderRadius: '16px', fontSize: '11px', background: llmStatus.available ? `${theme.colors.accents.green}20` : `${theme.colors.accents.red}20`, color: llmStatus.available ? theme.colors.accents.green : theme.colors.accents.red }}>
              {llmStatus.available ? `✓ ${llmStatus.model}` : '✗ Offline'}
            </span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: theme.colors.text.tertiary, cursor: 'pointer', fontSize: '20px' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px' }}>
          {/* Input */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input placeholder="ID" value={ticketId} onChange={e => setTicketId(e.target.value)}
              style={{ width: '80px', padding: '8px 12px', background: theme.colors.background.secondary, border: `1px solid ${theme.colors.border}`, borderRadius: '6px', color: theme.colors.text.primary, fontSize: '13px' }} />
            <textarea placeholder="Paste ticket description here..."
              value={ticketText} onChange={e => setTicketText(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', background: theme.colors.background.secondary, border: `1px solid ${theme.colors.border}`, borderRadius: '6px', color: theme.colors.text.primary, fontSize: '13px', resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }} />
            <button onClick={analyzeTicket} disabled={isAnalyzing || !llmStatus.available}
              style={{ padding: '8px 16px', background: isAnalyzing ? theme.colors.background.tertiary : theme.colors.accents.purple, border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 'bold', cursor: isAnalyzing ? 'not-allowed' : 'pointer', opacity: isAnalyzing || !llmStatus.available ? 0.6 : 1, whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
              {isAnalyzing ? '⏳...' : '🔍 Analyze'}
            </button>
          </div>

          {error && <div style={{ padding: '10px', background: `${theme.colors.accents.red}15`, borderRadius: '6px', color: theme.colors.accents.red, fontSize: '13px' }}>❌ {error}</div>}

          {analysis && <Results analysis={analysis} theme={theme} onCopy={copyCode} copiedIndex={copiedIndex} />}
        </div>
      </div>
    </div>
  );
}

function Results({ analysis, theme, onCopy, copiedIndex }) {
  const { parsed, gaps, recommendations, newMethods } = analysis;

  // Group recommendations by platform/screen
  const grouped = {};
  for (const rec of (recommendations || [])) {
    const key = `${rec.platform}.${rec.screen}`;
    if (!grouped[key]) grouped[key] = { platform: rec.platform, screen: rec.screen, blocks: [] };
    grouped[key].blocks.push(rec);
  }

  return (
    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Understanding */}
      {parsed?.feature && (
        <Section title="📋 Understanding" theme={theme}>
          <p style={{ margin: 0, color: theme.colors.text.secondary, fontSize: '13px', lineHeight: '1.5' }}>{parsed.feature}</p>
        </Section>
      )}

      {/* Test Scenarios */}
      {parsed?.testScenarios?.length > 0 && (
        <Section title="🧪 Test Scenarios" theme={theme}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {parsed.testScenarios.map((scenario, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', background: theme.colors.background.secondary, borderRadius: '6px' }}>
                <span style={{ color: theme.colors.accents.purple, fontWeight: '600' }}>{i + 1}.</span>
                <span style={{ color: theme.colors.text.secondary, fontSize: '13px' }}>{scenario}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* New Methods */}
      {newMethods?.length > 0 && (
        <Section title="🔧 New POM Methods" theme={theme}>
          <div style={{ padding: '8px 12px', background: `${theme.colors.accents.orange}10`, borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: theme.colors.accents.orange }}>
            ⚠️ Add these methods to your POM files first
          </div>
          {newMethods.map((m, i) => (
            <div key={i} style={{ marginBottom: '12px', background: theme.colors.background.secondary, borderRadius: '8px', overflow: 'hidden', border: `1px solid ${theme.colors.accents.orange}40` }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Tag color={theme.colors.accents.orange}>NEW</Tag>
                  <code style={{ marginLeft: '8px', color: theme.colors.accents.cyan, fontSize: '12px' }}>{m.methodName}()</code>
                </div>
                <button onClick={() => onCopy(m.code, `method-${i}`)}
                  style={{ padding: '4px 10px', background: copiedIndex === `method-${i}` ? theme.colors.accents.green : theme.colors.accents.orange, border: 'none', borderRadius: '4px', color: 'white', fontSize: '11px', cursor: 'pointer' }}>
                  {copiedIndex === `method-${i}` ? '✓' : '📋'}
                </button>
              </div>
              <div style={{ padding: '6px 14px', fontSize: '11px', color: theme.colors.text.tertiary }}>📁 {m.pomPath}</div>
              <pre style={{ margin: 0, padding: '12px 14px', fontSize: '11px', color: '#a0aec0', background: '#0d1117', overflow: 'auto' }}>
                <code>{m.code}</code>
              </pre>
            </div>
          ))}
        </Section>
      )}

      {/* Blocks by Screen */}
      {Object.keys(grouped).length > 0 && (
        <Section title="📝 Validation Blocks" theme={theme}>
          <div style={{ padding: '8px 12px', background: `${theme.colors.accents.blue}10`, borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: theme.colors.accents.blue }}>
            💡 Each block runs only when its conditions are met. The framework handles the logic.
          </div>
          {Object.entries(grouped).map(([key, group]) => (
            <ScreenGroup key={key} group={group} theme={theme} onCopy={onCopy} copiedIndex={copiedIndex} />
          ))}
        </Section>
      )}

      {/* Analysis */}
      {parsed?.analysis && (
        <Section title="💭 Analysis" theme={theme} collapsed>
          <p style={{ margin: 0, color: theme.colors.text.tertiary, fontSize: '12px', lineHeight: '1.5' }}>{parsed.analysis}</p>
        </Section>
      )}
    </div>
  );
}

function ScreenGroup({ group, theme, onCopy, copiedIndex }) {
  const { platform, screen, blocks } = group;
  const allBlocksCode = blocks.map(b => b.blockCode).join(',\n\n');
  
  return (
    <div style={{ marginBottom: '16px', background: theme.colors.background.secondary, borderRadius: '8px', overflow: 'hidden', border: `1px solid ${theme.colors.border}` }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: theme.colors.background.tertiary, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tag color={theme.colors.accents.blue}>{platform}</Tag>
          <span style={{ color: theme.colors.text.primary, fontWeight: '600', fontSize: '14px' }}>{screen}</span>
        </div>
        <button onClick={() => onCopy(allBlocksCode, `screen-${platform}-${screen}`)}
          style={{ padding: '5px 12px', background: copiedIndex === `screen-${platform}-${screen}` ? theme.colors.accents.green : theme.colors.accents.purple, border: 'none', borderRadius: '4px', color: 'white', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
          {copiedIndex === `screen-${platform}-${screen}` ? '✓ Copied!' : '📋 Copy All'}
        </button>
      </div>
      
      {/* Location */}
      <div style={{ padding: '8px 16px', fontSize: '11px', color: theme.colors.text.tertiary, background: theme.colors.background.primary, borderBottom: `1px solid ${theme.colors.border}` }}>
        📍 <code style={{ color: theme.colors.accents.cyan }}>mirrorsOn.UI.{platform}.{screen}.blocks[]</code>
      </div>
      
      {/* Blocks */}
      {blocks.map((rec, i) => (
        <BlockCard key={i} rec={rec} theme={theme} onCopy={onCopy} copiedIndex={copiedIndex} index={`block-${platform}-${screen}-${i}`} isLast={i === blocks.length - 1} />
      ))}
    </div>
  );
}

function BlockCard({ rec, theme, onCopy, copiedIndex, index, isLast }) {
  return (
    <div style={{ borderBottom: isLast ? 'none' : `1px solid ${theme.colors.border}` }}>
      {/* Block header */}
      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
            {rec.methodExists ? (
              <Tag color={theme.colors.accents.green}>✓ exists</Tag>
            ) : (
              <Tag color={theme.colors.accents.orange}>⚠️ new method</Tag>
            )}
            {rec.hasConditions && (
              <Tag color={theme.colors.accents.cyan}>conditional</Tag>
            )}
          </div>
          <p style={{ margin: 0, color: theme.colors.text.primary, fontSize: '13px', fontWeight: '500' }}>{rec.description}</p>
          
          {/* Method info */}
          <div style={{ marginTop: '4px', fontSize: '11px', color: theme.colors.text.tertiary }}>
            <code style={{ color: theme.colors.accents.green }}>{rec.method}()</code>
            {rec.pomPath && <span> • {rec.pomPath}</span>}
          </div>
          
          {/* Notes */}
          {rec.notes && (
            <div style={{ marginTop: '6px', padding: '6px 10px', background: `${theme.colors.accents.yellow}10`, borderRadius: '4px', fontSize: '11px', color: theme.colors.accents.yellow }}>
              💡 {rec.notes}
            </div>
          )}
          
          {/* Conditions */}
          {rec.conditions && rec.conditions.length > 0 && (
            <div style={{ marginTop: '8px', padding: '8px 12px', background: `${theme.colors.accents.cyan}08`, borderRadius: '6px', border: `1px solid ${theme.colors.accents.cyan}20` }}>
              <div style={{ fontSize: '11px', color: theme.colors.accents.cyan, fontWeight: '600', marginBottom: '4px' }}>
                📋 Runs when ALL conditions are true:
              </div>
              {rec.conditions.map((c, ci) => (
                <div key={ci} style={{ fontSize: '12px', color: theme.colors.text.secondary, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: theme.colors.text.tertiary }}>•</span>
                  <code style={{ color: theme.colors.accents.yellow, background: `${theme.colors.accents.yellow}10`, padding: '1px 4px', borderRadius: '3px' }}>{c.field}</code>
                  <span style={{ color: theme.colors.text.tertiary }}>{c.operator}</span>
                  {c.value ? (
                    <code style={{ color: theme.colors.accents.green, background: `${theme.colors.accents.green}10`, padding: '1px 4px', borderRadius: '3px' }}>"{c.value}"</code>
                  ) : (
                    <span style={{ color: theme.colors.text.tertiary, fontStyle: 'italic' }}>(any truthy)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => onCopy(rec.blockCode, index)}
          style={{ padding: '4px 10px', background: copiedIndex === index ? theme.colors.accents.green : theme.colors.accents.purple, border: 'none', borderRadius: '4px', color: 'white', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>
          {copiedIndex === index ? '✓' : '📋'}
        </button>
      </div>
      
      {/* Code */}
      <pre style={{ margin: 0, padding: '12px 16px', fontSize: '11px', color: '#a0aec0', background: '#0d1117', overflow: 'auto', maxHeight: '300px' }}>
        <code>{rec.blockCode}</code>
      </pre>
    </div>
  );
}

function Section({ title, theme, children, collapsed }) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  return (
    <div>
      <h3 onClick={() => collapsed && setIsCollapsed(!isCollapsed)}
        style={{ margin: '0 0 10px', color: theme.colors.text.primary, fontSize: '14px', fontWeight: '600', cursor: collapsed ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {title}
        {collapsed && <span style={{ fontSize: '10px', color: theme.colors.text.tertiary }}>{isCollapsed ? '▶' : '▼'}</span>}
      </h3>
      {!isCollapsed && children}
    </div>
  );
}

function Tag({ color, children }) {
  return <span style={{ padding: '2px 6px', background: `${color}20`, color, borderRadius: '4px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>{children}</span>;
}