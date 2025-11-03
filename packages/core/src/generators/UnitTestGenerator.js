// packages/core/src/generators/UnitTestGenerator.js

import path from 'path';
import fs from 'fs';
import TemplateEngine from './TemplateEngine.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { prepareValidationScreens, pascalCaseHelper } from './templateHelpers.js';
import Handlebars from 'handlebars';

// Create require for loading user files dynamically
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
Handlebars.registerHelper('pascalCase', pascalCaseHelper);

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
    const metadata = this._extractMetadata(ImplClass, platform, stateName, implFilePath);
    
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
_extractMetadata(ImplClass, platform, stateName = null, implFilePath = null) {
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
    
    // ✨ NEW: Find previous state by looking at ALL transitions
    previousStatus = this._findPreviousState(xstateConfig.states, stateName);
    
  } else {
    // Single-state machine: extract from root
    meta = xstateConfig.meta || {};
    status = meta.status;
    entry = xstateConfig.entry;
    transitions = xstateConfig.on || {};
    previousStatus = meta.requires?.previousStatus;
  }


  
const actionDetails = this._extractActionDetailsFromTransition(
  xstateConfig,
  stateName || status,
  platform,
  previousStatus || meta.requires?.previousStatus,
  implFilePath
);

  console.log(`\n🐛 DEBUG actionDetails extraction:`);
console.log(`   targetState: ${stateName || status}`);
console.log(`   previousStatus: ${previousStatus || meta.requires?.previousStatus}`);
console.log(`   implFilePath: ${implFilePath}`);
console.log(`   actionDetails found: ${!!actionDetails}`);
  
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
    
    // Action details (if provided) - ✅ NEW: From transition
    actionDetails: actionDetails,
    
    // Triggered by (multi-platform actions)
    triggeredBy: ImplClass.triggeredBy || [],
    
    // Mirrors on (for validation - Phase 2)
    mirrorsOn: ImplClass.mirrorsOn,
    
    // State name (for multi-state)
    stateName: stateName
  };
  
  // Process actionDetails if present
  if (metadata.actionDetails) {
    metadata.actionDetails = this._processActionDetailsImports(
      metadata.actionDetails,
      this.config?.screenObjectsPath,
      this.implFilePath
    );
  }
  
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
 * Extract actionDetails from the transition that leads to this state
 * 
 * Looks through all states for transitions TO the target state,
 * and extracts actionDetails from those transitions.
 * If not found, checks the previous state's file.
 * 
 * @param {object} xstateConfig - Full xstate configuration
 * @param {string} targetStateName - Target state we're generating for
 * @param {string} platform - Platform (web, mobile, etc.)
 * @param {string} previousStatus - Previous status (from meta.requires.previousStatus)
 * @param {string} implFilePath - Path to current Implication file
 * @returns {object|null} actionDetails or null
 */
