// packages/analyzer/src/index.js (UPDATE)

import { BrokenTransitionRule } from './rules/BrokenTransitionRule.js';
import { IsolatedStateRule } from './rules/IsolatedStateRule.js';
import { MissingTransitionsRule } from './rules/MissingTransitionsRule.js';
import { MissingUICoverageRule } from './rules/MissingUICoverageRule.js';
import { EmptyInheritanceRule } from './rules/EmptyInheritanceRule.js';
import { AnalysisResult, AnalysisSummary } from './types/issues.js';

export class ProjectAnalyzer {
  constructor() {
    this.rules = [
      new BrokenTransitionRule(),
      new IsolatedStateRule(),
      new MissingTransitionsRule(),
      new MissingUICoverageRule(),
      new EmptyInheritanceRule()
    ];
  }
  
  /**
   * Analyze discovery result and detect issues
   * @param {Object} discoveryResult - From discovery service
   * @param {Object} options - Analysis options (includes stateRegistry)
   */
  analyze(discoveryResult, options = {}) {
    console.log('\n🔍 Running analysis...');
    
    const implications = discoveryResult.files?.implications || [];
    const transitions = discoveryResult.transitions || [];
    
    // ✅ Build context with state registry
    const context = {
      implications,
      transitions,
      stateRegistry: options.stateRegistry, // ✅ Include registry
      projectPath: discoveryResult.projectPath,
      projectType: discoveryResult.projectType
    };
    
    const result = new AnalysisResult();
    
    // Run each rule
    for (const rule of this.rules) {
      console.log(`  Running: ${rule.name}`);
      
      for (const implication of implications) {
        if (rule.appliesTo(implication)) {
          const issues = rule.analyze(implication, context);
          result.issues.push(...issues);
        }
      }
    }
    
    // Build summary
    result.summary = this.buildSummary(result.issues);
    
    console.log(`✅ Analysis complete: ${result.summary.totalIssues} issues found`);
    
    return result;
  }
  
  buildSummary(issues) {
    const summary = new AnalysisSummary();
    
    summary.totalIssues = issues.length;
    summary.errorCount = issues.filter(i => i.severity === 'error').length;
    summary.warningCount = issues.filter(i => i.severity === 'warning').length;
    summary.infoCount = issues.filter(i => i.severity === 'info').length;
    
    // Group by type
    summary.byType = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {});
    
    // Group by state
    summary.byState = issues.reduce((acc, issue) => {
      const state = issue.stateName || 'unknown';
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});
    
    return summary;
  }
}