import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    currentJobId: null,
    status: 'idle', // idle, pending, active, completed, failed
    syncMode: null, // 'full' | 'incremental' — determined before sync starts
    lastSyncAt: null, // ISO string of last successful sync watermark
    localCount: 0, // problems stored locally (from sync-info)
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
        // Populate pre-sync info from GET /sync-info
        setSyncInfo: (state, action) => {
            const { lastSyncAt, localCount, syncMode } = action.payload;
            state.lastSyncAt = lastSyncAt || null;
            state.localCount = localCount ?? 0;
            state.syncMode = syncMode || null;
        },
        startSync: (state, action) => {
            state.status = 'pending';
            state.currentJobId = action.payload.jobId ?? action.payload;
            // Preserve syncMode from payload if provided (set by UI after getSyncInfo)
            if (action.payload.syncMode) state.syncMode = action.payload.syncMode;
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
            const { status, progress, progressPercent, error, syncMode } = action.payload;

            if (status) state.status = status;
            if (progress) state.progress = progress;
            if (error) state.error = error;
            if (syncMode) state.syncMode = syncMode;

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

export const { setSyncInfo, startSync, updateSyncStatus, clearSyncState } = syncSlice.actions;
export default syncSlice.reducer;
