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
            // Reset progress so bar always starts from 0 on a new sync
            state.progressPercent = 0;
            state.progress = {
                expectedProblems: 0,
                fetchedFromProvider: 0,
                insertedToDatabase: 0,
                duplicatesSkipped: 0,
                failedToProcess: 0,
            };
        },
        updateSyncStatus: (state, action) => {
            const { status, progress, progressPercent, error } = action.payload;

            if (status) state.status = status;
            if (progress) state.progress = progress;
            if (error) state.error = error;

            // Monotonic progressPercent rule:
            //   - completed → always 100 (even if payload says something else)
            //   - failed    → always 0
            //   - otherwise → only increase, never decrease
            if (status === 'completed') {
                state.progressPercent = 100;
            } else if (status === 'failed') {
                state.progressPercent = 0;
            } else if (progressPercent !== undefined && progressPercent > state.progressPercent) {
                state.progressPercent = progressPercent;
            }
        },
        clearSyncState: (state) => {
            return initialState;
        },
    },
});

export const { startSync, updateSyncStatus, clearSyncState } = syncSlice.actions;
export default syncSlice.reducer;
