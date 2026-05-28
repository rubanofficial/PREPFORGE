import mongoose from 'mongoose';
import Problem from '../models/Problem.js';

/**
 * ANALYTICS SERVICE
 * 
 * Optimized MongoDB aggregation queries for dashboard metrics.
 * 
 * Since the Problem collection stores ONLY unique accepted problems
 * (one document per titleSlug per user), counting is straightforward:
 * 
 *   - Unique accepted problems = Problem.countDocuments({ userId })
 *   - Difficulty breakdown = $group by difficulty
 *   - Topic-wise solved = $unwind topics → $group by topic
 *   - Each problem appears exactly ONCE — no deduplication needed at query time
 * 
 * ============================================================================
 * HOW LEETCODE CALCULATES METRICS (industry reference)
 * ============================================================================
 * 
 * SOLVED COUNT:
 *   SELECT COUNT(DISTINCT problem_id) WHERE verdict = 'Accepted'
 *   → We: Problem.countDocuments({ userId }) — already unique accepted
 * 
 * ACCEPTANCE RATE (per problem):
 *   accepted_runs / total_runs * 100 for each problem
 *   → We don't store failed attempts, so we can't compute per-problem rate
 *   → We report overall acceptance: all problems are accepted in our DB
 * 
 * STREAKS:
 *   Group submissions by calendar date → find longest consecutive day sequence
 *   → We: Sort solvedAt, walk backwards counting consecutive UTC days
 * 
 * TOPIC MASTERY:
 *   COUNT(DISTINCT problem_id) per topic WHERE verdict = 'Accepted'
 *   → We: $unwind topics → $group by topic → $sum
 * 
 * ============================================================================
 */

/**
 * Convert userId string to ObjectId for aggregation $match
 */
function toObjectId(userId) {
    return new mongoose.Types.ObjectId(userId);
}

/**
 * ============================================================================
 * 1. CORE DASHBOARD STATS
 * ============================================================================
 * Returns: uniqueAcceptedProblems, difficulty breakdown, top topics
 * All in a SINGLE aggregation pipeline using $facet for efficiency.
 * 
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object>} Dashboard stats
 */
