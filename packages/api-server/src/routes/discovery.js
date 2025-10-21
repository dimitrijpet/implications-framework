// packages/api-server/src/routes/discovery.js (FIX)

import express from 'express';
import { discoverProject } from '../services/discoveryService.js';
import { ProjectAnalyzer } from '../../../analyzer/src/index.js';
import { StateRegistry } from '../../../core/src/index.js';
import { loadConfig } from '../services/configService.js';

const router = express.Router();

router.post('/scan', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    console.log(`\n🔍 Starting discovery for: ${projectPath}`);
    const startTime = Date.now();
    
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
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Discovery complete in ${duration}s`);
    console.log(`   - Files: ${discoveryResult.stats?.totalFiles || 'N/A'}`);
    console.log(`   - Implications: ${discoveryResult.files.implications.length}`);
    console.log(`   - State Mappings: ${stateRegistry.size}`);
    console.log(`   - Issues Found: ${analysisResult.summary.totalIssues}`);
    
    // Include registry in response
    res.json({
      ...discoveryResult,
      analysis: analysisResult,
      stateRegistry: stateRegistry.toJSON()
    });
    
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;