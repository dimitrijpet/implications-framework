// packages/api-server/src/routes/config.js (NEW FILE)

import express from 'express';
import path from 'path';
import fs from 'fs-extra';

const router = express.Router();

router.get('/platforms/:projectPath(*)', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    const configPath = path.join(projectPath, 'ai-testing.config.js');
    
    console.log('📋 Loading platforms from:', configPath);
    
    const exists = await fs.pathExists(configPath);
    
    if (!exists) {
      return res.json({
        success: true,
        platforms: [],
        platformNames: [],
        message: 'No ai-testing.config.js found'
      });
    }
    
    const configModule = await import(`file://${configPath}?t=${Date.now()}`);
    const config = configModule.default || configModule;
    
    // Extract platform names from screenPaths (excluding 'ignore')
    const screenPaths = config.screenPaths || {};
    const platformNames = Object.keys(screenPaths).filter(key => key !== 'ignore');
    
    // Build platform objects with display names
    const platforms = platformNames.map(name => ({
      name,
      displayName: name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim(),
      paths: screenPaths[name]
    }));
    
    console.log(`✅ Loaded ${platforms.length} platforms:`, platformNames);
    
    res.json({
      success: true,
      platforms,
      platformNames
    });
    
  } catch (error) {
    console.error('❌ Error loading platforms:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      platforms: [],
      platformNames: []
    });
  }
});

/**
 * GET /api/config/test-data-schema
 * Get test data schema from project config
 * Used by UI to show available ctx.data.* variables
 * 
 * Priority:
 * 1. config.testDataSchema (explicit)
 * 2. config.testData?.schema (legacy)
 * 3. Auto-extract from shared.json (testDataPath)
 */
router.get('/test-data-schema/:projectPath(*)', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    const configPath = path.join(projectPath, 'ai-testing.config.js');
    
    console.log('📋 Loading test data schema from:', configPath);
    
    // Check if config exists
    const exists = await fs.pathExists(configPath);
    
    if (!exists) {
      return res.json({
        success: true,
        schema: [],
        source: null,
        message: 'No ai-testing.config.js found'
      });
    }
    
    // Import the config (with cache bust)
    const configModule = await import(`file://${configPath}?t=${Date.now()}`);
    const config = configModule.default || configModule;
    
    // Priority 1 & 2: Check for explicit schema
    const testDataSchema = config.testDataSchema || config.testData?.schema;
    
    if (testDataSchema && Object.keys(testDataSchema).length > 0) {
      // Use explicit schema
      const schemaArray = convertSchemaToArray(testDataSchema);
      console.log(`✅ Loaded ${schemaArray.length} test data fields from config.testDataSchema`);
      
      return res.json({
        success: true,
        schema: schemaArray,
        source: 'config'
      });
    }
    
    // Priority 3: Auto-extract from shared.json
    const testDataPath = config.testDataPath;
    
    if (!testDataPath) {
      console.log('⚠️ No testDataSchema or testDataPath in config');
      return res.json({
        success: true,
        schema: [],
        source: null,
        message: 'No testDataSchema or testDataPath defined in config'
      });
    }
    
    const fullTestDataPath = path.join(projectPath, testDataPath);
    const testDataExists = await fs.pathExists(fullTestDataPath);
    
    if (!testDataExists) {
      console.log(`⚠️ testDataPath not found: ${fullTestDataPath}`);
      return res.json({
        success: true,
        schema: [],
        source: null,
        message: `testDataPath not found: ${testDataPath}`
      });
    }
    
    // Read and parse testData file
    const testDataContent = await fs.readFile(fullTestDataPath, 'utf8');
    const testData = JSON.parse(testDataContent);
    
    // Extract schema from testData structure
    const schemaArray = extractSchemaFromTestData(testData);
    
    console.log(`✅ Auto-extracted ${schemaArray.length} fields from ${testDataPath}`);
    
    res.json({
      success: true,
      schema: schemaArray,
      source: testDataPath,
      autoExtracted: true
    });
    
  } catch (error) {
    console.error('❌ Error loading test data schema:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      schema: []
    });
  }
});

/**
 * Convert explicit schema object to array format
 */
