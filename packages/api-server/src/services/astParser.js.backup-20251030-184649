import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

/**
 * Parse a JavaScript file and extract basic structure
 */
export async function parseFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
    const classes = [];
    
    traverse.default(ast, {
      ClassDeclaration(path) {
        const className = path.node.id?.name;
        
        const staticProperties = [];
        const methods = [];
        
        path.node.body.body.forEach(member => {
          if (member.type === 'ClassProperty' && member.static) {
            staticProperties.push({
              name: member.key?.name,
              type: member.value?.type,
            });
          } else if (member.type === 'ClassMethod') {
            methods.push({
              name: member.key?.name,
              static: member.static,
              async: member.async,
            });
          }
        });
        
        classes.push({
          name: className,
          staticProperties,
          methods,
        });
      },
    });
    
    return {
      path: filePath,
      content,
      classes,
      error: null,
    };
    
  } catch (error) {
    return {
      path: filePath,
      content: null,
      classes: [],
      error: error.message,
    };
  }
}

/**
 * Check if parsed file has a specific pattern
 */
export function hasPattern(parsed, patternName) {
  const content = parsed.content || '';
  
  switch (patternName) {
    case 'xstate':
      return content.includes('xstateConfig') || content.includes('createMachine');
      
    case 'enhancedBaseSection':
      return content.includes('EnhancedBaseSection');
      
    case 'testContext':
      return content.includes('TestContext');
      
    case 'expectImplication':
      return content.includes('ExpectImplication');
      
    default:
      return false;
  }
}

/**
 * Extract XState transitions from xstateConfig
 */
