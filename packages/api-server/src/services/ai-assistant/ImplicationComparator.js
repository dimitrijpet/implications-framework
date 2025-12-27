// packages/api-server/src/services/ai-assistant/ImplicationComparator.js

import fs from 'fs/promises';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';

const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

class ImplicationComparator {
  
  async parseExistingImplication(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Detect CommonJS vs ES modules
    const isCommonJS = content.includes('require(') || content.includes('module.exports');
    
    const ast = parser.parse(content, {
      sourceType: isCommonJS ? 'script' : 'module',
      plugins: ['classProperties']
    });

    const result = {
      filePath,
      className: null,
      status: null,
      entity: null,
      platforms: [],
      mirrorsOn: null,
      mirrorsOnStart: null,  // Line number where mirrorsOn starts
      mirrorsOnEnd: null,    // Line number where mirrorsOn ends
      screens: [],           // { platform, screenName, elements: [] }
      compoundMethods: [],   // Existing compound methods
      transitions: [],
      rawContent: content
    };

    traverse(ast, {
      ClassDeclaration(path) {
        result.className = path.node.id.name;
      },

      ClassProperty(path) {
        const propName = path.node.key?.name;
        
        if (propName === 'xstateConfig') {
          // Extract meta info
          const code = generate(path.node.value).code;
          
          const statusMatch = code.match(/status:\s*['"]([^'"]+)['"]/);
          const entityMatch = code.match(/entity:\s*['"]([^'"]+)['"]/);
          const platformsMatch = code.match(/platforms:\s*\[([^\]]+)\]/);
          
          if (statusMatch) result.status = statusMatch[1];
          if (entityMatch) result.entity = entityMatch[1];
          if (platformsMatch) {
            result.platforms = platformsMatch[1]
              .split(',')
              .map(p => p.trim().replace(/['"]/g, ''))
              .filter(Boolean);
          }
          
          // Extract transitions
          const onMatch = code.match(/on:\s*\{([^}]+)\}/);
          if (onMatch) {
            const transitionMatches = onMatch[1].matchAll(/(\w+):\s*['"]([^'"]+)['"]/g);
            for (const match of transitionMatches) {
              result.transitions.push({ event: match[1], target: match[2] });
            }
          }
        }
        
        if (propName === 'mirrorsOn') {
          result.mirrorsOn = generate(path.node.value).code;
          result.mirrorsOnStart = path.node.loc?.start.line;
          result.mirrorsOnEnd = path.node.loc?.end.line;
          
          // Extract screens and their elements
          extractScreensFromMirrorsOn(path.node.value, result);
        }
      }
    });

    return result;
  }

  compare(existingImpl, capturedElements, targetPlatform, targetScreen) {
    const diff = {
      new: [],
      existing: [],
      summary: { newCount: 0, existingCount: 0 }
    };

    // Find existing elements for this platform/screen
    const existingScreen = existingImpl.screens.find(s => 
      s.platform === targetPlatform && s.screenName === targetScreen
    );
    
    const existingNames = new Set(
      (existingScreen?.elements || []).map(e => e.toLowerCase())
    );

    for (const el of capturedElements) {
      const nameLower = el.name.toLowerCase();
      
      if (existingNames.has(nameLower)) {
        diff.existing.push({ name: el.name, type: el.type });
        diff.summary.existingCount++;
      } else {
        diff.new.push({ 
          name: el.name, 
          type: el.type, 
          selector: el.selectors?.[0]?.value || el.selector || ''
        });
        diff.summary.newCount++;
      }
    }

    return diff;
  }

  async merge(existingImpl, diff, options = {}) {
  const { 
    platform, 
    screenName, 
    instanceName,
    compoundMethods = [],
    includeCompoundMethods = true 
  } = options;

  let content = existingImpl.rawContent;
  
  // Nothing to add
  if (diff.new.length === 0 && (!includeCompoundMethods || compoundMethods.length === 0)) {
    return content;
  }

  console.log('📝 Merge params:', { platform, screenName, instanceName });
  console.log('📝 New elements:', diff.new.length);
  console.log('📝 Compound methods:', compoundMethods.length);

  // Build the new screen block
  const screenBlockName = screenName.endsWith('Screen') ? screenName : `${screenName}Screen`;
  const instance = instanceName || screenName.charAt(0).toLowerCase() + screenName.slice(1);
  
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);

  // Build visible elements list
  const visibleElements = diff.new.map(el => `'${el.name}'`).join(',\n                    ');

  // Build compound methods block if we have any
  let compoundBlock = '';
  if (includeCompoundMethods && compoundMethods.length > 0) {
    const methodsJson = compoundMethods.map(m => {
      const paramsJson = m.params.map(p => 
        `{ name: '${p.name}', type: '${p.type}' }`
      ).join(', ');
      return `                  {
                    name: '${m.name}',
                    description: '${m.description.replace(/'/g, "\\'")}',
                    params: [${paramsJson}],
                    template: \`${m.template}\`
                  }`;
    }).join(',\n');

    compoundBlock = `,
              {
                id: 'blk_compound_${timestamp + 1}_${random}',
                type: 'compound-locators',
                label: 'Dynamic element lookups',
                order: 1,
                expanded: true,
                enabled: true,
                data: {
                  methods: [
${methodsJson}
                  ]
                }
              }`;
  }

  // The new screen definition
  const newScreenBlock = `${screenBlockName}: {
            description: '${screenName} elements',
            screen: '${instance}.screen.js',
            instance: '${instance}',
            blocks: [
              {
                id: 'blk_ui_${timestamp}_${random}',
                type: 'ui-assertion',
                label: '${screenName} visible elements',
                order: 0,
                expanded: true,
                enabled: true,
                data: {
                  visible: [
                    ${visibleElements}
                  ],
                  timeout: 30000
                }
              }${compoundBlock}
            ]
          }`;

  // Check if platform exists in UI
  const platformPattern = new RegExp(`(UI:\\s*\\{[\\s\\S]*?)(${platform}:\\s*\\{)([\\s\\S]*?)(\\}\\s*,?\\s*(?=\\w+:|\\}))`, 'm');
  const platformMatch = content.match(platformPattern);

  if (platformMatch) {
    // Platform exists - add screen to it
    console.log(`📝 Platform '${platform}' exists, adding screen`);
    
    // Find the closing brace of the platform object and insert before it
    // Look for pattern like: manager: { ... existing screens ... }
    const platformRegex = new RegExp(
      `(${platform}:\\s*\\{)([\\s\\S]*?)(\\}\\s*,?\\s*(?=dancer:|web:|manager:|android:|ios:|\\}\\s*\\};))`,
      'm'
    );
    
    const match = content.match(platformRegex);
    if (match) {
      const existingContent = match[2].trim();
      // Check if it ends with a comma or needs one
      const needsComma = existingContent && !existingContent.endsWith(',');
      const separator = existingContent ? (needsComma ? ',\n        ' : '\n        ') : '';
      
      content = content.replace(
        platformRegex,
        `$1$2${separator}${newScreenBlock}\n        $3`
      );
      console.log(`✅ Added ${screenBlockName} to ${platform}`);
    }
  } else {
    // Platform doesn't exist - add it
    console.log(`📝 Platform '${platform}' doesn't exist, adding it`);
    
    // Find UI: { and add the new platform
    const uiPattern = /(UI:\s*\{)/;
    const uiMatch = content.match(uiPattern);
    
    if (uiMatch) {
      const newPlatform = `$1\n      ${platform}: {\n        ${newScreenBlock}\n      },`;
      content = content.replace(uiPattern, newPlatform);
      console.log(`✅ Added platform '${platform}' with ${screenBlockName}`);
    } else {
      console.log('❌ Could not find UI: { in file');
    }
  }

  return content;
}
}

function extractScreensFromMirrorsOn(node, result) {
  // Traverse the mirrorsOn object to find screens and their elements
  const code = generate(node).code;
  
  // Match pattern: ScreenName: { ... blocks: [...] }
  const screenMatches = code.matchAll(/(\w+Screen|\w+):\s*\{[^}]*blocks:\s*\[([\s\S]*?)\]/g);
  
  for (const match of screenMatches) {
    const screenName = match[1];
    const blocksContent = match[2];
    
    // Extract visible elements
    const visibleMatch = blocksContent.match(/visible:\s*\[([^\]]*)\]/);
    const elements = [];
    
    if (visibleMatch) {
      const elems = visibleMatch[1].matchAll(/['"]([^'"]+)['"]/g);
      for (const el of elems) {
        elements.push(el[1]);
      }
    }
    
    // Determine platform from context (simplified)
    let platform = 'web';
    if (code.includes('android:') && code.indexOf(screenName) > code.indexOf('android:')) {
      platform = 'android';
    } else if (code.includes('ios:') && code.indexOf(screenName) > code.indexOf('ios:')) {
      platform = 'ios';
    } else if (code.includes('dancer:') && code.indexOf(screenName) > code.indexOf('dancer:')) {
      platform = 'dancer';
    } else if (code.includes('manager:') && code.indexOf(screenName) > code.indexOf('manager:')) {
      platform = 'manager';
    }
    
    result.screens.push({ platform, screenName, elements });
  }
}

