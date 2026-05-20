import leetcodeProvider from '../services/providers/leetcodeProvider.js';
import { normalizeLeetcodeStats } from '../services/normalization/normalizeLeetcodeData.js';
import { normalizeAcceptedProblems, buildProblemDocument } from '../services/normalization/normalizeAcceptedProblems.js';
import Problem from '../models/Problem.js';
import { asyncHandler, AppError } from '../utils/errorHandler.js';

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
 * GET /api/leetcode/stats
 * Get problem-solving statistics for user
 */
const getLeetCodeStats = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    // Get difficulty breakdown
    const difficultyStats = await Problem.aggregate([
        { $match: { userId } },
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
        { $match: { userId } },
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

export {
    syncLeetCodeProblems,
    syncAcceptedProblems,
    getUserProblems,
    getLeetCodeStats
};
