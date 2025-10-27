// packages/core/src/discovery/POMDiscovery.js

import fs from 'fs/promises';
import path from 'path';
import parser from '@babel/parser';
import traverse from '@babel/traverse';

// Handle default export from @babel/traverse
const traverseAST = traverse.default || traverse;

/**
 * POMDiscovery - Scans project for Page Object Models
 * Extracts getters, properties, and structure
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
   * Find all POM files in project
   * Looks in common locations: screenObjects, pages, pom, pageObjects
   */
  async _findPOMFiles() {
    const searchPaths = [
      'tests/screenObjects',
      'tests/pages',
      'tests/pom',
      'tests/pageObjects',
      'src/screenObjects',
      'src/pages',
      'src/pom',
      'src/pageObjects'
    ];

    const pomFiles = [];

    for (const searchPath of searchPaths) {
      const fullPath = path.join(this.projectPath, searchPath);
      
      try {
        const exists = await fs.access(fullPath).then(() => true).catch(() => false);
        if (!exists) continue;

        const files = await this._scanDirectory(fullPath);
        pomFiles.push(...files);
      } catch (error) {
        // Directory doesn't exist, skip
      }
    }

    return pomFiles;
  }

  /**
   * Recursively scan directory for .js files
   */
  async _scanDirectory(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Recurse into subdirectories
          const subFiles = await this._scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
    
    return files;
  }

  /**
   * Extract POM structure from file
   */
  async _extractPOMStructure(filePath) {
    const code = await fs.readFile(filePath, 'utf-8');
    
    // Parse with Babel
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

    // Traverse AST to find classes
    traverseAST(ast, {
      ClassDeclaration: (nodePath) => {
        const classInfo = this._extractClassInfo(nodePath.node);
        structure.classes.push(classInfo);
      },
      
      ExportDefaultDeclaration: (nodePath) => {
        // Track default export
        if (nodePath.node.declaration.type === 'Identifier') {
          structure.exports = nodePath.node.declaration.name;
        } else if (nodePath.node.declaration.type === 'ClassDeclaration') {
          structure.exports = nodePath.node.declaration.id.name;
        }
      },
      
      AssignmentExpression: (nodePath) => {
        // Handle module.exports = ClassName
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
   * Extract class information (getters, properties, methods)
   */
  _extractClassInfo(classNode) {
    const classInfo = {
      name: classNode.id ? classNode.id.name : 'Anonymous',
      getters: [],
      properties: [],
      methods: [],
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
      // Create a simple AST for just the constructor body
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
            
            // Check if it's a sub-object (like this.oneWayTicket = new OneWayTicket())
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
        classInfo.methods.push({
          name: member.key.name,
          async: member.async || false
        });
      }
    }

    return classInfo;
  }

  /**
   * Get available paths for a POM (for user guidance)
   */
  getAvailablePaths(pomName, instanceName = null) {
    const pom = this.pomCache.get(pomName);
    if (!pom) return [];

    const paths = [];
    
    for (const cls of pom.classes) {
      // If looking for specific instance
      if (instanceName) {
        const instanceProp = cls.properties.find(
          p => p.name === instanceName && p.type === 'instance'
        );
        
        if (instanceProp) {
          // Find the instance class
          const instanceClass = pom.classes.find(c => c.name === instanceProp.className);
          if (instanceClass) {
            // Return paths like "oneWayTicket.inputDeparture"
            for (const getter of instanceClass.getters) {
              paths.push(`${instanceName}.${getter.name}`);
            }
          }
        }
      } else {
        // Return all top-level getters
        for (const getter of cls.getters) {
          paths.push(getter.name);
        }
      }
    }

    return paths;
  }

  /**
   * Validate a POM path exists
   */
  validatePath(pomName, pathString) {
    const availablePaths = this.getAvailablePaths(pomName);
    
    // Check if path exists in available paths
    return availablePaths.includes(pathString);
  }

  /**
   * Get POM instances (like oneWayTicket, roundTrip)
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