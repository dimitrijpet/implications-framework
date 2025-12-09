// utils/TestPlanner.js

/**
 * TestPlanner - Prerequisites Validator
 * 
 * Analyzes test data against Implication requirements to determine if a test can run.
 * 
 * Features:
 * - Validates required fields
 * - Checks previous state prerequisites
 * - Builds complete state chain
 * - Suggests next steps with commands
 * - Static checkOrThrow() for easy usage
 * 
 * Usage:
 *   // Simple (recommended):
 *   TestPlanner.checkOrThrow(AcceptedBookingImplications, ctx.data);
 * 
 *   // Advanced:
 *   const planner = new TestPlanner({ verbose: true });
 *   const analysis = planner.analyze(AcceptedBookingImplications, ctx.data);
 *   if (!analysis.ready) { ... }
 */
class TestPlanner {
  
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose ?? true
    };
  }
  
  /**
   * ✨ SIMPLE API - Check prerequisites or throw with helpful error
   * 
   * This is the recommended way to use TestPlanner in your tests.
   * 
   * @param {object} Implication - Implication class (e.g., AcceptedBookingImplications)
   * @param {object} testData - Current test data
   * @param {object} options - Options
   * @param {boolean} options.verbose - Show detailed error (default: true)
   * @returns {object} Analysis result (if ready)
   * @throws {Error} If prerequisites not met
   * 
   * @example
   *   // In your test:
   *   const ctx = TestContext.load(AcceptedBookingImplications, testDataPath);
   *   TestPlanner.checkOrThrow(AcceptedBookingImplications, ctx.data);
   *   // Test continues only if ready!
   */
  static checkOrThrow(Implication, testData, options = {}) {
    const verbose = options.verbose ?? true;
    
    const planner = new TestPlanner({ verbose });
    const analysis = planner.analyze(Implication, testData);
    
    if (analysis.ready) {
      if (verbose) {
        console.log('✅ Prerequisites check passed');
      }
      return analysis;
    }
    
    // Not ready - print helpful error
    if (verbose) {
      this._printNotReadyError(analysis);
    }
    
    throw new Error('Prerequisites not met. Run prerequisite tests first.');
  }
  
  /**
   * Print detailed error when prerequisites not met
   */
  static _printNotReadyError(analysis) {
    console.error('\n❌ TEST NOT READY - PREREQUISITES NOT MET\n');
    
    console.error('📋 Missing Requirements:');
    analysis.missing.forEach(m => {
      console.error(`   ❌ ${m.field}: need ${m.required}, currently ${m.current}`);
    });
    
    console.error('\n🗺️  Full Path to Target:\n');
    analysis.chain.forEach((step, i) => {
      const marker = step.complete ? '✅' : (i === analysis.chain.length - 1 ? '🎯' : '📍');
      console.error(`   ${marker} ${i + 1}. ${step.status}`);
      if (!step.complete && step.actionName) {
        console.error(`      Action: ${step.actionName}`);
        console.error(`      Test: ${step.testFile}`);
        console.error(`      Platform: ${step.platform || 'unknown'}`);
      }
    });
    
    if (analysis.nextStep) {
      console.error('\n💡 NEXT STEP TO TAKE:\n');
      console.error(`   Status: ${analysis.nextStep.status}`);
      console.error(`   Action: ${analysis.nextStep.actionName}`);
      console.error(`   Platform: ${analysis.nextStep.platform}`);
      console.error(`\n   Command:`);
      console.error(`   ${analysis.nextStep.command}`);
      console.error(`\n   ⏭️  ${analysis.stepsRemaining} more step(s) after this\n`);
    }
  }
  
  /**
   * Analyze test data against Implication requirements
   * 
   * @param {object} Implication - Implication class
   * @param {object} testData - Current test data
   * @returns {object} Analysis result
   * 
   * Analysis result:
   * {
   *   ready: boolean,
   *   currentStatus: string,
   *   targetStatus: string,
   *   missing: [{ field, required, current }],
   *   chain: [{ status, complete, actionName, testFile, platform }],
   *   nextStep: { status, actionName, testFile, platform, command },
   *   stepsRemaining: number
   * }
   */
  analyze(Implication, testData) {
    const xstateConfig = Implication.xstateConfig;
    
    // Detect if multi-state or single-state
    const isMultiState = !!(xstateConfig.initial && xstateConfig.states);
    
    if (isMultiState) {
      return this._analyzeMultiState(Implication, testData);
    } else {
      return this._analyzeSingleState(Implication, testData);
    }
  }
  
  /**
   * Analyze single-state Implication (e.g., AcceptedBookingImplications)
   */
  _analyzeSingleState(Implication, testData) {
    const xstateConfig = Implication.xstateConfig;
    const meta = xstateConfig.meta || {};
    
    const targetStatus = meta.status;
    const currentStatus = testData.status;
    const requiredFields = meta.requiredFields || [];
    const previousStatus = meta.requires?.previousStatus;
    
    // Check required fields
    const missing = [];
    for (const field of requiredFields) {
      if (!testData.hasOwnProperty(field) || testData[field] === null || testData[field] === undefined) {
        missing.push({
          field,
          required: true,
          current: testData[field]
        });
      }
    }
    
    // Check previous status
    if (previousStatus && currentStatus !== previousStatus) {
      missing.push({
        field: 'status',
        required: previousStatus,
        current: currentStatus
      });
    }
    
    // Build chain (simple for single-state)
    const chain = [];
    
    if (previousStatus) {
      chain.push({
        status: previousStatus,
        complete: currentStatus === previousStatus,
        actionName: this._getActionName(previousStatus, meta),
        testFile: this._getTestFile(previousStatus, meta),
        platform: meta.setup?.[0]?.platform
      });
    }
    
    chain.push({
      status: targetStatus,
      complete: missing.length === 0,
      actionName: meta.setup?.[0]?.actionName,
      testFile: meta.setup?.[0]?.testFile,
      platform: meta.setup?.[0]?.platform
    });
    
    // Find next step
    const nextStep = chain.find(step => !step.complete);
    const stepsRemaining = chain.filter(step => !step.complete).length;
    
    // Build command
    if (nextStep) {
      nextStep.command = this._buildCommand(nextStep.testFile);
    }
    
    return {
      ready: missing.length === 0,
      currentStatus,
      targetStatus,
      missing,
      chain,
      nextStep,
      stepsRemaining
    };
  }
  
  /**
   * Analyze multi-state Implication (e.g., CMSPageImplications)
   */
  _analyzeMultiState(Implication, testData) {
    const xstateConfig = Implication.xstateConfig;
    const currentStatus = testData.status || xstateConfig.initial;
    
    // For multi-state, we need to know which target state
    // This is typically passed in, but for now we check current state
    const currentStateConfig = xstateConfig.states[currentStatus];
    
    if (!currentStateConfig) {
      return {
        ready: false,
        currentStatus,
        targetStatus: 'unknown',
        missing: [{ field: 'status', required: 'valid state', current: currentStatus }],
        chain: [],
        nextStep: null,
        stepsRemaining: 0
      };
    }
    
    const meta = currentStateConfig.meta || {};
    const requiredFields = meta.requiredFields || [];
    
    // Check required fields for current state
    const missing = [];
    for (const field of requiredFields) {
      if (!testData.hasOwnProperty(field) || testData[field] === null || testData[field] === undefined) {
        missing.push({
          field,
          required: true,
          current: testData[field]
        });
      }
    }
    
    // Build chain (current state only for multi-state)
    const chain = [{
      status: currentStatus,
      complete: missing.length === 0,
      actionName: meta.setup?.[0]?.actionName,
      testFile: meta.setup?.[0]?.testFile,
      platform: meta.setup?.[0]?.platform
    }];
    
    // Find next step
    const nextStep = missing.length > 0 ? {
      ...chain[0],
      command: this._buildCommand(chain[0].testFile)
    } : null;
    
    return {
      ready: missing.length === 0,
      currentStatus,
      targetStatus: currentStatus,
      missing,
      chain,
      nextStep,
      stepsRemaining: missing.length > 0 ? 1 : 0
    };
  }
  
  /**
   * Get action name from status (GENERIC)
   * 
   * Checks meta.setup first, then infers from status
   */
  _getActionName(status, meta = {}) {
    // Check if meta.setup tells us
    if (meta?.setup?.[0]?.actionName) {
      return meta.setup[0].actionName;
    }
    
    // Fallback: infer from status
    return this._inferActionName(status);
  }
  
  /**
   * Get test file name from status (GENERIC)
   * 
   * Checks meta.setup first, then generates from status
   */
  _getTestFile(status, meta = {}) {
    // Check if meta.setup tells us
    if (meta?.setup?.[0]?.testFile) {
      return meta.setup[0].testFile;
    }
    
    // Fallback: generate from status
    const action = this._toPascalCase(this._inferActionName(status));
    const platform = meta?.setup?.[0]?.platform || 'web';
    const platformSuffix = this._getPlatformSuffix(platform);
    
    return `${action}-${platformSuffix}-UNIT.spec.js`;
  }
  
  /**
   * Get platform suffix
   */
  _getPlatformSuffix(platform) {
    const mapping = {
      'web': 'Web',
      'cms': 'CMS',
      'dancer': 'Dancer',
      'manager': 'Manager'
    };
    
    return mapping[platform] || 'Web';
  }
  
  /**
   * Build command string
   */
  _buildCommand(testFile) {
    if (!testFile) return 'npx playwright test';
    
    return `TEST_DATA_PATH="tests/data/shared.json" npx playwright test ${testFile}`;
  }
  
  // ════════════════════════════════════════════════════════
  // GENERIC HELPERS (NO DOMAIN KNOWLEDGE!)
  // ════════════════════════════════════════════════════════
  
  /**
   * Convert string to camelCase
   */
  _toCamelCase(str) {
    if (!str) return '';
    let result = str.charAt(0).toLowerCase() + str.slice(1);
    result = result.replace(/[_-](\w)/g, (_, c) => c.toUpperCase());
    return result;
  }
  
  /**
   * Convert string to PascalCase
   */
  _toPascalCase(str) {
    if (!str) return '';
    let result = str.charAt(0).toUpperCase() + str.slice(1);
    result = result.replace(/[_-](\w)/g, (_, c) => c.toUpperCase());
    return result;
  }
  
  /**
   * Infer action name from status (generic conventions)
   */
  _inferActionName(status) {
    if (!status) return 'action';
    
    let name = this._toCamelCase(status);
    
    // Remove common suffixes
    if (name.endsWith('ed') && name.length > 3) {
      name = name.slice(0, -2);
    } else if (name.endsWith('ing') && name.length > 4) {
      name = name.slice(0, -3);
    }
    
    return name;
  }
}

module.exports = TestPlanner;