/**
 * LLM Routes - With implication file generation
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
    maxTokens: 6000,
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
// FILE READING
// ═══════════════════════════════════════════════════════════════════════════

function readImplicationFile(filePath, projectPath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (e) {
    return null;
  }
}

function findImplicationFiles(projectPath) {
  const files = [];
  const searchDirs = [
    'tests/implications/bookings/status',
    'tests/implications/bookings',
    'tests/implications'
  ];
  
  for (const dir of searchDirs) {
    const fullDir = path.join(projectPath, dir);
    if (fs.existsSync(fullDir)) {
      try {
        for (const file of fs.readdirSync(fullDir)) {
          if (file.endsWith('Implications.js') || file.includes('Implication')) {
            files.push({
              path: path.join(dir, file),
              name: file.replace('.js', '')
            });
          }
        }
      } catch (e) {}
    }
  }
  return files;
}

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
// CONTEXT BUILDING
// ═══════════════════════════════════════════════════════════════════════════

function buildImplicationsContext(index) {
  if (!index) return '';
  
  const lines = ['=== EXISTING STATES ===\n'];
  const stateMap = new Map();
  
  for (const state of (index.states || [])) {
    if (state.type !== 'state') continue;
    const status = state.metadata?.status;
    if (!status || stateMap.has(status)) continue;
    stateMap.set(status, { status, file: state.metadata?.file, validations: [] });
  }
  
  for (const [status, data] of stateMap) {
    lines.push(`- ${status} (${data.file || 'unknown'})`);
  }
  
  lines.push('\n=== EXISTING TRANSITIONS ===');
  for (const trans of (index.transitions || [])) {
    const from = trans.metadata?.from;
    const to = trans.metadata?.to;
    const event = trans.metadata?.event;
    if (from && to && event) {
      lines.push(`- ${from} --[${event}]--> ${to}`);
    }
  }
  
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
// IMPLICATION FILE GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateImplicationFile(state, poms) {
  const { status, statusLabel, entity, platforms, previousState, transitionEvent, validations } = state;
  
  const className = status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Implications';
  const timestamp = new Date().toISOString();
  
  // Build UI sections
  const uiSections = {};
  
  for (const val of (validations || [])) {
    const platform = val.platform || 'manager';
    const screen = val.screen || 'DefaultScreen';
    
    if (!uiSections[platform]) uiSections[platform] = {};
    if (!uiSections[platform][screen]) {
      let instance = screen.charAt(0).toLowerCase() + screen.slice(1);
      uiSections[platform][screen] = {
        description: `${screen} validations for ${statusLabel}`,
        screen: screen.replace('Screen', '.screen'),
        instance: instance,
        order: Object.keys(uiSections[platform]).length,
        blocks: []
      };
    }
    
    const { block } = generateFullBlock(val, poms);
    block.order = uiSections[platform][screen].blocks.length;
    uiSections[platform][screen].blocks.push(block);
  }
  
  // Format UI sections as code
  let uiCode = '';
  for (const [platform, screens] of Object.entries(uiSections)) {
    uiCode += `      ${platform}: {\n`;
    for (const [screenName, screenData] of Object.entries(screens)) {
      uiCode += `        ${screenName}: {\n`;
      uiCode += `          description: "${screenData.description}",\n`;
      uiCode += `          screen: "${screenData.screen}",\n`;
      uiCode += `          instance: "${screenData.instance}",\n`;
      uiCode += `          order: ${screenData.order},\n`;
      uiCode += `          blocks: [\n`;
      for (const block of screenData.blocks) {
        uiCode += formatBlockAsCode(block).split('\n').map(l => '            ' + l).join('\n');
        uiCode += ',\n';
      }
      uiCode += `          ]\n`;
      uiCode += `        },\n`;
    }
    uiCode += `      },\n`;
  }
  
  const file = `// Auto-generated by Implications Framework
// Created: ${timestamp}

/**
 * ${className}
 *
 * Status: ${status}
 * Platforms: ${platforms.join(', ')}
 */
class ${className} {
  static xstateConfig = {
    id: "${status}",
    meta: {
      status: "${status}",
      entity: "${entity}",
      statusLabel: "${statusLabel}",
      setup: [{
        testFile: "tests/implications/${entity}s/status/${className.replace('Implications', '')}Via${previousState ? previousState.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') : 'Previous'}-${transitionEvent || 'TRANSITION'}-UNIT.spec.js",
        actionName: "${status.replace(/_/g, '')}Via${previousState ? previousState.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') : 'Previous'}",
        platform: "${platforms[0] || 'manager'}",
        previousStatus: "${previousState || 'previous_state'}"
      }]
    },
    on: {
      // Add transitions to next states here
      // NEXT_EVENT: { target: "next_state", platforms: ["manager", "dancer"] }
    },
    entry: {
      status: "${status}",
      statusLabel: "${statusLabel}"
    }
  };
  
  static mirrorsOn = {
    description: "${statusLabel} state validations",
    triggeredBy: [{
      description: "Trigger ${status} state",
      platform: "${platforms[0] || 'manager'}",
      action: async (testDataPath, options = {}) => {
        // TODO: Implement trigger action
        throw new Error("Not implemented yet");
      }
    }],
    UI: {
${uiCode}    }
  };
  
  static meta = {
    status: "${status}",
    entity: "${entity}",
    statusLabel: "${statusLabel}"
  };
}

