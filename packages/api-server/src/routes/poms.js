// packages/api-server/src/routes/poms.js

import express from 'express';
import POMDiscovery from '../../../core/src/discovery/POMDiscovery.js';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

/**
 * GET /api/poms
 * Discover all POMs in guest project
 */
router.get('/', async (req, res) => {
  try {
    const projectPath = req.query.projectPath || process.env.GUEST_PROJECT_PATH;
    
    if (!projectPath) {
      return res.status(400).json({
        error: 'No project path provided. Set GUEST_PROJECT_PATH env var or pass ?projectPath='
      });
    }
    
    // Verify project exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(404).json({
        error: `Project not found: ${projectPath}`
      });
    }
    
    console.log(`🔍 Discovering POMs in: ${projectPath}`);
    
    const discovery = new POMDiscovery(projectPath);
    const poms = await discovery.discover();
    
    res.json({
      success: true,
      projectPath,
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

    // Get instances for this POM
    const instances = discovery.getInstances(pomName);

    // ✅ NEW: Check if this is a flat POM (no instances)
    const isFlatPOM = instances.length === 0;

    // Get available paths
    const instancePaths = {};
    
    if (isFlatPOM) {
      // ✅ Flat POM - add direct getters to "default" instance
      const directPaths = discovery.getAvailablePaths(pomName);
      if (directPaths.length > 0) {
        instancePaths['default'] = directPaths;
      }
    } else {
      // Has instances - get paths for each
      for (const instance of instances) {
        instancePaths[instance.name] = discovery.getAvailablePaths(pomName, instance.name); 
      }
    }

    res.json({
      success: true,
      pomName,
      instances,
      instancePaths
    });

  } catch (error) {
    console.error('❌ Failed to get POM details:', error);
    res.status(500).json({
      error: error.message
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
          availablePaths: availablePaths.slice(0, 20) // Show first 20
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

export default router;