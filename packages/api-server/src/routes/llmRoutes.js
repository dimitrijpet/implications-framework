/**
 * LLM Routes - Fixed version based on v2 that was working
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { getIndex, searchIndex } from '../services/intelligenceService.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// LLM CLIENT
// ═══════════════════════════════════════════════════════════════════════════

function getLLMConfig() {
  return {
    baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.LLM_MODEL || 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
    maxTokens: 4000,
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
  console.log('🤖 Calling LLM:', config.model);

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
// STATUS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/status', (req, res) => {
  const config = getLLMConfig();
  const available = config.apiKey && config.apiKey.length > 0;
  
  let provider = 'unknown';
  if (config.baseUrl.includes('deepseek')) provider = 'deepseek';
  else if (config.baseUrl.includes('openai')) provider = 'openai';
  else if (config.baseUrl.includes('localhost')) provider = 'ollama';
  
  res.json({ available, model: config.model, provider, baseUrl: config.baseUrl });
});

// ═══════════════════════════════════════════════════════════════════════════
// BUILD CONTEXT FROM INDEX + FILE SUMMARIES
// ═══════════════════════════════════════════════════════════════════════════

function buildImplicationsContext(index, projectPath) {
  if (!index) return 'No existing test data available.';
  
  const lines = [];
  lines.push('=== EXISTING TEST COVERAGE ===\n');
  
  // Group by state
  const stateMap = new Map();
  
  for (const state of (index.states || [])) {
    if (state.type !== 'state') continue;
    const status = state.metadata?.status;
    if (!status) continue;
    
    if (!stateMap.has(status)) {
      stateMap.set(status, {
        status,
        statusLabel: state.metadata?.statusLabel || status,
        platforms: new Set(),
        entity: state.metadata?.entity,
        file: state.metadata?.file,
        transitions: [],
        validations: [],
        conditions: []
      });
    }
    
    if (state.metadata?.platform) {
      stateMap.get(status).platforms.add(state.metadata.platform);
    }
  }
  
  // Add transitions
  for (const trans of (index.transitions || [])) {
    const from = trans.metadata?.from;
    if (from && stateMap.has(from)) {
      stateMap.get(from).transitions.push({
        event: trans.metadata?.event,
        to: trans.metadata?.to,
        platforms: trans.metadata?.platforms || []
      });
    }
  }
  
  // Add validations with FULL details
  for (const val of (index.validations || [])) {
    const status = val.metadata?.state;
    if (status && stateMap.has(status)) {
      stateMap.get(status).validations.push({
        screen: val.metadata?.screen,
        platform: val.metadata?.platform,
        label: val.metadata?.label || val.text?.split('|')[0]?.trim(),
        blockId: val.metadata?.blockId,
        blockType: val.metadata?.blockType
      });
    }
  }
  
  // Add conditions
  for (const cond of (index.conditions || [])) {
    const status = cond.metadata?.state;
    if (status && stateMap.has(status)) {
      stateMap.get(status).conditions.push({
        field: cond.metadata?.field,
        operator: cond.metadata?.operator,
        value: cond.metadata?.value,
        screen: cond.metadata?.screen
      });
    }
  }
  
  // Format each state with FULL validation details
  for (const [status, data] of stateMap) {
    lines.push(`\n## STATE: ${data.statusLabel} (${status})`);
    lines.push(`   File: ${data.file || 'unknown'}`);
    lines.push(`   Entity: ${data.entity || 'unknown'}`);
    lines.push(`   Platforms: ${[...data.platforms].join(', ') || 'none'}`);
    
    if (data.transitions.length > 0) {
      lines.push(`   Transitions OUT:`);
      for (const t of data.transitions) {
        lines.push(`     - ${t.event} → ${t.to}`);
      }
    }
    
    if (data.validations.length > 0) {
      lines.push(`   Validations (${data.validations.length}):`);
      const byPlatform = {};
      for (const v of data.validations) {
        const plat = v.platform || 'unknown';
        if (!byPlatform[plat]) byPlatform[plat] = [];
        byPlatform[plat].push(v);
      }
      for (const [plat, vals] of Object.entries(byPlatform)) {
        lines.push(`     [${plat}]`);
        for (const v of vals) {
          const label = v.label?.substring(0, 80) || v.screen;
          lines.push(`       - ${v.screen}: "${label}"`);
        }
      }
    }
  }
  
  lines.push('\n=== ALL STATES ===');
  lines.push([...stateMap.keys()].join(', '));
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// ROBUST JSON PARSING
// ═══════════════════════════════════════════════════════════════════════════

function parseJSONSafely(text) {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch (e) {}
  
  // Try extracting from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {}
  }
  
  // Try finding JSON object
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch (e) {
      // Try fixing common issues
      let fixed = braceMatch[0]
        .replace(/,\s*}/g, '}')  // trailing commas
        .replace(/,\s*]/g, ']')  // trailing commas in arrays
        .replace(/'/g, '"')      // single quotes
        .replace(/[\r\n]+/g, ' '); // newlines
      try {
        return JSON.parse(fixed);
      } catch (e2) {}
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TICKET ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are a senior test automation engineer analyzing tickets for an implications-based testing framework.

The framework has:
- States: app states like "booking_pending", "booking_accepted", "booking_cancelled"
- Transitions: events that move between states like "ACCEPT_BOOKING", "CANCEL_BOOKING"
- Validations: UI checks organized by platform (web, manager, dancer) and screen
- Conditions: conditional logic based on field values

Your job:
1. Understand the ticket requirements
2. Check what ALREADY EXISTS in the coverage data
3. Identify GAPS - what's missing
4. Give specific, actionable recommendations

IMPORTANT: Check the existing states and validations carefully before recommending new ones!`;

const OUTPUT_FORMAT = `Return a JSON object with this EXACT structure (no code blocks, just pure JSON):
{
  "feature": "Brief description",
  "actors": ["dancer", "manager"],
  "preconditions": ["list of preconditions"],
  "actions": ["what user does"],
  "expectedResults": ["what should happen"],
  "existingCoverage": {
    "found": true,
    "states": ["list of relevant existing states"],
    "validations": ["list of relevant existing validations"],
    "details": "Explanation of what already exists"
  },
  "gaps": [
    {
      "description": "What is missing",
      "targetState": "which state to add to",
      "targetPlatform": "dancer or manager or web",
      "targetScreen": "ScreenName",
      "severity": "HIGH or MEDIUM or LOW"
    }
  ],
  "recommendations": [
    {
      "priority": "HIGH or MEDIUM",
      "action": "add_validation or add_transition or modify_existing",
      "title": "Short title",
      "description": "What to do",
      "targetFile": "which implication file",
      "details": "Specific implementation details"
    }
  ],
  "analysis": "Your reasoning about what exists vs what's needed"
}`;

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

    // Get index
    let index = null;
    let context = 'No test data available.';
    try {
      index = await getIndex(projectPath);
      context = buildImplicationsContext(index, projectPath);
      console.log('📚 Built context from', index.states?.length || 0, 'states');
    } catch (e) {
      console.warn('Could not load index:', e.message);
    }

    // Search for relevant items
    const searchTerms = extractKeywords(ticketText);
    const relevant = findRelevantItems(index, searchTerms);

    // Build prompt
    const userPrompt = `TICKET: ${ticketId ? `[${ticketId}] ` : ''}${ticketText}

${context}

=== SEARCH RESULTS FOR TICKET KEYWORDS ===
Matching states: ${relevant.states.map(s => s.status).join(', ') || 'none'}
Matching validations: ${relevant.validations.length} found
${relevant.validations.slice(0, 5).map(v => `  - ${v.state}/${v.platform}/${v.screen}: ${v.label}`).join('\n')}

${OUTPUT_FORMAT}`;

    console.log('🤖 Calling LLM...');
    const llmResponse = await callLLM([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 3000 });

    console.log('📝 Got response, parsing...');

    // Parse with fallbacks
    let parsed = parseJSONSafely(llmResponse);
    
    if (!parsed) {
      console.warn('❌ Could not parse JSON, using fallback');
      parsed = {
        feature: ticketText.substring(0, 100),
        actors: [],
        existingCoverage: { found: false, details: 'Parse error' },
        gaps: [],
        recommendations: [],
        analysis: 'Failed to parse LLM response. Raw: ' + llmResponse.substring(0, 500)
      };
    }

    // Build response
    const response = {
      ticketId: ticketId || 'TICKET',
      parsed: {
        feature: parsed.feature,
        actors: parsed.actors || [],
        preconditions: parsed.preconditions || [],
        actions: parsed.actions || [],
        expectedResults: parsed.expectedResults || [],
        analysis: parsed.analysis
      },
      existingCoverage: relevant.states.map(s => ({
        id: s.status,
        type: 'state',
        status: s.status,
        description: s.statusLabel,
        file: s.file
      })),
      llmExistingCoverage: parsed.existingCoverage,
      gaps: parsed.gaps || [],
      recommendations: (parsed.recommendations || []).map(r => ({
        priority: r.priority || 'MEDIUM',
        title: r.title || r.action,
        action: r.action,
        description: r.description,
        targetFile: r.targetFile,
        details: r.details,
        // Generate code block based on recommendation
        code: generateCodeForRecommendation(r)
      })),
      analysis: parsed.analysis,
      suggestedStates: [],
      raw: parsed
    };

    console.log('✅ Done!');
    res.json(response);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function findRelevantItems(index, searchTerms) {
  const result = { states: [], validations: [], transitions: [] };
  if (!index) return result;
  
  const seen = new Set();
  
  for (const term of searchTerms) {
    const results = searchIndex(index, term, { limit: 10, minScore: 5 });
    for (const r of results) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      
      if (r.type === 'state') {
        result.states.push({
          status: r.metadata?.status,
          statusLabel: r.metadata?.statusLabel,
          file: r.metadata?.file
        });
      } else if (r.type === 'validation') {
        result.validations.push({
          state: r.metadata?.state,
          screen: r.metadata?.screen,
          platform: r.metadata?.platform,
          label: r.metadata?.label || r.text?.split('|')[0]
        });
      }
    }
  }
  
  return result;
}

function generateCodeForRecommendation(rec) {
  if (rec.action === 'add_validation') {
    const blockId = 'blk_func_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    return `{
  id: "${blockId}",
  type: "function-call",
  label: "${rec.title || rec.description}",
  order: 0,
  expanded: true,
  enabled: true,
  data: {
    instance: "${rec.targetScreen?.toLowerCase() || 'screen'}Screen",
    method: "TODO_addMethodName",
    args: ["ctx.data.booking"],
    await: true,
    assertion: {
      type: "toBeVisible",
      not: false
    }
  }
}`;
  }
  
  if (rec.action === 'add_transition') {
    return `// In xstateConfig.on:
${rec.title || 'EVENT_NAME'}: {
  target: "${rec.targetState || 'target_state'}",
  platforms: ["${rec.targetPlatform || 'web'}"]
}`;
  }
  
  return `// ${rec.description || rec.title}\n// TODO: Implement`;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'has',
  'been', 'were', 'being', 'will', 'would', 'could', 'should', 'must',
  'when', 'where', 'which', 'what', 'who', 'how', 'why', 'then', 'than',
  'into', 'onto', 'upon', 'also', 'just', 'only', 'some', 'such', 'each',
  'their', 'they', 'them', 'there', 'these', 'those', 'your', 'about',
  'after', 'before', 'show', 'display', 'check', 'verify', 'ensure'
]);

function extractKeywords(text) {
  if (!text) return [];
  
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !STOP_WORDS.has(w));
  
  return [...new Set(words)].slice(0, 20);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPLAIN
// ═══════════════════════════════════════════════════════════════════════════

router.post('/explain', async (req, res) => {
  try {
    const { query, projectPath } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    let context = '';
    if (projectPath) {
      try {
        const index = await getIndex(projectPath);
        context = buildImplicationsContext(index, projectPath);
      } catch (e) {}
    }

    const response = await callLLM([
      { role: 'system', content: 'You are a test automation expert. Answer questions about the test suite.' },
      { role: 'user', content: query + '\n\n' + context }
    ]);

    res.json({ explanation: response, model: getLLMConfig().model });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;