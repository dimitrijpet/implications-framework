// packages/core/src/generators/ImplicationGenerator.js

import path from 'path';
import fs from 'fs';
import TemplateEngine from './TemplateEngine.js';
import { pascalCaseHelper } from './templateHelpers.js';
import Handlebars from 'handlebars';

Handlebars.registerHelper('pascalCase', pascalCaseHelper);
Handlebars.registerHelper('capitalize', (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

/**
 * ImplicationGenerator
 * 
 * Generates Implication class files with composition and inheritance support.
 * 
 * Features:
 * - Compose behaviors (NotificationsImplications, UndoImplications, etc.)
 * - Extend base classes (BaseBookingImplications, BaseEventImplications)
 * - Generate screen definitions with mergeWithBase
 * - Handle multiple platforms
 * - Calculate relative import paths
 */
class ImplicationGenerator {
  
  constructor(options = {}) {
    this.options = {
      templatePath: options.templatePath || path.join(__dirname, 'templates/implication.hbs'),
      outputDir: options.outputDir || null,
      projectPath: options.projectPath || process.cwd(),
      ...options
    };
  }
  
  /**
   * Generate Implication file
   * 
   * @param {object} config - Generation configuration
   * @param {string} config.className - Implication class name (e.g., 'AcceptedBookingImplications')
   * @param {string} config.status - State status (e.g., 'Accepted')
   * @param {string} config.platform - Primary platform (e.g., 'web', 'dancer')
   * @param {array} config.platforms - All platforms with setup info
   * @param {array} config.composedBehaviors - Behaviors to compose (e.g., ['NotificationsImplications'])
   * @param {string} config.baseClass - Base class to extend (e.g., 'BaseBookingImplications')
   * @param {object} config.screens - Screen configurations by platform
   * @param {object} config.transitions - XState transitions
   * @param {object} config.meta - Additional metadata
   * @param {boolean} config.preview - Return code without writing file
   * @returns {object} { code, fileName, filePath }
   */
  generate(config) {
    console.log('\n🎨 ImplicationGenerator.generate()');
    console.log(`   Class: ${config.className}`);
    console.log(`   Status: ${config.status}`);
    console.log(`   Platform: ${config.platform}`);
    
    // Auto-detect output directory
    if (!this.options.outputDir) {
      this.options.outputDir = path.join(
        this.options.projectPath,
        'tests/implications'
      );
      console.log(`   📂 Auto-detected output: ${this.options.outputDir}`);
    }
    
    // Build template context
    const context = this._buildContext(config);
    
    // Validate context
    this._validateContext(context);
    
    // Render template
    const engine = new TemplateEngine();
    const code = engine.render('implication.hbs', context);
    
    // Generate file name
    const fileName = `${config.className}.js`;
    
    // Optionally write file
    let filePath = null;
    if (!config.preview && this.options.outputDir) {
      filePath = path.join(this.options.outputDir, fileName);
      
      // Create directory if needed
      fs.mkdirSync(this.options.outputDir, { recursive: true });
      
      fs.writeFileSync(filePath, code);
      console.log(`   ✅ Written: ${filePath}`);
    } else {
      console.log(`   ✅ Preview generated (${code.length} chars)`);
    }
    
    return {
      code,
      fileName,
      filePath,
      context
    };
  }
  
  /**
   * Build template context from config
   */
  _buildContext(config) {
    const {
      className,
      status,
      platform,
      platforms = [],
      composedBehaviors = [],
      baseClass = null,
      screens = {},
      transitions = {},
      meta = {},
      description = ''
    } = config;
    
    // Calculate output path for this implication
    const outputPath = path.join(
      this.options.outputDir,
      `${className}.js`
    );
    
    // Build context
    const context = {
      className,
      timestamp: new Date().toISOString(),
      description,
      
      // XState config
      stateId: this._toStateId(status),
      meta: {
        status,
        platform,
        statusLabel: status,
        ...meta
      },
      
      // Platforms setup
      platforms: platforms.length > 0 ? platforms : null,
      hasEntry: !!transitions.entry,
      
      // Composition
      composedBehaviors: this._buildComposedBehaviors(composedBehaviors, outputPath),
      baseClass: baseClass ? this._buildBaseClass(baseClass, outputPath) : null,
      
      // Screens
      screens: this._buildScreens(screens, platform, baseClass, outputPath),
      
      // Helpers
      helpers: {
        needsMergeWithBase: this._needsMergeWithBase(screens),
        needsImplicationHelper: this._needsImplicationHelper(screens)
      }
    };
    
    return context;
  }
  
  /**
   * Build composed behaviors context
   */
  _buildComposedBehaviors(behaviors, outputPath) {
    if (!behaviors || behaviors.length === 0) return null;
    
    return behaviors.map(behavior => {
      const className = typeof behavior === 'string' ? behavior : behavior.className;
      const methodName = typeof behavior === 'object' ? behavior.methodName : 'forBookings';
      const platformKey = typeof behavior === 'object' ? behavior.platformKey : 'dancer';
      
      return {
        className,
        methodName,
        platformKey,
        relativePath: this._calculateRelativePath(className, outputPath)
      };
    });
  }
  
  /**
   * Build base class context
   */
  _buildBaseClass(baseClass, outputPath) {
    const className = typeof baseClass === 'string' ? baseClass : baseClass.className;
    
    return {
      className,
      relativePath: this._calculateRelativePath(className, outputPath)
    };
  }
  
  /**
   * Build screens context
   */
  _buildScreens(screens, primaryPlatform, baseClass, outputPath) {
    const result = [];
    
    for (const [screenKey, screenConfig] of Object.entries(screens)) {
      const screen = {
        screenKey,
        platformKey: screenConfig.platform || primaryPlatform,
        extendsBase: screenConfig.extendsBase || false,
        visible: screenConfig.visible || [],
        hidden: screenConfig.hidden || [],
        checks: screenConfig.checks || {},
        description: screenConfig.description || ''
      };
      
      // Add base class reference if extending
      if (screen.extendsBase && baseClass) {
        screen.baseClass = {
          className: typeof baseClass === 'string' ? baseClass : baseClass.className,
          platformKey: screen.platformKey
        };
      }
      
      result.push(screen);
    }
    
    return result;
  }
  
  /**
   * Calculate relative path from output file to target class
   */
  _calculateRelativePath(targetClassName, fromPath) {
    // Common locations for implication files
    const possiblePaths = [
      path.join(this.options.projectPath, 'tests/implications', `${targetClassName}.js`),
      path.join(this.options.projectPath, 'tests/implications/bookings/status', `${targetClassName}.js`),
      path.join(this.options.projectPath, 'tests/implications/bookings', `${targetClassName}.js`)
    ];
    
    // Find which one exists
    let targetPath = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        targetPath = possiblePath;
        break;
      }
    }
    
    // If not found, assume it will be in same directory
    if (!targetPath) {
      targetPath = path.join(path.dirname(fromPath), `${targetClassName}.js`);
    }
    
    // Calculate relative path
    const relativePath = path.relative(path.dirname(fromPath), targetPath);
    
    // Ensure it starts with ./ or ../
    if (!relativePath.startsWith('.')) {
      return './' + relativePath;
    }
    
    return relativePath;
  }
  
  /**
   * Check if any screens need mergeWithBase
   */
  _needsMergeWithBase(screens) {
    return Object.values(screens).some(screen => screen.extendsBase);
  }
  
  /**
   * Check if ImplicationHelper is needed
   */
  _needsImplicationHelper(screens) {
    return this._needsMergeWithBase(screens);
  }
  
  /**
   * Convert status to state ID
   */
  _toStateId(status) {
    return status.toLowerCase().replace(/\s+/g, '-');
  }
  
  /**
   * Validate context has required fields
   */
  _validateContext(context) {
    const required = ['className', 'stateId', 'meta'];
    
    for (const field of required) {
      if (!context[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!context.meta.status) {
      throw new Error('Missing required field: meta.status');
    }
    
    console.log('   ✅ Context validation passed');
  }
}

export default ImplicationGenerator;