// packages/web-app/src/components/AIAssistant/ImplicationUpdatePanel.jsx

import { useState, useEffect, useMemo, useRef } from 'react';

const API_URL = 'http://localhost:3000';

export default function ImplicationUpdatePanel({ 
  projectPath, 
  capturedElements,
  patterns = {},
  compoundMethods = [],
  screenName,
  platform,
  theme,
  onComplete,
  onCancel,
  onCompoundMethodsChange  // ADD THIS
}) {
  const [implications, setImplications] = useState([]);
  const [selectedImpl, setSelectedImpl] = useState(null);
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedNew, setSelectedNew] = useState(new Set());
  const [selectedMethods, setSelectedMethods] = useState(new Set());
  const [viewMode, setViewMode] = useState('grouped');
  const [expandedGroups, setExpandedGroups] = useState(new Set(['compound', 'new']));
  const [mergeOptions, setMergeOptions] = useState({
    includeCompoundMethods: true
  });

  useEffect(() => {
    loadImplications();
  }, [projectPath]);

  useEffect(() => {
    if (diff) {
      setSelectedNew(new Set(diff.new.map(n => n.name)));
    }
  }, [diff]);

  // Auto-select all compound methods
  // Auto-select all compound methods
  useEffect(() => {
    if (compoundMethods?.length > 0) {
      setSelectedMethods(new Set(compoundMethods.map((_, i) => i)));
    }
  }, [compoundMethods?.length]);

  // Track previous selection to avoid infinite loops
  const prevSelectionRef = useRef(null);

  useEffect(() => {
    if (onCompoundMethodsChange && compoundMethods.length > 0) {
      const selected = compoundMethods.filter((_, i) => selectedMethods.has(i));
      const selectionKey = [...selectedMethods].sort().join(',');
      
      if (prevSelectionRef.current !== selectionKey) {
        prevSelectionRef.current = selectionKey;
        onCompoundMethodsChange(selected);
      }
    }
  }, [selectedMethods]);

  // Group elements by pattern
  const groupedElements = useMemo(() => {
    if (!diff) return { unique: [], coveredByCompound: [] };
    
    const repeatedPrefixes = new Set(
      (patterns?.repeatedLabels || []).map(r => r.prefix.toLowerCase())
    );
    
    const unique = [];
    const coveredByCompound = [];
    
    diff.new.forEach((el) => {
      const labelPrefix = (el.label || el.name || '').split(',')[0].trim().toLowerCase();
      const isRepeated = repeatedPrefixes.has(labelPrefix);
      
      if (isRepeated) {
        coveredByCompound.push(el);
      } else {
        unique.push(el);
      }
    });
    
    return { unique, coveredByCompound };
  }, [diff, patterns]);

  const hasCompoundMethods = compoundMethods && compoundMethods.length > 0;

  const loadImplications = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(
        `${API_URL}/api/ai-assistant/list-implications?projectPath=${encodeURIComponent(projectPath)}`
      );
      const data = await res.json();
      
      if (data.success) {
        setImplications(data.implications);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImpl = async (impl) => {
    setSelectedImpl(impl);
    setDiff(null);
    setComparing(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/ai-assistant/compare-implication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: impl.fullPath,
          elements: capturedElements,
          platform,
          screenName
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setDiff(data.diff);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Comparison failed: ' + e.message);
    } finally {
      setComparing(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedImpl || !diff) return;
    
    setMerging(true);
    setError(null);
    
    try {
      const filteredDiff = {
        new: diff.new.filter(n => selectedNew.has(n.name)),
        existing: diff.existing
      };
      
      const filteredCompoundMethods = mergeOptions.includeCompoundMethods
        ? compoundMethods.filter((_, i) => selectedMethods.has(i))
        : [];
      
      const instanceName = screenName.charAt(0).toLowerCase() + screenName.slice(1);
      const targetPlatform = mergeOptions.targetPlatform || platform;

      console.log('🔍 Sending implication merge:', {
        filteredDiff,
        filteredCompoundMethods: filteredCompoundMethods.map(m => m.name),
        mergeOptions
      });
      
      const res = await fetch(`${API_URL}/api/ai-assistant/merge-implication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: selectedImpl.fullPath,
          diff: filteredDiff,
          compoundMethods: filteredCompoundMethods,
          options: { platform: targetPlatform, screenName, instanceName, ...mergeOptions }
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        onComplete?.(data);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Merge failed: ' + e.message);
    } finally {
      setMerging(false);
    }
  };

  const toggleNew = (name) => {
    setSelectedNew(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleMethod = (index) => {
    setSelectedMethods(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // List view
  if (!selectedImpl) {
    return (
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ margin: 0, color: theme.colors.text.primary, fontSize: '18px' }}>
            📋 Select Implication to Update
          </h3>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 12px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              color: theme.colors.text.secondary,
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            ← Back
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: theme.colors.text.tertiary }}>
            ⏳ Loading implications...
          </div>
        ) : implications.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            background: theme.colors.background.tertiary,
            borderRadius: '8px',
            color: theme.colors.text.secondary
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
            <div>No existing implications found</div>
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="🔍 Filter by name or status..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: '12px',
                background: theme.colors.background.tertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                color: theme.colors.text.primary,
                fontSize: '13px'
              }}
            />
            
            <div style={{
              maxHeight: '350px',
              overflowY: 'auto',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px'
            }}>
              {implications
                .filter(impl => 
                  !searchFilter || 
                  impl.className?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  impl.status?.toLowerCase().includes(searchFilter.toLowerCase())
                )
                .map((impl, idx) => (
                  <div
                    key={impl.path}
                    onClick={() => handleSelectImpl(impl)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: idx < implications.length - 1 
                        ? `1px solid ${theme.colors.border}` 
                        : 'none',
                      cursor: 'pointer',
                      background: theme.colors.background.secondary,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = theme.colors.background.tertiary}
                    onMouseLeave={(e) => e.currentTarget.style.background = theme.colors.background.secondary}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: theme.colors.text.primary, marginBottom: '4px' }}>
                          {impl.className}
                        </div>
                        <div style={{ fontSize: '12px', color: theme.colors.text.tertiary }}>
                          Status: <span style={{ color: theme.colors.accents.blue }}>{impl.status}</span>
                          {impl.entity && <> • Entity: {impl.entity}</>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {impl.platforms?.map(p => (
                          <span key={p} style={{
                            padding: '2px 6px',
                            background: `${theme.colors.accents.green}20`,
                            borderRadius: '4px',
                            fontSize: '10px',
                            color: theme.colors.accents.green
                          }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}

        {error && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: `${theme.colors.accents.red}15`,
            border: `1px solid ${theme.colors.accents.red}`,
            borderRadius: '6px',
            color: theme.colors.accents.red,
            fontSize: '13px'
          }}>
            ❌ {error}
          </div>
        )}
      </div>
    );
  }

  // Diff view
  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: 0, color: theme.colors.text.primary, fontSize: '18px' }}>
          🔄 Update {selectedImpl.className}
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View mode toggle */}
          {hasCompoundMethods && diff && (
            <div style={{
              display: 'flex',
              background: theme.colors.background.tertiary,
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setViewMode('grouped')}
                style={{
                  padding: '4px 10px',
                  background: viewMode === 'grouped' ? theme.colors.accents.purple : 'transparent',
                  border: 'none',
                  fontSize: '11px',
                  color: viewMode === 'grouped' ? 'white' : theme.colors.text.secondary,
                  cursor: 'pointer'
                }}
              >
                📦 Grouped
              </button>
              <button
                onClick={() => setViewMode('flat')}
                style={{
                  padding: '4px 10px',
                  background: viewMode === 'flat' ? theme.colors.accents.purple : 'transparent',
                  border: 'none',
                  fontSize: '11px',
                  color: viewMode === 'flat' ? 'white' : theme.colors.text.secondary,
                  cursor: 'pointer'
                }}
              >
                📋 Flat
              </button>
            </div>
          )}
          <button
            onClick={() => { setSelectedImpl(null); setDiff(null); }}
            style={{
              padding: '6px 12px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              color: theme.colors.text.secondary,
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            ← Choose Different
          </button>
        </div>
      </div>

      {comparing ? (
        <div style={{ textAlign: 'center', padding: '40px', color: theme.colors.text.tertiary }}>
          ⏳ Comparing elements...
        </div>
      ) : diff ? (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            {hasCompoundMethods && (
              <div style={{
                flex: 1,
                padding: '12px',
                background: `${theme.colors.accents.purple}15`,
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: theme.colors.accents.purple }}>
                  {compoundMethods.length}
                </div>
                <div style={{ fontSize: '11px', color: theme.colors.text.tertiary }}>Compound</div>
              </div>
            )}
            <div style={{
              flex: 1,
              padding: '12px',
              background: `${theme.colors.accents.green}15`,
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: theme.colors.accents.green }}>
                {diff.summary.newCount}
              </div>
              <div style={{ fontSize: '11px', color: theme.colors.text.tertiary }}>New</div>
            </div>
            <div style={{
              flex: 1,
              padding: '12px',
              background: `${theme.colors.accents.blue}15`,
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: theme.colors.accents.blue }}>
                {diff.summary.existingCount}
              </div>
              <div style={{ fontSize: '11px', color: theme.colors.text.tertiary }}>Already Exist</div>
            </div>
          </div>

          {/* Elements list */}
          <div style={{ 
            maxHeight: '300px', 
            overflowY: 'auto',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            {viewMode === 'grouped' && hasCompoundMethods ? (
              <>
                {/* Compound Methods Section */}
                <GroupHeader
                  title="🧩 Smart Compound Methods"
                  subtitle={`${selectedMethods.size}/${compoundMethods.length} methods selected`}
                  expanded={expandedGroups.has('compound')}
                  onToggle={() => toggleGroup('compound')}
                  theme={theme}
                  color={theme.colors.accents.purple}
                />
                
                {expandedGroups.has('compound') && (
                  <div style={{ background: `${theme.colors.accents.purple}05` }}>
                    {compoundMethods.filter(m => !m.isDynamic).map((method, idx) => (
                      <CompoundMethodRow
                        key={idx}
                        method={method}
                        index={idx}
                        isSelected={selectedMethods.has(idx)}
                        onToggle={() => toggleMethod(idx)}
                        theme={theme}
                      />
                    ))}
                  </div>
                )}

                {/* Unique New Elements */}
                {groupedElements.unique.length > 0 && (
                  <>
                    <GroupHeader
                      title="✨ New Unique Elements"
                      subtitle={`${groupedElements.unique.filter(e => selectedNew.has(e.name)).length}/${groupedElements.unique.length} selected`}
                      expanded={expandedGroups.has('new')}
                      onToggle={() => toggleGroup('new')}
                      theme={theme}
                      color={theme.colors.accents.green}
                    />
                    
                    {expandedGroups.has('new') && groupedElements.unique.map((item) => (
                      <ElementRow
                        key={item.name}
                        item={item}
                        isSelected={selectedNew.has(item.name)}
                        onToggle={() => toggleNew(item.name)}
                        theme={theme}
                      />
                    ))}
                  </>
                )}

                {/* Elements covered by compound methods */}
                {groupedElements.coveredByCompound.length > 0 && (
                  <>
                    <GroupHeader
                      title="🔄 Covered by Compound Methods"
                      subtitle={`${groupedElements.coveredByCompound.length} elements (use methods above)`}
                      expanded={expandedGroups.has('covered')}
                      onToggle={() => toggleGroup('covered')}
                      theme={theme}
                      color={theme.colors.text.tertiary}
                      muted
                    />
                    
                    {expandedGroups.has('covered') && groupedElements.coveredByCompound.map((item) => (
                      <ElementRow
                        key={item.name}
                        item={item}
                        isSelected={selectedNew.has(item.name)}
                        onToggle={() => toggleNew(item.name)}
                        theme={theme}
                        muted
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              // Flat view
              diff.new.length > 0 && diff.new.map((item) => (
                <ElementRow
                  key={item.name}
                  item={item}
                  isSelected={selectedNew.has(item.name)}
                  onToggle={() => toggleNew(item.name)}
                  theme={theme}
                />
              ))
            )}

            {/* Existing elements (collapsed) */}
            {diff.existing.length > 0 && (
              <details>
                <summary style={{
                  padding: '12px 16px',
                  background: theme.colors.background.tertiary,
                  cursor: 'pointer',
                  color: theme.colors.text.secondary,
                  fontSize: '13px',
                  borderTop: `1px solid ${theme.colors.border}`
                }}>
                  ✓ {diff.existing.length} elements already in implication
                </summary>
                <div style={{
                  padding: '12px 16px',
                  background: theme.colors.background.secondary,
                  fontSize: '12px',
                  color: theme.colors.text.tertiary
                }}>
                  {diff.existing.map((item, idx) => (
                    <div key={idx} style={{ padding: '2px 0' }}>{item.name}</div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Options */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: theme.colors.background.tertiary,
            borderRadius: '6px'
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: theme.colors.text.primary,
              marginBottom: '8px'
            }}>
              ⚙️ Options
            </div>
            
            {/* Platform selector */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'block',
                fontSize: '12px',
                color: theme.colors.text.secondary,
                marginBottom: '4px'
              }}>
                Target Platform
              </label>
              <select
                value={mergeOptions.targetPlatform || platform}
                onChange={(e) => setMergeOptions(prev => ({
                  ...prev,
                  targetPlatform: e.target.value
                }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: theme.colors.background.secondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  color: theme.colors.text.primary,
                  fontSize: '13px'
                }}
              >
                <option value="web">Web</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="manager">Manager (Mobile)</option>
                <option value="dancer">Dancer (Mobile)</option>
              </select>
            </div>

            {hasCompoundMethods && (
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '13px',
                color: theme.colors.accents.purple,
                cursor: 'pointer',
                fontWeight: 600
              }}>
                <input
                  type="checkbox"
                  checked={mergeOptions.includeCompoundMethods}
                  onChange={(e) => setMergeOptions(prev => ({
                    ...prev,
                    includeCompoundMethods: e.target.checked
                  }))}
                />
                Include compound methods in mirrorsOn
              </label>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: theme.colors.text.tertiary }}>
              {selectedNew.size} elements
              {hasCompoundMethods && ` + ${selectedMethods.size} methods`} selected
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onCancel}
                style={{
                  padding: '10px 20px',
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '6px',
                  color: theme.colors.text.secondary,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={merging || (selectedNew.size === 0 && selectedMethods.size === 0)}
                style={{
                  padding: '10px 20px',
                  background: merging || (selectedNew.size === 0 && selectedMethods.size === 0)
                    ? theme.colors.background.tertiary 
                    : theme.colors.accents.green,
                  border: 'none',
                  borderRadius: '6px',
                  color: merging || (selectedNew.size === 0 && selectedMethods.size === 0) 
                    ? theme.colors.text.tertiary 
                    : 'white',
                  cursor: merging || (selectedNew.size === 0 && selectedMethods.size === 0) 
                    ? 'not-allowed' 
                    : 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                {merging ? '⏳ Merging...' : '✅ Add to Implication'}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════

function GroupHeader({ title, subtitle, expanded, onToggle, theme, color, muted }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '12px 16px',
        background: muted ? theme.colors.background.tertiary : `${color}10`,
        borderBottom: `1px solid ${theme.colors.border}`,
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div>
        <div style={{
          fontWeight: 600,
          fontSize: '14px',
          color: muted ? theme.colors.text.tertiary : color
        }}>
          {expanded ? '▼' : '▶'} {title}
        </div>
        <div style={{
          fontSize: '11px',
          color: theme.colors.text.tertiary,
          marginTop: '2px'
        }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function CompoundMethodRow({ method, index, isSelected, onToggle, theme }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
      <div style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        opacity: isSelected ? 1 : 0.5
      }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px' }}
        />

        <span 
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: '12px',
            color: theme.colors.text.tertiary,
            marginTop: '2px',
            cursor: 'pointer'
          }}
        >
          {expanded ? '▼' : '▶'}
        </span>
        
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '13px',
            color: theme.colors.accents.purple,
            fontWeight: 600,
            textDecoration: isSelected ? 'none' : 'line-through'
          }}>
            {method.name}({method.params.map(p => p.name).join(', ')})
          </div>
          <div style={{
            fontSize: '11px',
            color: theme.colors.text.secondary,
            marginTop: '4px'
          }}>
            {method.description}
          </div>
        </div>
        
        <span style={{
          padding: '2px 8px',
          background: `${theme.colors.accents.purple}20`,
          borderRadius: '4px',
          fontSize: '10px',
          color: theme.colors.accents.purple
        }}>
          {method.locatorType}
        </span>
      </div>
      
      {expanded && (
        <div style={{
          padding: '0 16px 12px 56px',
          background: `${theme.colors.background.tertiary}50`
        }}>
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: theme.colors.text.tertiary,
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Parameters
            </div>
            {method.params.map((param, idx) => (
              <div key={idx} style={{
                fontSize: '11px',
                color: theme.colors.text.secondary,
                marginLeft: '8px'
              }}>
                <code style={{ color: theme.colors.accents.blue }}>{param.name}</code>
                <span style={{ color: theme.colors.text.tertiary }}> : {param.type}</span>
                <span style={{ marginLeft: '8px', color: theme.colors.text.tertiary }}>
                  — {param.description}
                </span>
              </div>
            ))}
          </div>
          
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: theme.colors.text.tertiary,
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Selector Template
            </div>
            <code style={{
              display: 'block',
              padding: '8px',
              background: '#1a1a2e',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#e0e0e0',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {method.template}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

function ElementRow({ item, isSelected, onToggle, theme, muted = false }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: isSelected ? `${theme.colors.accents.green}10` : theme.colors.background.secondary,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        opacity: muted ? 0.6 : 1
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => {}}
        style={{ cursor: 'pointer' }}
      />
      <span style={{ 
        fontWeight: 600,
        textDecoration: isSelected ? 'none' : 'line-through',
        color: theme.colors.text.primary
      }}>
        {item.name}
      </span>
      <span style={{ fontSize: '11px', color: theme.colors.text.tertiary }}>
        ({item.type})
      </span>
    </div>
  );
}