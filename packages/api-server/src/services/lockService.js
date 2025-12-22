// packages/api-server/src/services/lockService.js

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const LOCKS_FILENAME = '.test-locks.json';

export class LockService {
  constructor(projectPath, config = null) {
    this.projectPath = projectPath;
    this.config = config;
    
    // Determine implications directory from config or default
    const implDir = config?.paths?.implications || 'tests/implications';
    this.locksPath = path.join(projectPath, implDir, LOCKS_FILENAME);
  }
  
  async loadLocks() {
    try {
      const content = await fs.readFile(this.locksPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return { 
        version: '1.0', 
        locks: {}
      };
    }
  }
  
  loadLocksSync() {
    try {
      const content = fsSync.readFileSync(this.locksPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return { 
        version: '1.0', 
        locks: {}
      };
    }
  }
  
  async saveLocks(data) {
    const dir = path.dirname(this.locksPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.locksPath, JSON.stringify(data, null, 2));
  }
  
  async isLocked(testPath) {
    const data = await this.loadLocks();
    const normalizedPath = this._normalizePath(testPath);
    return data.locks[normalizedPath]?.locked === true;
  }
  
  async getLockInfo(testPath) {
    const data = await this.loadLocks();
    const normalizedPath = this._normalizePath(testPath);
    return data.locks[normalizedPath] || null;
  }
  
  async lock(testPath, reason = '') {
    const data = await this.loadLocks();
    const normalizedPath = this._normalizePath(testPath);
    
    data.locks[normalizedPath] = {
      locked: true,
      lockedAt: new Date().toISOString(),
      reason: reason || 'Manually locked'
    };
    
    await this.saveLocks(data);
    console.log(`🔒 Locked: ${normalizedPath}`);
    return data.locks[normalizedPath];
  }
  
  async unlock(testPath) {
    const data = await this.loadLocks();
    const normalizedPath = this._normalizePath(testPath);
    
    if (data.locks[normalizedPath]) {
      delete data.locks[normalizedPath];
      await this.saveLocks(data);
      console.log(`🔓 Unlocked: ${normalizedPath}`);
    }
    
    return { unlocked: true, path: normalizedPath };
  }
  
  async lockBulk(testPaths, reason = '') {
    const data = await this.loadLocks();
    const results = [];
    
    for (const testPath of testPaths) {
      const normalizedPath = this._normalizePath(testPath);
      data.locks[normalizedPath] = {
        locked: true,
        lockedAt: new Date().toISOString(),
        reason: reason || 'Bulk lock'
      };
      results.push({ path: normalizedPath, locked: true });
    }
    
    await this.saveLocks(data);
    console.log(`🔒 Bulk locked ${results.length} tests`);
    return results;
  }
  
  async unlockBulk(testPaths) {
    const data = await this.loadLocks();
    const results = [];
    
    for (const testPath of testPaths) {
      const normalizedPath = this._normalizePath(testPath);
      if (data.locks[normalizedPath]) {
        delete data.locks[normalizedPath];
        results.push({ path: normalizedPath, unlocked: true });
      }
    }
    
    await this.saveLocks(data);
    console.log(`🔓 Bulk unlocked ${results.length} tests`);
    return results;
  }
  
  async getLockedPaths() {
    const data = await this.loadLocks();
    return Object.entries(data.locks)
      .filter(([_, info]) => info.locked)
      .map(([testPath, _]) => testPath);
  }
  
  async getAllLocks() {
    const data = await this.loadLocks();
    return data.locks;
  }
  
  async getStats() {
    const data = await this.loadLocks();
    const lockedCount = Object.values(data.locks).filter(l => l.locked).length;
    
    return {
      totalLocked: lockedCount,
      locks: data.locks
    };
  }
  
  // Check multiple paths at once - returns map of path -> isLocked
  async checkLocks(testPaths) {
    const data = await this.loadLocks();
    const results = {};
    
    for (const testPath of testPaths) {
      const normalizedPath = this._normalizePath(testPath);
      results[normalizedPath] = data.locks[normalizedPath]?.locked === true;
    }
    
    return results;
  }
  
  // Get lock status for tests belonging to a specific state
  // ✅ FIXED: Only returns tests that actually exist on disk
  async getLocksForState(stateName, setupEntries = []) {
    const data = await this.loadLocks();
    const results = [];
    
    for (const entry of setupEntries) {
      if (!entry.testFile) continue;
      
      const normalizedPath = this._normalizePath(entry.testFile);
      const fullPath = path.join(this.projectPath, normalizedPath);
      
      // ✅ Check if test file actually exists
      let exists = false;
      try {
        await fs.access(fullPath);
        exists = true;
      } catch {
        exists = false;
      }
      
      // Only include tests that exist on disk
      if (exists) {
        const lockInfo = data.locks[normalizedPath];
        
        results.push({
          testFile: entry.testFile,
          actionName: entry.actionName,
          platform: entry.platform,
          source: entry.source,
          fromState: entry.fromState,
          event: entry.event,
          locked: lockInfo?.locked === true,
          lockedAt: lockInfo?.lockedAt || null,
          reason: lockInfo?.reason || null,
          exists: true
        });
      }
      // Skip files that don't exist
    }
    
    console.log(`🔒 Found ${results.length} existing tests for state "${stateName}" (checked ${setupEntries.length} entries)`);
    
    return results;
  }
  
  // ✅ NEW: Check if a test file exists on disk
  async testExists(testPath) {
    const normalizedPath = this._normalizePath(testPath);
    const fullPath = path.join(this.projectPath, normalizedPath);
    
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
  
  _normalizePath(testPath) {
    if (!testPath) return testPath;
    
    // If it's an absolute path, make it relative
    if (path.isAbsolute(testPath)) {
      return path.relative(this.projectPath, testPath);
    }
    
    // If it starts with project path, strip it
    if (testPath.startsWith(this.projectPath)) {
      return testPath.slice(this.projectPath.length).replace(/^[\/\\]/, '');
    }
    
    // Normalize slashes
    return testPath.replace(/\\/g, '/');
  }
}

export default LockService;