const path = require('path');
const fs = require('fs');


/**
 * Shared initialization service
 * Used by both CLI and API server
 */

/**
 * Analyze project structure
 */
function analyzeProject(projectPath) {
  const analysis = {
    projectName: path.basename(projectPath),
    domain: 'general',
    testRunner: 'playwright',
    testsPath: 'tests',
    testDataMode: 'stateless',
    platforms: ['web'],
    patterns: {
      screenObjects: [],
      sections: []
    },
    screenObjectsPath: null  // ✨ NEW
  };
  
  // Detect test runner
  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps['@playwright/test']) {
      analysis.testRunner = 'playwright';
    } else if (deps['cypress']) {
      analysis.testRunner = 'cypress';
    } else if (deps['webdriverio']) {
      analysis.testRunner = 'webdriverio';
    }
  }
  
  // Detect test directory
  const commonTestDirs = ['tests', 'test', '__tests__', 'e2e', 'specs'];
  for (const dir of commonTestDirs) {
    if (fs.existsSync(path.join(projectPath, dir))) {
      analysis.testsPath = dir;
      break;
    }
  }
  
  // ✨ NEW: Detect screen objects directory
  analysis.screenObjectsPath = detectScreenObjectsPath(projectPath, analysis.testsPath);
  
  // Detect patterns
  const testsDir = path.join(projectPath, analysis.testsPath);
  if (fs.existsSync(testsDir)) {
    const findPattern = (dir, pattern) => {
      if (!fs.existsSync(dir)) return [];
      const files = fs.readdirSync(dir, { withFileTypes: true });
      return files
        .filter(f => f.isDirectory())
        .map(f => f.name)
        .filter(name => name.toLowerCase().includes(pattern));
    };
    
    const screenDirs = findPattern(testsDir, 'screen');
    if (screenDirs.length > 0) {
      analysis.patterns.screenObjects = screenDirs.map(d => 
        `${analysis.testsPath}/${d}/**/*.js`
      );
    }
    
    const sectionDirs = findPattern(testsDir, 'section');
    if (sectionDirs.length > 0) {
      analysis.patterns.sections = sectionDirs.map(d => 
        `${analysis.testsPath}/${d}/**/*.js`
      );
    }
  }
  
  return analysis;
}

/**
 * ✨ NEW: Detect screen objects directory
 */
