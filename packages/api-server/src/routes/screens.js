import express from 'express';
import { glob } from 'glob';
import path from 'path';
import { parseFile } from '../services/astParser.js';  // ✅ ADD THIS

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectPath is required' 
      });
    }
    
    console.log(`🔍 Finding screen/wrapper files in: ${projectPath}`);
    
    // Find all .screen.js AND .wrapper.js files
    const screenFiles = await glob('**/*.{screen,wrapper}.js', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
      absolute: true  // ✅ Get absolute paths for parsing
    });
    
    console.log(`📋 Found ${screenFiles.length} files`);
    
    const screens = [];
    
    // ✅ Parse each file and extract ALL classes
    for (const filePath of screenFiles) {
      const fileName = path.basename(filePath, '.js');
      console.log(`   🔍 Parsing: ${fileName}`);
      
      try {
        const parsed = await parseFile(filePath);
        
        if (parsed.classes && parsed.classes.length > 0) {
          // ✅ Loop through ALL classes in the file
          for (const classData of parsed.classes) {
            console.log(`      ✅ Found class: ${classData.name}`);
            
            screens.push({
              name: classData.name,           // ✅ Class name
              path: path.relative(projectPath, filePath),
              displayName: classData.name,    // ✅ Class name
              fileName: fileName,             // Original file name
              filePath: filePath
            });
          }
        } else {
          console.log(`      ⚠️ No classes found`);
        }
      } catch (parseError) {
        console.error(`      ❌ Parse error: ${parseError.message}`);
      }
    }
    
    // Sort alphabetically
    screens.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`✅ Returning ${screens.length} screen classes`);
    
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