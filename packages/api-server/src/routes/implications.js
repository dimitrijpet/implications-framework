import express from 'express';
import path from 'path';
import nodePath from 'path';
import fs from 'fs-extra';
import * as parser from '@babel/parser';
import { parse } from '@babel/parser';
import babelGenerate from '@babel/generator';
import babelTraverse from '@babel/traverse';  // ← CHANGE
import * as t from '@babel/types';
import Handlebars from 'handlebars';
import { glob } from 'glob';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import CompositionAnalyzer from '../services/CompositionAnalyzer.js';
import CompositionRewriter from '../services/CompositionRewriter.js';
import { extractUIImplications } from '../services/astParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ← ADD THIS
const traverse = babelTraverse.default || babelTraverse;

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
    
    traverse(ast, {
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
    
    traverse(ast, {
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

/**
 * POST /api/implications/update-composition
 * 
 * Update composition patterns in an Implication file
 * 
 * Body:
 * {
 *   filePath: "/absolute/path/to/AcceptedBookingImplications.js",
 *   config: {
 *     baseClass: "BaseBookingImplications",  // or null to remove
 *     behaviors: ["NotificationsImplications"]
 *   },
 *   preview: false  // Set true to preview without writing
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   backupPath: "/path/.backups/file.backup",
 *   changes: { ... },
 *   preview?: { ... }  // If preview mode
 * }
 */
router.post('/update-composition', async (req, res) => {
  console.log('📝 POST /update-composition', req.body);
  
  try {
    const { filePath, config, preview = false } = req.body;
    
    // Validation
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
    }
    
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'config is required'
      });
    }
    
    // Validate file exists and has correct structure
    const rewriter = new CompositionRewriter();
    const validation = await rewriter.validateFile(filePath);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: `Invalid Implication file: ${validation.error}`
      });
    }
    
    // Validate base class exists (if specified)
    if (config.baseClass && config.baseClass !== 'None') {
      const availableBaseClasses = await rewriter.getAvailableBaseClasses(filePath);
      if (!availableBaseClasses.includes(config.baseClass)) {
        return res.status(400).json({
          success: false,
          error: `Base class "${config.baseClass}" not found. Available: ${availableBaseClasses.join(', ')}`
        });
      }
    }
    
    // Validate behaviors exist (if specified)
    if (config.behaviors && config.behaviors.length > 0) {
      const availableBehaviors = await rewriter.getAvailableBehaviors(filePath);
      const invalidBehaviors = config.behaviors.filter(b => !availableBehaviors.includes(b));
      
      if (invalidBehaviors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Behaviors not found: ${invalidBehaviors.join(', ')}. Available: ${availableBehaviors.join(', ')}`
        });
      }
    }
    
    // Perform rewrite
    const result = await rewriter.rewrite(filePath, config, preview);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    // Success!
    console.log('✅ Composition updated successfully');
    return res.json(result);
    
  } catch (error) {
    console.error('❌ Error updating composition:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/implications/available-compositions
 * 
 * Get available base classes and behaviors for a given Implication file
 * 
 * Query:
 * - filePath: Path to Implication file
 * 
 * Response:
 * {
 *   success: true,
 *   baseClasses: ["BaseBookingImplications", "BaseDancerImplications"],
 *   behaviors: ["NotificationsImplications", "EmailImplications"]
 * }
 */
router.get('/available-compositions', async (req, res) => {
  try {
    const { filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
    }
    
    const rewriter = new CompositionRewriter();
    
    const [baseClasses, behaviors] = await Promise.all([
      rewriter.getAvailableBaseClasses(filePath),
      rewriter.getAvailableBehaviors(filePath)
    ]);
    
    return res.json({
      success: true,
      baseClasses,
      behaviors
    });
    
  } catch (error) {
    console.error('❌ Error getting available compositions:', error);
    return res.status(500).json({
      success: false,
      error: error.message
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

    traverse(ast, {
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
    traverse(ast, {
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
    const className = path.basename(filePath, '.js');

const newUINode = buildSmartUIAst(uiData, originalUINode, originalContent, className);
    
    // Second pass: Replace UI node
    traverse(ast, {
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
function buildSmartUIAst(newData, originalUINode, originalContent, className) {
  const platformProps = [];
  
  // For each platform in new data
  for (const [platformName, platformData] of Object.entries(newData)) {
    // Find original platform node
    const originalPlatformProp = originalUINode.properties.find(
      p => p.key?.name === platformName
    );
    
    let platformScreenProps;
    
      if (originalPlatformProp && t.isObjectExpression(originalPlatformProp.value)) {
      // ✅ CONVERT: screens object → array with screenName property
      const screensArray = Object.entries(platformData.screens || {}).map(([screenName, screenData]) => ({
        ...screenData,
        screenName: screenName  // ← Add the name!
      }));
      
      console.log(`  📋 Platform ${platformName}: converted ${Object.keys(platformData.screens || {}).length} screens to array`);
      
      // Platform exists in original - preserve what we can
      platformScreenProps = buildSmartScreenProps(
      screensArray,
      originalPlatformProp.value,
      originalContent,
      platformName,  // ← Add this
      className      // ← Add this
    );
    } else {
      // New platform - build from scratch
      const screensArray = Object.entries(platformData.screens || {}).map(([screenName, screenData]) => ({
        ...screenData,
        screenName: screenName
      }));
      
      platformScreenProps = buildScreenPropsFromData(screensArray);
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
function buildSmartScreenProps(newScreens, originalPlatformNode, originalContent, platformName, className) {
  // ✅ First, get ALL original screen names
  const originalScreenNames = originalPlatformNode.properties.map(p => p.key?.name).filter(Boolean);
  
  // ✅ Build a map of new screens by name
  const newScreensMap = {};
  newScreens.forEach(screen => {
    const key = screen.screenName || screen.originalName || screen.name;
    if (!newScreensMap[key]) {
      newScreensMap[key] = [];
    }
    newScreensMap[key].push(screen);
  });
  
  console.log(`    📊 Original screens: ${originalScreenNames.length}, New screens: ${Object.keys(newScreensMap).length}`);
  
  const screenProps = [];
  
  // ✅ Process ALL original screens (preserve those not in update)
  for (const screenName of originalScreenNames) {
    const originalScreenProp = originalPlatformNode.properties.find(
      p => p.key?.name === screenName
    );
    
    if (!originalScreenProp) continue;
    
    let screenArrayNode;
    
    // Check if this screen is in the update
   // Check if this screen is in the update
    if (newScreensMap[screenName]) {
      // ✅ Screen is being updated - check for changes
      const screens = newScreensMap[screenName];
      
      if (t.isArrayExpression(originalScreenProp.value)) {
        const comparisonResult = screensHaveChanges(screens, originalScreenProp.value);
        
        if (!comparisonResult.hasChanges) {
          // ✅ NO CHANGES - Use original AST (preserves mergeWithBase!)
          console.log(`  ✨ Preserving original AST for ${screenName}`);
          screenArrayNode = originalScreenProp.value;
        } else {
          // ❌ HAS CHANGES - Generate new AST with preserved functions
          console.log(`  🔧 Regenerating AST for ${screenName} (modified)`);
          screenArrayNode = t.arrayExpression(
            screens.map(screen => {
              // ✨ Attach original functions to screen data
              if (comparisonResult.originalFunctions.prerequisites) {
                screen._originalPrerequisites = comparisonResult.originalFunctions.prerequisites;
              }
              if (comparisonResult.originalFunctions.expect) {
                screen._originalExpect = comparisonResult.originalFunctions.expect;
              }
              return buildScreenAst(screen, screenName, platformName, className);
            })
          );
        }
      } else {
        // New screen - build from scratch
        screenArrayNode = t.arrayExpression(
          screens.map(screen => buildScreenAst(screen, screenName, platformName, className))
        );
      }
      
      // Remove from map so we know it's processed
      delete newScreensMap[screenName];
    } else {
      // ✅ Screen NOT in update - preserve original completely!
      console.log(`  ♻️ Preserving untouched screen: ${screenName}`);
      screenArrayNode = originalScreenProp.value;
    }
    
    screenProps.push(
      t.objectProperty(
        t.identifier(screenName),
        screenArrayNode
      )
    );
  }
  
  // ✅ Add any NEW screens that weren't in original
  for (const [screenName, screens] of Object.entries(newScreensMap)) {
    console.log(`  ➕ Adding new screen: ${screenName}`);
    screenProps.push(
      t.objectProperty(
        t.identifier(screenName),
        t.arrayExpression(screens.map(screen => buildScreenAst(screen, screenName, platformName, className)))
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
    console.log('    📊 Length changed:', newScreens.length, 'vs', originalArrayNode.elements.length);
    return { hasChanges: true, originalFunctions: {} };
  }
  
  // Track original function nodes
  let originalFunctions = {};
  
  // Deep check: compare each screen's data
  for (let i = 0; i < newScreens.length; i++) {
    const newScreen = newScreens[i];
    const originalElement = originalArrayNode.elements[i];
    
    if (!originalElement) {
      return { hasChanges: true, originalFunctions: {} };
    }
    
    // Check if original is mergeWithBase call
    if (originalElement.type === 'CallExpression' &&
        originalElement.callee?.type === 'MemberExpression' &&
        originalElement.callee.object?.name === 'ImplicationHelper' &&
        originalElement.callee.property?.name === 'mergeWithBase') {
      
      console.log('    🔍 Original is mergeWithBase, extracting child overrides...');
      
      // Extract child overrides from mergeWithBase (2nd argument)
      const overridesArg = originalElement.arguments[1];
      if (!overridesArg || overridesArg.type !== 'ObjectExpression') {
        console.log('    ⚠️ Could not extract overrides, assuming changed');
        return { hasChanges: true, originalFunctions: {} };
      }
      
      // ✨ NEW: Extract prerequisites and expect nodes
      const originalOverrides = extractScreenDataFromAst(overridesArg);
      
      // Extract function nodes
      overridesArg.properties.forEach(prop => {
        if (prop.key?.name === 'prerequisites') {
          originalFunctions.prerequisites = prop.value;
          console.log('    📦 Preserved prerequisites function');
        } else if (prop.key?.name === 'expect') {
          originalFunctions.expect = prop.value;
          console.log('    📦 Preserved expect function');
        }
      });
      
      // Compare new data with original overrides (not merged result!)
      if (!screensMatch(newScreen, originalOverrides)) {
        console.log('    🔧 Child overrides changed!');
        console.log('       Original:', JSON.stringify(originalOverrides, null, 2));
        console.log('       New:', JSON.stringify(newScreen, null, 2));
        return { hasChanges: true, originalFunctions };
      }
      
      console.log('    ✨ Child overrides match! Preserving mergeWithBase');
    } else if (originalElement.type === 'ObjectExpression') {
      // Direct object - compare as before
      const originalData = extractScreenDataFromAst(originalElement);
      
      // ✨ NEW: Extract function nodes from direct object too
      originalElement.properties.forEach(prop => {
        if (prop.key?.name === 'prerequisites') {
          originalFunctions.prerequisites = prop.value;
        } else if (prop.key?.name === 'expect') {
          originalFunctions.expect = prop.value;
        }
      });
      
      if (!screensMatch(newScreen, originalData)) {
        console.log('    🔧 Screen data changed');
        return { hasChanges: true, originalFunctions };
      }
    } else {
      // Unknown type - assume changed
      console.log('    ⚠️ Unknown original type:', originalElement.type);
      return { hasChanges: true, originalFunctions: {} };
    }
  }
  
  console.log('    ✅ No changes detected');
  return { hasChanges: false, originalFunctions };  // No changes detected
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
function screensMatch(screen1, screen2) {
  const clean1 = stripMetadata(screen1);
  const clean2 = stripMetadata(screen2);
  
  // Deep comparison instead of JSON.stringify
  return deepEqual(clean1, clean2);
}

function deepEqual(obj1, obj2) {
  // Handle null/undefined
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
  
  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    return obj1.every((item, i) => deepEqual(item, obj2[i]));
  }
  
  // Handle arrays vs objects mismatch
  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
  
  // Handle objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => {
    if (!keys2.includes(key)) return false;
    return deepEqual(obj1[key], obj2[key]);
  });
}

function stripMetadata(screen) {
  const { screenName, sourceInfo, alwaysVisible, sometimesVisible, functions, ...cleanScreen } = screen;
  
  // Also strip empty arrays from checks
  if (cleanScreen.checks) {
    const cleanChecks = { ...cleanScreen.checks };
    if (cleanChecks.visible?.length === 0) delete cleanChecks.visible;
    if (cleanChecks.hidden?.length === 0) delete cleanChecks.hidden;
    if (Object.keys(cleanChecks.text || {}).length === 0) delete cleanChecks.text;
    cleanScreen.checks = cleanChecks;
  }
  
  // Strip empty arrays
  if (cleanScreen.visible?.length === 0) delete cleanScreen.visible;
  if (cleanScreen.hidden?.length === 0) delete cleanScreen.hidden;
  
  return cleanScreen;
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
    // ✅ FIXED: Check screenName first!
    const key = screen.screenName || screen.originalName || screen.name;
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
  
  // ✨ NEW: POM screen property
  if (screen.screen) {
    props.push(t.objectProperty(
      t.identifier('screen'),
      t.stringLiteral(screen.screen)
    ));
  }
  
  // ✨ NEW: POM instance property (optional)
  if (screen.instance) {
    props.push(t.objectProperty(
      t.identifier('instance'),
      t.stringLiteral(screen.instance)
    ));
  }
  
  // ✨ NEW: Functions object
  if (screen.functions && Object.keys(screen.functions).length > 0) {
    const functionProps = [];
    
    for (const [funcName, funcData] of Object.entries(screen.functions)) {
      const funcObjectProps = [];
      
      // type
      if (funcData.type) {
        funcObjectProps.push(t.objectProperty(
          t.identifier('type'),
          t.stringLiteral(funcData.type)
        ));
      }
      
      // name
      if (funcData.name) {
        funcObjectProps.push(t.objectProperty(
          t.identifier('name'),
          t.stringLiteral(funcData.name)
        ));
      }
      
      // signature
      if (funcData.signature) {
        funcObjectProps.push(t.objectProperty(
          t.identifier('signature'),
          t.stringLiteral(funcData.signature)
        ));
      }
      
      // parameters object
      if (funcData.parameters && Object.keys(funcData.parameters).length > 0) {
        const paramProps = Object.entries(funcData.parameters).map(([key, value]) =>
          t.objectProperty(
            t.identifier(key),
            t.stringLiteral(String(value))
          )
        );
        
        funcObjectProps.push(t.objectProperty(
          t.identifier('parameters'),
          t.objectExpression(paramProps)
        ));
      }
      
      functionProps.push(t.objectProperty(
        t.identifier(funcName),
        t.objectExpression(funcObjectProps)
      ));
    }
    
    props.push(t.objectProperty(
      t.identifier('functions'),
      t.objectExpression(functionProps)
    ));
  }
  
  return t.objectExpression(props);
}
/**
 * Helper: Build AST for UI data
 */
function buildUIAst(uiData, className) {
  const platformProps = Object.entries(uiData).map(([platformName, platformData]) => {
    const screenEntries = Object.entries(platformData.screens);
    
    const screenProps = screenEntries.map(([screenName, screenArray]) => {
      // Each screen is wrapped in an array
      const wrappedScreens = t.arrayExpression(
        screenArray.map(screen => buildScreenAst(screen, screenName, platformName, className))
      );
      
      return t.objectProperty(
        t.identifier(screenName),
        wrappedScreens
      );
    });
    
    return t.objectProperty(
      t.identifier(platformName),
      t.objectExpression(screenProps)
    );
  });
  
  return t.objectExpression([
    t.objectProperty(
      t.identifier('UI'),
      t.objectExpression(platformProps)
    )
  ]);
}

/**
 * Helper: Build AST for screen object
 */
function buildScreenAst(screen, screenName, platformName, className) {
  const overrideProps = [];
  
  // description (always include if present)
  if (screen.description) {
    overrideProps.push(t.objectProperty(
      t.identifier('description'), 
      t.stringLiteral(screen.description)
    ));
  }
  
  // visible (only if has child elements)
  if (screen.visible && screen.visible.length > 0) {
    overrideProps.push(t.objectProperty(
      t.identifier('visible'),
      t.arrayExpression(screen.visible.map(v => t.stringLiteral(v)))
    ));
  }
  
  // hidden (only if has child elements)
  if (screen.hidden && screen.hidden.length > 0) {
    overrideProps.push(t.objectProperty(
      t.identifier('hidden'),
      t.arrayExpression(screen.hidden.map(h => t.stringLiteral(h)))
    ));
  }
  
  // checks
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
    
    if (screen.checks.text && Object.keys(screen.checks.text).length > 0) {
      const textProps = Object.entries(screen.checks.text).map(([key, value]) =>
        t.objectProperty(t.identifier(key), t.stringLiteral(value))
      );
      checkProps.push(t.objectProperty(
        t.identifier('text'),
        t.objectExpression(textProps)
      ));
    }
    
    if (checkProps.length > 0) {
      overrideProps.push(t.objectProperty(
        t.identifier('checks'),
        t.objectExpression(checkProps)
      ));
    }
  }
  
   // ✅ ADD THIS: Functions
  if (screen.functions && Object.keys(screen.functions).length > 0) {
    const functionProps = [];
    
    for (const [funcName, funcData] of Object.entries(screen.functions)) {
      const funcObjectProps = [];
      
      // signature
      if (funcData.signature) {
        funcObjectProps.push(t.objectProperty(
          t.identifier('signature'),
          t.stringLiteral(funcData.signature)
        ));
      }
      
      // parameters object
      if (funcData.parameters && Object.keys(funcData.parameters).length > 0) {
        const paramProps = Object.entries(funcData.parameters).map(([key, value]) =>
          t.objectProperty(
            t.identifier(key),
            t.stringLiteral(String(value))
          )
        );
        
        funcObjectProps.push(t.objectProperty(
          t.identifier('parameters'),
          t.objectExpression(paramProps)
        ));
      }
      
      functionProps.push(t.objectProperty(
        t.identifier(funcName),
        t.objectExpression(funcObjectProps)
      ));
    }
    
    overrideProps.push(t.objectProperty(
      t.identifier('functions'),
      t.objectExpression(functionProps)
    ));
    
    console.log(`    ✨ Including functions for ${screenName}:`, Object.keys(screen.functions));
  }
  // ✨ NEW: prerequisites (preserved from original AST)
  if (screen._originalPrerequisites) {
    console.log('    📦 Including preserved prerequisites');
    overrideProps.push(t.objectProperty(
      t.identifier('prerequisites'),
      screen._originalPrerequisites // AST node from original file
    ));
  }
  
  // ✨ NEW: expect (preserved from original AST)
  if (screen._originalExpect) {
    console.log('    📦 Including preserved expect function');
    overrideProps.push(t.objectProperty(
      t.identifier('expect'),
      screen._originalExpect // AST node from original file
    ));
  }
  
  // ✅ Build: ImplicationHelper.mergeWithBase(base, overrides, options)
  return t.callExpression(
    t.memberExpression(
      t.identifier('ImplicationHelper'),
      t.identifier('mergeWithBase')
    ),
    [
      // First arg: BaseBookingImplications.platform.screenName
      t.memberExpression(
        t.memberExpression(
          t.identifier('BaseBookingImplications'),
          t.identifier(platformName)
        ),
        t.identifier(screenName)
      ),
      // Second arg: override object
      t.objectExpression(overrideProps),
      // Third arg: { parentClass: AcceptedBookingImplications }
      t.objectExpression([
        t.objectProperty(
          t.identifier('parentClass'),
          t.identifier(className)
        )
      ])
    ]
  );
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
    
    traverse(ast, {
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
    const { sourceFile, targetFile, event, actionDetails } = req.body;  // ✨ Added actionDetails
    
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
    traverse(targetAst, {
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

// ✅ NEW: Handle BOTH simple and complex xstateCsonfig structures
traverse(sourceAst, {
  ClassProperty(path) {
    if (path.node.key?.name === 'xstateConfig' && path.node.static) {
      const configValue = path.node.value;
      
      if (configValue?.type === 'ObjectExpression') {
        let onProperty = null;
        
        // Try to find 'on' at root level (SIMPLE structure)
        onProperty = configValue.properties.find(p => p.key?.name === 'on');
        
        if (onProperty) {
          console.log('✅ Found simple structure: xstateConfig.on');
        } else {
          // Try to find 'on' inside states.idle (COMPLEX structure)
          console.log('🔍 Looking for complex structure: xstateConfig.states.*.on');
          
          const statesProperty = configValue.properties.find(p => p.key?.name === 'states');
          
          if (statesProperty && statesProperty.value?.type === 'ObjectExpression') {
            // Find 'idle' or first state
            let targetState = statesProperty.value.properties.find(p => p.key?.name === 'idle');
            
            if (!targetState && statesProperty.value.properties.length > 0) {
              targetState = statesProperty.value.properties[0];
              console.log(`✅ Using first state: ${targetState.key?.name}`);
            }
            
            if (targetState && targetState.value?.type === 'ObjectExpression') {
              onProperty = targetState.value.properties.find(p => p.key?.name === 'on');
              
              if (!onProperty) {
                // Create 'on' property inside state
                console.log('📝 Creating new "on" property inside state');
                onProperty = {
                  type: 'ObjectProperty',
                  key: { type: 'Identifier', name: 'on' },
                  value: { type: 'ObjectExpression', properties: [] }
                };
                targetState.value.properties.push(onProperty);
              }
            }
          }
        }
        
        // If still no 'on' found, create it at root level
        if (!onProperty) {
          console.log('📝 Creating new "on" property at root level');
          onProperty = {
            type: 'ObjectProperty',
            key: { type: 'Identifier', name: 'on' },
            value: { type: 'ObjectExpression', properties: [] }
          };
          configValue.properties.push(onProperty);
        }
        
        // Check if transition already exists
        const existingTransition = onProperty.value.properties?.find(
          p => p.key?.name === event || p.key?.value === event
        );
        
        if (existingTransition) {
          console.log('⚠️ Transition already exists');
          return;
        }
        
        // Build transition value
        const transitionProperties = [
          {
            type: 'ObjectProperty',
            key: { type: 'Identifier', name: 'target' },
            value: { type: 'StringLiteral', value: `${targetStateName}` }
          }
        ];
        
        // ✨ Add actionDetails if provided
        if (actionDetails) {
          console.log('✨ Adding actionDetails to transition');
          
          // Convert actionDetails to AST
          const actionDetailsAST = parser.parseExpression(JSON.stringify(actionDetails));
          
          transitionProperties.push({
            type: 'ObjectProperty',
            key: { type: 'Identifier', name: 'actionDetails' },
            value: actionDetailsAST
          });
        }
        
        // Add new transition
        console.log(`✅ Adding transition: ${event} → ${targetStateName}`);
        onProperty.value.properties.push({
          type: 'ObjectProperty',
          key: { type: 'Identifier', name: event },
          value: {
            type: 'ObjectExpression',
            properties: transitionProperties
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
  console.log('📝 Updating target file with prerequisite...');
  await fs.writeFile(sourceFile, newCode, 'utf-8');
console.log('✅ Source file updated');

// Parse target file AST (already loaded above)
let targetUpdated = false;

traverse(targetAst, {
  ClassProperty(path) {
    if (path.node.key?.name === 'xstateConfig' && path.node.static) {
      const configValue = path.node.value;
      
      if (configValue?.type === 'ObjectExpression') {
        // Find or create meta property
        let metaProperty = configValue.properties.find(p => p.key?.name === 'meta');
        
        if (!metaProperty) {
          // Create meta if doesn't exist
          metaProperty = {
            type: 'ObjectProperty',
            key: { type: 'Identifier', name: 'meta' },
            value: { type: 'ObjectExpression', properties: [] }
          };
          configValue.properties.unshift(metaProperty); // Add at start
        }
        
        // Find or create requires property in meta
        let requiresProperty = metaProperty.value.properties.find(p => p.key?.name === 'requires');
        
        if (!requiresProperty) {
          // Create requires if doesn't exist
          requiresProperty = {
            type: 'ObjectProperty',
            key: { type: 'Identifier', name: 'requires' },
            value: { type: 'ObjectExpression', properties: [] }
          };
          metaProperty.value.properties.push(requiresProperty);
        }
        
        // Extract source state name from source file
       const sourceStateName = nodePath.basename(sourceFile, '.js')  // ✅ Use nodePath!
  .replace(/Implications$/, '')
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '');
        
        // Find or create previousStatus in requires
        let prevStatusProperty = requiresProperty.value.properties.find(
          p => p.key?.name === 'previousStatus'
        );
        
        if (!prevStatusProperty) {
          // Add previousStatus
          requiresProperty.value.properties.push({
            type: 'ObjectProperty',
            key: { type: 'Identifier', name: 'previousStatus' },
            value: { type: 'StringLiteral', value: sourceStateName }
          });
          
          console.log(`✅ Added requires.previousStatus = '${sourceStateName}'`);
          targetUpdated = true;
        } else {
          console.log(`ℹ️  previousStatus already exists, not overwriting`);
        }
      }
    }
  }
});

// Write updated target file if modified
if (targetUpdated) {
  const { code: newTargetCode } = (babelGenerate.default || babelGenerate)(targetAst, {
    retainLines: true,
    comments: true
  });
  
  // Create backup of target
  const targetBackupPath = `${targetFile}.backup-${timestamp}`;
  await fs.copy(targetFile, targetBackupPath);
  
  // Write updated target file
  await fs.writeFile(targetFile, newTargetCode, 'utf-8');
  
  console.log('✅ Target file updated with prerequisite');
  console.log('📦 Target backup:', targetBackupPath);
}
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

/**
 * GET /api/implications/analyze-composition
 * 
 * Analyzes an implication file to detect composition patterns:
 * - Base class extension (BaseBookingImplications)
 * - Behavior composition (NotificationsImplications via spread)
 * - Helper usage (ImplicationHelper.mergeWithBase counts)
 * 
 * Query params:
 * - filePath: Absolute path to implication file
 * 
 * Returns:
 * {
 *   success: true,
 *   composition: {
 *     baseClass: { className, relativePath, screensUsed, totalMerges, platformBreakdown },
 *     behaviors: [{ className, relativePath, compositionMethod, platforms, screensAffected }],
 *     helperUsage: { totalMerges, byPlatform, byScreen }
 *   }
 * }
 */
router.get('/analyze-composition', async (req, res) => {
  try {
    const { filePath } = req.query;
    
    // Validate input
    if (!filePath) {
      return res.status(400).json({ 
        success: false,
        error: 'filePath query parameter is required' 
      });
    }
    
    // Check if file exists
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return res.status(404).json({ 
        success: false,
        error: `File not found: ${filePath}` 
      });
    }
    
    console.log('🔍 Analyzing composition for:', filePath);
    
    // Create analyzer and run analysis
    const analyzer = new CompositionAnalyzer();
    const composition = analyzer.analyze(filePath);
    
    console.log('✅ Composition analysis complete');
    console.log('   Base class:', composition.baseClass?.className || 'None');
    console.log('   Behaviors:', composition.behaviors.length);
    console.log('   Total merges:', composition.helperUsage.totalMerges);
    
    res.json({
      success: true,
      composition
    });
    
  } catch (error) {
    console.error('❌ Composition analysis failed:', error);
    
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.get('/ui-with-source', async (req, res) => {
  try {
    const { filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    console.log('📋 Getting UI data with source info for:', filePath);
    
    // Read the file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract UI with full merge (this includes sourceInfo!)
    const projectPath = findProjectRoot(filePath);
    const uiData = await extractUIImplications(content, projectPath, {});
    
    res.json({ uiData });
    
  } catch (error) {
    console.error('❌ Error getting UI with source:', error);
    res.status(500).json({ error: error.message });
  }
});

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
    
    // ✨ NEW: Extract fields from actionDetails in transitions
    const requiredFieldsFromActions = extractFieldsFromActionDetails(originalContent);
    
    // Merge context fields with discovered fields
    const allContextFields = {
      ...xstateConfig.context,
      ...requiredFieldsFromActions
    };
    
    // Detect types for each context field
    const contextWithTypes = {};
    
    Object.entries(allContextFields).forEach(([fieldName, value]) => {
      contextWithTypes[fieldName] = {
        value,
        type: detectFieldType(value),
        editable: true,
        source: xstateConfig.context[fieldName] !== undefined ? 'context' : 'actionDetails'
      };
    });
    
    console.log(`✅ Extracted ${Object.keys(contextWithTypes).length} context fields:`, allContextFields);
    console.log(`   - From context: ${Object.keys(xstateConfig.context).length}`);
    console.log(`   - From actionDetails: ${Object.keys(requiredFieldsFromActions).length}`);
    
    res.json({
      success: true,
      context: allContextFields,
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
function findProjectRoot(filePath) {
  let current = path.dirname(filePath);
  
  // Go up until we find a directory that contains 'tests'
  while (current !== '/' && !current.endsWith('/')) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      console.log('   ✅ Found project root (package.json):', current);
      return current;
    }
    
    // Check if current dir has 'tests' subdirectory
    if (fs.existsSync(path.join(current, 'tests'))) {
      console.log('   ✅ Found project root (tests/):', current);
      return current;
    }
    
    current = path.dirname(current);
  }
  
  console.warn('   ⚠️ Could not find project root, using 3-level-up fallback');
  return path.dirname(path.dirname(path.dirname(filePath)));
}
/**
 * ✨ NEW: Extract required fields from actionDetails
 * Parses ctx.data.fieldName from transition steps
 */
function extractFieldsFromActionDetails(fileContent) {
  const fields = {};
  
  try {
    const ast = parse(fileContent, {
      sourceType: 'module',
      plugins: ['classProperties', 'objectRestSpread']
    });
    
    console.log('🔍 Searching for actionDetails in AST...');
    
    traverse(ast, {
      ObjectProperty(path) {
        // Look for property with key "actionDetails"
        if (path.node.key?.name === 'actionDetails' || path.node.key?.value === 'actionDetails') {
          console.log('✅ Found actionDetails property!');
          
          const actionDetails = path.node.value;
          
          // actionDetails should be an ObjectExpression
          if (actionDetails.type === 'ObjectExpression') {
            console.log('  ✅ actionDetails is ObjectExpression');
            
            // Find "steps" property
            const stepsProp = actionDetails.properties.find(
              p => (p.key?.name === 'steps' || p.key?.value === 'steps')
            );
            
            if (stepsProp) {
              console.log('  ✅ Found steps property');
              
              // steps should be ArrayExpression
              if (stepsProp.value?.type === 'ArrayExpression') {
                console.log(`  ✅ Steps array has ${stepsProp.value.elements.length} elements`);
                
                stepsProp.value.elements.forEach((step, stepIndex) => {
                  if (step?.type === 'ObjectExpression') {
                    console.log(`    📍 Processing step ${stepIndex + 1}`);
                    
                    // Find "args" property in step
                    const argsProp = step.properties.find(
                      p => (p.key?.name === 'args' || p.key?.value === 'args')
                    );
                    
                    if (argsProp && argsProp.value?.type === 'ArrayExpression') {
                      console.log(`      ✅ Found args array with ${argsProp.value.elements.length} elements`);
                      
                      argsProp.value.elements.forEach((arg, argIndex) => {
                        if (arg?.type === 'StringLiteral') {
                          console.log(`        📝 Arg ${argIndex + 1}: "${arg.value}"`);
                          
                          // Parse ctx.data.fieldName pattern
                          const match = arg.value.match(/ctx\.data\.(\w+)/);
                          if (match) {
                            const fieldName = match[1];
                            fields[fieldName] = null;
                            console.log(`        ✨ FOUND FIELD: ${fieldName}`);
                          }
                        }
                      });
                    }
                  }
                });
              }
            }
          }
        }
      }
    });
    
    console.log(`📊 Total fields extracted: ${Object.keys(fields).length}`, fields);
    
  } catch (error) {
    console.error('❌ Error parsing actionDetails:', error);
  }
  
  return fields;
}

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
    
    traverse(ast, {
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
    
    traverse(ast, {
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
    
    traverse(ast, {
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
    traverse(ast, {
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


/**
 * GET /api/graph/layout
 * Load saved graph layout from guest project
 */
router.get('/graph/layout', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    // Layout file location in guest project
    const layoutPath = path.join(projectPath, '.implications-framework', 'graph-layout.json');
    
    console.log('📂 Loading graph layout from:', layoutPath);
    
    // Check if layout exists
    if (await fs.pathExists(layoutPath)) {
      const layout = await fs.readJson(layoutPath);
      console.log(`✅ Loaded layout with ${Object.keys(layout.positions || {}).length} node positions`);
      
      res.json({
        success: true,
        layout: layout
      });
    } else {
      console.log('ℹ️  No saved layout found');
      res.json({
        success: true,
        layout: null
      });
    }
    
  } catch (error) {
    console.error('❌ Load graph layout error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

/**
 * POST /api/graph/layout
 * Save graph layout to guest project
 */
router.post('/graph/layout', async (req, res) => {
  try {
    const { projectPath, layout } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    if (!layout || !layout.positions) {
      return res.status(400).json({ error: 'layout with positions is required' });
    }
    
    // Layout file location in guest project
    const layoutDir = path.join(projectPath, '.implications-framework');
    const layoutPath = path.join(layoutDir, 'graph-layout.json');
    
    console.log('💾 Saving graph layout to:', layoutPath);
    
    // Ensure directory exists
    await fs.ensureDir(layoutDir);
    
    // Add metadata
    const layoutData = {
      ...layout,
      savedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    // Write layout file
    await fs.writeJson(layoutPath, layoutData, { spaces: 2 });
    
    console.log(`✅ Saved ${Object.keys(layout.positions).length} node positions`);
    
    res.json({
      success: true,
      layoutPath: layoutPath
    });
    
  } catch (error) {
    console.error('❌ Save graph layout error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

/**
 * DELETE /api/graph/layout
 * Delete saved graph layout (reset to default)
 */
router.delete('/graph/layout', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    const layoutPath = path.join(projectPath, '.implications-framework', 'graph-layout.json');
    
    console.log('🗑️  Deleting graph layout:', layoutPath);
    
    if (await fs.pathExists(layoutPath)) {
      await fs.remove(layoutPath);
      console.log('✅ Layout deleted');
    }
    
    res.json({
      success: true,
      message: 'Layout reset to default'
    });
    
  } catch (error) {
    console.error('❌ Delete graph layout error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

/**
 * POST /api/implications/update-transition
 * Update an existing transition (change event name or target)
 */
router.post('/update-transition', async (req, res) => {
  try {
    const { 
      sourceFile, 
      oldEvent,      // Current event name
      newEvent,      // New event name (can be same as oldEvent)
      newTarget,     // New target state
      actionDetails  // Optional: update actionDetails
    } = req.body;
    
    console.log('✏️ Updating transition:', { sourceFile, oldEvent, newEvent, newTarget });
    
    if (!sourceFile || !oldEvent || !newEvent || !newTarget) {
      return res.status(400).json({ 
        error: 'sourceFile, oldEvent, newEvent, and newTarget are required' 
      });
    }
    
    const content = await fs.readFile(sourceFile, 'utf-8');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['classProperties', 'objectRestSpread']
    });
    
    let transitionUpdated = false;
    
    traverse(ast, {
      ClassProperty(path) {
        if (path.node.key?.name === 'xstateConfig' && path.node.static) {
          const configValue = path.node.value;
          
          if (configValue?.type === 'ObjectExpression') {
            let onProperty = null;
            
            // Try root level 'on'
            onProperty = configValue.properties.find(p => p.key?.name === 'on');
            
            // Try states.idle.on (complex structure)
            if (!onProperty) {
              const statesProperty = configValue.properties.find(p => p.key?.name === 'states');
              
              if (statesProperty?.value?.type === 'ObjectExpression') {
                const idleState = statesProperty.value.properties.find(p => p.key?.name === 'idle');
                
                if (idleState?.value?.type === 'ObjectExpression') {
                  onProperty = idleState.value.properties.find(p => p.key?.name === 'on');
                }
              }
            }
            
            if (!onProperty || !onProperty.value?.properties) {
              return res.status(400).json({ 
                error: 'Could not find transitions in xstateConfig' 
              });
            }
            
            // Find the old transition
            const transitionIndex = onProperty.value.properties.findIndex(
              p => (p.key?.name === oldEvent || p.key?.value === oldEvent)
            );
            
            if (transitionIndex === -1) {
              return res.status(404).json({ 
                error: `Transition "${oldEvent}" not found` 
              });
            }
            
            const oldTransition = onProperty.value.properties[transitionIndex];
            
            // Update the transition
            const transitionProperties = [
              {
                type: 'ObjectProperty',
                key: { type: 'Identifier', name: 'target' },
                value: { type: 'StringLiteral', value: newTarget }
              }
            ];
            
            // Add actionDetails if provided
            if (actionDetails) {
              const actionDetailsAST = parser.parseExpression(JSON.stringify(actionDetails));
              transitionProperties.push({
                type: 'ObjectProperty',
                key: { type: 'Identifier', name: 'actionDetails' },
                value: actionDetailsAST
              });
            } else if (oldTransition.value?.type === 'ObjectExpression') {
              // Preserve existing actionDetails if not updating
              const existingActionDetails = oldTransition.value.properties.find(
                p => p.key?.name === 'actionDetails'
              );
              if (existingActionDetails) {
                transitionProperties.push(existingActionDetails);
              }
            }
            
            // Replace the transition
            onProperty.value.properties[transitionIndex] = {
              type: 'ObjectProperty',
              key: { type: 'Identifier', name: newEvent },
              value: {
                type: 'ObjectExpression',
                properties: transitionProperties
              }
            };
            
            transitionUpdated = true;
            console.log(`✅ Updated: ${oldEvent} → ${newEvent} (target: ${newTarget})`);
          }
        }
      }
    });
    
    if (!transitionUpdated) {
      return res.status(400).json({ 
        error: 'Could not update transition' 
      });
    }
    
    // Generate updated code
    const { code: newCode } = (babelGenerate.default || babelGenerate)(ast, {
      retainLines: true,
      comments: true
    });
    
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${sourceFile}.backup-${timestamp}`;
    await fs.copy(sourceFile, backupPath);
    
    // Write updated file
    await fs.writeFile(sourceFile, newCode, 'utf-8');
    
    console.log('✅ Transition updated successfully');
    
    res.json({
      success: true,
      transition: {
        oldEvent,
        newEvent,
        target: newTarget
      },
      backup: backupPath
    });
    
  } catch (error) {
    console.error('❌ Update transition failed:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/implications/delete-transition
 * Remove a transition from xstateConfig
 */
router.post('/delete-transition', async (req, res) => {
  try {
    const { sourceFile, event } = req.body;
    
    console.log('🗑️ Deleting transition:', { sourceFile, event });
    
    if (!sourceFile || !event) {
      return res.status(400).json({ 
        error: 'sourceFile and event are required' 
      });
    }
    
    const content = await fs.readFile(sourceFile, 'utf-8');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['classProperties', 'objectRestSpread']
    });
    
    let transitionDeleted = false;
    
    traverse(ast, {
      ClassProperty(path) {
        if (path.node.key?.name === 'xstateConfig' && path.node.static) {
          const configValue = path.node.value;
          
          if (configValue?.type === 'ObjectExpression') {
            let onProperty = null;
            
            // Try root level 'on'
            onProperty = configValue.properties.find(p => p.key?.name === 'on');
            
            // Try states.idle.on (complex structure)
            if (!onProperty) {
              const statesProperty = configValue.properties.find(p => p.key?.name === 'states');
              
              if (statesProperty?.value?.type === 'ObjectExpression') {
                const idleState = statesProperty.value.properties.find(p => p.key?.name === 'idle');
                
                if (idleState?.value?.type === 'ObjectExpression') {
                  onProperty = idleState.value.properties.find(p => p.key?.name === 'on');
                }
              }
            }
            
            if (!onProperty || !onProperty.value?.properties) {
              return res.status(400).json({ 
                error: 'Could not find transitions in xstateConfig' 
              });
            }
            
            // Find and remove the transition
            const transitionIndex = onProperty.value.properties.findIndex(
              p => (p.key?.name === event || p.key?.value === event)
            );
            
            if (transitionIndex === -1) {
              return res.status(404).json({ 
                error: `Transition "${event}" not found` 
              });
            }
            
            // Remove the transition
            onProperty.value.properties.splice(transitionIndex, 1);
            transitionDeleted = true;
            
            console.log(`✅ Deleted transition: ${event}`);
          }
        }
      }
    });
    
    if (!transitionDeleted) {
      return res.status(400).json({ 
        error: 'Could not delete transition' 
      });
    }
    
    // Generate updated code
    const { code: newCode } = (babelGenerate.default || babelGenerate)(ast, {
      retainLines: true,
      comments: true
    });
    
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${sourceFile}.backup-${timestamp}`;
    await fs.copy(sourceFile, backupPath);
    
    // Write updated file
    await fs.writeFile(sourceFile, newCode, 'utf-8');
    
    console.log('✅ Transition deleted successfully');
    
    res.json({
      success: true,
      deletedEvent: event,
      backup: backupPath
    });
    
  } catch (error) {
    console.error('❌ Delete transition failed:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


export default router;