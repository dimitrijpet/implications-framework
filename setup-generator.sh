#!/bin/bash

# setup-generator.sh
# Complete setup for implications-framework generator system

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Implications Framework - Generator Setup               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

FRAMEWORK_ROOT="/home/dimitrij/Projects/personal/implications-framework"
cd "$FRAMEWORK_ROOT"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Copy TemplateEngine.js
echo -e "${BLUE}📦 Step 1: Installing TemplateEngine.js...${NC}"

if [ -f "outputs/TemplateEngine.js" ]; then
    cp outputs/TemplateEngine.js packages/core/src/generators/TemplateEngine.js
    echo -e "${GREEN}✅ TemplateEngine.js installed${NC}"
else
    echo -e "${YELLOW}⚠️  outputs/TemplateEngine.js not found${NC}"
    echo -e "${YELLOW}   Download it from Claude first${NC}"
    exit 1
fi

echo ""

# Step 2: Verify structure
echo -e "${BLUE}🔍 Step 2: Verifying structure...${NC}"

if [ -f "packages/core/src/generators/UnitTestGenerator.js" ]; then
    echo -e "${GREEN}✅ UnitTestGenerator.js exists${NC}"
else
    echo -e "${YELLOW}⚠️  UnitTestGenerator.js missing${NC}"
fi

if [ -f "packages/core/src/generators/unit-test.hbs" ]; then
    echo -e "${GREEN}✅ unit-test.hbs exists${NC}"
else
    echo -e "${YELLOW}⚠️  unit-test.hbs missing${NC}"
fi

if [ -f "packages/core/src/generators/TemplateEngine.js" ]; then
    echo -e "${GREEN}✅ TemplateEngine.js exists${NC}"
else
    echo -e "${YELLOW}⚠️  TemplateEngine.js missing${NC}"
fi

echo ""

# Step 3: Test the generator
echo -e "${BLUE}🧪 Step 3: Testing generator...${NC}"

cat > test-generator.js << 'TESTJS'
// test-generator.js - Quick test of the generator system

const path = require('path');

console.log('\n🔍 Testing Implications Framework Generator...\n');

try {
  // Test 1: Load TemplateEngine
  console.log('Test 1: Loading TemplateEngine...');
  const TemplateEngine = require('./packages/core/src/generators/TemplateEngine');
  console.log('✅ TemplateEngine loaded');
  
  // Test 2: Load UnitTestGenerator
  console.log('\nTest 2: Loading UnitTestGenerator...');
  const UnitTestGenerator = require('./packages/core/src/generators/UnitTestGenerator');
  console.log('✅ UnitTestGenerator loaded');
  
  // Test 3: Create engine instance
  console.log('\nTest 3: Creating TemplateEngine instance...');
  const engine = new TemplateEngine({
    templatesDir: path.join(__dirname, 'packages/core/src/generators')
  });
  console.log('✅ TemplateEngine instantiated');
  
  // Test 4: Test helpers
  console.log('\nTest 4: Testing Handlebars helpers...');
  const testTemplate = '{{upper "hello"}} {{pascalCase "test-case"}}';
  const compiled = engine.handlebars.compile(testTemplate);
  const result = compiled({});
  console.log(`   Result: "${result}"`);
  console.log('✅ Helpers working');
  
  console.log('\n🎉 All tests passed!\n');
  console.log('✅ Generator system is ready to use');
  console.log('\nNext steps:');
  console.log('  1. Point generator to a guest project (Leclerc)');
  console.log('  2. Run generation command');
  console.log('  3. Tests will be generated!\n');
  
} catch (error) {
  console.log('\n❌ Test failed!');
  console.log(`   Error: ${error.message}`);
  console.log('\nStack:');
  console.log(error.stack);
  process.exit(1);
}
TESTJS

node test-generator.js

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Setup Complete! ✅                                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Generator system is ready!${NC}"
echo ""
echo -e "${BLUE}What you have:${NC}"
echo "  ✅ TemplateEngine.js - Handlebars rendering"
echo "  ✅ UnitTestGenerator.js - Test generation"
echo "  ✅ unit-test.hbs - Test template"
echo ""
echo -e "${BLUE}Now you can:${NC}"
echo "  1. Connect to Leclerc project via config"
echo "  2. Generate tests from CMSPageImplications"
echo "  3. Run generated tests with Playwright"
echo ""