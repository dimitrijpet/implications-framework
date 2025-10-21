# Metadata Extraction System - Complete Guide

## 🎯 Overview

The metadata extraction system parses JavaScript files using Babel AST to extract structured information from implication classes.

---

## 🏗️ Architecture
```
JavaScript File → Babel Parser → AST → Traverse → Extract Metadata → Return Object
```

**Key Principle:** Extract happens in `api-server` (has Babel), results passed to `core`

---

## 📦 Component Breakdown

### 1. File Parser: `astParser.js`

**Location:** `packages/api-server/src/services/astParser.js`

**Purpose:** Parse JavaScript files into simplified AST structure
```javascript
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs-extra';

export async function parseFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Parse with all features enabled
  const ast = parse(content, {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties', 'objectRestSpread'],
  });
  
  const result = {
    path: filePath,
    content: content,  // ✅ Keep content for deep parsing
    classes: [],
    functions: [],
    imports: [],
    exports: [],
  };
  
  // Traverse AST to extract structure
  traverse.default(ast, {
    ClassDeclaration(path) {
      // Extract class info
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
  });
  
  return result;
}
```

---

### 2. XState Metadata Extractor

**Function:** `extractXStateMetadata(content)`

**Purpose:** Extract all fields from `xstateConfig.meta`
```javascript
export function extractXStateMetadata(content) {
  console.log('🔍 Extracting XState metadata...');
  
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
              
              // ✅ Handle setup array/object
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
```

**Extracted Fields:**
- `status` - State name (e.g., "Accepted")
- `triggerAction` - Action that triggers this state
- `triggerButton` - Button name (e.g., "ACCEPT")
- `afterButton` - Button shown after action
- `previousButton` - Previous state button
- `platform` - Platform name (mobile-manager, web, etc.)
- `platforms` - Array of all platforms
- `notificationKey` - Notification identifier
- `statusCode` - Status code string
- `statusNumber` - Numeric status
- `requiredFields` - Array of required test data fields
- `requires` - Prerequisites object
- `setup` - Setup configuration (array or object)

---

### 3. UI Implications Extractor

**Function:** `extractUIImplications(content)`

**Purpose:** Extract screen validations from `mirrorsOn.UI`
```javascript
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
          const value = path.node.value;
          
          if (value?.type === 'ObjectExpression') {
            // Find UI property
            const uiProperty = value.properties.find(
              p => p.key?.name === 'UI'
            );
            
            if (uiProperty?.value?.type === 'ObjectExpression') {
              // Extract platforms
              uiProperty.value.properties.forEach(platformProp => {
                const platformName = platformProp.key?.name;
                if (!platformName) return;
                
                const screens = [];
                
                // Each platform has screens
                if (platformProp.value?.type === 'ObjectExpression') {
                  platformProp.value.properties.forEach(screenProp => {
                    const screenName = screenProp.key?.name;
                    if (!screenName) return;
                    
                    // ✅ Handle ArrayExpression (screens are arrays!)
                    if (screenProp.value?.type === 'ArrayExpression') {
                      // Parse each validation object in array
                      screenProp.value.elements.forEach((validationNode, idx) => {
                        const screenData = parseScreenValidation(validationNode);
                        
                        if (screenData) {
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
                    }
                  });
                }
                
                if (screens.length > 0) {
                  uiData.platforms[platformName] = {
                    count: screens.length,
                    screens: screens
                  };
                  uiData.total += screens.length;
                }
              });
            }
          }
        }
      },
    });
    
  } catch (error) {
    console.error('Error extracting UI implications:', error.message);
  }
  
  return uiData;
}

// Parse a screen validation object
function parseScreenValidation(node) {
  // Handle function calls (mergeWithBase)
  if (node?.type === 'CallExpression') {
    console.log('⚠️ Screen uses function call (mergeWithBase), showing basic info');
    return {
      description: 'Screen validation defined',
      visible: [],
      hidden: [],
      checks: { visible: [], hidden: [], text: {} }
    };
  }
  
  // Handle direct objects
  if (node?.type === 'ObjectExpression') {
    const screenData = {
      description: '',
      visible: [],
      hidden: [],
      checks: { visible: [], hidden: [], text: {} }
    };
    
    node.properties.forEach(prop => {
      if (!prop.key) return;
      
      const key = prop.key.name;
      const value = prop.value;
      
      switch (key) {
        case 'description':
          if (value.type === 'StringLiteral') {
            screenData.description = value.value;
          }
          break;
          
        case 'visible':
          if (value.type === 'ArrayExpression') {
            screenData.visible = value.elements
              .map(el => extractValueFromNode(el))
              .filter(Boolean);
          }
          break;
          
        case 'hidden':
          if (value.type === 'ArrayExpression') {
            screenData.hidden = value.elements
              .map(el => extractValueFromNode(el))
              .filter(Boolean);
          }
          break;
          
        case 'checks':
          if (value.type === 'ObjectExpression') {
            screenData.checks = parseChecksObject(value);
          }
          break;
      }
    });
    
    return screenData;
  }
  
  // Fallback
  return {
    description: 'Screen validation detected',
    visible: [],
    hidden: [],
    checks: { visible: [], hidden: [], text: {} }
  };
}

// Parse checks object (visible, hidden, text)
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
```

