import apiClient from './apiClient'

const ANALYTICS_ENDPOINTS = {
    STATS: '/leetcode/stats',
}

const analyticsService = {
    async getStats() {
        const response = await apiClient.get(ANALYTICS_ENDPOINTS.STATS)
        // Controller returns { success: true, data: { ... } }
        return response.data && response.data.data ? response.data.data : response.data
    },
}

export default analyticsService