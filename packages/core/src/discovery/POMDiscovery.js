// packages/core/src/discovery/POMDiscovery.js
// ✨ FIXED: Proper recursive search with glob!
import fs from 'fs/promises';
import path from 'path';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import { promisify } from 'util';
import globCallback from 'glob';

const glob = promisify(globCallback);

// Handle default export from @babel/traverse
const traverseAST = traverse.default || traverse;

/**
 * POMDiscovery - Scans project for Page Object Models
 * Extracts getters, properties, methods WITH PARAMETERS
 */
class POMDiscovery {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.pomCache = new Map();
  }

  /**
   * Main entry point - discover all POMs in project
   */
  async discover() {
    console.log('🔍 Discovering Page Object Models...');
    
    const pomFiles = await this._findPOMFiles();
    console.log(`   Found ${pomFiles.length} POM files`);
    
    const poms = [];
    for (const filePath of pomFiles) {
      try {
        const structure = await this._extractPOMStructure(filePath);
        if (structure) {
          poms.push(structure);
          this.pomCache.set(structure.name, structure);
        }
      } catch (error) {
        console.error(`   ⚠️  Failed to parse ${filePath}: ${error.message}`);
      }
    }
    
    console.log(`   ✅ Extracted ${poms.length} POM structures`);
    return poms;
  }

  /**
   * ✅ FIXED: Find all POM files using glob patterns
   */
  async _findPOMFiles() {
    // ✅ Use glob patterns to search ANYWHERE in project
    const patterns = [
      '**/screenObjects/**/*.js',
      '**/pages/**/*.js',
      '**/pom/**/*.js',
      '**/pageObjects/**/*.js'
    ];

    const pomFiles = [];

    for (const pattern of patterns) {
      try {
        console.log(`   🔍 Searching: ${pattern}`);
        
        const files = await glob(pattern, {
          cwd: this.projectPath,
          absolute: true,
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**'
          ]
        });
        
        console.log(`      Found ${files.length} files`);
        pomFiles.push(...files);
      } catch (error) {
        console.error(`   ⚠️  Pattern ${pattern} failed: ${error.message}`);
      }
    }

    // ✅ Deduplicate (in case files match multiple patterns)
    const uniqueFiles = [...new Set(pomFiles)];
    console.log(`   📦 Total unique POM files: ${uniqueFiles.length}`);
    
    return uniqueFiles;
  }

  /**
   * Extract POM structure from file
   */
  async _extractPOMStructure(filePath) {
    const code = await fs.readFile(filePath, 'utf-8');
    
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    const structure = {
      name: path.basename(filePath, '.js'),
      path: path.relative(this.projectPath, filePath),
      classes: [],
      exports: null
    };

    traverseAST(ast, {
      ClassDeclaration: (nodePath) => {
        const classInfo = this._extractClassInfo(nodePath.node);
        structure.classes.push(classInfo);
      },
      
      ExportDefaultDeclaration: (nodePath) => {
        if (nodePath.node.declaration.type === 'Identifier') {
          structure.exports = nodePath.node.declaration.name;
        } else if (nodePath.node.declaration.type === 'ClassDeclaration') {
          structure.exports = nodePath.node.declaration.id.name;
        }
      },
      
      AssignmentExpression: (nodePath) => {
        if (
          nodePath.node.left.type === 'MemberExpression' &&
          nodePath.node.left.object.name === 'module' &&
          nodePath.node.left.property.name === 'exports'
        ) {
          if (nodePath.node.right.type === 'Identifier') {
            structure.exports = nodePath.node.right.name;
          }
        }
      }
    });

    return structure.classes.length > 0 ? structure : null;
  }

  /**
   * Extract class information (getters, properties, methods WITH PARAMETERS!)
   * ✨ ENHANCED!
   */
  _extractClassInfo(classNode) {
    const classInfo = {
      name: classNode.id ? classNode.id.name : 'Anonymous',
      getters: [],
      properties: [],
      methods: [],
      functions: [],  // ✨ NEW: Functions with parameters
      constructor: null
    };

    // Extract constructor info
    const constructorNode = classNode.body.body.find(
      node => node.kind === 'constructor'
    );
    
    if (constructorNode) {
      classInfo.constructor = {
        params: constructorNode.params.map(p => p.name || 'unknown')
      };
      
      // Extract properties assigned in constructor
      const constructorAST = {
        type: 'File',
        program: {
          type: 'Program',
          body: constructorNode.body.body
        }
      };
      
      traverseAST(constructorAST, {
        AssignmentExpression: (innerPath) => {
          const node = innerPath.node;
          if (
            node.left.type === 'MemberExpression' &&
            node.left.object.type === 'ThisExpression'
          ) {
            const propName = node.left.property.name;
            
            if (node.right.type === 'NewExpression' && node.right.callee.name) {
              classInfo.properties.push({
                name: propName,
                type: 'instance',
                className: node.right.callee.name
              });
            } else {
              classInfo.properties.push({
                name: propName,
                type: 'property'
              });
            }
          }
        }
      });
    }

    // Extract getters, setters, methods
    for (const member of classNode.body.body) {
      if (member.kind === 'get') {
        classInfo.getters.push({
          name: member.key.name,
          async: member.async || false
        });
      } else if (member.kind === 'method' && member.key.name !== 'constructor') {
        // ✨ NEW: Extract parameters!
        const params = this._extractParameters(member.params);
        
        // Add to methods array (legacy format)
        classInfo.methods.push({
          name: member.key.name,
          async: member.async || false
        });
        
        // ✨ NEW: If has parameters, also add to functions array
        if (params.length > 0) {
          classInfo.functions.push({
            name: member.key.name,
            async: member.async || false,
            parameters: params,
            paramNames: params.map(p => p.name),
            signature: this._buildSignature(member.key.name, params)
          });
        }
      }
    }

    return classInfo;
  }

  /**
   * ✨ NEW: Extract parameters from method
   */
  _extractParameters(params) {
    return params.map(param => {
      let paramName;
      let hasDefault = false;
      let defaultValue = undefined;
      
      if (param.type === 'Identifier') {
        // Simple: function(name)
        paramName = param.name;
      } else if (param.type === 'AssignmentPattern') {
        // Default: function(name = "default")
        paramName = param.left.name;
        hasDefault = true;
        defaultValue = this._extractDefaultValue(param.right);
      } else if (param.type === 'RestElement') {
        // Rest: function(...args)
        paramName = `...${param.argument.name}`;
      } else {
        paramName = 'unknown';
      }
      
      return {
        name: paramName,
        hasDefault,
        defaultValue
      };
    });
  }

  /**
   * ✨ NEW: Extract default value from AST node
   */
  _extractDefaultValue(node) {
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
        return {};
      case 'ArrayExpression':
        return [];
      default:
        return undefined;
    }
  }

  /**
   * ✨ NEW: Build function signature string
   */
  _buildSignature(name, params) {
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
   * Get available paths for a POM
   */
  getAvailablePaths(pomName, instanceName = null) {
    const pom = this.pomCache.get(pomName);
    if (!pom) return [];

    const paths = [];
    
    for (const cls of pom.classes) {
      if (instanceName) {
        const instanceProp = cls.properties.find(
          p => p.name === instanceName && p.type === 'instance'
        );
        
        if (instanceProp) {
          const instanceClass = pom.classes.find(c => c.name === instanceProp.className);
          if (instanceClass) {
            for (const getter of instanceClass.getters) {
              paths.push(`${instanceName}.${getter.name}`);
            }
          }
        }
      } else {
        const hasInstances = cls.properties.some(p => p.type === 'instance');
        
        if (!hasInstances) {
          for (const getter of cls.getters) {
            paths.push(getter.name);
          }
          
          for (const prop of cls.properties) {
            if (prop.type === 'property') {
              paths.push(prop.name);
            }
          }
        }
      }
    }

    return paths;
  }

  /**
   * ✨ NEW: Get functions for a POM
   */
  getFunctions(pomName) {
    const pom = this.pomCache.get(pomName);
    if (!pom) return [];
    
    const functions = [];
    
    for (const cls of pom.classes) {
      if (cls.functions) {
        functions.push(...cls.functions);
      }
    }
    
    return functions;
  }

  /**
   * Validate a POM path exists
   */
  validatePath(pomName, pathString) {
    const availablePaths = this.getAvailablePaths(pomName);
    return availablePaths.includes(pathString);
  }

  /**
   * Get POM instances
   */
  getInstances(pomName) {
    const pom = this.pomCache.get(pomName);
    if (!pom) return [];

    const instances = [];
    
    for (const cls of pom.classes) {
      for (const prop of cls.properties) {
        if (prop.type === 'instance') {
          instances.push({
            name: prop.name,
            className: prop.className
          });
        }
      }
    }

    return instances;
  }
}

export default POMDiscovery;