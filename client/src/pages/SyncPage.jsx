import React, { useState } from 'react';
import SyncProgressCard from '../components/UI/SyncProgressCard';
import { Database, AlertTriangle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { startSync, updateSyncStatus } from '../features/sync/syncSlice';

const SyncPage = () => {
    const dispatch = useDispatch();
    const { status, progressPercent, progress } = useSelector((state) => state.sync);

    const handleStartSync = () => {
        // Trigger action
        dispatch(startSync('mock-job-id'));
        // Mock progress updates for UI test
        setTimeout(() => dispatch(updateSyncStatus({ status: 'active', progressPercent: 20 })), 1000);
        setTimeout(() => dispatch(updateSyncStatus({ status: 'active', progressPercent: 60 })), 2500);
        setTimeout(() => dispatch(updateSyncStatus({ 
            status: 'completed', 
            progressPercent: 100,
            progress: { fetchedFromProvider: 50, insertedToDatabase: 45, duplicatesSkipped: 5, failedToProcess: 0 }
        })), 4000);
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
