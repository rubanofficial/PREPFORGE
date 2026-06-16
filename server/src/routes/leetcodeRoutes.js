import express from 'express';
import {
    storeSession,
    startDeepSync,
    syncLeetCodeProblems,
    syncAcceptedProblems,
    startBackgroundSync,
    getSyncStatus,
    getUserProblems,
    getLeetCodeStats,
    getAIAnalysis,
    getSyncInfo
} from '../controllers/leetcodeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ===== AUTHENTICATED DEEP SYNC (NEW) =====

// POST /api/leetcode/store-session - Store encrypted LEETCODE_SESSION cookie
// Protected route: requires authentication
// Body: { leetcodeUsername, leetcodeSessionCookie }
// Must be called before start-deep-sync
router.post('/store-session', protect, storeSession);

// POST /api/leetcode/start-deep-sync - Start authenticated deep sync
// Protected route: requires authentication
// Returns immediately with syncJobId
// Requires previous call to /store-session
// Client polls GET /sync-status/:syncJobId for progress
router.post('/start-deep-sync', protect, startDeepSync);

// ===== LEGACY ENDPOINTS (KEPT FOR BACKWARD COMPATIBILITY) =====

// POST /api/leetcode/sync - Fetch user's solved counts and stats
// Protected route: requires authentication
// DEPRECATED: Use /start-sync for background sync
router.post('/sync', protect, syncLeetCodeProblems);

// POST /api/leetcode/sync-problems - Fetch and sync user's accepted solved problems
// Protected route: requires authentication
// DEPRECATED: Use /start-sync for background sync
// Kept for backward compatibility
router.post('/sync-problems', protect, syncAcceptedProblems);

// POST /api/leetcode/start-sync - Start background batch sync (public API approach)
// Protected route: requires authentication
// Returns immediately with syncJobId
// Client polls GET /sync-status/:syncJobId for progress
router.post('/start-sync', protect, startBackgroundSync);

// GET /api/leetcode/sync-status/:syncJobId - Get sync progress
// Protected route: requires authentication
// Returns current status, progress metrics, and error info
router.get('/sync-status/:syncJobId', protect, getSyncStatus);

// GET /api/leetcode/problems - Retrieve synced problems for user
// Protected route: requires authentication
// Query parameters: difficulty, topic, limit, offset
router.get('/problems', protect, getUserProblems);

// GET /api/leetcode/stats - Get user's problem-solving statistics
// Protected route: requires authentication
router.get('/stats', protect, getLeetCodeStats);

// GET /api/leetcode/ai-analysis - Get AI-powered performance analysis
// Protected route: requires authentication
router.get('/ai-analysis', protect, getAIAnalysis);

// GET /api/leetcode/sync-info - Get sync metadata (last sync, local count, next sync mode)
// Protected route: requires authentication
// Used by the UI to show delta preview before user presses Sync
router.get('/sync-info', protect, getSyncInfo);

export default router;
