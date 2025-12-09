#!/bin/bash

# Convert UnitTestGenerator.js to ES Module
# Run this in your implications-framework directory

GENERATOR_FILE="packages/core/src/generators/UnitTestGenerator.js"

echo "🔄 Converting UnitTestGenerator.js to ES Module..."
echo ""

# 1. Add ES module imports at the top
echo "📝 Step 1: Adding ES module imports..."

# Create temp file with ES module header
cat > /tmp/header.js << 'EOF'
// packages/core/src/generators/UnitTestGenerator.js
// ES MODULE VERSION

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

EOF

# 2. Get the body (skip first 4 lines which have const path = require...)
tail -n +5 "$GENERATOR_FILE" > /tmp/body.js

# 3. Replace module.exports with export default at the end
sed -i 's/module\.exports = UnitTestGenerator;/export default UnitTestGenerator;/' /tmp/body.js

# 4. Fix the TemplateEngine require to handle both CJS and ESM
sed -i "s/const TemplateEngine = require('.\/TemplateEngine');/const TemplateEngineModule = require('.\/TemplateEngine.js');\n    const TemplateEngine = TemplateEngineModule.default || TemplateEngineModule;/" /tmp/body.js

# 5. Combine
cat /tmp/header.js /tmp/body.js > /tmp/UnitTestGenerator-ES.js

# 6. Backup original
cp "$GENERATOR_FILE" "${GENERATOR_FILE}.backup"
echo "✅ Created backup: ${GENERATOR_FILE}.backup"

# 7. Replace
cp /tmp/UnitTestGenerator-ES.js "$GENERATOR_FILE"
echo "✅ Converted: $GENERATOR_FILE"

echo ""
echo "🎉 Conversion complete!"
echo ""
echo "Changes made:"
echo "  1. ✅ Changed require() to import"
echo "  2. ✅ Added __filename and __dirname for ES modules"
echo "  3. ✅ Added createRequire for loading guest project files"
echo "  4. ✅ Changed module.exports to export default"
echo "  5. ✅ Fixed TemplateEngine loading"
echo ""
echo "Next step: Update your generate.js route to import it normally:"
echo "  import UnitTestGenerator from '../../core/src/generators/UnitTestGenerator.js';"