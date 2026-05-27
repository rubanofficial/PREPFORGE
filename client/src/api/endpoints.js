// Frontend API endpoints
export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
        PROFILE: '/auth/profile',
        DEBUG_USERS: '/auth/debug/users',
    },
    LEETCODE: {
        STORE_SESSION: '/leetcode/store-session',
        START_DEEP_SYNC: '/leetcode/start-deep-sync',
        START_SYNC: '/leetcode/start-sync',
        SYNC_STATUS: (id) => `/leetcode/sync-status/${id}`,
        PROBLEMS: '/leetcode/problems',
        STATS: '/leetcode/stats',
    },
    PROBLEMS: {
        LIST: '/leetcode/problems',
    },
}
