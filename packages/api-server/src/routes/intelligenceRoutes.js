/**
 * Intelligence API Routes
 * 
 * Provides REST endpoints for searching and analyzing implications.
 * 
 * Endpoints:
 *   GET  /api/intelligence/search          - Full-text search
 *   GET  /api/intelligence/conditions      - Find by field/condition
 *   GET  /api/intelligence/ticket/:id      - Lookup by ticket number
 *   GET  /api/intelligence/event/:name     - Find transitions by event
 *   GET  /api/intelligence/state/:status   - Get state details
 *   GET  /api/intelligence/chain/:status   - Get prerequisite chain
 *   POST /api/intelligence/rebuild         - Force rebuild index
 *   GET  /api/intelligence/stats           - Get index statistics
 * 
 * @module intelligenceRoutes
 */

import express from 'express';
import * as intelligence from '../services/intelligenceService.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/intelligence/search
 * 
 * Full-text search across states, transitions, and validations.
 * 
 * Query params:
 *   q: string            - Search query (required)
 *   projectPath: string  - Path to project (required)
 *   types: string        - Comma-separated types (default: "states,transitions,validations")
 *   limit: number        - Max results (default: 20)
 *   enrichChains: bool   - Include chain info (default: false)
 *   testDataPath: string - Path to test data (for chain enrichment)
 * 
 * Response:
 *   { results: SearchResult[], query: string, totalResults: number, searchTime: number }
 */
router.get('/search', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      q, 
      projectPath, 
      types = 'states,transitions,validations',
      limit = 20,
      enrichChains = false,
      testDataPath
    } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Query parameter "projectPath" is required' });
    }
    
    // Get or build index
    const index = await intelligence.getIndex(projectPath);
    
    // Parse types
    const typeArray = types.split(',').map(t => t.trim());
    
    // Search
    let results = intelligence.searchIndex(index, q, {
      types: typeArray,
      limit: parseInt(limit, 10)
    });
    
    // Optionally enrich with chain info
    if (enrichChains === 'true' || enrichChains === true) {
      results = await intelligence.enrichWithChains(results, projectPath, testDataPath);
    }
    
    const searchTime = Date.now() - startTime;
    
    res.json({
      results,
      query: q,
      totalResults: results.length,
      searchTime,
      types: typeArray
    });
    
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/intelligence/conditions
 * 
 * Find all conditions that reference a specific field.
 * 
 * Query params:
 *   field: string       - Field pattern to match (required)
 *   projectPath: string - Path to project (required)
 * 
 * Response:
 *   { results: ConditionDocument[], field: string, count: number }
 */
