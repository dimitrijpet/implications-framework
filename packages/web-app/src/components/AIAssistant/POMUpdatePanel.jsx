// packages/web-app/src/components/AIAssistant/POMUpdatePanel.jsx

import { useState, useEffect, useMemo } from 'react';

const API_URL = 'http://localhost:3000';

/**
 * Panel for updating existing POM files with newly captured elements
 */
export default function POMUpdatePanel({ 
  projectPath, 
  capturedElements,
  patterns = {},
  compoundMethods = [],
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
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'flat'
  const [expandedGroups, setExpandedGroups] = useState(new Set(['compound', 'new', 'changed']));
  
  // Merge options
  const [mergeOptions, setMergeOptions] = useState({
    addNew: true,
    updateChanged: true,
    generateActions: true,
    generateAssertions: true,
    includeCompoundMethods: true
  });
  
  // Selection state for diff items
  const [selectedNew, setSelectedNew] = useState(new Set());
  const [selectedChanged, setSelectedChanged] = useState(new Set());
  const [selectedMethods, setSelectedMethods] = useState(new Set());

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

  // Auto-select all compound methods
  useEffect(() => {
    if (compoundMethods?.length > 0) {
      setSelectedMethods(new Set(compoundMethods.map((_, i) => i)));
    }
  }, [compoundMethods]);

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

  const loadAvailablePOMs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = customPath 
        ? `${API_URL}/api/ai-assistant/list-poms?projectPath=${encodeURIComponent(projectPath)}&platform=${platform || ''}&searchPath=${encodeURIComponent(customPath)}`
        : `${API_URL}/api/ai-assistant/list-poms?projectPath=${encodeURIComponent(projectPath)}&platform=${platform || ''}`;
      
      const res = await fetch(url);
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
    const filteredDiff = {
      new: diff.new.filter(n => selectedNew.has(n.name)),
      changed: diff.changed.filter(c => selectedChanged.has(c.name)),
      unchanged: diff.unchanged,
      removed: diff.removed
    };

    const filteredCompoundMethods = mergeOptions.includeCompoundMethods
      ? compoundMethods.filter((_, i) => selectedMethods.has(i))
      : [];
    
    // DEBUG
    console.log('🔍 Sending merge request:', {
      filteredDiff,
      filteredCompoundMethods,
      selectedMethods: [...selectedMethods],
      mergeOptions
    });
    
    const res = await fetch(`${API_URL}/api/ai-assistant/merge-pom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: selectedPOM.fullPath,
        diff: filteredDiff,
        compoundMethods: filteredCompoundMethods,  // Make sure this is here!
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
                onKeyPress={(e) => e.key === 'Enter' && loadAvailablePOMs()}
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
            gridTemplateColumns: hasCompoundMethods ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {hasCompoundMethods && (
              <SummaryCard 
                icon="🧩" 
                label="Compound" 
                count={compoundMethods.length}
                color={theme.colors.accents.purple}
                theme={theme}
              />
            )}
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
          <div style={{ 
            maxHeight: '350px', 
            overflowY: 'auto',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px'
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
                    
                    {expandedGroups.has('new') && groupedElements.unique.map((item, idx) => (
                      <ElementDiffRow
                        key={item.name}
                        item={item}
                        isSelected={selectedNew.has(item.name)}
                        onToggle={() => toggleNew(item.name)}
                        theme={theme}
                        type="new"
                      />
                    ))}
                  </>
                )}

                {/* Elements covered by compound methods */}
                {groupedElements.coveredByCompound.length > 0 && (
                  <>
                    <GroupHeader
                      title="🔄 Covered by Compound Methods"
                      subtitle={`${groupedElements.coveredByCompound.length} elements (use methods above instead)`}
                      expanded={expandedGroups.has('covered')}
                      onToggle={() => toggleGroup('covered')}
                      theme={theme}
                      color={theme.colors.text.tertiary}
                      muted
                    />
                    
                    {expandedGroups.has('covered') && groupedElements.coveredByCompound.map((item) => (
                      <ElementDiffRow
                        key={item.name}
                        item={item}
                        isSelected={selectedNew.has(item.name)}
                        onToggle={() => toggleNew(item.name)}
                        theme={theme}
                        type="covered"
                        muted
                      />
                    ))}
                  </>
                )}

                {/* Changed elements */}
                {diff.changed.length > 0 && (
                  <>
                    <GroupHeader
                      title="✏️ Changed Selectors"
                      subtitle={`${selectedChanged.size}/${diff.changed.length} selected`}
                      expanded={expandedGroups.has('changed')}
                      onToggle={() => toggleGroup('changed')}
                      theme={theme}
                      color={theme.colors.accents.orange}
                    />
                    
                    {expandedGroups.has('changed') && diff.changed.map((item) => (
                      <ElementDiffRow
                        key={item.name}
                        item={item}
                        isSelected={selectedChanged.has(item.name)}
                        onToggle={() => toggleChanged(item.name)}
                        theme={theme}
                        type="changed"
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              // Flat view - original behavior
              <>
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
              </>
            )}

            {/* Unchanged (collapsed) */}
            {diff.unchanged.length > 0 && (
              <details style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                <summary style={{
                  padding: '12px 16px',
                  background: theme.colors.background.tertiary,
                  cursor: 'pointer',
                  color: theme.colors.text.secondary,
                  fontSize: '13px'
                }}>
                  ✓ {diff.unchanged.length} unchanged elements
                </summary>
                <div style={{
                  padding: '12px 16px',
                  background: theme.colors.background.secondary
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
                  Include compound methods
                </label>
              )}
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
              {selectedNew.size + selectedChanged.size} elements
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
                disabled={merging || (selectedNew.size === 0 && selectedChanged.size === 0 && selectedMethods.size === 0)}
                style={{
                  padding: '10px 20px',
                  background: merging || (selectedNew.size === 0 && selectedChanged.size === 0 && selectedMethods.size === 0)
                    ? theme.colors.background.tertiary
                    : theme.colors.accents.green,
                  border: 'none',
                  borderRadius: '6px',
                  color: merging || (selectedNew.size === 0 && selectedChanged.size === 0 && selectedMethods.size === 0)
                    ? theme.colors.text.tertiary
                    : 'white',
                  cursor: merging || (selectedNew.size === 0 && selectedChanged.size === 0 && selectedMethods.size === 0)
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
          {method.note && (
            <div style={{
              fontSize: '10px',
              color: theme.colors.text.tertiary,
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              📍 {method.note}
            </div>
          )}
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

function ElementDiffRow({ item, isSelected, onToggle, theme, type, muted = false }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: isSelected
          ? type === 'changed' ? `${theme.colors.accents.orange}10` : `${theme.colors.accents.green}10`
          : theme.colors.background.secondary,
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
      <div style={{ flex: 1 }}>
        {type === 'changed' ? (
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: theme.colors.text.primary }}>
              {item.name}
            </div>
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
        ) : (
          <>
            <span style={{ 
              fontWeight: 600, 
              color: theme.colors.text.primary,
              textDecoration: isSelected ? 'none' : 'line-through'
            }}>
              {item.name}
            </span>
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
        marginBottom: '8px',
        padding: '0 16px'
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: color }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '11px', color: theme.colors.text.tertiary }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={selectAll} style={miniButtonStyle(theme)}>All</button>
          <button onClick={selectNone} style={miniButtonStyle(theme)}>None</button>
        </div>
      </div>
      
      {items.map((item, idx) => (
        <div
          key={item.name}
          onClick={() => onToggle(item.name)}
          style={{
            padding: '10px 16px',
            borderBottom: idx < items.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
            background: selected.has(item.name) ? `${color}10` : theme.colors.background.secondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
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
  );
}

function miniButtonStyle(theme) {
  return {
    padding: '2px 8px',
    background: theme.colors.background.tertiary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '4px',
    fontSize: '10px',
    color: theme.colors.text.secondary,
    cursor: 'pointer'
  };
}