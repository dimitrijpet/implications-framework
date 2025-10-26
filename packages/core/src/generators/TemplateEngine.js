// packages/core/src/generators/TemplateEngine.js

import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * TemplateEngine
 * 
 * Handles Handlebars template rendering with custom helpers.
 * Used by UnitTestGenerator to render test code from templates.
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
      templatesDir: options.templatesDir || path.join(__dirname, '../templates'),
      cache: options.cache !== false,
      ...options
    };
    this.handlebars = Handlebars.create();
    this.templateCache = new Map();
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
    const template = this._getTemplate(templateName);
    return template(context);
  }
  
  _getTemplate(templateName) {
    if (this.options.cache && this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }
    const templatePath = path.join(this.options.templatesDir, templateName);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = this.handlebars.compile(templateSource, { noEscape: true });
    if (this.options.cache) {
      this.templateCache.set(templateName, template);
    }
    return template;
  }

  
_registerHelpers() {
    const hbs = this.handlebars;
    hbs.registerHelper('upper', (str) => str ? str.toUpperCase() : '');
    hbs.registerHelper('lower', (str) => str ? str.toLowerCase() : '');
    hbs.registerHelper('capitalize', (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '');
    hbs.registerHelper('camelCase', (str) => str ? str.charAt(0).toLowerCase() + str.slice(1) : '');
    hbs.registerHelper('snakeCase', (str) => str ? str.replace(/([A-Z])/g, '_$1').toLowerCase() : '');
    hbs.registerHelper('join', (array, sep) => Array.isArray(array) ? array.join(sep || ', ') : '');
    hbs.registerHelper('ifEquals', function(a, b, opts) { return (a == b) ? opts.fn(this) : opts.inverse(this); });
    hbs.registerHelper('length', (arr) => !arr ? 0 : Array.isArray(arr) ? arr.length : Object.keys(arr).length);
    hbs.registerHelper('or', function() { return Array.prototype.slice.call(arguments, 0, -1).some(arg => !!arg); });
    hbs.registerHelper('and', function() { return Array.prototype.slice.call(arguments, 0, -1).every(arg => !!arg); });
    hbs.registerHelper('not', (v) => !v);
    hbs.registerHelper('now', () => new Date().toISOString());
  }
  
  /**
   * Clear template cache
   */
  clearCache() {
    this.templateCache.clear();
    console.log('🗑️  Template cache cleared');
  }
  
  /**
   * Register a partial template
   */
  registerPartial(name, templateSource) {
    this.handlebars.registerPartial(name, templateSource);
    console.log(`✅ Registered partial: ${name}`);
  }
  
  /**
   * Load and register partials from directory
   */
  loadPartials(partialsDir) {
    if (!fs.existsSync(partialsDir)) {
      console.warn(`⚠️  Partials directory not found: ${partialsDir}`);
      return;
    }
    
    const files = fs.readdirSync(partialsDir);
    
    files.forEach(file => {
      if (file.endsWith('.hbs')) {
        const name = path.basename(file, '.hbs');
        const source = fs.readFileSync(path.join(partialsDir, file), 'utf8');
        this.registerPartial(name, source);
      }
    });
  }
}

export default TemplateEngine;