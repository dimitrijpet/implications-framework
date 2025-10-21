import { BaseRule } from './BaseRule.js';
import { Issue, Suggestion, IssueSeverity, IssueType } from '../types/issues.js';

/**
 * Detects implications that extend base classes but don't override anything meaningful
 */
export class EmptyInheritanceRule extends BaseRule {
  appliesTo(implication) {
    return true; // Applies to all
  }
  
  analyze(implication, context) {
    const issues = [];
    const metadata = implication.metadata;
    const className = metadata.className;
    
    // Check if UI coverage uses mergeWithBase
    if (metadata.uiCoverage && metadata.uiCoverage.platforms) {
      const platforms = metadata.uiCoverage.platforms;
      
      Object.entries(platforms).forEach(([platformName, platformData]) => {
        if (platformData.screens) {
          platformData.screens.forEach(screen => {
            // If screen has very minimal overrides (only description, no visible/hidden)
            const hasOnlyDescription = 
              screen.description && 
              (!screen.visible || screen.visible.length === 0) &&
              (!screen.hidden || screen.hidden.length === 0);
            
            if (hasOnlyDescription) {
              issues.push(this.createIssue({
                severity: IssueSeverity.INFO,
                type: IssueType.EMPTY_INHERITANCE,
                stateName: className,
                title: 'Minimal Override in UI Coverage',
                message: `${className}.${platformName}.${screen.name} extends base but only overrides description. Consider adding meaningful overrides or using base directly.`,
                suggestions: [
                  new Suggestion({
                    action: 'add-overrides',
                    title: 'Add Meaningful Overrides',
                    description: 'Add visible/hidden elements or other validations',
                    autoFixable: false,
                    data: {
                      platform: platformName,
                      screen: screen.name
                    }
                  }),
                  new Suggestion({
                    action: 'use-base-directly',
                    title: 'Use Base Directly',
                    description: 'Remove the override and reference base class directly',
                    autoFixable: true,
                    data: {
                      platform: platformName,
                      screen: screen.name
                    }
                  })
                ],
                affectedFields: [`mirrorsOn.UI.${platformName}.${screen.name}`],
                location: implication.path
              }));
            }
          });
        }
      });
    }
    
    return issues;
  }
}