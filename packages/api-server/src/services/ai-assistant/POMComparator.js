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
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['classProperties']
      });

      const result = {
        filePath,
        className: null,
        locators: [],      // { name, selector, line }
        actions: [],       // { name, params, line }
        assertions: [],    // { name, line }
        customMethods: [], // { name, code, line }
        hasConstructor: false,
        isMobile: false,   // Uses $() vs this.page
        rawContent: content
      };

      traverse(ast, {
        ClassDeclaration(path) {
          result.className = path.node.id.name;
        },

        ClassMethod(path) {
          const methodName = path.node.key.name;
          const line = path.node.loc?.start.line;

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
              line,
              node: path.node
            });

            // Detect mobile vs web
            if (selector && !selector.includes('this.page')) {
              result.isMobile = true;
            }
            return;
          }

          // Regular method - categorize
          if (methodName.startsWith('tap') || methodName.startsWith('click') ||
              methodName.startsWith('fill') || methodName.startsWith('select') ||
              methodName.startsWith('enter') || methodName.startsWith('type')) {
            result.actions.push({
              name: methodName,
              params: path.node.params.map(p => p.name),
              line,
              node: path.node
            });
          } else if (methodName.startsWith('is') && methodName.endsWith('Visible')) {
            result.assertions.push({
              name: methodName,
              line,
              node: path.node
            });
          } else {
            // Custom method - preserve as-is
            const code = generate(path.node).code;
            result.customMethods.push({
              name: methodName,
              code,
              line,
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
            line: existing.line
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
          line: existing.line
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
      generateAssertions = true
    } = options;

    const content = existingPOM.rawContent;
    const lines = content.split('\n');
    
    const replacements = [];

    // Find where locators section ends
    let lastLocatorLine = 0;
    let lastActionLine = 0;
    let lastAssertionLine = 0;
    let classEndLine = lines.length - 1;

    for (const loc of existingPOM.locators) {
      if (loc.line > lastLocatorLine) lastLocatorLine = loc.line;
    }
    for (const action of existingPOM.actions) {
      if (action.line > lastActionLine) lastActionLine = action.line;
    }
    for (const assertion of existingPOM.assertions) {
      if (assertion.line > lastAssertionLine) lastAssertionLine = assertion.line;
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

    // Handle changed selectors
    if (updateChanged) {
      for (const item of diff.changed) {
        // Find the line with the old selector and replace
        const lineIndex = item.line - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          const oldLine = lines[lineIndex];
          // Replace selector in the return statement
          const newLine = oldLine.replace(
            /\$\(['"`].*?['"`]\)/,
            `$('${item.newSelector}')`
          ).replace(
            /this\.page\.locator\(['"`].*?['"`]\)/,
            `this.page.locator('${item.newSelector}')`
          );
          replacements.push({ line: lineIndex, content: newLine });
        }
      }
    }

    // Build the new content
    let newContent = [...lines];

    // Apply replacements first
    for (const rep of replacements) {
      newContent[rep.line] = rep.content;
    }

    // Find insertion points and insert new code
    const locatorInsertPoint = findInsertionPoint(newContent, lastLocatorLine, 'LOCATORS');
    const actionInsertPoint = findInsertionPoint(newContent, lastActionLine || locatorInsertPoint, 'ACTIONS');
    const assertionInsertPoint = findInsertionPoint(newContent, lastAssertionLine || actionInsertPoint, 'ASSERTIONS');

    // Insert in reverse order to preserve line numbers
    if (newAssertions.length > 0) {
      const insertLine = Math.min(assertionInsertPoint + 1, classEndLine);
      newContent.splice(insertLine, 0, '', ...newAssertions);
    }
    
    if (newActions.length > 0) {
      const insertLine = Math.min(actionInsertPoint + 1, classEndLine);
      newContent.splice(insertLine, 0, '', ...newActions);
    }
    
    if (newLocators.length > 0) {
      const insertLine = Math.min(locatorInsertPoint + 1, classEndLine);
      newContent.splice(insertLine, 0, '', ...newLocators);
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
  if (isMobile) {
    return `  get ${name}() {
    return $('${selector}');
  }`;
  }
  return `  get ${name}() {
    return this.page.locator('${selector}');
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

function findInsertionPoint(lines, startLine, sectionName) {
  // Look for section comment
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes(sectionName)) {
      // Find next empty line or next section
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '' || lines[j].includes('═══')) {
          return j - 1;
        }
      }
    }
  }
  return startLine;
}

export default POMComparator;