import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fetchStats } from '../features/analytics/analyticsSlice';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const EMPTY_STATS = {
    totalSolved: 0,
    difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
    topTopics: []
};

const AnalyticsPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { stats, loading, error } = useSelector((s) => s.analytics || {});

    const resolvedStats = stats || EMPTY_STATS;
    const hasData = resolvedStats.totalSolved > 0;

    useEffect(() => {
        dispatch(fetchStats());
    }, [dispatch]);

    // Map server data to chart-friendly shapes
    const topicData = (resolvedStats.topTopics && resolvedStats.topTopics.length > 0)
        ? resolvedStats.topTopics.map(t => {
            const count = t.count || 0;
            return {
                subject: t.name.charAt(0).toUpperCase() + t.name.slice(1),
                count: count,
                fullMark: Math.max(count * 1.2, 10)
            };
        })
        : [];

    const difficultyData = [
        {
            name: 'Problems Solved',
            Easy: resolvedStats.difficultyBreakdown.easy || 0,
            Medium: resolvedStats.difficultyBreakdown.medium || 0,
            Hard: resolvedStats.difficultyBreakdown.hard || 0
        }
    ];

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-textMain">Intelligence Analytics</h1>
                <p className="text-sm text-textMuted mt-1">Deep insights into your learning patterns and mastery.</p>
            </header>

            {loading && (
                <div className="p-6">
                    <LoadingSpinner />
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded">Error loading analytics: {String(error)}</div>
            )}

            {/* Stat Cards */}
            {!loading && hasData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-surface border border-border rounded-lg p-4">
                        <div className="text-sm text-textMuted uppercase tracking-wider">Total Solved</div>
                        <div className="text-3xl font-bold text-primary mt-2">{resolvedStats.totalSolved}</div>
                        <div className="text-xs text-textMuted mt-2">problems</div>
                    </div>
                    <div className="bg-surface border border-border rounded-lg p-4">
                        <div className="text-sm text-textMuted uppercase tracking-wider">Topics Mastered</div>
                        <div className="text-3xl font-bold text-leetcodeEasy mt-2">{resolvedStats.topTopics?.length || 0}</div>
                        <div className="text-xs text-textMuted mt-2">unique topics</div>
                    </div>
                    <div className="bg-surface border border-border rounded-lg p-4">
                        <div className="text-sm text-textMuted uppercase tracking-wider">Avg Difficulty</div>
                        <div className="text-3xl font-bold text-leetcodeMedium mt-2">
                            {resolvedStats.difficultyBreakdown.medium > resolvedStats.difficultyBreakdown.easy ? 'M' : 'E'}
                        </div>
                        <div className="text-xs text-textMuted mt-2">E: {resolvedStats.difficultyBreakdown.easy} | M: {resolvedStats.difficultyBreakdown.medium} | H: {resolvedStats.difficultyBreakdown.hard}</div>
                    </div>
                </div>
            )}

            {!loading && !hasData && (
                <div className="bg-surface border border-border rounded-lg p-12 flex flex-col items-center justify-center text-center">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-2xl font-bold text-textMain mb-2">No Analytics Yet</h3>
                    <p className="text-textMuted max-w-md mb-6">Start syncing your LeetCode problems to unlock powerful learning analytics and topic mastery insights.</p>
                    <button
                        onClick={() => navigate('/sync')}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold"
                    >
                        Go to Sync →
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {hasData && topicData.length > 0 && (
                    <div className="bg-surface border border-border rounded-lg p-6">
                        <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider mb-2">Topic Mastery Radar</h3>
                        <p className="text-xs text-textMuted mb-4">Problems solved per topic</p>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={topicData}>
                                    <PolarGrid stroke="var(--border)" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                    <PolarRadiusAxis angle={90} tick={false} axisLine={false} />
                                    <Radar name="Problems" dataKey="count" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.5} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {hasData && (
                    <div className="bg-surface border border-border rounded-lg p-6">
                        <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider mb-2">Difficulty Breakdown</h3>
                        <p className="text-xs text-textMuted mb-4">Solved by difficulty level</p>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={difficultyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
                                    />
                                    <Legend wrapperStyle={{ color: 'var(--text-muted)' }} />
                                    <Bar dataKey="Easy" stackId="a" fill="var(--leetcode-easy)" />
                                    <Bar dataKey="Medium" stackId="a" fill="var(--leetcode-medium)" />
                                    <Bar dataKey="Hard" stackId="a" fill="var(--leetcode-hard)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-surface border border-border rounded-lg p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
                <h3 className="text-lg font-bold text-textMain mb-2">Recommendation Engine</h3>
                <p className="text-textMuted max-w-md">Our AI recommendation engine is currently analyzing your performance data. Check back soon for personalized problem sets.</p>
                <div className="mt-6 px-4 py-2 bg-background border border-border text-sm text-textMuted font-mono rounded inline-block">
                    Status: Training models...
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
