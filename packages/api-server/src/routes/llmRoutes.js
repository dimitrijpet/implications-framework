/**
 * LLM API Routes
 * 
 * Optional endpoints for natural language features.
 * These require LLM configuration (DeepSeek, Ollama, etc.)
 * 
 * Endpoints:
 *   POST /api/llm/explain           - Explain flow in natural language
 *   POST /api/llm/parse-backend     - Parse backend test code
 *   POST /api/llm/analyze-ticket    - Analyze ticket/specification
 *   POST /api/llm/suggest-tests     - Suggest missing tests
 *   GET  /api/llm/status            - Check LLM availability
 * 
 * @module llmRoutes
 */

import express from 'express';
import * as llm from '../services/llmservice.js';
import * as intelligence from '../services/intelligenceService.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// STATUS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/llm/status
 * 
 * Check if LLM is available and get configuration.
 * 
 * Response:
 *   { enabled: boolean, config: {...} }
 */
router.get('/status', async (req, res) => {
  res.json({
    enabled: llm.isLLMEnabled(),
    config: llm.getLLMConfig()
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPLANATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/llm/explain
 * 
 * Explain a flow or query in natural language.
 * 
 * Body:
 *   {
 *     query: string           - User's question
 *     projectPath: string     - Path to project
 *     testDataPath?: string   - Optional path to test data
 *   }
 * 
 * Response:
 *   { explanation: string, sources: SearchResult[], model: string }
 */
router.post('/explain', async (req, res) => {
  try {
    const { query, projectPath, testDataPath } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Body parameter "query" is required' });
    }
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Body parameter "projectPath" is required' });
    }
    
    if (!llm.isLLMEnabled()) {
      return res.status(503).json({ 
        error: 'LLM is not enabled',
        message: 'Set DEEPSEEK_API_KEY or configure Ollama to enable LLM features'
      });
    }
    
    // First, search for relevant context
    const index = await intelligence.getIndex(projectPath);
    let searchResults = intelligence.searchIndex(index, query, {
      types: ['states', 'transitions', 'validations'],
      limit: 10
    });
    
    // Enrich with chain info
    searchResults = await intelligence.enrichWithChains(
      searchResults, 
      projectPath, 
      testDataPath
    );
    
    // Get explanation from LLM
    const explanation = await llm.explainFlow(query, searchResults);
    
    res.json({
      explanation,
      sources: searchResults.slice(0, 5).map(r => ({
        id: r.id,
        type: r.type,
        text: r.text.substring(0, 100),
        score: r.score
      })),
      model: llm.getLLMConfig().model
    });
    
  } catch (error) {
    console.error('❌ LLM explain error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/llm/explain-state
 * 
 * Explain a specific state and its chain in natural language.
 * 
 * Body:
 *   {
 *     status: string         - State status
 *     projectPath: string    - Path to project
 *     testDataPath?: string  - Optional path to test data
 *   }
 */
router.post('/explain-state', async (req, res) => {
  try {
    const { status, projectPath, testDataPath } = req.body;
    
    if (!status || !projectPath) {
      return res.status(400).json({ 
        error: 'Body parameters "status" and "projectPath" are required' 
      });
    }
    
    if (!llm.isLLMEnabled()) {
      return res.status(503).json({ error: 'LLM is not enabled' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    const stateDetails = intelligence.getStateDetails(index, status);
    
    if (!stateDetails) {
      return res.status(404).json({ error: `State "${status}" not found` });
    }
    
    // Get chain info
    let testData = {};
    if (testDataPath) {
      try {
        const fs = await import('fs-extra');
        testData = fs.default.readJsonSync(testDataPath);
      } catch (e) {}
    }
    
    const chainInfo = await intelligence.getChainForState(
      index, status, projectPath, testData
    );
    
    // Create context for LLM
    const searchResults = [
      stateDetails,
      ...stateDetails.outgoingTransitions.slice(0, 3),
      ...stateDetails.validations.slice(0, 5)
    ];
    
    const explanation = await llm.explainFlow(
      `Explain the ${stateDetails.metadata.statusLabel} state`,
      searchResults,
      chainInfo
    );
    
    res.json({
      explanation,
      state: stateDetails,
      chain: chainInfo,
      model: llm.getLLMConfig().model
    });
    
  } catch (error) {
    console.error('❌ LLM explain-state error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BACKEND TEST PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/llm/parse-backend
 * 
 * Parse backend test code and find matching implications.
 * 
 * Body:
 *   {
 *     testCode: string      - Backend test code (RSpec, Jest, etc.)
 *     language: string      - Language ('ruby', 'javascript', etc.)
 *     projectPath: string   - Path to project
 *   }
 * 
 * Response:
 *   { parsed: {...}, matches: [...], confidence: string }
 */
router.post('/parse-backend', async (req, res) => {
  try {
    const { testCode, language = 'ruby', projectPath } = req.body;
    
    if (!testCode) {
      return res.status(400).json({ error: 'Body parameter "testCode" is required' });
    }
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Body parameter "projectPath" is required' });
    }
    
    if (!llm.isLLMEnabled()) {
      return res.status(503).json({ error: 'LLM is not enabled' });
    }
    
    // Parse the backend test
    const parsed = await llm.parseBackendTest(testCode, language);
    
    if (!parsed) {
      return res.status(500).json({ error: 'Failed to parse test code' });
    }
    
    // Map to implications
    const index = await intelligence.getIndex(projectPath);
    const mapping = llm.mapBackendTestToImplications(
      parsed, 
      index, 
      intelligence.searchIndex
    );
    
    res.json({
      parsed,
      matches: mapping.matches,
      confidence: mapping.confidence,
      searchTermsUsed: mapping.searchTermsUsed,
      model: llm.getLLMConfig().model
    });
    
  } catch (error) {
    console.error('❌ LLM parse-backend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TICKET ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/llm/analyze-ticket
 * 
 * Analyze a ticket or specification and extract test requirements.
 * 
 * Body:
 *   {
 *     ticketText: string    - Ticket description or specification
 *     projectPath: string   - Path to project (for finding existing tests)
 *   }
 * 
 * Response:
 *   { analysis: {...}, existingTests: [...], gaps: [...] }
 */
router.post('/analyze-ticket', async (req, res) => {
  try {
    const { ticketText, projectPath } = req.body;
    
    if (!ticketText) {
      return res.status(400).json({ error: 'Body parameter "ticketText" is required' });
    }
    
    if (!llm.isLLMEnabled()) {
      return res.status(503).json({ error: 'LLM is not enabled' });
    }
    
    // Analyze the ticket
    const analysis = await llm.analyzeTicket(ticketText);
    
    if (!analysis) {
      return res.status(500).json({ error: 'Failed to analyze ticket' });
    }
    
    // Find existing tests if projectPath provided
    let existingTests = [];
    if (projectPath && analysis.searchTerms?.length) {
      const index = await intelligence.getIndex(projectPath);
      
      for (const term of analysis.searchTerms) {
        const results = intelligence.searchIndex(index, term, { limit: 5 });
        existingTests.push(...results);
      }
      
      // Dedupe
      const seen = new Set();
      existingTests = existingTests.filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
    }
    
    // Calculate gaps
    const gaps = [];
    if (analysis.actions?.length) {
      for (const action of analysis.actions) {
        const hasTest = existingTests.some(t => 
          t.text.toLowerCase().includes(action.toLowerCase())
        );
        if (!hasTest) {
          gaps.push({ action, covered: false });
        }
      }
    }
    
    res.json({
      analysis,
      existingTests: existingTests.slice(0, 10),
      gaps,
      model: llm.getLLMConfig().model
    });
    
  } catch (error) {
    console.error('❌ LLM analyze-ticket error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/llm/suggest-tests
 * 
 * Suggest missing tests for a state.
 * 
 * Body:
 *   {
 *     status: string       - State to analyze
 *     projectPath: string  - Path to project
 *   }
 * 
 * Response:
 *   { suggestions: {...}, stateDetails: {...} }
 */
router.post('/suggest-tests', async (req, res) => {
  try {
    const { status, projectPath } = req.body;
    
    if (!status || !projectPath) {
      return res.status(400).json({ 
        error: 'Body parameters "status" and "projectPath" are required' 
      });
    }
    
    if (!llm.isLLMEnabled()) {
      return res.status(503).json({ error: 'LLM is not enabled' });
    }
    
    const index = await intelligence.getIndex(projectPath);
    const stateDetails = intelligence.getStateDetails(index, status);
    
    if (!stateDetails) {
      return res.status(404).json({ error: `State "${status}" not found` });
    }
    
    const suggestions = await llm.suggestMissingTests(stateDetails);
    
    res.json({
      suggestions,
      stateDetails: {
        id: stateDetails.id,
        type: stateDetails.type,
        metadata: stateDetails.metadata,
        transitionCount: stateDetails.outgoingTransitions.length,
        validationCount: stateDetails.validations.length,
        conditionCount: stateDetails.conditions.length
      },
      model: llm.getLLMConfig().model
    });
    
  } catch (error) {
    console.error('❌ LLM suggest-tests error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;