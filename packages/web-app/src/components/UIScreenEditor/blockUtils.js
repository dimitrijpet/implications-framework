// packages/web-app/src/components/UIScreenEditor/blockUtils.js
// Block architecture utilities for Hybrid Test Builder

/**
 * Block type constants
 */
export const BLOCK_TYPES = {
  UI_ASSERTION: 'ui-assertion',
  CUSTOM_CODE: 'custom-code',
  FUNCTION_CALL: 'function-call'
};

/**
 * Block type metadata for UI rendering
 */
export const BLOCK_TYPE_META = {
  [BLOCK_TYPES.UI_ASSERTION]: {
    icon: '📋',
    label: 'UI Assertion',
    color: 'green',
    description: 'Check element visibility and text content'
  },
  [BLOCK_TYPES.CUSTOM_CODE]: {
    icon: '💻',
    label: 'Custom Code',
    color: 'blue',
    description: 'Custom Playwright code snippet'
  },
  [BLOCK_TYPES.FUNCTION_CALL]: {
    icon: '⚡',
    label: 'Function Call',
    color: 'purple',
    description: 'Call a POM method'
  }
};

/**
 * Generate unique block ID
 */
export const generateBlockId = (type) => {
  const prefix = type === BLOCK_TYPES.UI_ASSERTION ? 'ui' 
               : type === BLOCK_TYPES.CUSTOM_CODE ? 'code' 
               : 'func';
  return `blk_${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
};

/**
 * Create a new UI Assertion block
 */
export const createUIAssertionBlock = (data = {}) => ({
  id: generateBlockId(BLOCK_TYPES.UI_ASSERTION),
  type: BLOCK_TYPES.UI_ASSERTION,
  label: data.label || 'Visibility Check',
  order: data.order ?? 0,
  expanded: true,
  enabled: true,
  data: {
    visible: data.visible || [],
    hidden: data.hidden || [],
    checks: {
      text: data.checks?.text || {},
      contains: data.checks?.contains || {}
    },
    truthy: data.truthy || [],
    falsy: data.falsy || [],
    assertions: data.assertions || [],
    timeout: data.timeout || 30000
  }
});

/**
 * Create a new Custom Code block
 */
export const createCustomCodeBlock = (data = {}) => ({
  id: generateBlockId(BLOCK_TYPES.CUSTOM_CODE),
  type: BLOCK_TYPES.CUSTOM_CODE,
  label: data.label || 'Custom Code',
  order: data.order ?? 0,
  expanded: true,
  enabled: true,
  code: data.code || '',
  wrapInTestStep: data.wrapInTestStep ?? true,
  testStepName: data.testStepName || '',
  dependencies: {
    poms: data.dependencies?.poms || [],
    imports: data.dependencies?.imports || []
  }
});

/**
 * Create a new Function Call block
 */
export const createFunctionCallBlock = (data = {}) => ({
  id: generateBlockId(BLOCK_TYPES.FUNCTION_CALL),
  type: BLOCK_TYPES.FUNCTION_CALL,
  label: data.label || 'Function Call',
  order: data.order ?? 0,
  expanded: false,
  enabled: true,
  data: {
    instance: data.instance || '',
    method: data.method || '',
    args: data.args || [],
    await: data.await ?? true,
    storeAs: data.storeAs || ''
  }
});

/**
 * Check if screen uses old format (no blocks array)
 */
export const isLegacyFormat = (screen) => {
  return !screen.blocks && (
    screen.visible?.length > 0 ||
    screen.hidden?.length > 0 ||
    Object.keys(screen.checks || {}).length > 0 ||
    Object.keys(screen.functions || {}).length > 0 ||
    screen.truthy?.length > 0 ||
    screen.falsy?.length > 0 ||
    screen.assertions?.length > 0
  );
};

/**
 * Migrate legacy screen format to blocks format
 * 
 * Old format:
 * { visible: [...], hidden: [...], checks: {...}, functions: {...}, truthy: [...], falsy: [...] }
 * 
 * New format:
 * { blocks: [{ type: 'ui-assertion', data: {...} }, { type: 'function-call', data: {...} }] }
 */
export const migrateToBlocksFormat = (screen) => {
  if (!isLegacyFormat(screen)) {
    // Already in blocks format or empty
    return screen.blocks || [];
  }

  const blocks = [];
  let order = 0;

  // 1. Create UI Assertion block from visible/hidden/checks/truthy/falsy/assertions
  const hasUIAssertions = 
    screen.visible?.length > 0 ||
    screen.hidden?.length > 0 ||
    Object.keys(screen.checks?.text || {}).length > 0 ||
    Object.keys(screen.checks?.contains || {}).length > 0 ||
    screen.truthy?.length > 0 ||
    screen.falsy?.length > 0 ||
    screen.assertions?.length > 0;

  if (hasUIAssertions) {
    blocks.push(createUIAssertionBlock({
      label: 'Main Assertions',
      order: order++,
      visible: screen.visible || [],
      hidden: screen.hidden || [],
      checks: screen.checks || {},
      truthy: screen.truthy || [],
      falsy: screen.falsy || [],
      assertions: screen.assertions || []
    }));
  }

  // 2. Create Function Call blocks from functions object
  const functions = screen.functions || {};
  Object.entries(functions).forEach(([funcName, funcData]) => {
    blocks.push(createFunctionCallBlock({
      label: funcData.signature || funcName,
      order: order++,
      instance: screen.instance || '',
      method: funcName,
      args: Object.values(funcData.parameters || {}),
      storeAs: funcData.storeAs || ''
    }));
  });

  return blocks;
};

/**
 * Convert blocks format back to legacy format for saving
 * (for backward compatibility with existing code generators)
 */
export const blocksToLegacyFormat = (blocks) => {
  const legacy = {
    visible: [],
    hidden: [],
    checks: {
      text: {},
      contains: {}
    },
    functions: {},
    truthy: [],
    falsy: [],
    assertions: []
  };

  blocks.forEach(block => {
    if (!block.enabled) return; // Skip disabled blocks

    switch (block.type) {
      case BLOCK_TYPES.UI_ASSERTION:
        // Merge UI assertion data
        legacy.visible = [...legacy.visible, ...(block.data.visible || [])];
        legacy.hidden = [...legacy.hidden, ...(block.data.hidden || [])];
        legacy.truthy = [...legacy.truthy, ...(block.data.truthy || [])];
        legacy.falsy = [...legacy.falsy, ...(block.data.falsy || [])];
        legacy.assertions = [...legacy.assertions, ...(block.data.assertions || [])];
        
        // Merge text checks
        Object.assign(legacy.checks.text, block.data.checks?.text || {});
        Object.assign(legacy.checks.contains, block.data.checks?.contains || {});
        break;

      case BLOCK_TYPES.FUNCTION_CALL:
        // Add to functions object
        const funcName = block.data.method;
        if (funcName) {
          legacy.functions[funcName] = {
            name: funcName,
            signature: `${block.data.instance}.${funcName}()`,
            parameters: block.data.args.reduce((acc, arg, i) => {
              acc[`arg${i}`] = arg;
              return acc;
            }, {}),
            ...(block.data.storeAs ? { storeAs: block.data.storeAs } : {})
          };
        }
        break;

      case BLOCK_TYPES.CUSTOM_CODE:
        // Custom code blocks need special handling in generator
        // For now, store as _customBlocks for the template engine
        if (!legacy._customBlocks) legacy._customBlocks = [];
        legacy._customBlocks.push({
          code: block.code,
          wrapInTestStep: block.wrapInTestStep,
          testStepName: block.testStepName,
          order: block.order,
          dependencies: block.dependencies
        });
        break;
    }
  });

  // Clean up empty arrays/objects
  if (legacy.visible.length === 0) delete legacy.visible;
  if (legacy.hidden.length === 0) delete legacy.hidden;
  if (legacy.truthy.length === 0) delete legacy.truthy;
  if (legacy.falsy.length === 0) delete legacy.falsy;
  if (legacy.assertions.length === 0) delete legacy.assertions;
  if (Object.keys(legacy.checks.text).length === 0) delete legacy.checks.text;
  if (Object.keys(legacy.checks.contains).length === 0) delete legacy.checks.contains;
  if (Object.keys(legacy.checks).length === 0) delete legacy.checks;
  if (Object.keys(legacy.functions).length === 0) delete legacy.functions;

  return legacy;
};

/**
 * Reorder blocks by order field
 */
export const sortBlocksByOrder = (blocks) => {
  return [...blocks].sort((a, b) => a.order - b.order);
};

/**
 * Update block orders after reorder
 */
export const reindexBlockOrders = (blocks) => {
  return blocks.map((block, index) => ({
    ...block,
    order: index
  }));
};

/**
 * Find block by ID
 */
export const findBlockById = (blocks, id) => {
  return blocks.find(b => b.id === id);
};

/**
 * Update a block in the array
 */
export const updateBlock = (blocks, id, updates) => {
  return blocks.map(block => 
    block.id === id ? { ...block, ...updates } : block
  );
};

/**
 * Delete a block and reindex
 */
export const deleteBlock = (blocks, id) => {
  return reindexBlockOrders(blocks.filter(b => b.id !== id));
};

/**
 * Add a new block at position
 */
export const addBlockAtPosition = (blocks, newBlock, position = -1) => {
  const pos = position === -1 ? blocks.length : position;
  const newBlocks = [...blocks];
  newBlocks.splice(pos, 0, { ...newBlock, order: pos });
  return reindexBlockOrders(newBlocks);
};

/**
 * Move block from one position to another
 */
export const moveBlock = (blocks, fromIndex, toIndex) => {
  const result = [...blocks];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return reindexBlockOrders(result);
};

/**
 * Duplicate a block
 */
export const duplicateBlock = (blocks, id) => {
  const sourceIndex = blocks.findIndex(b => b.id === id);
  if (sourceIndex === -1) return blocks;
  
  const source = blocks[sourceIndex];
  const duplicate = {
    ...JSON.parse(JSON.stringify(source)), // Deep clone
    id: generateBlockId(source.type),
    label: `${source.label} (copy)`
  };
  
  return addBlockAtPosition(blocks, duplicate, sourceIndex + 1);
};

/**
 * Toggle block enabled state
 */
export const toggleBlockEnabled = (blocks, id) => {
  return updateBlock(blocks, id, { 
    enabled: !findBlockById(blocks, id)?.enabled 
  });
};

/**
 * Toggle block expanded state
 */
export const toggleBlockExpanded = (blocks, id) => {
  return updateBlock(blocks, id, { 
    expanded: !findBlockById(blocks, id)?.expanded 
  });
};

/**
 * Expand/collapse all blocks
 */
export const setAllBlocksExpanded = (blocks, expanded) => {
  return blocks.map(block => ({ ...block, expanded }));
};