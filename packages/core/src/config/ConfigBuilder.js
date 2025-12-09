// packages/core/src/config/ConfigBuilder.js

const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * ConfigBuilder
 * 
 * Automatically generates ai-testing.config.js by:
 * 1. Analyzing existing project structure
 * 2. Asking user for preferences
 * 3. Discovering existing patterns
 * 4. Generating appropriate configuration
 * 
 * Usage:
 *   const builder = new ConfigBuilder();
 *   await builder.interactive();
 */
class ConfigBuilder {
  
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.rl = null;
    this.discovered = {
      paths: {},
      patterns: {},
      files: {}
    };
  }
  
  /**
   * Run interactive configuration builder
   */
  async interactive() {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  Implications Framework - Configuration Builder         ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    try {
      // Step 1: Analyze existing structure
      console.log('📊 Step 1: Analyzing project structure...\n');
      await this.analyzeStructure();
      
      // Step 2: Ask user questions
      console.log('\n❓ Step 2: Configuration questions...\n');
      const answers = await this.askQuestions();
      
      // Step 3: Build configuration
      console.log('\n⚙️  Step 3: Building configuration...\n');
      const config = this.buildConfig(answers);
      
      // Step 4: Write configuration file
      console.log('\n💾 Step 4: Writing configuration file...\n');
      await this.writeConfig(config);
      
      // Step 5: Validate
      console.log('\n✅ Step 5: Validating configuration...\n');
      await this.validateConfig(config);
      
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log('║  Configuration complete! ✅                              ║');
      console.log('╚══════════════════════════════════════════════════════════╝\n');
      console.log('Next steps:');
      console.log('  1. Review ai-testing.config.js');
      console.log('  2. Run: npm run test-generator');
      console.log('  3. Generate your first test!\n');
      
    } finally {
      this.rl.close();
    }
  }
  
  /**
   * Analyze project structure to discover existing patterns
   */
  async analyzeStructure() {
    const results = {
      packageJson: this.findPackageJson(),
      testDirectories: this.findTestDirectories(),
      screenObjects: this.findScreenObjects(),
      sections: this.findSections(),
      implications: this.findImplications(),
      credentials: this.findCredentials(),
      testRunner: this.detectTestRunner()
    };
    
    this.discovered = results;
    
    // Display findings
    console.log('   Found:');
    console.log(`     Test directories: ${results.testDirectories.length}`);
    console.log(`     Screen objects: ${results.screenObjects.length}`);
    console.log(`     Sections: ${results.sections.length}`);
    console.log(`     Implications: ${results.implications.length}`);
    console.log(`     Test runner: ${results.testRunner || 'not detected'}`);
    
    return results;
  }
  
  /**
   * Find package.json to determine project root
   */
  findPackageJson() {
    const packagePath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packagePath)) {
      return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    }
    return null;
  }
  
  /**
   * Find test directories
   */
  findTestDirectories() {
    const candidates = ['tests', 'test', 'spec', '__tests__', 'e2e'];
    const found = [];
    
    for (const candidate of candidates) {
      const fullPath = path.join(this.projectRoot, candidate);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        found.push({
          name: candidate,
          path: candidate,
          fullPath: fullPath
        });
      }
    }
    
    return found;
  }
  
  /**
   * Find screen object files
   */
  findScreenObjects() {
    const patterns = [
      '**/screenObjects/**/*.js',
      '**/screen-objects/**/*.js',
      '**/pages/**/*.js',
      '**/page-objects/**/*.js'
    ];
    
    const found = [];
    
    for (const dir of this.discovered.testDirectories || this.findTestDirectories()) {
      const files = this.scanDirectory(dir.fullPath, [
        /\.screen\.js$/,
        /Screen\.js$/,
        /\.page\.js$/,
        /Page\.js$/
      ]);
      
      found.push(...files);
    }
    
    return found;
  }
  
  /**
   * Find section files
   */
  findSections() {
    const found = [];
    
    for (const dir of this.discovered.testDirectories || this.findTestDirectories()) {
      const files = this.scanDirectory(dir.fullPath, [
        /\.section\.js$/,
        /Section\.js$/,
        /sections\/.*\.js$/
      ]);
      
      found.push(...files);
    }
    
    return found;
  }
  
  /**
   * Find Implications files
   */
  findImplications() {
    const found = [];
    
    for (const dir of this.discovered.testDirectories || this.findTestDirectories()) {
      const files = this.scanDirectory(dir.fullPath, [
        /Implications\.js$/,
        /implications\/.*\.js$/
      ]);
      
      found.push(...files);
    }
    
    return found;
  }
  
  /**
   * Find credentials files
   */
  findCredentials() {
    const candidates = [
      'test-data/credentials.json',
      'tests/data/credentials.json',
      'fixtures/credentials.json',
      'config/credentials.json',
      'credentials.json'
    ];
    
    for (const candidate of candidates) {
      const fullPath = path.join(this.projectRoot, candidate);
      if (fs.existsSync(fullPath)) {
        return {
          path: candidate,
          fullPath: fullPath
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect test runner from package.json
   */
  detectTestRunner() {
    const pkg = this.discovered.packageJson || this.findPackageJson();
    
    if (!pkg) return null;
    
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    };
    
    if (deps['@playwright/test']) return 'playwright';
    if (deps['@wdio/cli']) return 'webdriverio';
    if (deps['cypress']) return 'cypress';
    if (deps['jest']) return 'jest';
    
    return null;
  }
  
  /**
   * Scan directory for files matching patterns
   */
  scanDirectory(dir, patterns, maxDepth = 5, currentDepth = 0) {
    if (currentDepth > maxDepth) return [];
    if (!fs.existsSync(dir)) return [];
    
    const found = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectRoot, fullPath);
        
        // Skip excluded directories
        if (entry.isDirectory()) {
          if (this.shouldExclude(entry.name)) continue;
          
          // Recurse into subdirectory
          found.push(...this.scanDirectory(fullPath, patterns, maxDepth, currentDepth + 1));
        } else if (entry.isFile()) {
          // Check if file matches any pattern
          for (const pattern of patterns) {
            if (pattern.test(relativePath) || pattern.test(entry.name)) {
              found.push({
                name: entry.name,
                path: relativePath,
                fullPath: fullPath
              });
              break;
            }
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
    
    return found;
  }
  
  /**
   * Should exclude directory from scanning
   */
  shouldExclude(name) {
    const excluded = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      '.nuxt'
    ];
    
    return excluded.includes(name);
  }
  
  /**
   * Ask user configuration questions
   */
  async askQuestions() {
    const answers = {};
    
    // Project name
    answers.projectName = await this.ask(
      'Project name',
      this.discovered.packageJson?.name || path.basename(this.projectRoot)
    );
    
    // Domain
    answers.domain = await this.ask(
      'Domain (general/cms/booking/etc)',
      'general'
    );
    
    // Test directory
    if (this.discovered.testDirectories.length > 0) {
      console.log('\n   Discovered test directories:');
      this.discovered.testDirectories.forEach((dir, i) => {
        console.log(`     ${i + 1}. ${dir.path}`);
      });
      
      const choice = await this.ask(
        'Select test directory (number)',
        '1'
      );
      
      answers.testDir = this.discovered.testDirectories[parseInt(choice) - 1]?.path || 'tests';
    } else {
      answers.testDir = await this.ask('Test directory', 'tests');
    }
    
    // Test runner
    answers.testRunner = await this.ask(
      'Test runner (playwright/webdriverio/cypress)',
      this.discovered.testRunner || 'playwright'
    );
    
    // Platforms
    answers.platforms = await this.ask(
      'Platforms (comma-separated: web,cms,mobile)',
      'web'
    );
    
    // Test data mode
    answers.testDataMode = await this.ask(
      'Test data mode (stateless/stateful)',
      'stateless'
    );
    
    // Section naming pattern
    if (this.discovered.sections.length > 0) {
      const firstSection = this.discovered.sections[0].name;
      const detectedPattern = this.detectNamingPattern(firstSection, 'section');
      
      answers.sectionPattern = await this.ask(
        'Section file pattern ({name}.section.js or {Name}Section.js)',
        detectedPattern
      );
    } else {
      answers.sectionPattern = await this.ask(
        'Section file pattern',
        '{name}.section.js'
      );
    }
    
    // Screen naming pattern
    if (this.discovered.screenObjects.length > 0) {
      const firstScreen = this.discovered.screenObjects[0].name;
      const detectedPattern = this.detectNamingPattern(firstScreen, 'screen');
      
      answers.screenPattern = await this.ask(
        'Screen file pattern ({name}.screen.js or {Name}Screen.js)',
        detectedPattern
      );
    } else {
      answers.screenPattern = await this.ask(
        'Screen file pattern',
        '{name}.screen.js'
      );
    }
    
    // Discovery mode
    answers.enableDiscovery = await this.askYesNo(
      'Enable automatic file discovery',
      true
    );
    
    // Missing file behavior
    answers.onMissingFile = await this.ask(
      'Behavior on missing files (error/warn/skip/template)',
      'warn'
    );
    
    return answers;
  }
  
  /**
   * Detect naming pattern from example file
   */
  detectNamingPattern(filename, type) {
    // Check for lowercase with separator pattern
    if (filename.includes(`.${type}.js`)) {
      return `{name}.${type}.js`;
    }
    
    // Check for PascalCase pattern
    if (filename.includes(this.capitalize(type))) {
      return `{Name}${this.capitalize(type)}.js`;
    }
    
    return `{name}.${type}.js`;
  }
  
  /**
   * Build configuration object from answers
   */
  buildConfig(answers) {
    const testDir = answers.testDir || 'tests';
    const platforms = answers.platforms.split(',').map(p => p.trim());
    
    return {
      projectName: answers.projectName,
      domain: answers.domain,
      
      testRunner: answers.testRunner,
      platforms: platforms,
      testDataMode: answers.testDataMode,
      
      paths: {
        tests: testDir,
        implications: `${testDir}/implications`,
        utils: `${testDir}/implications/utils`,
        screenObjects: `${testDir}/screenObjects`,
        sections: `${testDir}/screenObjects/sections`,
        testData: 'test-data',
        credentials: this.discovered.credentials?.path || 'test-data/credentials.json'
      },
      
      conventions: {
        sectionPattern: answers.sectionPattern,
        screenPattern: answers.screenPattern,
        implicationPattern: '{Name}Implications.js',
        defaultCredentialKey: 'default',
        testPattern: '{Action}-{Platform}-UNIT.spec.js'
      },
      
      generator: {
        enableDiscovery: answers.enableDiscovery,
        onMissingFile: answers.onMissingFile,
        templateDir: null,
        autoFillMetadata: true,
        generateTestData: true
      },
      
      patterns: {
        screenObjects: [
          `${testDir}/screenObjects/**/*.screen.js`
        ],
        sections: [
          `${testDir}/screenObjects/sections/**/*.section.js`
        ],
        implications: [
          `${testDir}/implications/**/*Implications.js`
        ],
        tests: [
          `${testDir}/**/*.spec.js`
        ]
      },
      
      discovery: {
        extensions: ['.js', '.ts'],
        exclude: ['node_modules', 'dist', 'build', '.git', 'coverage'],
        cacheDiscovery: true,
        maxDepth: 10
      },
      
      validation: {
        requirePathsExist: false,
        validateImplications: true,
        validateSections: true,
        strictMode: false
      }
    };
  }
  
  /**
   * Write configuration to file
   */
  async writeConfig(config) {
    const configPath = path.join(this.projectRoot, 'ai-testing.config.js');
    
    // Check if file already exists
    if (fs.existsSync(configPath)) {
      const overwrite = await this.askYesNo(
        'ai-testing.config.js already exists. Overwrite',
        false
      );
      
      if (!overwrite) {
        console.log('   Cancelled. Keeping existing configuration.');
        return;
      }
      
      // Backup existing config
      const backupPath = `${configPath}.backup`;
      fs.copyFileSync(configPath, backupPath);
      console.log(`   Created backup: ${backupPath}`);
    }
    
    // Generate file content
    const content = this.generateConfigFile(config);
    
    // Write file
    fs.writeFileSync(configPath, content);
    console.log(`   ✅ Written: ${configPath}`);
  }
  
  /**
   * Generate configuration file content
   */
  generateConfigFile(config) {
    return `// ai-testing.config.js
// Generated by Implications Framework Configuration Builder
// Generated: ${new Date().toISOString()}

module.exports = ${JSON.stringify(config, null, 2)};
`;
  }
  
  /**
   * Validate configuration
   */
  async validateConfig(config) {
    const issues = [];
    
    // Check if paths exist
    for (const [key, value] of Object.entries(config.paths)) {
      if (typeof value === 'string') {
        const fullPath = path.join(this.projectRoot, value);
        if (!fs.existsSync(fullPath)) {
          issues.push(`Path does not exist: ${key} -> ${value}`);
        }
      }
    }
    
    // Check if at least one test directory exists
    if (issues.length === 0 || issues.every(i => !i.includes('tests'))) {
      console.log('   ✅ All critical paths valid');
    }
    
    // Display warnings
    if (issues.length > 0) {
      console.log('\n   ⚠️  Warnings:');
      issues.forEach(issue => console.log(`     - ${issue}`));
      console.log('\n   These paths will be created when needed.');
    }
    
    return issues;
  }
  
  /**
   * Ask question with default value
   */
  ask(question, defaultValue) {
    return new Promise(resolve => {
      const prompt = defaultValue 
        ? `   ${question} [${defaultValue}]: `
        : `   ${question}: `;
      
      this.rl.question(prompt, answer => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }
  
  /**
   * Ask yes/no question
   */
  askYesNo(question, defaultValue) {
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    
    return new Promise(resolve => {
      this.rl.question(`   ${question}? [${defaultText}]: `, answer => {
        answer = answer.trim().toLowerCase();
        
        if (answer === '') {
          resolve(defaultValue);
        } else {
          resolve(answer === 'y' || answer === 'yes');
        }
      });
    });
  }
  
  /**
   * Capitalize first letter
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = ConfigBuilder; 