/**
 * Test script to verify all dependencies are installed correctly
 * Run with: node src/adapters/test-setup.js
 */

import 'dotenv/config';

console.log('🔍 Checking AI Assistant dependencies...\n');

// Track results
const results = {
  playwright: { installed: false, working: false },
  anthropic: { installed: false, configured: false, working: false }
};

// 1. Check Playwright
console.log('1️⃣ Checking Playwright...');
try {
  const { chromium } = await import('playwright');
  results.playwright.installed = true;
  console.log('   ✅ Playwright installed');
  
  // Try to launch browser
  console.log('   🚀 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://example.com');
  const title = await page.title();
  await browser.close();
  
  results.playwright.working = true;
  console.log(`   ✅ Browser works! Got title: "${title}"`);
} catch (e) {
  console.log('   ❌ Playwright error:', e.message);
}

// 2. Check Anthropic SDK
console.log('\n2️⃣ Checking Anthropic SDK...');
try {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  results.anthropic.installed = true;
  console.log('   ✅ Anthropic SDK installed');
  
  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && apiKey.startsWith('sk-ant-')) {
    results.anthropic.configured = true;
    console.log('   ✅ API key configured (sk-ant-...)');
    
    // Test API connection with a tiny request
    console.log('   🔑 Testing API connection...');
    const client = new Anthropic({ apiKey });
    
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }]
    });
    
    results.anthropic.working = true;
    console.log(`   ✅ API works! Response: "${response.content[0].text}"`);
  } else {
    console.log('   ❌ ANTHROPIC_API_KEY not set or invalid in .env');
  }
} catch (e) {
  console.log('   ❌ Anthropic error:', e.message);
}

// 3. Summary
console.log('\n' + '='.repeat(50));
console.log('📋 SUMMARY');
console.log('='.repeat(50));

const playwrightOk = results.playwright.installed && results.playwright.working;
const anthropicOk = results.anthropic.installed && results.anthropic.configured && results.anthropic.working;

console.log(`Playwright:  ${playwrightOk ? '✅ Ready' : '❌ Issues found'}`);
console.log(`Anthropic:   ${anthropicOk ? '✅ Ready' : '❌ Issues found'}`);

if (playwrightOk && anthropicOk) {
  console.log('\n🎉 All systems go! Ready for Phase 2 implementation.');
} else {
  console.log('\n⚠️  Please fix the issues above before continuing.');
}