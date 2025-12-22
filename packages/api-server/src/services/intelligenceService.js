/**
 * Intelligence Service - Search and Analysis for Implications Framework
 * 
 * Provides:
 * - Auto-indexing from discovery results + direct file parsing
 * - Fast text search across states, transitions, validations
 * - Ticket number lookup (SC-XXXXX, JIRA-XXX)
 * - Field/condition search (find all uses of "manageGroups")
 * - Chain enrichment via TestPlanner integration
 * 
 * @module intelligenceService
 */

import fs from 'fs-extra';
import path from 'path';
import * as parser from '@babel/parser';

// ═══════════════════════════════════════════════════════════════════════════
// INDEX CACHE
// ═══════════════════════════════════════════════════════════════════════════

let cachedIndex = null;
let cacheTimestamp = null;
let cacheProjectPath = null;

/**
 * Get or build the search index
 * 
 * @param {string} projectPath - Path to the guest project
 * @param {Object} options - Options
 * @param {boolean} options.force - Force rebuild even if cached
 * @returns {SearchIndex}
 */
export async function getIndex(projectPath, options = {}) {
  const { force = false } = options;
  
  // Check if cached index is valid
  if (!force && cachedIndex && cacheProjectPath === projectPath) {
    // Check if discovery cache is newer
    const discoveryCachePath = path.join(projectPath, '.implications-framework', 'cache', 'discovery-result.json');
    
    if (fs.existsSync(discoveryCachePath)) {
      const stat = fs.statSync(discoveryCachePath);
      if (stat.mtime <= cacheTimestamp) {
        console.log('📚 Using cached intelligence index');
        return cachedIndex;
      }
    } else {
      // No discovery cache - use in-memory cache
      return cachedIndex;
    }
  }
  
  console.log('🔨 Building fresh intelligence index...');
  
  // Load discovery result
  const discoveryResult = await loadDiscoveryResult(projectPath);
  
  if (!discoveryResult) {
    throw new Error('No discovery result found. Run discovery first.');
  }
  
  // Build index
  cachedIndex = buildSearchIndex(discoveryResult, projectPath);
  cacheTimestamp = new Date();
  cacheProjectPath = projectPath;
  
  // Optionally persist to disk
  await persistIndex(cachedIndex, projectPath);
  
  return cachedIndex;
}

/**
 * Force rebuild the index
 */
export async function rebuildIndex(projectPath) {
  console.log('🔄 Force rebuilding intelligence index...');
  cachedIndex = null;
  cacheTimestamp = null;
  return getIndex(projectPath, { force: true });
}

/**
 * Invalidate the cache (call when implication files change)
 */