_extractActionDetailsFromTransition(xstateConfig, targetStateName, platform, previousStatus = null, implFilePath = null) {
  console.log(`\n🔍 === EXTRACTING ACTION DETAILS ===`);
  console.log(`   Target State: "${targetStateName}"`);
  console.log(`   Previous Status: "${previousStatus || 'none'}"`);
  console.log(`   Impl File: ${implFilePath || 'none'}`);
  console.log(`   Has xstateConfig: ${!!xstateConfig}`);
  console.log(`   Has xstateConfig.on: ${!!xstateConfig?.on}`);
  console.log(`   Has xstateConfig.states: ${!!xstateConfig?.states}`);
  
  let foundActionDetails = null;
  
  // ✅ STEP 1: Check top-level transitions first (single-state machines)
  if (xstateConfig.on) {
    console.log(`\n📋 STEP 1: Checking top-level transitions...`);
    console.log(`   Transitions found: ${Object.keys(xstateConfig.on).join(', ')}`);
    
    for (const [eventName, transitionConfig] of Object.entries(xstateConfig.on)) {
      console.log(`\n   🔍 Checking event: ${eventName}`);
      console.log(`      Type: ${typeof transitionConfig}`);
      
      let target, actionDetails;
      
      if (typeof transitionConfig === 'string') {
        target = transitionConfig;
        console.log(`      String target: ${target}`);
      } else if (typeof transitionConfig === 'object') {
        target = transitionConfig.target;
        actionDetails = transitionConfig.actionDetails;
        console.log(`      Object target: ${target}`);
        console.log(`      Has actionDetails: ${!!actionDetails}`);
        if (actionDetails) {
          console.log(`      ActionDetails imports: ${actionDetails.imports?.length || 0}`);
          console.log(`      ActionDetails steps: ${actionDetails.steps?.length || 0}`);
        }
      }
      
      const cleanTarget = target?.replace(/^#/, '');
      console.log(`      Clean target: ${cleanTarget}`);
      console.log(`      Matches target? ${cleanTarget === targetStateName}`);
      
      if (cleanTarget === targetStateName && actionDetails) {
        console.log(`\n   ✅ FOUND actionDetails in top-level ${eventName} → ${targetStateName}`);
        return actionDetails;
      }
    }
    
    console.log(`   ❌ No actionDetails found in top-level transitions`);
  } else {
    console.log(`\n⏭️  STEP 1 SKIPPED: No top-level transitions`);
  }
  
  // ✅ STEP 2: Check nested states (multi-state machines)
  if (!foundActionDetails && xstateConfig.states) {
    console.log(`\n📋 STEP 2: Checking nested state transitions...`);
    console.log(`   States: ${Object.keys(xstateConfig.states).join(', ')}`);
    
    for (const [sourceStateName, sourceStateConfig] of Object.entries(xstateConfig.states)) {
      const transitions = sourceStateConfig.on || {};
      
      if (Object.keys(transitions).length === 0) {
        continue;
      }
      
      console.log(`\n   🔍 Checking state: ${sourceStateName}`);
      console.log(`      Transitions: ${Object.keys(transitions).join(', ')}`);
      
      for (const [eventName, transitionConfig] of Object.entries(transitions)) {
        let target, actionDetails;
        
        if (typeof transitionConfig === 'string') {
          target = transitionConfig;
        } else if (typeof transitionConfig === 'object') {
          target = transitionConfig.target;
          actionDetails = transitionConfig.actionDetails;
        }
        
        const cleanTarget = target?.replace(/^#/, '');
        
        console.log(`      Event: ${eventName} → ${cleanTarget}`);
        console.log(`      Has actionDetails: ${!!actionDetails}`);
        
        if (cleanTarget === targetStateName && actionDetails) {
          console.log(`\n   ✅ FOUND actionDetails: ${sourceStateName} --${eventName}--> ${targetStateName}`);
          return actionDetails;
        }
      }
    }
    
    console.log(`   ❌ No actionDetails found in nested transitions`);
  } else if (!foundActionDetails) {
    console.log(`\n⏭️  STEP 2 SKIPPED: No nested states`);
  }

  // ✅ STEP 3: Check previous state's file
  if (!foundActionDetails && previousStatus && implFilePath) {
    console.log(`\n📂 STEP 3: Checking previous state file...`);
    console.log(`   Previous Status: ${previousStatus}`);
    console.log(`   Current File: ${implFilePath}`);
    
    try {
      const previousImplFile = this._findImplicationFile(previousStatus, implFilePath);
      
      console.log(`   Previous File Result: ${previousImplFile || 'NOT FOUND'}`);
      
      if (previousImplFile) {
        console.log(`\n   📂 Loading previous state file...`);
        
        // Clear cache to get fresh version
        const require = createRequire(import.meta.url);
        delete require.cache[require.resolve(previousImplFile)];
        
        const PreviousImplClass = require(previousImplFile);
        const prevXstateConfig = PreviousImplClass.xstateConfig;
        
        console.log(`   ✅ Loaded: ${PreviousImplClass.name}`);
        console.log(`   Has xstateConfig: ${!!prevXstateConfig}`);
        console.log(`   Has xstateConfig.on: ${!!prevXstateConfig?.on}`);
        
        if (prevXstateConfig?.on) {
          const transitions = prevXstateConfig.on;
          console.log(`   Transitions: ${Object.keys(transitions).join(', ')}`);
          
          for (const [eventName, transitionConfig] of Object.entries(transitions)) {
            console.log(`\n   🔍 Checking event: ${eventName}`);
            
            let target, actionDetails;
            
            if (typeof transitionConfig === 'string') {
              target = transitionConfig;
              console.log(`      String target: ${target}`);
            } else if (typeof transitionConfig === 'object') {
              target = transitionConfig.target;
              actionDetails = transitionConfig.actionDetails;
              console.log(`      Object target: ${target}`);
              console.log(`      Has actionDetails: ${!!actionDetails}`);
              if (actionDetails) {
                console.log(`      ActionDetails imports: ${actionDetails.imports?.length || 0}`);
                console.log(`      ActionDetails steps: ${actionDetails.steps?.length || 0}`);
              }
            }
            
            const cleanTarget = target?.replace(/^#/, '');
            console.log(`      Clean target: ${cleanTarget}`);
            console.log(`      Matches target? ${cleanTarget === targetStateName}`);
            
            if (cleanTarget === targetStateName && actionDetails) {
              console.log(`\n   ✅ FOUND actionDetails in previous state: ${previousStatus} --${eventName}--> ${targetStateName}`);
              return actionDetails;
            }
          }
          
          console.log(`   ❌ No matching transition found in previous state`);
        } else {
          console.log(`   ❌ Previous state has no transitions`);
        }
      } else {
        console.log(`   ❌ Could not find previous state file`);
      }
    } catch (error) {
      console.log(`   ❌ Error loading previous state: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }
  } else {
    console.log(`\n⏭️  STEP 3 SKIPPED:`);
    if (!previousStatus) console.log(`   - No previousStatus`);
    if (!implFilePath) console.log(`   - No implFilePath`);
  }
  
  // ✅ STEP 4: Fallback to meta.actionDetails
  const meta = xstateConfig.states?.[targetStateName]?.meta || xstateConfig.meta || {};
  if (meta.actionDetails) {
    console.log(`\n📝 STEP 4: Using actionDetails from meta (fallback)`);
    return meta.actionDetails;
  }
  
  console.log(`\n❌ === NO ACTION DETAILS FOUND ===\n`);
  return null;
}

/**
 * Find Implication file for a given status
 * 
 * @param {string} status - Status name (e.g., 'agency_selected')
 * @param {string} currentFilePath - Path to current Implication file
 * @returns {string|null} Path to Implication file or null
 */
/**
 * Find Implication file for a given status using state registry
 * 
 * @param {string} status - Status name (e.g., 'agency_selected' or 'active')
 * @param {string} currentFilePath - Path to current Implication file
 * @returns {string|null} Path to Implication file or null
 */
_findImplicationFile(status, currentFilePath) {
  const path = require('path');
  const fs = require('fs');
  
  const dir = path.dirname(currentFilePath);
  
  // ✅ STEP 1: Try state registry (BEST)
  const registryPath = path.join(dir, '.state-registry.json');
  
  if (fs.existsSync(registryPath)) {
    try {
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      
      // Try exact match first
      if (registry[status]) {
        const implFile = path.join(dir, `${registry[status]}.js`);
        if (fs.existsSync(implFile)) {
          console.log(`   ✅ Found via registry: ${status} → ${registry[status]}`);
          return implFile;
        }
      }
      
      // Try normalized match (without underscores)
      const normalized = status.replace(/_/g, '').toLowerCase();
      if (registry[normalized]) {
        const implFile = path.join(dir, `${registry[normalized]}.js`);
        if (fs.existsSync(implFile)) {
          console.log(`   ✅ Found via registry (normalized): ${status} → ${registry[normalized]}`);
          return implFile;
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not read registry: ${error.message}`);
    }
  }
  
  // ✅ STEP 2: Fallback to convention (snake_case → PascalCase)
  const className = status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  
  const conventionPath = path.join(dir, `${className}Implications.js`);
  
  if (fs.existsSync(conventionPath)) {
    console.log(`   ✅ Found via convention: ${status} → ${className}Implications`);
    return conventionPath;
  }
  
  // ✅ STEP 3: Last resort - scan directory
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('Implications.js'));
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Look for id: 'status' in xstateConfig
      if (content.includes(`id: '${status}'`) || 
          content.includes(`status: '${status}'`)) {
        console.log(`   ✅ Found via scan: ${status} → ${file}`);
        return filePath;
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Could not scan directory: ${error.message}`);
  }
  
  console.log(`   ❌ Not found: ${status}`);
  return null;
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
  
  // 🐛 ADD THIS DEBUG:
  console.log(`\n🐛 DEBUG hasEntityLogic:`);
  console.log(`   entry: ${JSON.stringify(metadata.entry)}`);
  console.log(`   entry.toString(): ${metadata.entry?.toString()}`);
  console.log(`   hasEntityLogic: ${hasEntityLogic}`);
    const entityName = this._inferEntityName(metadata);
    

    
   // Line 649-651 (BEFORE calling _extractDeltaFields)
console.log('\n🐛 DEBUG Delta Extraction:');
console.log(`   metadata.entry:`, metadata.entry);
console.log(`   typeof:`, typeof metadata.entry);
const deltaFields = this._extractDeltaFields(metadata.entry, targetStatus);
console.log(`   deltaFields:`, deltaFields);

    const hasDeltaLogic = deltaFields.length > 0;
    
    // Action details
    const hasActionDetails = !!metadata.actionDetails;
    
    // Test cases
    const testCases = this._generateTestCases(metadata, entityName);
    
    // âœ¨ NEW: Calculate smart import paths
    const paths = this._calculateImportPaths();
    
    // âœ¨ FIX #5: Extract action from triggeredBy
    const triggeredByAction = this._extractTriggeredByAction(metadata);
    const transitionInfo = this._extractTransitionInfo(metadata, targetStatus);
const uiScreens = this._getUIScreensForPlatform(metadata.mirrorsOn, platform);
const suggestedScreens = this._extractSuggestedScreens(uiScreens);

// Generate smart TODO (not used in template, can remove later)
const smartTODOComment = this._generateSmartTODO(
  transitionInfo,
  suggestedScreens,
  { implClassName, actionName, testFileName, platform }
);
    
    // âœ¨ FIX #6: Extract UI validation screens
    const uiValidation = {
  hasValidation: false,
  screens: []
};

if (metadata.mirrorsOn?.UI) {
  const platformKey = this._getPlatformKeyForMirrorsOn(platform);
  
  if (metadata.mirrorsOn.UI[platformKey]) {
    const validationScreens = prepareValidationScreens(
      metadata.mirrorsOn.UI,
      platformKey,
      {} // testData resolved at runtime
    );
    
    uiValidation.hasValidation = validationScreens.length > 0;
    uiValidation.screens = validationScreens;
    
    console.log(`   ✅ Function-aware validation: ${validationScreens.length} screens`);
  }
}
    
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
expectImplicationPath: paths.testContext.replace('/TestContext', '/ExpectImplication'),
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
actionDetails: metadata.actionDetails,  // ✅ Already extracted!
      triggerButton: metadata.triggerButton,
      navigationExample: this._generateNavigationExample(platform, metadata),
      actionExample: this._generateActionExample(metadata, platform),
      appObjectName: isMobile ? 'app' : 'page',
   smartTODOComment,
transitionInfo,
suggestedScreens, 
      
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
      useExpectImplication: true,
      
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
  testContext: `${relativePath}/TestContext`,
  testPlanner: `${relativePath}/TestPlanner`,
  testSetup: `${relativePath.replace('/ai-testing/utils', '/helpers')}/TestSetup`
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
  // Fallback - resolve relative to project root
  const projectRoot = this._findProjectRoot(implFilePath);
  utilsPath = path.join(projectRoot, 'tests/ai-testing/utils');
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

  _getUIScreensForPlatform(mirrorsOn, platform) {
  if (!mirrorsOn) {
    console.log('   ⚠️  No mirrorsOn found');
    return {};
  }
  
  // Check if there's a UI property
  if (!mirrorsOn.UI) {
    console.log('   ⚠️  No mirrorsOn.UI found');
    return {};
  }
  
  // Map platform names to mirrorsOn keys
  const platformKey = this._getPlatformKeyForMirrorsOn(platform);
  
  // Get screens for this platform
  const platformScreens = mirrorsOn.UI[platformKey];
  
  if (!platformScreens) {
    console.log(`   ⚠️  No screens found for platform: ${platformKey}`);
    return {};
  }
  
  console.log(`   ✅ Found mirrorsOn.UI.${platformKey} with ${Object.keys(platformScreens).length} screens`);
  return platformScreens;
}
  
  /**
   * Should we generate entity logic (e.g., bookings[0])?
   */
_shouldGenerateEntityLogic(metadata) {
  // Heuristic: if entry: assign modifies arrays or has indices
  
  // ✅ Safety check added - prevents "Cannot read properties of undefined"
  if (!metadata || !metadata.entry) {
    return false;
  }
  
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

  _extractTransitionInfo(metadata, targetStatus) {
  const info = {
    event: null,
    fromState: metadata.previousStatus || 'unknown',
    toState: targetStatus,
    screens: []
  };
  
  // Try to find event name from xstateConfig
  // Look for transitions TO this state
  if (metadata.xstateConfig && metadata.xstateConfig.states) {
    for (const [stateName, stateConfig] of Object.entries(metadata.xstateConfig.states)) {
      if (stateConfig.on) {
        for (const [eventName, targetState] of Object.entries(stateConfig.on)) {
          if (targetState === targetStatus || targetState.target === targetStatus) {
            info.event = eventName;
            info.fromState = stateName;
            break;
          }
        }
      }
    }
  }
  
  return info;
}

_extractScreenObjects(mirrorsOn, platform) {
  const screens = [];
  
  if (!mirrorsOn || !mirrorsOn.UI) return screens;
  
  const platformData = mirrorsOn.UI[platform] || mirrorsOn.UI.web;
  
  if (!platformData) return screens;
  
  // Extract screen references
  for (const [screenKey, screenDefs] of Object.entries(platformData)) {
    const def = Array.isArray(screenDefs) ? screenDefs[0] : screenDefs;
    
    if (def.screen) {
      screens.push({
        name: screenKey,
        file: def.screen,
        instance: def.instance || null
      });
    }
  }
  
  return screens;
}

// In UnitTestGenerator.js

_extractSuggestedScreens(uiScreens) {
  const suggestedScreens = [];
  
  if (!uiScreens || typeof uiScreens !== 'object') {
    return suggestedScreens;
  }
  
  for (const [screenKey, def] of Object.entries(uiScreens)) {
    // ✅ Skip non-screen properties (description, etc.)
    if (screenKey === 'description' || typeof def === 'string') {
      console.log(`   ⏭️  Skipping non-screen property: ${screenKey}`);
      continue;
    }
    
    // ✅ Handle both array and object formats
    let screenDef;
    
    if (Array.isArray(def)) {
      // Array format: [ImplicationHelper.mergeWithBase(...)]
      screenDef = def[0];
    } else if (typeof def === 'object') {
      // Object format: { screen: 'name', visible: [...] }
      screenDef = def;
    } else {
      console.warn(`   ⚠️  Skipping invalid screen definition for ${screenKey}`);
      continue;
    }
    
    // ✅ Safety check for screen property
    if (!screenDef) {
      console.warn(`   ⚠️  Screen definition is undefined for ${screenKey}`);
      continue;
    }
    
    // ✅ Extract screen name (handle different structures)
    let screenName;
    
    if (screenDef.screen) {
      // Has explicit screen property
      screenName = typeof screenDef.screen === 'string' 
        ? screenDef.screen 
        : String(screenDef.screen);
    } else if (screenDef.name) {
      // Fallback to name property
      screenName = screenDef.name;
    } else {
      // Use the key itself
      screenName = screenKey;
    }
    
    // ✅ Build suggested screen object with 'file' property (used by _generateSmartTODO)
    suggestedScreens.push({
      key: screenKey,
      screen: screenName,
      file: screenName,  // ✅ ADD THIS - used in _generateSmartTODO
      instance: screenDef.instance || screenKey.toLowerCase(),
      visible: screenDef.visible || [],
      hidden: screenDef.hidden || [],
      checks: screenDef.checks || {},
      description: screenDef.description || null
    });
    
    console.log(`   ✅ Extracted screen: ${screenKey} → ${screenName}`);
  }
  
  return suggestedScreens;
}
/**
 * Calculate relative path from generated test to screen object
 */
_calculateScreenObjectPath(implFilePath, screenFile) {
  const path = require('path');
  
  // Example:
  // implFilePath: /project/tests/implications/bookings/status/AgencySelectedImplications.js
  // screenFile: searchBar.wrapper
  // screenObjectsDir: /project/tests/screenObjects/
  // Generated test: /project/tests/implications/bookings/status/AgencySelect-Web-UNIT.spec.js
  
  const implDir = path.dirname(implFilePath);
  const testFile = path.join(implDir, 'AgencySelect-Web-UNIT.spec.js');
  
  // Try to find screenObjects directory
  let screenObjectsDir = this._findScreenObjectsDir(implFilePath);
  
  if (!screenObjectsDir) {
    // Fallback: assume it's at tests/screenObjects
    screenObjectsDir = path.join(path.dirname(implDir), 'screenObjects');
  }
  
  const screenObjectFile = path.join(screenObjectsDir, `${screenFile}.js`);
  
  // Calculate relative path
  const relativePath = path.relative(implDir, screenObjectFile);
  
  return relativePath;
}

/**
 * Process actionDetails imports with calculated paths
 */
_processActionDetailsImports(actionDetails, screenObjectsPath, implFilePath) {
  if (!actionDetails || !actionDetails.imports) {
    return actionDetails;
  }
  
  // Clone to avoid mutation
  const processed = JSON.parse(JSON.stringify(actionDetails));
  
  // Calculate paths for each import
  processed.imports = processed.imports.map(imp => {
    const relativePath = this._calculateScreenObjectPath(
      this.implFilePath,
      imp.path
    );
    
    return {
      ...imp,
      relativePath  // Add calculated path
    };
  });
  
  return processed;
}

/**
 * Find screenObjects directory by walking up from impl file
 */
_findScreenObjectsDir(startPath) {
  const path = require('path');
  const fs = require('fs');
  
  let currentDir = path.dirname(startPath);
  
  // Walk up max 5 levels
  for (let i = 0; i < 5; i++) {
    const screenObjectsPath = path.join(currentDir, 'screenObjects');
    
    if (fs.existsSync(screenObjectsPath)) {
      return screenObjectsPath;
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached root
    currentDir = parentDir;
  }
  
  return null;
}

_generateSmartTODO(transitionInfo, screens, metadata) {
  const lines = [];
  
  lines.push('// ═══════════════════════════════════════════════════════════');
  lines.push('// 🎬 ACTION LOGIC - TODO: Implement State Transition');
  lines.push('// ═══════════════════════════════════════════════════════════');
  lines.push('//');
  lines.push(`// This test induces the transition from '${transitionInfo.fromState}' → '${transitionInfo.toState}'`);
  lines.push('//');
  
  if (transitionInfo.event) {
    lines.push(`// Event: ${transitionInfo.event}`);
  }
  lines.push(`// From State: ${transitionInfo.fromState}`);
  lines.push(`// To State: ${transitionInfo.toState}`);
  lines.push('//');
  
  // Screen suggestions
  if (screens.length > 0) {
    lines.push('// ──────────────────────────────────────────────────────────');
    lines.push('// 💡 Suggested Implementation:');
    lines.push('// ──────────────────────────────────────────────────────────');
    lines.push('//');
    lines.push(`// Based on mirrorsOn, you'll need these screen objects:`);
    lines.push('//');
screens.forEach((screen, index) => {
  // ✅ Safety check for screen.file
  if (!screen.file) {
    console.warn(`   ⚠️  Screen ${index} has no file property, skipping`);
    return;
  }
  
  const className = screen.file.split('.').map(p => 
    p.charAt(0).toUpperCase() + p.slice(1)
  ).join('');
      
      lines.push(`//   ${index + 1}. Initialize ${className}:`);
      lines.push(`//      const ${className} = require('../../screenObjects/${screen.file}.js');`);
      lines.push(`//      const ${screen.instance || 'instance'} = new ${className}(page, ctx.data.lang || 'en', ctx.data.device || 'desktop');`);
      lines.push('//');
    });
    
    lines.push(`//   2. Perform actions to trigger '${transitionInfo.event || 'state change'}':`);
    lines.push('//      // TODO: Add your action code here');
    lines.push('//');
  }
  
  // triggeredBy hint
  lines.push('// ──────────────────────────────────────────────────────────');
  lines.push(`// 📝 Once implemented, update ${metadata.implClassName}.js:`);
  lines.push('// ──────────────────────────────────────────────────────────');
  lines.push('//');
  lines.push('//   static triggeredBy = [{');
  lines.push(`//     description: "${transitionInfo.event || 'Perform action'}",`);
  lines.push(`//     platform: "${metadata.platform}",`);
  lines.push('//     action: async (testDataPath, options = {}) => {');
  lines.push(`//       const { ${metadata.actionName} } = require('./${metadata.testFileName}');`);
  lines.push(`//       return ${metadata.actionName}(testDataPath, options);`);
  lines.push('//     }');
  lines.push('//   }];');
  lines.push('//');
  lines.push('// ═══════════════════════════════════════════════════════════');
  
  return lines.join('\n');
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
    
    console.log(`   🔍 Extracting UI validation for platform: ${platform}`);
    
    if (!mirrorsOn || !mirrorsOn.UI) {
      console.log(`   ⚠️  No mirrorsOn.UI found`);
      return result;
    }
    
    // Get platform key (convert web → web, mobile-dancer → dancer, etc.)
    const platformKey = this._getPlatformKeyForMirrorsOn(platform);
    console.log(`   📝 Platform key: ${platform} → ${platformKey}`);
    
    const platformUI = mirrorsOn.UI[platformKey];
    
    if (!platformUI) {
      console.log(`   ⚠️  No mirrorsOn.UI.${platformKey} found`);
      console.log(`   Available keys: ${Object.keys(mirrorsOn.UI).join(', ')}`);
      return result;
    }
    
    console.log(`   ✅ Found mirrorsOn.UI.${platformKey} with ${Object.keys(platformUI).length} screens`);
    
    // Extract each screen
    for (const [screenKey, screenDefs] of Object.entries(platformUI)) {
      if (!Array.isArray(screenDefs) || screenDefs.length === 0) {
        console.log(`   ⏭️  Skipping ${screenKey} (not an array or empty)`);
        continue;
      }
      
      const screenDef = screenDefs[0];  // Take first definition
      
      // ✅ FIX: Check multiple possible locations for visible/hidden arrays
      // 1. Direct properties: screenDef.visible, screenDef.hidden
      // 2. Inside checks: screenDef.checks.visible, screenDef.checks.hidden
      // 3. Inside override: screenDef.override.visible, screenDef.override.hidden
      
      let visibleArray = screenDef.visible || 
                         screenDef.checks?.visible || 
                         screenDef.override?.visible || 
                         [];
      let hiddenArray = screenDef.hidden || 
                        screenDef.checks?.hidden || 
                        screenDef.override?.hidden || 
                        [];
      
      // Ensure they're arrays
      if (!Array.isArray(visibleArray)) visibleArray = [];
      if (!Array.isArray(hiddenArray)) hiddenArray = [];
      
      const visibleCount = visibleArray.length || 0;
      const hiddenCount = hiddenArray.length || 0;
      
      console.log(`   📊 ${screenKey}: visible=${visibleCount}, hidden=${hiddenCount}`);
      
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
      console.log(`   ✅ UI Validation enabled: ${result.screens.length} screens`);
    } else {
      console.log(`   ⚠️  No screens with visible/hidden elements found`);
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