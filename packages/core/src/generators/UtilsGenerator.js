// packages/core/src/generators/UtilsGenerator.js

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * UtilsGenerator
 * 
 * Generates utility files (TestContext, TestPlanner, NavigationActions) for guest projects.
 * 
 * Features:
 * - Generates TestContext.js with delta file system
 * - Generates TestPlanner.js with auto-chaining
 * - Generates ExpectImplication.js for validation
 * - Generates NavigationActions.js for screen navigation
 * - Creates utils directory if needed
 * - Backs up existing files before overwriting
 */
class UtilsGenerator {
  
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || path.join(__dirname, 'templates'),
      outputDir: options.outputDir || null,
      backup: options.backup !== false, // Backup by default
      ...options
    };
  }
  
  /**
   * Generate all utility files
   * 
   * @param {object} options - Generation options
   * @param {string} options.projectPath - Path to guest project
   * @param {boolean} options.preview - Return code without writing files
   * @param {array} options.platforms - Platforms to generate NavigationActions for
   * @returns {object} { files: [...] }
   */
  generateAll(options = {}) {
    const {
      projectPath,
      preview = false,
      platforms = ['web', 'dancer', 'manager']  // ✅ NEW: Generate for all platforms
    } = options;
    
    console.log('\n🛠️  UtilsGenerator.generateAll()');
    console.log(`   Project: ${projectPath}`);
    console.log(`   Preview: ${preview}`);
    
    const results = {
      files: []
    };
    
    // Generate TestContext
    const testContextResult = this.generateTestContext({
      projectPath,
      preview
    });
    results.files.push(testContextResult);
    
    // Generate TestPlanner
    const testPlannerResult = this.generateTestPlanner({
      projectPath,
      preview
    });
    results.files.push(testPlannerResult);
    
    // Generate ExpectImplication (if template exists)
    try {
      const expectImplicationResult = this.generateExpectImplication({
        projectPath,
        preview
      });
      results.files.push(expectImplicationResult);
    } catch (error) {
      console.warn('   ⚠️  ExpectImplication template not found, skipping');
    }
    
    // Generate ImplicationsHelper (if template exists)
    try {
      const implicationsHelperResult = this.generateImplicationsHelper({
        projectPath,
        preview
      });
      results.files.push(implicationsHelperResult);
    } catch (error) {
      console.warn('   ⚠️  ImplicationsHelper template not found, skipping');
    }
    
    // ✅ NEW: Generate NavigationActions for each platform
    for (const platform of platforms) {
      try {
        const navActionsResult = this.generateNavigationActions({
          projectPath,
          platform,
          preview
        });
        results.files.push(navActionsResult);
      } catch (error) {
        console.warn(`   ⚠️  NavigationActions template not found for ${platform}, skipping`);
      }
    }
    
    console.log(`\n   ✅ Generated ${results.files.length} utility file(s)\n`);
    
    return results;
  }
  
  /**
   * Generate TestContext.js
   */
  generateTestContext(options = {}) {
    const { projectPath, preview = false } = options;
    
    console.log('\n   🔧 Generating TestContext.js');
    
    // Load and compile template
    const templatePath = path.join(this.options.templatesDir, 'TestContext.hbs');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource, { noEscape: true });
    
    const context = {
      outputPath: 'tests/ai-testing/utils/TestContext.js',
      timestamp: new Date().toISOString()
    };
    
    const code = template(context);
    
    const fileName = 'TestContext.js';
    const outputDir = path.join(projectPath, 'tests/ai-testing/utils');
    const filePath = path.join(outputDir, fileName);
    
    if (!preview) {
      // Create directory if needed
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`      📁 Created directory: ${outputDir}`);
      }
      
      // Backup existing file
      if (this.options.backup && fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup`;
        fs.copyFileSync(filePath, backupPath);
        console.log(`      💾 Backed up existing file to: ${path.basename(backupPath)}`);
      }
      
      // Write file
      fs.writeFileSync(filePath, code);
      console.log(`      ✅ Written: ${filePath}`);
    }
    
    return {
      type: 'TestContext',
      fileName,
      filePath: preview ? null : filePath,
      code,
      size: code.length
    };
  }
  
  /**
   * Generate TestPlanner.js
   */
  generateTestPlanner(options = {}) {
    const { projectPath, preview = false } = options;
    
    console.log('\n   🔧 Generating TestPlanner.js');
    
    // Load and compile template
    const templatePath = path.join(this.options.templatesDir, 'TestPlanner.hbs');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource, { noEscape: true });
    
    const context = {
      outputPath: 'tests/ai-testing/utils/TestPlanner.js',
      timestamp: new Date().toISOString()
    };
    
    const code = template(context);
    
    const fileName = 'TestPlanner.js';
    const outputDir = path.join(projectPath, 'tests/ai-testing/utils');
    const filePath = path.join(outputDir, fileName);
    
    if (!preview) {
      // Create directory if needed
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`      📁 Created directory: ${outputDir}`);
      }
      
      // Backup existing file
      if (this.options.backup && fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup`;
        fs.copyFileSync(filePath, backupPath);
        console.log(`      💾 Backed up existing file to: ${path.basename(backupPath)}`);
      }
      
      // Write file
      fs.writeFileSync(filePath, code);
      console.log(`      ✅ Written: ${filePath}`);
    }
    
    return {
      type: 'TestPlanner',
      fileName,
      filePath: preview ? null : filePath,
      code,
      size: code.length
    };
  }
  
  /**
   * Generate ExpectImplication.js
   */
  generateExpectImplication(options = {}) {
    const { projectPath, preview = false } = options;
    
    console.log('\n   🔧 Generating ExpectImplication.js');
    
    // Load and compile template
    const templatePath = path.join(this.options.templatesDir, 'ExpectImplication.hbs');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource, { noEscape: true });
    
    const context = {
      outputPath: 'tests/ai-testing/utils/ExpectImplication.js',
      timestamp: new Date().toISOString()
    };
    
    const code = template(context);
    
    const fileName = 'ExpectImplication.js';
    const outputDir = path.join(projectPath, 'tests/ai-testing/utils');
    const filePath = path.join(outputDir, fileName);
    
    if (!preview) {
      // Create directory if needed
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`      📁 Created directory: ${outputDir}`);
      }
      
      // Backup existing file
      if (this.options.backup && fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup`;
        fs.copyFileSync(filePath, backupPath);
        console.log(`      💾 Backed up existing file to: ${path.basename(backupPath)}`);
      }
      
      // Write file
      fs.writeFileSync(filePath, code);
      console.log(`      ✅ Written: ${filePath}`);
    }
    
    return {
      type: 'ExpectImplication',
      fileName,
      filePath: preview ? null : filePath,
      code,
      size: code.length
    };
  }

  /**
   * Generate ImplicationsHelper.js
   */
  generateImplicationsHelper(options = {}) {
    const { projectPath, preview = false } = options;
    
    console.log('\n   🔧 Generating ImplicationsHelper.js');
    
    // Load and compile template
    const templatePath = path.join(this.options.templatesDir, 'ImplicationsHelper.hbs');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource, { noEscape: true });
    
    const context = {
      outputPath: 'tests/implications/ImplicationsHelper.js',
      timestamp: new Date().toISOString()
    };
    
    const code = template(context);
    
    const fileName = 'ImplicationsHelper.js';
    const outputDir = path.join(projectPath, 'tests/implications');
    const filePath = path.join(outputDir, fileName);
    
    if (!preview) {
      // Create directory if needed
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`      📁 Created directory: ${outputDir}`);
      }
      
      // Backup existing file
      if (this.options.backup && fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup`;
        fs.copyFileSync(filePath, backupPath);
        console.log(`      💾 Backed up existing file to: ${path.basename(backupPath)}`);
      }
      
      // Write file
      fs.writeFileSync(filePath, code);
      console.log(`      ✅ Written: ${filePath}`);
    }
    
    return {
      type: 'ImplicationsHelper',
      fileName,
      filePath: preview ? null : filePath,
      code,
      size: code.length
    };
  }
  
  /**
   * ✅ NEW: Generate NavigationActions.js for a specific platform
   */
  generateNavigationActions(options = {}) {
    const { projectPath, platform = 'web', preview = false } = options;
    
    console.log(`\n   🔧 Generating NavigationActions for ${platform}`);
    
    // Load and compile template
    const templatePath = path.join(this.options.templatesDir, 'NavigationActions.hbs');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource, { noEscape: true });
    
    // Determine if Playwright or WebdriverIO
    const isPlaywright = platform === 'web' || platform === 'cms';
    
    const context = {
      platform,
      isPlaywright,
      timestamp: new Date().toISOString()
    };
    
    const code = template(context);
    
    const fileName = `navigation.${platform}.js`;
    const outputDir = path.join(projectPath, 'tests/helpers');
    const filePath = path.join(outputDir, fileName);
    
    if (!preview) {
      // Create directory if needed
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`      📁 Created directory: ${outputDir}`);
      }
      
      // Backup existing file
      if (this.options.backup && fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup`;
        fs.copyFileSync(filePath, backupPath);
        console.log(`      💾 Backed up existing file to: ${path.basename(backupPath)}`);
      }
      
      // Write file
      fs.writeFileSync(filePath, code);
      console.log(`      ✅ Written: ${filePath}`);
    }
    
    return {
      type: 'NavigationActions',
      platform,
      fileName,
      filePath: preview ? null : filePath,
      code,
      size: code.length
    };
  }
  
  /**
   * Generate single utility file
   * 
   * @param {string} utilName - 'TestContext' | 'TestPlanner' | 'ExpectImplication' | 'NavigationActions'
   * @param {object} options - Generation options
   */
  generate(utilName, options = {}) {
    const methodMap = {
      'TestContext': 'generateTestContext',
      'TestPlanner': 'generateTestPlanner',
      'ExpectImplication': 'generateExpectImplication',
      'ImplicationsHelper': 'generateImplicationsHelper',
      'NavigationActions': 'generateNavigationActions'  // ✅ NEW
    };
    
    const method = methodMap[utilName];
    
    if (!method) {
      throw new Error(`Unknown utility: ${utilName}. Valid options: ${Object.keys(methodMap).join(', ')}`);
    }
    
    return this[method](options);
  }
}

export default UtilsGenerator;