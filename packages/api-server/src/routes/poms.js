// packages/api-server/src/routes/poms.js
// ✨ FIXED: Platform-aware POM details lookup
// 
// The problem: Multiple Home.screen.js files exist (dancer, manager, legacy)
// and the cache uses just the name as key, so wrong file gets returned.
// 
// Solution: Accept platform parameter and filter by path patterns from config.

import express from 'express';
import POMDiscovery from '../../../core/src/discovery/POMDiscovery.js';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

/**
 * Simple glob pattern matcher (no external dependency)
 */
function matchGlob(filePath, pattern) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  
  const regexPattern = normalizedPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
}

/**
 * Check if path matches any pattern in the list
 */
function matchesAnyPattern(filePath, patterns) {
  return patterns.some(pattern => matchGlob(filePath, pattern));
}

/**
 * Load project config to get screenPaths
 */
async function loadProjectConfig(projectPath) {
  const configPath = path.join(projectPath, 'ai-testing.config.js');
  try {
    const configUrl = `file://${configPath}?t=${Date.now()}`;
    const config = await import(configUrl);
    return config.default || config;
  } catch (error) {
    console.warn(`⚠️ Could not load config from ${configPath}:`, error.message);
    return null;
  }
}

/**
 * Check if a path should be ignored based on ignore patterns
 */
