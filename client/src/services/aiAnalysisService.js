import apiClient from './apiClient';

/**
 * Get AI-powered performance analysis from Gemini
 * Analyzes user's LeetCode problem-solving patterns
 *
 * Uses the shared apiClient (which reads VITE_API_URL or falls back to '/api')
 * so this always hits the correct backend in both dev and production.
 *
 * Returns:
 * {
 *   success: boolean,
 *   data: {
 *     overallReadinessScore: number (0-100),
 *     topicStrengthRatings: { [topic: string]: number (0-10) },
 *     strongestAreas: Array<{ topic: string, rating: number, evidence: string }>,
 *     weakestAreas: Array<{ topic: string, rating: number, evidence: string }>,
 *     missingInterviewPatterns: Array<{ pattern: string, importance: string, description: string }>,
 *     next10Problems: Array<{ title: string, difficulty: string, topic: string, reason: string }>,
 *     placementAssessment: {
 *       currentLevel: string,
 *       serviceCompanyReadiness: string,
 *       productCompanyReadiness: string,
 *       fourWeekRoadmap: {
 *         week1: { focus: string, problems: string[], goal: string },
 *         week2: { focus: string, problems: string[], goal: string },
 *         week3: { focus: string, problems: string[], goal: string },
 *         week4: { focus: string, problems: string[], goal: string }
 *       }
 *     },
 *     metrics: {
 *       totalSolved, easySolved, mediumSolved, hardSolved,
 *       consistencyScore, topicsCovered, weightedScore
 *     },
 *     timestamp: string
 *   }
 * }
 */
export async function getPerformanceAnalysis() {
    try {
        // apiClient already sets baseURL from VITE_API_URL (or '/api' fallback)
        // and attaches Authorization: Bearer <token> via its request interceptor.
        const response = await apiClient.get('/leetcode/ai-analysis');
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
        // apiClient already sets baseURL from VITE_API_URL (or '/api' fallback)
        // and attaches Authorization: Bearer <token> via its request interceptor.
        const response = await apiClient.get('/leetcode/dashboard');
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to get dashboard stats');
    }
}
