import React from 'react';
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const SyncProgressCard = ({ status, progressPercent, metadata }) => {
    const isPending   = status === 'pending';
    const isActive    = status === 'active';
    const isRunning   = isPending || isActive;
    const isCompleted = status === 'completed';
    const isFailed    = status === 'failed';

    // Which colour the bar should be
    const barColour = isFailed ? 'bg-danger' : isCompleted ? 'bg-success' : 'bg-primary';

    // When pending and percent is 0 show a pulsing indeterminate bar
    const showIndeterminate = isPending && progressPercent === 0;

    return (
        <div className="bg-surface border border-border rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider">
                    Deep Sync Status
                </h3>
                {isActive  && <RefreshCw size={18} className="text-primary animate-spin" />}
                {isPending && <Loader2   size={18} className="text-primary animate-spin" />}
                {isCompleted && <CheckCircle2 size={18} className="text-success" />}
                {isFailed    && <XCircle      size={18} className="text-danger"  />}
            </div>

            {/* Status label + percentage */}
            <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-textMuted">
                    {isPending   ? 'Starting sync…'
                    : isActive   ? 'Syncing…'
                    : isCompleted ? 'Sync Complete'
                    : isFailed   ? 'Sync Failed'
                    : 'Idle'}
                </span>
                <span className="font-mono text-textMain">{progressPercent}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border">
                {showIndeterminate ? (
                    /* Animated indeterminate stripe while waiting for first event */
                    <div className="h-full w-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/30 animate-pulse" />
                        <div
                            className="absolute top-0 h-full w-1/3 bg-primary rounded-full"
                            style={{ animation: 'slide-indeterminate 1.4s ease-in-out infinite' }}
                        />
                    </div>
                ) : (
                    <div
                        className={`h-full transition-all duration-500 ease-out rounded-full ${barColour}`}
                        style={{ width: `${Math.max(progressPercent, isRunning ? 2 : 0)}%` }}
                    />
                )}
            </div>

            {/* Stats */}
            {metadata && (
                <div className="mt-4 text-xs font-mono text-textMuted flex flex-col gap-1">
                    <div>
                        Fetched: {metadata.fetchedFromProvider}
                        {metadata.expectedProblems > 0 ? ` / ${metadata.expectedProblems}` : ''}
                    </div>
                    <div>Inserted: {metadata.insertedToDatabase}</div>
                    {metadata.duplicatesSkipped > 0 && (
                        <div>Duplicates skipped: {metadata.duplicatesSkipped}</div>
                    )}
                    {metadata.failedToProcess > 0 && (
                        <div className="text-danger">Failed: {metadata.failedToProcess}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SyncProgressCard;