router.get('/conditions', async (req, res) => {
  try {
    const { field, projectPath } = req.query;
    
    if (!field) {
      return res.status(400).json({ error: 'Query parameter "field" is required' });
    }
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Query parameter "projectPath" is required' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    const results = intelligence.findByCondition(index, field);
    
    // Group by state for better organization
    const byState = {};
    for (const r of results) {
      const state = r.metadata.state;
      if (!byState[state]) {
        byState[state] = [];
      }
      byState[state].push(r);
    }
    
    res.json({
      results,
      byState,
      field,
      count: results.length
    });
    
  } catch (error) {
    console.error('❌ Conditions search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intelligence/ticket/:id
 * 
 * Look up validations by ticket number.
 * 
 * Params:
 *   id: string - Ticket ID (e.g., "SC-13092")
 * 
 * Query params:
 *   projectPath: string - Path to project (required)
 * 
 * Response:
 *   { ticket: string, results: ValidationDocument[], count: number }
 */
router.get('/ticket/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Query parameter "projectPath" is required' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    const results = intelligence.findByTicket(index, id);
    
    res.json({
      ticket: id.toUpperCase(),
      results,
      count: results.length,
      found: results.length > 0
    });
    
  } catch (error) {
    console.error('❌ Ticket lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intelligence/event/:name
 * 
 * Find all transitions for a given event.
 * 
 * Params:
 *   name: string - Event name (e.g., "ACCEPT_BOOKING")
 * 
 * Query params:
 *   projectPath: string - Path to project (required)
 * 
 * Response:
 *   { event: string, results: TransitionDocument[], count: number }
 */
router.get('/event/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Query parameter "projectPath" is required' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    const results = intelligence.findByEvent(index, name);
    
    res.json({
      event: name.toUpperCase(),
      results,
      count: results.length
    });
    
  } catch (error) {
    console.error('❌ Event lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intelligence/state/:status
 * 
 * Get detailed information about a state.
 * 
 * Params:
 *   status: string - State status (e.g., "booking_accepted")
 * 
 * Query params:
 *   projectPath: string - Path to project (required)
 * 
 * Response:
 *   { state: StateDocument, outgoingTransitions, incomingTransitions, validations, conditions }
 */
router.get('/state/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Query parameter "projectPath" is required' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    const details = intelligence.getStateDetails(index, status);
    
    if (!details) {
      return res.status(404).json({ 
        error: `State "${status}" not found`,
        suggestion: 'Try searching for a similar state name'
      });
    }
    
    res.json(details);
    
  } catch (error) {
    console.error('❌ State details error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intelligence/chain/:status
 * 
 * Get the prerequisite chain for reaching a state.
 * 
 * Params:
 *   status: string - Target state status
 * 
 * Query params:
 *   projectPath: string  - Path to project (required)
 *   testDataPath: string - Path to test data file (optional)
 * 
 * Response:
 *   { status, ready, steps, segments, currentStatus, needsExecution }
 */
router.get('/chain/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { projectPath, testDataPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Query parameter "projectPath" is required' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    
    // Load test data if provided
    let testData = {};
    if (testDataPath) {
      try {
        const fs = await import('fs-extra');
        testData = fs.default.readJsonSync(testDataPath);
      } catch (e) {
        console.log('⚠️ Could not load test data:', e.message);
      }
    }
    
    const chain = await intelligence.getChainForState(index, status, projectPath, testData);
    
    res.json(chain);
    
  } catch (error) {
    console.error('❌ Chain lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MANAGEMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/intelligence/rebuild
 * 
 * Force rebuild the search index.
 * 
 * Body:
 *   { projectPath: string }
 * 
 * Response:
 *   { success: boolean, counts: {...}, buildTime: string }
 */
router.post('/rebuild', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Body parameter "projectPath" is required' });
    }
    
    console.log('🔄 Rebuilding intelligence index for:', projectPath);
    
    const index = await intelligence.rebuildIndex(projectPath);
    
    res.json({
      success: true,
      buildTime: index.buildTime.toISOString(),
      counts: index.counts,
      ticketsIndexed: index.byTicket.size,
      fieldsIndexed: index.byField.size,
      eventsIndexed: index.byEvent.size
    });
    
  } catch (error) {
    console.error('❌ Rebuild error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intelligence/stats
 * 
 * Get index statistics.
 * 
 * Query params:
 *   projectPath: string - Path to project (required)
 * 
 * Response:
 *   { counts, ticketsIndexed, fieldsIndexed, eventsIndexed, buildTime }
 */
router.get('/stats', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Query parameter "projectPath" is required' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    
    res.json({
      counts: index.counts,
      ticketsIndexed: index.byTicket.size,
      fieldsIndexed: index.byField.size,
      eventsIndexed: index.byEvent.size,
      invertedIndexTerms: index.invertedIndex.size,
      chainsCached: index.chainCache.size,
      buildTime: index.buildTime.toISOString(),
      projectPath: index.projectPath
    });
    
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/intelligence/invalidate
 * 
 * Invalidate the cache (useful after editing implications).
 * 
 * Response:
 *   { success: true, message: string }
 */
router.post('/invalidate', async (req, res) => {
  try {
    intelligence.invalidateCache();
    
    res.json({
      success: true,
      message: 'Intelligence cache invalidated. Next search will rebuild index.'
    });
    
  } catch (error) {
    console.error('❌ Invalidate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUGGESTIONS & AUTOCOMPLETE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/intelligence/suggest
 * 
 * Get autocomplete suggestions for a partial query.
 * 
 * Query params:
 *   q: string           - Partial query (required)
 *   projectPath: string - Path to project (required)
 *   limit: number       - Max suggestions (default: 10)
 * 
 * Response:
 *   { suggestions: string[], query: string }
 */
router.get('/suggest', async (req, res) => {
  try {
    const { q, projectPath, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ suggestions: [], query: q || '' });
    }
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Query parameter "projectPath" is required' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    const queryLower = q.toLowerCase();
    
    const suggestions = new Set();
    
    // Suggest state names
    for (const state of index.states) {
      if (state.metadata.status?.toLowerCase().includes(queryLower)) {
        suggestions.add(state.metadata.status);
      }
      if (state.metadata.statusLabel?.toLowerCase().includes(queryLower)) {
        suggestions.add(state.metadata.statusLabel);
      }
    }
    
    // Suggest event names
    for (const [event] of index.byEvent) {
      if (event.toLowerCase().includes(queryLower)) {
        suggestions.add(event);
      }
    }
    
    // Suggest field names
    for (const [field] of index.byField) {
      if (field.toLowerCase().includes(queryLower)) {
        suggestions.add(field);
      }
    }
    
    // Suggest ticket numbers
    for (const [ticket] of index.byTicket) {
      if (ticket.toLowerCase().includes(queryLower)) {
        suggestions.add(ticket);
      }
    }
    
    res.json({
      suggestions: Array.from(suggestions).slice(0, parseInt(limit, 10)),
      query: q
    });
    
  } catch (error) {
    console.error('❌ Suggest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// IMPACT ANALYSIS (Preview Feature)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/intelligence/impact/:status
 * 
 * Find what would be affected if a state changes.
 * 
 * Params:
 *   status: string - State to analyze
 * 
 * Query params:
 *   projectPath: string - Path to project (required)
 * 
 * Response:
 *   { state, dependentStates, affectedTransitions, affectedValidations }
 */
router.get('/impact/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Query parameter "projectPath" is required' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    
    // Find states that depend on this state (have it in their chain)
    const dependentStates = [];
    for (const transition of index.transitions) {
      if (transition.metadata.from === status) {
        const targetState = index.byState.get(transition.metadata.to);
        if (targetState) {
          dependentStates.push({
            status: transition.metadata.to,
            via: transition.metadata.event,
            state: targetState
          });
        }
      }
    }
    
    // Find transitions that reference this state
    const affectedTransitions = index.transitions.filter(
      t => t.metadata.from === status || t.metadata.to === status
    );
    
    // Find validations for this state
    const affectedValidations = index.validations.filter(
      v => v.metadata.state === status
    );
    
    res.json({
      status,
      state: index.byState.get(status),
      dependentStates,
      affectedTransitions,
      affectedValidations,
      impactSummary: {
        statesAffected: dependentStates.length,
        transitionsAffected: affectedTransitions.length,
        validationsAffected: affectedValidations.length
      }
    });
    
  } catch (error) {
    console.error('❌ Impact analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/debug', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath required' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    
    res.json({
      counts: index.counts,
      sampleStates: index.states.slice(0, 3),
      sampleTransitions: index.transitions.slice(0, 3),
      sampleValidations: index.validations.slice(0, 3),
      sampleConditions: index.conditions.slice(0, 3),
      allFields: Array.from(index.byField.keys()),
      allTickets: Array.from(index.byTicket.keys()),
      allEvents: Array.from(index.byEvent.keys()),
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;