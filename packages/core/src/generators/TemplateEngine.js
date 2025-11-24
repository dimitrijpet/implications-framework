// packages/core/src/utils/TemplateEngine.js

import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'url';
import {
  pascalCaseHelper,
  camelCaseHelper,
  snakeCaseHelper,
  containsHelper,
  replaceHelper
} from '../generators/templateHelpers.js';

// Create __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * TemplateEngine
 * 
 * Handles Handlebars template rendering with custom helpers.
 * 
 * Features:
 * - Load and compile Handlebars templates
 * - Register custom helpers for formatting
 * - Cache compiled templates
 * - Support for partials
 */
class TemplateEngine {
  
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || path.join(__dirname, '../generators/templates'),
      cache: options.cache !== false,  // Cache by default
      ...options
    };
    
    this.handlebars = Handlebars.create();
    this.templateCache = new Map();
    
    // Register helpers
    this._registerHelpers();
  }
  
  /**
   * Render a template with context
   * 
   * @param {string} templateName - Template file name (e.g., 'unit-test.hbs')
   * @param {object} context - Template context/data
   * @returns {string} Rendered output
   */
render(templateName, context) {
  console.log(`\nðŸ“ TemplateEngine.render()`);
  console.log(`   Template: ${templateName}`);
  console.log(`   Context keys: ${Object.keys(context).length}`);
  
  // âœ… CLEAR CACHE BEFORE RENDERING (temporary debug)
  this.templateCache.clear();
  console.log('   ðŸ—‘ï¸  Cache cleared');
  
  // Get compiled template
  const template = this._getTemplate(templateName);
    
    // Render
    const output = template(context);
    
    console.log(`   âœ… Rendered: ${output.length} characters`);
    
    return output;
  }
  
  /**
   * Get compiled template (from cache or compile)
   */
  _getTemplate(templateName) {
    // Check cache
    if (this.options.cache && this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }
    
    // Load template file
    const templatePath = path.join(this.options.templatesDir, templateName);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    
    // Compile
    const template = this.handlebars.compile(templateSource, {
      noEscape: true  // Don't escape HTML (we're generating code)
    });
    
    // Cache
    if (this.options.cache) {
      this.templateCache.set(templateName, template);
    }
    
    return template;
  }
  
  /**
   * Register custom Handlebars helpers
   */
  _registerHelpers() {
    const hbs = this.handlebars;
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // STRING TRANSFORMATION HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    hbs.registerHelper('pascalCase', pascalCaseHelper);
    hbs.registerHelper('camelCase', camelCaseHelper);
    hbs.registerHelper('snakeCase', snakeCaseHelper);
    hbs.registerHelper('contains', containsHelper);
    hbs.registerHelper('replace', replaceHelper);
    
    /**
     * Uppercase string
     */
    hbs.registerHelper('upper', (str) => {
      return str ? str.toUpperCase() : '';
    });
    
    /**
     * Lowercase string
     */
    hbs.registerHelper('lower', (str) => {
      return str ? str.toLowerCase() : '';
    });
    
    /**
     * Capitalize first letter
     */
    hbs.registerHelper('capitalize', (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
    
    /**
     * Join array with separator
     */
    hbs.registerHelper('join', (array, separator) => {
      if (!Array.isArray(array)) return '';
      return array.join(separator || ', ');
    });
    
    /**
     * Split string by separator
     */
    hbs.registerHelper('split', (str, separator) => {
      if (!str) return [];
      return str.split(separator || ',');
    });

    hbs.registerHelper('formatRequirement', function(key, value) {
      // Handle boolean
      if (typeof value === 'boolean') {
        return `must be ${value}`;
      }
      
      // Handle string
      if (typeof value === 'string') {
        return `must equal "${value}"`;
      }
      
      // Handle object
      if (typeof value === 'object' && value !== null) {
        // Contains pattern: { contains: 'ctx.data.x' }
        if (value.contains) {
          const isNegated = key.startsWith('!');
          return isNegated 
            ? `must NOT contain ${value.contains}`
            : `must contain ${value.contains}`;
        }
        
        // Equals pattern: { equals: 'value' }
        if (value.equals !== undefined) {
          return `must equal ${value.equals}`;
        }
        
        // OneOf pattern: { oneOf: ['a', 'b'] }
        if (value.oneOf && Array.isArray(value.oneOf)) {
          return `must be one of: ${value.oneOf.join(', ')}`;
        }
        
        // Min/Max patterns
        if (value.min !== undefined || value.max !== undefined) {
          const parts = [];
          if (value.min !== undefined) parts.push(`>= ${value.min}`);
          if (value.max !== undefined) parts.push(`<= ${value.max}`);
          return `must be ${parts.join(' and ')}`;
        }
        
        // Fallback
        return `must match ${JSON.stringify(value)}`;
      }
      
      // Fallback
      return `= ${value}`;
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // COMPARISON HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Equals comparison
     */
    hbs.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });
    
    /**
     * Not equals comparison
     */
    hbs.registerHelper('ifNotEquals', function(arg1, arg2, options) {
      return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
    });
    
    /**
     * Contains check
     */
    hbs.registerHelper('ifContains', function(array, value, options) {
      if (!Array.isArray(array)) return options.inverse(this);
      return array.includes(value) ? options.fn(this) : options.inverse(this);
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DATE HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Format date
     */
    hbs.registerHelper('formatDate', (date, format) => {
      if (!date) return '';
      
      // Simple ISO format
      if (format === 'ISO' || !format) {
        return new Date(date).toISOString();
      }
      
      return new Date(date).toISOString();
    });
    
    /**
     * Current timestamp
     */
    hbs.registerHelper('now', () => {
      return new Date().toISOString();
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LOGIC HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * OR operation
     */
    hbs.registerHelper('or', function() {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      return args.some(arg => !!arg);
    });
    
    /**
     * AND operation
     */
    hbs.registerHelper('and', function() {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      return args.every(arg => !!arg);
    });
    
    /**
     * NOT operation
     */
    hbs.registerHelper('not', (value) => {
      return !value;
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ARRAY HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Get array length
     */
    hbs.registerHelper('length', (array) => {
      if (!array) return 0;
      return Array.isArray(array) ? array.length : Object.keys(array).length;
    });
    
    /**
     * Check if array is empty
     */
    hbs.registerHelper('isEmpty', (array) => {
      if (!array) return true;
      return Array.isArray(array) ? array.length === 0 : Object.keys(array).length === 0;
    });
    
    /**
     * Check if array is not empty
     */
    hbs.registerHelper('isNotEmpty', (array) => {
      if (!array) return false;
      return Array.isArray(array) ? array.length > 0 : Object.keys(array).length > 0;
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // MATH HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Add numbers
     */
    hbs.registerHelper('add', (a, b) => {
      return (a || 0) + (b || 0);
    });
    
    /**
     * Subtract numbers
     */
    hbs.registerHelper('subtract', (a, b) => {
      return (a || 0) - (b || 0);
    });
    
    /**
     * Increment
     */
    hbs.registerHelper('inc', (value) => {
      return (value || 0) + 1;
    });

    /**
     * Add one (for 1-indexed lists)
     */
    hbs.registerHelper('addOne', (value) => {
      return parseInt(value || 0) + 1;
    });
    
    /**
     * Decrement
     */
    hbs.registerHelper('dec', (value) => {
      return (value || 0) - 1;
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DEBUG HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Debug log
     */
    hbs.registerHelper('debug', function(value) {
      console.log('\nðŸ› DEBUG:', value);
      return '';
    });
    
    /**
     * JSON stringify
     */
    hbs.registerHelper('json', (obj) => {
      return JSON.stringify(obj, null, 2);
    });

    /**
     * JSON stringify inline (no newlines, for comments)
     */
    hbs.registerHelper('jsonInline', (obj) => {
      return JSON.stringify(obj).replace(/\n/g, ' ');
    });

    /**
     * Check if field is negated (starts with !)
     */
    hbs.registerHelper('isNegatedField', (field) => {
      return typeof field === 'string' && field.startsWith('!');
    });

    /**
     * Remove negation prefix from field
     */
    hbs.registerHelper('removeNegation', (field) => {
      if (typeof field === 'string' && field.startsWith('!')) {
        return field.slice(1);
      }
      return field;
    });

    /**
     * Check if value is a "contains" object pattern like { contains: "..." }
     */
    hbs.registerHelper('isContainsObject', (value) => {
      return typeof value === 'object' && value !== null && value.contains !== undefined;
    });

    /**
     * Get the contains value from object
     */
    hbs.registerHelper('getContainsValue', (value) => {
      if (typeof value === 'object' && value !== null && value.contains) {
        return value.contains;
      }
      return '';
    });

    /**
     * Check if value is boolean
     */
    hbs.registerHelper('isBoolean', (value) => {
      return typeof value === 'boolean';
    });

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENTITY-SCOPED HELPERS (for nested paths like dancer.email)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Check if value is a ctx.data reference
 */
hbs.registerHelper('isContextField', (value) => {
  const result = typeof value === 'string' && value.includes('ctx.data.');
  console.log(`ðŸ” isContextField("${value}") = ${result}`);
  return result;
});

/**
 * Remove ctx.data. prefix and extract field name
 * Usage: ctx.data.email â†’ email
 *        ctx.data.dancer.email â†’ dancer.email
 */
hbs.registerHelper('removeCtxDataPrefix', (value) => {
  if (typeof value === 'string') {
    const result = value.replace('ctx.data.', '');
    console.log(`ðŸ”§ removeCtxDataPrefix("${value}") = "${result}"`);
    return result;
  }
  console.log(`âš ï¸ removeCtxDataPrefix non-string: ${typeof value}`);
  return value;
});

/**
 * Convert field path to entity-scoped path
 * Usage: email â†’ dancer.email (if entity is 'dancer')
 *        status â†’ dancer.status
 */
hbs.registerHelper('entityScopePath', function(fieldPath, entity) {
  if (!entity) return fieldPath;
  
  // If already has entity prefix, return as-is
  if (fieldPath.startsWith(entity + '.')) {
    return fieldPath;
  }
  
  return `${entity}.${fieldPath}`;
});
    // âœ… MOVED: Final count AFTER all helpers registered
    console.log('âœ… Registered', Object.keys(hbs.helpers).length, 'Handlebars helpers (including 3 entity-scoped)');
  }
  
  /**
   * Clear template cache
   */
  clearCache() {
    this.templateCache.clear();
    console.log('ðŸ—‘ï¸  Template cache cleared');
  }
  
  /**
   * Register a partial template
   */
  registerPartial(name, templateSource) {
    this.handlebars.registerPartial(name, templateSource);
  }
  
  /**
   * Load and register partials from directory
   */
  loadPartials(partialsDir) {
    if (!fs.existsSync(partialsDir)) {
      console.warn(`âš ï¸  Partials directory not found: ${partialsDir}`);
      return;
    }
    
    const files = fs.readdirSync(partialsDir);
    
    files.forEach(file => {
      if (file.endsWith('.hbs')) {
        const name = path.basename(file, '.hbs');
        const source = fs.readFileSync(path.join(partialsDir, file), 'utf8');
        this.registerPartial(name, source);
        console.log(`  âœ… Registered partial: ${name}`);
      }
    });
  }
}

export default TemplateEngine;