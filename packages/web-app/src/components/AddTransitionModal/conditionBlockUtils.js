// packages/web-app/src/components/AddTransitionModal/conditionBlockUtils.js
// Condition block utilities for transition conditions

/**
 * Condition block type constants
 */
export const CONDITION_BLOCK_TYPES = {
  CONDITION_CHECK: 'condition-check',
  CUSTOM_CODE: 'custom-code'
};

/**
 * Block type metadata for UI rendering
 */
export const CONDITION_BLOCK_TYPE_META = {
  [CONDITION_BLOCK_TYPES.CONDITION_CHECK]: {
    icon: '📋',
    label: 'Condition Check',
    color: 'purple',
    description: 'Check field values with operators'
  },
  [CONDITION_BLOCK_TYPES.CUSTOM_CODE]: {
    icon: '💻',
    label: 'Custom Code',
    color: 'blue',
    description: 'JavaScript that returns true/false'
  }
};

/**
 * Available operators for condition checks
 */
export const OPERATORS = {
  // Equality
  equals: { label: '=', description: 'equals', needsValue: true, valueType: 'any' },
  notEquals: { label: '≠', description: 'not equals', needsValue: true, valueType: 'any' },
  
  // Comparison (numbers)
  greaterThan: { label: '>', description: 'greater than', needsValue: true, valueType: 'number' },
  greaterThanOrEqual: { label: '>=', description: 'greater or equal', needsValue: true, valueType: 'number' },
  lessThan: { label: '<', description: 'less than', needsValue: true, valueType: 'number' },
  lessThanOrEqual: { label: '<=', description: 'less or equal', needsValue: true, valueType: 'number' },
  
  // String operations
  contains: { label: 'contains', description: 'contains', needsValue: true, valueType: 'string' },
  notContains: { label: '∌', description: 'not contains', needsValue: true, valueType: 'string' },
  startsWith: { label: 'starts', description: 'starts with', needsValue: true, valueType: 'string' },
  endsWith: { label: 'ends', description: 'ends with', needsValue: true, valueType: 'string' },
  matches: { label: '~', description: 'regex match', needsValue: true, valueType: 'string' },
  
  // List operations
  in: { label: 'in', description: 'in list', needsValue: true, valueType: 'array' },
  notIn: { label: '∉', description: 'not in list', needsValue: true, valueType: 'array' },
  
  // Existence/truthiness
  exists: { label: '∃', description: 'exists', needsValue: false },
  notExists: { label: '∄', description: 'not exists', needsValue: false },
  truthy: { label: '✓', description: 'is truthy', needsValue: false },
  falsy: { label: '✗', description: 'is falsy', needsValue: false }
};

/**
 * Operator groups for UI dropdown
 */
export const OPERATOR_GROUPS = [
  {
    label: 'Equality',
    operators: ['equals', 'notEquals']
  },
  {
    label: 'Comparison',
    operators: ['greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual']
  },
  {
    label: 'String',
    operators: ['contains', 'notContains', 'startsWith', 'endsWith', 'matches']
  },
  {
    label: 'List',
    operators: ['in', 'notIn']
  },
  {
    label: 'Existence',
    operators: ['exists', 'notExists', 'truthy', 'falsy']
  }
];

/**
 * Generate unique block ID
 */
export const generateConditionBlockId = (type) => {
  const prefix = type === CONDITION_BLOCK_TYPES.CONDITION_CHECK ? 'check' : 'code';
  return `cond_${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
};

/**
 * Create a new condition-check block
 */
export const createConditionCheckBlock = (data = {}) => ({
  id: generateConditionBlockId(CONDITION_BLOCK_TYPES.CONDITION_CHECK),
  type: CONDITION_BLOCK_TYPES.CONDITION_CHECK,
  label: data.label || 'Field Checks',
  order: data.order ?? 0,
  expanded: true,
  enabled: true,
  mode: data.mode || 'all', // 'all' = AND, 'any' = OR
  data: {
    checks: data.checks || []
  }
});

/**
 * Create a new custom-code condition block
 */
export const createConditionCodeBlock = (data = {}) => ({
  id: generateConditionBlockId(CONDITION_BLOCK_TYPES.CUSTOM_CODE),
  type: CONDITION_BLOCK_TYPES.CUSTOM_CODE,
  label: data.label || 'Custom Condition',
  order: data.order ?? 0,
  expanded: true,
  enabled: true,
  code: data.code || '// Return true if condition is met\nreturn testData.field === expectedValue;',
  description: data.description || ''
});

/**
 * Create an empty check item
 */
export const createEmptyCheck = () => ({
  id: `chk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  field: '',
  operator: 'equals',
  value: '',
  valueType: 'string' // 'string', 'number', 'boolean', 'variable'
});

/**
 * Convert legacy requires object to condition blocks
 * 
 * @param {Object} requires - Legacy requires object { field: value, ... }
 * @returns {Object} Conditions object with blocks array
 */
