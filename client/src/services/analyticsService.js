import apiClient from './apiClient'

const ANALYTICS_ENDPOINTS = {
    STATS: '/leetcode/stats',
}

const analyticsService = {
    async getStats() {
        const response = await apiClient.get(ANALYTICS_ENDPOINTS.STATS)
        return response.data
    },
}

export default analyticsService