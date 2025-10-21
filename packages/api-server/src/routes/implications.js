// packages/api-server/src/routes/implications.js (NEW FILE)

import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

const router = express.Router();

/**
 * POST /api/implications/use-base-directly
 * Remove mergeWithBase override and use base directly
 */
router.post('/use-base-directly', async (req, res) => {
  try {
    const { filePath, platform, screen } = req.body;
    
    if (!filePath || !platform || !screen) {
      return res.status(400).json({ 
        error: 'filePath, platform, and screen are required' 
      });
    }
    
    console.log(`📝 Removing override: ${platform}.${screen} in ${path.basename(filePath)}`);
    
    // Read the file
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const originalContent = await fs.readFile(filePath, 'utf-8');
    
    // Parse the file
    const ast = parser.parse(originalContent, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties']
    });
    
    let modified = false;
    let baseClassName = null;
    
    // Traverse and modify
    traverse.default(ast, {
      ClassDeclaration(path) {
        // Get the base class name
        if (path.node.superClass && path.node.superClass.name) {
          baseClassName = path.node.superClass.name;
        }
        
        // Find the mirrorsOn property
        path.traverse({
          ClassProperty(propertyPath) {
            if (propertyPath.node.key.name === 'mirrorsOn' && 
                propertyPath.node.static) {
              
              // Navigate to the specific platform.screen
              traverse.default(propertyPath.node.value, {
                Property(screenPath) {
                  // Check if this is the platform we're looking for
                  if (screenPath.node.key.name === platform) {
                    const platformValue = screenPath.node.value;
                    
                    // Find the screen property within the platform
                    if (t.isObjectExpression(platformValue)) {
                      platformValue.properties.forEach((prop, index) => {
                        if (prop.key.name === screen) {
                          // Check if this is a mergeWithBase call
                          if (t.isArrayExpression(prop.value) && 
                              prop.value.elements.length > 0) {
                            
                            const firstElement = prop.value.elements[0];
                            
                            if (t.isCallExpression(firstElement) &&
                                firstElement.callee.property?.name === 'mergeWithBase') {
                              
                              // Get the base reference (first argument)
                              const baseRef = firstElement.arguments[0];
                              
                              // Replace the entire array with just the base reference
                              prop.value = baseRef;
                              modified = true;
                              
                              console.log(`✅ Replaced mergeWithBase with base reference`);
                            }
                          }
                        }
                      });
                    }
                  }
                }
              }, screenPath.scope, screenPath.state, screenPath);
            }
          }
        });
      }
    });
    
    if (!modified) {
      return res.status(400).json({ 
        error: 'Could not find mergeWithBase call for specified platform/screen',
        details: { platform, screen, baseClassName }
      });
    }
    
    // Generate new code
    const output = generate.default(ast, {
      retainLines: true,
      comments: true
    }, originalContent);
    
    // Create backup
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.copy(filePath, backupPath);
    console.log('📦 Backup created:', backupPath);
    
    // Write modified file
    await fs.writeFile(filePath, output.code, 'utf-8');
    
    console.log('✅ File modified successfully');
    
    res.json({
      success: true,
      filePath,
      backup: backupPath,
      baseClassName,
      modified: { platform, screen }
    });
    
  } catch (error) {
    console.error('❌ Error modifying file:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/implications/add-override
 * Add a new override to an existing screen (for add-overrides action)
 */
router.post('/add-override', async (req, res) => {
  try {
    const { filePath, platform, screen, overrides } = req.body;
    
    if (!filePath || !platform || !screen || !overrides) {
      return res.status(400).json({ 
        error: 'filePath, platform, screen, and overrides are required' 
      });
    }
    
    console.log(`📝 Adding overrides to: ${platform}.${screen} in ${path.basename(filePath)}`);
    
    // TODO: Implement this in next iteration
    // This would add visible/hidden/checks to an existing mergeWithBase call
    
    res.status(501).json({ 
      error: 'Not implemented yet',
      message: 'This feature will be added in the next phase'
    });
    
  } catch (error) {
    console.error('❌ Error adding override:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/implications/remove-state
 * Comment out an isolated state file
 */
router.post('/remove-state', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }
    
    console.log(`🗑️ Commenting out state file: ${path.basename(filePath)}`);
    
    // Read the file
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const originalContent = await fs.readFile(filePath, 'utf-8');
    
    // Create backup
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.copy(filePath, backupPath);
    console.log('📦 Backup created:', backupPath);
    
    // Add comment block around entire file
    const commentedContent = `/*
 * COMMENTED OUT BY IMPLICATIONS FRAMEWORK
 * Reason: Isolated state with no transitions
 * Date: ${new Date().toISOString()}
 * 
 * To restore: Remove this comment block
 * Backup: ${backupPath}
 */

/*
${originalContent}
*/
`;
    
    // Write commented file
    await fs.writeFile(filePath, commentedContent, 'utf-8');
    
    console.log('✅ File commented out successfully');
    
    res.json({
      success: true,
      filePath,
      backup: backupPath
    });
    
  } catch (error) {
    console.error('❌ Error commenting out file:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;