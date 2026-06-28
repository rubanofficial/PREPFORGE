import mongoose from 'mongoose';
import leetcodeProvider from '../services/providers/leetcodeProvider.js';
import leetcodeAuthProvider from '../services/providers/leetcodeAuthProvider.js';
import { normalizeLeetcodeStats } from '../services/normalization/normalizeLeetcodeData.js';
import { normalizeAcceptedProblems, buildProblemDocument } from '../services/normalization/normalizeAcceptedProblems.js';
import backgroundSyncService from '../services/sync/backgroundSyncService.js';
import deepSyncService from '../services/sync/deepSyncService.js';
import { encrypt } from '../utils/encryption.js';
import Problem from '../models/Problem.js';
import SyncJob from '../models/SyncJob.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { analyzeUserPerformance } from '../services/geminiAnalysisService.js';

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
 * Fetch and sync user's COMPLETE ACCEPTED SOLVED PROBLEMS from LeetCode
 * 
 * WHY THIS NEW FLOW?
 * 1. COMPLETE HISTORY: Fetches ALL solved problems, not just latest 20
 * 2. DYNAMIC SCALING: Uses total solved count to determine fetch limit
 * 3. SAFE LIMITS: Backend protection against massive requests
 * 4. HISTORICAL DATA: Preserves complete solving timeline
 * 
 * NEW FLOW (5 STEPS):
 * Step 1: Fetch solved stats (to get total count)
 * Step 2: Dynamically set limit = total solved count
 * Step 3: Fetch all accepted problems with dynamic limit
 * Step 4: Normalize and deduplicate
 * Step 5: Insert only new problems (preserve history)
 * 
 * ARCHITECTURE PATTERN:
 * Route → Controller → Provider (Stats) → Provider (Problems) → Normalization → Dedup → MongoDB
 *
 * RESPONSIBILITIES BY LAYER:
 * - Controller: Orchestrate flow, validate input, handle errors
 * - Provider: Fetch data from API only (with safe limits)
 * - Normalization: Transform structure (title, titleSlug, solvedAt)
 * - MongoDB: Store data with compound unique index (userId + titleSlug)
 * 
 * WHY THIS ARCHITECTURE SCALES:
 * 1. MODULAR: Each layer can be tested independently
 * 2. PROVIDER AGNOSTIC: Can add GFG, Codeforces providers later
 * 3. SAFE: Built-in upper limit protection (3000 max per sync)
 * 4. EFFICIENT: Uses deduplication before insert
 * 5. MAINTAINABLE: Clear separation of concerns
 * 
 * LOGGING DETAILS:
 * - Total solved count from stats
 * - Limit used for API request
 * - Provider response size
 * - Normalization count (valid/invalid/duplicates)
 * - Database deduplication count
 * - Inserted count
 * - Skipped count
 */
