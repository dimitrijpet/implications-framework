#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import UnitTestGenerator from '../../core/src/generators/UnitTestGenerator.js';
import { fileURLToPath } from 'url';

// ES6 __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse arguments
const args = process.argv.slice(2);

function printUsage() {
  console.log(`
ðŸŽ¯ UNIT Test Generator CLI

USAGE:
  node cli.js <implication-file> [options]

ARGUMENTS:
  <implication-file>    Path to Implication file

OPTIONS:
  --platform <n>     Platform: web, cms, mobile-dancer, mobile-manager
                        Default: web
  
  --state <n>        Target state (for multi-state machines)
                        If omitted, generates for ALL states
  
  --preview             Preview without writing file
  
  --output <dir>        Output directory
                        Default: same directory as Implication file
  
  --utils <path>        Path to utils directory (for import paths)
                        Default: auto-detected from file location
                        Example: tests/utils or apps/cms/tests/utils

EXAMPLES:
  # Generate web test (single-state)
  node cli.js ../../tests/implications/bookings/AcceptedBookingImplications.js
  
  # Generate for specific state (multi-state)
  node cli.js ../../tests/implications/pages/CMSPageImplications.js --state published
  
  # Generate for ALL states (multi-state)
  node cli.js ../../tests/implications/pages/CMSPageImplications.js
  
  # Generate with custom utils path
  node cli.js CMSPageImplications.js --platform cms --utils apps/cms/tests/utils
  
  # Generate mobile-dancer test
  node cli.js ../../tests/implications/bookings/AcceptedBookingImplications.js --platform mobile-dancer
  
  # Preview only
  node cli.js ../../tests/implications/bookings/AcceptedBookingImplications.js --preview
`);
}

// Parse options
const options = {
  platform: 'web',
  state: null,
  preview: false,
  output: null,
  utils: null  // âœ¨ NEW: Custom utils path
};

let implPath = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help' || arg === '-h') {
    printUsage();
    process.exit(0);
  } else if (arg === '--platform') {
    options.platform = args[++i];
  } else if (arg === '--state') {
    options.state = args[++i];
  } else if (arg === '--preview') {
    options.preview = true;
  } else if (arg === '--output') {
    options.output = args[++i];
  } else if (arg === '--utils') {
    options.utils = args[++i];
  } else if (!implPath) {
    implPath = arg;
  }
}

if (!implPath) {
  console.error('âŒ Error: Implication file required\n');
  printUsage();
  process.exit(1);
}

// Resolve path
const implFullPath = path.resolve(process.cwd(), implPath);

if (!fs.existsSync(implFullPath)) {
  console.error(`âŒ Error: File not found: ${implFullPath}`);
  process.exit(1);
}

// Set output directory
if (!options.output) {
  options.output = path.dirname(implFullPath);
}

console.log('\nðŸŽ¯ UNIT Test Generator');
console.log('â•'.repeat(60));
console.log(`Implication: ${implFullPath}`);
console.log(`Platform: ${options.platform}`);
if (options.state) {
  console.log(`State: ${options.state}`);
}
console.log(`Output: ${options.output}`);
console.log(`Preview: ${options.preview ? 'YES' : 'NO'}`);
console.log('â•'.repeat(60));

// Generate
try {
  const generator = new UnitTestGenerator({
    outputDir: options.output,
    utilsPath: options.utils  // âœ¨ NEW: Custom utils path
  });
  
  const result = generator.generate(implFullPath, {
    platform: options.platform,
    state: options.state,
    preview: options.preview
  });
  
  // Handle single result or array of results
  const results = Array.isArray(result) ? result : [result];
  
  console.log('\nâœ… SUCCESS!\n');
  console.log('â•'.repeat(60));
  
  if (results.length === 1) {
    // Single test
    const r = results[0];
    console.log('ðŸ“Š Result:');
    console.log(`   File: ${r.fileName}`);
    
    if (!options.preview) {
      console.log(`   Path: ${r.filePath}`);
      console.log(`   Size: ${r.code.length} chars`);
      console.log(`\nðŸ’¡ Test file written to disk`);
    } else {
      console.log(`   Size: ${r.code.length} chars`);
      console.log('\nðŸ“ Preview:\n');
      console.log('â”€'.repeat(60));
      const lines = r.code.split('\n');
      console.log(lines.slice(0, 50).join('\n'));
      if (lines.length > 50) {
        console.log('â”€'.repeat(60));
        console.log(`... ${lines.length - 50} more lines ...`);
      }
    }
  } else {
    // Multiple tests
    console.log(`ðŸ“Š Generated ${results.length} test(s):\n`);
    
    results.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.fileName}`);
      if (r.state) {
        console.log(`      State: ${r.state}`);
      }
      if (!options.preview) {
        console.log(`      Path: ${r.filePath}`);
      }
      console.log(`      Size: ${r.code.length} chars`);
      console.log('');
    });
    
    if (!options.preview) {
      console.log(`ðŸ’¡ All ${results.length} test file(s) written to disk`);
    }
  }
  
  console.log('\nâœ… Done!\n');
  
} catch (error) {
  console.error('\nâŒ ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
}