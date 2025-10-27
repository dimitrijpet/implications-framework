// packages/core/src/generators/UnitTestGenerator.js

import path from 'path';
import fs from 'fs';
import TemplateEngine from './TemplateEngine.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// Create require for loading user files dynamically
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/**
 * UnitTestGenerator
 * 
 * Generates UNIT test files from Implication class definitions.
 * 
 * Features:
 * - Reads Implication file and extracts metadata
 * - Builds template context from xstateConfig, triggeredBy, etc.
 * - Generates complete UNIT test with prerequisites checking
 * - Supports both Playwright (web/cms) and Appium (mobile) platforms
 * - Handles delta calculation from entry: assign
 * - Creates optional test registration
 */
class UnitTestGenerator {
  
  constructor(options = {}) {
    this.options = {
      templatePath: options.templatePath || path.join(__dirname, 'templates/unit-test.hbs'),
      outputDir: options.outputDir || null,
      ...options
    };
  }
  
  /**
   * Generate UNIT test from Implication class
   * 
   * @param {string} implFilePath - Path to Implication file
   * @param {object} options - Generation options
   * @param {string} options.platform - Platform: 'web', 'cms', 'mobile-dancer', 'mobile-manager'
   * @param {string} options.state - Target state (for multi-state machines)
   * @param {boolean} options.preview - Return code without writing file
   * @returns {object} { code, fileName, filePath } or array of results for multi-state
   */
  generate(implFilePath, options = {}) {
    const {
      platform = 'web',
      state = null,
      preview = false
    } = options;
    
    console.log('\nðŸŽ¯ UnitTestGenerator.generate()');
    console.log(`   Implication: ${implFilePath}`);
    console.log(`   Platform: ${platform}`);
    if (state) console.log(`   State: ${state}`);
    
    // ✅ FIX #3: Auto-detect output directory from implication file location
    if (!this.options.outputDir) {
      this.options.outputDir = path.dirname(path.resolve(implFilePath));
      console.log(`   ðŸ" Auto-detected output: ${this.options.outputDir}`);
    }
    
    // 1. Load Implication class
    const ImplClass = this._loadImplication(implFilePath);
    
    // 2. Detect if multi-state machine
    const isMultiState = this._isMultiStateMachine(ImplClass);
    
    if (isMultiState && !state) {
      // Generate for ALL states
      console.log(`   âœ¨ Multi-state machine detected`);
      return this._generateMultiState(ImplClass, implFilePath, platform, preview);
    } else if (isMultiState && state) {
      // Generate for specific state
      console.log(`   âœ¨ Generating for state: ${state}`);
      return this._generateSingleState(ImplClass, implFilePath, platform, state, preview);
    } else {
      // Single-state machine (original behavior)
      return this._generateSingleState(ImplClass, implFilePath, platform, null, preview);
    }
  }
  
  /**
   * Check if this is a multi-state machine
   */
  _isMultiStateMachine(ImplClass) {
    const xstateConfig = ImplClass.xstateConfig;
    
    // Multi-state has: initial + states
    // Single-state has: meta at root
    return !!(xstateConfig.initial && xstateConfig.states);
  }
  
  /**
   * Generate tests for all states in a multi-state machine
   */
  _generateMultiState(ImplClass, implFilePath, platform, preview) {
    const states = Object.keys(ImplClass.xstateConfig.states);
    
    console.log(`   ðŸ“‹ Found ${states.length} states: ${states.join(', ')}`);
    console.log('');
    
    const results = [];
    
    for (const stateName of states) {
      const stateConfig = ImplClass.xstateConfig.states[stateName];
      
      // Skip states without setup (no test needed)
      if (!stateConfig.meta?.setup || stateConfig.meta.setup.length === 0) {
        console.log(`   â­ï¸  Skipping ${stateName} (no setup defined)`);
        continue;
      }
      
      console.log(`   ðŸŽ¯ Generating for state: ${stateName}`);
      
      const result = this._generateSingleState(
        ImplClass, 
        implFilePath, 
        platform, 
        stateName, 
        preview
      );
      
      results.push(result);
      console.log('');
    }
    
    console.log(`   âœ… Generated ${results.length} test(s)\n`);
    
    return results;
  }
  
