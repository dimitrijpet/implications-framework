// packages/web-app/src/components/GenerateTestsButton.jsx
import { useState } from 'react';

export default function GenerateTestsButton({ state, projectPath, discoveryResult }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [forceRawValidation, setForceRawValidation] = useState(false);
  
  const handleGenerate = async () => {
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
          platform: state.meta?.platform || 'web',
          transitions: transitionsToGenerate,
          forceRawValidation  // ✅ USE THE STATE VARIABLE!
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }
      
      setResult(data);
      console.log(`✅ Generated ${data.results?.length || 1} test(s)`);
      
    } catch (err) {
      console.error('❌ Generation failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="generate-tests-section space-y-3">
      <div className="flex items-center gap-4">
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
      </div>
      
      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
            ✅ Generated {result.count || 1} Test(s)!
          </div>
          <div className="text-sm text-green-700 space-y-3">
            {result.results?.map((r, i) => (
              <div key={i} className="border-l-2 border-green-300 pl-3">
                <div className="font-semibold">Test {i + 1}: {r.fileName}</div>
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