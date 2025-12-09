// packages/core/src/constants.js

import path from 'path';

/**
 * Shared constants for Implications Framework
 * These paths are used across discovery, generation, and testing
 */

/**
 * State Registry Path
 * Canonical location for the state registry JSON file
 * Maps state names to Implication class names
 */
export const REGISTRY_PATH = path.join(process.cwd(), 'tests/implications/.state-registry.json');

/**
 * Discovery Cache Directory
 * Where discovery results and other cache files are stored
 */
export const CACHE_DIR = path.join(process.cwd(), '.implications-framework/cache');

/**
 * Discovery Cache File
 * Full discovery results including transitions
 */
export const DISCOVERY_CACHE_PATH = path.join(CACHE_DIR, 'discovery-result.json');

export default {
  REGISTRY_PATH,
  CACHE_DIR,
  DISCOVERY_CACHE_PATH
};