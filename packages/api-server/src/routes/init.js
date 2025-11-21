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
  
  // ✅ FIX: Call static method correctly + add console log
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

// ✅ Helper method to transform ISO date strings to moment objects
static _transformDates(obj) {
  const moment = require('moment');
  
  // Recursively walk the object and transform ISO date strings to moment
  function transform(value, key = '', parentKey = '') {
    if (!value) return value;
    
    // Check if it's a date string (ISO 8601 format)
    if (typeof value === 'string' && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/.test(value)) {
      const momentObj = moment(value);
      console.log(\`   🔄 Transformed \${parentKey ? parentKey + '.' : ''}\${key}: moment object\`);
      return momentObj;
    }
    
    // Recursively process arrays
    if (Array.isArray(value)) {
      return value.map((item, index) => transform(item, index, key));
    }
    
    // Recursively process objects
    if (typeof value === 'object' && value !== null) {
      const result = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = transform(v, k, parentKey ? \`\${parentKey}.\${key}\` : key);
      }
      return result;
    }
    
    return value;
  }
  
  // Transform in-place
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
// Version: 2.0 - Complete with ALL features
// Features: Entity-scoped, Multiple Paths, Blocking System, Cross-Platform

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
  
  // ✅ HYBRID: Supports both entity-scoped AND global status
  static _getCurrentStatus(testData, targetImplication = null) {
    const meta = targetImplication?.xstateConfig?.meta || targetImplication?.meta;
    
    // TRY entity-scoped first (for entity-scoped implications)
    if (meta?.entity) {
      const entity = meta.entity;
      const entityStatus = testData[entity]?.status || null;
      
      if (entityStatus) {
        return entityStatus;
      }
    }
    
    // FALLBACK to global status (for regular implications)
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
    
    const chain = this.buildPrerequisiteChain(ImplicationClass, currentStatus, targetStatus, new Set(), true, testData);
    const missingFields = this.findMissingFields(meta, testData);
    
    const entityFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && fieldName.includes('.');
    });

    const regularFields = missingFields.filter(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      return fieldName && !fieldName.includes('.');
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
          console.log(\`   Entity fields (will validate): \${entityFields.map(f => typeof f === 'string' ? f : f.field).join(', ')}\`);
        }
      }
    }
    
    return analysis;
  }
  
  // ✅ FIXED: Builds chain for BOTH entity and global implications
  buildPrerequisiteChain(ImplicationClass, currentStatus, targetStatus, visited = new Set(), isOriginalTarget = true, testData = null) {
    const chain = [];
    
    if (visited.has(targetStatus)) {
      console.warn(\`⚠️  Circular dependency detected for \${targetStatus}\`);
      return chain;
    }
    
    visited.add(targetStatus);
    
    const xstateConfig = ImplicationClass.xstateConfig || {};
    const meta = xstateConfig.meta || {};
    
    // Check for direct transition
    const directTransition = this._findDirectTransition(targetStatus, currentStatus);
    
    if (directTransition && isOriginalTarget) {
      console.log(\`   ✅ Direct transition: \${currentStatus} → \${targetStatus} (\${directTransition.event})\`);
      
      chain.push({
        status: targetStatus,
        className: ImplicationClass.name,
        actionName: meta.setup?.[0]?.actionName || 'unknown',
        testFile: meta.setup?.[0]?.testFile || 'unknown',
        platform: meta.platform || 'unknown',
        complete: false,
        isCurrent: false,
        isTarget: true,
        transitionEvent: directTransition.event,
        transitionFrom: currentStatus
      });
      
      return chain;
    }
    
    // ✅ Build prerequisite chain (works for BOTH entity and global)
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
            // ✅ RECURSIVE: Build chain for prerequisite
            const prevChain = this.buildPrerequisiteChain(
              PrevImplClass, 
              currentStatus, 
              previousStatus, 
              visited, 
              false,  // Not the original target
              testData  // ✅ Pass testData through
            );
            chain.push(...prevChain);
          }
        } catch (error) {
          console.log(\`   ⚠️  Could not load \${prevImplClassName}: \${error.message}\`);
        }
      }
    }
    
    // Add current state to chain
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
    
    // Mark all steps up to current as complete
    const currentIndex = chain.findIndex(step => step.status === currentStatus);
    if (currentIndex !== -1) {
      for (let i = 0; i <= currentIndex; i++) {
        chain[i].complete = true;
      }
    }

    // ✅ For entity-scoped implications, also mark global prerequisites as complete
    if (meta.entity && testData) {
      const globalStatus = testData.status || testData._currentStatus || 'initial';
      
      console.log(\`   🔍 DEBUG: Entity status = \${currentStatus}, Global status = \${globalStatus}\`);
      
      // Mark all global (non-entity) steps that match or precede global status as complete
      chain.forEach((step, index) => {
        // Skip entity-specific steps
        if (step.entity) {
          return;
        }
        
        // If this is a global prerequisite step and global status has passed it, mark complete
        if (step.status === globalStatus) {
          console.log(\`   ✅ Marking \${step.status} as complete (matches global status)\`);
          step.complete = true;
        }
        
        // Also mark any step BEFORE global status as complete
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
  
  // ✅ BLOCKING SYSTEM: Supports negated checks and array contains
  findMissingFields(meta, testData) {
    const missing = [];
    
    if (meta.requires) {
      for (const [field, requiredValue] of Object.entries(meta.requires)) {
        if (field === 'previousStatus') continue;
        
        const isNegated = field.startsWith('!');
        const cleanField = isNegated ? field.slice(1) : field;
        
        const actualValue = cleanField.includes('.') 
          ? cleanField.split('.').reduce((obj, key) => obj?.[key], testData)
          : testData[cleanField];
        
        // ✅ Array contains check (for blocking system)
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
  
  // ✅ CROSS-PLATFORM: Detects platform switches
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
          console.error(\`   npm run test:android:local -- --spec \${step.testFile}\`);
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

  // ✅ RECURSIVE AUTO-EXECUTION
  static async checkOrThrow(ImplicationClass, testData, options = {}) {
    const { page, driver, testDataPath } = options;
    
    const planner = new TestPlanner({ verbose: true });
    
    const meta = ImplicationClass.xstateConfig?.meta || ImplicationClass.meta;
    const targetStatus = meta.status;
    
    const currentStatus = this._getCurrentStatus(testData, ImplicationClass);
    
    console.log(\`\\n🔍 TestPlanner: Analyzing \${targetStatus} state\`);
    console.log(\`   Current: \${currentStatus}\`);
    console.log(\`   Target: \${targetStatus}\`);
    
    const analysis = planner.analyze(ImplicationClass, testData);
    
    if (targetStatus && currentStatus === targetStatus) {
      console.log(\`✅ Already in target state (\${targetStatus}), no action needed\\n\`);
      return { ready: true, skipped: true, currentStatus, targetStatus };
    }
    
    if (!analysis.ready && analysis.chain.length > 0) {
      const currentPlatform = options.page ? 'playwright' : 'webdriverio';
      const crossPlatformSteps = planner.detectCrossPlatform(analysis.chain, currentPlatform);
      
      if (crossPlatformSteps.length > 0) {
        planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
        throw new Error('Prerequisites not met (cross-platform)');
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
        
        // ✅ FIX: Determine which path to use
        const TestContext = require('./TestContext');
        const originalPath = options.testDataPath 
          || testData.__testDataPath 
          || process.env.TEST_DATA_PATH 
          || 'tests/data/shared.json';
        
        const deltaPath = TestContext.getDeltaPath(originalPath);
        
        // ✅ Use delta path if it exists, otherwise use original
        const pathToUse = fs.existsSync(deltaPath) ? deltaPath : originalPath;
        
        console.log(\`   📂 Using data from: \${pathToUse}\`);
        
        const result = await triggerFn(pathToUse, {
          page: options.page,
          driver: options.driver,
          testDataPath: pathToUse
        });
        
        if (result && result.save) {
          result.save(pathToUse);
          console.log('   💾 Prerequisite state saved');
        }

        // ✅ Reload from delta path after execution
        const finalDeltaPath = TestContext.getDeltaPath(originalPath);
        const reloadedCtx = TestContext.load(ImplicationClass, finalDeltaPath);
        Object.assign(testData, reloadedCtx.data);
        
        // ✅ Check current status after executing prerequisite
        const newCurrentStatus = this._getCurrentStatus(reloadedCtx.data, ImplicationClass);
        
        // ✅ Log completion of prerequisite
        if (newCurrentStatus === analysis.nextStep.status) {
          console.log(\`✅ Completed prerequisite: \${analysis.nextStep.status} → \${newCurrentStatus}\\n\`);
        }
        
        const newAnalysis = planner.analyze(ImplicationClass, reloadedCtx.data);
        
        // ✅ If still not ready, recursively check next prerequisite
        if (!newAnalysis.ready) {
          // Check if we're making progress (next step changed)
          const newNextStep = newAnalysis.nextStep;
          
          if (newNextStep && newNextStep.status !== analysis.nextStep.status) {
            console.log(\`   ⏭️  Moving to next prerequisite: \${newNextStep.actionName}\\n\`);
            // ✅ Pass updated options with delta path
            return TestPlanner.checkOrThrow(ImplicationClass, reloadedCtx.data, {
              ...options,
              testDataPath: finalDeltaPath
            });
          } else {
            // ✅ INFINITE LOOP DETECTED - same prerequisite keeps being suggested
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

  // ═══════════════════════════════════════════════════════════
  // MULTIPLE PATHS FEATURE (Session 12)
  // ═══════════════════════════════════════════════════════════

  _findAllPaths(currentStatus, targetStatus, currentPlatform) {
    const discoveryCache = this._loadDiscoveryCache();
    
    if (!discoveryCache || !discoveryCache.transitions) {
      return [];
    }
    
    const graph = {};
    
    for (const transition of discoveryCache.transitions) {
      const fromStatus = this._classNameToStatus(transition.from);
      const toStatus = this._normalizeStatus(transition.to);
      
      if (!graph[fromStatus]) {
        graph[fromStatus] = [];
      }
      
      graph[fromStatus].push({
        to: toStatus,
        event: transition.event,
        platforms: transition.platforms || [],
        from: fromStatus
      });
    }
    
    const allPaths = [];
    const queue = [{ 
      current: currentStatus, 
      path: [], 
      visited: new Set([currentStatus]) 
    }];
    
    while (queue.length > 0) {
      const { current, path, visited } = queue.shift();
      
      if (current === targetStatus) {
        allPaths.push(this._buildPathObject(path, currentStatus, currentPlatform));
        continue;
      }
      
      const neighbors = graph[current] || [];
      
      for (const transition of neighbors) {
        if (!visited.has(transition.to)) {
          const newVisited = new Set(visited);
          newVisited.add(transition.to);
          
          queue.push({
            current: transition.to,
            path: [...path, transition],
            visited: newVisited
          });
        }
      }
    }
    
    allPaths.sort((a, b) => b.score - a.score);
    
    return allPaths;
  }

  _buildPathObject(transitions, currentStatus, currentPlatform) {
    const steps = [
      {
        status: currentStatus,
        complete: true,
        isCurrent: true,
        isTarget: false,
        platform: currentPlatform
      }
    ];
    
    let hasCrossPlatform = false;
    
    for (const transition of transitions) {
      const stepPlatform = transition.platforms[0] || currentPlatform;
      
      if (stepPlatform !== currentPlatform) {
        hasCrossPlatform = true;
      }
      
      const implClassName = this.stateRegistry[transition.to];
      const actionName = transition.event || this._getActionNameForTransition(transition);
      
      steps.push({
        status: transition.to,
        complete: false,
        isCurrent: false,
        isTarget: false,
        platform: stepPlatform,
        event: transition.event,
        actionName: actionName,
        className: implClassName
      });
    }
    
    if (steps.length > 1) {
      steps[steps.length - 1].isTarget = true;
    }
    
    const score = this._calculatePathScore(steps, currentPlatform, hasCrossPlatform);
    
    return {
      steps,
      currentPlatform,
      hasCrossPlatform,
      score
    };
  }

  static async promptPathSelection(paths, currentStatus, targetStatus, timeoutSeconds = 10) {
    const readline = require('readline');
    
    console.log('═'.repeat(70));
    console.log('🗺️  MULTIPLE PATHS AVAILABLE - CHOOSE YOUR ROUTE');
    console.log('═'.repeat(70));
    console.log(\`\\n📊 Current: \${currentStatus}\`);
    console.log(\`🎯 Target: \${targetStatus}\\n\`);
    
    paths.forEach((path, index) => {
      TestPlanner._displayPath(path, index + 1, index === 0);
      console.log('');
    });
    
    console.log(\`❓ Which path do you want to take? (1-\${paths.length}, default: 1)\`);
    console.log(\`⏱️  Selecting Path 1 in \${timeoutSeconds} seconds...\\n\`);
    
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          rl.close();
          console.log(\`\\n⏱️  Timeout! Auto-selected Path 1 (recommended)\\n\`);
          resolve(paths[0]);
        }
      }, timeoutSeconds * 1000);
      
      rl.question('Your choice: ', (answer) => {
        if (resolved) return;
        
        resolved = true;
        clearTimeout(timeout);
        rl.close();
        
        const choice = parseInt(answer || '1', 10);
        
        if (isNaN(choice) || choice < 1 || choice > paths.length) {
          console.log(\`\\n⚠️  Invalid choice, using Path 1 (recommended)\\n\`);
          resolve(paths[0]);
        } else {
          console.log(\`\\n✅ Selected Path \${choice}\\n\`);
          resolve(paths[choice - 1]);
        }
      });
    });
  }

  static _displayPath(path, index, isRecommended) {
    const width = 70;
    const border = '─'.repeat(width - 2);
    
    console.log('┌' + border + '┐');
    
    let header = \`PATH \${index}\`;
    if (isRecommended) {
      header += ' (Recommended)';
    }
    if (!path.hasCrossPlatform) {
      header += ' - Same Platform';
    }
    
    console.log(\`│ \${header.padEnd(width - 3)}│\`);
    console.log('├' + border + '┤');
    
    path.steps.forEach((step, stepIndex) => {
      const icon = step.complete ? '✅' : step.isTarget ? '🎯' : '📍';
      const label = step.complete ? '(current)' : step.isTarget ? '(target)' : '';
      
      console.log(\`│ \${stepIndex + 1}. \${icon} \${step.status} \${label}\`.padEnd(width - 1) + '│');
      
      if (!step.complete && step.actionName) {
        const actionLine = \`    └─ Action: \${step.actionName} (\${step.platform})\`;
        const warning = step.platform !== path.currentPlatform ? ' ⚠️ ' : '';
        console.log(\`│ \${(actionLine + warning).padEnd(width - 3)}│\`);
      }
    });
    
    console.log('│'.padEnd(width - 1) + '│');
    
    const incompleteSteps = path.steps.filter(s => !s.complete).length;
    const estimatedTime = incompleteSteps * 15;
    console.log(\`│ ⏱️  Estimated: \${incompleteSteps} step(s), ~\${estimatedTime} seconds\`.padEnd(width - 1) + '│');
    
    if (path.hasCrossPlatform) {
      console.log(\`│ ⚠️  Warning: Requires platform switch (slower)\`.padEnd(width - 1) + '│');
    } else {
      console.log(\`│ 🔧 Platform: All \${path.currentPlatform} (fastest)\`.padEnd(width - 1) + '│');
    }
    
    console.log('└' + border + '┘');
  }

  _calculatePathScore(steps, currentPlatform, hasCrossPlatform) {
    let score = 100;
    
    const samePlatformSteps = steps.filter(s => s.platform === currentPlatform).length;
    score += samePlatformSteps * 20;
    
    score += (10 - steps.length) * 5;
    
    if (hasCrossPlatform) {
      score -= 50;
    }
    
    return score;
  }

  _getActionNameForTransition(transition) {
    const implClassName = this.stateRegistry[transition.to];
    
    if (!implClassName) {
      return \`goTo\${this._toPascalCase(transition.to)}\`;
    }
    
    try {
      const implPath = this.findImplicationFile(implClassName);
      if (!implPath) {
        return \`goTo\${this._toPascalCase(transition.to)}\`;
      }
      
      const ImplClass = require(implPath);
      const actionName = ImplClass.xstateConfig?.meta?.setup?.[0]?.actionName;
      
      return actionName || \`goTo\${this._toPascalCase(transition.to)}\`;
      
    } catch (error) {
      return \`goTo\${this._toPascalCase(transition.to)}\`;
    }
  }

  _classNameToStatus(className) {
    for (const [status, cls] of Object.entries(this.stateRegistry)) {
      if (cls === className) {
        return status;
      }
    }
    
    return className
      .replace(/Implications$/i, '')
      .replace(/([A-Z])/g, (match, p1, offset) => {
        return offset > 0 ? '_' + p1.toLowerCase() : p1.toLowerCase();
      });
  }

  _normalizeStatus(status) {
    return status.toLowerCase().replace(/\\s+/g, '_');
  }

  _loadDiscoveryCache() {
    try {
      const cacheDir = path.join(process.cwd(), '.implications-framework', 'cache');
      const discoveryCache = path.join(cacheDir, 'discovery-result.json');
      
      if (fs.existsSync(discoveryCache)) {
        return JSON.parse(fs.readFileSync(discoveryCache, 'utf-8'));
      }
    } catch (error) {
      // Silently handle
    }
    
    return null;
  }

  _toPascalCase(str) {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
  
  // ✅ PRE-FLIGHT CHECK with all features
  static preFlightCheck(ImplicationClass, testDataPath) {
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
      
      // Check for cross-platform issues
      const crossPlatformSteps = planner.detectCrossPlatform(analysis.chain, currentPlatform);
      
      if (crossPlatformSteps.length > 0) {
        planner.printCrossPlatformMessage(analysis.chain, currentPlatform);
        console.error('❌ Pre-flight check failed. Exiting before launching app.\\n');
        process.exit(1);
      }
      
      // If there's a next step, we can auto-execute
      if (analysis.nextStep) {
        console.log(\`\\n⚠️  Prerequisites missing - will auto-execute during test\\n\`);
        console.log(\`   Next step: \${analysis.nextStep.actionName} (\${analysis.nextStep.status})\`);
        console.log('✅ Pre-flight check passed (auto-execution enabled)\\n');
        return true;
      }
      
      // No path to target
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
  return `// ExpectImplication.js
// Validates UI implications against screen objects
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