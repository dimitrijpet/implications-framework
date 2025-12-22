/**
 * useIntelligenceSearch - React hook for Intelligence Layer
 * 
 * Provides:
 * - Debounced search
 * - Autocomplete suggestions
 * - Chain enrichment
 * - LLM explanations
 * 
 * Usage:
 *   const { search, results, loading, explain } = useIntelligenceSearch({ projectPath });
 *   search('booking accept');
 * 
 * @module useIntelligenceSearch
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE = '/api/intelligence';
const LLM_API_BASE = '/api/llm';

/**
 * Hook for intelligence search functionality
 * 
 * @param {Object} options
 * @param {string} options.projectPath - Path to the project
 * @param {number} options.debounceMs - Debounce delay (default: 300)
 * @param {boolean} options.enrichChains - Auto-enrich with chain info (default: false)
 * @param {string} options.testDataPath - Path to test data (for chain enrichment)
 */
export function useIntelligenceSearch(options = {}) {
  const {
    projectPath,
    debounceMs = 300,
    enrichChains = false,
    testDataPath = null
  } = options;
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [stats, setStats] = useState(null);
  
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Check LLM status on mount
  useEffect(() => {
    checkLLMStatus();
  }, []);

  // Load stats on mount
  useEffect(() => {
    if (projectPath) {
      loadStats();
    }
  }, [projectPath]);

  /**
   * Check if LLM is enabled
   */
  async function checkLLMStatus() {
    try {
      const res = await fetch(`${LLM_API_BASE}/status`);
      const data = await res.json();
      setLlmEnabled(data.enabled);
    } catch (e) {
      console.log('LLM status check failed:', e);
      setLlmEnabled(false);
    }
  }

  /**
   * Load index statistics
   */
  async function loadStats() {
    if (!projectPath) return;
    
    try {
      const res = await fetch(
        `${API_BASE}/stats?projectPath=${encodeURIComponent(projectPath)}`
      );
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.log('Stats load failed:', e);
    }
  }

  /**
   * Search the index
   */
  const search = useCallback(async (searchQuery, options = {}) => {
    const {
      types = ['states', 'transitions', 'validations'],
      limit = 20,
      immediate = false
    } = options;
    
    setQuery(searchQuery);
    setError(null);
    setExplanation(null);
    
    // Cancel pending requests
    if (abortRef.current) {
      abortRef.current.abort();
    }
    
    // Clear debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Don't search empty queries
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setSuggestions([]);
      return;
    }
    
    const doSearch = async () => {
      setLoading(true);
      abortRef.current = new AbortController();
      
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          projectPath,
          types: types.join(','),
          limit: limit.toString(),
          enrichChains: enrichChains.toString(),
          ...(testDataPath && { testDataPath })
        });
        
        const res = await fetch(`${API_BASE}/search?${params}`, {
          signal: abortRef.current.signal
        });
        
        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`);
        }
        
        const data = await res.json();
        setResults(data.results || []);
        
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Search error:', e);
          setError(e.message);
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (immediate) {
      doSearch();
    } else {
      debounceRef.current = setTimeout(doSearch, debounceMs);
    }
  }, [projectPath, debounceMs, enrichChains, testDataPath]);

  /**
   * Get autocomplete suggestions
   */
  const getSuggestions = useCallback(async (partialQuery) => {
    if (!partialQuery || partialQuery.length < 2 || !projectPath) {
      setSuggestions([]);
      return;
    }
    
    try {
      const params = new URLSearchParams({
        q: partialQuery,
        projectPath,
        limit: '10'
      });
      
      const res = await fetch(`${API_BASE}/suggest?${params}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      
    } catch (e) {
      console.log('Suggestions failed:', e);
    }
  }, [projectPath]);

  /**
   * Get LLM explanation for current query/results
   */
  const explain = useCallback(async () => {
    if (!llmEnabled || !query || results.length === 0) {
      return null;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch(`${LLM_API_BASE}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          projectPath,
          testDataPath
        })
      });
      
      if (!res.ok) {
        throw new Error(`Explain failed: ${res.status}`);
      }
      
      const data = await res.json();
      setExplanation(data.explanation);
      return data.explanation;
      
    } catch (e) {
      console.error('Explain error:', e);
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [llmEnabled, query, results, projectPath, testDataPath]);

  /**
   * Find by ticket number
   */
  const findByTicket = useCallback(async (ticketId) => {
    if (!projectPath) return [];
    
    setLoading(true);
    
    try {
      const res = await fetch(
        `${API_BASE}/ticket/${encodeURIComponent(ticketId)}?projectPath=${encodeURIComponent(projectPath)}`
      );
      const data = await res.json();
      setResults(data.results || []);
      return data.results;
      
    } catch (e) {
      console.error('Ticket search error:', e);
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  /**
   * Find by field/condition
   */
  const findByCondition = useCallback(async (fieldPattern) => {
    if (!projectPath) return [];
    
    setLoading(true);
    
    try {
      const res = await fetch(
        `${API_BASE}/conditions?field=${encodeURIComponent(fieldPattern)}&projectPath=${encodeURIComponent(projectPath)}`
      );
      const data = await res.json();
      setResults(data.results || []);
      return data;
      
    } catch (e) {
      console.error('Condition search error:', e);
      setError(e.message);
      return { results: [] };
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  /**
   * Get state details
   */
  const getStateDetails = useCallback(async (status) => {
    if (!projectPath) return null;
    
    try {
      const res = await fetch(
        `${API_BASE}/state/${encodeURIComponent(status)}?projectPath=${encodeURIComponent(projectPath)}`
      );
      
      if (!res.ok) return null;
      
      return await res.json();
      
    } catch (e) {
      console.error('State details error:', e);
      return null;
    }
  }, [projectPath]);

  /**
   * Get chain for a state
   */
  const getChain = useCallback(async (status) => {
    if (!projectPath) return null;
    
    try {
      const params = new URLSearchParams({
        projectPath,
        ...(testDataPath && { testDataPath })
      });
      
      const res = await fetch(
        `${API_BASE}/chain/${encodeURIComponent(status)}?${params}`
      );
      
      if (!res.ok) return null;
      
      return await res.json();
      
    } catch (e) {
      console.error('Chain error:', e);
      return null;
    }
  }, [projectPath, testDataPath]);

  /**
   * Get impact analysis for a state
   */
  const getImpact = useCallback(async (status) => {
    if (!projectPath) return null;
    
    try {
      const res = await fetch(
        `${API_BASE}/impact/${encodeURIComponent(status)}?projectPath=${encodeURIComponent(projectPath)}`
      );
      
      if (!res.ok) return null;
      
      return await res.json();
      
    } catch (e) {
      console.error('Impact error:', e);
      return null;
    }
  }, [projectPath]);

  /**
   * Rebuild the index
   */
  const rebuild = useCallback(async () => {
    if (!projectPath) return false;
    
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/rebuild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setStats(data);
      }
      
      return data.success;
      
    } catch (e) {
      console.error('Rebuild error:', e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  /**
   * Clear all state
   */
  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setError(null);
    setExplanation(null);
  }, []);

  return {
    // State
    query,
    results,
    suggestions,
    loading,
    error,
    explanation,
    llmEnabled,
    stats,
    
    // Actions
    search,
    getSuggestions,
    explain,
    findByTicket,
    findByCondition,
    getStateDetails,
    getChain,
    getImpact,
    rebuild,
    clear,
    
    // Helpers
    hasResults: results.length > 0
  };
}

export default useIntelligenceSearch;