function generateScreenBlock(screenName, instanceName, elements, compoundMethods = []) {
  const visibleElements = [
    ...elements.map(el => `'${el.name}'`),
    ...compoundMethods.map(m => `'@${m.name}'`)  // @ prefix for methods
  ].join(', ');
  
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  
  let block = `${screenName}: {
          screen: '${instanceName}.screen.js',
          instance: '${instanceName}',
          blocks: [
            {
              id: 'blk_ui_${timestamp}_${random}',
              type: 'ui-assertion',
              label: '${screenName} elements',
              order: 0,
              expanded: true,
              enabled: true,
              data: {
                visible: [${visibleElements}],
                hidden: [],
                timeout: 30000
              }
            }`;

  // Add compound methods block if we have any
  if (compoundMethods.length > 0) {
    const methodsTimestamp = Date.now() + 1;
    const methodsRandom = Math.random().toString(36).substring(2, 7);
    
    block += `,
            {
              id: 'blk_compound_${methodsTimestamp}_${methodsRandom}',
              type: 'compound-locators',
              label: 'Dynamic element lookups',
              order: 1,
              expanded: true,
              enabled: true,
              data: {
                methods: [
${compoundMethods.map(m => `                  {
                    name: '${m.name}',
                    description: '${m.description}',
                    params: [${m.params.map(p => `{ name: '${p.name}', type: '${p.type}' }`).join(', ')}],
                    template: \`${m.template}\`
                  }`).join(',\n')}
                ]
              }
            }`;
  }

  block += `
          ]
        }`;
  
  return block;
}

/**
 * Add a compound methods block to an existing screen in mirrorsOn
 */
function addCompoundMethodsBlock(content, screenName, compoundMethods, platform) {
  // Check if compound-locators block already exists for this screen
  const compoundBlockPattern = new RegExp(
    `${screenName}:[^}]*type:\\s*['"]compound-locators['"]`,
    's'
  );
  
  if (compoundBlockPattern.test(content)) {
    // Block exists, we could merge but for now just skip
    console.log(`ℹ️ Compound block already exists for ${screenName}`);
    return content;
  }

  // Find the last block in this screen's blocks array and add after it
  // This is a simplified approach - in production you'd use AST manipulation
  const screenBlocksPattern = new RegExp(
    `(${screenName}:\\s*\\{[^}]*blocks:\\s*\\[[\\s\\S]*?)(\\]\\s*\\})`,
    's'
  );
  
  const match = content.match(screenBlocksPattern);
  
  if (match) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7);
    
    const compoundBlock = `,
            {
              id: 'blk_compound_${timestamp}_${random}',
              type: 'compound-locators',
              label: 'Dynamic element lookups',
              order: 99,
              expanded: true,
              enabled: true,
              data: {
                methods: [
${compoundMethods.map(m => `                  {
                    name: '${m.name}',
                    description: '${m.description.replace(/'/g, "\\'")}',
                    params: [${m.params.map(p => `{ name: '${p.name}', type: '${p.type}' }`).join(', ')}],
                    template: \`${m.template}\`
                  }`).join(',\n')}
                ]
              }
            }`;
    
    content = content.replace(screenBlocksPattern, `$1${compoundBlock}$2`);
  }

  return content;
}

export default ImplicationComparator;