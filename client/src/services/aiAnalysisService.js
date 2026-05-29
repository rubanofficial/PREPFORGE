import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Get AI-powered performance analysis from Gemini
 * Analyzes user's LeetCode problem-solving patterns
 * 
 * Returns:
 * {
 *   success: boolean,
 *   data: {
 *     readinessScore: number,
 *     strengths: string[],
 *     weaknesses: string[],
 *     weeklyFocus: string[],
 *     aiInsight: string,
 *     recommendedProblems: Array<{ title: string, reason: string }>,
 *     metrics: {
 *       totalSolved,
 *       easySolved,
 *       mediumSolved,
 *       hardSolved,
 *       consistencyScore,
 *       topicsCovered
 *     },
 *     timestamp: string
 *   }
 * }
 */
export async function getPerformanceAnalysis() {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/leetcode/ai-analysis`,
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }
        );

        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('User has no problems solved yet. Sync problems first to get AI analysis.');
        }
        throw new Error(error.response?.data?.message || 'Failed to get AI analysis');
    }
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats() {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/leetcode/dashboard`,
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }
        );

        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to get dashboard stats');
    }
}
