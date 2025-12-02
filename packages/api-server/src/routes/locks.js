// packages/api-server/src/routes/locks.js

import express from 'express';
import { LockService } from '../services/lockService.js';

const router = express.Router();

/**
 * GET /api/locks
 * Get all locks for a project
 */
router.get('/', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    const lockService = new LockService(projectPath);
    const stats = await lockService.getStats();
    
    res.json({
      success: true,
      ...stats
    });
    
  } catch (error) {
    console.error('❌ Error getting locks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/locks/check
 * Check if specific test paths are locked
 */
router.get('/check', async (req, res) => {
  try {
    const { projectPath, testPaths } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    const lockService = new LockService(projectPath);
    
    // testPaths can be comma-separated or array
    const paths = Array.isArray(testPaths) 
      ? testPaths 
      : (testPaths || '').split(',').filter(Boolean);
    
    if (paths.length === 0) {
      return res.json({ success: true, locks: {} });
    }
    
    const locks = await lockService.checkLocks(paths);
    
    res.json({
      success: true,
      locks
    });
    
  } catch (error) {
    console.error('❌ Error checking locks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/locks/state/:stateName
 * Get locks for a specific state's tests
 */
router.get('/state/:stateName', async (req, res) => {
  try {
    const { stateName } = req.params;
    const { projectPath, setupEntries } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    const lockService = new LockService(projectPath);
    
    // Parse setupEntries if provided as JSON string
    let entries = [];
    if (setupEntries) {
      try {
        entries = JSON.parse(setupEntries);
      } catch (e) {
        console.warn('Could not parse setupEntries:', e.message);
      }
    }
    
    const locks = await lockService.getLocksForState(stateName, entries);
    
    res.json({
      success: true,
      stateName,
      tests: locks
    });
    
  } catch (error) {
    console.error('❌ Error getting state locks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/locks/lock
 * Lock a test file
 */
router.post('/lock', async (req, res) => {
  try {
    const { projectPath, testPath, reason } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    if (!testPath) {
      return res.status(400).json({ error: 'testPath is required' });
    }
    
    const lockService = new LockService(projectPath);
    const lock = await lockService.lock(testPath, reason);
    
    res.json({
      success: true,
      lock,
      testPath
    });
    
  } catch (error) {
    console.error('❌ Error locking test:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/locks/unlock
 * Unlock a test file
 */
router.post('/unlock', async (req, res) => {
  try {
    const { projectPath, testPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    if (!testPath) {
      return res.status(400).json({ error: 'testPath is required' });
    }
    
    const lockService = new LockService(projectPath);
    const result = await lockService.unlock(testPath);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('❌ Error unlocking test:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/locks/bulk
 * Lock/unlock multiple tests at once
 */
router.post('/bulk', async (req, res) => {
  try {
    const { projectPath, testPaths, action, reason } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    if (!testPaths || !Array.isArray(testPaths)) {
      return res.status(400).json({ error: 'testPaths array is required' });
    }
    if (!action || !['lock', 'unlock'].includes(action)) {
      return res.status(400).json({ error: 'action must be "lock" or "unlock"' });
    }
    
    const lockService = new LockService(projectPath);
    
    let results;
    if (action === 'lock') {
      results = await lockService.lockBulk(testPaths, reason);
    } else {
      results = await lockService.unlockBulk(testPaths);
    }
    
    res.json({
      success: true,
      action,
      count: results.length,
      results
    });
    
  } catch (error) {
    console.error('❌ Error bulk lock/unlock:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/locks/toggle
 * Toggle lock state for a test
 */
router.post('/toggle', async (req, res) => {
  try {
    const { projectPath, testPath, reason } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    if (!testPath) {
      return res.status(400).json({ error: 'testPath is required' });
    }
    
    const lockService = new LockService(projectPath);
    const isCurrentlyLocked = await lockService.isLocked(testPath);
    
    let result;
    if (isCurrentlyLocked) {
      result = await lockService.unlock(testPath);
      result.action = 'unlocked';
    } else {
      result = await lockService.lock(testPath, reason);
      result.action = 'locked';
    }
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('❌ Error toggling lock:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;