import apiClient from './apiClient'

// Auth API endpoints
const AUTH_ENDPOINTS = {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    GET_PROFILE: '/auth/profile',
}

const authService = {
    // Register user
    async register(credentials) {
        try {
            const response = await apiClient.post(AUTH_ENDPOINTS.REGISTER, credentials)
            return response.data
        } catch (error) {
            throw error.response?.data || { message: 'Registration failed' }
        }
    },

    // Login user
    async login(credentials) {
        try {
            const response = await apiClient.post(AUTH_ENDPOINTS.LOGIN, credentials)
            return response.data
        } catch (error) {
            throw error.response?.data || { message: 'Login failed' }
        }
    },

    // Logout user
    async logout() {
        try {
            await apiClient.post(AUTH_ENDPOINTS.LOGOUT)
        } catch (error) {
            console.error('Logout error:', error)
        }
    },

    // Get current user profile
    async getProfile() {
        try {
            const response = await apiClient.get(AUTH_ENDPOINTS.GET_PROFILE)
            return response.data
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch profile' }
        }
    },

    // Check if user is authenticated
    isAuthenticated() {
        return !!localStorage.getItem('token')
    },

    // Get stored token
    getToken() {
        return localStorage.getItem('token')
    },

    // Get stored user
    getUser() {
        const user = localStorage.getItem('user')
        return user ? JSON.parse(user) : null
    },
}

export default authService
