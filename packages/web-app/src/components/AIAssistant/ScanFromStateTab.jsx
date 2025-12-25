// packages/web-app/src/components/AIAssistant/ScanFromStateTab.jsx

import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

export default function ScanFromStateTab({ onScan, loading, error, theme, projectPath }) {
  const [states, setStates] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [platform, setPlatform] = useState('web');
  const [statesError, setStatesError] = useState(null);

  // Load available states when projectPath changes
  useEffect(() => {
    if (projectPath) {
      loadAvailableStates();
    }
  }, [projectPath]);

  const loadAvailableStates = async () => {
    setLoadingStates(true);
    setStatesError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/ai-assistant/available-states?projectPath=${encodeURIComponent(projectPath)}`
      );
      const data = await response.json();

      if (data.success) {
        setStates(data.states);
      } else {
        setStatesError(data.error);
      }
    } catch (err) {
      setStatesError('Failed to load states: ' + err.message);
    } finally {
      setLoadingStates(false);
    }
  };

  const handleScan = async () => {
    if (!selectedState) return;

    const response = await fetch(`${API_URL}/api/ai-assistant/scan-from-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath,
        targetState: selectedState,
        platform
      })
    });

    const data = await response.json();
    
    if (onScan) {
      onScan(data);
    }
  };

  // Group states by entity
  const statesByEntity = states.reduce((acc, state) => {
    const entity = state.entity || 'other';
    if (!acc[entity]) acc[entity] = [];
    acc[entity].push(state);
    return acc;
  }, {});

  // Get selected state info
  const selectedStateInfo = states.find(s => s.status === selectedState);

  return (
    <div>
      {!projectPath ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: theme.colors.text.tertiary
        }}>
          ⚠️ No project loaded. Scan a project first to use this feature.
        </div>
      ) : (
        <>
          {/* State Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text.primary
            }}>
              Target State
            </label>

            {loadingStates ? (
              <div style={{ 
                padding: '12px', 
                color: theme.colors.text.tertiary,
                fontSize: '13px'
              }}>
                ⏳ Loading available states...
              </div>
            ) : statesError ? (
              <div style={{
                padding: '12px',
                background: `${theme.colors.accents.red}15`,
                borderRadius: '6px',
                color: theme.colors.accents.red,
                fontSize: '13px'
              }}>
                ❌ {statesError}
                <button 
                  onClick={loadAvailableStates}
                  style={{
                    marginLeft: '12px',
                    padding: '4px 8px',
                    background: theme.colors.background.tertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  color: theme.colors.text.primary,
                  fontSize: '14px'
                }}
              >
                <option value="">Select a state to reach...</option>
                {Object.entries(statesByEntity).map(([entity, entityStates]) => (
                  <optgroup key={entity} label={`📁 ${entity.toUpperCase()}`}>
                    {entityStates.map(state => (
                      <option key={state.status} value={state.status}>
                        {state.status} ({state.platform})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Selected State Info */}
          {selectedStateInfo && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: `${theme.colors.accents.blue}10`,
              borderRadius: '6px',
              fontSize: '13px'
            }}>
              <div style={{ marginBottom: '6px' }}>
                <strong style={{ color: theme.colors.text.primary }}>
                  {selectedStateInfo.className}
                </strong>
              </div>
              <div style={{ color: theme.colors.text.tertiary }}>
                📄 {selectedStateInfo.file}
              </div>
            </div>
          )}

          {/* Platform Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text.primary
            }}>
              Platform
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { id: 'web', label: '🌐 Web', icon: '🌐' },
                { id: 'dancer', label: '💃 Dancer', icon: '💃' },
                { id: 'manager', label: '👔 Manager', icon: '👔' }
              ].map(p => (
                <label
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: platform === p.id 
                      ? `${theme.colors.accents.purple}20`
                      : theme.colors.background.tertiary,
                    border: `1px solid ${platform === p.id 
                      ? theme.colors.accents.purple 
                      : theme.colors.border}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: theme.colors.text.primary
                  }}
                >
                  <input
                    type="radio"
                    name="platform"
                    checked={platform === p.id}
                    onChange={() => setPlatform(p.id)}
                    style={{ display: 'none' }}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: `${theme.colors.accents.yellow}15`,
            border: `1px solid ${theme.colors.accents.yellow}40`,
            borderRadius: '6px',
            fontSize: '13px',
            color: theme.colors.accents.yellow
          }}>
            ⚠️ <strong>Note:</strong> This will execute real tests to reach the target state.
            Make sure your test environment is ready and test data is in the expected state.
          </div>

          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={loading || !selectedState}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: loading || !selectedState
                ? theme.colors.background.tertiary
                : theme.colors.accents.green,
              color: loading || !selectedState
                ? theme.colors.text.tertiary
                : 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: loading || !selectedState ? 'not-allowed' : 'pointer',
              fontSize: '15px'
            }}
          >
            {loading ? '⏳ Running Prerequisites & Scanning...' : '🚀 Run Prerequisites & Scan'}
          </button>

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

          {/* Stats */}
          <div style={{
            marginTop: '16px',
            padding: '10px',
            background: theme.colors.background.tertiary,
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.colors.text.tertiary,
            display: 'flex',
            gap: '16px'
          }}>
            <span>📊 {states.length} states available</span>
            <span>📁 {Object.keys(statesByEntity).length} entities</span>
          </div>
        </>
      )}
    </div>
  );
}