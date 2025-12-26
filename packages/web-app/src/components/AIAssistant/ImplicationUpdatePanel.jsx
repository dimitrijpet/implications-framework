// packages/web-app/src/components/AIAssistant/ImplicationUpdatePanel.jsx

import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

export default function ImplicationUpdatePanel({ 
  projectPath, 
  capturedElements,
  screenName,
  platform,
  theme,
  onComplete,
  onCancel
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

  useEffect(() => {
    loadImplications();
  }, [projectPath]);

  useEffect(() => {
    if (diff) {
      setSelectedNew(new Set(diff.new.map(n => n.name)));
    }
  }, [diff]);

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
      
      const instanceName = screenName.charAt(0).toLowerCase() + screenName.slice(1);
      
      const res = await fetch(`${API_URL}/api/ai-assistant/merge-implication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: selectedImpl.fullPath,
          diff: filteredDiff,
          options: { platform, screenName, instanceName }
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

      {comparing ? (
        <div style={{ textAlign: 'center', padding: '40px', color: theme.colors.text.tertiary }}>
          ⏳ Comparing elements...
        </div>
      ) : diff ? (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
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

          {/* New elements */}
          {diff.new.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: theme.colors.accents.green, marginBottom: '8px' }}>
                ➕ New Elements to Add
              </div>
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: '6px' }}>
                {diff.new.map((item, idx) => (
                  <div
                    key={item.name}
                    onClick={() => toggleNew(item.name)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: idx < diff.new.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                      background: selectedNew.has(item.name) ? `${theme.colors.accents.green}10` : theme.colors.background.secondary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedNew.has(item.name)}
                      onChange={() => {}}
                    />
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontSize: '11px', color: theme.colors.text.tertiary }}>
                      ({item.type})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing elements */}
          {diff.existing.length > 0 && (
            <details style={{ marginBottom: '16px' }}>
              <summary style={{
                padding: '8px 12px',
                background: theme.colors.background.tertiary,
                borderRadius: '6px',
                cursor: 'pointer',
                color: theme.colors.text.secondary,
                fontSize: '13px'
              }}>
                ✓ {diff.existing.length} elements already in implication
              </summary>
              <div style={{
                padding: '12px',
                background: theme.colors.background.secondary,
                borderRadius: '0 0 6px 6px',
                fontSize: '12px',
                color: theme.colors.text.tertiary
              }}>
                {diff.existing.map((item, idx) => (
                  <div key={idx} style={{ padding: '2px 0' }}>{item.name}</div>
                ))}
              </div>
            </details>
          )}

          {error && (
            <div style={{
              marginBottom: '16px',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: theme.colors.text.tertiary }}>
              {selectedNew.size} elements selected
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
                disabled={merging || selectedNew.size === 0}
                style={{
                  padding: '10px 20px',
                  background: merging || selectedNew.size === 0 
                    ? theme.colors.background.tertiary 
                    : theme.colors.accents.green,
                  border: 'none',
                  borderRadius: '6px',
                  color: merging || selectedNew.size === 0 ? theme.colors.text.tertiary : 'white',
                  cursor: merging || selectedNew.size === 0 ? 'not-allowed' : 'pointer',
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