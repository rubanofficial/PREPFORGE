import leetcodeService from '../services/leetcodeService.js';
import Problem from '../models/Problem.js';
import { asyncHandler } from '../utils/errorHandler.js';

/**
 * POST /api/leetcode/sync
 * Fetch user's LeetCode data and store in MongoDB
 */
const syncLeetCodeProblems = asyncHandler(async (req, res) => {
  const { leetcodeUsername } = req.body;
  const userId = req.user._id;

  // Validation
  if (!leetcodeUsername || typeof leetcodeUsername !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'LeetCode username is required and must be a string'
    });
  }

  if (leetcodeUsername.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'LeetCode username must be at least 2 characters'
    });
  }

  // Fetch data from LeetCode GraphQL
  const leetcodeData = await leetcodeService.fetchLeetCodeData(
    leetcodeUsername.trim()
  );

  // Delete old problems for this user (so we don't have duplicates)
  await Problem.deleteMany({ userId });

  // Transform and save each submission to MongoDB
  const problemsToSave = leetcodeData.submissions.map(submission => ({
    title: submission.problemDetails.title,
    titleSlug: submission.problemDetails.titleSlug,
    questionId: submission.problemDetails.questionId,
    platform: 'leetcode',
    difficulty: submission.problemDetails.difficulty,
    solvedAt: new Date(submission.timestamp * 1000), // Convert Unix timestamp to Date
    userId,
    topics: submission.problemDetails.topics || [],
    pattern: [], // Empty for now; recommendation engine will populate this later
    submissionId: submission.id,
    language: null // LeetCode submission object doesn't always include language
  }));

  // Batch insert all problems
  const savedProblems = await Problem.insertMany(problemsToSave);

  res.status(200).json({
    success: true,
    message: `Synced ${savedProblems.length} problems from LeetCode`,
    data: {
      totalSynced: savedProblems.length,
      solvedCount: leetcodeData.solvedCount,
      recentProblems: savedProblems.slice(0, 5) // Return first 5 as preview
    }
  });
});

/**
 * GET /api/leetcode/problems
 * Retrieve user's synced problems from MongoDB
 * Query parameters: ?difficulty=Medium&limit=10&offset=0
 */
const getUserProblems = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { difficulty, topic, limit = 20, offset = 0 } = req.query;

  // Build query filters dynamically
  const queryFilter = { userId };

  if (difficulty) {
    if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: 'Difficulty must be Easy, Medium, or Hard'
      });
    }
    queryFilter.difficulty = difficulty;
  }

  if (topic) {
    queryFilter.topics = { $in: [topic] }; // $in finds documents where topic array contains the value
  }

  // Validate pagination
  const parsedLimit = Math.min(Math.max(parseInt(limit), 1), 100); // Ensure between 1-100
  const parsedOffset = Math.max(parseInt(offset), 0);

  // Execute query with pagination
  const [problems, totalCount] = await Promise.all([
    Problem.find(queryFilter)
      .sort({ solvedAt: -1 }) // Most recent first
      .limit(parsedLimit)
      .skip(parsedOffset)
      .select('-__v'), // Exclude MongoDB version field
    Problem.countDocuments(queryFilter)
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / parsedLimit);
  const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;

  res.status(200).json({
    success: true,
    data: problems,
    pagination: {
      totalCount,
      totalPages,
      currentPage,
      pageSize: parsedLimit,
      hasMore: currentPage < totalPages
    }
  });
});

/**
 * GET /api/leetcode/stats
 * Get summary statistics about user's solved problems
 */
const getLeetCodeStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Aggregate data by difficulty
  const stats = await Problem.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$difficulty',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Aggregate data by topic
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
    { $limit: 10 } // Top 10 topics
  ]);

  // Get total solved
  const totalSolved = await Problem.countDocuments({ userId });

  // Calculate difficulty breakdown
  const difficultyBreakdown = {
    easy: 0,
    medium: 0,
    hard: 0
  };

  stats.forEach(stat => {
    if (stat._id === 'Easy') difficultyBreakdown.easy = stat.count;
    if (stat._id === 'Medium') difficultyBreakdown.medium = stat.count;
    if (stat._id === 'Hard') difficultyBreakdown.hard = stat.count;
  });

  res.status(200).json({
    success: true,
    data: {
      totalSolved,
      difficultyBreakdown,
      topTopics: topicStats.map(topic => ({
        name: topic._id,
        count: topic.count
      }))
    }
  });
});

export {
  syncLeetCodeProblems,
  getUserProblems,
  getLeetCodeStats
};
