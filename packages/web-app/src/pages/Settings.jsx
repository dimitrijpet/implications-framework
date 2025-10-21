// packages/web-app/src/pages/Settings.jsx (FIX THE IMPORT)

import { useState, useEffect } from 'react';
import { defaultTheme } from '../config/visualizerTheme'; // FIXED: use visualizerTheme instead

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const theme = defaultTheme; // FIXED: use defaultTheme

  const handleStrategyChange = (strategy) => {
    setConfig({
      ...config,
      stateRegistry: {
        ...config.stateRegistry,
        strategy
      }
    });
  };

  const handlePatternChange = (pattern) => {
    setConfig({
      ...config,
      stateRegistry: {
        ...config.stateRegistry,
        pattern
      }
    });
  };

  const handleCaseSensitiveChange = (caseSensitive) => {
    setConfig({
      ...config,
      stateRegistry: {
        ...config.stateRegistry,
        caseSensitive
      }
    });
  };

  const handleAddPrefix = () => {
    const prefix = prompt('Enter status prefix (e.g., "Accepted"):');
    if (prefix) {
      const prefixes = config.stateRegistry?.statusPrefixes || [];
      setConfig({
        ...config,
        stateRegistry: {
          ...config.stateRegistry,
          statusPrefixes: [...prefixes, prefix]
        }
      });
    }
  };

  const handleRemovePrefix = (index) => {
    const prefixes = [...(config.stateRegistry?.statusPrefixes || [])];
    prefixes.splice(index, 1);
    setConfig({
      ...config,
      stateRegistry: {
        ...config.stateRegistry,
        statusPrefixes: prefixes
      }
    });
  };

  const handleAddMapping = () => {
    const shortName = prompt('Enter short name (e.g., "accepted"):');
    if (!shortName) return;
    
    const fullName = prompt('Enter full class name (e.g., "AcceptedBookingImplications"):');
    if (!fullName) return;
    
    const mappings = config.stateRegistry?.mappings || {};
    setConfig({
      ...config,
      stateRegistry: {
        ...config.stateRegistry,
        mappings: {
          ...mappings,
          [shortName]: fullName
        }
      }
    });
  };

  const handleRemoveMapping = (shortName) => {
    const mappings = { ...(config.stateRegistry?.mappings || {}) };
    delete mappings[shortName];
    setConfig({
      ...config,
      stateRegistry: {
        ...config.stateRegistry,
        mappings
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      // In a real implementation, this would save to the config file
      // For now, we'll just simulate it
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessage({ type: 'success', text: '✅ Settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: `❌ Error: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Initialize with default config
  useEffect(() => {
    setConfig({
      projectName: 'My Project',
      projectType: 'booking',
      stateRegistry: {
        strategy: 'auto',
        caseSensitive: false,
        statusPrefixes: [
          'Accepted', 'Rejected', 'Pending', 'Standby',
          'Created', 'CheckedIn', 'CheckedOut', 'Completed',
          'Cancelled', 'Missed', 'Invited'
        ],
        pattern: '{Status}BookingImplications',
        mappings: {}
      }
    });
  }, []);

  if (!config) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen p-8" style={{ background: theme.colors.background.primary }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: theme.colors.text.primary }}>
            ⚙️ Settings
          </h1>
          <p style={{ color: theme.colors.text.secondary }}>
            Configure state registry and project settings
          </p>
        </div>

        {/* Message */}
        {message && (
          <div 
            className="mb-6 p-4 rounded-lg"
            style={{ 
              background: message.type === 'success' ? '#d4edda' : '#f8d7da',
              color: message.type === 'success' ? '#155724' : '#721c24'
            }}
          >
            {message.text}
          </div>
        )}

        {/* State Registry Section */}
        <div 
          className="mb-8 p-6 rounded-xl"
          style={{ background: theme.colors.background.secondary }}
        >
          <h2 className="text-2xl font-bold mb-6" style={{ color: theme.colors.text.primary }}>
            State Registry Configuration
          </h2>

          {/* Strategy Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
              Strategy
            </label>
            <select
              value={config.stateRegistry.strategy}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border"
              style={{ 
                background: theme.colors.background.tertiary,
                borderColor: theme.colors.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="auto">Auto-discover (Recommended)</option>
              <option value="pattern">Pattern-based</option>
              <option value="explicit">Explicit Mappings</option>
            </select>
            <p className="mt-2 text-sm" style={{ color: theme.colors.text.secondary }}>
              {config.stateRegistry.strategy === 'auto' && 'Automatically extract state names from class names'}
              {config.stateRegistry.strategy === 'pattern' && 'Use a regex pattern to extract state names'}
              {config.stateRegistry.strategy === 'explicit' && 'Manually define all state name mappings'}
            </p>
          </div>

          {/* Pattern (only for pattern strategy) */}
          {config.stateRegistry.strategy === 'pattern' && (
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
                Pattern
              </label>
              <input
                type="text"
                value={config.stateRegistry.pattern}
                onChange={(e) => handlePatternChange(e.target.value)}
                placeholder="{Status}BookingImplications"
                className="w-full px-4 py-2 rounded-lg border font-mono"
                style={{ 
                  background: theme.colors.background.tertiary,
                  borderColor: theme.colors.border,
                  color: theme.colors.text.primary
                }}
              />
              <p className="mt-2 text-sm" style={{ color: theme.colors.text.secondary }}>
                Use {'{Status}'} as a placeholder for the state name
              </p>
            </div>
          )}

          {/* Case Sensitivity */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.stateRegistry.caseSensitive}
                onChange={(e) => handleCaseSensitiveChange(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
                Case Sensitive
              </span>
            </label>
            <p className="mt-2 text-sm ml-8" style={{ color: theme.colors.text.secondary }}>
              When enabled, "accepted" and "Accepted" will be treated as different states
            </p>
          </div>

          {/* Status Prefixes (for auto strategy) */}
          {config.stateRegistry.strategy === 'auto' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                  Status Prefixes
                </label>
                <button
                  onClick={handleAddPrefix}
                  className="px-3 py-1 rounded text-sm font-medium"
                  style={{ 
                    background: theme.colors.accents.blue,
                    color: '#fff'
                  }}
                >
                  + Add Prefix
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(config.stateRegistry.statusPrefixes || []).map((prefix, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1 rounded-full"
                    style={{ background: theme.colors.background.tertiary }}
                  >
                    <code className="text-sm" style={{ color: theme.colors.text.primary }}>
                      {prefix}
                    </code>
                    <button
                      onClick={() => handleRemovePrefix(index)}
                      className="text-red-500 hover:text-red-700 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explicit Mappings (for explicit strategy) */}
          {config.stateRegistry.strategy === 'explicit' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                  Explicit Mappings
                </label>
                <button
                  onClick={handleAddMapping}
                  className="px-3 py-1 rounded text-sm font-medium"
                  style={{ 
                    background: theme.colors.accents.blue,
                    color: '#fff'
                  }}
                >
                  + Add Mapping
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(config.stateRegistry.mappings || {}).map(([shortName, fullName]) => (
                  <div
                    key={shortName}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: theme.colors.background.tertiary }}
                  >
                    <code className="flex-1 font-mono text-sm" style={{ color: theme.colors.accents.blue }}>
                      "{shortName}"
                    </code>
                    <span style={{ color: theme.colors.text.secondary }}>→</span>
                    <code className="flex-[2] font-mono text-sm" style={{ color: theme.colors.text.primary }}>
                      {fullName}
                    </code>
                    <button
                      onClick={() => handleRemoveMapping(shortName)}
                      className="text-red-500 hover:text-red-700 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {Object.keys(config.stateRegistry.mappings || {}).length === 0 && (
                  <div className="text-center py-4" style={{ color: theme.colors.text.secondary }}>
                    No mappings defined
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-lg font-bold text-white transition-all disabled:opacity-50"
            style={{ background: theme.colors.accents.blue }}
          >
            {saving ? '💾 Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}