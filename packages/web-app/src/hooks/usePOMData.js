// packages/web-app/src/hooks/usePOMData.js
// Custom hook for fetching and caching POM data for autocomplete

import { useState, useEffect, useCallback, useMemo } from 'react';

const API_URL = 'http://localhost:3000';

// Global cache to share data across components
const pomCache = {
  allPOMs: null,
  pomDetails: {},  // pomName -> { instances, instancePaths, functions }
  lastFetch: null
};

// Cache duration: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

/**
 * usePOMData - Hook for POM autocomplete data
 * 
 * Usage:
 *   const { 
 *     poms,                    // All POMs list
 *     loading,                 // Loading state
 *     getPOMFunctions,         // (pomName) => functions[]
 *     getPOMLocators,          // (pomName, instanceName?) => locators[]
 *     getPOMInstances,         // (pomName) => instances[]
 *     searchPOMs,              // (query) => filtered poms
 *     searchMethods,           // (pomName, query) => filtered methods
 *     getMethodReturnKeys,     // (pomName, methodName) => returnKeys[]
 *     refreshPOMs,             // Force refresh
 *   } = usePOMData(projectPath);
 */
export default function usePOMData(projectPath) {
  const [poms, setPOMs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all POMs
  const fetchAllPOMs = useCallback(async (force = false) => {
    if (!projectPath) return;

    // Check cache
    const now = Date.now();
    if (!force && pomCache.allPOMs && pomCache.lastFetch && (now - pomCache.lastFetch < CACHE_TTL)) {
      setPOMs(pomCache.allPOMs);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/poms?projectPath=${encodeURIComponent(projectPath)}`
      );

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
      pomCache.allPOMs = transformed;
      pomCache.lastFetch = now;
      
      setPOMs(transformed);
      console.log(`✅ Loaded ${transformed.length} POMs`);

    } catch (err) {
      console.error('Failed to fetch POMs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  // Fetch POM details (instances, locators, functions)
  const fetchPOMDetails = useCallback(async (pomName) => {
    if (!projectPath || !pomName) return null;

    // Check cache
    if (pomCache.pomDetails[pomName]) {
      return pomCache.pomDetails[pomName];
    }

    try {
      const response = await fetch(
        `${API_URL}/api/poms/${encodeURIComponent(pomName)}?projectPath=${encodeURIComponent(projectPath)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch POM details: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the result
      pomCache.pomDetails[pomName] = data;
      
      return data;

    } catch (err) {
      console.error(`Failed to fetch POM ${pomName}:`, err);
      return null;
    }
  }, [projectPath]);

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

  // Add this new function inside usePOMData hook (around line 90)

  // ✅ NEW: Get locators (getters) for a POM - SYNC version from cached data
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

  // Update the return statement to include getPOMLocatorsSync

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
    pomCache.allPOMs = null;
    pomCache.pomDetails = {};
    pomCache.lastFetch = null;
    fetchAllPOMs(true);
  }, [fetchAllPOMs]);

return {
  poms,
  loading,
  error,
  getPOMFunctions,
  getPOMLocators,
  getPOMLocatorsSync,  // ✅ ADD THIS
  getPOMInstances,
  searchPOMs,
  searchMethods,
  getMethodReturnKeys,
  refreshPOMs
};
}

/**
 * Format POM name for display
 * e.g., "agencySelect.wrapper" → "Agency Select (Wrapper)"
 */
function formatPOMName(name) {
  if (!name) return '';
  
  // Split by dots and common separators
  const parts = name.split(/[.\-_]/);
  
  // Capitalize each part
  const formatted = parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  
  return formatted;
}

/**
 * usePOMAutocomplete - Simplified hook for single autocomplete field
 * 
 * Usage:
 *   const { 
 *     options,      // Filtered options
 *     loading,
 *     onSearch,     // Update search query
 *   } = usePOMAutocomplete(projectPath, 'methods', pomName);
 */
export function usePOMAutocomplete(projectPath, type, parentValue = null) {
  const { 
    poms, 
    loading, 
    getPOMFunctions, 
    getPOMLocators,
    searchPOMs,
    searchMethods 
  } = usePOMData(projectPath);
  
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