import React, { useState, useRef, useEffect } from 'react';
import SyncProgressCard from '../components/UI/SyncProgressCard';
import { Database, AlertTriangle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { startSync, updateSyncStatus, clearSyncState } from '../features/sync/syncSlice';
import leetcodeService from '../services/leetcodeService';

const POLL_INTERVAL = 2000; // ms

const SyncPage = () => {
    const dispatch = useDispatch();
    const { status, progressPercent, progress, currentJobId } = useSelector((state) => state.sync);
    const pollingRef = useRef(null);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        return () => {
            // cleanup on unmount
            if (pollingRef.current) clearInterval(pollingRef.current);
            dispatch(clearSyncState());
        };
    }, [dispatch]);

    const pollStatus = async (jobId) => {
        try {
            const res = await leetcodeService.getSyncStatus(jobId);
            if (res && res.data) {
                const { status: s, progress: p, progressPercent: pp, error } = res.data;
                dispatch(updateSyncStatus({ status: s, progress: p, progressPercent: pp, error }));

                if (s === 'completed' || s === 'failed') {
                    if (pollingRef.current) {
                        clearInterval(pollingRef.current);
                        pollingRef.current = null;
                    }
                    setStarting(false);
                }
            }
        } catch (err) {
            console.error('Failed to poll sync status', err.message || err);
            dispatch(updateSyncStatus({ status: 'failed', error: err.message || 'Polling failed' }));
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            setStarting(false);
        }
    };

    const handleStartSync = async () => {
        setStarting(true);
        try {
            // Start authenticated deep sync (backend will verify stored session)
            const res = await leetcodeService.startDeepSync();
            if (res && res.data && res.data.syncJobId) {
                const jobId = res.data.syncJobId;
                dispatch(startSync(jobId));

                // Immediately poll once then set interval
                await pollStatus(jobId);
                pollingRef.current = setInterval(() => pollStatus(jobId), POLL_INTERVAL);
            } else {
                // Unexpected response
                dispatch(updateSyncStatus({ status: 'failed', error: res?.message || 'Failed to start sync' }));
                setStarting(false);
            }
        } catch (err) {
            console.error('Failed to start deep sync', err.message || err);
            dispatch(updateSyncStatus({ status: 'failed', error: err?.response?.data?.message || err.message || 'Start sync failed' }));
            setStarting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-textMain">Sync Architecture</h1>
                <p className="text-sm text-textMuted mt-1">Manage data ingestion from your connected platforms.</p>
            </header>

            <div className="bg-surface border border-border rounded-lg p-6">
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h2 className="text-lg font-semibold text-textMain flex items-center gap-2">
                            <Database size={20} className="text-primary" />
                            Deep Sync Engine
                        </h2>
                        <p className="text-sm text-textMuted mt-2 max-w-lg">
                            Initiate a deep sync to fetch your entire submission history.
                            This process runs in the background and normalizes data into our optimized analytics structure.
                        </p>
                    </div>
                    <button
                        onClick={handleStartSync}
                        disabled={status === 'active' || status === 'pending'}
                        className="bg-primary hover:bg-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
                    >
                        {status === 'active' ? 'Syncing...' : 'Start Deep Sync'}
                    </button>
                </div>

                <div className="bg-background border border-border rounded p-4 mb-8 flex gap-3 text-sm text-textMuted">
                    <AlertTriangle size={18} className="text-warning shrink-0" />
                    <p>Deep sync requires a valid LeetCode session cookie to fetch private submission histories. Ensure your session is active in the Settings tab before proceeding.</p>
                </div>

                <SyncProgressCard
                    status={status}
                    progressPercent={progressPercent}
                    metadata={progress}
                />
            </div>
        </div>
    );
};

export default SyncPage;
