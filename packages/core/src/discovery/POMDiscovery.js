// packages/core/src/discovery/POMDiscovery.js
// ✨ ENHANCED v2.0: Navigation Support + All Methods Extraction
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
 * POMDiscovery - Scans project for Page Object Models AND Navigation Files
 * Extracts getters, properties, methods WITH PARAMETERS
 * 
 * ✨ v2.0 Changes:
 * - Extracts ALL methods (not just ones with params)
 * - Adds navigation file discovery
 * - Platform-aware filtering
 */
class POMDiscovery {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.pomCache = new Map();
    this.navigationCache = new Map(); // ✅ NEW: Cache for navigation files
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
  
  // ✅ FIX: Cache ALL classes, not just first one
  for (const cls of structure.classes) {
    if (cls.name) {
      this.pomCache.set(cls.name, structure);
    }
  }

          
          // ✅ NEW: Check if this is a navigation file
          if (this._isNavigationFile(filePath, structure)) {
            this._cacheNavigationFile(filePath, structure);
          }
        }
      } catch (error) {
        console.error(`   ⚠️  Failed to parse ${filePath}: ${error.message}`);
      }
    }
    
console.log(`   ✅ Extracted ${poms.length} POM structures`);

// ✅ ADD THIS DEBUG:
console.log('\n🐛 DEBUG: POMs being returned:');
for (const pom of poms) {
  console.log(`   📄 ${pom.name}:`);
  console.log(`      Classes: ${pom.classes.map(c => c.name).join(', ')}`);
  console.log(`      Exports: ${pom.exports}`);
}

console.log(`   🧭 Found ${this.navigationCache.size} navigation files`);
    return poms;
  }

  /**
   * ✅ NEW: Check if file is a navigation file
   */
  _isNavigationFile(filePath, structure) {
    const fileName = path.basename(filePath).toLowerCase();
    const className = structure.classes?.[0]?.name?.toLowerCase() || '';
    
    return fileName.includes('navigation') || className.includes('navigation');
  }

  /**
   * ✅ NEW: Cache navigation file with platform info
   */
  _cacheNavigationFile(filePath, structure) {
    const platform = this._detectPlatform(filePath);
    const className = structure.classes?.[0]?.name || structure.name;
    
    // Get ALL methods (not just ones with params)
    const methods = [];
    for (const cls of structure.classes || []) {
      // Add from functions array (methods with params)
      if (cls.functions) {
        methods.push(...cls.functions);
      }
      
      // ✅ ALSO add methods without params that aren't in functions
      if (cls.methods) {
        for (const method of cls.methods) {
          const alreadyAdded = methods.some(m => m.name === method.name);
          if (!alreadyAdded) {
            methods.push({
              name: method.name,
              async: method.async,
              parameters: [],
              paramNames: [],
              signature: `${method.name}()`
            });
          }
        }
      }
    }
    
    const navFile = {
      className,
      displayName: `${className} (${platform})`,
      path: filePath,
      relativePath: path.relative(this.projectPath, filePath),
      platform,
      methods
    };
    
    // Cache by platform for quick filtering
    const cacheKey = `${platform}:${className}`;
    this.navigationCache.set(cacheKey, navFile);
    
    console.log(`   🧭 Navigation: ${className} (${platform}) - ${methods.length} methods`);
  }

/**
 * ✅ IMPROVED: Detect platform from file path
 * Handles complex paths like:
 * - /tests/mobile/android/dancer/screenObjects/... → dancer
 * - /tests/mobile/android/manager/actions/... → manager
 * - /tests/web/current/actions/... → web
 * - /tests/mobile/android/legacy/dancer_V2/... → dancer (legacy)
 */
_detectPlatform(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  
  // ✅ Check for specific platform folders (order matters - most specific first!)
  
  // Web platform
  if (normalizedPath.includes('/web/')) {
    return 'web';
  }
  
  // Dancer platform (mobile)
  if (
    normalizedPath.includes('/dancer/') ||
    normalizedPath.includes('/android/dancer/') ||
    normalizedPath.includes('/ios/dancer/') ||
    normalizedPath.includes('/dancer_v') ||  // Legacy: dancer_V2, dancer_V2.2
    normalizedPath.match(/\/dancer[_-]?v?\d/i)  // Match dancer_V2, dancerV2, dancer-v2
  ) {
    return 'dancer';
  }
  
  // Manager platform (mobile)
  if (
    normalizedPath.includes('/manager/') ||
    normalizedPath.includes('/android/manager/') ||
    normalizedPath.includes('/ios/manager/') ||
    normalizedPath.includes('/manager_v') ||  // Legacy: manager_V2, manager_V2.2
    normalizedPath.match(/\/manager[_-]?v?\d/i)  // Match manager_V2, managerV2, manager-v2
  ) {
    return 'manager';
  }
  
  // iOS platform (generic)
  if (normalizedPath.includes('/ios/')) {
    return 'ios';
  }
  
  // Mobile platform (generic - if can't determine dancer/manager)
  if (normalizedPath.includes('/mobile/') || normalizedPath.includes('/android/')) {
    return 'mobile';
  }
  
  return 'unknown';
}
  /**
   * ✅ NEW: Get navigation files for a specific platform
   */
  getNavigationFiles(platform = null) {
    const results = [];
    
    for (const [key, navFile] of this.navigationCache.entries()) {
      if (!platform || navFile.platform === platform) {
        results.push(navFile);
      }
    }
    
    return results;
  }

  /**
   * ✅ NEW: Get navigation methods for a specific class and platform
   */
  getNavigationMethods(className, platform = null) {
    // Try exact match first
    const cacheKey = platform ? `${platform}:${className}` : null;
    
    if (cacheKey && this.navigationCache.has(cacheKey)) {
      return this.navigationCache.get(cacheKey).methods;
    }
    
    // Fall back to searching by class name only
    for (const [key, navFile] of this.navigationCache.entries()) {
      if (navFile.className === className) {
        if (!platform || navFile.platform === platform) {
          return navFile.methods;
        }
      }
    }
    
    return [];
  }

