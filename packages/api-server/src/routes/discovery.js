import express from 'express';
import { discoverProject } from '../services/discoveryService.js';
import { Analyzer } from '../../../analyzer/src/index.js';  // ← ADD

const router = express.Router();

// Create analyzer instance
const analyzer = new Analyzer();  // ← ADD

router.post('/scan', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    console.log(`📡 Received scan request for: ${projectPath}`);
    
    // Run discovery
    const discoveryResult = await discoverProject(projectPath);
    
    // ✅ NEW: Run analysis
    const analysisResult = analyzer.analyze(discoveryResult);
    
    // ✅ NEW: Add analysis to response
    const response = {
      ...discoveryResult,
      analysis: analysisResult  // ← ADD
    };
    
    console.log(`✅ Scan complete with analysis`);
    
    res.json(response);  // ← Changed from discoveryResult to response
    
  } catch (error) {
    console.error('❌ Scan failed:', error);
    res.status(500).json({ 
      error: 'Discovery failed', 
      message: error.message 
    });
  }
});

export default router;