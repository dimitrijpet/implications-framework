// packages/api-server/src/services/IntelligenceCombiner.js
// Combines Phase 1 (testData) + Phase 2&3 (UI) for super-intelligent suggestions

import TestDataAnalyzer from './TestDataAnalyzer.js';
import { UIVariableExtractor } from './UIVariableExtractor.js';

/**
 * IntelligenceCombiner
 * 
 * Combines multiple intelligence sources to provide the best field suggestions:
 * - Phase 1: TestData keyword matching (baseline confidence)
 * - Phase 2&3: UI variable usage (confidence boost)
 * 
 * Result: High-confidence suggestions that are actually needed!
 */
export class IntelligenceCombiner {
  
  constructor() {
    this.testDataAnalyzer = new TestDataAnalyzer();
    this.uiExtractor = new UIVariableExtractor();
  }
  
  /**
   * Analyze with all intelligence sources
   * 
   * @param {string} testDataPath - Path to testData file
   * @param {string} stateName - State name for keyword matching
   * @param {string} implicationPath - Path to implication file
   * @param {string} projectPath - Project root path
   * @returns {Promise<Object>} - Combined analysis with boosted confidence
   */
  async analyze(testDataPath, stateName, implicationPath, projectPath) {
    console.log('\n🧠 IntelligenceCombiner: Starting combined analysis');
    console.log('  📊 Phase 1: TestData analysis');
    console.log('  🎨 Phase 2&3: UI variable extraction');
    
    try {
      // Phase 1: TestData analysis (keyword matching)
      const testDataAnalysis = await this.testDataAnalyzer.analyze(
        testDataPath,
        stateName,
        projectPath
      );
      
      // Get suggestions
      const allSuggestions = this.testDataAnalyzer.getAllSuggestions(testDataAnalysis.suggestions);
      const highConfidence = this.testDataAnalyzer.getHighConfidenceSuggestions(testDataAnalysis.suggestions);
      
      console.log('✅ Phase 1 complete:', {
        fields: Object.keys(testDataAnalysis.testData).length,
        highConfidence: highConfidence.length
      });
      
      // Phase 2&3: UI variable extraction
      const uiResult = await this.uiExtractor.extract(implicationPath);
      const uiSuggestions = this.uiExtractor.getSuggestions(uiResult);
      
      console.log('✅ Phase 2&3 complete:', {
        uiVariables: uiResult.allVariables.size,
        highConfidence: uiSuggestions.filter(s => s.confidence >= 85).length
      });
      
      // Combine results
      const combined = this.combineResults(
        allSuggestions,
        uiSuggestions,
        testDataAnalysis.testData
      );
      
      console.log('✅ Combined analysis complete:', {
        totalSuggestions: combined.allSuggestions.length,
        boostedFields: combined.boostedFields.length,
        superHighConfidence: combined.allSuggestions.filter(s => s.confidence >= 95).length
      });
      
      return {
        success: true,
        analysis: {
          stateName,
          keywords: testDataAnalysis.keywords,
          suggestions: combined.suggestions,
          allSuggestions: combined.allSuggestions,
          testData: testDataAnalysis.testData,
          uiVariables: Array.from(uiResult.allVariables),
          boostedFields: combined.boostedFields
        },
        meta: {
          totalFields: Object.keys(testDataAnalysis.testData).length,
          uiVariables: uiResult.allVariables.size,
          exactMatches: combined.exactMatches,
          boostedMatches: combined.boostedFields.length,
          requiredFields: combined.requiredFields,
          availableFields: combined.availableFields,
          highConfidenceCount: combined.allSuggestions.filter(s => s.confidence >= 70).length,
          superHighConfidenceCount: combined.allSuggestions.filter(s => s.confidence >= 95).length
        },
        intelligence: {
          phase1: 'TestData keyword matching',
          phase2_3: 'UI variable extraction',
          combined: 'Confidence boosting applied'
        }
      };
      
    } catch (error) {
      console.error('❌ IntelligenceCombiner error:', error);
      throw error;
    }
  }
  
  /**
   * Combine testData suggestions with UI suggestions
   * Apply confidence boosts for fields found in both sources
   */
  combineResults(testDataSuggestions, uiSuggestions, testData) {
    console.log('\n🔗 Combining suggestions...');
    
    // Create map of UI variables for quick lookup
    const uiVarMap = new Map();
    uiSuggestions.forEach(s => {
      uiVarMap.set(s.field, s);
    });
    
    // Start with testData suggestions
    const combined = new Map();
    const boostedFields = [];
    
    testDataSuggestions.forEach(suggestion => {
      const fieldName = suggestion.field;
      let confidence = suggestion.confidence;
      let reason = suggestion.reason;
      const sources = ['testData'];
      
      // Check if field is also in UI
      if (uiVarMap.has(fieldName)) {
        const uiVar = uiVarMap.get(fieldName);
        
        // BOOST confidence!
        const boost = Math.min(40, uiVar.confidence / 2);
        confidence = Math.min(100, confidence + boost);
        
        // Combine reasons
        reason = `${reason}; ${uiVar.reason}`;
        sources.push('ui-analysis');
        
        boostedFields.push({
          field: fieldName,
          originalConfidence: suggestion.confidence,
          boostedConfidence: confidence,
          boost,
          reason
        });
        
        console.log(`  ⬆️ Boosted "${fieldName}": ${suggestion.confidence}% → ${confidence}% (+${boost}%)`);
      }
      
      combined.set(fieldName, {
        field: fieldName,
        value: suggestion.value,
        confidence: Math.round(confidence),
        reason,
        sources
      });
    });
    
    // Add UI-only suggestions (not in testData)
    uiSuggestions.forEach(suggestion => {
      const fieldName = suggestion.field;
      
      if (!combined.has(fieldName)) {
        // Check if field exists in testData
        const value = testData[fieldName] || null;
        
        combined.set(fieldName, {
          field: fieldName,
          value,
          confidence: suggestion.confidence,
          reason: `${suggestion.reason}${value ? '; Available in testData' : ''}`,
          sources: ['ui-analysis']
        });
        
        console.log(`  ➕ Added UI-only "${fieldName}": ${suggestion.confidence}%`);
      }
    });
    
    // Convert to array and sort
    const allSuggestions = Array.from(combined.values())
      .sort((a, b) => b.confidence - a.confidence);
    
    // Categorize
    const exactMatches = allSuggestions.filter(s => 
      s.confidence >= 80 && s.sources.includes('testData')
    ).length;
    
    const requiredFields = allSuggestions.filter(s => 
      s.reason && s.reason.includes('Required')
    ).length;
    
    const availableFields = allSuggestions.filter(s => 
      s.confidence < 70
    ).length;
    
    // Create categorized suggestions
    const suggestions = {
      exact: allSuggestions.filter(s => s.confidence >= 80 && s.sources.includes('testData')),
      required: allSuggestions.filter(s => s.reason && s.reason.includes('Required')),
      available: allSuggestions.filter(s => s.confidence < 70),
      uiRequired: allSuggestions.filter(s => s.sources.includes('ui-analysis') && s.confidence >= 85)
    };
    
    return {
      allSuggestions,
      suggestions,
      boostedFields,
      exactMatches,
      requiredFields,
      availableFields
    };
  }
}

export default IntelligenceCombiner;