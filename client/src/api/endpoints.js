// Frontend API endpoints
export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
        ME: '/auth/me',
    },
    PROBLEMS: {
        LIST: '/problems',
        CREATE: '/problems',
        UPDATE: (id) => `/problems/${id}`,
        DELETE: (id) => `/problems/${id}`,
    },
    DASHBOARD: {
        STATS: '/dashboard/stats',
    },
}
