// packages/core/src/generators/UnitTestGenerator.js

import path from 'path';
import fs from 'fs';
import TemplateEngine from './TemplateEngine.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { prepareValidationScreens, pascalCaseHelper } from './templateHelpers.js';
import Handlebars from 'handlebars';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;

// Create require for loading user files dynamically
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
Handlebars.registerHelper('pascalCase', pascalCaseHelper);
/**
 * Handlebars helper: Format requirement values
 */
Handlebars.registerHelper('formatRequirement', function(key, value) {
  // Handle boolean
  if (typeof value === 'boolean') {
    return `must be ${value}`;
  }
  
  // Handle string
  if (typeof value === 'string') {
    return `must equal "${value}"`;
  }
  
  // Handle object (THE MAIN FIX!)
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
    
    // Fallback
    return `must match ${JSON.stringify(value)}`;
  }
  
  // Fallback
  return `= ${value}`;
});

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
   * @param {string} options.platform - Platform: 'web', 'cms', 'dancer', 'manager'
   * @param {string} options.state - Target state (for multi-state machines)
   * @param {boolean} options.preview - Return code without writing file
   * @returns {object} { code, fileName, filePath } or array of results for multi-state
   */
generate(implFilePath, options = {}) {
  const {
    platform = 'web',
    state = null,
    preview = false,
    projectPath,
    transition = null,
    forceRawValidation = false  // ← ADD THIS
  } = options;
  
  console.log('\n🎯 UnitTestGenerator.generate()');
  console.log(`   Implication: ${implFilePath}`);
  console.log(`   Platform: ${platform}`);
  if (state) console.log(`   State: ${state}`);
  if (transition) console.log(`   🔄 Transition: ${transition.event} (${transition.platform})`);
  
  // Store for later use
  this.projectPath = this._findProjectRoot(implFilePath);
  this.currentTransition = transition;
  this.forceRawValidation = forceRawValidation;
  
  console.log(`   📂 Project root: ${this.projectPath}`);
  
  // Auto-detect output directory
  if (!this.options.outputDir) {
    this.options.outputDir = path.dirname(path.resolve(implFilePath));
    console.log(`   🗂️ Auto-detected output: ${this.options.outputDir}`);
  }

  // 1. Load Implication class
  const ImplClass = this._loadImplication(implFilePath);
  
  // 2. Detect if multi-state machine
  const isMultiState = this._isMultiStateMachine(ImplClass);
  
  if (isMultiState && !state) {
    console.log(`   ✨ Multi-state machine detected`);
    return this._generateMultiState(ImplClass, implFilePath, platform, preview);
  } else if (isMultiState && state) {
    console.log(`   ✨ Generating for state: ${state}`);
    return this._generateSingleState(ImplClass, implFilePath, platform, state, preview);
  } else {
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
    
    console.log(`   Ã°Å¸â€œâ€¹ Found ${states.length} states: ${states.join(', ')}`);
    console.log('');
    
    const results = [];
    
    for (const stateName of states) {
      const stateConfig = ImplClass.xstateConfig.states[stateName];
      
      // Skip states without setup (no test needed)
      if (!stateConfig.meta?.setup || stateConfig.meta.setup.length === 0) {
        console.log(`   Ã¢ÂÂ­Ã¯Â¸Â  Skipping ${stateName} (no setup defined)`);
        continue;
      }
      
      console.log(`   Ã°Å¸Å½Â¯ Generating for state: ${stateName}`);
      
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
    
    console.log(`   Ã¢Å“â€¦ Generated ${results.length} test(s)\n`);
    
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
    
  // 3. Build template context - ✅ Pass transition and forceRawValidation
  const context = this._buildContext(metadata, platform, this.currentTransition, {
    forceRawValidation: this.forceRawValidation || false
  });
    
  // 4. Validate context
  this._validateContext(context);
    
  // 5. Render template
  const engine = new TemplateEngine();
  const code = engine.render('unit-test.hbs', context);
    
  // 6. Generate file name
  const event = this.currentTransition?.event;
  console.log(`🛠 DEBUG _generateFileName inputs:`);
  console.log(`   event: ${event}`);
  console.log(`   platform: ${platform}`);
  console.log(`   metadata.status: ${metadata.status}`);

  const fileName = this._generateFileName(metadata, platform, { event });
  console.log(`   ✅ Generated fileName: ${fileName}`);
    
  // 7. Optionally write file
  let filePath = null;
  if (!preview && this.options.outputDir) {
    filePath = path.join(this.options.outputDir, fileName);
    fs.writeFileSync(filePath, code);
    console.log(`      ✅ Written: ${filePath}`);
  } else {
    console.log(`      ✅ Preview generated (${code.length} chars)`);
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
 * Extract ordered screens for Phase 3.7 validation with hybrid support
 * 
 * Features:
 * - Processes screens in order (by `order` field)
 * - Smart detection: ExpectImplication for simple, raw for complex
 * - External POM detection and initialization
 * - Deduplicates POM requires across screens
 * - forceRawValidation option for verbose output
 * 
 * @param {object} metadata - Implication metadata
 * @param {string} platform - Platform key (web, dancer, etc.)
 * @param {object} options - Options including forceRawValidation
 * @returns {object} { hasOrderedScreens, orderedScreens, orderedScreenCount, uniquePomRequires, ... }
 */
_extractOrderedScreensForValidation(metadata, platform, options = {}) {
  const { forceRawValidation = false } = options;
  
  console.log(`\n🔄 _extractOrderedScreensForValidation for ${platform}`);
  if (forceRawValidation) {
    console.log(`   ⚡ Force raw validation: ENABLED`);
  }
  
  const result = {
    hasOrderedScreens: false,
    orderedScreens: [],
    orderedScreenCount: 0,
    uniquePomRequires: [],
    usesBlocks: false,
    usesLegacy: false
  };
  
  if (!metadata.mirrorsOn?.UI) {
    console.log('   ⚠️  No mirrorsOn.UI found');
    return result;
  }
  
  const platformKey = this._getPlatformKeyForMirrorsOn(platform);
  const platformScreens = metadata.mirrorsOn.UI[platformKey];
  
  if (!platformScreens || typeof platformScreens !== 'object') {
    console.log(`   ⚠️  No screens for platform: ${platformKey}`);
    return result;
  }
  
  console.log(`   📺 Found ${Object.keys(platformScreens).length} screen(s) for ${platformKey}`);
  
  const isPlaywright = platform === 'web' || platform === 'cms';
  const screens = [];
  
  // ═══════════════════════════════════════════════════════════
  // PASS 1: Process all screens
  // ═══════════════════════════════════════════════════════════
  for (const [screenKey, screenDef] of Object.entries(platformScreens)) {
    let screen;
    
    // Handle array or object format
    if (Array.isArray(screenDef)) {
      if (screenDef.length === 0) continue;
      screen = screenDef[0];
    } else if (typeof screenDef === 'object' && screenDef !== null) {
      screen = screenDef;
    } else {
      continue;
    }
    
    if (!screen || typeof screen !== 'object') continue;
    
    const order = typeof screen.order === 'number' ? screen.order : 999;
    const hasBlocks = Array.isArray(screen.blocks) && screen.blocks.length > 0;
    const hasNavigation = screen.navigation && 
                          (screen.navigation.pomName || screen.navigation.method);
    
    console.log(`   📺 ${screenKey}: order=${order}, blocks=${hasBlocks}, nav=${hasNavigation}`);
    
    if (hasBlocks) result.usesBlocks = true;
    else result.usesLegacy = true;
    
    // ───────────────────────────────────────────────────────
    // Process navigation
    // ───────────────────────────────────────────────────────
    let navigation = null;
    
    if (hasNavigation) {
      const nav = screen.navigation;
      const instanceName = nav.pomName 
        ? this._toCamelCase(nav.pomName)
        : 'navigationScreen';
      
      let pomPath = nav.pomPath || null;
      if (!pomPath && nav.pomName && this.implFilePath) {
        pomPath = this._calculateScreenObjectPath(this.implFilePath, nav.pomName);
      }
      
      const resolvedArgs = (nav.args || []).map(arg => this._resolveTemplateArg(arg));
      
      navigation = {
        pomName: nav.pomName,
        pomPath: pomPath,
        method: nav.method,
        args: nav.args || [],
        resolvedArgs: resolvedArgs,
        resolvedArgsString: resolvedArgs.join(', '),
        instanceName: instanceName,
        className: nav.pomName ? this._toPascalCase(nav.pomName) : null
      };
    }
    
    // ───────────────────────────────────────────────────────
    // SMART DETECTION: Determine validation mode per-screen
    // ───────────────────────────────────────────────────────
    let useRawValidation = forceRawValidation;
    let rawValidationReason = forceRawValidation ? 'forced by user' : null;
    
    // Only do auto-detection if NOT forced
    if (!forceRawValidation && hasBlocks) {
      const screenPomName = (screen.screen || screenKey).toLowerCase()
        .replace(/\.(wrapper|screen|page)$/i, '')
        .replace(/\//g, '');
      
      for (const block of screen.blocks) {
        if (block.enabled === false) continue;
        
        // Check 1: Custom code blocks always need raw
        if (block.type === 'custom-code' && block.code?.trim()) {
          useRawValidation = true;
          rawValidationReason = 'custom-code block';
          break;
        }
        
        // Check 2: Function calls to DIFFERENT POMs need raw
        if (block.type === 'function-call') {
          const blockInstance = (block.data?.instance || '').toLowerCase()
            .replace(/\.(wrapper|screen|page)$/i, '')
            .replace(/\//g, '');
          
          if (blockInstance && !screenPomName.includes(blockInstance) && !blockInstance.includes(screenPomName)) {
            useRawValidation = true;
            rawValidationReason = `external function call to ${block.data?.instance}`;
            break;
          }
        }
      }
    }
    
    console.log(`      🎯 Validation mode: ${useRawValidation ? 'RAW' : 'ExpectImplication'}${rawValidationReason ? ` (${rawValidationReason})` : ''}`);
    
    // ───────────────────────────────────────────────────────
    // Process blocks (for raw mode) OR legacy assertions
    // ───────────────────────────────────────────────────────
    let processedBlocks = [];
    let externalPoms = [];
    let legacyAssertions = null;
    
    if (hasBlocks && useRawValidation) {
      const blockResult = this._processBlocksForTemplate(screen.blocks, screenKey, isPlaywright);
      processedBlocks = blockResult.blocks;
      externalPoms = blockResult.externalPoms;
    } else if (!hasBlocks) {
      legacyAssertions = {
        visible: screen.visible || [],
        hidden: screen.hidden || [],
        checks: screen.checks || {},
        hasVisible: (screen.visible || []).length > 0,
        hasHidden: (screen.hidden || []).length > 0,
        hasTextChecks: Object.keys(screen.checks?.text || {}).length > 0
      };
    }
    
    // ───────────────────────────────────────────────────────
    // Calculate POM path with proper format
    // ───────────────────────────────────────────────────────
    let pomPathValue = null;
    let pomClassName = null;
    
    if (screen.screen) {
      let screenPath = screen.screen;
      
      if (screenPath.startsWith('../')) {
        pomPathValue = screenPath;
      } else {
        screenPath = screenPath.replace(/^screenObjects\//, '');
        if (!screenPath.endsWith('.js')) {
          screenPath = screenPath + '.js';
        }
        pomPathValue = `../../../screenObjects/${screenPath}`;
      }
      
      // Generate class name from screen path
      pomClassName = this._toPascalCase(
        screen.screen
          .replace(/\./g, '')
          .replace(/\//g, '')
          .replace(/\.js$/, '')
      );
    } else {
      // No screen property - use screenKey
      pomClassName = this._toPascalCase(screenKey);
    }
    
    console.log(`      📁 POM: ${pomClassName} from ${pomPathValue || 'N/A'}`);
    
    // ───────────────────────────────────────────────────────
    // Build screen object
    // ───────────────────────────────────────────────────────
    screens.push({
      screenKey,
      order,
      
      // POM info
      pomClassName: pomClassName,
      pomPath: pomPathValue,
      pomInstance: screen.instance || this._toCamelCase(screenKey),
      hasPom: !!pomPathValue,
      
      // Navigation
      hasNavigation: !!navigation,
      navigation,
      
      // Block info
      hasBlocks: hasBlocks,
      blocks: processedBlocks,
      blockCount: processedBlocks.length,
      
      // External POMs for function calls
      externalPoms: externalPoms,
      hasExternalPoms: externalPoms.length > 0,
      
      // Validation mode flags
      useRawValidation: useRawValidation,
      useExpectImplication: hasBlocks && !useRawValidation,
      rawValidationReason: rawValidationReason,
      
      // Legacy support (no blocks)
      hasLegacyAssertions: !hasBlocks && !!legacyAssertions && 
                           (legacyAssertions.hasVisible || legacyAssertions.hasHidden || legacyAssertions.hasTextChecks),
      legacyAssertions,
      useLegacyValidation: !hasBlocks,
      
      // Platform
      platformKey,
      isPlaywright
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // PASS 2: Sort by order and add position info
  // ═══════════════════════════════════════════════════════════
  screens.sort((a, b) => a.order - b.order);
  
  screens.forEach((screen, index) => {
    screen.position = index + 1;
    screen.totalScreens = screens.length;
    screen.isFirst = index === 0;
    screen.isLast = index === screens.length - 1;
  });
  
  // ═══════════════════════════════════════════════════════════
  // PASS 3: Collect unique POM requires (DEDUPLICATION FIX)
  // ═══════════════════════════════════════════════════════════
  const uniquePomRequires = new Map();
  
  for (const screen of screens) {
    // Add screen's own POM
    if (screen.pomPath && screen.pomClassName) {
      if (!uniquePomRequires.has(screen.pomClassName)) {
        uniquePomRequires.set(screen.pomClassName, {
          className: screen.pomClassName,
          path: screen.pomPath,
          isScreenPom: true
        });
      }
    }
    
    // Add external POMs from function calls
    if (screen.externalPoms && screen.externalPoms.length > 0) {
      for (const pom of screen.externalPoms) {
        if (!uniquePomRequires.has(pom.className)) {
          uniquePomRequires.set(pom.className, {
            className: pom.className,
            path: pom.pomPath,
            isScreenPom: false
          });
        }
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // Build result
  // ═══════════════════════════════════════════════════════════
  result.hasOrderedScreens = screens.length > 0;
  result.orderedScreens = screens;
  result.orderedScreenCount = screens.length;
  result.uniquePomRequires = Array.from(uniquePomRequires.values());
  
  // Summary
  const rawCount = screens.filter(s => s.useRawValidation).length;
  const expectCount = screens.filter(s => s.useExpectImplication).length;
  const legacyCount = screens.filter(s => s.useLegacyValidation).length;
  console.log(`\n   ✅ Prepared ${screens.length} screen(s):`);
  console.log(`      - ${expectCount} ExpectImplication`);
  console.log(`      - ${rawCount} Raw validation`);
  console.log(`      - ${legacyCount} Legacy`);
  console.log(`      - ${result.uniquePomRequires.length} unique POM(s) to require`);
  
  return result;
}


/**
 * Process blocks for template - WITH ARRAY INDEX SELECTOR SUPPORT
 * 
 * Replace the entire _processBlocksForTemplate method in UnitTestGenerator.js
 * 
 * Supports:
 * - element         → element (single)
 * - element[0]      → element.first() or element.nth(0)
 * - element[last]   → element.last()
 * - element[any]    → element.first() (at least one)
 * - element[all]    → loop checking all elements
 * - element[N]      → element.nth(N)
 */
/**
 * Process blocks for template - WITH ARRAY INDEX SELECTOR SUPPORT
 * 
 * Replace the entire _processBlocksForTemplate method in UnitTestGenerator.js
 * 
 * Supports:
 * - element         → element (single)
 * - element[0]      → element.first() or element.nth(0)
 * - element[last]   → element.last()
 * - element[any]    → element.first() (at least one)
 * - element[all]    → loop checking all elements
 * - element[N]      → element.nth(N)
 */
/**
 * Process blocks for template - WITH ARRAY INDEX SELECTOR SUPPORT
 * 
 * Replace the entire _processBlocksForTemplate method in UnitTestGenerator.js
 * 
 * Supports:
 * - element         → element (single)
 * - element[0]      → element.first() or element.nth(0)
 * - element[last]   → element.last()
 * - element[any]    → element.first() (at least one)
 * - element[all]    → loop checking all elements
 * - element[N]      → element.nth(N)
 */
_processBlocksForTemplate(blocks, screenKey, isPlaywright) {
  console.log(`\n🔍 _processBlocksForTemplate for ${screenKey}`);
  
  if (!Array.isArray(blocks)) return { blocks: [], externalPoms: [] };
  
  const processed = [];
  const screenInstance = this._toCamelCase(screenKey);
  
  // Track external POMs that need to be required
  const externalPoms = new Map();
  
  // ═══════════════════════════════════════════════════════════
  // Helper: Parse field with index notation
  // ═══════════════════════════════════════════════════════════
  const parseFieldWithIndex = (fieldStr) => {
    const match = fieldStr.match(/^(.+)\[(\d+|last|all|any)\]$/);
    if (!match) {
      return { field: fieldStr, indexType: '', customIndex: '' };
    }
    const idx = match[2];
    if (idx === '0') {
      return { field: match[1], indexType: 'first', customIndex: '' };
    } else if (['last', 'all', 'any'].includes(idx)) {
      return { field: match[1], indexType: idx, customIndex: '' };
    } else {
      return { field: match[1], indexType: 'custom', customIndex: idx };
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // Helper: Generate locator code based on index type
  // ═══════════════════════════════════════════════════════════
  const generateLocatorCode = (screenInst, field, indexType, customIndex) => {
    const base = `${screenInst}.${field}`;
    
    switch (indexType) {
      case 'first':
        return `${base}.first()`;
      case 'last':
        return `${base}.last()`;
      case 'any':
        return `${base}.first()`; // For visibility, check first exists
      case 'all':
        return base; // Will use different assertion pattern
      case 'custom':
        return `${base}.nth(${customIndex})`;
      default:
        return base;
    }
  };
  
  const enabledBlocks = blocks
    .filter(block => block.enabled !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  enabledBlocks.forEach((block, index) => {
    const blockType = block.type || 'ui-assertion';
    const blockData = block.data || block;
    
    switch (blockType) {
      // ═══════════════════════════════════════════════════════════
      // UI-ASSERTION BLOCK - WITH ARRAY INDEX SUPPORT
      // ═══════════════════════════════════════════════════════════
      case 'ui-assertion': {
        const assertions = [];
        const timeout = blockData.timeout || 30000;
        
        // ───────────────────────────────────────────────────────
        // VISIBLE assertions
        // ───────────────────────────────────────────────────────
        const visibleFields = blockData.visible || block.visible || [];
        if (Array.isArray(visibleFields) && visibleFields.length > 0) {
          for (const field of visibleFields) {
            const safeFieldRaw = this._sanitizeFieldName(field);
            const { field: baseField, indexType, customIndex } = parseFieldWithIndex(safeFieldRaw);
            const safeField = this._sanitizeFieldName(baseField);
            
            if (indexType === 'all') {
              // ALL elements must be visible
              assertions.push({
                assertionType: 'visible-all',
                field: safeField,
                originalField: field,
                expectCode: `// Check ALL ${safeField} elements are visible`
              });
              assertions.push({
                assertionType: 'visible-all',
                field: safeField,
                expectCode: `const ${safeField}VisibleCount = await ${screenInstance}.${safeField}.count();`
              });
              assertions.push({
                assertionType: 'visible-all',
                field: safeField,
                expectCode: `expect(${safeField}VisibleCount).toBeGreaterThan(0);`
              });
              assertions.push({
                assertionType: 'visible-all',
                field: safeField,
                expectCode: `for (let i = 0; i < ${safeField}VisibleCount; i++) {`
              });
              assertions.push({
                assertionType: 'visible-all',
                field: safeField,
                expectCode: isPlaywright
                  ? `  await expect(${screenInstance}.${safeField}.nth(i)).toBeVisible({ timeout: ${timeout} });`
                  : `  await expect(${screenInstance}.${safeField}.nth(i)).toBeDisplayed();`
              });
              assertions.push({
                assertionType: 'visible-all',
                field: safeField,
                expectCode: `}`
              });
            } else if (indexType === 'any') {
              // At least ONE must be visible
              assertions.push({
                assertionType: 'visible-any',
                field: safeField,
                originalField: field,
                expectCode: `// Check at least one ${safeField} is visible`
              });
              assertions.push({
                assertionType: 'visible-any',
                field: safeField,
                locator: `${screenInstance}.${safeField}.first()`,
                expectCode: isPlaywright
                  ? `await expect(${screenInstance}.${safeField}.first()).toBeVisible({ timeout: ${timeout} });`
                  : `await expect(${screenInstance}.${safeField}.first()).toBeDisplayed();`
              });
            } else {
              // Single element (no index, first, last, or custom)
              const locator = generateLocatorCode(screenInstance, safeField, indexType, customIndex);
              assertions.push({
                assertionType: 'visible',
                field: safeField,
                originalField: field,
                indexType: indexType || 'single',
                locator: locator,
                expectCode: isPlaywright
                  ? `await expect(${locator}).toBeVisible({ timeout: ${timeout} });`
                  : `await expect(${locator}).toBeDisplayed();`
              });
            }
          }
        }
        
        // ───────────────────────────────────────────────────────
        // HIDDEN assertions
        // ───────────────────────────────────────────────────────
        const hiddenFields = blockData.hidden || block.hidden || [];
        if (Array.isArray(hiddenFields) && hiddenFields.length > 0) {
          for (const field of hiddenFields) {
            const safeFieldRaw = this._sanitizeFieldName(field);
            const { field: baseField, indexType, customIndex } = parseFieldWithIndex(safeFieldRaw);
            const safeField = this._sanitizeFieldName(baseField);
            
            if (indexType === 'all') {
              // ALL elements must be hidden
              assertions.push({
                assertionType: 'hidden-all',
                field: safeField,
                originalField: field,
                expectCode: `// Check ALL ${safeField} elements are hidden`
              });
              assertions.push({
                assertionType: 'hidden-all',
                field: safeField,
                expectCode: `const ${safeField}HiddenCount = await ${screenInstance}.${safeField}.count();`
              });
              assertions.push({
                assertionType: 'hidden-all',
                field: safeField,
                expectCode: `for (let i = 0; i < ${safeField}HiddenCount; i++) {`
              });
              assertions.push({
                assertionType: 'hidden-all',
                field: safeField,
                expectCode: isPlaywright
                  ? `  await expect(${screenInstance}.${safeField}.nth(i)).toBeHidden({ timeout: ${timeout} });`
                  : `  await expect(${screenInstance}.${safeField}.nth(i)).not.toBeDisplayed();`
              });
              assertions.push({
                assertionType: 'hidden-all',
                field: safeField,
                expectCode: `}`
              });
            } else if (indexType === 'any') {
              // At least ONE must be hidden
              assertions.push({
                assertionType: 'hidden-any',
                field: safeField,
                originalField: field,
                expectCode: `// Check at least one ${safeField} is hidden`
              });
              assertions.push({
                assertionType: 'hidden-any',
                field: safeField,
                locator: `${screenInstance}.${safeField}.first()`,
                expectCode: isPlaywright
                  ? `await expect(${screenInstance}.${safeField}.first()).toBeHidden({ timeout: ${timeout} });`
                  : `await expect(${screenInstance}.${safeField}.first()).not.toBeDisplayed();`
              });
            } else {
              const locator = generateLocatorCode(screenInstance, safeField, indexType, customIndex);
              assertions.push({
                assertionType: 'hidden',
                field: safeField,
                originalField: field,
                indexType: indexType || 'single',
                locator: locator,
                expectCode: isPlaywright
                  ? `await expect(${locator}).toBeHidden({ timeout: ${timeout} });`
                  : `await expect(${locator}).not.toBeDisplayed();`
              });
            }
          }
        }
        
        // ───────────────────────────────────────────────────────
        // TEXT checks (exact match) - with index support
        // ───────────────────────────────────────────────────────
        const checks = blockData.checks || block.checks || {};
        if (checks.text && typeof checks.text === 'object') {
          for (const [field, expectedText] of Object.entries(checks.text)) {
            const { field: baseField, indexType, customIndex } = parseFieldWithIndex(field);
            const safeField = this._sanitizeFieldName(baseField);
            const resolvedText = this._resolveTemplateArg(expectedText);
            
            if (indexType === 'all') {
              assertions.push({
                assertionType: 'text-all',
                field: safeField,
                expectedText: resolvedText,
                expectCode: `// Check ALL ${safeField} elements have exact text`
              });
              assertions.push({
                assertionType: 'text-all',
                field: safeField,
                expectCode: `const ${safeField}TextCount = await ${screenInstance}.${safeField}.count();`
              });
              assertions.push({
                assertionType: 'text-all',
                field: safeField,
                expectCode: `for (let i = 0; i < ${safeField}TextCount; i++) {`
              });
              assertions.push({
                assertionType: 'text-all',
                field: safeField,
                expectCode: isPlaywright
                  ? `  await expect(${screenInstance}.${safeField}.nth(i)).toHaveText(${resolvedText}, { timeout: ${timeout} });`
                  : `  await expect(${screenInstance}.${safeField}.nth(i)).toHaveText(${resolvedText});`
              });
              assertions.push({
                assertionType: 'text-all',
                field: safeField,
                expectCode: `}`
              });
            } else {
              const locator = generateLocatorCode(screenInstance, safeField, indexType, customIndex);
              assertions.push({
                assertionType: 'text',
                field: safeField,
                expectedText: resolvedText,
                locator: locator,
                expectCode: isPlaywright
                  ? `await expect(${locator}).toHaveText(${resolvedText}, { timeout: ${timeout} });`
                  : `await expect(${locator}).toHaveText(${resolvedText});`
              });
            }
          }
        }
        
        // ───────────────────────────────────────────────────────
        // CONTAINS checks - with index support
        // ───────────────────────────────────────────────────────
        if (checks.contains && typeof checks.contains === 'object') {
          for (const [field, expectedText] of Object.entries(checks.contains)) {
            const { field: baseField, indexType, customIndex } = parseFieldWithIndex(field);
            const safeField = this._sanitizeFieldName(baseField);
            const resolvedText = this._resolveTemplateArg(expectedText);
            
            if (indexType === 'all') {
              assertions.push({
                assertionType: 'contains-all',
                field: safeField,
                expectedText: resolvedText,
                expectCode: `// Check ALL ${safeField} elements contain text`
              });
              assertions.push({
                assertionType: 'contains-all',
                field: safeField,
                expectCode: `const ${safeField}ContainsCount = await ${screenInstance}.${safeField}.count();`
              });
              assertions.push({
                assertionType: 'contains-all',
                field: safeField,
                expectCode: `for (let i = 0; i < ${safeField}ContainsCount; i++) {`
              });
              assertions.push({
                assertionType: 'contains-all',
                field: safeField,
                expectCode: isPlaywright
                  ? `  await expect(${screenInstance}.${safeField}.nth(i)).toContainText(${resolvedText}, { timeout: ${timeout} });`
                  : `  await expect(${screenInstance}.${safeField}.nth(i)).toHaveTextContaining(${resolvedText});`
              });
              assertions.push({
                assertionType: 'contains-all',
                field: safeField,
                expectCode: `}`
              });
            } else if (indexType === 'any') {
              assertions.push({
                assertionType: 'contains-any',
                field: safeField,
                expectedText: resolvedText,
                expectCode: `// Check at least one ${safeField} contains text`
              });
              assertions.push({
                assertionType: 'contains-any',
                field: safeField,
                locator: `${screenInstance}.${safeField}.first()`,
                expectCode: isPlaywright
                  ? `await expect(${screenInstance}.${safeField}.first()).toContainText(${resolvedText}, { timeout: ${timeout} });`
                  : `await expect(${screenInstance}.${safeField}.first()).toHaveTextContaining(${resolvedText});`
              });
            } else {
              const locator = generateLocatorCode(screenInstance, safeField, indexType, customIndex);
              assertions.push({
                assertionType: 'contains',
                field: safeField,
                expectedText: resolvedText,
                locator: locator,
                expectCode: isPlaywright
                  ? `await expect(${locator}).toContainText(${resolvedText}, { timeout: ${timeout} });`
                  : `await expect(${locator}).toHaveTextContaining(${resolvedText});`
              });
            }
          }
        }
        
        // ───────────────────────────────────────────────────────
        // TRUTHY function checks
        // ───────────────────────────────────────────────────────
        const truthyFields = blockData.truthy || [];
        if (Array.isArray(truthyFields) && truthyFields.length > 0) {
          for (const funcName of truthyFields) {
            const safeFn = this._sanitizeFieldName(funcName);
            assertions.push({
              assertionType: 'truthy',
              field: safeFn,
              expectCode: `expect(await ${screenInstance}.${safeFn}()).toBeTruthy();`
            });
          }
        }
        
        // ───────────────────────────────────────────────────────
        // FALSY function checks
        // ───────────────────────────────────────────────────────
        const falsyFields = blockData.falsy || [];
        if (Array.isArray(falsyFields) && falsyFields.length > 0) {
          for (const funcName of falsyFields) {
            const safeFn = this._sanitizeFieldName(funcName);
            assertions.push({
              assertionType: 'falsy',
              field: safeFn,
              expectCode: `expect(await ${screenInstance}.${safeFn}()).toBeFalsy();`
            });
          }
        }
        
        if (assertions.length > 0) {
          processed.push({
            blockType: 'ui-assertion',
            position: index + 1,
            description: block.label || block.description || 'UI assertions',
            assertions,
            assertionCount: assertions.length,
            enabled: true
          });
          console.log(`   ✅ Added ui-assertion block with ${assertions.length} assertion(s)`);
        } else {
          console.log(`   ⚠️  Skipping empty UI assertion block at position ${index + 1}`);
        }
        break;
      }
      
      // ═══════════════════════════════════════════════════════════
      // FUNCTION-CALL BLOCK (unchanged)
      // ═══════════════════════════════════════════════════════════
      case 'function-call': {
        const rawInstance = blockData.instance || block.instance || null;
        const method = blockData.method || block.method || 'doSomething';
        const storeAs = blockData.storeAs || block.storeAs || null;
        const args = (blockData.args || block.args || []).map(arg => this._resolveTemplateArg(arg));
        const argsString = args.join(', ');
        
        // Determine if this is the same POM or an external one
        let instanceName;
        let isExternal = false;
        
        if (!rawInstance || this._isSamePom(rawInstance, screenKey)) {
          instanceName = screenInstance;
        } else {
          isExternal = true;
          const cleanName = rawInstance.replace(/\.(wrapper|screen|page)$/i, '');
          instanceName = this._toCamelCase(cleanName);
          
          if (!externalPoms.has(instanceName)) {
            externalPoms.set(instanceName, {
              instanceName,
              className: this._toPascalCase(cleanName) + 'Wrapper',
              rawInstance: rawInstance,
              pomPath: `../../../screenObjects/${cleanName}.wrapper.js`
            });
          }
        }
        
        let callCode;
        if (storeAs) {
          callCode = `const ${storeAs} = await ${instanceName}.${method}(${argsString});`;
        } else {
          callCode = `await ${instanceName}.${method}(${argsString});`;
        }
        
        processed.push({
          blockType: 'function-call',
          position: index + 1,
          description: block.label || block.description || `Call ${instanceName}.${method}()`,
          instance: instanceName,
          rawInstance: rawInstance,
          method,
          args,
          argsString,
          storeAs,
          callCode,
          isExternal,
          enabled: true
        });
        console.log(`   ✅ Added function-call block: ${instanceName}.${method}()${isExternal ? ' (EXTERNAL)' : ''}`);
        break;
      }
      
      // ═══════════════════════════════════════════════════════════
      // CUSTOM-CODE BLOCK (unchanged)
      // ═══════════════════════════════════════════════════════════
      case 'custom-code': {
        const code = block.code || blockData.code || '';
        
        if (!code.trim()) {
          console.log(`   ⚠️  Skipping empty custom-code block at position ${index + 1}`);
          break;
        }
        
        const baseIndent = block.wrapInTestStep ? '        ' : '      ';
        const formattedCode = code
          .split('\n')
          .map(line => `${baseIndent}${line}`)
          .join('\n');
        
        processed.push({
          blockType: 'custom-code',
          position: index + 1,
          description: block.label || block.description || 'Custom code',
          code: code,
          formattedCode: formattedCode,
          testStepName: block.testStepName || null,
          wrapInTestStep: block.wrapInTestStep || false,
          enabled: true
        });
        console.log(`   ✅ Added custom-code block`);
        break;
      }
      
      default:
        console.warn(`⚠️  Unknown block type: ${blockType}`);
    }
  });
  
  // Renumber positions after filtering
  processed.forEach((block, idx) => {
    block.position = idx + 1;
  });
  
  console.log(`   📊 Processed ${processed.length} block(s), ${externalPoms.size} external POM(s)`);
  
  return {
    blocks: processed,
    externalPoms: Array.from(externalPoms.values())
  };
}

// Helper: Sanitize field name for valid JS property access
_sanitizeFieldName(field) {
  if (!field) return field;
  // Replace spaces with camelCase
  return field.replace(/\s+(.)/g, (_, char) => char.toUpperCase()).replace(/\s+/g, '');
}

// Helper: Check if instance refers to same POM
_isSamePom(instance, screenKey) {
  if (!instance) return true;
  const normalizedInstance = instance.toLowerCase().replace(/\.(wrapper|screen|page)$/i, '');
  const normalizedScreen = screenKey.toLowerCase().replace(/\.(wrapper|screen|page)$/i, '');
  return normalizedInstance.includes(normalizedScreen) || normalizedScreen.includes(normalizedInstance);
}

// Helper: Sanitize field name for valid JS property access
_sanitizeFieldName(field) {
  if (!field) return field;
  // If field has spaces or special chars, we need bracket notation
  // But for now, just replace spaces with camelCase
  return field.replace(/\s+(.)/g, (_, char) => char.toUpperCase()).replace(/\s+/g, '');
}

// Helper: Check if instance refers to same POM
_isSamePom(instance, screenKey) {
  if (!instance) return true;
  const normalizedInstance = instance.toLowerCase().replace(/\.(wrapper|screen|page)$/i, '');
  const normalizedScreen = screenKey.toLowerCase().replace(/\.(wrapper|screen|page)$/i, '');
  return normalizedInstance.includes(normalizedScreen) || normalizedScreen.includes(normalizedInstance);
}


/**
 * Resolve template argument
 * 
 * Converts:
 * - "{{ctx.data.x}}" → "ctx.data.x"
 * - "{{email}}" → "ctx.data.email"
 * - "ctx.data.x" → "ctx.data.x"
 * - "result.data.x" → "result.data.x"
 * - "literal" → "'literal'"
 * 
 * @param {string} arg - Argument to resolve
 * @returns {string} Resolved argument
 */
_resolveTemplateArg(arg) {
  if (typeof arg !== 'string') return String(arg);
  
  // Template variable: {{ctx.data.x}} → ctx.data.x
  if (arg.startsWith('{{') && arg.endsWith('}}')) {
    const inner = arg.slice(2, -2);
    // If it's already ctx.data or result.data, use as-is
    if (inner.startsWith('ctx.data.') || inner.startsWith('result.data.')) {
      return inner;
    }
    // Otherwise, assume it's a data field
    return `ctx.data.${inner}`;
  }
  
  // Already a context reference - use as-is
  if (arg.startsWith('ctx.data.') || arg.startsWith('result.data.')) {
    return arg;
  }
  
  // Number - use as-is
  if (!isNaN(arg)) {
    return arg;
  }
  
  // Boolean - use as-is
  if (arg === 'true' || arg === 'false') {
    return arg;
  }
  
  // Literal string - wrap in quotes
  return `'${arg}'`;
}

  /**
 * Determine if this is an INDUCER or VERIFY test
 * 
 * Logic:
 * - If this platform is in transition.platforms â†’ INDUCER
 * - If this platform is NOT in transition.platforms but has mirrorsOn.UI â†’ VERIFY
 * 
 * @returns {object} { mode: 'inducer'|'verify', transition: {...} }
 */
_determineTestMode(source, platform, stateName) {
  console.log(`\n🔍 Determining test mode for ${stateName} on ${platform}`);
  
  // Handle both ImplClass and metadata being passed
  const xstateConfig = source.xstateConfig || source.meta?.xstateConfig || source;
  
  let transition = null;
  
  // Check all states for transitions TO stateName
  if (xstateConfig && xstateConfig.states) {
    for (const [sourceState, sourceConfig] of Object.entries(xstateConfig.states)) {
      for (const [event, target] of Object.entries(sourceConfig.on || {})) {
        const targetState = typeof target === 'string' ? target : target.target;
        if (targetState === stateName) {
          transition = {
            event,
            from: sourceState,
            platforms: target.platforms || [],
            actionDetails: target.actionDetails
          };
          break;
        }
      }
      if (transition) break;
    }
  }
  
  // No transition found = initial state (always inducer)
  if (!transition) {
    console.log(`   ✅ Mode: INDUCER (initial state or no states found)`);
    return { mode: 'inducer', transition: null };
  }
  
  // Check if this platform can induce
  const canInduce = transition.platforms.includes(platform);
  
  if (canInduce) {
    console.log(`   ✅ Mode: INDUCER (${platform} in platforms: ${transition.platforms})`);
    return { mode: 'inducer', transition };
  } else {
    console.log(`   ✅ Mode: VERIFY (${platform} NOT in platforms: ${transition.platforms})`);
    return { mode: 'verify', transition };
  }
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
  
  const absolutePath = path.resolve(implFilePath);
  const projectRoot = this._findProjectRoot(absolutePath);
  const originalCwd = process.cwd();
  
  try {
    process.chdir(projectRoot);
    console.log(`   ðŸ“ Changed to project root: ${projectRoot}`);
    
    // Clear cache
    delete require.cache[require.resolve(absolutePath)];
    
    // âœ… TRY to require, but have fallback
    let ImplClass;
    
   try {
  ImplClass = require(absolutePath);
} catch (requireError) {
  console.warn(`   âš ï¸  Could not require file:`);
  console.warn(`   Error: ${requireError.message}`);
  console.warn(`   Stack: ${requireError.stack}`); // âœ… ADD THIS
  console.warn(`   ðŸ“– Falling back to AST parsing...`);
      
      // Parse the file directly with AST
      const content = fs.readFileSync(absolutePath, 'utf-8');
      ImplClass = this._parseImplicationFromAST(content);
    }
    
    if (!ImplClass || !ImplClass.xstateConfig) {
      throw new Error(`Invalid Implication: missing xstateConfig in ${absolutePath}`);
    }
    
    return ImplClass;
    
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * Parse Implication from AST (when require() fails)
 */
_parseImplicationFromAST(content) {
  const ast = parse(content, {
    sourceType: 'module',
    plugins: ['classProperties', 'objectRestSpread']
  });
  
  let className = null;
  let xstateConfig = null;
  let mirrorsOn = null;
  let triggeredBy = null;
  
  // âœ… Store 'this' reference
  const self = this;
  
  traverse(ast, {
    ClassDeclaration(path) {
      className = path.node.id?.name;
      
      path.node.body.body.forEach(member => {
        if (member.type === 'ClassProperty' && member.static) {
          const propName = member.key?.name;
          
          if (propName === 'xstateConfig') {
            xstateConfig = self._astNodeToObject(member.value);  // âœ… Use self
          } else if (propName === 'mirrorsOn') {
            mirrorsOn = self._astNodeToObject(member.value);     // âœ… Use self
          } else if (propName === 'triggeredBy') {
            triggeredBy = self._astNodeToObject(member.value);   // âœ… Use self
          }
        }
      });
    }
  });
  
  return {
    name: className,
    xstateConfig,
    mirrorsOn,
    triggeredBy
  };
}

/**
 * Convert AST node to plain JavaScript object
 */
_astNodeToObject(node) {
  if (!node) return null;
  
  switch (node.type) {
    case 'StringLiteral':
      return node.value;
    
    case 'NumericLiteral':
      return node.value;
    
    case 'BooleanLiteral':
      return node.value;
    
    case 'NullLiteral':
      return null;
    
    case 'ObjectExpression':
      const obj = {};
      const debugKeys = node.properties.map(p => p.key?.name).filter(Boolean);
  if (debugKeys.includes('CANCEL_REQUEST') || debugKeys.includes('CHECK_IN')) {
    console.log('   ðŸ” PARSING TRANSITIONS OBJECT!');
    console.log('   ðŸ“Š Properties:', debugKeys);
    console.log('   ðŸ“Š Property count:', node.properties.length);
    
    node.properties.forEach((prop, i) => {
      const key = prop.key?.name || prop.key?.value;
      console.log(`   ðŸ“ Property ${i}: ${key}`);
      console.log(`      Value type: ${prop.value?.type}`);
      
      if (prop.value?.type === 'ObjectExpression') {
        const innerKeys = prop.value.properties.map(p => p.key?.name).filter(Boolean);
        console.log(`      Inner keys: ${innerKeys.join(', ')}`);
      }
    });
  }
  
  node.properties.forEach(prop => {
    if (prop.key) {
      const key = prop.key.name || prop.key.value;
      const value = this._astNodeToObject(prop.value);
      
      obj[key] = value;
    }
  });
  return obj;
    
    case 'ArrayExpression':
      return node.elements.map(el => this._astNodeToObject(el));
    
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return '<function>';
    
    case 'CallExpression':
      return '<call>';
    
    case 'TemplateLiteral':
      // Handle template strings like `new ${ClassName}()`
      return '<template>';
      
    case 'Identifier':
      // Handle identifiers (variable names)
      return node.name;
    
    default:
      // Return empty object for unknown types instead of null
      return {};
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
      // âœ… ADDITIONAL CHECK: Make sure we're not IN tests/ ourselves!
      if (!currentDir.endsWith('/tests') && !currentDir.includes('/tests/')) {
        return currentDir;
      }
    }
    
    // Go up one level
    const parentDir = path.dirname(currentDir);
    
    // Reached filesystem root?
    if (parentDir === currentDir) {
      break;
    }
    
    currentDir = parentDir;
  }
  
  // Fallback
  console.warn('   âš ï¸  Could not find project root, using implication directory');
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
  
  let meta, status, entry, transitions, previousStatus, targetStateName;
  
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
    targetStateName = stateName;
    
    previousStatus = this._findPreviousState(xstateConfig.states, stateName);
    
  } else {
    // Single-state machine
    meta = xstateConfig.meta || {};
    status = meta.status;
    entry = xstateConfig.entry;
    transitions = xstateConfig.on || {};
    previousStatus = meta.requires?.previousStatus;
    targetStateName = status;
  }

  // âœ… NEW: Check if we have a specific transition to use
  let actionDetails = null;
  let allTransitions = [];
  
  if (this.currentTransition) {
    console.log(`\n✅ USING PROVIDED TRANSITION: ${this.currentTransition.event}`);
    console.log(`   From: ${this.currentTransition.fromState}`);
    
    // ✅ FIX: Read actionDetails from SOURCE FILE instead of trusting frontend
    // Frontend may have stale/incomplete data (e.g., missing storeAs values)
    const sourceFile = this._findImplicationFile(this.currentTransition.fromState, implFilePath);
    
    if (sourceFile) {
      console.log(`   📂 Reading actionDetails from: ${sourceFile}`);
      
      // Try require first (faster)
      let fileActionDetails = this._extractActionDetailsViaRequire(
        sourceFile, 
        this.currentTransition.event, 
        targetStateName
      );
      
      // Fallback to AST if require fails
      if (!fileActionDetails) {
        console.log(`   ⚠️ Require failed, trying AST...`);
        fileActionDetails = this._extractActionDetailsViaAST(
          sourceFile,
          this.currentTransition.event,
          targetStateName
        );
      }
      
      if (fileActionDetails) {
        actionDetails = fileActionDetails;
        console.log(`   ✅ Got actionDetails from file`);
        console.log(`   📊 Steps: ${fileActionDetails.steps?.length || 0}`);
        
        // Debug: Log storeAs values
        if (fileActionDetails.steps) {
          fileActionDetails.steps.forEach((step, i) => {
            if (step.storeAs) {
              console.log(`   💾 Step ${i} has storeAs: "${step.storeAs}"`);
            }
          });
        }
      } else {
        // Last resort: use frontend's version
        console.log(`   ⚠️ Could not read from file, using frontend data`);
        actionDetails = this.currentTransition.actionDetails;
      }
    } else {
      console.log(`   ⚠️ Source file not found, using frontend data`);
      actionDetails = this.currentTransition.actionDetails;
    }
    
    allTransitions = [this.currentTransition];
    
  } else {
    console.log(`\nðŸ” NO TRANSITION PROVIDED - searching...`);
    
    // âœ… OLD WAY: Get ALL transitions that lead to this state
    allTransitions = this._extractActionDetailsFromTransition(
      xstateConfig,
      targetStateName,
      platform,
      previousStatus,
      implFilePath
    );

    console.log(`\nðŸ› DEBUG actionDetails extraction:`);
    console.log(`   targetState: ${targetStateName}`);
    console.log(`   previousStatus: ${previousStatus}`);
    console.log(`   implFilePath: ${implFilePath}`);
    console.log(`   transitions found: ${allTransitions.length}`);

    // For now, use first transition (backward compatibility)
    if (allTransitions.length > 0) {
      const preferredTransition = allTransitions.find(
        t => t.fromState === previousStatus
      );
      
      actionDetails = preferredTransition 
        ? preferredTransition.actionDetails 
        : allTransitions[0].actionDetails;
        
      console.log(`   âœ… Using transition from: ${preferredTransition ? preferredTransition.fromState : allTransitions[0].fromState}`);
    }

    console.log(`   actionDetails found: ${!!actionDetails}`);
  }

  
  // Rest of function continues...
 const metadata = {
    className: ImplClass.name,
    status: status,
    previousStatus: previousStatus,
    meta: meta,
    
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
    
    // âœ… NEW: Store ALL transitions
    allTransitions: allTransitions,
    
    // Action details (backward compatibility - first transition)
    actionDetails: actionDetails,
    
    // Triggered by (multi-platform actions)
    triggeredBy: ImplClass.triggeredBy || [],
    
    // Mirrors on (for validation - Phase 2)
    mirrorsOn: ImplClass.mirrorsOn,
    
    // State name (for multi-state)
    stateName: stateName
  };

   // âœ… Store metadata so _processActionDetailsImports can access entity
  this.currentMetadata = metadata;
  
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

    if (platform && metadata.meta) {
    console.log(`   ðŸ”§ Overriding platform: ${metadata.meta.platform} â†’ ${platform}`);
    metadata.meta.platform = platform;
  }
  
  return metadata;
}

/**
 * Get all transitions that lead to a target state
 * Uses discovery cache instead of searching files
 * 
 * @param {string} targetState - Target state name (e.g., "booking_accepted")
 * @param {string} projectPath - Project root path
 * @returns {Array} Array of transitions TO this state
 */
_getIncomingTransitions(targetState, projectPath) {
  console.log(`\nðŸ—ºï¸  Finding transitions TO "${targetState}"...`);
  
  try {
    // Load discovery cache
    const cacheDir = path.join(projectPath, '.implications-framework', 'cache');
    const discoveryCache = path.join(cacheDir, 'discovery-result.json');
    
    if (!fs.existsSync(discoveryCache)) {
      console.log(`   âš ï¸  No discovery cache found`);
      return [];
    }
    
    const discovery = JSON.parse(fs.readFileSync(discoveryCache, 'utf-8'));
    
    if (!discovery.transitions) {
      console.log(`   âš ï¸  No transitions in cache`);
      return [];
    }
    
    // Filter transitions that go TO our target
    const incoming = discovery.transitions.filter(t => {
      // Handle both exact match and partial match
      return t.to === targetState || 
             t.to === `booking_${targetState}` ||
             t.to.endsWith(`_${targetState}`);
    });
    
    console.log(`   âœ… Found ${incoming.length} incoming transition(s):`);
    incoming.forEach(t => {
      console.log(`      ${t.from} --${t.event}--> ${t.to}`);
    });
    
    return incoming;
    
  } catch (error) {
    console.log(`   âŒ Error loading discovery cache: ${error.message}`);
    return [];
  }
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
/**
 * Extract ALL actionDetails from transitions that lead to this state
 * Uses discovery cache to find ALL incoming transitions
 * 
 * @returns {Array} Array of transition objects with actionDetails
 */
_extractActionDetailsFromTransition(xstateConfig, targetStateName, platform, previousStatus = null, implFilePath = null) {
  console.log(`\nðŸ” === _extractActionDetailsFromTransition ===`);
  console.log(`   targetStateName: ${targetStateName}`);
  console.log(`   platform: ${platform}`);
  console.log(`   previousStatus: ${previousStatus}`);
  console.log(`   implFilePath: ${implFilePath}`);
  console.log(`   this.projectPath: ${this.projectPath}`);
  console.log(`   this.currentTransition:`, this.currentTransition);
  
  const allTransitions = [];
  
  // âœ… STEP 1: Get ALL incoming transitions from discovery cache
  const incomingTransitions = this._getIncomingTransitions(targetStateName, this.projectPath);
  
  console.log(`   ðŸ“¥ Got ${incomingTransitions.length} incoming transitions`);
  incomingTransitions.forEach(t => {
    console.log(`      - ${t.from} --${t.event}--> ${t.to}`);
  });
  
  if (incomingTransitions.length === 0) {
    console.log(`   âš ï¸  No incoming transitions found in discovery cache`);
    console.log(`   âš ï¸  Falling back to previousStatus search...`);
  }
  
  // âœ… STEP 2: For each incoming transition, load the source file and extract actionDetails
  // âœ… RIGHT - transition.from is already the status!
for (const transition of incomingTransitions) {
  console.log(`\nðŸ“‚ Processing transition: ${transition.from} --${transition.event}--> ${transition.to}`);
  
  // âœ… transition.from contains the status name (e.g., "booking_pending")
  // But discovery is returning className, not status! Let's check the cache structure...
  
  // Find the source file using the "from" state
  const sourceFile = this._findImplicationFile(transition.from, implFilePath);
    
    if (!sourceFile || !fs.existsSync(sourceFile)) {
      console.log(`   âŒ Source file not found for: ${transition.from}`);
      continue;
    }
    
    // Try loading with require first
    let actionDetails = this._extractActionDetailsViaRequire(sourceFile, transition.event, targetStateName);
    
    // Fallback to AST if require fails
    if (!actionDetails) {
      actionDetails = this._extractActionDetailsViaAST(sourceFile, transition.event, targetStateName);
    }
    
    if (actionDetails) {
      allTransitions.push({
        event: transition.event,
        fromState: transition.from,
        target: transition.to,
        platforms: actionDetails.platforms || transition.platforms || [],
        actionDetails: actionDetails
      });
      
      console.log(`   âœ… Extracted actionDetails for ${transition.event}`);
    } else {
      console.log(`   âš ï¸  No actionDetails found for ${transition.event}`);
    }
  }
  
  // âœ… STEP 3: Fallback - if discovery cache had no results, use old method
  if (allTransitions.length === 0 && previousStatus && implFilePath) {
    console.log(`\nðŸ“‚ Fallback: Checking previous state file...`);
    console.log(`   Previous Status: ${previousStatus}`);
    
    const previousFile = this._findImplicationFile(previousStatus, implFilePath);
    
    if (previousFile && fs.existsSync(previousFile)) {
      // Try require
      let actionDetails = this._extractActionDetailsViaRequire(previousFile, null, targetStateName);
      
      // Try AST
      if (!actionDetails) {
        actionDetails = this._extractActionDetailsViaAST(previousFile, null, targetStateName);
      }
      
      if (actionDetails) {
        allTransitions.push({
          event: 'UNKNOWN',
          fromState: previousStatus,
          target: targetStateName,
          platforms: [],
          actionDetails: actionDetails
        });
      }
    }
  }
  
  // âœ… STEP 4: Remove duplicates (same event + fromState)
  const uniqueTransitions = [];
  const seen = new Set();
  
  for (const transition of allTransitions) {
    const key = `${transition.fromState}:${transition.event}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTransitions.push(transition);
    }
  }
  
  console.log(`\nâœ… === FOUND ${uniqueTransitions.length} UNIQUE TRANSITION(S) ===\n`);
  
  return uniqueTransitions;
}

/**
 * Extract actionDetails via require (fast but may fail)
 */
_extractActionDetailsViaRequire(filePath, eventName, targetStateName) {
  try {
    const require = createRequire(import.meta.url);
    delete require.cache[require.resolve(filePath)];
    
    const ImplClass = require(filePath);
    const xstateConfig = ImplClass.xstateConfig;
    
    if (!xstateConfig?.on) return null;
    
    for (const [event, config] of Object.entries(xstateConfig.on)) {
      // If eventName specified, match it
      if (eventName && event !== eventName) continue;
      
      const transition = this._parseTransition(event, config, null, targetStateName);
      if (transition) {
        return transition.actionDetails;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract actionDetails via AST (fallback when require fails)
 */
_extractActionDetailsViaAST(filePath, eventName, targetStateName) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['classProperties', 'objectRestSpread']
    });
    
    const xstateConfig = this._extractXStateFromAST(ast);
    
    if (!xstateConfig?.on) return null;
    
    for (const [event, config] of Object.entries(xstateConfig.on)) {
      // If eventName specified, match it
      if (eventName && event !== eventName) continue;
      
      const transition = this._parseTransition(event, config, null, targetStateName);
      if (transition) {
        return transition.actionDetails;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get all transitions that lead to a target state from discovery cache
 */
_getIncomingTransitions(targetState, projectPath) {
  console.log(`\nðŸ—ºï¸  Finding transitions TO "${targetState}"...`);
  
  try {
    const cacheDir = path.join(projectPath, '.implications-framework', 'cache');
    const discoveryCache = path.join(cacheDir, 'discovery-result.json');
    
    if (!fs.existsSync(discoveryCache)) {
      console.log(`   âš ï¸  No discovery cache found`);
      return [];
    }
    
    const discovery = JSON.parse(fs.readFileSync(discoveryCache, 'utf-8'));
    
    if (!discovery.transitions) {
      console.log(`   âš ï¸  No transitions in cache`);
      return [];
    }
    
    // Filter transitions that go TO our target (with flexible matching)
    const incoming = discovery.transitions.filter(t => {
      const cleanTarget = t.to.replace(/^booking_/, '').replace(/_/g, '');
      const cleanSearch = targetState.replace(/^booking_/, '').replace(/_/g, '');
      return cleanTarget === cleanSearch;
    });
    
    console.log(`   âœ… Found ${incoming.length} incoming transition(s):`);
    incoming.forEach(t => {
      console.log(`      ${t.from} --${t.event}--> ${t.to}`);
    });
    
    return incoming;
    
  } catch (error) {
    console.log(`   âŒ Error loading discovery cache: ${error.message}`);
    return [];
  }
}

/**
 * Parse a single transition and check if it matches target
 */
_parseTransition(eventName, transitionConfig, fromState, targetStateName) {
  let target, actionDetails, platforms;
  
  if (typeof transitionConfig === 'string') {
    target = transitionConfig;
  } else if (typeof transitionConfig === 'object') {
    target = transitionConfig.target;
    actionDetails = transitionConfig.actionDetails;
    platforms = transitionConfig.platforms || [];
  }
  
  const cleanTarget = target?.replace(/^#/, '');
  
  // Flexible matching
  const isMatch = cleanTarget === targetStateName || 
                  cleanTarget === `booking_${targetStateName}` ||
                  cleanTarget.endsWith(`_${targetStateName}`);
  
  if (isMatch && actionDetails) {
    return {
      event: eventName,
      fromState: fromState || 'root',
      target: cleanTarget,
      platforms: platforms,
      actionDetails: actionDetails
    };
  }
  
  return null;
}
/**
 * Parse a single transition and check if it matches target
 * 
 * @returns {Object|null} Transition object or null if no match
 */
_parseTransition(eventName, transitionConfig, fromState, targetStateName) {
  let target, actionDetails, platforms;
  
  if (typeof transitionConfig === 'string') {
    target = transitionConfig;
  } else if (typeof transitionConfig === 'object') {
    target = transitionConfig.target;
    actionDetails = transitionConfig.actionDetails;
    platforms = transitionConfig.platforms || [];
  }
  
  const cleanTarget = target?.replace(/^#/, '');
  
  // âœ… Flexible matching
  const isMatch = cleanTarget === targetStateName || 
                  cleanTarget === `booking_${targetStateName}` ||
                  cleanTarget.endsWith(`_${targetStateName}`);
  
  if (isMatch && actionDetails) {
    return {
      event: eventName,
      fromState: fromState || 'root',
      target: cleanTarget,
      platforms: platforms,
      actionDetails: actionDetails
    };
  }
  
  return null;
}

_extractXStateFromAST(ast) {
  const self = this;
  let xstateConfig = null;
  
  traverse(ast, {
    ClassProperty(path) {
      if (path.node.static && path.node.key?.name === 'xstateConfig') {
        console.log('   ðŸ” Found xstateConfig property in AST');
        console.log('   ðŸ“Š Value type:', path.node.value.type);
        
        xstateConfig = self._astNodeToObject(path.node.value);
        
        console.log('   ðŸ“Š Parsed xstateConfig keys:', Object.keys(xstateConfig || {}));
        
        if (xstateConfig?.on) {
          console.log('   ðŸ“Š on keys:', Object.keys(xstateConfig.on));
          console.log('   ðŸ“Š on object:', JSON.stringify(xstateConfig.on, null, 2));
        } else {
          console.log('   âŒ No "on" property found after parsing!');
        }
      }
    }
  });
  
  return xstateConfig;
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
/**
 * Find Implication file for a given status using state registry
 */
_findImplicationFile(status, currentFilePath) {
  console.log(`\nðŸ” _findImplicationFile:`);
  console.log(`   status: "${status}"`);
  console.log(`   currentFilePath: ${currentFilePath}`);
  console.log(`   this.projectPath: ${this.projectPath}`);
  
  const path = require('path');
  const fs = require('fs');
  
  // âœ… Use project path instead of process.cwd()
  const registryPath = path.join(
    this.projectPath,
    'tests/implications/.state-registry.json'
  );
  
  console.log(`   ðŸ“ Registry path: ${registryPath}`);
  console.log(`   ðŸ“ Exists? ${fs.existsSync(registryPath)}`);
  
  console.log(`   ðŸ“ Registry path: ${registryPath}`);
  
  if (fs.existsSync(registryPath)) {
    try {
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      
      // Try exact match first
      if (registry[status]) {
        const implDir = path.dirname(currentFilePath);
        const implFile = path.join(implDir, `${registry[status]}.js`);
        if (fs.existsSync(implFile)) {
          console.log(`   âœ… Found via registry: ${status} â†’ ${registry[status]}`);
          return implFile;
        }
      }
      
      // Try normalized match (without underscores)
      const normalized = status.replace(/_/g, '').toLowerCase();
      if (registry[normalized]) {
        const implDir = path.dirname(currentFilePath);
        const implFile = path.join(implDir, `${registry[normalized]}.js`);
        if (fs.existsSync(implFile)) {
          console.log(`   âœ… Found via registry (normalized): ${status} â†’ ${registry[normalized]}`);
          return implFile;
        }
      }
    } catch (error) {
      console.log(`   âš ï¸  Could not read registry: ${error.message}`);
    }
  } else {
    console.log(`   âš ï¸  Registry not found at: ${registryPath}`);
  }
  
  // âœ… STEP 2: Fallback to convention (snake_case â†’ PascalCase)
  const className = status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  
  const implDir = path.dirname(currentFilePath);
  const conventionPath = path.join(implDir, `${className}Implications.js`);
  
  if (fs.existsSync(conventionPath)) {
    console.log(`   âœ… Found via convention: ${status} â†’ ${className}Implications`);
    return conventionPath;
  }
  
  // âœ… STEP 3: Last resort - scan directory
  try {
    const files = fs.readdirSync(implDir)
      .filter(f => f.endsWith('Implications.js'));
    
    for (const file of files) {
      const filePath = path.join(implDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Look for id: 'status' in xstateConfig
      if (content.includes(`id: '${status}'`) || 
          content.includes(`status: '${status}'`)) {
        console.log(`   âœ… Found via scan: ${status} â†’ ${file}`);
        return filePath;
      }
    }
  } catch (error) {
    console.log(`   âš ï¸  Could not scan directory: ${error.message}`);
  }
  
  console.log(`   âŒ Not found: ${status}`);
  return null;
}
  
  /**
   * Build template context from metadata
   */
/**
 * Build template context from metadata
 * 
 * @param {object} metadata - Extracted metadata from Implication
 * @param {string} platform - Platform (web, cms, dancer, etc.)
 * @param {object} transition - Current transition info (optional)
 * @param {object} options - Options including forceRawValidation
 * @returns {object} Template context
 */
_buildContext(metadata, platform, transition = null, options = {}) {
  const { forceRawValidation = false } = options;
  const implClassName = metadata.className;
  const targetStatus = metadata.status;
  
  // Determine test mode
  const { mode } = this._determineTestMode(
    metadata,
    platform,
    targetStatus
  );
  
  const isInducer = mode === 'inducer';
  const isVerify = mode === 'verify';
  const actionName = this._generateActionName(metadata); 
  const testFileName = this._generateFileName(metadata, platform, { 
    event: this.currentTransition?.event 
  });
  
  // Platform detection
  const isPlaywright = platform === 'web' || platform === 'cms';
  const isMobile = platform.startsWith('mobile-');
  
  // Prerequisites
  const requiresPrerequisites = !!metadata.previousStatus;
  const hasPrerequisites = requiresPrerequisites;
  
  // Action description
  const actionDescription = metadata.actionDetails?.description || 
                            `Transition to ${targetStatus} state`;
  
  // Entity logic
  const hasEntityLogic = this._shouldGenerateEntityLogic(metadata);
  const entityName = this._inferEntityName(metadata);
  
  // Delta fields
  const deltaFields = this._extractDeltaFields(metadata.entry, targetStatus);
  const hasDeltaLogic = deltaFields.length > 0;
  
  // Action details
    const hasActionDetails = !!metadata.actionDetails;
    
    // Transition conditions (new block-based format)
    // Transition conditions (new block-based format)
// Transition conditions (new block-based format)
// First check currentTransition, then fall back to reading from source file
let transitionConditions = this.currentTransition?.conditions || null;

// If no conditions in currentTransition, try to read from source implication
if (!transitionConditions && this.currentTransition?.event && this.currentTransition?.fromState) {
  const sourceConditions = this._getTransitionConditionsFromSource(
    this.currentTransition.fromState,
    this.currentTransition.event,
    metadata.status
  );
  if (sourceConditions) {
    transitionConditions = sourceConditions;
    console.log('   ✅ Loaded transition conditions from source file');
  }
}

const hasTransitionConditions = !!(transitionConditions?.blocks?.length > 0);
  
  // Navigation extraction
  const navigation = hasActionDetails 
    ? this._extractNavigation(metadata.actionDetails)
    : null;
  
  // Test cases
  const testCases = this._generateTestCases(metadata, entityName);
  
  // Calculate smart import paths
  const paths = this._calculateImportPaths();
  
  // Extract action from triggeredBy
  const triggeredByAction = this._extractTriggeredByAction(metadata);
  const transitionInfo = this._extractTransitionInfo(metadata, targetStatus);
  const uiScreens = this._getUIScreensForPlatform(metadata.mirrorsOn, platform);
  const suggestedScreens = this._extractSuggestedScreens(uiScreens);
  
  // Generate smart TODO
  const smartTODOComment = this._generateSmartTODO(
    transitionInfo,
    suggestedScreens,
    { implClassName, actionName, testFileName, platform }
  );
  
  // ═══════════════════════════════════════════════════════════
  // LEGACY: UI validation screens (existing code)
  // ═══════════════════════════════════════════════════════════
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
        {}
      );
      
      uiValidation.hasValidation = validationScreens.length > 0;
      uiValidation.screens = validationScreens;
      
      console.log(`   ✅ Function-aware validation: ${validationScreens.length} screens`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // ✅ Phase 3.7 - Ordered Screens with Blocks & POM Deduplication
  // ═══════════════════════════════════════════════════════════
  const orderedScreensResult = this._extractOrderedScreensForValidation(
    metadata, 
    platform,
    { forceRawValidation }
  );
  
  const useBlocksValidation = orderedScreensResult.usesBlocks;
  const useOrderedScreens = orderedScreensResult.hasOrderedScreens && 
                             (orderedScreensResult.usesBlocks || 
                              orderedScreensResult.orderedScreens.some(s => s.hasNavigation));
  const useLegacyValidation = !useBlocksValidation && 
                               !useOrderedScreens && 
                               uiValidation.hasValidation;
  
  console.log(`\n📊 Validation Mode Decision:`);
  console.log(`   useBlocksValidation: ${useBlocksValidation}`);
  console.log(`   useOrderedScreens: ${useOrderedScreens}`);
  console.log(`   useLegacyValidation: ${useLegacyValidation}`);
  console.log(`   forceRawValidation: ${forceRawValidation}`);
  console.log(`   uniquePomRequires: ${orderedScreensResult.uniquePomRequires?.length || 0}`);
  
  // ═══════════════════════════════════════════════════════════
  // Build context
  // ═══════════════════════════════════════════════════════════
  const context = {
    // Header
    timestamp: new Date().toISOString(),
    implClassName,
    platform,
    platformKey: this._getPlatformKeyForMirrorsOn(platform),
    targetStatus,
    previousStatus: metadata.previousStatus,
    meta: metadata.meta || {},
    
    // Transition context
    transitionEvent: this.currentTransition?.event || null,
    transitionFrom: this.currentTransition?.fromState || metadata.previousStatus || null,
    transitionTo: targetStatus,
    hasTransitionContext: !!(this.currentTransition?.event),
    
    // Platform
    isPlaywright,
    isMobile,
    testMode: mode,
    isInducer,
    isVerify,
    
    // Paths
    testContextPath: paths.testContext,
    expectImplicationPath: paths.testContext.replace('/TestContext', '/ExpectImplication'),
    testPlannerPath: paths.testPlanner,
    testSetupPath: paths.testSetup,
    
    // Function
    actionName,
    actionDescription,
    testFileName,
    testDescription: `${targetStatus} State Transition`,
    
    // Descriptions
    transitionDescription: this.currentTransition?.event 
      ? `${this.currentTransition.event} (${this.currentTransition.fromState || 'unknown'} → ${targetStatus})`
      : `Transition to ${targetStatus} state`,
    deltaLabel: this.currentTransition?.event
      ? `${this._toTitleCase(this.currentTransition.event.replace(/_/g, ' '))} (${this.currentTransition.fromState || 'unknown'} → ${targetStatus})`
      : `${targetStatus} State`,
    
    // Prerequisites
    requiresPrerequisites,
    hasPrerequisites,
    prerequisiteImports: [],
    
    // Options
    optionParams: this._generateOptionParams(isPlaywright, hasEntityLogic),
    
    // Entity logic
    hasEntityLogic,
    entityName,
    
    // Action
    allTransitions: metadata.allTransitions || [],
    hasMultipleTransitions: (metadata.allTransitions || []).length > 1,
    hasActionDetails: !!metadata.actionDetails,
    actionDetails: metadata.actionDetails,
    
    // Transition conditions
    hasTransitionConditions: hasTransitionConditions,
    transitionConditions: transitionConditions,
    transitionConditionsJson: hasTransitionConditions ? JSON.stringify(transitionConditions, null, 2) : null,
    hasStoreAs: metadata.actionDetails?.steps?.some(step => step.storeAs) || false,
    storeAsFields: metadata.actionDetails?.storeAsFields || [],
    hasNavigation: !!navigation,
    navigation: navigation,
    triggerButton: metadata.triggerButton,
    navigationExample: this._generateNavigationExample(platform, metadata),
    actionExample: this._generateActionExample(metadata, platform),
    appObjectName: isMobile ? 'app' : 'page',
    smartTODOComment,
    transitionInfo,
    suggestedScreens,
    
    // Triggered by
    hasTriggeredByAction: triggeredByAction.hasAction,
    triggeredByActionCall: triggeredByAction.actionCall,
    triggeredByInstanceName: triggeredByAction.instanceName,
    
    // Delta
    hasDeltaLogic,
    deltaFields,
    
    // Helper functions
    hasHelperFunctions: false,
    helperFunctions: [],
    
    // Legacy UI Validation (backward compatibility)
    hasUIValidation: uiValidation.hasValidation || orderedScreensResult.hasOrderedScreens,
    validationScreens: uiValidation.screens,
    useExpectImplication: true,
    
    // ═══════════════════════════════════════════════════════════
    // ✅ Phase 3.7: Ordered Screens with Blocks & POM Deduplication
    // ═══════════════════════════════════════════════════════════
    hasOrderedScreens: orderedScreensResult.hasOrderedScreens,
    orderedScreens: orderedScreensResult.orderedScreens,
    orderedScreenCount: orderedScreensResult.orderedScreens.length,
    
    // ✅ NEW: Deduplicated POM requires
    uniquePomRequires: orderedScreensResult.uniquePomRequires || [],
    hasUniquePomRequires: (orderedScreensResult.uniquePomRequires || []).length > 0,
    
    // Validation mode flags
    useBlocksValidation: useBlocksValidation,
    useOrderedScreens: useOrderedScreens,
    useLegacyValidation: useLegacyValidation,
    hasAnyValidation: useBlocksValidation || useOrderedScreens || useLegacyValidation,
    
    // Test cases
    testCases,
    defaultTestDataPath: 'tests/data/shared.json',
    
    // Change log
    changeLogLabel: `${targetStatus} ${hasEntityLogic ? entityName : 'State'}`,
  };
  
  return context;
}


/**
 * Get transition conditions from source implication file
 * 
 * @param {string} fromState - Source state (e.g., 'agency_selected_main')
 * @param {string} event - Event name (e.g., 'SET_AGENCY_AS_PREFFERED')
 * @param {string} targetState - Target state to match
 * @returns {object|null} Conditions object or null
 */
_getTransitionConditionsFromSource(fromState, event, targetState) {
  try {
    const sourceFile = this._findImplicationFile(fromState, this.implFilePath);
    
    if (!sourceFile || !fs.existsSync(sourceFile)) {
      console.log(`   ⚠️ Source file not found for ${fromState}`);
      return null;
    }
    
    // Try require first
    try {
      delete require.cache[require.resolve(sourceFile)];
      const SourceImpl = require(sourceFile);
      const transitions = SourceImpl.xstateConfig?.on || {};
      const transition = transitions[event];
      
      if (transition) {
        const config = typeof transition === 'string' ? null : transition;
        const target = config?.target || transition;
        
        // Verify this transition goes to our target
        if (target === targetState || target?.endsWith(targetState)) {
          return config?.conditions || null;
        }
      }
    } catch (e) {
      // Fall back to AST parsing
      const content = fs.readFileSync(sourceFile, 'utf-8');
      const xstateConfig = this._extractXStateFromAST(
        parse(content, { sourceType: 'module', plugins: ['classProperties', 'objectRestSpread'] })
      );
      
      if (xstateConfig?.on?.[event]) {
        const transition = xstateConfig.on[event];
        const config = typeof transition === 'string' ? null : transition;
        return config?.conditions || null;
      }
    }
    
    return null;
  } catch (error) {
    console.log(`   ⚠️ Error reading conditions: ${error.message}`);
    return null;
  }
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
   *   Ã¢â€ â€™ ../../utils/TestContext (if utils at apps/cms/tests/utils)
   * 
   *   tests/implications/bookings/AcceptedBookingImplications.js
   *   Ã¢â€ â€™ ../utils/TestContext (if utils at tests/utils)
   * 
   * @returns {object} { testContext, testPlanner }
   */
 _calculateImportPaths() {
  const implFilePath = this.implFilePath || '';
  
  if (!implFilePath) {
    // Fallback to safe default
    console.log('   ⚠️  No implFilePath set, using default paths');
    return {
      testContext: '../../ai-testing/utils/TestContext',
      testPlanner: '../../ai-testing/utils/TestPlanner',
      testSetup: '../../helpers/TestSetup'
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
        // Ã¢Å“â€¦ FIX #1: Changed from 'utils' to 'ai-testing/utils'
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
console.log(`   ðŸ“‚ Smart paths: ${relativePath}/TestContext`);

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
 * Format requirement value for human-readable display
 * 
 * @param {string} key - Requirement key (e.g., '!dancer.blocked_clubs')
 * @param {*} value - Requirement value (string, boolean, or object)
 * @returns {string} Human-readable description
 */
_formatRequirementValue(key, value) {
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
    
    // Fallback: stringify nicely
    return `must match ${JSON.stringify(value)}`;
  }
  
  // Fallback
  return `= ${value}`;
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
      console.log('   Ã¢Å¡Â Ã¯Â¸Â  Could not extract assignment object from entry');
      
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
  // âœ… Check if it's a template placeholder like {{email}} or {{timestamp}}
  if (fieldValue.startsWith('{{') && fieldValue.endsWith('}}')) {
    const varName = fieldValue.slice(2, -2); // Remove {{ and }}
    
    // Special case: {{timestamp}} â†’ now
    if (varName === 'timestamp') {
      value = 'now';
    } else {
      // Convert {{email}} â†’ ctx.data.email
      value = `ctx.data.${varName}`;
    }
  } else {
    // Literal string: status: "published"
    value = `'${fieldValue}'`;
  }
  
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
    console.log('   âš ï¸  No mirrorsOn found');
    return {};
  }
  
  // Check if there's a UI property
  if (!mirrorsOn.UI) {
    console.log('   âš ï¸  No mirrorsOn.UI found');
    return {};
  }
  
  // Map platform names to mirrorsOn keys
  const platformKey = this._getPlatformKeyForMirrorsOn(platform);
  
  // Get screens for this platform
  const platformScreens = mirrorsOn.UI[platformKey];
  
  if (!platformScreens) {
    console.log(`   âš ï¸  No screens found for platform: ${platformKey}`);
    return {};
  }
  
  console.log(`   âœ… Found mirrorsOn.UI.${platformKey} with ${Object.keys(platformScreens).length} screens`);
  return platformScreens;
}
  
  /**
   * Should we generate entity logic (e.g., bookings[0])?
   */
_shouldGenerateEntityLogic(metadata) {
  // âœ… GENERIC - checks for any array operations
  if (!metadata || !metadata.entry) return false;
  
  const entryStr = metadata.entry?.toString() || '';
  
  // Check for array operations (any entity type)
  return entryStr.includes('[') && 
         (entryStr.includes('map(') || 
          entryStr.includes('filter(') ||
          entryStr.includes('forEach('));
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
/**
 * Generate action name (GENERIC - uses metadata or conventions)
 * 
 * Priority:
 * 1. Use metadata.actionName if provided
 * 2. Check meta.setup[0].actionName
 * 3. Just convert to camelCase - that's it!
 */
/**
 * Generate action name from transition context
 * 
 * Format: {targetState}Via{sourceState}
 * Examples:
 *   bookingAcceptedViaBookingPending
 *   bookingRejectedViaBookingAccepted
 * 
 * Fallback: If no source state, just use target (camelCase)
 */
/**
 * Generate action name from transition context
 * 
 * Format: {targetState}Via{sourceState}
 * Examples:
 *   bookingAcceptedViaBookingPending
 *   bookingRejectedViaBookingAccepted
 *   bookingAcceptedViaBookingStandby
 * 
 * Fallback: If no source state, just use target (camelCase)
 */
_generateActionName(metadata) {
  console.log('\nðŸ·ï¸  === _generateActionName called ===');
  console.log('   metadata.status:', metadata.status);
  console.log('   typeof metadata.status:', typeof metadata.status);
  console.log('   this.currentTransition:', this.currentTransition);
  console.log('   this.currentTransition?.fromState:', this.currentTransition?.fromState);
  
  // Check if we have transition context
  if (this.currentTransition?.fromState) {
    const targetCamel = this._toCamelCase(metadata.status);
    console.log('   ðŸŽ¯ targetCamel:', targetCamel);
    
    const sourceCamel = this._toCamelCase(this.currentTransition.fromState);
    console.log('   ðŸŽ¯ sourceCamel:', sourceCamel);
    
    // Capitalize first letter of source for "Via" style
    const sourceCapitalized = sourceCamel.charAt(0).toUpperCase() + sourceCamel.slice(1);
    console.log('   ðŸŽ¯ sourceCapitalized:', sourceCapitalized);
    
    const fullName = `${targetCamel}Via${sourceCapitalized}`;
    console.log('   âœ… fullName:', fullName);
    
    return fullName;
  }
  
  console.log('   âš ï¸  No transition context, falling back...');
  
  // Fallback: Check metadata
  if (metadata.actionName) {
    return metadata.actionName;
  }
  
  if (metadata.platformSetup?.actionName) {
    return metadata.platformSetup.actionName;
  }
  
  // Last resort: Just convert to camelCase
  const fallback = this._toCamelCase(metadata.status);
  console.log('   âš ï¸  Using fallback:', fallback);
  return fallback;
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
_generateFileName(metadata, platform, options = {}) {
  const { event } = options;
  
  // 1. Check if explicitly provided (and no event - means not a transition test)
  if (metadata.testFile && !event) {
    return metadata.testFile;
  }
  
  // 2. Check in platformSetup (but only if no event)
  if (metadata.platformSetup?.testFile && !event) {
    return path.basename(metadata.platformSetup.testFile);
  }
  
  // 3. Generate from action name + event + platform
  const actionName = this._generateActionName(metadata);
  const action = this._toPascalCase(actionName);
  const platformSuffix = this._getPlatformSuffix(platform);
  
  // âœ… If event provided, include it in filename
if (event) {
  // Keep event name as-is (BOOK_FLIGHT stays BOOK_FLIGHT)
  return `${action}-${event}-${platformSuffix}-UNIT.spec.js`;
}
  
  // Fallback: no event
  return `${action}-${platformSuffix}-UNIT.spec.js`;
}
  
  /**
   * Get platform suffix for file name
   */
  _getPlatformSuffix(platform) {
    const mapping = {
      'web': 'Web',
      'cms': 'CMS',
      'dancer': 'Dancer',
      'manager': 'Manager',
      'clubApp': 'ClubApp'
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
  
  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  // GENERIC HELPERS (NO DOMAIN KNOWLEDGE!)
  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  
  /**
   * Convert string to camelCase
   * Examples:
   *   approved Ã¢â€ â€™ approved
   *   checked_in Ã¢â€ â€™ checkedIn
   *   in-review Ã¢â€ â€™ inReview
   *   Published Ã¢â€ â€™ published
   */
 /**
 * Convert string to camelCase
 * Handles: snake_case, spaces, hyphens, PascalCase
 * 
 * Examples:
 *   approved â†’ approved
 *   checked_in â†’ checkedIn
 *   Booking Standby â†’ bookingStandby
 *   in-review â†’ inReview
 *   Published â†’ published
 */
_toCamelCase(str) {
  if (!str) return '';
  
  // First, normalize: replace spaces and hyphens with underscores
  let normalized = str.replace(/[\s-]/g, '_');
  
  // Lowercase first character
  let result = normalized.charAt(0).toLowerCase() + normalized.slice(1);
  
  // Replace _X with X (uppercase)
  result = result.replace(/[_](\w)/g, (_, c) => c.toUpperCase());
  
  return result;
}
  
  /**
   * Convert string to PascalCase
   * Examples:
   *   approved Ã¢â€ â€™ Approved
   *   checked_in Ã¢â€ â€™ CheckedIn
   *   draft Ã¢â€ â€™ Draft
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
   * - Remove 'ed' suffix if present: approved Ã¢â€ â€™ approve
   * - Convert to camelCase: checked_in Ã¢â€ â€™ checkIn
   * - Leave as-is if can't infer: draft Ã¢â€ â€™ draft
   * 
   * Examples:
   *   approved Ã¢â€ â€™ approve
   *   checked_in Ã¢â€ â€™ checkIn
   *   draft Ã¢â€ â€™ draft
   *   published Ã¢â€ â€™ publish
   */
  _inferActionName(status) {
    if (!status) return 'action';
    
    // Convert to camelCase first
    let name = this._toCamelCase(status);
    
    // Remove common suffixes
    if (name.endsWith('ed') && name.length > 3) {
      // approved Ã¢â€ â€™ approve, published Ã¢â€ â€™ publish
      name = name.slice(0, -2);
    } else if (name.endsWith('ing') && name.length > 4) {
      // filling Ã¢â€ â€™ fill
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
   * Ã¢Å“Â¨ FIX #5: Extract action code from triggeredBy
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
    // âœ… Skip non-screen properties (description, etc.)
    if (screenKey === 'description' || typeof def === 'string') {
      console.log(`   â­ï¸  Skipping non-screen property: ${screenKey}`);
      continue;
    }
    
    // âœ… Handle both array and object formats
    let screenDef;
    
    if (Array.isArray(def)) {
      // Array format: [ImplicationHelper.mergeWithBase(...)]
      screenDef = def[0];
    } else if (typeof def === 'object') {
      // Object format: { screen: 'name', visible: [...] }
      screenDef = def;
    } else {
      console.warn(`   âš ï¸  Skipping invalid screen definition for ${screenKey}`);
      continue;
    }
    
    // âœ… Safety check for screen property
    if (!screenDef) {
      console.warn(`   âš ï¸  Screen definition is undefined for ${screenKey}`);
      continue;
    }
    
    // âœ… Extract screen name (handle different structures)
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
    
    // âœ… Build suggested screen object with 'file' property (used by _generateSmartTODO)
    suggestedScreens.push({
      key: screenKey,
      screen: screenName,
      file: screenName,  // âœ… ADD THIS - used in _generateSmartTODO
      instance: screenDef.instance || screenKey.toLowerCase(),
      visible: screenDef.visible || [],
      hidden: screenDef.hidden || [],
      checks: screenDef.checks || {},
      description: screenDef.description || null
    });
    
    console.log(`   âœ… Extracted screen: ${screenKey} â†’ ${screenName}`);
  }
  
  return suggestedScreens;
}
_calculateScreenObjectPath(implFilePath, screenFile) {
  const path = require('path');
  const fs = require('fs');
  
  console.log(`\nðŸ“ _calculateScreenObjectPath called:`);
  console.log(`   implFilePath: ${implFilePath}`);
  console.log(`   screenFile: ${screenFile}`);
  
  // âœ… NEW: If screenFile is already an absolute or project-relative path, use it directly
 // âœ… NEW: If screenFile is already an absolute or project-relative path, use it directly
if (screenFile.startsWith('/') || screenFile.startsWith('tests/') || screenFile.startsWith('mobile/')) {
  console.log(`   âœ… Detected full/project-relative path`);
  
  const implDir = path.dirname(implFilePath);
  console.log(`   ðŸ“ Test directory: ${implDir}`);
  
  // âœ… FIX: Just use the path as-is, don't strip anything!
  const absoluteScreenPath = screenFile.startsWith('/') 
    ? screenFile 
    : path.join(this.projectPath, screenFile);  // âœ… Use FULL path as stored!
  
  console.log(`   ðŸ“ Absolute screen path: ${absoluteScreenPath}`);
  
  // Calculate relative path from test location to screen file
  let relativePath = path.relative(implDir, absoluteScreenPath);
  
  // Normalize for require()
  relativePath = relativePath.split(path.sep).join('/');
  
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  console.log(`   âœ… Calculated relative path: ${relativePath}`);
  return relativePath;
}
  
  // âœ… ORIGINAL LOGIC: For simple filenames like "StatusRequests.screen"
  console.log(`   ðŸ” Treating as filename, searching for screenObjects directory...`);
  
  // Get directory of Implication file (where test will be generated)
  const implDir = path.dirname(implFilePath);
  
  // âœ… STEP 1: Find screenObjects directory by walking up
  let screenObjectsDir = this._findScreenObjectsDir(implFilePath);
  
  if (!screenObjectsDir) {
    // âœ… FALLBACK: Try common patterns
    const projectRoot = this._findProjectRoot(implFilePath);
    
    // Try different possible locations:
    const possiblePaths = [
      path.join(projectRoot, 'tests/web/current/screenObjects'),
      path.join(projectRoot, 'tests/screenObjects'),
      path.join(projectRoot, 'screenObjects'),
      path.join(projectRoot, 'tests/mobile/current/screenObjects')
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        screenObjectsDir = possiblePath;
        console.log(`   ðŸ“‚ Found screenObjects at: ${possiblePath}`);
        break;
      }
    }
  }
  
  if (!screenObjectsDir) {
    // Last resort fallback - assume relative to tests/
    console.warn(`   âš ï¸  Could not find screenObjects directory, using fallback`);
    return `../screenObjects/${screenFile}.js`;
  }
  
  // âœ… STEP 2: Build full path to screen object file
  const screenObjectFile = path.join(screenObjectsDir, `${screenFile}.js`);
  
  // âœ… STEP 3: Calculate relative path from test location to screen object
  let relativePath = path.relative(implDir, screenObjectFile);
  
  // Normalize for require() - use forward slashes
  relativePath = relativePath.split(path.sep).join('/');
  
  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  console.log(`   ðŸ“ Screen path: ${screenFile} â†’ ${relativePath}`);
  
  return relativePath;
}
/**
 * Find screenObjects directory by walking up from impl file
 * 
 * @param {string} startPath - Starting path (Implication file)
 * @returns {string|null} Path to screenObjects directory or null
 */
_findScreenObjectsDir(startPath) {
  const path = require('path');
  const fs = require('fs');
  
  let currentDir = path.dirname(startPath);
  
  // Walk up max 10 levels
  for (let i = 0; i < 10; i++) {
    // Check multiple possible names
    const possibleNames = [
      'screenObjects',
      'web/current/screenObjects',
      'mobile/current/screenObjects'
    ];
    
    for (const name of possibleNames) {
      const screenObjectsPath = path.join(currentDir, name);
      
      if (fs.existsSync(screenObjectsPath) && fs.statSync(screenObjectsPath).isDirectory()) {
        console.log(`   âœ… Found screenObjects: ${screenObjectsPath}`);
        return screenObjectsPath;
      }
    }
    
    // Go up one level
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }
  
  return null;
}

/**
 * Process actionDetails imports with calculated paths
 * AND add entity to each step for template access
 */
_processActionDetailsImports(actionDetails, screenObjectsPath, implFilePath) {
  console.log('\nðŸ“ _processActionDetailsImports called:');
  console.log('   implFilePath:', implFilePath);
  
  if (!actionDetails) {
    return actionDetails;
  }
  
  const processed = JSON.parse(JSON.stringify(actionDetails));
  
  // Process imports if they exist
  if (processed.imports) {
    console.log(`   ðŸ“¦ Processing ${processed.imports.length} import(s)...`);
    
    processed.imports = processed.imports.map(imp => {
      console.log(`\n   ðŸ” Import: ${imp.className}`);
      console.log(`      path: ${imp.path}`);
      
      const relativePath = this._calculateScreenObjectPath(
        implFilePath,
        imp.path
      );
      
      console.log(`      âœ… relativePath: ${relativePath}`);
      
      return {
        ...imp,
        relativePath
      };
    });
  }
  
  // ✅ Get entity from metadata that's ALREADY in context
  // (Don't call _extractMetadata again - that causes recursion!)
  const entity = this.currentMetadata?.meta?.entity || null;
  
  // Process steps with storeAs parsing, args format, AND entity
  if (processed.steps) {
    const storeAsFields = [];  // Collect for delta generation
    
    processed.steps = processed.steps.map((step, index) => {
      const argsArray = Array.isArray(step.args) 
        ? step.args 
        : (step.args || '').split(',').map(s => s.trim()).filter(Boolean);
      
      const argsString = Array.isArray(step.args)
        ? step.args.join(', ')
        : step.args || '';
      
      // ✅ Parse storeAs config
      const storeAsConfig = this._parseStoreAsConfig(step.storeAs);
      
      if (storeAsConfig) {
        console.log(`   💾 Step ${index}: storeAs="${storeAsConfig.key}" (persist=${storeAsConfig.persist})`);
        
        storeAsFields.push({
          key: storeAsConfig.key,
          persist: storeAsConfig.persist,
          global: storeAsConfig.global,
          skipPersist: !storeAsConfig.persist
        });
      }
      
      // ✅ Parse step conditions
      const hasStepConditions = !!(step.conditions?.blocks?.length > 0);
      
      return {
        ...step,
        args: argsString,
        argsArray: argsArray,
        entity: entity,
        // ✅ Flattened storeAs properties for template
        storeAs: !!storeAsConfig,
        storeAsKey: storeAsConfig?.key,
        storeAsPersist: storeAsConfig?.persist,
        storeAsGlobal: storeAsConfig?.global,
        // ✅ Step conditions
        hasConditions: hasStepConditions,
        conditionsJson: hasStepConditions ? JSON.stringify(step.conditions) : null
      };
    });
    
    // ✅ Attach storeAs fields for delta generation
    processed.storeAsFields = storeAsFields;
    
    console.log(`   ✅ Processed ${processed.steps.length} step(s) with entity: ${entity}`);
    if (storeAsFields.length > 0) {
      console.log(`   💾 Found ${storeAsFields.length} storeAs field(s): ${storeAsFields.map(f => f.key).join(', ')}`);
    }
  }
  
  return processed;
}

/**
 * Parse storeAs config (handles both string and object format)
 * 
 * @param {string|object} storeAs - Either 'varName' or { key, persist, global }
 * @returns {object|null} Normalized config { key, persist, global }
 */
_parseStoreAsConfig(storeAs) {
  if (!storeAs) return null;
  
  if (typeof storeAs === 'string') {
    return {
      key: storeAs,
      persist: true,
      global: false
    };
  }
  
  if (typeof storeAs === 'object' && storeAs.key) {
    return {
      key: storeAs.key,
      persist: storeAs.persist !== false,  // Default true
      global: storeAs.global === true       // Default false
    };
  }
  
  // Invalid format
  console.warn(`   ⚠️ Invalid storeAs format:`, storeAs);
  return null;
}

/**
 * Extract navigation from actionDetails
 * 
 * @param {object} actionDetails - Action details with optional navigationMethod
 * @returns {object|null} { method, instance, args } or null
 */
/**
 * Extract navigation from actionDetails
 */
_extractNavigation(actionDetails) {
  if (!actionDetails?.navigationMethod || !actionDetails?.navigationFile) {
    return null;
  }

  const navMethod = actionDetails.navigationMethod;
  const navFile = actionDetails.navigationFile;
  
  // Parse signature: "navigateToManageRequests()"
  const match = navMethod.match(/^([^(]+)\(([^)]*)\)/);
  
  if (!match) {
    console.warn('âš ï¸ Could not parse navigation method:', navMethod);
    return null;
  }

  const methodName = match[1];
  const paramsStr = match[2];
  const params = paramsStr ? paramsStr.split(',').map(p => p.trim()) : [];

  // Build instance name from file: NavigationActions â†’ navigationActions
  const instanceName = navFile.charAt(0).toLowerCase() + navFile.slice(1);

  return {
    method: methodName,
    signature: navMethod,  // âœ… Keep full signature
    instance: instanceName,
    className: navFile,
    args: params.length > 0 ? params.map(p => `ctx.data.${p}`) : []
  };
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
  
  lines.push('// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  lines.push('// ðŸŽ¬ ACTION LOGIC - TODO: Implement State Transition');
  lines.push('// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  lines.push('//');
  lines.push(`// This test induces the transition from '${transitionInfo.fromState}' â†’ '${transitionInfo.toState}'`);
  lines.push('//');
  
  if (transitionInfo.event) {
    lines.push(`// Event: ${transitionInfo.event}`);
  }
  lines.push(`// From State: ${transitionInfo.fromState}`);
  lines.push(`// To State: ${transitionInfo.toState}`);
  lines.push('//');
  
  // Screen suggestions
  if (screens.length > 0) {
    lines.push('// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
    lines.push('// ðŸ’¡ Suggested Implementation:');
    lines.push('// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
    lines.push('//');
    lines.push(`// Based on mirrorsOn, you'll need these screen objects:`);
    lines.push('//');
screens.forEach((screen, index) => {
  // âœ… Safety check for screen.file
  if (!screen.file) {
    console.warn(`   âš ï¸  Screen ${index} has no file property, skipping`);
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
  lines.push('// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
  lines.push(`// ðŸ“ Once implemented, update ${metadata.implClassName}.js:`);
  lines.push('// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
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
  lines.push('// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  return lines.join('\n');
}


  
  /**
   * Ã¢Å“Â¨ FIX #6: Extract UI validation screens from mirrorsOn
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
    
    console.log(`   ðŸ” Extracting UI validation for platform: ${platform}`);
    
    if (!mirrorsOn || !mirrorsOn.UI) {
      console.log(`   âš ï¸  No mirrorsOn.UI found`);
      return result;
    }
    
    // Get platform key (convert web â†’ web, dancer â†’ dancer, etc.)
    const platformKey = this._getPlatformKeyForMirrorsOn(platform);
    console.log(`   ðŸ“ Platform key: ${platform} â†’ ${platformKey}`);
    
    const platformUI = mirrorsOn.UI[platformKey];
    
    if (!platformUI) {
      console.log(`   âš ï¸  No mirrorsOn.UI.${platformKey} found`);
      console.log(`   Available keys: ${Object.keys(mirrorsOn.UI).join(', ')}`);
      return result;
    }
    
    console.log(`   âœ… Found mirrorsOn.UI.${platformKey} with ${Object.keys(platformUI).length} screens`);
    
    // Extract each screen
    for (const [screenKey, screenDefs] of Object.entries(platformUI)) {
      if (!Array.isArray(screenDefs) || screenDefs.length === 0) {
        console.log(`   â­ï¸  Skipping ${screenKey} (not an array or empty)`);
        continue;
      }
      
      const screenDef = screenDefs[0];  // Take first definition
      
      // âœ… FIX: Check multiple possible locations for visible/hidden arrays
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
      
      console.log(`   ðŸ“Š ${screenKey}: visible=${visibleCount}, hidden=${hiddenCount}`);
      
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
      console.log(`   âœ… UI Validation enabled: ${result.screens.length} screens`);
    } else {
      console.log(`   âš ï¸  No screens with visible/hidden elements found`);
    }
    
    return result;
  }
  
  /**
   * Get platform key for mirrorsOn.UI lookup
   * 
   * Maps platform to mirrorsOn.UI key:
   *   web â†’ web
   *   cms â†’ cms  
   *   dancer â†’ dancer
   *   manager â†’ clubApp (or manager?)
   */
  _getPlatformKeyForMirrorsOn(platform) {
    const mapping = {
      'web': 'web',
      'cms': 'cms',
      'dancer': 'dancer',
      'manager': 'clubApp'  // Ã¢Å“â€¦ Use actual key from mirrorsOn
    };
    
    return mapping[platform] || platform;
  }

  /**
 * Convert string to Title Case
 * Examples:
 *   ACCEPT_BOOKING â†’ Accept Booking
 *   cancel_request â†’ Cancel Request
 */
_toTitleCase(str) {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
}

export default UnitTestGenerator;