/**
 * ✅ GENERIC: Find all POM files using config patterns OR defaults
 */
async _findPOMFiles() {
  // Try to load config from project
  const patterns = await this._loadPOMPatterns();
  
  console.log(`   🔍 Using ${patterns.length} pattern(s) for POM discovery`);

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
          '**/.next/**',
        ]
      });
      
      if (files.length > 0) {
        console.log(`      ✅ Found ${files.length} files`);
        pomFiles.push(...files);
      }
    } catch (error) {
      console.error(`   ⚠️  Pattern ${pattern} failed: ${error.message}`);
    }
  }

  // Deduplicate
  const uniqueFiles = [...new Set(pomFiles)];
  console.log(`   📦 Total unique POM files: ${uniqueFiles.length}`);
  
  return uniqueFiles;
}

/**
 * ✅ NEW: Load POM patterns from ai-testing.config.js or use defaults
 */
async _loadPOMPatterns() {
  const configPath = path.join(this.projectPath, 'ai-testing.config.js');
  
  try {
    // Check if config exists
    await fs.access(configPath);
    
    // Dynamic import for ESM compatibility
    const configModule = await import(`file://${configPath}`);
    const config = configModule.default || configModule;
    
    if (config.discovery?.poms && config.discovery.poms.length > 0) {
      console.log(`   ✅ Loaded ${config.discovery.poms.length} POM pattern(s) from ai-testing.config.js`);
      return config.discovery.poms;
    }
  } catch (error) {
    // Config doesn't exist or can't be loaded
    console.log(`   ℹ️  No ai-testing.config.js found, using default patterns`);
  }
  
  // Default patterns (generic, should work for most projects)
  return [
    '**/screenObjects/**/*.js',
    '**/pages/**/*.js',
    '**/screens/**/*.js',
    '**/pom/**/*.js',
    '**/pageObjects/**/*.js',
    '**/*.page.js',
    '**/*.screen.js',
  ];
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
   * ✨ ENHANCED: Now extracts ALL methods, not just ones with params
   */
  _extractClassInfo(classNode) {
    const classInfo = {
      name: classNode.id ? classNode.id.name : 'Anonymous',
      getters: [],
      properties: [],
      methods: [],
      functions: [],  // ✨ ALL functions with full signatures
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
        // ✨ Extract parameters
        const params = this._extractParameters(member.params);
        
        // Add to methods array (legacy format)
        classInfo.methods.push({
          name: member.key.name,
          async: member.async || false
        });
        
        // ✅ FIXED: Add ALL methods to functions array (not just ones with params)
        classInfo.functions.push({
          name: member.key.name,
          async: member.async || false,
          parameters: params,
          paramNames: params.map(p => p.name),
          signature: this._buildSignature(member.key.name, params)
        });
      }
    }

    return classInfo;
  }

  /**
   * ✨ Extract parameters from method
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
   * ✨ Extract default value from AST node
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
   * ✨ Build function signature string
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
   * ✅ FIXED: Get ALL functions for a POM (including ones without params)
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
  /**
   * ✅ NEW: Get direct getters from main class (even if it has instances)
   * This handles POMs like SearchBarWrapper that have BOTH:
   * - Instance properties (roundTrip, oneWayTicket)
   * - Direct getters (linkAgencyChange, agencyName, etc.)
   */
  getDirectGetters(pomName) {
    const pom = this.pomCache.get(pomName);
    if (!pom) return [];

    const directGetters = [];
    
    // Get the main/exported class (usually first or the exported one)
    const mainClass = pom.classes.find(c => c.name === pom.exports) || pom.classes[0];
    
    if (mainClass) {
      // Add all getters from the main class
      for (const getter of mainClass.getters || []) {
        directGetters.push(getter.name);
      }
      
      // Also add direct properties (not instances)
      for (const prop of mainClass.properties || []) {
        if (prop.type === 'property') {
          directGetters.push(prop.name);
        }
      }
    }
    
    console.log(`   📦 getDirectGetters(${pomName}): found ${directGetters.length} direct fields`);
    return directGetters;
  }
}





export default POMDiscovery;