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
