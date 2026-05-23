import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    stats: {
        totalSolved: 0,
        difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
        topTopics: []
    },
    loading: false,
    error: null,
};

const analyticsSlice = createSlice({
    name: 'analytics',
    initialState,
    reducers: {
        fetchStatsStart: (state) => {
            state.loading = true;
            state.error = null;
        },
        fetchStatsSuccess: (state, action) => {
            state.loading = false;
            state.stats = action.payload;
        },
        fetchStatsFailure: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
    },
});

export const { fetchStatsStart, fetchStatsSuccess, fetchStatsFailure } = analyticsSlice.actions;
export default analyticsSlice.reducer;
