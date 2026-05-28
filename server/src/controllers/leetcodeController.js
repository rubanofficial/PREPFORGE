import leetcodeProvider from '../services/providers/leetcodeProvider.js';
import { normalizeLeetcodeStats } from '../services/normalization/normalizeLeetcodeData.js';
import { normalizeAcceptedProblems, buildProblemDocument } from '../services/normalization/normalizeAcceptedProblems.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import SyncJob from '../models/SyncJob.js';
import deepSyncService from '../services/sync/deepSyncService.js';
import backgroundSyncService from '../services/sync/backgroundSyncService.js';
import problemEnrichmentService from '../services/enrichment/problemEnrichmentService.js';
import analyticsService from '../services/analyticsService.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { asyncHandler, AppError } from '../utils/errorHandler.js';

const runAsyncJob = (jobPromise) => {
    Promise.resolve(jobPromise).catch((error) => {
        console.error('❌ Background sync job failed:', error.message);
    });
};

/**
 * POST /api/leetcode/store-session
 * Store encrypted LEETCODE_SESSION cookie for authenticated syncing
 */
const storeSession = asyncHandler(async (req, res, next) => {
    const { leetcodeUsername, leetcodeSessionCookie } = req.body;
    const userId = req.user.userId;

    if (!leetcodeUsername || typeof leetcodeUsername !== 'string') {
        return next(new AppError('LeetCode username is required', 400));
    }

    if (!leetcodeSessionCookie || typeof leetcodeSessionCookie !== 'string') {
        return next(new AppError('LEETCODE_SESSION cookie is required', 400));
    }

    const username = leetcodeUsername.trim().toLowerCase();
    let cleanSession = leetcodeSessionCookie.trim();

    if (cleanSession.startsWith('LEETCODE_SESSION=')) {
        cleanSession = cleanSession.substring('LEETCODE_SESSION='.length);
    }

    if (!cleanSession || cleanSession.length < 20) {
        return next(new AppError('Invalid session cookie format', 400));
    }

    const encryptedSession = encrypt(cleanSession);

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
            leetcodeUsername: username,
            encryptedLeetCodeSession: encryptedSession,
            lastLeetcodeSyncAt: null,
        },
        { new: true, select: '-password -encryptedLeetCodeSession' }
    );

    if (!updatedUser) {
        return next(new AppError('User not found', 404));
    }

    res.status(200).json({
        success: true,
        message: 'LeetCode session stored securely',
        data: {
            userId,
            leetcodeUsername: username,
            message: 'Session is encrypted. You can now start authenticated deep sync.',
        },
    });
});

/**
 * POST /api/leetcode/start-deep-sync
 * Start authenticated deep sync using stored encrypted session.
 */
const startDeepSync = asyncHandler(async (req, res, next) => {
    const userId = req.user.userId;

    const user = await User.findById(userId).select('leetcodeUsername encryptedLeetCodeSession');

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    if (!user.leetcodeUsername) {
        return next(new AppError('LeetCode username is required. Save your session first.', 400));
    }

    if (!user.encryptedLeetCodeSession) {
        return next(new AppError('LeetCode session cookie is required. Save your session first.', 400));
    }

    const syncJob = await SyncJob.create({
        userId,
        username: user.leetcodeUsername,
        status: 'pending',
    });

    const decryptedSession = decrypt(user.encryptedLeetCodeSession);
    if (!decryptedSession) {
        await SyncJob.findByIdAndUpdate(syncJob._id, {
            status: 'failed',
            error: {
                message: 'Could not decrypt stored LeetCode session',
                code: 'DECRYPTION_FAILED',
                timestamp: new Date(),
            },
        });

        return next(new AppError('Stored LeetCode session is invalid. Please re-save it.', 400));
    }

    runAsyncJob(deepSyncService.performDeepSync(userId, user.encryptedLeetCodeSession, syncJob._id));

    res.status(202).json({
        success: true,
        message: 'Deep sync started',
        data: {
            syncJobId: syncJob._id,
            status: 'pending',
            username: user.leetcodeUsername,
        },
    });
});

/**
 * POST /api/leetcode/start-sync
 * Start legacy background sync using the public LeetCode API approach.
 */
const startBackgroundSync = asyncHandler(async (req, res, next) => {
    const userId = req.user.userId;
    const { leetcodeUsername } = req.body;

    const user = await User.findById(userId).select('leetcodeUsername');
    const username = (leetcodeUsername || user?.leetcodeUsername || '').trim().toLowerCase();

    if (!username) {
        return next(new AppError('LeetCode username is required', 400));
    }

    const syncJob = await SyncJob.create({
        userId,
        username,
        status: 'pending',
    });

    runAsyncJob(backgroundSyncService.startBackgroundSync(syncJob._id, username, userId));

    res.status(202).json({
        success: true,
        message: 'Background sync started',
        data: {
            syncJobId: syncJob._id,
            status: 'pending',
            username,
        },
    });
});

