/**
 * Intelligence Service - Search and Analysis for Implications Framework
 * 
 * Provides:
 * - Auto-indexing from discovery results (zero manual work)
 * - Fast text search across states, transitions, validations
 * - Ticket number lookup (SC-XXXXX, JIRA-XXX)
 * - Field/condition search (find all uses of "manageGroups")
 * - Chain enrichment via TestPlanner integration
 * 
 * @module intelligenceService
 */

import fs from 'fs-extra';
import path from 'path';

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
// INDEX BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build searchable index from discovery result
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
  
  for (const imp of implications) {
    const meta = imp.metadata || {};
    const xstate = meta.xstateConfig || {};
    const xstateMeta = xstate.meta || {};
    
    // ═══════════════════════════════════════════════════════════
    // INDEX STATES
    // ═══════════════════════════════════════════════════════════
    
    const status = meta.status || xstateMeta.status;
    if (!status) continue;
    
    const stateDoc = {
      id: status,
      type: 'state',
      text: buildStateText(meta, xstateMeta),
      metadata: {
        status: status,
        statusLabel: meta.statusLabel || xstateMeta.statusLabel || humanize(status),
        platform: meta.platform || xstateMeta.platform || 'unknown',
        entity: meta.entity || null,
        file: imp.path,
        className: imp.className || meta.className,
        setupCount: (xstateMeta.setup || []).length,
        transitionCount: Object.keys(xstate.on || {}).length,
        requiredFields: xstateMeta.requiredFields || [],
        requires: xstateMeta.requires || null
      }
    };
    
    index.states.push(stateDoc);
    index.byState.set(status, stateDoc);
    addToInvertedIndex(index.invertedIndex, stateDoc);

    // ═══════════════════════════════════════════════════════════
    // INDEX TRANSITIONS
    // ═══════════════════════════════════════════════════════════
    
    const transitions = xstate.on || {};
    for (const [event, transition] of Object.entries(transitions)) {
      const t = Array.isArray(transition) ? transition[0] : transition;
      if (!t) continue;
      
      const transitionDoc = {
        id: `${status}.${event}`,
        type: 'transition',
        text: buildTransitionText(event, t, status),
        metadata: {
          event: event,
          from: status,
          to: t.target || t,
          platforms: extractPlatforms(t),
          hasActionDetails: !!(t.actionDetails),
          description: t.actionDetails?.description || t.meta?.description || '',
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
    // INDEX VALIDATIONS (UI blocks)
    // ═══════════════════════════════════════════════════════════
    
    const mirrorsUI = meta.mirrorsOn?.UI || {};
    
    for (const [platform, screens] of Object.entries(mirrorsUI)) {
      for (const [screenName, screenDefs] of Object.entries(screens)) {
        // Handle both array and object screen definitions
        const defsArray = Array.isArray(screenDefs) ? screenDefs : [screenDefs];
        
        for (const def of defsArray) {
          if (!def) continue;
          
          // Index the screen itself
          const screenDoc = {
            id: `${status}.${platform}.${screenName}`,
            type: 'validation',
            text: buildScreenText(def, screenName, platform),
            metadata: {
              state: status,
              platform: platform,
              screen: screenName,
              blockId: null,
              blockType: 'screen',
              description: def.description || '',
              hasConditions: !!(def.conditions?.blocks?.length),
              visible: def.visible || [],
              hidden: def.hidden || [],
              file: imp.path
            }
          };
          
          index.validations.push(screenDoc);
          addToInvertedIndex(index.invertedIndex, screenDoc);
          
          // Index individual blocks within the screen
          const blocks = def.blocks || [];
          for (const block of blocks) {
            if (!block || !block.id) continue;
            
            const validationDoc = {
              id: `${status}.${platform}.${screenName}.${block.id}`,
              type: 'validation',
              text: buildValidationText(block, screenName, def),
              metadata: {
                state: status,
                platform: platform,
                screen: screenName,
                blockId: block.id,
                blockType: block.type || 'unknown',
                label: block.label || '',
                hasConditions: !!(block.conditions?.blocks?.length),
                file: imp.path
              }
            };
            
            index.validations.push(validationDoc);
            addToInvertedIndex(index.invertedIndex, validationDoc);
            
            // Extract ticket numbers from label
            const tickets = extractTicketNumbers(block.label);
            for (const ticket of tickets) {
              if (!index.byTicket.has(ticket)) {
                index.byTicket.set(ticket, []);
              }
              index.byTicket.get(ticket).push(validationDoc);
            }

            // Index conditions within blocks
            if (block.conditions?.blocks) {
              for (const condBlock of block.conditions.blocks) {
                const checks = condBlock.data?.checks || [];
                for (const check of checks) {
                  if (!check.field) continue;
                  
                  const conditionDoc = {
                    id: `${block.id}.${check.id || 'chk_' + index.conditions.length}`,
                    type: 'condition',
                    text: `${check.field} ${check.operator || 'equals'} ${check.value}`,
                    metadata: {
                      state: status,
                      blockId: block.id,
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
                  
                  addToInvertedIndex(index.invertedIndex, conditionDoc);
                }
              }
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // INDEX SETUP ENTRIES (how to reach this state)
    // ═══════════════════════════════════════════════════════════
    
    const setupEntries = xstateMeta.setup || [];
    for (const setup of setupEntries) {
      if (setup.isObserver || setup.mode === 'observer') continue;
      
      const setupDoc = {
        id: `${status}.setup.${setup.previousStatus || 'initial'}`,
        type: 'setup',
        text: `How to reach ${meta.statusLabel || status} from ${setup.previousStatus || 'initial'} via ${setup.platform || 'unknown'}`,
        metadata: {
          status: status,
          statusLabel: meta.statusLabel || humanize(status),
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

  // Also index transitions from the global transitions array
  const globalTransitions = discoveryResult.transitions || [];
  for (const t of globalTransitions) {
    const existingId = `${t.from}.${t.event}`;
    if (!index.transitions.find(tr => tr.id === existingId)) {
      const transitionDoc = {
        id: existingId,
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
  console.log(`   States: ${index.counts.states}`);
  console.log(`   Transitions: ${index.counts.transitions}`);
  console.log(`   Validations: ${index.counts.validations}`);
  console.log(`   Conditions: ${index.counts.conditions}`);
  console.log(`   Tickets indexed: ${index.byTicket.size}`);
  console.log(`   Fields indexed: ${index.byField.size}`);
  console.log(`   Events indexed: ${index.byEvent.size}`);
  console.log(`   Inverted index terms: ${index.invertedIndex.size}`);

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
    includeConditions = false
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

  // Score candidates
  const allDocs = [
    ...(searchTypes.includes('states') ? index.states : []),
    ...(searchTypes.includes('transitions') ? index.transitions : []),
    ...(searchTypes.includes('validations') ? index.validations : []),
    ...(searchTypes.includes('conditions') ? index.conditions : []),
  ];

  for (const doc of allDocs) {
    // Skip if not in candidates (for efficiency)
    if (candidateIds.size > 0 && !candidateIds.has(doc.id)) {
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
  
  // Also search full field paths
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
  
  // Check if we can get TestPlanner
  let TestPlanner = null;
  try {
    const testPlannerPath = path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js');
    if (fs.existsSync(testPlannerPath)) {
      // Dynamic import for CommonJS module
      TestPlanner = require(testPlannerPath);
    }
  } catch (e) {
    console.log('⚠️ TestPlanner not available for chain enrichment:', e.message);
  }
  
  // Load test data for chain analysis
  let testData = {};
  if (testDataPath && fs.existsSync(testDataPath)) {
    try {
      testData = fs.readJsonSync(testDataPath);
    } catch (e) {
      console.log('⚠️ Could not load test data:', e.message);
    }
  }
  
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
    
    // Try to analyze chain if TestPlanner available
    if (TestPlanner?.analyze) {
      try {
        const implPath = path.join(projectPath, result.metadata.file);
        
        // Clear require cache to get fresh module
        delete require.cache[require.resolve(implPath)];
        const ImplClass = require(implPath);
        
        const analysis = TestPlanner.analyze(ImplClass, testData, { 
          verbose: false,
          skipExecution: true 
        });
        
        const chainInfo = {
          ready: analysis.ready || false,
          steps: (analysis.chain || []).map(s => s.status || s),
          segments: analysis.segments?.length || 0,
          currentStatus: analysis.currentStatus
        };
        
        // Cache it
        index.chainCache.set(status, chainInfo);
        
        enriched.push({
          ...result,
          chain: chainInfo
        });
      } catch (e) {
        console.log(`⚠️ Could not analyze chain for ${status}:`, e.message);
        enriched.push({ 
          ...result, 
          chain: null, 
          chainError: e.message 
        });
      }
    } else {
      // No TestPlanner - add basic chain info from transitions
      const incomingTransitions = index.transitions.filter(
        t => t.metadata.to === status
      );
      
      const chainInfo = {
        ready: null,
        steps: incomingTransitions.map(t => t.metadata.from).filter(Boolean),
        segments: null,
        note: 'TestPlanner not available - showing direct predecessors only'
      };
      
      enriched.push({
        ...result,
        chain: chainInfo
      });
    }
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
  
  // Try TestPlanner
  const stateDoc = index.byState.get(status);
  if (!stateDoc) {
    return { error: `State ${status} not found` };
  }
  
  try {
    const TestPlanner = require(path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js'));
    const implPath = path.join(projectPath, stateDoc.metadata.file);
    
    delete require.cache[require.resolve(implPath)];
    const ImplClass = require(implPath);
    
    const analysis = TestPlanner.analyze(ImplClass, testData, { 
      verbose: false,
      skipExecution: true 
    });
    
    const chainInfo = {
      status,
      ready: analysis.ready || false,
      steps: (analysis.chain || []).map(s => ({
        status: s.status || s,
        platform: s.platform
      })),
      segments: analysis.segments || [],
      currentStatus: analysis.currentStatus,
      needsExecution: !analysis.ready
    };
    
    // Cache
    index.chainCache.set(status, chainInfo);
    
    return chainInfo;
  } catch (e) {
    console.log(`⚠️ Could not get chain for ${status}:`, e.message);
    
    // Fallback: Build simple chain from transitions
    const chain = buildSimpleChain(index, status);
    return {
      status,
      steps: chain,
      note: 'Built from transition graph (TestPlanner unavailable)',
      error: e.message
    };
  }
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
  
  for (const term of terms) {
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
  }

  // Boost certain types based on query context
  if (doc.type === 'validation' && score > 0) {
    score *= 1.1; // Validations often have descriptive labels
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
    meta.statusLabel || xstateMeta.statusLabel,
    meta.status || xstateMeta.status,
    (meta.status || xstateMeta.status || '').replace(/_/g, ' '),
    meta.description,
    xstateMeta.description,
    meta.platform || xstateMeta.platform,
    meta.entity
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
  const parts = [
    event,
    event.replace(/_/g, ' '),
    `from ${fromStatus}`,
    `to ${transition.target || transition}`,
    transition.actionDetails?.description,
    transition.meta?.description
  ];
  
  // Include step descriptions
  const steps = transition.actionDetails?.steps || [];
  for (const step of steps) {
    if (step.description) {
      parts.push(step.description);
    }
  }
  
  // Include platforms
  const platforms = extractPlatforms(transition);
  if (platforms.length) {
    parts.push(`platform: ${platforms.join(' ')}`);
  }
  
  return parts.filter(Boolean).join(' | ');
}

/**
 * Build searchable text for a screen definition
 */
function buildScreenText(def, screenName, platform) {
  const parts = [
    screenName,
    screenName.replace(/([A-Z])/g, ' $1').trim(), // camelCase to spaces
    platform,
    def.description
  ];
  
  // Include visible/hidden elements
  if (def.visible?.length) {
    parts.push(`visible: ${def.visible.join(' ')}`);
  }
  if (def.hidden?.length) {
    parts.push(`hidden: ${def.hidden.join(' ')}`);
  }
  
  return parts.filter(Boolean).join(' | ');
}

/**
 * Build searchable text for a validation block
 */
function buildValidationText(block, screenName, screenDef) {
  const parts = [
    block.label,
    screenName,
    screenDef.description,
    block.type
  ];
  
  // Include condition fields
  if (block.conditions?.blocks) {
    for (const condBlock of block.conditions.blocks) {
      for (const check of (condBlock.data?.checks || [])) {
        parts.push(`${check.field} ${check.operator || 'equals'} ${check.value}`);
      }
    }
  }
  
  return parts.filter(Boolean).join(' | ');
}

/**
 * Extract platforms from a transition definition
 */
function extractPlatforms(transition) {
  if (!transition) return [];
  
  if (transition.platforms) {
    return Array.isArray(transition.platforms) ? transition.platforms : [transition.platforms];
  }
  
  if (transition.meta?.platform) {
    return [transition.meta.platform];
  }
  
  if (transition.actionDetails?.platform) {
    return [transition.actionDetails.platform];
  }
  
  return [];
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