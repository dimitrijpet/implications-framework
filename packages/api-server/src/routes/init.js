// packages/api-server/src/routes/init.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

router.post('/check', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    console.log(`\n🔍 Checking initialization for: ${projectPath}`);
    
    const checks = {
      testContext: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestContext.js')),
      expectImplication: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js')),
      testPlanner: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js')),
      implicationsHelper: await fileExists(path.join(projectPath, 'tests/implications/ImplicationsHelper.js')),
      config: await fileExists(path.join(projectPath, 'ai-testing.config.js'))
    };
    
    const initialized = Object.values(checks).every(Boolean);
    const missing = Object.entries(checks).filter(([_, exists]) => !exists).map(([name, _]) => name);
    
    console.log(`   ${initialized ? '✅' : '⚠️'} Initialized: ${initialized}`);
    if (!initialized) console.log(`   Missing: ${missing.join(', ')}`);
    
    res.json({ initialized, checks, missing, structure: 'tests/ai-testing/' });
    
  } catch (error) {
    console.error('Error checking initialization:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/setup', async (req, res) => {
  try {
    const { projectPath, force = false } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    console.log(`\n🚀 Initializing project: ${projectPath}`);
    console.log(`   Force: ${force}`);
    
    if (!force) {
      const existingCheck = await checkIfInitialized(projectPath);
      if (existingCheck.initialized) {
        return res.status(400).json({
          error: 'Project already initialized. Use force=true to overwrite.',
          existing: existingCheck
        });
      }
    }
    
    const result = await initializeProject(projectPath, force);
    
    console.log(`   ✅ Initialization complete!`);
    
    res.json({
      success: true,
      message: 'Project initialized successfully',
      ...result
    });
    
  } catch (error) {
    console.error('Error during initialization:', error);
    res.status(500).json({ error: error.message });
  }
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkIfInitialized(projectPath) {
  const checks = {
    testContext: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestContext.js')),
    expectImplication: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js')),
    testPlanner: await fileExists(path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js')),
    implicationsHelper: await fileExists(path.join(projectPath, 'tests/implications/ImplicationsHelper.js')),
    config: await fileExists(path.join(projectPath, 'ai-testing.config.js'))
  };
  
  return { initialized: Object.values(checks).every(Boolean), checks };
}

async function initializeProject(projectPath, force) {
  const createdFiles = [];
  
  console.log('   📁 Creating directories...');
  const dirsToCreate = [
    'tests/ai-testing',
    'tests/ai-testing/utils',
    'tests/implications'
  ];
  
  for (const dir of dirsToCreate) {
    const dirPath = path.join(projectPath, dir);
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`      ✅ ${dir}/`);
  }
  
  console.log('   📝 Creating utility files...');
  
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/TestContext.js'),
    getTestContextTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/TestContext.js');
  console.log(`      ✅ TestContext.js`);
  
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js'),
    getTestPlannerTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/TestPlanner.js');
  console.log(`      ✅ TestPlanner.js`);
  
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js'),
    getExpectImplicationTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/ExpectImplication.js');
  console.log(`      ✅ ExpectImplication.js`);
  
  await fs.writeFile(
    path.join(projectPath, 'tests/implications/ImplicationsHelper.js'),
    getImplicationsHelperTemplate()
  );
  createdFiles.push('tests/implications/ImplicationsHelper.js');
  console.log(`      ✅ ImplicationsHelper.js`);
  
  console.log('   ⚙️  Creating ai-testing.config.js...');
  await fs.writeFile(
    path.join(projectPath, 'ai-testing.config.js'),
    getConfigTemplate(projectPath)
  );
  createdFiles.push('ai-testing.config.js');
  console.log(`      ✅ ai-testing.config.js`);
  
  console.log('   📖 Creating README.md...');
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/README.md'),
    getReadmeTemplate()
  );
  createdFiles.push('tests/ai-testing/README.md');
  console.log(`      ✅ README.md`);
  
  return { filesCreated: createdFiles, structure: 'tests/ai-testing/' };
}

function getTestContextTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/TestContext.js

class TestContext {
  /**
   * Fields that exist in memory but NEVER persist to JSON
   * These are session-only states that reset when the session ends
   * 
   * Loaded from ai-testing.config.js or uses defaults:
   * - 'logged_in' strips dancer.logged_in, club.logged_in, manager.logged_in
   * - 'app_opened' strips dancer.app_opened, etc.
   */
  static _sessionOnlyFields = null;
  
  /**
   * Get session-only fields from config or defaults
   */
  static getSessionOnlyFields() {
    if (this._sessionOnlyFields) return this._sessionOnlyFields;
    
    const fs = require('fs');
    const path = require('path');
    
    // Try to load from config
    try {
      const configPath = path.join(process.cwd(), 'ai-testing.config.js');
      if (fs.existsSync(configPath)) {
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        if (config.sessionOnlyFields && Array.isArray(config.sessionOnlyFields)) {
          console.log('📋 Loaded sessionOnlyFields from ai-testing.config.js');
          this._sessionOnlyFields = config.sessionOnlyFields;
          return this._sessionOnlyFields;
        }
      }
    } catch (e) {
      // Config not found or invalid, use defaults
    }
    
    // Defaults
    this._sessionOnlyFields = ['logged_in', 'app_opened', 'session_ready'];
    return this._sessionOnlyFields;
  }
  
  /**
   * Strip session-only fields from nested objects
   * e.g., removes dancer.logged_in, club.logged_in, etc.
   */
  _stripSessionFieldsFromObject(obj, parentKey = '') {
    if (!obj || typeof obj !== 'object') return;
    
    const sessionFields = TestContext.getSessionOnlyFields();
    
    for (const key of Object.keys(obj)) {
      // Check if this key is a session-only field
      if (sessionFields.includes(key)) {
        console.log(\`   🔒 Stripped session field: \${parentKey ? parentKey + '.' : ''}\${key}\`);
        delete obj[key];
        continue;
      }
      
      // Recurse into nested objects (but not arrays or special objects)
      const value = obj[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Skip internal fields
        if (key.startsWith('_')) continue;
        
        this._stripSessionFieldsFromObject(value, parentKey ? \`\${parentKey}.\${key}\` : key);
      }
    }
  }
  
  constructor(ImplicationClass, testData, actualFilePath) {
    this.ImplicationClass = ImplicationClass;
    this.data = testData;
    this.changeLog = [];
    this.actualFilePath = actualFilePath;
    
    this.config = {
      device: testData.device || testData._config?.device || 'desktop',
      lang: testData.lang || testData._config?.lang || 'en',
      carrier: testData.carrier || testData._config?.carrier || 'LCC',
      debugMode: testData.debugMode || testData._config?.debugMode || false,
      baseURL: testData._config?.baseURL,
      ...testData._config
    };
    
    this.wrappers = {};
    this.bookingData = {};
    this.flightData = {};
    
    this.runtime = {
      price: null,
      indexStart: 0,
      orderId: null
    };
  }
  
  static getDeltaPath(inputPath) {
    if (inputPath.includes('-master.')) {
      return inputPath.replace('-master.', '-current.');
    }
    if (inputPath.includes('-current.')) {
      return inputPath;
    }
    return inputPath.replace('.json', '-current.json');
  }
  
  static load(ImplicationClass, testDataPath) {
    const fs = require('fs');
    const path = require('path');
    
    let actualPath = testDataPath;
    let isMasterFile = testDataPath.includes('-master.');
    
    if (!isMasterFile) {
      const baseName = path.basename(testDataPath, '.json');
      const dirName = path.dirname(testDataPath);
      const currentPath = path.join(dirName, \`\${baseName}-current.json\`);
      
      if (fs.existsSync(currentPath)) {
        actualPath = currentPath;
        console.log(\`   📂 Loading from delta file: \${path.basename(currentPath)}\`);
      } else {
        console.log(\`   📂 Loading from: \${path.basename(testDataPath)}\`);
      }
    }
    
    const fileContents = fs.readFileSync(actualPath, 'utf8');
    const data = JSON.parse(fileContents);
    
    if (data._changeLog && data._changeLog.length > 0) {
      const original = data._original || {};
      let current = { ...original };
      
      for (const change of data._changeLog) {
        Object.assign(current, change.delta);
      }
      
      Object.assign(data, current);
      console.log(\`   📊 Applied \${data._changeLog.length} changes from history\`);
      console.log(\`   🎯 Current state: \${data.status}\`);
    } else {
      console.log(\`   ✨ Fresh state loaded\`);
    }
    
    TestContext._transformDates(data);
    console.log('   ✅ Date transformation complete');
    
    const meta = ImplicationClass.xstateConfig?.meta || ImplicationClass.meta;
    
    if (meta?.entity) {
      const entity = meta.entity;
      console.log(\`   🔍 Entity-scoped implication: \${entity}\`);
      
      const entityData = data[entity] || {};
      const entityStatus = entityData.status || data[\`\${entity}.status\`] || null;
      
      if (entityStatus) {
        console.log(\`   ✅ Found entity status: \${entity}.status = \${entityStatus}\`);
        data._entityStatus = entityStatus;
        data._entity = entity;
      } else {
        console.log(\`   ⚠️  Entity \${entity} has no status field\`);
      }
    }
    
    return new TestContext(ImplicationClass, data, testDataPath);
  }

  static _transformDates(obj) {
    const moment = require('moment');
    
    function transform(value, key = '', parentKey = '') {
      if (!value) return value;
      
      if (typeof value === 'string' && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/.test(value)) {
        const momentObj = moment(value);
        console.log(\`   🔄 Transformed \${parentKey ? parentKey + '.' : ''}\${key}: moment object\`);
        return momentObj;
      }
      
      if (Array.isArray(value)) {
        return value.map((item, index) => transform(item, index, key));
      }
      
      if (typeof value === 'object' && value !== null) {
        const result = {};
        for (const [k, v] of Object.entries(value)) {
          result[k] = transform(v, k, parentKey ? \`\${parentKey}.\${key}\` : key);
        }
        return result;
      }
      
      return value;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      obj[key] = transform(value, key);
    }
    
    return obj;
  }
  
  save(testDataPath) {
    const fs = require('fs');
    const path = require('path');
    
    let savePath;
    
    if (testDataPath) {
      savePath = TestContext.getDeltaPath(testDataPath);
    } else if (this.inputPath) {
      savePath = TestContext.getDeltaPath(this.inputPath);
    } else {
      savePath = this.actualFilePath;
    }
    
    const originalData = { ...this.data };
    
    for (let i = this.changeLog.length - 1; i >= 0; i--) {
      const change = this.changeLog[i];
      for (const key of Object.keys(change.delta)) {
        delete originalData[key];
      }
    }
    
    const masterPath = this.inputPath || testDataPath;
    if (masterPath && masterPath.includes('-master.') && fs.existsSync(masterPath)) {
      const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      Object.assign(originalData, masterData);
    }
    
    this._stripSessionFieldsFromObject(originalData);
    
    const sessionFields = TestContext.getSessionOnlyFields();
    const cleanedChangeLog = this.changeLog.map(change => {
      const cleanedDelta = { ...change.delta };
      
      for (const key of Object.keys(cleanedDelta)) {
        const fieldName = key.split('.').pop();
        if (sessionFields.includes(fieldName)) {
          delete cleanedDelta[key];
          console.log(\`   🔒 Stripped session field from delta: \${key}\`);
        }
      }
      
      return {
        ...change,
        delta: cleanedDelta
      };
    }).filter(change => Object.keys(change.delta).length > 0);
    
    const output = {
      _original: originalData,
      _changeLog: cleanedChangeLog
    };
    
    fs.writeFileSync(savePath, JSON.stringify(output, null, 2));
    
    const fileName = path.basename(savePath);
    const isMaster = savePath.includes('-master.');
    
    if (isMaster) {
      console.log(\`   ⚠️  WARNING: Saved to master file: \${fileName}\`);
    } else {
      console.log(\`   💾 Saved to delta file: \${fileName}\`);
    }
  }
  
  getBooking(index) {
    if (!this.data.bookings || !this.data.bookings[index]) {
      throw new Error(\`Booking at index \${index} not found\`);
    }
    return this.data.bookings[index];
  }
  
  getBookingsByStatus(status) {
    if (!this.data.bookings) return [];
    return this.data.bookings.filter(b => b.status === status);
  }
  
  getBookingsByIndices(indices) {
    if (!this.data.bookings) return [];
    return indices.map(i => this.getBooking(i));
  }
  
  applyDelta(path, value) {
    if (path.includes('[')) {
      const match = path.match(/^(\\w+)\\[(\\d+)\\]\\.?(.*)$/);
      if (match) {
        const [, arrayName, index, rest] = match;
        if (!this.data[arrayName]) this.data[arrayName] = [];
        if (!this.data[arrayName][index]) this.data[arrayName][index] = {};
        if (rest) {
          this.data[arrayName][index][rest] = value;
        } else {
          this.data[arrayName][index] = { ...this.data[arrayName][index], ...value };
        }
      }
    } else {
      this.data[path] = value;
    }
  }
  
  getFromArray(arrayName, index) {
    if (!this.data[arrayName]) {
      console.warn(\`⚠️  Array '\${arrayName}' does not exist\`);
      return null;
    }
    return this.data[arrayName][index] || null;
  }
  
  setInArray(arrayName, index, value) {
    if (!this.data[arrayName]) {
      this.data[arrayName] = [];
    }
    this.data[arrayName][index] = value;
  }
  
  pushToArray(arrayName, value) {
    if (!this.data[arrayName]) {
      this.data[arrayName] = [];
    }
    this.data[arrayName].push(value);
    return this.data[arrayName].length - 1;
  }
  
  removeFromArray(arrayName, index) {
    if (!this.data[arrayName]) {
      console.warn(\`⚠️  Array '\${arrayName}' does not exist\`);
      return;
    }
    this.data[arrayName].splice(index, 1);
  }

  static getNestedValue(obj, path) {
    if (!path.includes('.')) {
      return obj[path];
    }
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (!current || !current.hasOwnProperty(part)) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }
  
  static setNestedValue(obj, path, value) {
    if (!path.includes('.')) {
      obj[path] = value;
      return;
    }
    
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  async executeAndSave(label, testFile, deltaFn) {
    const { delta } = await deltaFn();
    
    for (const [key, value] of Object.entries(delta)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let obj = this.data;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      } else {
        this.data[key] = value;
      }
    }
    
    this.changeLog.push({
      label,
      testFile,
      delta,
      timestamp: new Date().toISOString()
    });
    
    return this;
  }
}

module.exports = TestContext;
`;
}

function getTestPlannerTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/TestPlanner.js
// Version: 3.0 - SMART REQUIREMENT CHAIN BUILDING
// Features: Entity-scoped, Multiple Paths, Blocking System, Cross-Platform, Multi-entity Dependencies

const fs = require('fs');
const path = require('path');

class TestPlanner {
  
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose ?? true,
      config: options.config || null,
      stateRegistry: options.stateRegistry || null
    };
    
    if (!this.stateRegistry) {
      this.stateRegistry = this.loadStateRegistry();
    }
  }
  
  loadStateRegistry() {
    try {
      const REGISTRY_PATH = path.join(process.cwd(), 'tests/implications/.state-registry.json');
      
      if (fs.existsSync(REGISTRY_PATH)) {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        if (this.options.verbose) {
          console.log(\`📋 Loaded state registry: \${REGISTRY_PATH}\`);
          console.log(\`   Total entries: \${Object.keys(registry).length}\`);
        }
        return registry;
      }
      
      if (this.options.verbose) {
        console.log('⚠️  No state registry found at:', REGISTRY_PATH);
      }
      return {};
      
    } catch (error) {
      if (this.options.verbose) {
        console.log(\`⚠️  Error loading state registry: \${error.message}\`);
      }
      return {};
    }
  }
  
  static _getCurrentStatus(testData, targetImplication = null) {
    const meta = targetImplication?.xstateConfig?.meta || targetImplication?.meta;
    
    if (meta?.entity) {
      const entity = meta.entity;
      const entityStatus = testData[entity]?.status || null;
      
      if (entityStatus) {
        return entityStatus;
      }
    }
    
    return testData.status || testData._currentStatus || 'initial';
  }
  
  analyze(ImplicationClass, testData, options = {}) {
    const xstateConfig = ImplicationClass.xstateConfig || {};
    const meta = xstateConfig.meta || {};
    
    const targetStatus = meta.status;
    const currentStatus = TestPlanner._getCurrentStatus(testData, ImplicationClass);
    
    if (this.options.verbose) {
      console.log(\`\\n🔍 TestPlanner: Analyzing \${targetStatus} state\`);
      console.log(\`   Current: \${currentStatus}\`);
      console.log(\`   Target: \${targetStatus}\`);
    }
    
    const chain = this.buildPrerequisiteChain(ImplicationClass, currentStatus, targetStatus, new Set(), true, testData, options);
    const missingFields = this.findMissingFields(meta, testData);
    
    const entityFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && fieldName.endsWith('.status');
    });

    const regularFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && !fieldName.endsWith('.status');
    });
    
    const ready = this.isReady(chain, currentStatus) && regularFields.length === 0;
    const nextStep = ready ? null : this.findNextStep(chain, currentStatus);
    const stepsRemaining = chain.filter(step => !step.complete).length;
    
    const analysis = {
      ready,
      currentStatus,
      targetStatus,
      missingFields,
      entityFields,
      regularFields,
      chain,
      nextStep,
      stepsRemaining
    };
    
    if (this.options.verbose) {
      console.log(\`   Ready: \${analysis.ready ? '✅' : '❌'}\`);
      if (!analysis.ready) {
        console.log(\`   Missing steps: \${stepsRemaining}\`);
        if (regularFields.length > 0) {
          console.log(\`   Missing fields: \${regularFields.map(f => typeof f === 'string' ? f : f.field).join(', ')}\`);
        }
        if (entityFields.length > 0) {
          console.log(\`   Entity status fields (auto-resolvable): \${entityFields.map(f => typeof f === 'string' ? f : f.field).join(', ')}\`);
        }
      }
    }
    
    return analysis;
  }
  
  buildPrerequisiteChain(ImplicationClass, currentStatus, targetStatus, visited = new Set(), isOriginalTarget = true, testData = null, options = {}) {
    const chain = [];
    
    if (visited.has(targetStatus)) {
      console.warn(\`⚠️  Circular dependency detected for \${targetStatus}\`);
      return chain;
    }
    
    visited.add(targetStatus);
    
    const xstateConfig = ImplicationClass.xstateConfig || {};
    const meta = xstateConfig.meta || {};
    
    const directTransition = this._findDirectTransition(targetStatus, currentStatus);

    if (directTransition && isOriginalTarget) {
      console.log(\`   ✅ Direct transition: \${currentStatus} → \${targetStatus} (\${directTransition.event})\`);
    }
    
    if (meta.requires && isOriginalTarget && testData) {
      for (const [field, requiredValue] of Object.entries(meta.requires)) {
        if (field === 'previousStatus') continue;
        
        if (field.startsWith('!')) continue;
        
        if (field === 'status' && typeof requiredValue === 'string' && this.stateRegistry[requiredValue]) {
          console.log(\`   🔍 Found global status requirement: status must be \${requiredValue}\`);
          
          const globalStatus = testData.status || testData._currentStatus || 'initial';
          
          if (globalStatus !== requiredValue) {
            const globalImplClassName = this.stateRegistry[requiredValue];
            
            if (globalImplClassName && !visited.has(requiredValue)) {
              try {
                const globalImplPath = this.findImplicationFile(globalImplClassName);
                
                if (globalImplPath) {
                  const GlobalImplClass = require(globalImplPath);
                  
                  console.log(\`   ⚙️  Building global chain: \${globalStatus} → \${requiredValue}\`);
                  
                  const globalChain = this.buildPrerequisiteChain(
                    GlobalImplClass,
                    globalStatus,
                    requiredValue,
                    visited,
                    false,
                    testData
                  );
                  
                  chain.push(...globalChain);
                }
              } catch (error) {
                console.log(\`   ⚠️  Could not load \${globalImplClassName}: \${error.message}\`);
              }
            }
          } else {
            console.log(\`   ✅ Global status already at \${requiredValue}\`);
          }
        }
        
        if (field.includes('.') && typeof requiredValue === 'boolean') {
          const [entity, statusField] = field.split('.');
          
          const stateKey = \`\${entity}_\${statusField}\`;
          
          if (this.stateRegistry[stateKey]) {
            const actualValue = testData[entity]?.[statusField];
            
            if (actualValue !== requiredValue) {
              console.log(\`   🔍 Found entity state requirement: \${entity}.\${statusField} must be \${requiredValue}\`);
              
              const entityImplClassName = this.stateRegistry[stateKey];
              
              if (entityImplClassName && !visited.has(stateKey)) {
                try {
                  const entityImplPath = this.findImplicationFile(entityImplClassName);
                  
                  if (entityImplPath) {
                    const EntityImplClass = require(entityImplPath);
                    
                    const entityMeta = EntityImplClass.xstateConfig?.meta || EntityImplClass.meta;
                    const currentEntityStatus = testData[entity]?.status || 'registered';
                    
                    console.log(\`   ⚙️  Building \${entity} chain: \${currentEntityStatus} → \${statusField}\`);

                    const entityChain = this.buildPrerequisiteChain(
                      EntityImplClass,
                      currentEntityStatus,
                      stateKey,
                      visited,
                      false,
                      testData
                    );
                    
                    chain.push(...entityChain);
                  }
                } catch (error) {
                  console.log(\`   ⚠️  Could not load \${entityImplClassName}: \${error.message}\`);
                }
              }
            } else {
              console.log(\`   ✅ Entity state already satisfied: \${entity}.\${statusField} = \${actualValue}\`);
            }
          }
        }
      }
    }
    
    if (meta.requires?.previousStatus) {
      const previousStatus = meta.requires.previousStatus;
      
      if (meta.entity) {
        console.log(\`   ℹ️  Entity prerequisite: \${meta.entity}.status must be \${previousStatus}\`);
      }
      
      const prevImplClassName = this.stateRegistry[previousStatus];
      
      if (prevImplClassName && !visited.has(previousStatus)) {
        try {
          const prevImplPath = this.findImplicationFile(prevImplClassName);
          
          if (prevImplPath) {
            const PrevImplClass = require(prevImplPath);
            
            const selectedTransition = this._selectTransition(
              PrevImplClass,
              targetStatus,
              meta.platform,
              { 
                explicitEvent: options?.explicitEvent,
                preferSamePlatform: true 
              }
            );
            
            const prevChain = this.buildPrerequisiteChain(
              PrevImplClass, 
              currentStatus, 
              previousStatus, 
              visited, 
              false,
              testData,
              { explicitEvent: selectedTransition?.event }
            );
            chain.push(...prevChain);
          }
        } catch (error) {
          console.log(\`   ⚠️  Could not load \${prevImplClassName}: \${error.message}\`);
        }
      }
    }

    const hasDirectTransition = directTransition && isOriginalTarget;

    chain.push({
      status: targetStatus,
      className: ImplicationClass.name,
      actionName: meta.setup?.[0]?.actionName || 'unknown',
      testFile: meta.setup?.[0]?.testFile || 'unknown',
      platform: meta.platform || 'unknown',
      complete: currentStatus === targetStatus,
      isCurrent: currentStatus === targetStatus,
      isTarget: isOriginalTarget,
      entity: meta.entity,
      ...(directTransition && {
        transitionEvent: directTransition.event,
        transitionFrom: currentStatus
      })
    });
    
    const currentIndex = chain.findIndex(step => step.status === currentStatus);
    if (currentIndex !== -1) {
      for (let i = 0; i <= currentIndex; i++) {
        chain[i].complete = true;
      }
    }

    if (meta.entity && testData) {
      const globalStatus = testData.status || testData._currentStatus || 'initial';
      
      console.log(\`   🔍 Entity: \${meta.entity}, Entity status: \${currentStatus}, Global status: \${globalStatus}\`);
      
      chain.forEach((step, index) => {
        if (step.entity) {
          return;
        }
        
        if (step.status === globalStatus) {
          console.log(\`   ✅ Marking \${step.status} as complete (matches global status)\`);
          step.complete = true;
        }
        
        const globalStepIndex = chain.findIndex(s => s.status === globalStatus && !s.entity);
        if (globalStepIndex !== -1 && index < globalStepIndex && !step.entity) {
          console.log(\`   ✅ Marking \${step.status} as complete (before global status)\`);
          step.complete = true;
        }
      });
    }
    
    return chain;
  }

  _findDirectTransition(targetStatus, currentStatus) {
    try {
      const cacheDir = path.join(process.cwd(), '.implications-framework', 'cache');
      const discoveryCache = path.join(cacheDir, 'discovery-result.json');
      
      if (!fs.existsSync(discoveryCache)) {
        return null;
      }
      
      const discovery = JSON.parse(fs.readFileSync(discoveryCache, 'utf-8'));
      
      if (!discovery.transitions) {
        return null;
      }
      
      const transition = discovery.transitions.find(t => {
        const matchesFrom = t.from === currentStatus || 
                           t.from.replace(/_/g, ' ').toLowerCase() === currentStatus.replace(/_/g, ' ').toLowerCase();
        
        const matchesTo = t.to === targetStatus || 
                         t.to.replace(/_/g, ' ').toLowerCase() === targetStatus.replace(/_/g, ' ').toLowerCase();
        
        return matchesFrom && matchesTo;
      });
      
      return transition || null;
      
    } catch (error) {
      return null;
    }
  }

  findImplicationFile(className) {
    const searchPaths = [
      path.join(process.cwd(), 'tests/implications'),
      path.join(process.cwd(), 'tests/ai-testing/implications'),
      path.join(__dirname, '..')
    ];
    
    for (const basePath of searchPaths) {
      const filePath = path.join(basePath, \`\${className}.js\`);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
      
      if (fs.existsSync(basePath)) {
        const files = this.findFilesRecursive(basePath, \`\${className}.js\`);
        if (files.length > 0) {
          return files[0];
        }
      }
    }
    
    return null;
  }

  findFilesRecursive(dir, filename) {
    const results = [];
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          results.push(...this.findFilesRecursive(fullPath, filename));
        } else if (item.name === filename) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // Silently handle
    }
    
    return results;
  }
  
  isReady(chain, currentStatus) {
    const incompleteSteps = chain.filter(step => !step.complete);
    
    if (incompleteSteps.length === 0) {
      return true;
    }
    
    if (incompleteSteps.length === 1 && 
        incompleteSteps[0].isTarget && 
        incompleteSteps[0].transitionEvent) {
      
      const targetStep = incompleteSteps[0];
      
      if (targetStep.transitionFrom) {
        return currentStatus === targetStep.transitionFrom;
      }
      
      return true;
    }
    
    if (incompleteSteps.length === 1 && incompleteSteps[0].isTarget) {
      return true;
    }
    
    return false;
  }
  
  findNextStep(chain, currentStatus) {
    const nextStep = chain.find(step => !step.complete && !step.isTarget);
    
    if (nextStep) {
      return {
        ...nextStep,
        executable: true
      };
    }
    
    return null;
  }
  
  findMissingFields(meta, testData) {
    const missing = [];
    
    if (meta.requires) {
      for (const [field, requiredValue] of Object.entries(meta.requires)) {
        if (field === 'previousStatus') continue;
        
        if (field === 'status' && typeof requiredValue === 'string' && this.stateRegistry[requiredValue]) {
          continue;
        }
        
        const isNegated = field.startsWith('!');
        const cleanField = isNegated ? field.slice(1) : field;
        
        const actualValue = cleanField.includes('.') 
          ? cleanField.split('.').reduce((obj, key) => obj?.[key], testData)
          : testData[cleanField];
        
        if (typeof requiredValue === 'object' && requiredValue.contains) {
          const valueToCheck = this._resolveValue(requiredValue.contains, testData);
          const arrayContains = Array.isArray(actualValue) && actualValue.includes(valueToCheck);
          
          if ((isNegated && arrayContains) || (!isNegated && !arrayContains)) {
            missing.push({
              field: cleanField,
              required: isNegated 
                ? \`NOT contain "\${valueToCheck}"\` 
                : \`contain "\${valueToCheck}"\`,
              actual: actualValue
            });
          }
        }
        else {
          const matches = actualValue === requiredValue;
          
          if ((isNegated && matches) || (!isNegated && !matches)) {
            missing.push({
              field: cleanField,
              required: isNegated ? \`NOT "\${requiredValue}"\` : requiredValue,
              actual: actualValue
            });
          }
        }
      }
    }
    
    if (meta.requiredFields && meta.requiredFields.length > 0) {
      for (const field of meta.requiredFields) {
        if (!testData.hasOwnProperty(field) || testData[field] === null || testData[field] === undefined) {
          missing.push({ field, required: 'defined', actual: 'missing' });
        }
      }
    }
    
    return missing;
  }

  _resolveValue(path, testData) {
    if (path.startsWith('ctx.data.')) {
      path = path.replace('ctx.data.', '');
    }
    return path.split('.').reduce((obj, key) => obj?.[key], testData);
  }
  
  detectCrossPlatform(chain, currentPlatform) {
    const crossPlatformSteps = [];
    
    for (const step of chain) {
      if (step.complete) continue;
      if (step.isTarget) continue;
      
      const stepPlatform = step.platform;
      
      const isMobileCurrent = currentPlatform.includes('mobile') || 
                              currentPlatform === 'dancer' || 
                              currentPlatform === 'clubApp';
      
      const isWebCurrent = currentPlatform === 'web' || 
                           currentPlatform === 'cms' || 
                           currentPlatform === 'playwright';
      
      const isMobileStep = stepPlatform.includes('mobile') || 
                           stepPlatform === 'dancer' || 
                           stepPlatform === 'clubApp';
      
      const isWebStep = stepPlatform === 'web' || 
                        stepPlatform === 'cms' || 
                        stepPlatform === 'playwright';
      
      const isCrossPlatform = 
        (isMobileCurrent && isWebStep) ||
        (isWebCurrent && isMobileStep);
      
      if (isCrossPlatform) {
        crossPlatformSteps.push(step);
      }
    }
    
    return crossPlatformSteps;
  }
  
  printCrossPlatformMessage(chain, currentPlatform) {
    console.error('\\n' + '═'.repeat(60));
    console.error('⚠️  CROSS-PLATFORM PREREQUISITES DETECTED');
    console.error('═'.repeat(60));
    
    console.error('\\n📊 Cannot auto-execute prerequisites across platforms');
    console.error(\`   Current test platform: \${currentPlatform}\`);
    
    console.error('\\n💡 RUN THESE COMMANDS IN ORDER:\\n');
    
    for (const step of chain) {
      if (step.complete) continue;
      
      const platform = step.platform;
      const emoji = step.isTarget ? '🎯' : '📍';
      
      console.error(\`\${emoji} \${step.status} (\${platform})\`);
      
      if (!step.isTarget) {
        if (platform === 'web' || platform === 'cms') {
          console.error(\`   npm run test:web -- \${step.testFile}\`);
        } else if (platform === 'dancer' || platform === 'clubApp') {
          const appType = platform === 'dancer' ? 'dancer' : 'club';
          console.error(\`   npm run test:android:local -- -u \${appType} --spec \${step.testFile}\`);
        }
        console.error('');
      }
    }
    
    console.error('═'.repeat(60) + '\\n');
  }
  
  printNotReadyError(analysis) {
    const { currentStatus, targetStatus, chain, nextStep, missingFields } = analysis;
    
    console.error('\\n' + '═'.repeat(60));
    console.error('❌ TEST NOT READY - PREREQUISITES NOT MET');
    console.error('═'.repeat(60));
    
    console.error(\`\\n📊 Status:\`);
    console.error(\`   Current: \${currentStatus}\`);
    console.error(\`   Target:  \${targetStatus}\`);
    
    if (missingFields.length > 0) {
      console.error(\`\\n❌ Missing Requirements:\`);
      missingFields.forEach(fieldInfo => {
        if (typeof fieldInfo === 'string') {
          console.error(\`   - \${fieldInfo}\`);
        } else {
          console.error(\`   - \${fieldInfo.field}: required=\${fieldInfo.required}, actual=\${fieldInfo.actual}\`);
        }
      });
    }
    
    console.error(\`\\n🗺️  Full Path to Target:\\n\`);
    
    chain.forEach((step, index) => {
      const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
      const label = step.complete ? ' ← You are here' : step.isTarget ? ' ← Target' : '';
      
      console.error(\`   \${icon} \${index + 1}. \${step.status}\${label}\`);
      
      if (!step.complete && !step.isTarget) {
        console.error(\`      Action: \${step.actionName}\`);
        console.error(\`      Test: \${step.testFile}\`);
      }
      
      if (index < chain.length - 1) {
        console.error('      ↓');
      }
    });
    
    if (nextStep) {
      console.error(\`\\n💡 NEXT STEP: \${nextStep.status}\`);
      console.error(\`   Action: \${nextStep.actionName}\`);
      console.error(\`   Test: \${nextStep.testFile}\`);
    }
    
    console.error('═'.repeat(60) + '\\n');
  }

  static platformPrerequisites = null;

  static _getPlatformPrerequisites() {
    if (this.platformPrerequisites) return this.platformPrerequisites;
    
    try {
      const configPath = path.join(process.cwd(), 'ai-testing.config.js');
      if (fs.existsSync(configPath)) {
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        if (config.platformPrerequisites) {
          console.log('📋 Loaded platformPrerequisites from ai-testing.config.js');
          this.platformPrerequisites = config.platformPrerequisites;
          return this.platformPrerequisites;
        }
      }
    } catch (e) {
      // Config not found or invalid, use defaults
    }
    
    this.platformPrerequisites = {
      dancer: {
        check: (data) => data.dancer?.logged_in === true,
        state: 'dancer_logged_in',
        implClass: 'DancerLoggedInImplications',
        file: 'tests/implications/bookings/status/DancerLoggedInViaDancerRegistered-SIGNIN-Dancer-UNIT.spec.js',
        actionName: 'dancerLoggedInViaDancerRegistered'
      },
      clubApp: {
        check: (data) => data.club?.logged_in === true,
        state: 'club_logged_in',
        implClass: 'ClubLoggedInImplications',
        file: 'tests/implications/bookings/status/ClubLoggedInViaClubRegistered-SIGNIN-ClubApp-UNIT.spec.js',
        actionName: 'clubLoggedInViaClubRegistered'
      },
      web: {
        check: (data) => data.manager?.logged_in === true,
        state: 'manager_logged_in',
        implClass: 'LoggedInImplications',
        file: 'tests/implications/login/LoggedInViaInitial-LOGIN-Web-UNIT.spec.js',
        actionName: 'loggedInViaInitial'
      }
    };
    
    return this.platformPrerequisites;
  }

  static async checkOrThrow(ImplicationClass, testData, options = {}) {
    const { page, driver, testDataPath } = options;
    
    const planner = new TestPlanner({ verbose: true });
    
    const meta = ImplicationClass.xstateConfig?.meta || ImplicationClass.meta;
    const targetStatus = meta.status;
    const platform = meta.platform;
    
    const platformPrereqs = this._getPlatformPrerequisites();
    const prereq = platformPrereqs[platform];
    
    if (prereq && !prereq.check(testData)) {
      console.log(\`\\n🔐 Platform prerequisite not met: \${platform} needs \${prereq.state}\`);
      console.log(\`   Running: \${prereq.actionName}\\n\`);
      
      try {
        process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
        process.env.IS_PREREQUISITE_EXECUTION = 'true';
        
        const testPath = path.join(process.cwd(), prereq.file);
        
        if (!fs.existsSync(testPath)) {
          console.warn(\`   ⚠️  Platform prerequisite file not found: \${prereq.file}\`);
          console.warn(\`   ⚠️  Skipping platform init - make sure login runs first!\\n\`);
        } else {
          delete require.cache[require.resolve(testPath)];
          
          const testModule = require(testPath);
          const actionFn = testModule[prereq.actionName];
          
          if (!actionFn) {
            throw new Error(\`Action \${prereq.actionName} not found in \${prereq.file}\`);
          }
          
          const result = await actionFn(testDataPath, { page, driver, testDataPath });
          
          if (result && result.save) {
            result.save(testDataPath);
          }
          
          if (result && result.data) {
            Object.assign(testData, result.data);
          }
          
          console.log(\`✅ Platform prerequisite \${prereq.state} complete!\\n\`);
        }
        
        delete process.env.SKIP_UNIT_TEST_REGISTRATION;
        delete process.env.IS_PREREQUISITE_EXECUTION;
        
      } catch (error) {
        delete process.env.SKIP_UNIT_TEST_REGISTRATION;
        delete process.env.IS_PREREQUISITE_EXECUTION;
        console.error(\`❌ Platform prerequisite failed: \${error.message}\`);
        throw error;
      }
    }
    
    const currentStatus = this._getCurrentStatus(testData, ImplicationClass);

    const testFile = meta.setup?.[0]?.testFile;
    const viaEvent = testFile ? TestPlanner._extractEventFromFilename(testFile) : null;

    console.log(\`\\n🔍 TestPlanner: Analyzing \${targetStatus} state\`);
    console.log(\`   Current: \${currentStatus}\`);
    console.log(\`   Target: \${targetStatus}\`);
    if (viaEvent) {
      console.log(\`   Via Event: \${viaEvent}\`);
    }
    
    const analysis = planner.analyze(ImplicationClass, testData, { explicitEvent: viaEvent });

    if (targetStatus && currentStatus === targetStatus) {
      console.log(\`✅ Already in target state (\${targetStatus}), no action needed\\n\`);
      return { ready: true, skipped: true, currentStatus, targetStatus };
    }

    if (!analysis.ready && analysis.chain.length > 0) {
      const segments = planner._groupChainByPlatform(analysis.chain, testData, ImplicationClass);
      
      console.log(\`\\n📊 Prerequisite Chain (\${segments.length} segment\${segments.length > 1 ? 's' : ''}):\\n\`);
      
      segments.forEach((segment, index) => {
        const status = segment.complete ? '✅' : '❌';
        const label = segment.steps.length === 1 && segment.steps[0].isTarget 
          ? 'CURRENT TEST' 
          : segment.complete ? 'COMPLETE' : 'NOT COMPLETE';
        
        console.log(\`Segment \${index + 1} (\${segment.platform}): \${status} \${label}\`);
        
        segment.steps.forEach(step => {
          const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
          console.log(\`  \${icon} \${step.status}\`);
        });
        console.log('');
      });
      
      const incompleteSegment = segments.find(s => !s.complete);
      
      if (incompleteSegment) {
        const currentPlatform = options.page ? 'web' : meta.platform;
        
        if (incompleteSegment.platform === currentPlatform || 
            (currentPlatform === 'web' && incompleteSegment.platform === 'playwright') ||
            (currentPlatform === 'playwright' && incompleteSegment.platform === 'web')) {
          
          console.log(\`⚡ Auto-executing \${incompleteSegment.platform} segment...\\n\`);
          
          let executedAnySteps = false;
          
          for (const step of incompleteSegment.steps) {
            if (step.isTarget) continue;
            
            let needsExecution = !step.complete;
            
            if (meta.requires) {
              for (const [field, requiredValue] of Object.entries(meta.requires)) {
                if (field.includes('.')) {
                  const actualValue = field.split('.').reduce((obj, key) => obj?.[key], testData);
                  if (actualValue !== requiredValue) {
                    needsExecution = true;
                    break;
                  }
                }
              }
            }
            
            if (!needsExecution) continue;

            let testFile = step.testFile;
            let actionName = step.actionName;

            if (!testFile || testFile === 'unknown') {
              const fullStep = analysis.chain.find(s => s.status === step.status);
              if (fullStep) {
                testFile = fullStep.testFile;
                actionName = fullStep.actionName;
              }
            }

            if (!testFile || testFile === 'unknown') {
              console.error(\`   ⚠️  Cannot execute \${step.status} - test file not found\\n\`);
              continue;
            }

            executedAnySteps = true;
            console.log(\`⚡ Auto-executing prerequisite: \${actionName}\\n\`);

            try {
              process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
              
              const testPath = path.join(process.cwd(), testFile);
              const testModule = require(testPath);
              delete process.env.SKIP_UNIT_TEST_REGISTRATION;
              
              let triggerFn = testModule[actionName];
              
              if (!triggerFn) {
                const camelCaseActionName = step.actionName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                triggerFn = testModule[camelCaseActionName];
                
                if (!triggerFn) {
                  throw new Error(\`Function \${step.actionName} not exported from \${step.testFile}\`);
                }
              }
              
              const TestContext = require('./TestContext');
              const originalPath = options.testDataPath || testData.__testDataPath || 'tests/data/shared.json';
              const deltaPath = TestContext.getDeltaPath(originalPath);
              const pathToUse = fs.existsSync(deltaPath) ? deltaPath : originalPath;
              
              const result = await triggerFn(pathToUse, {
                page: options.page,
                driver: options.driver,
                testDataPath: pathToUse,
                isPrerequisite: true
              });
              
              if (result && result.save) {
                result.save(pathToUse);
              }
              
              const finalDeltaPath = TestContext.getDeltaPath(originalPath);
              const reloadedCtx = TestContext.load(ImplicationClass, finalDeltaPath);
              Object.assign(testData, reloadedCtx.data);
              
              console.log(\`   ✅ Completed: \${step.status}\\n\`);
              
            } catch (error) {
              console.error(\`❌ Failed to execute \${step.actionName}: \${error.message}\\n\`);
              delete process.env.SKIP_UNIT_TEST_REGISTRATION;
              throw error;
            }
          }
          
          if (executedAnySteps) {
            console.log('🔄 Re-checking prerequisites after segment execution...\\n');
            return TestPlanner.checkOrThrow(ImplicationClass, testData, {
              ...options,
              isPrerequisite: options.isPrerequisite
            });
          } else {
            console.log(\`✅ Segment \${incompleteSegment.platform} has no executable steps\\n\`);
            
            const currentSegmentIndex = segments.indexOf(incompleteSegment);
            const nextIncomplete = segments.find((s, idx) => 
              !s.complete && idx > currentSegmentIndex
            );
            
            if (nextIncomplete && nextIncomplete.platform !== currentPlatform) {
              console.log(\`\\n⚠️  Next segment requires \${nextIncomplete.platform} platform\\n\`);
              
              const isPrerequisiteExecution = options?.isPrerequisite === true || process.env.IS_PREREQUISITE_EXECUTION === 'true';
              
              if (isPrerequisiteExecution) {
                console.log('✅ Prerequisite completed - parent test will handle remaining platforms\\n');
                return analysis;
              }
              
              planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
              throw new Error('Prerequisites not met (cross-platform)');
            }
            
            console.log('✅ All same-platform prerequisites satisfied!\\n');
            return analysis;
          }
          
        } else {
          const isPrerequisiteExecution = options?.isPrerequisite === true || process.env.IS_PREREQUISITE_EXECUTION === 'true';
          
          if (isPrerequisiteExecution) {
            console.log(\`\\n✅ Platform \${currentPlatform} prerequisites complete\\n\`);
            console.log(\`   (Remaining \${incompleteSegment.platform} prerequisites will be handled by parent test)\\n\`);
            return analysis;
          }
          
          console.log(\`\\n⚠️  Next segment requires \${incompleteSegment.platform} platform\\n\`);
          planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
          throw new Error('Prerequisites not met (cross-platform)');
        }
      }
    }
    
    if (!analysis.ready && analysis.nextStep && (options.page || options.driver)) {
      const { testFile, actionName } = analysis.nextStep;
      
      console.log(\`\\n⚡ Auto-executing prerequisite: \${actionName}\\n\`);
      
      try {
        process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
        
        const testPath = path.join(process.cwd(), testFile);
        const testModule = require(testPath);
        delete process.env.SKIP_UNIT_TEST_REGISTRATION;
        
        let triggerFn = testModule[actionName];
        
        if (!triggerFn) {
          const camelCaseActionName = actionName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          triggerFn = testModule[camelCaseActionName];
          
          if (!triggerFn) {
            throw new Error(\`Function \${actionName} (or \${camelCaseActionName}) not exported from \${testFile}\`);
          }
          
          console.log(\`   ℹ️  Using \${camelCaseActionName} instead of \${actionName}\`);
        }
        
        const TestContext = require('./TestContext');
        const originalPath = options.testDataPath 
          || testData.__testDataPath 
          || process.env.TEST_DATA_PATH 
          || 'tests/data/shared.json';
        
        const deltaPath = TestContext.getDeltaPath(originalPath);
        const pathToUse = fs.existsSync(deltaPath) ? deltaPath : originalPath;
        
        console.log(\`   📂 Using data from: \${pathToUse}\`);
        
        const result = await triggerFn(pathToUse, {
          page: options.page,
          driver: options.driver,
          testDataPath: pathToUse,
          isPrerequisite: true
        });
        
        if (result && result.save) {
          result.save(pathToUse);
          console.log('   💾 Prerequisite state saved');
        }

        const finalDeltaPath = TestContext.getDeltaPath(originalPath);
        const reloadedCtx = TestContext.load(ImplicationClass, finalDeltaPath);
        Object.assign(testData, reloadedCtx.data);
        
        const newCurrentStatus = this._getCurrentStatus(reloadedCtx.data, ImplicationClass);
        
        if (newCurrentStatus === analysis.nextStep.status) {
          console.log(\`✅ Completed prerequisite: \${analysis.nextStep.status} → \${newCurrentStatus}\\n\`);
        }
        
        const newAnalysis = planner.analyze(ImplicationClass, reloadedCtx.data);
        
        if (!newAnalysis.ready) {
          const newNextStep = newAnalysis.nextStep;
          
          if (newNextStep && newNextStep.status !== analysis.nextStep.status) {
            console.log(\`   ⭐ Moving to next prerequisite: \${newNextStep.actionName}\\n\`);
            return TestPlanner.checkOrThrow(ImplicationClass, reloadedCtx.data, {
              ...options,
              testDataPath: finalDeltaPath,
              isPrerequisite: options.isPrerequisite
            });
          } else {
            console.error(\`\\n⚠️  WARNING: Prerequisite \${analysis.nextStep.status} completed but chain not advancing\`);
            console.error(\`   This likely means global status changed but entity status did not.\\n\`);
            planner.printNotReadyError(newAnalysis);
            throw new Error('Prerequisite chain stuck - completed step but not advancing');
          }
        }
        
        console.log('✅ Prerequisites satisfied!\\n');
        return newAnalysis;
        
      } catch (error) {
        console.error(\`❌ Failed to auto-execute prerequisite: \${error.message}\\n\`);
        delete process.env.SKIP_UNIT_TEST_REGISTRATION;
        planner.printNotReadyError(analysis);
        throw error;
      }
    }
    
    if (!analysis.ready) {
      planner.printNotReadyError(analysis);
      throw new Error('Prerequisites not met');
    }
    
    return analysis;
  }

  _groupChainByPlatform(chain, testData = null, ImplicationClass = null) {
    const segments = [];
    let currentSegment = null;
    
    for (const step of chain) {
      if (!currentSegment || currentSegment.platform !== step.platform) {
        currentSegment = {
          platform: step.platform,
          steps: [],
          complete: true
        };
        segments.push(currentSegment);
      }
      
      currentSegment.steps.push(step);
      
      if (!step.complete) {
        currentSegment.complete = false;
      }
    }
    
    if (ImplicationClass && testData) {
      const meta = ImplicationClass.xstateConfig?.meta || {};
      
      if (meta.requires) {
        for (const segment of segments) {
          if (!segment.complete) continue;
          
          for (const [field, requiredValue] of Object.entries(meta.requires)) {
            if (field === 'previousStatus') continue;
            if (field.startsWith('!')) continue;
            
            if (field.includes('.')) {
              const actualValue = field.split('.').reduce((obj, key) => obj?.[key], testData);
              
              if (actualValue !== requiredValue) {
                const [entity] = field.split('.');
                
                const hasEntitySteps = segment.steps.some(step => 
                  step.status && (step.status.includes(entity) || step.entity === entity)
                );
                
                if (hasEntitySteps) {
                  console.log(\`   ⚠️  Segment \${segment.platform} marked incomplete: \${field} = \${actualValue}, required \${requiredValue}\`);
                  segment.complete = false;
                  break;
                }
              }
            }
          }
        }
      }
    }
    
    return segments;
  }

  static async countdown(seconds, message) {
    const readline = require('readline');
    
    console.log(\`\\n⏱️  \${message} in \${seconds} seconds...\`);
    console.log(\`   Press any key to cancel\\n\`);
    
    return new Promise((resolve) => {
      let timeLeft = seconds;
      let cancelled = false;
      
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      
      const onKeypress = () => {
        cancelled = true;
        cleanup();
        console.log('\\n❌ Cancelled by user\\n');
        resolve(false);
      };
      
      process.stdin.once('keypress', onKeypress);
      
      const interval = setInterval(() => {
        if (cancelled) return;
        
        timeLeft--;
        process.stdout.write(\`\\r⏱️  Starting in \${timeLeft} seconds... (press any key to cancel)\`);
        
        if (timeLeft <= 0) {
          cleanup();
          console.log('\\n\\n🚀 Starting auto-execution...\\n');
          resolve(true);
        }
      }, 1000);
      
      const cleanup = () => {
        clearInterval(interval);
        process.stdin.removeListener('keypress', onKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
      };
    });
  }

  static executeTestInSubprocess(testFile, platform) {
    const { spawnSync } = require('child_process');
    
    let command, args;
    
    if (platform === 'web' || platform === 'playwright') {
      command = 'npm';
      args = ['run', 'test:web', '--', testFile];
    } else if (platform === 'dancer') {
      command = 'npm';
      args = ['run', 'test:android:local', '--', '-u', 'dancer', '--spec', testFile];
    } else if (platform === 'clubApp') {
      command = 'npm';
      args = ['run', 'test:android:local', '--', '-u', 'club', '--spec', testFile];
    } else {
      throw new Error(\`Unknown platform: \${platform}\`);
    }
    
    console.log(\`   ⚡ Running \${path.basename(testFile)}...\`);
    
    const result = spawnSync(command, args, {
      stdio: 'inherit',
      shell: true
    });
    
    if (result.status !== 0) {
      throw new Error(\`Test failed with exit code \${result.status}\`);
    }
    
    console.log(\`   ✅ Completed\\n\`);
  }

  _selectTransition(sourceImplication, targetStatus, currentPlatform, options = {}) {
    const { explicitEvent, preferSamePlatform = true } = options;
    
    const xstateConfig = sourceImplication.xstateConfig || {};
    const transitions = xstateConfig.on || {};
    
    const candidates = [];
    
    for (const [event, config] of Object.entries(transitions)) {
      const target = typeof config === 'string' ? config : config.target;
      
      if (target === targetStatus || target.endsWith(\`_\${targetStatus}\`)) {
        candidates.push({
          event,
          config: typeof config === 'string' ? { target } : config
        });
      }
    }
    
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    
    console.log(\`   🔀 Multiple paths to \${targetStatus}: \${candidates.map(c => c.event).join(', ')}\`);
    
    if (explicitEvent) {
      const match = candidates.find(c => c.event === explicitEvent);
      if (match) {
        console.log(\`   ✅ Using explicit event: \${explicitEvent}\`);
        return match;
      }
    }
    
    const defaultCandidate = candidates.find(c => c.config.isDefault === true);
    if (defaultCandidate) {
      console.log(\`   ✅ Using default transition: \${defaultCandidate.event}\`);
      return defaultCandidate;
    }
    
    if (preferSamePlatform) {
      const samePlatform = candidates.find(c => 
        c.config.platforms?.includes(currentPlatform)
      );
      if (samePlatform) {
        console.log(\`   ✅ Using same-platform transition: \${samePlatform.event}\`);
        return samePlatform;
      }
    }
    
    console.log(\`   ⚠️  Using first available transition: \${candidates[0].event}\`);
    return candidates[0];
  }

  _toPascalCase(str) {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
  
  static _extractEventFromFilename(testFile) {
    if (!testFile) return null;
    
    const basename = path.basename(testFile);
    const parts = basename.split('-');
    
    if (parts.length < 4) return null;
    
    const event = parts[parts.length - 3];
    
    return event.replace(/([A-Z])/g, '_\$1').toUpperCase().slice(1);
  }

  static async preFlightCheck(ImplicationClass, testDataPath) {
    try {
      const TestContext = require('./TestContext');
      const ctx = TestContext.load(ImplicationClass, testDataPath);
      
      const planner = new TestPlanner({ verbose: true });
      const meta = ImplicationClass.xstateConfig?.meta || {};
      const currentPlatform = meta.platform || 'webdriverio';
      const targetStatus = meta.status;
      const currentStatus = this._getCurrentStatus(ctx.data, ImplicationClass);
      
      if (currentStatus === targetStatus) {
        console.log(\`✅ Already in target state (\${targetStatus}), test will skip\\n\`);
        return true;
      }
      
      const analysis = planner.analyze(ImplicationClass, ctx.data);
      
      if (analysis.ready) {
        console.log('✅ Pre-flight check passed!\\n');
        return true;
      }
      
      const segments = planner._groupChainByPlatform(analysis.chain);
      
      console.log(\`\\n📊 Prerequisite Chain (\${segments.length} segment\${segments.length > 1 ? 's' : ''}):\\n\`);
      
      segments.forEach((segment, index) => {
        const status = segment.complete ? '✅' : '❌';
        const label = segment.steps.length === 1 && segment.steps[0].isTarget 
          ? 'CURRENT TEST' 
          : segment.complete ? 'COMPLETE' : 'NOT COMPLETE';
        
        console.log(\`Segment \${index + 1} (\${segment.platform}): \${status} \${label}\`);
        
        segment.steps.forEach(step => {
          const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
          console.log(\`  \${icon} \${step.status}\`);
        });
        console.log('');
      });
      
      const incompleteSegment = segments.find(s => !s.complete);
      
      if (!incompleteSegment) {
        console.log('✅ Pre-flight check passed!\\n');
        return true;
      }
      
      const isDifferentPlatform = 
        incompleteSegment.platform !== currentPlatform &&
        !(currentPlatform === 'dancer' && incompleteSegment.platform === 'webdriverio') &&
        !(currentPlatform === 'clubApp' && incompleteSegment.platform === 'webdriverio') &&
        !(currentPlatform === 'web' && incompleteSegment.platform === 'playwright') &&
        !(currentPlatform === 'playwright' && incompleteSegment.platform === 'web');
      
      if (isDifferentPlatform) {
        console.log('⚡ Cross-platform execution detected!\\n');
        console.log('💡 AUTO-EXECUTION PLAN:\\n');
        
        const stepsToExecute = incompleteSegment.steps.filter(s => !s.complete && !s.isTarget);
        
        if (stepsToExecute.length === 0) {
          console.log(\`   Segment \${incompleteSegment.platform} has no executable steps\`);
          console.log('   Moving to next segment...\\n');
          
          const currentSegmentIndex = segments.indexOf(incompleteSegment);
          const nextSegment = segments.find((s, idx) => !s.complete && idx > currentSegmentIndex);
          
          if (nextSegment && nextSegment.platform !== currentPlatform) {
            console.log(\`⚠️  Next segment requires \${nextSegment.platform} platform\\n\`);
            planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
            console.error('❌ Pre-flight check failed. Manual execution required.\\n');
            process.exit(1);
          }
          
          console.log('✅ Pre-flight check passed!\\n');
          return true;
        }
        
        console.log(\`1. Run \${incompleteSegment.platform} segment (\${stepsToExecute.length} tests):\\n\`);
        stepsToExecute.forEach((step, idx) => {
          const testName = path.basename(step.testFile);
          console.log(\`   \${idx + 1}. \${step.status} - \${testName}\`);
        });
        
        console.log(\`\\n2. Continue with current test (\${currentPlatform})\\n\`);
        
        const shouldProceed = await this.countdown(10, 'Starting auto-execution');
        
        if (!shouldProceed) {
          console.error('❌ Pre-flight check cancelled by user.\\n');
          process.exit(1);
        }
        
        console.log(\`🌐 Executing \${incompleteSegment.platform} segment...\\n\`);
        
        try {
          for (const step of stepsToExecute) {
            process.env.IS_PREREQUISITE_EXECUTION = 'true';
            
            this.executeTestInSubprocess(step.testFile, incompleteSegment.platform);
            
            delete process.env.IS_PREREQUISITE_EXECUTION;
          }
          
          console.log(\`✅ \${incompleteSegment.platform} segment complete!\\n\`);
          
          console.log('⏳ Waiting for files to sync...\\n');
          await new Promise(resolve => setTimeout(resolve, 1000));

          console.log('🔄 Re-checking prerequisites...\\n');

          Object.keys(require.cache).forEach(key => {
            if (key.includes('/tests/data/') || 
                key.includes('shared') ||
                key.includes('TestContext') ||
                key.includes('Implications.js')) {
              delete require.cache[key];
            }
          });

          const deltaPath = path.join(process.cwd(), 'tests/data/shared-current.json');
          const actualPath = fs.existsSync(deltaPath) ? deltaPath : testDataPath;

          console.log(\`   📂 Loading updated state from: \${actualPath}\\n\`);

          const rawData = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
          const mergedData = rawData._original || rawData;

          console.log(\`   🔍 Loaded state - Global: \${mergedData.status}, Booking: \${mergedData.booking?.status}, Dancer logged_in: \${mergedData.dancer?.logged_in}\\n\`);

          if (meta.requires) {
            const unsatisfiedFields = [];
            
            for (const [field, requiredValue] of Object.entries(meta.requires)) {
              if (field === 'previousStatus' || field.startsWith('!')) continue;
              
              if (field.includes('.')) {
                const actualValue = field.split('.').reduce((obj, key) => obj?.[key], mergedData);
                
                if (actualValue !== requiredValue) {
                  unsatisfiedFields.push({ field, requiredValue, actualValue });
                }
              }
            }
            
            if (unsatisfiedFields.length > 0) {
              const testFile = meta.setup?.[0]?.testFile;
              const viaEvent = testFile ? TestPlanner._extractEventFromFilename(testFile) : null;
              
              const planner = new TestPlanner({ verbose: true });
              const updatedAnalysis = planner.analyze(ImplicationClass, mergedData, { 
                explicitEvent: viaEvent 
              });
              
              for (const { field, requiredValue, actualValue } of unsatisfiedFields) {
                console.log(\`⚠️  \${field} still required (expected: \${requiredValue}, actual: \${actualValue})\\n\`);
                
                const testToRun = updatedAnalysis.chain.find(step => {
                  if (step.isTarget) return false;
                  
                  try {
                    const implPath = planner.findImplicationFile(step.className);
                    if (!implPath) return false;
                    
                    const StepImplClass = require(implPath);
                    const stepEntry = StepImplClass.xstateConfig?.entry;
                    if (!stepEntry) return false;
                    
                    const fieldKey = field.split('.').pop();
                    const entityKey = field.split('.')[0];
                    
                    return stepEntry[fieldKey] !== undefined || 
                           stepEntry[field] !== undefined ||
                           (stepEntry[entityKey] && typeof stepEntry[entityKey] === 'object' && stepEntry[entityKey][fieldKey] !== undefined);
                  } catch (error) {
                    return false;
                  }
                });

                if (testToRun) {
                  console.log(\`⚡ Auto-executing: \${path.basename(testToRun.testFile)} \${testToRun.complete ? '(re-running)' : ''}\\n\`);
                  
                  try {
                    process.env.SKIP_UNIT_TEST_REGISTRATION = 'true';
                    process.env.IS_PREREQUISITE_EXECUTION = 'true';
                    
                    const testPath = path.join(process.cwd(), testToRun.testFile);
                    const testModule = require(testPath);
                    
                    delete process.env.SKIP_UNIT_TEST_REGISTRATION;
                    
                    const camelCase = str => str.replace(/_([a-z])/g, g => g[1].toUpperCase());
                    const functionName = testModule[testToRun.actionName] || 
                                         testModule[camelCase(testToRun.actionName)];
                    
                    if (testToRun.platform === 'dancer' || testToRun.platform === 'clubApp' || testToRun.platform === 'manager') {
                      console.log(\`   ⚠️  Appium prerequisite - will execute during main test\\n\`);
                      return true;
                    } else {
                      await functionName(testDataPath, {
                        page: undefined,
                        testDataPath
                      });
                    }
                    
                    delete process.env.IS_PREREQUISITE_EXECUTION;
                    
                    console.log(\`✅ \${testToRun.status} complete!\\n\`);
                  } catch (error) {
                    console.error(\`❌ Failed to run \${testToRun.status}: \${error.message}\\n\`);
                    process.exit(1);
                  }
                } else if (!testToRun) {
                  console.error(\`❌ No test found to satisfy \${field}\\n\`);
                  console.error(\`   Available chain steps:\\n\`);
                  updatedAnalysis.chain.forEach(step => {
                    console.error(\`   - \${step.status} (\${step.platform})\`);
                  });
                  process.exit(1);
                }
              }
              
              console.log('⏳ Waiting for files to sync...\\n');
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              Object.keys(require.cache).forEach(key => {
                if (key.includes('/tests/data/') || key.includes('shared') || key.includes('TestContext')) {
                  delete require.cache[key];
                }
              });
              
              const finalDeltaPath = path.join(process.cwd(), 'tests/data/shared-current.json');
              const finalData = JSON.parse(fs.readFileSync(finalDeltaPath, 'utf8'));
              const finalMerged = finalData._original || finalData;
              
              for (const { field, requiredValue } of unsatisfiedFields) {
                const actualValue = field.split('.').reduce((obj, key) => obj?.[key], finalMerged);
                
                if (actualValue !== requiredValue) {
                  console.error(\`❌ \${field} still not satisfied after test! (expected: \${requiredValue}, actual: \${actualValue})\\n\`);
                  process.exit(1);
                }
              }
              
              console.log('✅ All prerequisites satisfied!\\n');
              return true;
            }
          }

          const mockCtx = { data: mergedData };
          const newAnalysis = planner.analyze(ImplicationClass, mockCtx.data);
          
          if (newAnalysis.ready) {
            console.log('✅ All prerequisites satisfied!');
            console.log('🔄 Please re-run your test now. The prerequisites have been set up.\\n');
            process.exit(0);
          } else {
            console.error('⚠️  Prerequisites still not met after execution\\n');
            planner.printNotReadyError(newAnalysis);
            console.error('❌ Pre-flight check failed.\\n');
            process.exit(1);
          }
          
        } catch (error) {
          console.error(\`\\n❌ Error during auto-execution: \${error.message}\\n\`);
          console.error('❌ Pre-flight check failed.\\n');
          process.exit(1);
        }
      }
      
      if (analysis.nextStep) {
        console.log(\`\\n⚠️  Prerequisites missing - will auto-execute during test\\n\`);
        console.log(\`   Next step: \${analysis.nextStep.actionName} (\${analysis.nextStep.status})\`);
        console.log('✅ Pre-flight check passed (auto-execution enabled)\\n');
        return true;
      }
      
      planner.printNotReadyError(analysis);
      console.error('❌ Pre-flight check failed. No path to target state.\\n');
      process.exit(1);
      
    } catch (error) {
      console.error(\`❌ Pre-flight check error: \${error.message}\\n\`);
      process.exit(1);
    }
  }
}

module.exports = TestPlanner;
`;
}

function getExpectImplicationTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/ExpectImplication.js

const { expect } = require('@playwright/test');

class ExpectImplication {
  // ═══════════════════════════════════════════════════════════
  // STORED VALUES - For cross-step data passing (storeAs)
  // ═══════════════════════════════════════════════════════════
  static _capturedValues = {};
  
  /**
   * Store a value with a key (used by storeAs in actionDetails)
   */
  static storeValue(key, value) {
    this._capturedValues[key] = value;
    const preview = typeof value === 'object' 
      ? JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? '...' : '')
      : value;
    console.log(\`      💾 Stored: \${key} = \${preview}\`);
  }
  
  /**
   * Get a stored value by key
   */
  static getValue(key) {
    return this._capturedValues[key];
  }
  
  /**
   * Clear all captured values (call between tests)
   */
  static clearCapturedValues() {
    this._capturedValues = {};
    console.log('🗑️  Cleared captured values');
  }
  
  /**
   * Get all captured values (for debugging)
   */
  static getCapturedValues() {
    return { ...this._capturedValues };
  }

  // ═══════════════════════════════════════════════════════════
  // Get nested value - checks captured values first, then obj
  // ═══════════════════════════════════════════════════════════
  static getNestedValue(obj, path) {
    if (!path.includes('.')) {
      if (this._capturedValues[path] !== undefined) {
        return this._capturedValues[path];
      }
      return obj?.[path];
    }
    
    const parts = path.split('.');
    const firstPart = parts[0];
    
    // Check if first part is a captured value
    if (this._capturedValues[firstPart] !== undefined) {
      let current = this._capturedValues[firstPart];
      for (let i = 1; i < parts.length; i++) {
        if (current === null || current === undefined) return undefined;
        current = current[parts[i]];
      }
      return current;
    }
    
    // Fall back to obj
    let current = obj;
    for (const part of parts) {
      if (!current || !current.hasOwnProperty(part)) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  // ═══════════════════════════════════════════════════════════
  // Resolve {{variable}} template syntax
  // ═══════════════════════════════════════════════════════════
  static resolveTemplate(value, testData = {}) {
    // Handle non-strings
    if (typeof value !== 'string') {
      if (Array.isArray(value)) {
        return value.map(v => this.resolveTemplate(v, testData));
      }
      if (typeof value === 'object' && value !== null) {
        const resolved = {};
        for (const [k, v] of Object.entries(value)) {
          resolved[k] = this.resolveTemplate(v, testData);
        }
        return resolved;
      }
      return value;
    }
    
    // Check for simple case: entire string is a template
    const fullMatch = value.match(/^\\{\\{([^}]+)\\}\\}$/);
    if (fullMatch) {
      const path = fullMatch[1].trim();
      const result = this.getNestedValue(testData, path);
      if (result !== undefined) {
        console.log(\`      🔄 Resolved {{\${path}}} → \${JSON.stringify(result)}\`);
        return result;
      }
      console.warn(\`      ⚠️  Variable {{\${path}}} not found\`);
      return value;
    }
    
    // Replace all {{...}} in string
    return value.replace(/\\{\\{([^}]+)\\}\\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const result = this.getNestedValue(testData, trimmedPath);
      
      if (result === undefined || result === null) {
        console.warn(\`      ⚠️  Variable {{\${trimmedPath}}} not found\`);
        return match;
      }
      
      console.log(\`      🔄 Resolved {{\${trimmedPath}}} → \${result}\`);
      return String(result);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Parse field selector for array indexing
  // Supports: field, field[0], field[last], field[all], field[any]
  // ═══════════════════════════════════════════════════════════
  static _parseFieldSelector(fieldName) {
    const match = fieldName.match(/^(.+)\\[(\\d+|last|all|any)\\]$/);
    
    if (!match) {
      return { field: fieldName, index: null };
    }
    
    return {
      field: match[1],
      index: match[2] === 'last' ? 'last' 
           : match[2] === 'all' ? 'all'
           : match[2] === 'any' ? 'any'
           : parseInt(match[2], 10)
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Get locator with index support
  // ═══════════════════════════════════════════════════════════
  static async _getLocatorForField(screenObject, fieldName, page, isPlaywright) {
    const { field, index } = this._parseFieldSelector(fieldName);
    
    let baseLocator = screenObject[field];
    
    if (!baseLocator && isPlaywright) {
      baseLocator = page.locator(\`[data-testid="\${field}"]\`);
    }
    
    if (!baseLocator) {
      throw new Error(\`Field "\${field}" not found on screen object\`);
    }
    
    if (index === null) {
      return { locator: baseLocator, mode: 'single', field, index };
    } else if (index === 'last') {
      return { locator: baseLocator.last(), mode: 'single', field, index };
    } else if (index === 'all') {
      return { locator: baseLocator, mode: 'all', field, index };
    } else if (index === 'any') {
      return { locator: baseLocator, mode: 'any', field, index };
    } else {
      return { locator: baseLocator.nth(index), mode: 'single', field, index };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Check visible with array support
  // ═══════════════════════════════════════════════════════════
  static async _checkVisibleWithIndex(screenObject, elementName, page, isPlaywright) {
    const { locator, mode, field, index } = await this._getLocatorForField(
      screenObject, elementName, page, isPlaywright
    );
    
    const indexLabel = index !== null ? \`[\${index}]\` : '';
    
    if (mode === 'single') {
      if (isPlaywright) {
        await expect(locator).toBeVisible({ timeout: 10000 });
      } else {
        await expect(locator).toBeDisplayed();
      }
      console.log(\`      ✓ \${field}\${indexLabel} is visible\`);
      
    } else if (mode === 'all') {
      const elements = await locator.all();
      if (elements.length === 0) {
        throw new Error(\`\${field}[all] - no elements found\`);
      }
      for (let i = 0; i < elements.length; i++) {
        await expect(elements[i]).toBeVisible({ timeout: 10000 });
      }
      console.log(\`      ✓ \${field}[all] - all \${elements.length} elements are visible\`);
      
    } else if (mode === 'any') {
      const count = await locator.count();
      if (count === 0) {
        throw new Error(\`\${field}[any] - no elements found\`);
      }
      await expect(locator.first()).toBeVisible({ timeout: 10000 });
      console.log(\`      ✓ \${field}[any] - at least one of \${count} elements is visible\`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Check hidden with array support
  // ═══════════════════════════════════════════════════════════
  static async _checkHiddenWithIndex(screenObject, elementName, page, isPlaywright) {
    const { locator, mode, field, index } = await this._getLocatorForField(
      screenObject, elementName, page, isPlaywright
    );
    
    const indexLabel = index !== null ? \`[\${index}]\` : '';
    
    if (mode === 'single') {
      if (isPlaywright) {
        const count = await locator.count();
        if (count === 0) {
          console.log(\`      ✓ \${field}\${indexLabel} doesn't exist (counts as hidden)\`);
          return;
        }
        await expect(locator).not.toBeVisible();
      } else {
        const exists = await locator.isExisting();
        if (!exists) {
          console.log(\`      ✓ \${field}\${indexLabel} doesn't exist (counts as hidden)\`);
          return;
        }
        await expect(locator).not.toBeDisplayed();
      }
      console.log(\`      ✓ \${field}\${indexLabel} is hidden\`);
      
    } else if (mode === 'all') {
      const elements = await locator.all();
      if (elements.length === 0) {
        console.log(\`      ✓ \${field}[all] - no elements exist (counts as hidden)\`);
        return;
      }
      for (let i = 0; i < elements.length; i++) {
        await expect(elements[i]).not.toBeVisible();
      }
      console.log(\`      ✓ \${field}[all] - all \${elements.length} elements are hidden\`);
      
    } else if (mode === 'any') {
      const count = await locator.count();
      if (count === 0) {
        console.log(\`      ✓ \${field}[any] - no elements exist (counts as hidden)\`);
        return;
      }
      await expect(locator.first()).not.toBeVisible();
      console.log(\`      ✓ \${field}[any] - at least one element is hidden\`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Boolean function checks - truthy
  // ═══════════════════════════════════════════════════════════
  static async _checkTruthy(screenObject, functionName) {
    if (typeof screenObject[functionName] !== 'function') {
      throw new Error(\`"\${functionName}" is not a function on screen object\`);
    }
    
    const result = await screenObject[functionName]();
    expect(result, \`Expected \${functionName}() to be truthy, got: \${result}\`).toBeTruthy();
    console.log(\`      ✓ \${functionName}() is truthy (returned: \${result})\`);
  }

  // ═══════════════════════════════════════════════════════════
  // Boolean function checks - falsy
  // ═══════════════════════════════════════════════════════════
  static async _checkFalsy(screenObject, functionName) {
    if (typeof screenObject[functionName] !== 'function') {
      throw new Error(\`"\${functionName}" is not a function on screen object\`);
    }
    
    const result = await screenObject[functionName]();
    expect(result, \`Expected \${functionName}() to be falsy, got: \${result}\`).toBeFalsy();
    console.log(\`      ✓ \${functionName}() is falsy (returned: \${result})\`);
  }

  // ═══════════════════════════════════════════════════════════
  // Advanced assertions with template resolution
  // ═══════════════════════════════════════════════════════════
  static async _checkAssertion(screenObject, assertion, testData = {}) {
    const { fn, expect: expectType, value, params = {}, tolerance } = assertion;
    
    if (typeof screenObject[fn] !== 'function') {
      throw new Error(\`"\${fn}" is not a function on screen object\`);
    }
    
    const resolvedParams = this.resolveTemplate(params, testData);
    const paramValues = Object.values(resolvedParams);
    
    const result = paramValues.length > 0 
      ? await screenObject[fn](...paramValues)
      : await screenObject[fn]();
    
    const resolvedValue = this.resolveTemplate(value, testData);
    
    switch (expectType) {
      case 'toBe':
      case 'equals':
      case 'strictEquals':
        expect(result).toBe(resolvedValue);
        console.log(\`      ✓ \${fn}() toBe \${resolvedValue} (got: \${result})\`);
        break;
      case 'toEqual':
        expect(result).toEqual(resolvedValue);
        console.log(\`      ✓ \${fn}() toEqual \${JSON.stringify(resolvedValue)} (got: \${JSON.stringify(result)})\`);
        break;
      case 'toBeGreaterThan':
      case 'greaterThan':
        expect(result).toBeGreaterThan(resolvedValue);
        console.log(\`      ✓ \${fn}() > \${resolvedValue} (got: \${result})\`);
        break;
      case 'toBeGreaterThanOrEqual':
      case 'greaterThanOrEqual':
        expect(result).toBeGreaterThanOrEqual(resolvedValue);
        console.log(\`      ✓ \${fn}() >= \${resolvedValue} (got: \${result})\`);
        break;
      case 'toBeLessThan':
      case 'lessThan':
        expect(result).toBeLessThan(resolvedValue);
        console.log(\`      ✓ \${fn}() < \${resolvedValue} (got: \${result})\`);
        break;
      case 'toBeLessThanOrEqual':
      case 'lessThanOrEqual':
        expect(result).toBeLessThanOrEqual(resolvedValue);
        console.log(\`      ✓ \${fn}() <= \${resolvedValue} (got: \${result})\`);
        break;
      case 'toContain':
      case 'contains':
        expect(result).toContain(resolvedValue);
        console.log(\`      ✓ \${fn}() contains "\${resolvedValue}" (got: \${result})\`);
        break;
      case 'toMatch':
      case 'matches':
        expect(result).toMatch(resolvedValue);
        console.log(\`      ✓ \${fn}() matches \${resolvedValue} (got: \${result})\`);
        break;
      case 'toBeDefined':
        expect(result).toBeDefined();
        console.log(\`      ✓ \${fn}() is defined (got: \${result})\`);
        break;
      case 'toBeUndefined':
        expect(result).toBeUndefined();
        console.log(\`      ✓ \${fn}() is undefined\`);
        break;
      case 'toBeNull':
        expect(result).toBeNull();
        console.log(\`      ✓ \${fn}() is null\`);
        break;
      case 'toBeTruthy':
        expect(result).toBeTruthy();
        console.log(\`      ✓ \${fn}() is truthy (got: \${result})\`);
        break;
      case 'toBeFalsy':
        expect(result).toBeFalsy();
        console.log(\`      ✓ \${fn}() is falsy (got: \${result})\`);
        break;
      case 'toHaveLength':
      case 'hasLength':
        expect(result).toHaveLength(resolvedValue);
        console.log(\`      ✓ \${fn}() has length \${resolvedValue} (got: \${result?.length})\`);
        break;
      case 'notEquals':
        expect(result).not.toBe(resolvedValue);
        console.log(\`      ✓ \${fn}() !== \${resolvedValue} (got: \${result})\`);
        break;
      case 'notContains':
        expect(result).not.toContain(resolvedValue);
        console.log(\`      ✓ \${fn}() not contains "\${resolvedValue}" (got: \${result})\`);
        break;
      case 'startsWith':
        expect(String(result).startsWith(resolvedValue)).toBe(true);
        console.log(\`      ✓ \${fn}() starts with "\${resolvedValue}" (got: \${result})\`);
        break;
      case 'endsWith':
        expect(String(result).endsWith(resolvedValue)).toBe(true);
        console.log(\`      ✓ \${fn}() ends with "\${resolvedValue}" (got: \${result})\`);
        break;
      case 'closeTo':
        const tol = tolerance || 0.01;
        expect(Math.abs(Number(result) - Number(resolvedValue))).toBeLessThanOrEqual(tol);
        console.log(\`      ✓ \${fn}() ≈ \${resolvedValue} (got: \${result}, tolerance: \${tol})\`);
        break;
      default:
        throw new Error(\`Unknown assertion type: \${expectType}\`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Execute functions with storeAs support
  // ═══════════════════════════════════════════════════════════
  static async _executeFunctions(functions, screenObject, testData = {}) {
    if (!functions || Object.keys(functions).length === 0) {
      return;
    }
    
    console.log(\`   ⚡ Executing \${Object.keys(functions).length} function(s)...\`);
    
    for (const [funcName, funcConfig] of Object.entries(functions)) {
      try {
        const { parameters = {}, params = {}, storeAs, signature } = funcConfig;
        
        const funcParams = Object.keys(parameters).length > 0 ? parameters : params;
        
        const fn = screenObject[funcName];
        if (typeof fn !== 'function') {
          console.warn(\`      ⚠️  Function \${funcName} not found on screen, skipping...\`);
          continue;
        }
        
        const resolvedParams = this.resolveTemplate(funcParams, testData);
        const paramValues = Object.values(resolvedParams);
        
        const displayName = signature || funcName;
        const paramsDisplay = paramValues.length > 0 
          ? \`(\${paramValues.map(v => JSON.stringify(v)).join(', ')})\`
          : '()';
        
        console.log(\`      ▶ \${displayName}\${paramsDisplay}\`);
        
        const result = paramValues.length > 0
          ? await fn.call(screenObject, ...paramValues)
          : await fn.call(screenObject);
        
        if (storeAs) {
          this.storeValue(storeAs, result);
        } else {
          console.log(\`      ✅ \${funcName} completed\`);
        }
        
      } catch (error) {
        console.error(\`      ❌ \${funcName} failed: \${error.message}\`);
        throw error;
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // Main validation method
  // ═══════════════════════════════════════════════════════════
  static async validateImplications(screenDef, testData, screenObject) {
    if (!screenDef || screenDef.length === 0) {
      console.log('   ⚠️  No screen definition to validate');
      return;
    }
    
    const def = Array.isArray(screenDef) ? screenDef[0] : screenDef;
    
    console.log(\`\\n   🔍 Validating screen: \${def.name || 'unnamed'}\`);
    console.log('   ' + '─'.repeat(47));
    
    const isPlaywright = screenObject.page !== undefined;
    const page = screenObject.page || screenObject;
    
    const getElement = async (elementName) => {
      if (screenObject[elementName]) {
        return screenObject[elementName];
      }
      if (isPlaywright) {
        return page.locator(\`[data-testid="\${elementName}"]\`);
      }
      return null;
    };
    
    const checkText = async (element, elementName, expectedText) => {
      if (isPlaywright) {
        await expect(element).toHaveText(expectedText, { timeout: 10000 });
      } else {
        await expect(element).toHaveText(expectedText);
      }
      console.log(\`      ✓ \${elementName} has text: "\${expectedText}"\`);
    };
    
    // Prerequisites
    if (def.prerequisites && def.prerequisites.length > 0) {
      console.log(\`   🔧 Running \${def.prerequisites.length} prerequisites...\`);
      for (const prereq of def.prerequisites) {
        console.log(\`      \${prereq.description}\`);
        await prereq.setup(testData, page);
      }
      console.log('   ✅ Prerequisites completed');
    }

    // Execute functions (with storeAs) FIRST
    if (def.functions && Object.keys(def.functions).length > 0) {
      await this._executeFunctions(def.functions, screenObject, testData);
    }
    
    // Visible checks
    if (def.visible && def.visible.length > 0) {
      console.log(\`   ✅ Checking \${def.visible.length} visible elements...\`);
      for (const elementName of def.visible) {
        try {
          await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
        } catch (error) {
          console.error(\`      ✗ \${elementName} NOT visible: \${error.message}\`);
          throw new Error(\`Visibility check failed for \${elementName}\`);
        }
      }
    }
    
    // Hidden checks
    if (def.hidden && def.hidden.length > 0) {
      console.log(\`   ✅ Checking \${def.hidden.length} hidden elements...\`);
      for (const elementName of def.hidden) {
        try {
          await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
        } catch (error) {
          console.error(\`      ✗ \${elementName} NOT hidden: \${error.message}\`);
          throw new Error(\`Hidden check failed for \${elementName}\`);
        }
      }
    }

    // Truthy function checks
    if (def.truthy && def.truthy.length > 0) {
      console.log(\`   ✅ Checking \${def.truthy.length} truthy functions...\`);
      for (const functionName of def.truthy) {
        try {
          await this._checkTruthy(screenObject, functionName);
        } catch (error) {
          console.error(\`      ✗ \${functionName}() NOT truthy: \${error.message}\`);
          throw new Error(\`Truthy check failed for \${functionName}()\`);
        }
      }
    }

    // Falsy function checks
    if (def.falsy && def.falsy.length > 0) {
      console.log(\`   ✅ Checking \${def.falsy.length} falsy functions...\`);
      for (const functionName of def.falsy) {
        try {
          await this._checkFalsy(screenObject, functionName);
        } catch (error) {
          console.error(\`      ✗ \${functionName}() NOT falsy: \${error.message}\`);
          throw new Error(\`Falsy check failed for \${functionName}()\`);
        }
      }
    }

    // Advanced assertions
    if (def.assertions && def.assertions.length > 0) {
      console.log(\`   ✅ Running \${def.assertions.length} assertions...\`);
      for (const assertion of def.assertions) {
        try {
          await this._checkAssertion(screenObject, assertion, testData);
        } catch (error) {
          console.error(\`      ✗ Assertion \${assertion.fn}() \${assertion.expect} failed: \${error.message}\`);
          throw new Error(\`Assertion failed: \${assertion.fn}() \${assertion.expect} \${assertion.value ?? ''}\`);
        }
      }
    }
    
    // Legacy: checks object
    if (def.checks) {
      console.log('   🔍 Running additional checks...');
      
      if (def.checks.visible && def.checks.visible.length > 0) {
        for (const elementName of def.checks.visible) {
          await this._checkVisibleWithIndex(screenObject, elementName, page, isPlaywright);
        }
      }
      
      if (def.checks.hidden && def.checks.hidden.length > 0) {
        for (const elementName of def.checks.hidden) {
          await this._checkHiddenWithIndex(screenObject, elementName, page, isPlaywright);
        }
      }
      
      if (def.checks.text && Object.keys(def.checks.text).length > 0) {
        for (const [elementName, expectedText] of Object.entries(def.checks.text)) {
          const element = await getElement(elementName);
          const finalText = this.resolveTemplate(expectedText, testData);
          await checkText(element, elementName, finalText);
        }
      }
    }
    
    // Custom expect function
    if (def.expect && typeof def.expect === 'function') {
      console.log('   🎯 Running custom expect function...');
      await def.expect(testData, page);
      console.log('   ✅ Custom expect passed');
    }
    
    console.log(\`   ✅ All validations passed for \${def.name || 'screen'}\`);
    console.log('   ' + '─'.repeat(47));
  }
}

module.exports = ExpectImplication;
`;
}

function getImplicationsHelperTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/implications/ImplicationsHelper.js

class ImplicationsHelper {
  
  static mergeWithBase(baseConfig, statusConfig, options = {}) {
    const {
      appendPrerequisites = false,
      parentClass = null
    } = options;
    
    let prerequisites;
    if (statusConfig.prerequisites) {
      if (appendPrerequisites) {
        const basePrereqs = baseConfig.prerequisites || [];
        prerequisites = [...basePrereqs, ...statusConfig.prerequisites];
      } else {
        prerequisites = statusConfig.prerequisites;
      }
    } else {
      prerequisites = baseConfig.prerequisites;
    }
    
    const screen = statusConfig.screen || baseConfig.screen;
    
    const checks = {};
    
    if (statusConfig.text || baseConfig.defaultText) {
      checks.text = {
        ...(baseConfig.defaultText || {}),
        ...(statusConfig.text || {})
      };
    }
    
    const alwaysVisible = baseConfig.alwaysVisible || [];
    const sometimesVisible = baseConfig.sometimesVisible || [];
    const baseVisible = baseConfig.visible || [];
    const baseHidden = baseConfig.hidden || [];
    const statusVisible = statusConfig.visible || [];
    const statusHidden = statusConfig.hidden || [];
    
    let finalVisible = [
      ...alwaysVisible,
      ...sometimesVisible,
      ...baseVisible,
      ...statusVisible
    ];
    
    const finalHidden = [
      ...baseHidden,
      ...statusHidden
    ];
    
    finalVisible = finalVisible.filter(item => !finalHidden.includes(item));
    
    if (finalVisible.length > 0) {
      checks.visible = [...new Set(finalVisible)];
    }
    
    if (finalHidden.length > 0) {
      checks.hidden = [...new Set(finalHidden)];
    }
    
    if (statusConfig.checks) {
      Object.assign(checks, statusConfig.checks);
    }
    
    return {
      screen,
      description: statusConfig.description || baseConfig.description,
      ...(prerequisites && { prerequisites }),
      checks,
      ...(statusConfig.expect && { expect: statusConfig.expect })
    };
  }
}

module.exports = ImplicationsHelper;
`;
}

function getConfigTemplate(projectPath) {
  const projectName = path.basename(projectPath);
  
  return `// Auto-generated by Implications Framework
module.exports = {
  // ═══════════════════════════════════════════════════════════
  // PROJECT INFO
  // ═══════════════════════════════════════════════════════════
  projectName: "${projectName}",
  projectRoot: __dirname,
  
  // ═══════════════════════════════════════════════════════════
  // PATHS
  // ═══════════════════════════════════════════════════════════
  utilsPath: "tests/ai-testing/utils",
  outputPath: "tests/implications",
  testDataPath: "tests/data/shared.json",
  
  // ═══════════════════════════════════════════════════════════
  // TEST RUNNER CONFIGURATION
  // ═══════════════════════════════════════════════════════════
  testRunner: "playwright",  // 'playwright' | 'webdriverio' | 'cypress'
  testDataMode: "stateful",  // 'stateful' | 'stateless'
  
  // ═══════════════════════════════════════════════════════════
  // PLATFORMS
  // ═══════════════════════════════════════════════════════════
  platforms: ["web"],
  
  // ═══════════════════════════════════════════════════════════
  // DISCOVERY PATTERNS (glob patterns relative to projectRoot)
  // ═══════════════════════════════════════════════════════════
  patterns: {
    implications: ["tests/implications/**/*Implications.js"],
    tests: ["tests/**/*.spec.js"]
  },
  
  // ═══════════════════════════════════════════════════════════
  // GENERATION OPTIONS
  // ═══════════════════════════════════════════════════════════
  generation: {
    skipTestRegistration: false,
    autoValidateUI: true,
    extractActions: true
  },

  // ═══════════════════════════════════════════════════════════
  // SESSION & PREREQUISITES - Controls login/auth behavior
  // ═══════════════════════════════════════════════════════════

  /**
   * Session-only fields - NEVER saved to JSON, reset each test run
   * 
   * These fields exist in memory during test execution but are stripped
   * before saving to JSON. This ensures each test session starts fresh.
   * 
   * Examples:
   * - 'logged_in' strips dancer.logged_in, club.logged_in, manager.logged_in
   * - 'app_opened' strips dancer.app_opened, club.app_opened, etc.
   * - 'session_ready' strips any platform's session_ready flag
   */
  sessionOnlyFields: [
    'logged_in',
    'app_opened',
    'session_ready',
  ],

  /**
   * Platform prerequisites - auto-run before any test on that platform
   * 
   * Each platform can define a prerequisite that must be satisfied before
   * running tests. TestPlanner auto-executes these if needed.
   * 
   * Structure:
   * {
   *   check: (data) => boolean,  // Function to check if prerequisite met
   *   state: string,              // State name for this prerequisite
   *   file: string,               // Path to test file that satisfies it
   *   actionName: string          // Function name to call
   * }
   * 
   * Example: Before running any 'web' test, ensure manager is logged in
   */
  platformPrerequisites: {
    web: {
      check: (data) => data.manager?.logged_in === true,
      state: 'manager_logged_in',
      file: 'tests/implications/login/LoggedInViaInitial-LOGIN-Web-UNIT.spec.js',
      actionName: 'loggedInViaInitial'
    }
    // Add more platforms as needed:
    // dancer: { ... },
    // clubApp: { ... },
    // mobile: { ... }
  }
};
`;
}

function getReadmeTemplate() {
  return `# AI Testing Framework

Auto-generated testing utilities for the Implications Framework.

## Files Generated

- \`TestContext.js\` - Test data management with delta files
- \`TestPlanner.js\` - Prerequisite validation with auto-execution  
- \`ExpectImplication.js\` - UI validation engine
- \`ImplicationsHelper.js\` - Base class merging utilities

Generated: ${new Date().toISOString()}
`;
}

export default router;