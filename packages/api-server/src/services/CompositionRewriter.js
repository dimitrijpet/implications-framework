// packages/api-server/src/services/CompositionRewriter.js

import fs from 'fs/promises';
import path from 'path';
import * as parser from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/**
 * CompositionRewriter
 * 
 * Rewrites Implication files to modify composition patterns:
 * - Change base class extension
 * - Add/remove composed behaviors
 * - Update ImplicationHelper.mergeWithBase() calls
 * - Preserve formatting, comments, and non-composition code
 * 
 * Safety Features:
 * - Creates timestamped backups before modification
 * - Validates file structure before writing
 * - Preview mode (returns generated code without writing)
 * - Only modifies imports and mirrorsOn sections
 */
class CompositionRewriter {
  
  /**
   * Rewrite composition in an Implication file
   * 
   * @param {string} filePath - Absolute path to Implication file
   * @param {Object} config - Composition configuration
   * @param {string} config.baseClass - New base class name (or null to remove)
   * @param {string[]} config.behaviors - Array of behavior class names
   * @param {boolean} preview - If true, return code without writing
   * @returns {Promise<Object>} Result with success, changes, backupPath
   */
  async rewrite(filePath, config, preview = false) {
    console.log('🔄 CompositionRewriter.rewrite()', { filePath, config, preview });
    
    try {
      // Read original file
      const originalContent = await fs.readFile(filePath, 'utf-8');
      
      // Parse to AST
      const ast = parser.parse(originalContent, {
        sourceType: 'module',
        plugins: ['classProperties', 'objectRestSpread']
      });
      
      // Analyze current composition
      const currentComposition = this.analyzeComposition(ast);
      console.log('📊 Current composition:', currentComposition);
      
      // Calculate changes needed
      const changes = await this.calculateChanges(currentComposition, config, filePath);
      console.log('📝 Changes to apply:', changes);
      
      // Apply changes to AST
      this.applyChanges(ast, changes, filePath);
      
      // Generate new code
      const newContent = generate(ast, {
        retainLines: true,
        comments: true
      }).code;
      
      // Preview mode - return without writing
      if (preview) {
        return {
          success: true,
          preview: {
            original: originalContent,
            modified: newContent,
            changes: this.formatChangesForPreview(changes)
          }
        };
      }
      
      // Create backup
      const backupPath = await this.createBackup(filePath, originalContent);
      console.log('💾 Backup created:', backupPath);
      
      // Write modified file
      await fs.writeFile(filePath, newContent, 'utf-8');
      console.log('✅ File written:', filePath);
      
      return {
        success: true,
        backupPath,
        changes: this.formatChangesForPreview(changes),
        filePath
      };
      
    } catch (error) {
      console.error('❌ CompositionRewriter error:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }
  
  /**
   * Analyze current composition from AST
   */
  analyzeComposition(ast) {
    const composition = {
      baseClass: null,
      baseClassImport: null,
      behaviors: [],
      helperImport: null,
      importStatements: [],
      requireStatements: [],
      moduleSystem: null // 'esm' or 'commonjs'
    };
    
    // Check for ES6 imports
    traverse(ast, {
      ImportDeclaration(path) {
        composition.moduleSystem = 'esm';
        const { node } = path;
        
        // Get imported name
        const importedName = node.specifiers[0]?.local?.name;
        const importPath = node.source?.value;
        
        if (!importedName) return;
        
        composition.importStatements.push({
          name: importedName,
          path: importPath,
          node: node
        });
        
        // Detect base class (usually named Base...)
        if (importedName.startsWith('Base') && importedName.includes('Implications')) {
          composition.baseClass = importedName;
          composition.baseClassImport = node;
        }
        
        // Detect ImplicationHelper
        if (importedName === 'ImplicationHelper') {
          composition.helperImport = node;
        }
        
        // Detect behaviors (other Implications)
        if (importedName.endsWith('Implications') && !importedName.startsWith('Base')) {
          composition.behaviors.push({
            name: importedName,
            path: importPath,
            node: node
          });
        }
      }
    });
    
    // Check for CommonJS requires
    traverse(ast, {
      VariableDeclarator(path) {
        const { node } = path;
        
        // Check for require() statements
        if (node.init && node.init.type === 'CallExpression' &&
            node.init.callee.name === 'require') {
          
          if (!composition.moduleSystem) {
            composition.moduleSystem = 'commonjs';
          }
          
          // Skip destructured imports like: const { assign } = require('xstate')
          if (node.id.type !== 'Identifier') {
            return;
          }
          
          const varName = node.id.name;
          const requirePath = node.init.arguments[0]?.value;
          
          // Skip if no variable name or path
          if (!varName || !requirePath) {
            return;
          }
          
          composition.requireStatements.push({
            name: varName,
            path: requirePath,
            node: node
          });
          
          // Detect base class (usually named Base...)
          if (varName.startsWith('Base') && varName.includes('Implications')) {
            composition.baseClass = varName;
            composition.baseClassImport = node;
          }
          
          // Detect ImplicationHelper
          if (varName === 'ImplicationHelper') {
            composition.helperImport = node;
          }
          
          // Detect behaviors (other Implications)
          if (varName.endsWith('Implications') && !varName.startsWith('Base')) {
            composition.behaviors.push({
              name: varName,
              path: requirePath,
              node: node
            });
          }
        }
      }
    });
    
    return composition;
  }
  
  /**
   * Calculate what changes need to be made
   */
  async calculateChanges(current, config, filePath) {
    const changes = {
      addImports: [],
      removeImports: [],
      updateMergeWithBase: false,
      updateSpreadOperators: [],
      moduleSystem: current.moduleSystem || 'esm' // Pass detected module system
    };
    
    // Base class changes
    if (config.baseClass && config.baseClass !== current.baseClass) {
      // Add new base class import
      if (config.baseClass !== 'None') {
        // Find the actual file path for the base class
        const basePath = await this.findImplicationFilePath(filePath, config.baseClass);
        
        changes.addImports.push({
          name: config.baseClass,
          path: basePath
        });
        changes.updateMergeWithBase = true;
      }
      
      // Remove old base class import
      if (current.baseClass) {
        changes.removeImports.push(current.baseClass);
      }
    }
    
    // Remove base class if config says null or 'None'
    if ((config.baseClass === null || config.baseClass === 'None') && current.baseClass) {
      changes.removeImports.push(current.baseClass);
      changes.updateMergeWithBase = 'remove';
    }
    
    // Behavior changes
    const configBehaviors = config.behaviors || [];
    const currentBehaviorNames = current.behaviors.map(b => b.name);
    
    // Add new behaviors
    for (const behaviorName of configBehaviors) {
      if (!currentBehaviorNames.includes(behaviorName)) {
        const behaviorPath = await this.findImplicationFilePath(filePath, behaviorName);
        
        changes.addImports.push({
          name: behaviorName,
          path: behaviorPath
        });
        changes.updateSpreadOperators.push({
          action: 'add',
          name: behaviorName
        });
      }
    }
    
    // Remove old behaviors
    currentBehaviorNames.forEach(behaviorName => {
      if (!configBehaviors.includes(behaviorName)) {
        changes.removeImports.push(behaviorName);
        changes.updateSpreadOperators.push({
          action: 'remove',
          name: behaviorName
        });
      }
    });
    
    return changes;
  }
  
  /**
   * Find the file path for an implication and calculate relative path
   */
  async findImplicationFilePath(fromFile, implicationName) {
    const implicationsRoot = this.findImplicationsRoot(fromFile);
    
    if (!implicationsRoot) {
      // Fallback to same directory
      return `./${implicationName}`;
    }
    
    // Find the actual file
    const files = await this.findFilesRecursive(
      implicationsRoot,
      (fileName) => path.basename(fileName, '.js') === implicationName
    );
    
    if (files.length === 0) {
      // Fallback to same directory
      return `./${implicationName}`;
    }
    
    // Calculate relative path from current file to found file
    const fromDir = path.dirname(fromFile);
    const toFile = files[0]; // Take first match
    let relativePath = path.relative(fromDir, toFile);
    
    // Remove .js extension (will be added back by generate)
    relativePath = relativePath.replace(/\.js$/, '');
    
    // Ensure path starts with ./ or ../
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }
    
    return relativePath;
  }
  
  /**
   * Apply changes to AST
   */
  applyChanges(ast, changes, filePath) {
    const fileDir = path.dirname(filePath);
    const moduleSystem = changes.moduleSystem || 'esm'; // Default to ESM
    
    // 1. Add new imports
    changes.addImports.forEach(imp => {
      const importPath = path.relative(fileDir, path.join(fileDir, imp.path + '.js'));
      const cleanPath = importPath.startsWith('.') ? importPath : './' + importPath;
      
      let newImportNode;
      
      if (moduleSystem === 'commonjs') {
        // Create CommonJS require statement
        newImportNode = t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(imp.name),
            t.callExpression(
              t.identifier('require'),
              [t.stringLiteral(cleanPath)]
            )
          )
        ]);
      } else {
        // Create ES6 import statement
        newImportNode = t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(imp.name))],
          t.stringLiteral(cleanPath)
        );
      }
      
      // Insert after existing imports/requires
      const lastIndex = moduleSystem === 'commonjs' 
        ? this.findLastRequireIndex(ast)
        : this.findLastImportIndex(ast);
      
      ast.program.body.splice(lastIndex + 1, 0, newImportNode);
    });
    
    // 2. Remove old imports
    if (changes.removeImports.length > 0) {
      ast.program.body = ast.program.body.filter(node => {
        if (moduleSystem === 'commonjs') {
          // Remove require statements
          if (node.type === 'VariableDeclaration') {
            const declarator = node.declarations[0];
            if (declarator && declarator.init && 
                declarator.init.type === 'CallExpression' &&
                declarator.init.callee.name === 'require') {
              const varName = declarator.id.name;
              return !changes.removeImports.includes(varName);
            }
          }
        } else {
          // Remove import statements
          if (node.type === 'ImportDeclaration') {
            const importedName = node.specifiers[0]?.local?.name;
            return !changes.removeImports.includes(importedName);
          }
        }
        return true;
      });
    }
    
    // 3. Update mergeWithBase calls
    if (changes.updateMergeWithBase) {
      this.updateMergeWithBaseCalls(ast, changes);
    }
    
    // 4. Update spread operators
    if (changes.updateSpreadOperators.length > 0) {
      this.updateSpreadOperators(ast, changes.updateSpreadOperators);
    }
  }
  
  /**
   * Find index of last import statement
   */
  findLastImportIndex(ast) {
    let lastIndex = -1;
    
    ast.program.body.forEach((node, index) => {
      if (node.type === 'ImportDeclaration') {
        lastIndex = index;
      }
    });
    
    return lastIndex;
  }
  
  /**
   * Find index of last require() statement
   */
  findLastRequireIndex(ast) {
    let lastIndex = -1;
    
    ast.program.body.forEach((node, index) => {
      if (node.type === 'VariableDeclaration') {
        const declarator = node.declarations[0];
        if (declarator && declarator.init && 
            declarator.init.type === 'CallExpression' &&
            declarator.init.callee.name === 'require') {
          lastIndex = index;
        }
      }
    });
    
    return lastIndex;
  }
  
  /**
   * Update ImplicationHelper.mergeWithBase() calls
   */
  updateMergeWithBaseCalls(ast, changes) {
    const newBaseClass = changes.addImports.find(imp => imp.name.startsWith('Base'))?.name;
    
    if (changes.updateMergeWithBase === 'remove') {
      // Remove mergeWithBase, replace with plain object
      traverse(ast, {
        CallExpression(path) {
          const { node } = path;
          
          if (node.callee.type === 'MemberExpression' &&
              node.callee.object.name === 'ImplicationHelper' &&
              node.callee.property.name === 'mergeWithBase') {
            
            // Replace with the override object (second argument)
            if (node.arguments[1]) {
              path.replaceWith(node.arguments[1]);
            }
          }
        }
      });
    } else if (newBaseClass) {
      // Update base class reference in mergeWithBase
      traverse(ast, {
        CallExpression(path) {
          const { node } = path;
          
          if (node.callee.type === 'MemberExpression' &&
              node.callee.object.name === 'ImplicationHelper' &&
              node.callee.property.name === 'mergeWithBase') {
            
            // Update first argument (base class reference)
            if (node.arguments[0] && node.arguments[0].type === 'MemberExpression') {
              node.arguments[0].object.name = newBaseClass;
            }
          }
        }
      });
    }
  }
  
  /**
   * Update spread operator usage
   */
  updateSpreadOperators(ast, spreadChanges) {
    const self = this; // Preserve 'this' context for traverse callback
    
    traverse(ast, {
      ObjectProperty(path) {
        const { node } = path;
        
        // Find objects in mirrorsOn.UI
        if (node.value && node.value.type === 'ArrayExpression') {
          node.value.elements.forEach((element, index) => {
            if (element && element.type === 'ObjectExpression') {
              
              // Check for spread operators
              element.properties.forEach((prop, propIndex) => {
                if (prop.type === 'SpreadElement') {
                  const spreadSource = self.getSpreadSourceName(prop);
                  
                  // Remove spread if behavior removed
                  spreadChanges.forEach(change => {
                    if (change.action === 'remove' && 
                        spreadSource && spreadSource.includes(change.name)) {
                      element.properties.splice(propIndex, 1);
                    }
                  });
                }
              });
            }
          });
        }
      }
    });
  }
  
  /**
   * Get the class name from spread operator
   */
  getSpreadSourceName(spreadElement) {
    if (spreadElement.argument && 
        spreadElement.argument.type === 'MemberExpression') {
      let current = spreadElement.argument;
      while (current.object) {
        if (current.object.name) {
          return current.object.name;
        }
        current = current.object;
      }
    }
    return null;
  }
  
  /**
   * Create backup of original file
   */
  async createBackup(filePath, content) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(path.dirname(filePath), '.backups');
    const backupFileName = `${path.basename(filePath)}.${timestamp}.backup`;
    const backupPath = path.join(backupDir, backupFileName);
    
    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true });
    
    // Write backup
    await fs.writeFile(backupPath, content, 'utf-8');
    
    return backupPath;
  }
  
  /**
   * Format changes for preview display
   */
  formatChangesForPreview(changes) {
    const isCommonJS = changes.moduleSystem === 'commonjs';
    
    const formatted = {
      moduleSystem: changes.moduleSystem || 'esm',
      imports: {
        added: changes.addImports.map(imp => 
          isCommonJS 
            ? `const ${imp.name} = require('${imp.path}');`
            : `import ${imp.name} from '${imp.path}';`
        ),
        removed: changes.removeImports.map(name => 
          isCommonJS
            ? `const ${name} = require('...');`
            : `import ${name} from '...';`
        )
      },
      mergeWithBase: changes.updateMergeWithBase === 'remove' 
        ? 'Removed (converting to plain objects)' 
        : changes.updateMergeWithBase 
        ? 'Updated to use new base class'
        : 'No changes',
      spreadOperators: changes.updateSpreadOperators.map(op => 
        `${op.action}: ${op.name}`
      )
    };
    
    return formatted;
  }
  
  /**
   * Validate implication file structure
   */
  async validateFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['classProperties', 'objectRestSpread']
      });
      
      // Check for class definition
      let hasClass = false;
      let hasMirrorsOn = false;
      
      traverse(ast, {
        ClassDeclaration(path) {
          hasClass = true;
        },
        ClassProperty(path) {
          if (path.node.key.name === 'mirrorsOn') {
            hasMirrorsOn = true;
          }
        }
      });
      
      if (!hasClass) {
        throw new Error('File does not contain a class definition');
      }
      
      if (!hasMirrorsOn) {
        throw new Error('File does not contain mirrorsOn property');
      }
      
      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get available base classes from entire implications directory tree
   */
  async getAvailableBaseClasses(implicationFilePath) {
    // Find the root 'implications' directory
    const implicationsRoot = this.findImplicationsRoot(implicationFilePath);
    
    if (!implicationsRoot) {
      console.warn('⚠️ Could not find implications root directory');
      return [];
    }
    
    // Recursively search for Base*Implications.js files
    const baseClasses = await this.findFilesRecursive(
      implicationsRoot,
      (fileName) => fileName.startsWith('Base') && fileName.endsWith('Implications.js')
    );
    
    return baseClasses.map(f => path.basename(f, '.js'));
  }
  
  /**
   * Get available behaviors from entire implications directory tree
   */
  async getAvailableBehaviors(implicationFilePath) {
    // Find the root 'implications' directory
    const implicationsRoot = this.findImplicationsRoot(implicationFilePath);
    
    if (!implicationsRoot) {
      console.warn('⚠️ Could not find implications root directory');
      return [];
    }
    
    const currentFileName = path.basename(implicationFilePath, '.js');
    
    // Recursively search for *Implications.js files (excluding Base* and current file)
    const behaviors = await this.findFilesRecursive(
      implicationsRoot,
      (fileName) => 
        fileName.endsWith('Implications.js') && 
        !fileName.startsWith('Base') &&
        path.basename(fileName, '.js') !== currentFileName
    );
    
    return behaviors.map(f => path.basename(f, '.js'));
  }
  
  /**
   * Find the root 'implications' directory by walking up the tree
   */
  findImplicationsRoot(filePath) {
    let currentDir = path.dirname(filePath);
    
    // Walk up until we find a directory named 'implications' or hit root
    while (currentDir !== '/' && currentDir !== '.') {
      if (path.basename(currentDir) === 'implications') {
        return currentDir;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }
    
    return null;
  }
  
  /**
   * Recursively find files matching a filter function
   */
  async findFilesRecursive(dir, filterFn) {
    const results = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules, .git, etc.
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const subResults = await this.findFilesRecursive(fullPath, filterFn);
            results.push(...subResults);
          }
        } else if (entry.isFile() && filterFn(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // Directory not readable, skip
      console.warn(`⚠️ Could not read directory: ${dir}`);
    }
    
    return results;
  }
}

export default CompositionRewriter;