module.exports = ${className};
`;

  return { className, fileName: `${className}.js`, content: file };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are a test automation engineer for an implications-based testing framework.

You can do TWO things:
1. Generate VALIDATION BLOCKS for existing states
2. Generate NEW STATE IMPLICATIONS (complete implication files)

Detect what the user needs:
- If they mention "create state", "new state", "need state for", "implication for" → Generate new implications
- If they mention "validate", "check", "test that", "when X happens" → Generate validation blocks
- If they ask for a flow like "A → B → C" → Generate the missing state implications

FOR NEW STATE IMPLICATIONS:
When user asks for new states, analyze:
1. The flow (what comes before, what comes after)
2. What entity it belongs to (booking, dancer, club, etc.)
3. What platforms need coverage (manager, dancer, web)
4. What validations should exist for this state

Return newStates array with:
- status: snake_case state name
- statusLabel: Human readable name
- entity: booking, dancer, club, etc.
- platforms: ["manager", "dancer", "web"]
- previousState: state that leads to this one
- transitionEvent: TRANSITION_NAME that gets here
- validations: array of validation blocks for this state

FOR VALIDATION BLOCKS:
Use conditions to define WHEN blocks run.
- conditions: [{field, operator, value}]
- Operators: equals, notEquals, truthy, falsy, contains

Example newStates response:
{
  "needsNewStates": true,
  "newStates": [
    {
      "status": "booking_checked_in",
      "statusLabel": "Booking Checked In",
      "entity": "booking",
      "platforms": ["manager", "dancer"],
      "previousState": "booking_accepted",
      "transitionEvent": "CHECK_IN",
      "validations": [
        { "platform": "manager", "screen": "ManageBookingsScreen", "method": "fieldBookingStatus", "args": ["ctx.data.booking", "checked_in"], "label": "Booking shows checked-in status" },
        { "platform": "dancer", "screen": "BookingDetailsScreen", "method": "statusText", "args": ["CHECKED IN"], "label": "Dancer sees checked-in status" }
      ]
    }
  ]
}`;

const OUTPUT_FORMAT = `{
  "understanding": "What the user is asking for",
  
  "needsNewStates": true/false,
  
  "newStates": [
    {
      "status": "snake_case_status",
      "statusLabel": "Human Readable Label",
      "entity": "booking",
      "platforms": ["manager", "dancer"],
      "previousState": "previous_state",
      "transitionEvent": "TRANSITION_EVENT",
      "validations": [
        {
          "platform": "manager|dancer|web",
          "screen": "ScreenName",
          "method": "methodName",
          "args": ["arg1"],
          "label": "Description",
          "conditions": [{ "field": "path", "operator": "op", "value": "val" }]
        }
      ]
    }
  ],
  
  "recommendations": [
    {
      "platform": "manager",
      "screen": "ScreenName",
      "method": "methodName",
      "args": ["ctx.data.booking"],
      "label": "Description",
      "conditions": [{ "field": "path", "operator": "op", "value": "val" }]
    }
  ],
  
  "newMethods": [
    { "pomClass": "ScreenName", "pomPath": "path", "methodName": "name", "methodCode": "code" }
  ],
  
  "analysis": "Explanation"
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
    
    // Find and include a sample implication file for reference
    const implFiles = findImplicationFiles(projectPath);
    let sampleImplication = '';
    if (implFiles.length > 0) {
      const sample = readImplicationFile(implFiles[0].path, projectPath);
      if (sample) {
        sampleImplication = `\n=== SAMPLE IMPLICATION FILE (${implFiles[0].name}) ===\n${sample.substring(0, 3000)}${sample.length > 3000 ? '\n... (truncated)' : ''}`;
      }
    }

    const userPrompt = `TICKET: ${ticketId ? `[${ticketId}] ` : ''}${ticketText}

${implContext}
${pomContext}
${sampleImplication}

${OUTPUT_FORMAT}

IMPORTANT:
- If user asks for new states, set needsNewStates: true and populate newStates
- Include validations for each new state based on existing POM methods
- For booking states, typical platforms are manager and dancer
- Look at the sample implication file to understand the structure`;

    const llmResponse = await callLLM([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 6000 });

    let parsed = parseJSONSafely(llmResponse);
    if (!parsed) {
      parsed = { understanding: ticketText.substring(0, 100), recommendations: [], newStates: [], analysis: 'Parse error' };
    }

    // Generate implication files for new states
    const newStateFiles = [];
    if (parsed.needsNewStates && parsed.newStates?.length > 0) {
      for (const state of parsed.newStates) {
        const file = generateImplicationFile(state, poms);
        newStateFiles.push({
          status: state.status,
          statusLabel: state.statusLabel,
          className: file.className,
          fileName: file.fileName,
          filePath: `tests/implications/${state.entity}s/status/${file.fileName}`,
          previousState: state.previousState,
          transitionEvent: state.transitionEvent,
          platforms: state.platforms,
          content: file.content
        });
      }
    }

    // Generate validation blocks
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

    res.json({
      ticketId: ticketId || 'TICKET',
      parsed: { 
        feature: parsed.understanding, 
        analysis: parsed.analysis,
        testScenarios: parsed.testScenarios 
      },
      needsNewStates: parsed.needsNewStates || false,
      newStateFiles,
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