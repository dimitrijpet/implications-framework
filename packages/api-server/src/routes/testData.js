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

// ADD these routes to your existing testData.js file

/**
 * GET /api/test-data/files
 * List all testData JSON files in the project
 */
router.get('/files', async (req, res) => {
  console.log('\n📂 GET /api/test-data/files');
  
  const { projectPath } = req.query;
  
  if (!projectPath) {
    return res.status(400).json({ 
      success: false, 
      error: 'projectPath is required' 
    });
  }
  
  try {
    const fsModule = await import('fs-extra');
    const fs = fsModule.default || fsModule;
    const { glob } = await import('glob');
    
    console.log(`📂 Scanning for testData files in: ${projectPath}`);
    
    // Default patterns for testData files
    const searchPatterns = [
      'tests/data/**/*.json',
      'tests/testData/**/*.json',
      'tests/implications/data/**/*.json',
      'testData/**/*.json',
      'data/**/*-master.json',
      'data/**/*-current.json',
      '**/*-testdata.json',
      '**/*TestData.json'
    ];
    
    const files = [];
    const seenPaths = new Set();
    
    for (const pattern of searchPatterns) {
      const fullPattern = path.join(projectPath, pattern);
      
      try {
        const matches = await glob(fullPattern, {
          nodir: true,
          absolute: true,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
        });
        
        for (const filePath of matches) {
          if (seenPaths.has(filePath)) continue;
          seenPaths.add(filePath);
          
          const relativePath = path.relative(projectPath, filePath);
          const fileName = path.basename(filePath);
          const stats = await fs.stat(filePath);
          
          // Determine type (master vs current)
          let type = 'data';
          if (fileName.includes('-master')) type = 'master';
          else if (fileName.includes('-current')) type = 'current';
          else if (fileName.toLowerCase().includes('test')) type = 'test';
          
          files.push({
            name: fileName,
            path: relativePath,
            fullPath: filePath,
            type,
            size: stats.size,
            modified: stats.mtime
          });
        }
      } catch (globError) {
        console.warn(`   ⚠️ Glob error for ${pattern}:`, globError.message);
      }
    }
    
    // Sort: master files first, then by name
    files.sort((a, b) => {
      if (a.type === 'master' && b.type !== 'master') return -1;
      if (b.type === 'master' && a.type !== 'master') return 1;
      return a.name.localeCompare(b.name);
    });
    
    console.log(`✅ Found ${files.length} testData files`);
    
    res.json({
      success: true,
      files,
      count: files.length
    });
    
  } catch (error) {
    console.error('❌ TestData files scan error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/test-data/load
 * Load a specific testData JSON file and extract all keys
 */
router.get('/load', async (req, res) => {
  console.log('\n📖 GET /api/test-data/load');
  
  const { projectPath, filePath } = req.query;
  
  if (!projectPath || !filePath) {
    return res.status(400).json({ 
      success: false, 
      error: 'projectPath and filePath are required' 
    });
  }
  
  try {
    const fsModule = await import('fs-extra');
    const fs = fsModule.default || fsModule;
    
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(projectPath, filePath);
    
    console.log(`📖 Loading testData: ${fullPath}`);
    
    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    const content = await fs.readFile(fullPath, 'utf-8');
    const data = JSON.parse(content);
    
    // Extract all keys (flattened) for validation
    const keys = extractAllKeys(data);
    
    // Also extract root-level keys
    const rootKeys = Object.keys(data).filter(k => !k.startsWith('_'));
    
    console.log(`✅ Loaded testData: ${keys.length} total fields, ${rootKeys.length} root fields`);
    
    res.json({
      success: true,
      data,
      keys,
      rootKeys,
      filePath: fullPath,
      fileName: path.basename(fullPath)
    });
    
  } catch (error) {
    console.error('❌ TestData load error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * Extract all keys from nested object (dot notation)
 */
function extractAllKeys(obj, prefix = '') {
  const keys = [];
  
  if (!obj || typeof obj !== 'object') return keys;
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip private/meta fields
    if (key.startsWith('_')) continue;
    
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractAllKeys(value, fullKey));
    }
  }
  
  return keys;
}

export default router;