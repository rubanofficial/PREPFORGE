import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    items: [],
    totalCount: 0,
    loading: false,
    error: null,
    filters: {
        difficulty: '',
        topic: '',
        page: 1,
        limit: 20,
    }
};

const problemSlice = createSlice({
    name: 'problem',
    initialState,
    reducers: {
        fetchProblemsStart: (state) => {
            state.loading = true;
            state.error = null;
        },
        fetchProblemsSuccess: (state, action) => {
            state.loading = false;
            state.items = action.payload.data;
            state.totalCount = action.payload.pagination.totalCount;
        },
        fetchProblemsFailure: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
        setFilters: (state, action) => {
            state.filters = { ...state.filters, ...action.payload };
        }
    },
});

export const { fetchProblemsStart, fetchProblemsSuccess, fetchProblemsFailure, setFilters } = problemSlice.actions;
export default problemSlice.reducer;
