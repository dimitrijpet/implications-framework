#!/usr/bin/env node
// diagnose-ui-coverage.js
// Run: node diagnose-ui-coverage.js /path/to/AcceptedBookingImplications.js

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node diagnose-ui-coverage.js <implication-file-path>');
  process.exit(1);
}

console.log('🔍 Diagnosing UI Coverage Structure\n');
console.log(`File: ${filePath}\n`);

// Load the file
const ImplicationClass = require(path.resolve(filePath));

console.log('📋 Raw mirrorsOn.UI structure:');
console.log(JSON.stringify(ImplicationClass.mirrorsOn.UI, null, 2));

console.log('\n' + '='.repeat(60) + '\n');

// Check each platform
Object.entries(ImplicationClass.mirrorsOn.UI).forEach(([platform, screens]) => {
  console.log(`\n📱 Platform: ${platform}`);
  console.log(`   Screens: ${Object.keys(screens).length}`);
  
  Object.entries(screens).forEach(([screenName, screenArray]) => {
    console.log(`\n   📄 Screen: ${screenName}`);
    console.log(`      Array length: ${screenArray.length}`);
    
    screenArray.forEach((screenObj, idx) => {
      console.log(`\n      [${idx}]:`);
      console.log(`         visible: ${screenObj.visible ? screenObj.visible.length + ' items' : 'MISSING ❌'}`);
      console.log(`         hidden: ${screenObj.hidden ? screenObj.hidden.length + ' items' : 'MISSING ❌'}`);
      console.log(`         checks: ${screenObj.checks ? Object.keys(screenObj.checks).length + ' checks' : 'MISSING ❌'}`);
      console.log(`         description: ${screenObj.description || 'N/A'}`);
      
      if (screenObj.visible) {
        console.log(`         visible items: ${screenObj.visible.join(', ')}`);
      }
      if (screenObj.hidden) {
        console.log(`         hidden items: ${screenObj.hidden.join(', ')}`);
      }
      if (screenObj.checks) {
        console.log(`         checks: ${JSON.stringify(screenObj.checks, null, 2)}`);
      }
    });
  });
});

console.log('\n' + '='.repeat(60));
console.log('\n✅ Diagnosis complete!\n');
console.log('What you should see:');
console.log('- visible, hidden, checks should be present in screen objects');
console.log('- If MISSING, the discovery service is not extracting them');
console.log('- Check discoveryService.js extractUIImplications() function');