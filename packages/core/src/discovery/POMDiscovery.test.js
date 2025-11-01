// packages/core/tests/POMDiscovery.test.js

import POMDiscovery from '../src/discovery/POMDiscovery.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testPOMDiscovery() {
  console.log('🧪 Testing POM Discovery...\n');
  
  // Use your actual guest project path
  const guestProjectPath = 'C:\\Users\\Studio Radost!\\Projects\\cxm\\PolePosition-TESTING';
  // Or on Linux: '/home/dimitrij/Projects/cxm/Leclerc-Playwright'
  
  const discovery = new POMDiscovery(guestProjectPath);
  
  try {
    // Discover all POMs
    const poms = await discovery.discover();
    
    console.log('\n📊 Discovery Results:');
    console.log('='.repeat(60));
    
    for (const pom of poms) {
      console.log(`\n📄 ${pom.name}`);
      console.log(`   Path: ${pom.path}`);
      console.log(`   Export: ${pom.exports || 'none'}`);
      
      for (const cls of pom.classes) {
        console.log(`\n   📦 Class: ${cls.name}`);
        
        if (cls.constructor) {
          console.log(`      Constructor params: ${cls.constructor.params.join(', ')}`);
        }
        
        if (cls.properties.length > 0) {
          console.log(`      Properties:`);
          for (const prop of cls.properties) {
            if (prop.type === 'instance') {
              console.log(`        • ${prop.name} (${prop.className} instance)`);
            } else {
              console.log(`        • ${prop.name}`);
            }
          }
        }
        
        if (cls.getters.length > 0) {
          console.log(`      Getters:`);
          for (const getter of cls.getters) {
            console.log(`        • ${getter.name}${getter.async ? ' (async)' : ''}`);
          }
        }
        
        if (cls.methods.length > 0) {
          console.log(`      Methods: ${cls.methods.map(m => m.name).join(', ')}`);
        }
      }
    }
    
    // Test specific POM
    console.log('\n\n🔍 Testing searchBar.wrapper:');
    console.log('='.repeat(60));
    
    const instances = discovery.getInstances('searchBar.wrapper');
    console.log('\n   Available instances:', instances.map(i => i.name).join(', '));
    
    const oneWayTicketPaths = discovery.getAvailablePaths('searchBar.wrapper', 'oneWayTicket');
    console.log('\n   oneWayTicket paths:');
    for (const p of oneWayTicketPaths) {
      console.log(`      • ${p}`);
    }
    
    // Validate a path
    const isValid = discovery.validatePath('searchBar.wrapper', 'oneWayTicket.inputDepartureLocation');
    console.log(`\n   ✅ Path "oneWayTicket.inputDepartureLocation" is ${isValid ? 'VALID' : 'INVALID'}`);
    
    console.log('\n\n✅ Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

testPOMDiscovery();