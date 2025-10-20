/**
 * Discovery result types and schemas
 */

export const DISCOVERY_TYPES = {
  IMPLICATION: 'implication',
  SECTION: 'section',
  SCREEN: 'screen',
  UNIT_TEST: 'unit_test',
  VALIDATION_TEST: 'validation_test',
  STATE_MACHINE: 'state_machine',
};

export const PROJECT_PATTERNS = {
  CMS: 'cms',
  BOOKING: 'booking',
  CUSTOM: 'custom',
};

/**
 * Structure of a discovered file
 */
export class DiscoveredFile {
  constructor(data) {
    this.path = data.path;
    this.type = data.type;
    this.className = data.className;
    this.methods = data.methods || [];
    this.properties = data.properties || {};
    this.imports = data.imports || [];
    this.exports = data.exports || [];
    this.pattern = data.pattern || null;
    this.metadata = data.metadata || {};
  }
}

/**
 * Discovery result for entire project
 */
export class DiscoveryResult {
  constructor() {
    this.projectPath = '';
    this.projectType = PROJECT_PATTERNS.CUSTOM;
    this.files = {
      implications: [],
      sections: [],
      screens: [],
      unitTests: [],
      validationTests: [],
      stateMachines: [],
    };
    this.patterns = {
      hasEnhancedBaseSection: false,
      hasXState: false,
      hasTestContext: false,
      hasExpectImplication: false,
    };
    this.statistics = {
      totalFiles: 0,
      totalClasses: 0,
      totalMethods: 0,
    };
    this.errors = [];
  }
}