async function getDashboardStats(userId) {
    const uid = toObjectId(userId);

    // Single $facet aggregation — one DB round-trip for all metrics
    const [result] = await Problem.aggregate([
        { $match: { userId: uid } },
        {
            $facet: {
                // ── Total unique accepted problems ──
                totalCount: [
                    { $count: 'count' }
                ],

                // ── Difficulty breakdown ──
                difficultyBreakdown: [
                    {
                        $group: {
                            _id: '$difficulty',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ],

                // ── Topic-wise solved count ──
                topicStats: [
                    { $unwind: '$topics' },
                    {
                        $group: {
                            _id: '$topics',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 20 }
                ],

                // ── Language breakdown ──
                languageStats: [
                    {
                        $match: {
                            language: { $ne: null, $ne: '' }
                        }
                    },
                    {
                        $group: {
                            _id: '$language',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ],

                // ── Recent activity (last 10 problems) ──
                recentProblems: [
                    { $sort: { solvedAt: -1 } },
                    { $limit: 10 },
                    {
                        $project: {
                            title: 1,
                            titleSlug: 1,
                            difficulty: 1,
                            solvedAt: 1,
                            language: 1,
                            topics: 1,
                            _id: 0
                        }
                    }
                ],
            }
        }
    ]);

    // ── Parse results ──
    const uniqueAcceptedProblems = result.totalCount[0]?.count || 0;

    // Difficulty breakdown → { easy, medium, hard, unknown }
    const difficulty = { easy: 0, medium: 0, hard: 0, unknown: 0 };
    for (const stat of result.difficultyBreakdown) {
        const key = stat._id ? stat._id.toLowerCase() : 'unknown';
        if (key in difficulty) {
            difficulty[key] = stat.count;
        } else {
            difficulty.unknown += stat.count;
        }
    }

    // Topic stats → [{ name, count }]
    const topTopics = result.topicStats.map(t => ({
        name: t._id,
        count: t.count
    }));

    // Language stats → [{ name, count }]
    const languages = result.languageStats.map(l => ({
        name: l._id,
        count: l.count
    }));

    return {
        uniqueAcceptedProblems,
        difficultyBreakdown: difficulty,
        topTopics,
        languages,
        recentProblems: result.recentProblems,
    };
}

/**
 * ============================================================================
 * 2. STREAK STATS
 * ============================================================================
 * Calculates current streak, longest streak, and last active date.
 * 
 * Algorithm:
 *   1. Get all distinct solved dates (UTC) sorted descending
 *   2. Walk backwards from today counting consecutive days = current streak
 *   3. Walk entire list tracking longest consecutive run = longest streak
 * 
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object>} { currentStreak, longestStreak, lastActiveDate, totalActiveDays }
 */
async function getStreakStats(userId) {
    const uid = toObjectId(userId);

    // Get all unique solved dates (day-level precision)
    const dateDocs = await Problem.aggregate([
        { $match: { userId: uid } },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$solvedAt' }
                }
            }
        },
        { $sort: { _id: -1 } }   // newest first
    ]);

    if (dateDocs.length === 0) {
        return {
            currentStreak: 0,
            longestStreak: 0,
            lastActiveDate: null,
            totalActiveDays: 0,
        };
    }

    // Convert to sorted Date objects (newest first)
    const dates = dateDocs.map(d => new Date(d._id));
    const lastActiveDate = dates[0];
    const totalActiveDays = dates.length;

    // ── Current streak ──
    // Check if the most recent date is today or yesterday (streak alive)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const mostRecent = new Date(dates[0]);
    mostRecent.setUTCHours(0, 0, 0, 0);

    let currentStreak = 0;

    if (mostRecent.getTime() >= yesterday.getTime()) {
        // Streak is alive — count consecutive days backwards
        currentStreak = 1;
        for (let i = 1; i < dates.length; i++) {
            const prevDay = new Date(dates[i - 1]);
            prevDay.setUTCHours(0, 0, 0, 0);
            const currDay = new Date(dates[i]);
            currDay.setUTCHours(0, 0, 0, 0);

            const diffDays = Math.round((prevDay.getTime() - currDay.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                currentStreak++;
            } else {
                break;
            }
        }
    }

    // ── Longest streak ──
    // Walk entire list tracking max consecutive run
    let longestStreak = 1;
    let runLength = 1;

    for (let i = 1; i < dates.length; i++) {
        const prevDay = new Date(dates[i - 1]);
        prevDay.setUTCHours(0, 0, 0, 0);
        const currDay = new Date(dates[i]);
        currDay.setUTCHours(0, 0, 0, 0);

        const diffDays = Math.round((prevDay.getTime() - currDay.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            runLength++;
        } else {
            longestStreak = Math.max(longestStreak, runLength);
            runLength = 1;
        }
    }
    longestStreak = Math.max(longestStreak, runLength);

    return {
        currentStreak,
        longestStreak,
        lastActiveDate: lastActiveDate.toISOString().split('T')[0],
        totalActiveDays,
    };
}

/**
 * ============================================================================
 * 3. ACTIVITY HEATMAP
 * ============================================================================
 * Returns daily solve counts for the last N days (default 365).
 * Used for GitHub-style contribution heatmaps.
 * 
 * @param {string} userId - MongoDB user ID
 * @param {number} days - Number of days to look back (default 365)
 * @returns {Promise<Array<{date: string, count: number}>>}
 */
async function getActivityHeatmap(userId, days = 365) {
    const uid = toObjectId(userId);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    const heatmap = await Problem.aggregate([
        {
            $match: {
                userId: uid,
                solvedAt: { $gte: since }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$solvedAt' }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } },
        {
            $project: {
                _id: 0,
                date: '$_id',
                count: 1
            }
        }
    ]);

    return heatmap;
}

/**
 * ============================================================================
 * 4. FULL DASHBOARD (all metrics combined)
 * ============================================================================
 * Runs all analytics in parallel for maximum performance.
 * 
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object>} Complete dashboard data
 */
async function getFullDashboard(userId) {
    const [stats, streak, heatmap] = await Promise.all([
        getDashboardStats(userId),
        getStreakStats(userId),
        getActivityHeatmap(userId),
    ]);

    return {
        overview: {
            uniqueAcceptedProblems: stats.uniqueAcceptedProblems,
            easy: stats.difficultyBreakdown.easy,
            medium: stats.difficultyBreakdown.medium,
            hard: stats.difficultyBreakdown.hard,
            unknown: stats.difficultyBreakdown.unknown,
        },
        difficultyBreakdown: stats.difficultyBreakdown,
        topTopics: stats.topTopics,
        languages: stats.languages,
        recentProblems: stats.recentProblems,
        streak,
        heatmap,
    };
}

export default {
    getDashboardStats,
    getStreakStats,
    getActivityHeatmap,
    getFullDashboard,
};
