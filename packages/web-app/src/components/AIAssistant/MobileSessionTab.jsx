// packages/web-app/src/components/AIAssistant/MobileSessionTab.jsx

import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

export default function MobileSessionTab({ onCapture, theme, projectPath }) {
  // Session state
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(null);
  
  // Config state
  const [platform, setPlatform] = useState('android');
  const [deviceName, setDeviceName] = useState('emulator-5554');
  const [appiumUrl, setAppiumUrl] = useState('http://127.0.0.1:4725');
  const [appPackage, setAppPackage] = useState('');
  
  // Loading states
  const [launching, setLaunching] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);

  // Poll session status when active
  useEffect(() => {
    if (!session) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/ai-assistant/mobile/status`);
        const data = await res.json();
        setStatus(data);
        if (!data.running) {
          setSession(null);
        }
      } catch (e) {
        console.error('Status poll error:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [session]);

  // Check for existing session on mount
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await fetch(`${API_URL}/api/ai-assistant/mobile/status`);
        const data = await res.json();
        if (data.running) {
          setSession(data);
          setStatus(data);
          setPlatform(data.platform || 'android');
          setDeviceName(data.deviceName || 'emulator-5554');
        }
      } catch (e) {}
    };
    checkExisting();
  }, []);

  const launchSession = async () => {
    setLaunching(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/ai-assistant/mobile/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          deviceName,
          appiumUrl,
          app: appPackage || undefined
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSession(data);
        setStatus(data);
      } else {
        setError(data.error || 'Failed to launch session');
        if (data.hint) {
          setError(prev => `${prev}\n\n💡 ${data.hint}`);
        }
      }
    } catch (e) {
      setError(`Connection failed: ${e.message}`);
    } finally {
      setLaunching(false);
    }
  };

  const captureScreen = async () => {
    setCapturing(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/ai-assistant/mobile/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generateLocators: true,
          generatePOM: true,
          generateTransitions: true
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Add platform info to result
        onCapture({
          ...data,
          platform: status?.platform || platform,
          capturedFrom: 'mobile-session'
        });
      } else {
        setError(data.error || 'Capture failed');
      }
    } catch (e) {
      setError(`Capture failed: ${e.message}`);
    } finally {
      setCapturing(false);
    }
  };

  const closeSession = async () => {
    try {
      await fetch(`${API_URL}/api/ai-assistant/mobile/close`, { method: 'POST' });
    } catch (e) {}
    setSession(null);
    setStatus(null);
  };

  // Not connected - show config form
  if (!session) {
    return (
      <div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px'
        }}>
          {/* Platform */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: theme.colors.text.primary
            }}>
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: theme.colors.background.tertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                color: theme.colors.text.primary,
                fontSize: '14px'
              }}
            >
              <option value="android">🤖 Android</option>
              <option value="ios">🍎 iOS</option>
            </select>
          </div>

          {/* Device Name */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: theme.colors.text.primary
            }}>
              Device Name
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="emulator-5554"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: theme.colors.background.tertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                color: theme.colors.text.primary,
                fontSize: '14px'
              }}
            />
            <div style={{
              marginTop: '4px',
              fontSize: '11px',
              color: theme.colors.text.tertiary
            }}>
              Run <code>adb devices</code> to see connected devices
            </div>
          </div>
        </div>

        {/* Appium URL */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.text.primary
          }}>
            Appium Server URL
          </label>
          <input
            type="text"
            value={appiumUrl}
            onChange={(e) => setAppiumUrl(e.target.value)}
            placeholder="http://127.0.0.1:4725"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              color: theme.colors.text.primary,
              fontSize: '14px',
              fontFamily: 'monospace'
            }}
          />
        </div>

        {/* App Package */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.text.primary
          }}>
            App Package (optional)
          </label>
          <input
            type="text"
            value={appPackage}
            onChange={(e) => setAppPackage(e.target.value)}
            placeholder="com.example.myapp"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              color: theme.colors.text.primary,
              fontSize: '14px',
              fontFamily: 'monospace'
            }}
          />
          <div style={{
            marginTop: '4px',
            fontSize: '11px',
            color: theme.colors.text.tertiary
          }}>
            Leave empty to use the currently open app
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div style={{
            padding: '12px',
            background: `${theme.colors.accents.red}15`,
            border: `1px solid ${theme.colors.accents.red}40`,
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px',
            color: theme.colors.accents.red,
            whiteSpace: 'pre-wrap'
          }}>
            ❌ {error}
          </div>
        )}

        {/* Launch button */}
        <button
          onClick={launchSession}
          disabled={launching || !deviceName}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: launching || !deviceName
              ? theme.colors.background.tertiary
              : theme.colors.accents.green,
            border: 'none',
            borderRadius: '8px',
            color: launching || !deviceName
              ? theme.colors.text.tertiary
              : 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: launching || !deviceName ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {launching ? '🔄 Connecting to Appium...' : '🚀 Connect to Device'}
        </button>

        {/* Prerequisites */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: `${theme.colors.accents.yellow}10`,
          border: `1px solid ${theme.colors.accents.yellow}30`,
          borderRadius: '6px'
        }}>
          <div style={{
            fontWeight: 600,
            color: theme.colors.accents.yellow,
            marginBottom: '8px',
            fontSize: '13px'
          }}>
            ⚠️ Prerequisites
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: '20px',
            fontSize: '12px',
            color: theme.colors.text.secondary,
            lineHeight: '1.6'
          }}>
            <li>Appium server running: <code>appium server -p 4725 -a 127.0.0.1 -pa /wd/hub</code></li>
            <li>Android: Emulator running or device connected</li>
            <li>iOS: Simulator running or device connected with provisioning</li>
          </ul>
        </div>
      </div>
    );
  }

  // Connected - show capture controls
  return (
    <div>
      {/* Session status */}
      <div style={{
        padding: '16px',
        background: `${theme.colors.accents.green}15`,
        border: `1px solid ${theme.colors.accents.green}40`,
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{
            fontWeight: 600,
            color: theme.colors.accents.green,
            fontSize: '14px'
          }}>
            ✅ Connected to {status?.platform === 'ios' ? '🍎 iOS' : '🤖 Android'}
          </div>
          <span style={{
            fontSize: '12px',
            color: theme.colors.text.tertiary
          }}>
            {status?.deviceName}
          </span>
        </div>
        
        <div style={{
          fontSize: '13px',
          color: theme.colors.text.secondary
        }}>
          📱 Current Screen: <strong>{status?.currentScreen || 'Unknown'}</strong>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        padding: '20px',
        background: theme.colors.background.tertiary,
        borderRadius: '8px',
        textAlign: 'center',
        marginBottom: '16px'
      }}>
        <div style={{
          fontSize: '32px',
          marginBottom: '8px'
        }}>
          👆
        </div>
        <div style={{
          color: theme.colors.text.primary,
          fontWeight: 500,
          marginBottom: '4px'
        }}>
          Navigate to the screen you want to capture
        </div>
        <div style={{
          color: theme.colors.text.tertiary,
          fontSize: '13px'
        }}>
          Use your device/emulator to navigate, then click Capture
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          padding: '12px',
          background: `${theme.colors.accents.red}15`,
          border: `1px solid ${theme.colors.accents.red}40`,
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px',
          color: theme.colors.accents.red
        }}>
          ❌ {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '12px'
      }}>
        <button
          onClick={captureScreen}
          disabled={capturing}
          style={{
            flex: 1,
            padding: '14px 20px',
            background: capturing
              ? theme.colors.background.tertiary
              : theme.colors.accents.blue,
            border: 'none',
            borderRadius: '8px',
            color: capturing ? theme.colors.text.tertiary : 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: capturing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {capturing ? '📸 Capturing...' : '📸 Capture Screen'}
        </button>
        
        <button
          onClick={closeSession}
          style={{
            padding: '14px 20px',
            background: theme.colors.background.tertiary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            color: theme.colors.text.secondary,
            fontSize: '15px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ✕ Disconnect
        </button>
      </div>

      {/* Quick actions */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: theme.colors.background.secondary,
        borderRadius: '6px',
        border: `1px solid ${theme.colors.border}`
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: theme.colors.text.primary,
          marginBottom: '8px'
        }}>
          🎮 Quick Actions
        </div>
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <QuickActionButton
            label="⬆️ Swipe Up"
            onClick={() => executeAction('swipe', { direction: 'up' })}
            theme={theme}
          />
          <QuickActionButton
            label="⬇️ Swipe Down"
            onClick={() => executeAction('swipe', { direction: 'down' })}
            theme={theme}
          />
          <QuickActionButton
            label="⬅️ Back"
            onClick={() => executeAction('back')}
            theme={theme}
          />
          <QuickActionButton
            label="🏠 Home"
            onClick={() => executeAction('home')}
            theme={theme}
          />
        </div>
      </div>
    </div>
  );
}

// Quick action button helper
function QuickActionButton({ label, onClick, theme }) {
  const [loading, setLoading] = useState(false);
  
  const handleClick = async () => {
    setLoading(true);
    try {
      await onClick();
    } catch (e) {}
    setLoading(false);
  };
  
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: '6px 12px',
        background: theme.colors.background.tertiary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '4px',
        fontSize: '12px',
        color: theme.colors.text.secondary,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1
      }}
    >
      {label}
    </button>
  );
}

// Execute mobile action
async function executeAction(action, params = {}) {
  const endpoints = {
    swipe: '/api/ai-assistant/mobile/swipe',
    back: '/api/ai-assistant/mobile/back',
    home: '/api/ai-assistant/mobile/home'
  };
  
  const endpoint = endpoints[action];
  if (!endpoint) return;
  
  try {
    await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (e) {
    console.error(`Action ${action} failed:`, e);
  }
}