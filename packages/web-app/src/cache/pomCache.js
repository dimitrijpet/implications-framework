// ═══════════════════════════════════════════════════════════════════════════
// ✨ POM CACHING SOLUTION
// 
// PROBLEM: Every component that needs POMs triggers a full project scan
//          (292 files × multiple components = very slow)
//
// SOLUTION: Cache POM discovery results and share across components
//
// TWO OPTIONS PROVIDED:
// 1. Frontend-only cache (simple, no backend changes)
// 2. Backend cache with API (more robust)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// OPTION 1: FRONTEND CACHE (Simple - Add to your app)
// ═══════════════════════════════════════════════════════════════════════════

// Create file: packages/web-app/src/cache/pomCache.js

const POM_CACHE = {
  poms: null,
  navigation: {},  // Keyed by platform
  timestamp: null,
  projectPath: null,
  TTL: 5 * 60 * 1000,  // 5 minutes cache
};

/**
 * Get cached POMs or fetch fresh
 */
export async function getCachedPOMs(projectPath, forceRefresh = false) {
  const API_URL = "http://localhost:3000";
  
  // Check if cache is valid
  const now = Date.now();
  const cacheValid = 
    POM_CACHE.poms &&
    POM_CACHE.projectPath === projectPath &&
    POM_CACHE.timestamp &&
    (now - POM_CACHE.timestamp) < POM_CACHE.TTL &&
    !forceRefresh;
  
  if (cacheValid) {
    console.log('📦 Using cached POMs');
    return POM_CACHE.poms;
  }
  
  console.log('🔍 Fetching fresh POMs...');
  
  try {
    const response = await fetch(
      `${API_URL}/api/poms?projectPath=${encodeURIComponent(projectPath)}`
    );
    
    if (response.ok) {
      const data = await response.json();
      
      // Transform and cache
      const transformedPOMs = data.poms.map((pom) => {
        const mainClass = pom.classes?.[0];
        return {
          name: mainClass?.name || pom.name,
          className: mainClass?.name || pom.name,
          path: pom.path,
          filePath: pom.path,
          classes: pom.classes,
        };
      });
      
      POM_CACHE.poms = transformedPOMs;
      POM_CACHE.timestamp = now;
      POM_CACHE.projectPath = projectPath;
      
      console.log(`✅ Cached ${transformedPOMs.length} POMs`);
      return transformedPOMs;
    }
  } catch (error) {
    console.error('Failed to fetch POMs:', error);
  }
  
  return [];
}

/**
 * Get cached navigation files or fetch fresh
 */
export async function getCachedNavigation(projectPath, platform, forceRefresh = false) {
  const API_URL = "http://localhost:3000";
  
  // Check if cache is valid for this platform
  const now = Date.now();
  const cached = POM_CACHE.navigation[platform];
  const cacheValid = 
    cached &&
    POM_CACHE.projectPath === projectPath &&
    cached.timestamp &&
    (now - cached.timestamp) < POM_CACHE.TTL &&
    !forceRefresh;
  
  if (cacheValid) {
    console.log(`🧭 Using cached navigation for ${platform}`);
    return cached.files;
  }
  
  console.log(`🧭 Fetching fresh navigation for ${platform}...`);
  
  try {
    const response = await fetch(
      `${API_URL}/api/poms/navigation?projectPath=${encodeURIComponent(projectPath)}&platform=${platform}`
    );
    
    if (response.ok) {
      const data = await response.json();
      
      const transformedNavFiles = data.navigationFiles.map(navFile => ({
        className: navFile.className,
        displayName: navFile.displayName,
        path: navFile.path,
        methods: navFile.methods.map(method => ({
          name: method.name,
          signature: method.signature,
          async: method.async,
          parameters: method.parameters || []
        }))
      }));
      
      // Cache by platform
      POM_CACHE.navigation[platform] = {
        files: transformedNavFiles,
        timestamp: now
      };
      
      console.log(`✅ Cached ${transformedNavFiles.length} navigation files for ${platform}`);
      return transformedNavFiles;
    }
  } catch (error) {
    console.error('Failed to fetch navigation:', error);
  }
  
  return [];
}

