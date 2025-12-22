import { glob } from 'glob';
import path from 'path';
import fs from 'fs-extra';
import { parseFile, hasPattern, extractXStateTransitions, extractXStateMetadata, extractUIImplications, extractXStateContext } from './astParser.js';
import { isImplication, extractImplicationMetadata } from '../../../core/src/patterns/implications.js';
import { isSection, extractSectionMetadata } from '../../../core/src/patterns/sections.js';
import { isScreen, extractScreenMetadata } from '../../../core/src/patterns/screens.js';
import { DiscoveryResult, DiscoveredFile } from '../../../core/src/types/discovery.js';
/**
 * Discover all patterns in a project
 */
export async function discoverProject(projectPath) {
  const cacheDir = path.join(projectPath, '.implications-framework', 'cache');
if (fs.existsSync(cacheDir)) {
  console.log('🗑️ Clearing discovery cache for fresh scan...');
  fs.rmSync(cacheDir, { recursive: true, force: true });
}
  console.log(`🔍 Discovering project at: ${projectPath}`);
  
  const result = new DiscoveryResult();
  result.projectPath = projectPath;
  
  // Add transitions array
  result.transitions = [];
  
  // ✅ CREATE CACHE OBJECT
  const cache = {
    baseFiles: {}
  };
  
  try {
    // Find all JavaScript files
    const jsFiles = await glob('**/*.js', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
      absolute: true,
    });
    
    console.log(`📁 Found ${jsFiles.length} JavaScript files`);
    
    // Parse each file
    for (const filePath of jsFiles) {
      try {
        const parsed = await parseFile(filePath);
        
        // Skip files with parse errors
        if (parsed.error) {
          result.errors.push({
            file: filePath,
            error: parsed.error,
          });
          continue;
        }
        
        // Check what type of file this is - PASS CACHE
       await classifyFile(parsed, result, projectPath, cache);

// NEW: Extract transitions if it's an implication
if (isImplication(parsed)) {
  const fileName = path.basename(filePath);
  console.log(`🔍 Checking transitions for: ${fileName}`);
  
  const metadata = await extractImplicationMetadata(
    parsed,
    extractXStateMetadata,
    (content) => extractUIImplications(content, projectPath, cache),
    extractXStateContext
  );
  
  console.log(`   Class: ${metadata.className}`);
  console.log(`   hasXStateConfig: ${metadata.hasXStateConfig}`);
  
  if (metadata.hasXStateConfig) {
    console.log(`   📤 Calling extractXStateTransitions...`);
    const transitions = extractXStateTransitions(parsed, metadata.className);
    console.log(`   📥 Got ${transitions.length} transition(s)`);
    
    if (transitions.length > 0) {
      transitions.forEach(t => {
        console.log(`      ✅ ${t.from} → ${t.to} (${t.event})`);
      });
    }
    
    result.transitions.push(...transitions);
  } else {
    console.log(`   ⚠️ No xstateConfig found`);
  }
}
        
        // Check for patterns
        if (hasPattern(parsed, 'xstate')) result.patterns.hasXState = true;
        if (hasPattern(parsed, 'enhancedBaseSection')) result.patterns.hasEnhancedBaseSection = true;
        if (hasPattern(parsed, 'testContext')) result.patterns.hasTestContext = true;
        if (hasPattern(parsed, 'expectImplication')) result.patterns.hasExpectImplication = true;
        
      } catch (error) {
        result.errors.push({
          file: filePath,
          error: error.message,
        });
      }
    }
    
    // Determine project type
    result.projectType = determineProjectType(result);
    
    // Calculate statistics
    result.statistics = calculateStatistics(result);

// ✨ NEW: Build and write state registry
if (result.files.implications.length > 0) {
  result.stateRegistry = buildAndWriteStateRegistry(
    result.files.implications,
    projectPath
  );
}

// ✨ NEW: Build and write state registry
if (result.files.implications.length > 0) {
  result.stateRegistry = buildAndWriteStateRegistry(
    result.files.implications,
    projectPath
  );
}

// ✨ NEW: Check which transitions need test regeneration
if (result.transitions && result.transitions.length > 0) {
  console.log('\n🔍 Checking transitions for missing test files...');
  result.transitions = checkTransitionsForRegeneration(
    result.transitions,
    result.files.implications,
    projectPath
  );
}

// ✅ ADD THIS: Save discovery result to cache

// ✅ ADD THIS: Save discovery result to cache
console.log('\n💾 Saving discovery cache...');
const cacheDir = path.join(projectPath, '.implications-framework', 'cache');
fs.ensureDirSync(cacheDir);

const cacheFile = path.join(cacheDir, 'discovery-result.json');
fs.writeJsonSync(cacheFile, result, { spaces: 2 });

console.log(`   ✅ Cache saved: ${cacheFile}`);

console.log(`✅ Discovery complete`);
console.log(`✅ Discovery complete`);
console.log(`   - Implications: ${result.files.implications.length}`);
console.log(`   - Sections: ${result.files.sections.length}`);
console.log(`   - Screens: ${result.files.screens.length}`);
console.log(`   - Project Type: ${result.projectType}`);
console.log(`   - Transitions: ${result.transitions.length}`);
console.log(`   💾 Cache: ${Object.keys(cache.baseFiles).length} base files cached`)
    return result;
    
  } catch (error) {
    console.error(`❌ Discovery failed:`, error);
    throw error;
  }
}