export function invalidateCache() {
  console.log('🗑️ Invalidating intelligence cache');
  cachedIndex = null;
  cacheTimestamp = null;
  cacheProjectPath = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE PARSING - Extract mirrorsOn and xstateConfig from source files
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse an implication file and extract mirrorsOn + xstateConfig
 * Uses regex-based extraction for reliability
 */
function parseImplicationFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    
    let mirrorsOn = null;
    let xstateConfig = null;
    
    // Extract xstateConfig using regex + balanced brace matching
    const xstateMatch = code.match(/static\s+xstateConfig\s*=\s*\{/);
    if (xstateMatch) {
      const startIndex = xstateMatch.index + xstateMatch[0].length - 1;
      const extracted = extractBalancedBraces(code, startIndex);
      if (extracted) {
        try {
          // Clean up the code for eval (remove requires, functions, etc.)
          const cleanedCode = cleanForEval(extracted);
          xstateConfig = eval(`(${cleanedCode})`);
        } catch (e) {
          console.log(`⚠️ Could not eval xstateConfig in ${path.basename(filePath)}: ${e.message}`);
          // Try simpler extraction
          xstateConfig = extractSimpleConfig(extracted);
        }
      }
    }
    
    // Extract mirrorsOn using regex + balanced brace matching
    const mirrorsMatch = code.match(/static\s+mirrorsOn\s*=\s*\{/);
    if (mirrorsMatch) {
      const startIndex = mirrorsMatch.index + mirrorsMatch[0].length - 1;
      const extracted = extractBalancedBraces(code, startIndex);
      if (extracted) {
        try {
          const cleanedCode = cleanForEval(extracted);
          mirrorsOn = eval(`(${cleanedCode})`);
        } catch (e) {
          console.log(`⚠️ Could not eval mirrorsOn in ${path.basename(filePath)}: ${e.message}`);
          // Try simpler extraction for UI blocks
          mirrorsOn = extractMirrorsOnSimple(extracted);
        }
      }
    }
    
    return { mirrorsOn, xstateConfig };
  } catch (error) {
    console.error(`❌ Failed to parse ${path.basename(filePath)}:`, error.message);
    return { mirrorsOn: null, xstateConfig: null };
  }
}

/**
 * Extract balanced braces from code starting at given index
 */
function extractBalancedBraces(code, startIndex) {
  if (code[startIndex] !== '{') return null;
  
  let depth = 0;
  let inString = false;
  let stringChar = null;
  let escaped = false;
  
  for (let i = startIndex; i < code.length; i++) {
    const char = code[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      continue;
    }
    
    if (inString) {
      if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
      continue;
    }
    
    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (char === '{') depth++;
    if (char === '}') depth--;
    
    if (depth === 0) {
      return code.substring(startIndex, i + 1);
    }
  }
  
  return null;
}

/**
 * Clean code for safe eval (remove functions, requires, etc.)
 */
function cleanForEval(code) {
  return code
    // Remove async functions
    .replace(/async\s*\([^)]*\)\s*=>\s*\{[^}]*\}/g, 'null')
    .replace(/async\s+function[^{]*\{[^}]*\}/g, 'null')
    // Remove arrow functions
    .replace(/\([^)]*\)\s*=>\s*\{[^}]*\}/g, 'null')
    .replace(/\([^)]*\)\s*=>\s*[^,}\]]+/g, 'null')
    // Remove require statements
    .replace(/require\s*\([^)]+\)/g, 'null')
    // Remove template literals that reference variables
    .replace(/`\$\{[^}]+\}`/g, '"{{dynamic}}"')
    // Keep simple template literals
    .replace(/`([^`$]*)`/g, '"$1"');
}

/**
 * Simple extraction for when eval fails - extract just the meta and on
 */
function extractSimpleConfig(code) {
  const config = {};
  
  // Extract meta
  const metaMatch = code.match(/meta\s*:\s*\{/);
  if (metaMatch) {
    const startIndex = metaMatch.index + metaMatch[0].length - 1;
    const metaCode = extractBalancedBraces(code, startIndex);
    if (metaCode) {
      try {
        config.meta = eval(`(${cleanForEval(metaCode)})`);
      } catch (e) {
        // Extract key fields manually
        config.meta = extractMetaFields(metaCode);
      }
    }
  }
  
  // Extract on (transitions)
  const onMatch = code.match(/\bon\s*:\s*\{/);
  if (onMatch) {
    const startIndex = onMatch.index + onMatch[0].length - 1;
    const onCode = extractBalancedBraces(code, startIndex);
    if (onCode) {
      try {
        config.on = eval(`(${cleanForEval(onCode)})`);
      } catch (e) {
        // Extract transition names at least
        config.on = extractTransitionNames(onCode);
      }
    }
  }
  
  return config;
}

/**
 * Extract key meta fields using regex
 */
function extractMetaFields(code) {
  const meta = {};
  
  const statusMatch = code.match(/status\s*:\s*["']([^"']+)["']/);
  if (statusMatch) meta.status = statusMatch[1];
  
  const statusLabelMatch = code.match(/statusLabel\s*:\s*["']([^"']+)["']/);
  if (statusLabelMatch) meta.statusLabel = statusLabelMatch[1];
  
  const platformMatch = code.match(/platform\s*:\s*["']([^"']+)["']/);
  if (platformMatch) meta.platform = platformMatch[1];
  
  const entityMatch = code.match(/entity\s*:\s*["']([^"']+)["']/);
  if (entityMatch) meta.entity = entityMatch[1];
  
  return meta;
}

/**
 * Extract transition event names
 */
function extractTransitionNames(code) {
  const on = {};
  
  // Match EVENT_NAME: { or EVENT_NAME: "
  const eventMatches = code.matchAll(/(\w+)\s*:\s*[{"]/g);
  for (const match of eventMatches) {
    const eventName = match[1];
    if (eventName !== 'target' && eventName !== 'platforms' && eventName !== 'actionDetails') {
      // Try to extract target
      const targetMatch = code.match(new RegExp(`${eventName}\\s*:\\s*\\{[^}]*target\\s*:\\s*["']([^"']+)["']`));
      const simpleTargetMatch = code.match(new RegExp(`${eventName}\\s*:\\s*["']([^"']+)["']`));
      
      on[eventName] = {
        target: targetMatch?.[1] || simpleTargetMatch?.[1] || 'unknown'
      };
    }
  }
  
  return on;
}

/**
 * Simple mirrorsOn extraction - focus on UI blocks
 */
function extractMirrorsOnSimple(code) {
  const mirrorsOn = { UI: {} };
  
  // Find UI section
  const uiMatch = code.match(/UI\s*:\s*\{/);
  if (!uiMatch) return mirrorsOn;
  
  const startIndex = uiMatch.index + uiMatch[0].length - 1;
  const uiCode = extractBalancedBraces(code, startIndex);
  if (!uiCode) return mirrorsOn;
  
  // Extract platform sections
  const platforms = ['web', 'manager', 'dancer', 'clubApp'];
  for (const platform of platforms) {
    const platformMatch = uiCode.match(new RegExp(`${platform}\\s*:\\s*\\{`));
    if (platformMatch) {
      const platformStart = platformMatch.index + platformMatch[0].length - 1;
      const platformCode = extractBalancedBraces(uiCode, platformStart);
      if (platformCode) {
        try {
          mirrorsOn.UI[platform] = eval(`(${cleanForEval(platformCode)})`);
        } catch (e) {
          // At minimum, extract screen names and blocks
          mirrorsOn.UI[platform] = extractScreenBlocks(platformCode);
        }
      }
    }
  }
  
  return mirrorsOn;
}

/**
 * Extract screen blocks from platform code
 */
function extractScreenBlocks(code) {
  const screens = {};
  
  // Match ScreenName: { or ScreenName: [
  const screenMatches = code.matchAll(/(\w+Screen|\w+)\s*:\s*[\[{]/g);
  
  for (const match of screenMatches) {
    const screenName = match[0].split(':')[0].trim();
    if (screenName.length > 2) {
      screens[screenName] = { blocks: [] };
      
      // Try to find blocks within this screen
      const blockMatches = code.matchAll(/\{[^{}]*id\s*:\s*["']([^"']+)["'][^{}]*label\s*:\s*["']([^"']+)["'][^{}]*\}/g);
      for (const blockMatch of blockMatches) {
        screens[screenName].blocks.push({
          id: blockMatch[1],
          label: blockMatch[2]
        });
      }
      
      // Find conditions with field checks
      const conditionMatches = code.matchAll(/field\s*:\s*["']([^"']+)["']/g);
      for (const condMatch of conditionMatches) {
        if (!screens[screenName].conditions) {
          screens[screenName].conditions = [];
        }
        screens[screenName].conditions.push({
          field: condMatch[1]
        });
      }
    }
  }
  
  return screens;
}

// ═══════════════════════════════════════════════════════════════════════════
// INDEX BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build searchable index from discovery result + file parsing
 * 
 * @param {Object} discoveryResult - From discoverProject()
 * @param {string} projectPath - Project root path
 * @returns {SearchIndex} Searchable index
 */
export function buildSearchIndex(discoveryResult, projectPath) {
  const startTime = Date.now();
  
  const index = {
    // Document collections
    states: [],
    transitions: [],
    validations: [],
    conditions: [],
    
    // Quick lookup maps
    byState: new Map(),
    byField: new Map(),
    byTicket: new Map(),
    byEvent: new Map(),
    
    // Inverted index for fast text search
    invertedIndex: new Map(),
    
    // Pre-computed chains (populated on-demand)
    chainCache: new Map(),
    
    // Metadata
    buildTime: new Date(),
    projectPath: projectPath,
    counts: { states: 0, transitions: 0, validations: 0, conditions: 0 }
  };

  const implications = discoveryResult.files?.implications || [];
  console.log(`📂 Processing ${implications.length} implication files...`);
  
  let parsedCount = 0;
  let errorCount = 0;
  
  for (const imp of implications) {
    const meta = imp.metadata || {};
    const filePath = path.join(projectPath, imp.path);
    
    // ═══════════════════════════════════════════════════════════
    // PARSE THE ACTUAL FILE to get mirrorsOn and xstateConfig
    // ═══════════════════════════════════════════════════════════
    let mirrorsOn = null;
    let xstateConfig = null;
    
    if (fs.existsSync(filePath)) {
      const parsed = parseImplicationFile(filePath);
      mirrorsOn = parsed.mirrorsOn;
      xstateConfig = parsed.xstateConfig;
      
      if (mirrorsOn || xstateConfig) {
        parsedCount++;
      }
    } else {
      console.log(`⚠️ File not found: ${filePath}`);
      errorCount++;
      continue;
    }
    
    const xstateMeta = xstateConfig?.meta || {};
    const status = meta.status || xstateMeta.status;
    
    if (!status) continue;
    
    // ═══════════════════════════════════════════════════════════
    // INDEX STATES
    // ═══════════════════════════════════════════════════════════
    
    const stateDoc = {
      id: status,
      type: 'state',
      text: buildStateText(meta, xstateMeta),
      metadata: {
        status: status,
        statusLabel: xstateMeta.statusLabel || meta.statusLabel || humanize(status),
        platform: xstateMeta.platform || meta.platform || 'unknown',
        entity: xstateMeta.entity || meta.entity || null,
        file: imp.path,
        className: imp.className || meta.className,
        setupCount: (xstateMeta.setup || meta.setup || []).length,
        transitionCount: Object.keys(xstateConfig?.on || {}).length,
        requiredFields: xstateMeta.requiredFields || meta.requiredFields || [],
        requires: xstateMeta.requires || meta.requires || null
      }
    };
    
    index.states.push(stateDoc);
    index.byState.set(status, stateDoc);
    addToInvertedIndex(index.invertedIndex, stateDoc);

    // ═══════════════════════════════════════════════════════════
    // INDEX TRANSITIONS from xstateConfig.on
    // ═══════════════════════════════════════════════════════════
    
    const transitions = xstateConfig?.on || {};
    for (const [event, transition] of Object.entries(transitions)) {
      const t = Array.isArray(transition) ? transition[0] : transition;
      if (!t) continue;
      
      const targetState = typeof t === 'string' ? t : (t.target || null);
      
      const transitionDoc = {
        id: `${status}.${event}`,
        type: 'transition',
        text: buildTransitionText(event, t, status),
        metadata: {
          event: event,
          from: status,
          to: targetState,
          platforms: t.platforms || (t.platform ? [t.platform] : []),
          hasActionDetails: !!(t.actionDetails),
          description: t.actionDetails?.description || '',
          file: imp.path
        }
      };
      
      index.transitions.push(transitionDoc);
      
      // Add to event lookup
      if (!index.byEvent.has(event)) {
        index.byEvent.set(event, []);
      }
      index.byEvent.get(event).push(transitionDoc);
      
      addToInvertedIndex(index.invertedIndex, transitionDoc);
    }

    // ═══════════════════════════════════════════════════════════
    // INDEX VALIDATIONS from mirrorsOn.UI
    // ═══════════════════════════════════════════════════════════
    
    const mirrorsUI = mirrorsOn?.UI || {};
    
    for (const [platform, screens] of Object.entries(mirrorsUI)) {
      if (!screens || typeof screens !== 'object') continue;
      
      for (const [screenName, screenDef] of Object.entries(screens)) {
        // Handle both array and object screen definitions
        const defsArray = Array.isArray(screenDef) ? screenDef : [screenDef];
        
        for (let defIndex = 0; defIndex < defsArray.length; defIndex++) {
          const def = defsArray[defIndex];
          if (!def || typeof def !== 'object') continue;
          
          // Index the screen itself
          const screenDoc = {
            id: `${status}.${platform}.${screenName}.${defIndex}`,
            type: 'validation',
            text: `${screenName} ${platform} ${def.description || ''} ${def.screen || ''}`,
            metadata: {
              state: status,
              platform: platform,
              screen: screenName,
              description: def.description || '',
              hasBlocks: !!(def.blocks?.length),
              file: imp.path
            }
          };
          
          index.validations.push(screenDoc);
          addToInvertedIndex(index.invertedIndex, screenDoc);
          
          // ═══════════════════════════════════════════════════════
          // INDEX BLOCKS within the screen
          // ═══════════════════════════════════════════════════════
          const blocks = def.blocks || [];
          for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
            const block = blocks[blockIndex];
            if (!block) continue;
            
            const blockId = block.id || `block_${blockIndex}`;
            
            const blockDoc = {
              id: `${status}.${platform}.${screenName}.${blockId}`,
              type: 'validation',
              text: `${block.label || ''} ${block.type || ''} ${screenName} ${platform}`,
              metadata: {
                state: status,
                platform: platform,
                screen: screenName,
                blockId: blockId,
                blockType: block.type || 'unknown',
                label: block.label || '',
                hasConditions: !!(block.conditions?.blocks?.length),
                file: imp.path
              }
            };
            
            index.validations.push(blockDoc);
            addToInvertedIndex(index.invertedIndex, blockDoc);
            
            // Extract ticket numbers from label
            const tickets = extractTicketNumbers(block.label);
            for (const ticket of tickets) {
              if (!index.byTicket.has(ticket)) {
                index.byTicket.set(ticket, []);
              }
              index.byTicket.get(ticket).push(blockDoc);
            }

            // ═══════════════════════════════════════════════════════
            // INDEX CONDITIONS within blocks
            // ═══════════════════════════════════════════════════════
            if (block.conditions?.blocks) {
              for (const condBlock of block.conditions.blocks) {
                const checks = condBlock.data?.checks || [];
                for (let checkIndex = 0; checkIndex < checks.length; checkIndex++) {
                  const check = checks[checkIndex];
                  if (!check.field) continue;
                  
                  const checkId = check.id || `chk_${checkIndex}`;
                  
                  const conditionDoc = {
                    id: `${status}.${blockId}.${checkId}`,
                    type: 'condition',
                    text: `${check.field} ${check.operator || 'equals'} ${check.value}`,
                    metadata: {
                      state: status,
                      blockId: blockId,
                      blockLabel: block.label || '',
                      screen: screenName,
                      platform: platform,
                      field: check.field,
                      operator: check.operator || 'equals',
                      value: check.value,
                      file: imp.path
                    }
                  };
                  
                  index.conditions.push(conditionDoc);
                  
                  // Add to field lookup (by last segment of field path)
                  const fieldKey = check.field.split('.').pop().toLowerCase();
                  if (!index.byField.has(fieldKey)) {
                    index.byField.set(fieldKey, []);
                  }
                  index.byField.get(fieldKey).push(conditionDoc);
                  
                  // Also index full field path
                  const fullFieldKey = check.field.toLowerCase();
                  if (!index.byField.has(fullFieldKey)) {
                    index.byField.set(fullFieldKey, []);
                  }
                  index.byField.get(fullFieldKey).push(conditionDoc);
                  
                  addToInvertedIndex(index.invertedIndex, conditionDoc);
                }
              }
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // INDEX SETUP ENTRIES
    // ═══════════════════════════════════════════════════════════
    
    const setupEntries = xstateMeta.setup || meta.setup || [];
    const setupArray = Array.isArray(setupEntries) ? setupEntries : [setupEntries];
    
    for (let setupIndex = 0; setupIndex < setupArray.length; setupIndex++) {
      const setup = setupArray[setupIndex];
      if (!setup || setup.isObserver || setup.mode === 'observer') continue;
      
      const setupDoc = {
        id: `${status}.setup.${setup.previousStatus || 'initial'}.${setup.platform || 'unknown'}.${setupIndex}`,
        type: 'setup',
        text: `How to reach ${xstateMeta.statusLabel || humanize(status)} from ${setup.previousStatus || 'initial'} via ${setup.platform || 'unknown'}`,
        metadata: {
          status: status,
          statusLabel: xstateMeta.statusLabel || humanize(status),
          platform: setup.platform || 'unknown',
          previousStatus: setup.previousStatus || 'initial',
          testFile: setup.testFile,
          actionName: setup.actionName,
          file: imp.path
        }
      };
      
      index.states.push(setupDoc);
      addToInvertedIndex(index.invertedIndex, setupDoc);
    }
  }

  // Also index transitions from the global transitions array (from discovery)
  const globalTransitions = discoveryResult.transitions || [];
  for (const t of globalTransitions) {
    const existingId = `${t.from}.${t.event}`;
    if (!index.transitions.find(tr => tr.id === existingId)) {
      const transitionDoc = {
        id: `${existingId}.global`,
        type: 'transition',
        text: `${t.event} from ${t.from} to ${t.to}`.replace(/_/g, ' '),
        metadata: {
          event: t.event,
          from: t.from,
          to: t.to,
          platforms: t.platforms || [],
          hasActionDetails: false,
          file: t.file || 'unknown'
        }
      };
      
      index.transitions.push(transitionDoc);
      addToInvertedIndex(index.invertedIndex, transitionDoc);
    }
  }

  // Update counts
  index.counts = {
    states: index.states.length,
    transitions: index.transitions.length,
    validations: index.validations.length,
    conditions: index.conditions.length
  };

  const elapsed = Date.now() - startTime;
  
  console.log(`📚 Built intelligence index in ${elapsed}ms:`);
  console.log(`   Files parsed: ${parsedCount}/${implications.length}`);
  console.log(`   States: ${index.counts.states}`);
  console.log(`   Transitions: ${index.counts.transitions}`);
  console.log(`   Validations: ${index.counts.validations}`);
  console.log(`   Conditions: ${index.counts.conditions}`);
  console.log(`   Tickets indexed: ${index.byTicket.size}`);
  console.log(`   Fields indexed: ${index.byField.size}`);
  console.log(`   Events indexed: ${index.byEvent.size}`);
  console.log(`   Inverted index terms: ${index.invertedIndex.size}`);
  
  if (errorCount > 0) {
    console.log(`   ⚠️ Errors: ${errorCount}`);
  }

  return index;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Search the index with fuzzy text matching
 * 
 * @param {SearchIndex} index - The search index
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {SearchResult[]}
 */
export function searchIndex(index, query, options = {}) {
  const {
    limit = 20,
    types = ['states', 'transitions', 'validations'],
    minScore = 3,
    includeConditions = true
  } = options;

  if (!query || query.trim().length === 0) {
    return [];
  }

  // Check for ticket number first (highest priority)
  const ticketMatch = query.match(/[A-Z]+-\d+/i);
  if (ticketMatch) {
    const ticketKey = ticketMatch[0].toUpperCase();
    const ticketResults = index.byTicket.get(ticketKey);
    if (ticketResults?.length) {
      return ticketResults.map(r => ({ 
        ...r, 
        score: 100, 
        matchType: 'ticket',
        matchedOn: ticketKey
      }));
    }
  }

  // Normalize and tokenize query
  const queryTerms = tokenize(query);
  
  if (queryTerms.length === 0) {
    return [];
  }

  const results = [];
  const searchTypes = includeConditions ? [...types, 'conditions'] : types;

  // Use inverted index for fast initial filtering
  const candidateIds = new Set();
  
  for (const term of queryTerms) {
    // Exact term lookup
    const exactMatches = index.invertedIndex.get(term);
    if (exactMatches) {
      exactMatches.forEach(id => candidateIds.add(id));
    }
    
    // Prefix matching for partial terms
    for (const [indexTerm, ids] of index.invertedIndex.entries()) {
      if (indexTerm.startsWith(term) || term.startsWith(indexTerm)) {
        ids.forEach(id => candidateIds.add(id));
      }
    }
  }

  // Also check field lookup for condition searches
  for (const term of queryTerms) {
    const fieldResults = index.byField.get(term);
    if (fieldResults) {
      fieldResults.forEach(r => candidateIds.add(r.id));
    }
  }

  // Score candidates
  const allDocs = [
    ...(searchTypes.includes('states') ? index.states : []),
    ...(searchTypes.includes('transitions') ? index.transitions : []),
    ...(searchTypes.includes('validations') ? index.validations : []),
    ...(searchTypes.includes('conditions') ? index.conditions : []),
  ];

  for (const doc of allDocs) {
    // Skip if not in candidates (for efficiency) - unless we have few candidates
    if (candidateIds.size > 0 && candidateIds.size < 1000 && !candidateIds.has(doc.id)) {
      continue;
    }
    
    const score = scoreDocument(doc, queryTerms, query);
    
    if (score >= minScore) {
      results.push({
        ...doc,
        score,
        matchType: 'text'
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Find all conditions that reference a field
 * 
 * @param {SearchIndex} index
 * @param {string} fieldPattern - Field name or pattern to match
 * @returns {ConditionDocument[]}
 */
export function findByCondition(index, fieldPattern) {
  const pattern = fieldPattern.toLowerCase();
  const results = [];
  const seen = new Set();
  
  // Check field lookup map first (by last segment)
  for (const [field, conditions] of index.byField.entries()) {
    if (field.includes(pattern)) {
      for (const c of conditions) {
        if (!seen.has(c.id)) {
          results.push(c);
          seen.add(c.id);
        }
      }
    }
  }
  
  // Also search full field paths in conditions
  for (const condition of index.conditions) {
    if (!seen.has(condition.id) && 
        condition.metadata.field.toLowerCase().includes(pattern)) {
      results.push(condition);
      seen.add(condition.id);
    }
  }
  
  return results;
}

/**
 * Find validations by ticket number
 * 
 * @param {SearchIndex} index
 * @param {string} ticketId - Ticket number (e.g., "SC-13092")
 * @returns {ValidationDocument[]}
 */
export function findByTicket(index, ticketId) {
  const normalized = ticketId.toUpperCase();
  return index.byTicket.get(normalized) || [];
}

/**
 * Find transitions by event name
 * 
 * @param {SearchIndex} index
 * @param {string} eventName - Event name (e.g., "ACCEPT_BOOKING")
 * @returns {TransitionDocument[]}
 */
export function findByEvent(index, eventName) {
  const normalized = eventName.toUpperCase();
  return index.byEvent.get(normalized) || [];
}

/**
 * Get state details with related info
 * 
 * @param {SearchIndex} index
 * @param {string} status - State status
 * @returns {Object} State with related transitions and validations
 */
export function getStateDetails(index, status) {
  const state = index.byState.get(status);
  if (!state) return null;
  
  // Find all transitions from this state
  const outgoingTransitions = index.transitions.filter(
    t => t.metadata.from === status
  );
  
  // Find all transitions to this state
  const incomingTransitions = index.transitions.filter(
    t => t.metadata.to === status
  );
  
  // Find all validations for this state
  const validations = index.validations.filter(
    v => v.metadata.state === status
  );
  
  // Find all conditions for this state
  const conditions = index.conditions.filter(
    c => c.metadata.state === status
  );
  
  return {
    ...state,
    outgoingTransitions,
    incomingTransitions,
    validations,
    conditions
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAIN ENRICHMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enrich search results with chain information
 * Uses TestPlanner if available
 * 
 * @param {SearchResult[]} results - Search results to enrich
 * @param {string} projectPath - Project path
 * @param {string} testDataPath - Path to test data file
 * @returns {SearchResult[]} Enriched results
 */
export async function enrichWithChains(results, projectPath, testDataPath) {
  const index = await getIndex(projectPath);
  
  const enriched = [];
  
  for (const result of results) {
    // Only enrich state results
    if (result.type !== 'state' || !result.metadata?.status) {
      enriched.push(result);
      continue;
    }
    
    const status = result.metadata.status;
    
    // Check cache first
    if (index.chainCache.has(status)) {
      enriched.push({
        ...result,
        chain: index.chainCache.get(status)
      });
      continue;
    }
    
    // Build simple chain from transitions
    const chain = buildSimpleChain(index, status);
    const chainInfo = {
      steps: chain,
      note: 'Built from transition graph'
    };
    
    // Cache it
    index.chainCache.set(status, chainInfo);
    
    enriched.push({
      ...result,
      chain: chainInfo
    });
  }
  
  return enriched;
}

/**
 * Get prerequisite chain for a state
 * 
 * @param {SearchIndex} index
 * @param {string} status - Target state
 * @param {string} projectPath - Project path
 * @param {Object} testData - Optional test data
 * @returns {Object} Chain information
 */
export async function getChainForState(index, status, projectPath, testData = {}) {
  // Check cache
  if (index.chainCache.has(status)) {
    return index.chainCache.get(status);
  }
  
  const stateDoc = index.byState.get(status);
  if (!stateDoc) {
    return { error: `State ${status} not found` };
  }
  
  // Build simple chain from transitions
  const chain = buildSimpleChain(index, status);
  
  const chainInfo = {
    status,
    steps: chain,
    note: 'Built from transition graph'
  };
  
  // Cache
  index.chainCache.set(status, chainInfo);
  
  return chainInfo;
}

/**
 * Build a simple chain by walking backwards through transitions
 */
function buildSimpleChain(index, targetStatus, visited = new Set()) {
  if (visited.has(targetStatus)) return [];
  visited.add(targetStatus);
  
  const chain = [targetStatus];
  
  // Find transitions leading TO this state
  const incoming = index.transitions.filter(t => t.metadata.to === targetStatus);
  
  if (incoming.length > 0) {
    // Take the first path (could be smarter about this)
    const prev = incoming[0].metadata.from;
    if (prev && prev !== 'initial' && !visited.has(prev)) {
      const prevChain = buildSimpleChain(index, prev, visited);
      return [...prevChain, ...chain];
    }
  }
  
  return chain;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load discovery result from cache
 */
async function loadDiscoveryResult(projectPath) {
  const cachePath = path.join(projectPath, '.implications-framework', 'cache', 'discovery-result.json');
  
  if (fs.existsSync(cachePath)) {
    console.log('📂 Loading discovery cache from:', cachePath);
    return fs.readJsonSync(cachePath);
  }
  
  console.log('⚠️ No discovery cache found at:', cachePath);
  return null;
}

/**
 * Persist index to disk
 */
async function persistIndex(index, projectPath) {
  const cachePath = path.join(projectPath, '.implications-framework', 'cache', 'intelligence-index.json');
  
  // Create a serializable version (Maps → Objects)
  const serializable = {
    states: index.states,
    transitions: index.transitions,
    validations: index.validations,
    conditions: index.conditions,
    counts: index.counts,
    buildTime: index.buildTime.toISOString(),
    projectPath: index.projectPath,
    // Convert Maps to objects for JSON serialization
    byTicket: Object.fromEntries(index.byTicket),
    byField: Object.fromEntries(index.byField),
    byEvent: Object.fromEntries(index.byEvent)
  };
  
  fs.ensureDirSync(path.dirname(cachePath));
  fs.writeJsonSync(cachePath, serializable, { spaces: 2 });
  console.log('💾 Intelligence index persisted to:', cachePath);
}

/**
 * Tokenize text for indexing/searching
 */
function tokenize(text) {
  if (!text) return [];
  
  return text
    .toLowerCase()
    .replace(/[_\-\.]/g, ' ')  // Replace separators with spaces
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .split(/\s+/)
    .filter(t => t.length >= 2); // Min 2 chars
}

/**
 * Add document to inverted index
 */
function addToInvertedIndex(invertedIndex, doc) {
  const terms = tokenize(doc.text);
  
  // Also tokenize ID and key metadata
  const idTerms = tokenize(doc.id);
  const metaTerms = tokenize(doc.metadata?.label || '');
  const fieldTerms = tokenize(doc.metadata?.field || '');
  
  const allTerms = [...terms, ...idTerms, ...metaTerms, ...fieldTerms];
  
  for (const term of allTerms) {
    if (!invertedIndex.has(term)) {
      invertedIndex.set(term, new Set());
    }
    invertedIndex.get(term).add(doc.id);
  }
}

/**
 * Score a document against query terms
 */
function scoreDocument(doc, queryTerms, originalQuery) {
  const text = doc.text.toLowerCase();
  const id = doc.id.toLowerCase();
  let score = 0;

  for (const term of queryTerms) {
    // Exact substring match in text
    if (text.includes(term)) {
      score += 10;
      
      // Bonus for word boundary match
      const wordRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
      if (wordRegex.test(doc.text)) {
        score += 5;
      }
    }
    
    // Match in ID (higher value)
    if (id.includes(term)) {
      score += 12;
    }
    
    // Match in metadata
    const metadata = doc.metadata || {};
    if (metadata.label?.toLowerCase().includes(term)) {
      score += 8;
    }
    if (metadata.description?.toLowerCase().includes(term)) {
      score += 6;
    }
    if (metadata.field?.toLowerCase().includes(term)) {
      score += 15; // High score for field matches
    }
  }

  // Boost certain types based on query context
  if (doc.type === 'validation' && score > 0) {
    score *= 1.1; // Validations often have descriptive labels
  }
  
  if (doc.type === 'condition' && score > 0) {
    score *= 1.2; // Conditions are specific, boost them
  }
  
  // Boost exact phrase match
  if (text.includes(originalQuery.toLowerCase())) {
    score *= 1.5;
  }

  return Math.round(score);
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build searchable text for a state
 */
function buildStateText(meta, xstateMeta) {
  const parts = [
    xstateMeta.statusLabel || meta.statusLabel,
    xstateMeta.status || meta.status,
    (xstateMeta.status || meta.status || '').replace(/_/g, ' '),
    xstateMeta.description || meta.description,
    xstateMeta.platform || meta.platform,
    xstateMeta.entity || meta.entity
  ];
  
  // Include requires as searchable
  if (xstateMeta.requires) {
    parts.push(`requires: ${JSON.stringify(xstateMeta.requires)}`);
  }
  
  // Include required fields
  if (xstateMeta.requiredFields?.length) {
    parts.push(`fields: ${xstateMeta.requiredFields.join(' ')}`);
  }
  
  return parts.filter(Boolean).join(' | ');
}

/**
 * Build searchable text for a transition
 */
function buildTransitionText(event, transition, fromStatus) {
  const t = typeof transition === 'string' ? { target: transition } : transition;
  
  const parts = [
    event,
    event.replace(/_/g, ' '),
    `from ${fromStatus}`,
    `to ${t.target || 'unknown'}`,
    t.actionDetails?.description
  ];
  
  // Include step descriptions
  const steps = t.actionDetails?.steps || [];
  for (const step of steps) {
    if (step.description) {
      parts.push(step.description);
    }
  }
  
  // Include platforms
  const platforms = t.platforms || (t.platform ? [t.platform] : []);
  if (platforms.length) {
    parts.push(`platform: ${platforms.join(' ')}`);
  }
  
  return parts.filter(Boolean).join(' | ');
}

/**
 * Extract ticket numbers from text
 */
function extractTicketNumbers(text) {
  if (!text) return [];
  
  // Match patterns like SC-13092, JIRA-123, BUG-456, PP-1234
  const matches = text.match(/[A-Z]+-\d+/g) || [];
  return [...new Set(matches)]; // Dedupe
}

/**
 * Humanize a status string
 */
function humanize(status) {
  if (!status) return '';
  return status
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  // Core functions
  getIndex,
  rebuildIndex,
  invalidateCache,
  buildSearchIndex,
  
  // Search functions
  searchIndex,
  findByCondition,
  findByTicket,
  findByEvent,
  getStateDetails,
  
  // Chain functions
  enrichWithChains,
  getChainForState
};