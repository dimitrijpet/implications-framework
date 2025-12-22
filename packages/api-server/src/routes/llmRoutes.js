/**
 * LLM Routes - AI-powered analysis endpoints
 * 
 * Provides:
 * - Ticket analysis and test recommendations
 * - Natural language explanations
 * - Backend test parsing
 */

import express from 'express';
import { getIndex, searchIndex } from '../services/intelligenceService.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// LLM CLIENT - reads env on each request to pick up changes
// ═══════════════════════════════════════════════════════════════════════════

function getLLMConfig() {
  return {
    baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.LLM_MODEL || 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
    maxTokens: 2000,
    temperature: 0.3
  };
}

async function callLLM(messages, options = {}) {
  const config = getLLMConfig();
  const maxTokens = options.maxTokens || config.maxTokens;
  const temperature = options.temperature || config.temperature;
  
  if (!config.apiKey) {
    throw new Error('No API key configured. Set DEEPSEEK_API_KEY or OPENAI_API_KEY in .env');
  }

  const url = config.baseUrl + '/chat/completions';
  
  console.log('🤖 Calling LLM:', config.model, 'at', config.baseUrl);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.apiKey
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('LLM API error: ' + response.status + ' - ' + error);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/llm/status
 * Check if LLM is available
 */
router.get('/status', (req, res) => {
  const config = getLLMConfig();
  const available = config.apiKey && config.apiKey.length > 0;
  
  let provider = 'unknown';
  if (config.baseUrl.includes('deepseek')) provider = 'deepseek';
  else if (config.baseUrl.includes('openai')) provider = 'openai';
  else if (config.baseUrl.includes('localhost')) provider = 'ollama';
  
  // Debug: log what we found
  console.log('🔍 LLM Status Check:');
  console.log('   baseUrl:', config.baseUrl);
  console.log('   model:', config.model);
  console.log('   apiKey present:', available);
  console.log('   apiKey length:', config.apiKey?.length || 0);
  
  res.json({
    available,
    model: config.model,
    provider,
    baseUrl: config.baseUrl,
    debug: {
      envKeySet: !!process.env.DEEPSEEK_API_KEY,
      keyLength: config.apiKey?.length || 0
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TICKET ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

const TICKET_ANALYZER_SYSTEM_PROMPT = `You are a test automation analyst. Your job is to analyze tickets/requirements and identify what tests are needed.

Given a ticket description, extract:
1. The main feature being described
2. Actors/platforms involved (dancer, manager, web, mobile, API)
3. Preconditions (what state must exist before)
4. Actions (what the user does)
5. Expected results (what should happen)
6. Search terms to find related existing tests

Return your analysis as JSON:
{
  "feature": "Brief description of the feature",
  "actors": ["dancer", "manager"],
  "preconditions": ["booking must be accepted", "user must be logged in"],
  "actions": ["dancer cancels booking", "manager views notifications"],
  "expectedResults": ["notification appears", "booking removed from list", "status changes to cancelled"],
  "searchTerms": ["cancel", "booking", "notification", "accepted"],
  "suggestsNewState": null,
  "suggestedStates": []
}

Be thorough in extracting expected results - each testable outcome should be listed.
Search terms should include key nouns and verbs that would appear in existing test names.`;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'has',
  'been', 'were', 'being', 'will', 'would', 'could', 'should', 'must',
  'when', 'where', 'which', 'what', 'who', 'how', 'why', 'then', 'than',
  'into', 'onto', 'upon', 'also', 'just', 'only', 'some', 'such', 'each',
  'their', 'they', 'them', 'there', 'these', 'those', 'your', 'about'
]);

function extractKeywords(text) {
  if (!text) return [];
  
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !STOP_WORDS.has(w));
  
  return [...new Set(words)].slice(0, 10);
}

function buildTicketParsePrompt(ticketText, index) {
  let prompt = 'Analyze this ticket:\n\n' + ticketText + '\n\n';
  
  if (index) {
    const stateNames = index.states
      .filter(s => s.type === 'state')
      .map(s => s.metadata?.status)
      .filter(Boolean)
      .slice(0, 30);
    
    if (stateNames.length > 0) {
      prompt += '\nExisting states in the test suite: ' + stateNames.join(', ') + '\n';
    }
    
    const transitionNames = index.transitions
      .map(t => t.metadata?.event)
      .filter(Boolean)
      .slice(0, 20);
    
    if (transitionNames.length > 0) {
      prompt += '\nExisting transitions: ' + [...new Set(transitionNames)].join(', ') + '\n';
    }
  }
  
  prompt += '\nReturn your analysis as JSON only, no other text.';
  
  return prompt;
}

function findTargetFile(parsed, existingCoverage) {
  const relevantCoverage = existingCoverage.find(e => e.type === 'state' || e.type === 'validation');
  if (relevantCoverage?.id) {
    const baseName = relevantCoverage.id.split('.')[0];
    return 'tests/implications/.../' + baseName + 'Implications.js';
  }
  return 'tests/implications/[FeatureName]Implications.js';
}

function generateValidationBlockCode(description) {
  const blockId = 'blk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  
  return `{
  id: "${blockId}",
  type: "ui-assertion",
  label: "${description}",
  order: 0,
  expanded: true,
  enabled: true,
  data: {
    assertions: [
      // TODO: Add specific assertions
    ],
    timeout: 30000
  }
}`;
}

function generateStateSkeletonCode(stateName) {
  const status = stateName.toLowerCase().replace(/\s+/g, '_');
  const words = stateName.split(' ');
  const className = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') + 'Implications';
  
  return `class ${className} {
  static xstateConfig = {
    id: "${status}",
    meta: {
      status: "${status}",
      statusLabel: "${stateName}",
      platform: "web", // TODO: adjust
      entity: "booking", // TODO: adjust
      setup: [{
        testFile: "tests/implications/.../TODO.spec.js",
        actionName: "TODO",
        previousStatus: "TODO",
        platform: "web"
      }]
    },
    on: {
      // TODO: Add transitions
    },
    entry: {
      // TODO: Add context updates
    }
  };
  
  static mirrorsOn = {
    UI: {
      web: {
        // TODO: Add validations
      }
    }
  };
}`;
}

/**
 * POST /api/llm/analyze-ticket
 * 
 * Analyze a ticket and find/suggest tests
 */
router.post('/analyze-ticket', async (req, res) => {
  try {
    const { ticketId, ticketText, projectPath } = req.body;

    if (!ticketText) {
      return res.status(400).json({ error: 'ticketText is required' });
    }

    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    console.log('🎫 Analyzing ticket:', ticketId || 'TICKET');

    // Step 1: Get the search index
    let index = null;
    try {
      index = await getIndex(projectPath);
    } catch (e) {
      console.warn('Could not load index:', e.message);
    }

    // Step 2: Use LLM to parse the ticket
    const parsePrompt = buildTicketParsePrompt(ticketText, index);
    
    console.log('🤖 Calling LLM to parse ticket...');
    const llmResponse = await callLLM([
      { role: 'system', content: TICKET_ANALYZER_SYSTEM_PROMPT },
      { role: 'user', content: parsePrompt }
    ], { maxTokens: 2000 });

    console.log('📝 LLM response received, length:', llmResponse.length);

    // Step 3: Parse LLM response
    let parsed;
    try {
      // Try to extract JSON from response
      const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/);
      let jsonStr;
      
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        // Try to find raw JSON object
        const braceMatch = llmResponse.match(/\{[\s\S]*\}/);
        jsonStr = braceMatch ? braceMatch[0] : llmResponse;
      }
      
      parsed = JSON.parse(jsonStr);
      console.log('✅ Parsed LLM response successfully');
    } catch (e) {
      console.warn('Could not parse LLM JSON response:', e.message);
      console.log('Raw response:', llmResponse.substring(0, 500));
      parsed = {
        feature: ticketText.substring(0, 100),
        actors: [],
        preconditions: [],
        actions: [],
        expectedResults: [],
        searchTerms: extractKeywords(ticketText)
      };
    }

    // Step 4: Search for existing coverage
    const existingCoverage = [];
    const searchedTerms = new Set();

    if (index) {
      const searchTerms = [
        ...(parsed.searchTerms || []),
        ...(parsed.actors || []),
        ...extractKeywords(ticketText)
      ];

      for (const term of searchTerms) {
        if (searchedTerms.has(term.toLowerCase())) continue;
        searchedTerms.add(term.toLowerCase());

        const results = searchIndex(index, term, { limit: 5, minScore: 10 });
        for (const result of results) {
          if (!existingCoverage.find(e => e.id === result.id)) {
            existingCoverage.push({
              id: result.id,
              type: result.type,
              status: result.metadata?.status,
              description: result.text?.split('|')[0]?.trim(),
              matchedTerm: term,
              score: result.score
            });
          }
        }
      }

      existingCoverage.sort((a, b) => b.score - a.score);
    }

    // Step 5: Identify gaps
    const gaps = [];
    
    for (const expected of (parsed.expectedResults || [])) {
      const expectedLower = expected.toLowerCase();
      const covered = existingCoverage.some(e => {
        const descLower = (e.description || '').toLowerCase();
        const statusLower = (e.status || '').toLowerCase();
        return descLower.includes(expectedLower.substring(0, 20)) ||
               expectedLower.includes(statusLower);
      });
      
      if (!covered) {
        gaps.push({
          description: expected,
          type: 'missing_validation',
          suggestion: 'Add validation for: "' + expected + '"'
        });
      }
    }

    for (const actor of (parsed.actors || [])) {
      const actorLower = actor.toLowerCase();
      const hasActorCoverage = existingCoverage.some(e => {
        const descLower = (e.description || '').toLowerCase();
        const idLower = (e.id || '').toLowerCase();
        return descLower.includes(actorLower) || idLower.includes(actorLower);
      });
      
      if (!hasActorCoverage && !['user', 'system', 'api'].includes(actorLower)) {
        gaps.push({
          description: 'No tests found for "' + actor + '" platform',
          type: 'missing_platform',
          suggestion: 'Ensure validations exist for ' + actor + ' platform'
        });
      }
    }

    // Step 6: Generate recommendations
    const recommendations = [];

    for (const gap of gaps.filter(g => g.type === 'missing_validation')) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Add Validation Block',
        action: 'add_validation',
        description: gap.suggestion,
        targetFile: findTargetFile(parsed, existingCoverage),
        code: generateValidationBlockCode(gap.description)
      });
    }

    if (parsed.suggestsNewState) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Create New State',
        action: 'create_state',
        description: 'Consider creating a new state for: ' + parsed.suggestsNewState,
        code: generateStateSkeletonCode(parsed.suggestsNewState)
      });
    }

    // Step 7: Build response
    const response = {
      ticketId: ticketId || 'TICKET',
      parsed: {
        feature: parsed.feature,
        actors: parsed.actors || [],
        preconditions: parsed.preconditions || [],
        actions: parsed.actions || [],
        expectedResults: parsed.expectedResults || [],
        searchTerms: parsed.searchTerms || []
      },
      existingCoverage: existingCoverage.slice(0, 10),
      gaps,
      recommendations,
      suggestedStates: parsed.suggestedStates || [],
      raw: parsed
    };

    console.log('✅ Analysis complete:', existingCoverage.length, 'existing,', gaps.length, 'gaps,', recommendations.length, 'recommendations');
    
    res.json(response);

  } catch (error) {
    console.error('❌ Ticket analysis failed:', error);
    res.status(500).json({ 
      error: error.message,
      hint: error.message.includes('API key') 
        ? 'Set DEEPSEEK_API_KEY in your .env file' 
        : undefined
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPLAIN ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/llm/explain
 * 
 * Get natural language explanation for a query
 */
router.post('/explain', async (req, res) => {
  try {
    const { query, projectPath, context } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    let searchResults = [];
    if (projectPath) {
      try {
        const index = await getIndex(projectPath);
        searchResults = searchIndex(index, query, { limit: 10 });
      } catch (e) {
        console.warn('Could not search index:', e.message);
      }
    }

    let contextStr = '';
    if (searchResults.length > 0) {
      const resultTexts = searchResults.map(r => '- ' + r.type + ': ' + r.text);
      contextStr = '\n\nRelevant test data:\n' + resultTexts.join('\n');
    }

    let userContent = query + contextStr;
    if (context) {
      userContent += '\n\nAdditional context: ' + context;
    }

    const response = await callLLM([
      { 
        role: 'system', 
        content: 'You are a test automation expert. Explain testing concepts clearly and concisely. Reference specific states, transitions, and validations when available.' 
      },
      { role: 'user', content: userContent }
    ]);

    res.json({
      explanation: response,
      sources: searchResults.slice(0, 5),
      model: getLLMConfig().model
    });

  } catch (error) {
    console.error('❌ Explain failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;