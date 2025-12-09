// test-composition-rewriter.js
// Quick test script for CompositionRewriter backend

import CompositionRewriter from './CompositionRewriter.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testRewriter() {
  console.log('🧪 Testing CompositionRewriter...\n');
  
  // ⚠️ UPDATE THIS PATH TO YOUR ACTUAL PROJECT!
  // Example: /home/dimitrij/Projects/cxm/PolePosition-TESTING/tests/implications/bookings/status/AcceptedBookingImplications.js
  const testFilePath = process.argv[2] || path.join(
    '/home/dimitrij/Projects/cxm/PolePosition-TESTING',
    'tests/implications/bookings/status/AcceptedBookingImplications.js'
  );
  
  console.log('📁 Test file:', testFilePath);
  console.log('');
  
  const rewriter = new CompositionRewriter();
  
  // Test 1: Validate file structure
  console.log('Test 1: Validating file structure...');
  try {
    const validation = await rewriter.validateFile(testFilePath);
    console.log('  Result:', validation);
    console.log('');
    
    if (!validation.valid) {
      console.error('❌ File validation failed. Cannot proceed.');
      return;
    }
  } catch (error) {
    console.error('❌ Error reading file:', error.message);
    console.log('\n💡 Usage: node test-composition-rewriter.js [path-to-implication-file]');
    console.log('   Example: node test-composition-rewriter.js /home/dimitrij/Projects/cxm/PolePosition-TESTING/tests/implications/bookings/status/AcceptedBookingImplications.js');
    return;
  }
  
  // Test 2: Get available base classes
  console.log('Test 2: Finding available base classes...');
  const baseClasses = await rewriter.getAvailableBaseClasses(testFilePath);
  console.log('  Base classes:', baseClasses);
  console.log('');
  
  // Test 3: Get available behaviors
  console.log('Test 3: Finding available behaviors...');
  const behaviors = await rewriter.getAvailableBehaviors(testFilePath);
  console.log('  Behaviors:', behaviors);
  console.log('');
  
  // Test 4: Preview mode - change base class
  console.log('Test 4: Preview mode - changing base class...');
  const previewResult = await rewriter.rewrite(
    testFilePath,
    {
      baseClass: 'BaseBookingImplications', // Change to different base class
      behaviors: ['NotificationsImplications']
    },
    true // Preview mode - don't write
  );
  
  if (previewResult.success) {
    console.log('  ✅ Preview successful!');
    console.log('  Changes:', JSON.stringify(previewResult.preview.changes, null, 2));
    console.log('');
    console.log('  First 500 chars of modified code:');
    console.log('  ', previewResult.preview.modified.slice(0, 500).replace(/\n/g, '\n   '));
  } else {
    console.error('  ❌ Preview failed:', previewResult.error);
  }
  
  console.log('');
  console.log('✅ All tests complete!');
  console.log('');
  console.log('💡 To test with actual file writing, run:');
  console.log('   node test-composition-rewriter.js [path-to-file] --write');
}

// Run tests
testRewriter().catch(console.error);