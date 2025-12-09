// packages/api-server/src/services/configService.js (CREATE THIS FILE)

import path from 'path';
import fs from 'fs-extra';

/**
 * Load ai-testing.config.js from project
 */
export async function loadConfig(projectPath) {
  const configPath = path.join(projectPath, 'ai-testing.config.js');
  
  try {
    // Check if config exists
    const exists = await fs.pathExists(configPath);
    
    if (!exists) {
      console.log('ℹ️  No config file found, using defaults');
      return getDefaultConfig();
    }
    
    // Import config (works with ES modules)
    const configModule = await import(`file://${configPath}`);
    const config = configModule.default || configModule;
    
    console.log('✅ Loaded config from:', configPath);
    return config;
    
  } catch (error) {
    console.warn('⚠️  Error loading config, using defaults:', error.message);
    return getDefaultConfig();
  }
}

/**
 * Default configuration
 */
function getDefaultConfig() {
  return {
    projectName: 'Unknown Project',
    projectType: 'generic',
    
    stateRegistry: {
      strategy: 'auto',
      caseSensitive: false,
      statusPrefixes: [
        // Booking statuses
        'Accepted', 'Rejected', 'Pending', 'Standby',
        'Created', 'CheckedIn', 'CheckedOut', 'Completed',
        'Cancelled', 'Missed', 'Invited',
        
        // Application statuses
        'Approved', 'Denied', 'Submitted', 'Draft',
        
        // Generic statuses
        'Active', 'Inactive', 'Archived', 'Deleted'
      ]
    },
    
    paths: {
      implications: './tests/implications',
      sections: './tests/sections',
      screens: './tests/screens'
    }
  };
}