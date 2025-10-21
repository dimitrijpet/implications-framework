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

export function extractUIImplications(content) {
  console.log('🔍 Extracting UI implications...');
  
  const uiData = {
    total: 0,
    platforms: {}
  };
  
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
    traverse.default(ast, {
      ClassProperty(path) {
        if (path.node.key?.name === 'mirrorsOn' && path.node.static) {
          console.log('✅ Found mirrorsOn!');
          
          const value = path.node.value;
          
          if (value?.type === 'ObjectExpression') {
            console.log('✅ mirrorsOn is an object');
            
            // Find UI property
            const uiProperty = value.properties.find(
              p => p.key?.name === 'UI'
            );
            
            if (uiProperty) {
              console.log('✅ Found UI property');
              
              if (uiProperty.value?.type === 'ObjectExpression') {
                console.log('✅ UI is an object, platforms:', uiProperty.value.properties.length);
                
                // Extract platforms
                uiProperty.value.properties.forEach(platformProp => {
                  const platformName = platformProp.key?.name;
                  console.log('  📱 Platform:', platformName);
                  
                  if (!platformName) return;
                  
                  const screens = [];
                  
                 if (platformProp.value?.type === 'ObjectExpression') {
  console.log('    Platform has', platformProp.value.properties.length, 'screens');
  
  platformProp.value.properties.forEach(screenProp => {
    const screenName = screenProp.key?.name;
    console.log('    📺 Screen:', screenName);
    
    if (!screenName) return;
    
    // ✅ FIX: Handle ArrayExpression (multiple validation objects per screen)
    if (screenProp.value?.type === 'ArrayExpression') {
      console.log('      Screen is an array with', screenProp.value.elements.length, 'validation objects');
      
      // Parse each validation object in the array
      screenProp.value.elements.forEach((validationNode, idx) => {
        const screenData = parseScreenValidation(validationNode);
        console.log('      Validation', idx, 'data:', screenData);
        
        if (screenData) {
          // If multiple validations, add index to name
          const fullName = screenProp.value.elements.length > 1 
            ? `${screenName}_${idx + 1}`
            : screenName;
            
          screens.push({
            name: fullName,
            originalName: screenName,
            ...screenData
          });
        }
      });
    } else {
      // Fallback: single object (rare case)
      const screenData = parseScreenValidation(screenProp.value);
      console.log('      Screen data:', screenData);
      
      if (screenData) {
        screens.push({
          name: screenName,
          ...screenData
        });
      }
    }
  });
}
                  
                  console.log('  📊 Platform', platformName, 'has', screens.length, 'parsed screens');
                  
                  if (screens.length > 0) {
                    uiData.platforms[platformName] = {
                      count: screens.length,
                      screens: screens
                    };
                    uiData.total += screens.length;
                  }
                });
              } else {
                console.log('⚠️ UI is not an object, type:', uiProperty.value?.type);
              }
            } else {
              console.log('⚠️ No UI property found');
            }
          }
        }
      },
    });
    
    console.log('📊 Final UI data:', uiData);
    
  } catch (error) {
    console.error('❌ Error extracting UI implications:', error.message);
  }
  
  return uiData;
}

/**
 * Parse a screen validation object (simplified - handle any structure)
 */
function parseScreenValidation(node) {
  console.log('      🔍 Parsing screen validation, node type:', node?.type);
  
  // Handle any type - just extract what we can
  const screenData = {
    description: '',
    visible: [],
    hidden: [],
    checks: {
      visible: [],
      hidden: [],
      text: {}
    }
  };
  
  // If it's a function call (like mergeWithBase), we can't parse it easily
  // Just return basic data so the screen shows up
  if (node?.type === 'CallExpression') {
    console.log('      ⚠️ Screen uses function call (like mergeWithBase), showing basic info');
    return {
      description: 'Screen validation defined',
      visible: [],
      hidden: [],
      checks: { visible: [], hidden: [], text: {} }
    };
  }
  
  if (!node || node.type !== 'ObjectExpression') {
    console.log('      ⚠️ Not a parseable type');
    // Still return something so screen shows up
    return {
      description: 'Screen validation detected',
      visible: [],
      hidden: [],
      checks: { visible: [], hidden: [], text: {} }
    };
  }
  
  console.log('      Found', node.properties.length, 'properties');
  
  // Parse each property
  node.properties.forEach(prop => {
    if (!prop.key) return;
    
    const key = prop.key.name;
    console.log('        Property:', key);
    
    const value = prop.value;
    
    switch (key) {
      case 'description':
        if (value.type === 'StringLiteral') {
          screenData.description = value.value;
          console.log('          Description:', screenData.description);
        }
        break;
        
      case 'visible':
        if (value.type === 'ArrayExpression') {
          screenData.visible = value.elements
            .map(el => extractValueFromNode(el))
            .filter(Boolean);
          console.log('          Visible:', screenData.visible.length);
        }
        break;
        
      case 'hidden':
        if (value.type === 'ArrayExpression') {
          screenData.hidden = value.elements
            .map(el => extractValueFromNode(el))
            .filter(Boolean);
          console.log('          Hidden:', screenData.hidden.length);
        }
        break;
        
      case 'checks':
        if (value.type === 'ObjectExpression') {
          screenData.checks = parseChecksObject(value);
          console.log('          Checks:', screenData.checks);
        }
        break;
    }
  });
  
  return screenData;
}
/**
 * Parse the checks object (visible, hidden, text)
 */
function parseChecksObject(node) {
  const checks = {
    visible: [],
    hidden: [],
    text: {}
  };
  
  if (!node || node.type !== 'ObjectExpression') {
    return checks;
  }
  
  node.properties.forEach(prop => {
    if (!prop.key) return;
    
    const key = prop.key.name;
    const value = prop.value;
    
    switch (key) {
      case 'visible':
        if (value.type === 'ArrayExpression') {
          checks.visible = value.elements
            .map(el => extractValueFromNode(el))
            .filter(Boolean);
        }
        break;
        
      case 'hidden':
        if (value.type === 'ArrayExpression') {
          checks.hidden = value.elements
            .map(el => extractValueFromNode(el))
            .filter(Boolean);
        }
        break;
        
      case 'text':
        if (value.type === 'ObjectExpression') {
          value.properties.forEach(textProp => {
            if (textProp.key && textProp.value) {
              const elementName = textProp.key.name || textProp.key.value;
              const expectedText = extractValueFromNode(textProp.value);
              if (elementName && expectedText) {
                checks.text[elementName] = expectedText;
              }
            }
          });
        }
        break;
    }
  });
  
  return checks;
}