// packages/core/src/registry/StateRegistry.js (CREATE THIS FILE)

/**
 * State Registry - Maps short state names to full class names
 * 
 * Supports three strategies:
 * 1. Auto-discovery: Extract from class names automatically
 * 2. Pattern-based: Use regex pattern from config
 * 3. Explicit: Use mappings defined in config
 */
export class StateRegistry {
  constructor(config = {}) {
    this.config = config.stateRegistry || {};
    this.registry = new Map(); // short name → full class name
    this.reverseRegistry = new Map(); // full class name → short name
    this.strategy = this.config.strategy || 'auto';
  }
  
  /**
   * Build registry from discovery result
   * @param {Object} discoveryResult - Result from discovery service
   * @returns {StateRegistry} - Returns this for chaining
   */
  async build(discoveryResult) {
    console.log(`🗺️  Building State Registry (strategy: ${this.strategy})...`);
    
    switch (this.strategy) {
      case 'explicit':
        this.buildFromExplicitMappings();
        break;
      
      case 'pattern':
        this.buildFromPattern(discoveryResult);
        break;
      
      case 'auto':
      default:
        this.buildAuto(discoveryResult);
        break;
    }
    
    console.log(`✅ State Registry built: ${this.registry.size} mappings`);
    return this;
  }
  
  /**
   * Auto-discover mappings from class names
   */
  buildAuto(discoveryResult) {
    const implications = discoveryResult.files?.implications || [];
    
    implications.forEach(impl => {
      const className = impl.metadata?.className;
      if (!className) return;
      
      const shortName = this.extractShortName(className);
      
      if (shortName) {
        this.register(shortName, className);
      }
    });
  }
  
  /**
   * Use explicit mappings from config
   */
  buildFromExplicitMappings() {
    const mappings = this.config.mappings || {};
    
    Object.entries(mappings).forEach(([short, full]) => {
      this.register(short, full);
    });
  }
  
  /**
   * Use pattern from config to extract state names
   */
  buildFromPattern(discoveryResult) {
    const pattern = this.config.pattern;
    if (!pattern) {
      throw new Error('Pattern strategy requires stateRegistry.pattern in config');
    }
    
    const implications = discoveryResult.files?.implications || [];
    const regex = this.patternToRegex(pattern);
    
    implications.forEach(impl => {
      const className = impl.metadata?.className;
      if (!className) return;
      
      const match = className.match(regex);
      
      if (match && match[1]) {
        const shortName = this.config.caseSensitive 
          ? match[1] 
          : match[1].toLowerCase();
        this.register(shortName, className);
      }
    });
  }
  
  /**
   * Convert pattern to regex
   * E.g., '{Status}BookingImplications' → /^(\w+)BookingImplications$/
   */
  patternToRegex(pattern) {
    const escaped = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace('{Status}', '(\\w+)');
    return new RegExp(`^${escaped}$`);
  }
  
  /**
   * Extract short name from class name using various strategies
   */
  extractShortName(className) {
    const prefixes = this.config.statusPrefixes || [];
    
    // Try to match known prefixes
    for (const prefix of prefixes) {
      if (className.startsWith(prefix)) {
        return this.config.caseSensitive 
          ? prefix 
          : prefix.toLowerCase();
      }
    }
    
    // Fallback: Remove common suffixes and lowercase
    let shortName = className
      .replace(/Implications$/i, '')
      .replace(/Booking$/i, '')
      .replace(/Application$/i, '')
      .replace(/Status$/i, '');
    
    // Convert PascalCase to lowercase
    return this.config.caseSensitive 
      ? shortName 
      : shortName.toLowerCase();
  }
  
  /**
   * Register a mapping between short name and full class name
   */
  register(shortName, fullClassName) {
    const key = this.config.caseSensitive 
      ? shortName 
      : shortName.toLowerCase();
    
    // Check for conflicts
    if (this.registry.has(key)) {
      const existing = this.registry.get(key);
      if (existing !== fullClassName) {
        console.warn(
          `⚠️  State name conflict: "${key}" maps to both "${existing}" and "${fullClassName}". ` +
          `Using "${fullClassName}".`
        );
      }
    }
    
    this.registry.set(key, fullClassName);
    this.reverseRegistry.set(fullClassName, shortName);
    
    console.log(`  📌 Mapped: "${key}" → "${fullClassName}"`);
  }
  
  /**
   * Resolve a state name to full class name
   * Handles: short names, full names, different cases
   */
  resolve(stateName) {
    if (!stateName || typeof stateName !== 'string') {
      return null;
    }
    
    const key = this.config.caseSensitive 
      ? stateName 
      : stateName.toLowerCase();
    
    // 1. Check registry first (short name)
    if (this.registry.has(key)) {
      return this.registry.get(key);
    }
    
    // 2. Check if it's already a full class name
    if (this.reverseRegistry.has(stateName)) {
      return stateName;
    }
    
    // 3. Try capitalized version (Accepted → accepted)
    const capitalized = stateName.charAt(0).toUpperCase() + stateName.slice(1);
    const capitalizedLower = this.config.caseSensitive 
      ? capitalized 
      : capitalized.toLowerCase();
    
    if (this.registry.has(capitalizedLower)) {
      return this.registry.get(capitalizedLower);
    }
    
    // 4. Case-insensitive search through all mappings
    if (!this.config.caseSensitive) {
      for (const [registeredKey, fullName] of this.registry.entries()) {
        if (registeredKey.toLowerCase() === stateName.toLowerCase()) {
          return fullName;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get short name from full class name
   */
  getShortName(fullClassName) {
    return this.reverseRegistry.get(fullClassName);
  }
  
  /**
   * Get all mappings as array
   */
  getAllMappings() {
    return Array.from(this.registry.entries()).map(([short, full]) => ({
      shortName: short,
      fullClassName: full
    }));
  }
  
  /**
   * Check if a state exists in registry
   */
  exists(stateName) {
    return this.resolve(stateName) !== null;
  }
  
  /**
   * Get registry size
   */
  get size() {
    return this.registry.size;
  }
  
  /**
   * Clear all mappings
   */
  clear() {
    this.registry.clear();
    this.reverseRegistry.clear();
  }
  
  /**
   * Export registry data for serialization
   */
  toJSON() {
    return {
      strategy: this.strategy,
      size: this.size,
      mappings: this.getAllMappings(),
      config: this.config
    };
  }
}