// packages/web-app/src/utils/requiresColors.js

// Color palette for requires conditions
const REQUIRES_COLORS = [
  '#A855F7',  // Purple
  '#F59E0B',  // Amber  
  '#EC4899',  // Pink
  '#14B8A6',  // Teal
  '#F97316',  // Orange
  '#6366F1',  // Indigo
  '#EF4444',  // Red
  '#84CC16',  // Lime
  '#06B6D4',  // Cyan
  '#8B5CF6',  // Violet
];

/**
 * Generate consistent hash from string
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get color for a requires condition
 * Same key+value always gets same color
 */
export function getRequiresColor(key, value) {
  const colorKey = `${key}:${value}`;
  const hash = hashString(colorKey);
  return REQUIRES_COLORS[hash % REQUIRES_COLORS.length];
}

/**
 * Get color for entire requires object (uses first condition)
 */
export function getRequiresObjectColor(requires) {
  if (!requires || typeof requires !== 'object') return null;
  const entries = Object.entries(requires);
  if (entries.length === 0) return null;
  const [key, value] = entries[0];
  return getRequiresColor(key, value);
}

/**
 * Format requires for label
 */
export function formatRequiresLabel(requires) {
  if (!requires || typeof requires !== 'object' || Object.keys(requires).length === 0) {
    return '';
  }
  
  const str = Object.entries(requires)
    .map(([k, v]) => {
      if (typeof v === 'boolean') return `${k}:${v}`;
      if (typeof v === 'string') return `${k}:"${v}"`;
      return `${k}:${JSON.stringify(v)}`;
    })
    .join(', ');
    
  return `[${str}]`;
}

// ============================================================
// SUGGESTIONS SYSTEM
// ============================================================

let knownRequires = new Map();

export function registerRequires(key, value) {
  if (!knownRequires.has(key)) {
    knownRequires.set(key, new Set());
  }
  knownRequires.get(key).add(JSON.stringify(value));
}

export function registerRequiresFromObject(requires) {
  if (!requires || typeof requires !== 'object') return;
  Object.entries(requires).forEach(([key, value]) => {
    registerRequires(key, value);
  });
}

export function getRequiresSuggestions() {
  const suggestions = [];
  knownRequires.forEach((values, key) => {
    values.forEach(valueStr => {
      const value = JSON.parse(valueStr);
      suggestions.push({
        key,
        value,
        label: `${key}: ${typeof value === 'string' ? `"${value}"` : value}`,
        color: getRequiresColor(key, value)
      });
    });
  });
  return suggestions;
}

export function getKnownKeys() {
  return Array.from(knownRequires.keys());
}

export function clearRequiresCache() {
  knownRequires.clear();
}

export function initializeFromDiscovery(discoveryResult) {
  clearRequiresCache();
  
  const { transitions = [], files = {} } = discoveryResult;
  
  // From transitions
  transitions.forEach(t => {
    if (t.requires) registerRequiresFromObject(t.requires);
  });
  
  // From implications setup
  const implications = files.implications || [];
  implications.forEach(imp => {
    const setup = imp.metadata?.setup;
    if (Array.isArray(setup)) {
      setup.forEach(s => {
        if (s.requires) registerRequiresFromObject(s.requires);
      });
    } else if (setup?.requires) {
      registerRequiresFromObject(setup.requires);
    }
  });
  
  console.log('📦 Requires cache initialized:', getRequiresSuggestions());
}

export default {
  getRequiresColor,
  getRequiresObjectColor,
  formatRequiresLabel,
  registerRequires,
  registerRequiresFromObject,
  getRequiresSuggestions,
  getKnownKeys,
  clearRequiresCache,
  initializeFromDiscovery
};