/**
 * Type definitions and constants for the Implications Framework
 */

export const PROJECT_TYPES = {
  CMS: 'cms',
  BOOKING: 'booking',
  CUSTOM: 'custom',
};

export const PLATFORMS = {
  WEB: 'web',
  MOBILE_DANCER: 'mobile-dancer',
  MOBILE_MANAGER: 'mobile-manager',
};

export const FILE_PATTERNS = {
  IMPLICATIONS: /Implications\.js$/,
  UNIT_TESTS: /-UNIT\.spec\.js$/,
  VALIDATION_TESTS: /-VALIDATION\.spec\.js$/,
  SECTIONS: /Section\.js$/,
  SCREENS: /Screen\.js$/,
};

/**
 * Default configuration structure
 */
export const DEFAULT_CONFIG = {
  name: '',
  type: PROJECT_TYPES.CUSTOM,
  testDir: 'tests',
  version: '1.0.0',
  patterns: {
    implications: 'tests/implications/**/*Implications.js',
    unitTests: 'tests/**/*-UNIT.spec.js',
    validationTests: 'tests/**/*-VALIDATION.spec.js',
  },
};