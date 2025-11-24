// packages/web-app/src/components/GenerateTestsButton.jsx
// Button to generate unit tests from implications

import { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

export default function GenerateTestsButton({ state, projectPath, discoveryResult }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      console.log('🎯 Generating tests for:', state.name);
      console.log('📊 Discovery available:', !!discoveryResult);
      
      // ✅ Helper: Look up actionDetails from source implication metadata
      const findActionDetails = (fromState, event) => {
  console.log(`🔍 Looking for actionDetails: ${fromState} --${event}-->`);
  
  if (!fromState || !event) {
    console.log(`   ❌ Missing fromState or event`);
    return null;
  }
  
  // Find the source implication by status
  const sourceImpl = discoveryResult?.files?.implications?.find(
    impl => impl.metadata?.status === fromState
  );
  
  if (!sourceImpl) {
    console.log(`   ❌ Source implication not found for state: ${fromState}`);
    return null;
  }
  
  console.log(`   ✅ Found source: ${sourceImpl.className}`);
  
  // ✅ FIX: Get actionDetails from xstateConfig.on[event]
  const transition = sourceImpl.metadata?.xstateConfig?.on?.[event];
  
  if (!transition) {
    console.log(`   ❌ Event ${event} not found in xstateConfig.on`);
    return null;
  }
  
  const actionDetails = transition.actionDetails || null;
  
  if (actionDetails) {
    console.log(`   ✅ Found actionDetails with ${actionDetails.steps?.length || 0} steps`);
  } else {
    console.log(`   ⚠️  No actionDetails for ${event}`);
  }
  
  return actionDetails;
};
      
   const incomingTransitions = discoveryResult?.transitions?.filter(t => 
  t.to === state.name || t.target === state.name
) || [];

console.log(`📥 Found ${incomingTransitions.length} incoming transition(s)`);
incomingTransitions.forEach(t => {
  console.log(`   - ${t.from} --${t.event}--> ${t.to}`);
});

// ✅ Expand transitions with multiple platforms and enrich with actionDetails
const transitionsToGenerate = [];

for (const t of incomingTransitions) {
  console.log(`\n🔄 Processing: ${t.from} --${t.event}--> ${t.to}`);
  
  const platforms = t.platforms || [t.platform || state.meta?.platform || 'web'];
  console.log(`   Platforms: ${platforms.join(', ')}`);
  
  // Create one transition per platform
  for (const platform of platforms) {
    // ✅ Look up actionDetails from source implication
    const actionDetails = findActionDetails(t.from, t.event);
    
    const transitionObj = {
      event: t.event,
      fromState: t.from,
      target: state.name,
      platform: platform,
      actionDetails: actionDetails
    };
    
    console.log(`   ✅ Added transition:`, transitionObj.event, transitionObj.platform);
    transitionsToGenerate.push(transitionObj);
  }
}

console.log(`\n📊 Total transitions to generate: ${transitionsToGenerate.length}`);
      
      // ✅ Fallback: If no incoming transitions, generate for main platform
      if (transitionsToGenerate.length === 0) {
        transitionsToGenerate.push({
          event: null,
          fromState: null,
          target: state.name,
          platform: state.meta?.platform || 'web',
          actionDetails: null
        });
      }
      
      console.log('🔄 Transitions to generate:', transitionsToGenerate);
      console.log('🔄 First transition actionDetails:', transitionsToGenerate[0]?.actionDetails);
      
      const response = await axios.post(`${API_URL}/api/generate/unit-test`, {
        implPath: state.files?.implication,
        platform: state.meta?.platform || 'web',
        transitions: transitionsToGenerate,
        projectPath
      });
      
      setResult(response.data);
      const count = response.data.results?.length || 1;
      console.log(`✅ Generated ${count} test(s)`);
      
    } catch (err) {
      console.error('❌ Generation failed:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="generate-tests-section">
      <button
        onClick={handleGenerate}
        disabled={loading || !state.files?.implication}
        className={`
          px-4 py-2 rounded-lg font-medium transition-all
          ${loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'}
        `}
      >
        {loading ? '⏳ Generating...' : '🧪 Generate Unit Test'}
      </button>
      
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
            <span>✅</span>
            <span>Generated {result.count || 1} Test(s) Successfully!</span>
          </div>
          <div className="text-sm text-green-700 space-y-3">
            {result.results?.map((r, i) => (
              <div key={i} className="border-l-2 border-green-300 pl-3">
                <div className="font-semibold">Test {i + 1}:</div>
                <div>📄 <strong>File:</strong> {r.fileName}</div>
                {r.filePath && (
                  <div className="text-xs">📁 {r.filePath}</div>
                )}
                <div>📏 <strong>Size:</strong> {r.code?.length || 0} characters</div>
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
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
            <span>❌</span>
            <span>Generation Failed</span>
          </div>
          <div className="text-sm text-red-700">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}