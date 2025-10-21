import { glob } from 'glob';
import path from 'path';
import { parseFile, hasPattern, extractXStateTransitions, extractXStateMetadata, extractUIImplications } from './astParser.js';
import { isImplication, extractImplicationMetadata } from '../../../core/src/patterns/implications.js';
import { isSection, extractSectionMetadata } from '../../../core/src/patterns/sections.js';
import { isScreen, extractScreenMetadata } from '../../../core/src/patterns/screens.js';
import { DiscoveryResult, DiscoveredFile } from '../../../core/src/types/discovery.js';

/**
 * Discover all patterns in a project
 */
/**
 * Discover all patterns in a project
 */
export async function discoverProject(projectPath) {
  console.log(`🔍 Discovering project at: ${projectPath}`);
  
  const result = new DiscoveryResult();
  result.projectPath = projectPath;
  
  // Add transitions array
  result.transitions = [];
  
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
        
        // Check what type of file this is
        await classifyFile(parsed, result);
        
        // NEW: Extract transitions if it's an implication
        if (isImplication(parsed)) {
          const metadata = extractImplicationMetadata(parsed);
          if (metadata.hasXStateConfig) {
            const transitions = extractXStateTransitions(parsed, metadata.className);
            result.transitions.push(...transitions);
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
    
    console.log(`✅ Discovery complete`);
    console.log(`   - Implications: ${result.files.implications.length}`);
    console.log(`   - Sections: ${result.files.sections.length}`);
    console.log(`   - Screens: ${result.files.screens.length}`);
    console.log(`   - Project Type: ${result.projectType}`);
    
    return result;
    
  } catch (error) {
    console.error(`❌ Discovery failed:`, error);
    throw error;
  }
}

/**
 * Classify a parsed file
 */
async function classifyFile(parsed, result) {
  const relativePath = path.relative(result.projectPath, parsed.path);
  
  // Check for Implication
  if (isImplication(parsed)) {
    const metadata = extractImplicationMetadata(parsed, extractXStateMetadata, extractUIImplications);  // ✅ Pass both extractors
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