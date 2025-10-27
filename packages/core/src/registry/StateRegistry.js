// packages/core/src/registry/StateRegistry.js (COMPLETE FIX)
// Replace your current StateRegistry.js with this version

/**
 * State Registry - Maps short state names to full class names
 * 
 * ✅ FIXED: Now reads xstateConfig.id as the PRIMARY source!
 */
export class StateRegistry {
  constructor(config = {}) {
    this.config = config.stateRegistry || {};
    this.registry = new Map();
    this.reverseRegistry = new Map();
    this.strategy = this.config.strategy || 'auto';
  }
  
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
   * ✅ FIXED: Now passes full impl object to extractShortName
   */
  buildAuto(discoveryResult) {
    const implications = discoveryResult.files?.implications || [];
    
    implications.forEach(impl => {
      const className = impl.metadata?.className;
      if (!className) return;
      
      // ✅ Pass full impl, not just className!
      const shortName = this.extractShortName(impl);
      
      if (shortName) {
        this.register(shortName, className);
      }
    });
    
    // Explicit overrides
    const explicitMappings = this.config.mappings || {};
    Object.entries(explicitMappings).forEach(([short, full]) => {
      this.register(short, full);
    });
  }
  
  buildFromExplicitMappings() {
    const mappings = this.config.mappings || {};
    Object.entries(mappings).forEach(([short, full]) => {
      this.register(short, full);
    });
  }
  
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
        const shortName = this.config.caseSensitive ? match[1] : match[1].toLowerCase();
        this.register(shortName, className);
      }
    });
  }
  
  patternToRegex(pattern) {
    const escaped = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace('{Status}', '(\\w+)');
    return new RegExp(`^${escaped}$`);
  }
  
  /**
   * ✅ THE KEY FIX: Now accepts impl object and reads xstateConfig.id FIRST!
   */
  extractShortName(impl) {
    // ✅ PRIORITY 1: Use xstateConfig.id if it exists!
    const xstateId = impl.metadata?.xstateConfig?.id;
    if (xstateId) {
      return this.config.caseSensitive ? xstateId : xstateId.toLowerCase();
    }
    
    // Priority 2: Try known prefixes
    const className = impl.metadata?.className;
    if (!className) return null;
    
    const prefixes = this.config.statusPrefixes || [];
    for (const prefix of prefixes) {
      if (className.startsWith(prefix)) {
        return this.config.caseSensitive ? prefix : prefix.toLowerCase();
      }
    }
    
    // Priority 3: Derive from class name (fallback)
    let shortName = className
      .replace(/Implications$/i, '')
      .replace(/Booking$/i, '')
      .replace(/Application$/i, '')
      .replace(/Status$/i, '');
    
    return this.config.caseSensitive ? shortName : shortName.toLowerCase();
  }
  
  register(shortName, fullClassName) {
    const key = this.config.caseSensitive ? shortName : shortName.toLowerCase();
    
    if (this.registry.has(key)) {
      const existing = this.registry.get(key);
      if (existing !== fullClassName) {
        console.warn(`⚠️  Conflict: "${key}" → "${existing}" vs "${fullClassName}"`);
      }
    }
    
    this.registry.set(key, fullClassName);
    this.reverseRegistry.set(fullClassName, shortName);
    console.log(`  📌 Mapped: "${key}" → "${fullClassName}"`);
  }
  
  resolve(stateName) {
    if (!stateName || typeof stateName !== 'string') return null;
    
    const key = this.config.caseSensitive ? stateName : stateName.toLowerCase();
    
    if (this.registry.has(key)) return this.registry.get(key);
    if (this.reverseRegistry.has(stateName)) return stateName;
    
    // Case-insensitive fallback
    if (!this.config.caseSensitive) {
      for (const [registeredKey, fullName] of this.registry.entries()) {
        if (registeredKey.toLowerCase() === stateName.toLowerCase()) {
          return fullName;
        }
      }
    }
    
    return null;
  }
  
  getShortName(fullClassName) {
    return this.reverseRegistry.get(fullClassName);
  }
  
  getAllMappings() {
    return Array.from(this.registry.entries()).map(([short, full]) => ({
      shortName: short,
      fullClassName: full
    }));
  }
  
  exists(stateName) {
    return this.resolve(stateName) !== null;
  }
  
  get size() {
    return this.registry.size;
  }
  
  clear() {
    this.registry.clear();
    this.reverseRegistry.clear();
  }
  
  toJSON() {
    return {
      strategy: this.strategy,
      size: this.size,
      mappings: this.getAllMappings(),
      config: this.config
    };
  }
}