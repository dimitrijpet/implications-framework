// packages/web-app/src/components/UIScreenEditor/screenOrderingUtils.js
// ✨ Screen Ordering & Navigation Utilities - FIXED VERSION

/**
 * Convert object-based screens to ordered array format
 * Handles multiple formats:
 * - { screenName: { ...data } }           → Direct object
 * - { screenName: [{ ...data }] }         → Array wrapped
 * - Already an array
 * 
 * @param {Object|Array} screensInput - Screens in various formats
 * @returns {Array} - [{ name, order, ...screenData }, ...]
 */
export function screensObjectToArray(screensInput) {
  console.log('🔄 screensObjectToArray INPUT:', screensInput);
  console.log('🔄 screensObjectToArray INPUT type:', typeof screensInput, Array.isArray(screensInput) ? 'isArray' : 'notArray');
  
  if (!screensInput) return [];
  
  // Already an array - ensure order property exists
  if (Array.isArray(screensInput)) {
    console.log('🔄 Input is already array, just adding order');
    const result = screensInput.map((screen, idx) => ({
      ...screen,
      order: screen.order ?? idx
    }));
    console.log('🔄 Array result:', result);
    return result;
  }
  
  // It's an object - convert to array
  if (typeof screensInput !== 'object') return [];
  
  const result = [];
  
  Object.entries(screensInput).forEach(([screenName, data], idx) => {
    console.log(`🔄 Processing screen "${screenName}":`, data);
    console.log(`🔄 Screen "${screenName}" has keys:`, Object.keys(data || {}));
    
    // Skip non-screen properties
    if (!data || typeof data !== 'object') {
      console.log(`🔄 Skipping "${screenName}" - not an object`);
      return;
    }
    
    // Handle array-wrapped format: { screenName: [{ ...data }] }
    let screenData;
    if (Array.isArray(data)) {
      console.log(`🔄 Screen "${screenName}" is array-wrapped, extracting [0]`);
      screenData = data[0] || {};
    } else {
      // Direct object format: { screenName: { ...data } }
      console.log(`🔄 Screen "${screenName}" is direct object`);
      screenData = data;
    }
    
    console.log(`🔄 Screen "${screenName}" extracted data keys:`, Object.keys(screenData));
    
    // Preserve ALL existing data, just add/ensure name and order
    const finalScreen = {
      ...screenData,
      name: screenName,
      screenName: screenName, // Keep for backward compatibility
      order: screenData.order ?? idx
    };
    
    console.log(`🔄 Screen "${screenName}" final result:`, finalScreen);
    result.push(finalScreen);
  });
  
  // Sort by order
  const sorted = result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  console.log('🔄 screensObjectToArray FINAL OUTPUT:', sorted);
  return sorted;
}

/**
 * Convert ordered array back to object format for saving
 * CRITICAL: Preserves ALL screen data!
 * 
 * @param {Array} screensArray - [{ name, order, ...screenData }, ...]
 * @returns {Object} - { screenName: { ...data, order }, ... }
 */
export function screensArrayToObject(screensArray) {
  if (!screensArray || !Array.isArray(screensArray)) return {};
  
  const result = {};
  
  // Sort by order first to ensure consistent output
  const sorted = [...screensArray].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  
  sorted.forEach((screen, idx) => {
    const screenName = screen.name || screen.screenName || `screen_${idx}`;
    
    // ✅ FIXED: Keep ALL data, only remove the duplicate 'name' field
    // Don't destructure and lose data!
    const screenData = { ...screen };
    
    // Remove duplicate name fields (we use the key as the name)
    delete screenData.name;
    // Keep screenName for backward compat inside the object
    
    // Update order to normalized sequential index
    screenData.order = idx;
    
    // ✅ Store as direct object (NOT array wrapped)
    // This matches the format: { RoundTrip: { screen: "...", checks: {...} } }
    result[screenName] = screenData;
  });
  
  return result;
}

/**
 * Reorder screens after drag-drop
 * @param {Array} screens - Current screens array
 * @param {number} fromIndex - Original index
 * @param {number} toIndex - New index
 * @returns {Array} - Reordered array with updated order properties
 */
export function reorderScreens(screens, fromIndex, toIndex) {
  const result = [...screens];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  
  // Update order properties
  return result.map((screen, idx) => ({
    ...screen,
    order: idx
  }));
}

/**
 * Add navigation to a screen
 * @param {Object} screen - Screen object
 * @param {Object} navigation - Navigation config
 * @returns {Object} - Updated screen
 */
export function addNavigationToScreen(screen, navigation) {
  return {
    ...screen,
    navigation: navigation
  };
}

/**
 * Remove navigation from a screen
 * @param {Object} screen - Screen object
 * @returns {Object} - Updated screen without navigation
 */
export function removeNavigationFromScreen(screen) {
  const { navigation, ...rest } = screen;
  return rest;
}

/**
 * Create empty navigation object
 */
export function createEmptyNavigation() {
  return {
    pomName: '',
    instanceName: '',
    method: '',
    args: []
  };
}

/**
 * Validate navigation config
 * @param {Object} navigation
 * @returns {boolean}
 */
export function isValidNavigation(navigation) {
  return navigation && 
    navigation.pomName && 
    navigation.method;
}

/**
 * Debug helper - log screen data transformation
 */
export function debugScreenTransform(label, data) {
  console.log(`🔍 ${label}:`, JSON.stringify(data, null, 2));
}