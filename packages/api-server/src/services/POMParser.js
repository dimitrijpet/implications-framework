// packages/api-server/src/services/POMParser.js
// Enhanced POM Parser - Handles both instances AND direct getters

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs/promises';

/**
 * Extract POM structure from a file
 * Handles 3 patterns:
 * 1. Instance properties (searchBar.wrapper → oneWayTicket, roundTrip)
 * 2. Direct getters (bookingConfirmation.screen → get btnConfirm())
 * 3. Constructor properties (this.btnConfirm = ...)
 */
export async function extractPOMStructure(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
    
   const result = {
  className: null,
  instances: [],
  directGetters: [],
  constructorFields: [],
  functions: [],  // ✨ ADD THIS LINE
  instancePaths: {}
};
    
    traverse.default(ast, {
      ClassDeclaration(classPath) {
        const className = classPath.node.id?.name;
        if (!className) return;
        
        result.className = className;
        console.log(`  📦 Found class: ${className}`);
        
        // Extract constructor to find instances and properties
        classPath.node.body.body.forEach(member => {
          
          // 🎯 PATTERN 1: Constructor instances
          if (member.type === 'ClassMethod' && member.kind === 'constructor') {
            member.body.body.forEach(statement => {
              if (statement.type === 'ExpressionStatement' &&
                  statement.expression.type === 'AssignmentExpression') {
                
                const left = statement.expression.left;
                const right = statement.expression.right;
                
                // Check if it's: this.something = new SomeClass(...)
                if (left.type === 'MemberExpression' &&
                    left.object.type === 'ThisExpression' &&
                    right.type === 'NewExpression' &&
                    right.callee.type === 'Identifier') {
                  
                  const instanceName = left.property.name;
                  const instanceClass = right.callee.name;
                  
                  result.instances.push({
                    name: instanceName,
                    className: instanceClass
                  });
                  
                  console.log(`    🔹 Instance: ${instanceName} (${instanceClass})`);
                }
                
                // Check if it's: this.btnSomething = page.locator(...)
                else if (left.type === 'MemberExpression' &&
                         left.object.type === 'ThisExpression') {
                  
                  const fieldName = left.property.name;
                  result.constructorFields.push(fieldName);
                  console.log(`    🔸 Constructor field: ${fieldName}`);
                }
              }
            });
          }
          
          // 🎯 PATTERN 2: Direct getters
          else if (member.type === 'ClassMethod' && member.kind === 'get') {
            const getterName = member.key.name;
            result.directGetters.push(getterName);
            console.log(`    ✨ Getter: ${getterName}`);
          }

         else if (member.type === 'ClassMethod' && member.kind === 'method') {
  const methodName = member.key.name;
  const isAsync = member.async || false;
  
  // ✨ NEW: Extract parameters
  const params = member.params.map(param => {
    // Handle different parameter types
    let paramName;
    let hasDefault = false;
    let defaultValue = undefined;
    
    if (param.type === 'Identifier') {
      // Simple param: function(name)
      paramName = param.name;
    } else if (param.type === 'AssignmentPattern') {
      // Default param: function(name = "default")
      paramName = param.left.name;
      hasDefault = true;
      defaultValue = extractDefaultValue(param.right);
    } else if (param.type === 'RestElement') {
      // Rest param: function(...args)
      paramName = `...${param.argument.name}`;
    } else {
      // Other types (destructuring, etc.)
      paramName = 'unknown';
    }
    
    return {
      name: paramName,
      hasDefault,
      defaultValue
    };
  });
  
  // ✨ Build signature string
  const signature = buildMethodSignature(methodName, params);
  
  result.methods.push({
    name: methodName,
    async: isAsync,
    parameters: params,
    paramNames: params.map(p => p.name),  // Quick access
    signature  // "helperLogin(username, password)"
  });
}
        });
      }
    });
    
    // Build instancePaths for validation
    buildInstancePaths(result);
    
    return result;
    
  } catch (error) {
    console.error(`  ❌ Error parsing ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Build flattened paths for validation
 */
function buildInstancePaths(result) {
  // If we have instances, we already handled them
  // (searchBar.wrapper → oneWayTicket, roundTrip)
  
  // If we have direct getters or constructor fields, add them to "default" instance
  const directFields = [
    ...result.directGetters,
    ...result.constructorFields
  ];
  
  if (directFields.length > 0) {
    result.instancePaths['default'] = directFields;
    console.log(`  📝 Added ${directFields.length} fields to "default" instance`);
  }

  if (result.functions.length > 0) {
  console.log(`  🎯 Found ${result.functions.length} functions with parameters`);
}
  
  // Note: Instance fields will be discovered by recursively parsing instance classes
  // This is handled by the POMDiscovery service
}


/**
 * Extract default value from AST node
 */
function extractDefaultValue(node) {
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
    case 'ObjectExpression':
      return {}; // Simplified - could parse full object
    case 'ArrayExpression':
      return []; // Simplified - could parse full array
    default:
      return undefined; // Complex expression
  }
}

/**
 * Build method signature string
 */
function buildMethodSignature(name, params) {
  if (params.length === 0) {
    return `${name}()`;
  }
  
  const paramStrings = params.map(p => {
    if (p.hasDefault && p.defaultValue !== undefined) {
      const valueStr = typeof p.defaultValue === 'string' 
        ? `"${p.defaultValue}"` 
        : JSON.stringify(p.defaultValue);
      return `${p.name} = ${valueStr}`;
    }
    return p.name;
  });
  
  return `${name}(${paramStrings.join(', ')})`;
}

/**
 * Build function signature string
 */
function buildSignature(name, params) {
  const paramStrings = params.map(p => {
    if (p.hasDefault && p.defaultValue !== undefined) {
      return `${p.name} = ${JSON.stringify(p.defaultValue)}`;
    }
    return p.name;
  });
  
  return `${name}(${paramStrings.join(', ')})`;
}

export default { extractPOMStructure };