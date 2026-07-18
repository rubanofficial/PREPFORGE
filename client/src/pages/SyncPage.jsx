import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SyncProgressCard from '../components/UI/SyncProgressCard';
import {
    Database, Zap, RefreshCw, ShieldCheck, GitMerge,
    CheckCircle2, Clock, ArrowRight, Info, Layers,
    Key, AlertTriangle, Settings
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { startSync, updateSyncStatus, setSyncInfo } from '../features/sync/syncSlice';
import leetcodeService from '../services/leetcodeService';

// ─── Concept Badge ──────────────────────────────────────────────────────────
const ConceptBadge = ({ icon: Icon, label, description, color }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-default transition-all duration-200 select-none ${color}`}>
                <Icon size={12} />
                {label}
            </div>
            {hovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-background border border-border rounded-lg p-3 text-xs text-textMuted shadow-xl z-50 pointer-events-none">
                    <p className="font-semibold text-textMain mb-1">{label}</p>
                    <p>{description}</p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
                </div>
            )}
        </div>
    );
};

// ─── Sync Mode Badge ─────────────────────────────────────────────────────────
const SyncModeBadge = ({ mode }) => {
    if (!mode) return null;
    const isIncremental = mode === 'incremental';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
            isIncremental
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-warning/10 text-warning border border-warning/30'
        }`}>
            {isIncremental ? <Zap size={11} /> : <Database size={11} />}
            {isIncremental ? 'Incremental Sync' : 'Full Sync'}
        </span>
    );
};

