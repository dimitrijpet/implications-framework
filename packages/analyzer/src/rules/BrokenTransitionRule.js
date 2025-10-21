import { BaseRule } from './BaseRule.js';
import { Issue, Suggestion, IssueSeverity, IssueType } from '../types/issues.js';

/**
 * Detects transitions that reference non-existent states
 */
export class BrokenTransitionRule extends BaseRule {
  appliesTo(implication) {
    return implication.metadata?.hasXStateConfig === true;
  }
  
  analyze(implication, context) {
    const issues = [];
    const className = implication.metadata.className;
    
    // Get all valid state names
    const validStates = context.implications
      .filter(i => i.metadata.hasXStateConfig)
      .map(i => i.metadata.className);
    
    // Find transitions from this state
    const outgoing = context.transitions.filter(t => t.from === className);
    
    outgoing.forEach(transition => {
      // Check if target state exists
      const targetExists = validStates.includes(transition.to);
      
      if (!targetExists) {
        issues.push(this.createIssue({
          severity: IssueSeverity.ERROR,
          type: IssueType.BROKEN_TRANSITION,
          stateName: className,
          title: 'Broken Transition',
          message: `${className} has transition "${transition.event}" to "${transition.to}", but that state doesn't exist.`,
          suggestions: [
            new Suggestion({
              action: 'fix-target',
              title: 'Fix Target State',
              description: 'Update the transition to reference a valid state',
              autoFixable: false,
              data: {
                currentTarget: transition.to,
                event: transition.event,
                possibleTargets: this.suggestSimilarStates(transition.to, validStates)
              }
            }),
            new Suggestion({
              action: 'remove-transition',
              title: 'Remove Transition',
              description: 'Delete this broken transition',
              autoFixable: true,
              data: {
                event: transition.event
              }
            })
          ],
          affectedFields: [`xstateConfig.on.${transition.event}`],
          location: implication.path
        }));
      }
    });
    
    return issues;
  }
  
  /**
   * Suggest states with similar names
   */
  suggestSimilarStates(targetName, validStates) {
    // Simple Levenshtein-like matching
    return validStates
      .map(state => ({
        name: state,
        similarity: this.calculateSimilarity(targetName.toLowerCase(), state.toLowerCase())
      }))
      .filter(s => s.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(s => s.name);
  }
  
  /**
   * Simple similarity calculation
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  /**
   * Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}