// packages/web-app/src/hooks/usePOMData.js
// Custom hook for fetching and caching POM data for autocomplete

import { useState, useEffect, useCallback, useMemo } from 'react';

const API_URL = 'http://localhost:3000';

// Global cache to share data across components
// ✅ CHANGED: Cache is now keyed by platform
const pomCache = {
  byPlatform: {},  // platform -> { allPOMs, pomDetails, lastFetch }
};

// Cache duration: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// Helper to get/create platform cache
function getPlatformCache(platform) {
  const key = platform || 'all';
  if (!pomCache.byPlatform[key]) {
    pomCache.byPlatform[key] = {
      allPOMs: null,
      pomDetails: {},
      lastFetch: null
    };
  }
  return pomCache.byPlatform[key];
}

/**
 * usePOMData - Hook for POM autocomplete data
 * 
 * ✅ UPDATED: Now accepts platform parameter for filtering
 * 
 * Usage:
 *   const { 
 *     poms,                    // All POMs list (filtered by platform)
 *     loading,                 // Loading state
 *     getPOMFunctions,         // (pomName) => functions[]
 *     getPOMLocators,          // (pomName, instanceName?) => locators[]
 *     getPOMInstances,         // (pomName) => instances[]
 *     searchPOMs,              // (query) => filtered poms
 *     searchMethods,           // (pomName, query) => filtered methods
 *     getMethodReturnKeys,     // (pomName, methodName) => returnKeys[]
 *     refreshPOMs,             // Force refresh
 *   } = usePOMData(projectPath, platform);
 */
