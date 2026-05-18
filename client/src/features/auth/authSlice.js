import { createSlice } from '@reduxjs/toolkit'

// Initial state - check if user is already logged in
const initialState = {
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null,
    token: localStorage.getItem('token') || null,
    loading: false,
    error: null,
    isAuthenticated: !!localStorage.getItem('token'),
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        // Start login/register process
        authStart(state) {
            state.loading = true
            state.error = null
        },

        // Successful login/register
        authSuccess(state, action) {
            const { user, token } = action.payload
            state.loading = false
            state.isAuthenticated = true
            state.user = user
            state.token = token
            state.error = null

            // Store token and user in localStorage
            localStorage.setItem('token', token)
            localStorage.setItem('user', JSON.stringify(user))
        },

        // Failed login/register
        authError(state, action) {
            state.loading = false
            state.error = action.payload
            state.isAuthenticated = false
        },

        // Logout
        logout(state) {
            state.loading = false
            state.user = null
            state.token = null
            state.isAuthenticated = false
            state.error = null

            // Clear localStorage
            localStorage.removeItem('token')
            localStorage.removeItem('user')
        },

        // Clear error
        clearError(state) {
            state.error = null
        },
    },
})

export const { authStart, authSuccess, authError, logout, clearError } = authSlice.actions
export default authSlice.reducer
