import apiClient from './apiClient'

const PROBLEM_ENDPOINTS = {
    LIST: '/leetcode/problems',
}

const problemService = {
    async getProblems(params = {}) {
        const response = await apiClient.get(PROBLEM_ENDPOINTS.LIST, { params })
        return response.data
    },
}

export default problemService