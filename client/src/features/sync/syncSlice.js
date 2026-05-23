import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    currentJobId: null,
    status: 'idle', // idle, pending, active, completed, failed
    progress: {
        expectedProblems: 0,
        fetchedFromProvider: 0,
        insertedToDatabase: 0,
        duplicatesSkipped: 0,
        failedToProcess: 0,
    },
    progressPercent: 0,
    error: null,
};

const syncSlice = createSlice({
    name: 'sync',
    initialState,
    reducers: {
        startSync: (state, action) => {
            state.status = 'pending';
            state.currentJobId = action.payload;
            state.error = null;
        },
        updateSyncStatus: (state, action) => {
            const { status, progress, progressPercent, error } = action.payload;
            state.status = status;
            if (progress) state.progress = progress;
            if (progressPercent !== undefined) state.progressPercent = progressPercent;
            if (error) state.error = error;
        },
        clearSyncState: (state) => {
            return initialState;
        },
    },
});

export const { startSync, updateSyncStatus, clearSyncState } = syncSlice.actions;
export default syncSlice.reducer;
