// packages/api-server/src/routes/testData.js
// SIMPLE VERSION - Uses regex instead of Babel for persistence!

import express from 'express';
import path from 'path';
import TestDataAnalyzer from '../services/TestDataAnalyzer.js';

const router = express.Router();

/**
 * POST /api/test-data/analyze
 */
router.post('/analyze', async (req, res) => {
  console.log('\n📊 POST /api/test-data/analyze');
  
  const { testDataPath, stateName, projectPath } = req.body;
  
  if (!testDataPath || !stateName || !projectPath) {
    return res.status(400).json({
      success: false,
      error: 'testDataPath, stateName, and projectPath are required'
    });
  }
  
  try {
    const fullPath = path.resolve(projectPath, testDataPath);
    console.log(`📁 Full path: ${fullPath}`);
    
    const analyzer = new TestDataAnalyzer();
    const analysis = await analyzer.analyze(fullPath, stateName);
    
    const allSuggestions = analyzer.getAllSuggestions(analysis.suggestions);
    const highConfidence = analyzer.getHighConfidenceSuggestions(analysis.suggestions);
    
    res.json({
      success: true,
      analysis: {
        stateName: analysis.stateName,
        keywords: analysis.keywords,
        suggestions: analysis.suggestions,
        testData: analysis.testData,
        allSuggestions,
        highConfidence
      },
      meta: {
        totalFields: Object.keys(analysis.testData).length,
        exactMatches: analysis.suggestions.exact.length,
        requiredFields: analysis.suggestions.required.length,
        availableFields: analysis.suggestions.available.length,
        highConfidenceCount: highConfidence.length
      }
    });
    
  } catch (error) {
    console.error('❌ Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/test-data/validate
 */
router.get('/validate', async (req, res) => {
  console.log('\n📊 GET /api/test-data/validate');
  
  const { testDataPath, projectPath } = req.query;
  
  if (!testDataPath || !projectPath) {
    return res.status(400).json({
      success: false,
      error: 'testDataPath and projectPath are required'
    });
  }
  
  try {
    const analyzer = new TestDataAnalyzer();
    const fullPath = path.resolve(projectPath, testDataPath);
    
    const testData = await analyzer.readTestData(fullPath);
    const fields = Object.keys(testData).filter(k => !k.startsWith('_'));
    
    res.json({
      success: true,
      exists: true,
      valid: true,
      fields,
      fieldCount: fields.length
    });
    
  } catch (error) {
    res.json({
      success: true,
      exists: error.message.includes('not found') ? false : true,
      valid: false,
      error: error.message
    });
  }
});

/**
 * POST /api/test-data/save-link
 * SIMPLE VERSION - Uses regex, no Babel!
 */
router.post('/save-link', async (req, res) => {
  console.log('\n💾 POST /api/test-data/save-link');
  
  const { implicationPath, testDataPath } = req.body;
  
  if (!implicationPath || !testDataPath) {
    return res.status(400).json({
      success: false,
      error: 'implicationPath and testDataPath are required'
    });
  }
  
  try {
    const fsModule = await import('fs-extra');
    const fs = fsModule.default || fsModule;
    
    // Read file
    let content = await fs.readFile(implicationPath, 'utf-8');
    
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${implicationPath}.backup-${timestamp}`;
    await fs.writeFile(backupPath, content, 'utf-8');
    console.log(`📦 Backup created: ${backupPath}`);
    
    // Check if metadata exists
    const hasMetadata = /static\s+metadata\s*=/.test(content);
    
    if (hasMetadata) {
      // Update existing metadata
      const hasTestDataPath = /testDataPath\s*:\s*['"]/.test(content);
      
      if (hasTestDataPath) {
        // Replace existing testDataPath
        content = content.replace(
          /(testDataPath\s*:\s*)['"][^'"]*['"]/,
          `$1'${testDataPath}'`
        );
        console.log('✅ Updated existing testDataPath');
      } else {
        // Add testDataPath to existing metadata
        content = content.replace(
          /(static\s+metadata\s*=\s*\{)/,
          `$1\n    testDataPath: '${testDataPath}',`
        );
        console.log('✅ Added testDataPath to existing metadata');
      }
    } else {
      // Add new metadata property after class declaration
      content = content.replace(
        /(class\s+\w+\s*\{)/,
        `$1\n  static metadata = {\n    testDataPath: '${testDataPath}'\n  };\n`
      );
      console.log('✅ Created new metadata with testDataPath');
    }
    
    // Write updated file
    await fs.writeFile(implicationPath, content, 'utf-8');
    
    console.log('✅ TestData path saved to metadata');
    
    res.json({
      success: true,
      testDataPath,
      backupPath
    });
    
  } catch (error) {
    console.error('❌ Save link error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/test-data/load-link
 * SIMPLE VERSION - Uses regex, no Babel!
 */
router.get('/load-link', async (req, res) => {
  console.log('\n📂 GET /api/test-data/load-link');
  
  const { implicationPath } = req.query;
  
  if (!implicationPath) {
    return res.status(400).json({
      success: false,
      error: 'implicationPath is required'
    });
  }
  
  try {
    const fsModule = await import('fs-extra');
    const fs = fsModule.default || fsModule;
    
    // Read file
    const content = await fs.readFile(implicationPath, 'utf-8');
    
    // Extract testDataPath using regex
    const match = content.match(/testDataPath\s*:\s*['"]([^'"]+)['"]/);
    
    if (match) {
      const testDataPath = match[1];
      console.log('✅ Found testData path:', testDataPath);
      res.json({
        success: true,
        testDataPath
      });
    } else {
      console.log('⚠️ No testData path found in metadata');
      res.json({
        success: true,
        testDataPath: null,
        message: 'No testData path saved'
      });
    }
    
  } catch (error) {
    console.error('❌ Load link error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;