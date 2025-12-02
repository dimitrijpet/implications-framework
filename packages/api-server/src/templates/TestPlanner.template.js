// tests/ai-testing/utils/TestPlanner.js
// Version: 4.2 - Multi-Platform, Loop Transitions, Requires Mismatch Detection
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
    
    if (meta?.entity) {
      const entity = meta.entity;
      const entityStatus = testData[entity]?.status || null;
      
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
static _findSetupEntry(meta, options = {}) {
  const { currentTestFile, explicitEvent, testData } = options;
  
  if (!meta.setup || meta.setup.length === 0) {
    return null;
  }
  
  const verbose = process.env.DEBUG_SETUP_ENTRY === 'true';
  
  if (verbose) {
    console.log(`\n   🔍 _findSetupEntry: ${meta.setup.length} entries`);
    console.log(`      testData.agency=${testData?.agency}`);
    console.log(`      currentTestFile=${currentTestFile ? path.basename(currentTestFile) : 'none'}`);
    console.log(`      explicitEvent=${explicitEvent || 'none'}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // STEP 1: Match by exact test file path (highest priority)
  // ═══════════════════════════════════════════════════════════
  if (currentTestFile) {
    const currentBasename = path.basename(currentTestFile);
    const entry = meta.setup.find(s => {
      if (!s.testFile) return false;
      return path.basename(s.testFile) === currentBasename;
    });
    if (entry) {
      if (verbose) console.log(`   ✅ Matched by exact testFile: ${currentBasename}`);
      return entry;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // STEP 2: Check requires against testData (PRIORITY!)
  // This is the key fix - requires matching takes precedence
  // ═══════════════════════════════════════════════════════════
  if (testData && meta.setup.length > 1) {
    if (verbose) console.log(`   🔍 Checking requires against testData...`);
    
    // Collect all entries that match the requires
    const matchingEntries = [];
    
    for (let i = 0; i < meta.setup.length; i++) {
      const entry = meta.setup[i];
      
      // Entry without requires is a "default" path
      if (!entry.requires || Object.keys(entry.requires).length === 0) {
        if (verbose) console.log(`   📋 Entry ${i}: No requires (default path, skipping for now)`);
        continue;
      }
      
      let allMet = true;
      const checks = [];
      
      for (const [field, requiredValue] of Object.entries(entry.requires)) {
        // Skip previousStatus - that's not a data field check
        if (field === 'previousStatus') continue;
        
        const actualValue = field.includes('.')
          ? field.split('.').reduce((obj, key) => obj?.[key], testData)
          : testData[field];
        
        const matches = actualValue === requiredValue;
        checks.push({ field, required: requiredValue, actual: actualValue, matches });
        
        if (!matches) {
          allMet = false;
        }
      }
      
      if (verbose) {
        console.log(`   📋 Entry ${i} (previousStatus: ${entry.previousStatus}):`);
        checks.forEach(c => {
          const icon = c.matches ? '✅' : '❌';
          console.log(`      ${icon} ${c.field}: required=${JSON.stringify(c.required)}, actual=${JSON.stringify(c.actual)}`);
        });
        console.log(`      Result: ${allMet ? '✅ MATCHES' : '❌ No match'}`);
      }
      
      if (allMet && checks.length > 0) {
        matchingEntries.push({ entry, index: i, checksCount: checks.length });
      }
    }
    
    // If we found matching entries, pick the best one
    if (matchingEntries.length > 0) {
      // If only one matches, use it
      if (matchingEntries.length === 1) {
        const winner = matchingEntries[0];
        if (verbose) console.log(`   ✅ Single requires match: Entry ${winner.index} (previousStatus: ${winner.entry.previousStatus})`);
        return winner.entry;
      }
      
      // Multiple matches - use explicitEvent as tiebreaker
      if (explicitEvent && matchingEntries.length > 1) {
        const normalizedEvent = explicitEvent.replace(/_/g, '').toUpperCase();
        const eventMatch = matchingEntries.find(m => {
          if (!m.entry.testFile) return false;
          return m.entry.testFile.toUpperCase().includes(normalizedEvent);
        });
        if (eventMatch) {
          if (verbose) console.log(`   ✅ Tiebreaker by explicitEvent: Entry ${eventMatch.index}`);
          return eventMatch.entry;
        }
      }
      
      // Just return the first matching entry
      const winner = matchingEntries[0];
      if (verbose) console.log(`   ✅ First requires match: Entry ${winner.index} (previousStatus: ${winner.entry.previousStatus})`);
      return winner.entry;
    }
    
    // No requires matched - fall back to entry WITHOUT requires (default path)
    const defaultEntry = meta.setup.find(s => !s.requires || Object.keys(s.requires).length === 0);
    if (defaultEntry) {
      if (verbose) console.log(`   ⚠️ No requires match, using default entry (no requires)`);
      return defaultEntry;
    }
    
    // All entries have requires but none match - configuration error!
    console.warn(`\n   ⚠️ WARNING: No setup entry matches testData!`);
    console.warn(`   ⚠️ testData values:`);
    meta.setup.forEach((entry, i) => {
      if (entry.requires) {
        Object.keys(entry.requires).forEach(field => {
          if (field !== 'previousStatus') {
            const actual = field.includes('.') 
              ? field.split('.').reduce((obj, key) => obj?.[key], testData)
              : testData[field];
            console.warn(`      ${field}: ${JSON.stringify(actual)}`);
          }
        });
      }
    });
    console.warn(`   ⚠️ Available entries:`);
    meta.setup.forEach((entry, i) => {
      console.warn(`      Entry ${i}: requires=${JSON.stringify(entry.requires)}, previousStatus=${entry.previousStatus}`);
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // STEP 3: Fall back to explicitEvent matching (legacy behavior)
  // ═══════════════════════════════════════════════════════════
  if (explicitEvent) {
    const normalizedEvent = explicitEvent.replace(/_/g, '').toUpperCase();
    const entry = meta.setup.find(s => {
      if (!s.testFile) return false;
      return s.testFile.toUpperCase().includes(normalizedEvent);
    });
    if (entry) {
      if (verbose) console.log(`   ⚠️ Fallback: Matched by explicitEvent: ${explicitEvent}`);
      return entry;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // STEP 4: Default to first entry
  // ═══════════════════════════════════════════════════════════
  if (verbose) console.log(`   ⚠️ Falling back to first entry`);
  return meta.setup[0];
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
  // STATIC HELPER: Get previousStatus from setup entry or meta.requires
  // ═══════════════════════════════════════════════════════════
  static _getPreviousStatus(meta, options = {}) {
    const setupEntry = TestPlanner._findSetupEntry(meta, options);
    
    if (setupEntry?.previousStatus) {
      return setupEntry.previousStatus;
    }
    
    return meta.requires?.previousStatus || null;
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
    if (!rawData._changeLog || !rawData._original) {
      return rawData;
    }
    
    const merged = { ...rawData._original };
    
    for (const change of rawData._changeLog) {
      if (change.delta) {
        Object.assign(merged, change.delta);
      }
    }
    
    return merged;
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYZE - Main entry point for prerequisite analysis
  // ═══════════════════════════════════════════════════════════
  analyze(ImplicationClass, testData, options = {}) {
    const xstateConfig = ImplicationClass.xstateConfig || {};
    const meta = xstateConfig.meta || {};
    
    const targetStatus = meta.status;
    const currentStatus = TestPlanner._getCurrentStatus(testData, ImplicationClass);
    
    const previousStatus = TestPlanner._getPreviousStatus(meta, { ...options, testData });
    
    if (this.options.verbose) {
      console.log(`\n🔍 TestPlanner: Analyzing ${targetStatus} state`);
      console.log(`   Current: ${currentStatus}`);
      console.log(`   Target: ${targetStatus}`);
      if (previousStatus) {
        console.log(`   Required previous: ${previousStatus}`);
      }
    }
    
    const chain = this.buildPrerequisiteChain(
      ImplicationClass, 
      currentStatus, 
      targetStatus, 
      new Set(), 
      true, 
      testData, 
      options
    );
    
    const missingFields = this.findMissingFields(meta, testData);
    
    const entityFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && fieldName.endsWith('.status');
    });

    const regularFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && !fieldName.endsWith('.status');
    });
    
    // Check for loop transition
    const isLoopTransition = targetStatus === currentStatus && 
                             previousStatus && 
                             previousStatus !== currentStatus;
    
    const ready = this.isReady(chain, currentStatus, isLoopTransition) && regularFields.length === 0;
    const nextStep = ready ? null : this.findNextStep(chain, currentStatus);
    const stepsRemaining = chain.filter(step => !step.complete).length;
    
    const analysis = {
      ready,
      currentStatus,
      targetStatus,
      previousStatus,
      isLoopTransition,
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
    
    const previousStatus = TestPlanner._getPreviousStatus(meta, { ...options, testData });
    
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
    // PREVIOUS STATUS CHAIN - This is the key fix!
    // ═══════════════════════════════════════════════════════════
    if (previousStatus) {
      if (meta.entity && this.options.verbose) {
        console.log(`   ℹ️  Entity prerequisite: ${meta.entity}.status must be ${previousStatus}`);
      }
      
      const prevImplClassName = this.stateRegistry[previousStatus];
      
      const canVisitPrevious = !visited.has(previousStatus) || 
                               (options.loopTarget === previousStatus) ||
                               (isLoopTransition && previousStatus !== targetStatus);
      
      if (prevImplClassName && canVisitPrevious) {
        try {
          const prevImplPath = this.findImplicationFile(prevImplClassName);
          
          if (prevImplPath) {
            // FIXED: Clear cache properly before require
            this._clearImplicationCache(prevImplPath);
            const PrevImplClass = require(prevImplPath);
            
            // Select the right transition if multiple paths exist
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
                loopTarget: isLoopTransition ? targetStatus : options.loopTarget
              }
            );
            chain.push(...prevChain);
          } else {
            // File not found - add placeholder
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
          // CRITICAL: Don't silently skip - add to chain as incomplete!
          console.error(`   ❌ Failed to load ${prevImplClassName}: ${error.message}`);
          
          // Try to get basic info from state registry or filename pattern
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
        // Status not in registry
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
        const cleanField = field.slice(1);
        const actualValue = this._getNestedValue(cleanField, testData);
        checkResult.met = actualValue !== requiredValue;
        checkResult.actual = actualValue;
      }
      else if (field.includes('.')) {
        const actualValue = this._getNestedValue(field, testData);
        checkResult.met = actualValue === requiredValue;
        checkResult.actual = actualValue;
      }
      else if (typeof requiredValue === 'object' && requiredValue.contains) {
        const actualValue = testData[field];
        const valueToCheck = this._resolveValue(requiredValue.contains, testData);
        checkResult.met = Array.isArray(actualValue) && actualValue.includes(valueToCheck);
        checkResult.actual = actualValue;
      }
      else {
        const actualValue = testData[field];
        checkResult.met = actualValue === requiredValue;
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
    
    // Check setup entry requires
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
    else if (setupEntry?.requires) {
      for (const [field, requiredValue] of Object.entries(setupEntry.requires)) {
        if (field === 'previousStatus') continue;
        
        const actualValue = field.includes('.')
          ? field.split('.').reduce((obj, key) => obj?.[key], testData)
          : testData[field];
        
        if (actualValue !== requiredValue) {
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
                        
                        const actualValue = field.includes('.')
                          ? field.split('.').reduce((obj, key) => obj?.[key], testData)
                          : testData[field];
                        
                        if (actualValue !== requiredValue) {
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

// ═══════════════════════════════════════════════════════════════════════════
// STATIC: CHECK OR THROW - With inline same-platform execution
// ═══════════════════════════════════════════════════════════════════════════
static async checkOrThrow(ImplicationClass, testData, options = {}) {
  const { page, driver, testDataPath } = options;
  
  // If preflight already ran AND we're in a spawned subprocess, skip everything
  if (process.env.PREFLIGHT_COMPLETED === 'true' && process.env.IS_PREREQUISITE_EXECUTION === 'true') {
    console.log('✅ Pre-flight already completed, skipping prerequisite check\n');
    return { ready: true, skipped: true };
  }
  
  const planner = new TestPlanner({ verbose: true });
  
  const meta = ImplicationClass.xstateConfig?.meta || ImplicationClass.meta;
  const targetStatus = meta.status;
  const platform = meta.platform;

  // ═══════════════════════════════════════════════════════════
  // PLATFORM PREREQUISITES - Skip on recursive calls!
  // ═══════════════════════════════════════════════════════════
  const platformPrereqs = this._getPlatformPrerequisites();
  const prereq = platformPrereqs[platform];
  
  // Skip platform prereq if:
  // 1. This is a recursive call (skipPlatformPrereq flag)
  // 2. Already executing as prerequisite
  // 3. Session already established in this browser context
  const skipPlatformPrereq = options.skipPlatformPrereq === true || 
                              options.isPrerequisite === true ||
                              process.env.IS_PREREQUISITE_EXECUTION === 'true';
  
  if (prereq && !skipPlatformPrereq && !prereq.check(testData)) {
    console.log(`\n🔐 Platform prerequisite not met: ${platform} needs ${prereq.state}`);
    console.log(`   Running: ${prereq.actionName}\n`);
    
    try {
      process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
      process.env.IS_PREREQUISITE_EXECUTION = 'true';
      
      const testPath = path.join(process.cwd(), prereq.file);
      
      if (!fs.existsSync(testPath)) {
        console.warn(`   ⚠️  Platform prerequisite file not found: ${prereq.file}`);
        console.warn(`   ⚠️  Skipping platform init - make sure login runs first!\n`);
      } else {
        delete require.cache[require.resolve(testPath)];
        
        const testModule = require(testPath);
        const actionFn = testModule[prereq.actionName];
        
        if (!actionFn) {
          throw new Error(`Action ${prereq.actionName} not found in ${prereq.file}`);
        }
        
        const result = await actionFn(testDataPath, { page, driver, testDataPath });
        
        if (result && result.save) {
          result.save(testDataPath);
        }
        
        if (result && result.data) {
          Object.assign(testData, result.data);
        }
        
        console.log(`✅ Platform prerequisite ${prereq.state} complete!\n`);
      }
      
      delete process.env.SKIP_UNIT_TEST_REGISTRATION;
      delete process.env.IS_PREREQUISITE_EXECUTION;
      
    } catch (error) {
      delete process.env.SKIP_UNIT_TEST_REGISTRATION;
      delete process.env.IS_PREREQUISITE_EXECUTION;
      console.error(`❌ Platform prerequisite failed: ${error.message}`);
      throw error;
    }
  }
  
  const currentStatus = this._getCurrentStatus(testData, ImplicationClass);

  const testFile = meta.setup?.[0]?.testFile;
  const viaEvent = testFile ? TestPlanner._extractEventFromFilename(testFile) : null;

  console.log(`\n🔍 TestPlanner: Analyzing ${targetStatus} state`);
  console.log(`   Current: ${currentStatus}`);
  console.log(`   Target: ${targetStatus}`);
  if (viaEvent) {
    console.log(`   Via Event: ${viaEvent}`);
  }
  
  const analysis = planner.analyze(ImplicationClass, testData, { explicitEvent: viaEvent });

  // Already at target?
  if (targetStatus && currentStatus === targetStatus) {
    console.log(`✅ Already in target state (${targetStatus}), no action needed\n`);
    return { ready: true, skipped: true, currentStatus, targetStatus };
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
      const currentPlatform = page ? 'web' : platform;
      const isSamePlatform = this._isSamePlatform(incompleteSegment.platform, currentPlatform);
      
      if (isSamePlatform) {
        // ═══════════════════════════════════════════════════════════
        // SAME PLATFORM - Execute inline with SAME page/driver!
        // ═══════════════════════════════════════════════════════════
        console.log(`⚡ Auto-executing ${incompleteSegment.platform} segment inline...\n`);
        
        let executedAnySteps = false;
        
        for (const step of incompleteSegment.steps) {
          if (step.isTarget) continue;
          if (step.complete) continue;
          
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
            
            // Execute with SAME PAGE/DRIVER - this is the key!
            const result = await triggerFn(pathToUse, {
              page: page,       // ← SAME PAGE!
              driver: driver,   // ← SAME DRIVER!
              testDataPath: pathToUse,
              isPrerequisite: true
            });
            
            if (result && result.save) {
              result.save(pathToUse);
            }
            
            // Reload data to get updated status
            const finalDeltaPath = TestContext.getDeltaPath(originalPath);
            const reloadedCtx = TestContext.load(ImplicationClass, finalDeltaPath);
            Object.assign(testData, reloadedCtx.data);
            
            console.log(`   ✅ Completed: ${step.status}\n`);
            
          } catch (error) {
            console.error(`❌ Failed to execute ${actionName}: ${error.message}\n`);
            delete process.env.SKIP_UNIT_TEST_REGISTRATION;
            throw error;
          }
        }
        
        if (executedAnySteps) {
          console.log('🔄 Re-checking prerequisites after segment execution...\n');
          
          // CRITICAL: Skip platform prereq on recursive call!
          return TestPlanner.checkOrThrow(ImplicationClass, testData, {
            ...options,
            skipPlatformPrereq: true  // ← KEY FIX!
          });
        } else {
          console.log(`✅ Segment ${incompleteSegment.platform} has no executable steps\n`);
          
          // Check if there's a next segment on a different platform
          const currentSegmentIndex = segments.indexOf(incompleteSegment);
          const nextIncomplete = segments.find((s, idx) => 
            !s.complete && idx > currentSegmentIndex
          );
          
          if (nextIncomplete && !this._isSamePlatform(nextIncomplete.platform, currentPlatform)) {
            console.log(`\n⚠️  Next segment requires ${nextIncomplete.platform} platform\n`);
            
            const isPrerequisiteExecution = options?.isPrerequisite === true || 
                                            process.env.IS_PREREQUISITE_EXECUTION === 'true';
            
            if (isPrerequisiteExecution) {
              console.log('✅ Prerequisite completed - parent test will handle remaining platforms\n');
              return analysis;
            }
            
            planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
            throw new Error('Prerequisites not met (cross-platform)');
          }
          
          console.log('✅ All same-platform prerequisites satisfied!\n');
          return analysis;
        }
        
      } else {
        // ═══════════════════════════════════════════════════════════
        // DIFFERENT PLATFORM - Cannot execute inline
        // ═══════════════════════════════════════════════════════════
        const isPrerequisiteExecution = options?.isPrerequisite === true || 
                                        process.env.IS_PREREQUISITE_EXECUTION === 'true';
        
        if (isPrerequisiteExecution) {
          console.log(`\n✅ Platform ${currentPlatform} prerequisites complete\n`);
          console.log(`   (Remaining ${incompleteSegment.platform} prerequisites will be handled by parent test)\n`);
          return analysis;
        }
        
        console.log(`\n⚠️  Next segment requires ${incompleteSegment.platform} platform\n`);
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
        isPrerequisite: true
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
          skipPlatformPrereq: true  // ← KEY FIX!
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
  static async preFlightCheck(ImplicationClass, testDataPath) {
    try {
      const TestContext = require('./TestContext');
      const ctx = TestContext.load(ImplicationClass, testDataPath);
      
      const planner = new TestPlanner({ verbose: true });
      const meta = ImplicationClass.xstateConfig?.meta || {};
      const currentPlatform = meta.platform || 'web';
      const targetStatus = meta.status;
      const currentTestFile = meta.setup?.[0]?.testFile;
      
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
      
      const incompleteSegment = segments.find(s => !s.complete);
      
      if (!incompleteSegment) {
        console.log('✅ Pre-flight check passed!\n');
        return true;
      }
      
 
  const isDifferentPlatform = !this._isSamePlatform(incompleteSegment.platform, currentPlatform);
  
  if (isDifferentPlatform) {
        console.log('⚡ Cross-platform execution detected!\n');
        console.log('💡 AUTO-EXECUTION PLAN:\n');
        
        const stepsToExecute = incompleteSegment.steps.filter(s => !s.complete && !s.isTarget);
        
        if (stepsToExecute.length === 0) {
          console.log(`   Segment ${incompleteSegment.platform} has no executable steps`);
          console.log('✅ Pre-flight check passed!\n');
          return true;
        }
        
        console.log(`1. Run ${incompleteSegment.platform} segment (${stepsToExecute.length} tests):\n`);
        stepsToExecute.forEach((step, idx) => {
          const testName = path.basename(step.testFile || 'unknown');
          console.log(`   ${idx + 1}. ${step.status} - ${testName}`);
        });
        
        console.log(`\n2. Continue with current test (${currentPlatform})\n`);
        
        const shouldProceed = await this.countdown(10, 'Starting auto-execution');
        
        if (!shouldProceed) {
          console.error('❌ Pre-flight check cancelled by user.\n');
          process.exit(1);
        }
        
console.log(`🌐 Executing ${incompleteSegment.platform} segment...\n`);
        
        try {
          // Use inline execution for web to preserve session!
          if (incompleteSegment.platform === 'web' || incompleteSegment.platform === 'playwright') {
            await this.executeWebSegmentInline(stepsToExecute, testDataPath);
          } else {
            // Mobile - subprocess per test
            for (const step of stepsToExecute) {
              this.executeTestInSubprocess(step.testFile, incompleteSegment.platform);
            }
          }
          
          console.log(`✅ ${incompleteSegment.platform} segment complete!\n`);
          
          // Wait for files to sync
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Re-check
          this._clearDataCaches();
          
          const deltaPath = TestContext.getDeltaPath(testDataPath);
          const actualPath = fs.existsSync(deltaPath) ? deltaPath : testDataPath;
          const rawData = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
          const mergedData = this._mergeChangeLog(rawData);
          
          console.log(`   📂 Loaded state: status=${mergedData.status}\n`);
          
          const newAnalysis = planner.analyze(ImplicationClass, mergedData);
          
          if (newAnalysis.ready) {
            console.log('✅ All prerequisites satisfied!\n');
            return true;
          } else {
            console.error('⚠️  Prerequisites still not met after execution\n');
            planner.printNotReadyError(newAnalysis);
            console.error('❌ Pre-flight check failed.\n');
            process.exit(1);
          }
          
        } catch (error) {
          console.error(`\n❌ Error during auto-execution: ${error.message}\n`);
          console.error('❌ Pre-flight check failed.\n');
          process.exit(1);
        }
      }
      
      // Same platform - will auto-execute during test
        if (analysis.nextStep) {
      console.log(`\n⚠️  Prerequisites missing - will auto-execute during test\n`);
      console.log(`   Next step: ${analysis.nextStep.actionName} (${analysis.nextStep.status})`);
      console.log('✅ Pre-flight check passed (auto-execution enabled)\n');
      return true;
    }
      
      planner.printNotReadyError(analysis);
      console.error('❌ Pre-flight check failed. No path to target state.\n');
      process.exit(1);
      
    } catch (error) {
      console.error(`❌ Pre-flight check error: ${error.message}\n`);
      console.error(error.stack);
      process.exit(1);
    }
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