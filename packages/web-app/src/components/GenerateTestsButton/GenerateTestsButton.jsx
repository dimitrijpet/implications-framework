// packages/web-app/src/components/GenerateTestsButton.jsx
import { useState, useEffect } from 'react';

export default function GenerateTestsButton({ state, projectPath, discoveryResult }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [forceRawValidation, setForceRawValidation] = useState(false);
  const [lockedTests, setLockedTests] = useState([]);
  const [loadingLocks, setLoadingLocks] = useState(false);
  
  // Load lock status when component mounts or state changes
  useEffect(() => {
    if (state?.meta?.setup && projectPath) {
      loadLockStatus();
    }
  }, [state?.meta?.setup, projectPath]);
  
  const loadLockStatus = async () => {
    if (!state?.meta?.setup || !projectPath) return;
    
    setLoadingLocks(true);
    try {
      const setupEntries = state.meta.setup || [];
      const response = await fetch(
        `/api/locks/state/${encodeURIComponent(state.name)}?` +
        `projectPath=${encodeURIComponent(projectPath)}&` +
        `setupEntries=${encodeURIComponent(JSON.stringify(setupEntries))}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setLockedTests(data.tests || []);
      }
    } catch (err) {
      console.error('Failed to load lock status:', err);
    } finally {
      setLoadingLocks(false);
    }
  };
  
  const handleGenerate = async () => {
    // Check for locked tests and warn user
    const lockedCount = lockedTests.filter(t => t.locked).length;
    
    if (lockedCount > 0) {
      const proceed = window.confirm(
        `⚠️ ${lockedCount} test(s) are locked and will be skipped.\n\n` +
        `Locked tests:\n${lockedTests.filter(t => t.locked).map(t => `• ${t.actionName}`).join('\n')}\n\n` +
        `Continue with generation?`
      );
      
      if (!proceed) return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      console.log('🎯 Generating tests for:', state.name);
      console.log('🔲 forceRawValidation:', forceRawValidation);
      
      // Helper: Look up actionDetails from source implication
      const findActionDetails = (fromState, event) => {
        if (!fromState || !event) return null;
        
        const sourceImpl = discoveryResult?.files?.implications?.find(
          impl => impl.metadata?.status === fromState
        );
        
        if (!sourceImpl) {
          console.log(`   ❌ Source not found: ${fromState}`);
          return null;
        }
        
        const transition = sourceImpl.metadata?.xstateConfig?.on?.[event];
        return transition?.actionDetails || null;
      };
      
      // Find incoming transitions
      const incomingTransitions = discoveryResult?.transitions?.filter(t => 
        t.to === state.name || t.target === state.name
      ) || [];
      
      console.log(`📥 Found ${incomingTransitions.length} incoming transition(s)`);
      
      // Build transitions to generate
      const transitionsToGenerate = [];
      
      for (const t of incomingTransitions) {
        const platforms = t.platforms || [t.platform || state.meta?.platform || 'web'];
        
        for (const platform of platforms) {
          transitionsToGenerate.push({
            event: t.event,
            fromState: t.from,
            target: state.name,
            platform: platform,
            actionDetails: findActionDetails(t.from, t.event)
          });
        }
      }
      
      // Fallback if no transitions
      if (transitionsToGenerate.length === 0) {
        transitionsToGenerate.push({
          event: null,
          fromState: null,
          target: state.name,
          platform: state.meta?.platform || 'web',
          actionDetails: null
        });
      }
      
      const implFilePath = `${projectPath}/tests/implications/bookings/status/${state.className}.js`;
      
      console.log('📂 implFilePath:', implFilePath);
      console.log('📊 Transitions:', transitionsToGenerate.length);
      console.log('⚡ forceRawValidation:', forceRawValidation);
      
     const response = await fetch('/api/generate/unit-test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    implFilePath,
    projectPath,
    state: state.name || state.meta?.status,  // ← ADD THIS
    platform: state.meta?.platform || 'web',
    transitions: transitionsToGenerate,
    forceRawValidation,
    skipLocked: true
  })
});
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }
      
      setResult(data);
      console.log(`✅ Generated ${data.results?.length || 1} test(s), skipped ${data.skippedCount || 0}`);
      
      // Refresh lock status after generation
      await loadLockStatus();
      
    } catch (err) {
      console.error('❌ Generation failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const lockedCount = lockedTests.filter(t => t.locked).length;
  
  return (
    <div className="generate-tests-section space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`
            px-4 py-2 rounded-lg font-medium transition-all
            ${loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'}
          `}
        >
          {loading ? '⏳ Generating...' : '🧪 Generate Unit Test'}
        </button>
        
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={forceRawValidation}
            onChange={(e) => setForceRawValidation(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Force raw assertions (verbose)</span>
        </label>
        
        {/* Lock status indicator */}
        {!loadingLocks && lockedCount > 0 && (
          <span className="px-3 py-1 rounded-full text-sm bg-amber-100 text-amber-800 border border-amber-300">
            🔒 {lockedCount} locked (will skip)
          </span>
        )}
      </div>
      
      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
            ✅ Generated {result.count || 1} Test(s)
            {result.skippedCount > 0 && (
              <span className="text-amber-600 text-sm font-normal">
                ({result.skippedCount} skipped - locked)
              </span>
            )}
          </div>
          
          {/* Generated tests */}
          <div className="text-sm text-green-700 space-y-3">
            {result.results?.map((r, i) => (
              <div key={i} className="border-l-2 border-green-300 pl-3">
                <div className="font-semibold">✅ {r.fileName}</div>
                {r.filePath && <div className="text-xs opacity-75">📁 {r.filePath}</div>}
                <div className="text-xs">📏 {r.code?.length || 0} chars</div>
                <button
                  onClick={() => navigator.clipboard.writeText(r.code)}
                  className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  📋 Copy Code
                </button>
              </div>
            ))}
          </div>
          
          {/* Skipped tests */}
          {result.skipped?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-green-200">
              <div className="text-sm text-amber-700 font-medium mb-2">
                ⏭️ Skipped (locked):
              </div>
              <div className="text-xs text-amber-600 space-y-1">
                {result.skipped.map((s, i) => (
                  <div key={i}>🔒 {s.fileName}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 font-medium mb-1">❌ Generation Failed</div>
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
    </div>
  );
}