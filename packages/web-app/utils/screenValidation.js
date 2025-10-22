/**
 * Screen Name Validation
 * 
 * Validates screen names for:
 * - Required field
 * - Length constraints
 * - Valid identifier format
 * - Duplicate prevention
 */

/**
 * Validate screen name
 * @param {string} name - Screen name to validate
 * @param {string} platformName - Target platform name
 * @param {Array} existingScreens - Array of existing screens with {originalName, platform}
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateScreenName = (name, platformName, existingScreens = []) => {
  const errors = [];

  // Required
  if (!name || !name.trim()) {
    errors.push('Screen name is required');
    return { valid: false, errors };
  }

  const trimmedName = name.trim();

  // Length check
  if (trimmedName.length > 50) {
    errors.push('Name too long (max 50 characters)');
  }

  // Valid identifier format
  // Must start with letter or underscore, followed by letters, numbers, or underscores
  const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (!identifierRegex.test(trimmedName)) {
    errors.push('Name must be a valid identifier (letters, numbers, underscores only)');
  }

  // Check for duplicates in same platform
  const duplicate = existingScreens.some(screen => 
    screen.originalName === trimmedName && screen.platform === platformName
  );
  if (duplicate) {
    errors.push('Screen name already exists in this platform');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Check if name follows camelCase convention
 * This is a recommendation, not a requirement
 */
export const isCamelCase = (name) => {
  if (!name) return false;
  // Starts with lowercase, may contain uppercase letters after first char
  return /^[a-z][a-zA-Z0-9]*$/.test(name);
};

/**
 * Get validation hint for user
 */
export const getValidationHint = (name) => {
  if (!name || !name.trim()) {
    return 'Enter a screen name (e.g., myNewScreen)';
  }

  const validation = validateScreenName(name, '', []);
  
  if (!validation.valid) {
    return validation.errors[0];
  }

  if (!isCamelCase(name)) {
    return '💡 Tip: camelCase is recommended (e.g., myNewScreen)';
  }

  return '✓ Valid name';
};

/**
 * Suggest name with copy suffix
 */
export const suggestCopyName = (originalName, existingScreens, platformName) => {
  let suffix = 1;
  let suggestedName = `${originalName}_copy`;

  // Keep incrementing suffix if name exists
  while (existingScreens.some(s => 
    s.originalName === suggestedName && s.platform === platformName
  )) {
    suffix++;
    suggestedName = `${originalName}_copy${suffix}`;
  }

  return suggestedName;
};