// packages/api-server/src/routes/generate.js

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import UnitTestGenerator from '../../../core/src/generators/UnitTestGenerator.js';
import ImplicationGenerator from '../../../core/src/generators/ImplicationGenerator.js';

const router = express.Router();

/**
 * POST /api/generate/unit-test
 * 
 * Generate a UNIT test from an Implication file
 */
router.post('/unit-test', async (req, res) => {
  try {
    console.log('🔍 Received request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      implPath,
      filePath,
      implFilePath,
      platform = 'web', 
      state = null, 
      targetState = null,
      transitions = []  // ✅ Extract transitions!
    } = req.body;
    
    const implFilePathFinal = implPath || filePath || implFilePath;
    const stateToUse = state || targetState;
    
    console.log('📝 Parsed values:');
    console.log(`   implFilePath: ${implFilePathFinal}`);
    console.log(`   platform: ${platform}`);
    console.log(`   state: ${stateToUse}`);
    console.log(`   transitions: ${transitions.length}`);  // ✅ Log it!
    
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
    console.log(`   Transitions to generate: ${transitions.length}`);
    
    const generator = new UnitTestGenerator({});
    
    // ✅ Generate multiple tests - one per transition!
    const results = [];
    
    if (transitions.length > 0) {
      console.log('\n🔄 Generating transition tests...');
      
      for (const transition of transitions) {
        console.log(`\n📝 Generating test for: ${transition.event} (${transition.platform})`);
        
        const result = generator.generate(implFilePathFinal, {
          platform: transition.platform,  // ✅ Use transition's platform!
          state: stateToUse,
          transition: transition,  // ✅ Pass the transition!
          preview: false
        });
        
        results.push(result);
      }
    } else {
      // Fallback: Generate single test (old behavior)
      console.log('\n📝 Generating single test (no transitions)');
      
      const result = generator.generate(implFilePathFinal, {
        platform,
        state: stateToUse,
        preview: false
      });
      
      results.push(result);
    }
    
    console.log(`\n✅ Generated ${results.length} test(s)`);
    
    return res.json({
      success: true,
      count: results.length,
      results: results.map(r => ({
        fileName: r.fileName,
        filePath: r.filePath,
        code: r.code,
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

/**
 * POST /api/generate/implication
 * 
 * Generate an Implication file with composition and inheritance
 * 
 * Body:
 * {
 *   projectPath: string,
 *   className: string,
 *   status: string,
 *   platform: string,
 *   platforms: array,
 *   composedBehaviors: array,
 *   baseClass: string,
 *   screens: object,
 *   description: string,
 *   meta: object,
 *   preview: boolean
 * }
 */
router.post('/implication', async (req, res) => {
  try {
    const {
      projectPath,
      className,
      status,
      platform,
      platforms = [],
      composedBehaviors = [],
      baseClass = null,
      screens = {},
      description = '',
      meta = {},
      preview = false
    } = req.body;
    
    console.log('\n🎨 Generate Implication Request');
    console.log(`   Project: ${projectPath}`);
    console.log(`   Class: ${className}`);
    console.log(`   Status: ${status}`);
    console.log(`   Platform: ${platform}`);
    console.log(`   Composed Behaviors: ${composedBehaviors.length}`);
    console.log(`   Base Class: ${baseClass || 'none'}`);
    console.log(`   Screens: ${Object.keys(screens).length}`);
    
    // Validate required fields
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    if (!className) {
      return res.status(400).json({ error: 'className is required' });
    }
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    if (!platform) {
      return res.status(400).json({ error: 'platform is required' });
    }
    
    // Validate project path exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Project path does not exist',
        path: projectPath 
      });
    }
    
    // Determine output directory
    const outputDir = path.join(projectPath, 'tests/implications/bookings/status');
    
    // Create generator
    const generator = new ImplicationGenerator({
      projectPath,
      outputDir
    });
    
    // Generate implication
    const result = generator.generate({
      className,
      status,
      platform,
      platforms,
      composedBehaviors,
      baseClass,
      screens,
      description,
      meta,
      preview
    });
    
    console.log(`   ✅ Generated: ${result.fileName}`);
    
    res.json({
      success: true,
      message: `Implication generated: ${result.fileName}`,
      result: {
        fileName: result.fileName,
        filePath: result.filePath,
        code: preview ? result.code : undefined,
        className: result.context.className,
        status: result.context.meta.status,
        platform: result.context.meta.platform
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating implication:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/generate/full
 * 
 * Generate both Implication and UNIT test in one call
 */
router.post('/full', async (req, res) => {
  try {
    const {
      projectPath,
      className,
      status,
      platform,
      platforms = [],
      composedBehaviors = [],
      baseClass = null,
      screens = {},
      description = '',
      meta = {},
      preview = false
    } = req.body;
    
    console.log('\n🚀 Generate Full (Implication + Test) Request');
    console.log(`   Project: ${projectPath}`);
    console.log(`   Class: ${className}`);
    
    // Step 1: Generate Implication
    const outputDir = path.join(projectPath, 'tests/implications/bookings/status');
    
    const implGenerator = new ImplicationGenerator({
      projectPath,
      outputDir
    });
    
    const implResult = implGenerator.generate({
      className,
      status,
      platform,
      platforms,
      composedBehaviors,
      baseClass,
      screens,
      description,
      meta,
      preview
    });
    
    console.log(`   ✅ Generated Implication: ${implResult.fileName}`);
    
    // Step 2: Generate UNIT test
    let testResult = null;
    
    if (!preview && implResult.filePath) {
      const testGenerator = new UnitTestGenerator({});
      
      testResult = testGenerator.generate(implResult.filePath, {
        platform,
        preview
      });
      
      const testResults = Array.isArray(testResult) ? testResult : [testResult];
      console.log(`   ✅ Generated ${testResults.length} test(s)`);
    }
    
    res.json({
      success: true,
      message: `Generated ${className} with tests`,
      implication: {
        fileName: implResult.fileName,
        filePath: implResult.filePath,
        code: preview ? implResult.code : undefined
      },
      tests: testResult ? (Array.isArray(testResult) ? testResult : [testResult]).map(r => ({
        fileName: r.fileName,
        filePath: r.filePath,
        code: preview ? r.code : undefined,
        state: r.state
      })) : []
    });
    
  } catch (error) {
    console.error('❌ Error generating full:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/generate/behaviors
 * 
 * Get available behaviors for composition
 */
router.get('/behaviors', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    console.log('\n📚 Get Available Behaviors');
    console.log(`   Project: ${projectPath}`);
    
    const implicationsPath = path.join(projectPath, 'tests/implications');
    
    const behaviors = [];
    
    // Look for common behavior files
    const commonBehaviors = [
      'NotificationsImplications.js',
      'UndoImplications.js',
      'AuditLogImplications.js'
    ];
    
    for (const behaviorFile of commonBehaviors) {
      const behaviorPath = path.join(implicationsPath, behaviorFile);
      try {
        await fs.access(behaviorPath);
        const className = behaviorFile.replace('.js', '');
        behaviors.push({
          className,
          path: behaviorPath,
          methodName: 'forBookings',
          description: `${className} behavior`
        });
      } catch (error) {
        // File doesn't exist, skip
      }
    }
    
    console.log(`   ✅ Found ${behaviors.length} behaviors`);
    
    res.json({
      success: true,
      behaviors
    });
    
  } catch (error) {
    console.error('❌ Error getting behaviors:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

/**
 * GET /api/generate/base-classes
 * 
 * Get available base classes for inheritance
 */
router.get('/base-classes', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    console.log('\n🏗️  Get Available Base Classes');
    console.log(`   Project: ${projectPath}`);
    
    const implicationsPath = path.join(projectPath, 'tests/implications');
    
    const baseClasses = [];
    
    // Look for Base* files
    const { glob } = await import('glob');
    const baseFiles = await glob('**/Base*Implications.js', {
      cwd: implicationsPath,
      absolute: true
    });
    
    for (const baseFile of baseFiles) {
      const className = path.basename(baseFile, '.js');
      baseClasses.push({
        className,
        path: baseFile,
        description: `${className} base class`
      });
    }
    
    console.log(`   ✅ Found ${baseClasses.length} base classes`);
    
    res.json({
      success: true,
      baseClasses
    });
    
  } catch (error) {
    console.error('❌ Error getting base classes:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

export default router;