// packages/web-app/src/components/AIAssistant/DebugBrowserTab.jsx

import { useState, useEffect, useCallback } from 'react';

const API_URL = 'http://localhost:3000';

export default function DebugBrowserTab({ onCapture, theme, projectPath }) {
  const [status, setStatus] = useState({ running: false });
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const [startUrl, setStartUrl] = useState('');

  // Poll for status
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/debug-browser/status`);
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setStatus({ running: false });
    }
  }, []);

  // Check status on mount and periodically when running
  useEffect(() => {
    checkStatus();
    
    const interval = setInterval(() => {
  if (status.running) {
    checkStatus();
  }
}, 5000);  // Changed from 2000 to 5000

    return () => clearInterval(interval);
  }, [status.running, checkStatus]);

  const launchBrowser = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/debug-browser/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUrl: startUrl || undefined })
      });

      const data = await response.json();

      if (data.success) {
        setStatus({ running: true, ...data });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to launch browser: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const closeBrowser = async () => {
    try {
      await fetch(`${API_URL}/api/ai-assistant/debug-browser/close`, {
        method: 'POST'
      });
      setStatus({ running: false });
    } catch (err) {
      setError('Failed to close browser: ' + err.message);
    }
  };

  const capture = async () => {
    setCapturing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/debug-browser/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'web',
          generateLocators: true,
          generatePOM: true,
          generateTransitions: true
        })
      });

      const data = await response.json();

      if (data.success && onCapture) {
        onCapture(data);
      } else if (!data.success) {
        setError(data.error);
      }
    } catch (err) {
      setError('Capture failed: ' + err.message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div>
      {/* Launch Section */}
      {!status.running && (
        <div>
          <p style={{
            marginBottom: '16px',
            color: theme.colors.text.secondary,
            fontSize: '14px'
          }}>
            Launch a debug browser to manually navigate and interact. 
            When you're on the page you want to scan, click "Capture & Scan".
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text.primary
            }}>
              Start URL (optional)
            </label>
            <input
              type="url"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://your-app.com or leave empty"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: theme.colors.background.tertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                color: theme.colors.text.primary,
                fontSize: '14px'
              }}
            />
          </div>

          <button
            onClick={launchBrowser}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: loading 
                ? theme.colors.background.tertiary 
                : theme.colors.accents.purple,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '15px'
            }}
          >
            {loading ? '⏳ Launching...' : '🚀 Launch Debug Browser'}
          </button>
        </div>
      )}

      {/* Running Section */}
      {status.running && (
        <div>
          {/* Status Card */}
          <div style={{
            padding: '16px',
            background: `${theme.colors.accents.green}15`,
            border: `1px solid ${theme.colors.accents.green}40`,
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <span style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: theme.colors.accents.green,
                animation: 'pulse 2s infinite'
              }} />
              <strong style={{ color: theme.colors.accents.green }}>
                Debug Browser Running
              </strong>
            </div>

            {status.currentUrl && (
              <div style={{ marginBottom: '8px' }}>
                <span style={{ 
                  color: theme.colors.text.tertiary, 
                  fontSize: '12px' 
                }}>
                  Current URL:
                </span>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: theme.colors.text.primary,
                  wordBreak: 'break-all'
                }}>
                  {status.currentUrl}
                </div>
              </div>
            )}

            {status.pageTitle && (
              <div>
                <span style={{ 
                  color: theme.colors.text.tertiary, 
                  fontSize: '12px' 
                }}>
                  Page Title:
                </span>
                <div style={{
                  fontSize: '13px',
                  color: theme.colors.text.primary
                }}>
                  {status.pageTitle}
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div style={{
            padding: '12px',
            background: `${theme.colors.accents.blue}10`,
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px',
            color: theme.colors.text.secondary
          }}>
            💡 <strong>Tip:</strong> Interact with the browser window - login, navigate, 
            click around. When you're on the page you want to scan, click the button below.
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={capture}
              disabled={capturing}
              style={{
                flex: 2,
                padding: '14px 24px',
                background: capturing 
                  ? theme.colors.background.tertiary 
                  : theme.colors.accents.green,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: capturing ? 'not-allowed' : 'pointer',
                fontSize: '15px'
              }}
            >
              {capturing ? '⏳ Capturing...' : '📸 Capture & Scan'}
            </button>

            <button
              onClick={checkStatus}
              style={{
                padding: '14px 16px',
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              title="Refresh status"
            >
              🔄
            </button>

            <button
              onClick={closeBrowser}
              style={{
                padding: '14px 16px',
                background: `${theme.colors.accents.red}20`,
                color: theme.colors.accents.red,
                border: `1px solid ${theme.colors.accents.red}40`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              title="Close browser"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

      {/* Add pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}