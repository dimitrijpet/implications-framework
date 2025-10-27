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
      instances: [],          // { name: 'oneWayTicket', className: 'OneWayTicket' }
      directGetters: [],      // Direct getters on main class
      constructorFields: [],  // Fields set in constructor
      instancePaths: {}       // Flattened paths for validation
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
  
  // Note: Instance fields will be discovered by recursively parsing instance classes
  // This is handled by the POMDiscovery service
}

export default { extractPOMStructure };