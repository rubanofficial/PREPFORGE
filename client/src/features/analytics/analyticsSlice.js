import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import analyticsService from '../../services/analyticsService';

const initialState = {
    stats: {
        totalSolved: 0,
        difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
        topTopics: [],
    },
    loading: false,
    error: null,
};

export const fetchStats = createAsyncThunk('analytics/fetchStats', async (_, { rejectWithValue }) => {
    try {
        const data = await analyticsService.getStats();
        return data;
    } catch (err) {
        return rejectWithValue(err.response?.data || err.message || 'Failed to fetch analytics');
    }
});

const analyticsSlice = createSlice({
    name: 'analytics',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchStats.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchStats.fulfilled, (state, action) => {
                state.loading = false;
                state.stats = action.payload;
            })
            .addCase(fetchStats.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to load analytics';
            });
    },
});

export default analyticsSlice.reducer;
