/**
 * Screen Name Validation
 * 
 * Validates screen names for:
 * - Required field
 * - Length constraints
 * - Valid identifier format
 * - Duplicate prevention
 * 
 * ✅ Compatible with both formats:
 *    - Array: [{ originalName, platform }]
 *    - Object: { "screenName": {...} }
 */

/**
 * Validate screen name
 * @param {string} name - Screen name to validate
 * @param {string} platformName - Target platform name
 * @param {Array|Object} existingScreens - Array of {originalName, platform} OR object with screen names as keys
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

  // ✅ FIX: Check for duplicates - handle both array and object formats
  let duplicate = false;
  
  if (Array.isArray(existingScreens)) {
    // Original format: Array of {originalName, platform}
    duplicate = existingScreens.some(screen => 
      screen.originalName === trimmedName && screen.platform === platformName
    );
  } else if (existingScreens && typeof existingScreens === 'object') {
    // New format: Object with screen names as keys (from mirrorsOn.UI[platform])
    duplicate = Object.keys(existingScreens).some(screenName => 
      screenName === trimmedName
    );
  }
  
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

  // ✅ Handle both formats
  const checkExists = (name) => {
    if (Array.isArray(existingScreens)) {
      return existingScreens.some(s => 
        s.originalName === name && s.platform === platformName
      );
    } else if (existingScreens && typeof existingScreens === 'object') {
      return Object.keys(existingScreens).includes(name);
    }
    return false;
  };

  // Keep incrementing suffix if name exists
  while (checkExists(suggestedName)) {
    suffix++;
    suggestedName = `${originalName}_copy${suffix}`;
  }

  return suggestedName;
};