---

### 4. Value Extractor: `extractValueFromNode()`

**Purpose:** Extract primitive values from AST nodes
```javascript
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
```

---

### 5. Transition Extractor

**Function:** `extractXStateTransitions(parsed, className)`

**Purpose:** Extract transitions from `xstateConfig.on`
```javascript
export function extractXStateTransitions(parsed, className) {
  const transitions = [];
  
  try {
    const content = parsed.content || '';
    if (!content) return transitions;
    
    const ast = parse(content, {
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
```

---

## 🔗 Integration with Discovery Service

**Location:** `packages/api-server/src/services/discoveryService.js`
```javascript
import { 
  parseFile, 
  extractXStateMetadata, 
  extractUIImplications,
  extractXStateTransitions 
} from './astParser.js';

import { 
  isImplication, 
  extractImplicationMetadata 
} from '../../../core/src/patterns/implications.js';

async function classifyFile(parsed, result) {
  const relativePath = path.relative(result.projectPath, parsed.path);
  
  // Check for Implication
  if (isImplication(parsed)) {
    // ✅ Pass extractor functions from api-server to core
    const metadata = extractImplicationMetadata(
      parsed, 
      extractXStateMetadata,  // From api-server
      extractUIImplications   // From api-server
    );
    
    result.files.implications.push(new DiscoveredFile({
      path: relativePath,
      type: 'implication',
      className: metadata.className,
      metadata,
    }));
    
    // Extract transitions
    if (metadata.hasXStateConfig) {
      const transitions = extractXStateTransitions(parsed, metadata.className);
      result.transitions.push(...transitions);
    }
    
    return;
  }
  
  // ... handle sections, screens, tests
}
```

---

## 🧪 Example Extraction Flow

### Input File: `AcceptedBookingImplications.js`
```javascript
class AcceptedBookingImplications {
  static xstateConfig = {
    meta: {
      status: "Accepted",
      triggerButton: "ACCEPT",
      platform: "mobile-manager",
      requiredFields: ["dancerName", "clubName"]
    },
    on: {
      UNDO: 'pending',
      CANCEL: 'rejected'
    }
  };
  
  static mirrorsOn = {
    UI: {
      dancer: {
        notificationsScreen: [{
          description: "Accepted notification visible",
          visible: ['notification']
        }]
      }
    }
  };
}
```

### Extraction Steps

