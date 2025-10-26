// packages/api-server/src/routes/generate.js

import express from 'express';
import path from 'path';
import UnitTestGenerator from '../../../core/src/generators/UnitTestGenerator.js';

const router = express.Router();

/**
 * POST /api/generate/unit-test
 * 
 * Generate a UNIT test from an Implication file
 */
router.post('/unit-test', async (req, res) => {
  try {
    // ✅ Log everything to debug
    console.log('🔍 Received request body:', JSON.stringify(req.body, null, 2));
    
    // ✅ Accept ALL possible parameter names!
    const { 
      implPath,           // UI sends this
      filePath,           // Alternate
      implFilePath,       // Alternate
      platform = 'web', 
      state = null, 
      targetState = null 
    } = req.body;
    
    const implFilePathFinal = implPath || filePath || implFilePath;
    const stateToUse = state || targetState;
    
    console.log('📝 Parsed values:');
    console.log(`   implFilePath: ${implFilePathFinal}`);
    console.log(`   platform: ${platform}`);
    console.log(`   state: ${stateToUse}`);
    
    if (!implFilePathFinal) {
      console.error('❌ Missing file path in request body!');
      return res.status(400).json({ 
        error: 'Missing required field: implPath, filePath, or implFilePath',
        receivedBody: req.body
      });
    }
    
    console.log('🎯 Generate Unit Test Request:');
    console.log(`   Implication: ${implFilePathFinal}`);
    console.log(`   Platform: ${platform}`);
    console.log(`   State: ${stateToUse || 'all states'}`);
    
    // ✅ FIX: Don't pass outputDir - let generator auto-detect from implFilePath!
    const generator = new UnitTestGenerator({
      // outputDir is NOT set here - generator will auto-detect it!
    });
    
    const result = generator.generate(implFilePathFinal, {
      platform,
      state: stateToUse,
      preview: false
    });
    
    // Handle both single result and array (multi-state)
    const results = Array.isArray(result) ? result : [result];
    
    console.log(`\n✅ Generated ${results.length} test(s)`);
    
    return res.json({
      success: true,
      count: results.length,
      tests: results.map(r => ({
        fileName: r.fileName,
        filePath: r.filePath,
        size: r.code?.length || 0,
        state: r.state
      }))
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
