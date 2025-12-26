// packages/web-app/src/components/AIAssistant/POMUpdatePanel.jsx

import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

/**
 * Panel for updating existing POM files with newly captured elements
 */
export default function POMUpdatePanel({ 
  projectPath, 
  capturedElements, 
  platform,
  theme,
  onComplete,
  onCancel
}) {
  // State
  const [availablePOMs, setAvailablePOMs] = useState([]);
  const [selectedPOM, setSelectedPOM] = useState(null);
  const [existingPOM, setExistingPOM] = useState(null);
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState(null);
  
  // Merge options
  const [mergeOptions, setMergeOptions] = useState({
    addNew: true,
    updateChanged: true,
    generateActions: true,
    generateAssertions: true
  });
  
  // Selection state for diff items
  const [selectedNew, setSelectedNew] = useState(new Set());
  const [selectedChanged, setSelectedChanged] = useState(new Set());

    const [searchFilter, setSearchFilter] = useState('');
  const [customPath, setCustomPath] = useState('');

  // Load available POMs on mount
  useEffect(() => {
    loadAvailablePOMs();
  }, [projectPath, platform]);

  // Auto-select items when diff loads
  useEffect(() => {
    if (diff) {
      setSelectedNew(new Set(diff.new.map(n => n.name)));
      setSelectedChanged(new Set(diff.changed.map(c => c.name)));
    }
  }, [diff]);

  const loadAvailablePOMs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(
        `${API_URL}/api/ai-assistant/list-poms?projectPath=${encodeURIComponent(projectPath)}&platform=${platform || ''}`
      );
      const data = await res.json();
      
      if (data.success) {
        setAvailablePOMs(data.poms);
      } else {
        setError(data.error || 'Failed to load POMs');
      }
    } catch (e) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPOM = async (pom) => {
    setSelectedPOM(pom);
    setDiff(null);
    setComparing(true);
    setError(null);
    
    try {
      // Compare with captured elements
      const res = await fetch(`${API_URL}/api/ai-assistant/compare-pom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: pom.fullPath,
          elements: capturedElements
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setExistingPOM(data.existingPOM);
        setDiff(data.diff);
      } else {
        setError(data.error || 'Comparison failed');
      }
    } catch (e) {
      setError('Failed to compare: ' + e.message);
    } finally {
      setComparing(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedPOM || !diff) return;
    
    setMerging(true);
    setError(null);
    
    try {
      // Filter diff to only selected items
      const filteredDiff = {
        new: diff.new.filter(n => selectedNew.has(n.name)),
        changed: diff.changed.filter(c => selectedChanged.has(c.name)),
        unchanged: diff.unchanged,
        removed: diff.removed
      };
      
      const res = await fetch(`${API_URL}/api/ai-assistant/merge-pom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: selectedPOM.fullPath,
          diff: filteredDiff,
          options: mergeOptions
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        onComplete?.({
          filePath: data.filePath,
          backupPath: data.backupPath,
          changes: data.changes
        });
      } else {
        setError(data.error || 'Merge failed');
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

  const toggleChanged = (name) => {
    setSelectedChanged(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Not comparing yet - show POM list
  if (!selectedPOM) {
    return (
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ 
            margin: 0, 
            color: theme.colors.text.primary,
            fontSize: '18px'
          }}>
            📂 Select Screen Object to Update
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
            ⏳ Loading screen objects...
          </div>
        ) : availablePOMs.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            background: theme.colors.background.tertiary,
            borderRadius: '8px',
            color: theme.colors.text.secondary
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
            <div>No existing screen objects found</div>
            <div style={{ fontSize: '13px', marginTop: '8px', color: theme.colors.text.tertiary }}>
              Create a new one instead
            </div>
          </div>
        ) : (
          <>
            {/* Search and Path Filter */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="🔍 Filter by name..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '6px',
                  color: theme.colors.text.primary,
                  fontSize: '13px'
                }}
              />
              <input
                type="text"
                placeholder="Custom path (e.g. tests/mobile/screens)"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                onBlur={() => customPath && loadAvailablePOMs()}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '6px',
                  color: theme.colors.text.primary,
                  fontSize: '13px'
                }}
              />
            </div>
            
            <div style={{
              maxHeight: '350px',
              overflowY: 'auto',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px'
            }}>
              {availablePOMs
                .filter(pom => 
                  !searchFilter || 
                  pom.className?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  pom.path?.toLowerCase().includes(searchFilter.toLowerCase())
                )
                .map((pom, idx) => (
              <div
                key={pom.path}
                onClick={() => handleSelectPOM(pom)}
                style={{
                  padding: '12px 16px',
                  borderBottom: idx < availablePOMs.length - 1 
                    ? `1px solid ${theme.colors.border}` 
                    : 'none',
                  cursor: 'pointer',
                  background: theme.colors.background.secondary,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = theme.colors.background.tertiary}
                onMouseLeave={(e) => e.currentTarget.style.background = theme.colors.background.secondary}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{
                      fontWeight: 600,
                      color: theme.colors.text.primary,
                      marginBottom: '4px'
                    }}>
                      {pom.isMobile ? '📱' : '🌐'} {pom.className}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: theme.colors.text.tertiary,
                      fontFamily: 'monospace'
                    }}>
                      {pom.path}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '8px'
                  }}>
                    <span style={{
                      padding: '2px 8px',
                      background: `${theme.colors.accents.blue}20`,
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: theme.colors.accents.blue
                    }}>
                      {pom.locatorCount} locators
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: `${theme.colors.accents.green}20`,
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: theme.colors.accents.green
                    }}>
                      {pom.actionCount} actions
                    </span>
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

  // Comparing or showing diff
  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ 
          margin: 0, 
          color: theme.colors.text.primary,
          fontSize: '18px'
        }}>
          🔄 Update {existingPOM?.className || selectedPOM.className}
        </h3>
        <button
          onClick={() => {
            setSelectedPOM(null);
            setDiff(null);
          }}
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

      {comparing ? (
        <div style={{ textAlign: 'center', padding: '40px', color: theme.colors.text.tertiary }}>
          ⏳ Comparing elements...
        </div>
      ) : diff ? (
        <>
          {/* Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <SummaryCard 
              icon="➕" 
              label="New" 
              count={diff.summary.newCount}
              color={theme.colors.accents.green}
              theme={theme}
            />
            <SummaryCard 
              icon="✏️" 
              label="Changed" 
              count={diff.summary.changedCount}
              color={theme.colors.accents.orange}
              theme={theme}
            />
            <SummaryCard 
              icon="✓" 
              label="Unchanged" 
              count={diff.summary.unchangedCount}
              color={theme.colors.accents.blue}
              theme={theme}
            />
            <SummaryCard 
              icon="❓" 
              label="Not in scan" 
              count={diff.summary.removedCount}
              color={theme.colors.text.tertiary}
              theme={theme}
            />
          </div>

          {/* Diff sections */}
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {/* New elements */}
            {diff.new.length > 0 && (
              <DiffSection
                title="➕ New Elements"
                subtitle="Will be added to the screen object"
                items={diff.new}
                selected={selectedNew}
                onToggle={toggleNew}
                renderItem={(item) => (
                  <>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{ 
                      marginLeft: '8px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: theme.colors.text.tertiary
                    }}>
                      {item.selector}
                    </span>
                  </>
                )}
                color={theme.colors.accents.green}
                theme={theme}
              />
            )}

            {/* Changed elements */}
            {diff.changed.length > 0 && (
              <DiffSection
                title="✏️ Changed Selectors"
                subtitle="Selector has changed since last scan"
                items={diff.changed}
                selected={selectedChanged}
                onToggle={toggleChanged}
                renderItem={(item) => (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                      <span style={{ color: theme.colors.accents.red, textDecoration: 'line-through' }}>
                        {item.oldSelector}
                      </span>
                      <span style={{ margin: '0 8px', color: theme.colors.text.tertiary }}>→</span>
                      <span style={{ color: theme.colors.accents.green }}>
                        {item.newSelector}
                      </span>
                    </div>
                  </div>
                )}
                color={theme.colors.accents.orange}
                theme={theme}
              />
            )}

            {/* Unchanged (collapsed) */}
            {diff.unchanged.length > 0 && (
              <details style={{ marginTop: '12px' }}>
                <summary style={{
                  padding: '8px 12px',
                  background: theme.colors.background.tertiary,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: theme.colors.text.secondary,
                  fontSize: '13px'
                }}>
                  ✓ {diff.unchanged.length} unchanged elements
                </summary>
                <div style={{
                  padding: '12px',
                  background: theme.colors.background.secondary,
                  borderRadius: '0 0 6px 6px',
                  marginTop: '-4px'
                }}>
                  {diff.unchanged.map((item, idx) => (
                    <div key={idx} style={{
                      padding: '4px 0',
                      fontSize: '12px',
                      color: theme.colors.text.tertiary
                    }}>
                      {item.name}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Not in scan (info only) */}
            {diff.removed.length > 0 && (
              <details style={{ marginTop: '12px' }}>
                <summary style={{
                  padding: '8px 12px',
                  background: theme.colors.background.tertiary,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: theme.colors.text.tertiary,
                  fontSize: '13px'
                }}>
                  ❓ {diff.removed.length} elements not in current scan (will be kept)
                </summary>
                <div style={{
                  padding: '12px',
                  background: theme.colors.background.secondary,
                  borderRadius: '0 0 6px 6px',
                  marginTop: '-4px',
                  fontSize: '12px',
                  color: theme.colors.text.tertiary
                }}>
                  {diff.removed.map((item, idx) => (
                    <div key={idx} style={{ padding: '4px 0' }}>
                      {item.name} — <code>{item.selector}</code>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Merge options */}
          <div style={{
            marginTop: '16px',
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
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '13px',
                color: theme.colors.text.secondary,
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={mergeOptions.generateActions}
                  onChange={(e) => setMergeOptions(prev => ({
                    ...prev,
                    generateActions: e.target.checked
                  }))}
                />
                Generate actions
              </label>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '13px',
                color: theme.colors.text.secondary,
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={mergeOptions.generateAssertions}
                  onChange={(e) => setMergeOptions(prev => ({
                    ...prev,
                    generateAssertions: e.target.checked
                  }))}
                />
                Generate assertions
              </label>
            </div>
          </div>

          {/* Error */}
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

          {/* Actions */}
          <div style={{
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '13px', color: theme.colors.text.tertiary }}>
              {selectedNew.size + selectedChanged.size} changes selected
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
                disabled={merging || (selectedNew.size === 0 && selectedChanged.size === 0)}
                style={{
                  padding: '10px 20px',
                  background: merging || (selectedNew.size === 0 && selectedChanged.size === 0)
                    ? theme.colors.background.tertiary
                    : theme.colors.accents.green,
                  border: 'none',
                  borderRadius: '6px',
                  color: merging || (selectedNew.size === 0 && selectedChanged.size === 0)
                    ? theme.colors.text.tertiary
                    : 'white',
                  cursor: merging || (selectedNew.size === 0 && selectedChanged.size === 0)
                    ? 'not-allowed'
                    : 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                {merging ? '⏳ Merging...' : '✅ Apply Changes'}
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

function SummaryCard({ icon, label, count, color, theme }) {
  return (
    <div style={{
      padding: '12px',
      background: `${color}15`,
      borderRadius: '8px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ 
        fontSize: '24px', 
        fontWeight: 700, 
        color: color 
      }}>
        {count}
      </div>
      <div style={{ 
        fontSize: '11px', 
        color: theme.colors.text.tertiary 
      }}>
        {label}
      </div>
    </div>
  );
}

function DiffSection({ title, subtitle, items, selected, onToggle, renderItem, color, theme }) {
  const selectAll = () => {
    items.forEach(item => {
      if (!selected.has(item.name)) {
        onToggle(item.name);
      }
    });
  };

  const selectNone = () => {
    items.forEach(item => {
      if (selected.has(item.name)) {
        onToggle(item.name);
      }
    });
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: color
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: '11px',
              color: theme.colors.text.tertiary
            }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={selectAll}
            style={{
              padding: '2px 8px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              fontSize: '10px',
              color: theme.colors.text.secondary,
              cursor: 'pointer'
            }}
          >
            All
          </button>
          <button
            onClick={selectNone}
            style={{
              padding: '2px 8px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              fontSize: '10px',
              color: theme.colors.text.secondary,
              cursor: 'pointer'
            }}
          >
            None
          </button>
        </div>
      </div>
      
      <div style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        {items.map((item, idx) => (
          <div
            key={item.name}
            onClick={() => onToggle(item.name)}
            style={{
              padding: '10px 12px',
              borderBottom: idx < items.length - 1 
                ? `1px solid ${theme.colors.border}` 
                : 'none',
              background: selected.has(item.name)
                ? `${color}10`
                : theme.colors.background.secondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'background 0.2s'
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(item.name)}
              onChange={() => {}}
              style={{ cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              {renderItem(item)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}