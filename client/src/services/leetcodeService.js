import apiClient from './apiClient'

const LEECODE_ENDPOINTS = {
    STORE_SESSION: '/leetcode/store-session',
    START_DEEP_SYNC: '/leetcode/start-deep-sync',
    START_SYNC: '/leetcode/start-sync',
    SYNC_STATUS: (id) => `/leetcode/sync-status/${id}`,
    SYNC_INFO: '/leetcode/sync-info',
}

const leetcodeService = {
    async storeSession(body) {
        const res = await apiClient.post(LEECODE_ENDPOINTS.STORE_SESSION, body)
        return res.data
    },
    async startDeepSync(body) {
        const res = await apiClient.post(LEECODE_ENDPOINTS.START_DEEP_SYNC, body)
        return res.data
    },
    async startSync(body) {
        const res = await apiClient.post(LEECODE_ENDPOINTS.START_SYNC, body)
        return res.data
    },
    async getSyncStatus(id) {
        const res = await apiClient.get(LEECODE_ENDPOINTS.SYNC_STATUS(id))
        return res.data
    },
    async getSyncInfo() {
        const res = await apiClient.get(LEECODE_ENDPOINTS.SYNC_INFO)
        return res.data
    }
}

export default leetcodeService