  /**
   * Generate test for a single state
   */
  _generateSingleState(ImplClass, implFilePath, platform, stateName, preview) {
    // Store implFilePath for smart path calculation
    this.implFilePath = implFilePath;
    
    // 2. Extract metadata
    const metadata = this._extractMetadata(ImplClass, platform, stateName);
    
    // 3. Build template context
    const context = this._buildContext(metadata, platform);
    
    // 4. Validate context
    this._validateContext(context);
    
    // 5. Render template
    const engine = new TemplateEngine();
    const code = engine.render('unit-test.hbs', context);
    
    // 6. Generate file name
    const fileName = this._generateFileName(metadata, platform);
    
    // 7. Optionally write file
    let filePath = null;
    if (!preview && this.options.outputDir) {
      filePath = path.join(this.options.outputDir, fileName);
      fs.writeFileSync(filePath, code);
      console.log(`      âœ… Written: ${filePath}`);
    } else {
      console.log(`      âœ… Preview generated (${code.length} chars)`);
    }
    
    return {
      code,
      fileName,
      filePath,
      metadata,
      state: stateName
    };
  }
  
  /**
   * Load Implication class from file
   * 
   * CRITICAL: Changes working directory to PROJECT ROOT
   * before requiring, so non-relative imports work correctly.
   * 
   * Handles both:
   * - Relative: require('../../../something')
   * - Project-relative: require('tests/mobile/i18n/en.json')
   */
  _loadImplication(implFilePath) {
    if (!fs.existsSync(implFilePath)) {
      throw new Error(`Implication file not found: ${implFilePath}`);
    }
    
    // Get absolute path
    const absolutePath = path.resolve(implFilePath);
    
    // Find project root (directory containing tests/)
    const projectRoot = this._findProjectRoot(absolutePath);
    
    // Save current directory
    const originalCwd = process.cwd();
    
    try {
      // Change to PROJECT ROOT so all imports work
      process.chdir(projectRoot);
      
      console.log(`   📁 Changed to project root: ${projectRoot}`);
      
      // Clear require cache to get fresh version
      delete require.cache[require.resolve(absolutePath)];
      
      // Require from the project root context
      const ImplClass = require(absolutePath);
      
      if (!ImplClass.xstateConfig) {
        throw new Error(`Invalid Implication: missing xstateConfig in ${absolutePath}`);
      }
      
      return ImplClass;
      
    } finally {
      // ALWAYS restore original directory
      process.chdir(originalCwd);
    }
  }
  
  /**
   * Find project root by looking for tests/ directory
   * 
   * Goes up from the implication file until we find a directory
   * that has 'tests' as a subdirectory.
   */
  _findProjectRoot(implFilePath) {
    let currentDir = path.dirname(implFilePath);
    
    // Go up max 10 levels looking for tests/ directory
    for (let i = 0; i < 10; i++) {
      const testsDir = path.join(currentDir, 'tests');
      
      if (fs.existsSync(testsDir) && fs.statSync(testsDir).isDirectory()) {
        // Found it! This is the project root
        return currentDir;
      }
      
      // Go up one level
      const parentDir = path.dirname(currentDir);
      
      // Reached filesystem root?
      if (parentDir === currentDir) {
        break;
      }
      
      currentDir = parentDir;
    }
    
    // Fallback: use implication's directory
    console.warn('   ⚠️  Could not find project root, using implication directory');
    return path.dirname(implFilePath);
  }
  
