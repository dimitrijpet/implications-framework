/**
 * LLM Service - Natural Language Intelligence for Implications Framework
 * 
 * Provides:
 * - Flow explanations in plain English
 * - Backend test parsing and mapping
 * - Ticket/specification analysis
 * - Test gap suggestions
 * 
 * Supports:
 * - DeepSeek API ($0.14/1M tokens)
 * - Ollama (free, local)
 * - OpenAI-compatible APIs
 * 
 * Configuration via environment variables:
 *   LLM_BASE_URL - API base URL (default: https://api.deepseek.com/v1)
 *   LLM_MODEL - Model name (default: deepseek-chat)
 *   DEEPSEEK_API_KEY / OPENAI_API_KEY - API key
 *   LLM_ENABLED - Set to 'false' to disable (default: true if key exists)
 * 
 * @module llmService
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const LLM_CONFIG = {
  baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
  model: process.env.LLM_MODEL || 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || 'ollama',
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '800', 10),
  temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
  enabled: process.env.LLM_ENABLED !== 'false' && 
           !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || 
              process.env.LLM_BASE_URL?.includes('localhost'))
};

/**
 * Check if LLM is available and enabled
 */
export function isLLMEnabled() {
  return LLM_CONFIG.enabled;
}

/**
 * Get current LLM configuration (for debugging)
 */
