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
            console.log('Attempting to register with:', { ...credentials, password: '***' })
            const response = await apiClient.post(AUTH_ENDPOINTS.REGISTER, credentials)
            console.log('Registration response:', response.data)
            return response.data
        } catch (error) {
            console.error('Registration error:', error)
            console.error('Error response:', error.response?.data)
            console.error('Error message:', error.message)
            const errorMsg = error.response?.data?.message || error.message || 'Registration failed'
            throw { message: errorMsg, ...error.response?.data }
        }
    },

    // Login user
    async login(credentials) {
        try {
            console.log('Attempting to login with:', { ...credentials, password: '***' })
            const response = await apiClient.post(AUTH_ENDPOINTS.LOGIN, credentials)
            console.log('Login response:', response.data)
            return response.data
        } catch (error) {
            console.error('Login error:', error)
            console.error('Error response:', error.response?.data)
            const errorMsg = error.response?.data?.message || error.message || 'Login failed'
            throw { message: errorMsg, ...error.response?.data }
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
            console.error('Get profile error:', error)
            const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch profile'
            throw { message: errorMsg, ...error.response?.data }
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
