// packages/analyzer/src/types/issues.js (ADD THIS CLASS)

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
    location = null,
    details = {}
  }) {
    this.severity = severity;
    this.type = type;
    this.stateName = stateName;
    this.title = title;
    this.message = message;
    this.suggestions = suggestions; // Array of Suggestion objects
    this.affectedFields = affectedFields; // Fields that are affected
    this.location = location; // File path
    this.details = details; // Additional context data
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
 * Analysis summary statistics
 */
export class AnalysisSummary {
  constructor() {
    this.totalIssues = 0;
    this.errorCount = 0;
    this.warningCount = 0;
    this.infoCount = 0;
    this.byType = {}; // Count by issue type
    this.byState = {}; // Count by state name
  }
}

/**
 * Analysis result
 */
export class AnalysisResult {
  constructor() {
    this.projectPath = null;
    this.totalImplications = 0;
    this.issues = [];
    this.summary = new AnalysisSummary();
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
}