// packages/api-server/src/routes/discovery.js

import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import { discoverProject, parseImplicationFile } from '../services/discoveryService.js';
import { ProjectAnalyzer } from '../../../analyzer/src/index.js';
import { StateRegistry } from '../../../core/src/index.js';
import { loadConfig } from '../services/configService.js';

const router = express.Router();

/**
 * GET /api/discovery/screens
 * Scan project for POM/Screen Object files and return list
 */
router.get('/screens', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectPath is required' 
      });
    }
    
    console.log(`🔍 Scanning for screen objects in: ${projectPath}`);
    
    // Load config to find screenObjects directory
    const config = await loadConfig(projectPath);
    const screenObjectsDir = config?.paths?.screenObjects || 'tests/screenObjects';
    const fullPath = path.join(projectPath, screenObjectsDir);
    
    // Check if directory exists
    if (!await fs.pathExists(fullPath)) {
      console.log(`⚠️ Screen objects directory not found: ${fullPath}`);
      return res.json({ 
        success: true, 
        screens: [],
        message: `Directory not found: ${screenObjectsDir}`
      });
    }
    
    // Scan for .js files recursively
    const screens = [];
    
    async function scanDirectory(dir, relativePath = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        const entryRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          // Recurse into subdirectories
          await scanDirectory(entryPath, entryRelative);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          // Parse the file to extract class info
          try {
            const content = await fs.readFile(entryPath, 'utf-8');
            
            // Extract class name
            const classMatch = content.match(/class\s+(\w+)/);
            const className = classMatch ? classMatch[1] : entry.name.replace('.js', '');
            
            // Extract instance name (commonly used variable name)
            // Look for patterns like: const searchBar = new SearchBar()
            const instanceMatch = content.match(/(?:const|let|var)\s+(\w+)\s*=\s*new\s+\w+/);
            const instanceName = instanceMatch ? instanceMatch[1] : null;
            
            // Get the POM name (file name without extension, or with path for nested)
            const pomName = entryRelative.replace('.js', '');
            
            screens.push({
              name: pomName,
              className: className,
              instanceName: instanceName,
              path: entryRelative,
              fullPath: entryPath
            });
            
          } catch (parseError) {
            console.warn(`⚠️ Could not parse ${entryPath}:`, parseError.message);
            // Still add it with basic info
            screens.push({
              name: entry.name.replace('.js', ''),
              className: entry.name.replace('.js', ''),
              path: entryRelative,
              fullPath: entryPath
            });
          }
        }
      }
    }
    
    await scanDirectory(fullPath);
    
    console.log(`✅ Found ${screens.length} screen objects`);
    
    res.json({
      success: true,
      screens: screens,
      directory: screenObjectsDir
    });
    
  } catch (error) {
    console.error('❌ Screen discovery error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.post('/scan', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    // Validate input
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
    
    // 🔥 CACHE THE DISCOVERY RESULT FOR PATTERN ANALYSIS
    req.app.set('lastDiscoveryResult', discoveryResult);
    
    // Build complete response
    const response = {
      ...discoveryResult,
      analysis: analysisResult,
      stateRegistry: stateRegistry.toJSON()
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
    
    // Check if file exists
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get project path from the last scanned project
    const lastScannedProject = req.app.get('lastScannedProject');
    const projectPath = lastScannedProject || path.dirname(path.dirname(path.dirname(filePath)));
    
    console.log(`   Project path: ${projectPath}`);
    
    // Parse the single file
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