export const migrateRequiresToConditions = (requires) => {
  if (!requires || Object.keys(requires).length === 0) {
    return null;
  }

  const checks = Object.entries(requires).map(([field, value]) => ({
    id: `chk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    field,
    operator: 'equals',
    value,
    valueType: typeof value === 'boolean' ? 'boolean' 
             : typeof value === 'number' ? 'number' 
             : 'string'
  }));

  return {
    mode: 'all',
    blocks: [
      createConditionCheckBlock({
        label: 'Migrated Conditions',
        checks
      })
    ]
  };
};

/**
 * Convert condition blocks back to simple requires format
 * (for backward compatibility)
 * 
 * Only works if ALL conditions are simple equals checks in a single block
 */
export const conditionsToRequires = (conditions) => {
  if (!conditions || !conditions.blocks || conditions.blocks.length === 0) {
    return null;
  }

  // Can only convert if single condition-check block with all 'equals' operators
  if (conditions.blocks.length !== 1) return null;
  
  const block = conditions.blocks[0];
  if (block.type !== CONDITION_BLOCK_TYPES.CONDITION_CHECK) return null;
  if (!block.enabled) return null;
  
  const checks = block.data?.checks || [];
  if (checks.some(c => c.operator !== 'equals')) return null;

  // Convert to simple requires object
  const requires = {};
  checks.forEach(check => {
    if (check.field && check.enabled !== false) {
      requires[check.field] = check.value;
    }
  });

  return Object.keys(requires).length > 0 ? requires : null;
};

/**
 * Check if conditions can be represented as simple requires
 */
export const canConvertToSimpleRequires = (conditions) => {
  return conditionsToRequires(conditions) !== null;
};

/**
 * Sort blocks by order
 */
export const sortConditionBlocks = (blocks) => {
  return [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Reindex block orders after reorder
 */
export const reindexConditionBlockOrders = (blocks) => {
  return blocks.map((block, index) => ({
    ...block,
    order: index
  }));
};

/**
 * Update a block in the array
 */
export const updateConditionBlock = (blocks, id, updates) => {
  return blocks.map(block => 
    block.id === id ? { ...block, ...updates } : block
  );
};

/**
 * Delete a block and reindex
 */
export const deleteConditionBlock = (blocks, id) => {
  return reindexConditionBlockOrders(blocks.filter(b => b.id !== id));
};

/**
 * Add a new block at position
 */
export const addConditionBlockAtPosition = (blocks, newBlock, position = -1) => {
  const pos = position === -1 ? blocks.length : position;
  const newBlocks = [...blocks];
  newBlocks.splice(pos, 0, { ...newBlock, order: pos });
  return reindexConditionBlockOrders(newBlocks);
};

/**
 * Duplicate a block
 */
export const duplicateConditionBlock = (blocks, id) => {
  const sourceIndex = blocks.findIndex(b => b.id === id);
  if (sourceIndex === -1) return blocks;
  
  const source = blocks[sourceIndex];
  const duplicate = {
    ...JSON.parse(JSON.stringify(source)),
    id: generateConditionBlockId(source.type),
    label: `${source.label} (copy)`
  };
  
  return addConditionBlockAtPosition(blocks, duplicate, sourceIndex + 1);
};

/**
 * Get summary text for a condition block (collapsed state)
 */
export const getConditionBlockSummary = (block) => {
  switch (block.type) {
    case CONDITION_BLOCK_TYPES.CONDITION_CHECK: {
      const checks = block.data?.checks || [];
      const enabled = checks.filter(c => c.enabled !== false);
      if (enabled.length === 0) return 'No checks';
      if (enabled.length === 1) {
        const c = enabled[0];
        const op = OPERATORS[c.operator];
        if (op?.needsValue) {
          return `${c.field} ${op.label} ${formatValue(c.value)}`;
        }
        return `${c.field} ${op?.label || c.operator}`;
      }
      return `${enabled.length} checks (${block.mode === 'all' ? 'ALL' : 'ANY'})`;
    }
    
    case CONDITION_BLOCK_TYPES.CUSTOM_CODE: {
      const lines = (block.code || '').split('\n').filter(l => l.trim()).length;
      return `${lines} line${lines !== 1 ? 's' : ''}`;
    }
    
    default:
      return '';
  }
};

/**
 * Format a value for display
 */
export const formatValue = (value) => {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value.startsWith('{{') && value.endsWith('}}')) {
      return value; // Variable reference
    }
    return `"${value}"`;
  }
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  return JSON.stringify(value);
};

/**
 * Parse a value from string input based on type
 */
export const parseValue = (input, valueType) => {
  if (valueType === 'boolean') {
    return input === 'true' || input === true;
  }
  if (valueType === 'number') {
    const num = Number(input);
    return isNaN(num) ? 0 : num;
  }
  if (valueType === 'array') {
    if (Array.isArray(input)) return input;
    return input.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (valueType === 'variable') {
    // Ensure wrapped in {{}}
    if (input.startsWith('{{') && input.endsWith('}}')) return input;
    return `{{${input}}}`;
  }
  return input; // string
};

/**
 * Validate a condition block
 */
export const validateConditionBlock = (block) => {
  const errors = [];
  
  if (block.type === CONDITION_BLOCK_TYPES.CONDITION_CHECK) {
    const checks = block.data?.checks || [];
    checks.forEach((check, i) => {
      if (!check.field) {
        errors.push(`Check ${i + 1}: Field is required`);
      }
      const op = OPERATORS[check.operator];
      if (op?.needsValue && (check.value === '' || check.value === undefined)) {
        errors.push(`Check ${i + 1}: Value is required for "${op.description}"`);
      }
    });
  }
  
  if (block.type === CONDITION_BLOCK_TYPES.CUSTOM_CODE) {
    if (!block.code || !block.code.trim()) {
      errors.push('Code is required');
    }
  }
  
  return errors;
};

/**
 * Validate all condition blocks
 */
export const validateConditions = (conditions) => {
  if (!conditions || !conditions.blocks) return [];
  
  const allErrors = [];
  conditions.blocks.forEach((block, i) => {
    const blockErrors = validateConditionBlock(block);
    blockErrors.forEach(err => {
      allErrors.push(`Block ${i + 1} (${block.label}): ${err}`);
    });
  });
  
  return allErrors;
};