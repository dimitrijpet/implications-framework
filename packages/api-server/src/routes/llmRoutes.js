/**
 * LLM Routes - Smarter condition generation
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
  if (!config.apiKey) throw new Error('No API key configured');

  const response = await fetch(config.baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.apiKey },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || config.temperature
    })
  });

  if (!response.ok) throw new Error('LLM API error: ' + response.status);
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

router.get('/status', (req, res) => {
  const config = getLLMConfig();
  res.json({ available: !!config.apiKey, model: config.model, provider: config.baseUrl.includes('deepseek') ? 'deepseek' : 'unknown' });
});

// ═══════════════════════════════════════════════════════════════════════════
// POM PARSING
// ═══════════════════════════════════════════════════════════════════════════

function parsePOMFile(filePath, projectPath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
  if (!fs.existsSync(fullPath)) return null;
  
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const methods = [];
    
    const asyncRegex = /async\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = asyncRegex.exec(content)) !== null) {
      if (!match[1].startsWith('_') && match[1] !== 'constructor') {
        methods.push({ name: match[1], params: match[2].trim(), async: true });
      }
    }
    
    const getterRegex = /get\s+(\w+)\s*\(\)\s*\{/g;
    while ((match = getterRegex.exec(content)) !== null) {
      methods.push({ name: match[1], params: '', isGetter: true });
    }
    
    const classMatch = content.match(/class\s+(\w+)/);
    return { path: filePath, className: classMatch ? classMatch[1] : path.basename(filePath, '.js'), methods };
  } catch (e) {
    return null;
  }
}

function findPOMFiles(index, projectPath) {
  const pomPaths = new Set();
  const poms = [];
  
  const dirs = [
    'tests/mobile/android/dancer/screenObjects',
    'tests/mobile/android/manager/screenObjects',
    'tests/web/pages',
    'tests/web/wrappers'
  ];
  
  for (const dir of dirs) {
    const fullDir = path.join(projectPath, dir);
    if (fs.existsSync(fullDir)) {
      try {
        for (const file of fs.readdirSync(fullDir)) {
          if (file.endsWith('.screen.js') || file.endsWith('.page.js') || file.endsWith('.wrapper.js')) {
            pomPaths.add(path.join(dir, file));
          }
        }
      } catch (e) {}
    }
  }
  
  for (const pomPath of pomPaths) {
    const parsed = parsePOMFile(pomPath, projectPath);
    if (parsed) poms.push(parsed);
  }
  
  return poms;
}

function buildPOMContext(poms) {
  if (!poms.length) return '';
  const lines = ['\n=== AVAILABLE POM METHODS ==='];
  for (const pom of poms) {
    lines.push(`\n${pom.className} (${pom.path}):`);
    for (const m of pom.methods.slice(0, 15)) {
      lines.push(`  - ${m.isGetter ? 'get ' : m.async ? 'async ' : ''}${m.name}(${m.params})`);
    }
    if (pom.methods.length > 15) lines.push(`  ... +${pom.methods.length - 15} more`);
  }
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

function buildImplicationsContext(index) {
  if (!index) return '';
  
  const lines = ['=== EXISTING COVERAGE ===\n'];
  const stateMap = new Map();
  
  for (const state of (index.states || [])) {
    if (state.type !== 'state') continue;
    const status = state.metadata?.status;
    if (!status || stateMap.has(status)) continue;
    stateMap.set(status, { status, file: state.metadata?.file, validations: [] });
  }
  
  for (const val of (index.validations || [])) {
    const status = val.metadata?.state;
    if (status && stateMap.has(status)) {
      stateMap.get(status).validations.push({
        platform: val.metadata?.platform,
        screen: val.metadata?.screen,
        label: val.metadata?.label,
        method: val.metadata?.method,
        hasConditions: val.metadata?.hasConditions
      });
    }
  }
  
  for (const [status, data] of stateMap) {
    lines.push(`\n## ${status}`);
    if (data.validations.length) {
      const byPlat = {};
      for (const v of data.validations) {
        const p = v.platform || 'unknown';
        if (!byPlat[p]) byPlat[p] = [];
        byPlat[p].push(v);
      }
      for (const [p, vs] of Object.entries(byPlat)) {
        lines.push(`  [${p}]`);
        for (const v of vs.slice(0, 5)) {
          const cond = v.hasConditions ? ' [conditional]' : '';
          lines.push(`    - ${v.screen}: ${v.label || v.method || '?'}${cond}`);
        }
      }
    }
  }
  
  lines.push('\nAll states: ' + [...stateMap.keys()].join(', '));
  return lines.join('\n');
}

function parseJSONSafely(text) {
  try { return JSON.parse(text); } catch (e) {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[1] || match[0]); } catch (e) {
      try { return JSON.parse((match[1] || match[0]).replace(/,\s*([}\]])/g, '$1')); } catch (e2) {}
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ID GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateId(prefix = 'blk') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateConditionBlock(conditions) {
  if (!conditions || conditions.length === 0) return null;
  
  const checks = conditions.map(c => ({
    id: generateId('chk'),
    field: c.field,
    operator: c.operator || 'equals',
    value: String(c.value ?? ''),
    valueType: c.valueType || 'string'
  }));
  
  return {
    mode: 'all',
    blocks: [{
      id: generateId('cond_check'),
      type: 'condition-check',
      enabled: true,
      mode: 'all',
      data: { checks }
    }]
  };
}

function generateFullBlock(rec, poms) {
  const screenName = rec.screen || rec.targetScreen || '';
  const pom = poms.find(p => 
    p.className.toLowerCase().includes(screenName.toLowerCase().replace('screen', '').replace('wrapper', '')) ||
    screenName.toLowerCase().includes(p.className.toLowerCase().replace('screen', '').replace('wrapper', ''))
  );
  
  let instance = screenName.charAt(0).toLowerCase() + screenName.slice(1);
  if (!instance.endsWith('Screen') && !instance.endsWith('Wrapper')) instance += 'Screen';
  instance = instance.replace('ScreenScreen', 'Screen').replace('WrapperWrapper', 'Wrapper');
  
  const methodExists = pom?.methods.some(m => m.name === rec.method);
  
  let assertionType = rec.assertionType || 'toBeVisible';
  let assertionNot = rec.negate || rec.not || rec.hidden || false;
  
  let args = rec.args || [];
  if (typeof args === 'string') args = [args];
  
  const block = {
    id: generateId('blk_func'),
    type: rec.blockType || 'function-call',
    label: rec.label || rec.description || `Check ${rec.method}`,
    order: rec.order || 0,
    expanded: true,
    enabled: true,
    data: {
      instance: instance,
      method: rec.method,
      args: args,
      await: true,
      assertion: { type: assertionType, not: assertionNot }
    }
  };
  
  if (rec.conditions && rec.conditions.length > 0) {
    block.conditions = generateConditionBlock(rec.conditions);
  }
  
  if (rec.storeAs) {
    block.data.storeAs = rec.storeAs;
  }
  
  return { block, methodExists, pomPath: pom?.path, pomClass: pom?.className };
}

function formatBlockAsCode(block) {
  let code = `{
  id: "${block.id}",
  type: "${block.type}",
  label: "${block.label}",
  order: ${block.order},
  expanded: ${block.expanded},
  enabled: ${block.enabled},`;

  if (block.conditions) {
    code += `
  conditions: {
    mode: "${block.conditions.mode}",
    blocks: [{
      id: "${block.conditions.blocks[0].id}",
      type: "condition-check",
      enabled: true,
      mode: "${block.conditions.blocks[0].mode}",
      data: {
        checks: [${block.conditions.blocks[0].data.checks.map(c => `{
          id: "${c.id}",
          field: "${c.field}",
          operator: "${c.operator}",
          value: "${c.value}",
          valueType: "${c.valueType}"
        }`).join(', ')}]
      }
    }]
  },`;
  }

  code += `
  data: {
    instance: "${block.data.instance}",
    method: "${block.data.method}",
    args: [${block.data.args.map(a => {
      if (typeof a === 'string' && a.startsWith('ctx.')) return a;
      return `"${a}"`;
    }).join(', ')}],
    await: ${block.data.await},${block.data.storeAs ? `
    storeAs: "${block.data.storeAs}",` : ''}
    assertion: {
      type: "${block.data.assertion.type}",
      not: ${block.data.assertion.not}
    }
  }
}`;

  return code;
}

// ═══════════════════════════════════════════════════════════════════════════
// TICKET ANALYZER - IMPROVED PROMPT
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are a test automation engineer creating validation blocks for an implications-based testing framework.

CRITICAL RULES FOR CONDITIONS:

1. CONDITIONS define WHEN a block runs, not WHAT it checks.
   - The block's method + assertion checks the UI
   - The conditions define the data state that must be true for this check to apply

2. ONE block can cover MULTIPLE scenarios using conditions:
   
   WRONG (multiple separate blocks):
   - Block 1: "notification visible" (no condition)
   - Block 2: "notification NOT visible without permission" (no condition, just negate)
   
   RIGHT (single block with condition):
   - Block: "notification visible" with condition: permissions.manageGroups = truthy
   - The test framework will skip this block when permission is falsy

3. For "should NOT appear when X" scenarios:
   - If X is a data condition (permission, status, flag): Use a CONDITION
   - The assertion stays positive (toBeVisible, not: false)
   - Example: "notification should not appear if no manageGroups permission"
     → Block checks notification IS visible
     → Condition: club.user.permissions.manageGroups = truthy
     → Framework skips block when permission is false, so no false positive

4. For genuinely negative assertions (element truly shouldn't exist):
   - Use negate: true in assertion
   - Example: "error message should never appear after successful save"
     → assertion: { type: "toBeVisible", not: true }

5. COMMON CONDITION PATTERNS:
   - Permission check: { field: "club.user.permissions.manageGroups", operator: "truthy", value: "" }
   - Status check: { field: "booking.status", operator: "equals", value: "checked_out" }
   - Type check: { field: "booking.type", operator: "notEquals", value: "audition" }
   - Flag check: { field: "dancer.isInGroup", operator: "falsy", value: "" }
   - Negated: { field: "booking.isAudition", operator: "falsy", value: "" }

6. DON'T create duplicate blocks for opposite conditions. ONE block with the positive condition is enough.
   The framework handles the "skip when condition not met" logic.

EXAMPLE - NOTIFICATION PERMISSION:

Ticket: "Notification should only show for managers with manage_groups permission"

WRONG approach (2 blocks):
{
  "recommendations": [
    { "label": "Notification visible", "method": "notifGroupAdd", "negate": false },
    { "label": "Notification NOT visible without permission", "method": "notifGroupAdd", "negate": true }
  ]
}

RIGHT approach (1 block with condition):
{
  "recommendations": [
    {
      "label": "Add to groups notification visible",
      "method": "notifGroupAdd",
      "args": ["ctx.data.booking"],
      "negate": false,
      "conditions": [
        { "field": "club.user.permissions.manageGroups", "operator": "truthy", "value": "" }
      ]
    }
  ]
}

EXAMPLE - BOOKING TYPE:

Ticket: "Notification should NOT appear for auditions, only for regular bookings"

RIGHT approach:
{
  "recommendations": [
    {
      "label": "Add to groups notification after checkout",
      "method": "notifGroupAdd",
      "args": ["ctx.data.booking"],
      "negate": false,
      "conditions": [
        { "field": "booking.type", "operator": "notEquals", "value": "audition" },
        { "field": "booking.status", "operator": "equals", "value": "checked_out" }
      ]
    }
  ]
}

EXAMPLE - MULTIPLE CONDITIONS (AND):

Ticket: "Show notification only if: has permission AND booking is checked out AND entertainer not in group"

{
  "label": "Add to groups notification",
  "method": "notifGroupAdd",
  "conditions": [
    { "field": "club.user.permissions.manageGroups", "operator": "truthy", "value": "" },
    { "field": "booking.status", "operator": "equals", "value": "checked_out" },
    { "field": "dancer.isInGroup", "operator": "falsy", "value": "" }
  ]
}`;

const OUTPUT_FORMAT = `Return JSON:
{
  "understanding": "Brief summary of what needs testing",
  "testScenarios": [
    "List each distinct scenario that needs validation"
  ],
  "recommendations": [
    {
      "platform": "manager|dancer|web",
      "screen": "ScreenName",
      "method": "methodName",
      "args": ["ctx.data.booking"],
      "label": "Human readable description",
      "negate": false,
      "conditions": [
        { "field": "data.path", "operator": "equals|notEquals|truthy|falsy|contains", "value": "value" }
      ],
      "newMethod": false,
      "notes": "Optional implementation notes"
    }
  ],
  "newMethods": [
    {
      "pomClass": "ScreenName",
      "pomPath": "path/to/file.js",
      "methodName": "name",
      "methodCode": "async methodName() { ... }"
    }
  ],
  "analysis": "Explanation of approach"
}`;

router.post('/analyze-ticket', async (req, res) => {
  try {
    const { ticketId, ticketText, projectPath } = req.body;
    if (!ticketText) return res.status(400).json({ error: 'ticketText required' });
    if (!projectPath) return res.status(400).json({ error: 'projectPath required' });

    console.log('🎫 Analyzing:', ticketId || 'TICKET');

    let index = null;
    let implContext = '';
    try {
      index = await getIndex(projectPath);
      implContext = buildImplicationsContext(index);
    } catch (e) {}

    const poms = findPOMFiles(index, projectPath);
    const pomContext = buildPOMContext(poms);

    const userPrompt = `TICKET: ${ticketId ? `[${ticketId}] ` : ''}${ticketText}

${implContext}
${pomContext}

${OUTPUT_FORMAT}

REMEMBER:
- Use CONDITIONS to define when a block applies (data state, permissions, status)
- DON'T duplicate blocks for "with permission" vs "without permission" - use ONE block with condition
- Conditions define WHEN, assertions define WHAT
- Multiple conditions in one block = AND logic`;

    const llmResponse = await callLLM([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]);

    let parsed = parseJSONSafely(llmResponse);
    if (!parsed) {
      parsed = { understanding: ticketText.substring(0, 100), recommendations: [], analysis: 'Parse error' };
    }

    // Generate full blocks
    const recommendations = (parsed.recommendations || []).map((rec, idx) => {
      const { block, methodExists, pomPath, pomClass } = generateFullBlock(rec, poms);
      
      return {
        priority: rec.priority || (idx === 0 ? 'HIGH' : 'MEDIUM'),
        platform: rec.platform,
        screen: rec.screen,
        method: rec.method,
        methodExists,
        pomPath,
        pomClass,
        description: rec.label || rec.description,
        notes: rec.notes,
        isNewMethod: rec.newMethod || !methodExists,
        hasConditions: !!(rec.conditions && rec.conditions.length > 0),
        conditions: rec.conditions,
        blockCode: formatBlockAsCode(block),
        location: `mirrorsOn.UI.${rec.platform}.${rec.screen}.blocks[]`
      };
    });

    // New methods
    const newMethods = (parsed.newMethods || []).map(m => ({
      pomClass: m.pomClass,
      pomPath: m.pomPath,
      methodName: m.methodName,
      code: m.methodCode
    }));

    for (const rec of recommendations) {
      if (rec.isNewMethod && !newMethods.find(m => m.methodName === rec.method)) {
        newMethods.push({
          pomClass: rec.pomClass || rec.screen,
          pomPath: rec.pomPath || `tests/mobile/android/${rec.platform}/screenObjects/${rec.screen}.screen.js`,
          methodName: rec.method,
          code: `// TODO: Implement ${rec.method}\nasync ${rec.method}() {\n  // Add implementation\n}`
        });
      }
    }

    res.json({
      ticketId: ticketId || 'TICKET',
      parsed: { 
        feature: parsed.understanding, 
        analysis: parsed.analysis,
        testScenarios: parsed.testScenarios 
      },
      existingCoverage: parsed.existingCoverage,
      gaps: parsed.testScenarios || [],
      recommendations,
      newMethods,
      poms: poms.map(p => ({ className: p.className, path: p.path, methods: p.methods.map(m => m.name) })),
      raw: parsed
    });

  } catch (error) {
    console.error('❌', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/explain', async (req, res) => {
  try {
    const { query, projectPath } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });

    let context = '';
    if (projectPath) {
      try {
        const index = await getIndex(projectPath);
        context = buildImplicationsContext(index) + buildPOMContext(findPOMFiles(index, projectPath));
      } catch (e) {}
    }

    const response = await callLLM([
      { role: 'system', content: 'You are a test automation expert.' },
      { role: 'user', content: query + '\n\n' + context }
    ]);

    res.json({ explanation: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;