  /**
   * Extract metadata from Implication class
   * 
   * @param {object} ImplClass - Implication class
   * @param {string} platform - Platform
   * @param {string} stateName - State name (for multi-state machines)
   */
  _extractMetadata(ImplClass, platform, stateName = null) {
    const xstateConfig = ImplClass.xstateConfig;
    
    let meta, status, entry, transitions, previousStatus;
    
    if (stateName) {
      // Multi-state machine: extract from specific state
      const stateConfig = xstateConfig.states[stateName];
      
      if (!stateConfig) {
        throw new Error(`State "${stateName}" not found in xstateConfig`);
      }
      
      meta = stateConfig.meta || {};
      status = meta.status || stateName;
      entry = stateConfig.entry;
      transitions = stateConfig.on || {};
      
      // âœ¨ NEW: Find previous state by looking at ALL transitions
      previousStatus = this._findPreviousState(xstateConfig.states, stateName);
      
    } else {
      // Single-state machine: extract from root
      meta = xstateConfig.meta || {};
      status = meta.status;
      entry = xstateConfig.entry;
      transitions = xstateConfig.on || {};
      previousStatus = meta.requires?.previousStatus;
    }
    
    const metadata = {
      // Class info
      className: ImplClass.name,
      
      // Status info
      status: status,
      previousStatus: previousStatus || meta.requires?.previousStatus,
      
      // Fields
      requiredFields: meta.requiredFields || [],
      
      // Setup info
      setup: meta.setup || [],
      
      // Buttons
      triggerButton: meta.triggerButton,
      afterButton: meta.afterButton,
      previousButton: meta.previousButton,
      
      // Transitions
      transitions: transitions,
      
      // Entry actions (for delta)
      entry: entry,
      
      // Action details (if provided)
      actionDetails: meta.actionDetails,
      
      // Triggered by (multi-platform actions)
      triggeredBy: ImplClass.triggeredBy || [],
      
      // Mirrors on (for validation - Phase 2)
      mirrorsOn: ImplClass.mirrorsOn,
      
      // State name (for multi-state)
      stateName: stateName
    };
    
    // Filter setup for this platform
    metadata.platformSetup = metadata.setup.find(s => s.platform === platform);
    
    return metadata;
  }
  
  /**
   * Find the previous state by looking at incoming transitions
   * 
   * For example, if we have:
   *   draft: { on: { PUBLISH: 'published' } }
   * 
   * Then 'published' has previousStatus = 'draft'
   */
  _findPreviousState(states, targetStateName) {
    const previousStates = [];
    
    // Look through all states
    for (const [stateName, stateConfig] of Object.entries(states)) {
      const transitions = stateConfig.on || {};
      
      // Check if any transition leads to our target state
      for (const [event, targetState] of Object.entries(transitions)) {
        if (targetState === targetStateName) {
          previousStates.push(stateName);
        }
      }
    }
    
    // Return the most likely previous state
    // Priority: draft > filling > empty > others
    const priority = ['draft', 'filling', 'empty', 'pending', 'created'];
    
    for (const preferred of priority) {
      if (previousStates.includes(preferred)) {
        return preferred;
      }
    }
    
    // Return first one found, or null
    return previousStates[0] || null;
  }
  
