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
      content: content,  // ADD THIS LINE
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
 * Extract XState transitions from xstateConfig static property
 */
export function extractXStateTransitions(parsed, className) {
  const transitions = [];
  
  try {
    // Find the class with xstateConfig
    const cls = parsed.classes.find(c => 
      c.staticProperties.some(p => p.name === 'xstateConfig')
    );
    
    if (!cls) return transitions;
    
    // We need to re-parse to get the full AST with the xstateConfig object
    const content = parsed.content || ''; // We'll need to pass this
    if (!content) return transitions;
    
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
    // Traverse to find xstateConfig and extract 'on' transitions
    traverse.default(ast, {
      ClassProperty(path) {
        if (path.node.key?.name === 'xstateConfig' && path.node.static) {
          // Found xstateConfig
          const value = path.node.value;
          
          if (value?.type === 'ObjectExpression') {
            // Look for 'on' property
            const onProperty = value.properties.find(
              p => p.key?.name === 'on'
            );
            
            if (onProperty && onProperty.value?.type === 'ObjectExpression') {
              // Extract each transition
              onProperty.value.properties.forEach(transitionProp => {
                const eventName = transitionProp.key?.name || 
                                 transitionProp.key?.value;
                
                let targetState = null;
                
                // Handle different transition formats
                if (transitionProp.value?.type === 'StringLiteral') {
                  // Simple: ACCEPT: 'accepted'
                  targetState = transitionProp.value.value;
                } else if (transitionProp.value?.type === 'ObjectExpression') {
                  // Complex: ACCEPT: { target: 'accepted' }
                  const targetProp = transitionProp.value.properties.find(
                    p => p.key?.name === 'target'
                  );
                  if (targetProp?.value?.type === 'StringLiteral') {
                    targetState = targetProp.value.value;
                  }
                }
                
                if (eventName && targetState) {
                  transitions.push({
                    event: eventName,
                    from: className,
                    to: targetState,
                  });
                }
              });
            }
          }
        }
      },
    });
    
  } catch (error) {
    console.error(`Error extracting transitions from ${className}:`, error.message);
  }
  
  return transitions;
}

/**
 * Extract detailed metadata from xstateConfig.meta
 */
export function extractXStateMetadata(content) {
  const metadata = {};
  
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
            // Find meta property
            const metaProperty = value.properties.find(
              p => p.key?.name === 'meta'
            );
            
            if (metaProperty?.value?.type === 'ObjectExpression') {
              // Extract all meta fields
              metaProperty.value.properties.forEach(prop => {
                if (!prop.key) return;
                
                const key = prop.key.name;
                const extractedValue = extractValueFromNode(prop.value);
                
                if (extractedValue !== null && extractedValue !== undefined) {
                  metadata[key] = extractedValue;
                }
              });
              
              // Handle setup array/object
              if (metadata.setup) {
                if (Array.isArray(metadata.setup)) {
                  metadata.platforms = metadata.setup
                    .map(s => s?.platform)
                    .filter(Boolean);
                  if (!metadata.platform && metadata.platforms.length > 0) {
                    metadata.platform = metadata.platforms[0];
                  }
                } else if (metadata.setup?.platform) {
                  metadata.platform = metadata.setup.platform;
                  metadata.platforms = [metadata.setup.platform];
                }
              }
            }
          }
        }
      },
    });
    
  } catch (error) {
    console.error('Error extracting XState metadata:', error.message);
  }
  
  return metadata;
}

/**
 * Extract value from AST node
 */
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
      
    case 'TemplateLiteral':
      if (node.quasis && node.quasis.length === 1) {
        return node.quasis[0].value.cooked;
      }
      return null;
      
    default:
      return null;
  }
}