// packages/web-app/src/components/GenerateTestsButton.jsx
// Button to generate unit tests from implications

import { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

export default function GenerateTestsButton({ state, projectPath, discoveryResult }) {  // ← ADD discoveryResult HERE
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
    
    // ✅ Find transitions that ARRIVE AT this state
    const incomingTransitions = discoveryResult?.transitions?.filter(t => 
      t.to === state.name || t.target === state.name
    ) || [];
    
    console.log(`📥 Found ${incomingTransitions.length} incoming transition(s)`);
    console.log('📋 Raw transitions:', incomingTransitions);  // ← ADD THIS DEBUG
    
    if (incomingTransitions.length === 0) {
      console.log('⚠️ No incoming transitions found, generating default test');
    }
    
    // ✅ Expand transitions with multiple platforms
    const transitionsToGenerate = [];
    
    for (const t of incomingTransitions) {
      const platforms = t.platforms || [t.platform || state.meta?.platform || 'web'];
      
      // Create one transition per platform
      for (const platform of platforms) {
        transitionsToGenerate.push({
          event: t.event,
          fromState: t.from || t.fromState,
          target: state.name,
          platform: platform,
          actionDetails: t.actionDetails
        });
      }
    }
    
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