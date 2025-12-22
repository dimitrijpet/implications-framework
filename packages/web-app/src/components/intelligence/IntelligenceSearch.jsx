/**
 * IntelligenceSearch - React component for Intelligence Layer UI
 * 
 * Features:
 * - ⌘K keyboard shortcut to open
 * - Debounced search with autocomplete
 * - Result cards by type (state/transition/validation)
 * - Chain preview on state results
 * - LLM explanation button
 * - Ticket number highlighting
 * 
 * Usage:
 *   <IntelligenceSearch 
 *     projectPath="/path/to/project"
 *     onSelectResult={(result) => navigateTo(result)}
 *     theme={yourTheme}
 *   />
 * 
 * @module IntelligenceSearch
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIntelligenceSearch } from '../../hooks/useIntelligenceSearch';

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT THEME
// ═══════════════════════════════════════════════════════════════════════════

const defaultTheme = {
  colors: {
    background: {
      primary: '#1a1a2e',
      secondary: '#16213e',
      tertiary: '#0f3460'
    },
    text: {
      primary: '#e8e8e8',
      secondary: '#a0a0a0',
      tertiary: '#707070'
    },
    accents: {
      blue: '#4da8da',
      purple: '#9d4edd',
      cyan: '#00d4aa',
      orange: '#ff6b35',
      yellow: '#ffd700',
      red: '#ff4757'
    },
    border: '#2a2a4a'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function IntelligenceSearch({ 
  projectPath,
  testDataPath,
  onSelectResult,
  theme = defaultTheme,
  defaultOpen = false
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTypes, setActiveTypes] = useState(['states', 'transitions', 'validations']);
  const inputRef = useRef(null);
  
  const {
    query,
    results,
    suggestions,
    loading,
    error,
    explanation,
    llmEnabled,
    stats,
    search,
    getSuggestions,
    explain,
    clear,
    hasResults
  } = useIntelligenceSearch({ 
    projectPath, 
    testDataPath,
    enrichChains: true 
  });

  // Keyboard shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        clear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clear]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    search(value, { types: activeTypes });
    getSuggestions(value);
  }, [search, getSuggestions, activeTypes]);

  const handleTypeToggle = (type) => {
    const newTypes = activeTypes.includes(type)
      ? activeTypes.filter(t => t !== type)
      : [...activeTypes, type];
    
    if (newTypes.length > 0) {
      setActiveTypes(newTypes);
      if (query) {
        search(query, { types: newTypes, immediate: true });
      }
    }
  };

const handleResultClick = (result) => {
  if (onSelectResult) {
    onSelectResult(result);
  }
  setIsOpen(false);  // ← ADD THIS LINE
};

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  // Compact trigger button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '8px',
          background: theme.colors.background.secondary,
          border: `1px solid ${theme.colors.border}`,
          color: theme.colors.text.secondary,
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        <span>🔍</span>
        <span>Search implications...</span>
        <kbd style={{
          marginLeft: 'auto',
          padding: '2px 6px',
          borderRadius: '4px',
          background: theme.colors.background.tertiary,
          color: theme.colors.text.tertiary,
          fontSize: '11px'
        }}>
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      paddingTop: '100px'
    }} onClick={() => setIsOpen(false)}>
      <div 
        style={{
          width: '700px',
          maxHeight: '80vh',
          background: theme.colors.background.primary,
          borderRadius: '16px',
          border: `1px solid ${theme.colors.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Header */}
        <div style={{ padding: '16px', borderBottom: `1px solid ${theme.colors.border}` }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              defaultValue={query}
              onChange={handleInputChange}
              placeholder="Search states, transitions, validations, tickets..."
              style={{
                width: '100%',
                padding: '12px 16px',
                paddingLeft: '40px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.background.secondary,
                color: theme.colors.text.primary,
                fontSize: '16px',
                outline: 'none'
              }}
            />
            <span style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              opacity: 0.5
            }}>
              {loading ? '⏳' : '🔍'}
            </span>
          </div>
          
          {/* Type Filters */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginTop: '12px',
            flexWrap: 'wrap'
          }}>
            <FilterChip 
              label="States" 
              active={activeTypes.includes('states')}
              onClick={() => handleTypeToggle('states')}
              theme={theme}
              color={theme.colors.accents.blue}
            />
            <FilterChip 
              label="Transitions" 
              active={activeTypes.includes('transitions')}
              onClick={() => handleTypeToggle('transitions')}
              theme={theme}
              color={theme.colors.accents.purple}
            />
            <FilterChip 
              label="Validations" 
              active={activeTypes.includes('validations')}
              onClick={() => handleTypeToggle('validations')}
              theme={theme}
              color={theme.colors.accents.cyan}
            />
            
            {/* Stats */}
            {stats && (
              <div style={{
                marginLeft: 'auto',
                color: theme.colors.text.tertiary,
                fontSize: '12px'
              }}>
                {stats.counts?.states || 0} states · {stats.counts?.transitions || 0} transitions · {stats.ticketsIndexed || 0} tickets
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          padding: '8px'
        }}>
          {error && (
            <div style={{
              padding: '16px',
              background: `${theme.colors.accents.red}20`,
              borderRadius: '8px',
              color: theme.colors.accents.red,
              margin: '8px'
            }}>
              ❌ {error}
            </div>
          )}
          
          {!hasResults && query && !loading && (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.text.tertiary
            }}>
              No results found for "{query}"
            </div>
          )}
          
          {hasResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
{results.map((result, i) => (
  <ResultCard
    key={`${result.type}-${result.id}-${i}-${result.score}`} 
                  result={result}
                  onClick={() => handleResultClick(result)}
                  theme={theme}
                />
              ))}
            </div>
          )}
          
          {/* Suggestions */}
          {suggestions.length > 0 && !hasResults && (
            <div style={{ padding: '8px' }}>
              <div style={{ 
                color: theme.colors.text.tertiary, 
                fontSize: '12px',
                marginBottom: '8px'
              }}>
                Suggestions:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => search(s, { immediate: true })}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: `1px solid ${theme.colors.border}`,
                      background: theme.colors.background.secondary,
                      color: theme.colors.text.secondary,
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* LLM Explanation */}
        {llmEnabled && hasResults && (
          <div style={{ 
            padding: '12px 16px',
            borderTop: `1px solid ${theme.colors.border}`,
            background: theme.colors.background.secondary
          }}>
            {explanation ? (
              <div style={{
                padding: '12px',
                background: theme.colors.background.primary,
                borderRadius: '8px',
                color: theme.colors.text.primary,
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
                {explanation}
              </div>
            ) : (
              <button
                onClick={explain}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: theme.colors.accents.purple,
                  color: 'white',
                  cursor: loading ? 'wait' : 'pointer',
                  fontSize: '14px',
                  opacity: loading ? 0.6 : 1
                }}
              >
                <span>✨</span>
                <span>{loading ? 'Thinking...' : 'Explain this flow'}</span>
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: theme.colors.text.tertiary,
          fontSize: '12px'
        }}>
          <span>
            <kbd style={{ padding: '2px 4px', background: theme.colors.background.tertiary, borderRadius: '3px' }}>↑</kbd>
            <kbd style={{ padding: '2px 4px', background: theme.colors.background.tertiary, borderRadius: '3px', marginLeft: '2px' }}>↓</kbd>
            <span style={{ marginLeft: '4px' }}>Navigate</span>
            <span style={{ margin: '0 8px' }}>·</span>
            <kbd style={{ padding: '2px 4px', background: theme.colors.background.tertiary, borderRadius: '3px' }}>Enter</kbd>
            <span style={{ marginLeft: '4px' }}>Select</span>
            <span style={{ margin: '0 8px' }}>·</span>
            <kbd style={{ padding: '2px 4px', background: theme.colors.background.tertiary, borderRadius: '3px' }}>Esc</kbd>
            <span style={{ marginLeft: '4px' }}>Close</span>
          </span>
          <span>
            {llmEnabled ? '🤖 AI enabled' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function FilterChip({ label, active, onClick, theme, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: '16px',
        border: active ? `1px solid ${color}` : `1px solid ${theme.colors.border}`,
        background: active ? `${color}20` : 'transparent',
        color: active ? color : theme.colors.text.secondary,
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.2s ease'
      }}
    >
      {label}
    </button>
  );
}

function ResultCard({ result, onClick, theme }) {
  const { id, type, text, score, metadata, chain, matchType } = result;
  
  // Type-specific styling
  const typeConfig = {
    state: { emoji: '📍', color: theme.colors.accents.blue },
    transition: { emoji: '➡️', color: theme.colors.accents.purple },
    validation: { emoji: '✓', color: theme.colors.accents.cyan },
    condition: { emoji: '🔍', color: theme.colors.accents.orange },
    setup: { emoji: '🔧', color: theme.colors.accents.yellow }
  };
  
  const config = typeConfig[type] || typeConfig.state;
  
  // Highlight ticket numbers
  const highlightTickets = (text) => {
    return text.replace(
      /([A-Z]+-\d+)/g,
      `<span style="color: ${theme.colors.accents.yellow}; font-weight: bold;">$1</span>`
    );
  };
  
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        background: theme.colors.background.secondary,
        border: `1px solid ${theme.colors.border}`,
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = theme.colors.background.tertiary;
        e.currentTarget.style.borderColor = config.color;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = theme.colors.background.secondary;
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px' }}>{config.emoji}</span>
        <span style={{ 
          fontWeight: 'bold', 
          color: config.color,
          flex: 1
        }}>
          {metadata?.statusLabel || metadata?.event || id.split('.').pop()}
        </span>
        <span style={{
          padding: '2px 8px',
          borderRadius: '12px',
          background: `${config.color}20`,
          color: config.color,
          fontSize: '11px',
          textTransform: 'uppercase'
        }}>
          {type}
        </span>
        {metadata?.platform && (
          <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            background: theme.colors.background.tertiary,
            color: theme.colors.text.tertiary,
            fontSize: '11px'
          }}>
            {metadata.platform}
          </span>
        )}
        <span style={{
          padding: '2px 6px',
          borderRadius: '4px',
          background: theme.colors.background.tertiary,
          color: theme.colors.text.tertiary,
          fontSize: '10px',
          fontFamily: 'monospace'
        }}>
          {score}
        </span>
      </div>
      
      {/* Text preview */}
      <p 
        style={{
          margin: 0,
          color: theme.colors.text.secondary,
          fontSize: '13px',
          lineHeight: '1.4',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        dangerouslySetInnerHTML={{ 
          __html: highlightTickets(text.split('|')[0].substring(0, 120)) 
        }}
      />
      
      {/* Chain preview (for states) */}
      {chain?.steps?.length > 0 && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap'
        }}>
          <span style={{ 
            color: theme.colors.text.tertiary, 
            fontSize: '11px',
            marginRight: '4px'
          }}>
            Chain:
          </span>
          {chain.steps.slice(0, 5).map((step, i) => (
            <React.Fragment key={step}>
              <span style={{
                padding: '2px 6px',
                borderRadius: '4px',
                background: theme.colors.background.tertiary,
                color: theme.colors.text.secondary,
                fontSize: '11px'
              }}>
                {typeof step === 'string' ? step : step.status}
              </span>
              {i < Math.min(chain.steps.length - 1, 4) && (
                <span style={{ color: theme.colors.text.tertiary, fontSize: '10px' }}>→</span>
              )}
            </React.Fragment>
          ))}
          {chain.steps.length > 5 && (
            <span style={{ color: theme.colors.text.tertiary, fontSize: '11px' }}>
              +{chain.steps.length - 5} more
            </span>
          )}
        </div>
      )}
      
      {/* Transition details */}
      {type === 'transition' && metadata && (
        <div style={{
          marginTop: '6px',
          color: theme.colors.text.tertiary,
          fontSize: '11px'
        }}>
          {metadata.from} → {metadata.to}
          {metadata.description && ` · ${metadata.description.substring(0, 50)}`}
        </div>
      )}
      
      {/* Validation details */}
      {type === 'validation' && metadata?.screen && (
        <div style={{
          marginTop: '6px',
          color: theme.colors.text.tertiary,
          fontSize: '11px'
        }}>
          Screen: {metadata.screen}
          {metadata.blockType && metadata.blockType !== 'screen' && ` · ${metadata.blockType}`}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default IntelligenceSearch;