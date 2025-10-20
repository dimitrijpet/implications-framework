import { DISCOVERY_TYPES } from '../types/discovery.js';

/**
 * Detect if file is a Section (EnhancedBaseSection child)
 */
export function isSection(parsed) {
  const classes = parsed.classes || [];
  
  return classes.some(cls => {
    const name = cls.name || '';
    const hasSectionSuffix = name.endsWith('Section');
    const extendsEnhanced = cls.superClass === 'EnhancedBaseSection';
    
    return hasSectionSuffix || extendsEnhanced;
  });
}

/**
 * Extract section metadata
 */
export function extractSectionMetadata(parsed) {
  const cls = parsed.classes[0];
  if (!cls) return null;
  
  const metadata = {
    className: cls.name,
    type: DISCOVERY_TYPES.SECTION,
    superClass: cls.superClass,
    hasScenarios: cls.staticProperties.some(p => p.name === 'SCENARIOS'),
    methods: cls.methods.map(m => m.name),
    staticProperties: cls.staticProperties.map(p => p.name),
  };
  
  // Extract scenarios if present
  const scenariosProp = cls.staticProperties.find(p => p.name === 'SCENARIOS');
  if (scenariosProp) {
    metadata.scenarios = scenariosProp.value; // Will be '<Object>' from AST
  }
  
  return metadata;
}