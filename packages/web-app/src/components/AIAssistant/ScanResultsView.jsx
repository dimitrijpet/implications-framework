// packages/web-app/src/components/AIAssistant/ScanResultsView.jsx

import { useState, useEffect } from 'react';
import ElementSelector from './ElementSelector';

const API_URL = 'http://localhost:3000';
import CreateStateForm from './CreateStateForm';

export default function ScanResultsView({ 
  result, 
  onClear, 
  theme, 
  projectPath,
  existingStates = [],
  existingEntities = [],
  existingTags = { screen: [], group: [] }
}) {
  const [activeCodeTab, setActiveCodeTab] = useState('locators');
  const [copied, setCopied] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [screenNameOverride, setScreenNameOverride] = useState('');
  const [allElements, setAllElements] = useState(result?.elements || []);
  const [selectedElements, setSelectedElements] = useState(result?.elements || []);
  const [rescanError, setRescanError] = useState(null);

  console.log('ScanResultsView result:', result);
console.log('🔍 Patterns:', result.patterns);
console.log('🔍 CompoundMethods:', result.compoundMethods);

  // Update when result changes
  useEffect(() => {
    if (result?.elements) {
      setAllElements(result.elements);
      setSelectedElements(result.elements);
    }
  }, [result?.elements]);

  if (!result) return null;

  const effectiveScreenName = screenNameOverride || result.screenName || 'UnknownScreen';

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const saveToProject = async (fileType = 'all') => {
    if (!projectPath) {
      alert('No project path set. Please scan a project first.');
      return;
    }

    setSaving(true);
    setSaveResult(null);

    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/save-to-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          screenName: effectiveScreenName,
          fileType,
          code: {
            locators: result.generated?.locators,
            pom: result.generated?.pom,
            transitions: result.generated?.transitions
          },
          overwrite: false
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Save failed');
      }

      setSaveResult(data);
      console.log('✅ Saved to project:', data);

    } catch (err) {
      setSaveResult({ success: false, error: err.message });
    } finally {
      setSaving(false);
    }
  };

  const codeTabs = [
  { id: 'locators', label: '📍 Locators', code: result.generated?.locators },
  { id: 'compound', label: '🧩 Compound', code: result.generated?.compoundLocators },
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

      {/* Save to Project Section */}
      {projectPath && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          background: `${theme.colors.accents.green}10`,
          border: `1px solid ${theme.colors.accents.green}40`,
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h5 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.accents.green
            }}>
              💾 Save to Project
            </h5>
          </div>

          {/* Screen Name Override */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '12px',
              color: theme.colors.text.secondary
            }}>
              Screen Name
            </label>
            <input
              type="text"
              value={screenNameOverride}
              onChange={(e) => setScreenNameOverride(e.target.value)}
              placeholder={result.screenName || 'ScreenName'}
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
            <div style={{
              marginTop: '4px',
              fontSize: '11px',
              color: theme.colors.text.tertiary
            }}>
              Files will be saved to: <code>tests/screens/{effectiveScreenName}/</code>
            </div>
          </div>

          {/* Save Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => saveToProject('all')}
              disabled={saving}
              style={{
                padding: '10px 20px',
                background: saving ? theme.colors.background.tertiary : theme.colors.accents.green,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              {saving ? '⏳ Saving...' : '💾 Save All Files'}
            </button>

            <button
              onClick={() => saveToProject('locators')}
              disabled={saving || !result.generated?.locators}
              style={{
                padding: '8px 16px',
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                opacity: !result.generated?.locators ? 0.5 : 1
              }}
            >
              Save Locators
            </button>

            <button
              onClick={() => saveToProject('pom')}
              disabled={saving || !result.generated?.pom}
              style={{
                padding: '8px 16px',
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                opacity: !result.generated?.pom ? 0.5 : 1
              }}
            >
              Save POM
            </button>

            <button
              onClick={() => saveToProject('transitions')}
              disabled={saving || !result.generated?.transitions}
              style={{
                padding: '8px 16px',
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                opacity: !result.generated?.transitions ? 0.5 : 1
              }}
            >
              Save Transitions
            </button>
          </div>

          {/* Save Result */}
          {saveResult && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: saveResult.success
                ? `${theme.colors.accents.green}20`
                : `${theme.colors.accents.red}20`,
              borderRadius: '6px',
              fontSize: '13px'
            }}>
              {saveResult.success ? (
                <div>
                  <div style={{ 
                    fontWeight: 600, 
                    color: theme.colors.accents.green,
                    marginBottom: '8px'
                  }}>
                    ✅ Files saved successfully!
                  </div>
                  <div style={{ color: theme.colors.text.secondary }}>
                    {saveResult.savedFiles?.map((file, idx) => (
                      <div key={idx} style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '11px',
                        marginBottom: '2px'
                      }}>
                        📄 {file.path.replace(projectPath, '.')}
                      </div>
                    ))}
                  </div>
                  {saveResult.skippedFiles?.length > 0 && (
                    <div style={{ 
                      marginTop: '8px', 
                      color: theme.colors.accents.yellow 
                    }}>
                      ⚠️ Skipped {saveResult.skippedFiles.length} existing files
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: theme.colors.accents.red }}>
                  ❌ {saveResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}

  {/* Create State Machine Implication */}
{projectPath && (
  <CreateStateForm
    result={result}
    projectPath={projectPath}
    theme={theme}
    existingStates={existingStates}
    existingEntities={existingEntities}
    existingTags={existingTags}
    onSuccess={(data) => {
      console.log('✅ Implication created:', data);
    }}
  />
)}


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

{/* Elements Selector */}
<div style={{ marginBottom: '20px' }}>
  <ElementSelector
    elements={allElements}
    patterns={result.patterns}
    compoundMethods={result.compoundMethods}
    screenshot={result.screenshot}
    theme={theme}
    onElementsChange={(selected) => {
      setSelectedElements(selected);
    }}
    onRescan={async (focusPrompt) => {
  setRescanError(null);
  
  // DEBUG: Check what we have
  console.log('🔍 Rescan debug:', {
    hasScreenshot: !!result.screenshot,
    screenshotLength: result.screenshot?.length,
    allElementsCount: allElements.length,
    focusPrompt
  });
  
  if (!result.screenshot) {
    setRescanError('No screenshot available for rescan');
    return;
  }
  
  try {
        const response = await fetch(`${API_URL}/api/ai-assistant/rescan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot: result.screenshot,
            existingElements: allElements,
            focusPrompt,
            pageTitle: result.pageTitle,
            pageUrl: result.pageUrl
          })
        });
        
        const data = await response.json();
        
        if (data.success && data.elements?.length > 0) {
          // Merge new elements with existing
          const merged = [...allElements, ...data.elements];
          setAllElements(merged);
          setSelectedElements(merged);
          console.log(`✅ Added ${data.elements.length} new elements`);
        } else if (data.elements?.length === 0) {
          setRescanError('No additional elements found. Try a different focus area.');
        } else {
  // Ensure error is always a string
  const errorMsg = typeof data.error === 'string' 
    ? data.error 
    : data.error?.message || 'Rescan failed';
  setRescanError(errorMsg);
}
      } catch (err) {
  setRescanError('Rescan failed: ' + (err?.message || String(err)));
}
    }}
  />
  
  {rescanError && (
    <div style={{
      marginTop: '8px',
      padding: '10px',
      background: `${theme.colors.accents.yellow}15`,
      borderRadius: '6px',
      fontSize: '12px',
      color: theme.colors.accents.yellow
    }}>
      ⚠️ {rescanError}
    </div>
  )}
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