export function extractXStateTransitions(parsed, className) {
  const transitions = [];
  
  try {
    const ast = parse(parsed.content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
    traverse.default(ast, {
      ClassProperty(path) {
        if (path.node.key?.name === 'xstateConfig' && path.node.static) {
          const value = path.node.value;
          
          if (value?.type === 'ObjectExpression') {
            // Find 'on' property
            const onProperty = value.properties.find(
              p => p.key?.name === 'on'
            );
            
            if (onProperty && onProperty.value?.type === 'ObjectExpression') {
              // Extract each transition
              onProperty.value.properties.forEach(transitionProp => {
                const eventName = transitionProp.key?.name || transitionProp.key?.value;
                let targetState = null;
                
                // Handle different formats
                if (transitionProp.value?.type === 'StringLiteral') {
                  targetState = transitionProp.value.value;
                } else if (transitionProp.value?.type === 'ObjectExpression') {
                  const targetProp = transitionProp.value.properties.find(
                    p => p.key?.name === 'target'
                  );
                  if (targetProp?.value?.type === 'StringLiteral') {
                    targetState = targetProp.value.value;
                  }
                }
                
                if (eventName && targetState) {
                  transitions.push({
                    from: className,
                    to: targetState,
                    event: eventName,
                  });
                }
              });
            }
          }
        }
      },
    });
    
  } catch (error) {
    console.error('Error extracting transitions:', error.message);
  }
  
  return transitions;
}

/**
 * Extract metadata from xstateConfig.meta
 */
export function extractXStateMetadata(content) {
  const metadata = {
    status: null,
    triggerAction: null,
    triggerButton: null,
    afterButton: null,
    previousButton: null,
    platform: null,
    platforms: [],
    notificationKey: null,
    statusCode: null,
    statusNumber: null,
    requiredFields: [],
    requires: null,
    setup: null,
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
            // Find 'meta' property
            const metaProperty = value.properties.find(
              p => p.key?.name === 'meta'
            );
            
            if (metaProperty && metaProperty.value?.type === 'ObjectExpression') {
              // Extract each field from meta
              metaProperty.value.properties.forEach(prop => {
                const key = prop.key?.name;
                const value = extractValueFromNode(prop.value);
                
                if (key && value !== undefined) {
                  metadata[key] = value;
                }
              });
              
              // Handle special cases
              if (metadata.setup) {
                // Extract platforms from setup if present
                if (Array.isArray(metadata.setup.platforms)) {
                  metadata.platforms = metadata.setup.platforms;
                  if (metadata.platforms.length > 0) {
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
 * Extract UI implications from mirrorsOn.UI
 * NOW with caching support
 */
export async function extractUIImplications(content, projectPath, cache = {}) {
  console.log('🔍 Extracting UI implications...');
  
  if (!cache.baseFiles) {
    cache.baseFiles = {};
  }
  
  const uiData = {
    total: 0,
    platforms: {}
  };
  
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
    // Collect async work during traversal
    const asyncWork = [];
    
    traverse.default(ast, {
      ClassProperty(path) {
  if (path.node.key?.name === 'mirrorsOn' && path.node.static) {
    console.log('✅ Found mirrorsOn!');
    
    const value = path.node.value;
    
    if (value?.type === 'ObjectExpression') {
      const uiProperty = value.properties.find(p => p.key?.name === 'UI');
      
      if (uiProperty?.value?.type === 'ObjectExpression') {
        console.log('✅ UI is an object, platforms:', uiProperty.value.properties.length);
        
        // Process each platform
        uiProperty.value.properties.forEach(platformProp => {
          const platformName = platformProp.key?.name;
          
          if (!platformName) return;
          
          console.log(`\n📱 Processing platform: ${platformName}`);
          
          if (platformProp.value?.type === 'ObjectExpression') {
            // Collect all screens for this platform
            platformProp.value.properties.forEach(screenProp => {
              const screenName = screenProp.key?.name;
              
              if (!screenName) return;
              
              console.log(`   📺 Screen: ${screenName}`);
              
              // Queue async work for this screen
              asyncWork.push(async () => {
                let screenDefinitions = [];
                
                if (screenProp.value?.type === 'ArrayExpression') {
                  // Process array elements
                  const elements = screenProp.value.elements || [];
                  
                  for (const element of elements) {
                    if (!element) continue;
                    
                    if (element.type === 'ObjectExpression') {
                      // Direct screen definition
                      const def = extractScreenDefinition(element);
                      if (def) {
                        screenDefinitions.push(def);
                      }
                    } else if (element.type === 'CallExpression') {
                      // mergeWithBase call - ✅ FIXED FUNCTION NAME
                      const merged = await parseScreenValidation(
                        element,
                        projectPath,
                        cache
                      );
                      
                      if (merged) {
                        screenDefinitions.push(merged);
                      }
                    } else if (element.type === 'MemberExpression') {
                      // Base reference: BaseClass.platform.screen
                      const baseData = await resolveBaseImplication(
                        {
                          className: element.object?.object?.name,
                          platform: element.object?.property?.name,
                          screenName: element.property?.name
                        },
                        projectPath,
                        cache
                      );
                      
                      if (baseData) {
                        screenDefinitions.push(baseData);
                      }
                    }
                  }
                } else if (screenProp.value?.type === 'CallExpression') {
                  // Direct mergeWithBase (not in array)
                  const merged = await parseScreenValidation(
                    screenProp.value,
                    projectPath,
                    cache
                  );
                  
                  if (merged) {
                    screenDefinitions.push(merged);
                  }
                } else if (screenProp.value?.type === 'MemberExpression') {
                  // Direct base reference
                  const baseData = await resolveBaseImplication(
                    {
                      className: screenProp.value.object?.object?.name,
                      platform: screenProp.value.object?.property?.name,
                      screenName: screenProp.value.property?.name
                    },
                    projectPath,
                    cache
                  );
                  
                  if (baseData) {
                    screenDefinitions.push(baseData);
                  }
                }
                
                // Store results
                if (screenDefinitions.length > 0) {
                  if (!uiData.platforms[platformName]) {
                    uiData.platforms[platformName] = {
                      name: platformName,
                      screens: {},
                      total: 0
                    };
                  }
                  
                  uiData.platforms[platformName].screens[screenName] = screenDefinitions;
                  uiData.platforms[platformName].total += screenDefinitions.length;
                  uiData.total += screenDefinitions.length;
                }
              });
            });
          }
        });
      }
    }
  }
}
    });
    
    // Execute all async work AFTER traversal
    console.log(`\n⚡ Executing ${asyncWork.length} async operations...`);
    await Promise.all(asyncWork.map(fn => fn()));
    
    // Calculate totals after async work
    for (const [platformName, platformData] of Object.entries(uiData.platforms)) {
      platformData.total = Object.keys(platformData.screens).length;
      uiData.total += platformData.total;
    }
    
    console.log('\n✅ UI Implications extraction complete');
    console.log(`   Total platforms: ${Object.keys(uiData.platforms).length}`);
    console.log(`   Total screens: ${uiData.total}`);
    
  } catch (error) {
    console.error('❌ Error extracting UI implications:', error.message);
    console.error(error.stack);
  }
  
  // ✅ NORMALIZE to array format before returning
console.log('🎯 FINAL uiData before return:', JSON.stringify(uiData, null, 2));

return {
  total: uiData.total,
  platforms: uiData.platforms
};

}
/**
 * Normalize UI data to consistent format
 * Converts object format to array format that UI components expect
 * 
 * INPUT (from AST):
 * {
 *   dancer: {
 *     notificationsScreen: [...],
 *     requestBookingScreen: [...]
 *   }
 * }
 * 
 * OUTPUT (for UI):
 * {
 *   dancer: {
 *     name: 'dancer',
 *     screens: [
 *       { name: 'notificationsScreen', ... },
 *       { name: 'requestBookingScreen', ... }
 *     ],
 *     total: 2
 *   }
 * }
 */
function normalizeUIData(platforms) {
  const normalized = {};
  
  for (const [platformName, platformData] of Object.entries(platforms)) {
    // If already in array format, keep it
    if (platformData.screens && Array.isArray(platformData.screens)) {
      normalized[platformName] = platformData;
      continue;
    }
    
    // Convert object keys to screens array
    const screens = [];
    
    for (const [screenName, screenData] of Object.entries(platformData)) {
      // Skip metadata fields
      if (screenName === 'name' || screenName === 'total' || screenName === 'screens') {
        continue;
      }
      
      // screenData is typically an array of screen configs
      if (Array.isArray(screenData)) {
        screenData.forEach((config, index) => {
          screens.push({
            ...config,           // ← SPREAD FIRST!
            name: screenName,    // ← THEN override name
            originalName: screenName,
            index: index
          });
        });
      } else {
        // Single object
        screens.push({
          ...screenData,        // ← SPREAD FIRST!
          name: screenName,     // ← THEN override name
          originalName: screenName
        });
      }
    }
    
    normalized[platformName] = {
      name: platformName,
      screens: screens,
      total: screens.length
    };
  }
  
  return normalized;
}


/**
 * Find class file in project
 */
async function findClassFile(className, projectPath, cache) {
  // Check cache first
  if (cache.classFiles && cache.classFiles[className]) {
    return cache.classFiles[className];
  }
  
  // Common locations for implication files
  const searchPaths = [
    path.join(projectPath, 'tests/implications', `${className}.js`),
    path.join(projectPath, 'tests/implications/**', `${className}.js`),
    path.join(projectPath, 'tests/**', `${className}.js`)
  ];
  
  for (const pattern of searchPaths) {
    const files = await glob(pattern, { absolute: true });
    if (files.length > 0) {
      const filePath = files[0];
      
      // Cache it
      if (!cache.classFiles) cache.classFiles = {};
      cache.classFiles[className] = filePath;
      
      return filePath;
    }
  }
  
  return null;
}

/**
 * Extract screen definition from ObjectExpression node
 */
function extractScreenDefinition(objectNode) {
  const def = {
    visible: [],
    hidden: [],
    checks: {
      visible: [],
      hidden: [],
      text: {}
    }
  };
  
  objectNode.properties.forEach(prop => {
    const key = prop.key?.name;
    
    if (key === 'visible' || key === 'hidden') {
      if (prop.value?.type === 'ArrayExpression') {
        def[key] = prop.value.elements
          .map(el => extractValueFromNode(el))
          .filter(Boolean);
      }
    } else if (key === 'checks' && prop.value?.type === 'ObjectExpression') {
      prop.value.properties.forEach(checkProp => {
        const checkKey = checkProp.key?.name;
        
        if (checkKey === 'visible' || checkKey === 'hidden') {
          if (checkProp.value?.type === 'ArrayExpression') {
            def.checks[checkKey] = checkProp.value.elements
              .map(el => extractValueFromNode(el))
              .filter(Boolean);
          }
        } else if (checkKey === 'text' && checkProp.value?.type === 'ObjectExpression') {
          checkProp.value.properties.forEach(textProp => {
            const textKey = textProp.key?.name || textProp.key?.value;
            const textValue = extractValueFromNode(textProp.value);
            if (textKey && textValue) {
              def.checks.text[textKey] = textValue;
            }
          });
        }
      });
    }
  });
  
  return def;
}

/**
 * Process a single platform's screens (async)
 * NOW with caching support
 */
async function processPlatform(platformName, platformNode, projectPath, cache) {
  const screens = [];
  const screenPromises = [];
  
  // Process each screen
  for (const screenProp of platformNode.properties) {
    const screenName = screenProp.key?.name;
    if (!screenName) continue;
    
    console.log('    ðŸ“º Screen:', screenName);
    
    // Handle ArrayExpression (multiple validation objects)
    if (screenProp.value?.type === 'ArrayExpression') {
      console.log('      Screen is an array with', screenProp.value.elements.length, 'validation objects');
      
      // Parse each validation object in the array
      for (let idx = 0; idx < screenProp.value.elements.length; idx++) {
        const validationNode = screenProp.value.elements[idx];
        
        const screenPromise = parseScreenValidation(validationNode, projectPath, cache)  // âœ… Pass cache
          .then(screenData => {
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
        
        screenPromises.push(screenPromise);
      }
    } else {
      // Fallback: single object (rare case)
      const screenPromise = parseScreenValidation(screenProp.value, projectPath, cache)  // âœ… Pass cache
        .then(screenData => {
          if (screenData) {
            screens.push({
              name: screenName,
              ...screenData
            });
          }
        });
      
      screenPromises.push(screenPromise);
    }
  }
  
  // Wait for all screens to be processed
  await Promise.all(screenPromises);
  
  console.log('  ðŸ“Š Platform', platformName, 'has', screens.length, 'parsed screens');
  
  return {
    count: screens.length,
    screens: screens
  };
}
/**
 * Parse a screen validation object (NOW ASYNC with caching)
 */
async function parseScreenValidation(node, projectPath, cache) {
  console.log('      ðŸ” Parsing screen validation, node type:', node?.type);
  
  // âœ… Check if this is a mergeWithBase call
  if (node?.type === 'CallExpression') {
    // Check if it's specifically ImplicationHelper.mergeWithBase()
    if (node.callee?.type === 'MemberExpression' &&
        node.callee.object?.name === 'ImplicationHelper' &&
        node.callee.property?.name === 'mergeWithBase') {
      
      console.log('      âœ… Detected mergeWithBase call!');
      
      const mergeData = parseMergeWithBaseCall(node);
      
      if (mergeData && mergeData.baseInfo) {
        // âœ… Resolve base file and merge (with cache)
        const baseData = await resolveBaseImplication(mergeData.baseInfo, projectPath, cache);
        const merged = mergeScreenData(baseData, mergeData.overrides);
        
        return merged;
      } else {
        // Just return overrides if we couldn't parse base reference
        return mergeData?.overrides || {
          description: 'MergeWithBase parse error',
          visible: [],
          hidden: [],
          checks: { visible: [], hidden: [], text: {} }
        };
      }
    }
    
    // Other function calls - return generic placeholder
    console.log('      âš ï¸ Screen uses function call (unknown type)');
    return {
      description: 'Screen validation defined',
      visible: [],
      hidden: [],
      checks: { visible: [], hidden: [], text: {} }
    };
  }
  
  // Handle object literals
  return parseScreenValidationObject(node);
}
 
/**
 * Parse mergeWithBase call and extract arguments
 */
function parseMergeWithBaseCall(callNode) {
  console.log('      ðŸ”§ Parsing mergeWithBase arguments...');
  
  const args = callNode.arguments;
  
  if (args.length < 2) {
    console.log('      âš ï¸ mergeWithBase has less than 2 arguments');
    return null;
  }
  
  // Argument 0: Base reference (e.g., BaseBookingImplications.dancer.bookingDetailsScreen)
  const baseRef = args[0];
  let baseInfo = null;
  
  if (baseRef?.type === 'MemberExpression') {
    // Parse: BaseBookingImplications.dancer.bookingDetailsScreen
    baseInfo = {
      className: baseRef.object?.object?.name,      // BaseBookingImplications
      platform: baseRef.object?.property?.name,     // dancer
      screenName: baseRef.property?.name            // bookingDetailsScreen
    };
    console.log('      ðŸ“‹ Base reference:', baseInfo);
  }
  
  // Argument 1: Overrides object
  const overridesNode = args[1];
  const overrides = parseScreenValidationObject(overridesNode);
  console.log('      ðŸ“ Overrides parsed:', overrides);
  
  // Argument 2: Options (optional) - { parentClass: ... }
  const optionsNode = args[2];
  let parentClass = null;
  if (optionsNode?.type === 'ObjectExpression') {
    const parentProp = optionsNode.properties.find(p => p.key?.name === 'parentClass');
    if (parentProp) {
      parentClass = parentProp.value?.name;
      console.log('      ðŸ·ï¸ Parent class:', parentClass);
    }
  }
  
  return {
    baseInfo,
    overrides,
    parentClass
  };
}

/**
 * Parse screen validation object (extracted from parseScreenValidation)
 * This handles the object literal part
 */
function parseScreenValidationObject(node) {
  const screenData = {
    description: '',
    visible: [],
    hidden: [],
    alwaysVisible: [],
    sometimesVisible: [],
    checks: {
      visible: [],
      hidden: [],
      text: {}
    }
  };
  
  if (!node || node.type !== 'ObjectExpression') {
    return screenData;
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
      case 'hidden':
      case 'alwaysVisible':
      case 'sometimesVisible':
        if (value.type === 'ArrayExpression') {
          screenData[key] = value.elements
            .map(el => extractValueFromNode(el))
            .filter(Boolean);
          console.log('          ', key, ':', screenData[key].length);
        }
        break;
        
      case 'checks':
        if (value.type === 'ObjectExpression') {
          screenData.checks = parseChecksObject(value);
          console.log('          Checks parsed');
        }
        break;
        
      // ✨ NEW: Extract functions
      case 'functions':
        if (value.type === 'ObjectExpression') {
          screenData.functions = parseFunctionsObject(value);
          console.log('          Functions:', Object.keys(screenData.functions).length);
        }
        break;
        
      // ✨ NEW: Extract screen (POM reference)
      case 'screen':
        if (value.type === 'StringLiteral') {
          screenData.screen = value.value;
          console.log('          Screen (POM):', screenData.screen);
        }
        break;
        
      // ✨ NEW: Extract instance (POM instance)
      case 'instance':
        if (value.type === 'StringLiteral') {
          screenData.instance = value.value;
          console.log('          Instance:', screenData.instance);
        } else if (value.type === 'NullLiteral') {
          screenData.instance = null;
        }
        break;
    }
  });
  
  return screenData;
}

/**
 * ✨ NEW: Parse functions object
 */
function parseFunctionsObject(node) {
  const functions = {};
  
  if (!node || node.type !== 'ObjectExpression') {
    return functions;
  }
  
  node.properties.forEach(prop => {
    if (!prop.key) return;
    
    const funcName = prop.key.name;
    const funcValue = prop.value;
    
    if (funcValue.type === 'ObjectExpression') {
      const funcData = {};
      
      funcValue.properties.forEach(funcProp => {
        if (!funcProp.key) return;
        
        const key = funcProp.key.name;
        const value = extractValueFromNode(funcProp.value);
        
        if (key === 'parameters' && funcProp.value.type === 'ObjectExpression') {
          // Parse parameters object
          funcData.parameters = {};
          funcProp.value.properties.forEach(paramProp => {
            if (paramProp.key) {
              const paramKey = paramProp.key.name || paramProp.key.value;
              const paramValue = extractValueFromNode(paramProp.value);
              funcData.parameters[paramKey] = paramValue;
            }
          });
        } else if (value !== undefined) {
          funcData[key] = value;
        }
      });
      
      functions[funcName] = funcData;
    }
  });
  
  return functions;
}

/**
 * Parse checks object
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
      case 'hidden':
        if (value.type === 'ArrayExpression') {
          checks[key] = value.elements
            .map(el => extractValueFromNode(el))
            .filter(Boolean);
        }
        break;
        
      case 'text':
        if (value.type === 'ObjectExpression') {
          value.properties.forEach(textProp => {
            if (textProp.key) {
              const textKey = textProp.key.name || textProp.key.value;
              const textValue = extractValueFromNode(textProp.value);
              if (textValue !== undefined) {
                checks.text[textKey] = textValue;
              }
            }
          });
        }
        break;
    }
  });
  
  return checks;
}

/**
 * Find a file by name in the project
 */
async function findFile(projectPath, fileName) {
  console.log(`    ðŸ” Searching for ${fileName} in ${projectPath}...`);
  
  const patterns = [
    `${projectPath}/**/${fileName}`,
    `${projectPath}/tests/**/${fileName}`,
    `${projectPath}/test/**/${fileName}`
  ];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, { 
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'] 
    });
    
    if (files.length > 0) {
      console.log(`    âœ… Found: ${files[0]}`);
      return files[0];
    }
  }
  
  console.log(`    âš ï¸ ${fileName} not found`);
  return null;
}

/**
 * Extract static property from base class content
 */
function extractStaticPropertyFromContent(content, platform, screenName) {
  console.log(`    ðŸ“– Extracting ${platform}.${screenName} from base file...`);
  
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
    let baseData = null;
    
    traverse.default(ast, {
      ClassProperty(path) {
        // Look for: static dancer = { ... }
        if (path.node.static && 
            path.node.key?.name === platform &&
            path.node.value?.type === 'ObjectExpression') {
          
          console.log(`    âœ… Found static ${platform} property`);
          
          // Find the screen property
          const screenProp = path.node.value.properties.find(
            p => p.key?.name === screenName
          );
          
          if (screenProp && screenProp.value?.type === 'ObjectExpression') {
            console.log(`    âœ… Found ${screenName} screen`);
            baseData = parseScreenValidationObject(screenProp.value);
          }
        }
      }
    });
    
    return baseData;
    
  } catch (error) {
    console.error(`    âŒ Error parsing base file:`, error.message);
    return null;
  }
}

/**
 * Resolve base implication and return base data
 * NOW with caching!
 */
async function resolveBaseImplication(baseInfo, projectPath, cache = {}) {
  if (!baseInfo || !baseInfo.className) {
    return null;
  }
  
  const cacheKey = `${baseInfo.className}.${baseInfo.platform}.${baseInfo.screenName}`;
  
  // âœ… Check cache first
  if (cache.baseFiles && cache.baseFiles[cacheKey]) {
    console.log(`    ðŸ’¾ Cache HIT: ${cacheKey}`);
    return cache.baseFiles[cacheKey];
  }
  
  console.log(`    ðŸ”— Resolving base: ${baseInfo.className}.${baseInfo.platform}.${baseInfo.screenName}`);
  
  // Find the base file
  const baseFilePath = await findFile(projectPath, `${baseInfo.className}.js`);
  
  if (!baseFilePath) {
    console.log(`    âš ï¸ Base file not found, using overrides only`);
    return null;
  }
  
  // Read and parse the base file
  const baseContent = await fs.readFile(baseFilePath, 'utf-8');
  const baseData = extractStaticPropertyFromContent(
    baseContent, 
    baseInfo.platform, 
    baseInfo.screenName
  );
  
  if (baseData) {
    console.log(`    âœ… Base data resolved:`, {
      visible: baseData.visible?.length || 0,
      hidden: baseData.hidden?.length || 0,
      alwaysVisible: baseData.alwaysVisible?.length || 0,
      description: baseData.description ? 'yes' : 'no'
    });
    
    // âœ… Store in cache
    if (!cache.baseFiles) {
      cache.baseFiles = {};
    }
    cache.baseFiles[cacheKey] = baseData;
    console.log(`    ðŸ’¾ Cached: ${cacheKey}`);
  }
  
  return baseData;
}

/**
 * Merge base data with overrides (like ImplicationHelper.mergeWithBase does)
 */
function mergeScreenData(baseData, overrides) {
  if (!baseData) {
    console.log(`    â„¹ï¸ No base data, returning overrides only`);
    return overrides;
  }
  
  console.log(`    ðŸ”€ Merging base + overrides...`);
  console.log(`      Base visible:`, baseData.visible);
  console.log(`      Base alwaysVisible:`, baseData.alwaysVisible);
  console.log(`      Override visible:`, overrides.visible);
  console.log(`      Override alwaysVisible:`, overrides.alwaysVisible);
  
  // Merge arrays (deduplicate)
  const mergeArrays = (...arrays) => {
    const flattened = arrays.flat().filter(Boolean); // Flatten and remove nulls/undefined
    return [...new Set(flattened)]; // Deduplicate
  };
  
  // Merge checks objects
  const mergeChecks = (baseChecks, overrideChecks) => {
    return {
      visible: mergeArrays(baseChecks?.visible || [], overrideChecks?.visible || []),
      hidden: mergeArrays(baseChecks?.hidden || [], overrideChecks?.hidden || []),
      text: {
        ...(baseChecks?.text || {}),
        ...(overrideChecks?.text || {})
      }
    };
  };
  
  // âœ… Combine alwaysVisible + visible into one visible array
  const combinedVisible = mergeArrays(
    baseData.alwaysVisible || [],
    baseData.visible || [],
    overrides.alwaysVisible || [],
    overrides.visible || []
  );
  
  console.log(`      Combined visible:`, combinedVisible);
  
  // âœ… Combine sometimesVisible + hidden into one hidden array
  let combinedHidden = mergeArrays(
    baseData.sometimesVisible || [],
    baseData.hidden || [],
    overrides.sometimesVisible || [],
    overrides.hidden || []
  );
  
  console.log(`      Combined hidden (before filter):`, combinedHidden);
  
  // âœ… CRITICAL: Remove items from hidden if they appear in visible
  combinedHidden = combinedHidden.filter(item => !combinedVisible.includes(item));
  
  console.log(`      Combined hidden (after filter):`, combinedHidden);
  
  const merged = {
    description: overrides.description || baseData.description || '',
    visible: combinedVisible,
    hidden: combinedHidden,
    checks: mergeChecks(baseData.checks || {}, overrides.checks || {})
  };
  
  console.log(`    âœ… Merged result:`, {
    visible: merged.visible,
    hidden: merged.hidden,
    description: merged.description ? 'yes' : 'no'
  });
  
  return merged;
}

/**
 * Detect spread operator and resolve it
 * Example: ...NotificationsImplications.forBookings().dancer
 */
async function resolveSpreadOperator(spreadNode, projectPath, cache) {
  console.log('   🔍 Resolving spread operator...');
  
  // spreadNode looks like: ...NotificationsImplications.forBookings().dancer
  const argument = spreadNode.argument;
  
  // Case 1: Method call - NotificationsImplications.forBookings().dancer
  if (argument.type === 'MemberExpression') {
    const chain = extractMemberExpressionChain(argument);
    console.log('   📊 Chain:', chain);
    
    // chain = ['NotificationsImplications', 'forBookings', 'dancer']
    const className = chain[0];
    const methodName = chain[1];
    const propertyPath = chain.slice(2);
    
    // Load the class file
    const classFile = await findClassFile(className, projectPath);
    if (!classFile) {
      console.warn(`   ⚠️  Could not find ${className}`);
      return null;
    }
    
    // Execute the method (forBookings()) and get result
    const result = await executeStaticMethod(classFile, methodName);
    
    // Navigate to property (dancer)
    let value = result;
    for (const prop of propertyPath) {
      value = value[prop];
    }
    
    return value;
  }
  
  // Case 2: Direct property - BaseBookingImplications.dancer.notificationsScreen
  if (argument.type === 'MemberExpression') {
    // Similar logic but without method call
    return resolvePropertyChain(argument, projectPath, cache);
  }
  
  return null;
}

/**
 * Extract chain from MemberExpression
 * Example: NotificationsImplications.forBookings().dancer
 * Returns: ['NotificationsImplications', 'forBookings', 'dancer']
 */
function extractMemberExpressionChain(node) {
  const chain = [];
  let current = node;
  
  while (current) {
    if (current.type === 'MemberExpression') {
      if (current.property.type === 'Identifier') {
        chain.unshift(current.property.name);
      }
      current = current.object;
    } else if (current.type === 'CallExpression') {
      // Method call like forBookings()
      if (current.callee.type === 'MemberExpression') {
        chain.unshift(current.callee.property.name);
      }
      current = current.callee.object;
    } else if (current.type === 'Identifier') {
      chain.unshift(current.name);
      break;
    } else {
      break;
    }
  }
  
  return chain;
}

// Enhanced astParser.js additions
// Add these new functions to extract XState context

// Add this function to packages/api-server/src/services/astParser.js
// Place it right after extractXStateMetadata()

/**
 * Extract context fields from xstateConfig
 */
export function extractXStateContext(content) {
  const contextFields = {};
  
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
            // Find context property
            const contextProperty = value.properties.find(
              p => p.key?.name === 'context'
            );
            
            if (contextProperty?.value?.type === 'ObjectExpression') {
              // Extract all context fields
              contextProperty.value.properties.forEach(prop => {
                if (!prop.key) return;
                
                const key = prop.key.name;
                const extractedValue = extractValueFromNode(prop.value);
                
                // Store the field (even if null - that's the default!)
                contextFields[key] = extractedValue;
              });
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error extracting XState context:', error.message);
  }
  
  return contextFields;
}

/**
 * âœ… ENHANCED: Extract complete XState structure
 * Returns: { context, states, meta, transitions }
 */
export function extractCompleteXStateConfig(content) {
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
                      // Could extract more here if needed
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

// ============================================
// Helper function (already exists in astParser, shown here for reference)
// ============================================

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
      // Handle assign() calls
      if (node.callee?.name === 'assign') {
        return '<assign>';
      }
      return '<call>';
      
    default:
      return null;
  }
}

// ============================================
// USAGE in discoveryService.js:
// ============================================

/*
import { extractXStateContext, extractCompleteXStateConfig } from './astParser.js';

// When parsing an implication file:
if (isImplication(parsed)) {
  const metadata = extractImplicationMetadata(parsed);
  
  if (metadata.hasXStateConfig) {
    // âœ… Extract context
    const context = extractXStateContext(parsed.content);
    metadata.xstateContext = context;
    
    // OR use complete extraction:
    const xstateConfig = extractCompleteXStateConfig(parsed.content);
    metadata.xstateContext = xstateConfig.context;
    metadata.xstateInitial = xstateConfig.initial;
    metadata.xstateStates = xstateConfig.states;
  }
}
*/