function shouldIgnore(filePath, ignorePatterns = []) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  for (const pattern of ignorePatterns) {
    if (matchGlob(normalizedPath, pattern)) {
      return true;
    }
    
    const keyPart = pattern.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^\/|\/$/g, '');
    if (keyPart && normalizedPath.includes(`/${keyPart}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * ✅ NEW: Check if a POM path matches platform patterns
 */
function matchesPlatformPatterns(pomPath, platformPatterns, ignorePatterns = []) {
  const normalizedPath = pomPath.replace(/\\/g, '/');
  
  // First check if it should be ignored
  if (shouldIgnore(normalizedPath, ignorePatterns)) {
    return false;
  }
  
  // Check if it matches any of the platform patterns
  for (const pattern of platformPatterns) {
    if (matchGlob(normalizedPath, pattern)) {
      return true;
    }
    
    // Also do a simple path prefix check
    const pathPrefix = pattern.split('**')[0].replace(/\/$/, '');
    if (pathPrefix && normalizedPath.includes(pathPrefix)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter POMs by platform using config-driven screenPaths
 */
function filterPOMsByPlatformFromConfig(poms, platform, config) {
  if (!config?.screenPaths) {
    console.warn('⚠️ No screenPaths in config, returning all POMs');
    return poms;
  }
  
  const screenPaths = config.screenPaths;
  const ignorePatterns = screenPaths.ignore || [];
  const platformPatterns = screenPaths[platform];
  
  if (!platformPatterns) {
    console.warn(`⚠️ No screenPaths defined for platform "${platform}", returning all POMs`);
    return poms;
  }
  
  console.log(`   🔍 Filtering with patterns:`, platformPatterns);
  console.log(`   🚫 Ignore patterns:`, ignorePatterns);
  
  return poms.filter(pom => {
    const pomPath = (pom.path || '').replace(/\\/g, '/');
    return matchesPlatformPatterns(pomPath, platformPatterns, ignorePatterns);
  });
}

/**
 * GET /api/poms
 * Discover all POMs in guest project with optional platform filtering
 */
router.get('/', async (req, res) => {
  try {
    const projectPath = req.query.projectPath || process.env.GUEST_PROJECT_PATH;
    const platform = req.query.platform || null;
    
    if (!projectPath) {
      return res.status(400).json({
        error: 'No project path provided. Set GUEST_PROJECT_PATH env var or pass ?projectPath='
      });
    }
    
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(404).json({
        error: `Project not found: ${projectPath}`
      });
    }
    
    console.log(`🔍 Discovering POMs in: ${projectPath}`);
    if (platform) {
      console.log(`   📱 Platform filter: ${platform}`);
    }
    
    const discovery = new POMDiscovery(projectPath);
    let poms = await discovery.discover();
    
    if (platform) {
      const config = await loadProjectConfig(projectPath);
      const beforeCount = poms.length;
      
      if (config?.screenPaths) {
        poms = filterPOMsByPlatformFromConfig(poms, platform, config);
      }
      
      console.log(`   🎯 Filtered: ${beforeCount} → ${poms.length} POMs for ${platform}`);
    }
    
    res.json({
      success: true,
      projectPath,
      platform: platform || 'all',
      count: poms.length,
      poms
    });
    
  } catch (error) {
    console.error('❌ POM discovery failed:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/poms/validate
 */
router.post('/validate', async (req, res) => {
  try {
    const projectPath = req.body.projectPath || process.env.GUEST_PROJECT_PATH;
    const { pomName, path: pomPath } = req.body;
    
    if (!projectPath || !pomName || !pomPath) {
      return res.status(400).json({
        error: 'Missing required fields: projectPath, pomName, path'
      });
    }
    
    const discovery = new POMDiscovery(projectPath);
    await discovery.discover();
    
    let availablePaths = [];
    let isValid = false;
    
    if (pomPath.includes('.')) {
      const [instanceName, ...rest] = pomPath.split('.');
      availablePaths = discovery.getAvailablePaths(pomName, instanceName);
      isValid = availablePaths.includes(pomPath);
      
      if (!isValid) {
        return res.json({
          success: false,
          valid: false,
          message: `Path "${pomPath}" not found in ${pomName}.${instanceName}`,
          hint: `Did you mean one of these?`,
          availablePaths: availablePaths.slice(0, 20)
        });
      }
    } else {
      availablePaths = discovery.getAvailablePaths(pomName);
      isValid = availablePaths.includes(pomPath);
      
      if (!isValid) {
        return res.json({
          success: false,
          valid: false,
          message: `Path "${pomPath}" not found in ${pomName}`,
          availablePaths: availablePaths.slice(0, 20)
        });
      }
    }
    
    res.json({
      success: true,
      valid: true,
      message: `Path "${pomPath}" is valid in ${pomName}`
    });
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/poms/navigation
 */
router.get('/navigation', async (req, res) => {
  try {
    const projectPath = req.query.projectPath || process.env.GUEST_PROJECT_PATH;
    const platform = req.query.platform || null;
    
    if (!projectPath) {
      return res.status(400).json({
        error: 'No project path provided. Set GUEST_PROJECT_PATH env var or pass ?projectPath='
      });
    }
    
    console.log(`🧭 Discovering navigation files...`);
    console.log(`   Project: ${projectPath}`);
    console.log(`   Platform filter: ${platform || 'all'}`);
    
    const discovery = new POMDiscovery(projectPath);
    await discovery.discover();
    
    let navigationFiles = discovery.getNavigationFiles(platform);
    
    if (platform) {
      const config = await loadProjectConfig(projectPath);
      if (config?.screenPaths) {
        const ignorePatterns = config.screenPaths.ignore || [];
        navigationFiles = navigationFiles.filter(nav => {
          const navPath = (nav.path || '').replace(/\\/g, '/');
          return !shouldIgnore(navPath, ignorePatterns);
        });
      }
    }
    
    console.log(`   ✅ Found ${navigationFiles.length} navigation files`);
    
    navigationFiles.forEach(nav => {
      console.log(`      📍 ${nav.displayName}: ${nav.methods.length} methods`);
    });
    
    res.json({
      success: true,
      projectPath,
      platform: platform || 'all',
      count: navigationFiles.length,
      navigationFiles
    });
    
  } catch (error) {
    console.error('❌ Navigation discovery failed:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/poms/navigation/:className
 */
router.get('/navigation/:className', async (req, res) => {
  try {
    const projectPath = req.query.projectPath || process.env.GUEST_PROJECT_PATH;
    const platform = req.query.platform || null;
    const { className } = req.params;
    
    if (!projectPath) {
      return res.status(400).json({
        error: 'No project path provided'
      });
    }
    
    console.log(`🧭 Getting navigation methods for: ${className} (${platform || 'any platform'})`);
    
    const discovery = new POMDiscovery(projectPath);
    await discovery.discover();
    
    const methods = discovery.getNavigationMethods(className, platform);
    
    if (methods.length === 0) {
      return res.status(404).json({
        error: `Navigation class "${className}" not found${platform ? ` for platform ${platform}` : ''}`
      });
    }
    
    res.json({
      success: true,
      className,
      platform: platform || 'any',
      count: methods.length,
      methods
    });
    
  } catch (error) {
    console.error('❌ Failed to get navigation methods:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/poms/functions
 */
router.get('/functions', async (req, res) => {
  try {
    const { projectPath, pomName } = req.query;
    
    if (!projectPath || !pomName) {
      return res.status(400).json({ error: 'projectPath and pomName required' });
    }
    
    console.log(`📦 Getting functions & locators for POM: ${pomName}`);
    
    const discovery = new POMDiscovery(projectPath);
    await discovery.discover();
    
    const pom = discovery.pomCache.get(pomName);
    if (!pom) {
      return res.json({ success: true, functions: [], locators: [] });
    }
    
    const functions = [];
    const locators = [];
    
    for (const cls of pom.classes) {
      if (cls.functions) {
        for (const fn of cls.functions) {
          functions.push({
            name: fn.name,
            type: 'method',
            signature: fn.signature,
            parameters: fn.parameters || [],
            returns: fn.returns
          });
        }
      }
      
      if (cls.getters) {
        for (const getter of cls.getters) {
          locators.push({
            name: getter.name,
            type: 'locator',
            signature: getter.name,
            async: getter.async
          });
        }
      }
      
      if (cls.properties) {
        for (const prop of cls.properties) {
          if (prop.type === 'property') {
            locators.push({
              name: prop.name,
              type: 'locator',
              signature: prop.name
            });
          }
        }
      }
    }
    
    console.log(`   ✅ Found ${functions.length} functions, ${locators.length} locators`);
    
    res.json({ 
      success: true, 
      functions: functions.map(f => f.name),
      methods: functions,
      locators: locators,
      all: [...locators, ...functions]
    });
    
  } catch (error) {
    console.error('Error getting POM functions:', error);
    res.json({ success: true, functions: [], locators: [], methods: [], all: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ✨ FIXED: GET /api/poms/:pomName - Now accepts platform parameter
// ═══════════════════════════════════════════════════════════════════════════

router.get('/:pomName', async (req, res) => {
  try {
    const projectPath = req.query.projectPath || process.env.GUEST_PROJECT_PATH;
    const platform = req.query.platform || null;  // ✅ NEW: Accept platform
    const { pomName } = req.params;

    console.log(`\n📦 Getting POM details: ${pomName}`);
    if (platform) {
      console.log(`   📱 Platform filter: ${platform}`);
    }

    const discovery = new POMDiscovery(projectPath);
    await discovery.discover();

    let pom = null;
    
    // ✅ NEW: If platform specified, find POM from correct platform path
    if (platform) {
      const config = await loadProjectConfig(projectPath);
      const platformPatterns = config?.screenPaths?.[platform] || [];
      const ignorePatterns = config?.screenPaths?.ignore || [];
      
      console.log(`   🔍 Looking for "${pomName}" in platform "${platform}" paths`);
      console.log(`   📂 Platform patterns:`, platformPatterns);
      
      // Search through ALL cached POMs to find one matching name AND platform
      for (const [cacheKey, cachedPom] of discovery.pomCache.entries()) {
        const pomPath = cachedPom.path || '';
        
        // Check if this POM's path matches platform patterns
        const matchesPlatform = matchesPlatformPatterns(pomPath, platformPatterns, ignorePatterns);
        
        if (!matchesPlatform) {
          continue; // Skip POMs not in this platform's paths
        }
        
        // Check if name matches (various formats)
        const normalizedCacheKey = cacheKey.toLowerCase()
          .replace(/\.screen$/, '')
          .replace(/screen$/, '')
          .replace(/-/g, '');
        const normalizedPomName = pomName.toLowerCase()
          .replace(/\.screen$/, '')
          .replace(/screen$/, '')
          .replace(/-/g, '');
        
        // Check class names too
        const classNameMatch = cachedPom.classes?.some(cls => {
          const clsName = cls.name.toLowerCase();
          return clsName === pomName.toLowerCase() ||
                 clsName === normalizedPomName ||
                 clsName.replace(/screen$/i, '') === normalizedPomName;
        });
        
        const nameMatches = 
          normalizedCacheKey === normalizedPomName ||
          normalizedCacheKey.includes(normalizedPomName) ||
          cacheKey.toLowerCase() === pomName.toLowerCase() ||
          classNameMatch;
        
        if (nameMatches) {
          console.log(`   ✅ Found platform-specific POM: ${cachedPom.path}`);
          pom = cachedPom;
          break;
        }
      }
      
      if (!pom) {
        console.log(`   ⚠️ No POM found for "${pomName}" in platform "${platform}"`);
        // List what WAS found for this platform (for debugging)
        const platformPoms = [];
        for (const [key, cached] of discovery.pomCache.entries()) {
          if (matchesPlatformPatterns(cached.path || '', platformPatterns, ignorePatterns)) {
            platformPoms.push(key);
          }
        }
        console.log(`   📦 Available POMs in ${platform}:`, platformPoms.slice(0, 10));
      }
    }
    
    // Fallback to original lookup if no platform or not found
    if (!pom) {
      pom = discovery.pomCache.get(pomName);
      
      if (!pom) {
        // Try case-insensitive search
        for (const [key, cachedPom] of discovery.pomCache.entries()) {
          if (key.toLowerCase() === pomName.toLowerCase()) {
            pom = cachedPom;
            console.log(`   📍 Found via case-insensitive match: ${key}`);
            break;
          }
          if (cachedPom.classes?.some(cls => cls.name === pomName)) {
            pom = cachedPom;
            console.log(`   📍 Found via class name match: ${cachedPom.path}`);
            break;
          }
        }
      }
    }

    if (!pom) {
      console.log(`   ❌ POM "${pomName}" not found`);
      console.log(`   📦 All available POMs:`, [...discovery.pomCache.keys()].slice(0, 20));
      return res.json({
        success: true,
        pomName,
        instances: [],
        instancePaths: {},
        functions: []
      });
    }

    // Extract data from found POM
    const instances = [];
    const functions = [];
    const locators = [];
    
    for (const cls of pom.classes || []) {
      for (const prop of cls.properties || []) {
        if (prop.type === 'instance') {
          instances.push({ name: prop.name, className: prop.className });
        }
      }
      
      if (cls.functions) {
        functions.push(...cls.functions);
      }
      
      for (const getter of cls.getters || []) {
        locators.push(getter.name);
      }
      for (const prop of cls.properties || []) {
        if (prop.type === 'property') {
          locators.push(prop.name);
        }
      }
    }

    const instancePaths = {};
    if (instances.length === 0 && locators.length > 0) {
      instancePaths['default'] = locators;
    } else {
      for (const inst of instances) {
        instancePaths[inst.name] = discovery.getAvailablePaths(pom.name, inst.name);
      }
      if (locators.length > 0) {
        instancePaths['default'] = locators;
      }
    }

    console.log(`   ✅ ${pomName}: ${functions.length} functions, ${locators.length} locators`);
    console.log(`   📄 Source file: ${pom.path}`);

    res.json({
      success: true,
      pomName,
      path: pom.path,  // ✅ Include path so frontend knows which file was used
      platform: platform || 'any',
      instances,
      instancePaths,
      functions
    });

  } catch (error) {
    console.error('❌ Failed to get POM details:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/poms/:pomName/locators
 */
router.get('/:pomName/locators', async (req, res) => {
  try {
    const projectPath = req.query.projectPath || process.env.GUEST_PROJECT_PATH;
    const platform = req.query.platform || null;  // ✅ Accept platform here too
    const { pomName } = req.params;
    const instanceName = req.query.instance || null;

    if (!projectPath) {
      return res.status(400).json({ error: 'No project path provided' });
    }

    const discovery = new POMDiscovery(projectPath);
    await discovery.discover();

    // ✅ Use same platform-aware lookup as /:pomName
    let pom = null;
    
    if (platform) {
      const config = await loadProjectConfig(projectPath);
      const platformPatterns = config?.screenPaths?.[platform] || [];
      const ignorePatterns = config?.screenPaths?.ignore || [];
      
      for (const [cacheKey, cachedPom] of discovery.pomCache.entries()) {
        const pomPath = cachedPom.path || '';
        
        if (!matchesPlatformPatterns(pomPath, platformPatterns, ignorePatterns)) {
          continue;
        }
        
        const normalizedCacheKey = cacheKey.toLowerCase().replace(/\.screen$/, '').replace(/screen$/, '');
        const normalizedPomName = pomName.toLowerCase().replace(/\.screen$/, '').replace(/screen$/, '');
        
        if (normalizedCacheKey === normalizedPomName ||
            normalizedCacheKey.includes(normalizedPomName) ||
            cacheKey.toLowerCase() === pomName.toLowerCase()) {
          pom = cachedPom;
          break;
        }
      }
    }
    
    if (!pom) {
      pom = discovery.pomCache.get(pomName);
    }
    
    if (!pom) {
      return res.status(404).json({ error: `POM "${pomName}" not found` });
    }

    const locators = [];
    
    for (const cls of pom.classes) {
      for (const getter of cls.getters || []) {
        locators.push({
          name: getter.name,
          type: 'getter',
          className: cls.name,
          path: getter.name
        });
      }
      
      for (const prop of cls.properties || []) {
        if (prop.type === 'property') {
          locators.push({
            name: prop.name,
            type: 'property',
            className: cls.name,
            path: prop.name
          });
        }
      }
    }

    if (instanceName) {
      const instanceLocators = discovery.getAvailablePaths(pomName, instanceName);
      return res.json({
        success: true,
        pomName,
        instance: instanceName,
        locators: instanceLocators.map(path => ({
          name: path.split('.').pop(),
          path,
          type: 'instance-getter'
        }))
      });
    }

    res.json({
      success: true,
      pomName,
      path: pom.path,
      count: locators.length,
      locators
    });

  } catch (error) {
    console.error('❌ Failed to get locators:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;