const syncAcceptedProblems = asyncHandler(async (req, res, next) => {
    const { leetcodeUsername } = req.body;
    const userId = req.user.userId;

    // ===== INPUT VALIDATION =====
    if (!leetcodeUsername || typeof leetcodeUsername !== 'string') {
        return next(new AppError('LeetCode username is required', 400));
    }

    const username = leetcodeUsername.trim();
    if (username.length < 2 || username.length > 50) {
        return next(new AppError('Username must be 2-50 characters', 400));
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 FULL SYNC FLOW: Starting complete problem sync for user ${userId}`);
    console.log(`   Username: ${username}`);
    console.log(`${'='.repeat(70)}\n`);

    try {
        // ===== STEP 1: FETCH SOLVED STATS =====
        console.log(`[STEP 1/5] 📊 Provider: Fetching solved statistics...`);
        const statsResponse = await leetcodeProvider.fetchSolvedStats(username);

        // Check for provider errors
        if (statsResponse.error) {
            console.error(`❌ Stats fetch error: ${statsResponse.message}`);
            return next(new AppError(statsResponse.message, statsResponse.statusCode));
        }

        const totalSolved = statsResponse.data.totalSolved;
        console.log(`✅ Stats fetched:`, {
            totalSolved: statsResponse.data.totalSolved,
            easySolved: statsResponse.data.easySolved,
            mediumSolved: statsResponse.data.mediumSolved,
            hardSolved: statsResponse.data.hardSolved
        });

        // Early exit if user has no problems
        if (totalSolved === 0) {
            console.log(`⚠️  User "${username}" has no solved problems`);
            return res.status(200).json({
                success: true,
                message: `User "${username}" has no solved problems`,
                data: {
                    username: username,
                    syncedCount: 0,
                    skippedCount: 0,
                    totalCount: 0,
                    stats: {
                        totalSolved: 0,
                        easySolved: 0,
                        mediumSolved: 0,
                        hardSolved: 0,
                        inserted: 0
                    }
                }
            });
        }

        // ===== STEP 2: DYNAMICALLY DETERMINE FETCH LIMIT =====
        console.log(`\n[STEP 2/5] 🎯 Controller: Setting dynamic limit...`);
        const dynamicLimit = totalSolved;
        console.log(`✅ Dynamic limit set:`, {
            totalSolvedCount: totalSolved,
            limitToFetch: dynamicLimit,
            reason: 'Using total solved count as limit'
        });

        // ===== STEP 3: FETCH ALL ACCEPTED PROBLEMS WITH DYNAMIC LIMIT =====
        console.log(`\n[STEP 3/5] 📡 Provider: Fetching all accepted problems...`);

        // Try to fetch all problems - the API may paginate, so we fetch in chunks
        let allSubmissions = [];
        let offset = 0;
        const chunkSize = dynamicLimit; // Fetch size per request
        let hasMore = true;
        let fetchAttempts = 0;
        const maxFetchAttempts = 15; // Prevent infinite loops (max ~15 * 3000 = 45k problems)

        while (hasMore && fetchAttempts < maxFetchAttempts) {
            fetchAttempts++;
            console.log(`   📥 Fetch attempt ${fetchAttempts}: offset=${offset}, limit=${chunkSize}`);

            // Try fetching with the dynamic limit and offset (for pagination)
            const providerResponse = await leetcodeProvider.fetchAcceptedProblems(username, chunkSize, offset);

            // Check for provider errors
            if (providerResponse.error) {
                console.error(`❌ Provider error on attempt ${fetchAttempts}: ${providerResponse.message}`);

                // If it's a timeout or network error, don't retry indefinitely
                if (providerResponse.error === 'TIMEOUT' || providerResponse.error === 'NETWORK_ERROR') {
                    console.error(`❌ Network error - stopping pagination`);
                    if (allSubmissions.length === 0) {
                        return next(new AppError(providerResponse.message, providerResponse.statusCode));
                    }
                    break; // Use what we've fetched so far
                }

                // For other errors, stop
                return next(new AppError(providerResponse.message, providerResponse.statusCode));
            }

            const batch = providerResponse.data.submissions || [];
            const batchCount = batch.length;

            console.log(`   ✅ Received ${batchCount} problems in this batch`);

            allSubmissions = allSubmissions.concat(batch);

            // Check if we got fewer items than requested (pagination detection)
            if (batchCount < chunkSize) {
                console.log(`   ✨ Reached end of results (received ${batchCount} < requested ${chunkSize})`);
                hasMore = false;
            }

            offset += batchCount;
        }

        if (allSubmissions.length === 0) {
            console.log(`⚠️  No problems fetched from provider`);
            return res.status(200).json({
                success: true,
                message: 'No valid problems to sync',
                data: {
                    username: username,
                    syncedCount: 0,
                    skippedCount: 0,
                    totalCount: 0,
                    stats: {
                        totalSolvedOnLeetCode: statsResponse.data.totalSolved,
                        easyOnLeetCode: statsResponse.data.easySolved,
                        mediumOnLeetCode: statsResponse.data.mediumSolved,
                        hardOnLeetCode: statsResponse.data.hardSolved,
                        fetchedFromProvider: 0,
                        limitUsed: dynamicLimit,
                        reason: 'No submissions returned from provider'
                    }
                }
            });
        }

        console.log(`✅ Provider: Successfully fetched total ${allSubmissions.length} accepted problems`);

        // Prepare provider response object for normalization
        const completeProviderResponse = {
            success: true,
            data: {
                username: username.trim(),
                submissions: allSubmissions,
                count: allSubmissions.length,
                limitUsed: dynamicLimit,
                fetchedAt: new Date().toISOString()
            }
        };

        // ===== STEP 4: NORMALIZATION - Transform to internal format =====
        console.log(`\n[STEP 4/5] 📝 Normalization: Transforming ${allSubmissions.length} problems...`);
        const normalizedData = normalizeAcceptedProblems(completeProviderResponse, userId);
        const { problems, stats: normStats } = normalizedData;

        console.log(`✅ Normalization complete:`, {
            validProblems: normStats.valid,
            invalidSkipped: normStats.invalid,
            internalDuplicates: normStats.duplicates,
            totalProcessed: normStats.total
        });

        if (problems.length === 0) {
            console.log(`⚠️  No valid problems after normalization`);
            return res.status(200).json({
                success: true,
                message: 'No valid problems to sync',
                data: {
                    username: username,
                    syncedCount: 0,
                    skippedCount: 0,
                    totalCount: 0,
                    stats: normStats
                }
            });
        }

        // ===== STEP 5: DEDUPLICATION & INSERTION =====
        console.log(`\n[STEP 5/5] 💾 Database: Checking duplicates and inserting...`);

        // Find existing problems using compound index (userId + titleSlug)
        const existingProblems = await Problem.find({
            userId,
            titleSlug: { $in: problems.map(p => p.titleSlug) }
        }).select('titleSlug');

        const existingTitleSlugs = new Set(existingProblems.map(p => p.titleSlug));

        // Separate new and existing
        const newProblems = problems.filter(p => !existingTitleSlugs.has(p.titleSlug));
        const skippedProblems = problems.filter(p => existingTitleSlugs.has(p.titleSlug));

        console.log(`✅ Deduplication check:`, {
            newProblems: newProblems.length,
            existingInDB: skippedProblems.length,
            totalFromNormalization: problems.length
        });

        // Insert only new problems
        let insertedCount = 0;
        if (newProblems.length > 0) {
            // Build MongoDB documents
            const documents = newProblems.map(problem =>
                buildProblemDocument(problem, userId)
            );

            // Insert using insertMany with ordered: false (race condition safe)
            try {
                const result = await Problem.insertMany(documents, { ordered: false });
                insertedCount = result.length;
                console.log(`✅ MongoDB: Inserted ${insertedCount} new problems`);
            } catch (insertError) {
                // Handle race condition (another request inserted same problems)
                if (insertError.code === 11000) {
                    console.warn(`⚠️  MongoDB: Duplicate key error (race condition - safe)`);
                    insertedCount = insertError.insertedIds?.length || 0;
                    console.log(`✅ MongoDB: Inserted ${insertedCount} problems (duplicates skipped)`);
                } else {
                    throw insertError;
                }
            }
        }

        // ===== SUCCESS RESPONSE =====
        console.log(`\n${'='.repeat(70)}`);
        console.log(`✅ FULL SYNC COMPLETE`);
        console.log(`${'='.repeat(70)}\n`);

        res.status(200).json({
            success: true,
            message: `Full sync completed for user "${username}"`,
            data: {
                username: username,
                syncedCount: insertedCount,
                skippedCount: skippedProblems.length,
                totalCount: problems.length,
                stats: {
                    // Stats from LeetCode
                    totalSolvedOnLeetCode: statsResponse.data.totalSolved,
                    easyOnLeetCode: statsResponse.data.easySolved,
                    mediumOnLeetCode: statsResponse.data.mediumSolved,
                    hardOnLeetCode: statsResponse.data.hardSolved,
                    // Provider response
                    fetchedFromProvider: allSubmissions.length,
                    limitUsed: dynamicLimit,
                    fetchAttempts: fetchAttempts,
                    // Normalization
                    validFromProvider: normStats.valid,
                    invalidSkipped: normStats.invalid,
                    internalDuplicates: normStats.duplicates,
                    // Database
                    alreadyInDatabase: skippedProblems.length,
                    newProblemsInserted: insertedCount
                }
            }
        });

    } catch (error) {
        console.error(`❌ SYNC ERROR:`, error.message);
        console.error(`   Stack:`, error.stack);

        // Handle normalization errors
        if (error.message && error.message.includes('Normalization')) {
            console.error(`❌ Normalization Error: Provider response format mismatch`);
            return next(new AppError(
                `Normalization failed: ${error.message}`,
                502
            ));
        }

        // Handle specific error types
        if (error.notFound) {
            return next(new AppError(error.message, 404));
        }
        if (error.rateLimited) {
            return next(new AppError(error.message, 429));
        }
        if (error.statusCode) {
            return next(new AppError(error.message, error.statusCode));
        }

        // Generic error
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
 * POST /api/leetcode/start-sync
 * Start background LeetCode sync job
 *
 * RETURNS IMMEDIATELY without waiting for sync to complete
 *
 * Flow:
 * 1. Create SyncJob document (pending)
 * 2. Spawn background sync task (NOT awaited)
 * 3. Return syncJobId to client
 * 4. Client can poll GET /sync-status/:syncJobId for progress
 *
 * WHY THIS WORKS:
 * - Request lifecycle: User gets response in <100ms
 * - Background task: Processes batches independently
 * - Scalability: Multiple users can sync simultaneously
 * - UX: No timeout waiting for long syncs
 * - Foundation: Can upgrade to queue systems later
 */
const startBackgroundSync = asyncHandler(async (req, res, next) => {
    const userId = req.user.userId;

    // Username can come from body OR from the stored User record (same as deep-sync)
    let username = req.body?.leetcodeUsername?.trim();

    if (!username) {
        // Fall back to the stored leetcodeUsername on the User document
        const userRecord = await User.findById(userId).select('leetcodeUsername');
        if (!userRecord) return next(new AppError('User not found', 404));
        username = userRecord.leetcodeUsername;
    }

    if (!username || typeof username !== 'string') {
        return next(new AppError('LeetCode username is required. Please set it in Settings.', 400));
    }

    if (username.length < 2 || username.length > 50) {
        return next(new AppError('Username must be 2-50 characters', 400));
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📨 START-SYNC: Determining sync mode for user ${userId}`);
    console.log(`   Username: ${username}`);
    console.log(`${'='.repeat(70)}\n`);

    try {
        // ── DETERMINE SYNC MODE ────────────────────────────────────────────────
        // Read the user's last sync watermark from the database.
        // - null  → never synced before → FULL sync
        // - Date  → previously synced   → INCREMENTAL sync (delta only)
        const user = await User.findById(userId).select('lastLeetcodeSyncAt lastSolvedCount');

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        const lastSolvedCount = user.lastSolvedCount ?? 0;
        const sinceTimestamp = user.lastLeetcodeSyncAt || null;
        const syncMode = lastSolvedCount > 0 ? 'incremental' : 'full';

        console.log(`✅ Sync mode determined: ${syncMode.toUpperCase()}`);
        console.log(`   Previous Solved Count: ${lastSolvedCount}`);
        if (lastSolvedCount === 0) {
            console.log(`   No prior sync found — performing full sync`);
        }
        // ─────────────────────────────────────────────────────────────────────

        // Create SyncJob in pending state
        const syncJob = await SyncJob.create({
            userId,
            username: username.toLowerCase(),
            status: 'pending',
            syncMode,
            syncFrom: sinceTimestamp
        });

        console.log(`✅ SyncJob created: ${syncJob._id}`);

        // Spawn background task - do NOT await this
        // This allows us to return immediately to client
        backgroundSyncService.startBackgroundSync(
            syncJob._id.toString(),
            username,
            userId,
            lastSolvedCount,
            syncMode
        ).catch(error => {
            // Catch unhandled errors in background task
            console.error(`❌ Background sync failed (unhandled):`, error);
        });

        console.log(`🚀 Background sync spawned (not awaited)`);
        console.log(`✅ Returning syncJobId to client immediately\n`);

        // Return immediately with sync job ID
        res.status(202).json({
            success: true,
            message: `${syncMode === 'incremental' ? 'Incremental' : 'Full'} sync started in background`,
            data: {
                syncJobId: syncJob._id,
                username: username,
                status: syncJob.status,
                syncMode,
                previousSolvedCount: lastSolvedCount,
                message: 'Use GET /api/leetcode/sync-status/:syncJobId to check progress'
            }
        });

    } catch (error) {
        console.error(`❌ Failed to create sync job:`, error.message);
        return next(new AppError(`Failed to start sync: ${error.message}`, 500));
    }
});

