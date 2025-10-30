// packages/api-server/src/services/CompositionAnalyzer.js
// FIXED VERSION - 'this' binding issue resolved

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs-extra';

/**
 * CompositionAnalyzer
 * 
 * Analyzes Implication files to detect composition patterns:
 * - Base class extension (e.g., BaseBookingImplications)
 * - Behavior composition (e.g., NotificationsImplications via spread)
 * - Helper method usage (ImplicationHelper.mergeWithBase)
 * 
 * Returns detailed breakdown by platform and screen.
 */
class CompositionAnalyzer {
  
  /**
   * Analyze an implication file for composition patterns
   * 
   * @param {string} filePath - Path to the implication file
   * @returns {Object} Composition analysis
   */
  analyze(filePath) {
    try {
      // Read the file
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse to AST
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'classProperties', 'decorators-legacy']
      });
      
      // Initialize result structure
      const result = {
        baseClass: null,
        behaviors: [],
        helperUsage: {
          totalMerges: 0,
          byPlatform: {},
          byScreen: {}
        }
      };
      
      // Track imports
      const imports = {
        baseClass: null,
        behaviors: [],
        helper: null
      };
      
      // Track platforms found in mirrorsOn.UI
      const platformsFound = new Set();
      
      // Pass 1: Detect require() statements
      traverse.default(ast, {
        CallExpression(path) {
          if (path.node.callee.name === 'require') {
            const requirePath = path.node.arguments[0]?.value;
            
            if (!requirePath) return;
            
            // Find the variable name being assigned
            const parent = path.parent;
            let varName = null;
            
            if (parent.type === 'VariableDeclarator' && parent.id) {
              varName = parent.id.name;
            }
            
            // Detect Base class pattern (Base*)
            if (varName && varName.startsWith('Base') && varName.includes('Implications')) {
              imports.baseClass = {
                className: varName,
                relativePath: requirePath
              };
            }
            
            // Detect Behavior classes (*Implications, but not Base*)
            else if (varName && varName.includes('Implications') && !varName.startsWith('Base')) {
              imports.behaviors.push({
                className: varName,
                relativePath: requirePath
              });
            }
            
            // Detect ImplicationHelper
            else if (varName === 'ImplicationHelper') {
              imports.helper = {
                className: varName,
                relativePath: requirePath
              };
            }
          }
        }
      });
      
      // Pass 2: Analyze mirrorsOn structure for patterns
      // ⚠️ IMPORTANT: Store 'this' reference for use inside traverse callbacks
      const self = this;
      
      traverse.default(ast, {
        ClassProperty(path) {
          // Find the static mirrorsOn property
          if (path.node.static && 
              path.node.key?.name === 'mirrorsOn' &&
              path.node.value?.type === 'ObjectExpression') {
            
            const mirrorsOnValue = path.node.value;
            
            // Find UI property
            const uiProp = mirrorsOnValue.properties.find(
              p => p.key?.name === 'UI' && p.value?.type === 'ObjectExpression'
            );
            
            if (!uiProp) return;
            
            // Iterate through platforms (dancer, clubApp, web, etc.)
            uiProp.value.properties.forEach(platformProp => {
              if (!platformProp.key?.name || platformProp.value?.type !== 'ObjectExpression') {
                return;
              }
              
              const platform = platformProp.key.name;
              platformsFound.add(platform);
              
              // Initialize platform counters
              if (!result.helperUsage.byPlatform[platform]) {
                result.helperUsage.byPlatform[platform] = 0;
              }
              
              // Iterate through screens
              platformProp.value.properties.forEach(screenProp => {
                if (!screenProp.key?.name) return;
                
                const screenName = screenProp.key.name;
                const screenKey = `${platform}.${screenName}`;
                
                // Initialize screen counter
                if (!result.helperUsage.byScreen[screenKey]) {
                  result.helperUsage.byScreen[screenKey] = 0;
                }
                
                // Check for mergeWithBase() usage
                // ⚠️ Use 'self' instead of 'this'
                self._findMergeWithBase(screenProp.value, (mergeCall) => {
                  result.helperUsage.totalMerges++;
                  result.helperUsage.byPlatform[platform]++;
                  result.helperUsage.byScreen[screenKey]++;
                });
                
                // Check for spread operators with behavior classes
                // ⚠️ Use 'self' instead of 'this'
                self._findSpreadOperators(screenProp.value, imports.behaviors, (behaviorName) => {
                  // Find or create behavior entry
                  let behaviorEntry = result.behaviors.find(b => b.className === behaviorName);
                  if (!behaviorEntry) {
                    const behaviorImport = imports.behaviors.find(b => b.className === behaviorName);
                    behaviorEntry = {
                      className: behaviorName,
                      relativePath: behaviorImport?.relativePath || 'unknown',
                      compositionMethod: 'spread',
                      platforms: [],
                      screensAffected: []
                    };
                    result.behaviors.push(behaviorEntry);
                  }
                  
                  // Add platform if not already tracked
                  if (!behaviorEntry.platforms.includes(platform)) {
                    behaviorEntry.platforms.push(platform);
                  }
                  
                  // Add screen if not already tracked
                  if (!behaviorEntry.screensAffected.includes(screenName)) {
                    behaviorEntry.screensAffected.push(screenName);
                  }
                });
              });
            });
          }
        }
      });
      
      // Build base class result if found
      if (imports.baseClass) {
        const screensUsed = Object.keys(result.helperUsage.byScreen)
          .filter(key => result.helperUsage.byScreen[key] > 0)
          .map(key => key.split('.')[1]); // Extract screen name
        
        // Remove duplicates
        const uniqueScreens = [...new Set(screensUsed)];
        
        result.baseClass = {
          className: imports.baseClass.className,
          relativePath: imports.baseClass.relativePath,
          screensUsed: uniqueScreens,
          totalMerges: result.helperUsage.totalMerges,
          platformBreakdown: { ...result.helperUsage.byPlatform }
        };
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to analyze composition: ${error.message}`);
    }
  }
  
  /**
   * Recursively find ImplicationHelper.mergeWithBase() calls
   * 
   * @param {Object} node - AST node to search
   * @param {Function} callback - Called when mergeWithBase found
   */
  _findMergeWithBase(node, callback) {
    if (!node) return;
    
    // Check if this node is a mergeWithBase call
    if (node.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        node.callee.object?.name === 'ImplicationHelper' &&
        node.callee.property?.name === 'mergeWithBase') {
      callback(node);
    }
    
    // Recursively search arrays
    if (node.type === 'ArrayExpression' && node.elements) {
      node.elements.forEach(el => this._findMergeWithBase(el, callback));
    }
    
    // Recursively search object properties
    if (node.type === 'ObjectExpression' && node.properties) {
      node.properties.forEach(prop => {
        this._findMergeWithBase(prop.value, callback);
      });
    }
  }
  
  /**
   * Recursively find spread operators using behavior classes
   * 
   * @param {Object} node - AST node to search
   * @param {Array} behaviorImports - List of imported behavior classes
   * @param {Function} callback - Called when spread found with behavior name
   */
  _findSpreadOperators(node, behaviorImports, callback) {
    if (!node) return;
    
    // Check if this is a spread element
    if (node.type === 'SpreadElement' && node.argument) {
      // Check if it's spreading a behavior class property
      // Pattern: ...NotificationsImplications.mirrorsOn.UI.platform.screen[0]
      const arg = node.argument;
      
      if (arg.type === 'MemberExpression') {
        // Walk up the member expression chain to find the root identifier
        let current = arg;
        while (current.type === 'MemberExpression' && current.object) {
          if (current.object.type === 'Identifier') {
            const rootName = current.object.name;
            
            // Check if this matches a behavior import
            if (behaviorImports.some(b => b.className === rootName)) {
              callback(rootName);
              break;
            }
          }
          current = current.object;
        }
      }
    }
    
    // Check for object destructuring: { ...BehaviorClass.mirrorsOn... }
    if (node.type === 'ObjectExpression' && node.properties) {
      node.properties.forEach(prop => {
        if (prop.type === 'SpreadElement') {
          this._findSpreadOperators(prop, behaviorImports, callback);
        } else {
          this._findSpreadOperators(prop.value, behaviorImports, callback);
        }
      });
    }
    
    // Recursively search arrays
    if (node.type === 'ArrayExpression' && node.elements) {
      node.elements.forEach(el => this._findSpreadOperators(el, behaviorImports, callback));
    }
  }
}

export default CompositionAnalyzer;