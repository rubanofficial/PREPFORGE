import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import StatCard from '../components/UI/StatCard';
import SyncProgressCard from '../components/UI/SyncProgressCard';
import { Target, CheckCircle, Code, Flame, TrendingUp, AlertCircle } from 'lucide-react';
import analyticsService from '../services/analyticsService';
import problemService from '../services/problemService';

const defaultStats = {
    totalSolved: 0,
    easy: 0,
    medium: 0,
    hard: 0,
};

const defaultActivity = Array.from({ length: 7 }).map((_, i) => ({ name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(i + 1) % 7], problems: 0 }));

const DashboardPage = () => {
    const [stats, setStats] = useState(defaultStats);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [problems, setProblems] = useState([]);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    
    // Get sync state from Redux
    const syncState = useSelector((state) => state.sync);

    useEffect(() => {
        const loadStatsAndActivity = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch aggregated stats
                const statsData = await analyticsService.getStats();
                const breakdown = statsData?.difficultyBreakdown || {};

                setStats({
                    totalSolved: statsData?.totalSolved ?? 0,
                    easy: breakdown.easy ?? 0,
                    medium: breakdown.medium ?? 0,
                    hard: breakdown.hard ?? 0,
                });

                // Fetch user's problems (get recent history, use large limit)
                const problemsPayload = await problemService.getProblems({ limit: 1000 });
                const problemsList = (problemsPayload && problemsPayload.data) ? problemsPayload.data : [];
                setProblems(problemsList);

                // Get saved AI analysis from localStorage (set by Analytics page)
                const savedAnalysis = localStorage.getItem('aiAnalysis');
                if (savedAnalysis) {
                    try {
                        setAiAnalysis(JSON.parse(savedAnalysis));
                    } catch (err) {
                        console.log('Could not parse saved AI analysis');
                    }
                }

            } catch (err) {
                setError(err?.response?.data?.message || err?.message || 'Failed to load dashboard');
                setStats(defaultStats);
                setActivity(defaultActivity);
            } finally {
                setLoading(false);
            }
        };

        loadStatsAndActivity();
    }, []);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-textMain">Dashboard</h1>
                <p className="text-sm text-textMuted mt-1">Your preparation intelligence overview.</p>
            </header>

            {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            )}

            {/* SECTION 1: User Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Solved"
                    value={loading ? '...' : stats.totalSolved}
                    icon={Target}
                    trend={12}
                />
                <StatCard
                    title="Easy Mastery"
                    value={loading ? '...' : stats.easy}
                    icon={CheckCircle}
                    colorClass="text-leetcodeEasy"
                />
                <StatCard
                    title="Medium Focus"
                    value={loading ? '...' : stats.medium}
                    icon={Code}
                    colorClass="text-leetcodeMedium"
                />
                <StatCard
                    title="Hard Challenges"
                    value={loading ? '...' : stats.hard}
                    icon={Flame}
                    colorClass="text-leetcodeHard"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* SECTION 4: AI Analysis */}
                <div className="lg:col-span-2 bg-surface border border-border rounded-lg p-6">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider">AI Analysis</h3>
                    </div>
                    
                    {aiAnalysis ? (
                        <div className="space-y-6">
                            {/* Readiness Score */}
                            <div className="bg-background/50 rounded-lg p-4 border border-primary/20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-textMain flex items-center gap-2">
                                        <TrendingUp size={16} className="text-primary" />
                                        Overall Readiness Score
                                    </span>
                                    <span className="text-2xl font-bold text-primary">{aiAnalysis.overallReadinessScore}/100</span>
                                </div>
                                <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500" 
                                        style={{ width: `${aiAnalysis.overallReadinessScore}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Strongest Areas */}
                            {aiAnalysis.strongestAreas && aiAnalysis.strongestAreas.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-textMain uppercase mb-2 opacity-70">Strongest Areas</h4>
                                    <div className="space-y-2">
                                        {aiAnalysis.strongestAreas.slice(0, 3).map((area, idx) => (
                                            <div key={idx} className="p-2 bg-background/50 rounded border border-success/20">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-success">{area.topic}</span>
                                                    <span className="text-xs text-textMuted">{area.rating}/10</span>
                                                </div>
                                                <p className="text-xs text-textMuted mt-1">{area.evidence}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Weakest Areas */}
                            {aiAnalysis.weakestAreas && aiAnalysis.weakestAreas.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-textMain uppercase mb-2 opacity-70 flex items-center gap-1">
                                        <AlertCircle size={14} className="text-danger" />
                                        Areas for Improvement
                                    </h4>
                                    <div className="space-y-2">
                                        {aiAnalysis.weakestAreas.slice(0, 3).map((area, idx) => (
                                            <div key={idx} className="p-2 bg-background/50 rounded border border-danger/20">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-danger">{area.topic}</span>
                                                    <span className="text-xs text-textMuted">{area.rating}/10</span>
                                                </div>
                                                <p className="text-xs text-textMuted mt-1">{area.evidence}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Current Level */}
                            {aiAnalysis.placementAssessment && (
                                <div className="bg-background/50 rounded-lg p-3 border border-border">
                                    <p className="text-xs text-textMuted mb-1">Interview Readiness</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <p className="text-xs font-semibold text-textMain">Service Companies</p>
                                            <p className="text-xs text-primary font-bold mt-1">{aiAnalysis.placementAssessment.serviceCompanyReadiness}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-textMain">Product Companies</p>
                                            <p className="text-xs text-primary font-bold mt-1">{aiAnalysis.placementAssessment.productCompanyReadiness}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-64 text-textMuted text-sm border border-dashed border-border rounded bg-background/50 flex-col gap-2">
                            <p>AI analysis not available yet.</p>
                            <p className="text-xs">Go to <span className="text-primary font-semibold">Analytics</span> page and click <span className="text-primary font-semibold">Compute Analysis</span> button.</p>
                        </div>
                    )}
                </div>

                {/* SECTION 3: Sync Status Overview */}
                <div className="lg:col-span-1 space-y-6">
                    <SyncProgressCard
                        status={syncState.status}
                        progressPercent={syncState.progressPercent}
                        metadata={syncState.progress}
                    />

                    {/* SECTION 2: Recent Activity */}
                    <div className="bg-surface border border-border rounded-lg p-6 flex flex-col h-[calc(100%-144px)]">
                        <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider mb-4">Recent Solved</h3>
                        <div className="flex-1 flex flex-col overflow-y-auto gap-2">
                            {problems.length > 0 ? (
                                problems.slice(0, 5).map((p) => (
                                    <div key={p._id || p.id} className="p-3 bg-background rounded border border-border hover:border-primary transition-colors">
                                        <p className="font-mono text-xs text-primary truncate">{p.title}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs text-textMuted">
                                                {p.solvedAt ? new Date(p.solvedAt).toLocaleDateString() : 'N/A'}
                                            </span>
                                            {p.difficulty && (
                                                <span className={`text-xs font-semibold ${p.difficulty === 'Easy' ? 'text-leetcodeEasy' :
                                                    p.difficulty === 'Medium' ? 'text-leetcodeMedium' :
                                                        'text-leetcodeHard'
                                                    }`}>
                                                    {p.difficulty}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-textMuted text-sm border border-dashed border-border rounded bg-background/50">
                                    No recent activity found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