function convertSchemaToArray(testDataSchema) {
  return Object.entries(testDataSchema).map(([key, value]) => {
    if (typeof value === 'string') {
      return {
        name: key,
        path: key,
        type: 'string',
        description: value
      };
    }
    
    return {
      name: key,
      path: key,
      type: value.type || 'unknown',
      description: value.description || key,
      values: value.values || null,
      required: value.required || false
    };
  });
}

/**
 * Extract schema from actual testData JSON
 * Recursively walks the object to build a flat list of paths
 */
function extractSchemaFromTestData(testData, prefix = '', maxDepth = 4) {
  const schema = [];
  
  if (!testData || typeof testData !== 'object' || maxDepth <= 0) {
    return schema;
  }
  
  for (const [key, value] of Object.entries(testData)) {
    // Skip internal/meta fields
    if (key.startsWith('_') || key === 'status' || key === 'statusLabel') {
      // Still include status at root level
      if (prefix === '' && (key === 'status' || key === 'statusLabel')) {
        schema.push({
          name: key,
          path: key,
          type: typeof value,
          value: value,
          source: 'testData'
        });
      }
      continue;
    }
    
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const valueType = Array.isArray(value) ? 'array' : typeof value;
    
    // Add this field
    schema.push({
      name: key,
      path: fullPath,
      type: valueType,
      isNested: prefix !== '',
      parent: prefix || null,
      // Include sample value for primitives (helps UI show context)
      sampleValue: valueType === 'string' || valueType === 'number' || valueType === 'boolean' 
        ? value 
        : undefined,
      source: 'testData'
    });
    
    // Recurse into objects (but not arrays)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedSchema = extractSchemaFromTestData(value, fullPath, maxDepth - 1);
      schema.push(...nestedSchema);
    }
  }
  
  return schema;
}

/**
 * GET /api/config/:projectPath
 * Load config from project
 */
