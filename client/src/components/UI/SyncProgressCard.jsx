import React from 'react';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

const SyncProgressCard = ({ status, progressPercent, metadata }) => {
    const isRunning = status === 'active' || status === 'pending';
    const isCompleted = status === 'completed';
    const isFailed = status === 'failed';

    return (
        <div className="bg-surface border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider">Deep Sync Status</h3>
                {isRunning && <RefreshCw size={18} className="text-primary animate-spin" />}
                {isCompleted && <CheckCircle2 size={18} className="text-success" />}
                {isFailed && <XCircle size={18} className="text-danger" />}
            </div>

            <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-textMuted">
                    {isRunning ? 'Syncing...' : isCompleted ? 'Sync Complete' : isFailed ? 'Sync Failed' : 'Idle'}
                </span>
                <span className="font-mono text-textMain">{progressPercent}%</span>
            </div>

            <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border">
                <div 
                    className={`h-full transition-all duration-500 ease-out ${isFailed ? 'bg-danger' : isCompleted ? 'bg-success' : 'bg-primary'}`}
                    style={{ width: `${progressPercent}%` }}
                ></div>
            </div>

            {metadata && (
                <div className="mt-4 text-xs font-mono text-textMuted flex flex-col gap-1">
                    <div>Fetched: {metadata.fetchedFromProvider}</div>
                    <div>Inserted: {metadata.insertedToDatabase}</div>
                </div>
            )}
        </div>
    );
};

export default SyncProgressCard;
