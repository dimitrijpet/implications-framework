#!/usr/bin/env node

/**
 * Quick Diagnostic - Show actual implication object structure
 */

const http = require('http');
const path = require('path');

const projectPath = process.argv[2] || '/home/dimitrij/Projects/cxm/Leclerc-Phase-2-Playwright/';

console.log('\n🔍 QUICK DIAGNOSTIC: Implication Object Structure\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/discovery/scan',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (result.files?.implications?.length > 0) {
        const impl = result.files.implications[0];
        
        console.log('📦 Implication Object Structure:\n');
        console.log('Top-level properties:');
        Object.keys(impl).forEach(key => {
          const val = impl[key];
          const type = Array.isArray(val) ? 'array' : typeof val;
          console.log(`  - ${key}: ${type}`);
        });
        
        console.log('\n📊 Metadata properties:');
        if (impl.metadata) {
          Object.keys(impl.metadata).forEach(key => {
            const val = impl.metadata[key];
            const type = Array.isArray(val) ? 'array' : typeof val;
            console.log(`  - metadata.${key}: ${type}`);
          });
        }
        
        console.log('\n🗂️ File Path Info:');
        console.log(`  - impl.path: "${impl.path}"`);
        console.log(`  - impl.files: ${impl.files ? JSON.stringify(impl.files) : 'undefined'}`);
        console.log(`  - Absolute path would be: "${path.join(projectPath, impl.path)}"`);
        
        console.log('\n🎯 For Test Script:');
        console.log(`  Use: implication.files?.implication || path.join(projectPath, implication.path)`);
        
        console.log('\n🔍 Multi-State Detection:');
        console.log(`  - metadata.isMultiState: ${impl.metadata?.isMultiState}`);
        console.log(`  - metadata.xstateInitial: "${impl.metadata?.xstateInitial}"`);
        console.log(`  - metadata.xstateStates: ${impl.metadata?.xstateStates ? 'exists' : 'undefined'}`);
        
        if (impl.className === 'CMSPageImplications') {
          console.log('\n✅ This IS a multi-state machine!');
          console.log('   It should have: initial="empty" + states={empty,filling,draft,...}');
          
          if (!impl.metadata?.isMultiState && !impl.metadata?.xstateStates) {
            console.log('\n❌ PROBLEM: Multi-state not detected!');
            console.log('   Parser needs to extract "initial" and "states" from xstateConfig');
          }
        }
        
        console.log('\n');
        
      } else {
        console.log('❌ No implications found\n');
      }
    } catch (e) {
      console.error('❌ Error:', e.message);
    }
  });
});

req.on('error', (e) => console.error('❌ Request failed:', e.message));
req.write(JSON.stringify({ projectPath }));
req.end();