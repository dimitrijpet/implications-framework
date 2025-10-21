// packages/api-server/src/services/patternAnalyzer.js

/**
 * Pattern Analyzer Service
 * Analyzes existing states to extract patterns and generate suggestions
 */

export class PatternAnalyzer {
  
  /**
   * Analyze all patterns from discovery result
   */
  static analyze(discoveryResult) {
    if (!discoveryResult?.files?.implications || discoveryResult.files.implications.length === 0) {
      return {
        noData: true,
        message: 'No states found to analyze'
      };
    }

    const implications = discoveryResult.files.implications;
    
    console.log(`🔍 Analyzing patterns from ${implications.length} states...`);
    
    const buttons = this.analyzeButtonPatterns(implications);
    const fields = this.analyzeFieldPatterns(implications);
    const setup = this.analyzeSetupPatterns(implications);
    const platforms = this.analyzePlatformDistribution(implications);
    
    console.log('✅ Pattern analysis complete');
    
    return {
      buttons,
      fields,
      setup,
      platforms,
      totalStates: implications.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyze button naming patterns
   */
  static analyzeButtonPatterns(implications) {
    const buttons = implications
      .map(imp => imp.metadata?.triggerButton)
      .filter(Boolean);
    
    if (buttons.length === 0) {
      return { noData: true };
    }

    // Count occurrences
    const frequency = {};
    buttons.forEach(button => {
      frequency[button] = (frequency[button] || 0) + 1;
    });

    // Detect naming convention
    const convention = this.detectNamingConvention(buttons);
    
    // Find most common verbs
    const verbs = this.extractVerbs(buttons);
    
    // Calculate statistics
    const total = buttons.length;
    const sortedButtons = Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    const mostCommon = sortedButtons.reduce((acc, [button, count]) => {
      acc[button] = (count / total).toFixed(2);
      return acc;
    }, {});

    console.log(`  📊 Button patterns:`, {
      convention: convention.pattern,
      confidence: convention.confidence,
      total: buttons.length
    });

    return {
      convention,
      mostCommon,
      topVerbs: verbs.slice(0, 5),
      totalAnalyzed: total,
      examples: sortedButtons.slice(0, 3).map(([btn]) => btn)
    };
  }

  /**
   * Detect naming convention (VERB_OBJECT vs OBJECT_VERB vs OTHER)
   */
  static detectNamingConvention(buttons) {
    const patterns = {
      VERB_OBJECT: 0,    // SUBMIT_BOOKING, ACCEPT_REQUEST
      OBJECT_VERB: 0,    // BOOKING_SUBMIT, REQUEST_ACCEPT
      SINGLE_VERB: 0,    // SUBMIT, ACCEPT, REJECT
      OTHER: 0
    };

    const commonVerbs = [
      'SUBMIT', 'ACCEPT', 'REJECT', 'CREATE', 'UPDATE', 'DELETE',
      'CANCEL', 'REVIEW', 'APPROVE', 'CONFIRM', 'START', 'FINISH',
      'COMPLETE', 'PROCESS', 'SEND', 'REQUEST', 'EDIT', 'REMOVE'
    ];

    buttons.forEach(button => {
      const parts = button.split('_');
      
      if (parts.length === 1) {
        patterns.SINGLE_VERB++;
      } else if (parts.length === 2) {
        const [first, second] = parts;
        
        if (commonVerbs.includes(first)) {
          patterns.VERB_OBJECT++;
        } else if (commonVerbs.includes(second)) {
          patterns.OBJECT_VERB++;
        } else {
          patterns.OTHER++;
        }
      } else {
        patterns.OTHER++;
      }
    });

    const total = buttons.length;
    const maxPattern = Object.entries(patterns)
      .reduce((max, [pattern, count]) => 
        count > max.count ? { pattern, count } : max,
        { pattern: 'OTHER', count: 0 }
      );

    return {
      pattern: maxPattern.pattern,
      confidence: (maxPattern.count / total).toFixed(2),
      distribution: Object.entries(patterns).reduce((acc, [key, val]) => {
        acc[key] = (val / total).toFixed(2);
        return acc;
      }, {})
    };
  }

  /**
   * Extract common verbs from button names
   */
  static extractVerbs(buttons) {
    const verbCounts = {};
    
    const commonVerbs = [
      'SUBMIT', 'ACCEPT', 'REJECT', 'CREATE', 'UPDATE', 'DELETE',
      'CANCEL', 'REVIEW', 'APPROVE', 'CONFIRM', 'START', 'FINISH'
    ];

    buttons.forEach(button => {
      const parts = button.split('_');
      parts.forEach(part => {
        if (commonVerbs.includes(part)) {
          verbCounts[part] = (verbCounts[part] || 0) + 1;
        }
      });
    });

    return Object.entries(verbCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([verb, count]) => ({ verb, count, percentage: (count / buttons.length).toFixed(2) }));
  }

/**
 * Extract field names from xstateConfig.entry assign() calls
 */
static extractFieldsFromEntry(entry) {
  const fields = [];
  
  if (!entry) return fields;
  
  // entry can be a function, object, or array
  if (typeof entry === 'function') {
    const entryStr = entry.toString();
    // Match patterns like: fieldName: value or "fieldName": value
    const matches = entryStr.matchAll(/['"]?(\w+)['"]?\s*:/g);
    for (const match of matches) {
      const field = match[1];
      // Filter out common XState internals
      if (!['type', 'event', 'context', 'params'].includes(field)) {
        fields.push(field);
      }
    }
  } else if (typeof entry === 'object' && entry !== null) {
    // Direct object with field assignments
    Object.keys(entry).forEach(key => {
      if (!['type'].includes(key)) {
        fields.push(key);
      }
    });
  } else if (Array.isArray(entry)) {
    // Array of entry actions
    entry.forEach(action => {
      if (typeof action === 'object' && action !== null) {
        Object.keys(action).forEach(key => {
          if (!['type'].includes(key)) {
            fields.push(key);
          }
        });
      }
    });
  }
  
  return [...new Set(fields)]; // Remove duplicates
}

/**
 * Analyze required fields patterns - IMPROVED VERSION
 * Now separates required fields vs context fields
 */
static analyzeFieldPatterns(implications) {
  const requiredFields = {};
  const contextFields = {};
  const allFields = {};
  
  implications.forEach(imp => {
    // Extract required fields from meta
    if (imp.metadata?.requiredFields && Array.isArray(imp.metadata.requiredFields)) {
      imp.metadata.requiredFields.forEach(field => {
        requiredFields[field] = (requiredFields[field] || 0) + 1;
        allFields[field] = (allFields[field] || 0) + 1;
      });
    }
    
    // Extract context fields from xstateConfig.entry
    if (imp.xstateConfig?.entry) {
      const entryFields = this.extractFieldsFromEntry(imp.xstateConfig.entry);
      entryFields.forEach(field => {
        contextFields[field] = (contextFields[field] || 0) + 1;
        if (!requiredFields[field]) {
          allFields[field] = (allFields[field] || 0) + 1;
        }
      });
    }
  });

  const total = implications.length;

  // Helper to format field data
  const formatFields = (fieldObj) => {
    return Object.entries(fieldObj)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([field, count]) => ({
        field,
        count,
        percentage: Math.round((count / total) * 100) + '%',
        frequency: (count / total).toFixed(2)
      }));
  };

  const requiredCommon = formatFields(requiredFields);
  const contextCommon = formatFields(contextFields);
  const allCommon = formatFields(allFields);

  // Find common field combinations (only for required fields)
  const combinations = this.findFieldCombinations(implications);

  console.log(`  📊 Field patterns: ${Object.keys(allFields).length} unique fields (${Object.keys(requiredFields).length} required, ${Object.keys(contextFields).length} context)`);

  return {
    required: requiredCommon,
    context: contextCommon,
    all: allCommon,
    totalUnique: Object.keys(allFields).length,
    commonCombinations: combinations.slice(0, 3)
  };
}

  /**
   * Find common field combinations that appear together
   */
  static findFieldCombinations(implications) {
    const combos = {};
    
    implications.forEach(imp => {
      const fields = imp.metadata?.requiredFields || [];
      if (fields.length < 2) return;
      
      // Sort to ensure consistent combination keys
      const sorted = [...fields].sort();
      const key = sorted.join(',');
      combos[key] = (combos[key] || 0) + 1;
    });

    return Object.entries(combos)
      .sort(([, a], [, b]) => b - a)
      .map(([combo, count]) => ({
        fields: combo.split(','),
        count,
        frequency: (count / implications.length).toFixed(2)
      }));
  }
/**
 * Analyze setup action patterns - IMPROVED VERSION
 * Now properly extracts function/action names
 */
static analyzeSetupPatterns(implications) {
  const setupActions = {};
  
  implications.forEach(imp => {
    const setup = imp.metadata?.setup;
    if (!setup) return;
    
    const actions = Array.isArray(setup) ? setup : [setup];
    
    actions.forEach(action => {
      const actionName = this.extractActionName(action);
      if (actionName) {
        setupActions[actionName] = (setupActions[actionName] || 0) + 1;
      }
    });
  });

  if (Object.keys(setupActions).length === 0) {
    return { noData: true };
  }

  const total = implications.length;
  const sortedActions = Object.entries(setupActions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  
  const mostCommon = sortedActions.map(([action, count]) => ({
    action,
    count,
    percentage: Math.round((count / total) * 100) + '%',
    frequency: (count / total).toFixed(2)
  }));

  console.log(`  📊 Setup patterns: ${sortedActions.length} common actions found`);

  return {
    mostCommon,
    totalUnique: Object.keys(setupActions).length
  };
}

/**
 * Extract readable action name from various action formats
 */
static extractActionName(action) {
  // String action name
  if (typeof action === 'string') {
    return action;
  }
  
  // Function with name
  if (typeof action === 'function') {
    return action.name || 'anonymous';
  }
  
  // Object with name property
  if (action && typeof action === 'object') {
    // Check for common patterns
    if (action.name) return action.name;
    if (action.type) return action.type;
    if (action.action) return action.action;
    
    // Try to extract from toString
    const str = action.toString();
    if (str !== '[object Object]') {
      return str.slice(0, 50);
    }
    
    // Last resort: show first key
    const keys = Object.keys(action);
    if (keys.length > 0) {
      return `{${keys[0]}: ...}`;
    }
  }
  
  return null;
}

  /**
   * Analyze platform distribution
   */
  static analyzePlatformDistribution(implications) {
    const platforms = {};
    
    implications.forEach(imp => {
      const platform = imp.metadata?.platform || 'unknown';
      platforms[platform] = (platforms[platform] || 0) + 1;
    });

    const total = implications.length;
    const distribution = Object.entries(platforms)
      .sort(([, a], [, b]) => b - a)
      .map(([platform, count]) => ({
        platform,
        count,
        percentage: ((count / total) * 100).toFixed(0) + '%'
      }));

    return {
      distribution,
      mostCommon: distribution[0]?.platform || 'unknown'
    };
  }

  /**
   * Generate context-aware suggestions based on current input
   */
  static generateSuggestions(analysisResult, currentInput = {}) {
    if (analysisResult.noData) {
      return { noSuggestions: true };
    }

    const suggestions = {
      triggerButton: [],
      requiredFields: [],
      setupActions: [],
      platform: null
    };

    // Button suggestions
    if (currentInput.stateName && analysisResult.buttons?.convention) {
      suggestions.triggerButton = this.suggestButtonNames(
        currentInput.stateName,
        analysisResult.buttons
      );
    }

    // Field suggestions
    if (analysisResult.fields?.mostCommon) {
      suggestions.requiredFields = analysisResult.fields.mostCommon
        .filter(f => parseFloat(f.frequency) > 0.5) // >50% usage
        .map(f => ({
          field: f.field,
          confidence: f.percentage,
          reason: `Used in ${f.percentage} of states`
        }));
    }

    // Setup suggestions
    if (analysisResult.setup?.mostCommon) {
      suggestions.setupActions = analysisResult.setup.mostCommon
        .filter(s => parseFloat(s.frequency) > 0.6) // >60% usage
        .map(s => ({
          action: s.action,
          confidence: s.percentage,
          reason: `Used in ${s.percentage} of states`
        }));
    }

    // Platform suggestion
    if (analysisResult.platforms?.mostCommon) {
      suggestions.platform = {
        value: analysisResult.platforms.mostCommon,
        reason: 'Most common platform in your project'
      };
    }

    return suggestions;
  }

  /**
   * Suggest button names based on state name and convention
   */
  static suggestButtonNames(stateName, buttonAnalysis) {
    const suggestions = [];
    const { convention, topVerbs } = buttonAnalysis;
    
    // Extract base from state name (e.g., "reviewing_booking" -> "REVIEW", "BOOKING")
    const parts = stateName.split('_');
    
    if (convention.pattern === 'VERB_OBJECT') {
      // Suggest VERB_OBJECT format
      topVerbs.slice(0, 3).forEach(({ verb }) => {
        const object = parts[parts.length - 1]?.toUpperCase() || 'BOOKING';
        suggestions.push({
          value: `${verb}_${object}`,
          confidence: convention.confidence,
          reason: `Matches ${convention.pattern} pattern (${(convention.confidence * 100).toFixed(0)}% confidence)`
        });
      });
    } else if (convention.pattern === 'SINGLE_VERB') {
      // Suggest single verb
      topVerbs.slice(0, 3).forEach(({ verb }) => {
        suggestions.push({
          value: verb,
          confidence: convention.confidence,
          reason: `Matches ${convention.pattern} pattern`
        });
      });
    }

    return suggestions.slice(0, 3); // Top 3 suggestions
  }
}

export default PatternAnalyzer;