router.get('/:projectPath(*)', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    const configPath = path.join(projectPath, 'ai-testing.config.js');
    
    console.log('📖 Loading config from:', configPath);
    
    // Check if config exists
    const exists = await fs.pathExists(configPath);
    
    if (!exists) {
      console.log('ℹ️  Config file not found, returning default');
      return res.json({
        exists: false,
        config: getDefaultConfig()
      });
    }
    
    // Read the file content
    const content = await fs.readFile(configPath, 'utf-8');
    
    // Import the config
    const configModule = await import(`file://${configPath}?t=${Date.now()}`);
    const config = configModule.default || configModule;
    
    console.log('✅ Config loaded successfully');
    
    res.json({
      exists: true,
      config: config,
      filePath: configPath
    });
    
  } catch (error) {
    console.error('❌ Error loading config:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/config
 * Save config to project
 */
router.post('/', async (req, res) => {
  try {
    const { projectPath, config } = req.body;
    
    if (!projectPath || !config) {
      return res.status(400).json({ 
        error: 'projectPath and config are required' 
      });
    }
    
    const configPath = path.join(projectPath, 'ai-testing.config.js');
    
    console.log('💾 Saving config to:', configPath);
    
    // Create backup if file exists
    const exists = await fs.pathExists(configPath);
    if (exists) {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fs.copy(configPath, backupPath);
      console.log('📦 Backup created:', backupPath);
    }
    
    // Generate config file content
    const configContent = generateConfigFile(config);
    
    // Write to file
    await fs.writeFile(configPath, configContent, 'utf-8');
    
    console.log('✅ Config saved successfully');
    
    res.json({
      success: true,
      filePath: configPath,
      backup: exists
    });
    
  } catch (error) {
    console.error('❌ Error saving config:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Generate config file content from object
 */
function generateConfigFile(config) {
  // Better formatting that preserves structure
  const configStr = JSON.stringify(config, null, 2);
  
  // Only remove quotes from top-level keys, not nested ones
  const lines = configStr.split('\n');
  const formatted = lines.map((line, index) => {
    // Only replace quotes on lines that are direct object properties (2 spaces indent)
    if (line.match(/^  "[^"]+":/)) {
      return line.replace(/^  "([^"]+)":/, '  $1:');
    }
    return line;
  }).join('\n');
  
  return `// Auto-generated by Implications Framework
// Last updated: ${new Date().toISOString()}

module.exports = ${formatted};
`;
}

/**
 * Default configuration
 */
function getDefaultConfig() {
  return {
    projectName: 'My Project',
    projectType: 'generic',
    
    stateRegistry: {
      strategy: 'auto',
      caseSensitive: false,
      statusPrefixes: [
        'Accepted', 'Rejected', 'Pending', 'Standby',
        'Created', 'CheckedIn', 'CheckedOut', 'Completed',
        'Cancelled', 'Missed', 'Invited'
      ],
      pattern: '{Status}BookingImplications',
      mappings: {}
    },
    
    paths: {
      implications: './tests/implications',
      sections: './tests/sections',
      screens: './tests/screens'
    }
  };
}

/**
 * POST /api/config/add-mapping
 * Add a custom mapping to config
 */
router.post('/add-mapping', async (req, res) => {
  try {
    const { projectPath, shortName, fullName } = req.body;
    
    if (!projectPath || !shortName || !fullName) {
      return res.status(400).json({ 
        error: 'projectPath, shortName, and fullName are required' 
      });
    }
    
    const configPath = path.join(projectPath, 'ai-testing.config.js');
    
    console.log(`➕ Adding mapping: "${shortName}" → "${fullName}"`);
    
    // Load current config
    const configModule = await import(`file://${configPath}?t=${Date.now()}`);
    const config = configModule.default || configModule;
    
    // Ensure stateRegistry.mappings exists
    if (!config.stateRegistry) {
      config.stateRegistry = { strategy: 'auto', mappings: {} };
    }
    if (!config.stateRegistry.mappings) {
      config.stateRegistry.mappings = {};
    }
    
    // Add mapping
    config.stateRegistry.mappings[shortName] = fullName;
    
    // Create backup
    const exists = await fs.pathExists(configPath);
    if (exists) {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fs.copy(configPath, backupPath);
      console.log('📦 Backup created:', backupPath);
    }
    
    // Save
    const configContent = generateConfigFile(config);
    await fs.writeFile(configPath, configContent, 'utf-8');
    
    console.log('✅ Mapping added successfully');
    
    res.json({
      success: true,
      mapping: { shortName, fullName }
    });
    
  } catch (error) {
    console.error('❌ Error adding mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/config/add-prefix
 * Add a status prefix to config
 */
router.post('/add-prefix', async (req, res) => {
  try {
    const { projectPath, prefix } = req.body;
    
    if (!projectPath || !prefix) {
      return res.status(400).json({ 
        error: 'projectPath and prefix are required' 
      });
    }
    
    const configPath = path.join(projectPath, 'ai-testing.config.js');
    
    console.log(`➕ Adding prefix: "${prefix}"`);
    
    // Load current config
    const configModule = await import(`file://${configPath}?t=${Date.now()}`);
    const config = configModule.default || configModule;
    
    // Ensure stateRegistry.statusPrefixes exists
    if (!config.stateRegistry) {
      config.stateRegistry = { strategy: 'auto', statusPrefixes: [] };
    }
    if (!config.stateRegistry.statusPrefixes) {
      config.stateRegistry.statusPrefixes = [];
    }
    
    // Add prefix if not already present
    if (!config.stateRegistry.statusPrefixes.includes(prefix)) {
      config.stateRegistry.statusPrefixes.push(prefix);
    } else {
      return res.json({
        success: true,
        message: 'Prefix already exists',
        prefix
      });
    }
    
    // Create backup
    const exists = await fs.pathExists(configPath);
    if (exists) {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fs.copy(configPath, backupPath);
      console.log('📦 Backup created:', backupPath);
    }
    
    // Save
    const configContent = generateConfigFile(config);
    await fs.writeFile(configPath, configContent, 'utf-8');
    
    console.log('✅ Prefix added successfully');
    
    res.json({
      success: true,
      prefix
    });
    
  } catch (error) {
    console.error('❌ Error adding prefix:', error);
    res.status(500).json({ error: error.message });
  }
});



export default router;