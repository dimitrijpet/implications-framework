import express from 'express';

const router = express.Router();

// Placeholder - will implement in Phase 2
router.get('/', (req, res) => {
  res.json({
    projects: [],
    message: 'Project discovery coming in Phase 2',
  });
});

router.post('/discover', (req, res) => {
  res.json({
    success: false,
    message: 'Discovery feature coming in Phase 2',
  });
});

export default router;