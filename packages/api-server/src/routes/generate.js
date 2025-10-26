// packages/api-server/src/routes/generate.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import UnitTestGenerator from '../../../core/src/generators/UnitTestGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

router.post('/unit-test', async (req, res) => {
  try {
    const { implPath, platform, state, projectPath } = req.body;
    
    if (!implPath) {
      return res.status(400).json({ error: 'implPath is required' });
    }
    
    console.log('\n🎯 Generate Unit Test Request:');
    console.log(`   Implication: ${implPath}`);
    console.log(`   Platform: ${platform || 'auto'}`);
    console.log(`   State: ${state || 'all states'}`);
    
    const outputDir = projectPath || path.dirname(implPath);
    
    const templatePath = path.join(__dirname, '../templates/unit-test.hbs');
    
    console.log(`📁 Output: ${outputDir}`);
    console.log(`📝 Template: ${templatePath}`);
    
    const generator = new UnitTestGenerator({
      outputDir,
      templatePath
    });
    
    const result = await generator.generate(implPath, {
      platform: platform || 'web',
      state: state || null,
      preview: false
    });
    
    // Handle array results (multi-state) or single result
    const results = Array.isArray(result) ? result : [result];
    
    console.log('\n✅ Generated:', results.map(r => r.fileName).join(', '));
    
    res.json({
      success: true,
      results: results.map(r => ({
        code: r.code,
        fileName: r.fileName,
        filePath: r.filePath
      })),
      count: results.length,
      message: `Generated ${results.length} test(s)`
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const { implPath, platform, state } = req.body;
    
    if (!implPath) {
      return res.status(400).json({ error: 'implPath is required' });
    }
    
    const templatePath = path.join(__dirname, '../templates/unit-test.hbs');
    const generator = new UnitTestGenerator({ templatePath });
    
    const result = await generator.generate(implPath, {
      platform: platform || 'web',
      state: state || null,
      preview: true
    });
    
    res.json({
      success: true,
      code: result.code,
      fileName: result.fileName
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;