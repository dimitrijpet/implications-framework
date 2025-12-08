// packages/api-server/src/routes/generate.js

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import UnitTestGenerator from '../../../core/src/generators/UnitTestGenerator.js';
import ImplicationGenerator from '../../../core/src/generators/ImplicationGenerator.js';
import { LockService } from '../services/lockService.js';

const router = express.Router();

/**
 * Update Implication file's setup.testFile and triggeredBy to point to generated test
 * 
 * This ensures TestPlanner can find the correct test file when resolving prerequisites.
 * 
 * @param {string} implFilePath - Path to the Implication file
 * @param {string} testFileName - Generated test filename (e.g., AgencySelectedViaLanding-SELECTAGENCY-Web-UNIT.spec.js)
 * @param {object} transition - Transition object with event, platform, etc.
 * @param {string} implDir - Directory containing the implication files
 */
async function updateImplicationSetup(implFilePath, testFileName, transition, implDir) {
  try {
    const absolutePath = path.resolve(implFilePath);
    let content = await fs.readFile(absolutePath, 'utf-8');
    
    // Build the full test file path (relative from project root)
    const testFileRelative = `${implDir}/${testFileName}`.replace(/^\//, '');
    
    // Parse filename to get actionName
    // AgencySelectedViaLanding-SELECTAGENCY-Web-UNIT.spec.js → agencySelectedViaLanding
    const baseFileName = testFileName
      .replace(/-UNIT\.spec\.js$/, '')  // Remove suffix
      .split('-')[0];  // Get first part (before event name)
    
    const actionName = baseFileName.charAt(0).toLowerCase() + baseFileName.slice(1);
    
    console.log(`\n   📝 Updating ${path.basename(implFilePath)}:`);
    console.log(`      testFile: ${testFileRelative}`);
    console.log(`      actionName: ${actionName}`);
    
    let updated = false;
    
    // Strategy 1: Replace existing setup block using regex
    // Match: setup: [{ testFile: '...', actionName: '...', platform: '...' }]
    const setupBlockRegex = /(setup:\s*\[\s*\{[^}]*testFile:\s*['"])[^'"]+(['"][^}]*actionName:\s*['"])[^'"]+(['"])/;
    
    if (setupBlockRegex.test(content)) {
      content = content.replace(setupBlockRegex, `$1${testFileRelative}$2${actionName}$3`);
      updated = true;
    } else {
      // Strategy 2: Replace testFile and actionName separately
      const testFileRegex = /(setup:\s*\[\s*\{[\s\S]*?testFile:\s*['"])[^'"]+(['"])/;
      if (testFileRegex.test(content)) {
        content = content.replace(testFileRegex, `$1${testFileRelative}$2`);
        updated = true;
      }
      
      const actionNameRegex = /(setup:\s*\[\s*\{[\s\S]*?actionName:\s*['"])[^'"]+(['"])/;
      if (actionNameRegex.test(content)) {
        content = content.replace(actionNameRegex, `$1${actionName}$2`);
        updated = true;
      }
    }
    
    // Update triggeredBy require path and function name
    // Match: require('./SomeFile.spec.js') and the destructured function name
    const triggeredByRequireRegex = /(require\(\s*['"]\.\/)[^'"]+Implications-[^'"]+\.spec\.js(['"])/g;
    if (triggeredByRequireRegex.test(content)) {
      content = content.replace(triggeredByRequireRegex, `$1${testFileName}$2`);
      updated = true;
    }
    
    // Also update the destructured function name in triggeredBy
    // Match: const { old_action_name } = require(...)
    const triggeredByFunctionRegex = /(const\s*\{\s*)[a-zA-Z_]+(\s*\}\s*=\s*require\(['"]\.\/[^'"]*['"])/g;
    content = content.replace(triggeredByFunctionRegex, `$1${actionName}$2`);
    
    // Update the return call: return old_action_name(testDataPath, options)
    const returnCallRegex = /(return\s+)[a-zA-Z_]+(\(testDataPath,\s*options\))/g;
    content = content.replace(returnCallRegex, `$1${actionName}$2`);
    
    if (updated) {
      await fs.writeFile(absolutePath, content, 'utf-8');
      console.log(`      ✅ Updated successfully`);
    } else {
      console.log(`      ⚠️ No setup block found to update`);
    }
    
  } catch (error) {
    console.warn(`      ⚠️ Could not update implication: ${error.message}`);
  }
}

/**
 * POST /api/generate/unit-test
 * 
 * Generate a UNIT test from an Implication file
 */
router.post('/unit-test', async (req, res) => {
  try {
    console.log('=== STARTING GENERATION ===');
    console.log('🔍 Received request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      implPath,
      filePath,
      implFilePath,
      platform = 'web', 
      state = null, 
      targetState = null,
      transitions = [],
      forceRawValidation = false,
      skipLocked = true,  // ← NEW: Skip locked tests by default
      projectPath        // ← NEW: Need this for lock checking
    } = req.body;
    
    const implFilePathFinal = implPath || filePath || implFilePath;
    const stateToUse = state || targetState;
    
    console.log('📝 Parsed values:');
    console.log(`   implFilePath: ${implFilePathFinal}`);
    console.log(`   platform: ${platform}`);
    console.log(`   state: ${stateToUse}`);
    console.log(`   transitions: ${transitions.length}`);
    console.log(`   skipLocked: ${skipLocked}`);
    
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
    console.log(`   Force Raw Validation: ${forceRawValidation}`);
    
    const generator = new UnitTestGenerator({});
    
    // Get the implication directory for relative paths
    const implDir = path.dirname(implFilePathFinal).replace(/^.*?tests\//, 'tests/');
    
    // ═══════════════════════════════════════════════════════════
    // NEW: Check for locked tests before generation
    // ═══════════════════════════════════════════════════════════
    let lockService = null;
    let lockedPaths = [];
    
    if (skipLocked && projectPath) {
      lockService = new LockService(projectPath);
      lockedPaths = await lockService.getLockedPaths();
      
      if (lockedPaths.length > 0) {
        console.log(`🔒 Found ${lockedPaths.length} locked test(s)`);
      }
    }
    
    // ✅ Generate multiple tests - one per transition!
    const results = [];
    const skipped = [];
    
    if (transitions.length > 0) {
      console.log('\n🔄 Generating transition tests...');
      
      for (const transition of transitions) {
        // Build expected test file path to check against locks
        const expectedFileName = buildTestFileName(stateToUse, transition);
        const expectedTestPath = `${implDir}/${expectedFileName}`;
        
        // ═══════════════════════════════════════════════════════════
        // NEW: Skip if locked
        // ═══════════════════════════════════════════════════════════
        if (skipLocked && isPathLocked(expectedTestPath, lockedPaths)) {
          console.log(`   ⏭️  Skipping locked: ${expectedFileName}`);
          skipped.push({
            fileName: expectedFileName,
            path: expectedTestPath,
            reason: 'locked',
            transition: transition.event
          });
          continue;
        }
        
        console.log(`\n📝 Generating test for: ${transition.event} (${transition.platform})`);
        
        const result = generator.generate(implFilePathFinal, {
          platform: transition.platform,
          state: stateToUse,
          transition: transition,
          event: transition.event,
          preview: false,
          forceRawValidation
        });
        
        results.push(result);
        
        // Update implication setup (existing code)
        if (result.filePath && transition.sourceImplPath) {
          await updateImplicationSetup(
            transition.sourceImplPath,
            result.fileName,
            transition,
            implDir
          );
        }
        
        if (result.filePath) {
          await updateImplicationSetup(
            implFilePathFinal,
            result.fileName,
            transition,
            implDir
          );
        }
      }
    } else {
      // Fallback: Generate single test (old behavior)
      console.log('\n📝 Generating single test (no transitions)');
      
      const result = generator.generate(implFilePathFinal, {
        platform,
        state: stateToUse,
        preview: false,
        forceRawValidation
      });
      
      // Check if this single test is locked
      if (skipLocked && result.filePath && isPathLocked(result.filePath, lockedPaths)) {
        console.log(`   ⏭️  Skipping locked: ${result.fileName}`);
        skipped.push({
          fileName: result.fileName,
          path: result.filePath,
          reason: 'locked'
        });
      } else {
        results.push(result);
      }
    }
    
    console.log(`\n✅ Generated ${results.length} test(s), skipped ${skipped.length} locked`);
    
    return res.json({
      success: true,
      count: results.length,
      skippedCount: skipped.length,
      results: results.map(r => ({
        fileName: r.fileName,
        filePath: r.filePath,
        code: r.code,
        size: r.code?.length || 0,
        state: r.state
      })),
      skipped: skipped
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

// ═══════════════════════════════════════════════════════════
// NEW: Helper functions for lock checking
// ═══════════════════════════════════════════════════════════

function isPathLocked(testPath, lockedPaths) {
  if (!testPath || !lockedPaths.length) return false;
  
  // Normalize the path for comparison
  const normalized = testPath.replace(/\\/g, '/');
  
  return lockedPaths.some(locked => {
    const normalizedLocked = locked.replace(/\\/g, '/');
    return normalized === normalizedLocked || 
           normalized.endsWith(normalizedLocked) || 
           normalizedLocked.endsWith(normalized);
  });
}

function buildTestFileName(stateName, transition) {
  // Build expected filename pattern
  // e.g., PassengerDataSubmittedViaPassengerDataFilled-SUBMITPASSENGERSDATA-Web-UNIT.spec.js
  
  if (!transition.event) {
    return `${stateName}-${transition.platform || 'Web'}-UNIT.spec.js`;
  }
  
  const fromState = transition.fromState || 'Unknown';
  const event = transition.event.toUpperCase().replace(/_/g, '');
  const platform = (transition.platform || 'web').charAt(0).toUpperCase() + (transition.platform || 'web').slice(1);
  
  // Convert state names to PascalCase
  const toPascal = (str) => str
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
  
  const targetPascal = toPascal(stateName);
  const fromPascal = toPascal(fromState);
  
  return `${targetPascal}Via${fromPascal}-${event}-${platform}-UNIT.spec.js`;
}

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