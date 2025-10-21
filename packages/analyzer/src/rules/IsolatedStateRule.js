// packages/analyzer/src/rules/IsolatedStateRule.js (UPDATE)

import { BaseRule } from './BaseRule.js';
import { IssueSeverity, IssueType, Issue, Suggestion } from '../types/issues.js';

export class IsolatedStateRule extends BaseRule {
  constructor() {
    super('isolated-states', 'Isolated States');
  }
  
  appliesTo(implication) {
    return true; // Check all implications
  }
  
  analyze(implication, context) {
    const issues = [];
    const className = implication.metadata.className;
    
    // ✅ Get state registry
    const registry = context.stateRegistry;
    
    if (!registry) {
      return issues;
    }
    
    // Check if state is referenced by any transition
    const isReferenced = context.transitions.some(t => {
      // ✅ Resolve target name using registry
      const resolvedTarget = registry.resolve(t.to);
      return resolvedTarget === className;
    });
    
    // Check if state has any outgoing transitions
    const hasOutgoing = context.transitions.some(t => t.from === className);
    
    // Isolated if: no incoming AND no outgoing
    const isIsolated = !isReferenced && !hasOutgoing;
    
    if (isIsolated) {
      // Check if it's a terminal state (might be intentional)
      const isTerminal = this.isTerminalState(implication);
      
      issues.push(this.createIssue({
        severity: isTerminal ? IssueSeverity.WARNING : IssueSeverity.ERROR,
        type: IssueType.ISOLATED_STATE,
        stateName: className,
        title: isTerminal ? 'Terminal State Not Referenced' : 'Completely Isolated State',
        message: isTerminal 
          ? `State "${className}" appears to be a terminal state but is never referenced by any transition.`
          : `State "${className}" is completely isolated - it has no incoming or outgoing transitions.`,
        details: {
          hasOutgoing: false,
          isReferenced: false,
          isTerminal: isTerminal,
          sourceFile: implication.path
        },
        suggestions: this.getSuggestions(className, implication, context)
      }));
    }
    
    return issues;
  }
  
  isTerminalState(implication) {
    const metadata = implication.metadata;
    
    // Check if xstateConfig has no outgoing transitions
    if (metadata.hasXStateConfig) {
      // Assume terminal if no 'on' property or empty 'on'
      return true; // Simplified check
    }
    
    return false;
  }
  
  getSuggestions(className, implication, context) {
    const suggestions = [];
    
    // Suggest adding transitions
    suggestions.push(new Suggestion({
      action: 'add-transition',
      title: '➕ Add Incoming Transition',
      description: 'Add a transition from another state to this one',
      autoFixable: false,
      data: {
        targetState: className,
        possibleSources: this.suggestSourceStates(className, context)
      }
    }));
    
    // Suggest adding outgoing transitions
    suggestions.push(new Suggestion({
      action: 'add-outgoing',
      title: '➕ Add Outgoing Transition',
      description: 'Add transitions from this state to others',
      autoFixable: false
    }));
    
    // Suggest removal if truly isolated
    suggestions.push(new Suggestion({
      action: 'remove-state',
      title: '🗑️ Remove Isolated State',
      description: 'Delete this state if it\'s not needed',
      autoFixable: true,
      data: {
        className: className,
        filePath: implication.path
      }
    }));
    
    return suggestions;
  }
  
  suggestSourceStates(targetState, context) {
    // Return all states that could transition to this one
    return context.implications
      .filter(impl => impl.metadata.className !== targetState)
      .map(impl => impl.metadata.className)
      .slice(0, 5); // Top 5
  }
}