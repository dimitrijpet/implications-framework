// packages/api-server/src/routes/poms.js
// ✨ FIXED: Config-driven platform filtering, no hardcoded values
import express from 'express';
import POMDiscovery from '../../../core/src/discovery/POMDiscovery.js';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

/**
 * Simple glob pattern matcher (no external dependency)
 * Supports: ** (any path), * (any segment), exact matches
 */
function matchGlob(filePath, pattern) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  
  // Convert glob pattern to regex
  const regexPattern = normalizedPattern
    .replace(/\./g, '\\.')           // Escape dots
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')  // Temp placeholder for **
    .replace(/\*/g, '[^/]*')         // * matches anything except /
    .replace(/<<<GLOBSTAR>>>/g, '.*'); // ** matches anything including /
  
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
    // Check glob pattern match
    if (matchGlob(normalizedPath, pattern)) {
      return true;
    }
    
    // Also check simple substring for patterns like '**/legacy/**'
    // Extract the key part between ** markers
    const keyPart = pattern.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^\/|\/$/g, '');
    if (keyPart && normalizedPath.includes(`/${keyPart}/`)) {
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
    
    // First check if it should be ignored
    if (shouldIgnore(pomPath, ignorePatterns)) {
      return false;
    }
    
    // Then check if it matches any of the platform patterns
    for (const pattern of platformPatterns) {
      if (matchGlob(pomPath, pattern)) {
        return true;
      }
      
      // Also do a simple path prefix check
      const pathPrefix = pattern.split('**')[0].replace(/\/$/, '');
      if (pathPrefix && pomPath.includes(pathPrefix)) {
        return true;
      }
    }
    
    return false;
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
    
    // Filter by platform if specified (using config)
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
 * Validate a POM path exists
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
    
    // Check if path contains instance (e.g., "oneWayTicket.inputDepartureLocation")
    let availablePaths = [];
    let isValid = false;
    
    if (pomPath.includes('.')) {
      // Instance path - split it
      const [instanceName, ...rest] = pomPath.split('.');
      
      // Get paths for this specific instance
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
      // Top-level path
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
 * Get navigation files filtered by platform
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
    
    // Get navigation files (optionally filtered by platform)
    let navigationFiles = discovery.getNavigationFiles(platform);
    
    // Apply config-based filtering if platform specified
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
 * Get methods for a specific navigation class
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
 * Get functions AND locators for a specific POM
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
      // Methods/functions
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
      
      // Getters (locators)
      if (cls.getters) {
        for (const getter of cls.getters) {
          locators.push({
            name: getter.name,
            type: 'locator',
            signature: getter.name,  // No () for getters
            async: getter.async
          });
        }
      }
      
      // Direct properties (also locators)
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
      // Legacy format for backward compat
      functions: functions.map(f => f.name),
      // New format with full info
      methods: functions,
      locators: locators,
      // Combined for easy dropdown
      all: [...locators, ...functions]
    });
    
  } catch (error) {
    console.error('Error getting POM functions:', error);
    res.json({ success: true, functions: [], locators: [], methods: [], all: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ✨ Parameterized routes MUST come LAST!
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/poms/:pomName
 * Get details for a specific POM
 */
router.get('/:pomName', async (req, res) => {
  try {
    const projectPath = req.query.projectPath || process.env.GUEST_PROJECT_PATH;
    const { pomName } = req.params;

    if (!projectPath) {
      return res.status(400).json({
        error: 'No project path provided'
      });
    }

    const discovery = new POMDiscovery(projectPath);
    await discovery.discover();

    const instances = discovery.getInstances(pomName);
    const functions = discovery.getFunctions(pomName);

    const isFlatPOM = instances.length === 0;

    const instancePaths = {};
    
    if (isFlatPOM) {
      const directPaths = discovery.getAvailablePaths(pomName);
      if (directPaths.length > 0) {
        instancePaths['default'] = directPaths;
      }
    } else {
      for (const instance of instances) {
        instancePaths[instance.name] = discovery.getAvailablePaths(pomName, instance.name); 
      }
      
      const directGetters = discovery.getDirectGetters(pomName);
      if (directGetters.length > 0) {
        instancePaths['default'] = directGetters;
        console.log(`   ✅ Added ${directGetters.length} direct getters to 'default' instance`);
      }
    }

    res.json({
      success: true,
      pomName,
      instances,
      instancePaths,
      functions
    });

  } catch (error) {
    console.error('❌ Failed to get POM details:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/poms/:pomName/locators
 * Get locators (getters) for a specific POM
 */
router.get('/:pomName/locators', async (req, res) => {
  try {
    const projectPath = req.query.projectPath || process.env.GUEST_PROJECT_PATH;
    const { pomName } = req.params;
    const instanceName = req.query.instance || null;

    if (!projectPath) {
      return res.status(400).json({ error: 'No project path provided' });
    }

    const discovery = new POMDiscovery(projectPath);
    await discovery.discover();

    const pom = discovery.pomCache.get(pomName);
    if (!pom) {
      return res.status(404).json({ error: `POM "${pomName}" not found` });
    }

    // Extract locators (getters) from all classes
    const locators = [];
    
    for (const cls of pom.classes) {
      // Direct getters
      for (const getter of cls.getters || []) {
        locators.push({
          name: getter.name,
          type: 'getter',
          className: cls.name,
          path: getter.name
        });
      }
      
      // Constructor field properties (this.btn = page.locator(...))
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

    // If instanceName provided, get instance-specific locators
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
      count: locators.length,
      locators
    });

  } catch (error) {
    console.error('❌ Failed to get locators:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;