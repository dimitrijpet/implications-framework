import { AnalysisResult } from './types/issues.js';
import { MissingTransitionsRule } from './rules/MissingTransitionsRule.js';
import { IsolatedStateRule } from './rules/IsolatedStateRule.js';
import { MissingUICoverageRule } from './rules/MissingUICoverageRule.js';
import { EmptyInheritanceRule } from './rules/EmptyInheritanceRule.js';
import { BrokenTransitionRule } from './rules/BrokenTransitionRule.js';

/**
 * Main Analyzer Service
 */
export class Analyzer {
  constructor() {
    this.rules = [
      new BrokenTransitionRule(),      // Check first (most critical)
      new IsolatedStateRule(),
      new MissingTransitionsRule(),
      new MissingUICoverageRule(),
      new EmptyInheritanceRule()
    ];
  }
  
  /**
   * Analyze a discovery result and return issues
   * @param {DiscoveryResult} discoveryResult
   * @returns {AnalysisResult}
   */
  analyze(discoveryResult) {
    console.log('🔍 Analyzing project for issues...');
    
    const implications = discoveryResult.files.implications;
    const transitions = discoveryResult.transitions;
    
    const context = {
      implications,
      transitions,
      projectPath: discoveryResult.projectPath
    };
    
    const allIssues = [];
    
    // Run each rule on each implication
    implications.forEach(implication => {
      this.rules.forEach(rule => {
        if (!rule.enabled) return;
        
        if (rule.appliesTo(implication)) {
          const issues = rule.analyze(implication, context);
          allIssues.push(...issues);
        }
      });
    });
    
    // Create analysis result
    const result = new AnalysisResult({
      projectPath: discoveryResult.projectPath,
      totalImplications: implications.length,
      issues: allIssues
    });
    
    // Calculate summary
    result.calculateSummary();
    
    console.log(`✅ Analysis complete:`);
    console.log(`   - Total issues: ${result.summary.total}`);
    console.log(`   - Errors: ${result.summary.errors}`);
    console.log(`   - Warnings: ${result.summary.warnings}`);
    console.log(`   - Info: ${result.summary.info}`);
    
    return result;
  }
  
  /**
   * Add a custom rule
   */
  addRule(rule) {
    this.rules.push(rule);
  }
  
  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleName, enabled) {
    const rule = this.rules.find(r => r.name === ruleName);
    if (rule) {
      rule.enabled = enabled;
    }
  }
}

// Export everything
export * from './types/issues.js';
export * from './rules/BaseRule.js';
export * from './rules/MissingTransitionsRule.js';
export * from './rules/IsolatedStateRule.js';
export * from './rules/MissingUICoverageRule.js';
export * from './rules/EmptyInheritanceRule.js';
export * from './rules/BrokenTransitionRule.js';