/**
 * ✅ Parse a single implication file (for fast refresh)
 * @param {string} filePath - Absolute path to file
 * @param {string} projectPath - Project root path
 * @returns {Object} Parsed implication data
 */
export async function parseImplicationFile(filePath, projectPath) {
  try {
    console.log(`⚡ Parsing single file: ${path.basename(filePath)}`);
    
    const parsed = await parseFile(filePath);
    
    if (parsed.error) {
      throw new Error(`Parse error: ${parsed.error}`);
    }
    
    if (!isImplication(parsed)) {
      throw new Error('File is not an implication');
    }
    
    // Create cache for this single parse
    const cache = { baseFiles: {} };
    
    // Extract metadata with UI implications
    const metadata = await extractImplicationMetadata(
      parsed,
      extractXStateMetadata,
      (content) => extractUIImplications(content, projectPath, cache),
      extractXStateContext
    );
    
    const relativePath = path.relative(projectPath, filePath);
    
    console.log(`✅ Parsed: ${metadata.className}`);
    
    return {
      path: relativePath,
      type: 'implication',
      fileName: path.basename(filePath),
      className: metadata.className,
      metadata
    };
    
  } catch (error) {
    console.error(`❌ Error parsing ${path.basename(filePath)}:`, error.message);
    throw error;
  }
}

/**
 * Classify a parsed file
 */
async function classifyFile(parsed, result, projectPath, cache) {
  const relativePath = path.relative(result.projectPath, parsed.path);
  
  // Check for Implication
  if (isImplication(parsed)) {
    const metadata = await extractImplicationMetadata(
      parsed, 
      extractXStateMetadata, 
      (content) => extractUIImplications(content, projectPath, cache),
      extractXStateContext
    );
    
    result.files.implications.push(new DiscoveredFile({
      path: relativePath,
      type: 'implication',
      className: metadata.className,
      metadata,
    }));
    return;
  }

  // Check for Section
  if (isSection(parsed)) {
    const metadata = extractSectionMetadata(parsed);
    result.files.sections.push(new DiscoveredFile({
      path: relativePath,
      type: 'section',
      className: metadata.className,
      metadata,
    }));
    return;
  }
  
  // Check for Screen
  if (isScreen(parsed)) {
    const metadata = extractScreenMetadata(parsed);
    result.files.screens.push(new DiscoveredFile({
      path: relativePath,
      type: 'screen',
      className: metadata.className,
      metadata,
    }));
    return;
  }
  
  // Check for UNIT test
  if (parsed.path.includes('-UNIT.spec.js')) {
    result.files.unitTests.push(new DiscoveredFile({
      path: relativePath,
      type: 'unit_test',
    }));
    return;
  }
  
  // Check for VALIDATION test
  if (parsed.path.includes('-VALIDATION.spec.js')) {
    result.files.validationTests.push(new DiscoveredFile({
      path: relativePath,
      type: 'validation_test',
    }));
  }
}

/**
 * Determine overall project type
 */
function determineProjectType(result) {
  const { patterns, files } = result;
  
  // If has XState and stateful implications, it's Booking
  const hasStatefulImplications = files.implications.some(
    imp => imp.metadata?.isStateful
  );
  
  if (patterns.hasXState && hasStatefulImplications) {
    return 'booking';
  }
  
  // If has EnhancedBaseSection and sections, it's CMS
  if (patterns.hasEnhancedBaseSection && files.sections.length > 0) {
    return 'cms';
  }
  
  // Otherwise custom
  return 'custom';
}

