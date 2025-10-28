// packages/core/src/utils/TemplateEngine.js

import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'url';

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
      templatesDir: options.templatesDir || path.join(__dirname, 'templates'),
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
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // STRING HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Uppercase string
     * Usage: {{upper "hello"}} â†’ "HELLO"
     */
    hbs.registerHelper('upper', (str) => {
      return str ? str.toUpperCase() : '';
    });
    
    /**
     * Lowercase string
     * Usage: {{lower "HELLO"}} â†’ "hello"
     */
    hbs.registerHelper('lower', (str) => {
      return str ? str.toLowerCase() : '';
    });
    
    /**
     * Capitalize first letter
     * Usage: {{capitalize "hello"}} â†’ "Hello"
     */
    hbs.registerHelper('capitalize', (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
    hbs.registerHelper('snakeCase', (str) => {
  if (!str) return '';
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
});

/**
 * Convert to PascalCase
 * Usage: {{pascalCase "btn_calendar_day"}} → "BtnCalendarDay"
 */
hbs.registerHelper('pascalCase', (str) => {
  if (!str) return '';
  return str
    .split(/[-_.\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
});

/**
 * Join array with separator
 * Usage: {{join array ", "}}
 */
hbs.registerHelper('join', (array, separator) => {
  if (!Array.isArray(array)) return '';
  return array.join(separator || ', ');
});
    
    /**
     * Split string by separator
     * Usage: {{split string "\n"}}
     */
    hbs.registerHelper('split', (str, separator) => {
      if (!str) return [];
      return str.split(separator || ',');
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // COMPARISON HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Equals comparison
     * Usage: {{#ifEquals value "test"}}...{{/ifEquals}}
     */
    hbs.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });
    
    /**
     * Not equals comparison
     * Usage: {{#ifNotEquals value "test"}}...{{/ifNotEquals}}
     */
    hbs.registerHelper('ifNotEquals', function(arg1, arg2, options) {
      return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
    });
    
    /**
     * Contains check
     * Usage: {{#ifContains array value}}...{{/ifContains}}
     */
    hbs.registerHelper('ifContains', function(array, value, options) {
      if (!Array.isArray(array)) return options.inverse(this);
      return array.includes(value) ? options.fn(this) : options.inverse(this);
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DATE HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Format date
     * Usage: {{formatDate date "YYYY-MM-DD"}}
     */
    hbs.registerHelper('formatDate', (date, format) => {
      if (!date) return '';
      
      // Simple ISO format
      if (format === 'ISO' || !format) {
        return new Date(date).toISOString();
      }
      
      // Could add moment.js for more complex formatting
      return new Date(date).toISOString();
    });
    
    /**
     * Current timestamp
     * Usage: {{now}}
     */
    hbs.registerHelper('now', () => {
      return new Date().toISOString();
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LOGIC HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * OR operation
     * Usage: {{#if (or value1 value2)}}...{{/if}}
     */
    hbs.registerHelper('or', function() {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      return args.some(arg => !!arg);
    });
    
    /**
     * AND operation
     * Usage: {{#if (and value1 value2)}}...{{/if}}
     */
    hbs.registerHelper('and', function() {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      return args.every(arg => !!arg);
    });
    
    /**
     * NOT operation
     * Usage: {{#if (not value)}}...{{/if}}
     */
    hbs.registerHelper('not', (value) => {
      return !value;
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ARRAY HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Get array length
     * Usage: {{length array}}
     */
    hbs.registerHelper('length', (array) => {
      if (!array) return 0;
      return Array.isArray(array) ? array.length : Object.keys(array).length;
    });
    
    /**
     * Check if array is empty
     * Usage: {{#if (isEmpty array)}}...{{/if}}
     */
    hbs.registerHelper('isEmpty', (array) => {
      if (!array) return true;
      return Array.isArray(array) ? array.length === 0 : Object.keys(array).length === 0;
    });
    
    /**
     * Check if array is not empty
     * Usage: {{#if (isNotEmpty array)}}...{{/if}}
     */
    hbs.registerHelper('isNotEmpty', (array) => {
      if (!array) return false;
      return Array.isArray(array) ? array.length > 0 : Object.keys(array).length > 0;
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // MATH HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Add numbers
     * Usage: {{add 5 3}} â†’ 8
     */
    hbs.registerHelper('add', (a, b) => {
      return (a || 0) + (b || 0);
    });
    
    /**
     * Subtract numbers
     * Usage: {{subtract 5 3}} â†’ 2
     */
    hbs.registerHelper('subtract', (a, b) => {
      return (a || 0) - (b || 0);
    });
    
    /**
     * Increment
     * Usage: {{inc value}} â†’ value + 1
     */
    hbs.registerHelper('inc', (value) => {
      return (value || 0) + 1;
    });
    
    /**
     * Decrement
     * Usage: {{dec value}} â†’ value - 1
     */
    hbs.registerHelper('dec', (value) => {
      return (value || 0) - 1;
    });
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DEBUG HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    /**
     * Debug log
     * Usage: {{debug value}}
     */
    hbs.registerHelper('debug', function(value) {
      console.log('\nðŸ› DEBUG:', value);
      return '';
    });
    
    /**
     * JSON stringify
     * Usage: {{json object}}
     */
    hbs.registerHelper('json', (obj) => {
      return JSON.stringify(obj, null, 2);
    });
    
    console.log('âœ… Registered', Object.keys(hbs.helpers).length, 'Handlebars helpers');
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