/**
 * GET /api/leetcode/sync-status/:syncJobId
 * Get sync progress for the authenticated user.
 */
const getSyncStatus = asyncHandler(async (req, res, next) => {
    const { syncJobId } = req.params;
    const userId = req.user.userId;

    const syncJob = await SyncJob.findOne({ _id: syncJobId, userId });

    if (!syncJob) {
        return next(new AppError('Sync job not found', 404));
    }

    const progress = syncJob.progress || {};
    const totalExpected = progress.totalExpected || 0;
    const processed = progress.processed || 0;
    const progressPercent = totalExpected > 0 ? Math.min(Math.round((processed / totalExpected) * 100), 100) : 0;

    const startedAt = syncJob.startedAt ? new Date(syncJob.startedAt) : null;
    const completedAt = syncJob.completedAt ? new Date(syncJob.completedAt) : null;
    const elapsedSeconds = startedAt
        ? Math.round(((completedAt || new Date()).getTime() - startedAt.getTime()) / 1000)
        : 0;

    res.status(200).json({
        success: true,
        data: {
            syncJobId: syncJob._id,
            username: syncJob.username,
            status: syncJob.status,
            progress: {
                ...progress,
                percent: progressPercent,
            },
            startedAt: syncJob.startedAt,
            completedAt: syncJob.completedAt,
            elapsedSeconds,
            error: syncJob.error || null,
            metadata: syncJob.metadata || {},
        },
    });
});

/**
 * POST /api/leetcode/sync
 * ❌ DEPRECATED: This function used GraphQL which we removed
 * 
 * TO RESTORE: If you need LeetCode stats, create a new Alfa API provider function
 * for stats endpoint and update this controller
 * 
 * CURRENT APPROACH:
 * Use POST /api/leetcode/sync-problems instead to sync accepted problems
 */
const syncLeetCodeProblems = asyncHandler(async (req, res, next) => {
    return next(new AppError(
        'This endpoint has been deprecated. Use POST /api/leetcode/sync-problems instead to sync accepted problems.',
        410
    ));
});

/**
 * POST /api/leetcode/sync-problems
 * Fetch and sync user's ACCEPTED SOLVED PROBLEMS from LeetCode
 * 
 * FLOW:
 * 1. Provider: Fetch lightweight accepted submissions (title, titleSlug, timestamp)
 * 2. Normalization: Transform to internal format (only required fields)
 * 3. Deduplication: Check which problems already exist in DB
 * 4. Insertion: Insert only NEW problems (preserve history)
 * 5. Response: Return sync statistics
 * 
 * ARCHITECTURE PATTERN:
 * Route → Controller → Provider → Normalization → MongoDB
 *
 * RESPONSIBILITIES BY LAYER:
 * - Controller: Validate input, orchestrate flow, return response
 * - Provider: Fetch from LeetCode API only
 * - Normalization: Transform structure only
 * - MongoDB: Store data only
 * 
 * WHY THIS ARCHITECTURE:
 * - SCALABLE: Easy to add GFG, Codeforces providers
 * - TESTABLE: Each layer independently testable
 * - MAINTAINABLE: Changes isolated to specific layer
 * - FLEXIBLE: Can swap providers without touching controller
 */