export default function usePOMData(projectPath, platform = null) {
  const [poms, setPOMs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all POMs
  const fetchAllPOMs = useCallback(async (force = false) => {
    if (!projectPath) return;

    const cache = getPlatformCache(platform);
    
    // Check cache
    const now = Date.now();
    if (!force && cache.allPOMs && cache.lastFetch && (now - cache.lastFetch < CACHE_TTL)) {
      setPOMs(cache.allPOMs);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ FIXED: Include platform in API call
      let url = `${API_URL}/api/poms?projectPath=${encodeURIComponent(projectPath)}`;
      if (platform) {
        url += `&platform=${encodeURIComponent(platform)}`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch POMs: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform to usable format
      const transformed = (data.poms || []).map(pom => {
        const mainClass = pom.classes?.[0];
        return {
          name: pom.name,
          displayName: formatPOMName(pom.name),
          className: mainClass?.name || pom.name,
          path: pom.path,
          platform: pom.platform,  // ✅ Include platform in data
          classes: pom.classes || [],
          // Extract all functions with signatures
          functions: mainClass?.functions || [],
          // Extract getters (locators)
          getters: mainClass?.getters || [],
          // Extract properties (instances)
          properties: mainClass?.properties || []
        };
      });

      // Update cache
      cache.allPOMs = transformed;
      cache.lastFetch = now;
      
      setPOMs(transformed);
      console.log(`✅ Loaded ${transformed.length} POMs for platform: ${platform || 'all'}`);

    } catch (err) {
      console.error('Failed to fetch POMs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectPath, platform]);

  // Fetch POM details (instances, locators, functions)
  const fetchPOMDetails = useCallback(async (pomName) => {
    if (!projectPath || !pomName) return null;

    const cache = getPlatformCache(platform);
    
    // Check cache
    if (cache.pomDetails[pomName]) {
      return cache.pomDetails[pomName];
    }

    try {
      // ✅ FIXED: Include platform in API call
      let url = `${API_URL}/api/poms/${encodeURIComponent(pomName)}?projectPath=${encodeURIComponent(projectPath)}`;
      if (platform) {
        url += `&platform=${encodeURIComponent(platform)}`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch POM details: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the result
      cache.pomDetails[pomName] = data;
      
      return data;

    } catch (err) {
      console.error(`Failed to fetch POM ${pomName}:`, err);
      return null;
    }
  }, [projectPath, platform]);

  // Initial fetch
  useEffect(() => {
    fetchAllPOMs();
  }, [fetchAllPOMs]);

  // Get functions for a POM
  const getPOMFunctions = useCallback((pomName) => {
    if (!pomName) return [];
    
    const pom = poms.find(p => 
      p.name === pomName || 
      p.className === pomName ||
      p.name.includes(pomName) ||
      pomName.includes(p.name)
    );
    
    return pom?.functions || [];
  }, [poms]);

  // Get locators (getters) for a POM
  const getPOMLocators = useCallback(async (pomName, instanceName = null) => {
    if (!pomName) return [];

    // Try to get from detailed API for instance-specific locators
    const details = await fetchPOMDetails(pomName);
    
    if (details?.instancePaths) {
      if (instanceName && details.instancePaths[instanceName]) {
        return details.instancePaths[instanceName];
      }
      // Return all paths if no specific instance
      return Object.values(details.instancePaths).flat();
    }

    // Fallback to getters from main list
    const pom = poms.find(p => p.name === pomName || p.className === pomName);
    return pom?.getters?.map(g => g.name) || [];
  }, [poms, fetchPOMDetails]);

  // ✅ NEW: Get locators (getters) for a POM - SYNC version from cached data
  const getPOMLocatorsSync = useCallback((pomName) => {
    if (!pomName) return [];
    
    const pom = poms.find(p => 
      p.name === pomName || 
      p.className === pomName ||
      p.name.includes(pomName) ||
      pomName.includes(p.name)
    );
    
    if (!pom) return [];
    
    // Extract getters from classes
    const locators = [];
    for (const cls of pom.classes || []) {
      // Getters (these are the locators!)
      for (const getter of cls.getters || []) {
        locators.push({
          name: getter.name,
          type: 'getter',
          signature: `get ${getter.name}()`
        });
      }
      // Properties (non-instance) - also locators
      for (const prop of cls.properties || []) {
        if (prop.type === 'property') {
          locators.push({
            name: prop.name,
            type: 'property',
            signature: `this.${prop.name}`
          });
        }
      }
    }
    
    return locators;
  }, [poms]);

  // Get instances for a POM
  const getPOMInstances = useCallback(async (pomName) => {
    if (!pomName) return [];

    const details = await fetchPOMDetails(pomName);
    return details?.instances || [];
  }, [fetchPOMDetails]);

  // Search POMs by query
  const searchPOMs = useCallback((query) => {
    if (!query) return poms;
    
    const q = query.toLowerCase();
    return poms.filter(pom => 
      pom.name.toLowerCase().includes(q) ||
      pom.displayName.toLowerCase().includes(q) ||
      pom.className.toLowerCase().includes(q) ||
      pom.path.toLowerCase().includes(q)
    );
  }, [poms]);

  // Search methods within a POM
  const searchMethods = useCallback((pomName, query) => {
    const functions = getPOMFunctions(pomName);
    if (!query) return functions;
    
    const q = query.toLowerCase();
    return functions.filter(fn =>
      fn.name.toLowerCase().includes(q) ||
      fn.signature?.toLowerCase().includes(q)
    );
  }, [getPOMFunctions]);

  // Get return keys for a method (for storeAs autocomplete)
  const getMethodReturnKeys = useCallback((pomName, methodName) => {
    const functions = getPOMFunctions(pomName);
    const method = functions.find(fn => fn.name === methodName);
    
    if (method?.returns?.type === 'object' && method.returns.keys) {
      return method.returns.keys;
    }
    
    return [];
  }, [getPOMFunctions]);

  // Force refresh
  const refreshPOMs = useCallback(() => {
    const cache = getPlatformCache(platform);
    cache.allPOMs = null;
    cache.pomDetails = {};
    cache.lastFetch = null;
    fetchAllPOMs(true);
  }, [fetchAllPOMs, platform]);

  return {
    poms,
    loading,
    error,
    getPOMFunctions,
    getPOMLocators,
    getPOMLocatorsSync,
    getPOMInstances,
    searchPOMs,
    searchMethods,
    getMethodReturnKeys,
    refreshPOMs
  };
}

/**
 * Format POM name for display
 */
function formatPOMName(name) {
  if (!name) return '';
  const parts = name.split(/[.\-_]/);
  const formatted = parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return formatted;
}

/**
 * usePOMAutocomplete - Simplified hook for single autocomplete field
 * ✅ UPDATED: Now accepts platform parameter
 */
export function usePOMAutocomplete(projectPath, type, parentValue = null, platform = null) {
  const { 
    poms, 
    loading, 
    getPOMFunctions, 
    getPOMLocators,
    searchPOMs,
    searchMethods 
  } = usePOMData(projectPath, platform);
  
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);

  useEffect(() => {
    const loadOptions = async () => {
      switch (type) {
        case 'poms':
        case 'instances':
          setOptions(searchPOMs(query).map(p => ({
            value: p.name,
            label: p.displayName,
            description: p.path
          })));
          break;

        case 'methods':
        case 'functions':
          if (parentValue) {
            const methods = searchMethods(parentValue, query);
            setOptions(methods.map(m => ({
              value: m.name,
              label: m.name,
              description: m.signature,
              async: m.async,
              returns: m.returns
            })));
          }
          break;

        case 'locators':
        case 'fields':
          if (parentValue) {
            const locators = await getPOMLocators(parentValue);
            const q = query.toLowerCase();
            const filtered = q 
              ? locators.filter(l => l.toLowerCase().includes(q))
              : locators;
            setOptions(filtered.map(l => ({
              value: l,
              label: l
            })));
          }
          break;
      }
    };

    loadOptions();
  }, [type, parentValue, query, poms, searchPOMs, searchMethods, getPOMLocators]);

  return {
    options,
    loading,
    onSearch: setQuery,
    query
  };
}