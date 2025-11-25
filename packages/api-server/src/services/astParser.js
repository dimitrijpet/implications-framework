import { parse } from '@babel/parser';
import parser from '@babel/parser';
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
 * Parse file and extract class methods WITH PARAMETERS
 */
export async function parseFileWithMethods(filePath) {
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
        
        const functions = [];
        
        path.node.body.body.forEach(member => {
          if (member.type === 'ClassMethod') {
            // Extract parameters
            const params = member.params.map(param => {
              if (param.type === 'Identifier') {
                return param.name;
              } else if (param.type === 'AssignmentPattern') {
                // Has default value
                return `${param.left.name} = ${extractValueFromNode(param.right)}`;
              }
              return 'unknown';
            });
            
            const signature = `${member.key?.name}(${params.join(', ')})`;
            
            functions.push({
              name: member.key?.name,
              signature: signature,
              params: params,
              static: member.static,
              async: member.async,
            });
          }
        });
        
        classes.push({
          name: className,
          functions: functions,
        });
      },
    });
    
    return {
      path: filePath,
      classes,
      error: null,
    };
    
  } catch (error) {
    return {
      path: filePath,
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
            // ✅ STEP 1: Extract status from meta.status
            let fromStatus = className; // Fallback to className
            
            const metaProperty = value.properties.find(
              p => p.key?.name === 'meta'
            );
            
            if (metaProperty && metaProperty.value?.type === 'ObjectExpression') {
              const statusProp = metaProperty.value.properties.find(
                p => p.key?.name === 'status'
              );
              
              if (statusProp?.value?.type === 'StringLiteral') {
                fromStatus = statusProp.value.value;
                console.log(`   📍 Extracted status: "${fromStatus}" from meta`);
              }
            }
            
            // Find 'on' property
            const onProperty = value.properties.find(
              p => p.key?.name === 'on'
            );
            
            if (onProperty && onProperty.value?.type === 'ObjectExpression') {
              // Extract each transition
             // Extract each transition
              onProperty.value.properties.forEach(transitionProp => {
                const eventName = transitionProp.key?.name || transitionProp.key?.value;
                
                // ✅ NEW: Handle array of transitions (multi-platform)
                if (transitionProp.value?.type === 'ArrayExpression') {
                  console.log(`      📦 Found array transition for ${eventName}, extracting ${transitionProp.value.elements.length} variants`);
                  
                  transitionProp.value.elements.forEach((element, index) => {
                    if (element.type === 'ObjectExpression') {
                      let targetState = null;
                      let platforms = null;
                      
                      // Extract target
                      const targetProp = element.properties.find(p => p.key?.name === 'target');
                      if (targetProp?.value?.type === 'StringLiteral') {
                        targetState = targetProp.value.value;
                      }
                      
                      // Extract platforms
                      const platformsProp = element.properties.find(p => p.key?.name === 'platforms');
                      if (platformsProp && platformsProp.value?.type === 'ArrayExpression') {
                        platforms = platformsProp.value.elements
                          .filter(el => el.type === 'StringLiteral')
                          .map(el => el.value);
                        console.log(`         📱 Variant ${index + 1} platforms:`, platforms);
                      }
                      
                      if (targetState) {
                        transitions.push({
                          from: fromStatus,
                          to: targetState,
                          event: eventName,
                          platforms: platforms
                        });
                      }
                    }
                  });
                  
                  return; // Skip rest of processing for this transition
                }
                
                // Original handling for single transitions
                let targetState = null;
                let platforms = null;
                
                // Handle different formats
                if (transitionProp.value?.type === 'StringLiteral') {
                  targetState = transitionProp.value.value;
                } else if (transitionProp.value?.type === 'ObjectExpression') {
                  // Extract target
                  const targetProp = transitionProp.value.properties.find(
                    p => p.key?.name === 'target'
                  );
                  if (targetProp?.value?.type === 'StringLiteral') {
                    targetState = targetProp.value.value;
                  }
                  
                  // Extract platforms (new format)
                  const platformsProp = transitionProp.value.properties.find(
                    p => p.key?.name === 'platforms'
                  );
                  
                  if (platformsProp && platformsProp.value?.type === 'ArrayExpression') {
                    platforms = platformsProp.value.elements
                      .filter(el => el.type === 'StringLiteral')
                      .map(el => el.value);
                    
                    console.log(`      📱 Found platforms for ${eventName}:`, platforms);
                  }
                  
                  // ✅ FALLBACK: Check old format meta.platform
                  if (!platforms) {
                    const metaProp = transitionProp.value.properties.find(
                      p => p.key?.name === 'meta'
                    );
                    
                    if (metaProp && metaProp.value?.type === 'ObjectExpression') {
                      const platformProp = metaProp.value.properties.find(
                        p => p.key?.name === 'platform'
                      );
                      
                      if (platformProp?.value?.type === 'StringLiteral') {
                        platforms = [platformProp.value.value];
                        console.log(`      📱 Found legacy meta.platform for ${eventName}:`, platforms);
                      }
                    }
                  }
                }
                
                if (eventName && targetState) {
                  transitions.push({
                    from: fromStatus,
                    to: targetState,
                    event: eventName,
                    platforms: platforms
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
/**
 * Extract metadata from xstateConfig.meta
 * ✨ NOW INCLUDES FULL XSTATE CONFIG WITH TRANSITIONS!
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
    xstateConfig: null  // ✅ ADD THIS!
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
            
            // ✅ STEP 1: Extract the FULL xstateConfig as an object
            const fullConfig = {
              id: null,
              meta: {},
              on: {},
              entry: null
            };
            
            // Parse all top-level properties
            value.properties.forEach(prop => {
              const key = prop.key?.name;
              
              if (key === 'id') {
                fullConfig.id = extractValueFromNode(prop.value);
              } else if (key === 'entry') {
                fullConfig.entry = extractValueFromNode(prop.value);
              } else if (key === 'on' && prop.value?.type === 'ObjectExpression') {
                // ✅ Extract transitions from 'on'
                prop.value.properties.forEach(transitionProp => {
                  const eventName = transitionProp.key?.name || transitionProp.key?.value;
                  
                  if (transitionProp.value?.type === 'StringLiteral') {
                    // Simple: UNDO: 'pending'
                    fullConfig.on[eventName] = {
                      target: transitionProp.value.value
                    };
                  } else if (transitionProp.value?.type === 'ObjectExpression') {
                    // Complex: { target: 'x', platforms: [...] }
                    const transitionObj = {};
                    
                    transitionProp.value.properties.forEach(transProp => {
                      const transKey = transProp.key?.name;
                      const transValue = extractValueFromNode(transProp.value);
                      
                      if (transValue !== undefined) {
                        transitionObj[transKey] = transValue;
                      }
                    });
                    
                    fullConfig.on[eventName] = transitionObj;
                  }
                });
              } else if (key === 'meta' && prop.value?.type === 'ObjectExpression') {
                // Extract meta fields
                prop.value.properties.forEach(metaProp => {
                  const metaKey = metaProp.key?.name;
                  const metaValue = extractValueFromNode(metaProp.value);
                  
                  if (metaKey && metaValue !== undefined) {
                    metadata[metaKey] = metaValue;
                    fullConfig.meta[metaKey] = metaValue;
                  }
                });
              }
            });
            
            // ✅ STEP 2: Store the full config!
            metadata.xstateConfig = fullConfig;
            
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
                        
                        console.log(`      📦 Array with ${elements.length} elements`);
                        
                        for (let i = 0; i < elements.length; i++) {
                          const element = elements[i];
                          if (!element) continue;
                          
                          console.log(`      🎯 Element ${i}: type=${element.type}`);
                          
                          if (element.type === 'ObjectExpression') {
                            console.log('      📝 Direct screen definition (ObjectExpression)');
                            const def = extractScreenDefinition(element);
                            if (def) {
                              screenDefinitions.push(def);
                            }
                          } else if (element.type === 'CallExpression') {
                            console.log('      📞 CallExpression detected!');
                            console.log('      🎯 Callee type:', element.callee?.type);
                            console.log('      🎯 Callee object:', element.callee?.object?.name);
                            console.log('      🎯 Callee property:', element.callee?.property?.name);
                            
                            // mergeWithBase call
                            const merged = await parseScreenValidation(
                              element,
                              projectPath,
                              cache
                            );
                            
                            if (merged) {
                              console.log('      ✅ Merged result has sourceInfo?', !!merged.sourceInfo);
                              screenDefinitions.push(merged);
                            }
                          } else if (element.type === 'MemberExpression') {
                            console.log('      🔗 Base reference (MemberExpression)');
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
                          } else {
                            console.log(`      ⚠️ Unknown element type: ${element.type}`);
                          }
                        }
                       } else if (screenProp.value?.type === 'CallExpression') {
                        console.log('      📞 Direct CallExpression (not in array)');
                        const merged = await parseScreenValidation(
                          screenProp.value,
                          projectPath,
                          cache
                        );
                        
                        if (merged) {
                          screenDefinitions.push(merged);
                        }
                      } else if (screenProp.value?.type === 'MemberExpression') {
                        console.log('      🔗 Direct base reference');
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
                      } else if (screenProp.value?.type === 'ObjectExpression') {
                        // ✅ NEW: Handle direct object (single screen, not in array)
                        console.log('      📝 Direct ObjectExpression (single screen)');
                        const def = extractScreenDefinition(screenProp.value);
                        if (def) {
                          screenDefinitions.push(def);
                        }
                      } else {
                        console.log(`      ⚠️ Unhandled screen value type: ${screenProp.value?.type}`);
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
                        
                        console.log(`      ✅ Stored ${screenDefinitions.length} definition(s) for ${screenName}`);
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
    
    console.log('\n✅ UI Implications extraction complete');
    console.log(`   Total platforms: ${Object.keys(uiData.platforms).length}`);
    console.log(`   Total screens: ${uiData.total}`);
    
  } catch (error) {
    console.error('❌ Error extracting UI implications:', error.message);
    console.error(error.stack);
  }
  
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
  
  console.log(`🔍 Searching for ${className}.js in ${projectPath}`);
  
  // Common locations for implication files
  const searchPaths = [
    path.join(projectPath, `tests/implications/${className}.js`),
    path.join(projectPath, `tests/implications/**/${className}.js`),
    path.join(projectPath, `tests/**/${className}.js`),
    path.join(projectPath, `**/${className}.js`)
  ];
  
  for (const pattern of searchPaths) {
    console.log(`   🔍 Trying pattern: ${pattern}`);
    const files = await glob(pattern, { absolute: true });
    
    if (files.length > 0) {
      const filePath = files[0];
      console.log(`   ✅ FOUND: ${filePath}`);
      
      // Cache it
      if (!cache.classFiles) cache.classFiles = {};
      cache.classFiles[className] = filePath;
      
      return filePath;
    }
  }
  
  console.log(`   ❌ NOT FOUND after trying all patterns`);
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
  console.log('      🔍 Parsing screen validation, node type:', node?.type);
  
  // ============================================================
  // CASE 1: Direct Reference to Another Implication
  // Example: NotificationsImplications.mirrorsOn.UI.dancer.notificationsScreen[0]
  // ============================================================
  if (node?.type === 'MemberExpression') {
    console.log('      🔗 Detected direct reference (MemberExpression)!');
    
    try {
      // Parse the reference chain to get className, platform, screenName
      const refInfo = extractBaseReference(node);
      
      if (refInfo && refInfo.className) {
        console.log(`      🔗 Following direct reference to: ${refInfo.className}.${refInfo.platform}.${refInfo.screenName}`);
        
        // Recursively resolve the reference
        const resolvedData = await resolveBaseImplication(refInfo, projectPath, cache);
        
        if (resolvedData) {
          console.log('      ✅ Direct reference resolved successfully!');
          console.log('      📊 Resolved data:', {
            visible: resolvedData.visible?.length || 0,
            hidden: resolvedData.hidden?.length || 0,
            alwaysVisible: resolvedData.alwaysVisible?.length || 0,
            sometimesVisible: resolvedData.sometimesVisible?.length || 0
          });
          return resolvedData;
        } else {
          console.log('      ⚠️ Direct reference could not be resolved, returning empty');
        }
      } else {
        console.log('      ⚠️ Could not extract reference info from MemberExpression');
      }
    } catch (error) {
      console.log('      ❌ Error resolving direct reference:', error.message);
    }
    
    // If resolution failed, return empty structure
    return {
      description: 'Direct reference (unresolved)',
      visible: [],
      hidden: [],
      alwaysVisible: [],
      sometimesVisible: [],
      checks: { visible: [], hidden: [], text: {} }
    };
  }
  
  // ============================================================
  // CASE 2: ImplicationHelper.mergeWithBase() Call
  // Example: ImplicationHelper.mergeWithBase(BaseClass.platform.screen, {...})
  // ============================================================
  if (node?.type === 'CallExpression') {
    // Check if it's specifically ImplicationHelper.mergeWithBase()
    if (node.callee?.type === 'MemberExpression' &&
        node.callee.object?.name === 'ImplicationHelper' &&
        node.callee.property?.name === 'mergeWithBase') {
      
      console.log('      ✅ Detected mergeWithBase call!');
      console.log('      🔧 Parsing mergeWithBase arguments...');
      
      try {
        // Parse the mergeWithBase call to extract base reference and overrides
        const mergeData = parseMergeWithBaseCall(node);
        
        if (mergeData && mergeData.baseInfo) {
          console.log('      📋 Base reference:', mergeData.baseInfo);
          
          // Resolve the base file and get its data
          const baseData = await resolveBaseImplication(mergeData.baseInfo, projectPath, cache);
          
          // Merge base data with child overrides
          const merged = mergeScreenData(baseData, mergeData.overrides, {
            baseClassName: mergeData.baseInfo.className || 'BaseClass',
            childClassName: mergeData.parentClass || 'ChildClass'
          });
          
          return merged;
        } else {
          console.log('      ⚠️ Could not parse mergeWithBase arguments');
          // Return just the overrides if base couldn't be parsed
          return mergeData?.overrides || {
            description: 'MergeWithBase parse error',
            visible: [],
            hidden: [],
            alwaysVisible: [],
            sometimesVisible: [],
            checks: { visible: [], hidden: [], text: {} }
          };
        }
      } catch (error) {
        console.log('      ❌ Error parsing mergeWithBase:', error.message);
        return {
          description: 'MergeWithBase error',
          visible: [],
          hidden: [],
          alwaysVisible: [],
          sometimesVisible: [],
          checks: { visible: [], hidden: [], text: {} }
        };
      }
    }
    
    // ============================================================
    // CASE 3: Other Function Calls (not mergeWithBase)
    // Example: someOtherHelper.doSomething()
    // ============================================================
    console.log('      ⚠️ Screen uses function call (unknown type)');
    return {
      description: 'Screen validation defined via function call',
      visible: [],
      hidden: [],
      alwaysVisible: [],
      sometimesVisible: [],
      checks: { visible: [], hidden: [], text: {} }
    };
  }
  
  // ============================================================
  // CASE 4: Object Literal
  // Example: { screen: () => app.screen, visible: [...], hidden: [...] }
  // ============================================================
  console.log('      📝 Parsing as object literal');
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
  console.log(`    📖 Extracting ${platform}.${screenName} from base file...`);
  
  try {
    // ✅ USE THE ALREADY IMPORTED 'parser' INSTEAD OF require()
    const ast = parser.parse(content, {
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
          
          console.log(`    ✅ Found static ${platform} property`);
          
          // Find the screen property
          const screenProp = path.node.value.properties.find(
            p => p.key?.name === screenName
          );
          
          if (screenProp && screenProp.value?.type === 'ObjectExpression') {
            console.log(`    ✅ Found ${screenName} screen in AST`);
            console.log(`    📊 Properties found:`, screenProp.value.properties.map(p => p.key?.name).join(', '));
            
            baseData = parseScreenValidationObject(screenProp.value);
            
            console.log(`    📊 After parsing:`, {
              alwaysVisible: baseData?.alwaysVisible?.length || 0,
              sometimesVisible: baseData?.sometimesVisible?.length || 0,
              visible: baseData?.visible?.length || 0,
              hidden: baseData?.hidden?.length || 0
            });
          } else if (screenProp) {
            console.log(`    ⚠️ screenProp.value type is:`, screenProp.value?.type);
          } else {
            console.log(`    ❌ Did NOT find ${screenName} in static ${platform}`);
          }
        }
      }
    });
    
    return baseData;
    
  } catch (error) {
    console.error(`    ❌ Error parsing base file:`, error.message);
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
  
  console.log(`🔍 ATTEMPTING TO FIND: ${baseInfo.className}.js`);
  console.log(`   Project path: ${projectPath}`);
  
  const baseFilePath = await findClassFile(baseInfo.className, projectPath, cache);
  
  console.log(`📁 RESULT: ${baseFilePath || 'NOT FOUND'}`);
  
  const cacheKey = `${baseInfo.className}.${baseInfo.platform}.${baseInfo.screenName}`;
  
  // ✅ Check cache first
  if (cache.baseFiles && cache.baseFiles[cacheKey]) {
    console.log(`    💾 Cache HIT: ${cacheKey}`);
    return cache.baseFiles[cacheKey];
  }
  
  console.log(`    📖 Resolving base: ${baseInfo.className}.${baseInfo.platform}.${baseInfo.screenName}`);
  
  // Find the base file
  
  if (!baseFilePath) {
    console.log(`    ⚠️ Base file not found, using overrides only`);
    return null;
  }
  
  // Read and parse the base file
  const baseContent = await fs.readFile(baseFilePath, 'utf-8');
  
  // ✨ NEW: Use a more sophisticated extraction that can detect and follow references
  const baseData = await extractStaticPropertyWithReferences(
    baseContent,
    baseInfo.platform,
    baseInfo.screenName,
    projectPath,
    cache
  );
  
  if (baseData) {
    console.log(`    ✅ Base data resolved:`, {
      visible: baseData.visible?.length || 0,
      hidden: baseData.hidden?.length || 0,
      alwaysVisible: baseData.alwaysVisible?.length || 0,
      sometimesVisible: baseData.sometimesVisible?.length || 0,
      description: baseData.description ? 'yes' : 'no'
    });
    
    // ✅ Store in cache
    if (!cache.baseFiles) {
      cache.baseFiles = {};
    }
    cache.baseFiles[cacheKey] = baseData;
    console.log(`    💾 Cached: ${cacheKey}`);
  }
  
  return baseData;
}

// ✨ NEW HELPER FUNCTION - Add this after resolveBaseImplication
async function extractStaticPropertyWithReferences(content, platform, screenName, projectPath, cache) {
  // First try the normal extraction
  let data = extractStaticPropertyFromContent(content, platform, screenName);
  
  // If we got data but it's empty arrays, check if it's a reference
  if (data && 
      (!data.alwaysVisible || data.alwaysVisible.length === 0) &&
      (!data.sometimesVisible || data.sometimesVisible.length === 0) &&
      (!data.visible || data.visible.length === 0)) {
    
    console.log(`    🔗 Empty data, checking if it's a reference...`);
    
    // Parse the AST to look for references
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    
    let referenceFound = false;
    
    traverse.default(ast, {
      ClassDeclaration(path) {
        // Find the static property for the platform
        const staticProps = path.node.body.body.filter(
          node => node.static && node.type === 'ClassProperty'
        );
        
        for (const prop of staticProps) {
          if (prop.key.name === platform && prop.value?.type === 'ObjectExpression') {
            // Look for the specific screen property
            for (const screenProp of prop.value.properties) {
              if (screenProp.key.name === screenName) {
                // Check if it's a MemberExpression (reference to another class)
                if (screenProp.value.type === 'MemberExpression') {
                  console.log(`    🔗 Found reference chain!`);
                  const refInfo = extractBaseReference(screenProp.value);
                  
                  if (refInfo && refInfo.className) {
                    console.log(`    🔗 Following to: ${refInfo.className}.${refInfo.platform}.${refInfo.screenName}`);
                    referenceFound = true;
                    
                    // Recursively resolve - use the helper flag to avoid infinite loops
                    data = resolveBaseImplication(refInfo, projectPath, cache);
                  }
                }
              }
            }
          }
        }
      }
    });
    
    // If we found a reference, await it
    if (referenceFound && data && typeof data.then === 'function') {
      data = await data;
    }
  }
  
  return data;
}

/**
 * Merge base data with overrides (like ImplicationHelper.mergeWithBase does)
 * 
 * REPLACE THE ENTIRE mergeScreenData FUNCTION WITH THIS
 */
function mergeScreenData(baseData, overrides, options = {}) {
  console.log('🔍 mergeScreenData called');
  console.log('   Base:', {
    alwaysVisible: baseData?.alwaysVisible?.length || 0,
    sometimesVisible: baseData?.sometimesVisible?.length || 0,
    visible: baseData?.visible?.length || 0,
    hidden: baseData?.hidden?.length || 0
  });
  console.log('   Override:', {
    alwaysVisible: overrides?.alwaysVisible?.length || 0,
    sometimesVisible: overrides?.sometimesVisible?.length || 0,
    visible: overrides?.visible?.length || 0,
    hidden: overrides?.hidden?.length || 0
  });
  
  if (!baseData) {
    console.log('   No base data, returning overrides only');
    return overrides;
  }
  
  const baseClassName = options.baseClassName || 'BaseClass';
  const childClassName = options.childClassName || 'ChildClass';
  
  // Initialize source tracking
  const sourceInfo = {
    visible: {},
    hidden: {},
    description: null,
    checks: { visible: {}, hidden: {}, text: {} }
  };
  
  // ============================================
  // MERGE VISIBLE ELEMENTS
  // ============================================
  const combinedVisible = [];
  
  // From base: alwaysVisible → visible
  (baseData.alwaysVisible || []).forEach(element => {
    if (!combinedVisible.includes(element)) {
      combinedVisible.push(element);
      sourceInfo.visible[element] = {
        source: baseClassName,
        type: 'alwaysVisible',
        category: 'base'
      };
    }
  });
  
  // From base: visible → visible
  (baseData.visible || []).forEach(element => {
    if (!combinedVisible.includes(element)) {
      combinedVisible.push(element);
      sourceInfo.visible[element] = {
        source: baseClassName,
        type: 'visible',
        category: 'base'
      };
    }
  });
  
  // From child: alwaysVisible → visible (override)
  (overrides.alwaysVisible || []).forEach(element => {
    if (!combinedVisible.includes(element)) {
      combinedVisible.push(element);
    }
    sourceInfo.visible[element] = {
      source: childClassName,
      type: 'alwaysVisible',
      category: 'child'
    };
  });
  
  // From child: visible → visible (add new)
  (overrides.visible || []).forEach(element => {
    if (!combinedVisible.includes(element)) {
      combinedVisible.push(element);
    }
    sourceInfo.visible[element] = {
      source: childClassName,
      type: 'visible',
      category: 'child'
    };
  });
  
  // ============================================
  // MERGE HIDDEN ELEMENTS
  // ============================================
  (baseData.sometimesVisible || []).forEach(element => {
  // Skip if child explicitly hid this element
  if ((overrides.hidden || []).includes(element)) {
    return; // Will be added to hidden later
  }
  
  // Add to visible
  if (!combinedVisible.includes(element)) {
    combinedVisible.push(element);
    sourceInfo.visible[element] = {
      source: baseClassName,
      type: 'sometimesVisible',
      category: 'base'
    };
  }
});

// ============================================
// MERGE HIDDEN ELEMENTS
// ============================================
const combinedHidden = [];

// From base: hidden → hidden
(baseData.hidden || []).forEach(element => {
  if (!combinedVisible.includes(element) && !combinedHidden.includes(element)) {
    combinedHidden.push(element);
    sourceInfo.hidden[element] = {
      source: baseClassName,
      type: 'hidden',
      category: 'base'
    };
  }
});
  
  // From child: sometimesVisible → hidden (if not in visible)
  (overrides.sometimesVisible || []).forEach(element => {
    if (!combinedVisible.includes(element) && !combinedHidden.includes(element)) {
      combinedHidden.push(element);
    }
    sourceInfo.hidden[element] = {
      source: childClassName,
      type: 'sometimesVisible',
      category: 'child'
    };
  });
  
  // From child: hidden → hidden
  (overrides.hidden || []).forEach(element => {
    if (!combinedVisible.includes(element) && !combinedHidden.includes(element)) {
      combinedHidden.push(element);
    }
    sourceInfo.hidden[element] = {
      source: childClassName,
      type: 'hidden',
      category: 'child'
    };
  });
  
  // ============================================
  // MERGE CHECKS
  // ============================================
  const mergedChecks = {
    visible: [...new Set([
      ...(baseData.checks?.visible || []),
      ...(overrides.checks?.visible || [])
    ])],
    hidden: [...new Set([
      ...(baseData.checks?.hidden || []),
      ...(overrides.checks?.hidden || [])
    ])],
    text: {
      ...(baseData.checks?.text || {}),
      ...(overrides.checks?.text || {})
    }
  };
  
  // Track sources for checks
  (baseData.checks?.visible || []).forEach(check => {
    sourceInfo.checks.visible[check] = { source: baseClassName, category: 'base' };
  });
  (overrides.checks?.visible || []).forEach(check => {
    sourceInfo.checks.visible[check] = { source: childClassName, category: 'child' };
  });
  (baseData.checks?.hidden || []).forEach(check => {
    sourceInfo.checks.hidden[check] = { source: baseClassName, category: 'base' };
  });
  (overrides.checks?.hidden || []).forEach(check => {
    sourceInfo.checks.hidden[check] = { source: childClassName, category: 'child' };
  });
  
  // ============================================
  // MERGE OTHER FIELDS
  // ============================================
  const merged = {
    description: overrides.description || baseData.description || '',
    screen: overrides.screen || baseData.screen,
    instance: overrides.instance !== undefined ? overrides.instance : baseData.instance,
    visible: combinedVisible,
    hidden: combinedHidden,
    alwaysVisible: baseData.alwaysVisible || [],  // Keep original for reference
    sometimesVisible: baseData.sometimesVisible || [],  // Keep original for reference
    checks: mergedChecks,
    prerequisites: overrides.prerequisites || baseData.prerequisites,
    functions: { ...(baseData.functions || {}), ...(overrides.functions || {}) },
    expect: overrides.expect || baseData.expect,
    sourceInfo
  };
  
  console.log('   ✅ Merged result:', {
    visible: merged.visible.length,
    hidden: merged.hidden.length,
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