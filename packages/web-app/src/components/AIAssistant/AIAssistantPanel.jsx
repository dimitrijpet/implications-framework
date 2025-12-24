// packages/web-app/src/components/AIAssistant/AIAssistantPanel.jsx

import { useState, useEffect } from 'react';
import { useAIAssistant } from './hooks/useAIAssistant';
import ScanUrlTab from './ScanUrlTab';
import ScanResultsView from './ScanResultsView';

export default function AIAssistantPanel({ theme, projectPath, onElementsGenerated }) {
  const [activeTab, setActiveTab] = useState('scan-url');
  const [collapsed, setCollapsed] = useState(false);
  
  const {
    status,
    scanResult,
    loading,
    error,
    checkStatus,
    scanUrl,
    analyzeScreenshot,
    clearResults
  } = useAIAssistant();

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleScan = async (url, options) => {
    const result = await scanUrl(url, options);
    if (result?.success && onElementsGenerated) {
      onElementsGenerated(result);
    }
    return result;
  };

  const handleScreenshotUpload = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      const result = await analyzeScreenshot(base64, {
        pageTitle: file.name
      });
      if (result?.success && onElementsGenerated) {
        onElementsGenerated(result);
      }
    };
    reader.readAsDataURL(file);
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '12px 20px',
          background: theme.colors.accents.purple,
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000
        }}
      >
        🤖 AI Assistant
      </button>
    );
  }

  return (
    <div 
      className="ai-assistant-panel"
      style={{
        background: theme.colors.background.secondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '12px',
        marginBottom: '24px',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: `linear-gradient(135deg, ${theme.colors.accents.purple}20 0%, ${theme.colors.accents.blue}20 100%)`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🤖</span>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: '18px', 
              fontWeight: 700,
              color: theme.colors.text.primary
            }}>
              AI Assistant
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '12px', 
              color: theme.colors.text.tertiary 
            }}>
              Scan pages, generate POMs & locators
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Status indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: status?.allReady 
              ? `${theme.colors.accents.green}20`
              : `${theme.colors.accents.yellow}20`,
            borderRadius: '20px',
            fontSize: '12px',
            color: status?.allReady 
              ? theme.colors.accents.green 
              : theme.colors.accents.yellow
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: status?.allReady 
                ? theme.colors.accents.green 
                : theme.colors.accents.yellow
            }} />
            {status?.allReady ? 'Ready' : 'Checking...'}
          </div>

          <button
            onClick={() => setCollapsed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.text.tertiary,
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px'
            }}
            title="Minimize"
          >
            ─
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.background.tertiary
      }}>
        {[
          { id: 'scan-url', label: '🔗 Scan URL', icon: '🔗' },
          { id: 'upload', label: '📤 Upload Screenshot', icon: '📤' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === tab.id 
                ? theme.colors.background.secondary 
                : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id 
                ? `2px solid ${theme.colors.accents.purple}` 
                : '2px solid transparent',
              color: activeTab === tab.id 
                ? theme.colors.text.primary 
                : theme.colors.text.tertiary,
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {activeTab === 'scan-url' && (
          <ScanUrlTab
            onScan={handleScan}
            loading={loading}
            error={error}
            theme={theme}
          />
        )}

        {activeTab === 'upload' && (
          <UploadTab
            onUpload={handleScreenshotUpload}
            loading={loading}
            error={error}
            theme={theme}
          />
        )}

        {/* Results */}
        {scanResult && (
          <ScanResultsView
            result={scanResult}
            onClear={clearResults}
            theme={theme}
            projectPath={projectPath}
          />
        )}
      </div>
    </div>
  );
}

// Simple upload tab component
function UploadTab({ onUpload, loading, error, theme }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onUpload(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          padding: '40px',
          border: `2px dashed ${dragOver ? theme.colors.accents.purple : theme.colors.border}`,
          borderRadius: '8px',
          textAlign: 'center',
          background: dragOver ? `${theme.colors.accents.purple}10` : 'transparent',
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}
        onClick={() => document.getElementById('screenshot-input').click()}
      >
        <input
          id="screenshot-input"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>
          {loading ? '⏳' : '📤'}
        </div>
        
        <p style={{ 
          color: theme.colors.text.primary, 
          fontWeight: 600,
          marginBottom: '8px'
        }}>
          {loading ? 'Analyzing...' : 'Drop screenshot here'}
        </p>
        
        <p style={{ 
          color: theme.colors.text.tertiary, 
          fontSize: '13px' 
        }}>
          or click to browse
        </p>
      </div>

      {error && (
        <div style={{
          marginTop: '12px',
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
