// tests/ai-testing/utils/TestPlanner.js
// Version: 4.2 - Multi-Platform, Loop Transitions, Requires Mismatch Detection - THIS IS NEW FILE THAT WORKS ON PLAYWRIGHT BUT STILL NOT ON APPIUM
// 
// CHANGELOG from v3.0:
// - Fixed _extractEventFromFilename (was breaking uppercase events)
// - Added loop transition support
// - Added _findSetupEntry with requires matching
// - Added requires mismatch warning system
// - Added _clearDataCaches helper
// - Better _selectTransition with requires checking
// - Added PREFLIGHT_COMPLETED environment check
// - Fixed cache clearing on module load

// NUCLEAR CACHE CLEAR - Ensures fresh implication loads
const implCacheKeys = Object.keys(require.cache).filter(k => 
  k.includes('Implications') || k.includes('implications')
);
implCacheKeys.forEach(key => delete require.cache[key]);

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class TestPlanner {
  
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose ?? true,
      config: options.config || null,
      stateRegistry: options.stateRegistry || null
    };
    
    if (!this.options.stateRegistry) {
      this.stateRegistry = this.loadStateRegistry();
    } else {
      this.stateRegistry = this.options.stateRegistry;
    }
  }
  
  loadStateRegistry() {
    try {
      const REGISTRY_PATH = path.join(process.cwd(), 'tests/implications/.state-registry.json');
      
      if (fs.existsSync(REGISTRY_PATH)) {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        if (this.options.verbose) {
          console.log(`📋 Loaded state registry: ${REGISTRY_PATH}`);
          console.log(`   Total entries: ${Object.keys(registry).length}`);
        }
        return registry;
      }
      
      if (this.options.verbose) {
        console.log('⚠️  No state registry found at:', REGISTRY_PATH);
      }
      return {};
      
    } catch (error) {
      if (this.options.verbose) {
        console.log(`⚠️  Error loading state registry: ${error.message}`);
      }
      return {};
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Get current status from testData
  // ═══════════════════════════════════════════════════════════
static _getCurrentStatus(testData, targetImplication = null) {
  const meta = targetImplication?.xstateConfig?.meta || targetImplication?.meta;
  
  console.log(`🔍 _getCurrentStatus DEBUG:`);
  console.log(`   targetImplication: ${targetImplication?.name || 'none'}`);
  console.log(`   meta.entity: ${meta?.entity || 'none'}`);
  console.log(`   testData.status: ${testData?.status}`);
  console.log(`   testData.booking?.status: ${testData?.booking?.status}`);
  
  if (meta?.entity) {
    const entity = meta.entity;
    const entityStatus = testData[entity]?.status || null;
    console.log(`   Entity lookup: testData[${entity}]?.status = ${entityStatus}`);
    
    if (entityStatus) {
      return entityStatus;
    }
  }
  
  return testData.status || testData._currentStatus || 'initial';
}

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Find the setup entry for the current test
  // Supports multiple setup entries with different requires
  // ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// STATIC HELPER: Find the setup entry for the current test
// Supports multiple setup entries with different requires
// ═══════════════════════════════════════════════════════════
static _findSetupEntry(meta, options = {}) {
  const { currentTestFile, explicitEvent, testData } = options;
  
  console.log(`\n🔍 _findSetupEntry DEBUG:`);
  console.log(`   testData passed: ${testData ? 'YES' : 'NO'}`);
  console.log(`   testData.returnFlight: ${testData?.returnFlight}`);
  console.log(`   setup entries: ${meta.setup?.length || 0}`);
  console.log(`   explicitEvent: ${explicitEvent || 'none'}`);
  
  if (!meta.setup || meta.setup.length === 0) {
    return null;
  }
  
  const verbose = process.env.DEBUG_SETUP_ENTRY === 'true';
  
  // ✅ Helper function to resolve dot-notation paths like "booking.status"
  const resolvePath = (obj, path) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };
  
// STEP 0: Filter and prioritize setup entries by requires
const entriesWithMatchingRequires = meta.setup.filter(entry => {
  if (!entry.requires || !testData) return false;
  
  return Object.entries(entry.requires).every(([field, expected]) => {
    const actual = resolvePath(testData, field);
    
    // ✅ Handle special object requirements
    if (typeof expected === 'object' && expected !== null) {
      // { exists: true }
      if (expected.exists === true) {
        const matches = actual !== undefined && actual !== null;
        if (verbose) console.log(`   🔍 Checking ${field}: exists=${matches} → ${matches ? '✅' : '❌'}`);
        return matches;
      }
      // { exists: false }
      if (expected.exists === false) {
        const matches = actual === undefined || actual === null;
        if (verbose) console.log(`   🔍 Checking ${field}: notExists=${matches} → ${matches ? '✅' : '❌'}`);
        return matches;
      }
      // { oneOf: [...] }
      if (Array.isArray(expected.oneOf)) {
        const matches = expected.oneOf.includes(actual);
        if (verbose) console.log(`   🔍 Checking ${field}: actual="${actual}" oneOf=${JSON.stringify(expected.oneOf)} → ${matches ? '✅' : '❌'}`);
        return matches;
      }
      // Other object - stringify compare
      const matches = JSON.stringify(actual) === JSON.stringify(expected);
      if (verbose) console.log(`   🔍 Checking ${field}: actual="${JSON.stringify(actual)}" expected="${JSON.stringify(expected)}" → ${matches ? '✅' : '❌'}`);
      return matches;
    }
    
    // Simple equality
    const matches = actual === expected;
    if (verbose || !matches) {
      console.log(`   🔍 Checking ${field}: actual="${actual}" expected="${expected}" → ${matches ? '✅' : '❌'}`);
    }
    return matches;
  });
});
  const entriesWithoutRequires = meta.setup.filter(entry => !entry.requires);

  // Prefer entries with matching requires, fall back to entries without requires
  const candidateEntries = entriesWithMatchingRequires.length > 0 
    ? entriesWithMatchingRequires 
    : entriesWithoutRequires.length > 0 
      ? entriesWithoutRequires 
      : meta.setup; // Last resort: all entries

  console.log(`   Valid entries: ${entriesWithMatchingRequires.length} with matching requires, ${entriesWithoutRequires.length} without requires`);
  
  // ═══════════════════════════════════════════════════════════
  // STEP 1: Match by exact test file path (highest priority)
  // ═══════════════════════════════════════════════════════════
  if (currentTestFile) {
    const currentBasename = path.basename(currentTestFile);
    const entry = candidateEntries.find(s => {
      if (!s.testFile) return false;
      return path.basename(s.testFile) === currentBasename;
    });
    if (entry) {
      if (verbose) console.log(`   ✅ Matched by exact testFile: ${currentBasename}`);
      return entry;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // STEP 2: Match by explicitEvent (HIGH PRIORITY!)
  // ═══════════════════════════════════════════════════════════
  if (explicitEvent) {
    const normalizedEvent = explicitEvent.replace(/_/g, '').toUpperCase();
    console.log(`   🔍 Matching by explicitEvent: ${explicitEvent} (normalized: ${normalizedEvent})`);
    
    const entry = candidateEntries.find(s => {
      if (!s.testFile) return false;
      const normalizedTestFile = s.testFile.replace(/_/g, '').toUpperCase();
      const matches = normalizedTestFile.includes(normalizedEvent);
      if (matches) {
        console.log(`   ✅ Matched: ${path.basename(s.testFile)} (previousStatus: ${s.previousStatus})`);
      }
      return matches;
    });
    
    if (entry) {
      console.log(`   ✅ Found by explicitEvent: previousStatus=${entry.previousStatus}`);
      return entry;
    } else {
      console.log(`   ⚠️ No match found for event ${explicitEvent}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // STEP 3: Default to first valid entry
  // ═══════════════════════════════════════════════════════════
  if (verbose) console.log(`   ⚠️ Falling back to first valid entry`);
  console.log(`   📋 _getPreviousStatus: Using setupEntry.previousStatus = ${candidateEntries[0]?.previousStatus}`);
  return candidateEntries[0];
}




// ═══════════════════════════════════════════════════════════
// ALSO FIX: _getPreviousStatus should pass testData!
// ═══════════════════════════════════════════════════════════

static _getPreviousStatus(meta, options = {}) {
  // CRITICAL: Must pass testData to _findSetupEntry!
  const setupEntry = TestPlanner._findSetupEntry(meta, options);
  
  if (setupEntry?.previousStatus) {
    console.log(`   📋 _getPreviousStatus: Using setupEntry.previousStatus = ${setupEntry.previousStatus}`);
    return setupEntry.previousStatus;
  }
  
  const fallback = meta.requires?.previousStatus || null;
  console.log(`   📋 _getPreviousStatus: Falling back to meta.requires.previousStatus = ${fallback}`);
  return fallback;
}

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Extract event from filename (FIXED!)
  // ═══════════════════════════════════════════════════════════
  static _extractEventFromFilename(testFile) {
    if (!testFile) return null;
    
    const basename = path.basename(testFile);
    // Pattern: SomethingViaSomething-EVENT-Platform-UNIT.spec.js
    const parts = basename.split('-');
    
    if (parts.length < 4) return null;
    
    // EVENT is typically the second part (after XxxViaYyy)
    // Find the part that looks like an event (all caps or camelCase action word)
    const eventPart = parts[1]; // Usually the event
    
    if (!eventPart) return null;
    
    // If already has underscores, return as-is (uppercase)
    if (eventPart.includes('_')) {
      return eventPart.toUpperCase();
    }
    
    // If already all uppercase, return as-is (e.g., REQUESTBOOKING -> REQUEST_BOOKING)
    if (eventPart === eventPart.toUpperCase()) {
      // Insert underscores between word boundaries
      // REQUESTBOOKING -> REQUEST_BOOKING
      const words = [];
      const commonWords = [
        'REQUEST', 'BOOKING', 'CREATE', 'DELETE', 'UPDATE', 'VIEW', 'SELECT',
        'CLICK', 'SUBMIT', 'CANCEL', 'UNDO', 'SAVE', 'LOAD', 'GET', 'SET',
        'ADD', 'REMOVE', 'OPEN', 'CLOSE', 'SIGN', 'LOG', 'SEARCH', 'FILTER',
        'SORT', 'EDIT', 'CONFIRM', 'ACCEPT', 'REJECT', 'APPROVE', 'DENY',
        'FLIGHT', 'AGENCY', 'DETAILS', 'RESULTS', 'FARES', 'LOGIN', 'LOGOUT',
        'IN', 'OUT', 'UP', 'DOWN', 'ON', 'OFF', 'ALL', 'NONE', 'INVITE',
        'DANCER', 'CLUB', 'MANAGER', 'PUBLISH', 'DRAFT'
      ];
      
      let remaining = eventPart;
      
      while (remaining.length > 0) {
        let matched = false;
        
        // Sort by length descending to match longer words first
        for (const word of commonWords.sort((a, b) => b.length - a.length)) {
          if (remaining.startsWith(word)) {
            words.push(word);
            remaining = remaining.slice(word.length);
            matched = true;
            break;
          }
        }
        
        if (!matched) {
          // No known word found, take the rest as-is
          words.push(remaining);
          break;
        }
      }
      
      return words.join('_');
    }
    
    // CamelCase to SNAKE_CASE
    return eventPart
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Check if two platforms are different
  // ═══════════════════════════════════════════════════════════
  static _isDifferentPlatform(platform1, platform2) {
    const normalize = (p) => {
      if (!p) return 'unknown';
      p = p.toLowerCase();
      if (p === 'playwright' || p === 'web' || p === 'cms') return 'web';
      if (p === 'dancer' || p === 'clubapp' || p === 'club' || p === 'mobile' || p === 'webdriverio') return 'mobile';
      return p;
    };
    
    return normalize(platform1) !== normalize(platform2);
  }

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Clear data-related caches
  // ═══════════════════════════════════════════════════════════
  static _clearDataCaches() {
    Object.keys(require.cache).forEach(key => {
      if (key.includes('/tests/data/') || 
          key.includes('shared') ||
          key.includes('TestContext') ||
          key.includes('Implications.js')) {
        delete require.cache[key];
      }
    });
  }

  

  // ═══════════════════════════════════════════════════════════
  // STATIC HELPER: Merge _changeLog into data
  // ═══════════════════════════════════════════════════════════
static _mergeChangeLog(rawData) {
  console.log(`   🔍 DEBUG _mergeChangeLog input:`);
  console.log(`      has _changeLog: ${!!rawData._changeLog}`);
  console.log(`      has _original: ${!!rawData._original}`);
  
  if (!rawData._changeLog || !rawData._original) {
    console.log(`      ⚠️ No delta format, returning rawData as-is`);
    console.log(`      rawData.status: ${rawData.status}`);
    console.log(`      rawData.booking?.status: ${rawData.booking?.status}`);
    return rawData;
  }
  
  console.log(`      _changeLog entries: ${rawData._changeLog.length}`);
  rawData._changeLog.forEach((entry, i) => {
    console.log(`      [${i}] ${entry.label}: ${JSON.stringify(entry.delta)}`);
  });
  
  // Deep clone to avoid mutation
  const merged = JSON.parse(JSON.stringify(rawData._original));
  
  for (const change of rawData._changeLog) {
    if (change.delta) {
      for (const [key, value] of Object.entries(change.delta)) {
        if (key.includes('.')) {
          // Handle nested paths like "booking.status"
          const parts = key.split('.');
          let obj = merged;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
          }
          obj[parts[parts.length - 1]] = value;
          console.log(`      Applied ${key} = ${JSON.stringify(value)}`);
        } else {
          merged[key] = value;
          console.log(`      Applied ${key} = ${JSON.stringify(value)}`);
        }
      }
    }
  }
  
  console.log(`      Final merged.booking?.status: ${merged.booking?.status}`);
  return merged;
}

  // ═══════════════════════════════════════════════════════════
  // ANALYZE - Main entry point for prerequisite analysis
  // ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// ANALYZE - Main entry point for prerequisite analysis
// ═══════════════════════════════════════════════════════════
analyze(ImplicationClass, testData, options = {}) {
  const xstateConfig = ImplicationClass.xstateConfig || {};
  const meta = xstateConfig.meta || {};
  
  const targetStatus = meta.status;
  const currentStatus = TestPlanner._getCurrentStatus(testData, ImplicationClass);
  
  const previousStatus = TestPlanner._getPreviousStatus(meta, { ...options, testData });
  
  // ═══════════════════════════════════════════════════════════
  // NEW: Check if this is an OBSERVER/VERIFY test
  // Observer tests just validate existing state, they don't create it
  // ═══════════════════════════════════════════════════════════
  const setupEntry = TestPlanner._findSetupEntry(meta, { ...options, testData });
  const isObserverMode = setupEntry?.mode === 'verify' || setupEntry?.mode === 'observer';
  
  if (this.options.verbose) {
    console.log(`\n🔍 TestPlanner: Analyzing ${targetStatus} state`);
    console.log(`   Current: ${currentStatus}`);
    console.log(`   Target: ${targetStatus}`);
    if (previousStatus) {
      console.log(`   Required previous: ${previousStatus}`);
    }
    if (isObserverMode) {
      console.log(`   Mode: OBSERVER (verify only, does not induce state)`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // OBSERVER MODE: If we're just observing and state exists, we're ready!
  // ═══════════════════════════════════════════════════════════
  if (isObserverMode && currentStatus === targetStatus) {
    if (this.options.verbose) {
      console.log(`   ✅ Observer mode: ${targetStatus} state already exists, ready to validate`);
    }
    
    return {
      ready: true,
      currentStatus,
      targetStatus,
      previousStatus,
      isLoopTransition: false,
      isObserverMode: true,
      missingFields: [],
      entityFields: [],
      regularFields: [],
      chain: [{
        status: targetStatus,
        className: ImplicationClass.name,
        actionName: setupEntry?.actionName || 'observe',
        testFile: setupEntry?.testFile || 'unknown',
        platform: setupEntry?.platform || meta.platform || 'unknown',
        complete: true,
        isCurrent: true,
        isTarget: true,
        isObserver: true
      }],
      nextStep: null,
      stepsRemaining: 0
    };
  }

  // ═══════════════════════════════════════════════════════════
  // OBSERVER MODE: State doesn't exist yet - need prerequisites
  // But DON'T treat as loop - just build chain to target
  // ═══════════════════════════════════════════════════════════
  const isLoopTransition = !isObserverMode && 
                           targetStatus === currentStatus && 
                           previousStatus && 
                           previousStatus !== currentStatus;
  
  // For loop transitions, we need to build chain to previousStatus first
  // For observer mode, we build chain to targetStatus (the state must exist)
  const effectiveTarget = isLoopTransition ? previousStatus : targetStatus;

  let chain = this.buildPrerequisiteChain(
    ImplicationClass, 
    currentStatus, 
    effectiveTarget,
    new Set(), 
    true, 
    testData, 
    { 
      ...options, 
      isLoopTransition,
      isObserverMode,
      loopFinalTarget: isLoopTransition ? targetStatus : null
    }
  );

  // ═══════════════════════════════════════════════════════════
  // POST-PROCESS: Insert mandatory detours at correct positions
  // ═══════════════════════════════════════════════════════════
  chain = this._insertMandatoryDetours(chain, testData);

  // For loop transitions, add the final step back to target
  if (isLoopTransition && chain.length > 0) {
    const loopSetupEntry = TestPlanner._findSetupEntry(meta, { ...options, testData });
    
    // Only add if chain doesn't already end at targetStatus
    const lastStep = chain[chain.length - 1];
    if (lastStep.status !== targetStatus) {
      chain.push({
        status: targetStatus,
        className: ImplicationClass.name,
        actionName: loopSetupEntry?.actionName || meta.setup?.[0]?.actionName || 'unknown',
        testFile: loopSetupEntry?.testFile || meta.setup?.[0]?.testFile || 'unknown',
        platform: loopSetupEntry?.platform || meta.platform || 'unknown',
        complete: false,
        isCurrent: false,
        isTarget: true,
        entity: meta.entity,
        previousStatus: previousStatus
      });
    }
  }
  
  const missingFields = this.findMissingFields(meta, testData);
  
  const entityFields = missingFields.filter(f => {
    const fieldName = typeof f === 'string' ? f : f.field;
    return fieldName && fieldName.endsWith('.status');
  });

  const regularFields = missingFields.filter(f => {
    const fieldName = typeof f === 'string' ? f : f.field;
    return fieldName && !fieldName.endsWith('.status');
  });
  
  const ready = this.isReady(chain, currentStatus, isLoopTransition) && regularFields.length === 0;
  const nextStep = ready ? null : this.findNextStep(chain, currentStatus);
  const stepsRemaining = chain.filter(step => !step.complete).length;
  
  const analysis = {
    ready,
    currentStatus,
    targetStatus,
    previousStatus,
    isLoopTransition,
    isObserverMode,
    missingFields,
    entityFields,
    regularFields,
    chain,
    nextStep,
    stepsRemaining
  };
  
  if (this.options.verbose) {
    console.log(`   Ready: ${analysis.ready ? '✅' : '❌'}`);
    if (isLoopTransition) {
      console.log(`   🔄 Loop transition: ${currentStatus} → ... → ${previousStatus} → ${targetStatus}`);
    }
    if (isObserverMode && !analysis.ready) {
      console.log(`   👁️ Observer mode: waiting for ${targetStatus} to be created by inducer`);
    }
    if (!analysis.ready) {
      console.log(`   Missing steps: ${stepsRemaining}`);
      if (regularFields.length > 0) {
        console.log(`   Missing fields: ${regularFields.map(f => typeof f === 'string' ? f : f.field).join(', ')}`);
      }
      if (entityFields.length > 0) {
        console.log(`   Entity status fields (auto-resolvable): ${entityFields.map(f => typeof f === 'string' ? f : f.field).join(', ')}`);
      }
    }
  }
  
  return analysis;
}

  // ═══════════════════════════════════════════════════════════
  // BUILD PREREQUISITE CHAIN
  // ═══════════════════════════════════════════════════════════
// Replace the entire buildPrerequisiteChain method with this fixed version:

  buildPrerequisiteChain(ImplicationClass, currentStatus, targetStatus, visited = new Set(), isOriginalTarget = true, testData = null, options = {}) {
    // Handle string class names
    if (typeof ImplicationClass === 'string') {
      const implPath = this.findImplicationFile(ImplicationClass);
      if (implPath) {
        this._clearImplicationCache(implPath);
        ImplicationClass = require(implPath);
      }
    }
    
    const chain = [];
    
    const xstateConfig = ImplicationClass.xstateConfig || {};
    const meta = xstateConfig.meta || {};
    
    let previousStatus = TestPlanner._getPreviousStatus(meta, { ...options, testData });
    
    // Check for loop transition
    const isLoopTransition = isOriginalTarget && 
                             previousStatus && 
                             previousStatus !== targetStatus;
    
    // Circular dependency check with loop transition exception
    if (visited.has(targetStatus)) {
      const isLoopPassThrough = options.loopTarget === targetStatus;
      
      if (isLoopPassThrough) {
        if (this.options.verbose) {
          console.log(`   🔄 Loop prerequisite: ${targetStatus} (first occurrence)`);
        }
        
        const setupEntry = TestPlanner._findSetupEntry(meta, { ...options, testData });
        
        chain.push({
          status: targetStatus,
          className: ImplicationClass.name,
          actionName: setupEntry?.actionName || meta.setup?.[0]?.actionName || 'unknown',
          testFile: setupEntry?.testFile || meta.setup?.[0]?.testFile || 'unknown',
          platform: setupEntry?.platform || meta.platform || 'unknown',
          complete: currentStatus === targetStatus,
          isCurrent: currentStatus === targetStatus,
          isTarget: false,
          isLoopPrerequisite: true,
          entity: meta.entity,
          previousStatus: previousStatus
        });
        
        return chain;
      }
      
      console.warn(`⚠️  Circular dependency detected for ${targetStatus}`);
      return chain;
    }
    
    visited.add(targetStatus);
    
    // Check for direct transition
    const directTransition = this._findDirectTransition(targetStatus, currentStatus);

    if (directTransition && isOriginalTarget && this.options.verbose) {
      console.log(`   ✅ Direct transition: ${currentStatus} → ${targetStatus} (${directTransition.event})`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // GLOBAL STATUS REQUIREMENTS
    // ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// GLOBAL STATUS REQUIREMENTS
// ═══════════════════════════════════════════════════════════
if (meta.requires && testData) {  // ← REMOVED isOriginalTarget
  for (const [field, requiredValue] of Object.entries(meta.requires)) {
    if (field === 'previousStatus') continue;
    if (field.startsWith('!')) continue;
    
    // Global status requirement
    if (field === 'status' && typeof requiredValue === 'string' && this.stateRegistry[requiredValue]) {
          const globalStatus = testData.status || testData._currentStatus || 'initial';
          
          if (globalStatus !== requiredValue) {
            if (this.options.verbose) {
              console.log(`   🔍 Found global status requirement: status must be ${requiredValue}`);
            }
            
            const globalImplClassName = this.stateRegistry[requiredValue];
            
            if (globalImplClassName && !visited.has(requiredValue)) {
              try {
                const globalImplPath = this.findImplicationFile(globalImplClassName);
                
                if (globalImplPath) {
                  this._clearImplicationCache(globalImplPath);
                  const GlobalImplClass = require(globalImplPath);
                  
                  if (this.options.verbose) {
                    console.log(`   ⚙️  Building global chain: ${globalStatus} → ${requiredValue}`);
                  }
                  
                  const globalChain = this.buildPrerequisiteChain(
                    GlobalImplClass,
                    globalStatus,
                    requiredValue,
                    visited,
                    false,
                    testData,
                    { loopTarget: isLoopTransition ? targetStatus : options.loopTarget }
                  );
                  
                  chain.push(...globalChain);
                }
              } catch (error) {
                console.error(`   ❌ Failed to load ${globalImplClassName}: ${error.message}`);
                chain.push({
                  status: requiredValue,
                  className: globalImplClassName,
                  actionName: 'FAILED_TO_LOAD',
                  testFile: 'unknown',
                  platform: 'unknown',
                  complete: false,
                  isTarget: false,
                  loadError: error.message
                });
              }
            }
          }
        }
        
        // Entity boolean state requirement (e.g., dancer.logged_in: true)
        if (field.includes('.') && typeof requiredValue === 'boolean') {
          const [entity, statusField] = field.split('.');
          const stateKey = `${entity}_${statusField}`;
          
          if (this.stateRegistry[stateKey]) {
            const actualValue = testData[entity]?.[statusField];
            
            if (actualValue !== requiredValue) {
              if (this.options.verbose) {
                console.log(`   🔍 Found entity state requirement: ${entity}.${statusField} must be ${requiredValue}`);
              }
              
              const entityImplClassName = this.stateRegistry[stateKey];
              
              if (entityImplClassName && !visited.has(stateKey)) {
                try {
                  const entityImplPath = this.findImplicationFile(entityImplClassName);
                  
                  if (entityImplPath) {
                    this._clearImplicationCache(entityImplPath);
                    const EntityImplClass = require(entityImplPath);
                    const currentEntityStatus = testData[entity]?.status || 'registered';
                    
                    if (this.options.verbose) {
                      console.log(`   ⚙️  Building ${entity} chain: ${currentEntityStatus} → ${statusField}`);
                    }

                    const entityChain = this.buildPrerequisiteChain(
                      EntityImplClass,
                      currentEntityStatus,
                      stateKey,
                      visited,
                      false,
                      testData,
                      { loopTarget: isLoopTransition ? targetStatus : options.loopTarget }
                    );
                    
                    chain.push(...entityChain);
                  }
                } catch (error) {
                  console.error(`   ❌ Failed to load ${entityImplClassName}: ${error.message}`);
                  chain.push({
                    status: stateKey,
                    className: entityImplClassName,
                    actionName: 'FAILED_TO_LOAD',
                    testFile: 'unknown',
                    platform: 'unknown',
                    complete: false,
                    isTarget: false,
                    loadError: error.message
                  });
                }
              }
            }
          }
        }
      }
    }

 // ═══════════════════════════════════════════════════════════
// PREVIOUS STATUS CHAIN - WITH CONDITION CHECKING & ALTERNATIVES!
// ═══════════════════════════════════════════════════════════
if (previousStatus) {
  if (meta.entity && this.options.verbose) {
    console.log(`   ℹ️  Entity prerequisite: ${meta.entity}.status must be ${previousStatus}`);
  }

  // ═══════════════════════════════════════════════════════════
  // NEW: Check if this previousStatus path would go through our ORIGINAL target
  // If so, we need to find an alternative setup entry
  // ═══════════════════════════════════════════════════════════
  const originalTarget = options.originalTarget || targetStatus;
  
  if (previousStatus !== originalTarget && !isOriginalTarget) {
    // Check if previousStatus chain would go through originalTarget
    const wouldGoThroughTarget = this._wouldPathGoThrough(previousStatus, originalTarget, new Set([...visited]));
    
    if (wouldGoThroughTarget) {
      if (this.options.verbose) {
        console.log(`   ⚠️  Path via ${previousStatus} would go through target ${originalTarget}`);
        console.log(`   🔄 Looking for alternative setup entry...`);
      }
      
      // Try to find alternative setup entry that doesn't go through target
      const alternativeEntry = this._findAlternativeSetupEntry(meta, originalTarget, testData, visited);
      
      if (alternativeEntry && alternativeEntry.previousStatus !== previousStatus) {
        if (this.options.verbose) {
          console.log(`   ✅ Using alternative: ${alternativeEntry.previousStatus} (instead of ${previousStatus})`);
        }
        previousStatus = alternativeEntry.previousStatus;
      }
    }
  }
  
  // ✅ Check if the transition FROM previousStatus TO targetStatus is valid
  const transitionCheck = this._checkTransitionConditionsToTarget(previousStatus, targetStatus, testData);
  
  if (!transitionCheck.valid) {
    // Transition is BLOCKED by conditions!
    if (this.options.verbose) {
      console.log(`   ⚠️  Transition ${previousStatus} → ${targetStatus} blocked by conditions`);
      if (transitionCheck.blockedTransitions) {
        transitionCheck.blockedTransitions.forEach(t => {
          console.log(`      ❌ ${t.event}: ${t.blockedBy.map(b => `${b.field}=${JSON.stringify(b.actual)} (needs ${JSON.stringify(b.expected)})`).join(', ')}`);
        });
      }
    }
    // ═══════════════════════════════════════════════════════════
    // ✅ FIX: Find the state we CAN reach that has a path to target
    // We need to find an alternative from the state BEFORE the blocked one
    // ═══════════════════════════════════════════════════════════
    
    // First, find what state comes before previousStatus (the blocked one)
    // by looking at what can reach previousStatus
    const stateBeforeBlocked = this._findStateBeforeBlocked(previousStatus, currentStatus, testData, visited);
    
    if (stateBeforeBlocked && this.options.verbose) {
      console.log(`   🔍 Searching alternative path: ${stateBeforeBlocked} → ${targetStatus} (avoiding direct path via ${previousStatus})`);
    }
    
    // ✅ NEW: Try to find an alternative path from the state BEFORE the blocked transition
    const searchFrom = stateBeforeBlocked || currentStatus;
    
    const alternativePath = this._findAlternativePathToTarget(
      searchFrom,
      targetStatus,
      testData,
      new Set([...visited]),
      previousStatus // The blocked previous status to avoid
    );
    
    if (alternativePath && alternativePath.length > 0) {
      if (this.options.verbose) {
        console.log(`   ✅ Found alternative path: ${alternativePath.map(s => s.status).join(' → ')}`);
      }
      
      // ✅ FIX: If we found an alternative, we need to ALSO build the chain TO searchFrom first!
      if (stateBeforeBlocked && stateBeforeBlocked !== currentStatus) {
        const chainToSearchFrom = this._buildChainToState(currentStatus, stateBeforeBlocked, testData, new Set([...visited]));
        if (chainToSearchFrom && chainToSearchFrom.length > 0) {
          chain.push(...chainToSearchFrom);
        }
      }
      
      chain.push(...alternativePath);
      return chain;
    }
    
    // No alternative found - mark as blocked
    if (this.options.verbose) {
      console.log(`   ❌ No alternative path found`);
    }
    
    chain.push({
      status: targetStatus,
      className: ImplicationClass.name,
      actionName: 'BLOCKED_BY_CONDITIONS',
      testFile: 'N/A',
      platform: meta.platform || 'unknown',
      complete: false,
      isCurrent: false,
      isTarget: isOriginalTarget,
      blocked: true,
      blockedReason: `Transition from ${previousStatus} requires conditions not met in testData. No alternative path found.`,
      blockedTransitions: transitionCheck.blockedTransitions
    });
    
    return chain;
  }
  
  // Transition is valid - continue building chain normally
  const prevImplClassName = this.stateRegistry[previousStatus];
  
  const canVisitPrevious = !visited.has(previousStatus) || 
                           (options.loopTarget === previousStatus) ||
                           (isLoopTransition && previousStatus !== targetStatus);
  
  if (prevImplClassName && canVisitPrevious) {
    try {
      const prevImplPath = this.findImplicationFile(prevImplClassName);
      
      if (prevImplPath) {
        this._clearImplicationCache(prevImplPath);
        const PrevImplClass = require(prevImplPath);
        
        const selectedTransition = this._selectTransition(
          PrevImplClass,
          targetStatus,
          meta.platform,
          { 
            explicitEvent: options?.explicitEvent,
            preferSamePlatform: true,
            testData
          }
        );
        
     const prevChain = this.buildPrerequisiteChain(
  PrevImplClass, 
  currentStatus, 
  previousStatus, 
  visited, 
  false,
  testData,
  { 
    explicitEvent: selectedTransition?.event,
    loopTarget: isLoopTransition ? targetStatus : options.loopTarget,
    originalTarget: options.originalTarget || targetStatus  // ← ADD THIS
  }
);
        
        // Check if the previous chain has any blocked steps
        const hasBlockedSteps = prevChain.some(step => step.blocked);
        if (hasBlockedSteps) {
          if (this.options.verbose) {
            console.log(`   ⚠️  Previous chain to ${previousStatus} contains blocked steps`);
          }
          
          // ✅ NEW: Try alternative path when previous chain is blocked
          const alternativePath = this._findAlternativePathToTarget(
            currentStatus,
            targetStatus,
            testData,
            new Set([...visited]),
            previousStatus
          );
          
          if (alternativePath && alternativePath.length > 0) {
            if (this.options.verbose) {
              console.log(`   ✅ Found alternative path: ${alternativePath.map(s => s.status).join(' → ')}`);
            }
            chain.push(...alternativePath);
            return chain;
          }
          
          // No alternative - propagate blocked status
          chain.push(...prevChain);
          return chain;
        }
        
        chain.push(...prevChain);
      } else {
        console.error(`   ❌ Implication file not found for: ${prevImplClassName}`);
        chain.push({
          status: previousStatus,
          className: prevImplClassName,
          actionName: 'FILE_NOT_FOUND',
          testFile: 'unknown',
          platform: 'unknown',
          complete: false,
          isTarget: false,
          loadError: 'File not found'
        });
      }
    } catch (error) {
      console.error(`   ❌ Failed to load ${prevImplClassName}: ${error.message}`);
      chain.push({
        status: previousStatus,
        className: prevImplClassName,
        actionName: this._inferActionName(previousStatus),
        testFile: this._inferTestFile(prevImplClassName, previousStatus),
        platform: this._inferPlatform(previousStatus),
        complete: false,
        isCurrent: false,
        isTarget: false,
        loadError: error.message
      });
    }
  } else if (!prevImplClassName) {
    console.error(`   ❌ Status "${previousStatus}" not found in state registry!`);
    chain.push({
      status: previousStatus,
      className: 'UNKNOWN',
      actionName: 'NOT_IN_REGISTRY',
      testFile: 'unknown',
      platform: 'unknown',
      complete: false,
      isTarget: false,
      loadError: 'Not in state registry'
    });
  }
}

    // ═══════════════════════════════════════════════════════════
    // ADD CURRENT STATE TO CHAIN
    // ═══════════════════════════════════════════════════════════
    const setupEntry = TestPlanner._findSetupEntry(meta, { ...options, testData });

    chain.push({
      status: targetStatus,
      className: ImplicationClass.name,
      actionName: setupEntry?.actionName || meta.setup?.[0]?.actionName || 'unknown',
      testFile: setupEntry?.testFile || meta.setup?.[0]?.testFile || 'unknown',
      platform: setupEntry?.platform || meta.platform || 'unknown',
      complete: currentStatus === targetStatus && !options.isLoopTransition,
      isCurrent: currentStatus === targetStatus,
      isTarget: isOriginalTarget,
      entity: meta.entity,
      previousStatus: previousStatus,
      ...(directTransition && {
        transitionEvent: directTransition.event,
        transitionFrom: currentStatus
      })
    });
    
    // ═══════════════════════════════════════════════════════════
    // MARK COMPLETED STEPS
    // ═══════════════════════════════════════════════════════════
    const currentIndex = chain.findIndex(step => step.status === currentStatus && !step.isLoopPrerequisite);
    if (currentIndex !== -1 && !options.isLoopTransition) {
      for (let i = 0; i <= currentIndex; i++) {
        chain[i].complete = true;
      }
    }

    // Mark global status steps as complete if we're at that global status
    if (meta.entity && testData) {
      const globalStatus = testData.status || testData._currentStatus || 'initial';
      
      if (this.options.verbose) {
        console.log(`   🔍 Entity: ${meta.entity}, Entity status: ${currentStatus}, Global status: ${globalStatus}`);
      }
      
      chain.forEach((step, index) => {
        if (step.entity) return;
        if (step.loadError) return; // Don't mark errored steps as complete!
        
        if (step.status === globalStatus) {
          if (this.options.verbose) {
            console.log(`   ✅ Marking ${step.status} as complete (matches global status)`);
          }
          step.complete = true;
        }
        
        const globalStepIndex = chain.findIndex(s => s.status === globalStatus && !s.entity);
        if (globalStepIndex !== -1 && index < globalStepIndex && !step.entity) {
          step.complete = true;
        }
      });
    }
    
    return chain;
  }
/**
 * Post-process chain to insert mandatory detours at correct positions
 */
_insertMandatoryDetours(chain, testData) {
  if (!testData || chain.length === 0) return chain;
  
  const result = [];
  const detourInserted = new Set(); // Track which states already had detours inserted
  
  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    
    // Add the current step first
    result.push(step);
    
    // Skip if we already processed a detour for this state
    if (detourInserted.has(step.status)) continue;
    
    // Skip if this is already a detour step
    if (step.isDetour) continue;
    
    // Check if this state has a mandatory detour
    const implClassName = this.stateRegistry[step.status];
    if (!implClassName) continue;
    
    try {
      const implPath = this.findImplicationFile(implClassName);
      if (!implPath) continue;
      
      this._clearImplicationCache(implPath);
      const ImplClass = require(implPath);
      
      const detour = this._findMandatoryDetour(ImplClass, step.status, testData, new Set());
      
      if (detour) {
        const detourEndpoint = this._findDetourEndpoint(detour.target, step.status, testData);
        
        if (detourEndpoint) {
          if (this.options.verbose) {
            console.log(`   🔄 Inserting detour after ${step.status}: ${detour.target} → ... → ${detourEndpoint} → ${step.status}`);
          }
          
          // Mark this state as having a detour
          detourInserted.add(step.status);
          
          // Build the detour path
          const detourSteps = this._buildSimpleDetourPath(
            step.status,      // from (e.g., landing_page)
            detour.target,    // first step (e.g., agency_modal_opened)
            detourEndpoint,   // last step before return (e.g., agency_preffered)
            testData
          );
          
          if (detourSteps.length > 0) {
            result.push(...detourSteps);
          }
        }
      }
    } catch (error) {
      console.error(`   ❌ Error checking detour for ${step.status}: ${error.message}`);
    }
  }
  
  return result;
}

/**
 * Build a simple linear path through the detour
 */
_buildSimpleDetourPath(fromState, firstState, lastState, testData) {
  const path = [];
  const visited = new Set([fromState]);
  let current = firstState;
  let prevState = fromState;
  
  // Walk through detour states
  while (current && !visited.has(current)) {
    visited.add(current);
    
    const implClassName = this.stateRegistry[current];
    if (!implClassName) break;
    
    try {
      const implPath = this.findImplicationFile(implClassName);
      if (!implPath) break;
      
      this._clearImplicationCache(implPath);
      const ImplClass = require(implPath);
      const meta = ImplClass.xstateConfig?.meta || {};
      const setupEntry = TestPlanner._findSetupEntry(meta, { testData });
      
      path.push({
        status: current,
        className: ImplClass.name,
        actionName: setupEntry?.actionName || meta.setup?.[0]?.actionName || `${current}Via${prevState}`,
        testFile: setupEntry?.testFile || meta.setup?.[0]?.testFile || 'unknown',
        platform: setupEntry?.platform || meta.platform || 'web',
        complete: false,
        isTarget: false,
        isDetour: true,
        previousStatus: prevState
      });
      
      // If we reached the endpoint, add return step and stop
      if (current === lastState) {
        // Add the return to fromState
        const fromImplClassName = this.stateRegistry[fromState];
        if (fromImplClassName) {
          try {
            const fromImplPath = this.findImplicationFile(fromImplClassName);
            if (fromImplPath) {
              this._clearImplicationCache(fromImplPath);
              const FromImplClass = require(fromImplPath);
              const fromMeta = FromImplClass.xstateConfig?.meta || {};
              const returnSetup = fromMeta.setup?.find(s => s.previousStatus === lastState);
              
              path.push({
                status: fromState,
                className: FromImplClass.name,
                actionName: returnSetup?.actionName || `${fromState}Via${lastState}`,
                testFile: returnSetup?.testFile || 'unknown',
                platform: returnSetup?.platform || fromMeta.platform || 'web',
                complete: false,
                isTarget: false,
                isDetour: true,
                isReturnFromDetour: true,
                previousStatus: lastState
              });
            }
          } catch (e) {
            // Skip if can't load
          }
        }
        break;
      }
      
      // Find next state - follow first transition that's not back to fromState
      const transitions = ImplClass.xstateConfig?.on || {};
      let nextState = null;
      
      for (const [event, config] of Object.entries(transitions)) {
        const target = typeof config === 'string' ? config : config?.target;
        if (target && !visited.has(target) && target !== fromState) {
          nextState = target;
          break;
        }
      }
      
      prevState = current;
      current = nextState;
      
    } catch (error) {
      break;
    }
  }
  
  return path;
}
/**
 * Build the path through a detour
 */
_buildDetourPath(fromState, firstDetourState, lastDetourState, testData) {
  const path = [];
  const visited = new Set([fromState]);
  
  let current = firstDetourState;
  let previousState = fromState;
  
  while (current && !visited.has(current)) {
    visited.add(current);
    
    const implClassName = this.stateRegistry[current];
    if (!implClassName) break;
    
    try {
      const implPath = this.findImplicationFile(implClassName);
      if (!implPath) break;
      
      this._clearImplicationCache(implPath);
      const ImplClass = require(implPath);
      const meta = ImplClass.xstateConfig?.meta || {};
      const setupEntry = TestPlanner._findSetupEntry(meta, { testData });
      
      path.push({
        status: current,
        className: ImplClass.name,
        actionName: setupEntry?.actionName || meta.setup?.[0]?.actionName || `${current}Via${previousState}`,
        testFile: setupEntry?.testFile || meta.setup?.[0]?.testFile || 'unknown',
        platform: setupEntry?.platform || meta.platform || 'web',
        complete: false,
        isTarget: false,
        isDetour: true,
        previousStatus: previousState
      });
      
      // If we reached the endpoint, add the return step and stop
      if (current === lastDetourState) {
        // Find the setup entry for returning to fromState
        const fromImplClassName = this.stateRegistry[fromState];
        if (fromImplClassName) {
          const fromImplPath = this.findImplicationFile(fromImplClassName);
          if (fromImplPath) {
            this._clearImplicationCache(fromImplPath);
            const FromImplClass = require(fromImplPath);
            const fromMeta = FromImplClass.xstateConfig?.meta || {};
            
            // Find setup entry that comes from detour endpoint
            const returnSetup = fromMeta.setup?.find(s => s.previousStatus === lastDetourState);
            
            path.push({
              status: fromState,
              className: FromImplClass.name,
              actionName: returnSetup?.actionName || `${fromState}Via${lastDetourState}`,
              testFile: returnSetup?.testFile || 'unknown',
              platform: returnSetup?.platform || fromMeta.platform || 'web',
              complete: false,
              isTarget: false,
              isDetour: true,
              isReturnFromDetour: true,
              previousStatus: lastDetourState
            });
          }
        }
        break;
      }
      
      // Find next state in detour
      const transitions = ImplClass.xstateConfig?.on || {};
      let nextState = null;
      
      for (const [event, config] of Object.entries(transitions)) {
        const target = typeof config === 'string' ? config : config?.target;
        if (target && !visited.has(target) && target !== fromState) {
          nextState = target;
          break;
        }
      }
      
      previousState = current;
      current = nextState;
    } catch (error) {
      break;
    }
  }
  
  return path;
}

/**
 * Find mandatory detour from a state based on testData
 */
_findMandatoryDetour(ImplicationClass, currentStatus, testData, visited) {
  const xstateConfig = ImplicationClass.xstateConfig || {};
  const transitions = xstateConfig.on || {};
  
  for (const [event, config] of Object.entries(transitions)) {
    const configObj = typeof config === 'string' ? { target: config } : config;
    const target = configObj.target;
    
    if (!target || visited.has(target)) continue;
    
    // Check if this transition has requires that match testData
    if (configObj.requires) {
      const allMatch = Object.entries(configObj.requires).every(([field, expected]) => {
        return testData[field] === expected;
      });
      
      if (allMatch) {
        return { event, target, config: configObj };
      }
    }
  }
  
  return null;
}

/**
 * Find the endpoint of a detour (the state that returns to the original state)
 */
_findDetourEndpoint(detourStart, returnToState, testData) {
  const visited = new Set();
  let current = detourStart;
  const maxDepth = 20;
  let depth = 0;
  
  while (depth < maxDepth) {
    if (visited.has(current)) break;
    visited.add(current);
    
    const implClassName = this.stateRegistry[current];
    if (!implClassName) break;
    
    try {
      const implPath = this.findImplicationFile(implClassName);
      if (!implPath) break;
      
      this._clearImplicationCache(implPath);
      const ImplClass = require(implPath);
      const xstateConfig = ImplClass.xstateConfig || {};
      const transitions = xstateConfig.on || {};
      
      // Check if any transition goes back to returnToState
      for (const [event, config] of Object.entries(transitions)) {
        const target = typeof config === 'string' ? config : config?.target;
        if (target === returnToState) {
          return current;
        }
      }
      
      // Follow the first available transition
      const firstTransition = Object.entries(transitions)[0];
      if (firstTransition) {
        const [, config] = firstTransition;
        current = typeof config === 'string' ? config : config?.target;
      } else {
        break;
      }
      
      depth++;
    } catch (error) {
      break;
    }
  }
  
  return null;
}

  /**
 * Find the state that comes before a blocked state in the normal flow
 * This helps us find where to start searching for alternatives
 * 
 * @param {string} blockedStatus - The status that's blocked
 * @param {string} currentStatus - Current test status
 * @param {object} testData - Test data
 * @param {Set} visited - Already visited states
 * @returns {string|null} The state before the blocked one, or null
 */
_findStateBeforeBlocked(blockedStatus, currentStatus, testData, visited) {
  // Look up the blocked status's implication to find ITS previousStatus
  const blockedImplClassName = this.stateRegistry[blockedStatus];
  if (!blockedImplClassName) return null;
  
  try {
    const blockedImplPath = this.findImplicationFile(blockedImplClassName);
    if (!blockedImplPath) return null;
    
    this._clearImplicationCache(blockedImplPath);
    const BlockedImplClass = require(blockedImplPath);
    const blockedMeta = BlockedImplClass.xstateConfig?.meta || {};
    
    // Get the previousStatus of the blocked state
    const stateBeforeBlocked = TestPlanner._getPreviousStatus(blockedMeta, { testData });
    
    if (stateBeforeBlocked && stateBeforeBlocked !== blockedStatus) {
      if (this.options.verbose) {
        console.log(`   🔍 State before blocked (${blockedStatus}): ${stateBeforeBlocked}`);
      }
      return stateBeforeBlocked;
    }
  } catch (error) {
    if (this.options.verbose) {
      console.warn(`   ⚠️ Could not find state before ${blockedStatus}: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Build a chain to reach a specific state (simplified version for alternative paths)
 * 
 * @param {string} fromStatus - Starting status
 * @param {string} toStatus - Target status
 * @param {object} testData - Test data
 * @param {Set} visited - Already visited states
 * @returns {Array} Chain of steps
 */
_buildChainToState(fromStatus, toStatus, testData, visited) {
  const implClassName = this.stateRegistry[toStatus];
  if (!implClassName) return [];
  
  try {
    const implPath = this.findImplicationFile(implClassName);
    if (!implPath) return [];
    
    this._clearImplicationCache(implPath);
    const ImplClass = require(implPath);
    
    // Recursively build the chain
    return this.buildPrerequisiteChain(
      ImplClass,
      fromStatus,
      toStatus,
      visited,
      false,
      testData,
      {}
    );
  } catch (error) {
    if (this.options.verbose) {
      console.warn(`   ⚠️ Could not build chain to ${toStatus}: ${error.message}`);
    }
    return [];
  }
}

  // ═══════════════════════════════════════════════════════════
  // HELPER: Clear implication cache properly
  // ═══════════════════════════════════════════════════════════
  _clearImplicationCache(filePath) {
    try {
      const resolved = require.resolve(filePath);
      delete require.cache[resolved];
    } catch (e) {
      // File not in cache yet, that's fine
    }
    
    // Also clear any cached implications that might have stale references
    Object.keys(require.cache).forEach(key => {
      if (key.includes('Implications') || 
          key.includes('implications') ||
          key.includes('BaseBooking')) {
        delete require.cache[key];
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
// CHECK IF PATH WOULD GO THROUGH A SPECIFIC STATE
// ═══════════════════════════════════════════════════════════
_wouldPathGoThrough(fromStatus, throughStatus, visited = new Set()) {
  if (fromStatus === throughStatus) return true;
  if (visited.has(fromStatus)) return false;
  
  visited.add(fromStatus);
  
  const implClassName = this.stateRegistry[fromStatus];
  if (!implClassName) return false;
  
  const implPath = this.findImplicationFile(implClassName);
  if (!implPath) return false;
  
  try {
    this._clearImplicationCache(implPath);
    const ImplClass = require(implPath);
    const meta = ImplClass.xstateConfig?.meta || {};
    
    // Get all possible previousStatus values from setup entries
    const setupEntries = meta.setup || [];
    
    for (const entry of setupEntries) {
      const entryPreviousStatus = entry.previousStatus;
      if (!entryPreviousStatus) continue;
      
      if (entryPreviousStatus === throughStatus) {
        return true;
      }
      
      // Recursively check
      if (this._wouldPathGoThrough(entryPreviousStatus, throughStatus, visited)) {
        return true;
      }
    }
    
    // Also check meta.requires.previousStatus
    const metaPreviousStatus = meta.requires?.previousStatus;
    if (metaPreviousStatus) {
      if (metaPreviousStatus === throughStatus) return true;
      if (this._wouldPathGoThrough(metaPreviousStatus, throughStatus, visited)) return true;
    }
    
    return false;
    
  } catch (error) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// FIND ALTERNATIVE SETUP ENTRY THAT DOESN'T GO THROUGH TARGET
// ═══════════════════════════════════════════════════════════
_findAlternativeSetupEntry(meta, avoidStatus, testData, visited) {
  const setupEntries = meta.setup || [];
  
  for (const entry of setupEntries) {
    const entryPreviousStatus = entry.previousStatus;
    if (!entryPreviousStatus) continue;
    
    // Check if this entry's path would avoid the target
    const wouldGoThrough = this._wouldPathGoThrough(entryPreviousStatus, avoidStatus, new Set([...visited]));
    
    if (!wouldGoThrough) {
      // This entry doesn't go through the target - use it!
      return entry;
    }
  }
  
  // No alternative found
  return null;
}

  // ═══════════════════════════════════════════════════════════
  // HELPERS: Infer info when we can't load the file
  // ═══════════════════════════════════════════════════════════
  _inferActionName(status) {
    // booking_created -> bookingCreatedVia...
    const parts = status.split('_');
    const camelCase = parts.map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('');
    return camelCase + 'Via...';
  }

  _inferTestFile(className, status) {
    // Try to find any test file that mentions this status
    const searchDirs = [
      path.join(process.cwd(), 'tests/implications'),
    ];
    
    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      
      const files = this._findFilesMatching(dir, status);
      if (files.length > 0) {
        return files[0];
      }
    }
    
    return 'unknown';
  }

  _findFilesMatching(dir, pattern) {
    const results = [];
    const normalizedPattern = pattern.replace(/_/g, '').toLowerCase();
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          results.push(...this._findFilesMatching(fullPath, pattern));
        } else if (item.name.toLowerCase().includes(normalizedPattern) && item.name.endsWith('.spec.js')) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // Silently handle
    }
    
    return results;
  }

  _inferPlatform(status) {
    // Look at state registry for clues
    const className = this.stateRegistry[status];
    if (!className) return 'unknown';
    
    // Try to find the test file to infer platform
    const testFile = this._inferTestFile(className, status);
    if (testFile && testFile !== 'unknown') {
      if (testFile.includes('-Web-') || testFile.includes('-Playwright-')) return 'web';
      if (testFile.includes('-Dancer-')) return 'dancer';
      if (testFile.includes('-ClubApp-') || testFile.includes('-Club-')) return 'clubApp';
    }
    
    return 'web'; // Default assumption
  }

  // ═══════════════════════════════════════════════════════════
  // FIND DIRECT TRANSITION
  // ═══════════════════════════════════════════════════════════
  _findDirectTransition(targetStatus, currentStatus) {
    try {
      const cacheDir = path.join(process.cwd(), '.implications-framework', 'cache');
      const discoveryCache = path.join(cacheDir, 'discovery-result.json');
      
      if (!fs.existsSync(discoveryCache)) {
        return null;
      }
      
      const discovery = JSON.parse(fs.readFileSync(discoveryCache, 'utf-8'));
      
      if (!discovery.transitions) {
        return null;
      }
      
      const transition = discovery.transitions.find(t => {
        const matchesFrom = t.from === currentStatus || 
                           t.from.replace(/_/g, ' ').toLowerCase() === currentStatus.replace(/_/g, ' ').toLowerCase();
        
        const matchesTo = t.to === targetStatus || 
                         t.to.replace(/_/g, ' ').toLowerCase() === targetStatus.replace(/_/g, ' ').toLowerCase();
        
        return matchesFrom && matchesTo;
      });
      
      return transition || null;
      
    } catch (error) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // FIND IMPLICATION FILE
  // ═══════════════════════════════════════════════════════════
  findImplicationFile(className) {
    const searchPaths = [
      path.join(process.cwd(), 'tests/implications'),
      path.join(process.cwd(), 'tests/ai-testing/implications'),
      path.join(__dirname, '..')
    ];
    
    for (const basePath of searchPaths) {
      const filePath = path.join(basePath, `${className}.js`);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
      
      if (fs.existsSync(basePath)) {
        const files = this.findFilesRecursive(basePath, `${className}.js`);
        if (files.length > 0) {
          return files[0];
        }
      }
    }
    
    return null;
  }

  findFilesRecursive(dir, filename) {
    const results = [];
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          results.push(...this.findFilesRecursive(fullPath, filename));
        } else if (item.name === filename) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // Silently handle
    }
    
    return results;
  }
  
  // ═══════════════════════════════════════════════════════════
  // IS READY CHECK
  // ═══════════════════════════════════════════════════════════
  isReady(chain, currentStatus, isLoopTransition = false) {
  // ✅ NEW: If any step is blocked, we're not ready
  const hasBlockedSteps = chain.some(step => step.blocked);
  if (hasBlockedSteps) {
    return false;
  }
  
  const incompleteSteps = chain.filter(step => !step.complete);
  
    
    if (incompleteSteps.length === 0) {
      return true;
    }
    
    // Loop transition special case
    if (isLoopTransition) {
      const targetStep = incompleteSteps.find(s => s.isTarget);
      
      if (targetStep) {
        const atPreviousStatus = currentStatus === targetStep.previousStatus;
        
        if (atPreviousStatus && incompleteSteps.length === 1) {
          return true;
        }
      }
      
      return false;
    }
    
    // Direct transition ready
    if (incompleteSteps.length === 1 && 
        incompleteSteps[0].isTarget && 
        incompleteSteps[0].transitionEvent) {
      
      const targetStep = incompleteSteps[0];
      
      if (targetStep.transitionFrom) {
        return currentStatus === targetStep.transitionFrom;
      }
      
      return true;
    }
    
    // Only target step remaining
    if (incompleteSteps.length === 1 && incompleteSteps[0].isTarget) {
      return true;
    }
    
    return false;
  }
  
  // ═══════════════════════════════════════════════════════════
  // FIND NEXT STEP
  // ═══════════════════════════════════════════════════════════
  findNextStep(chain, currentStatus) {
    const nextStep = chain.find(step => !step.complete && !step.isTarget);
    
    if (nextStep) {
      return {
        ...nextStep,
        executable: true
      };
    }
    
    return null;
  }
  
  // ═══════════════════════════════════════════════════════════
  // FIND MISSING FIELDS
  // ═══════════════════════════════════════════════════════════
  findMissingFields(meta, testData) {
    const missing = [];
    
    if (meta.requires) {
      for (const [field, requiredValue] of Object.entries(meta.requires)) {
        if (field === 'previousStatus') continue;
        
        if (field === 'status' && typeof requiredValue === 'string' && this.stateRegistry[requiredValue]) {
          continue;
        }
        
        const isNegated = field.startsWith('!');
        const cleanField = isNegated ? field.slice(1) : field;
        
        const actualValue = cleanField.includes('.') 
          ? cleanField.split('.').reduce((obj, key) => obj?.[key], testData)
          : testData[cleanField];
        
        if (typeof requiredValue === 'object' && requiredValue.contains) {
          const valueToCheck = this._resolveValue(requiredValue.contains, testData);
          const arrayContains = Array.isArray(actualValue) && actualValue.includes(valueToCheck);
          
          if ((isNegated && arrayContains) || (!isNegated && !arrayContains)) {
            missing.push({
              field: cleanField,
              required: isNegated 
                ? `NOT contain "${valueToCheck}"` 
                : `contain "${valueToCheck}"`,
              actual: actualValue
            });
          }
        }
        else {
          const matches = actualValue === requiredValue;
          
          if ((isNegated && matches) || (!isNegated && !matches)) {
            missing.push({
              field: cleanField,
              required: isNegated ? `NOT "${requiredValue}"` : requiredValue,
              actual: actualValue
            });
          }
        }
      }
    }
    
    if (meta.requiredFields && meta.requiredFields.length > 0) {
      for (const field of meta.requiredFields) {
        if (!testData.hasOwnProperty(field) || testData[field] === null || testData[field] === undefined) {
          missing.push({ field, required: 'defined', actual: 'missing' });
        }
      }
    }
    
    return missing;
  }

  _resolveValue(pathStr, testData) {
    if (pathStr.startsWith('ctx.data.')) {
      pathStr = pathStr.replace('ctx.data.', '');
    }
    return pathStr.split('.').reduce((obj, key) => obj?.[key], testData);
  }
  
  // ═══════════════════════════════════════════════════════════
  // DETECT CROSS-PLATFORM
  // ═══════════════════════════════════════════════════════════
  detectCrossPlatform(chain, currentPlatform) {
    const crossPlatformSteps = [];
    
    for (const step of chain) {
      if (step.complete) continue;
      if (step.isTarget) continue;
      
      if (TestPlanner._isDifferentPlatform(currentPlatform, step.platform)) {
        crossPlatformSteps.push(step);
      }
    }
    
    return crossPlatformSteps;
  }
  
  // ═══════════════════════════════════════════════════════════
  // PRINT CROSS-PLATFORM MESSAGE
  // ═══════════════════════════════════════════════════════════
  printCrossPlatformMessage(chain, currentPlatform) {
    console.error('\n' + '═'.repeat(60));
    console.error('⚠️  CROSS-PLATFORM PREREQUISITES DETECTED');
    console.error('═'.repeat(60));
    
    console.error('\n📊 Cannot auto-execute prerequisites across platforms');
    console.error(`   Current test platform: ${currentPlatform}`);
    
    console.error('\n💡 RUN THESE COMMANDS IN ORDER:\n');
    
    for (const step of chain) {
      if (step.complete) continue;
      
      const platform = step.platform;
      const emoji = step.isTarget ? '🎯' : '📍';
      
      console.error(`${emoji} ${step.status} (${platform})`);
      
      if (!step.isTarget) {
        if (platform === 'web' || platform === 'cms' || platform === 'playwright') {
          console.error(`   npm run test:impl -- ${step.testFile}`);
        } else if (platform === 'dancer') {
          console.error(`   npm run test:impl -- ${step.testFile}`);
        } else if (platform === 'clubApp' || platform === 'club') {
          console.error(`   npm run test:impl -- ${step.testFile}`);
        }
        console.error('');
      }
    }
    
    console.error('═'.repeat(60) + '\n');
  }
  
  // ═══════════════════════════════════════════════════════════
  // PRINT NOT READY ERROR
  // ═══════════════════════════════════════════════════════════
  printNotReadyError(analysis) {
    const { currentStatus, targetStatus, chain, nextStep, missingFields, isLoopTransition, previousStatus } = analysis;
    
    console.error('\n' + '═'.repeat(60));
    console.error('❌ TEST NOT READY - PREREQUISITES NOT MET');
    console.error('═'.repeat(60));
    
    console.error(`\n📊 Status:`);
    console.error(`   Current: ${currentStatus}`);
    console.error(`   Target:  ${targetStatus}`);
    if (isLoopTransition) {
      console.error(`   🔄 Loop: needs ${previousStatus} first`);
    }
    
    if (missingFields.length > 0) {
      console.error(`\n❌ Missing Requirements:`);
      missingFields.forEach(fieldInfo => {
        if (typeof fieldInfo === 'string') {
          console.error(`   - ${fieldInfo}`);
        } else {
          console.error(`   - ${fieldInfo.field}: required=${fieldInfo.required}, actual=${fieldInfo.actual}`);
        }
      });
    }
    
    console.error(`\n🗺️  Full Path to Target:\n`);
    
    chain.forEach((step, index) => {
      const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
      const label = step.complete ? ' ← Complete' : step.isTarget ? ' ← Target' : '';
      const currentLabel = step.status === currentStatus ? ' (current)' : '';
      
      console.error(`   ${icon} ${index + 1}. ${step.status}${currentLabel}${label}`);
      
      if (!step.complete && !step.isTarget) {
        console.error(`      Action: ${step.actionName}`);
        console.error(`      Test: ${step.testFile}`);
      }
      
      if (index < chain.length - 1) {
        console.error('      ↓');
      }
    });

    const blockedSteps = chain.filter(s => s.blocked);
if (blockedSteps.length > 0) {
  console.error(`\n🚫 BLOCKED TRANSITIONS:`);
  blockedSteps.forEach(step => {
    console.error(`\n   ${step.status}:`);
    console.error(`   Reason: ${step.blockedReason}`);
    if (step.blockedTransitions) {
      step.blockedTransitions.forEach(t => {
        console.error(`   Event ${t.event}:`);
        t.blockedBy.forEach(b => {
          console.error(`      ❌ ${b.field}: need ${JSON.stringify(b.expected)}, have ${JSON.stringify(b.actual)}`);
        });
      });
    }
  });
  
  console.error(`\n💡 FIX: Update your testData to match the required conditions,`);
  console.error(`   or run a different test that matches your current testData.`);
}
    
    if (nextStep) {
      console.error(`\n💡 NEXT STEP: ${nextStep.status}`);
      console.error(`   Action: ${nextStep.actionName}`);
      console.error(`   Test: ${nextStep.testFile}`);
    }
    
    console.error('═'.repeat(60) + '\n');
  }

  // ═══════════════════════════════════════════════════════════
  // GROUP CHAIN BY PLATFORM
  // ═══════════════════════════════════════════════════════════
_groupChainByPlatform(chain, testData = null, ImplicationClass = null) {
  const segments = [];
  let currentSegment = null;
  
  const currentStatus = testData?.status;
  
  console.log('DEBUG: Raw chain:', chain.map(s => `${s.status}(${s.complete ? '✅' : '📍'})`).join(' → '));
  
  // ═══════════════════════════════════════════════════════════
  // FIX: Determine if steps before currentStatus are already done
  // Check if the step immediately before currentStatus leads TO currentStatus
  // via a "normal" path (like cookies → landing_page) or a "loop" path
  // ═══════════════════════════════════════════════════════════
  if (currentStatus) {
    const currentStatusIndex = chain.findIndex(s => s.status === currentStatus);
    
    if (currentStatusIndex > 0) {
      // Get the step immediately before currentStatus
      const stepBeforeCurrent = chain[currentStatusIndex - 1];
      
      // Check if this step is a "loop" step (agency flow) or "normal" step (init/cookies)
      // Agency flow steps contain "agency" in their name
      const isLoopPath = stepBeforeCurrent.status.includes('agency') || 
                         stepBeforeCurrent.status.includes('preffered');
      
      if (isLoopPath) {
        // This is a loop path - steps before current need to execute
        for (let i = 0; i < currentStatusIndex; i++) {
          chain[i].complete = false;
        }
      }
      // If not a loop path, leave completion status as-is from raw chain
    }
  }
  
  for (const step of chain) {
    if (!currentSegment || currentSegment.platform !== step.platform) {
      currentSegment = {
        platform: step.platform,
        steps: [],
        complete: true
      };
      segments.push(currentSegment);
    }
    
    currentSegment.steps.push(step);
    
    if (!step.complete) {
      currentSegment.complete = false;
    }
  }
  
  // Re-check segment completeness based on actual requirements
  if (ImplicationClass && testData) {
    const meta = ImplicationClass.xstateConfig?.meta || {};
    
    if (meta.requires) {
      for (const segment of segments) {
        if (!segment.complete) continue;
        
        for (const [field, requiredValue] of Object.entries(meta.requires)) {
          if (field === 'previousStatus') continue;
          if (field.startsWith('!')) continue;
          
          if (field.includes('.')) {
            const actualValue = field.split('.').reduce((obj, key) => obj?.[key], testData);
            
            if (actualValue !== requiredValue) {
              const [entity] = field.split('.');
              
              const hasEntitySteps = segment.steps.some(step => 
                step.status && (step.status.includes(entity) || step.entity === entity)
              );
              
              if (hasEntitySteps) {
                segment.complete = false;
                break;
              }
            }
          }
        }
      }
    }
  }
  
  return segments;
}

  // Add this new method to TestPlanner class (around line 580, after _selectTransition):
// ═══════════════════════════════════════════════════════════
// FIND ALTERNATIVE PATH TO TARGET (BFS with condition checking)
// ═══════════════════════════════════════════════════════════
_findAlternativePathToTarget(fromStatus, toStatus, testData, visited = new Set(), blockedVia = null) {
  if (this.options.verbose) {
    console.log(`   🔍 Searching alternative path: ${fromStatus} → ${toStatus} (avoiding direct path via ${blockedVia})`);
  }
  
  // BFS to find valid path - but allow revisiting fromStatus if we've made progress
  const queue = [{ status: fromStatus, path: [], visitedInPath: new Set([fromStatus]) }];
  
  let iterations = 0;
  const maxIterations = 200;
  
  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const { status: currentStatus, path, visitedInPath } = queue.shift();
    
    // Get all valid outgoing transitions from current status
    const validTransitions = this._getValidOutgoingTransitions(currentStatus, testData);
    
    if (this.options.verbose && validTransitions.length > 0) {
      console.log(`      [${iterations}] At ${currentStatus}, valid transitions: ${validTransitions.map(t => `${t.event}→${t.target}`).join(', ')}`);
    }
    
    for (const transition of validTransitions) {
      const nextStatus = transition.target;
      
      // Skip if this is the blocked direct path (only on first step)
      if (path.length === 0 && blockedVia && nextStatus === blockedVia) {
        if (this.options.verbose) {
          console.log(`      Skipping blocked direct path to ${nextStatus}`);
        }
        continue;
      }
      
      // Allow revisiting the start node if we've made progress (for loop paths)
      // But don't allow revisiting other nodes in our current path
      if (nextStatus !== fromStatus && visitedInPath.has(nextStatus)) {
        continue;
      }
      
      // If we loop back to start, we need to then be able to reach the target
      if (nextStatus === fromStatus && path.length > 0) {
        if (this.options.verbose) {
          console.log(`      🔄 Looped back to ${fromStatus} after ${path.length} steps`);
        }
        
        const transitionsFromStart = this._getValidOutgoingTransitions(fromStatus, testData);
        const toTargetTransition = transitionsFromStart.find(t => t.target === toStatus);
        
        if (toTargetTransition) {
          // ✅ FIX: Get correct setup entry for each step
          const fromSetupInfo = this._getSetupInfoForStatus(fromStatus, testData);
          const toSetupInfo = this._getSetupInfoForStatus(toStatus, testData);
          
          const finalPath = [...path, {
            status: fromStatus,
            from: currentStatus,
            event: transition.event,
            className: this.stateRegistry[fromStatus] || 'Unknown',
            actionName: fromSetupInfo.actionName || this._inferActionName(fromStatus),
            testFile: fromSetupInfo.testFile || 'unknown',
            platform: fromSetupInfo.platform || 'web',
            complete: false,
            isLoopBack: true
          }, {
            status: toStatus,
            from: fromStatus,
            event: toTargetTransition.event,
            className: this.stateRegistry[toStatus] || 'Unknown',
            actionName: toSetupInfo.actionName || this._inferActionName(toStatus),
            testFile: toSetupInfo.testFile || 'unknown',
            platform: toSetupInfo.platform || 'web',
            complete: false,
            isTarget: true
          }];
          
          if (this.options.verbose) {
            console.log(`   ✅ Found loop path (${finalPath.length} steps): ${fromStatus} → ${path.map(s => s.status).join(' → ')} → ${fromStatus} → ${toStatus}`);
          }
          return finalPath;
        }
      }
      
      const newVisited = new Set(visitedInPath);
      newVisited.add(nextStatus);
      
      // ✅ FIX: Get correct setup entry for this step based on testData
      const setupInfo = this._getSetupInfoForStatus(nextStatus, testData);
      
      const newPath = [...path, {
        status: nextStatus,
        from: currentStatus,
        event: transition.event,
        className: this.stateRegistry[nextStatus] || 'Unknown',
        actionName: setupInfo.actionName || this._inferActionName(nextStatus),
        testFile: setupInfo.testFile || this._inferTestFile(this.stateRegistry[nextStatus], nextStatus),
        platform: setupInfo.platform || 'web',
        complete: false,
        isTarget: nextStatus === toStatus
      }];
      
      // Found the target directly!
      if (nextStatus === toStatus) {
        if (this.options.verbose) {
          console.log(`   ✅ Alternative path found (${newPath.length} steps): ${fromStatus} → ${newPath.map(s => s.status).join(' → ')}`);
        }
        return newPath;
      }
      
      // Continue searching
      queue.push({ status: nextStatus, path: newPath, visitedInPath: newVisited });
    }
  }
  
  if (this.options.verbose) {
    console.log(`   ❌ No alternative path found after ${iterations} iterations`);
  }
  
  return null;
}

// ✅ NEW HELPER: Get setup info for a status based on testData
_getSetupInfoForStatus(status, testData) {
  const implClassName = this.stateRegistry[status];
  if (!implClassName) {
    return { actionName: null, testFile: null, platform: 'web' };
  }
  
  const implPath = this.findImplicationFile(implClassName);
  if (!implPath) {
    return { actionName: null, testFile: null, platform: 'web' };
  }
  
  try {
    this._clearImplicationCache(implPath);
    const ImplClass = require(implPath);
    const meta = ImplClass.xstateConfig?.meta || {};
    
    // Use _findSetupEntry to get the correct entry based on testData
    const setupEntry = TestPlanner._findSetupEntry(meta, { testData });
    
    if (setupEntry) {
      return {
        actionName: setupEntry.actionName,
        testFile: setupEntry.testFile,
        platform: setupEntry.platform || meta.platform || 'web'
      };
    }
    
    // Fallback to first setup entry
    const firstSetup = meta.setup?.[0];
    return {
      actionName: firstSetup?.actionName,
      testFile: firstSetup?.testFile,
      platform: firstSetup?.platform || meta.platform || 'web'
    };
    
  } catch (error) {
    return { actionName: null, testFile: null, platform: 'web' };
  }
}

// ═══════════════════════════════════════════════════════════
// GET ALL VALID OUTGOING TRANSITIONS FROM A STATUS
// ═══════════════════════════════════════════════════════════
_getValidOutgoingTransitions(fromStatus, testData) {
  const transitions = [];
  
  const implClassName = this.stateRegistry[fromStatus];
  if (!implClassName) return transitions;
  
  const implPath = this.findImplicationFile(implClassName);
  if (!implPath) return transitions;
  
  try {
    this._clearImplicationCache(implPath);
    const ImplClass = require(implPath);
    const xstateConfig = ImplClass.xstateConfig || {};
    const on = xstateConfig.on || {};
    
    for (const [event, config] of Object.entries(on)) {
      const configs = Array.isArray(config) ? config : [config];
      
      for (const singleConfig of configs) {
        const target = typeof singleConfig === 'string' ? singleConfig : singleConfig?.target;
        if (!target) continue;
        
        const configObj = typeof singleConfig === 'string' ? { target } : singleConfig;
        
        // Check conditions
        let conditionsMet = true;
        let hasConditions = false;
        
        if (configObj.conditions?.blocks?.length > 0) {
          hasConditions = true;
          const result = this._evaluateConditions(configObj.conditions, testData);
          conditionsMet = result.met;
        } else if (configObj.requires && Object.keys(configObj.requires).length > 0) {
          // Only count as "has conditions" if requires has actual fields (not empty object)
          const nonPreviousStatusKeys = Object.keys(configObj.requires).filter(k => k !== 'previousStatus');
          if (nonPreviousStatusKeys.length > 0) {
            hasConditions = true;
            const result = this._checkTransitionRequires(configObj.requires, testData);
            conditionsMet = result.met;
          }
        }
        
        // Get setup info for the target state
        const targetImplClassName = this.stateRegistry[target];
        let actionName = null;
        let testFile = null;
        let platform = configObj.platforms?.[0] || 'web';
        
        if (targetImplClassName) {
          const targetImplPath = this.findImplicationFile(targetImplClassName);
          if (targetImplPath) {
            try {
              this._clearImplicationCache(targetImplPath);
              const TargetImplClass = require(targetImplPath);
              const targetMeta = TargetImplClass.xstateConfig?.meta || {};
              const setup = targetMeta.setup?.[0];
              if (setup) {
                actionName = setup.actionName;
                testFile = setup.testFile;
                platform = setup.platform || platform;
              }
            } catch (e) {
              // Ignore
            }
          }
        }
        
        transitions.push({
          event,
          target,
          actionName,
          testFile,
          platform,
          config: configObj,
          hasConditions,
          conditionsMet,
          // ✅ Priority score for sorting
          priority: hasConditions && conditionsMet ? 2    // Matching conditions = highest
                  : !hasConditions ? 1                     // No conditions = middle  
                  : 0                                      // Has conditions but NOT met = lowest (blocked)
        });
      }
    }
    
    // ✅ Sort by priority (highest first)
    transitions.sort((a, b) => b.priority - a.priority);
    
    // ✅ Filter out blocked transitions (priority 0)
    const validTransitions = transitions.filter(t => t.priority > 0);
    
    if (this.options.verbose && transitions.length > validTransitions.length) {
      const blocked = transitions.filter(t => t.priority === 0);
      blocked.forEach(t => {
        console.log(`      ⛔ ${t.event} → ${t.target} (conditions not met)`);
      });
    }
    
    return validTransitions;
    
  } catch (error) {
    if (this.options.verbose) {
      console.warn(`   ⚠️ Error getting transitions from ${fromStatus}: ${error.message}`);
    }
  }
  
  return transitions;
}
// ═══════════════════════════════════════════════════════════
// CHECK IF TRANSITION CONDITIONS ARE MET
// ═══════════════════════════════════════════════════════════
_checkTransitionConditionsToTarget(sourceStatus, targetStatus, testData) {
  // Find the source implication
  const sourceImplClassName = this.stateRegistry[sourceStatus];
  if (!sourceImplClassName) {
    return { valid: true, reason: 'source not in registry' };
  }
  
  const sourceImplPath = this.findImplicationFile(sourceImplClassName);
  if (!sourceImplPath) {
    return { valid: true, reason: 'source file not found' };
  }
  
  try {
    this._clearImplicationCache(sourceImplPath);
    const SourceImplClass = require(sourceImplPath);
    const transitions = SourceImplClass.xstateConfig?.on || {};
    
    // Find ALL transitions that lead to targetStatus
    const matchingTransitions = [];
    
    for (const [event, config] of Object.entries(transitions)) {
      const configs = Array.isArray(config) ? config : [config];
      
      for (const singleConfig of configs) {
        const target = typeof singleConfig === 'string' ? singleConfig : singleConfig?.target;
        
        if (target === targetStatus) {
          const configObj = typeof singleConfig === 'string' ? { target } : singleConfig;
          
          // Check conditions
          let conditionsMet = true;
          let blockedBy = [];
          
          if (configObj.conditions?.blocks?.length > 0) {
            const result = this._evaluateConditions(configObj.conditions, testData);
            conditionsMet = result.met;
            if (!conditionsMet && result.results) {
              for (const blockResult of result.results) {
                if (!blockResult.met && blockResult.checks) {
                  blockedBy.push(...blockResult.checks.filter(c => !c.met));
                }
              }
            }
          } else if (configObj.requires) {
            const result = this._checkTransitionRequires(configObj.requires, testData);
            conditionsMet = result.met;
            if (!conditionsMet) {
              blockedBy = result.checks.filter(c => !c.met);
            }
          }
          
          matchingTransitions.push({
            event,
            config: configObj,
            conditionsMet,
            blockedBy,
            hasConditions: !!(configObj.conditions?.blocks?.length > 0 || configObj.requires)
          });
        }
      }
    }
    
    if (matchingTransitions.length === 0) {
      // No direct transition exists - that's fine, might use different path
      return { valid: true, noDirectTransition: true };
    }
    
    // Check if ANY transition to target has conditions met
    const validTransition = matchingTransitions.find(t => t.conditionsMet);
    
    if (validTransition) {
      return { 
        valid: true, 
        event: validTransition.event,
        transition: validTransition
      };
    }
    
    // All transitions blocked!
    return {
      valid: false,
      blockedTransitions: matchingTransitions,
      from: sourceStatus,
      to: targetStatus
    };
    
  } catch (error) {
    if (this.options.verbose) {
      console.warn(`   ⚠️ Error checking transition ${sourceStatus} → ${targetStatus}: ${error.message}`);
    }
    return { valid: true, reason: `error: ${error.message}` };
  }
}

// ═══════════════════════════════════════════════════════════
// FIND ALTERNATIVE PATH WHEN DIRECT PATH IS BLOCKED
// ═══════════════════════════════════════════════════════════
_findAlternativePathFrom(fromStatus, testData, visited = new Set(), depth = 0) {
  if (depth > 10) return []; // Prevent infinite recursion
  if (visited.has(fromStatus)) return [];
  
  visited.add(fromStatus);
  
  const sourceImplClassName = this.stateRegistry[fromStatus];
  if (!sourceImplClassName) return [];
  
  const sourceImplPath = this.findImplicationFile(sourceImplClassName);
  if (!sourceImplPath) return [];
  
  try {
    this._clearImplicationCache(sourceImplPath);
    const SourceImplClass = require(sourceImplPath);
    const transitions = SourceImplClass.xstateConfig?.on || {};
    
    const validNextStates = [];
    
    for (const [event, config] of Object.entries(transitions)) {
      const configs = Array.isArray(config) ? config : [config];
      
      for (const singleConfig of configs) {
        const target = typeof singleConfig === 'string' ? singleConfig : singleConfig?.target;
        if (!target) continue;
        if (visited.has(target)) continue;
        
        const configObj = typeof singleConfig === 'string' ? { target } : singleConfig;
        
        // Check if conditions are met
        let conditionsMet = true;
        
        if (configObj.conditions?.blocks?.length > 0) {
          const result = this._evaluateConditions(configObj.conditions, testData);
          conditionsMet = result.met;
        } else if (configObj.requires) {
          const result = this._checkTransitionRequires(configObj.requires, testData);
          conditionsMet = result.met;
        }
        
        if (conditionsMet) {
          validNextStates.push({
            status: target,
            event,
            from: fromStatus
          });
        }
      }
    }
    
    return validNextStates;
    
  } catch (error) {
    return [];
  }
}

  // ═══════════════════════════════════════════════════════════
  // SELECT TRANSITION (for multi-path)
  // ═══════════════════════════════════════════════════════════
  _selectTransition(sourceImplication, targetStatus, currentPlatform, options = {}) {
    const { explicitEvent, preferSamePlatform = true, testData } = options;
    
    const xstateConfig = sourceImplication.xstateConfig || {};
    const transitions = xstateConfig.on || {};
    
    const candidates = [];
    
   for (const [event, config] of Object.entries(transitions)) {
      const configs = Array.isArray(config) ? config : [config];
      
      for (const singleConfig of configs) {
        const target = typeof singleConfig === 'string' ? singleConfig : singleConfig?.target;
        
        if (!target) continue;
        
        if (target === targetStatus || target.endsWith(`_${targetStatus}`)) {
          const configObj = typeof singleConfig === 'string' ? { target } : singleConfig;
          
          // Check new conditions format first, fallback to legacy requires
          let requirementCheck;
          if (configObj.conditions?.blocks?.length > 0) {
            requirementCheck = this._evaluateConditions(configObj.conditions, testData);
          } else {
            requirementCheck = this._checkTransitionRequires(configObj.requires, testData);
          }
          
          const hasRequirements = !!(configObj.conditions?.blocks?.length > 0 || configObj.requires);
          
          candidates.push({
            event,
            config: configObj,
            meetsRequirements: requirementCheck.met,
            hasRequirements: hasRequirements,
            requirementDetails: requirementCheck
          });
        }
      }
    }
    
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    
    if (this.options.verbose) {
      console.log(`   🔀 Multiple paths to ${targetStatus}: ${candidates.map(c => c.event).join(', ')}`);
    }
    
    // Priority 1: Explicit event
    if (explicitEvent) {
      const match = candidates.find(c => c.event === explicitEvent);
      if (match) {
        if (this.options.verbose) console.log(`   ✅ Using explicit event: ${explicitEvent}`);
        return match;
      }
    }
    
    // Priority 2: Matching requirements
    const matchingWithRequirements = candidates.find(c => c.hasRequirements && c.meetsRequirements);
    if (matchingWithRequirements) {
      if (this.options.verbose) console.log(`   ✅ Using transition with matching requires: ${matchingWithRequirements.event}`);
      return matchingWithRequirements;
    }
    
    // Priority 3: No requirements (default path)
    const noRequirements = candidates.find(c => !c.hasRequirements);
    if (noRequirements) {
      if (this.options.verbose) console.log(`   ✅ Using default transition (no requires): ${noRequirements.event}`);
      return noRequirements;
    }
    
    // Priority 4: isDefault flag
    const defaultCandidate = candidates.find(c => c.config.isDefault === true);
    if (defaultCandidate) {
      if (this.options.verbose) console.log(`   ✅ Using marked default: ${defaultCandidate.event}`);
      return defaultCandidate;
    }
    
    // Priority 5: Same platform
    if (preferSamePlatform) {
      const samePlatform = candidates.find(c => 
        c.config.platforms?.includes(currentPlatform)
      );
      if (samePlatform) {
        if (this.options.verbose) console.log(`   ✅ Using same-platform transition: ${samePlatform.event}`);
        return samePlatform;
      }
    }
    
    if (this.options.verbose) console.log(`   ⚠️  Using first available: ${candidates[0].event}`);
    return candidates[0];
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK TRANSITION REQUIRES
  // ═══════════════════════════════════════════════════════════
_checkTransitionRequires(requires, testData) {
  if (!requires || !testData) {
    return { met: true, checks: [] };
  }
  
  // ✅ Helper to check special object requirements
  const checkSpecialRequirement = (requiredValue, actualValue, testData) => {
    if (typeof requiredValue !== 'object' || requiredValue === null) {
      return actualValue === requiredValue;
    }
    
    // { exists: true }
    if (requiredValue.exists === true) {
      return actualValue !== undefined && actualValue !== null;
    }
    
    // { exists: false }
    if (requiredValue.exists === false) {
      return actualValue === undefined || actualValue === null;
    }
    
    // { contains: value } - can be a ctx.data reference
    if (requiredValue.contains !== undefined) {
      const valueToCheck = this._resolveValue(requiredValue.contains, testData);
      return Array.isArray(actualValue) && actualValue.includes(valueToCheck);
    }
    
    // { notContains: value }
    if (requiredValue.notContains !== undefined) {
      const valueToCheck = this._resolveValue(requiredValue.notContains, testData);
      return !Array.isArray(actualValue) || !actualValue.includes(valueToCheck);
    }
    
    // { greaterThan: value }
    if (requiredValue.greaterThan !== undefined) {
      return typeof actualValue === 'number' && actualValue > requiredValue.greaterThan;
    }
    
    // { lessThan: value }
    if (requiredValue.lessThan !== undefined) {
      return typeof actualValue === 'number' && actualValue < requiredValue.lessThan;
    }
    
    // { matches: regex }
    if (requiredValue.matches !== undefined) {
      const regex = new RegExp(requiredValue.matches);
      return typeof actualValue === 'string' && regex.test(actualValue);
    }
    
    // { oneOf: [values] }
    if (Array.isArray(requiredValue.oneOf)) {
      return requiredValue.oneOf.includes(actualValue);
    }
    
    // Unknown object - deep equality
    return JSON.stringify(actualValue) === JSON.stringify(requiredValue);
  };
  
  const checks = [];
  let allMet = true;
  
  for (const [field, requiredValue] of Object.entries(requires)) {
    let checkResult = { field, required: requiredValue, met: false };
    
    if (field === 'previousStatus') {
      const changeLog = testData._changeLog || [];
      const visitedStatuses = changeLog.map(entry => entry.status);
      checkResult.met = visitedStatuses.includes(requiredValue);
      checkResult.actual = visitedStatuses;
    }
    else if (field.startsWith('!')) {
      // Negation: field must NOT equal value
      const cleanField = field.slice(1);
      const actualValue = this._getNestedValue(cleanField, testData);
      
      // Handle special requirements with negation
      if (typeof requiredValue === 'object' && requiredValue !== null) {
        // !field: { contains: x } means field must NOT contain x
        checkResult.met = !checkSpecialRequirement(requiredValue, actualValue, testData);
      } else {
        checkResult.met = actualValue !== requiredValue;
      }
      checkResult.actual = actualValue;
    }
    else {
      // Normal field check
      const actualValue = field.includes('.') 
        ? this._getNestedValue(field, testData)
        : testData[field];
      
      checkResult.met = checkSpecialRequirement(requiredValue, actualValue, testData);
      checkResult.actual = actualValue;
    }
    
    checks.push(checkResult);
    
    if (!checkResult.met) {
      allMet = false;
    }
  }
  
  return { met: allMet, checks };
}

  _getNestedValue(pathStr, obj) {
    return pathStr.split('.').reduce((current, key) => current?.[key], obj);
  }

  // ═══════════════════════════════════════════════════════════
  // EVALUATE CONDITION BLOCKS (NEW! - Supports block-based conditions)
  // ═══════════════════════════════════════════════════════════
  _evaluateConditions(conditions, testData, storedVariables = {}) {
    // If no conditions or empty, pass
    if (!conditions?.blocks || conditions.blocks.length === 0) {
      return { met: true, checks: [] };
    }
    
    const { mode = 'all', blocks } = conditions;
    const enabledBlocks = blocks.filter(b => b.enabled !== false);
    
    if (enabledBlocks.length === 0) {
      return { met: true, checks: [] };
    }
    
    const results = enabledBlocks.map(block => 
      this._evaluateSingleBlock(block, testData, storedVariables)
    );
    
    // mode: 'all' = AND, mode: 'any' = OR
    const met = mode === 'any' 
      ? results.some(r => r.met)
      : results.every(r => r.met);
    
    return { met, results };
  }

  _evaluateSingleBlock(block, testData, storedVariables) {
    if (block.type === 'condition-check') {
      return this._evaluateConditionCheckBlock(block, testData, storedVariables);
    } else if (block.type === 'custom-code') {
      return this._evaluateCustomCodeBlock(block, testData, storedVariables);
    }
    return { met: true, type: 'unknown' };
  }

  _evaluateConditionCheckBlock(block, testData, storedVariables) {
    const { mode = 'all', data } = block;
    const checks = data?.checks || [];
    
    if (checks.length === 0) {
      return { met: true, type: 'condition-check', checks: [] };
    }
    
    const results = checks.map(check => {
      const { field, operator, value, valueType } = check;
      
      // Resolve field value (support nested paths and stored variables)
      let actualValue = this._resolveFieldValue(field, testData, storedVariables);
      
      // Resolve comparison value (might be a variable reference)
      let compareValue = value;
      if (valueType === 'variable' && typeof value === 'string') {
        compareValue = this._resolveFieldValue(value.replace(/^\{\{|\}\}$/g, ''), testData, storedVariables);
      }
      
      const met = this._evaluateOperator(actualValue, operator, compareValue);
      
      return { field, operator, expected: compareValue, actual: actualValue, met };
    });
    
    const met = mode === 'any'
      ? results.some(r => r.met)
      : results.every(r => r.met);
    
    return { met, type: 'condition-check', checks: results };
  }

  _evaluateCustomCodeBlock(block, testData, storedVariables) {
    try {
      const code = block.code || '';
      
      // Create function with testData and storedVariables in scope
      const fn = new Function('testData', 'storedVariables', `
        ${code}
      `);
      
      const result = fn(testData, storedVariables);
      
      return { met: !!result, type: 'custom-code' };
    } catch (error) {
      console.warn(`⚠️ Custom code evaluation failed: ${error.message}`);
      return { met: false, type: 'custom-code', error: error.message };
    }
  }

  _resolveFieldValue(fieldPath, testData, storedVariables) {
    if (!fieldPath) return undefined;
    
    // Remove {{ }} wrapper if present
    fieldPath = fieldPath.replace(/^\{\{|\}\}$/g, '').trim();
    
    // Check storedVariables first (for step conditions)
    if (storedVariables) {
      const [varName, ...rest] = fieldPath.split('.');
      if (storedVariables[varName] !== undefined) {
        if (rest.length === 0) {
          return storedVariables[varName];
        }
        return rest.reduce((obj, key) => obj?.[key], storedVariables[varName]);
      }
    }
    
    // Check testData
    return fieldPath.split('.').reduce((obj, key) => obj?.[key], testData);
  }

  _evaluateOperator(actual, operator, expected) {
    switch (operator) {
      // Equality
      case 'equals':
        return actual === expected;
      case 'notEquals':
        return actual !== expected;
      
      // Comparison
      case 'greaterThan':
        return Number(actual) > Number(expected);
      case 'greaterThanOrEqual':
        return Number(actual) >= Number(expected);
      case 'lessThan':
        return Number(actual) < Number(expected);
      case 'lessThanOrEqual':
        return Number(actual) <= Number(expected);
      
      // String
      case 'contains':
        return String(actual || '').includes(String(expected || ''));
      case 'notContains':
        return !String(actual || '').includes(String(expected || ''));
      case 'startsWith':
        return String(actual || '').startsWith(String(expected || ''));
      case 'endsWith':
        return String(actual || '').endsWith(String(expected || ''));
      case 'matches':
        try {
          return new RegExp(expected).test(String(actual || ''));
        } catch {
          return false;
        }
      
      // Array
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'notIn':
        return Array.isArray(expected) && !expected.includes(actual);
      
      // Existence
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'notExists':
        return actual === undefined || actual === null;
      case 'truthy':
        return !!actual;
      case 'falsy':
        return !actual;
      
      default:
        console.warn(`⚠️ Unknown operator: ${operator}`);
        return false;
    }
  }

  // Add this static helper near the top of the class (after _getPlatformPrerequisites):

static _getPlaywrightConfigPath() {
  // 1. Check ai-testing.config.js first
  try {
    const configPath = path.join(process.cwd(), 'ai-testing.config.js');
    if (fs.existsSync(configPath)) {
      delete require.cache[require.resolve(configPath)];
      const config = require(configPath);
      if (config.playwrightConfig) {
        const explicitPath = path.join(process.cwd(), config.playwrightConfig);
        if (fs.existsSync(explicitPath)) {
          return explicitPath;
        }
        console.warn(`⚠️  Configured playwrightConfig not found: ${config.playwrightConfig}`);
      }
    }
  } catch (e) {
    // Config not found or invalid
  }
  
  // 2. Auto-detect common locations
  const commonPaths = [
    'playwright.config.js',
    'playwright.config.ts',
    'config/playwright.config.js',
    'config/playwright.config.ts',
    'config/frameworks/playwright.config.js',
    'config/frameworks/playwright.config.ts'
  ];
  
  for (const configFile of commonPaths) {
    const fullPath = path.join(process.cwd(), configFile);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  
  // 3. Fallback - let Playwright find it (no --config flag)
  return null;
}

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC: PLATFORM PREREQUISITES
  // ═══════════════════════════════════════════════════════════════════════════
  static platformPrerequisites = null;

  static _getPlatformPrerequisites() {
    if (this.platformPrerequisites) return this.platformPrerequisites;
    
    try {
      const configPath = path.join(process.cwd(), 'ai-testing.config.js');
      if (fs.existsSync(configPath)) {
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        if (config.platformPrerequisites) {
          console.log('📋 Loaded platformPrerequisites from ai-testing.config.js');
          this.platformPrerequisites = config.platformPrerequisites;
          return this.platformPrerequisites;
        }
      }
    } catch (e) {
      // Config not found or invalid
    }
    
    // Defaults
    this.platformPrerequisites = {
      dancer: {
        check: (data) => data.dancer?.logged_in === true,
        state: 'dancer_logged_in',
        implClass: 'DancerLoggedInImplications',
        file: 'tests/implications/bookings/status/DancerLoggedInViaDancerRegistered-SIGNIN-Dancer-UNIT.spec.js',
        actionName: 'dancerLoggedInViaDancerRegistered'
      },
      clubApp: {
        check: (data) => data.club?.logged_in === true,
        state: 'club_logged_in',
        implClass: 'ClubLoggedInImplications',
        file: 'tests/implications/bookings/status/ClubLoggedInViaClubRegistered-SIGNIN-ClubApp-UNIT.spec.js',
        actionName: 'clubLoggedInViaClubRegistered'
      },
      web: {
        check: (data) => data.manager?.logged_in === true,
        state: 'manager_logged_in',
        implClass: 'LoggedInImplications',
        file: 'tests/implications/bookings/status/LoggedInViaInitial-LOGIN-Web-UNIT.spec.js',
        actionName: 'loggedInViaInitial'
      }
    };
    
    return this.platformPrerequisites;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC: COUNTDOWN (for preFlightCheck)
  // ═══════════════════════════════════════════════════════════════════════════
  static async countdown(seconds, message) {
    console.log(`\n⏱️  ${message} in ${seconds} seconds...`);
    console.log(`   Press any key to cancel\n`);
    
    return new Promise((resolve) => {
      let timeLeft = seconds;
      let cancelled = false;
      
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      
      const onKeypress = () => {
        cancelled = true;
        cleanup();
        console.log('\n❌ Cancelled by user\n');
        resolve(false);
      };
      
      process.stdin.once('keypress', onKeypress);
      
      const interval = setInterval(() => {
        if (cancelled) return;
        
        timeLeft--;
        process.stdout.write(`\r⏱️  Starting in ${timeLeft} seconds... (press any key to cancel)`);
        
        if (timeLeft <= 0) {
          cleanup();
          console.log('\n\n🚀 Starting auto-execution...\n');
          resolve(true);
        }
      }, 1000);
      
      const cleanup = () => {
        clearInterval(interval);
        process.stdin.removeListener('keypress', onKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC: REQUIRES MISMATCH COUNTDOWN
  // ═══════════════════════════════════════════════════════════════════════════
  static async _requiresMismatchCountdown(seconds) {
    return new Promise((resolve) => {
      let timeLeft = seconds;
      let changed = false;
      
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      
      const onKeypress = () => {
        changed = true;
        cleanup();
        resolve(true); // true = change data
      };
      
      process.stdin.once('keypress', onKeypress);
      
      const interval = setInterval(() => {
        if (changed) return;
        
        timeLeft--;
        process.stdout.write(`\r⏱️  Continuing in ${timeLeft} seconds... (press any key to CHANGE data)  `);
        
        if (timeLeft <= 0) {
          cleanup();
          console.log('');
          resolve(false); // false = continue as-is
        }
      }, 1000);
      
      const cleanup = () => {
        clearInterval(interval);
        process.stdin.removeListener('keypress', onKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC: EXECUTE TEST IN SUBPROCESS
  // ═══════════════════════════════════════════════════════════════════════════
  static executeTestInSubprocess(testFile, platform) {
    const { spawnSync } = require('child_process');
    
    // Use run-test.js for all executions to ensure preflight runs
    const command = 'node';
    const args = ['run-test.js', testFile, '--skip-preflight']; // Skip preflight since parent already did it
    
    console.log(`   ⚡ Running ${path.basename(testFile)}...`);
    
    const result = spawnSync(command, args, {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        IS_PREREQUISITE_EXECUTION: 'true'
      }
    });
    
    if (result.status !== 0) {
      throw new Error(`Test failed with exit code ${result.status}`);
    }
    
    console.log(`   ✅ Completed\n`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUIRES MISMATCH WARNING SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

static _checkCurrentTestRequires(ImplicationClass, testData, options = {}) {
  const meta = ImplicationClass.xstateConfig?.meta || {};
  const { currentTestFile } = options;
  
  const mismatches = [];
  
  // ✅ Helper to check special object requirements
  const checkSpecialRequirement = (field, requiredValue, actualValue) => {
    if (typeof requiredValue !== 'object' || requiredValue === null) {
      // Simple equality check
      return actualValue === requiredValue;
    }
    
    // { exists: true } - field must have a value
    if (requiredValue.exists === true) {
      return actualValue !== undefined && actualValue !== null;
    }
    
    // { exists: false } - field must be null/undefined
    if (requiredValue.exists === false) {
      return actualValue === undefined || actualValue === null;
    }
    
    // { contains: value } - array must contain value
    if (requiredValue.contains !== undefined) {
      return Array.isArray(actualValue) && actualValue.includes(requiredValue.contains);
    }
    
    // { notContains: value } - array must NOT contain value
    if (requiredValue.notContains !== undefined) {
      return !Array.isArray(actualValue) || !actualValue.includes(requiredValue.notContains);
    }
    
    // { greaterThan: value }
    if (requiredValue.greaterThan !== undefined) {
      return typeof actualValue === 'number' && actualValue > requiredValue.greaterThan;
    }
    
    // { lessThan: value }
    if (requiredValue.lessThan !== undefined) {
      return typeof actualValue === 'number' && actualValue < requiredValue.lessThan;
    }
    
    // { matches: regex }
    if (requiredValue.matches !== undefined) {
      const regex = new RegExp(requiredValue.matches);
      return typeof actualValue === 'string' && regex.test(actualValue);
    }
    
    // { oneOf: [values] } - value must be one of the options
    if (Array.isArray(requiredValue.oneOf)) {
      return requiredValue.oneOf.includes(actualValue);
    }
    
    
    // Unknown object - fall back to deep equality (or just fail)
    return JSON.stringify(actualValue) === JSON.stringify(requiredValue);
  };
  
  // ✅ Helper to resolve nested paths
  const resolvePath = (obj, path) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };
  
  // Check setup entry requires
  const setupEntry = this._findSetupEntry(meta, { currentTestFile, testData });
  
  // Check new conditions format first
  if (setupEntry?.conditions?.blocks?.length > 0) {
    const planner = new TestPlanner({ verbose: false });
    const conditionResult = planner._evaluateConditions(setupEntry.conditions, testData);
    
    if (!conditionResult.met && conditionResult.results) {
      for (const blockResult of conditionResult.results) {
        if (!blockResult.met && blockResult.checks) {
          for (const check of blockResult.checks) {
            if (!check.met) {
              mismatches.push({
                field: check.field,
                required: `${check.operator} ${JSON.stringify(check.expected)}`,
                actual: check.actual,
                source: 'setup-condition'
              });
            }
          }
        }
      }
    }
  }
  // Fallback to legacy requires
  else  if (setupEntry?.requires) {
    for (const [field, requiredValue] of Object.entries(setupEntry.requires)) {
      if (field === 'previousStatus') continue;
      
      // ✅ Skip status fields - these are handled by prerequisite chain, not data changes
      if (field.endsWith('.status') || field === 'status') continue;
      
      const actualValue = resolvePath(testData, field);
      
      // ✅ Use helper for special requirements
      if (!checkSpecialRequirement(field, requiredValue, actualValue)) {
        mismatches.push({ field, required: requiredValue, actual: actualValue, source: 'setup' });
      }
    }
  }
  
  // Check transition requires on SOURCE Implication
  if (currentTestFile) {
    const event = this._extractEventFromFilename(currentTestFile);
    const previousStatus = meta.requires?.previousStatus || setupEntry?.previousStatus;
    
    if (event && previousStatus) {
      try {
        const planner = new TestPlanner({ verbose: false });
        const sourceImplClassName = planner.stateRegistry[previousStatus];
        
        if (sourceImplClassName) {
          const sourceImplPath = planner.findImplicationFile(sourceImplClassName);
          
          if (sourceImplPath) {
            delete require.cache[require.resolve(sourceImplPath)];
            const SourceImplClass = require(sourceImplPath);
            
            const transitions = SourceImplClass.xstateConfig?.on || {};
            const transition = transitions[event];
            
            if (transition) {
              const configs = Array.isArray(transition) ? transition : [transition];
              
              for (const singleConfig of configs) {
                const config = typeof singleConfig === 'string' ? null : singleConfig;
                
                if (config?.requires) {
                  const transitionTarget = config.target;
                  const ourTarget = meta.status;
                  
                  if (transitionTarget === ourTarget || transitionTarget?.endsWith(ourTarget)) {
                    for (const [field, requiredValue] of Object.entries(config.requires)) {
                      if (field === 'previousStatus') continue;
                      if (mismatches.some(m => m.field === field)) continue;
                      
                      const actualValue = resolvePath(testData, field);
                      
                      // ✅ Use helper for special requirements
                      if (!checkSpecialRequirement(field, requiredValue, actualValue)) {
                        mismatches.push({ 
                          field, 
                          required: requiredValue, 
                          actual: actualValue, 
                          source: 'transition',
                          fromState: previousStatus,
                          event: event
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        // Silently continue
      }
    }
  }
  
  return { hasMismatch: mismatches.length > 0, mismatches };
}

  // Add this helper method to TestPlanner class (around line 1900):

/**
 * Check if we can take a transition TO a target status from current state
 * Looks at the source state's outgoing transitions and checks conditions
 */
static _canTakeTransitionTo(targetStatus, currentStatus, testData) {
  const planner = new TestPlanner({ verbose: false });
  
  // Find what state leads to targetStatus
  const targetImplClassName = planner.stateRegistry[targetStatus];
  if (!targetImplClassName) {
    return { valid: true, reason: 'target not in registry' };
  }
  
  const targetImplPath = planner.findImplicationFile(targetImplClassName);
  if (!targetImplPath) {
    return { valid: true, reason: 'target file not found' };
  }
  
  try {
    delete require.cache[require.resolve(targetImplPath)];
    const TargetImplClass = require(targetImplPath);
    const meta = TargetImplClass.xstateConfig?.meta || {};
    
    // ✅ FIX: Use _findSetupEntry to get the correct entry based on testData
    const setupEntry = TestPlanner._findSetupEntry(meta, { testData });
    const previousStatus = setupEntry?.previousStatus || meta.requires?.previousStatus;
    
    if (!previousStatus) {
      return { valid: true, reason: 'no previousStatus defined' };
    }
    
    // Now check the SOURCE state's transition conditions
    const sourceImplClassName = planner.stateRegistry[previousStatus];
    if (!sourceImplClassName) {
      return { valid: true, reason: 'source not in registry' };
    }
    
    const sourceImplPath = planner.findImplicationFile(sourceImplClassName);
    if (!sourceImplPath) {
      return { valid: true, reason: 'source file not found' };
    }
    
    delete require.cache[require.resolve(sourceImplPath)];
    const SourceImplClass = require(sourceImplPath);
    const transitions = SourceImplClass.xstateConfig?.on || {};
    
    // Find transition(s) that lead to targetStatus
    // ✅ FIX: Collect all blocking reasons, but return valid if ANY path works
    const allBlockedReasons = [];
    
    for (const [event, config] of Object.entries(transitions)) {
      const configs = Array.isArray(config) ? config : [config];
      
      for (const singleConfig of configs) {
        const target = typeof singleConfig === 'string' ? singleConfig : singleConfig?.target;
        
        if (target === targetStatus) {
          const configObj = typeof singleConfig === 'string' ? { target } : singleConfig;
          
          // Check conditions
          if (configObj.conditions?.blocks?.length > 0) {
            const result = planner._evaluateConditions(configObj.conditions, testData);
            if (!result.met) {
              const blockedBy = [];
              if (result.results) {
                for (const blockResult of result.results) {
                  if (!blockResult.met && blockResult.checks) {
                    blockedBy.push(...blockResult.checks.filter(c => !c.met));
                  }
                }
              }
              // ✅ Don't return yet - save and continue checking other transitions
              allBlockedReasons.push({ 
                event,
                blockedBy,
                from: previousStatus,
                to: targetStatus
              });
              continue; // Check next transition
            }
          } else if (configObj.requires) {
            const result = planner._checkTransitionRequires(configObj.requires, testData);
            if (!result.met) {
              // ✅ Don't return yet - save and continue checking other transitions
              allBlockedReasons.push({ 
                event,
                blockedBy: result.checks.filter(c => !c.met),
                from: previousStatus,
                to: targetStatus
              });
              continue; // Check next transition
            }
          }
          
          // ✅ Found a valid transition - return immediately
          return { valid: true, event, from: previousStatus, to: targetStatus };
        }
      }
    }
    
    // ✅ No valid transition found - return the blocked reasons
    if (allBlockedReasons.length > 0) {
      return { 
        valid: false, 
        blockedBy: allBlockedReasons[0].blockedBy,
        event: allBlockedReasons[0].event,
        from: previousStatus,
        to: targetStatus,
        allBlocked: allBlockedReasons
      };
    }
    
    // No transition found to target - might be ok if using different path
    return { valid: true, reason: 'no direct transition found' };
    
  } catch (error) {
    return { valid: true, reason: `error: ${error.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STATIC: CHECK OR THROW - With inline same-platform execution
// ═══════════════════════════════════════════════════════════════════════════
static async checkOrThrow(ImplicationClass, testData, options = {}) {
  const { page, driver, testDataPath, validateEachStep = false } = options;

  const planner = new TestPlanner({ verbose: true });
  const meta = ImplicationClass.xstateConfig?.meta || ImplicationClass.meta;
  const targetStatus = meta.status;

  // ═══════════════════════════════════════════════════════════
  // DETECT ACTUAL PLATFORM from test file name or page/driver presence
  // ═══════════════════════════════════════════════════════════
  const detectedTestFile = (() => {
    try {
      const stack = new Error().stack;
      const specMatch = stack.match(/([^\s(]+\.spec\.js)/);
      return specMatch ? specMatch[1] : null;
    } catch (e) {
      return null;
    }
  })();

  // Extract platform from test filename (e.g., "...-ClubApp-UNIT.spec.js" → "clubApp")
  const platformFromFilename = (() => {
    if (!detectedTestFile) return null;
    const basename = path.basename(detectedTestFile);
    if (basename.includes('-ClubApp-') || basename.includes('-Club-') || basename.includes('-Manager-')) return 'manager';
    if (basename.includes('-Dancer-')) return 'dancer';
    if (basename.includes('-Web-') || basename.includes('-Playwright-') || basename.includes('-CMS-')) return 'web';
    return null;
  })();

  // Priority: 1) page object means web, 2) driver + filename, 3) driver alone, 4) filename, 5) meta
  const currentPlatform = page ? 'web'
    : driver ? (platformFromFilename || 'mobile')
    : (platformFromFilename || meta.platform || 'web');

  const isMobilePlatform = currentPlatform === 'dancer' || currentPlatform === 'manager' || currentPlatform === 'clubApp' || currentPlatform === 'mobile';

  console.log('🔍 DEBUG: Platform detection:');
  console.log(`   Detected test file: ${detectedTestFile ? path.basename(detectedTestFile) : 'none'}`);
  console.log(`   Platform from filename: ${platformFromFilename || 'none'}`);
  console.log(`   page present: ${!!page}, driver present: ${!!driver}`);
  console.log(`   Current platform: ${currentPlatform} (mobile: ${isMobilePlatform})`);

  // ═══════════════════════════════════════════════════════════
  // PLATFORM PREREQUISITES - ALWAYS check for mobile (app resets between sessions!)
  // ═══════════════════════════════════════════════════════════
  const platformPrereqs = this._getPlatformPrerequisites();
  const prereq = platformPrereqs[currentPlatform];

  // Skip platform prereq if:
  // 1. This is a recursive call (skipPlatformPrereq flag)
  // 2. Already executing as prerequisite (BUT NOT for mobile with driver - app resets!)
  const skipPlatformPrereq = options.skipPlatformPrereq === true ||
    options.isPrerequisite === true ||
    (process.env.IS_PREREQUISITE_EXECUTION === 'true' && !(isMobilePlatform && driver));

  if (prereq && !skipPlatformPrereq && prereq.check && !prereq.check(testData)) {
    console.log(`\n🔐 Platform prerequisite not met: ${currentPlatform} needs ${prereq.name}`);
    console.log(`   Running: ${prereq.setup?.actionName || prereq.actionName}\n`);

    try {
      process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';

      const prereqFile = prereq.setup?.file || prereq.file;
      const prereqActionName = prereq.setup?.actionName || prereq.actionName;

      if (!prereqFile) {
        console.warn(`   ⚠️  Platform prerequisite missing 'file' property`);
        console.warn(`   ⚠️  Skipping platform init\n`);
      } else {
        const testPath = path.join(process.cwd(), prereqFile);

        if (!fs.existsSync(testPath)) {
          console.warn(`   ⚠️  Platform prerequisite file not found: ${prereqFile}`);
          console.warn(`   ⚠️  Skipping platform init - make sure login runs first!\n`);
        } else {
          // ═══════════════════════════════════════════════════════════
          // PREREQUISITE CHAINING: Check if this prereq has its OWN prerequisites
          // e.g., club_selected_manager requires manager_logged_in first
          // ═══════════════════════════════════════════════════════════
          const chainPlanner = new TestPlanner({ verbose: false });
          
          // Load state registry to find implication class for this prereq
          const stateRegistry = chainPlanner.stateRegistry || {};
          const prereqImplClassName = stateRegistry[prereq.name];
          
          if (prereqImplClassName) {
            const prereqImplPath = chainPlanner.findImplicationFile(prereqImplClassName);
            
            if (prereqImplPath) {
              delete require.cache[require.resolve(prereqImplPath)];
              const PrereqImplClass = require(prereqImplPath);
              const prereqMeta = PrereqImplClass.xstateConfig?.meta || PrereqImplClass.meta;
              
              // Check for requires in meta or setup entry
              const prereqRequires = prereqMeta.requires || prereqMeta.setup?.[0]?.requires;
              const prereqPreviousStatus = prereqMeta.setup?.[0]?.previousStatus;
              
              // Get the required status (either from requires.status or previousStatus)
              const requiredStatus = prereqRequires?.status || prereqPreviousStatus;
              
              if (requiredStatus) {
                const currentStatus = testData.status || 'initial';
                
                console.log(`   🔗 Prerequisite chain detected:`);
                console.log(`      ${prereq.name} requires: ${requiredStatus}`);
                console.log(`      Current status: ${currentStatus}`);
                
                if (currentStatus !== requiredStatus) {
                  // Need to satisfy the chain first
                  const requiredImplClassName = stateRegistry[requiredStatus];
                  
                  if (requiredImplClassName) {
                    const requiredImplPath = chainPlanner.findImplicationFile(requiredImplClassName);
                    
                    if (requiredImplPath) {
                      delete require.cache[require.resolve(requiredImplPath)];
                      const RequiredImplClass = require(requiredImplPath);
                      const requiredMeta = RequiredImplClass.xstateConfig?.meta || RequiredImplClass.meta;
                      
                      // Find the right setup entry for this platform
                      const requiredSetup = requiredMeta.setup?.find(s => 
                        s.platform === currentPlatform || !s.platform
                      ) || requiredMeta.setup?.[0];
                      
                      if (requiredSetup?.testFile && requiredSetup?.actionName) {
                        const requiredTestPath = path.join(process.cwd(), requiredSetup.testFile);
                        
                        if (fs.existsSync(requiredTestPath)) {
                          console.log(`\n   ⚡ First executing chain prerequisite: ${requiredSetup.actionName}`);
                          
                          delete require.cache[require.resolve(requiredTestPath)];
                          const requiredModule = require(requiredTestPath);
                          const requiredFn = requiredModule[requiredSetup.actionName];
                          
                          if (requiredFn) {
                            const chainResult = await requiredFn(testDataPath, {
                              page,
                              driver,
                              testDataPath,
                              isPrerequisite: true,
                              skipPlatformPrereq: true
                            });
                            
                            if (chainResult && chainResult.save) {
                              chainResult.save(testDataPath);
                            }
                            
                            if (chainResult && chainResult.data) {
                              Object.assign(testData, chainResult.data);
                            }
                            
                            console.log(`   ✅ Chain prerequisite complete: ${requiredStatus}\n`);
                          } else {
                            console.warn(`   ⚠️  Action ${requiredSetup.actionName} not found in ${requiredSetup.testFile}`);
                          }
                        } else {
                          console.warn(`   ⚠️  Chain prerequisite file not found: ${requiredSetup.testFile}`);
                        }
                      } else {
                        console.warn(`   ⚠️  No setup entry found for ${requiredStatus}`);
                      }
                    }
                  } else {
                    console.log(`   ⚠️  No implication class found for ${requiredStatus} in state registry`);
                  }
                } else {
                  console.log(`   ✅ Chain prerequisite already satisfied: ${requiredStatus}`);
                }
              }
            }
          }
          // ═══════════════════════════════════════════════════════════
          // END CHAINING - Now run the original prerequisite
          // ═══════════════════════════════════════════════════════════

          delete require.cache[require.resolve(testPath)];

          const testModule = require(testPath);
          const actionFn = testModule[prereqActionName];

          if (!actionFn) {
            throw new Error(`Action ${prereqActionName} not found in ${prereqFile}`);
          }

          console.log(`   🎬 Executing ${prereqActionName} with ${driver ? 'driver' : 'page'}...`);
          
          const result = await actionFn(testDataPath, { 
            page, 
            driver, 
            testDataPath,
            isPrerequisite: true,
            skipPlatformPrereq: true
          });

          if (result && result.save) {
            result.save(testDataPath);
          }

          if (result && result.data) {
            Object.assign(testData, result.data);
          }

          console.log(`✅ Platform prerequisite ${prereq.name} complete!\n`);
        }
      }

      delete process.env.SKIP_UNIT_TEST_REGISTRATION;

    } catch (error) {
      delete process.env.SKIP_UNIT_TEST_REGISTRATION;
      console.error(`❌ Platform prerequisite failed: ${error.message}`);
      throw error;
    }
  }


  // ═══════════════════════════════════════════════════════════
  // EARLY RETURN: If preflight completed and we're NOT mobile, skip chain analysis
  // For mobile, we already handled the platform prereq above, now continue normally
  // ═══════════════════════════════════════════════════════════
  if (process.env.PREFLIGHT_COMPLETED === 'true') {
    if (isMobilePlatform && driver) {
      // Mobile: Platform prereq was handled above, now continue with normal analysis
      console.log('📱 Mobile platform: preflight completed, platform prereq handled inline\n');
    } else if (process.env.IS_PREREQUISITE_EXECUTION === 'true') {
      // Web subprocess: skip everything
      console.log('✅ Pre-flight already completed, skipping prerequisite check\n');
      return { ready: true, skipped: true };
    }
  }

  const currentStatus = this._getCurrentStatus(testData, ImplicationClass);

  // Get event from the CURRENT test file being executed
  const viaEvent = detectedTestFile
    ? TestPlanner._extractEventFromFilename(detectedTestFile)
    : (meta.setup?.[0]?.testFile ? TestPlanner._extractEventFromFilename(meta.setup[0].testFile) : null);

  console.log(`🔍 DEBUG: Extracted event: ${viaEvent}`);

  console.log(`\n🔍 TestPlanner: Analyzing ${targetStatus} state`);
  console.log(`   Current: ${currentStatus}`);
  console.log(`   Target: ${targetStatus}`);
  if (viaEvent) {
    console.log(`   Via Event: ${viaEvent}`);
  }

  const analysis = planner.analyze(ImplicationClass, testData, { explicitEvent: viaEvent });

  // Already at target?
  const previousStatus = meta.requires?.previousStatus || meta.setup?.[0]?.previousStatus;

  if (targetStatus && currentStatus === targetStatus) {
    if (previousStatus && previousStatus !== currentStatus) {
      console.log(`🔄 Loop detected: Currently at ${currentStatus}, but test expects to come FROM ${previousStatus}`);
      console.log(`   Need to reach ${previousStatus} first, then transition to ${targetStatus}\n`);
    } else {
      console.log(`✅ Already in target state (${targetStatus}), no action needed\n`);
      return { ready: true, skipped: true, currentStatus, targetStatus };
    }
  }

  // If analysis is ready after platform prereq, we're good
  if (analysis.ready) {
    console.log('✅ Prerequisites satisfied!\n');
    return analysis;
  }



  // ═══════════════════════════════════════════════════════════
// VALIDATE ACTION STEP ARGUMENTS
// ═══════════════════════════════════════════════════════════
const actionDetails = meta.actionDetails || ImplicationClass.xstateConfig?.on?.[viaEvent]?.actionDetails;

if (actionDetails?.steps) {
  const missingArgs = [];
  
  for (const step of actionDetails.steps) {
    const args = Array.isArray(step.args) ? step.args : (step.args || '').split(',').map(s => s.trim());
    
    for (const arg of args) {
      if (arg.startsWith('ctx.data.')) {
        const fieldPath = arg.replace('ctx.data.', '');
        const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], testData);
        
        if (value === undefined) {
          missingArgs.push(fieldPath);
        }
      }
    }
  }
  
  if (missingArgs.length > 0) {
    console.error('\n' + '═'.repeat(60));
    console.error('❌ MISSING REQUIRED TEST DATA FIELDS');
    console.error('═'.repeat(60));
    console.error(`\nThe action steps require these fields in testData:\n`);
    missingArgs.forEach(field => {
      console.error(`   ❌ ${field}`);
    });
    console.error(`\n💡 Add these fields to your shared.json file.\n`);
    console.error('═'.repeat(60) + '\n');
    throw new Error(`Missing required testData fields: ${missingArgs.join(', ')}`);
  }
}

  // ═══════════════════════════════════════════════════════════════════════
  // INLINE SAME-PLATFORM EXECUTION (when page/driver available)
  // ═══════════════════════════════════════════════════════════════════════
  if (!analysis.ready && analysis.chain.length > 0 && (page || driver)) {
    const segments = planner._groupChainByPlatform(analysis.chain, testData, ImplicationClass);

    console.log(`\n📊 Prerequisite Chain (${segments.length} segment${segments.length > 1 ? 's' : ''}):\n`);

    segments.forEach((segment, index) => {
      const status = segment.complete ? '✅' : '❌';
      const label = segment.steps.length === 1 && segment.steps[0].isTarget
        ? 'CURRENT TEST'
        : segment.complete ? 'COMPLETE' : 'NOT COMPLETE';

      console.log(`Segment ${index + 1} (${segment.platform}): ${status} ${label}`);

      segment.steps.forEach(step => {
        const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
        console.log(`  ${icon} ${step.status}`);
      });
      console.log('');
    });

    const incompleteSegment = segments.find(s => !s.complete);

    if (incompleteSegment) {
      // ✅ FIX: Use currentPlatform (detected from filename/driver), NOT meta.platform
      const isSamePlatform = this._isSamePlatform(incompleteSegment.platform, currentPlatform);

      console.log(`🔍 DEBUG: Platform comparison:`);
      console.log(`   Incomplete segment platform: ${incompleteSegment.platform}`);
      console.log(`   Current test platform: ${currentPlatform}`);
      console.log(`   Same platform? ${isSamePlatform}`);

      if (isSamePlatform) {
        // ═══════════════════════════════════════════════════════════
        // SAME PLATFORM - Execute inline with SAME page/driver!
        // ═══════════════════════════════════════════════════════════
        console.log(`⚡ Auto-executing ${incompleteSegment.platform} segment inline...\n`);

        console.log('🔍 DEBUG: incompleteSegment.steps:', JSON.stringify(
          incompleteSegment.steps.map(s => ({
            status: s.status,
            complete: s.complete,
            isTarget: s.isTarget,
            isLoopPrerequisite: s.isLoopPrerequisite,
            actionName: s.actionName
          })), null, 2
        ));

        let executedAnySteps = false;

        for (let i = 0; i < incompleteSegment.steps.length; i++) {
          const step = incompleteSegment.steps[i];

          if (step.isTarget) continue;
          if (step.complete) continue;
          if (step.isLoopPrerequisite) continue;

          // Handle blocked steps
          if (step.blocked) {
            console.error(`\n🚫 Path is BLOCKED at ${step.status}`);
            console.error(`   ${step.blockedReason}`);
            if (step.blockedTransitions) {
              step.blockedTransitions.forEach(t => {
                t.blockedBy.forEach(b => {
                  console.error(`   ❌ ${b.field}: need ${JSON.stringify(b.expected)}, have ${JSON.stringify(b.actual)}`);
                });
              });
            }
            throw new Error(`Cannot reach ${targetStatus} - path blocked at ${step.status}`);
          }

          let testFilePath = step.testFile;
          let actionName = step.actionName;

          if (!testFilePath || testFilePath === 'unknown') {
            const fullStep = analysis.chain.find(s => s.status === step.status);
            if (fullStep) {
              testFilePath = fullStep.testFile;
              actionName = fullStep.actionName;
            }
          }

          if (!testFilePath || testFilePath === 'unknown') {
            console.error(`   ⚠️  Cannot execute ${step.status} - test file not found\n`);
            continue;
          }

          executedAnySteps = true;
          console.log(`⚡ Auto-executing prerequisite: ${actionName}\n`);

          try {
            process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';

            const fullTestPath = path.join(process.cwd(), testFilePath);
            delete require.cache[require.resolve(fullTestPath)];
            const testModule = require(fullTestPath);

            delete process.env.SKIP_UNIT_TEST_REGISTRATION;

            // Find the action function
            let triggerFn = testModule[actionName];

            if (!triggerFn) {
              const camelCaseActionName = actionName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
              triggerFn = testModule[camelCaseActionName];

              if (!triggerFn) {
                throw new Error(`Function ${actionName} not exported from ${testFilePath}`);
              }
            }

            // Get current data path (might have delta from previous step)
            const TestContext = require('./TestContext');
            const originalPath = options.testDataPath || testData.__testDataPath || 'tests/data/shared.json';
            const deltaPath = TestContext.getDeltaPath(originalPath);
            const pathToUse = fs.existsSync(deltaPath) ? deltaPath : originalPath;

            // Check transition conditions before executing
            const transitionCheck = this._canTakeTransitionTo(step.status, currentStatus, testData);
            if (!transitionCheck.valid) {
              console.error(`\n❌ Cannot execute ${step.status} - transition conditions not met!`);
              console.error(`   Transition: ${transitionCheck.from} --(${transitionCheck.event})--> ${transitionCheck.to}`);
              if (transitionCheck.blockedBy) {
                transitionCheck.blockedBy.forEach(b => {
                  console.error(`   ❌ ${b.field}: expected ${JSON.stringify(b.expected)}, got ${JSON.stringify(b.actual)}`);
                });
              }
              console.error(`\n💡 Your testData doesn't support this path. Check your test data or use a different test.\n`);
              throw new Error(`Transition to ${step.status} blocked by conditions`);
            }

            // Execute with SAME PAGE/DRIVER - this is the key!
            const result = await triggerFn(pathToUse, {
              page: page,
              driver: driver,
              testDataPath: pathToUse,
              isPrerequisite: true,
              skipPlatformPrereq: true  // Already handled platform prereq above
            });

            if (result && result.save) {
              result.save(pathToUse);
            }

            // Reload data to get updated status
            const finalDeltaPath = TestContext.getDeltaPath(originalPath);
            const reloadedCtx = TestContext.load(ImplicationClass, finalDeltaPath);
            Object.assign(testData, reloadedCtx.data);

            console.log(`   ✅ Completed: ${step.status}\n`);

            // Optional: Validate assertions at each step
            const shouldValidateEachStep = process.env.VALIDATE_EACH_STEP === 'true';

            if (shouldValidateEachStep && page) {
              try {
                const stepImplClassName = planner.stateRegistry[step.status];
                if (stepImplClassName) {
                  const stepImplPath = planner.findImplicationFile(stepImplClassName);
                  if (stepImplPath) {
                    planner._clearImplicationCache(stepImplPath);
                    const StepImplClass = require(stepImplPath);

                    const mirrorsOn = StepImplClass.mirrorsOn;
                    if (mirrorsOn?.UI?.web) {
                      console.log(`   🔍 Validating ${step.status} UI...`);

                      const ExpectImplication = require('./ExpectImplication');
                      const currentData = TestContext.load(StepImplClass, testDataPath).data;

                      for (const [screenKey, screenConfig] of Object.entries(mirrorsOn.UI.web)) {
                        const pomPathRaw = screenConfig.pom || screenConfig._pomSource?.path;
                        if (pomPathRaw) {
                          try {
                            const pomPath = path.isAbsolute(pomPathRaw)
                              ? pomPathRaw
                              : path.join(process.cwd(), pomPathRaw);

                            const PomClass = require(pomPath);
                            const pomInstance = new PomClass(page, currentData.lang || 'en', currentData.device || 'desktop');

                            await ExpectImplication.validateImplications(
                              screenConfig,
                              currentData,
                              pomInstance
                            );
                            console.log(`   ✅ ${step.status}.${screenKey} validation passed`);
                          } catch (pomError) {
                            console.log(`   ⚠️  Could not load POM for ${screenKey}: ${pomError.message}`);
                          }
                        } else {
                          console.log(`   ⏭️  ${screenKey} has no POM defined, skipping validation`);
                        }
                      }
                    } else {
                      console.log(`   ⏭️  No UI.web validation defined for ${step.status}`);
                    }
                  }
                }
              } catch (validationError) {
                console.error(`   ❌ Validation failed at ${step.status}: ${validationError.message}`);
                throw validationError;
              }
            }

          } catch (error) {
            console.error(`❌ Failed to execute ${actionName}: ${error.message}\n`);
            delete process.env.SKIP_UNIT_TEST_REGISTRATION;
            throw error;
          }
        }

        if (executedAnySteps) {
          const TestContext = require('./TestContext');
          const originalPath = options.testDataPath || testData.__testDataPath || 'tests/data/shared.json';
          const finalDeltaPath = TestContext.getDeltaPath(originalPath);
          const reloadedCtx = TestContext.load(ImplicationClass, finalDeltaPath);
          const newStatus = this._getCurrentStatus(reloadedCtx.data, ImplicationClass);
          
          // Update testData with new values
          Object.assign(testData, reloadedCtx.data);

          const targetStep = incompleteSegment.steps.find(s => s.isTarget);

          const targetPreviousStatus = targetStep?.previousStatus ||
            TestPlanner._getPreviousStatus(
              ImplicationClass.xstateConfig?.meta || ImplicationClass.meta, 
              { explicitEvent: viaEvent, testData: reloadedCtx.data }
            );

          // Check if we've reached the state right before target
          if (newStatus === targetPreviousStatus) {
            console.log(`✅ Reached required state: ${newStatus} (ready for ${targetStatus})\n`);
            return { ready: true, chain: analysis.chain, currentStatus: newStatus, targetStatus };
          }

          // ═══════════════════════════════════════════════════════════
          // ✅ FIX: Re-analyze and check for remaining cross-platform segments!
          // ═══════════════════════════════════════════════════════════
          const newAnalysis = planner.analyze(ImplicationClass, reloadedCtx.data, { explicitEvent: viaEvent });
          const newSegments = planner._groupChainByPlatform(newAnalysis.chain, reloadedCtx.data, ImplicationClass);
          
          // Find next incomplete segment (excluding target-only segments)
          const nextIncomplete = newSegments.find(s => 
            !s.complete && !s.steps.every(step => step.isTarget || step.complete)
          );
          
          console.log(`\n🔍 DEBUG: After segment completion:`);
          console.log(`   New status: ${newStatus}`);
          console.log(`   Target previous status: ${targetPreviousStatus}`);
          console.log(`   Next incomplete segment: ${nextIncomplete ? nextIncomplete.platform : 'none'}`);
          
          if (nextIncomplete) {
            const isNextSamePlatform = this._isSamePlatform(nextIncomplete.platform, currentPlatform);
            console.log(`   Next segment platform: ${nextIncomplete.platform}, same as current (${currentPlatform})? ${isNextSamePlatform}`);
            
            if (!isNextSamePlatform) {
                   // ═══════════════════════════════════════════════════════════
            // CROSS-PLATFORM SEGMENT DETECTED - Execute it!
            // ═══════════════════════════════════════════════════════════
            console.log(`\n🌐 Cross-platform prerequisite detected!`);
            console.log(`   Completed: ${incompleteSegment.platform} segment`);
            console.log(`   Next needs: ${nextIncomplete.platform}`);
            console.log(`   Current test: ${currentPlatform}\n`);
            
            const stepsToExecute = nextIncomplete.steps.filter(s => !s.complete && !s.isTarget);
            
            if (stepsToExecute.length > 0) {
              console.log(`⚡ Auto-executing ${nextIncomplete.platform} prerequisites (${stepsToExecute.length} steps)...\n`);
              
              stepsToExecute.forEach((step, idx) => {
                console.log(`   ${idx + 1}. ${step.status} - ${step.actionName}`);
              });
              console.log('');
              
              try {
                if (nextIncomplete.platform === 'web' || nextIncomplete.platform === 'playwright') {
                  // Web: batch execution in single browser
                  await this.executeWebSegmentInline(stepsToExecute, testDataPath || 'tests/data/shared.json');
                } else {
                  // Mobile (dancer/manager/clubApp): subprocess per test
                  for (const step of stepsToExecute) {
                    console.log(`   ⚡ Running ${step.actionName}...`);
                    this.executeTestInSubprocess(step.testFile, nextIncomplete.platform);
                  }
                }
                
                console.log(`✅ ${nextIncomplete.platform} prerequisites complete!\n`);
                
                // Wait for file sync
                await new Promise(resolve => setTimeout(resolve, 500));
                this._clearDataCaches();
                
                // Reload data after cross-platform execution
                const afterCrossPlatDelta = TestContext.getDeltaPath(originalPath);
                const afterCrossPlatPath = fs.existsSync(afterCrossPlatDelta) ? afterCrossPlatDelta : originalPath;
                const afterCrossPlatCtx = TestContext.load(ImplicationClass, afterCrossPlatPath);
                
                console.log(`   📂 After cross-platform: status=${afterCrossPlatCtx.data.status}, booking.status=${afterCrossPlatCtx.data.booking?.status || 'N/A'}\n`);
                
                // Update testData
                Object.assign(testData, afterCrossPlatCtx.data);
                
                // ═══════════════════════════════════════════════════════════
                // CRITICAL: After cross-platform MOBILE execution, the current 
                // driver session is DEAD (Android kills previous app instrumentation
                // when launching a new app). We cannot continue inline!
                // ═══════════════════════════════════════════════════════════
                const finalAnalysis = planner.analyze(ImplicationClass, afterCrossPlatCtx.data, { explicitEvent: viaEvent });
                
                // Check if we're on mobile and came FROM a different mobile platform
                const crossPlatformWasMobile = nextIncomplete.platform === 'dancer' || 
                                                nextIncomplete.platform === 'manager' || 
                                                nextIncomplete.platform === 'clubApp';
                const currentIsMobile = isMobilePlatform && driver;
                
                if (currentIsMobile && crossPlatformWasMobile) {
                  // Mobile-to-mobile cross-platform: session is definitely dead
                  console.log(`\n⚠️  Mobile cross-platform execution completed.`);
                  console.log(`   The ${nextIncomplete.platform} subprocess killed the ${currentPlatform} app session.`);
                  
                  if (finalAnalysis.ready) {
                    console.log(`\n✅ All prerequisites ARE satisfied!`);
                    console.log(`   booking.status = ${afterCrossPlatCtx.data.booking?.status}`);
                    console.log(`\n🔄 Session is stale - running final test as subprocess...\n`);
                    
                    // Find the target test file from the original test
                    const targetSetup = meta.setup?.find(s => s.platform === currentPlatform) || meta.setup?.[0];
                    
                    if (targetSetup?.testFile) {
                      // Run the FINAL test as subprocess too since our session is dead
                      console.log(`   ⚡ Spawning ${currentPlatform} test: ${targetSetup.actionName}`);
                      this.executeTestInSubprocess(targetSetup.testFile, currentPlatform);
                      
                      // Wait for completion
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      // Reload final state
                      const finalDelta = TestContext.getDeltaPath(originalPath);
                      const finalPath = fs.existsSync(finalDelta) ? finalDelta : originalPath;
                      const finalCtx = TestContext.load(ImplicationClass, finalPath);
                      
                      Object.assign(testData, finalCtx.data);
                      
                      console.log(`\n✅ Cross-platform test chain COMPLETE!`);
                      console.log(`   Final status: ${finalCtx.data.booking?.status || finalCtx.data.status}\n`);
                      
                      // Return success - test already executed in subprocess
                      return { 
                        ready: true, 
                        skipped: true,  // Signal that test already ran
                        executedInSubprocess: true,
                        chain: finalAnalysis.chain, 
                        currentStatus: this._getCurrentStatus(finalCtx.data, ImplicationClass), 
                        targetStatus 
                      };
                    } else {
                      // No test file found - throw helpful error
                      throw new Error(
                        `Cross-platform prerequisites complete but cannot find test file for ${currentPlatform}. ` +
                        `Please re-run the test manually - it will execute immediately.`
                      );
                    }
                  } else {
                    // Prerequisites not satisfied after cross-platform
                    console.log(`\n❌ Prerequisites still not satisfied after cross-platform execution.`);
                    console.log(`   This may indicate a state machine configuration issue.\n`);
                    
                    throw new Error(
                      `Cross-platform execution completed but prerequisites not satisfied. ` +
                      `Current: ${this._getCurrentStatus(afterCrossPlatCtx.data, ImplicationClass)}, ` +
                      `Target needs: ${targetStatus}`
                    );
                  }
                }
                
                // Web platform or web-to-mobile: session may survive, try continuing
                if (finalAnalysis.ready) {
                  console.log(`✅ All prerequisites complete after cross-platform execution!\n`);
                  return { 
                    ready: true, 
                    chain: finalAnalysis.chain, 
                    currentStatus: this._getCurrentStatus(afterCrossPlatCtx.data, ImplicationClass), 
                    targetStatus 
                  };
                }
                
                // Not ready - need more steps
                console.log(`\n⚠️ Additional prerequisites needed after cross-platform execution.`);
                console.log(`   Attempting to continue...\n`);
                
                return this.checkOrThrow(ImplicationClass, afterCrossPlatCtx.data, {
                  ...options,
                  testDataPath: afterCrossPlatPath,
                  skipPlatformPrereq: false
                });
                
              } catch (error) {
                console.error(`\n❌ Cross-platform prerequisite failed: ${error.message}\n`);
                planner.printCrossPlatformMessage(newAnalysis.chain, currentPlatform);
                throw new Error(`Prerequisites not met (cross-platform ${nextIncomplete.platform} execution failed)`);
              }
            }
          } else {
            // ═══════════════════════════════════════════════════════════
            // SAME PLATFORM - Continue with recursive call
            // ═══════════════════════════════════════════════════════════
            console.log(`\n⚡ More ${currentPlatform} prerequisites needed, continuing...\n`);
            
            return this.checkOrThrow(ImplicationClass, reloadedCtx.data, {
              ...options,
              testDataPath: finalDeltaPath,
              skipPlatformPrereq: true
            });
          }
        }

        // No more incomplete segments (except maybe target)
        const remainingSteps = incompleteSegment.steps.filter(s =>
          !s.isTarget && !s.complete && s.status !== newStatus
        );

        if (remainingSteps.length === 0) {
          // Check if we're truly ready
          const finalCheck = planner.analyze(ImplicationClass, reloadedCtx.data, { explicitEvent: viaEvent });
          
          if (finalCheck.ready) {
            console.log(`✅ All prerequisites complete!\n`);
            return { ready: true, chain: finalCheck.chain, currentStatus: newStatus, targetStatus };
          }
          
          // Not ready but no remaining steps in this segment - might need cross-platform
          console.log(`   ⚠️ Segment complete but not ready. Checking other segments...`);
        }

        console.log(`   Remaining steps: ${remainingSteps.map(s => s.status).join(' → ')}\n`);
        console.log(`   Current status: ${newStatus}\n`);

        // Default: return current state
        return { ready: true, chain: analysis.chain, currentStatus: newStatus, targetStatus };
      }
    } else {

        // ═══════════════════════════════════════════════════════════
        // DIFFERENT PLATFORM - Cannot execute inline, spawn subprocess
        // ═══════════════════════════════════════════════════════════
        console.log(`\n🌐 Cross-platform prerequisite detected!`);
        console.log(`   Current test: ${currentPlatform}`);
        console.log(`   Prerequisites need: ${incompleteSegment.platform}\n`);

        const isPrerequisiteExecution = options?.isPrerequisite === true ||
          process.env.IS_PREREQUISITE_EXECUTION === 'true';

        if (isPrerequisiteExecution) {
          console.log(`\n✅ Platform ${currentPlatform} prerequisites complete\n`);
          console.log(`   (Remaining ${incompleteSegment.platform} prerequisites will be handled by parent test)\n`);
          return analysis;
        }

        // Get steps that need to be executed on the other platform
        const stepsToExecute = incompleteSegment.steps.filter(s => !s.complete && !s.isTarget);

        if (stepsToExecute.length > 0) {
          console.log(`⚡ Auto-executing ${incompleteSegment.platform} prerequisites via subprocess...\n`);

          try {
            if (incompleteSegment.platform === 'web' || incompleteSegment.platform === 'playwright') {
              // Web prerequisites - use batch execution
              await this.executeWebSegmentInline(stepsToExecute, testDataPath || 'tests/data/shared.json');
            } else {
              // Mobile prerequisites - execute one by one
              for (const step of stepsToExecute) {
                this.executeTestInSubprocess(step.testFile, incompleteSegment.platform);
              }
            }

            console.log(`✅ ${incompleteSegment.platform} prerequisites complete!\n`);

            // Reload data and re-check
            await new Promise(resolve => setTimeout(resolve, 500));
            this._clearDataCaches();

            const TestContext = require('./TestContext');
            const deltaPath = TestContext.getDeltaPath(testDataPath || 'tests/data/shared.json');
            const actualPath = fs.existsSync(deltaPath) ? deltaPath : (testDataPath || 'tests/data/shared.json');
            const rawData = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
            const mergedData = this._mergeChangeLog(rawData);

            Object.assign(testData, mergedData);

            const newAnalysis = planner.analyze(ImplicationClass, mergedData);

            if (newAnalysis.ready) {
              console.log('✅ All prerequisites satisfied!\n');
              return newAnalysis;
            }

            // Check if remaining prerequisites are now same-platform
            const newSegments = planner._groupChainByPlatform(newAnalysis.chain, mergedData, ImplicationClass);
            const newIncomplete = newSegments.find(s => !s.complete);

            if (newIncomplete && this._isSamePlatform(newIncomplete.platform, currentPlatform)) {
              console.log(`✅ Remaining prerequisites are now ${currentPlatform}, continuing...\n`);
              return newAnalysis;
            }

          } catch (error) {
            console.error(`\n❌ Cross-platform prerequisite failed: ${error.message}\n`);
            planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
            throw new Error('Prerequisites not met (cross-platform execution failed)');
          }
        }

        planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
        throw new Error('Prerequisites not met (cross-platform)');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FALLBACK: Single step auto-execution (legacy path)
  // ═══════════════════════════════════════════════════════════════════════
  if (!analysis.ready && analysis.nextStep && (page || driver)) {
    const { testFile: stepTestFile, actionName } = analysis.nextStep;

    console.log(`\n⚡ Auto-executing prerequisite: ${actionName}\n`);

    try {
      process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';

      const testPath = path.join(process.cwd(), stepTestFile);
      delete require.cache[require.resolve(testPath)];
      const testModule = require(testPath);

      delete process.env.SKIP_UNIT_TEST_REGISTRATION;

      let triggerFn = testModule[actionName];

      if (!triggerFn) {
        const camelCaseActionName = actionName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        triggerFn = testModule[camelCaseActionName];

        if (!triggerFn) {
          throw new Error(`Function ${actionName} (or ${camelCaseActionName}) not exported from ${stepTestFile}`);
        }
      }

      const TestContext = require('./TestContext');
      const originalPath = options.testDataPath
        || testData.__testDataPath
        || process.env.TEST_DATA_PATH
        || 'tests/data/shared.json';

      const deltaPath = TestContext.getDeltaPath(originalPath);
      const pathToUse = fs.existsSync(deltaPath) ? deltaPath : originalPath;

      const result = await triggerFn(pathToUse, {
        page: page,
        driver: driver,
        testDataPath: pathToUse,
        isPrerequisite: true,
        skipPlatformPrereq: true
      });

      if (result && result.save) {
        result.save(pathToUse);
      }

      const finalDeltaPath = TestContext.getDeltaPath(originalPath);
      const reloadedCtx = TestContext.load(ImplicationClass, finalDeltaPath);
      Object.assign(testData, reloadedCtx.data);

      const newCurrentStatus = this._getCurrentStatus(reloadedCtx.data, ImplicationClass);

      if (newCurrentStatus === analysis.nextStep.status) {
        console.log(`✅ Completed prerequisite: ${analysis.nextStep.status}\n`);
      }

      const newAnalysis = planner.analyze(ImplicationClass, reloadedCtx.data);

      if (!newAnalysis.ready && newAnalysis.nextStep) {
        console.log(`   ⭐ Moving to next prerequisite: ${newAnalysis.nextStep.actionName}\n`);
        return TestPlanner.checkOrThrow(ImplicationClass, reloadedCtx.data, {
          ...options,
          testDataPath: finalDeltaPath,
          skipPlatformPrereq: true
        });
      }

      if (!newAnalysis.ready) {
        planner.printNotReadyError(newAnalysis);
        throw new Error('Prerequisite chain stuck');
      }

      console.log('✅ Prerequisites satisfied!\n');
      return newAnalysis;

    } catch (error) {
      console.error(`❌ Failed to auto-execute prerequisite: ${error.message}\n`);
      delete process.env.SKIP_UNIT_TEST_REGISTRATION;
      planner.printNotReadyError(analysis);
      throw error;
    }
  }

  // No page/driver but have nextStep - shouldn't happen in normal flow
  if (!analysis.ready && analysis.nextStep && !page && !driver) {
    planner.printNotReadyError(analysis);
    throw new Error('Prerequisites not met - run with preflight enabled');
  }

  if (!analysis.ready) {
    planner.printNotReadyError(analysis);
    throw new Error('Prerequisites not met');
  }

  return analysis;
}

static async executeWebSegmentInline(stepsToExecute, testDataPath) {
  const { spawnSync } = require('child_process');
  
  console.log(`\n🌐 Running ${stepsToExecute.length} web prerequisites in single browser...\n`);
  
  const firstStepDir = path.dirname(path.join(process.cwd(), stepsToExecute[0].testFile));
  const tempFile = path.join(firstStepDir, 'BatchPrereqs-BATCH-Web-UNIT.spec.js');
  
  console.log(`   📝 Creating batch file: ${tempFile}`);
  
  const stepCalls = stepsToExecute.map((step, i) => {
    const fullPath = path.join(process.cwd(), step.testFile).replace(/\\/g, '/');
    const fnName = step.actionName;
    const camelName = fnName.replace(/_([a-z])/g, g => g[1].toUpperCase());
    
    return `
    // Step ${i + 1}: ${step.status}
    {
      console.log('\\n⚡ Step ${i + 1}: ${fnName} (${step.status})');
      const mod = require('${fullPath}');
      const fn = mod['${fnName}'] || mod['${camelName}'];
      if (!fn) throw new Error('Function ${fnName} not found');
      
      const TestContext = require('${path.join(process.cwd(), 'tests/ai-testing/utils/TestContext').replace(/\\/g, '/')}');
      const fs = require('fs');
      const deltaPath = TestContext.getDeltaPath('${testDataPath}');
      const pathToUse = fs.existsSync(deltaPath) ? deltaPath : '${testDataPath}';
      
      const result = await fn(pathToUse, { page, testDataPath: pathToUse, isPrerequisite: true });
      if (result && result.save) result.save(pathToUse);
      console.log('   ✅ Done: ${step.status}');
    }`;
  }).join('\n');
  
  const specContent = `// Auto-generated batch runner - DELETE IF FOUND
process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
process.env.IS_PREREQUISITE_EXECUTION = 'true';

const { test } = require('@playwright/test');

test('Batch: Execute ${stepsToExecute.length} web prerequisites', async ({ page }) => {
  ${stepCalls}
});
`;
  
  fs.writeFileSync(tempFile, specContent);
  console.log(`   ✅ Batch file created (${specContent.length} bytes)`);
  
  if (!fs.existsSync(tempFile)) {
    throw new Error('Batch file was not created!');
  }
  console.log(`   ✅ File verified on disk`);
  
  try {
    // Build args dynamically based on config availability
    const playwrightConfig = this._getPlaywrightConfigPath();
    const args = ['playwright', 'test', `"${tempFile}"`];
    
    if (playwrightConfig) {
      args.push('--config', playwrightConfig);
      console.log(`   📄 Using config: ${playwrightConfig}`);
    } else {
      console.log(`   📄 Using Playwright default config detection`);
    }
    
    console.log(`   🎬 Running: npx ${args.join(' ')}\n`);
    
    const result = spawnSync('npx', args, {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
      env: {
        ...process.env,
        PREFLIGHT_COMPLETED: 'true',
        IS_PREREQUISITE_EXECUTION: 'true',
        SKIP_UNIT_TEST_REGISTRATION: 'true'
      }
    });
    
    if (result.status !== 0) {
      throw new Error(`Batch prerequisites failed with code ${result.status}`);
    }
    
    console.log(`\n✅ All ${stepsToExecute.length} web prerequisites complete!\n`);
    
  } finally {
    try { 
      fs.unlinkSync(tempFile); 
      console.log('   🧹 Cleaned up batch file');
    } catch (e) {}
  }
}
  // Helper for platform comparison
  static _isSamePlatform(platform1, platform2) {
    const normalize = (p) => {
      if (!p) return 'unknown';
      p = p.toLowerCase();
      if (p === 'playwright' || p === 'web' || p === 'cms') return 'web';
      if (p === 'dancer') return 'dancer';
      if (p === 'clubapp' || p === 'club') return 'clubApp';
      return p;
    };
    
    return normalize(platform1) === normalize(platform2);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC: PRE-FLIGHT CHECK
  // ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// STATIC: PRE-FLIGHT CHECK
// ═══════════════════════════════════════════════════════════════════════════
static async preFlightCheck(ImplicationClass, testDataPath, testFile = null) {
  try {
    const TestContext = require('./TestContext');
    const ctx = TestContext.load(ImplicationClass, testDataPath);
    
    const planner = new TestPlanner({ verbose: true });
    const meta = ImplicationClass.xstateConfig?.meta || {};
    const targetStatus = meta.status;
    const currentTestFile = testFile || meta.setup?.[0]?.testFile;
    
    // ═══════════════════════════════════════════════════════════
    // DETECT ACTUAL PLATFORM from test file name (not implication meta!)
    // ═══════════════════════════════════════════════════════════
    const platformFromFilename = (() => {
      if (!currentTestFile) return null;
      const basename = path.basename(currentTestFile);
      if (basename.includes('-ClubApp-') || basename.includes('-Club-') || basename.includes('-Manager-')) return 'manager';
      if (basename.includes('-Dancer-')) return 'dancer';
      if (basename.includes('-Web-') || basename.includes('-Playwright-') || basename.includes('-CMS-')) return 'web';
      return null;
    })();
    
    // Priority: filename detection, then meta.platform, then default
    const currentPlatform = platformFromFilename || meta.platform || 'web';
    
    console.log(`🔍 Pre-flight platform detection:`);
    console.log(`   Test file: ${currentTestFile ? path.basename(currentTestFile) : 'unknown'}`);
    console.log(`   Platform from filename: ${platformFromFilename || 'none'}`);
    console.log(`   Current platform: ${currentPlatform}`);
    
    // ═══════════════════════════════════════════════════════════
    // CHECK REQUIRES MISMATCH - Interactive!
    // ═══════════════════════════════════════════════════════════
    const requiresCheck = this._checkCurrentTestRequires(ImplicationClass, ctx.data, { currentTestFile });
    
    if (requiresCheck.hasMismatch) {
      console.log('\n\x1b[33m' + '='.repeat(65) + '\x1b[0m');
      console.log('\x1b[33m⚠️  TEST DATA MISMATCH DETECTED\x1b[0m');
      console.log('\x1b[33m' + '='.repeat(65) + '\x1b[0m');
      
      if (currentTestFile) {
        console.log('\x1b[36m📄 Test: ' + path.basename(currentTestFile) + '\x1b[0m');
      }
      
      console.log('\n\x1b[36m📊 This test requires:\x1b[0m');
      for (const m of requiresCheck.mismatches) {
        let sourceInfo = '';
        if (m.source === 'transition' && m.fromState && m.event) {
          sourceInfo = ' \x1b[2m(from ' + m.fromState + ' -> ' + m.event + ')\x1b[0m';
        } else if (m.source === 'setup') {
          sourceInfo = ' \x1b[2m(setup requirement)\x1b[0m';
        }
        console.log('     \x1b[32m' + m.field + ' = ' + JSON.stringify(m.required) + '\x1b[0m' + sourceInfo);
      }
      
      console.log('\n\x1b[36m📊 Your testData has:\x1b[0m');
      for (const m of requiresCheck.mismatches) {
        console.log('     \x1b[31m' + m.field + ' = ' + JSON.stringify(m.actual) + ' <- MISMATCH\x1b[0m');
      }
      
      console.log('\x1b[33m' + '='.repeat(65) + '\x1b[0m');
      console.log('\n\x1b[36m💡 Options:\x1b[0m');
      console.log('   \x1b[32m[Press Key]\x1b[0m Change testData to match requires');
      console.log('   \x1b[33m[Wait]\x1b[0m Continue with current testData (may fail)');
      console.log('');
      
      const shouldChange = await this._requiresMismatchCountdown(10);
      
      if (shouldChange) {
        console.log('\n\x1b[32m🔧 Updating testData to match requires:\x1b[0m\n');
        
        for (const m of requiresCheck.mismatches) {
          if (m.field.includes('.')) {
            const parts = m.field.split('.');
            let obj = ctx.data;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!obj[parts[i]]) obj[parts[i]] = {};
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = m.required;
          } else {
            ctx.data[m.field] = m.required;
          }
          console.log('   \x1b[32m✅ ' + m.field + ':\x1b[0m ' + JSON.stringify(m.actual) + ' -> \x1b[32m' + JSON.stringify(m.required) + '\x1b[0m');
        }
        
        // Save directly to shared.json
        const originalPath = path.resolve(process.cwd(), testDataPath);
        const originalData = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
        
        for (const m of requiresCheck.mismatches) {
          if (m.field.includes('.')) {
            const parts = m.field.split('.');
            let obj = originalData;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!obj[parts[i]]) obj[parts[i]] = {};
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = m.required;
          } else {
            originalData[m.field] = m.required;
          }
        }
        
        fs.writeFileSync(originalPath, JSON.stringify(originalData, null, 2));
        console.log('\n\x1b[32m💾 Updated shared.json directly!\x1b[0m\n');
      } else {
        console.log('\n\x1b[33m▶️  Continuing with original testData...\x1b[0m\n');
      }
    }
    
    const currentStatus = this._getCurrentStatus(ctx.data, ImplicationClass);
    
    // Already at target?
    if (currentStatus === targetStatus) {
      console.log(`✅ Already in target state (${targetStatus}), test will skip\n`);
      return true;
    }
    
    // Analyze prerequisites
    const analysis = planner.analyze(ImplicationClass, ctx.data);
    
    if (analysis.ready) {
      console.log('✅ Pre-flight check passed!\n');
      return true;
    }
    
    const segments = planner._groupChainByPlatform(analysis.chain, ctx.data, ImplicationClass);
    
    console.log(`\n📊 Prerequisite Chain (${segments.length} segment${segments.length > 1 ? 's' : ''}):\n`);
    
    segments.forEach((segment, index) => {
      const status = segment.complete ? '✅' : '❌';
      const label = segment.steps.length === 1 && segment.steps[0].isTarget 
        ? 'CURRENT TEST' 
        : segment.complete ? 'COMPLETE' : 'NOT COMPLETE';
      
      console.log(`Segment ${index + 1} (${segment.platform}): ${status} ${label}`);
      
      segment.steps.forEach(step => {
        const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
        console.log(`  ${icon} ${step.status}`);
      });
      console.log('');
    });
    
    // ═══════════════════════════════════════════════════════════
    // EXECUTE ALL CROSS-PLATFORM SEGMENTS IN ORDER
    // ═══════════════════════════════════════════════════════════
    let currentData = ctx.data;
    let segmentsExecuted = 0;
    const maxSegments = 10; // Safety limit
    const config = this._loadConfig();
    
    while (segmentsExecuted < maxSegments) {
      // Re-analyze with current data
      const currentAnalysis = segmentsExecuted === 0 
        ? analysis 
        : planner.analyze(ImplicationClass, currentData);
      
      if (currentAnalysis.ready) {
        console.log('✅ All prerequisites satisfied!\n');
        return true;
      }
      
      const currentSegments = segmentsExecuted === 0
        ? segments
        : planner._groupChainByPlatform(currentAnalysis.chain, currentData, ImplicationClass);
      
      // Find next incomplete segment that's NOT the target
      const incompleteSegment = currentSegments.find(s => 
        !s.complete && !s.steps.every(step => step.isTarget)
      );
      
      if (!incompleteSegment) {
        // No incomplete segments except target - we're ready!
        console.log('✅ Pre-flight check passed!\n');
        return true;
      }
      
      const isDifferentPlatform = !this._isSamePlatform(incompleteSegment.platform, currentPlatform);
      
      if (!isDifferentPlatform) {
        // Same platform - will auto-execute during test
        if (currentAnalysis.nextStep) {
          console.log(`\n⚠️  Prerequisites missing - will auto-execute during test\n`);
          console.log(`   Next step: ${currentAnalysis.nextStep.actionName} (${currentAnalysis.nextStep.status})`);
        }
        console.log('✅ Pre-flight check passed (auto-execution enabled)\n');
        return true;
      }
      
      // ═══════════════════════════════════════════════════════════
      // CROSS-PLATFORM SEGMENT - Execute it!
      // ═══════════════════════════════════════════════════════════
      if (segmentsExecuted === 0) {
        console.log('⚡ Cross-platform execution detected!\n');
        console.log('💡 AUTO-EXECUTION PLAN:\n');
      }
      
      const stepsToExecute = incompleteSegment.steps.filter(s => {
        if (s.complete) return false;
        
        // If this is the target step, check if it needs to run on a different platform
        if (s.isTarget) {
          const setupPlatform = s.platform || 'web';
          return setupPlatform !== currentPlatform;
        }
        
        return true;
      });
      
      if (stepsToExecute.length === 0) {
        console.log(`   Segment ${incompleteSegment.platform} has no executable steps`);
        segmentsExecuted++;
        continue;
      }
      
      console.log(`${segmentsExecuted + 1}. Run ${incompleteSegment.platform} segment (${stepsToExecute.length} tests):\n`);
      stepsToExecute.forEach((step, idx) => {
        const testName = path.basename(step.testFile || 'unknown');
        console.log(`   ${idx + 1}. ${step.status} - ${testName}`);
      });
      console.log('');
      
      // Only show countdown on first segment
      if (segmentsExecuted === 0) {
        // Show what comes after
        const remainingSegments = currentSegments.filter((s, i) => 
          i > currentSegments.indexOf(incompleteSegment) && !s.complete
        );
        
        if (remainingSegments.length > 0) {
          remainingSegments.forEach((seg, idx) => {
            const segSteps = seg.steps.filter(s => !s.complete && !s.isTarget);
            if (segSteps.length > 0 || seg.steps.some(s => s.isTarget)) {
              const label = seg.steps.some(s => s.isTarget) ? 'Continue with current test' : `Run ${seg.platform} segment`;
              console.log(`${segmentsExecuted + idx + 2}. ${label} (${seg.platform})\n`);
            }
          });
        }
        
        const shouldProceed = await this.countdown(10, 'Starting auto-execution');
        
        if (!shouldProceed) {
          console.error('❌ Pre-flight check cancelled by user.\n');
          process.exit(1);
        }
      }
      
      console.log(`🌐 Executing ${incompleteSegment.platform} segment...\n`);
      
      try {
        // ═══════════════════════════════════════════════════════════
// CHECK PLATFORM PREREQUISITES BEFORE EXECUTING SEGMENT
// ═══════════════════════════════════════════════════════════
const platformPrereq = config?.platformPrerequisites?.[incompleteSegment.platform];

if (platformPrereq && typeof platformPrereq.check === 'function') {
  const prereqMet = platformPrereq.check(currentData);
  
  if (!prereqMet && platformPrereq.setup?.file) {
    console.log(`   ⚠️  Platform prerequisite not met: ${platformPrereq.name}`);
    
    // Execute the platform prerequisite first
    if (incompleteSegment.platform === 'web' || incompleteSegment.platform === 'playwright') {
      // Web: can run in subprocess (browser state persists)
      console.log(`   🔐 Running login first: ${path.basename(platformPrereq.setup.file)}\n`);
      await this.executeWebSegmentInline([{
        testFile: platformPrereq.setup.file,
        status: platformPrereq.name,
        actionName: platformPrereq.setup.actionName
      }], testDataPath);
      
      // Reload data after prerequisite
      await new Promise(resolve => setTimeout(resolve, 300));
      this._clearDataCaches();
      
      const deltaPath = TestContext.getDeltaPath(testDataPath);
const resolvedDelta = path.resolve(process.cwd(), deltaPath);
const resolvedOriginal = path.resolve(process.cwd(), testDataPath);
const actualPath = fs.existsSync(resolvedDelta) ? resolvedDelta : resolvedOriginal;

console.log(`   🔍 DEBUG paths:`);
console.log(`      deltaPath: ${deltaPath}`);
console.log(`      resolvedDelta exists: ${fs.existsSync(resolvedDelta)}`);
console.log(`      actualPath: ${actualPath}`);
      const rawData = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
      currentData = this._mergeChangeLog(rawData);
      
      console.log(`   ✅ Platform prerequisite complete: ${platformPrereq.name}`);
      console.log(`   📂 Loaded state: ${platformPrereq.name}=${currentData[incompleteSegment.platform]?.logged_in || 'unknown'}\n`);
    } else {
      // Mobile: DON'T run here! App resets between sessions.
      // checkOrThrow will handle it inline with the live driver.
      console.log(`   📱 Mobile prerequisite will run inline with test driver (app resets between sessions)`);
      console.log(`   ℹ️  checkOrThrow() will execute ${platformPrereq.setup.actionName} with same Appium session\n`);
    }
  }
}
        
        // ═══════════════════════════════════════════════════════════
        // EXECUTE THE ACTUAL SEGMENT STEPS
        // ═══════════════════════════════════════════════════════════
        if (incompleteSegment.platform === 'web' || incompleteSegment.platform === 'playwright') {
          await this.executeWebSegmentInline(stepsToExecute, testDataPath);
        } else {
          // Mobile (dancer/clubApp/manager) - subprocess per test
          for (const step of stepsToExecute) {
            this.executeTestInSubprocess(step.testFile, incompleteSegment.platform);
          }
        }
        
        console.log(`✅ ${incompleteSegment.platform} segment complete!\n`);
        
        // Wait for files to sync
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Re-load data
        this._clearDataCaches();
        
        const deltaPath = TestContext.getDeltaPath(testDataPath);
const resolvedDelta = path.resolve(process.cwd(), deltaPath);
const resolvedOriginal = path.resolve(process.cwd(), testDataPath);
const actualPath = fs.existsSync(resolvedDelta) ? resolvedDelta : resolvedOriginal;

console.log(`   🔍 DEBUG paths:`);
console.log(`      deltaPath: ${deltaPath}`);
console.log(`      resolvedDelta exists: ${fs.existsSync(resolvedDelta)}`);
console.log(`      actualPath: ${actualPath}`);
        const rawData = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
        const mergedData = this._mergeChangeLog(rawData);
        
        console.log(`   📂 Loaded state: status=${mergedData.status}, booking.status=${mergedData.booking?.status || 'N/A'}\n`);
        
        currentData = mergedData;
        segmentsExecuted++;
        
      } catch (error) {
        console.error(`\n❌ Error during auto-execution: ${error.message}\n`);
        console.error('❌ Pre-flight check failed.\n');
        process.exit(1);
      }
    }
    
    // If we got here, we executed max segments but still not ready
    const finalAnalysis = planner.analyze(ImplicationClass, currentData);
    
    if (finalAnalysis.ready) {
      console.log('✅ All prerequisites satisfied!\n');
      return true;
    }
    
    // Check if remaining is same-platform
    const finalSegments = planner._groupChainByPlatform(finalAnalysis.chain, currentData, ImplicationClass);
    const remainingIncomplete = finalSegments.find(s => !s.complete && !s.steps.every(step => step.isTarget));
    
    if (!remainingIncomplete || this._isSamePlatform(remainingIncomplete.platform, currentPlatform)) {
      if (finalAnalysis.nextStep) {
        console.log(`\n⚠️  Prerequisites missing - will auto-execute during test\n`);
        console.log(`   Next step: ${finalAnalysis.nextStep.actionName} (${finalAnalysis.nextStep.status})`);
      }
      console.log('✅ Pre-flight check passed (auto-execution enabled)\n');
      return true;
    }
    
    planner.printNotReadyError(finalAnalysis);
    console.error('❌ Pre-flight check failed. Could not complete all cross-platform prerequisites.\n');
    process.exit(1);
    
  } catch (error) {
    console.error(`❌ Pre-flight check error: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Load ai-testing.config.js
 */
static _loadConfig() {
  try {
    const configPath = path.join(process.cwd(), 'ai-testing.config.js');
    if (fs.existsSync(configPath)) {
      delete require.cache[require.resolve(configPath)];
      return require(configPath);
    }
  } catch (e) {
    console.warn(`   ⚠️  Could not load ai-testing.config.js: ${e.message}`);
  }
  return null;
}
// ═══════════════════════════════════════════════════════════
  // STATIC: Evaluate conditions (for use in generated tests)
  // ═══════════════════════════════════════════════════════════
  static evaluateConditions(conditions, testData, storedVariables = {}) {
    const planner = new TestPlanner({ verbose: false });
    return planner._evaluateConditions(conditions, testData, storedVariables);
  }

  static evaluateStepConditions(stepConditions, testData, storedVariables = {}) {
    if (!stepConditions?.blocks?.length) {
      return true; // No conditions = always run
    }
    
    const result = TestPlanner.evaluateConditions(stepConditions, testData, storedVariables);
    
    if (!result.met) {
      console.log('⏭️ Step conditions not met:');
      if (result.results) {
        for (const blockResult of result.results) {
          if (!blockResult.met && blockResult.checks) {
            for (const check of blockResult.checks) {
              if (!check.met) {
                console.log(`   ❌ ${check.field} ${check.operator} ${JSON.stringify(check.expected)} (actual: ${JSON.stringify(check.actual)})`);
              }
            }
          }
        }
      }
    }
    
    return result.met;
  }
}

module.exports = TestPlanner;