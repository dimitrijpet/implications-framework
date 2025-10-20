import { DISCOVERY_TYPES } from '../types/discovery.js';

/**
 * Detect if file is an Implication
 */
export function isImplication(parsed) {
  const classes = parsed.classes || [];
  
  return classes.some(cls => {
    const name = cls.name || '';
    const hasImplicationSuffix = name.endsWith('Implications');
    const hasXStateConfig = cls.staticProperties.some(p => p.name === 'xstateConfig');
    const hasMirrorsOn = cls.staticProperties.some(p => p.name === 'mirrorsOn');
    
    return hasImplicationSuffix || hasXStateConfig || hasMirrorsOn;
  });
}

/**
 * Extract implication metadata
 */
export function extractImplicationMetadata(parsed) {
  const cls = parsed.classes[0];
  if (!cls) return null;
  
  const metadata = {
    className: cls.name,
    type: DISCOVERY_TYPES.IMPLICATION,
    hasXStateConfig: cls.staticProperties.some(p => p.name === 'xstateConfig'),
    hasMirrorsOn: cls.staticProperties.some(p => p.name === 'mirrorsOn'),
    hasStatusData: cls.staticMethods.some(m => m.name === 'statusData') ||
                   cls.staticProperties.some(p => p.name === 'statusData'),
    hasValidation: cls.staticMethods.some(m => m.name === 'validateTestData'),
    hasCreateTestData: cls.staticMethods.some(m => m.name === 'createTestData'),
    staticMethods: cls.staticMethods.map(m => m.name),
    staticProperties: cls.staticProperties.map(p => p.name),
  };
  
  // Determine if it's stateful (booking) or stateless (CMS)
  metadata.isStateful = metadata.hasXStateConfig;
  metadata.pattern = metadata.isStateful ? 'booking' : 'cms';
  
  return metadata;
}