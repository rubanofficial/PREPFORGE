import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import syncReducer from '../features/sync/syncSlice';
import problemReducer from '../features/problem/problemSlice';
import analyticsReducer from '../features/analytics/analyticsSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        sync: syncReducer,
        problem: problemReducer,
        analytics: analyticsReducer,
    },
});