/**
 * GET /api/leetcode/sync-status/:syncJobId
 * Get progress of a background sync job
 *
 * Returns current state:
 * - status: pending | active | completed | failed
 * - progress: { processed, inserted, duplicates, failed }
 * - timestamps: startedAt, completedAt
 * - error: if status is 'failed'
 *
 * POLLING PATTERN:
 * Client can poll this endpoint to show progress bar:
 * - "Fetched 20 problems"
 * - "Inserted 18, skipped 2 duplicates"
 * - "Batch 5 complete"
 * - "Sync finished! 127 new problems added"
 */
const getSyncStatus = asyncHandler(async (req, res, next) => {
    const { syncJobId } = req.params;
    const userId = req.user.userId;

    // Validate syncJobId format
    if (!syncJobId || syncJobId.length !== 24) {
        return next(new AppError('Invalid syncJobId format', 400));
    }

    console.log(`📊 SYNC-STATUS: Checking job ${syncJobId}`);

    try {
        // Fetch sync job
        const syncJob = await SyncJob.findById(syncJobId).select(
            'userId username status progress startedAt completedAt error metadata syncMode syncFrom'
        );

        if (!syncJob) {
            return next(new AppError('Sync job not found', 404));
        }

        // Verify ownership - user can only check their own sync jobs
        if (syncJob.userId.toString() !== userId) {
            return next(new AppError('Not authorized to view this sync job', 403));
        }

        // Calculate elapsed time
        const elapsedMs = syncJob.completedAt
            ? syncJob.completedAt - syncJob.startedAt
            : Date.now() - syncJob.startedAt;

        const elapsedSeconds = Math.round(elapsedMs / 1000);

        // Calculate progress percentage
        // ─────────────────────────────────────────────────────────────────
        // Rules:
        //   completed → always 100  (even if totalExpected was never set)
        //   failed    → always 0
        //   active/pending → ratio of processed/totalExpected, capped at 99
        //                    so the bar never falsely hits 100% before done
        // ─────────────────────────────────────────────────────────────────
        let progressPercent = 0;
        if (syncJob.status === 'completed') {
            progressPercent = 100;
        } else if (syncJob.status !== 'failed') {
            const { totalExpected, processed } = syncJob.progress;
            if (totalExpected > 0 && processed > 0) {
                progressPercent = Math.min(
                    Math.round((processed / totalExpected) * 100),
                    99   // cap in-progress at 99% — only completed gets 100
                );
            }
        }

        // Debug log — remove once confirmed working
        console.log(`📊 Progress calc: status=${syncJob.status} processed=${syncJob.progress.processed} totalExpected=${syncJob.progress.totalExpected} → progressPercent=${progressPercent}`);

        console.log(`✅ Retrieved job status: ${syncJob.status}`);

        // Build response
        res.status(200).json({
            success: true,
            data: {
                syncJobId: syncJob._id,
                username: syncJob.username,
                status: syncJob.status,

                // Sync type (full vs incremental delta sync)
                syncMode: syncJob.syncMode || 'full',
                sinceTimestamp: syncJob.syncFrom || null,
                // Progress tracking
                progress: {
                    expectedProblems: syncJob.progress.totalExpected,
                    fetchedFromProvider: syncJob.progress.processed,
                    insertedToDatabase: syncJob.progress.inserted,
                    duplicatesSkipped: syncJob.progress.duplicates,
                    failedToProcess: syncJob.progress.failed,
                    batchesCompleted: syncJob.progress.batchesProcessed
                },

                // Percentage complete
                progressPercent,

                // Timing
                startedAt: syncJob.startedAt,
                completedAt: syncJob.completedAt,
                elapsedSeconds,

                // For failed jobs
                error: syncJob.error || null,

                // Metadata for debugging
                metadata: syncJob.metadata || {}
            }
        });

    } catch (error) {
        console.error(`❌ Error fetching sync status:`, error.message);
        return next(new AppError(`Failed to get sync status: ${error.message}`, 500));
    }
});

