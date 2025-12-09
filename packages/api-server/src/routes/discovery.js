import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';
import minimatch from 'minimatch';

import { discoverProject, parseImplicationFile } from '../services/discoveryService.js';
import { ProjectAnalyzer } from '../../../analyzer/src/index.js';
import { StateRegistry } from '../../../core/src/index.js';
import { loadConfig } from '../services/configService.js';

const router = express.Router();

/**
 * GET /api/discovery/screens
 * Scan project for POM/Screen Object files with platform filtering
 * 
 * Query params:
 *   - projectPath: (required) Path to project
 *   - platform: (optional) Filter by platform (web, dancer, manager, clubApp)
 */
router.get('/screens', async (req, res) => {
  try {
    const { projectPath, platform } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectPath is required' 
      });
    }
    
    console.log(`🔍 Scanning for screen objects in: ${projectPath}`);
    if (platform) {
      console.log(`   📱 Filtering for platform: ${platform}`);
    }
    
    // Load config
    const config = await loadConfig(projectPath);
    
    // Determine which paths to scan based on platform
    let searchPatterns = [];
    let ignorePatterns = [];
    
    if (config?.screenPaths) {
      // Use new screenPaths config
      ignorePatterns = config.screenPaths.ignore || [];
      
      if (platform && config.screenPaths[platform]) {
        // Platform-specific paths
        searchPatterns = Array.isArray(config.screenPaths[platform]) 
          ? config.screenPaths[platform] 
          : [config.screenPaths[platform]];
        console.log(`   🎯 Using platform-specific paths:`, searchPatterns);
      } else if (!platform) {
        // No platform specified - scan ALL platform paths
        const allPlatformPaths = [];
        Object.entries(config.screenPaths).forEach(([key, paths]) => {
          if (key !== 'ignore' && Array.isArray(paths)) {
            allPlatformPaths.push(...paths);
          }
        });
        searchPatterns = [...new Set(allPlatformPaths)]; // Dedupe
        console.log(`   🌐 Scanning all platforms:`, searchPatterns);
      }
    }
    
    // Fallback to legacy config
    if (searchPatterns.length === 0) {
      if (config?.screenObjectsPaths) {
        searchPatterns = config.screenObjectsPaths;
      } else if (config?.patterns?.screenObjects) {
        searchPatterns = config.patterns.screenObjects;
      } else {
        // Ultimate fallback
        const defaultDir = config?.paths?.screenObjects || 'tests/screenObjects';
        searchPatterns = [`${defaultDir}/**/*.js`];
      }
      console.log(`   📂 Using fallback paths:`, searchPatterns);
    }
    
    // Scan using glob patterns
    const screens = [];
    const seenPaths = new Set();
    
    for (const pattern of searchPatterns) {
      const fullPattern = path.join(projectPath, pattern);
      console.log(`   🔎 Glob pattern: ${fullPattern}`);
      
      try {
        const files = await glob(fullPattern, {
          nodir: true,
          absolute: true
        });
        
        for (const filePath of files) {
          // Skip if already processed (deduplication)
          if (seenPaths.has(filePath)) continue;
          
          // Get relative path from project root
          const relativePath = path.relative(projectPath, filePath);
          
          // Check against ignore patterns
          const shouldIgnore = ignorePatterns.some(ignorePattern => 
            minimatch(relativePath, ignorePattern) || 
            minimatch(path.basename(filePath), ignorePattern)
          );
          
          if (shouldIgnore) {
            console.log(`   ⏭️  Ignoring: ${relativePath}`);
            continue;
          }
          
          seenPaths.add(filePath);
          
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            
            // Extract class name
            const classMatch = content.match(/class\s+(\w+)/);
            const className = classMatch ? classMatch[1] : path.basename(filePath, '.js');
            
            // Extract instance name (if exported)
            const instanceMatch = content.match(/(?:const|let|var)\s+(\w+)\s*=\s*new\s+\w+/);
            const instanceName = instanceMatch ? instanceMatch[1] : null;
            
            // Detect platform from path
            const detectedPlatform = detectPlatformFromPath(relativePath);
            
            const pomName = relativePath.replace(/\.js$/, '');
            
            screens.push({
              name: pomName,
              className: className,
              instanceName: instanceName,
              path: relativePath,
              fullPath: filePath,
              platform: detectedPlatform
            });
            
          } catch (parseError) {
            console.warn(`   ⚠️ Could not parse ${filePath}:`, parseError.message);
            screens.push({
              name: path.basename(filePath, '.js'),
              className: path.basename(filePath, '.js'),
              path: relativePath,
              fullPath: filePath,
              platform: detectPlatformFromPath(relativePath)
            });
          }
        }
      } catch (globError) {
        console.warn(`   ⚠️ Glob error for pattern ${pattern}:`, globError.message);
      }
    }
    
    // Sort by name for consistent ordering
    screens.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`✅ Found ${screens.length} screen objects${platform ? ` for ${platform}` : ''}`);
    
    res.json({
      success: true,
      screens: screens,
      count: screens.length,
      platform: platform || 'all',
      patterns: searchPatterns
    });
    
  } catch (error) {
    console.error('❌ Screen discovery error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * Detect platform from file path
 */
function detectPlatformFromPath(filePath) {
  const lowerPath = filePath.toLowerCase();
  
  if (lowerPath.includes('/dancer/')) return 'dancer';
  if (lowerPath.includes('/manager/')) return 'manager';
  if (lowerPath.includes('/clubapp/')) return 'clubApp';
  if (lowerPath.includes('/web/')) return 'web';
  if (lowerPath.includes('/mobile/')) return 'mobile';
  if (lowerPath.includes('/android/')) {
    if (lowerPath.includes('dancer')) return 'dancer';
    if (lowerPath.includes('manager')) return 'manager';
    return 'mobile';
  }
  if (lowerPath.includes('/ios/')) return 'mobile';
  
  // Default to web if no mobile indicators
  return 'web';
}

router.post('/scan', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    console.log(`\n🔍 Starting discovery for: ${projectPath}`);
    const startTime = Date.now();
    
    // Store project path immediately
    req.app.set('lastScannedProject', projectPath);
    
    // Load project config
    const config = await loadConfig(projectPath);
    
    // Run discovery
    const discoveryResult = await discoverProject(projectPath);
    
    // Build state registry
    console.log('\n🗺️  Building State Registry...');
    const stateRegistry = new StateRegistry(config);
    await stateRegistry.build(discoveryResult);
    
    // Run analysis with registry
    const analyzer = new ProjectAnalyzer();
    const analysisResult = analyzer.analyze(discoveryResult, {
      stateRegistry
    });
    
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Log results
    console.log(`✅ Discovery complete in ${duration}s`);
    console.log(`   - Files: ${discoveryResult.stats?.totalFiles || 'N/A'}`);
    console.log(`   - Implications: ${discoveryResult.files.implications.length}`);
    console.log(`   - State Mappings: ${stateRegistry.size}`);
    console.log(`   - Issues Found: ${analysisResult.summary.totalIssues}`);
    
    // Cache the discovery result
    req.app.set('lastDiscoveryResult', discoveryResult);
    
    // ✅ Extract graphColors from config (safely)
    let graphColors = null;
    if (config?.graphColors) {
      // Only pass serializable parts (no functions)
      graphColors = {
        colorNodesBy: config.graphColors.colorNodesBy || 'platform',
        platforms: config.graphColors.platforms || null,
        statuses: config.graphColors.statuses || null,
        patterns: config.graphColors.patterns || null,
        edgeColors: config.graphColors.edgeColors || null,
      };
      console.log(`   - Graph Colors: configured (colorNodesBy: ${graphColors.colorNodesBy})`);
    }
    
    // Build complete response
    const response = {
      ...discoveryResult,
      analysis: analysisResult,
      stateRegistry: stateRegistry.toJSON(),
      // ✅ Pass config to frontend for graphBuilder
      config: {
        graphColors: graphColors,
        projectName: config?.projectName || null,
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Discovery error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add this route to discovery.js (after the imports, before export)

/**
 * GET /api/config
 * Get project configuration
 */
router.get('/config', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectPath is required' 
      });
    }
    
    console.log(`📋 Loading config for: ${projectPath}`);
    
    const config = await loadConfig(projectPath);
    
    if (!config) {
      return res.json({
        success: true,
        config: {
          platforms: ['web'],
          projectName: null
        }
      });
    }
    
    console.log(`✅ Config loaded, platforms: ${config.platforms?.join(', ') || 'web'}`);
    
    res.json({
      success: true,
      config: {
        platforms: config.platforms || ['web'],
        projectName: config.projectName || null,
        testDataMode: config.testDataMode || 'stateful',
        graphColors: config.graphColors || null
      }
    });
    
  } catch (error) {
    console.error('❌ Config load error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/discovery/parse-single-file
 * Re-parse a single implication file (for fast refresh)
 */
router.post('/parse-single-file', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }
    
    console.log(`⚡ Fast parsing: ${path.basename(filePath)}`);
    
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const lastScannedProject = req.app.get('lastScannedProject');
    const projectPath = lastScannedProject || path.dirname(path.dirname(path.dirname(filePath)));
    
    console.log(`   Project path: ${projectPath}`);
    
    const implication = await parseImplicationFile(filePath, projectPath);
    
    if (!implication) {
      return res.status(400).json({ error: 'Failed to parse file' });
    }
    
    console.log(`✅ File parsed: ${implication.className}`);
    
    res.json(implication);
    
  } catch (error) {
    console.error('❌ Parse single file error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;