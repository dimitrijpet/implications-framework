// Add this to packages/api-server/src/routes/discovery.js
// OR create a new file: packages/api-server/src/routes/screens.js

import express from 'express';
import { glob } from 'glob';
import path from 'path';

const router = express.Router();

/**
 * GET /api/screens
 * 
 * Returns all screen files (.screen.js) in the project
 * Used by POMFieldSelector to show screen dropdown
 */
router.get('/', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectPath is required' 
      });
    }
    
    console.log(`🔍 Finding screen files in: ${projectPath}`);
    
    // Find all .screen.js files
    const screenFiles = await glob('**/*.screen.js', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
      absolute: false
    });
    
    console.log(`📋 Found ${screenFiles.length} screen files`);
    
    // Extract screen names (remove .js extension)
    const screens = screenFiles.map(filePath => {
      const fileName = path.basename(filePath, '.js'); // Remove .js
      return {
        name: fileName,           // e.g., "passengers.screen"
        path: filePath,          // e.g., "tests/screens/passengers.screen.js"
        displayName: fileName    // e.g., "passengers.screen"
      };
    });
    
    // Sort alphabetically
    screens.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({
      success: true,
      screens,
      count: screens.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching screens:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;