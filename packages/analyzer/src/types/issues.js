/**
 * Issue severity levels
 */
export const IssueSeverity = {
  ERROR: 'error',     // Blocks functionality
  WARNING: 'warning', // Should fix but not critical
  INFO: 'info'        // Suggestions for improvement
};

/**
 * Issue types (categories)
 */
export const IssueType = {
  MISSING_TRANSITIONS: 'missing-transitions',
  ISOLATED_STATE: 'isolated-state',
  MISSING_UI_COVERAGE: 'missing-ui-coverage',
  INCOMPLETE_UI_COVERAGE: 'incomplete-ui-coverage',
  EMPTY_INHERITANCE: 'empty-inheritance',
  INVALID_STATE_NAME: 'invalid-state-name',
  MISSING_METADATA: 'missing-metadata',
  BROKEN_TRANSITION: 'broken-transition'
};

/**
 * Issue structure
 */
export class Issue {
  constructor({
    severity,
    type,
    stateName,
    title,
    message,
    suggestions = [],
    affectedFields = [],
    location = null
  }) {
    this.severity = severity;
    this.type = type;
    this.stateName = stateName;
    this.title = title;
    this.message = message;
    this.suggestions = suggestions; // Array of Suggestion objects
    this.affectedFields = affectedFields; // Fields that are affected
    this.location = location; // File path
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Suggestion for fixing an issue
 */
export class Suggestion {
  constructor({
    action,
    title,
    description,
    autoFixable = false,
    data = {}
  }) {
    this.action = action; // e.g., 'add-transition', 'add-platform'
    this.title = title;
    this.description = description;
    this.autoFixable = autoFixable; // Can be fixed automatically?
    this.data = data; // Data needed for the fix
  }
}

/**
 * Analysis result
 */
export class AnalysisResult {
  constructor({
    projectPath,
    totalImplications = 0,
    issues = [],
    summary = {}
  }) {
    this.projectPath = projectPath;
    this.totalImplications = totalImplications;
    this.issues = issues;
    this.summary = summary;
    this.timestamp = new Date().toISOString();
  }
  
  /**
   * Get issues by severity
   */
  getBySeverity(severity) {
    return this.issues.filter(issue => issue.severity === severity);
  }
  
  /**
   * Get issues by type
   */
  getByType(type) {
    return this.issues.filter(issue => issue.type === type);
  }
  
  /**
   * Get issues for a specific state
   */
  getForState(stateName) {
    return this.issues.filter(issue => issue.stateName === stateName);
  }
  
  /**
   * Calculate summary statistics
   */
  calculateSummary() {
    this.summary = {
      total: this.issues.length,
      errors: this.getBySeverity(IssueSeverity.ERROR).length,
      warnings: this.getBySeverity(IssueSeverity.WARNING).length,
      info: this.getBySeverity(IssueSeverity.INFO).length,
      byType: {}
    };
    
    // Count by type
    Object.values(IssueType).forEach(type => {
      const count = this.getByType(type).length;
      if (count > 0) {
        this.summary.byType[type] = count;
      }
    });
    
    return this.summary;
  }
}