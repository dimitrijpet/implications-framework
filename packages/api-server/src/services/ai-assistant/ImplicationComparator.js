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
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['classProperties']
    });

    const result = {
      filePath,
      className: null,
      status: null,
      entity: null,
      platforms: [],
      mirrorsOn: null,
      screens: [],       // { platform, screenName, elements: [] }
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
      addToVisible = true 
    } = options;

    let content = existingImpl.rawContent;
    
    if (diff.new.length === 0) {
      return content;
    }

    // Find the mirrorsOn block for this platform/screen
    const screenPattern = new RegExp(
      `(${screenName}:\\s*\\{[^}]*blocks:\\s*\\[)([^\\]]*)(\\])`,
      's'
    );
    
    const match = content.match(screenPattern);
    
    if (match) {
      // Add new elements to existing blocks
      const newElements = diff.new.map(el => `'${el.name}'`).join(', ');
      
      // Find visible array in the blocks and append
      const visiblePattern = /(visible:\s*\[)([^\]]*?)(\])/;
      const visibleMatch = content.match(visiblePattern);
      
      if (visibleMatch) {
        const existingVisible = visibleMatch[2].trim();
        const newVisible = existingVisible 
          ? `${existingVisible}, ${newElements}`
          : newElements;
        content = content.replace(visiblePattern, `$1${newVisible}$3`);
      }
    } else {
      // No existing screen block - need to add one
      // Find mirrorsOn.UI.{platform} and add new screen
      const platformPattern = new RegExp(
        `(UI:\\s*\\{[^}]*${platform}:\\s*\\{)([^}]*)(\\})`,
        's'
      );
      
      const platformMatch = content.match(platformPattern);
      
      if (platformMatch) {
        const newBlock = generateScreenBlock(screenName, instanceName, diff.new);
        const existingContent = platformMatch[2].trim();
        const separator = existingContent ? ',\n        ' : '';
        const newContent = `${existingContent}${separator}${newBlock}`;
        content = content.replace(platformPattern, `$1${newContent}$3`);
      }
    }

    return content;
  }
}

function extractScreensFromMirrorsOn(node, result) {
  // Traverse the mirrorsOn object to find screens and their elements
  const code = generate(node).code;
  
  // Match pattern: ScreenName: { ... blocks: [...] }
  const screenMatches = code.matchAll(/(\w+Screen):\s*\{[^}]*blocks:\s*\[([\s\S]*?)\]/g);
  
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
    }
    
    result.screens.push({ platform, screenName, elements });
  }
}

function generateScreenBlock(screenName, instanceName, elements) {
  const visibleElements = elements.map(el => `'${el.name}'`).join(', ');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  
  return `${screenName}: {
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
            }
          ]
        }`;
}

export default ImplicationComparator;