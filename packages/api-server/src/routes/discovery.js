import express from 'express';
import { discoverProject } from '../services/discoveryService.js';
import path from 'path';

const router = express.Router();

/**
 * POST /api/discovery/scan
 * Scan a project directory
 */
router.post('/scan', async (req, res, next) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({
        error: 'projectPath is required',
      });
    }
    
    // Validate path exists
    const absolutePath = path.resolve(projectPath);
    
    console.log(`📡 API: Starting discovery for ${absolutePath}`);
    
    const result = await discoverProject(absolutePath);
    
    res.json({
      success: true,
      result,
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/discovery/patterns
 * Get list of known patterns
 */
router.get('/patterns', (req, res) => {
  res.json({
    patterns: {
      implications: {
        description: 'XState-based or stateless implications',
        markers: ['xstateConfig', 'mirrorsOn', '*Implications.js'],
      },
      sections: {
        description: 'EnhancedBaseSection children',
        markers: ['extends EnhancedBaseSection', 'SCENARIOS', '*Section.js'],
      },
      screens: {
        description: 'Page Object Model screens',
        markers: ['*Screen.js', 'constructor(page)'],
      },
    },
  });
});

export default router;