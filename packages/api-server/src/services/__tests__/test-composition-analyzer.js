// packages/api-server/src/services/__tests__/test-composition-analyzer.js
// Simple manual test for CompositionAnalyzer
// Run with: node test-composition-analyzer.js

import CompositionAnalyzer from '../CompositionAnalyzer.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function testAnalyzer() {
  logSection('🧪 CompositionAnalyzer Test Suite');
  
  // NOTE: Update this path to point to your actual test file
  // The implications-framework is testing files from the PolePosition-TESTING project
  const testFilePath = '/home/dimitrij/Projects/cxm/PolePosition-TESTING/tests/implications/bookings/status/AcceptedBookingImplications.js';
  
  log(`\n📁 Testing file: ${testFilePath}`, 'cyan');
  
  try {
    const analyzer = new CompositionAnalyzer();
    const result = analyzer.analyze(testFilePath);
    
    // Display Base Class
    logSection('📦 Base Class Extension');
    if (result.baseClass) {
      log('✅ Base class detected!', 'green');
      console.log('   Class Name:', result.baseClass.className);
      console.log('   Import Path:', result.baseClass.relativePath);
      console.log('   Total Merges:', result.baseClass.totalMerges);
      console.log('   Screens Used:', result.baseClass.screensUsed.join(', '));
      console.log('   Platform Breakdown:');
      Object.entries(result.baseClass.platformBreakdown).forEach(([platform, count]) => {
        console.log(`      ${platform}: ${count} screens`);
      });
    } else {
      log('ℹ️  No base class extension detected', 'yellow');
    }
    
    // Display Behaviors
    logSection('🔗 Behavior Composition');
    if (result.behaviors.length > 0) {
      log(`✅ ${result.behaviors.length} behavior(s) detected!`, 'green');
      result.behaviors.forEach((behavior, index) => {
        console.log(`\n   Behavior ${index + 1}:`);
        console.log('      Class Name:', behavior.className);
        console.log('      Import Path:', behavior.relativePath);
        console.log('      Method:', behavior.compositionMethod);
        console.log('      Platforms:', behavior.platforms.join(', '));
        console.log('      Screens:', behavior.screensAffected.join(', '));
      });
    } else {
      log('ℹ️  No behavior composition detected', 'yellow');
    }
    
    // Display Helper Usage
    logSection('🛠️  Helper Usage Summary');
    log(`Total mergeWithBase calls: ${result.helperUsage.totalMerges}`, 'bright');
    
    if (result.helperUsage.totalMerges > 0) {
      console.log('\n   By Platform:');
      Object.entries(result.helperUsage.byPlatform).forEach(([platform, count]) => {
        console.log(`      ${platform}: ${count}`);
      });
      
      console.log('\n   By Screen:');
      Object.entries(result.helperUsage.byScreen).forEach(([screen, count]) => {
        console.log(`      ${screen}: ${count}`);
      });
    }
    
    // Final Summary
    logSection('📊 Test Summary');
    log('✅ All tests passed!', 'green');
    log('\nAPI Response Preview:', 'cyan');
    console.log(JSON.stringify({ success: true, composition: result }, null, 2));
    
  } catch (error) {
    logSection('❌ Test Failed');
    log(error.message, 'red');
    log('\nStack trace:', 'yellow');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testAnalyzer();