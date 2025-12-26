// CompoundLocatorGenerator.js
// Analyzes element patterns and generates smart parameterized locators

export class CompoundLocatorGenerator {
  constructor(platform = 'android') {
    this.platform = platform;
  }

  /**
   * Analyze elements and generate compound locator methods
   * @param {Array} elements - Merged elements with hierarchy data
   * @returns {Object} { patterns, methods, code }
   */
  analyze(elements) {
    const patterns = this.detectPatterns(elements);
    const methods = this.generateMethods(patterns, elements);
    const code = this.generateCode(methods);

    return { patterns, methods, code };
  }

  /**
   * Detect patterns in elements
   */
  detectPatterns(elements) {
    const patterns = {
      sections: [],        // Section headers (Evening, Day, etc.)
      repeatedText: [],    // Same text appearing multiple times
      repeatedLabels: [],  // Same label pattern (Standby, Pending, etc.)
      cards: []            // Detected card groupings
    };

    // 1. Find repeated text/labels
    const labelPrefixes = {};  // "Standby" from "Standby, 0"
    const fullLabels = {};

    for (const el of elements) {
      if (!el.label) continue;
      
      // Track full labels
      fullLabels[el.label] = (fullLabels[el.label] || 0) + 1;
      
      // Track prefixes (first word before comma)
      const prefix = el.label.split(',')[0].trim();
      if (prefix.length >= 2) {
        if (!labelPrefixes[prefix]) labelPrefixes[prefix] = [];
        labelPrefixes[prefix].push(el);
      }
    }

    // Identify repeated patterns (appear 2+ times)
    patterns.repeatedLabels = Object.entries(labelPrefixes)
      .filter(([prefix, els]) => els.length > 1)
      .map(([prefix, els]) => ({
        prefix,
        count: els.length,
        elements: els.map(e => e.name)
      }));

    // 2. Find section markers
    const sectionKeywords = ['Evening', 'Day', 'Morning', 'Night', 'Afternoon', 'Weekly', 'Monthly'];
    patterns.sections = elements.filter(el => 
      el._domMatched && 
      sectionKeywords.some(kw => el.label?.includes(kw)) &&
      el.selectorStrategy !== 'xpath-fallback'
    ).map(el => ({
      name: el.name,
      label: el.label,
      selector: el.selectors?.[0]?.value,
      depth: el.hierarchy?.depth
    }));

    // 3. Detect card patterns by analyzing hierarchy
    patterns.cards = this.detectCards(elements, patterns.sections);

    return patterns;
  }

  /**
   * Detect card/container groupings
   */
  detectCards(elements, sections) {
    const cards = [];

    for (const section of sections) {
      // Find elements that are "near" this section in hierarchy
      const sectionDepth = section.depth || 0;
      const sectionLabel = section.label?.split(',')[0].trim();

      // Elements within 3 levels of depth and appearing after section
      const cardElements = elements.filter(el => {
        if (!el.hierarchy) return false;
        const depthDiff = Math.abs((el.hierarchy.depth || 0) - sectionDepth);
        return depthDiff <= 5 && el.name !== section.name;
      });

      // Group by looking for repeated status patterns within this card
      const statuses = cardElements.filter(el => 
        ['Pending', 'Accepted', 'Standby', 'Rejected', 'Invited', 'Ck-in/out', 'Checked'].some(s => 
          el.label?.includes(s)
        )
      );

      if (statuses.length > 0) {
        cards.push({
          sectionName: sectionLabel,
          sectionSelector: section.selector,
          statuses: statuses.map(s => ({
            name: s.name,
            label: s.label,
            statusType: s.label?.split(',')[0].trim()
          }))
        });
      }
    }

    return cards;
  }

