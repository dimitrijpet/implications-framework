// packages/web-app/src/components/AIAssistant/AIAssistantWizard.jsx

import { useState, useEffect } from 'react';
import DebugBrowserTab from './DebugBrowserTab';
import ScanUrlTab from './ScanUrlTab';
import ElementSelector from './ElementSelector';
import MobileSessionTab from './MobileSessionTab';
import POMUpdatePanel from './POMUpdatePanel';
import ImplicationUpdatePanel from './ImplicationUpdatePanel';

const API_URL = 'http://localhost:3000';

const STEPS = [
  { id: 1, name: 'Capture', icon: '📸' },
  { id: 2, name: 'Refine Elements', icon: '🎯' },
  { id: 3, name: 'Screen Object', icon: '📄' },
  { id: 4, name: 'Implication', icon: '🔧' }
];

export default function AIAssistantWizard({ 
  projectPath, 
  theme,
  existingStates = [],
  existingEntities = [],
  onComplete
}) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [captureMode, setCaptureMode] = useState('debug'); // 'debug' | 'url' | 'upload'
  
  // Data collected through steps
  const [scanResult, setScanResult] = useState(null);
  const [selectedElements, setSelectedElements] = useState([]);
  const [screenConfig, setScreenConfig] = useState({
    name: '',
    format: 'single', // 'single' | 'split'
    platform: 'web',
    outputPath: ''
  });
  const [implicationConfig, setImplicationConfig] = useState({
    status: '',
    entity: '',
    previousState: '',
    triggerEvent: ''
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [savedScreenObject, setSavedScreenObject] = useState(null);
  const [mode, setMode] = useState('create'); // 'create' | 'update'
  const [implMode, setImplMode] = useState('create'); // 'create' | 'update'

  // Load project config for defaults
  useEffect(() => {
    if (projectPath) {
      loadProjectConfig();
    }
  }, [projectPath]);

  // Update screen name from scan result
  useEffect(() => {
  if (scanResult) {
    setScreenConfig(prev => ({
      ...prev,
      name: scanResult.screenName || prev.name,
      // Set platform from capture result (mobile captures include platform)
      platform: scanResult.platform || scanResult.capturedFrom === 'mobile-session' 
        ? (scanResult.platform || 'android') 
        : prev.platform
    }));
  }
  if (scanResult?.elements) {
    setSelectedElements(scanResult.elements);
  }
}, [scanResult]);

  const loadProjectConfig = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/config?projectPath=${encodeURIComponent(projectPath)}`
      );
      const data = await response.json();
      
      if (data.config?.screenObjectGeneration) {
        const gen = data.config.screenObjectGeneration;
        setScreenConfig(prev => ({
          ...prev,
          format: gen.format || 'single',
          outputPath: gen.paths?.web || 'tests/screenObjects'
        }));
      }
    } catch (err) {
      console.log('Could not load project config:', err.message);
    }
  };

  // Regenerate code when elements change
  useEffect(() => {
    if (selectedElements.length > 0 && currentStep >= 2) {
      regenerateCode();
    }
  }, [selectedElements, screenConfig.name, screenConfig.format]);

  const regenerateCode = async () => {
    if (!selectedElements.length || !screenConfig.name) return;

    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/generate-screen-object`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elements: selectedElements,
          screenName: screenConfig.name,
          format: screenConfig.format,
          platform: screenConfig.platform,
          style: {
            useThisPage: true,
            includeAssertions: true,
            includeCompoundActions: true
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedCode(data.code);
      }
    } catch (err) {
      console.error('Code generation failed:', err);
    }
  };

  const handleCapture = (result) => {
    setScanResult(result);
    setSelectedElements(result.elements || []);
    setError(null);
    // Auto-advance to step 2
    setCurrentStep(2);
  };

  const handleSaveScreenObject = async () => {
    if (!generatedCode || !screenConfig.name) {
      setError('Please enter a screen name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/save-screen-object`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          screenName: screenConfig.name,
          format: screenConfig.format,
          platform: screenConfig.platform,
          outputPath: screenConfig.outputPath,
          code: generatedCode
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSavedScreenObject(data);
        // Auto-advance to step 4
        setCurrentStep(4);
      } else {
        setError(data.error || 'Failed to save screen object');
      }
    } catch (err) {
      setError('Save failed: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateImplication = async () => {
    if (!implicationConfig.status) {
      setError('Please enter a status name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/create-implication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
    projectPath,
    screenName: screenConfig.name,
    screenObjectPath: savedScreenObject?.filePath,
    elements: selectedElements,
    status: implicationConfig.status,
    entity: implicationConfig.entity,
    previousState: implicationConfig.previousState,
    triggerEvent: implicationConfig.triggerEvent,
    platform: screenConfig.platform,
    screenshot: scanResult?.screenshot  // ADD THIS
  })
      });

      const data = await response.json();
      
      if (data.success) {
        if (onComplete) {
          onComplete(data);
        }
        // Reset wizard or show success
        alert('✅ Implication created successfully!');
      } else {
        setError(data.error || 'Failed to create implication');
      }
    } catch (err) {
      setError('Creation failed: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const canAdvance = () => {
    switch (currentStep) {
      case 1: return !!scanResult;
      case 2: return selectedElements.length > 0;
      case 3: return !!screenConfig.name && !!generatedCode;
      case 4: return true; // Optional step
      default: return false;
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goNext = () => {
    if (currentStep < 4 && canAdvance()) {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Step Indicator */}
      <StepIndicator 
        steps={STEPS} 
        currentStep={currentStep} 
        theme={theme}
        onStepClick={(step) => {
          // Allow going back to completed steps
          if (step < currentStep) {
            setCurrentStep(step);
          }
        }}
      />

      {/* Step Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* Step 1: Capture */}
        {currentStep === 1 && (
          <StepCapture
            captureMode={captureMode}
            setCaptureMode={setCaptureMode}
            onCapture={handleCapture}
            theme={theme}
            projectPath={projectPath}
          />
        )}

{/* Step 2: Refine Elements */}
{currentStep === 2 && (
  <div>
    {/* Mode Toggle */}
    <div style={{
      display: 'flex',
      gap: '8px',
      marginBottom: '20px'
    }}>
      <button
        onClick={() => setMode('create')}
        style={{
          flex: 1,
          padding: '12px',
          background: mode === 'create' 
            ? `${theme.colors.accents.green}20` 
            : theme.colors.background.tertiary,
          border: `2px solid ${mode === 'create' 
            ? theme.colors.accents.green 
            : theme.colors.border}`,
          borderRadius: '8px',
          cursor: 'pointer',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '20px', marginBottom: '4px' }}>📄</div>
        <div style={{ 
          fontWeight: 600, 
          color: theme.colors.text.primary 
        }}>
          Create New
        </div>
        <div style={{ 
          fontSize: '11px', 
          color: theme.colors.text.tertiary 
        }}>
          New screen object
        </div>
      </button>
      
      <button
        onClick={() => setMode('update')}
        style={{
          flex: 1,
          padding: '12px',
          background: mode === 'update' 
            ? `${theme.colors.accents.blue}20` 
            : theme.colors.background.tertiary,
          border: `2px solid ${mode === 'update' 
            ? theme.colors.accents.blue 
            : theme.colors.border}`,
          borderRadius: '8px',
          cursor: 'pointer',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '20px', marginBottom: '4px' }}>🔄</div>
        <div style={{ 
          fontWeight: 600, 
          color: theme.colors.text.primary 
        }}>
          Update Existing
        </div>
        <div style={{ 
          fontSize: '11px', 
          color: theme.colors.text.tertiary 
        }}>
          Add to existing POM
        </div>
      </button>
    </div>

    {/* Show appropriate panel based on mode */}
    {mode === 'create' ? (
      <StepRefineElements
        allElements={scanResult?.elements || []}
        selectedElements={selectedElements}
        setSelectedElements={setSelectedElements}
        screenshot={scanResult?.screenshot}
        theme={theme}
        onAddElements={(newElements) => {
          setScanResult(prev => ({
            ...prev,
            elements: [...(prev?.elements || []), ...newElements]
          }));
          setSelectedElements(prev => [...prev, ...newElements]);
        }}
        onRescan={async (focusPrompt) => {
          if (!scanResult?.screenshot) {
            setError('No screenshot available');
            return;
          }
          
          try {
            const response = await fetch(`${API_URL}/api/ai-assistant/rescan`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                screenshot: scanResult.screenshot,
                existingElements: selectedElements,
                focusPrompt
              })
            });
            
            const data = await response.json();
            if (data.success && data.elements?.length > 0) {
              setSelectedElements([...selectedElements, ...data.elements]);
            } else if (data.elements?.length === 0) {
              setError('No additional elements found');
            }
          } catch (err) {
            setError('Rescan failed: ' + (err?.message || String(err)));
          }
        }}
      />
    ) : (
      <POMUpdatePanel
        projectPath={projectPath}
        capturedElements={scanResult?.elements || []}
        platform={screenConfig.platform}
        theme={theme}
        onComplete={(result) => {
          alert(`✅ Updated ${result.filePath}\n\nAdded ${result.changes.addedLocators} locators\nUpdated ${result.changes.updatedSelectors} selectors\n\nBackup saved to ${result.backupPath}`);
          // Skip Step 3 (save) since we already saved, go directly to Step 4 (implication)
          setCurrentStep(4);
        }}
        onCancel={() => setMode('create')}
      />
    )}
  </div>
)}

        {/* Step 3: Generate Screen Object */}
        {currentStep === 3 && (
          <StepScreenObject
            config={screenConfig}
            setConfig={setScreenConfig}
            generatedCode={generatedCode}
            loading={loading}
            onSave={handleSaveScreenObject}
            theme={theme}
            projectPath={projectPath}
          />
        )}

       {/* Step 4: Create Implication */}
{currentStep === 4 && (
  <div>
    {/* Mode Toggle */}
    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
      <button
        onClick={() => setImplMode('create')}
        style={{
          flex: 1,
          padding: '12px',
          background: implMode === 'create' ? `${theme.colors.accents.green}20` : theme.colors.background.tertiary,
          border: `2px solid ${implMode === 'create' ? theme.colors.accents.green : theme.colors.border}`,
          borderRadius: '8px',
          cursor: 'pointer',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '20px', marginBottom: '4px' }}>📄</div>
        <div style={{ fontWeight: 600, color: theme.colors.text.primary }}>Create New</div>
        <div style={{ fontSize: '11px', color: theme.colors.text.tertiary }}>New implication</div>
      </button>
      
      <button
        onClick={() => setImplMode('update')}
        style={{
          flex: 1,
          padding: '12px',
          background: implMode === 'update' ? `${theme.colors.accents.blue}20` : theme.colors.background.tertiary,
          border: `2px solid ${implMode === 'update' ? theme.colors.accents.blue : theme.colors.border}`,
          borderRadius: '8px',
          cursor: 'pointer',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '20px', marginBottom: '4px' }}>🔄</div>
        <div style={{ fontWeight: 600, color: theme.colors.text.primary }}>Update Existing</div>
        <div style={{ fontSize: '11px', color: theme.colors.text.tertiary }}>Add to existing</div>
      </button>
    </div>

    {implMode === 'create' ? (
      <StepImplication
        config={implicationConfig}
        setConfig={setImplicationConfig}
        screenConfig={screenConfig}
        savedScreenObject={savedScreenObject}
        existingStates={existingStates}
        existingEntities={existingEntities}
        loading={loading}
        onCreate={handleCreateImplication}
        onSkip={() => {
          if (onClose) onClose();
        }}
        theme={theme}
      />
    ) : (
      <ImplicationUpdatePanel
        projectPath={projectPath}
        capturedElements={selectedElements}
        screenName={screenConfig.name}
        platform={screenConfig.platform}
        theme={theme}
        onComplete={(result) => {
          alert(`✅ Updated ${result.filePath}\n\nAdded ${result.changes.addedElements} elements`);
          if (onClose) onClose();
        }}
        onCancel={() => setImplMode('create')}
      />
    )}
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
      </div>

      {/* Navigation Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: `1px solid ${theme.colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: theme.colors.background.secondary
      }}>
        <button
          onClick={goBack}
          disabled={currentStep === 1}
          style={{
            padding: '10px 20px',
            background: currentStep === 1 
              ? theme.colors.background.tertiary 
              : theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            color: currentStep === 1 
              ? theme.colors.text.tertiary 
              : theme.colors.text.primary,
            cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          ← Back
        </button>

        <div style={{ 
          fontSize: '13px', 
          color: theme.colors.text.tertiary 
        }}>
          Step {currentStep} of {STEPS.length}
        </div>

        {currentStep < 3 && (
          <button
            onClick={goNext}
            disabled={!canAdvance()}
            style={{
              padding: '10px 20px',
              background: canAdvance() 
                ? theme.colors.accents.purple 
                : theme.colors.background.tertiary,
              border: 'none',
              borderRadius: '6px',
              color: canAdvance() ? 'white' : theme.colors.text.tertiary,
              cursor: canAdvance() ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            Next Step →
          </button>
        )}

        {currentStep === 3 && (
          <button
            onClick={handleSaveScreenObject}
            disabled={!canAdvance() || loading}
            style={{
              padding: '10px 20px',
              background: canAdvance() && !loading
                ? theme.colors.accents.green 
                : theme.colors.background.tertiary,
              border: 'none',
              borderRadius: '6px',
              color: canAdvance() && !loading ? 'white' : theme.colors.text.tertiary,
              cursor: canAdvance() && !loading ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            {loading ? '⏳ Saving...' : '💾 Save & Continue'}
          </button>
        )}

        {currentStep === 4 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onComplete?.({ skipped: true })}
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
              Skip
            </button>
            <button
              onClick={handleCreateImplication}
              disabled={!implicationConfig.status || loading}
              style={{
                padding: '10px 20px',
                background: implicationConfig.status && !loading
                  ? theme.colors.accents.green 
                  : theme.colors.background.tertiary,
                border: 'none',
                borderRadius: '6px',
                color: implicationConfig.status && !loading ? 'white' : theme.colors.text.tertiary,
                cursor: implicationConfig.status && !loading ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {loading ? '⏳ Creating...' : '🔧 Create Implication'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP INDICATOR COMPONENT
// ═══════════════════════════════════════════════════════════════

function StepIndicator({ steps, currentStep, theme, onStepClick }) {
  return (
    <div style={{
      display: 'flex',
      padding: '16px 20px',
      borderBottom: `1px solid ${theme.colors.border}`,
      background: theme.colors.background.secondary
    }}>
      {steps.map((step, idx) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        const isClickable = step.id < currentStep;

        return (
          <div
            key={step.id}
            onClick={() => isClickable && onStepClick(step.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              cursor: isClickable ? 'pointer' : 'default'
            }}
          >
            {/* Step circle */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive 
                ? theme.colors.accents.purple 
                : isCompleted 
                  ? theme.colors.accents.green 
                  : theme.colors.background.tertiary,
              color: isActive || isCompleted ? 'white' : theme.colors.text.tertiary,
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s'
            }}>
              {isCompleted ? '✓' : step.icon}
            </div>

            {/* Step label */}
            <span style={{
              marginLeft: '8px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive 
                ? theme.colors.text.primary 
                : theme.colors.text.tertiary,
              display: idx === steps.length - 1 ? 'block' : 'none',
              '@media (min-width: 600px)': {
                display: 'block'
              }
            }}>
              {step.name}
            </span>

            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: '2px',
                background: isCompleted 
                  ? theme.colors.accents.green 
                  : theme.colors.border,
                margin: '0 12px',
                transition: 'background 0.2s'
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 1: CAPTURE
// ═══════════════════════════════════════════════════════════════

function StepCapture({ captureMode, setCaptureMode, onCapture, theme, projectPath }) {
  return (
    <div>
      <h3 style={{ 
        margin: '0 0 8px 0', 
        color: theme.colors.text.primary,
        fontSize: '18px'
      }}>
        📸 Capture Screen
      </h3>
      <p style={{ 
        margin: '0 0 20px 0', 
        color: theme.colors.text.secondary,
        fontSize: '14px'
      }}>
        Choose how to capture the screen you want to analyze.
      </p>

      {/* Mode selector */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'debug', label: '🌐 Web Browser', desc: 'Interactive browser' },
          { id: 'mobile', label: '📱 Mobile App', desc: 'Android / iOS' },
          { id: 'url', label: '🔗 Scan URL', desc: 'Public pages' },
          { id: 'upload', label: '📤 Upload', desc: 'From file' }
        ].map(mode => (
          <button
            key={mode.id}
            onClick={() => setCaptureMode(mode.id)}
            style={{
              flex: 1,
              padding: '16px',
              background: captureMode === mode.id 
                ? `${theme.colors.accents.purple}20` 
                : theme.colors.background.tertiary,
              border: `2px solid ${captureMode === mode.id 
                ? theme.colors.accents.purple 
                : theme.colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 600,
              color: theme.colors.text.primary,
              marginBottom: '4px'
            }}>
              {mode.label}
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: theme.colors.text.tertiary 
            }}>
              {mode.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Capture content based on mode */}
      {captureMode === 'debug' && (
        <DebugBrowserTab
          onCapture={onCapture}
          theme={theme}
          projectPath={projectPath}
        />
      )}

      {captureMode === 'url' && (
        <ScanUrlTab
          onScanComplete={onCapture}
          theme={theme}
        />
      )}

      {captureMode === 'upload' && (
        <UploadScreenshot
          onCapture={onCapture}
          theme={theme}
        />
      )}

      {captureMode === 'mobile' && (
        <MobileSessionTab
          onCapture={onCapture}
          theme={theme}
          projectPath={projectPath}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: REFINE ELEMENTS
// ═══════════════════════════════════════════════════════════════

function StepRefineElements({ 
  allElements, 
  selectedElements, 
  setSelectedElements, 
  screenshot, 
  theme, 
  onAddElements,
  onRescan 
}) {
  // Track which element indices are selected
  const [selectedIndices, setSelectedIndices] = useState(() => {
    // Initially, find indices of selected elements in allElements
    return new Set(allElements.map((_, i) => i));
  });

  // Update selection when allElements changes (e.g., after rescan)
  useEffect(() => {
    // Select all new elements by default
    setSelectedIndices(new Set(allElements.map((_, i) => i)));
  }, [allElements.length]);

  // When selection changes, update parent's selectedElements
  useEffect(() => {
    const selected = allElements.filter((_, i) => selectedIndices.has(i));
    setSelectedElements(selected);
  }, [selectedIndices, allElements, setSelectedElements]);

  const toggleElement = (index) => {
    setSelectedIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedIndices(new Set(allElements.map((_, i) => i)));
  };

  const selectNone = () => {
    setSelectedIndices(new Set());
  };

  const selectByType = (type) => {
    const matching = new Set(
      allElements
        .map((el, i) => el.type === type ? i : null)
        .filter(i => i !== null)
    );
    setSelectedIndices(matching);
  };

  // Get unique types for filter buttons
  const types = [...new Set(allElements.map(el => el.type))];

  return (
    <div>
      <h3 style={{ 
        margin: '0 0 8px 0', 
        color: theme.colors.text.primary,
        fontSize: '18px'
      }}>
        🎯 Refine Elements
      </h3>
      <p style={{ 
        margin: '0 0 20px 0', 
        color: theme.colors.text.secondary,
        fontSize: '14px'
      }}>
        Select the elements you want to include in your screen object. 
        Unchecked elements won't be included in the generated code.
      </p>

      {/* Screenshot preview */}
      {screenshot && (
        <div style={{ marginBottom: '16px' }}>
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Captured screen"
            style={{
              maxWidth: '100%',
              maxHeight: '200px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`
            }}
          />
        </div>
      )}

      {/* Selection controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 600,
          color: theme.colors.text.primary 
        }}>
          🎯 {selectedIndices.size}/{allElements.length} elements selected
        </div>
        
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={selectAll}
            style={{
              padding: '4px 10px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              fontSize: '11px',
              color: theme.colors.text.secondary,
              cursor: 'pointer'
            }}
          >
            All
          </button>
          <button
            onClick={selectNone}
            style={{
              padding: '4px 10px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              fontSize: '11px',
              color: theme.colors.text.secondary,
              cursor: 'pointer'
            }}
          >
            None
          </button>
          {types.map(type => (
            <button
              key={type}
              onClick={() => selectByType(type)}
              style={{
                padding: '4px 10px',
                background: theme.colors.background.tertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                fontSize: '11px',
                color: theme.colors.text.secondary,
                cursor: 'pointer'
              }}
            >
              {getTypeIcon(type)} {type}
            </button>
          ))}
        </div>
      </div>

      {/* Elements list */}
      <div style={{
        maxHeight: '350px',
        overflowY: 'auto',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        {allElements.map((element, idx) => {
          const isSelected = selectedIndices.has(idx);
          
          return (
            <div
              key={idx}
              style={{
                padding: '10px 12px',
                borderBottom: `1px solid ${theme.colors.border}`,
                background: isSelected 
                  ? `${theme.colors.accents.green}08`
                  : theme.colors.background.secondary,
                opacity: isSelected ? 1 : 0.6,
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleElement(idx)}
                  style={{ 
                    width: '18px', 
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />

                {/* Type icon */}
                <span style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  background: getTypeColor(element.type, theme),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  flexShrink: 0
                }}>
                  {getTypeIcon(element.type)}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600,
                    color: theme.colors.text.primary,
                    fontSize: '13px',
                    textDecoration: isSelected ? 'none' : 'line-through'
                  }}>
                    {element.name}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: theme.colors.text.tertiary,
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {element.selectors?.[0]?.value || 'No selector'}
                  </div>
                </div>

                {/* Type badge */}
                <span style={{
                  padding: '2px 8px',
                  background: `${theme.colors.accents.blue}20`,
                  borderRadius: '4px',
                  fontSize: '10px',
                  color: theme.colors.accents.blue,
                  flexShrink: 0
                }}>
                  {element.type}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rescan section */}
      <RescanSection 
        theme={theme}
        onRescan={async (focusPrompt) => {
          if (onRescan) {
            await onRescan(focusPrompt);
          }
        }}
      />
    </div>
  );
}

// Helper component for rescan
function RescanSection({ theme, onRescan }) {
  const [rescanPrompt, setRescanPrompt] = useState('');
  const [rescanning, setRescanning] = useState(false);
  const [error, setError] = useState(null);

  const handleRescan = async () => {
    if (!rescanPrompt.trim()) return;
    
    setRescanning(true);
    setError(null);
    
    try {
      await onRescan(rescanPrompt);
      setRescanPrompt('');
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setRescanning(false);
    }
  };

  return (
    <div style={{
      padding: '12px',
      background: `${theme.colors.accents.blue}10`,
      borderRadius: '8px'
    }}>
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: theme.colors.text.primary,
        marginBottom: '8px'
      }}>
        🔍 Scan for More Elements
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={rescanPrompt}
          onChange={(e) => setRescanPrompt(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleRescan()}
          placeholder="Focus on... (e.g., 'navigation links', 'form inputs')"
          style={{
            flex: 1,
            padding: '10px 12px',
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            color: theme.colors.text.primary,
            fontSize: '13px'
          }}
        />
        <button
          onClick={handleRescan}
          disabled={rescanning || !rescanPrompt.trim()}
          style={{
            padding: '10px 16px',
            background: rescanning || !rescanPrompt.trim()
              ? theme.colors.background.tertiary 
              : theme.colors.accents.blue,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: rescanning || !rescanPrompt.trim() ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '13px',
            whiteSpace: 'nowrap'
          }}
        >
          {rescanning ? '⏳' : '🔍'} Rescan
        </button>
      </div>
      
      <div style={{
        marginTop: '8px',
        fontSize: '11px',
        color: theme.colors.text.tertiary
      }}>
        💡 Quick: 
        {['navigation', 'buttons', 'inputs', 'links', 'footer'].map(prompt => (
          <button
            key={prompt}
            onClick={() => setRescanPrompt(`Focus on ${prompt}`)}
            style={{
              marginLeft: '6px',
              padding: '2px 6px',
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '3px',
              fontSize: '10px',
              color: theme.colors.text.secondary,
              cursor: 'pointer'
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: `${theme.colors.accents.red}15`,
          borderRadius: '4px',
          fontSize: '12px',
          color: theme.colors.accents.red
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

// Helper functions (add at the bottom of the file if not already there)
function getTypeIcon(type) {
  const icons = {
    button: '🔘',
    input: '📝',
    link: '🔗',
    text: '📄',
    image: '🖼️',
    checkbox: '☑️',
    select: '📋',
    heading: '📰',
    nav: '🧭',
    icon: '⭐'
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

// ═══════════════════════════════════════════════════════════════
// STEP 3: SCREEN OBJECT
// ═══════════════════════════════════════════════════════════════

function StepScreenObject({ config, setConfig, generatedCode, loading, onSave, theme, projectPath }) {
  const [activeTab, setActiveTab] = useState('single');

  return (
    <div>
      <h3 style={{ 
        margin: '0 0 8px 0', 
        color: theme.colors.text.primary,
        fontSize: '18px'
      }}>
        📄 Generate Screen Object
      </h3>
      <p style={{ 
        margin: '0 0 20px 0', 
        color: theme.colors.text.secondary,
        fontSize: '14px'
      }}>
        Configure and preview your screen object before saving.
      </p>

      {/* Config form */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Screen Name */}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.text.primary
          }}>
            Screen Name *
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="PasswordRecoveryScreen"
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
            Output: {config.name?.toLowerCase() || 'screen'}.screen.js
          </div>
        </div>

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
            value={config.platform}
            onChange={(e) => setConfig({ ...config, platform: e.target.value })}
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
            <option value="web">Web (Playwright)</option>
            <option value="dancer">Mobile - Dancer</option>
            <option value="manager">Mobile - Manager</option>
          </select>
        </div>

        {/* Output Path */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.text.primary
          }}>
            Output Path
          </label>
          <input
            type="text"
            value={config.outputPath}
            onChange={(e) => setConfig({ ...config, outputPath: e.target.value })}
            placeholder="tests/web/screenObjects"
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
      </div>

      {/* Format selector */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: theme.colors.text.primary
        }}>
          Output Format
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setConfig({ ...config, format: 'single' })}
            style={{
              flex: 1,
              padding: '12px',
              background: config.format === 'single' 
                ? `${theme.colors.accents.purple}20` 
                : theme.colors.background.tertiary,
              border: `2px solid ${config.format === 'single' 
                ? theme.colors.accents.purple 
                : theme.colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ 
              fontWeight: 600, 
              color: theme.colors.text.primary,
              marginBottom: '4px'
            }}>
              📄 Single File
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: theme.colors.text.tertiary 
            }}>
              Locators + actions in one file
            </div>
          </button>
          
          <button
            onClick={() => setConfig({ ...config, format: 'split' })}
            style={{
              flex: 1,
              padding: '12px',
              background: config.format === 'split' 
                ? `${theme.colors.accents.purple}20` 
                : theme.colors.background.tertiary,
              border: `2px solid ${config.format === 'split' 
                ? theme.colors.accents.purple 
                : theme.colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ 
              fontWeight: 600, 
              color: theme.colors.text.primary,
              marginBottom: '4px'
            }}>
              📁 Split Files
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: theme.colors.text.tertiary 
            }}>
              Separate .screen.js and .actions.js
            </div>
          </button>
        </div>
      </div>

      {/* Code preview */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: theme.colors.text.primary
        }}>
          Preview
        </label>
        
        {generatedCode ? (
          <pre style={{
            margin: 0,
            padding: '16px',
            background: '#1a1a2e',
            borderRadius: '8px',
            overflow: 'auto',
            maxHeight: '300px',
            fontSize: '12px',
            lineHeight: '1.5',
            color: '#e0e0e0',
            fontFamily: "'Fira Code', 'Monaco', monospace"
          }}>
            <code>
              {typeof generatedCode === 'string' 
                ? generatedCode 
                : generatedCode.screen || generatedCode.single || 'Generating...'}
            </code>
          </pre>
        ) : (
          <div style={{
            padding: '40px',
            background: theme.colors.background.tertiary,
            borderRadius: '8px',
            textAlign: 'center',
            color: theme.colors.text.tertiary
          }}>
            {config.name ? '⏳ Generating preview...' : 'Enter a screen name to see preview'}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 4: IMPLICATION
// ═══════════════════════════════════════════════════════════════

function StepImplication({ 
  config, 
  setConfig, 
  screenConfig,
  savedScreenObject,
  existingStates,
  existingEntities,
  loading,
  onCreate,
  onSkip,
  theme 
}) {
  return (
    <div>
      <h3 style={{ 
        margin: '0 0 8px 0', 
        color: theme.colors.text.primary,
        fontSize: '18px'
      }}>
        🔧 Create Implication (Optional)
      </h3>
      <p style={{ 
        margin: '0 0 20px 0', 
        color: theme.colors.text.secondary,
        fontSize: '14px'
      }}>
        Create a state machine implication that references your new screen object.
      </p>

      {/* Success banner */}
      {savedScreenObject && (
        <div style={{
          padding: '12px 16px',
          background: `${theme.colors.accents.green}15`,
          border: `1px solid ${theme.colors.accents.green}40`,
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{ 
            fontWeight: 600, 
            color: theme.colors.accents.green,
            marginBottom: '4px'
          }}>
            ✅ Screen Object Saved
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: theme.colors.text.secondary,
            fontFamily: 'monospace'
          }}>
            {savedScreenObject.filePath}
          </div>
        </div>
      )}

      {/* Config form */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16px'
      }}>
        {/* Status */}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.text.primary
          }}>
            Status Name *
          </label>
          <input
            type="text"
            value={config.status}
            onChange={(e) => setConfig({ ...config, status: e.target.value })}
            placeholder="password_recovery_shown"
            list="existing-statuses"
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
          <datalist id="existing-statuses">
            {existingStates.map(s => (
              <option key={s.status} value={s.status} />
            ))}
          </datalist>
        </div>

        {/* Entity */}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.text.primary
          }}>
            Entity
          </label>
          <input
            type="text"
            value={config.entity}
            onChange={(e) => setConfig({ ...config, entity: e.target.value })}
            placeholder="user"
            list="existing-entities"
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
          <datalist id="existing-entities">
            {existingEntities.map(e => (
              <option key={e} value={e} />
            ))}
          </datalist>
          
          {/* Quick pick entities */}
          {existingEntities.length > 0 && (
            <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {existingEntities.slice(0, 5).map(entity => (
                <button
                  key={entity}
                  onClick={() => setConfig({ ...config, entity })}
                  style={{
                    padding: '2px 8px',
                    background: config.entity === entity 
                      ? theme.colors.accents.purple 
                      : theme.colors.background.tertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: config.entity === entity 
                      ? 'white' 
                      : theme.colors.text.secondary,
                    cursor: 'pointer'
                  }}
                >
                  {entity}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Previous State */}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.text.primary
          }}>
            Previous State
          </label>
          <select
            value={config.previousState}
            onChange={(e) => setConfig({ ...config, previousState: e.target.value })}
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
            <option value="">Select previous state...</option>
            {existingStates.map(s => (
              <option key={s.status} value={s.status}>{s.status}</option>
            ))}
          </select>
        </div>

        {/* Trigger Event */}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.text.primary
          }}>
            Trigger Event
          </label>
          <input
            type="text"
            value={config.triggerEvent}
            onChange={(e) => setConfig({ ...config, triggerEvent: e.target.value })}
            placeholder="SHOW_PASSWORD_RECOVERY"
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
        </div>
      </div>

      {/* Reference info */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        background: `${theme.colors.accents.blue}10`,
        borderRadius: '6px',
        fontSize: '12px',
        color: theme.colors.text.secondary
      }}>
        <strong>This implication will reference:</strong>
        <div style={{ marginTop: '8px', fontFamily: 'monospace' }}>
          📄 Screen: {screenConfig.name}.screen.js<br />
          🔧 Instance: {screenConfig.name?.charAt(0).toLowerCase() + screenConfig.name?.slice(1) || 'screen'}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD SCREENSHOT COMPONENT
// ═══════════════════════════════════════════════════════════════

function UploadScreenshot({ onCapture, theme }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result.split(',')[1];
        setPreview(base64);

        // Analyze screenshot
        const response = await fetch(`${API_URL}/api/ai-assistant/analyze-screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot: base64,
            generateLocators: true,
            generatePOM: true,
            generateTransitions: true
          })
        });

        const data = await response.json();
        
        if (data.success) {
          onCapture({ ...data, screenshot: base64 });
        }
        
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{
        border: `2px dashed ${theme.colors.border}`,
        borderRadius: '8px',
        padding: '40px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s'
      }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          id="screenshot-upload"
        />
        <label 
          htmlFor="screenshot-upload"
          style={{ cursor: 'pointer' }}
        >
          {uploading ? (
            <div>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
              <div style={{ color: theme.colors.text.secondary }}>
                Analyzing screenshot...
              </div>
            </div>
          ) : preview ? (
            <div>
              <img 
                src={`data:image/png;base64,${preview}`}
                alt="Preview"
                style={{ 
                  maxWidth: '200px', 
                  maxHeight: '150px',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}
              />
              <div style={{ color: theme.colors.text.secondary }}>
                Click to upload different screenshot
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📤</div>
              <div style={{ 
                color: theme.colors.text.primary,
                fontWeight: 600,
                marginBottom: '4px'
              }}>
                Drop screenshot here or click to upload
              </div>
              <div style={{ 
                color: theme.colors.text.tertiary,
                fontSize: '12px'
              }}>
                PNG, JPG up to 10MB
              </div>
            </div>
          )}
        </label>
      </div>
    </div>
  );
}