/**
 * Calculate statistics
 */
function calculateStatistics(result) {
  const totalFiles = Object.values(result.files).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  
  const totalClasses = result.files.implications.length +
                       result.files.sections.length +
                       result.files.screens.length;
  
  return {
    totalFiles,
    totalClasses,
    totalMethods: 0, // TODO: Sum from metadata
  };
}

/**
 * Build and write state registry to disk
 * 
 * @param {Array} implications - Array of discovered implications
 * @param {string} projectPath - Root path of project
 * @returns {Object} State registry mapping
 */
export function buildAndWriteStateRegistry(implications, projectPath) {
  console.log('\n🗺️  Building State Registry...');
  console.log('🗺️  Building State Registry (strategy: auto)...');
  
  const registry = {};
  
  implications.forEach(imp => {
    const metadata = imp.metadata || {};
    
    if (metadata.hasXStateConfig && metadata.status) {
      // Map status -> className
      registry[metadata.status] = metadata.className;
      console.log(`  📌 Mapped: "${metadata.status}" → "${metadata.className}"`);
      
      // Also map normalized version (remove underscores, lowercase)
      const normalized = metadata.status.replace(/_/g, '').toLowerCase();
      if (normalized !== metadata.status) {
        registry[normalized] = metadata.className;
      }
    }
  });
  
  console.log(`✅ State Registry built: ${Object.keys(registry).length} mappings\n`);
  
  // Write to each directory containing Implications
 

// ✅ Write to canonical location in the PROJECT being scanned
const registryPath = path.join(projectPath, 'tests/implications/.state-registry.json');
const registryDir = path.dirname(registryPath);

// Ensure directory exists
fs.ensureDirSync(registryDir);

// Write registry
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
console.log(`   💾 Wrote registry: ${registryPath}`);
  return registry;
}

/**
 * ✨ Check which transitions need test file regeneration
 * 
 * A transition needs regeneration if:
 * 1. The target state has no setup entry for this path
 * 2. The setup entry exists but test file is missing
 */
function checkTransitionsForRegeneration(transitions, implications, projectPath) {
  let needsRegenCount = 0;
  
  // Build a map of status -> implication for quick lookup
  const implicationMap = new Map();
  implications.forEach(imp => {
    const status = imp.metadata?.status;
    if (status) {
      implicationMap.set(status, imp);
      implicationMap.set(status.toLowerCase(), imp);
    }
  });
  
  // Check each transition
  const enrichedTransitions = transitions.map(transition => {
    const { from, to, event } = transition;
    
    // Find the target implication
    const targetImp = implicationMap.get(to) || implicationMap.get(to.toLowerCase());
    
    if (!targetImp) {
      needsRegenCount++;
      return {
        ...transition,
        needsRegeneration: true,
        regenerationReason: 'Target state not found'
      };
    }
    
    // Get setup entries from target
    const setup = targetImp.metadata?.setup || targetImp.metadata?.xstateConfig?.meta?.setup;
    const setupArray = Array.isArray(setup) ? setup : (setup ? [setup] : []);
    
    // Find matching setup entry for this transition
    const matchingSetup = setupArray.find(s => {
      const prevStatusMatch = s.previousStatus === from || 
                              s.previousStatus?.toLowerCase() === from?.toLowerCase();
      return prevStatusMatch;
    });
    
    if (!matchingSetup) {
      needsRegenCount++;
      return {
        ...transition,
        needsRegeneration: true,
        regenerationReason: 'No setup entry for this path'
      };
    }
    
    // Check if test file exists
    if (matchingSetup.testFile) {
      const testFilePath = path.join(projectPath, matchingSetup.testFile);
      const testFileExists = fs.existsSync(testFilePath);
      
      if (!testFileExists) {
        needsRegenCount++;
        return {
          ...transition,
          needsRegeneration: true,
          regenerationReason: 'Test file missing',
          expectedTestFile: matchingSetup.testFile
        };
      }
      
      // Test file exists
      return {
        ...transition,
        needsRegeneration: false,
        hasTestFile: true,
        testFile: matchingSetup.testFile
      };
    } else {
      needsRegenCount++;
      return {
        ...transition,
        needsRegeneration: true,
        regenerationReason: 'No test file specified in setup'
      };
    }
  });
  
  console.log(`   ⚠️  ${needsRegenCount} transitions need test regeneration`);
  
  return enrichedTransitions;
}