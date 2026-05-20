import express from 'express';
import { syncLeetCodeProblems, syncAcceptedProblems, getUserProblems, getLeetCodeStats } from '../controllers/leetcodeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/leetcode/sync - Fetch user's solved counts and stats
// Protected route: requires authentication
router.post('/sync', protect, syncLeetCodeProblems);

// POST /api/leetcode/sync-problems - Fetch and sync user's accepted solved problems
// Protected route: requires authentication
// Lightweight ingestion: title, titleSlug, timestamp only
router.post('/sync-problems', protect, syncAcceptedProblems);

// GET /api/leetcode/problems - Retrieve synced problems for user
// Protected route: requires authentication
// Query parameters: difficulty, topic, limit, offset
router.get('/problems', protect, getUserProblems);

// GET /api/leetcode/stats - Get user's problem-solving statistics
// Protected route: requires authentication
router.get('/stats', protect, getLeetCodeStats);

export default router;