  /**
   * Build template context from metadata
   */
  _buildContext(metadata, platform) {
    const implClassName = metadata.className;
    const targetStatus = metadata.status;
    const actionName = this._generateActionName(targetStatus);
    const testFileName = this._generateFileName(metadata, platform);
    
    // Platform detection
    const isPlaywright = platform === 'web' || platform === 'cms';
    const isMobile = platform.startsWith('mobile-');
    
    // Prerequisites
    const requiresPrerequisites = !!metadata.previousStatus;
    const hasPrerequisites = requiresPrerequisites;
    
    // Action description
    const actionDescription = metadata.actionDetails?.description || 
                              `Transition to ${targetStatus} state`;
    
    // Entity logic (for things like bookings, users, etc.)
    const hasEntityLogic = this._shouldGenerateEntityLogic(metadata);
    const entityName = this._inferEntityName(metadata);
    
    // Delta fields (from entry: assign)
    const deltaFields = this._extractDeltaFields(metadata.entry, targetStatus);
    const hasDeltaLogic = deltaFields.length > 0;
    
    // Action details
    const hasActionDetails = !!metadata.actionDetails;
    
    // Test cases
    const testCases = this._generateTestCases(metadata, entityName);
    
    // âœ¨ NEW: Calculate smart import paths
    const paths = this._calculateImportPaths();
    
    // âœ¨ FIX #5: Extract action from triggeredBy
    const triggeredByAction = this._extractTriggeredByAction(metadata);
    
    // âœ¨ FIX #6: Extract UI validation screens
    const uiValidation = this._extractUIValidation(metadata, platform);
    
    // Build context
    const context = {
      // Header
      timestamp: new Date().toISOString(),
      implClassName,
      platform,
      targetStatus,
      previousStatus: metadata.previousStatus,
      
      // Platform
      isPlaywright,
      isMobile,
      
      // Paths (âœ¨ SMART - calculated based on file location)
     testContextPath: paths.testContext,
testPlannerPath: paths.testPlanner,
testSetupPath: paths.testSetup,
      
      // Function
      actionName,
      actionDescription,
      testFileName,
      testDescription: `${targetStatus} State Transition`,
      
      // Prerequisites
      requiresPrerequisites,
      hasPrerequisites,
      prerequisiteImports: [], // TODO: Extract from triggeredBy
      
      // Options
      optionParams: this._generateOptionParams(isPlaywright, hasEntityLogic),
      
      // Entity logic
      hasEntityLogic,
      entityName,
      
      // Action
      hasActionDetails,
      actionDetails: metadata.actionDetails,
      triggerButton: metadata.triggerButton,
      navigationExample: this._generateNavigationExample(platform, metadata),
      actionExample: this._generateActionExample(metadata, platform),
      appObjectName: isMobile ? 'app' : 'page',
      
      // âœ¨ FIX #5: Extracted action from triggeredBy
      hasTriggeredByAction: triggeredByAction.hasAction,
      triggeredByActionCall: triggeredByAction.actionCall,
      triggeredByInstanceName: triggeredByAction.instanceName,
      
      // Delta
      hasDeltaLogic,
      deltaFields,
      
      // Helper functions
      hasHelperFunctions: false,
      helperFunctions: [],
      
      // âœ¨ FIX #6: UI Validation screens
      hasUIValidation: uiValidation.hasValidation,
      validationScreens: uiValidation.screens,
      
      // Test cases
      testCases,
      defaultTestDataPath: 'tests/data/shared.json',
      
      // Change log
      changeLogLabel: `${targetStatus} ${hasEntityLogic ? entityName : 'State'}`,
    };
    
    return context;
  }
  
  /**
   * Calculate smart import paths based on file locations
   * 
   * This figures out the correct ../../ paths for imports based on:
   * - Where the Implication file is (passed to generator)
   * - Where the generated test will be (same directory as Implication)
   * - Where the utils folder is (configurable via --utils option)
   * 
   * Examples:
   *   apps/cms/tests/implications/pages/CMSPageImplications.js
   *   â†’ ../../utils/TestContext (if utils at apps/cms/tests/utils)
   * 
   *   tests/implications/bookings/AcceptedBookingImplications.js
   *   â†’ ../utils/TestContext (if utils at tests/utils)
   * 
   * @returns {object} { testContext, testPlanner }
   */
  _calculateImportPaths() {
    // Get the Implication file path (absolute or relative)
    const implFilePath = this.implFilePath || '';
    
    if (!implFilePath) {
      // Fallback to safe default
      console.log('   âš ï¸  No implFilePath set, using default paths');
      return {
        testContext: '../../ai-testing/utils/TestContext',
        testPlanner: '../../ai-testing/utils/TestPlanner'
      };
    }
    
    // Get directory of Implication file (where test will be generated)
    const implDir = path.dirname(implFilePath);
    
    // Utils path - configurable via options or use smart detection
    let utilsPath = this.options.utilsPath;
    
    if (!utilsPath) {
      // Smart detection: look for 'tests' directory in path
      if (implDir.includes('/tests/')) {
        // Extract base tests directory
        const testsIndex = implDir.indexOf('/tests/');
        const testsBase = implDir.substring(0, testsIndex + 6); // Keep '/tests'
        // âœ… FIX #1: Changed from 'utils' to 'ai-testing/utils'
        utilsPath = path.join(testsBase, 'ai-testing/utils');
      } else {
        // Fallback
        utilsPath = 'tests/ai-testing/utils';
      }
    }
    
    // Calculate relative path from test location to utils
    let relativePath = path.relative(implDir, utilsPath);
    
    // Normalize for require() - use forward slashes
    relativePath = relativePath.split(path.sep).join('/');
    
    // Ensure it starts with ./ or ../
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }
    
