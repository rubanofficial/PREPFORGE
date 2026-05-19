import express from 'express';
import { syncLeetCodeProblems, getUserProblems, getLeetCodeStats } from '../controllers/leetcodeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/leetcode/sync - Fetch and sync user's LeetCode problems
// Protected route: requires authentication
router.post('/sync', protect, syncLeetCodeProblems);

// GET /api/leetcode/problems - Retrieve synced problems for user
// Protected route: requires authentication
// Query parameters: difficulty, topic, limit, offset
router.get('/problems', protect, getUserProblems);

// GET /api/leetcode/stats - Get user's problem-solving statistics
// Protected route: requires authentication
router.get('/stats', protect, getLeetCodeStats);

export default router;