/**
 * GET /api/leetcode/stats
 * Get problem-solving statistics for user
 */
const getLeetCodeStats = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    // IMPORTANT: aggregate() does NOT auto-cast strings to ObjectId like find() does.
    // The Problem model stores userId as ObjectId, so we must convert explicitly.
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get difficulty breakdown
    const difficultyStats = await Problem.aggregate([
        { $match: { userId: userObjectId } },
        {
            $group: {
                _id: '$difficulty',
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Get top topics
    const topicStats = await Problem.aggregate([
        { $match: { userId: userObjectId } },
        { $unwind: '$topics' },
        {
            $group: {
                _id: '$topics',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    // Get total count
    const totalSolved = await Problem.countDocuments({ userId });

    // Build breakdown object
    const breakdown = { easy: 0, medium: 0, hard: 0, null: 0 };
    difficultyStats.forEach(stat => {
        const key = stat._id ? stat._id.toLowerCase() : 'null';
        if (key in breakdown) breakdown[key] = stat.count;
    });

    res.status(200).json({
        success: true,
        data: {
            totalSolved,
            difficultyBreakdown: breakdown,
            topTopics: topicStats.map(t => ({
                name: t._id,
                count: t.count
            }))
        }
    });
});

/**
 * GET /api/leetcode/ai-analysis
 * Generate and return AI-powered performance analysis for user
 */
const getAIAnalysis = asyncHandler(async (req, res, next) => {
    const userId = req.user.userId;

    try {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🤖 AI ANALYSIS: Generating performance analysis for user ${userId}`);
        console.log(`${'='.repeat(70)}\n`);

        const analysisResult = await analyzeUserPerformance(userId);

        if (!analysisResult || analysisResult.success === false) {
            // Return 404 if no problems solved yet, which triggers the frontend "no data" page
            return next(new AppError(
                analysisResult?.message || 'No problems solved yet. Sync problems first to get AI analysis.',
                404
            ));
        }

        res.status(200).json({
            success: true,
            message: 'AI analysis completed',
            data: {
                ...analysisResult.analysis,
                metrics: analysisResult.performanceMetrics,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error(`❌ AI Analysis failed:`, error.message);
        return next(new AppError(`AI Analysis failed: ${error.message}`, 500));
    }
});

/**
 * POST /api/leetcode/store-session
 * Store encrypted LEETCODE_SESSION cookie for authenticated syncing
 * 
 * BODY:
 * {
 *   "leetcodeUsername": "john_doe",
 *   "leetcodeSessionCookie": "LEETCODE_SESSION=eyJf..."
 * }
 * 
 * SECURITY:
 * - Cookie is encrypted before storing in database
 * - Encryption key must be in ENCRYPTION_KEY env variable
 * - Encrypted value is stored in User.encryptedLeetCodeSession
 * - Never returned in API responses
 * - Only used for background sync operations
 * 
 * WHY THIS ENDPOINT?
 * - Users need a secure way to provide their session cookie
 * - We encrypt it immediately
 * - Backend stores encrypted value only
 * - User can update/revoke session anytime
 */
const storeSession = asyncHandler(async (req, res, next) => {
    const { leetcodeUsername, leetcodeSessionCookie } = req.body;
    const userId = req.user.userId;

    // Validate inputs
    if (!leetcodeUsername || typeof leetcodeUsername !== 'string') {
        return next(new AppError('LeetCode username is required', 400));
    }

    if (!leetcodeSessionCookie || typeof leetcodeSessionCookie !== 'string') {
        return next(new AppError('LEETCODE_SESSION cookie is required', 400));
    }

    const username = leetcodeUsername.trim().toLowerCase();

    if (username.length < 2 || username.length > 50) {
        return next(new AppError('Username must be 2-50 characters', 400));
    }

    // Validate that cookie looks like a real session cookie
    const isValidCookie = leetcodeSessionCookie.length >= 20 && (
        leetcodeSessionCookie.includes('=') || 
        leetcodeSessionCookie.startsWith('eyJ')
    );
    if (!isValidCookie) {
        return next(new AppError('Invalid session cookie format', 400));
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔐 STORE-SESSION: Encrypting and storing session`);
    console.log(`   User: ${userId}`);
    console.log(`   Username: ${username}`);
    console.log(`${'='.repeat(70)}\n`);

    try {
        // Encrypt the session cookie
        const encryptedSession = encrypt(leetcodeSessionCookie);

        console.log(`✅ Session encrypted successfully`);

        // Update user with encrypted session and username
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                leetcodeUsername: username,
                encryptedLeetCodeSession: encryptedSession,
                lastLeetcodeSyncAt: null, // Reset sync timestamp
            },
            { new: true, select: '-password -encryptedLeetCodeSession' }
        );

        if (!updatedUser) {
            return next(new AppError('User not found', 404));
        }

        console.log(`✅ User updated with encrypted session`);
        console.log(`   Username stored: ${username}\n`);

        res.status(200).json({
            success: true,
            message: 'LeetCode session stored securely',
            data: {
                userId,
                leetcodeUsername: username,
                message: 'Session is encrypted. You can now start authenticated deep sync.'
            }
        });

    } catch (error) {
        console.error(`❌ Failed to store session:`, error.message);
        return next(new AppError(`Failed to store session: ${error.message}`, 500));
    }
});

/**
 * POST /api/leetcode/start-deep-sync
 * Start authenticated deep-sync using encrypted LEETCODE_SESSION
 * 
 * FLOW:
 * 1. Verify user has stored session
 * 2. Create SyncJob (pending)
 * 3. Start background deep sync (NOT awaited)
 * 4. Return immediately with syncJobId
 * 
 * BACKGROUND PROCESS:
 * - Initializes authenticated LeetCode connection
 * - Fetches all submissions with pagination
 * - Normalizes and deduplicates
 * - Inserts into database
 * - Tracks progress in SyncJob
 * - Handles errors gracefully
 * 
 * WHY BACKGROUND?
 * - Deep sync can take 30+ seconds (depending on submission count)
 * - Request timeout would kill the sync
 * - User gets immediate response with syncJobId
 * - Can poll GET /api/leetcode/sync-status/:syncJobId for progress
 */
const startDeepSync = asyncHandler(async (req, res, next) => {
    const userId = req.user.userId;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 START-DEEP-SYNC: Initiating authenticated deep sync`);
    console.log(`   User: ${userId}`);
    console.log(`${'='.repeat(70)}\n`);

    try {
        // Verify user has stored session
        const user = await User.findById(userId).select(
            'leetcodeUsername encryptedLeetCodeSession'
        );

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        if (!user.encryptedLeetCodeSession) {
            return next(new AppError(
                'No LeetCode session stored. Use POST /api/leetcode/store-session first.',
                400
            ));
        }

        if (!user.leetcodeUsername) {
            return next(new AppError(
                'LeetCode username not found. Please store session again.',
                400
            ));
        }

        console.log(`✅ Verified stored session for user: ${user.leetcodeUsername}`);

        // Create SyncJob in pending state
        const syncJob = await SyncJob.create({
            userId,
            username: user.leetcodeUsername.toLowerCase(),
            status: 'pending',
            metadata: {
                syncType: 'authenticated-deep-sync',
                initiatedAt: new Date(),
            }
        });

        console.log(`✅ SyncJob created: ${syncJob._id}`);

        // Spawn background deep sync - do NOT await this
        // This allows us to return immediately to client
        deepSyncService.performDeepSync(
            userId.toString(),
            user.encryptedLeetCodeSession,
            syncJob._id.toString()
        ).catch(error => {
            // Catch unhandled errors in background task
            console.error(`❌ Deep sync failed (unhandled):`, error);
        });

        console.log(`🚀 Background deep sync spawned (not awaited)`);
        console.log(`✅ Returning syncJobId to client immediately\n`);

        // Return immediately with sync job ID
        res.status(202).json({
            success: true,
            message: 'Deep sync started in background',
            data: {
                syncJobId: syncJob._id,
                username: user.leetcodeUsername,
                status: syncJob.status,
                message: 'Deep sync is running. Use GET /api/leetcode/sync-status/:syncJobId to check progress'
            }
        });

    } catch (error) {
        console.error(`❌ Failed to start deep sync:`, error.message);
        return next(new AppError(`Failed to start deep sync: ${error.message}`, 500));
    }
});

/**
 * GET /api/leetcode/sync-info
 * Returns sync metadata needed by the UI to show delta preview:
 * - lastSyncAt   : watermark timestamp (null = never synced)
 * - localCount   : number of problems stored locally for this user
 * - syncMode     : 'full' (first sync) | 'incremental' (subsequent syncs)
 */
const getSyncInfo = asyncHandler(async (req, res, next) => {
    const userId = req.user.userId;

    try {
        const [user, localCount] = await Promise.all([
            User.findById(userId).select('lastLeetcodeSyncAt leetcodeUsername'),
            Problem.countDocuments({ userId })
        ]);

        if (!user) return next(new AppError('User not found', 404));

        const lastSyncAt = user.lastLeetcodeSyncAt || null;
        const syncMode = lastSyncAt ? 'incremental' : 'full';

        res.status(200).json({
            success: true,
            data: {
                lastSyncAt,
                localCount,
                syncMode,
                leetcodeUsername: user.leetcodeUsername || null
            }
        });
    } catch (error) {
        return next(new AppError(`Failed to get sync info: ${error.message}`, 500));
    }
});

export {
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
};
