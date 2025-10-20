import { PROJECT_TYPES } from '../types/index.js';

/**
 * Validate project configuration
 */
export function validateConfig(config) {
  const errors = [];

  if (!config.name) {
    errors.push('Project name is required');
  }

  if (!Object.values(PROJECT_TYPES).includes(config.type)) {
    errors.push(`Invalid project type: ${config.type}`);
  }

  if (!config.testDir) {
    errors.push('Test directory is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return true;
}

/**
 * Validate implication structure (placeholder)
 */
export function validateImplication(implication) {
  // TODO: Implement in Phase 2
  return true;
}
