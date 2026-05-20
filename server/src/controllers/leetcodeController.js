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
    const userId = req.user._id;

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

        throw error;
    }
});

/**
 * GET /api/leetcode/problems
 * Retrieve user's synced problems with filters
 * Query: ?difficulty=Medium&topic=Array&limit=20&offset=0
 */
const getUserProblems = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
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
    const userId = req.user._id;

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
