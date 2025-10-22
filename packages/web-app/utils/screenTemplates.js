/**
 * Screen Templates for Add Screen Modal
 * 
 * Provides pre-defined structures for new screens:
 * - simple: Basic screen with visible/hidden arrays
 * - withChecks: Includes top-level text checks
 * - full: Complete structure with nested checks
 */

export const SCREEN_TEMPLATES = {
  simple: {
    id: 'simple',
    name: 'Simple',
    description: 'Basic screen with visible and hidden elements',
    structure: (screenName, description = '') => ({
      name: screenName,
      originalName: screenName,
      ...(description && { description }),
      visible: [],
      hidden: []
    })
  },

  withChecks: {
    id: 'withChecks',
    name: 'With Checks',
    description: 'Screen with visible, hidden, and text checks',
    structure: (screenName, description = '') => ({
      name: screenName,
      originalName: screenName,
      ...(description && { description }),
      visible: [],
      hidden: [],
      checks: {
        text: {}
      }
    })
  },

  full: {
    id: 'full',
    name: 'Full Structure',
    description: 'Complete structure with nested checks',
    structure: (screenName, description = '') => ({
      name: screenName,
      originalName: screenName,
      ...(description && { description }),
      visible: [],
      hidden: [],
      checks: {
        visible: [],
        hidden: [],
        text: {}
      }
    })
  }
};

/**
 * Get template by ID
 */
export const getTemplate = (templateId) => {
  return SCREEN_TEMPLATES[templateId] || SCREEN_TEMPLATES.simple;
};

/**
 * Get all templates as array
 */
export const getAllTemplates = () => {
  return Object.values(SCREEN_TEMPLATES);
};

/**
 * Create screen from template
 */
export const createScreenFromTemplate = (templateId, screenName, description = '') => {
  const template = getTemplate(templateId);
  return template.structure(screenName, description);
};