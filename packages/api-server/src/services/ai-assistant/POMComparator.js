// packages/api-server/src/services/ai-assistant/POMComparator.js

import fs from 'fs/promises';
import path from 'path';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';

const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

class POMComparator {
  /**
   * Parse an existing POM file and extract its structure
   */
async parseExistingPOM(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Detect if it's CommonJS or ES module
    const isCommonJS = content.includes('require(') || content.includes('module.exports');
    
    const ast = parser.parse(content, {
      sourceType: isCommonJS ? 'script' : 'module',
      plugins: ['classProperties']
    });

    const result = {
      filePath,
      className: null,
      locators: [],
      actions: [],
      assertions: [],
      compoundMethods: [],
      customMethods: [],
      hasConstructor: false,
      isMobile: false,
      rawContent: content
    };

    traverse(ast, {
      ClassDeclaration(path) {
        result.className = path.node.id.name;
      },

      ClassMethod(path) {
        const methodName = path.node.key.name;
        const startLine = path.node.loc?.start.line;
        const endLine = path.node.loc?.end.line;

        // Constructor
        if (methodName === 'constructor') {
          result.hasConstructor = true;
          return;
        }

        // Getter (locator)
        if (path.node.kind === 'get') {
          const selector = extractSelectorFromGetter(path.node);
          result.locators.push({
            name: methodName,
            selector,
            startLine,
            endLine,
            node: path.node
          });

          if (selector && !selector.includes('this.page')) {
            result.isMobile = true;
          }
          return;
        }

        // Compound methods (parameterized locators like getStatusInSection)
        // These are async methods with params that return elements
        if (path.node.async && path.node.params.length > 0) {
          const methodCode = generate(path.node).code;
          
          // Check if it returns $() or element - likely a compound locator
          if (methodCode.includes('return $(') || methodCode.includes('return this.')) {
            // Could be a compound method OR a custom method
            // Compound methods typically start with 'get' or have locator-like patterns
            if (methodName.startsWith('get') || 
                methodName.includes('ByIndex') ||
                methodName.includes('InSection')) {
              result.compoundMethods.push({
                name: methodName,
                params: path.node.params.map(p => p.name || p.left?.name),
                startLine,
                endLine,
                node: path.node
              });
              return;
            }
          }
        }

        // Regular method - categorize
        if (methodName.startsWith('tap') || methodName.startsWith('click') ||
            methodName.startsWith('fill') || methodName.startsWith('select') ||
            methodName.startsWith('enter') || methodName.startsWith('type')) {
          result.actions.push({
            name: methodName,
            params: path.node.params.map(p => p.name),
            startLine,
            endLine,
            node: path.node
          });
        } else if (methodName.startsWith('is') && methodName.endsWith('Visible')) {
          result.assertions.push({
            name: methodName,
            startLine,
            endLine,
            node: path.node
          });
        } else {
          // Custom method - preserve as-is
          const code = generate(path.node).code;
          result.customMethods.push({
            name: methodName,
            code,
            startLine,
            endLine,
            node: path.node
          });
        }
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to parse POM:', error);
    throw new Error(`Failed to parse POM file: ${error.message}`);
  }
}

  /**
   * Compare existing POM with newly captured elements
   */
  compare(existingPOM, capturedElements) {
    const diff = {
      new: [],        // Elements in capture but not in POM
      changed: [],    // Elements in both but selector differs
      unchanged: [],  // Elements in both with same selector
      removed: [],    // Elements in POM but not in capture
      summary: {
        newCount: 0,
        changedCount: 0,
        unchangedCount: 0,
        removedCount: 0
      }
    };

    const existingByName = new Map(
      existingPOM.locators.map(loc => [loc.name.toLowerCase(), loc])
    );
    
    const capturedByName = new Map(
      capturedElements.map(el => [el.name.toLowerCase(), el])
    );

    // Check each captured element
    for (const captured of capturedElements) {
      const nameLower = captured.name.toLowerCase();
      const existing = existingByName.get(nameLower);
      const capturedSelector = captured.selectors?.[0]?.value || captured.selector || '';

      if (!existing) {
        // New element
        diff.new.push({
          name: captured.name,
          type: captured.type,
          selector: capturedSelector,
          element: captured
        });
        diff.summary.newCount++;
      } else {
        // Compare selectors
        const existingSelector = normalizeSelector(existing.selector);
        const newSelector = normalizeSelector(capturedSelector);

        if (existingSelector === newSelector) {
          diff.unchanged.push({
            name: captured.name,
            type: captured.type,
            selector: capturedSelector,
            existingSelector: existing.selector
          });
          diff.summary.unchangedCount++;
        } else {
          diff.changed.push({
            name: captured.name,
            type: captured.type,
            oldSelector: existing.selector,
            newSelector: capturedSelector,
            startLine: existing.startLine,
            endLine: existing.endLine
          });
          diff.summary.changedCount++;
        }
      }
    }

    // Find removed elements (in POM but not in capture)
    for (const existing of existingPOM.locators) {
      const nameLower = existing.name.toLowerCase();
      if (!capturedByName.has(nameLower)) {
        diff.removed.push({
          name: existing.name,
          selector: existing.selector,
          startLine: existing.startLine,
          endLine: existing.endLine
        });
        diff.summary.removedCount++;
      }
    }

    return diff;
  }

  /**
   * Merge captured elements into existing POM
   * Returns the new file content
   */
  async merge(existingPOM, diff, options = {}) {
    const {
      addNew = true,
      updateChanged = true,
      removeDeleted = false,
      generateActions = true,
      generateAssertions = true,
      includeCompoundMethods = true
    } = options;

    // Get compound methods from options
    const compoundMethods = options.compoundMethods || [];

    const content = existingPOM.rawContent;
    const lines = content.split('\n');
    
    const replacements = [];

    // Find where each section ENDS (not starts)
    let lastLocatorEndLine = 0;
    let lastCompoundEndLine = 0;
    let lastActionEndLine = 0;
    let lastAssertionEndLine = 0;
    let classEndLine = lines.length - 1;

    // Track section end lines
    for (const loc of existingPOM.locators) {
      if (loc.endLine > lastLocatorEndLine) lastLocatorEndLine = loc.endLine;
    }
    for (const compound of existingPOM.compoundMethods || []) {
      if (compound.endLine > lastCompoundEndLine) lastCompoundEndLine = compound.endLine;
    }
    for (const action of existingPOM.actions) {
      if (action.endLine > lastActionEndLine) lastActionEndLine = action.endLine;
    }
    for (const assertion of existingPOM.assertions) {
      if (assertion.endLine > lastAssertionEndLine) lastAssertionEndLine = assertion.endLine;
    }

    // Find class closing brace
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === '}') {
        classEndLine = i;
        break;
      }
    }

    // Prepare new code blocks
    const newLocators = [];
    const newCompoundMethods = [];
    const newActions = [];
    const newAssertions = [];

    // Add new elements
    if (addNew) {
      for (const item of diff.new) {
        // Locator
        newLocators.push(generateLocatorCode(item.name, item.selector, existingPOM.isMobile));
        
        // Action
        if (generateActions && isInteractiveType(item.type)) {
          newActions.push(generateActionCode(item.name, item.type, existingPOM.isMobile));
        }
        
        // Assertion
        if (generateAssertions) {
          newAssertions.push(generateAssertionCode(item.name, existingPOM.isMobile));
        }
      }
    }

    // Add compound methods
    if (includeCompoundMethods && compoundMethods.length > 0) {
      // Check which compound methods already exist
      const existingCompoundNames = new Set(
        (existingPOM.compoundMethods || []).map(m => m.name.toLowerCase())
      );

      for (const method of compoundMethods) {
        if (!existingCompoundNames.has(method.name.toLowerCase())) {
          newCompoundMethods.push(generateCompoundMethodCode(method, existingPOM.isMobile));
        }
      }
    }

    // Handle changed selectors - replace the entire getter
    if (updateChanged) {
      for (const item of diff.changed) {
        if (item.startLine && item.endLine) {
          // Mark lines for replacement
          const startIndex = item.startLine - 1;
          const endIndex = item.endLine - 1;
          
          // Generate new getter code
          const newGetter = generateLocatorCode(item.name, item.newSelector, existingPOM.isMobile);
          
          replacements.push({
            startLine: startIndex,
            endLine: endIndex,
            content: newGetter
          });
        }
      }
    }

    // Build the new content
    let newContent = [...lines];

    // Apply replacements first (from bottom to top to preserve line numbers)
    replacements.sort((a, b) => b.startLine - a.startLine);
    for (const rep of replacements) {
      // Remove old lines and insert new
      newContent.splice(rep.startLine, rep.endLine - rep.startLine + 1, rep.content);
    }

    // Recalculate insert points after replacements
    // Find section comments or calculate based on last items
    const locatorInsertLine = findSectionEndLine(newContent, lastLocatorEndLine, 'LOCATORS', classEndLine);
    
    // Compound methods go after locators, before actions
    const compoundInsertLine = lastCompoundEndLine > 0 
      ? findSectionEndLine(newContent, lastCompoundEndLine, 'COMPOUND', classEndLine)
      : locatorInsertLine;
    
    const actionInsertLine = lastActionEndLine > 0
      ? findSectionEndLine(newContent, lastActionEndLine, 'ACTIONS', classEndLine)
      : compoundInsertLine;
    
    const assertionInsertLine = lastAssertionEndLine > 0
      ? findSectionEndLine(newContent, lastAssertionEndLine, 'ASSERTIONS', classEndLine)
      : actionInsertLine;

    // Insert in reverse order to preserve line numbers
    if (newAssertions.length > 0) {
      const insertAt = Math.min(assertionInsertLine + 1, classEndLine);
      newContent.splice(insertAt, 0, '', ...newAssertions);
      classEndLine += newAssertions.length + 1;
    }
    
    if (newActions.length > 0) {
      const insertAt = Math.min(actionInsertLine + 1, classEndLine);
      newContent.splice(insertAt, 0, '', ...newActions);
      classEndLine += newActions.length + 1;
    }

    if (newCompoundMethods.length > 0) {
      // Insert compound methods section
      const insertAt = Math.min(compoundInsertLine + 1, classEndLine);
      
      // Add section header if this is the first compound method
      if ((existingPOM.compoundMethods || []).length === 0) {
        newContent.splice(insertAt, 0, 
          '',
          '  // ═══════════════════════════════════════════════════',
          '  // COMPOUND LOCATORS (Smart Methods)',
          '  // ═══════════════════════════════════════════════════',
          '',
          ...newCompoundMethods
        );
        classEndLine += newCompoundMethods.length + 5;
      } else {
        newContent.splice(insertAt, 0, '', ...newCompoundMethods);
        classEndLine += newCompoundMethods.length + 1;
      }
    }
    
    if (newLocators.length > 0) {
      const insertAt = Math.min(locatorInsertLine + 1, classEndLine);
      newContent.splice(insertAt, 0, '', ...newLocators);
    }

    return newContent.join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function extractSelectorFromGetter(node) {
  let selector = null;
  
  // Look for return statement
  const body = node.body?.body || [];
  for (const stmt of body) {
    if (stmt.type === 'ReturnStatement') {
      const arg = stmt.argument;
      
      if (arg?.type === 'CallExpression') {
        // $('selector')
        if (arg.callee?.name === '$' && arg.arguments?.[0]) {
          selector = arg.arguments[0].value;
        }
        // this.page.locator('selector')
        else if (arg.callee?.property?.name === 'locator' && arg.arguments?.[0]) {
          selector = arg.arguments[0].value;
        }
        // this.page.getByTestId('id')
        else if (arg.callee?.property?.name === 'getByTestId' && arg.arguments?.[0]) {
          selector = `getByTestId('${arg.arguments[0].value}')`;
        }
      }
    }
  }
  
  return selector;
}

function normalizeSelector(selector) {
  if (!selector) return '';
  return selector
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isInteractiveType(type) {
  return ['button', 'input', 'link', 'select', 'checkbox', 'icon'].includes(type);
}

function generateLocatorCode(name, selector, isMobile) {
  const escapedSelector = selector.replace(/'/g, "\\'");
  if (isMobile) {
    return `  get ${name}() {
    return $('${escapedSelector}');
  }`;
  }
  return `  get ${name}() {
    return this.page.locator('${escapedSelector}');
  }`;
}

function generateCompoundMethodCode(method, isMobile) {
  const params = method.params.map(p => p.name).join(', ');
  
  // Build JSDoc
  const jsdocLines = [
    '  /**',
    `   * ${method.description}`,
    ...method.params.map(p => `   * @param {${p.type}} ${p.name} - ${p.description}`),
  ];
  if (method.note) {
    jsdocLines.push(`   * @note ${method.note}`);
  }
  jsdocLines.push('   * @returns {Promise<WebdriverIO.Element>}');
  jsdocLines.push('   */');

  // Build method body
  let body;
  if (method.isDynamic) {
    body = `    const conditions = ${method.params[0].name}.map(part => \`contains(@content-desc,'\${part}') or contains(@text,'\${part}')\`).join(' and ');
    return $(\`//*[\${conditions}]\`);`;
  } else if (method.locatorType === 'indexed') {
    const template = method.template.replace('<index+1>', '${index + 1}');
    body = `    return $(\`${template}\`);`;
  } else {
    body = `    return $(\`${method.template}\`);`;
  }

  return `${jsdocLines.join('\n')}
  async ${method.name}(${params}) {
${body}
  }`;
}

function generateActionCode(name, type, isMobile) {
  const methodName = name.charAt(0).toUpperCase() + name.slice(1);
  
  if (type === 'input') {
    if (isMobile) {
      return `  async fill${methodName}(value) {
    await this.${name}.setValue(value);
  }`;
    }
    return `  async fill${methodName}(value) {
    await this.${name}.fill(value);
  }`;
  }
  
  if (type === 'select') {
    if (isMobile) {
      return `  async select${methodName}(value) {
    await this.${name}.click();
    // Select option logic for mobile
  }`;
    }
    return `  async select${methodName}(value) {
    await this.${name}.selectOption(value);
  }`;
  }
  
  // Button, link, icon
  const verb = isMobile ? 'tap' : 'click';
  return `  async ${verb}${methodName}() {
    await this.${name}.click();
  }`;
}

function generateAssertionCode(name, isMobile) {
  const methodName = name.charAt(0).toUpperCase() + name.slice(1);
  return `  async is${methodName}Visible() {
    return await this.${name}.isDisplayed();
  }`;
}

/**
 * Find the actual end line of a section by looking for:
 * 1. The closing brace of the last method in that section
 * 2. A section divider comment
 * 3. The next section header
 */
function findSectionEndLine(lines, lastMethodEndLine, sectionName, classEndLine) {
  if (lastMethodEndLine <= 0) {
    // No methods in this section yet, find the section header
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(sectionName)) {
        // Find the end of the section header block
        for (let j = i + 1; j < lines.length; j++) {
          const line = lines[j].trim();
          if (line === '' || line.startsWith('//')) {
            continue;
          }
          // Return the line before the first actual code
          return j - 1;
        }
        return i + 1;
      }
    }
    return classEndLine - 1;
  }

  // We have methods, find where the last one ends
  // lastMethodEndLine is 1-indexed, convert to 0-indexed
  const endIndex = lastMethodEndLine - 1;
  
  // Verify this line has the closing brace
  if (endIndex >= 0 && endIndex < lines.length) {
    const line = lines[endIndex].trim();
    if (line === '}' || line.endsWith('}')) {
      return endIndex;
    }
  }
  
  // If not, scan forward to find the closing brace
  for (let i = endIndex; i < Math.min(endIndex + 5, lines.length); i++) {
    if (lines[i].trim() === '}') {
      return i;
    }
  }
  
  return endIndex;
}

export default POMComparator;