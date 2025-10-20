import { DISCOVERY_TYPES } from '../types/discovery.js';

/**
 * Detect if file is a Screen object
 */
export function isScreen(parsed) {
  const classes = parsed.classes || [];
  
  return classes.some(cls => {
    const name = cls.name || '';
    return name.endsWith('Screen') || name.includes('Page');
  });
}

/**
 * Extract screen metadata
 */
export function extractScreenMetadata(parsed) {
  const cls = parsed.classes[0];
  if (!cls) return null;
  
  return {
    className: cls.name,
    type: DISCOVERY_TYPES.SCREEN,
    methods: cls.methods.map(m => ({
      name: m.name,
      async: m.async,
      params: m.params,
    })),
    hasConstructor: cls.methods.some(m => m.name === 'constructor'),
    hasLocators: cls.methods.length > 0,
  };
}