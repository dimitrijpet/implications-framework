// packages/api-server/src/routes/implications.js (COMPLETE FILE)

import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import * as parser from '@babel/parser';
import { parse } from '@babel/parser';
import babelGenerate from '@babel/generator';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import Handlebars from 'handlebars';
import { glob } from 'glob';  // 👈 ADD THIS LINE

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Register Handlebars helpers
Handlebars.registerHelper('camelCase', function(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
});

/**
 * POST /api/implications/create-state
 * Generate a new implication file from template
 */
// packages/api-server/src/routes/implications.js

router.post('/create-state', async (req, res) => {
  try {
    const { 
      projectPath, 
      stateName, 
      displayName,
      platform, 
      status,          // ✅ Extract from body
      description,     // ✅ Extract from body
      copyFrom,
      triggerButton,
      afterButton,
      previousButton,
      statusCode,
      statusNumber,
      notificationKey,
      setupActions,
      requiredFields,
      contextFields    // ✅ Use contextFields, not context
    } = req.body;
    
    console.log('🎯 Creating state:', stateName);
    console.log('📦 Received data:', req.body);
    
    // ✅ Filter out Status and Description from context if they exist
    const cleanContext = contextFields ? 
      Object.fromEntries(
        Object.entries(contextFields).filter(([key]) => 
          key !== 'Status' && key !== 'Description'
        )
      ) : null;
    
    // Convert stateName to proper formats
    const className = toPascalCase(stateName) + 'Implications';
    const stateId = stateName.toLowerCase();
    
    // Build template data
    const templateData = {
      className,
      stateId,
      timestamp: new Date().toISOString(),
      initial: 'idle',
      status: status || null,                    // ✅ Use status field
      platform: platform || 'web',
      description: description || null,           // ✅ Use description field
      context: cleanContext,                      // ✅ Use cleaned context
      hasEntry: !!status,
      
      meta: {
        status: status || displayName || toPascalCase(stateName),
        statusLabel: displayName || toPascalCase(stateName),
        triggerAction: triggerButton ? toCamelCase(triggerButton) : null,
        platform: platform || null,
        triggerButton: triggerButton || null,
        afterButton: afterButton || null,
        previousButton: previousButton || null,
        statusCode: statusCode || null,
        statusNumber: statusNumber ? parseInt(statusNumber) : null,
        notificationKey: notificationKey || null,
        setupActions: setupActions || null,
        requiredFields: requiredFields || null
      }
    };
    
    console.log('📝 Template data:', templateData);
    
    // Load template
    const templatePath = path.join(__dirname, '../templates/implication.hbs');
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    
    // Register JSON helper for Handlebars
    Handlebars.registerHelper('json', function(context) {
      return JSON.stringify(context);
    });
    
    const template = Handlebars.compile(templateContent);
    
    // Generate code
    const code = template(templateData);
    
    // Determine output path
    const outputPath = path.join(
      projectPath, 
      'tests/implications/bookings/status', 
      `${className}.js`
    );
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(outputPath));
    
    // Write file
    await fs.writeFile(outputPath, code, 'utf-8');
    
    console.log('✅ State created:', outputPath);
    
    res.json({
      success: true,
      filePath: outputPath,
      fileName: `${className}.js`,
      className
    });
    
  } catch (error) {
    console.error('❌ Create state failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function toPascalCase(str) {
  return str
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

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
    
    console.log(`📝 Attempting to remove override: ${platform}.${screen} in ${path.basename(filePath)}`);
    
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found: ' + filePath });
    }
    
    const originalContent = await fs.readFile(filePath, 'utf-8');
    
    if (!originalContent.includes('mergeWithBase')) {
      return res.status(400).json({ 
        error: 'This file does not use mergeWithBase pattern',
        hint: 'This action only works on files that extend a base class and use ImplicationHelper.mergeWithBase'
      });
    }
    
    const ast = parser.parse(originalContent, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'decorators-legacy']
    });
    
    let modified = false;
    let baseClassName = null;
    let foundMirrorsOn = false;
    
    traverse.default(ast, {
      ClassDeclaration(classPath) {
        if (classPath.node.superClass && classPath.node.superClass.name) {
          baseClassName = classPath.node.superClass.name;
        }
        
        classPath.node.body.body.forEach((member) => {
          if (t.isClassProperty(member) && 
              member.static && 
              member.key.name === 'mirrorsOn') {
            
            foundMirrorsOn = true;
            console.log('  ✓ Found mirrorsOn property');
            
            const mirrorsOnValue = member.value;
            
            if (!t.isObjectExpression(mirrorsOnValue)) {
              return;
            }
            
            const uiProp = mirrorsOnValue.properties.find(
              p => t.isObjectProperty(p) && p.key.name === 'UI'
            );
            
            if (!uiProp || !t.isObjectExpression(uiProp.value)) {
              console.log('  ✗ No UI property found');
              return;
            }
            
            console.log(`  ✓ Found UI property, looking for platform: ${platform}`);
            
            const platformProp = uiProp.value.properties.find(
              p => t.isObjectProperty(p) && p.key.name === platform
            );
            
            if (!platformProp || !t.isObjectExpression(platformProp.value)) {
              console.log(`  ✗ Platform "${platform}" not found`);
              return;
            }
            
            console.log(`  ✓ Found platform "${platform}", looking for screen: ${screen}`);
            
            const screenProp = platformProp.value.properties.find(
              p => t.isObjectProperty(p) && p.key.name === screen
            );
            
            if (!screenProp) {
              console.log(`  ✗ Screen "${screen}" not found`);
              return;
            }
            
            console.log(`  ✓ Found screen "${screen}"`);
            
            if (!t.isArrayExpression(screenProp.value)) {
              console.log('  ✗ Screen value is not an array');
              return;
            }
            
            if (screenProp.value.elements.length === 0) {
              console.log('  ✗ Screen array is empty');
              return;
            }
            
            const firstElement = screenProp.value.elements[0];
            
            if (!t.isCallExpression(firstElement)) {
              console.log('  ✗ First element is not a function call');
              return;
            }
            
            const isMergeWithBase = 
              (t.isMemberExpression(firstElement.callee) && 
               firstElement.callee.property?.name === 'mergeWithBase') ||
              (t.isIdentifier(firstElement.callee) && 
               firstElement.callee.name === 'mergeWithBase');
            
            if (!isMergeWithBase) {
              console.log('  ✗ Not a mergeWithBase call');
              return;
            }
            
            console.log('  ✓ Found mergeWithBase call!');
            
            if (!firstElement.arguments || firstElement.arguments.length === 0) {
              console.log('  ✗ mergeWithBase has no arguments');
              return;
            }
            
            const baseRef = firstElement.arguments[0];
            
            screenProp.value = baseRef;
            modified = true;
            
            console.log('  ✅ Successfully replaced mergeWithBase with base reference');
          }
        });
      }
    });
    
    if (!foundMirrorsOn) {
      return res.status(400).json({ 
        error: 'No mirrorsOn property found in this file',
        hint: 'This action only works on implication classes with a static mirrorsOn property'
      });
    }
    
    if (!modified) {
      return res.status(400).json({ 
        error: `Could not find mergeWithBase call for ${platform}.${screen}`,
        details: { 
          platform, 
          screen, 
          baseClassName,
          hint: 'The screen may not use mergeWithBase pattern, or the platform/screen names may be incorrect'
        }
      });
    }
    
    const output = babelGenerate.default(ast, {
      retainLines: true,
      comments: true
    }, originalContent);
    
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.copy(filePath, backupPath);
    console.log('📦 Backup created:', backupPath);
    
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
    
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const originalContent = await fs.readFile(filePath, 'utf-8');
    
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.copy(filePath, backupPath);
    console.log('📦 Backup created:', backupPath);
    
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

