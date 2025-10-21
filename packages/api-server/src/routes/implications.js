// packages/api-server/src/routes/implications.js (COMPLETE FILE)

import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
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
      stateName,
      displayName,
      status,
      platform,
      copyFrom,
      triggerButton,
      afterButton,
      previousButton,
      previousStatus,
      notificationKey,
      statusCode,
      statusNumber,
      setupActions,
      requiredFields
    } = req.body;
    
    // Validate required fields
    if (!stateName) {
      return res.status(400).json({ error: 'stateName is required' });
    }
    
    const projectPath = req.app.get('lastScannedProject');
    if (!projectPath) {
      return res.status(400).json({ error: 'No project scanned yet' });
    }

    console.log(`➕ Creating new state: ${stateName}BookingImplications`);
    
    // If copying, fetch source state data
    let copyData = null;
    if (copyFrom) {
      console.log(`📋 Copying from: ${copyFrom}`);
      try {
        const copyResponse = await fetch(`http://localhost:3000/api/implications/get-state-details?stateId=${copyFrom}`);
        if (copyResponse.ok) {
          copyData = await copyResponse.json();
          console.log(`✅ Loaded copy data from ${copyFrom}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch copy data:`, error.message);
      }
    }
    
    // Convert stateName to proper formats
    const stateNamePascal = stateName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    
    const stateNameCamel = stateName
      .split('_')
      .map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    
    // Smart merge: form data takes precedence, fall back to copyData, then defaults
    const finalData = {
      // State identification
      stateName: stateNamePascal,
      stateId: stateName,
      
      // Display info
      status: status || displayName || copyData?.status || 
              stateName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      statusUpperCase: (status || stateName).toUpperCase().replace(/_/g, '_'),
      
      // Platform
      platform: platform || copyData?.platform || 'mobile-manager',
      
      // Buttons
      triggerButton: triggerButton || copyData?.triggerButton || 
                     stateName.toUpperCase().replace(/_/g, '_'),
      afterButton: afterButton || copyData?.afterButton || null,
      previousButton: previousButton || copyData?.previousButton || null,
      
      // Actions and fields
      setupActions: (setupActions && setupActions.length > 0) 
        ? setupActions 
        : (copyData?.setupActions || []),
      requiredFields: (requiredFields && requiredFields.length > 0)
        ? requiredFields
        : (copyData?.requiredFields || ['dancerName', 'clubName', 'bookingTime']),
      
      // Other metadata
      previousStatus: previousStatus || '',
      notificationKey: notificationKey || copyData?.notificationKey || 
                       (status || stateName).replace(/_/g, ' '),
      statusCode: statusCode || copyData?.statusCode || '',
      statusNumber: statusNumber || copyData?.statusNumber || '',
      
      // Action naming
      actionName: `${stateNameCamel}Booking`,
      camelCase: stateNameCamel,
      
      // Metadata
      timestamp: new Date().toISOString(),
      copiedFrom: copyFrom || null
    };
    
    console.log('📦 Final data for template:', {
      stateName: finalData.stateName,
      status: finalData.status,
      platform: finalData.platform,
      triggerButton: finalData.triggerButton,
      setupActions: finalData.setupActions?.length || 0,
      requiredFields: finalData.requiredFields?.length || 0
    });
    
    // Load template
    const templatePath = path.join(__dirname, '../templates/implication.hbs');
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    
    // Register Handlebars helper for camelCase
    Handlebars.registerHelper('camelCase', function(str) {
      return str.split(/[\s_]+/)
        .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    });
    
    const template = Handlebars.compile(templateContent);
    
    // Generate code
    const code = template(finalData);
    
    // Determine file path
    const fileName = `${finalData.stateName}BookingImplications.js`;
    const filePath = path.join(
      projectPath,
      'tests/implications/bookings/status',
      fileName
    );
    
    // Check if file already exists
    const exists = await fs.pathExists(filePath);
    if (exists) {
      return res.status(409).json({ 
        error: `File already exists: ${fileName}`,
        filePath,
        suggestion: 'Choose a different state name or delete the existing file'
      });
    }
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(filePath));
    
    // Write file
    await fs.writeFile(filePath, code, 'utf-8');
    
    console.log(`✅ Created: ${filePath}`);
    
    // Log what was copied (if anything)
    if (copyFrom && copyData) {
      console.log(`📋 Copied structure from "${copyFrom}":`);
      console.log(`   - Platform: ${copyData?.platform} → ${finalData.platform}`);
      if (copyData?.setupActions?.length > 0) {
        console.log(`   - Setup Actions: ${copyData.setupActions.join(', ')}`);
      }
      if (copyData?.requiredFields?.length > 0) {
        console.log(`   - Required Fields: ${copyData.requiredFields.join(', ')}`);
      }
    }
    
    // 🔥 Try to auto-register in state machine
    let autoRegistered = false;
    try {
      const stateMachinePath = path.join(
        projectPath,
        'tests/implications/bookings/BookingStateMachine.js'
      );
      
      if (await fs.pathExists(stateMachinePath)) {
        let machineContent = await fs.readFile(stateMachinePath, 'utf-8');
        
        // Add import statement at the top (after existing imports)
        const importStatement = `const ${finalData.stateName}BookingImplications = require('./status/${finalData.stateName}BookingImplications.js');\n`;
        
        if (!machineContent.includes(importStatement)) {
          // Find the last require statement and add after it
          const lastRequireIndex = machineContent.lastIndexOf('require(');
          if (lastRequireIndex !== -1) {
            const endOfLine = machineContent.indexOf('\n', lastRequireIndex);
            machineContent = machineContent.slice(0, endOfLine + 1) + 
                           importStatement + 
                           machineContent.slice(endOfLine + 1);
          } else {
            // No requires found, add at top
            machineContent = importStatement + machineContent;
          }
        }
        
        // Add to states object
        const stateEntry = `    ${stateName}: ${finalData.stateName}BookingImplications.xstateConfig,`;
        
        // Find states object and add entry
        const statesPattern = /states:\s*{/;
        if (statesPattern.test(machineContent) && !machineContent.includes(stateEntry)) {
          machineContent = machineContent.replace(
            statesPattern, 
            `states: {\n${stateEntry}`
          );
          
          await fs.writeFile(stateMachinePath, machineContent, 'utf-8');
          console.log(`✅ Auto-registered ${finalData.stateName} in BookingStateMachine`);
          autoRegistered = true;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not auto-register in state machine:`, error.message);
    }
    
    res.json({
      success: true,
      filePath,
      fileName,
      stateName: `${finalData.stateName}BookingImplications`,
      copiedFrom: copyFrom || null,
      autoRegistered,
      summary: {
        status: finalData.status,
        platform: finalData.platform,
        triggerButton: finalData.triggerButton,
        setupActions: finalData.setupActions?.length || 0,
        requiredFields: finalData.requiredFields?.length || 0
      },
      nextSteps: autoRegistered ? [
        '✅ State automatically registered in BookingStateMachine',
        '🔄 Re-scan to see it in the graph'
      ] : [
        `📝 Add import: const ${finalData.stateName}BookingImplications = require('./status/${finalData.stateName}BookingImplications.js');`,
        `📝 Register in BookingStateMachine.js states object: ${stateName}: ${finalData.stateName}BookingImplications.xstateConfig,`,
        '🔄 Re-scan to see it in the graph'
      ]
    });
    
  } catch (error) {
    console.error('❌ Error creating state:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

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
    
    const output = generate.default(ast, {
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
    const output = generate.default(ast, {
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
 * POST /api/implications/add-transition
 * Add a transition to an existing implication file
 */
router.post('/add-transition', async (req, res) => {
  try {
    const { filePath, event, target } = req.body;
    
    if (!filePath || !event || !target) {
      return res.status(400).json({ 
        error: 'filePath, event, and target are required' 
      });
    }
    
    console.log(`🔗 Adding transition: ${event} → ${target} in ${path.basename(filePath)}`);
    
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
              const onProp = member.value.properties.find(
                p => t.isObjectProperty(p) && p.key.name === 'on'
              );
              
              if (onProp && t.isObjectExpression(onProp.value)) {
                // Check if transition already exists
                const existingTransition = onProp.value.properties.find(
                  p => t.isObjectProperty(p) && p.key.name === event
                );
                
                if (existingTransition) {
                  return res.status(409).json({ 
                    error: `Transition "${event}" already exists`
                  });
                }
                
                // Add new transition
                onProp.value.properties.push(
                  t.objectProperty(
                    t.identifier(event),
                    t.stringLiteral(target)
                  )
                );
                
                modified = true;
                console.log(`✅ Added transition: ${event} → ${target}`);
              }
            }
          }
        });
      }
    });
    
    if (!modified) {
      return res.status(400).json({ 
        error: 'Could not add transition - no xstateConfig found'
      });
    }
    
    const output = generate.default(ast, {
      retainLines: true,
      comments: true
    }, originalContent);
    
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.copy(filePath, backupPath);
    console.log('📦 Backup created:', backupPath);
    
    await fs.writeFile(filePath, output.code, 'utf-8');
    
    console.log('✅ Transition added successfully');
    
    res.json({
      success: true,
      filePath,
      backup: backupPath,
      transition: { event, target }
    });
    
  } catch (error) {
    console.error('❌ Error adding transition:', error);
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

export default router;