/**
 * Filter cached POMs by platform
 */
export function filterPOMsByPlatform(poms, platform) {
  if (!platform || !poms) return poms;
  
  return poms.filter(pom => {
    const path = pom.path || pom.filePath || '';
    
    if (platform === 'web') {
      return path.includes('/web/') || path.includes('\\web\\');
    } else if (platform === 'dancer') {
      return path.includes('/dancer/') || path.includes('\\dancer\\') || 
             path.includes('/android/dancer/') || path.includes('\\android\\dancer\\');
    } else if (platform === 'manager') {
      return path.includes('/manager/') || path.includes('\\manager\\') ||
             path.includes('/android/manager/') || path.includes('\\android\\manager\\');
    }
    
    return false;
  });
}

/**
 * Clear all caches
 */
export function clearPOMCache() {
  POM_CACHE.poms = null;
  POM_CACHE.navigation = {};
  POM_CACHE.timestamp = null;
  console.log('🗑️ POM cache cleared');
}

/**
 * Pre-warm cache (call on app start or project load)
 */
export async function preWarmPOMCache(projectPath) {
  console.log('🔥 Pre-warming POM cache...');
  
  // Fetch all POMs
  await getCachedPOMs(projectPath, true);
  
  // Fetch navigation for all platforms in parallel
  await Promise.all([
    getCachedNavigation(projectPath, 'web', true),
    getCachedNavigation(projectPath, 'dancer', true),
    getCachedNavigation(projectPath, 'manager', true),
  ]);
  
  console.log('✅ POM cache pre-warmed');
}

export default {
  getCachedPOMs,
  getCachedNavigation,
  filterPOMsByPlatform,
  clearPOMCache,
  preWarmPOMCache,
};


// ═══════════════════════════════════════════════════════════════════════════
// HOW TO USE IN AddTransitionModal.jsx:
// ═══════════════════════════════════════════════════════════════════════════

/*
// At top of file:
import { getCachedPOMs, getCachedNavigation, filterPOMsByPlatform } from '../../cache/pomCache';

// Replace fetchAvailablePOMs:
const fetchAvailablePOMs = async () => {
  setLoadingPOMs(true);
  try {
    const allPOMs = await getCachedPOMs(projectPath);
    const filteredPOMs = filterPOMsByPlatform(allPOMs, formData.platform);
    setAvailablePOMs(filteredPOMs);
  } finally {
    setLoadingPOMs(false);
  }
};

// Replace fetchNavigationFiles:
const fetchNavigationFiles = async () => {
  setLoadingNavigation(true);
  try {
    const navFiles = await getCachedNavigation(projectPath, formData.platform);
    setNavigationFiles(navFiles);
  } finally {
    setLoadingNavigation(false);
  }
};
*/


// ═══════════════════════════════════════════════════════════════════════════
// OPTION 2: BACKEND CACHE (More robust - requires backend changes)
// ═══════════════════════════════════════════════════════════════════════════

/*
Add to POMDiscovery.js:

// Module-level cache
const discoveryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class POMDiscovery {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.pomCache = new Map();
    this.navigationCache = new Map();
  }

  async discover() {
    // Check module-level cache first
    const cacheKey = this.projectPath;
    const cached = discoveryCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('📦 Using cached discovery result');
      this.pomCache = cached.pomCache;
      this.navigationCache = cached.navigationCache;
      return cached.poms;
    }
    
    // ... rest of discover() logic ...
    
    // Save to cache at end
    discoveryCache.set(cacheKey, {
      poms: poms,
      pomCache: this.pomCache,
      navigationCache: this.navigationCache,
      timestamp: Date.now()
    });
    
    return poms;
  }
}
*/