**Step 1:** `parseFile()` creates simplified AST
```javascript
{
  path: '/path/to/AcceptedBookingImplications.js',
  content: '...',
  classes: [{
    name: 'AcceptedBookingImplications',
    staticProperties: [
      { name: 'xstateConfig' },
      { name: 'mirrorsOn' }
    ]
  }]
}
```

**Step 2:** `isImplication()` returns `true`

**Step 3:** `extractImplicationMetadata()` calls extractors

**Step 4:** `extractXStateMetadata()` parses meta
```javascript
{
  status: "Accepted",
  triggerButton: "ACCEPT",
  platform: "mobile-manager",
  requiredFields: ["dancerName", "clubName"]
}
```

**Step 5:** `extractUIImplications()` parses UI
```javascript
{
  total: 1,
  platforms: {
    dancer: {
      count: 1,
      screens: [{
        name: 'notificationsScreen',
        description: 'Accepted notification visible',
        visible: ['notification'],
        hidden: [],
        checks: {}
      }]
    }
  }
}
```

**Step 6:** `extractXStateTransitions()` parses transitions
```javascript
[
  { event: 'UNDO', from: 'AcceptedBookingImplications', to: 'pending' },
  { event: 'CANCEL', from: 'AcceptedBookingImplications', to: 'rejected' }
]
```

**Step 7:** Combined result
```javascript
{
  className: 'AcceptedBookingImplications',
  isStateful: true,
  hasXStateConfig: true,
  hasMirrorsOn: true,
  pattern: 'booking',
  status: "Accepted",
  triggerButton: "ACCEPT",
  platform: "mobile-manager",
  requiredFields: ["dancerName", "clubName"],
  uiCoverage: { total: 1, platforms: {...} }
}
```

---

## ⚠️ Current Limitations

### 1. MergeWithBase Not Parsed
**Impact:** Screens using `ImplicationHelper.mergeWithBase()` show placeholder

**Workaround:** Show screen name and basic info

**Fix:** See PARSER-IMPROVEMENT-NEEDED.md

### 2. Dynamic Values Not Evaluated
```javascript
meta: {
  requiredFields: [...BaseFields, 'extra']  // Can't evaluate
}
```

**Impact:** Only extracts literals, not computed values

**Workaround:** Use static arrays

### 3. Complex Object Spreads
```javascript
meta: {
  ...baseMetadata,
  status: "Accepted"
}
```

**Impact:** Doesn't merge spread objects

**Workaround:** Define all fields explicitly

---

## 🎯 Best Practices

### For Implication Authors

**✅ DO:**
```javascript
meta: {
  status: "Accepted",  // Literal string
  requiredFields: ["dancerName", "clubName"],  // Literal array
  platform: "mobile-manager"  // Literal string
}
```

**❌ DON'T:**
```javascript
const STATUS = "Accepted";
meta: {
  status: STATUS,  // Reference not extracted
  requiredFields: BASE_FIELDS,  // Reference not extracted
}
```

### For Parser Developers

**Always:**
1. Check node type before accessing properties
2. Handle null/undefined gracefully
3. Return fallback values for unparseable nodes
4. Log warnings for unknown patterns
5. Test with real implication files

---

## 🔧 Debugging

### Enable Verbose Logging
```javascript
// In extractXStateMetadata
console.log('Found meta property with', metaProperty.value.properties.length, 'fields');
metaProperty.value.properties.forEach(prop => {
  console.log('  Field:', prop.key?.name, '=', extractValueFromNode(prop.value));
});
```

### Inspect AST
```javascript
// Pretty-print AST
console.log(JSON.stringify(ast, null, 2));

// Or use https://astexplorer.net/
// Paste your code, select @babel/parser
```

### Test Individual Extractors
```javascript
// Test file
const content = fs.readFileSync('AcceptedBookingImplications.js', 'utf-8');
const metadata = extractXStateMetadata(content);
console.log('Extracted:', metadata);
```

---

This extraction system is **the foundation** of the entire framework. Session 2 will improve it to handle complex patterns!