/**
 * POST /api/implications/update-metadata
 * Update state metadata and transitions in implication file
 */
router.post('/update-metadata', async (req, res) => {
  try {
    const { filePath, metadata, transitions } = req.body;
    
    if (!filePath || !metadata) {
      return res.status(400).json({ 
        error: 'filePath and metadata are required' 
      });
    }
    
    console.log(`📝 Updating metadata in: ${path.basename(filePath)}`);
    console.log(`📊 Fields to update:`, Object.keys(metadata));
    
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const originalContent = await fs.readFile(filePath, 'utf-8');
    
    const ast = parser.parse(originalContent, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties']
    });
    
    let modified = false;
    
    traverse.default(ast, {
      ClassDeclaration(classPath) {
        classPath.node.body.body.forEach((member) => {
          if (t.isClassProperty(member) && 
              member.static && 
              member.key.name === 'xstateConfig') {
            
            if (t.isObjectExpression(member.value)) {
              const metaProp = member.value.properties.find(
                p => t.isObjectProperty(p) && p.key.name === 'meta'
              );
              
             if (metaProp && t.isObjectExpression(metaProp.value)) {
  // ✅ WHITELIST: Only update these simple fields
  const EDITABLE_FIELDS = [
    'status',
    'statusCode', 
    'statusNumber',
    'triggerButton',
    'afterButton',
    'previousButton',
    'triggerAction',
    'notificationKey',
    'platform'
  ];
  
  Object.entries(metadata).forEach(([key, value]) => {
    // ❌ Skip if not in whitelist
    if (!EDITABLE_FIELDS.includes(key)) {
      console.log(`  ⏭️  Skipping ${key} (not editable)`);
      return;
    }
    
    // ❌ Skip undefined
    if (value === undefined) return;
    
    const existingProp = metaProp.value.properties.find(
      p => t.isObjectProperty(p) && p.key.name === key
    );
    
    // Create the AST node for SIMPLE values only
    let valueNode;
    if (value === null) {
      valueNode = t.nullLiteral();
    } else if (typeof value === 'string') {
      valueNode = t.stringLiteral(value);
    } else if (typeof value === 'number') {
      valueNode = t.numericLiteral(value);
    } else {
      console.log(`  ⚠️  Skipping ${key} - complex type`);
      return;
    }
    
    if (existingProp) {
      // ✅ Update existing
      existingProp.value = valueNode;
      console.log(`  ✏️  Updated ${key}: ${value}`);
      modified = true;
    } else {
      // ✅ Add new (simple fields only)
      const newProp = t.objectProperty(
        t.identifier(key),
        valueNode
      );
      metaProp.value.properties.push(newProp);
      console.log(`  ➕ Added ${key}: ${value}`);
      modified = true;
    }
  });
}
              
              // Handle transitions
              if (transitions) {
                const onProp = member.value.properties.find(
                  p => t.isObjectProperty(p) && p.key.name === 'on'
                );
                
                if (onProp) {
                  onProp.value = t.objectExpression(
                    transitions.map(trans => 
                      t.objectProperty(
                        t.identifier(trans.event),
                        t.stringLiteral(trans.target)
                      )
                    )
                  );
                  console.log(`  🔄 Updated ${transitions.length} transitions`);
                  modified = true;
                } else if (transitions.length > 0) {
                  // ✅ ADD 'on' property if it doesn't exist
                  const newOnProp = t.objectProperty(
                    t.identifier('on'),
                    t.objectExpression(
                      transitions.map(trans =>
                        t.objectProperty(
                          t.identifier(trans.event),
                          t.stringLiteral(trans.target)
                        )
                      )
                    )
                  );
                  member.value.properties.push(newOnProp);
                  console.log(`  ➕ Added 'on' with ${transitions.length} transitions`);
                  modified = true;
                }
              }
            }
          }
        });
      }
    });
    
    if (!modified) {
      return res.status(400).json({ 
        error: 'Could not update metadata - no xstateConfig found'
      });
    }
    
    // Generate code with better formatting
    const output = babelGenerate.default(ast, {
      retainLines: false,  // ✅ Better formatting
      compact: false,
      comments: true,
      concise: false
    }, originalContent);
    
    // Create backup
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.copy(filePath, backupPath);
    console.log('📦 Backup created:', path.basename(backupPath));
    
    // Write updated file
    await fs.writeFile(filePath, output.code, 'utf-8');
    
    console.log('✅ Metadata updated successfully');
    
    res.json({
      success: true,
      filePath,
      backup: backupPath,
      modified: { 
        metadata: Object.keys(metadata), 
        transitions: transitions?.length || 0 
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating metadata:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET endpoint to fetch state details for copying
// GET endpoint to fetch state details for copying
router.get('/get-state-details', async (req, res) => {
  try {
    const { stateId } = req.query;
    
    if (!stateId) {
      return res.status(400).json({ error: 'stateId is required' });
    }

    console.log(`🔍 Getting details for state: ${stateId}`);

    // Get project path
    const projectPath = req.app.get('lastScannedProject');
    if (!projectPath) {
      return res.status(400).json({ error: 'No project scanned yet' });
    }

    // Convert stateId to PascalCase for the class name
    const stateNamePascal = stateId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    // Search specifically for BookingImplications files first
    const patterns = [
      `${projectPath}/**/bookings/**/${stateNamePascal}BookingImplications.js`,
      `${projectPath}/**/bookings/**/*${stateNamePascal}*BookingImplications.js`,
      `${projectPath}/**/${stateNamePascal}BookingImplications.js`,
      `${projectPath}/**/*${stateNamePascal}*Implications.js`,
    ];

    let filePath = null;
    for (const pattern of patterns) {
      console.log(`  Searching with pattern: ${pattern}`);
      const files = await glob(pattern, { ignore: ['**/node_modules/**'] });
      if (files.length > 0) {
        // Prefer booking implications over others
        const bookingFile = files.find(f => f.includes('Booking'));
        filePath = bookingFile || files[0];
        console.log(`  ✅ Found ${files.length} file(s), using: ${path.basename(filePath)}`);
        break;
      }
    }
    
    if (!filePath) {
      console.log(`❌ State file not found for: ${stateId}`);
      return res.status(404).json({ 
        error: 'State file not found',
        searchedFor: stateNamePascal,
        hint: `Looking for ${stateNamePascal}BookingImplications.js`
      });
    }

    console.log(`📄 Reading file: ${filePath}`);

    const content = await fs.readFile(filePath, 'utf-8');
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'classProperties']
    });

    // Extract metadata
    let stateDetails = {
      platform: null,
      triggerButton: null,
      afterButton: null,
      previousButton: null,
      statusCode: null,
      statusNumber: null,
      notificationKey: null,
      setupActions: [],
      requiredFields: [],
      uiCoverage: { totalScreens: 0 }
    };

    traverse.default(ast, {  // 👈 FIX: Use .default
      ClassProperty(path) {
        const propertyName = path.node.key?.name;
        
        // Look for xstateConfig
        if (propertyName === 'xstateConfig' && path.node.static) {
          console.log('  ✅ Found xstateConfig');
          
          // Traverse the meta object
          path.traverse({
            ObjectProperty(metaPath) {
              const key = metaPath.node.key?.name || metaPath.node.key?.value;
              const value = metaPath.node.value;

              // Extract simple string fields
              if (value.type === 'StringLiteral') {
                if (['platform', 'triggerButton', 'afterButton', 'previousButton', 
                     'statusCode', 'notificationKey'].includes(key)) {
                  stateDetails[key] = value.value;
                  console.log(`    Found ${key}: ${value.value}`);
                }
              }
              
              // Extract number fields
              if (value.type === 'NumericLiteral' && key === 'statusNumber') {
                stateDetails[key] = value.value;
                console.log(`    Found ${key}: ${value.value}`);
              }

              // Extract arrays
              if (value.type === 'ArrayExpression') {
                if (key === 'requiredFields') {
                  stateDetails.requiredFields = value.elements
                    .filter(el => el.type === 'StringLiteral')
                    .map(el => el.value);
                  console.log(`    Found requiredFields: ${stateDetails.requiredFields.join(', ')}`);
                }
              }
              
              // Extract setup object
              if (key === 'setup' && value.type === 'ObjectExpression') {
                value.properties.forEach(prop => {
                  if (prop.key?.name === 'platform' && prop.value.type === 'StringLiteral') {
                    stateDetails.platform = prop.value.value;
                  }
                });
              }
            }
          });
        }
      }
    });

    console.log(`✅ Extracted details:`, {
      platform: stateDetails.platform,
      triggerButton: stateDetails.triggerButton,
      setupActions: stateDetails.setupActions.length,
      requiredFields: stateDetails.requiredFields.length
    });

    res.json(stateDetails);
    
  } catch (error) {
    console.error('❌ Error getting state details:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post('/update-ui', async (req, res) => {
  try {
    const { filePath, uiData } = req.body;
    
    // ✅ ADD THIS DEBUG
    console.log('📥 Received uiData:', JSON.stringify(uiData, null, 2));
    console.log('📥 uiData type:', typeof uiData);
    console.log('📥 uiData keys:', uiData ? Object.keys(uiData) : 'NULL');
    
    if (!filePath || !uiData) {
      return res.status(400).json({ 
        error: 'filePath and uiData are required' 
      });
    }
    
    console.log(`🖥️  Updating UI in: ${path.basename(filePath)}`);
    console.log(`📊 Platforms: ${Object.keys(uiData).join(', ')}`);
    
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const originalContent = await fs.readFile(filePath, 'utf-8');
    
    const ast = parser.parse(originalContent, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties']
    });
    
    let modified = false;
    let originalUINode = null;
    
    // First pass: Extract original UI structure
    traverse.default(ast, {
      ClassDeclaration(classPath) {
        classPath.node.body.body.forEach((member) => {
          if (t.isClassProperty(member) && 
              member.static && 
              member.key.name === 'mirrorsOn') {
            
            if (t.isObjectExpression(member.value)) {
              const uiProp = member.value.properties.find(
                p => t.isObjectProperty(p) && p.key.name === 'UI'
              );
              
              if (uiProp && t.isObjectExpression(uiProp.value)) {
                originalUINode = uiProp.value;
              }
            }
          }
        });
      }
    });
    
    if (!originalUINode) {
      return res.status(400).json({ 
        error: 'Could not find mirrorsOn.UI in file'
      });
    }
    
    // Build new UI AST with smart preservation
    const newUINode = buildSmartUIAst(uiData, originalUINode, originalContent);
    
    // Second pass: Replace UI node
    traverse.default(ast, {
      ClassDeclaration(classPath) {
        classPath.node.body.body.forEach((member) => {
          if (t.isClassProperty(member) && 
              member.static && 
              member.key.name === 'mirrorsOn') {
            
            if (t.isObjectExpression(member.value)) {
              const uiProp = member.value.properties.find(
                p => t.isObjectProperty(p) && p.key.name === 'UI'
              );
              
              if (uiProp) {
                uiProp.value = newUINode;
                modified = true;
                console.log('✅ Updated mirrorsOn.UI with smart preservation');
              }
            }
          }
        });
      }
    });
    
    if (!modified) {
      return res.status(400).json({ 
        error: 'Could not update UI'
      });
    }
    
    // Generate code
    const output = babelGenerate.default(ast, {
      retainLines: false,
      compact: false,
      comments: true,
      concise: false
    }, originalContent);
    
    // Create backup
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.copy(filePath, backupPath);
    console.log('📦 Backup created:', path.basename(backupPath));
    
    // Write updated file
    await fs.writeFile(filePath, output.code, 'utf-8');
    
    console.log('✅ UI updated successfully');
    
    res.json({
      success: true,
      filePath,
      backup: backupPath,
      platforms: Object.keys(uiData)
    });
    
  } catch (error) {
    console.error('❌ Error updating UI:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * ✅ SMART: Build UI AST while preserving original structure where possible
 */
function buildSmartUIAst(newData, originalUINode, originalContent) {
  const platformProps = [];
  
  // For each platform in new data
  for (const [platformName, platformData] of Object.entries(newData)) {
    // Find original platform node
    const originalPlatformProp = originalUINode.properties.find(
      p => p.key?.name === platformName
    );
    
    let platformScreenProps;
    
    if (originalPlatformProp && t.isObjectExpression(originalPlatformProp.value)) {
      // Platform exists in original - preserve what we can
      platformScreenProps = buildSmartScreenProps(
        platformData.screens,
        originalPlatformProp.value,
        originalContent
      );
    } else {
      // New platform - build from scratch
      platformScreenProps = buildScreenPropsFromData(platformData.screens);
    }
    
    platformProps.push(
      t.objectProperty(
        t.identifier(platformName),
        t.objectExpression(platformScreenProps)
      )
    );
  }
  
  return t.objectExpression(platformProps);
}

/**
 * Build screen properties while preserving original AST where unchanged
 */
function buildSmartScreenProps(newScreens, originalPlatformNode, originalContent) {
  // Group new screens by originalName
  const screenGroups = {};
  newScreens.forEach(screen => {
    const key = screen.originalName || screen.name;
    if (!screenGroups[key]) {
      screenGroups[key] = [];
    }
    screenGroups[key].push(screen);
  });
  
  const screenProps = [];
  
  for (const [screenKey, screens] of Object.entries(screenGroups)) {
    // Find original screen array
    const originalScreenProp = originalPlatformNode.properties.find(
      p => p.key?.name === screenKey
    );
    
    let screenArrayNode;
    
    if (originalScreenProp && t.isArrayExpression(originalScreenProp.value)) {
      // Check if screens changed
      const hasChanges = screensHaveChanges(screens, originalScreenProp.value);
      
      if (!hasChanges) {
        // ✅ NO CHANGES - Use original AST (preserves spreads, merges, comments!)
        console.log(`  ✨ Preserving original AST for ${screenKey}`);
        screenArrayNode = originalScreenProp.value;
      } else {
        // ❌ HAS CHANGES - Generate new AST
        console.log(`  🔧 Regenerating AST for ${screenKey} (modified)`);
        screenArrayNode = t.arrayExpression(
          screens.map(screen => buildScreenObjectAst(screen))
        );
      }
    } else {
      // New screen - build from scratch
      screenArrayNode = t.arrayExpression(
        screens.map(screen => buildScreenObjectAst(screen))
      );
    }
    
    screenProps.push(
      t.objectProperty(
        t.identifier(screenKey),
        screenArrayNode
      )
    );
  }
  
  return screenProps;
}


/**
 * Check if screens have changes compared to original AST
 */
function screensHaveChanges(newScreens, originalArrayNode) {
  // Simple check: compare lengths
  if (newScreens.length !== originalArrayNode.elements.length) {
    return true;
  }
  
  // Deep check: compare each screen's data
  for (let i = 0; i < newScreens.length; i++) {
    const newScreen = newScreens[i];
    const originalElement = originalArrayNode.elements[i];
    
    if (!originalElement || originalElement.type !== 'ObjectExpression') {
      return true;  // Can't compare - assume changed
    }
    
    // Extract data from original AST
    const originalData = extractScreenDataFromAst(originalElement);
    
    // Compare
    if (!screensMatch(newScreen, originalData)) {
      return true;
    }
  }
  
  return false;  // No changes detected
}

/**
 * Extract screen data from AST node for comparison
 */
function extractScreenDataFromAst(objectNode) {
  const data = {};
  
  objectNode.properties.forEach(prop => {
    if (!t.isObjectProperty(prop) || !prop.key) return;
    
    const key = prop.key.name;
    
    if (t.isStringLiteral(prop.value)) {
      data[key] = prop.value.value;
    } else if (t.isArrayExpression(prop.value)) {
      data[key] = prop.value.elements
        .filter(e => t.isStringLiteral(e))
        .map(e => e.value);
    } else if (t.isObjectExpression(prop.value)) {
      data[key] = extractScreenDataFromAst(prop.value);
    }
  });
  
  return data;
}

/**
 * Compare two screen objects
 */
function screensMatch(newScreen, originalData) {
  // Compare basic fields
  if (newScreen.name !== originalData.name) return false;
  if (newScreen.description !== originalData.description) return false;
  
  // Compare arrays
  if (!arraysMatch(newScreen.visible, originalData.visible)) return false;
  if (!arraysMatch(newScreen.hidden, originalData.hidden)) return false;
  
  // Compare checks
  if (newScreen.checks || originalData.checks) {
    if (!newScreen.checks || !originalData.checks) return false;
    
    if (!arraysMatch(newScreen.checks.visible, originalData.checks.visible)) return false;
    if (!arraysMatch(newScreen.checks.hidden, originalData.checks.hidden)) return false;
    
    // Compare checks.text
    if (!objectsMatch(newScreen.checks.text, originalData.checks.text)) return false;
  }
  
  return true;
}

/**
 * Compare two arrays
 */
function arraysMatch(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  
  return a.every((item, i) => item === b[i]);
}

/**
 * Compare two objects
 */
function objectsMatch(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  
  const keysA = Object.keys(a || {});
  const keysB = Object.keys(b || {});
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => a[key] === b[key]);
}

/**
 * Build screen props from data (when no original to preserve)
 */
function buildScreenPropsFromData(screens) {
  const screenGroups = {};
  
  screens.forEach(screen => {
    const key = screen.originalName || screen.name;
    if (!screenGroups[key]) {
      screenGroups[key] = [];
    }
    screenGroups[key].push(screen);
  });
  
  return Object.entries(screenGroups).map(([screenKey, screenArray]) =>
    t.objectProperty(
      t.identifier(screenKey),
      t.arrayExpression(screenArray.map(s => buildScreenObjectAst(s)))
    )
  );
}

/**
 * ✅ FIXED: Build AST for UI data with proper structure
 * Structure: { dancer: { screens: [...] }, web: { screens: [...] } }
 * Target:    { dancer: { screenKey: [...], screenKey: [...] }, web: { screenKey: [...] } }
 */
function buildUIAstFromPlatforms(uiData) {
  const platformProps = [];
  
  // For each platform (dancer, web, clubApp)
  for (const [platformName, platformData] of Object.entries(uiData)) {
    const screens = platformData.screens || [];
    
    // Group screens by their screen name (e.g., notificationsScreen, requestBookingScreen)
    const screenGroups = {};
    
    screens.forEach(screen => {
      const screenKey = screen.originalName || screen.name;
      if (!screenGroups[screenKey]) {
        screenGroups[screenKey] = [];
      }
      screenGroups[screenKey].push(screen);
    });
    
    // Build platform object: { notificationsScreen: [...], requestBookingScreen: [...] }
    const screenKeyProps = Object.entries(screenGroups).map(([screenKey, screenArray]) => {
      return t.objectProperty(
        t.identifier(screenKey),
        t.arrayExpression(screenArray.map(screen => buildScreenObjectAst(screen)))
      );
    });
    
    // Add this platform
    platformProps.push(
      t.objectProperty(
        t.identifier(platformName),
        t.objectExpression(screenKeyProps)
      )
    );
  }
  
  return t.objectExpression(platformProps);
}

/**
 * ✅ FIXED: Build AST for a single screen object
 */
function buildScreenObjectAst(screen) {
  const props = [];
  
  // Only add properties that exist and have values
  
  if (screen.name) {
    props.push(t.objectProperty(
      t.identifier('name'),
      t.stringLiteral(screen.name)
    ));
  }
  
  if (screen.description) {
    props.push(t.objectProperty(
      t.identifier('description'),
      t.stringLiteral(screen.description)
    ));
  }
  
  // Top-level visible array
  if (screen.visible && screen.visible.length > 0) {
    props.push(t.objectProperty(
      t.identifier('visible'),
      t.arrayExpression(screen.visible.map(v => t.stringLiteral(v)))
    ));
  }
  
  // Top-level hidden array
  if (screen.hidden && screen.hidden.length > 0) {
    props.push(t.objectProperty(
      t.identifier('hidden'),
      t.arrayExpression(screen.hidden.map(h => t.stringLiteral(h)))
    ));
  }
  
  // Checks object
  if (screen.checks && Object.keys(screen.checks).length > 0) {
    const checkProps = [];
    
    // checks.visible
    if (screen.checks.visible && screen.checks.visible.length > 0) {
      checkProps.push(t.objectProperty(
        t.identifier('visible'),
        t.arrayExpression(screen.checks.visible.map(v => t.stringLiteral(v)))
      ));
    }
    
    // checks.hidden
    if (screen.checks.hidden && screen.checks.hidden.length > 0) {
      checkProps.push(t.objectProperty(
        t.identifier('hidden'),
        t.arrayExpression(screen.checks.hidden.map(h => t.stringLiteral(h)))
      ));
    }
    
    // checks.text
    if (screen.checks.text && Object.keys(screen.checks.text).length > 0) {
      const textProps = Object.entries(screen.checks.text).map(([key, value]) =>
        t.objectProperty(
          t.identifier(key),
          t.stringLiteral(value)
        )
      );
      checkProps.push(t.objectProperty(
        t.identifier('text'),
        t.objectExpression(textProps)
      ));
    }
    
    if (checkProps.length > 0) {
      props.push(t.objectProperty(
        t.identifier('checks'),
        t.objectExpression(checkProps)
      ));
    }
  }
  
  return t.objectExpression(props);
}
/**
 * Helper: Build AST for UI data
 */
function buildUIAst(uiData) {
  const platformProps = Object.entries(uiData).map(([platformName, platformData]) => {
    const screenArray = t.arrayExpression(
      platformData.screens.map(screen => buildScreenAst(screen))
    );
    
    const screenNameKey = Object.keys(platformData.screens[0]?.screen ? { screen: 1 } : {})[0] || 
                          platformData.screens[0]?.name || 
                          'unknownScreen';
    
    return t.objectProperty(
      t.identifier(screenNameKey),
      screenArray
    );
  });
  
  return t.objectExpression(platformProps);
}

/**
 * Helper: Build AST for screen object
 */
function buildScreenAst(screen) {
  const props = [];
  
  // Add each property
  if (screen.name) {
    props.push(t.objectProperty(t.identifier('name'), t.stringLiteral(screen.name)));
  }
  
  if (screen.description) {
    props.push(t.objectProperty(t.identifier('description'), t.stringLiteral(screen.description)));
  }
  
  if (screen.visible && screen.visible.length > 0) {
    props.push(t.objectProperty(
      t.identifier('visible'),
      t.arrayExpression(screen.visible.map(v => t.stringLiteral(v)))
    ));
  }
  
  if (screen.hidden && screen.hidden.length > 0) {
    props.push(t.objectProperty(
      t.identifier('hidden'),
      t.arrayExpression(screen.hidden.map(h => t.stringLiteral(h)))
    ));
  }
  
  if (screen.checks) {
    const checkProps = [];
    
    if (screen.checks.visible && screen.checks.visible.length > 0) {
      checkProps.push(t.objectProperty(
        t.identifier('visible'),
        t.arrayExpression(screen.checks.visible.map(v => t.stringLiteral(v)))
      ));
    }
    
    if (screen.checks.hidden && screen.checks.hidden.length > 0) {
      checkProps.push(t.objectProperty(
        t.identifier('hidden'),
        t.arrayExpression(screen.checks.hidden.map(h => t.stringLiteral(h)))
      ));
    }
    
    if (screen.checks.text) {
      const textProps = Object.entries(screen.checks.text).map(([key, value]) =>
        t.objectProperty(t.identifier(key), t.stringLiteral(value))
      );
      checkProps.push(t.objectProperty(
        t.identifier('text'),
        t.objectExpression(textProps)
      ));
    }
    
    if (checkProps.length > 0) {
      props.push(t.objectProperty(
        t.identifier('checks'),
        t.objectExpression(checkProps)
      ));
    }
  }
  
  return t.objectExpression(props);
}

/**
 * Extract complete XState structure
 * Returns: { context, states, meta, transitions }
 */
function extractCompleteXStateConfig(content) {
  const result = {
    context: {},
    states: {},
    initial: null,
    meta: {}
  };
  
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
    traverse.default(ast, {
      ClassProperty(path) {
        if (path.node.key?.name === 'xstateConfig' && path.node.static) {
          const value = path.node.value;
          
          if (value?.type === 'ObjectExpression') {
            value.properties.forEach(prop => {
              const key = prop.key?.name;
              
              if (key === 'context' && prop.value?.type === 'ObjectExpression') {
                // Extract context
                prop.value.properties.forEach(contextProp => {
                  if (contextProp.key) {
                    const fieldName = contextProp.key.name;
                    const fieldValue = extractValueFromNode(contextProp.value);
                    result.context[fieldName] = fieldValue;
                  }
                });
              } else if (key === 'initial') {
                // Extract initial state
                result.initial = extractValueFromNode(prop.value);
              } else if (key === 'states' && prop.value?.type === 'ObjectExpression') {
                // Extract states (basic - just names for now)
                prop.value.properties.forEach(stateProp => {
                  if (stateProp.key) {
                    const stateName = stateProp.key.name;
                    result.states[stateName] = {
                      name: stateName,
                    };
                  }
                });
              } else if (key === 'meta' && prop.value?.type === 'ObjectExpression') {
                // Extract top-level meta
                prop.value.properties.forEach(metaProp => {
                  if (metaProp.key) {
                    const metaKey = metaProp.key.name;
                    const metaValue = extractValueFromNode(metaProp.value);
                    result.meta[metaKey] = metaValue;
                  }
                });
              }
            });
          }
        }
      },
    });
    
  } catch (error) {
    console.error('Error extracting complete XState config:', error.message);
  }
  
  return result;
}

function extractValueFromNode(node) {
  if (!node) return null;
  
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
      
    case 'NullLiteral':
      return null;
      
    case 'Identifier':
      if (node.name === 'undefined') return undefined;
      if (node.name === 'null') return null;
      return node.name;
      
    case 'ArrayExpression':
      return node.elements
        .map(el => extractValueFromNode(el))
        .filter(v => v !== null && v !== undefined);
      
    case 'ObjectExpression':
      const obj = {};
      node.properties.forEach(prop => {
        if (prop.key) {
          const key = prop.key.name || prop.key.value;
          const value = extractValueFromNode(prop.value);
          if (value !== undefined) {
            obj[key] = value;
          }
        }
      });
      return obj;
      
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return '<function>';
      
    case 'CallExpression':
      if (node.callee?.name === 'assign') {
        return '<assign>';
      }
      return '<call>';
      
    default:
      return null;
  }
}

// ✅ FIXED VERSION - Add Transition Endpoint
// Replace lines 1547-1676 in implications.js with this

router.post('/add-transition', async (req, res) => {
  try {
    const { sourceFile, targetFile, event } = req.body;
    
    console.log('➕ Adding transition:', { sourceFile, targetFile, event });
    
    // Validate inputs
    if (!sourceFile || !targetFile || !event) {
      return res.status(400).json({ 
        error: 'sourceFile, targetFile, and event are required' 
      });
    }
    
    const sourceContent = await fs.readFile(sourceFile, 'utf-8');

    const sourceAst = parse(sourceContent, {
      sourceType: 'module',
      plugins: ['classProperties', 'objectRestSpread'],
    });

    // Read target file to extract actual state ID
    const targetContent = await fs.readFile(targetFile, 'utf-8');
    const targetAst = parse(targetContent, {
      sourceType: 'module',
      plugins: ['classProperties', 'objectRestSpread']
    });

    let targetStateName = null;

    // Extract ID from target file's xstateConfig
    traverse.default(targetAst, {
      ClassProperty(path) {
        if (path.node.key?.name === 'xstateConfig' && path.node.static) {
          const config = path.node.value;
          if (config?.type === 'ObjectExpression') {
            const idProp = config.properties.find(p => p.key?.name === 'id');
            if (idProp?.value?.value) {
              targetStateName = idProp.value.value;
            }
          }
        }
      }
    });

    // Fallback: derive from filename
    if (!targetStateName) {
      targetStateName = path.basename(targetFile, '.js')
        .replace(/Implications$/, '')
        .replace(/Booking$/, '')
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    }

    console.log('🎯 Target state name:', targetStateName);
    
    let transitionAdded = false;
    
    // ✅ FIX: Navigate to states.idle.on instead of top-level on
    traverse.default(sourceAst, {
      ClassProperty(path) {
        if (path.node.key?.name === 'xstateConfig' && path.node.static) {
          const configValue = path.node.value;
          
          if (configValue?.type === 'ObjectExpression') {
            // ✅ Find 'states' property
            let statesProperty = configValue.properties.find(
              p => p.key?.name === 'states'
            );
            
            if (!statesProperty || statesProperty.value?.type !== 'ObjectExpression') {
              console.log('❌ No states property found');
              return;
            }
            
            // ✅ Find 'idle' state (or first state)
            let idleState = statesProperty.value.properties.find(
              p => p.key?.name === 'idle'
            );
            
            if (!idleState) {
              // Use first state if idle doesn't exist
              idleState = statesProperty.value.properties[0];
            }
            
            if (!idleState || idleState.value?.type !== 'ObjectExpression') {
              console.log('❌ No idle state found');
              return;
            }
            
            // ✅ Find or create 'on' property INSIDE idle state
            let onProperty = idleState.value.properties.find(
              p => p.key?.name === 'on'
            );
            
            if (!onProperty) {
              console.log('📝 Creating new "on" property inside idle state');
              onProperty = {
                type: 'ObjectProperty',
                key: { type: 'Identifier', name: 'on' },
                value: { type: 'ObjectExpression', properties: [] }
              };
              idleState.value.properties.push(onProperty);
            }
            
            // Check if transition already exists
            const existingTransition = onProperty.value.properties?.find(
              p => p.key?.name === event || p.key?.value === event
            );
            
            if (existingTransition) {
              console.log('⚠️ Transition already exists');
              return;
            }
            
            // ✅ Add new transition with proper target format
            console.log(`✅ Adding transition: ${event} → #${targetStateName}`);
            onProperty.value.properties.push({
              type: 'ObjectProperty',
              key: { type: 'Identifier', name: event },
              value: {
                type: 'ObjectExpression',
                properties: [
                  {
                    type: 'ObjectProperty',
                    key: { type: 'Identifier', name: 'target' },
                    value: { type: 'StringLiteral', value: `#${targetStateName}` }
                  }
                ]
              }
            });
            
            transitionAdded = true;
          }
        }
      }
    });
    
    if (!transitionAdded) {
      return res.status(400).json({ 
        error: 'Could not add transition - failed to modify xstateConfig.states.idle.on' 
      });
    }
    
    // Generate updated code
    const { code: newCode } = (babelGenerate.default || babelGenerate)(sourceAst, {
      retainLines: true,
      comments: true
    });
    
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${sourceFile}.backup-${timestamp}`;
    await fs.copy(sourceFile, backupPath);
    
    // Write updated file
    await fs.writeFile(sourceFile, newCode, 'utf-8');
    
    console.log('✅ Transition added successfully');
    console.log('📦 Backup:', backupPath);
    
    res.json({
      success: true,
      transition: {
        event,
        from: path.basename(sourceFile),
        to: `#${targetStateName}`
      },
      backup: backupPath
    });
    
  } catch (error) {
    console.error('❌ Add transition failed:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========================================
// POST /api/implications/add-context-field
// ========================================
router.post('/add-context-field', async (req, res) => {
  try {
    const { filePath, fieldName, initialValue, fieldType } = req.body;
    
    console.log('➕ Adding context field:', { filePath, fieldName, initialValue, fieldType });
    
    // Validation
    if (!filePath || !fieldName) {
      return res.status(400).json({ error: 'Missing required fields: filePath and fieldName' });
    }
    
    // Validate field name (must be valid JS identifier)
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(fieldName)) {
      return res.status(400).json({ 
        error: 'Invalid field name - must be valid JavaScript identifier' 
      });
    }
    
    // Reserved keywords
    const reserved = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'];
    if (reserved.includes(fieldName)) {
      return res.status(400).json({ error: `"${fieldName}" is a reserved JavaScript keyword` });
    }
    
    // Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse AST
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['classProperties', 'classStaticBlock']
    });
    
    let contextFound = false;
    let fieldAdded = false;
    
    // Find xstateConfig.context and add field
    traverse.default(ast, {
      ClassProperty(path) {
        if (path.node.static && path.node.key.name === 'xstateConfig') {
          console.log('✅ Found xstateConfig');
          
          // Find context property
          let contextProp = path.node.value.properties.find(
            p => (p.key?.name === 'context' || p.key?.value === 'context')
          );
          
          if (!contextProp) {
            console.log('⚠️ No context property found, creating one');
            // Create context if it doesn't exist
            contextProp = {
              type: 'ObjectProperty',
              key: { type: 'Identifier', name: 'context' },
              value: { type: 'ObjectExpression', properties: [] }
            };
            // Add context as first property
            path.node.value.properties.unshift(contextProp);
          }
          
          contextFound = true;
          
          // Check if field already exists
          const existingField = contextProp.value.properties.find(
            p => (p.key?.name === fieldName || p.key?.value === fieldName)
          );
          
          if (existingField) {
            throw new Error(`Field "${fieldName}" already exists in context`);
          }
          
          // Add new field
          contextProp.value.properties.push({
            type: 'ObjectProperty',
            key: { type: 'Identifier', name: fieldName },
            value: createValueNode(initialValue)
          });
          
          console.log('✅ Field added to AST');
          fieldAdded = true;
        }
      }
    });
    
    if (!contextFound) {
      return res.status(400).json({ 
        error: 'No xstateConfig found in file',
        hint: 'Make sure the file contains a class with static xstateConfig property'
      });
    }
    
    if (!fieldAdded) {
      return res.status(500).json({ error: 'Failed to add field to AST' });
    }
    
    // Generate code
    const output = babelGenerate.default(ast, {
      retainLines: true,
      comments: true
    }, content);
    
    console.log('✅ Code generated');
    
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;
    await fs.writeFile(backupPath, content);
    console.log('✅ Backup created:', backupPath);
    
    // Write updated file
    await fs.writeFile(filePath, output.code);
    console.log('✅ File written');
    
    res.json({ 
      success: true, 
      backup: backupPath,
      message: `Field "${fieldName}" added to context`
    });
    
  } catch (error) {
    console.error('❌ Add context field error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========================================
// POST /api/implications/delete-context-field
// ========================================
router.post('/delete-context-field', async (req, res) => {
  try {
    const { filePath, fieldName } = req.body;
    
    console.log('🗑️ Deleting context field:', { filePath, fieldName });
    
    if (!filePath || !fieldName) {
      return res.status(400).json({ error: 'Missing required fields: filePath and fieldName' });
    }
    
    // Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse AST
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['classProperties', 'classStaticBlock']
    });
    
    let fieldDeleted = false;
    
    // Find and remove field from context
    traverse.default(ast, {
      ClassProperty(path) {
        if (path.node.static && path.node.key.name === 'xstateConfig') {
          const contextProp = path.node.value.properties.find(
            p => (p.key?.name === 'context' || p.key?.value === 'context')
          );
          
          if (contextProp && contextProp.value.type === 'ObjectExpression') {
            const fieldIndex = contextProp.value.properties.findIndex(
              p => (p.key?.name === fieldName || p.key?.value === fieldName)
            );
            
            if (fieldIndex !== -1) {
              contextProp.value.properties.splice(fieldIndex, 1);
              fieldDeleted = true;
              console.log('✅ Field removed from AST');
            }
          }
        }
      }
    });
    
    if (!fieldDeleted) {
      return res.status(404).json({ 
        error: `Field "${fieldName}" not found in context`
      });
    }
    
    // Generate code
    const output = babelGenerate.default(ast, {
      retainLines: true,
      comments: true
    }, content);
    
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;
    await fs.writeFile(backupPath, content);
    console.log('✅ Backup created:', backupPath);
    
    // Write updated file
    await fs.writeFile(filePath, output.code);
    console.log('✅ File written');
    
    res.json({ 
      success: true, 
      backup: backupPath,
      message: `Field "${fieldName}" deleted from context`
    });
    
  } catch (error) {
    console.error('❌ Delete context field error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========================================
// GET /api/implications/extract-mirrorson-variables
// ========================================
router.get('/extract-mirrorson-variables', async (req, res) => {
  try {
    const { filePath } = req.query;
    
    console.log('💡 Extracting mirrorsOn variables from:', filePath);
    
    if (!filePath) {
      return res.status(400).json({ error: 'Missing filePath parameter' });
    }
    
    // Read and parse file
    const content = await fs.readFile(filePath, 'utf-8');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['classProperties', 'classStaticBlock']
    });
    
    let contextFields = [];
    let mirrorsOnVariables = new Set();
    
    // Extract context and mirrorsOn
    traverse.default(ast, {
      ClassProperty(path) {
        // Get context fields
        if (path.node.static && path.node.key.name === 'xstateConfig') {
          const contextProp = path.node.value.properties.find(
            p => (p.key?.name === 'context' || p.key?.value === 'context')
          );
          
          if (contextProp && contextProp.value.type === 'ObjectExpression') {
            contextFields = contextProp.value.properties.map(
              p => p.key.name || p.key.value
            );
          }
        }
        
        // Extract from mirrorsOn
        if (path.node.static && path.node.key.name === 'mirrorsOn') {
          // Traverse the entire mirrorsOn object
          traverse.default(path.node.value, {
            TemplateLiteral(tPath) {
              // Find {{variable}} patterns in template literals
              tPath.node.quasis.forEach(quasi => {
                const text = quasi.value.cooked || quasi.value.raw;
                const matches = text.matchAll(/\{\{(\w+)\}\}/g);
                for (const match of matches) {
                  mirrorsOnVariables.add(match[1]);
                }
              });
            },
            StringLiteral(tPath) {
              // Also check string literals for {{variable}} patterns
              const matches = tPath.node.value.matchAll(/\{\{(\w+)\}\}/g);
              for (const match of matches) {
                mirrorsOnVariables.add(match[1]);
              }
            }
          }, path.scope, path);
        }
      }
    });
    
    // Find missing fields (in mirrorsOn but not in context)
    const missingFromContext = Array.from(mirrorsOnVariables)
      .filter(v => !contextFields.includes(v));
    
    console.log('✅ Extracted:', {
      contextFields: contextFields.length,
      mirrorsOnVariables: mirrorsOnVariables.size,
      missingFromContext: missingFromContext.length
    });
    
    res.json({
      contextFields,
      mirrorsOnVariables: Array.from(mirrorsOnVariables),
      missingFromContext
    });
    
  } catch (error) {
    console.error('❌ Extract mirrorsOn variables error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================
// COMPLETE BACKEND ENDPOINT FOR CONTEXT
// Add to: packages/api-server/src/routes/implications.js
// Location: BEFORE "export default router;"
// ============================================

// Make sure these imports are at the top of your file:
// import * as t from '@babel/types';
// import * as babelGenerate from '@babel/generator';

/**
 * GET /api/implications/context-schema
 * Extract context fields from an xstate implication file
 */
router.get('/context-schema', async (req, res) => {
  try {
    const { filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }
    
    console.log(`📋 Extracting context schema from: ${filePath}`);
    
    // Read the file
    const originalContent = await fs.readFile(filePath, 'utf-8');
    
    // Extract complete xstate config
    const xstateConfig = extractCompleteXStateConfig(originalContent);
    
    // Detect types for each context field
    const contextWithTypes = {};
    
    Object.entries(xstateConfig.context).forEach(([fieldName, value]) => {
      contextWithTypes[fieldName] = {
        value,
        type: detectFieldType(value),
        editable: true
      };
    });
    
    console.log(`✅ Extracted ${Object.keys(contextWithTypes).length} context fields:`, xstateConfig.context);
    
    res.json({
      success: true,
      context: xstateConfig.context,
      contextWithTypes,
      initial: xstateConfig.initial,
      states: Object.keys(xstateConfig.states)
    });
    
  } catch (error) {
    console.error('❌ Failed to extract context schema:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post('/add-context-field', async (req, res) => {
  const { filePath, fieldName, initialValue, fieldType } = req.body;
  
  console.log('➕ Adding context field:', { filePath, fieldName, fieldType });
  
  if (!filePath || !fieldName) {
    return res.status(400).json({ 
      success: false, 
      error: 'filePath and fieldName are required' 
    });
  }
  
  try {
    // 1. Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 2. Parse to AST
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread']
    });
    
    // 3. Find and update xstateConfig.context
    let contextUpdated = false;
    
    traverse.default(ast, {
      ClassProperty(path) {
        const node = path.node;
        
        // Find: static xstateConfig = { ... }
        if (
          node.static &&
          node.key.name === 'xstateConfig' &&
          t.isObjectExpression(node.value)
        ) {
          // Find context property
          const contextProp = node.value.properties.find(
            prop => prop.key && prop.key.name === 'context'
          );
          
          if (contextProp && t.isObjectExpression(contextProp.value)) {
            // Check if field already exists
            const existingField = contextProp.value.properties.find(
              prop => prop.key && prop.key.name === fieldName
            );
            
            if (existingField) {
              throw new Error(`Field "${fieldName}" already exists in context`);
            }
            
            // Add new field
            const newProperty = t.objectProperty(
              t.identifier(fieldName),
              createValueNode(initialValue)
            );
            
            contextProp.value.properties.push(newProperty);
            contextUpdated = true;
            
            console.log(`✅ Added field "${fieldName}" to context`);
          } else {
            // Context doesn't exist, create it
            node.value.properties.push(
              t.objectProperty(
                t.identifier('context'),
                t.objectExpression([
                  t.objectProperty(
                    t.identifier(fieldName),
                    createValueNode(initialValue)
                  )
                ])
              )
            );
            contextUpdated = true;
            
            console.log(`✅ Created context with field "${fieldName}"`);
          }
        }
      }
    });
    
    if (!contextUpdated) {
      return res.status(404).json({
        success: false,
        error: 'Could not find xstateConfig in file'
      });
    }
    
    // 4. Generate updated code
    const output = babelGenerate.default(ast, {
      retainLines: true,
      retainFunctionParens: true
    }, content);
    
    // 5. Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;
    await fs.writeFile(backupPath, content);
    
    // 6. Write updated file
    await fs.writeFile(filePath, output.code);
    
    console.log('✅ Context field added successfully');
    
    res.json({
      success: true,
      fieldName,
      initialValue,
      backup: backupPath
    });
    
  } catch (error) {
    console.error('❌ Error adding context field:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 2. DELETE CONTEXT FIELD
// ============================================

router.post('/delete-context-field', async (req, res) => {
  const { filePath, fieldName } = req.body;
  
  console.log('🗑️ Deleting context field:', { filePath, fieldName });
  
  if (!filePath || !fieldName) {
    return res.status(400).json({ 
      success: false, 
      error: 'filePath and fieldName are required' 
    });
  }
  
  try {
    // 1. Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 2. Parse to AST
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread']
    });
    
    // 3. Find and remove from xstateConfig.context
    let contextUpdated = false;
    
    traverse.default(ast, {
      ClassProperty(path) {
        const node = path.node;
        
        // Find: static xstateConfig = { ... }
        if (
          node.static &&
          node.key.name === 'xstateConfig' &&
          t.isObjectExpression(node.value)
        ) {
          // Find context property
          const contextProp = node.value.properties.find(
            prop => prop.key && prop.key.name === 'context'
          );
          
          if (contextProp && t.isObjectExpression(contextProp.value)) {
            // Find and remove field
            const fieldIndex = contextProp.value.properties.findIndex(
              prop => prop.key && prop.key.name === fieldName
            );
            
            if (fieldIndex === -1) {
              throw new Error(`Field "${fieldName}" not found in context`);
            }
            
            contextProp.value.properties.splice(fieldIndex, 1);
            contextUpdated = true;
            
            console.log(`✅ Removed field "${fieldName}" from context`);
          }
        }
      }
    });
    
    if (!contextUpdated) {
      return res.status(404).json({
        success: false,
        error: 'Could not find field in xstateConfig.context'
      });
    }
    
    // 4. Generate updated code
    const output = babelGenerate.default(ast, {
      retainLines: true,
      retainFunctionParens: true
    }, content);
    
    // 5. Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;
    await fs.writeFile(backupPath, content);
    
    // 6. Write updated file
    await fs.writeFile(filePath, output.code);
    
    console.log('✅ Context field deleted successfully');
    
    res.json({
      success: true,
      fieldName,
      backup: backupPath
    });
    
  } catch (error) {
    console.error('❌ Error deleting context field:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 3. EXTRACT MIRRORSON VARIABLES
// ============================================

router.get('/extract-mirrorson-variables', async (req, res) => {
  const { filePath } = req.query;
  
  console.log('🔍 Extracting mirrorsOn variables from:', filePath);
  
  if (!filePath) {
    return res.status(400).json({ 
      success: false, 
      error: 'filePath is required' 
    });
  }
  
  try {
    // 1. Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 2. Parse to AST
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread']
    });
    
    // 3. Find mirrorsOn and extract variables
    const variables = new Set();
    let contextFields = {};
    
    traverse.default(ast, {
      ClassProperty(path) {
        const node = path.node;
        
        // Find mirrorsOn
        if (node.static && node.key.name === 'mirrorsOn') {
          // Convert to JSON to search for {{variable}} patterns
          const code = babelGenerate.default(node.value).code;
          
          // Match {{variableName}} patterns
          const matches = code.matchAll(/\{\{(\w+)\}\}/g);
          for (const match of matches) {
            variables.add(match[1]);
          }
        }
        
        // Also get existing context fields
        if (
          node.static &&
          node.key.name === 'xstateConfig' &&
          t.isObjectExpression(node.value)
        ) {
          const contextProp = node.value.properties.find(
            prop => prop.key && prop.key.name === 'context'
          );
          
          if (contextProp && t.isObjectExpression(contextProp.value)) {
            contextProp.value.properties.forEach(prop => {
              if (prop.key) {
                contextFields[prop.key.name] = true;
              }
            });
          }
        }
      }
    });
    
    // 4. Filter out variables that already exist in context
    const missingVariables = Array.from(variables).filter(
      varName => !contextFields[varName]
    );
    
    console.log('📋 Found variables:', Array.from(variables));
    console.log('📦 Existing context fields:', Object.keys(contextFields));
    console.log('⚠️ Missing variables:', missingVariables);
    
    res.json({
      success: true,
      allVariables: Array.from(variables),
      existingInContext: Object.keys(contextFields),
      missingFromContext: missingVariables.map(name => ({
        name,
        reason: `Used in mirrorsOn checks but not in context`,
        from: 'mirrorsOn'
      }))
    });
    
  } catch (error) {
    console.error('❌ Error extracting mirrorsOn variables:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/**
 * POST /api/implications/update-context
 * Update context field values in an xstate implication file
 */
router.post('/update-context', async (req, res) => {
  try {
    const { filePath, contextUpdates } = req.body;
    
    console.log('💾 Updating context in:', filePath);
    console.log('📝 Updates:', contextUpdates);
    
    // ✅ Read file - keep 'content' in scope
    const content = await fs.readFile(filePath, 'utf-8');
    
    // ✅ Parse with Babel - 'content' is available here
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['classProperties', 'objectRestSpread'],
    });
    
    let contextFound = false;
    
    // Traverse AST and update context fields
    traverse.default(ast, {
      ClassProperty(path) {
        if (path.node.key?.name === 'xstateConfig' && path.node.static) {
          const configValue = path.node.value;
          
          if (configValue?.type === 'ObjectExpression') {
            // Find context property
            const contextProperty = configValue.properties.find(
              p => p.key?.name === 'context'
            );
            
            if (contextProperty?.value?.type === 'ObjectExpression') {
              contextFound = true;
              
              // Update each field
              Object.entries(contextUpdates).forEach(([key, value]) => {
                const field = contextProperty.value.properties.find(
                  p => p.key?.name === key
                );
                
                if (field) {
                  // Update existing field
                  field.value = createValueNode(value);
                  console.log(`  ✓ Updated ${key}: ${JSON.stringify(value)}`);
                } else {
                  // Add new field
                  contextProperty.value.properties.push({
                    type: 'ObjectProperty',
                    key: { type: 'Identifier', name: key },
                    value: createValueNode(value)
                  });
                  console.log(`  ✓ Added ${key}: ${JSON.stringify(value)}`);
                }
              });
            }
          }
        }
      }
    });
    
    if (!contextFound) {
      return res.status(400).json({ error: 'No context found in xstateConfig' });
    }
    
    // Generate updated code
    const { code: newCode } = (babelGenerate.default || babelGenerate)(ast, {
      retainLines: true,
      comments: true
    });
    
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;
    await fs.copy(filePath, backupPath);
    
    // Write updated file
    await fs.writeFile(filePath, newCode, 'utf-8');
    
    console.log('✅ Context updated successfully');
    console.log('📦 Backup created:', backupPath);
    
    res.json({
      success: true,
      updated: Object.keys(contextUpdates),
      backup: backupPath
    });
    
  } catch (error) {
    console.error('❌ Update context failed:', error);
    res.status(500).json({ error: error.message });
  }
});


/**
 * Detect the type of a value for proper input rendering
 */
function detectFieldType(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

/**
 * Create a Babel AST node from a JavaScript value
 */
function createValueNode(value) {
  if (value === null) {
    return t.nullLiteral();
  }
  
  if (value === undefined) {
    return t.identifier('undefined');
  }
  
  if (typeof value === 'boolean') {
    return t.booleanLiteral(value);
  }
  
  if (typeof value === 'number') {
    return t.numericLiteral(value);
  }
  
  if (typeof value === 'string') {
    return t.stringLiteral(value);
  }
  
  if (Array.isArray(value)) {
    return t.arrayExpression(
      value.map(item => createValueNode(item))
    );
  }
  
  if (typeof value === 'object') {
    const properties = Object.entries(value).map(([key, val]) =>
      t.objectProperty(
        t.identifier(key),
        createValueNode(val)
      )
    );
    return t.objectExpression(properties);
  }
  
  // Fallback
  return t.stringLiteral(String(value));
}

/**
 * Extract JavaScript value from AST node
 */
function extractValueFromAST(node) {
  if (!node) return null;
  
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
      
    case 'NullLiteral':
      return null;
      
    case 'Identifier':
      if (node.name === 'undefined') return undefined;
      if (node.name === 'null') return null;
      return node.name;
      
    case 'ArrayExpression':
      return node.elements
        .filter(el => el !== null)
        .map(el => extractValueFromAST(el));
      
    case 'ObjectExpression':
      const obj = {};
      node.properties.forEach(prop => {
        if (prop.key) {
          const key = prop.key.name || prop.key.value;
          const value = extractValueFromAST(prop.value);
          if (value !== undefined) {
            obj[key] = value;
          }
        }
      });
      return obj;
      
    case 'TemplateLiteral':
      if (node.quasis && node.quasis.length === 1 && node.expressions.length === 0) {
        return node.quasis[0].value.cooked;
      }
      return null;
      
    default:
      return null;
  }
}

export default router;