// ─── Relative time helper ─────────────────────────────────────────────────────
const relativeTime = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const SyncPage = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { status, progressPercent, progress, syncMode, lastSyncAt, localCount } =
        useSelector((state) => state.sync);

    const [syncInfo, setSyncInfoLocal] = useState(null);
    const [infoLoading, setInfoLoading] = useState(true);

    // Load sync-info on mount to show delta preview
    useEffect(() => {
        const loadSyncInfo = async () => {
            setInfoLoading(true);
            try {
                const res = await leetcodeService.getSyncInfo();
                if (res?.data) {
                    setSyncInfoLocal(res.data);
                    dispatch(setSyncInfo(res.data));
                }
            } catch (err) {
                console.warn('Could not load sync-info:', err.message);
            } finally {
                setInfoLoading(false);
            }
        };
        loadSyncInfo();
    }, [dispatch]);

    // Refresh sync-info after a sync completes
    useEffect(() => {
        if (status === 'completed') {
            leetcodeService.getSyncInfo().then((res) => {
                if (res?.data) {
                    setSyncInfoLocal(res.data);
                    dispatch(setSyncInfo(res.data));
                }
            }).catch(() => {});
        }
    }, [status, dispatch]);

    const handleStartSync = async () => {
        try {
            // Calls /start-sync — backend auto-detects full vs incremental using lastLeetcodeSyncAt
            const res = await leetcodeService.startSync();
            if (res?.data?.syncJobId) {
                dispatch(startSync({
                    jobId: res.data.syncJobId,
                    syncMode: res.data.syncMode || syncInfo?.syncMode || 'full'
                }));
            } else {
                dispatch(updateSyncStatus({
                    status: 'failed',
                    error: res?.message || 'Failed to start sync'
                }));
            }
        } catch (err) {
            console.error('Failed to start sync:', err.message || err);
            dispatch(updateSyncStatus({
                status: 'failed',
                error: err?.response?.data?.message || err.message || 'Start sync failed'
            }));
        }
    };

    const isBusy = status === 'active' || status === 'pending';
    const effectiveSyncMode = syncInfo?.syncMode || syncMode;
    const effectiveLocalCount = syncInfo?.localCount ?? localCount;
    const effectiveLastSyncAt = syncInfo?.lastSyncAt || lastSyncAt;
    const isIncremental = effectiveSyncMode === 'incremental';

    const hasSession = !!syncInfo?.leetcodeUsername;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-textMain">Sync Engine</h1>
                <p className="text-sm text-textMuted mt-1">
                    Authenticated data ingestion from LeetCode using your session — fetches your full submission history with true pagination.
                </p>
            </header>

            {/* ── Session Required Banner ──────────────────────────────────── */}
            {!infoLoading && !hasSession && (
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-5">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-warning/20 rounded-lg shrink-0">
                            <AlertTriangle size={20} className="text-warning" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-warning mb-1">LeetCode Session Required</h3>
                            <p className="text-sm text-textMuted mb-3">
                                The sync engine now requires an authenticated LeetCode session to fetch your full submission history with pagination. 
                                Please save your LEETCODE_SESSION cookie in Settings first.
                            </p>
                            <button
                                onClick={() => navigate('/settings')}
                                className="inline-flex items-center gap-2 bg-warning/20 hover:bg-warning/30 text-warning text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200"
                            >
                                <Settings size={15} />
                                Go to Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Session active indicator ──────────────────────────────────── */}
            {!infoLoading && hasSession && (
                <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-success/20 rounded-lg">
                        <Key size={16} className="text-success" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-success">Authenticated as <span className="font-mono">{syncInfo.leetcodeUsername}</span></p>
                        <p className="text-xs text-textMuted">Session is stored. You can sync your full LeetCode history.</p>
                    </div>
                </div>
            )}

            {/* ── Concept badges row ───────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
                <ConceptBadge
                    icon={GitMerge}
                    label="Paginated Sync"
                    color="text-primary border-primary/30 bg-primary/5"
                    description="Fetches submissions in batches of 20 using LeetCode's REST API with offset/limit pagination."
                />
                <ConceptBadge
                    icon={RefreshCw}
                    label="Session Auth"
                    color="text-primary border-primary/30 bg-primary/5"
                    description="Uses your encrypted LEETCODE_SESSION cookie for authenticated API access. No public API dependency."
                />
                <ConceptBadge
                    icon={ShieldCheck}
                    label="Idempotency"
                    color="text-primary border-primary/30 bg-primary/5"
                    description="Running sync twice is safe — duplicate problems are detected and skipped via DB index."
                />
                <ConceptBadge
                    icon={Layers}
                    label="Data Consistency"
                    color="text-primary border-primary/30 bg-primary/5"
                    description="Watermark is only updated on full success, so a failed sync retries from the same point."
                />
                <ConceptBadge
                    icon={Zap}
                    label="Metadata Enrichment"
                    color="text-primary border-primary/30 bg-primary/5"
                    description="After fetching submissions, we enrich them with difficulty and topic tags via GraphQL metadata queries."
                />
            </div>

            {/* ── Main sync panel ──────────────────────────────────────────── */}
            <div className="bg-surface border border-border rounded-xl p-6 space-y-6">

                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-textMain flex items-center gap-2">
                                <Database size={20} className="text-primary" />
                                {isIncremental ? 'Incremental Sync Ready' : 'Authenticated Sync'}
                            </h2>
                            {!infoLoading && <SyncModeBadge mode={effectiveSyncMode} />}
                        </div>
                        <p className="text-sm text-textMuted max-w-lg">
                            {isIncremental
                                ? 'Your data is up to date. Only new problems solved since last sync will be fetched via pagination.'
                                : 'First-time sync — your entire submission history will be fetched via paginated LeetCode API.'}
                        </p>
                    </div>

                    <button
                        id="sync-start-btn"
                        onClick={handleStartSync}
                        disabled={isBusy}
                        className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-primary/30 active:scale-95"
                    >
                        {isBusy ? (
                            <>
                                <RefreshCw size={15} className="animate-spin" />
                                {status === 'pending' ? 'Starting…' : 'Syncing…'}
                            </>
                        ) : (
                            <>
                                <Zap size={15} />
                                {isIncremental ? 'Sync New Problems' : 'Start Full Sync'}
                            </>
                        )}
                    </button>
                </div>

                {/* ── Delta preview cards ──────────────────────────────────── */}
                {!infoLoading && effectiveSyncMode && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                        {/* Local count */}
                        <div className="bg-background border border-border rounded-lg p-4 flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Database size={16} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-textMuted">Local DB</p>
                                <p className="text-xl font-bold text-textMain">{effectiveLocalCount}</p>
                                <p className="text-xs text-textMuted">problems stored</p>
                            </div>
                        </div>

                        {/* Arrow / delta indicator */}
                        <div className="flex items-center justify-center">
                            <div className="flex flex-col items-center gap-1 text-center">
                                <ArrowRight size={24} className="text-primary hidden sm:block" />
                                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                    isIncremental
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-warning/10 text-warning'
                                }`}>
                                    {isIncremental ? 'Will fetch delta only' : 'Will fetch everything'}
                                </span>
                            </div>
                        </div>

                        {/* Last sync watermark */}
                        <div className="bg-background border border-border rounded-lg p-4 flex items-center gap-3">
                            <div className="p-2 bg-success/10 rounded-lg">
                                <Clock size={16} className="text-success" />
                            </div>
                            <div>
                                <p className="text-xs text-textMuted">Last Synced</p>
                                {effectiveLastSyncAt ? (
                                    <>
                                        <p className="text-sm font-bold text-textMain">{relativeTime(effectiveLastSyncAt)}</p>
                                        <p className="text-xs text-textMuted">
                                            {new Date(effectiveLastSyncAt).toLocaleDateString()}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-bold text-warning">Never</p>
                                        <p className="text-xs text-textMuted">First sync required</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* How it works — only shown before sync or after idle */}
                {!isBusy && status !== 'active' && (
                    <div className="bg-background/50 border border-border/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Info size={14} className="text-textMuted" />
                            <p className="text-xs font-semibold text-textMuted uppercase tracking-wider">
                                How Paginated Sync Works
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs text-textMuted">
                            {[
                                { step: '1', text: 'Initialize authenticated session' },
                                { step: '2', text: 'Fetch profile to get total count' },
                                { step: '3', text: 'Paginated fetch (offset/limit)' },
                                { step: '4', text: 'Enrich metadata (difficulty, topics)' },
                                { step: '5', text: 'Insert deduplicated problems' },
                            ].map(({ step, text }, i, arr) => (
                                <React.Fragment key={step}>
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 bg-primary/20 text-primary rounded-full text-xs flex items-center justify-center font-bold shrink-0">
                                            {step}
                                        </span>
                                        <span>{text}</span>
                                    </div>
                                    {i < arr.length - 1 && (
                                        <ArrowRight size={12} className="text-border shrink-0 hidden sm:block" />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}

                {/* Progress card */}
                <SyncProgressCard
                    status={status}
                    progressPercent={progressPercent}
                    metadata={progress}
                />

                {/* Post-sync success summary */}
                {status === 'completed' && (
                    <div className="flex items-center gap-3 bg-success/10 border border-success/30 rounded-lg p-4">
                        <CheckCircle2 size={20} className="text-success shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-success">Sync Complete</p>
                            <p className="text-xs text-textMuted mt-0.5">
                                {progress.insertedToDatabase} new problem{progress.insertedToDatabase !== 1 ? 's' : ''} added
                                {' · '}{progress.duplicatesSkipped} already in DB (skipped)
                                {' · '}{effectiveLocalCount} total problems stored
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SyncPage;

