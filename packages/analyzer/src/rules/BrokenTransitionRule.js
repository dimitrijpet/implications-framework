// packages/analyzer/src/rules/BrokenTransitionRule.js (UPDATE)

import { BaseRule } from './BaseRule.js';
import { IssueSeverity, IssueType, Issue, Suggestion } from '../types/issues.js';

export class BrokenTransitionRule extends BaseRule {
  constructor() {
    super('broken-transitions', 'Broken State Transitions');
  }
  
  appliesTo(implication) {
    return implication.metadata?.hasXStateConfig === true;
  }
  
  analyze(implication, context) {
    const issues = [];
    const className = implication.metadata.className;
    
    // ✅ Get state registry from context
    const registry = context.stateRegistry;
    
    if (!registry) {
      console.warn('⚠️  No state registry available for analysis');
      return issues;
    }
    
    // Find outgoing transitions from this state
    const outgoing = context.transitions.filter(t => t.from === className);
    
    if (outgoing.length === 0) {
      return issues;
    }
    
    outgoing.forEach(transition => {
      // ✅ Resolve target using registry
      const resolvedTarget = registry.resolve(transition.to);
      
      if (!resolvedTarget) {
        // Target cannot be resolved at all
        issues.push(this.createIssue({
          severity: IssueSeverity.ERROR,
          type: IssueType.BROKEN_TRANSITION,
          stateName: className,
          title: `Unresolvable Transition: ${transition.event}`,
          message: `State "${className}" has transition "${transition.event}" pointing to "${transition.to}", which cannot be resolved to any known state class.`,
          details: {
            event: transition.event,
            targetName: transition.to,
            sourceFile: implication.path
          },
          suggestions: [
            new Suggestion({
              action: 'check-registry',
              title: '📋 Check State Registry',
              description: 'Verify state registry configuration and naming patterns',
              autoFixable: false
            }),
            new Suggestion({
              action: 'add-mapping',
              title: '➕ Add Custom Mapping',
              description: `Add explicit mapping for "${transition.to}" in ai-testing.config.js`,
              autoFixable: false,
              data: { 
                targetName: transition.to,
                suggestedMapping: this.suggestMapping(transition.to, context)
              }
            })
          ]
        }));
        return;
      }
      
      // Check if resolved target exists as a class
      const targetExists = context.implications.some(
        impl => impl.metadata.className === resolvedTarget
      );
      
      if (!targetExists) {
        // Target resolves but class doesn't exist
        issues.push(this.createIssue({
          severity: IssueSeverity.ERROR,
          type: IssueType.BROKEN_TRANSITION,
          stateName: className,
          title: `Missing Target State: ${transition.event}`,
          message: `State "${className}" has transition "${transition.event}" to "${transition.to}" (resolves to "${resolvedTarget}"), but that state class doesn't exist.`,
          details: {
            event: transition.event,
            targetName: transition.to,
            resolvedName: resolvedTarget,
            sourceFile: implication.path
          },
          suggestions: [
            new Suggestion({
              action: 'create-state',
              title: `✨ Create ${resolvedTarget}`,
              description: 'Generate the missing state class with template',
              autoFixable: true,
              data: { 
                className: resolvedTarget,
                shortName: transition.to
              }
            }),
            new Suggestion({
              action: 'fix-target',
              title: '🔧 Fix Transition Target',
              description: 'Update transition to reference an existing state',
              autoFixable: false,
              data: {
                currentTarget: transition.to,
                resolvedTarget: resolvedTarget,
                possibleTargets: this.suggestSimilarStates(resolvedTarget, context)
              }
            }),
            new Suggestion({
              action: 'remove-transition',
              title: '🗑️ Remove Transition',
              description: 'Delete this broken transition',
              autoFixable: true,
              data: {
                event: transition.event
              }
            })
          ]
        }));
      }
    });
    
    return issues;
  }
  
  /**
   * Suggest a mapping for an unresolvable state
   */
  suggestMapping(targetName, context) {
    // Find similar class names
    const similar = context.implications
      .map(impl => impl.metadata.className)
      .filter(name => {
        const lowerName = name.toLowerCase();
        const lowerTarget = targetName.toLowerCase();
        return lowerName.includes(lowerTarget) || lowerTarget.includes(lowerName);
      });
    
    if (similar.length > 0) {
      return similar[0];
    }
    
    // Suggest a class name based on naming pattern
    const capitalizedTarget = targetName.charAt(0).toUpperCase() + targetName.slice(1);
    return `${capitalizedTarget}BookingImplications`;
  }
  
  /**
   * Find states with similar names
   */
  suggestSimilarStates(targetName, context) {
    const allStates = context.implications.map(impl => impl.metadata.className);
    
    // Calculate similarity scores
    const scored = allStates.map(state => ({
      name: state,
      score: this.calculateSimilarity(targetName, state)
    }));
    
    // Return top 3 matches
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter(s => s.score > 0.3)
      .map(s => s.name);
  }
  
  /**
   * Simple similarity score (Levenshtein-ish)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
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