export function getLLMConfig() {
  return {
    ...LLM_CONFIG,
    apiKey: LLM_CONFIG.apiKey ? '***' + LLM_CONFIG.apiKey.slice(-4) : null
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Call the LLM API (OpenAI-compatible format)
 * 
 * @param {Array} messages - Chat messages
 * @param {Object} options - Additional options
 * @returns {string} Assistant's response
 */
export async function callLLM(messages, options = {}) {
  if (!LLM_CONFIG.enabled) {
    throw new Error('LLM is not enabled. Set DEEPSEEK_API_KEY or configure Ollama.');
  }
  
  const {
    maxTokens = LLM_CONFIG.maxTokens,
    temperature = LLM_CONFIG.temperature,
    jsonMode = false
  } = options;
  
  const requestBody = {
    model: LLM_CONFIG.model,
    messages,
    max_tokens: maxTokens,
    temperature
  };
  
  // Add JSON mode if supported (DeepSeek, OpenAI)
  if (jsonMode && !LLM_CONFIG.baseUrl.includes('localhost')) {
    requestBody.response_format = { type: 'json_object' };
  }
  
  console.log(`🤖 Calling LLM: ${LLM_CONFIG.model} at ${LLM_CONFIG.baseUrl}`);
  
  const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_CONFIG.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid LLM response format');
  }
  
  const content = data.choices[0].message.content;
  
  // Log usage if available
  if (data.usage) {
    console.log(`   Tokens: ${data.usage.prompt_tokens} in, ${data.usage.completion_tokens} out`);
  }
  
  return content;
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOW EXPLANATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Explain a flow or search results in natural language
 * 
 * @param {string} query - User's original question
 * @param {Array} searchResults - Results from intelligence search
 * @param {Object} chainInfo - Optional chain information
 * @returns {string} Natural language explanation
 */
export async function explainFlow(query, searchResults, chainInfo = null) {
  if (!LLM_CONFIG.enabled) {
    return null;
  }
  
  const context = formatResultsForLLM(searchResults, chainInfo);
  
  const messages = [
    {
      role: 'system',
      content: `You are an expert on the PolePosition test automation framework.
Given search results from the implications system, explain the relevant flows clearly and concisely.

Focus on:
1. What states are involved
2. What platforms run each step (web, dancer, manager)
3. What the prerequisite chain looks like
4. Any conditions or permissions required

Be practical and direct. Use bullet points for steps.
Keep your response under 300 words.`
    },
    {
      role: 'user',
      content: `Query: "${query}"

Search Results:
${context}

Please explain this flow.`
    }
  ];
  
  try {
    return await callLLM(messages, { maxTokens: 600 });
  } catch (error) {
    console.error('❌ LLM explain error:', error.message);
    return null;
  }
}

/**
 * Format search results for LLM context
 */
function formatResultsForLLM(results, chainInfo) {
  let output = '';
  
  // Limit to top results to stay within context
  const topResults = results.slice(0, 10);
  
  for (const r of topResults) {
    output += `[${r.type.toUpperCase()}] ${r.id}\n`;
    output += `  ${r.text.substring(0, 200)}${r.text.length > 200 ? '...' : ''}\n`;
    if (r.metadata?.platform) output += `  Platform: ${r.metadata.platform}\n`;
    if (r.metadata?.description) output += `  Description: ${r.metadata.description}\n`;
    if (r.chain?.steps) output += `  Chain: ${r.chain.steps.join(' → ')}\n`;
    output += '\n';
  }
  
  if (chainInfo) {
    output += `\n--- Full Chain Information ---\n`;
    output += `Steps: ${chainInfo.steps?.join(' → ') || 'Unknown'}\n`;
    output += `Segments: ${chainInfo.segments || 'Unknown'}\n`;
    output += `Ready: ${chainInfo.ready ? 'Yes' : 'No'}\n`;
  }
  
  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKEND TEST PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a backend test and extract structured information
 * 
 * @param {string} testCode - RSpec, Jest, or other test code
 * @param {string} language - Test language ('ruby', 'javascript', etc.)
 * @returns {Object} Parsed test information
 */
export async function parseBackendTest(testCode, language = 'ruby') {
  if (!LLM_CONFIG.enabled) {
    return null;
  }
  
  const messages = [
    {
      role: 'system',
      content: `You are an expert at analyzing ${language} tests.
Extract structured information from the test code.

Return JSON with exactly these fields:
{
  "description": "What the test verifies (1 sentence)",
  "condition": "What condition is being tested (e.g., 'permission=false')",
  "expectedBehavior": "What should happen when condition is met",
  "entities": ["array", "of", "entities", "involved"],
  "fields": ["relevant", "field", "names"],
  "searchTerms": ["terms", "to", "find", "related", "frontend", "tests"]
}

Be concise. Focus on testable behaviors.`
    },
    {
      role: 'user',
      content: `Analyze this ${language} test:\n\n${testCode}`
    }
  ];
  
  try {
    const response = await callLLM(messages, { 
      maxTokens: 400, 
      temperature: 0.2,
      jsonMode: true 
    });
    
    // Parse JSON response
    try {
      return JSON.parse(response);
    } catch (e) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```json?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return { raw: response, parseError: e.message };
    }
  } catch (error) {
    console.error('❌ LLM parse error:', error.message);
    return null;
  }
}

/**
 * Map a parsed backend test to existing implications
 * 
 * @param {Object} parsedTest - From parseBackendTest()
 * @param {Object} index - Intelligence search index
 * @param {Function} searchFn - Search function
 * @returns {Object} Mapping results
 */
export function mapBackendTestToImplications(parsedTest, index, searchFn) {
  if (!parsedTest?.searchTerms?.length) {
    return { matches: [], confidence: 'low', reason: 'No search terms extracted' };
  }
  
  // Search for each term
  const allMatches = [];
  
  for (const term of parsedTest.searchTerms) {
    const results = searchFn(index, term, { 
      types: ['validations'], 
      limit: 5 
    });
    allMatches.push(...results);
  }
  
  // Dedupe and score
  const seen = new Set();
  const uniqueMatches = [];
  
  for (const match of allMatches) {
    if (!seen.has(match.id)) {
      seen.add(match.id);
      uniqueMatches.push(match);
    }
  }
  
  // Sort by score
  uniqueMatches.sort((a, b) => b.score - a.score);
  
  // Determine confidence
  let confidence = 'low';
  if (uniqueMatches.length > 0 && uniqueMatches[0].score > 30) {
    confidence = 'high';
  } else if (uniqueMatches.length > 0 && uniqueMatches[0].score > 15) {
    confidence = 'medium';
  }
  
  return {
    matches: uniqueMatches.slice(0, 5),
    confidence,
    searchTermsUsed: parsedTest.searchTerms,
    parsedInfo: {
      description: parsedTest.description,
      condition: parsedTest.condition,
      expectedBehavior: parsedTest.expectedBehavior
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TICKET ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze a ticket or specification text
 * 
 * @param {string} ticketText - Ticket description or specification
 * @returns {Object} Extracted test requirements
 */
export async function analyzeTicket(ticketText) {
  if (!LLM_CONFIG.enabled) {
    return null;
  }
  
  const messages = [
    {
      role: 'system',
      content: `You are an expert at analyzing feature specifications and tickets.
Extract test requirements from the text.

Return JSON with these fields:
{
  "feature": "Brief feature name (2-5 words)",
  "actors": ["who performs actions: dancer, manager, admin"],
  "preconditions": ["required state before feature works"],
  "actions": ["what user does"],
  "expectedResults": ["what should happen"],
  "edgeCases": ["special conditions mentioned"],
  "searchTerms": ["terms to find existing tests"]
}

Be concise and focus on testable requirements.`
    },
    {
      role: 'user',
      content: `Analyze this ticket/specification:\n\n${ticketText}`
    }
  ];
  
  try {
    const response = await callLLM(messages, { 
      maxTokens: 500, 
      temperature: 0.2,
      jsonMode: true 
    });
    
    try {
      return JSON.parse(response);
    } catch (e) {
      const jsonMatch = response.match(/```json?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return { raw: response, parseError: e.message };
    }
  } catch (error) {
    console.error('❌ LLM ticket analysis error:', error.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST GAP ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Suggest missing tests based on existing patterns
 * 
 * @param {Object} stateDetails - State with transitions and validations
 * @returns {Object} Suggested tests
 */
export async function suggestMissingTests(stateDetails) {
  if (!LLM_CONFIG.enabled) {
    return null;
  }
  
  const context = `
State: ${stateDetails.id} (${stateDetails.metadata?.statusLabel || ''})
Platform: ${stateDetails.metadata?.platform || 'unknown'}

Outgoing Transitions (${stateDetails.outgoingTransitions?.length || 0}):
${(stateDetails.outgoingTransitions || []).map(t => 
  `  - ${t.metadata.event} → ${t.metadata.to}`
).join('\n')}

Incoming Transitions (${stateDetails.incomingTransitions?.length || 0}):
${(stateDetails.incomingTransitions || []).map(t => 
  `  - ${t.metadata.from} → ${t.metadata.event}`
).join('\n')}

Validations (${stateDetails.validations?.length || 0}):
${(stateDetails.validations || []).map(v => 
  `  - ${v.metadata.screen}: ${v.metadata.description || v.text.substring(0, 50)}`
).join('\n')}

Conditions (${stateDetails.conditions?.length || 0}):
${(stateDetails.conditions || []).map(c => 
  `  - ${c.metadata.field} ${c.metadata.operator} ${c.metadata.value}`
).join('\n')}
`;

  const messages = [
    {
      role: 'system',
      content: `You are a test coverage expert.
Analyze the test coverage for a state and suggest gaps.

Return JSON:
{
  "coverageScore": "high/medium/low",
  "missingTransitionTests": ["transitions that might need tests"],
  "missingValidations": ["screens or elements not validated"],
  "suggestedEdgeCases": ["edge cases to consider"],
  "recommendations": ["specific test recommendations"]
}

Be practical. Focus on high-value gaps.`
    },
    {
      role: 'user',
      content: `Analyze test coverage for:\n${context}`
    }
  ];
  
  try {
    const response = await callLLM(messages, { 
      maxTokens: 500, 
      temperature: 0.3,
      jsonMode: true 
    });
    
    try {
      return JSON.parse(response);
    } catch (e) {
      const jsonMatch = response.match(/```json?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return { raw: response, parseError: e.message };
    }
  } catch (error) {
    console.error('❌ LLM gap analysis error:', error.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  callLLM,  // ADD THIS
  isLLMEnabled,
  getLLMConfig,
  explainFlow,
  parseBackendTest,
  mapBackendTestToImplications,
  analyzeTicket,
  suggestMissingTests
};