  /**
   * Generate smart methods based on patterns
   */
  generateMethods(patterns, elements) {
    const methods = [];

    // 1. Generate section-based status getter if we have sections + repeated statuses
    if (patterns.sections.length > 0 && patterns.repeatedLabels.length > 0) {
      methods.push({
        name: 'getStatusInSection',
        description: 'Get a status element within a specific section (Evening, Day, etc.)',
        params: [
          { name: 'section', type: 'string', description: 'Section name: "Evening", "Day", etc.' },
          { name: 'status', type: 'string', description: 'Status type: "Pending", "Accepted", "Standby", etc.' }
        ],
        returnsMultiple: false,
        locatorType: 'xpath-compound',
        template: this.platform === 'android' 
          ? `//android.view.ViewGroup[descendant::*[@text='\${section}']]//descendant::*[contains(@content-desc,'\${status}') or contains(@text,'\${status}')]`
          : `//XCUIElementTypeOther[descendant::*[@label='\${section}']]//descendant::*[contains(@label,'\${status}')]`
      });
    }

    // 2. Generate card/booking getter if detected
    if (patterns.cards.length > 0) {
      methods.push({
        name: 'getBookingCard',
        description: 'Get a booking card by type and time range',
        params: [
          { name: 'type', type: 'string', description: 'Booking type: "Evening", "Day", etc.' },
          { name: 'timeRange', type: 'string', description: 'Time range: "4:00pm - 12:00am"' }
        ],
        returnsMultiple: false,
        locatorType: 'xpath-compound',
        template: this.platform === 'android'
          ? `//android.view.ViewGroup[descendant::*[@text='\${type}'] and descendant::*[@text='\${timeRange}']]`
          : `//XCUIElementTypeOther[descendant::*[@label='\${type}'] and descendant::*[@label='\${timeRange}']]`
      });

      methods.push({
        name: 'getStatusInCard',
        description: 'Get a status element within a specific booking card',
        params: [
          { name: 'type', type: 'string', description: 'Booking type: "Evening", "Day"' },
          { name: 'timeRange', type: 'string', description: 'Time range' },
          { name: 'status', type: 'string', description: 'Status: "Accepted", "Pending", etc.' }
        ],
        returnsMultiple: false,
        locatorType: 'chained',
        template: this.platform === 'android'
          ? `//android.view.ViewGroup[descendant::*[@text='\${type}'] and descendant::*[@text='\${timeRange}']]//descendant::*[contains(@content-desc,'\${status}') or contains(@text,'\${status}')]`
          : `//XCUIElementTypeOther[descendant::*[@label='\${type}'] and descendant::*[@label='\${timeRange}']]//descendant::*[contains(@label,'\${status}')]`
      });
    }

    // 3. Generate MANAGE button getter per section
    const manageButtons = elements.filter(el => el.label?.includes('MANAGE'));
    if (manageButtons.length > 1 && patterns.sections.length > 0) {
      methods.push({
        name: 'getManageButtonInSection',
        description: 'Get the MANAGE button within a specific section',
        params: [
          { name: 'section', type: 'string', description: 'Section name: "Evening", "Day"' }
        ],
        returnsMultiple: false,
        locatorType: 'xpath-compound',
        template: this.platform === 'android'
          ? `//android.view.ViewGroup[descendant::*[@text='\${section}']]//descendant::*[@text='MANAGE' or contains(@content-desc,'MANAGE')]`
          : `//XCUIElementTypeOther[descendant::*[@label='\${section}']]//descendant::*[@label='MANAGE']`
      });
    }

    // 4. Generate indexed getter for repeated elements
    for (const repeated of patterns.repeatedLabels) {
      if (repeated.count >= 2) {
        methods.push({
          name: `get${repeated.prefix.replace(/[^a-zA-Z]/g, '')}ByIndex`,
          description: `Get ${repeated.prefix} element by index (0-based). Found ${repeated.count} instances.`,
          params: [
            { name: 'index', type: 'number', description: `Index 0-${repeated.count - 1}` }
          ],
          returnsMultiple: false,
          locatorType: 'indexed',
          template: this.platform === 'android'
            ? `(//*[contains(@text,'${repeated.prefix}') or contains(@content-desc,'${repeated.prefix}')])[<index+1>]`
            : `(//XCUIElementTypeAny[contains(@label,'${repeated.prefix}')])[<index+1>]`,
          note: `Elements: ${repeated.elements.join(', ')}`
        });
      }
    }

    // 5. Generate content-desc compound matcher
    methods.push({
      name: 'getByContentDesc',
      description: 'Get element by partial content-desc/accessibility label match',
      params: [
        { name: 'parts', type: 'string[]', description: 'Parts to match in content-desc' }
      ],
      returnsMultiple: false,
      locatorType: 'dynamic',
      template: 'dynamic - see implementation',
      isDynamic: true
    });

    return methods;
  }

  /**
   * Generate actual code for the methods
   */
  generateCode(methods) {
    const lines = [
      '// ═══════════════════════════════════════════════════════════════',
      '// COMPOUND LOCATORS (Auto-generated)',
      '// Smart parameterized methods for complex element selection',
      '// ═══════════════════════════════════════════════════════════════',
      ''
    ];

    for (const method of methods) {
      // JSDoc
      lines.push('/**');
      lines.push(` * ${method.description}`);
      for (const param of method.params) {
        lines.push(` * @param {${param.type}} ${param.name} - ${param.description}`);
      }
      if (method.note) {
        lines.push(` * @note ${method.note}`);
      }
      lines.push(' * @returns {Promise<WebdriverIO.Element>}');
      lines.push(' */');

      // Method signature
      const paramList = method.params.map(p => p.name).join(', ');
      
      if (method.isDynamic) {
        // Dynamic method needs special handling
        lines.push(`async ${method.name}(${paramList}) {`);
        lines.push(`  const conditions = ${method.params[0].name}.map(part => \`contains(@content-desc,'\${part}') or contains(@text,'\${part}')\`).join(' and ');`);
        lines.push(`  return $(\`//*[\${conditions}]\`);`);
        lines.push('}');
      } else if (method.locatorType === 'indexed') {
        lines.push(`async ${method.name}(${paramList}) {`);
        const xpath = method.template.replace('<index+1>', '${index + 1}');
        lines.push(`  return $(\`${xpath}\`);`);
        lines.push('}');
      } else {
        lines.push(`async ${method.name}(${paramList}) {`);
        // Convert template to template literal
        const selector = method.template
          .replace(/\$\{/g, '${')  // Already template syntax
          .replace(/'/g, "'");
        lines.push(`  return $(\`${selector}\`);`);
        lines.push('}');
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate a summary of detected patterns
   */
  generatePatternSummary(patterns) {
    const summary = [];
    
    if (patterns.sections.length > 0) {
      summary.push(`📑 Sections detected: ${patterns.sections.map(s => s.label?.split(',')[0]).join(', ')}`);
    }
    
    if (patterns.repeatedLabels.length > 0) {
      summary.push(`🔁 Repeated elements: ${patterns.repeatedLabels.map(r => `${r.prefix} (×${r.count})`).join(', ')}`);
    }
    
    if (patterns.cards.length > 0) {
      summary.push(`🎴 Card patterns: ${patterns.cards.length} booking cards detected`);
    }

    return summary;
  }
}

export default CompoundLocatorGenerator;