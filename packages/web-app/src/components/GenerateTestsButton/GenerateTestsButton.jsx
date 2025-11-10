// packages/web-app/src/components/GenerateTestsButton.jsx
// Button to generate unit tests from implications

import { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

export default function GenerateTestsButton({ state, projectPath }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const handleGenerate = async () => {
  setLoading(true);
  setError(null);
  setResult(null);
  
  try {
    console.log('🎯 Generating tests for:', state.name);
    console.log('📋 xstateConfig:', state.meta?.xstateConfig);
    
    // ✅ Extract transitions with platforms
    const transitions = [];
    const xstateOn = state.meta?.xstateConfig?.on || {};
    
    Object.entries(xstateOn).forEach(([event, config]) => {
      const target = typeof config === 'string' ? config : config.target;
      const platforms = config.platforms || [state.meta?.platform || 'web'];
      
      // Create one transition entry per platform
      platforms.forEach(platform => {
        transitions.push({
          event,
          target,
          platform,
          actionDetails: config.actionDetails
        });
      });
    });
    
    console.log('🔄 Extracted transitions:', transitions);
    
    // ✅ If no transitions, generate for main platform only
    if (transitions.length === 0) {
      transitions.push({
        event: null,
        target: null,
        platform: state.meta?.platform || 'web',
        actionDetails: null
      });
    }
    
    const response = await axios.post(`${API_URL}/api/generate/unit-test`, {
      implPath: state.files?.implication,
      platform: state.meta?.platform || 'web',  // Main platform
      transitions: transitions,  // ✅ Pass all transitions!
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