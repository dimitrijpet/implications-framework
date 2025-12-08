// packages/api-server/src/routes/navigation.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import { parseFile } from '../services/astParser.js';
import { parseFileWithMethods } from '../services/astParser.js';  // ✅ ADD THIS

const router = express.Router();

/**
 * GET /api/navigation?projectPath=...&platform=web
 * 
 * Finds all navigation helper files in the project
 */
router.get('/', async (req, res) => {
  const { projectPath, platform } = req.query;

  if (!projectPath) {
    return res.status(400).json({ error: 'projectPath is required' });
  }

  try {
    console.log('🧭 Searching for navigation files...');
    console.log('   Project:', projectPath);
    console.log('   Platform:', platform || 'all');

    const navFiles = await findNavigationFiles(projectPath, platform);

    console.log(`✅ Found ${navFiles.length} navigation files`);

    res.json({
      success: true,
      navigationFiles: navFiles
    });

  } catch (error) {
    console.error('❌ Navigation discovery failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find all navigation files in the project
 */
async function findNavigationFiles(projectPath, platform) {
  const navFiles = [];

  // ✅ EXPANDED: Search in MORE locations
  const searchPaths = [
    // Web
    path.join(projectPath, 'tests/web/current/navigation'),
    path.join(projectPath, 'tests/web/current/actions'),
    path.join(projectPath, 'tests/web/current/utils'),
    path.join(projectPath, 'tests/web/navigation'),
    path.join(projectPath, 'tests/web/actions'),
    
    // Mobile - Dancer
    path.join(projectPath, 'tests/mobile/android/dancer/navigation'),
    path.join(projectPath, 'tests/mobile/android/dancer/actions'),
    path.join(projectPath, 'tests/mobile/ios/dancer/navigation'),
    path.join(projectPath, 'tests/mobile/ios/dancer/actions'),
    
    // Mobile - Manager
    path.join(projectPath, 'tests/mobile/android/manager/navigation'),
    path.join(projectPath, 'tests/mobile/android/manager/actions'),
    path.join(projectPath, 'tests/mobile/ios/manager/navigation'),
    path.join(projectPath, 'tests/mobile/ios/manager/actions'),
    
    // Generic
    path.join(projectPath, 'tests/navigation'),
    path.join(projectPath, 'tests/actions'),
    path.join(projectPath, 'tests/helpers'),
    path.join(projectPath, 'tests/utils'),
  ];

for (const searchPath of searchPaths) {
  if (!fs.existsSync(searchPath)) continue;

  console.log(`   📂 Scanning: ${searchPath}`);

  try {
    const files = fs.readdirSync(searchPath)
      .filter(f => {
        const lower = f.toLowerCase();
        return f.endsWith('.js') && (
          lower.includes('nav') || 
          lower.includes('navigation') ||
          lower.includes('action')
        );
      });

    console.log(`      Found ${files.length} potential files: ${files.join(', ')}`);

    for (const file of files) {
      const filePath = path.join(searchPath, file);  // ✅ DEFINE HERE!
      console.log(`      🔍 Parsing: ${file}`);

      try {
        // Parse file to extract methods WITH SIGNATURES
        const parsed = await parseFileWithMethods(filePath);  // ✅ NOW IT'S DEFINED
        
        if (parsed.classes.length > 0) {
  // Loop through ALL classes in the file
  for (const classData of parsed.classes) {
    const methods = classData.functions || [];

    console.log(`         Checking class ${classData.name}: ${methods.length} total methods`);

    // Filter for navigation methods
    const navMethods = methods.filter(m => {
      const lower = m.name.toLowerCase();
      return lower.includes('navigate') ||
             lower.includes('goto') ||
             lower.includes('open') ||
             lower.includes('go') ||
             lower.startsWith('to');
    });

    console.log(`         Found ${navMethods.length} navigation methods in ${classData.name}`);

    if (navMethods.length > 0) {
      navFiles.push({
        file: file,
        path: filePath,
        className: classData.name,  // ✅ Use actual class name
        methods: navMethods,
        allMethods: methods,
        relativePath: path.relative(projectPath, filePath)
      });

      console.log(`         ✅ Added ${classData.name} with ${navMethods.length} methods`);
    }
  }
}
      } catch (parseError) {
        console.error(`         ❌ Parse error: ${parseError.message}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ Error scanning ${searchPath}:`, error.message);
  }
}

  return navFiles;
}

export default router;