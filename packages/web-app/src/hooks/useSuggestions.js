// packages/web-app/src/hooks/useSuggestions.js

import { useState, useEffect } from 'react';

export function useSuggestions(projectPath) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectPath) return;
    
    fetchAnalysis();
  }, [projectPath]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching pattern analysis...');
      
      const response = await fetch('http://localhost:3000/api/patterns/analyze');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Pattern analysis loaded:', data.analysis);
      
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('❌ Failed to fetch analysis:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { analysis, loading, error, refetch: fetchAnalysis };
}