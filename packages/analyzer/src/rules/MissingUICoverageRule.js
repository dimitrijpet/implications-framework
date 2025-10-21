import { BaseRule } from './BaseRule.js';
import { Issue, Suggestion, IssueSeverity, IssueType } from '../types/issues.js';

/**
 * Detects stateful implications without UI coverage
 */
export class MissingUICoverageRule extends BaseRule {
  appliesTo(implication) {
    return implication.metadata?.hasXStateConfig === true;
  }
  
  analyze(implication, context) {
    const issues = [];
    const metadata = implication.metadata;
    const className = metadata.className;
    
    // Check if has mirrorsOn
    if (!metadata.hasMirrorsOn) {
      issues.push(this.createIssue({
        severity: IssueSeverity.WARNING,
        type: IssueType.MISSING_UI_COVERAGE,
        stateName: className,
        title: 'No UI Coverage Defined',
        message: `${className} has no mirrorsOn property. UI validations are not defined for this state.`,
        suggestions: [
          new Suggestion({
            action: 'add-mirrors-on',
            title: 'Add UI Coverage',
            description: 'Define which UI elements should be visible/hidden in this state',
            autoFixable: false,
            data: {
              platforms: ['dancer', 'clubApp', 'web'],
              template: 'basic-ui-coverage'
            }
          }),
          new Suggestion({
            action: 'copy-from-similar',
            title: 'Copy from Similar State',
            description: 'Start with UI coverage from a similar state',
            autoFixable: false,
            data: {
              similarStates: this.findSimilarStates(className, context)
            }
          })
        ],
        affectedFields: ['mirrorsOn'],
        location: implication.path
      }));
    }
    
    // Check if UI coverage is incomplete (has mirrorsOn but empty/minimal)
    else if (metadata.uiCoverage && metadata.uiCoverage.total === 0) {
      issues.push(this.createIssue({
        severity: IssueSeverity.INFO,
        type: IssueType.INCOMPLETE_UI_COVERAGE,
        stateName: className,
        title: 'Empty UI Coverage',
        message: `${className} has mirrorsOn property but no screens defined. UI validations exist but are empty.`,
        suggestions: [
          new Suggestion({
            action: 'add-platform-coverage',
            title: 'Add Platform Coverage',
            description: 'Define UI validations for at least one platform',
            autoFixable: false,
            data: {
              platforms: ['dancer', 'clubApp', 'web']
            }
          })
        ],
        affectedFields: ['mirrorsOn.UI'],
        location: implication.path
      }));
    }
    
    // Check for incomplete platform coverage
    else if (metadata.uiCoverage) {
      const platforms = Object.keys(metadata.uiCoverage.platforms);
      const allPlatforms = ['dancer', 'clubApp', 'web'];
      const missing = allPlatforms.filter(p => !platforms.includes(p));
      
      if (missing.length > 0 && missing.length < allPlatforms.length) {
        issues.push(this.createIssue({
          severity: IssueSeverity.INFO,
          type: IssueType.INCOMPLETE_UI_COVERAGE,
          stateName: className,
          title: 'Incomplete Platform Coverage',
          message: `${className} is missing UI coverage for: ${missing.join(', ')}`,
          suggestions: [
            new Suggestion({
              action: 'add-missing-platforms',
              title: `Add ${missing.join(', ')} Coverage`,
              description: 'Define UI validations for missing platforms',
              autoFixable: false,
              data: {
                missingPlatforms: missing,
                existingPlatforms: platforms
              }
            })
          ],
          affectedFields: ['mirrorsOn.UI'],
          location: implication.path
        }));
      }
    }
    
    return issues;
  }
  
  /**
   * Find similar states based on naming patterns
   */
  findSimilarStates(currentState, context) {
    const allStates = context.implications
      .filter(i => i.metadata.hasMirrorsOn && i.metadata.uiCoverage?.total > 0)
      .map(i => i.metadata.className);
    
    // Simple similarity: same suffix or similar words
    return allStates.filter(state => {
      const currentWords = currentState.match(/[A-Z][a-z]+/g) || [];
      const stateWords = state.match(/[A-Z][a-z]+/g) || [];
      
      // Check if they share at least one word
      return currentWords.some(word => stateWords.includes(word));
    }).slice(0, 3);
  }
}