const syncAcceptedProblems = asyncHandler(async (req, res, next) => {
    const { leetcodeUsername } = req.body;
    const userId = req.user.userId;

    // ===== INPUT VALIDATION =====
    if (!leetcodeUsername || typeof leetcodeUsername !== 'string') {
        return next(new AppError('LeetCode username is required', 400));
    }

    const username = leetcodeUsername.trim();
    if (username.length < 2 || username.length > 30) {
        return next(new AppError('Username must be 2-30 characters', 400));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 SYNC FLOW: Starting sync for user ${userId}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        // ===== STEP 1: PROVIDER - Fetch accepted problems =====
        console.log(`[1/4] 📡 Provider: Fetching accepted problems...`);
        const providerResponse = await leetcodeProvider.fetchAcceptedProblems(username);

        // Check for provider errors
        if (providerResponse.error) {
            console.error(`❌ Provider error: ${providerResponse.message}`);
            return next(new AppError(providerResponse.message, providerResponse.statusCode));
        }

        console.log(`✅ Provider: Successfully fetched data`);

        // ===== STEP 2: NORMALIZATION - Transform to internal format =====
        console.log(`\n[2/4] 📝 Normalization: Transforming LeetCode response...`);
        const normalizedData = normalizeAcceptedProblems(providerResponse, userId);
        const { problems, stats: normStats } = normalizedData;

        console.log(`✅ Normalization: Complete`);
        console.log(`   - Valid problems: ${normStats.valid}`);
        console.log(`   - Invalid/skipped: ${normStats.invalid}`);
        console.log(`   - Internal duplicates: ${normStats.duplicates}`);

        if (problems.length === 0) {
            console.log(`⚠️  No valid problems to sync`);
            return res.status(200).json({
                success: true,
                message: 'No new problems to sync',
                data: {
                    username: username,
                    syncedCount: 0,
                    skippedCount: 0,
                    totalCount: 0,
                    stats: normStats
                }
            });
        }

        // ===== STEP 3: DEDUPLICATION - Check what's new =====
        console.log(`\n[3/4] 🔍 Database: Checking for duplicates...`);

        // Build dedup keys (userId + titleSlug)
        const problemKeys = problems.map(p => ({
            userId,
            titleSlug: p.titleSlug
        }));

        // Find existing problems
        const existingProblems = await Problem.find({
            userId,
            titleSlug: { $in: problems.map(p => p.titleSlug) }
        }).select('titleSlug');

        const existingTitlSlugs = new Set(existingProblems.map(p => p.titleSlug));

        // Separate new and existing
        const newProblems = problems.filter(p => !existingTitlSlugs.has(p.titleSlug));
        const skippedProblems = problems.filter(p => existingTitlSlugs.has(p.titleSlug));

        console.log(`✅ Database check complete`);
        console.log(`   - New problems: ${newProblems.length}`);
        console.log(`   - Already in DB: ${skippedProblems.length}`);

        // ===== STEP 4: INSERTION - Insert only new problems =====
        console.log(`\n[4/4] 💾 MongoDB: Inserting new problems...`);

        let insertedCount = 0;
        if (newProblems.length > 0) {
            // Build MongoDB documents for new problems
            const documents = newProblems.map(problem =>
                buildProblemDocument(problem, userId)
            );

            // Insert using insertMany with ordered: false (skip duplicates on race conditions)
            try {
                const result = await Problem.insertMany(documents, { ordered: false });
                insertedCount = result.length;
                console.log(`✅ MongoDB: Inserted ${insertedCount} new problems`);
            } catch (insertError) {
                // Handle potential race condition where another request inserted same problems
                if (insertError.code === 11000) {
                    console.warn(`⚠️  MongoDB: Duplicate key error (race condition)`);
                    // Try inserting remaining with retries
                    insertedCount = insertError.insertedIds?.length || 0;
                    console.log(`✅ MongoDB: Inserted ${insertedCount} problems (some duplicates skipped)`);
                } else {
                    throw insertError;
                }
            }
        }

        // ===== SUCCESS RESPONSE =====
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ SYNC COMPLETE: Successfully synced problems`);
        console.log(`${'='.repeat(60)}\n`);

        res.status(200).json({
            success: true,
            message: `Sync completed for user "${username}"`,
            data: {
                username: username,
                syncedCount: insertedCount,
                skippedCount: skippedProblems.length,
                totalCount: problems.length,
                stats: {
                    fromProvider: normStats.total,
                    valid: normStats.valid,
                    invalid: normStats.invalid,
                    duplicates: normStats.duplicates,
                    inserted: insertedCount
                }
            }
        });

    } catch (error) {
        console.error(`❌ SYNC ERROR:`, error.message);
        console.error(`   Stack:`, error.stack);

        // Handle normalization errors (from provider response format issues)
        if (error.message && error.message.includes('Normalization')) {
            console.error(`❌ Normalization Error: Provider response format mismatch`);
            return next(new AppError(
                `Normalization failed: ${error.message}. Provider returned unexpected response structure.`,
                502
            ));
        }

        // Handle specific error types
        if (error.notFound) {
            return next(new AppError(error.message, 404));
        }
        if (error.graphqlError) {
            return next(new AppError(error.message, 502));
        }
        if (error.rateLimited) {
            return next(new AppError(error.message, 429));
        }
        if (error.statusCode) {
            return next(new AppError(error.message, error.statusCode));
        }

        // Generic error - log full details for debugging
        console.error(`❌ Unexpected error:`, {
            name: error.name,
            message: error.message,
            code: error.code
        });

        throw error;
    }
});

/**
 * GET /api/leetcode/problems
 * Retrieve user's synced problems with filters
 * Query: ?difficulty=Medium&topic=Array&limit=20&offset=0
 */
const getUserProblems = asyncHandler(async (req, res, next) => {
    const userId = req.user.userId;
    const { difficulty, topic, limit = 20, offset = 0 } = req.query;

    // Build query filter
    const filter = { userId };

    if (difficulty) {
        if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
            return next(new AppError('Difficulty must be Easy, Medium, or Hard', 400));
        }
        filter.difficulty = difficulty;
    }

    if (topic) {
        filter.topics = { $in: [topic.toLowerCase()] };
    }

    // Validate pagination
    const pageLimit = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageOffset = Math.max(parseInt(offset), 0);

    // Query database
    const [problems, totalCount] = await Promise.all([
        Problem.find(filter)
            .sort({ solvedAt: -1 })
            .limit(pageLimit)
            .skip(pageOffset)
            .lean(),
        Problem.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / pageLimit);
    const currentPage = Math.floor(pageOffset / pageLimit) + 1;

    res.status(200).json({
        success: true,
        data: problems,
        pagination: {
            totalCount,
            totalPages,
            currentPage,
            pageSize: pageLimit,
            hasMore: currentPage < totalPages
        }
    });
});

/**
 * GET /api/leetcode/stats
 * Get problem-solving statistics for user
 * 
 * IMPORTANT: The Problem collection stores ONLY unique accepted problems.
 * Each problem (titleSlug) appears exactly once per user.
 * So countDocuments = unique accepted problems, NOT total submissions.
 * 
 * Returns:
 *   - uniqueAcceptedProblems: count of distinct solved problems
 *   - difficultyBreakdown: { easy, medium, hard, unknown }
 *   - topTopics: [{ name, count }]  (top 20)
 *   - languages: [{ name, count }]  (top 10)
 *   - recentProblems: last 10 solved
 */
const getLeetCodeStats = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const stats = await analyticsService.getDashboardStats(userId);

    res.status(200).json({
        success: true,
        data: {
            uniqueAcceptedProblems: stats.uniqueAcceptedProblems,
            difficultyBreakdown: stats.difficultyBreakdown,
            topTopics: stats.topTopics,
            languages: stats.languages,
            recentProblems: stats.recentProblems,
        }
    });
});

/**
 * GET /api/leetcode/dashboard
 * Comprehensive dashboard analytics — all metrics in one call.
 * 
 * Returns:
 *   - overview: unique accepted count + difficulty counts
 *   - difficultyBreakdown: { easy, medium, hard, unknown }
 *   - topTopics: [{ name, count }]
 *   - languages: [{ name, count }]
 *   - recentProblems: last 10 solved
 *   - streak: { currentStreak, longestStreak, lastActiveDate, totalActiveDays }
 *   - heatmap: [{ date, count }]  (last 365 days)
 */
const getDashboardAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const dashboard = await analyticsService.getFullDashboard(userId);

    res.status(200).json({
        success: true,
        data: dashboard
    });
});

/**
 * POST /api/leetcode/enrich-problems
 * Enrich existing problems with missing difficulty data
 * Protected route: requires authentication
 */
const enrichProblems = asyncHandler(async (req, res, next) => {
    const userId = req.user.userId;

    console.log(`🔧 Starting problem enrichment for user: ${userId}`);

    // Get user's encrypted session if available (for authenticated enrichment)
    const user = await User.findById(userId).select('encryptedLeetCodeSession leetcodeUsername');

    let leetcodeClient = null;

    // If user has saved session, use authenticated client for better data
    if (user && user.encryptedLeetCodeSession) {
        try {
            const { leetcode, error } = await (await import('../services/providers/leetcodeAuthProvider.js')).default.initializeAuthenticatedConnection(
                user.encryptedLeetCodeSession
            );

            if (!error && leetcode) {
                leetcodeClient = leetcode;
                console.log(`✅ Using authenticated client for enrichment`);
            }
        } catch (err) {
            console.warn(`⚠️  Could not initialize authenticated client, falling back to public API`);
        }
    }

    // Run enrichment in background
    const enrichmentPromise = problemEnrichmentService.enrichUserProblems(userId, leetcodeClient);

    // Return immediately
    res.status(202).json({
        success: true,
        message: 'Problem enrichment started in background',
        data: {
            userId,
            status: 'in_progress'
        }
    });

    // Continue enrichment without blocking response
    enrichmentPromise
        .then((result) => {
            console.log(`✅ Enrichment completed:`, result);
        })
        .catch((error) => {
            console.error(`❌ Enrichment failed:`, error.message);
        });
});

export {
    storeSession,
    startDeepSync,
    startBackgroundSync,
    getSyncStatus,
    syncLeetCodeProblems,
    syncAcceptedProblems,
    getUserProblems,
    getLeetCodeStats,
    getDashboardAnalytics,
    enrichProblems
};
