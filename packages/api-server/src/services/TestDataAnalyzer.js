// packages/api-server/src/services/TestDataAnalyzer.js

import fs from 'fs-extra';
import path from 'path';

/**
 * TestDataAnalyzer - Analyzes master testData files to suggest context fields
 * 
 * Phase 1 of the Intelligence System
 * 
 * Usage:
 *   const analyzer = new TestDataAnalyzer();
 *   const suggestions = await analyzer.analyze(testDataPath, stateName);
 */
class TestDataAnalyzer {
  
  /**
   * Analyze testData file and suggest fields for a state
   * 
   * @param {string} testDataPath - Absolute path to testData JSON file
   * @param {string} stateName - Name of state being created/edited
   * @returns {Object} Analysis with exact/required/available field suggestions
   */
  async analyze(testDataPath, stateName) {
    console.log(`📊 Analyzing testData for state: ${stateName}`);
    console.log(`📁 TestData file: ${testDataPath}`);
    
    try {
      // 1. Read and parse testData file
      const testData = await this.readTestData(testDataPath);
      
      // 2. Extract keywords from state name
      const keywords = this.extractKeywords(stateName);
      console.log(`🔍 Extracted keywords:`, keywords);
      
      // 3. Match fields to keywords
      const matches = this.matchFields(testData, keywords);
      
      console.log(`✅ Analysis complete:`, {
        exact: matches.exact.length,
        required: matches.required.length,
        available: matches.available.length
      });
      
      return {
        success: true,
        stateName,
        keywords,
        testData,
        suggestions: matches
      };
      
    } catch (error) {
      console.error('❌ TestData analysis error:', error);
      throw new Error(`Failed to analyze testData: ${error.message}`);
    }
  }
  
  /**
   * Read and parse testData JSON file
   * 
   * @param {string} testDataPath - Path to JSON file
   * @returns {Object} Parsed testData
   */
  async readTestData(testDataPath) {
    // Check if file exists
    const exists = await fs.pathExists(testDataPath);
    if (!exists) {
      throw new Error(`TestData file not found: ${testDataPath}`);
    }
    
    // Read file
    const content = await fs.readFile(testDataPath, 'utf-8');
    
    // Parse JSON
    try {
      const data = JSON.parse(content);
      return data;
    } catch (error) {
      throw new Error(`Invalid JSON in testData file: ${error.message}`);
    }
  }
  
  /**
   * Extract meaningful keywords from state name
   * 
   * Examples:
   *   "agency_selected" → ["agency", "selected"]
   *   "search_results" → ["search", "results"]
   *   "flight_selected" → ["flight", "selected"]
   * 
   * @param {string} stateName - Name of state
   * @returns {string[]} Array of keywords
   */
  extractKeywords(stateName) {
    return stateName
      .split('_')                    // Split on underscore
      .map(k => k.toLowerCase())     // Lowercase
      .filter(k => k.length > 2)     // Ignore short words (is, or, etc)
      .filter(k => !this.isCommonWord(k));  // Filter common words
  }
  
  /**
   * Check if word is too common to be useful
   * 
   * @param {string} word - Word to check
   * @returns {boolean} True if common word
   */
  isCommonWord(word) {
    const commonWords = ['the', 'and', 'for', 'with', 'from', 'has', 'was', 'are'];
    return commonWords.includes(word.toLowerCase());
  }
  
  /**
   * Match testData fields to state name keywords
   * 
   * Categorizes fields as:
   * - exact: Field name contains keyword (high relevance)
   * - required: Always needed (status, config)
   * - available: Other fields in testData
   * 
   * @param {Object} testData - Parsed testData object
   * @param {string[]} keywords - Keywords from state name
   * @returns {Object} Categorized matches
   */
  matchFields(testData, keywords) {
    const matches = {
      exact: [],      // Fields matching state name keywords
      required: [],   // Always needed fields
      available: []   // Other available fields
    };
    
    for (const [fieldName, value] of Object.entries(testData)) {
      // Skip internal fields (starting with _)
      if (fieldName.startsWith('_')) {
        continue;
      }
      
      const fieldLower = fieldName.toLowerCase();
      
      // Check if required field (status, config)
      if (this.isRequiredField(fieldName)) {
        matches.required.push({
          field: fieldName,
          value: value,
          reason: 'Required for state tracking',
          confidence: 100
        });
        continue;
      }
      
      // Check for exact keyword match
      const matchingKeyword = this.findMatchingKeyword(fieldLower, keywords);
      if (matchingKeyword) {
        matches.exact.push({
          field: fieldName,
          value: value,
          reason: `Matches keyword "${matchingKeyword}"`,
          keyword: matchingKeyword,
          confidence: 80
        });
        continue;
      }
      
      // Otherwise, it's just available
      matches.available.push({
        field: fieldName,
        value: value,
        reason: 'Available in testData',
        confidence: 30
      });
    }
    
    return matches;
  }
  
  /**
   * Check if field is required (always needed)
   * 
   * @param {string} fieldName - Field name to check
   * @returns {boolean} True if required
   */
  isRequiredField(fieldName) {
    const requiredFields = ['status', 'config', '_config'];
    return requiredFields.includes(fieldName.toLowerCase());
  }
  
  /**
   * Find which keyword (if any) matches the field name
   * 
   * @param {string} fieldLower - Lowercase field name
   * @param {string[]} keywords - Keywords to check
   * @returns {string|null} Matching keyword or null
   */
  findMatchingKeyword(fieldLower, keywords) {
    for (const keyword of keywords) {
      // Check if field contains keyword
      if (fieldLower.includes(keyword)) {
        return keyword;
      }
      
      // Check if keyword contains field (for shorter field names)
      if (keyword.includes(fieldLower) && fieldLower.length > 3) {
        return keyword;
      }
    }
    
    return null;
  }
  
  /**
   * Get suggested fields sorted by confidence
   * 
   * @param {Object} matches - Matches from matchFields()
   * @returns {Array} All suggestions sorted by confidence
   */
  getAllSuggestions(matches) {
    const all = [
      ...matches.exact,
      ...matches.required,
      ...matches.available
    ];
    
    // Sort by confidence (high to low)
    return all.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Get only high-confidence suggestions
   * 
   * @param {Object} matches - Matches from matchFields()
   * @param {number} threshold - Minimum confidence (default 70)
   * @returns {Array} High-confidence suggestions
   */
  getHighConfidenceSuggestions(matches, threshold = 70) {
    const all = this.getAllSuggestions(matches);
    return all.filter(s => s.confidence >= threshold);
  }
}

export default TestDataAnalyzer;