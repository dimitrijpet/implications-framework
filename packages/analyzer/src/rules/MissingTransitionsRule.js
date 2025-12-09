import { BaseRule } from './BaseRule.js';
import { Issue, Suggestion, IssueSeverity, IssueType } from '../types/issues.js';

/**
 * Detects implications with xstateConfig but no transitions
 */
export class MissingTransitionsRule extends BaseRule {
  appliesTo(implication) {
    // Only applies to stateful implications
    return implication.metadata?.hasXStateConfig === true;
  }
  
  analyze(implication, context) {
    const issues = [];
    const metadata = implication.metadata;
    const className = metadata.className;
    
    // Find transitions for this state
    const outgoingTransitions = context.transitions.filter(
      t => t.from === className
    );
    
    // If no transitions, this is a terminal state (might be intentional)
    // But if it's not obviously terminal (like "Completed", "Cancelled"), flag it
    const terminalStates = ['completed', 'cancelled', 'deleted', 'archived', 'final'];
    const isTerminal = terminalStates.some(term => 
      className.toLowerCase().includes(term)
    );
    
    if (outgoingTransitions.length === 0 && !isTerminal) {
      issues.push(this.createIssue({
        severity: IssueSeverity.WARNING,
        type: IssueType.MISSING_TRANSITIONS,
        stateName: className,
        title: 'No Transitions Defined',
        message: `${className} has no outgoing transitions. This state appears isolated and may be unreachable or a dead-end.`,
        suggestions: [
          new Suggestion({
            action: 'add-transition',
            title: 'Add Transition',
            description: 'Define at least one transition to another state',
            autoFixable: false,
            data: {
              suggestedEvents: ['COMPLETE', 'CANCEL', 'UPDATE', 'NEXT'],
              suggestedTargets: this.suggestTargets(className, context)
            }
          }),
          new Suggestion({
            action: 'mark-terminal',
            title: 'Mark as Terminal State',
            description: 'If this is intentionally a final state, document it',
            autoFixable: true,
            data: {
              addToMeta: { terminal: true }
            }
          })
        ],
        affectedFields: ['xstateConfig.on'],
        location: implication.path
      }));
    }
    
    return issues;
  }
  
  /**
   * Suggest possible target states based on naming patterns
   */
  suggestTargets(currentState, context) {
    const allStates = context.implications.map(i => i.metadata.className);
    
    // Simple heuristic: suggest states with similar patterns
    // E.g., PendingBooking → AcceptedBooking, RejectedBooking
    const baseName = currentState.replace(/Implications$/, '');
    
    return allStates.filter(state => {
      return state !== currentState && 
             state.includes(baseName.split(/(?=[A-Z])/)[1] || '');
    }).slice(0, 3); // Top 3 suggestions
  }
}