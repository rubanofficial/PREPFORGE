import { createSlice } from '@reduxjs/toolkit';

const readStoredJson = (key) => {
    const value = localStorage.getItem(key);
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        localStorage.removeItem(key);
        return null;
    }
};

const initialState = {
    user: readStoredJson('user'),
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token'),
    loading: false,
    error: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        loginStart: (state) => {
            state.loading = true;
            state.error = null;
        },
        loginSuccess: (state, action) => {
            state.loading = false;
            state.isAuthenticated = true;
            state.user = action.payload.user;
            state.token = action.payload.token;
            localStorage.setItem('token', action.payload.token);
            localStorage.setItem('user', JSON.stringify(action.payload.user));
        },
        setUser: (state, action) => {
            state.user = action.payload;
            state.isAuthenticated = !!state.token;
            if (action.payload) {
                localStorage.setItem('user', JSON.stringify(action.payload));
            }
        },
        loginFailure: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        },
    },
});

export const { loginStart, loginSuccess, setUser, loginFailure, logout } = authSlice.actions;

export default authSlice.reducer;
