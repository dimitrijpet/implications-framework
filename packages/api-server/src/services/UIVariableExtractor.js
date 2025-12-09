// packages/api-server/src/services/UIVariableExtractor.js
// Phase 2 & 3: Extract UI variables and function parameters from mirrorsOn

import * as babelParser from '@babel/parser';
import babelTraverse from '@babel/traverse';
import fsExtra from 'fs-extra';

// Handle both ESM and CommonJS
const parser = babelParser;
const traverse = babelTraverse.default || babelTraverse;
const fs = fsExtra.default || fsExtra;

/**
 * UIVariableExtractor
 * 
 * Extracts context requirements from mirrorsOn by analyzing:
 * 1. Template variables: {{fieldName}}
 * 2. Function parameters: cardFlight(flightId, price)
 * 3. Object property access: booking.status, flight.departure
 */
export class UIVariableExtractor {
  
  /**
   * Extract all variables from an implication file
   * 
   * @param {string} implicationPath - Path to implication file
   * @returns {Promise<Object>} - Extracted variables with confidence scores
   */
  async extract(implicationPath) {
    console.log('\n🔍 UIVariableExtractor: Analyzing', implicationPath);
    
    try {
      // Read file
      const content = await fs.readFile(implicationPath, 'utf-8');
      
      // Parse to AST
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'classProperties']
      });
      
      const result = {
        templateVariables: [],    // {{var}} from strings
        functionParams: [],       // params from function calls
        objectProperties: [],     // obj.prop access
        allVariables: new Set(),  // Combined unique list
        confidence: {}            // Variable → confidence score
      };
      
      // Find mirrorsOn in xstateConfig
      let mirrorsOnNode = null;
      
      traverse(ast, {
        ClassProperty(path) {
          if (path.node.static && 
              path.node.key && 
              path.node.key.name === 'xstateConfig') {
            
            // Look for mirrorsOn property
            const configObj = path.node.value;
            if (configObj.type === 'ObjectExpression') {
              const mirrorsOnProp = configObj.properties.find(
                p => p.key && p.key.name === 'mirrorsOn'
              );
              
              if (mirrorsOnProp) {
                mirrorsOnNode = mirrorsOnProp.value;
              }
            }
            
            path.stop();
          }
        }
      });
      
      if (!mirrorsOnNode) {
        console.log('⚠️ No mirrorsOn found');
        return result;
      }
      
      console.log('✅ Found mirrorsOn, extracting variables...');
      
      // Extract variables from mirrorsOn
      this.extractFromNode(mirrorsOnNode, result);
      
      // Calculate confidence scores
      this.calculateConfidence(result);
      
      console.log('✅ Extraction complete:', {
        templateVars: result.templateVariables.length,
        functionParams: result.functionParams.length,
        objectProps: result.objectProperties.length,
        totalUnique: result.allVariables.size
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ UIVariableExtractor error:', error);
      throw error;
    }
  }
  
  /**
   * Extract variables from a node recursively
   */
  extractFromNode(node, result) {
    if (!node) return;
    
    // Handle different node types
    if (node.type === 'StringLiteral' || node.type === 'TemplateLiteral') {
      this.extractTemplateVariables(node, result);
    }
    
    if (node.type === 'CallExpression') {
      this.extractFunctionParams(node, result);
    }
    
    if (node.type === 'MemberExpression') {
      this.extractObjectProperties(node, result);
    }
    
    if (node.type === 'ObjectExpression') {
      node.properties.forEach(prop => {
        this.extractFromNode(prop.value, result);
      });
    }
    
    if (node.type === 'ArrayExpression') {
      node.elements.forEach(el => {
        this.extractFromNode(el, result);
      });
    }
  }
  
  /**
   * Extract {{variable}} from template strings
   */
  extractTemplateVariables(node, result) {
    let text = '';
    
    if (node.type === 'StringLiteral') {
      text = node.value;
    } else if (node.type === 'TemplateLiteral') {
      // Combine all parts
      text = node.quasis.map(q => q.value.raw).join('');
      
      // Also check template expressions
      node.expressions.forEach(expr => {
        if (expr.type === 'Identifier') {
          result.templateVariables.push({
            name: expr.name,
            source: 'template-expression',
            confidence: 90
          });
          result.allVariables.add(expr.name);
        }
      });
    }
    
    // Extract {{variable}} patterns
    const regex = /\{\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}\}/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const varName = match[1];
      result.templateVariables.push({
        name: varName,
        source: 'template-string',
        confidence: 95  // High confidence - explicitly used in UI
      });
      result.allVariables.add(varName);
    }
  }
  
  /**
   * Extract parameters from function calls
   * 
   * Examples:
   *   cardFlight(flightId) → flightId
   *   searchResults(departure, destination) → departure, destination
   */
  extractFunctionParams(node, result) {
    if (node.type !== 'CallExpression') return;
    
    // Get function name
    let functionName = '';
    if (node.callee.type === 'Identifier') {
      functionName = node.callee.name;
    } else if (node.callee.type === 'MemberExpression') {
      if (node.callee.property.type === 'Identifier') {
        functionName = node.callee.property.name;
      }
    }
    
    // Extract arguments
    node.arguments.forEach(arg => {
      if (arg.type === 'Identifier') {
        result.functionParams.push({
          name: arg.name,
          function: functionName,
          source: 'function-param',
          confidence: 85  // High confidence - passed to function
        });
        result.allVariables.add(arg.name);
      }
    });
  }
  
  /**
   * Extract property access: booking.status, flight.departure
   */
  extractObjectProperties(node, result) {
    if (node.type !== 'MemberExpression') return;
    
    // Get full property path
    const parts = [];
    let current = node;
    
    while (current) {
      if (current.property && current.property.type === 'Identifier') {
        parts.unshift(current.property.name);
      }
      
      if (current.object) {
        if (current.object.type === 'Identifier') {
          parts.unshift(current.object.name);
          break;
        } else if (current.object.type === 'MemberExpression') {
          current = current.object;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    
    if (parts.length >= 2) {
      // booking.status → need "booking" in context
      const rootObject = parts[0];
      const property = parts.slice(1).join('.');
      
      result.objectProperties.push({
        name: rootObject,
        property,
        source: 'object-access',
        confidence: 80  // Medium-high confidence
      });
      result.allVariables.add(rootObject);
    }
  }
  
  /**
   * Calculate final confidence scores
   */
  calculateConfidence(result) {
    // Count occurrences and sources
    const occurrences = {};
    
    [...result.templateVariables, ...result.functionParams, ...result.objectProperties]
      .forEach(item => {
        if (!occurrences[item.name]) {
          occurrences[item.name] = {
            count: 0,
            maxConfidence: 0,
            sources: new Set()
          };
        }
        
        occurrences[item.name].count++;
        occurrences[item.name].maxConfidence = Math.max(
          occurrences[item.name].maxConfidence, 
          item.confidence
        );
        occurrences[item.name].sources.add(item.source);
      });
    
    // Calculate final confidence
    Object.keys(occurrences).forEach(varName => {
      const data = occurrences[varName];
      
      // Base confidence from highest source
      let confidence = data.maxConfidence;
      
      // Boost if used multiple times
      if (data.count > 1) {
        confidence = Math.min(100, confidence + (data.count - 1) * 5);
      }
      
      // Boost if used in multiple ways
      if (data.sources.size > 1) {
        confidence = Math.min(100, confidence + 10);
      }
      
      result.confidence[varName] = confidence;
    });
  }
  
  /**
   * Get suggestions with reasons
   */
  getSuggestions(extractionResult) {
    const suggestions = [];
    
    Array.from(extractionResult.allVariables).forEach(varName => {
      const confidence = extractionResult.confidence[varName] || 0;
      
      // Find how it's used
      const usages = [];
      
      const templateUse = extractionResult.templateVariables.find(v => v.name === varName);
      if (templateUse) {
        usages.push('Used in UI template');
      }
      
      const functionUse = extractionResult.functionParams.find(v => v.name === varName);
      if (functionUse) {
        usages.push(`Passed to ${functionUse.function}()`);
      }
      
      const objectUse = extractionResult.objectProperties.find(v => v.name === varName);
      if (objectUse) {
        usages.push(`Accessed as ${varName}.${objectUse.property}`);
      }
      
      suggestions.push({
        field: varName,
        value: null,  // No default value
        confidence,
        reason: usages.join(', '),
        source: 'ui-analysis'
      });
    });
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
}

export default UIVariableExtractor;