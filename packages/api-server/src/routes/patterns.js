// packages/api-server/src/routes/patterns.js

import express from 'express';
import { PatternAnalyzer } from '../services/patternAnalyzer.js';

const router = express.Router();

/**
 * GET /api/patterns/analyze
 * Analyze patterns from last scanned project
 */
router.get('/analyze', async (req, res) => {
  try {
    console.log('🔍 Pattern analysis requested');
    
    // Get cached discovery result
    const discoveryResult = req.app.get('lastDiscoveryResult');
    
    if (!discoveryResult) {
      return res.status(400).json({ 
        error: 'No project scanned yet',
        hint: 'Scan a project first using /api/discovery/scan'
      });
    }

    // Analyze patterns
    const analysis = PatternAnalyzer.analyze(discoveryResult);
    
    // Cache the analysis
    req.app.set('lastPatternAnalysis', analysis);
    
    console.log('✅ Pattern analysis complete:', {
      states: analysis.totalStates,
      buttons: analysis.buttons?.mostCommon ? Object.keys(analysis.buttons.mostCommon).length : 0,
      fields: analysis.fields?.totalUnique || 0
    });
    
    res.json({
      success: true,
      analysis
    });
    
  } catch (error) {
    console.error('❌ Pattern analysis error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/patterns/suggest
 * Get context-aware suggestions for current input
 */
router.post('/suggest', async (req, res) => {
  try {
    const { stateName, platform, currentFields } = req.body;
    
    console.log('💡 Suggestions requested for:', stateName);
    
    // Get cached analysis
    let analysis = req.app.get('lastPatternAnalysis');
    
    // If no cached analysis, generate it
    if (!analysis) {
      const discoveryResult = req.app.get('lastDiscoveryResult');
      if (!discoveryResult) {
        return res.status(400).json({ 
          error: 'No project scanned yet' 
        });
      }
      analysis = PatternAnalyzer.analyze(discoveryResult);
      req.app.set('lastPatternAnalysis', analysis);
    }
    
    // Generate suggestions
    const suggestions = PatternAnalyzer.generateSuggestions(analysis, {
      stateName,
      platform,
      currentFields
    });
    
    console.log('✅ Suggestions generated:', {
      buttons: suggestions.triggerButton?.length || 0,
      fields: suggestions.requiredFields?.length || 0,
      setup: suggestions.setupActions?.length || 0
    });
    
    res.json({
      success: true,
      suggestions
    });
    
  } catch (error) {
    console.error('❌ Suggestion error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

/**
 * GET /api/patterns/stats
 * Get quick statistics about patterns
 */
router.get('/stats', async (req, res) => {
  try {
    const analysis = req.app.get('lastPatternAnalysis');
    
    if (!analysis) {
      return res.status(404).json({ 
        error: 'No analysis available',
        hint: 'Run /api/patterns/analyze first'
      });
    }
    
    // Generate quick stats
    const stats = {
      totalStates: analysis.totalStates,
      buttonConvention: analysis.buttons?.convention?.pattern || 'Unknown',
      buttonConfidence: analysis.buttons?.convention?.confidence || 0,
      mostCommonFields: analysis.fields?.mostCommon?.slice(0, 5).map(f => f.field) || [],
      mostCommonSetup: analysis.setup?.mostCommon?.slice(0, 3).map(s => s.action) || [],
      platformDistribution: analysis.platforms?.distribution || []
    };
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;