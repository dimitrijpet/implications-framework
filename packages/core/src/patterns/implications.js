import { DISCOVERY_TYPES } from '../types/discovery.js';

/**
 * Detect if file is an Implication
 */
export function isImplication(parsed) {
  const classes = parsed.classes || [];
  
  return classes.some(cls => {
    const name = cls.name || '';
    const hasImplicationSuffix = name.endsWith('Implications');
    const hasXStateConfig = cls.staticProperties.some(p => p.name === 'xstateConfig');
    const hasMirrorsOn = cls.staticProperties.some(p => p.name === 'mirrorsOn');
    
    return hasImplicationSuffix || hasXStateConfig || hasMirrorsOn;
  });
}

/**
 * Extract metadata from an Implication class
 */
export function extractImplicationMetadata(parsed, extractXStateMetadata = null, extractUIImplications = null) {
  const metadata = {
    className: null,
    isStateful: false,
    hasXStateConfig: false,
    hasMirrorsOn: false,
    pattern: null,
    
    // Fields from xstateConfig.meta
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
    
    // ✅ ADD: UI implications
    uiCoverage: {
      total: 0,
      platforms: {}
    }
  };
  
  // Use the simplified structure from parseFile
  if (!parsed.classes || parsed.classes.length === 0) {
    return metadata;
  }
  
  // Find the Implication class
  const implClass = parsed.classes.find(cls => 
    cls.name && (
      cls.name.endsWith('Implications') ||
      cls.staticProperties.some(p => p.name === 'xstateConfig' || p.name === 'mirrorsOn')
    )
  );
  
  if (!implClass) return metadata;
  
  metadata.className = implClass.name;
  
  // Determine if stateful (Booking pattern)
  if (metadata.className.includes('Booking')) {
    metadata.pattern = 'booking';
    metadata.isStateful = true;
  }
  
  // Check for xstateConfig
  const hasXStateConfig = implClass.staticProperties.some(p => p.name === 'xstateConfig');
  if (hasXStateConfig) {
    metadata.hasXStateConfig = true;
    
    // Extract meta from content
    if (parsed.content && extractXStateMetadata) {
      const xstateMetadata = extractXStateMetadata(parsed.content);
      Object.assign(metadata, xstateMetadata);
    }
  }
  
  // Check for mirrorsOn
  const hasMirrorsOn = implClass.staticProperties.some(p => p.name === 'mirrorsOn');
if (hasMirrorsOn) {
  metadata.hasMirrorsOn = true;
  
  console.log('🔍 Has mirrorsOn, extracting UI...', {
    hasContent: !!parsed.content,
    hasExtractor: !!extractUIImplications
  });
  
  // Extract UI implications
  if (parsed.content && extractUIImplications) {
    metadata.uiCoverage = extractUIImplications(parsed.content);
    console.log('✅ Extracted UI coverage:', metadata.uiCoverage);
  } else {
    console.log('⚠️ Cannot extract UI - missing content or extractor');
  }
}
  
  return metadata;
}

/**
 * Helper: Extract meta fields from file content
 */
function extractMetaFromContent(content) {
  const metadata = {};
  
  try {
    const { parse } = require('@babel/parser');
    const traverse = require('@babel/traverse').default;
    
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
    // Find xstateConfig.meta
    traverse(ast, {
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
                const extractedValue = extractValueFromAST(prop.value);
                
                if (extractedValue !== null && extractedValue !== undefined) {
                  metadata[key] = extractedValue;
                }
              });
              
              // Handle setup array/object
              if (metadata.setup) {
                if (Array.isArray(metadata.setup)) {
                  metadata.platforms = metadata.setup
                    .map(s => s.platform)
                    .filter(Boolean);
                  if (!metadata.platform && metadata.platforms.length > 0) {
                    metadata.platform = metadata.platforms[0];
                  }
                } else if (metadata.setup.platform) {
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
    console.error('Error extracting meta from content:', error.message);
  }
  
  return metadata;
}

/**
 * Helper: Extract value from AST node
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
        .map(el => extractValueFromAST(el))
        .filter(v => v !== null && v !== undefined);
      
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
      if (node.quasis && node.quasis.length === 1) {
        return node.quasis[0].value.cooked;
      }
      return null;
      
    default:
      return null;
  }
}