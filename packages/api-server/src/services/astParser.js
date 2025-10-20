import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs-extra';

/**
 * Parse a JavaScript file and extract structure
 */
export async function parseFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse with all features enabled
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
    const result = {
      path: filePath,
      classes: [],
      functions: [],
      imports: [],
      exports: [],
    };
    
    // Traverse AST
    traverse.default(ast, {
      // Extract class declarations
      ClassDeclaration(path) {
        const classInfo = {
          name: path.node.id?.name,
          superClass: path.node.superClass?.name,
          methods: [],
          properties: [],
          staticMethods: [],
          staticProperties: [],
        };
        
        // Extract class body
        path.node.body.body.forEach(member => {
          if (member.type === 'ClassMethod') {
            const methodInfo = {
              name: member.key.name,
              static: member.static,
              async: member.async,
              params: member.params.map(p => p.name),
            };
            
            if (member.static) {
              classInfo.staticMethods.push(methodInfo);
            } else {
              classInfo.methods.push(methodInfo);
            }
          } else if (member.type === 'ClassProperty') {
            const propInfo = {
              name: member.key.name,
              static: member.static,
              value: extractValue(member.value),
            };
            
            if (member.static) {
              classInfo.staticProperties.push(propInfo);
            } else {
              classInfo.properties.push(propInfo);
            }
          }
        });
        
        result.classes.push(classInfo);
      },
      
      // Extract imports
      ImportDeclaration(path) {
        result.imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.map(s => ({
            type: s.type,
            local: s.local.name,
            imported: s.imported?.name,
          })),
        });
      },
      
      // Extract exports
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          result.exports.push({
            type: 'named',
            name: path.node.declaration.id?.name || path.node.declaration.name,
          });
        }
      },
      
      ExportDefaultDeclaration(path) {
        result.exports.push({
          type: 'default',
          name: path.node.declaration.id?.name || path.node.declaration.name,
        });
      },
    });
    
    return result;
    
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return {
      path: filePath,
      error: error.message,
      classes: [],
      functions: [],
      imports: [],
      exports: [],
    };
  }
}

/**
 * Extract simple values from AST nodes
 */
function extractValue(node) {
  if (!node) return null;
  
  switch (node.type) {
    case 'StringLiteral':
      return node.value;
    case 'NumericLiteral':
      return node.value;
    case 'BooleanLiteral':
      return node.value;
    case 'ObjectExpression':
      return '<Object>';
    case 'ArrayExpression':
      return '<Array>';
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return '<Function>';
    default:
      return `<${node.type}>`;
  }
}

/**
 * Check if file has specific pattern
 */
export function hasPattern(parsed, pattern) {
  switch (pattern) {
    case 'xstate':
      return parsed.imports.some(imp => 
        imp.source === 'xstate' || imp.source.includes('xstate')
      );
      
    case 'enhancedBaseSection':
      return parsed.classes.some(cls => 
        cls.superClass === 'EnhancedBaseSection'
      );
      
    case 'testContext':
      return parsed.imports.some(imp => 
        imp.source.includes('TestContext')
      );
      
    case 'expectImplication':
      return parsed.imports.some(imp => 
        imp.source.includes('ExpectImplication')
      );
      
    default:
      return false;
  }
}

/**
 * Extract XState transitions from xstateConfig
 */
export function extractXStateTransitions(parsed) {
  const transitions = [];
  
  // Find the xstateConfig property
  const xstateClass = parsed.classes.find(cls => 
    cls.staticProperties.some(p => p.name === 'xstateConfig')
  );
  
  if (!xstateClass) return transitions;
  
  const xstateConfig = xstateClass.staticProperties.find(p => p.name === 'xstateConfig');
  
  // TODO: Parse the AST to extract transitions from the 'on' object
  // For now, we'll return empty array
  // This requires traversing the ObjectExpression in the AST
  
  return transitions;
}