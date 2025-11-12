// packages/api-server/src/routes/init.js
// ✅ UPDATED: 2025-01-12 - All templates now include blocking support

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
  
  // 1. TestContext.js
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/TestContext.js'),
    getTestContextTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/TestContext.js');
  console.log(`      ✅ TestContext.js`);
  
  // 2. TestPlanner.js
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/TestPlanner.js'),
    getTestPlannerTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/TestPlanner.js');
  console.log(`      ✅ TestPlanner.js`);
  
  // 3. ExpectImplication.js
  await fs.writeFile(
    path.join(projectPath, 'tests/ai-testing/utils/ExpectImplication.js'),
    getExpectImplicationTemplate()
  );
  createdFiles.push('tests/ai-testing/utils/ExpectImplication.js');
  console.log(`      ✅ ExpectImplication.js`);
  
  // 4. ImplicationsHelper.js
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

// ═══════════════════════════════════════════════════════════
// ✅ UPDATED TEMPLATE FUNCTIONS (2025-01-12)
// ═══════════════════════════════════════════════════════════

function getTestContextTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/TestContext.js
// Updated: 2025-01-12 - Entity-scoped status resolution + nested path support

class TestContext {
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
    
    // Apply changeLog if present
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
    
    // ✅ NEW: Resolve entity-scoped status
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
    