function detectScreenObjectsPath(projectPath, testsPath) {
  const commonLocations = [
    path.join(testsPath, 'screenObjects'),
    path.join(testsPath, 'screen-objects'),
    path.join(testsPath, 'pages'),
    path.join(testsPath, 'pageObjects'),
    path.join(testsPath, 'page-objects'),
    'screenObjects',
    'pages',
    'pageObjects'
  ];
  
  for (const location of commonLocations) {
    const fullPath = path.join(projectPath, location);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ Found screen objects at: ${location}`);
      return location;
    }
  }
  
  // Default fallback
  console.log(`⚠️  Screen objects not found, using default: ${testsPath}/screenObjects`);
  return path.join(testsPath, 'screenObjects');
}

/**
 * Create necessary directories
 */
function createDirectories(projectPath, analysis) {
  const dirs = [
    path.join(projectPath, analysis.testsPath, 'implications'),
    path.join(projectPath, analysis.testsPath, 'implications', 'utils')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  return dirs.map(d => path.relative(projectPath, d));
}

/**
 * Copy utility files from framework core to guest project
 */
function copyUtilities(projectPath, analysis) {
  const utilsDir = path.join(projectPath, analysis.testsPath, 'implications', 'utils');
  
  // Find core package - could be in multiple locations
  let coreDir = null;
  
  // Try 1: Relative to this file (for monorepo)
  const relativeCore = path.join(__dirname, '../../../core/src');
  if (fs.existsSync(path.join(relativeCore, 'TestContext.js'))) {
    coreDir = relativeCore;
  }
  
  // Try 2: In node_modules (for published package)
  if (!coreDir) {
    const nodeModulesCore = path.join(__dirname, '../../../node_modules/@implications/core/src');
    if (fs.existsSync(path.join(nodeModulesCore, 'TestContext.js'))) {
      coreDir = nodeModulesCore;
    }
  }
  
  // Try 3: Look up from current location
  if (!coreDir) {
    const searchPaths = [
      path.join(__dirname, '../../../../packages/core/src'),
      path.join(__dirname, '../../../../../packages/core/src')
    ];
    
    for (const searchPath of searchPaths) {
      if (fs.existsSync(path.join(searchPath, 'TestContext.js'))) {
        coreDir = searchPath;
        break;
      }
    }
  }
  
  if (!coreDir) {
    throw new Error('Could not find @implications/core package. Make sure it is installed.');
  }
  
  console.log('📦 Found core package at:', coreDir);
  
  const files = [
    { src: 'TestContext.js', dest: 'TestContext.js' },
    { src: 'ExpectImplication.js', dest: 'ExpectImplication.js' }
  ];
  
  const copiedFiles = [];
  
  files.forEach(({ src, dest }) => {
    const srcPath = path.join(coreDir, src);
    const destPath = path.join(utilsDir, dest);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      copiedFiles.push(path.relative(projectPath, destPath));
      console.log(`✅ Copied: ${src}`);
    } else {
      console.warn(`⚠️  File not found: ${srcPath}`);
    }
  });
  
  return copiedFiles;
}

/**
 * Generate config file
 */
function generateConfig(projectPath, analysis) {
  const configPath = path.join(projectPath, 'ai-testing.config.js');
  
  const config = `// ai-testing.config.js
// Generated by Implications Framework

module.exports = {
  // === Project Info ===
  projectName: "${analysis.projectName}",
  domain: '${analysis.domain}',
  
  // === Paths ===
  paths: {
    tests: '${analysis.testsPath}',
    implications: '${analysis.testsPath}/implications',
    utils: '${analysis.testsPath}/implications/utils',
    screenObjects: '${analysis.screenObjectsPath}'  // ✨ NEW
  },
  
  // === Test Configuration ===
  testRunner: '${analysis.testRunner}',
  platforms: ${JSON.stringify(analysis.platforms)},
  
  // === Architecture ===
  testDataMode: '${analysis.testDataMode}', // 'stateless' or 'stateful'
  
  // === Patterns ===
  patterns: {
    screenObjects: ${JSON.stringify(analysis.patterns.screenObjects, null, 6).replace(/\n/g, '\n    ')},
    sections: ${JSON.stringify(analysis.patterns.sections, null, 6).replace(/\n/g, '\n    ')},
    implications: [
      '${analysis.testsPath}/implications/**/*Implications.js'
    ],
    tests: [
      '${analysis.testsPath}/**/*.spec.js'
    ]
  }
};
`;
  
  fs.writeFileSync(configPath, config);
  return 'ai-testing.config.js';
}

/**
 * Create README
 */
function createReadme(projectPath, analysis) {
  const readmePath = path.join(
    projectPath, 
    analysis.testsPath, 
    'implications', 
    'README.md'
  );
  
  const readme = `# Implications Framework

This directory contains auto-generated implications-based tests.

## Structure

\`\`\`
${analysis.testsPath}/implications/
├── utils/                    # Utility files (auto-copied)
│   ├── TestContext.js       # Data management
│   └── ExpectImplication.js # Validation engine
│
├── [domain]/                # Your implications (to be generated)
│   └── [Type]Implications.js
│
└── README.md                # This file
\`\`\`

## Next Steps

1. **Discover patterns:**
   \`\`\`bash
   implications discover
   \`\`\`

2. **Generate implications:**
   \`\`\`bash
   implications generate:implication YourType
   \`\`\`

3. **Open web UI:**
   \`\`\`bash
   # Start the framework
   cd path/to/implications-framework
   pnpm dev
   
   # Open browser
   # http://localhost:3000
   \`\`\`

## Documentation

- [Getting Started](../../../node_modules/@implications/docs/getting-started.md)
- [Implications Guide](../../../node_modules/@implications/docs/implications.md)
- [TestContext API](../../../node_modules/@implications/docs/test-context.md)

## Support

For issues or questions:
- GitHub: https://github.com/implications-framework/core
- Docs: https://implications-framework.dev
`;
  
  fs.writeFileSync(readmePath, readme);
  return path.relative(projectPath, readmePath);
}

module.exports = {
  analyzeProject,
  createDirectories,
  copyUtilities,
  generateConfig,
  createReadme
};