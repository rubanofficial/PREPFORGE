/**
 * Normalization Layer - Transforms external API structure to internal format
 * Isolates database schema from LeetCode's changing data structure
 */

/**
 * Normalize LeetCode stats to internal format
 * @param {Object} leetcodeStats - Raw stats from LeetCode API
 * @param {string} userId - MongoDB user ID
 * @returns {Object} Normalized user stats
 */
export function normalizeLeetcodeStats(leetcodeStats, userId) {
  if (!leetcodeStats) {
    throw new Error('Invalid LeetCode stats data');
  }

  // Extract stats safely
  const username = leetcodeStats.username || 'unknown';
  const profile = leetcodeStats.profile || {};
  const submitStats = leetcodeStats.submitStats || {};

  // Calculate total solved count
  const acSubmissionNum = submitStats.acSubmissionNum || [];
  const totalSolved = acSubmissionNum.find(a => a.difficulty === 'All')?.count || acSubmissionNum.reduce((sum, item) => item.difficulty !== 'All' ? sum + (item.count || 0) : sum, 0);

  console.log('📊 Normalization Debug:', {
    acSubmissionNum,
    totalSolvedCalculated: totalSolved,
    breakdown: { easy: acSubmissionNum.find(a => a.difficulty === 'Easy')?.count || 0, medium: acSubmissionNum.find(a => a.difficulty === 'Medium')?.count || 0, hard: acSubmissionNum.find(a => a.difficulty === 'Hard')?.count || 0 }
  });

  // Extract difficulty breakdown
  const difficultyBreakdown = {};
  if (Array.isArray(acSubmissionNum)) {
    acSubmissionNum.forEach(item => {
      if (item.difficulty && item.count) {
        difficultyBreakdown[item.difficulty.toLowerCase()] = item.count;
      }
    });
  }

  return {
    username,
    stats: {
      totalSolved,
      ranking: profile.ranking || 0,
      reputation: profile.reputation || 0,
      difficultyBreakdown: {
        easy: difficultyBreakdown.easy || 0,
        medium: difficultyBreakdown.medium || 0,
        hard: difficultyBreakdown.hard || 0
      }
    },
    userId,
    lastSyncAt: new Date()
  };
}
