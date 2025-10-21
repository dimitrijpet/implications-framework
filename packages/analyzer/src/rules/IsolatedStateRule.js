import { BaseRule } from './BaseRule.js';
import { Issue, Suggestion, IssueSeverity, IssueType } from '../types/issues.js';

/**
 * Detects states that have no incoming or outgoing transitions (completely isolated)
 */
export class IsolatedStateRule extends BaseRule {
  appliesTo(implication) {
    return implication.metadata?.hasXStateConfig === true;
  }
  
  analyze(implication, context) {
    const issues = [];
    const className = implication.metadata.className;
    
    // Find incoming and outgoing transitions
    const incoming = context.transitions.filter(t => t.to === className);
    const outgoing = context.transitions.filter(t => t.from === className);
    
    // If no incoming AND no outgoing, this state is completely isolated
    if (incoming.length === 0 && outgoing.length === 0) {
      issues.push(this.createIssue({
        severity: IssueSeverity.ERROR,
        type: IssueType.ISOLATED_STATE,
        stateName: className,
        title: 'Isolated State',
        message: `${className} is completely isolated with no incoming or outgoing transitions. This state is unreachable and serves no purpose in the state machine.`,
        suggestions: [
          new Suggestion({
            action: 'add-incoming-transition',
            title: 'Add Incoming Transition',
            description: 'Connect this state to the state machine by adding a transition from another state',
            autoFixable: false,
            data: {
              possibleSources: context.implications
                .filter(i => i.metadata.hasXStateConfig)
                .map(i => i.metadata.className)
                .slice(0, 5)
            }
          }),
          new Suggestion({
            action: 'delete-state',
            title: 'Delete This State',
            description: 'If this state is not needed, consider removing it',
            autoFixable: false
          })
        ],
        affectedFields: ['xstateConfig.on'],
        location: implication.path
      }));
    }
    // If no incoming but has outgoing, warn about unreachable state
    else if (incoming.length === 0 && outgoing.length > 0) {
      issues.push(this.createIssue({
        severity: IssueSeverity.WARNING,
        type: IssueType.ISOLATED_STATE,
        stateName: className,
        title: 'Unreachable State',
        message: `${className} has no incoming transitions. This state can never be reached from other states.`,
        suggestions: [
          new Suggestion({
            action: 'add-incoming-transition',
            title: 'Add Incoming Transition',
            description: 'Make this state reachable by adding a transition from another state',
            autoFixable: false,
            data: {
              possibleSources: context.implications
                .filter(i => i.metadata.hasXStateConfig)
                .map(i => i.metadata.className)
                .slice(0, 5)
            }
          }),
          new Suggestion({
            action: 'mark-initial',
            title: 'Mark as Initial State',
            description: 'If this is the starting state, document it in the meta',
            autoFixable: true,
            data: {
              addToMeta: { initial: true }
            }
          })
        ],
        affectedFields: [],
        location: implication.path
      }));
    }
    
    return issues;
  }
}