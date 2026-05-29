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
    getDashboardAnalytics,
    enrichProblems,
    getAIAnalysis
} from '../controllers/leetcodeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();


router.post('/store-session', protect, storeSession);


router.post('/start-deep-sync', protect, startDeepSync);


router.post('/sync', protect, syncLeetCodeProblems);


router.post('/sync-problems', protect, syncAcceptedProblems);


router.post('/start-sync', protect, startBackgroundSync);

router.get('/sync-status/:syncJobId', protect, getSyncStatus);

router.get('/problems', protect, getUserProblems);

router.get('/stats', protect, getLeetCodeStats);

router.get('/dashboard', protect, getDashboardAnalytics);

router.post('/enrich-problems', protect, enrichProblems);


router.get('/ai-analysis', protect, getAIAnalysis);

export default router;
