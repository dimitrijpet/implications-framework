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

/**
 * Extract UI implications from mirrorsOn.UI
 * NOW with caching support
 */
export async function extractUIImplications(content, projectPath, cache = {}) {
  console.log('🔍 Extracting UI implications...');
  
  // Initialize base file cache if not provided
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
    
    // We need to collect promises for base resolution
    const platformPromises = [];
    
    traverse.default(ast, {
      ClassProperty(path) {
        if (path.node.key?.name === 'mirrorsOn' && path.node.static) {
          console.log('✅ Found mirrorsOn!');
          
          const value = path.node.value;
          
          if (value?.type === 'ObjectExpression') {
            const uiProperty = value.properties.find(p => p.key?.name === 'UI');
            
            if (uiProperty?.value?.type === 'ObjectExpression') {
              console.log('✅ UI is an object, platforms:', uiProperty.value.properties.length);
              
              // Extract platforms
              uiProperty.value.properties.forEach(platformProp => {
                const platformName = platformProp.key?.name;
                if (!platformName) return;
                
                console.log('  📱 Platform:', platformName);
                
                if (platformProp.value?.type === 'ObjectExpression') {
                  console.log('    Platform has', platformProp.value.properties.length, 'screens');
                  
                  // Process this platform (async) - PASS CACHE
                  const platformPromise = processPlatform(
                    platformName,
                    platformProp.value,
                    projectPath,
                    cache  // ✅ Pass cache
                  ).then(platformData => {
                    if (platformData && platformData.screens.length > 0) {
                      uiData.platforms[platformName] = platformData;
                      uiData.total += platformData.count;
                    }
                  });
                  
                  platformPromises.push(platformPromise);
                }
              });
            }
          }
        }
      },
    });
    
    // Wait for all platform processing to complete
    await Promise.all(platformPromises);
    
    console.log('📊 Final UI data:', uiData);
    
    // ✅ Log cache stats
    if (cache.baseFiles) {
      const cacheKeys = Object.keys(cache.baseFiles);
      console.log(`💾 Cache stats: ${cacheKeys.length} base files cached`);
      console.log(`   Files:`, cacheKeys);
    }
    
  } catch (error) {
    console.error('❌ Error extracting UI implications:', error.message);
  }
  
  return uiData;
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
    
    console.log('    📺 Screen:', screenName);
    
    // Handle ArrayExpression (multiple validation objects)
    if (screenProp.value?.type === 'ArrayExpression') {
      console.log('      Screen is an array with', screenProp.value.elements.length, 'validation objects');
      
      // Parse each validation object in the array
      for (let idx = 0; idx < screenProp.value.elements.length; idx++) {
        const validationNode = screenProp.value.elements[idx];
        
        const screenPromise = parseScreenValidation(validationNode, projectPath, cache)  // ✅ Pass cache
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
      const screenPromise = parseScreenValidation(screenProp.value, projectPath, cache)  // ✅ Pass cache
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
  
  console.log('  📊 Platform', platformName, 'has', screens.length, 'parsed screens');
  
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
  
  // ✅ Check if this is a mergeWithBase call
  if (node?.type === 'CallExpression') {
    // Check if it's specifically ImplicationHelper.mergeWithBase()
    if (node.callee?.type === 'MemberExpression' &&
        node.callee.object?.name === 'ImplicationHelper' &&
        node.callee.property?.name === 'mergeWithBase') {
      
      console.log('      ✅ Detected mergeWithBase call!');
      
      const mergeData = parseMergeWithBaseCall(node);
      
      if (mergeData && mergeData.baseInfo) {
        // ✅ Resolve base file and merge (with cache)
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
    console.log('      ⚠️ Screen uses function call (unknown type)');
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
  console.log('      🔧 Parsing mergeWithBase arguments...');
  
  const args = callNode.arguments;
  
  if (args.length < 2) {
    console.log('      ⚠️ mergeWithBase has less than 2 arguments');
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
    console.log('      📋 Base reference:', baseInfo);
  }
  
  // Argument 1: Overrides object
  const overridesNode = args[1];
  const overrides = parseScreenValidationObject(overridesNode);
  console.log('      📝 Overrides parsed:', overrides);
  
  // Argument 2: Options (optional) - { parentClass: ... }
  const optionsNode = args[2];
  let parentClass = null;
  if (optionsNode?.type === 'ObjectExpression') {
    const parentProp = optionsNode.properties.find(p => p.key?.name === 'parentClass');
    if (parentProp) {
      parentClass = parentProp.value?.name;
      console.log('      🏷️ Parent class:', parentClass);
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
    }
  });
  
  return screenData;
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
  console.log(`    🔍 Searching for ${fileName} in ${projectPath}...`);
  
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
      console.log(`    ✅ Found: ${files[0]}`);
      return files[0];
    }
  }
  
  console.log(`    ⚠️ ${fileName} not found`);
  return null;
}

/**
 * Extract static property from base class content
 */
function extractStaticPropertyFromContent(content, platform, screenName) {
  console.log(`    📖 Extracting ${platform}.${screenName} from base file...`);
  
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
          
          console.log(`    ✅ Found static ${platform} property`);
          
          // Find the screen property
          const screenProp = path.node.value.properties.find(
            p => p.key?.name === screenName
          );
          
          if (screenProp && screenProp.value?.type === 'ObjectExpression') {
            console.log(`    ✅ Found ${screenName} screen`);
            baseData = parseScreenValidationObject(screenProp.value);
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
  
  const cacheKey = `${baseInfo.className}.${baseInfo.platform}.${baseInfo.screenName}`;
  
  // ✅ Check cache first
  if (cache.baseFiles && cache.baseFiles[cacheKey]) {
    console.log(`    💾 Cache HIT: ${cacheKey}`);
    return cache.baseFiles[cacheKey];
  }
  
  console.log(`    🔗 Resolving base: ${baseInfo.className}.${baseInfo.platform}.${baseInfo.screenName}`);
  
  // Find the base file
  const baseFilePath = await findFile(projectPath, `${baseInfo.className}.js`);
  
  if (!baseFilePath) {
    console.log(`    ⚠️ Base file not found, using overrides only`);
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
    console.log(`    ✅ Base data resolved:`, {
      visible: baseData.visible?.length || 0,
      hidden: baseData.hidden?.length || 0,
      alwaysVisible: baseData.alwaysVisible?.length || 0,
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

/**
 * Merge base data with overrides (like ImplicationHelper.mergeWithBase does)
 */
function mergeScreenData(baseData, overrides) {
  if (!baseData) {
    console.log(`    ℹ️ No base data, returning overrides only`);
    return overrides;
  }
  
  console.log(`    🔀 Merging base + overrides...`);
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
  
  // ✅ Combine alwaysVisible + visible into one visible array
  const combinedVisible = mergeArrays(
    baseData.alwaysVisible || [],
    baseData.visible || [],
    overrides.alwaysVisible || [],
    overrides.visible || []
  );
  
  console.log(`      Combined visible:`, combinedVisible);
  
  // ✅ Combine sometimesVisible + hidden into one hidden array
  let combinedHidden = mergeArrays(
    baseData.sometimesVisible || [],
    baseData.hidden || [],
    overrides.sometimesVisible || [],
    overrides.hidden || []
  );
  
  console.log(`      Combined hidden (before filter):`, combinedHidden);
  
  // ✅ CRITICAL: Remove items from hidden if they appear in visible
  combinedHidden = combinedHidden.filter(item => !combinedVisible.includes(item));
  
  console.log(`      Combined hidden (after filter):`, combinedHidden);
  
  const merged = {
    description: overrides.description || baseData.description || '',
    visible: combinedVisible,
    hidden: combinedHidden,
    checks: mergeChecks(baseData.checks || {}, overrides.checks || {})
  };
  
  console.log(`    ✅ Merged result:`, {
    visible: merged.visible,
    hidden: merged.hidden,
    description: merged.description ? 'yes' : 'no'
  });
  
  return merged;
}