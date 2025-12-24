// packages/web-app/src/components/AIAssistant/ScanResultsView.jsx

import { useState } from 'react';

export default function ScanResultsView({ result, onClear, theme, projectPath }) {
  const [activeCodeTab, setActiveCodeTab] = useState('locators');
  const [copied, setCopied] = useState(null);

  if (!result) return null;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const codeTabs = [
    { id: 'locators', label: '📍 Locators', code: result.generated?.locators },
    { id: 'pom', label: '📄 POM', code: result.generated?.pom },
    { id: 'transitions', label: '🔀 Transitions', code: result.generated?.transitions }
  ].filter(tab => tab.code);

  return (
    <div style={{
      marginTop: '24px',
      borderTop: `1px solid ${theme.colors.border}`,
      paddingTop: '24px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px'
      }}>
        <div>
          <h4 style={{
            margin: '0 0 8px 0',
            fontSize: '18px',
            fontWeight: 700,
            color: theme.colors.accents.green
          }}>
            ✅ Scan Complete
          </h4>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: theme.colors.text.secondary
          }}>
            <strong>{result.screenName}</strong> • {result.elements?.length || 0} elements found
          </p>
        </div>

        <button
          onClick={onClear}
          style={{
            padding: '8px 16px',
            background: theme.colors.background.tertiary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            color: theme.colors.text.secondary,
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          ✕ Clear
        </button>
      </div>

      {/* Screenshot Preview */}
      {result.screenshot && (
        <div style={{ marginBottom: '20px' }}>
          <h5 style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            color: theme.colors.text.secondary
          }}>
            📸 Screenshot
          </h5>
          <img
            src={`data:image/png;base64,${result.screenshot}`}
            alt="Page screenshot"
            style={{
              maxWidth: '100%',
              maxHeight: '300px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`
            }}
          />
        </div>
      )}

      {/* Elements List */}
      <div style={{ marginBottom: '20px' }}>
        <h5 style={{
          margin: '0 0 12px 0',
          fontSize: '14px',
          color: theme.colors.text.secondary
        }}>
          🎯 Detected Elements ({result.elements?.length || 0})
        </h5>
        
        <div style={{
          display: 'grid',
          gap: '8px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {result.elements?.map((element, idx) => (
            <div
              key={idx}
              style={{
                padding: '10px 14px',
                background: theme.colors.background.tertiary,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                background: getTypeColor(element.type, theme),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}>
                {getTypeIcon(element.type)}
              </span>
              
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 600,
                  color: theme.colors.text.primary,
                  fontSize: '13px'
                }}>
                  {element.name}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: theme.colors.text.tertiary,
                  fontFamily: 'monospace'
                }}>
                  {element.selectors?.[0]?.value || element.type}
                </div>
              </div>
              
              <span style={{
                padding: '2px 8px',
                background: `${theme.colors.accents.blue}20`,
                borderRadius: '4px',
                fontSize: '11px',
                color: theme.colors.accents.blue
              }}>
                {element.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Generated Code Tabs */}
      {codeTabs.length > 0 && (
        <div>
          <h5 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: theme.colors.text.secondary
          }}>
            💻 Generated Code
          </h5>

          {/* Tab Headers */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '12px'
          }}>
            {codeTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveCodeTab(tab.id)}
                style={{
                  padding: '8px 16px',
                  background: activeCodeTab === tab.id
                    ? theme.colors.accents.purple
                    : theme.colors.background.tertiary,
                  border: 'none',
                  borderRadius: '6px',
                  color: activeCodeTab === tab.id
                    ? 'white'
                    : theme.colors.text.secondary,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeCodeTab === tab.id ? 600 : 400
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Code Display */}
          {codeTabs.map(tab => (
            tab.id === activeCodeTab && (
              <div key={tab.id} style={{ position: 'relative' }}>
                <button
                  onClick={() => copyToClipboard(tab.code, tab.id)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    padding: '6px 12px',
                    background: copied === tab.id
                      ? theme.colors.accents.green
                      : theme.colors.background.secondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    color: copied === tab.id
                      ? 'white'
                      : theme.colors.text.secondary,
                    cursor: 'pointer',
                    fontSize: '12px',
                    zIndex: 10
                  }}
                >
                  {copied === tab.id ? '✓ Copied!' : '📋 Copy'}
                </button>
                
                <pre style={{
                  margin: 0,
                  padding: '16px',
                  background: '#1a1a2e',
                  borderRadius: '8px',
                  overflow: 'auto',
                  maxHeight: '400px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  color: '#e0e0e0',
                  fontFamily: "'Fira Code', 'Monaco', monospace"
                }}>
                  <code>{tab.code}</code>
                </pre>
              </div>
            )
          ))}
        </div>
      )}

      {/* Usage Info */}
      {result.usage && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: theme.colors.background.tertiary,
          borderRadius: '6px',
          fontSize: '12px',
          color: theme.colors.text.tertiary,
          display: 'flex',
          gap: '16px'
        }}>
          <span>🧠 Vision tokens: {result.usage.vision || 0}</span>
          <span>💻 Codegen tokens: {result.usage.codegen || 0}</span>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getTypeIcon(type) {
  const icons = {
    button: '🔘',
    input: '📝',
    link: '🔗',
    text: '📄',
    image: '🖼️',
    checkbox: '☑️',
    select: '📋',
    form: '📑'
  };
  return icons[type] || '◻️';
}

function getTypeColor(type, theme) {
  const colors = {
    button: theme.colors.accents.blue,
    input: theme.colors.accents.green,
    link: theme.colors.accents.purple,
    text: theme.colors.accents.yellow,
    image: theme.colors.accents.orange,
    checkbox: theme.colors.accents.cyan,
    select: theme.colors.accents.pink
  };
  return `${colors[type] || theme.colors.border}30`;
}
