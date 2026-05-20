import leetcodeProvider from '../services/providers/leetcodeProvider.js';
import { normalizeLeetcodeStats } from '../services/normalization/normalizeLeetcodeData.js';
import Problem from '../models/Problem.js';
import { asyncHandler, AppError } from '../utils/errorHandler.js';

/**
 * POST /api/leetcode/sync
 * Fetch user's LeetCode stats (stable GraphQL integration)
 * Returns: username, solved count, ranking, reputation, difficulty breakdown
 */
const syncLeetCodeProblems = asyncHandler(async (req, res, next) => {
    const { leetcodeUsername } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!leetcodeUsername || typeof leetcodeUsername !== 'string') {
        return next(new AppError('LeetCode username is required', 400));
    }

    const username = leetcodeUsername.trim();
    if (username.length < 2 || username.length > 30) {
        return next(new AppError('Username must be 2-30 characters', 400));
    }

    try {
        // Step 1: Fetch user stats from LeetCode (stable GraphQL query)
        const rawStats = await leetcodeProvider.fetchUserStats(username);

        // DEBUG: Log raw API response to check data structure
        console.log('🔍 Raw LeetCode API Response:', {
            username: rawStats.username,
            acSubmissionNum: rawStats.submitStats?.acSubmissionNum,
            totalSubmissionNum: rawStats.submitStats?.totalSubmissionNum
        });

        // Step 2: Normalize to internal format
        const normalizedStats = normalizeLeetcodeStats(rawStats, userId);

        // Step 3: Return user stats
        // Note: Problem history syncing will be implemented separately
        res.status(200).json({
            success: true,
            message: `Successfully fetched LeetCode stats for ${normalizedStats.username}`,
            data: {
                username: normalizedStats.username,
                userId: normalizedStats.userId,
                stats: normalizedStats.stats,
                lastSyncAt: normalizedStats.lastSyncAt
            }
        });

    } catch (error) {
        // Handle provider errors with proper status codes
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
    getUserProblems,
    getLeetCodeStats
};
