import { Issue } from '../types/issues.js';

/**
 * Base class for all analysis rules
 */
export class BaseRule {
  constructor() {
    this.name = this.constructor.name;
    this.enabled = true;
  }
  
  /**
   * Check if this rule applies to the given implication
   * @param {Object} implication - Implication metadata
   * @returns {boolean}
   */
  appliesTo(implication) {
    return true; // Override in subclasses
  }
  
  /**
   * Analyze the implication and return issues
   * @param {Object} implication - Implication metadata
   * @param {Object} context - Additional context (all implications, transitions, etc.)
   * @returns {Issue[]}
   */
  analyze(implication, context) {
    throw new Error('analyze() must be implemented by subclass');
  }
  
  /**
   * Helper to create an issue
   */
  createIssue(options) {
    return new Issue(options);
  }
}