/**
 * Adapters Index
 * 
 * Export all adapter classes for easy importing.
 * 
 * Usage:
 *   import { BrowserAdapter, VisionAdapter } from './adapters/index.js';
 *   import { PlaywrightAdapter, ClaudeVisionAdapter } from './adapters/index.js';
 */

// Abstract interfaces
export { BrowserAdapter } from './BrowserAdapter.js';
export { VisionAdapter } from './VisionAdapter.js';

// Concrete implementations
export { PlaywrightAdapter } from './PlaywrightAdapter.js';
export { ClaudeVisionAdapter } from './ClaudeVisionAdapter.js';

/**
 * Factory function to create browser adapter based on config
 * 
 * @param {string} type - Adapter type: 'playwright', 'vibium'
 * @param {Object} config - Configuration options
 * @returns {Promise<BrowserAdapter>} - Browser adapter instance
 */
export async function createBrowserAdapter(type = 'playwright', config = {}) {
  switch (type.toLowerCase()) {
    case 'playwright': {
      const { PlaywrightAdapter } = await import('./PlaywrightAdapter.js');
      return new PlaywrightAdapter(config);
    }
    
    case 'vibium': {
      throw new Error('VibiumAdapter not yet implemented. Use playwright for now.');
    }
    
    default:
      throw new Error(`Unknown browser adapter type: ${type}`);
  }
}

/**
 * Factory function to create vision adapter based on config
 * 
 * @param {string} type - Adapter type: 'claude', 'gpt4'
 * @param {Object} config - Configuration options
 * @returns {Promise<VisionAdapter>} - Vision adapter instance
 */
export async function createVisionAdapter(type = 'claude', config = {}) {
  switch (type.toLowerCase()) {
    case 'claude':
    case 'claude-vision':
    case 'haiku': {
      const { ClaudeVisionAdapter } = await import('./ClaudeVisionAdapter.js');
      return new ClaudeVisionAdapter(config);
    }
    
    case 'gpt4':
    case 'gpt4-vision': {
      throw new Error('GPT4VisionAdapter not yet implemented.');
    }
    
    default:
      throw new Error(`Unknown vision adapter type: ${type}`);
  }
}

/**
 * Get available adapter types and their status
 * 
 * @returns {Object} - Available adapters with implementation status
 */
export function getAvailableAdapters() {
  return {
    browser: {
      playwright: {
        name: 'Playwright',
        implemented: true,
        description: 'Microsoft Playwright for cross-browser automation'
      },
      vibium: {
        name: 'Vibium',
        implemented: false,
        description: 'Vibium browser automation with AI-powered features'
      }
    },
    vision: {
      claude: {
        name: 'Claude Vision',
        implemented: true,
        description: 'Anthropic Claude 3 Haiku for fast, affordable vision analysis'
      },
      gpt4: {
        name: 'GPT-4 Vision',
        implemented: false,
        description: 'OpenAI GPT-4V for vision analysis'
      }
    }
  };
}

/**
 * Quick check if all required adapters are configured
 * 
 * @returns {Object} - Configuration status
 */
export function checkAdaptersConfiguration() {
  const status = {
    browser: { ready: true, message: 'Playwright ready' },
    vision: { ready: false, message: 'Not checked' }
  };

  // Check vision adapter (needs API key)
  if (process.env.ANTHROPIC_API_KEY) {
    status.vision = { ready: true, message: 'Claude Vision ready' };
  } else {
    status.vision = { ready: false, message: 'ANTHROPIC_API_KEY not set' };
  }

  return status;
}