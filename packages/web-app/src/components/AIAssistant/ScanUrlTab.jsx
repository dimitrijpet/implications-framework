// packages/web-app/src/components/AIAssistant/ScanUrlTab.jsx

import { useState } from 'react';

export default function ScanUrlTab({ onScan, loading, error, theme }) {
  const [url, setUrl] = useState('');
  const [options, setOptions] = useState({
    generateLocators: true,
    generatePOM: true,
    generateTransitions: true,
    platform: 'web',
    screenName: ''
  });
  const [showOptions, setShowOptions] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onScan(url.trim(), options);
    }
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* URL Input */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: 600,
          color: theme.colors.text.primary
        }}>
          Page URL
        </label>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/login"
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              color: theme.colors.text.primary,
              fontSize: '14px'
            }}
          />
          
          <button
            type="submit"
            disabled={loading || !url.trim() || !isValidUrl(url)}
            style={{
              padding: '12px 24px',
              background: loading || !isValidUrl(url)
                ? theme.colors.background.tertiary
                : theme.colors.accents.purple,
              color: loading || !isValidUrl(url)
                ? theme.colors.text.tertiary
                : 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: loading || !isValidUrl(url) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              minWidth: '120px'
            }}
          >
            {loading ? '⏳ Scanning...' : '🔍 Scan'}
          </button>
        </div>
      </div>

      {/* Options Toggle */}
      <button
        type="button"
        onClick={() => setShowOptions(!showOptions)}
        style={{
          background: 'none',
          border: 'none',
          color: theme.colors.accents.blue,
          cursor: 'pointer',
          fontSize: '13px',
          padding: '4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        ⚙️ {showOptions ? 'Hide' : 'Show'} Options
      </button>

      {/* Options Panel */}
      {showOptions && (
        <div style={{
          marginTop: '12px',
          padding: '16px',
          background: theme.colors.background.tertiary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`
        }}>
          {/* Screen Name */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              color: theme.colors.text.secondary
            }}>
              Screen Name (optional)
            </label>
            <input
              type="text"
              value={options.screenName}
              onChange={(e) => setOptions(prev => ({ ...prev, screenName: e.target.value }))}
              placeholder="Auto-detected from page"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: theme.colors.background.secondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                color: theme.colors.text.primary,
                fontSize: '13px'
              }}
            />
          </div>

          {/* Platform */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              color: theme.colors.text.secondary
            }}>
              Platform
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['web', 'mobile'].map(platform => (
                <label
                  key={platform}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    color: theme.colors.text.primary
                  }}
                >
                  <input
                    type="radio"
                    checked={options.platform === platform}
                    onChange={() => setOptions(prev => ({ ...prev, platform }))}
                  />
                  {platform === 'web' ? '🌐' : '📱'} {platform}
                </label>
              ))}
            </div>
          </div>

          {/* Generate Options */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            gap: '16px' 
          }}>
            {[
              { key: 'generateLocators', label: 'Locators' },
              { key: 'generatePOM', label: 'POM Class' },
              { key: 'generateTransitions', label: 'Transitions' }
            ].map(opt => (
              <label
                key={opt.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  color: theme.colors.text.primary,
                  fontSize: '13px'
                }}
              >
                <input
                  type="checkbox"
                  checked={options[opt.key]}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    [opt.key]: e.target.checked 
                  }))}
                />
                Generate {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
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

      {/* Quick Examples */}
      {!url && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          background: `${theme.colors.accents.blue}10`,
          borderRadius: '6px'
        }}>
          <p style={{ 
            margin: '0 0 8px 0', 
            fontSize: '12px', 
            color: theme.colors.text.tertiary 
          }}>
            Try these examples:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              'https://github.com/login',
              'https://example.com'
            ].map(example => (
              <button
                key={example}
                type="button"
                onClick={() => setUrl(example)}
                style={{
                  padding: '4px 10px',
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  color: theme.colors.text.secondary,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