  console.log(`   📂 Smart paths: ${relativePath}/TestContext`);

// Calculate helpers path (parallel to ai-testing/utils)
const helpersPath = utilsPath.replace('/ai-testing/utils', '/helpers');
let helpersRelativePath = path.relative(implDir, helpersPath);
helpersRelativePath = helpersRelativePath.split(path.sep).join('/');
if (!helpersRelativePath.startsWith('.')) {
  helpersRelativePath = './' + helpersRelativePath;
}

return {
  testContext: `${relativePath}/TestContext`,
  testPlanner: `${relativePath}/TestPlanner`,
  testSetup: `${helpersRelativePath}/TestSetup`
};
  }
  
  /**
   * Extract delta fields from entry: assign
   * 
   * This parses the assign object/function to extract ALL fields
   * that should be included in the delta.
   */
  _extractDeltaFields(entryAssign, targetStatus) {
    if (!entryAssign) return [];
    
    const fields = [];
    
    // Get the assignment object
    let assignmentObj = null;
    
    if (entryAssign.assignment) {
      // XState v5 format: assign({ status: "...", ... })
      assignmentObj = entryAssign.assignment;
    } else if (typeof entryAssign === 'object') {
      // Direct object
      assignmentObj = entryAssign;
    }
    
    if (!assignmentObj) {
      console.log('   âš ï¸  Could not extract assignment object from entry');
      
      // Fallback: just add status
      fields.push({
        name: 'status',
        value: `'${targetStatus}'`
      });
      
      return fields;
    }
    
    // Parse each field in the assignment
    for (const [fieldName, fieldValue] of Object.entries(assignmentObj)) {
      let value;
      
      if (typeof fieldValue === 'string') {
        // Literal string: status: "published"
        value = `'${fieldValue}'`;
        
      } else if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
        // Literal number/boolean
        value = String(fieldValue);
        
      } else if (typeof fieldValue === 'function') {
        // Function: ({event}) => event.publishedAt
        const fnStr = fieldValue.toString();
        
        // Try to extract event fields
        const eventMatch = fnStr.match(/event\.(\w+)/);
        if (eventMatch) {
          const eventField = eventMatch[1];
          
          // Check if this is a timestamp field
          if (fieldName.endsWith('At') || fieldName.endsWith('Time')) {
            // Use 'now' as default, but allow override from event
            value = `options.${eventField} || now`;
          } else {
            // Regular event field
            value = `options.${eventField}`;
          }
        } else {
          // Couldn't parse - check for common patterns
          if (fieldName.endsWith('At') || fieldName.endsWith('Time')) {
            value = 'now';
          } else if (fieldName === 'status') {
            value = `'${targetStatus}'`;
          } else {
            value = `undefined  // TODO: Set ${fieldName}`;
          }
        }
        
      } else {
        // Unknown type
        value = 'undefined  // TODO: Set value';
      }
      
      fields.push({
        name: fieldName,
        value: value
      });
    }
    
    // Ensure status is always present
    if (!fields.find(f => f.name === 'status')) {
      fields.unshift({
        name: 'status',
        value: `'${targetStatus}'`
      });
    }
    
    return fields;
  }
  
  /**
   * Should we generate entity logic (e.g., bookings[0])?
   */
  _shouldGenerateEntityLogic(metadata) {
    // Heuristic: if entry: assign modifies arrays or has indices
    const entryStr = metadata.entry?.toString() || '';
    return entryStr.includes('bookings') || 
           entryStr.includes('[') ||
           entryStr.includes('map(');
  }
  
  /**
   * Infer entity name from metadata
   */
  _inferEntityName(metadata) {
    const entryStr = metadata.entry?.toString() || '';
    
    // Try to find entity name in entry: assign
    const matches = entryStr.match(/(\w+):\s*\(\{[^}]*context[^}]*\}\)\s*=>\s*context\.(\w+)/);
    if (matches && matches[2]) {
      const pluralName = matches[2];
      // Remove 's' to get singular
      return pluralName.endsWith('s') ? pluralName.slice(0, -1) : pluralName;
    }
    
    // Try to find in className
    const className = metadata.className;
    if (className.includes('Booking')) return 'booking';
    if (className.includes('User')) return 'user';
    if (className.includes('Event')) return 'event';
    
    // Default
    return 'entity';
  }
  
  /**
   * Generate option parameters for JSDoc
   */
  _generateOptionParams(isPlaywright, hasEntityLogic) {
    const params = [];
    
    if (hasEntityLogic) {
      params.push({
        type: '{number}',
        name: 'index',
        description: 'Single entity index'
      });
      params.push({
        type: '{array}',
        name: 'indices',
        description: 'Multiple entity indices [0, 1, 2]'
      });
    }
    
    return params;
  }
  
  /**
   * Generate test cases
   */
  _generateTestCases(metadata, entityName) {
    const testCases = [];
    
    const hasEntityLogic = this._shouldGenerateEntityLogic(metadata);
    
    if (hasEntityLogic) {
      // Test case for single entity
      testCases.push({
        description: `Process first ${entityName}`,
        params: 'index: 0'
      });
      
      // Test case for multiple entities
      testCases.push({
        description: `Process multiple ${entityName}s`,
        params: 'indices: [0, 1, 2]'
      });
    } else {
      // Simple test case
      testCases.push({
        description: `Execute ${metadata.status} transition`,
        params: null
      });
    }
    
    return testCases;
  }
  
  /**
   * Generate navigation example
   */
  _generateNavigationExample(platform, metadata) {
    const status = metadata?.status;
    const examples = [];
    
    if (platform === 'cms') {
      // CMS-specific navigation
      if (status === 'empty' || status === 'filling') {
        examples.push(`// await page.goto('/admin/pages/new');`);
      } else if (status === 'draft' || status === 'published') {
        examples.push(`// await page.goto(\`/admin/pages/\${ctx.data.pageId}/edit\`);`);
      } else if (status === 'archived') {
        examples.push(`// await page.goto('/admin/pages/archived');`);
      } else {
        examples.push(`// await page.goto('/admin/pages');`);
      }
      
      examples.push(`// await page.waitForLoadState('networkidle');`);
      
    } else if (platform === 'web') {
      examples.push(`// await webNav.navigateToScreen();`);
      
    } else if (platform.startsWith('mobile-')) {
      examples.push(`// await this.navigateToScreen();`);
    }
    
    // Return as ALREADY COMMENTED lines
    return examples.length > 0 ? examples.join('\n') : null;
  }
  
  /**
   * Generate action example
   */
  _generateActionExample(metadata, platform) {
    const examples = [];
    
    // Add trigger button example if present
    if (metadata.triggerButton) {
      if (platform === 'web' || platform === 'cms') {
        examples.push(`// await page.getByRole('button', { name: '${metadata.triggerButton}' }).click();`);
        examples.push(`// await page.waitForSelector('.success-message');  // Wait for confirmation`);
      } else {
        examples.push(`// await app.screen.btn${metadata.triggerButton}.click();`);
        examples.push(`// await app.screen.successMessage.waitForDisplayed();`);
      }
    }
    
    // Add state-specific examples
    const status = metadata.status;
    
    if (status === 'published' && platform === 'cms') {
      examples.push(`// // Wait for page to be live`);
      examples.push(`// await page.waitForURL(/.*\\/published/);`);
    } else if (status === 'draft' && platform === 'cms') {
      examples.push(`// // Verify draft saved`);
      examples.push(`// await expect(page.locator('.draft-indicator')).toBeVisible();`);
    } else if (status === 'filling' && platform === 'cms') {
      examples.push(`// // Fill in page content`);
      examples.push(`// await page.fill('#pageTitle', ctx.data.pageTitle);`);
    }
    
    // Return as ALREADY COMMENTED lines
    return examples.length > 0 ? examples.join('\n') : null;
  }
  
  /**
   * Generate action name from status
   */
  /**
   * Generate action name (GENERIC - uses metadata or conventions)
   * 
   * Priority:
   * 1. Use metadata.actionName if provided
   * 2. Check meta.setup[0].actionName
   * 3. Infer from status using conventions
   * 
   * NO HARDCODED DOMAIN MAPPINGS!
   */
  _generateActionName(statusOrMetadata) {
    // Handle both old API (string) and new API (metadata object)
    const metadata = typeof statusOrMetadata === 'string' 
      ? { status: statusOrMetadata }
      : statusOrMetadata;
    
    // 1. Check if explicitly provided
    if (metadata.actionName) {
      return metadata.actionName;
    }
    
    // 2. Check in platformSetup (not setup[0])
    if (metadata.platformSetup?.actionName) {
      return metadata.platformSetup.actionName;
    }
    
    // 3. Infer from status using generic conventions
    return this._inferActionName(metadata.status);
  }
  
  /**
   * Generate file name (GENERIC - uses metadata or conventions)
   * 
   * Priority:
   * 1. Use metadata.testFile if provided
   * 2. Check meta.setup[0].testFile
   * 3. Generate from action name + platform
   * 
   * Format: ActionName-Platform-UNIT.spec.js
   * Example: Approve-Web-UNIT.spec.js
   */
  _generateFileName(metadata, platform) {
    // 1. Check if explicitly provided
    if (metadata.testFile) {
      return metadata.testFile;
    }
    
    // 2. Check in platformSetup (not setup[0])
    if (metadata.platformSetup?.testFile) {
      return path.basename(metadata.platformSetup.testFile);
    }
    
    // 3. Generate from action name
    const actionName = this._generateActionName(metadata);
    const action = this._toPascalCase(actionName);  // approve â†’ Approve
    const platformSuffix = this._getPlatformSuffix(platform);
    
    // Format: Approve-Web-UNIT.spec.js
    return `${action}-${platformSuffix}-UNIT.spec.js`;
  }
  
  /**
   * Get platform suffix for file name
   */
  _getPlatformSuffix(platform) {
    const mapping = {
      'web': 'Web',
      'cms': 'CMS',
      'mobile-dancer': 'Dancer',
      'mobile-manager': 'Manager'
    };
    
    return mapping[platform] || 'Web';
  }
  
  /**
   * Validate context before rendering
   */
  _validateContext(context) {
    const required = ['implClassName', 'actionName', 'targetStatus', 'testFileName'];
    
    for (const field of required) {
      if (!context[field]) {
        throw new Error(`Missing required context field: ${field}`);
      }
    }
    
    return true;
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // GENERIC HELPERS (NO DOMAIN KNOWLEDGE!)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  /**
   * Convert string to camelCase
   * Examples:
   *   approved â†’ approved
   *   checked_in â†’ checkedIn
   *   in-review â†’ inReview
   *   Published â†’ published
   */
  _toCamelCase(str) {
    if (!str) return '';
    
    // First lowercase
    let result = str.charAt(0).toLowerCase() + str.slice(1);
    
    // Replace _X or -X with X
    result = result.replace(/[_-](\w)/g, (_, c) => c.toUpperCase());
    
    return result;
  }
  
  /**
   * Convert string to PascalCase
   * Examples:
   *   approved â†’ Approved
   *   checked_in â†’ CheckedIn
   *   draft â†’ Draft
   */
  _toPascalCase(str) {
    if (!str) return '';
    
    // First uppercase
    let result = str.charAt(0).toUpperCase() + str.slice(1);
    
    // Replace _X or -X with X
    result = result.replace(/[_-](\w)/g, (_, c) => c.toUpperCase());
    
    return result;
  }
  
  /**
   * Infer action name from status (generic, no domain knowledge)
   * 
   * Conventions:
   * - Remove 'ed' suffix if present: approved â†’ approve
   * - Convert to camelCase: checked_in â†’ checkIn
   * - Leave as-is if can't infer: draft â†’ draft
   * 
   * Examples:
   *   approved â†’ approve
   *   checked_in â†’ checkIn
   *   draft â†’ draft
   *   published â†’ publish
   */
  _inferActionName(status) {
    if (!status) return 'action';
    
    // Convert to camelCase first
    let name = this._toCamelCase(status);
    
    // Remove common suffixes
    if (name.endsWith('ed') && name.length > 3) {
      // approved â†’ approve, published â†’ publish
      name = name.slice(0, -2);
    } else if (name.endsWith('ing') && name.length > 4) {
      // filling â†’ fill
      name = name.slice(0, -3);
    }
    
    return name;
  }
  
  /**
   * Capitalize first letter
   */
  _capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  /**
   * âœ¨ FIX #5: Extract action code from triggeredBy
   * 
   * Parses mirrorsOn.triggeredBy[0].action to extract the actual action call.
   * 
   * Example input:
   *   triggeredBy: [{
   *     action: async (testData) => {
   *       await actionsM.dashboardBooking.updateBookingStatusToRejected(testData);
   *     }
   *   }]
   * 
   * Example output:
   *   {
   *     hasAction: true,
   *     actionCall: "await actionsM.dashboardBooking.updateBookingStatusToRejected(ctx.data);",
   *     instanceName: "actionsM"
   *   }
   */
  _extractTriggeredByAction(metadata) {
    const result = {
      hasAction: false,
      actionCall: null,
      instanceName: null
    };
    
    // Check mirrorsOn.triggeredBy first
    const triggeredBy = metadata.mirrorsOn?.triggeredBy;
    
    if (!triggeredBy || triggeredBy.length === 0) {
      return result;
    }
    
    const firstTrigger = triggeredBy[0];
    
    if (!firstTrigger.action) {
      return result;
    }
    
    // Convert function to string
    const actionFnStr = firstTrigger.action.toString();
    
    // Extract the action call using regex
    // Match patterns like: await actionsM.something.method(...)
    const actionMatch = actionFnStr.match(/await\s+([\w.]+)\((.*?)\);/);
    
    if (actionMatch) {
      const fullCall = actionMatch[1];  // e.g., "actionsM.dashboardBooking.updateBookingStatusToRejected"
      const params = actionMatch[2];     // e.g., "testData"
      
      // Extract instance name (first part before first dot)
      const instanceName = fullCall.split('.')[0];  // e.g., "actionsM"
      
      // Replace testData with ctx.data
      const newParams = params.replace(/testData/g, 'ctx.data');
      
      result.hasAction = true;
      result.actionCall = `await ${fullCall}(${newParams});`;
      result.instanceName = instanceName;
    }
    
    return result;
  }
  
  /**
   * âœ¨ FIX #6: Extract UI validation screens from mirrorsOn
   * 
   * Extracts which screens need validation for the given platform.
   * 
   * Example input:
   *   mirrorsOn.UI.web.manageRequestingEntertainers = [{ visible: [...], hidden: [...] }]
   * 
   * Example output:
   *   {
   *     hasValidation: true,
   *     screens: [{
   *       screenKey: "manageRequestingEntertainers",
   *       visible: 2,
   *       hidden: 5
   *     }]
   *   }
   */
  _extractUIValidation(metadata, platform) {
    const result = {
      hasValidation: false,
      screens: []
    };
    
    const mirrorsOn = metadata.mirrorsOn;
    
    if (!mirrorsOn || !mirrorsOn.UI) {
      return result;
    }
    
    // Get platform key (convert web → web, mobile-dancer → dancer, etc.)
    const platformKey = this._getPlatformKeyForMirrorsOn(platform);
    
    const platformUI = mirrorsOn.UI[platformKey];
    
    if (!platformUI) {
      return result;
    }
    
    // Extract each screen
    for (const [screenKey, screenDefs] of Object.entries(platformUI)) {
      if (!Array.isArray(screenDefs) || screenDefs.length === 0) {
        continue;
      }
      
      const screenDef = screenDefs[0];  // Take first definition
      
      const visibleCount = screenDef.visible?.length || 0;
      const hiddenCount = screenDef.hidden?.length || 0;
      
      if (visibleCount > 0 || hiddenCount > 0) {
        result.screens.push({
          screenKey,
          visible: visibleCount,
          hidden: hiddenCount
        });
      }
    }
    
    if (result.screens.length > 0) {
      result.hasValidation = true;
    }
    
    return result;
  }
  
  /**
   * Get platform key for mirrorsOn.UI lookup
   * 
   * Maps platform to mirrorsOn.UI key:
   *   web → web
   *   cms → cms  
   *   mobile-dancer → dancer
   *   mobile-manager → clubApp (or manager?)
   */
  _getPlatformKeyForMirrorsOn(platform) {
    const mapping = {
      'web': 'web',
      'cms': 'cms',
      'mobile-dancer': 'dancer',
      'mobile-manager': 'clubApp'  // âœ… Use actual key from mirrorsOn
    };
    
    return mapping[platform] || platform;
  }
}

export default UnitTestGenerator;