    const output = {
      _original: originalData,
      _changeLog: this.changeLog
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
    
    // ✅ NEW: Apply delta with nested path support
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
// Updated: 2025-01-12 - Blocking support with array checks

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
        }
        return registry;
      }
      
      if (this.options.verbose) {
        console.log('⚠️  No state registry found');
      }
      return {};
      
    } catch (error) {
      if (this.options.verbose) {
        console.log(\`⚠️  Error loading state registry: \${error.message}\`);
      }
      return {};
    }
  }
  
  analyze(ImplicationClass, testData, options = {}) {
    const xstateConfig = ImplicationClass.xstateConfig || {};
    const meta = xstateConfig.meta || {};
    
    const targetStatus = meta.status;
    const currentStatus = testData.status || 'unknown';
    
    if (this.options.verbose) {
      console.log(\`\\n🔍 TestPlanner: Analyzing \${targetStatus} state\`);
      console.log(\`   Current: \${currentStatus}\`);
      console.log(\`   Target: \${targetStatus}\`);
    }
    
    const chain = this.buildPrerequisiteChain(ImplicationClass, currentStatus, targetStatus);
    const missingFields = this.findMissingFields(meta, testData);
    
    // ✅ NEW: Separate entity fields from regular fields
    const entityFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && fieldName.includes('.status');
    });
    
    const regularFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && !fieldName.includes('.status');
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
          console.log(\`   Entity requirements (auto-resolvable): \${entityFields.map(f => typeof f === 'string' ? f : f.field).join(', ')}\`);
        }
      }
    }
    
    return analysis;
  }
  
  buildPrerequisiteChain(ImplicationClass, currentStatus, targetStatus, visited = new Set()) {
    const chain = [];
    
    if (visited.has(targetStatus)) {
      console.warn(\`⚠️  Circular dependency detected for \${targetStatus}\`);
      return chain;
    }
    
    visited.add(targetStatus);
    
    const xstateConfig = ImplicationClass.xstateConfig || {};
    const meta = xstateConfig.meta || {};
    
    if (meta.requires?.previousStatus) {
      const previousStatus = meta.requires.previousStatus;
      const prevImplClassName = this.stateRegistry[previousStatus];
      
      if (prevImplClassName && !visited.has(previousStatus)) {
        try {
          const prevImplPath = this.findImplicationFile(prevImplClassName);
          if (prevImplPath) {
            const PrevImplClass = require(prevImplPath);
            const prevChain = this.buildPrerequisiteChain(PrevImplClass, currentStatus, previousStatus, visited);
            chain.push(...prevChain);
          }
        } catch (error) {
          console.log(\`   ⚠️  Could not load \${prevImplClassName}: \${error.message}\`);
        }
      }
    }
    
    chain.push({
      status: targetStatus,
      className: ImplicationClass.name,
      actionName: meta.setup?.[0]?.actionName || 'unknown',
      testFile: meta.setup?.[0]?.testFile || 'unknown',
      platform: meta.platform || 'unknown',
      complete: currentStatus === targetStatus,
      isCurrent: currentStatus === targetStatus,
      isTarget: true
    });
    
    return chain;
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
      // Skip directories we can't read
    }
    
    return results;
  }
  
  isReady(chain, currentStatus) {
    const incompleteSteps = chain.filter(step => !step.complete);
    
    if (incompleteSteps.length === 0) {
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
    
    // ✅ NEW: Check meta.requires (blocking support)
    if (meta.requires) {
      for (const [field, requiredValue] of Object.entries(meta.requires)) {
        if (field === 'previousStatus') continue;
        
        // Handle negation
        const isNegated = field.startsWith('!');
        const cleanField = isNegated ? field.slice(1) : field;
        
        // Get actual value (nested path support)
        const actualValue = cleanField.includes('.') 
          ? cleanField.split('.').reduce((obj, key) => obj?.[key], testData)
          : testData[cleanField];
        
        // Array containment check
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
        // Simple equality check
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
  
  static async checkOrThrow(ImplicationClass, testData, options = {}) {
    const planner = new TestPlanner({ 
      verbose: options.verbose ?? true,
      config: options.config
    });
    
    const analysis = planner.analyze(ImplicationClass, testData, options);
    
    const targetStatus = ImplicationClass.xstateConfig?.meta?.status;
    const currentStatus = testData.status;
    
    if (targetStatus && currentStatus === targetStatus) {
      console.log(\`✅ Already in target state (\${targetStatus}), no action needed\\n\`);
      return { ready: true, skipped: true, currentStatus, targetStatus };
    }
    
    if (!analysis.ready && analysis.nextStep && options.page) {
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
        
        const testDataPath = options.testDataPath 
          || testData.__testDataPath 
          || process.env.TEST_DATA_PATH 
          || 'tests/data/shared.json';
        
        const result = await triggerFn(testDataPath, {
          page: options.page,
          testDataPath
        });
        
        if (result && result.save) {
          result.save(testDataPath);
          console.log('   💾 Prerequisite state saved');
        }

        const TestContext = require('./TestContext');
        const deltaPath = TestContext.getDeltaPath(testDataPath);
        const reloadedCtx = TestContext.load(ImplicationClass, deltaPath);
        Object.assign(testData, reloadedCtx.data);
        
        const newAnalysis = planner.analyze(ImplicationClass, reloadedCtx.data);
        
        if (!newAnalysis.ready) {
          return TestPlanner.checkOrThrow(ImplicationClass, reloadedCtx.data, options);
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
}

module.exports = TestPlanner;
`;
}

function getExpectImplicationTemplate() {
  return `// Auto-generated by Implications Framework
// Location: tests/ai-testing/utils/ExpectImplication.js
// Updated: 2025-01-12 - Platform detection + nested value support

const { expect } = require('@playwright/test');

class ExpectImplication {
  
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
  
  static async validateImplications(screenDef, testData, screenObject) {
    if (!screenDef || screenDef.length === 0) {
      console.log('   ⚠️  No screen definition to validate');
      return;
    }
    
    const def = Array.isArray(screenDef) ? screenDef[0] : screenDef;
    
    console.log(\`   🔍 Validating screen: \${def.name || 'unnamed'}\`);
    
    const isPlaywright = screenObject.page !== undefined;
    const isWebdriverIO = !isPlaywright;
    
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
    
    const checkVisible = async (element, elementName) => {
      if (isPlaywright) {
        await expect(element).toBeVisible({ timeout: 10000 });
      } else {
        await expect(element).toBeDisplayed();
      }
      console.log(\`      ✓ \${elementName} is visible\`);
    };
    
    const checkHidden = async (element, elementName) => {
      if (isPlaywright) {
        const count = await element.count();
        if (count === 0) {
          console.log(\`      ✓ \${elementName} doesn't exist (counts as hidden)\`);
          return;
        }
        await expect(element).not.toBeVisible();
      } else {
        const exists = await element.isExisting();
        if (!exists) {
          console.log(\`      ✓ \${elementName} doesn't exist (counts as hidden)\`);
          return;
        }
        await expect(element).not.toBeDisplayed();
      }
      console.log(\`      ✓ \${elementName} is hidden\`);
    };
    
    const checkText = async (element, elementName, expectedText) => {
      if (isPlaywright) {
        await expect(element).toHaveText(expectedText, { timeout: 10000 });
      } else {
        await expect(element).toHaveText(expectedText);
      }
      console.log(\`      ✓ \${elementName} has text: "\${expectedText}"\`);
    };
    
    if (def.prerequisites && def.prerequisites.length > 0) {
      console.log(\`   🔧 Running \${def.prerequisites.length} prerequisites...\`);
      for (const prereq of def.prerequisites) {
        console.log(\`      \${prereq.description}\`);
        await prereq.setup(testData, page);
      }
      console.log('   ✅ Prerequisites completed');
    }
    
    if (def.visible && def.visible.length > 0) {
      console.log(\`   ✅ Checking \${def.visible.length} visible elements...\`);
      for (const elementName of def.visible) {
        try {
          const element = await getElement(elementName);
          await checkVisible(element, elementName);
        } catch (error) {
          console.error(\`      ✗ \${elementName} NOT visible: \${error.message}\`);
          throw new Error(\`Visibility check failed for \${elementName}\`);
        }
      }
    }
    
    if (def.hidden && def.hidden.length > 0) {
      console.log(\`   ✅ Checking \${def.hidden.length} hidden elements...\`);
      for (const elementName of def.hidden) {
        try {
          const element = await getElement(elementName);
          await checkHidden(element, elementName);
        } catch (error) {
          console.error(\`      ✗ \${elementName} NOT hidden: \${error.message}\`);
          throw new Error(\`Hidden check failed for \${elementName}\`);
        }
      }
    }
    
    if (def.checks) {
      console.log('   🔍 Running additional checks...');
      
      if (def.checks.visible && def.checks.visible.length > 0) {
        console.log(\`   ✅ Checking \${def.checks.visible.length} additional visible elements...\`);
        for (const elementName of def.checks.visible) {
          try {
            const element = await getElement(elementName);
            await checkVisible(element, elementName);
          } catch (error) {
            console.error(\`      ✗ \${elementName} NOT visible: \${error.message}\`);
            throw new Error(\`Checks.visible failed for \${elementName}\`);
          }
        }
      }
      
      if (def.checks.hidden && def.checks.hidden.length > 0) {
        console.log(\`   ✅ Checking \${def.checks.hidden.length} additional hidden elements...\`);
        for (const elementName of def.checks.hidden) {
          try {
            const element = await getElement(elementName);
            await checkHidden(element, elementName);
          } catch (error) {
            console.error(\`      ✗ \${elementName} NOT hidden: \${error.message}\`);
            throw new Error(\`Checks.hidden failed for \${elementName}\`);
          }
        }
      }
      
      if (def.checks.text && Object.keys(def.checks.text).length > 0) {
        console.log(\`   ✅ Checking \${Object.keys(def.checks.text).length} text checks...\`);
        for (const [elementName, expectedText] of Object.entries(def.checks.text)) {
          try {
            const element = await getElement(elementName);
            
            let finalText = expectedText;
            if (typeof expectedText === 'string' && expectedText.includes('{{')) {
              const variableMatch = expectedText.match(/\\{\\{([\\w.]+)\\}\\}/);
              if (variableMatch && testData) {
                const path = variableMatch[1];
                const value = this.getNestedValue(testData, path);
                
                if (value !== undefined) {
                  finalText = expectedText.replace(/\\{\\{([\\w.]+)\\}\\}/, value);
                  console.log(\`      📝 Substituted {{\${path}}} -> \${value}\`);
                } else {
                  console.warn(\`      ⚠️  Variable {{\${path}}} not found in testData\`);
                }
              }
            }
            
            await checkText(element, elementName, finalText);
          } catch (error) {
            console.error(\`      ✗ \${elementName} text check failed: \${error.message}\`);
            throw new Error(\`Text check failed for \${elementName}\`);
          }
        }
      }
    }
    
    if (def.expect && typeof def.expect === 'function') {
      console.log('   🎯 Running custom expect function...');
      await def.expect(testData, page);
      console.log('   ✅ Custom expect passed');
    }
    
    console.log(\`   ✅ All validations passed for \${def.name || 'screen'}\`);
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
  projectName: "${projectName}",
  projectRoot: __dirname,
  utilsPath: "tests/ai-testing/utils",
  outputPath: "tests/implications",
  testRunner: "playwright",
  platforms: ["web"],
  testDataMode: "stateful",
  testDataPath: "tests/data/shared.json",
  patterns: {
    implications: ["tests/implications/**/*Implications.js"],
    tests: ["tests/**/*.spec.js"]
  },
  generation: {
    skipTestRegistration: false,
    autoValidateUI: true,
    extractActions: true
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