// packages/api-server/src/routes/context.js
// API endpoints for extracting context from implication files

import express from 'express';
import fs from 'fs/promises';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const router = express.Router();

/**
 * Extract xstateConfig.context and entry from an implication file
 * 
 * GET /api/context/extract?projectPath=...&file=...
 */
router.get('/extract', async (req, res) => {
  try {
    const { projectPath, file } = req.query;

    if (!projectPath || !file) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: projectPath, file'
      });
    }

    console.log(`📊 Extracting context from: ${file}`);

    // Check if file is already an absolute path
    let filePath = file;
    if (!file.includes(':\\') && !file.startsWith('/')) {
      // Relative path - append to projectPath
      filePath = `${projectPath}/${file}`;
    }
    
    console.log(`  📂 Full path: ${filePath}`);
    
    // Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse AST
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread']
    });

    let context = null;
    let entry = null;
    let requiredFields = [];
    let className = null;

    // Traverse to find xstateConfig
    traverse.default(ast, {
      ClassDeclaration(path) {
        className = path.node.id?.name;
      },
      
      ClassProperty(path) {
        if (path.node.static && 
            path.node.key?.name === 'xstateConfig' &&
            path.node.value?.type === 'ObjectExpression') {
          
          // Extract context
          const contextProp = path.node.value.properties.find(
            p => p.key?.name === 'context'
          );
          
          if (contextProp?.value?.type === 'ObjectExpression') {
            context = extractObjectValue(contextProp.value);
          }

          // Extract entry
          const entryProp = path.node.value.properties.find(
            p => p.key?.name === 'entry'
          );
          
          if (entryProp) {
            if (entryProp.value?.type === 'ObjectExpression') {
              entry = extractObjectValue(entryProp.value);
            } else if (entryProp.value?.type === 'CallExpression' &&
                       entryProp.value.callee?.name === 'assign') {
              // Handle: entry: assign({ ... })
              const arg = entryProp.value.arguments[0];
              if (arg?.type === 'ObjectExpression') {
                entry = extractObjectValue(arg);
              }
            }
          }

          // ✅ NEW: Extract meta.requiredFields
          const metaProp = path.node.value.properties.find(
            p => p.key?.name === 'meta'
          );
          
          if (metaProp?.value?.type === 'ObjectExpression') {
            const requiredProp = metaProp.value.properties.find(
              p => p.key?.name === 'requiredFields'
            );
            
            if (requiredProp?.value?.type === 'ArrayExpression') {
              requiredFields = requiredProp.value.elements
                .filter(el => el?.type === 'StringLiteral')
                .map(el => el.value);
            }
          }
        }
      }
    });

    console.log(`  ✅ Extracted context: ${context ? Object.keys(context).length : 0} fields`);
    console.log(`  ✅ Extracted entry: ${entry ? Object.keys(entry).length : 0} fields`);
    console.log(`  ✅ Extracted requiredFields: ${requiredFields.length} fields`);

    res.json({
      success: true,
      className,
      context: context || {},
      entry: entry || {},
      requiredFields: requiredFields || [],
      hasContext: context !== null,
      hasEntry: entry !== null
    });

  } catch (error) {
    console.error('❌ Failed to extract context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper: Extract object value from AST node
 */
function extractObjectValue(node) {
  if (!node || node.type !== 'ObjectExpression') return null;

  const obj = {};

  node.properties.forEach(prop => {
    if (!prop.key) return;
    
    const key = prop.key.name || prop.key.value;
    const value = extractValue(prop.value);
    
    if (value !== undefined) {
      obj[key] = value;
    }
  });

  return obj;
}

/**
 * Helper: Extract value from any AST node
 */
function extractValue(node) {
  if (!node) return undefined;

  switch (node.type) {
    case 'StringLiteral':
      return node.value;
    
    case 'NumericLiteral':
      return node.value;
    
    case 'BooleanLiteral':
      return node.value;
    
    case 'NullLiteral':
      return null;
    
    case 'Identifier':
      if (node.name === 'undefined') return undefined;
      return `<${node.name}>`;
    
    case 'ObjectExpression':
      return extractObjectValue(node);
    
    case 'ArrayExpression':
      return node.elements.map(el => extractValue(el));
    
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return '<function>';
    
    case 'CallExpression':
      return '<call>';
    
    default:
      return `<${node.type}>`;
  }
}

export default router;