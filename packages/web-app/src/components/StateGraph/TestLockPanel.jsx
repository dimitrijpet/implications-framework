import { useState, useEffect } from 'react';

export default function TestLockPanel({ state, projectPath, theme, incomingTransitions = [] }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  
  useEffect(() => {
    loadTests();
  }, [state?.meta?.setup, state?.meta?.status, projectPath, incomingTransitions]);
  
  const loadTests = async () => {
    if (!projectPath) {
      setTests([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Build test entries from BOTH setup AND incoming transitions
      const testEntries = buildTestEntries();
      
      if (testEntries.length === 0) {
        setTests([]);
        setLoading(false);
        return;
      }
      
      const response = await fetch(
        `/api/locks/state/${encodeURIComponent(state?.name || state?.meta?.status)}?` +
        `projectPath=${encodeURIComponent(projectPath)}&` +
        `setupEntries=${encodeURIComponent(JSON.stringify(testEntries))}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setTests(data.tests || []);
      }
    } catch (err) {
      console.error('Failed to load test locks:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Build complete list of test entries from setup + incoming transitions
  const buildTestEntries = () => {
    const entries = [];
    const seenFiles = new Set();
    
    // 1. Add from setup array (if exists)
    const setupEntries = state?.meta?.setup || state?.xstateConfig?.meta?.setup || [];
    for (const entry of setupEntries) {
      if (entry.testFile && !seenFiles.has(entry.testFile)) {
        seenFiles.add(entry.testFile);
        entries.push({
          testFile: entry.testFile,
          actionName: entry.actionName,
          platform: entry.platform || 'web',
          source: 'setup'
        });
      }
    }
    
    // 2. Add from incoming transitions (build expected filenames)
    const stateName = state?.name || state?.meta?.status;
    for (const transition of incomingTransitions) {
      const testFile = buildTestFilePath(stateName, transition);
      if (testFile && !seenFiles.has(testFile)) {
        seenFiles.add(testFile);
        entries.push({
          testFile,
          actionName: buildActionName(stateName, transition.from),
          platform: transition.platform || 'web',
          source: 'transition',
          event: transition.event,
          fromState: transition.from
        });
      }
    }
    
    return entries;
  };
  
  // Build test file path from state name and transition
  const buildTestFilePath = (stateName, transition) => {
    if (!stateName || !transition.from || !transition.event) return null;
    
    const toPascal = (str) => str
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
    
    const targetPascal = toPascal(stateName);
    const fromPascal = toPascal(transition.from);
    const event = transition.event.toUpperCase().replace(/_/g, '');
    const platform = (transition.platform || 'web').charAt(0).toUpperCase() + (transition.platform || 'web').slice(1).toLowerCase();
    
    return `tests/implications/bookings/status/${targetPascal}Via${fromPascal}-${event}-${platform}-UNIT.spec.js`;
  };
  
  // Build action name from state and fromState
  const buildActionName = (stateName, fromState) => {
    const toPascal = (str) => str
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
    
    const targetPascal = toPascal(stateName);
    const fromPascal = toPascal(fromState);
    
    // flightsInputDaataViaFlightsReturn
    return targetPascal.charAt(0).toLowerCase() + targetPascal.slice(1) + 'Via' + fromPascal;
  };
  
  const toggleLock = async (testFile, currentlyLocked) => {
    setUpdating(testFile);
    
    try {
      const reason = !currentlyLocked 
        ? window.prompt('Lock reason (optional):', 'Manual edits')
        : null;
      
      // User cancelled the prompt
      if (!currentlyLocked && reason === null) {
        setUpdating(null);
        return;
      }
      
      const response = await fetch('/api/locks/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          testPath: testFile,
          reason: reason || undefined
        })
      });
      
      if (response.ok) {
        await loadTests();
      } else {
        const error = await response.json();
        alert(`Failed to toggle lock: ${error.error}`);
      }
    } catch (err) {
      console.error('Failed to toggle lock:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };
  
  if (loading) {
    return (
      <div 
        className="p-4 rounded-lg text-center"
        style={{ background: theme.colors.background.secondary }}
      >
        <span style={{ color: theme.colors.text.tertiary }}>Loading test locks...</span>
      </div>
    );
  }
  
  if (tests.length === 0) {
    return (
      <div 
        className="p-4 rounded-lg text-center"
        style={{ background: theme.colors.background.secondary }}
      >
        <span style={{ color: theme.colors.text.tertiary }}>No tests found for this state</span>
      </div>
    );
  }
  
  const lockedCount = tests.filter(t => t.locked).length;
  
  return (
    <div className="space-y-3">
      {/* Summary */}
      <div 
        className="p-3 rounded-lg flex items-center justify-between"
        style={{ 
          background: lockedCount > 0 
            ? `${theme.colors.accents.orange}15`
            : `${theme.colors.accents.green}15`,
          border: `1px solid ${lockedCount > 0 ? theme.colors.accents.orange : theme.colors.accents.green}40`
        }}
      >
        <span style={{ color: lockedCount > 0 ? theme.colors.accents.orange : theme.colors.accents.green }}>
          {lockedCount > 0 
            ? `🔒 ${lockedCount} of ${tests.length} test(s) locked - will be skipped during regeneration`
            : `🔓 ${tests.length} test(s) - all unlocked`
          }
        </span>
      </div>
      
      {/* Test list */}
      <div className="space-y-2">
        {tests.map((test, idx) => (
          <div 
            key={idx}
            className="p-3 rounded-lg flex items-center justify-between gap-3"
            style={{ 
              background: theme.colors.background.secondary,
              border: `1px solid ${test.locked ? theme.colors.accents.orange : theme.colors.border}40`
            }}
          >
            <div className="flex-1 min-w-0">
              <div 
                className="font-mono text-sm truncate"
                style={{ color: theme.colors.text.primary }}
                title={test.testFile}
              >
                {test.testFile?.split('/').pop() || test.actionName}
              </div>
              <div 
                className="text-xs mt-1 flex items-center gap-2 flex-wrap"
                style={{ color: theme.colors.text.tertiary }}
              >
                <span>📦 {test.actionName}</span>
                <span>•</span>
                <span>🖥️ {test.platform}</span>
                {test.source === 'transition' && test.fromState && (
                  <>
                    <span>•</span>
                    <span>📍 from {test.fromState}</span>
                  </>
                )}
                {test.locked && test.reason && (
                  <>
                    <span>•</span>
                    <span title={`Locked: ${test.lockedAt}`}>💬 {test.reason}</span>
                  </>
                )}
              </div>
            </div>
            
            <button
              onClick={() => toggleLock(test.testFile, test.locked)}
              disabled={updating === test.testFile}
              className="px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 shrink-0"
              style={{
                background: test.locked 
                  ? `${theme.colors.accents.orange}20`
                  : theme.colors.background.tertiary,
                color: test.locked 
                  ? theme.colors.accents.orange 
                  : theme.colors.text.secondary,
                border: `1px solid ${test.locked ? theme.colors.accents.orange : theme.colors.border}40`,
                opacity: updating === test.testFile ? 0.5 : 1,
                cursor: updating === test.testFile ? 'wait' : 'pointer'
              }}
            >
              {updating === test.testFile ? (
                '⏳'
              ) : test.locked ? (
                <>🔒 Locked</>
              ) : (
                <>🔓 Unlocked</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}