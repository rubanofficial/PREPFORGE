import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fetchStats } from '../features/analytics/analyticsSlice';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { getPerformanceAnalysis } from '../services/aiAnalysisService';

const EMPTY_STATS = {
    totalSolved: 0,
    difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
    topTopics: []
};

const AnalyticsPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { stats, loading, error } = useSelector((s) => s.analytics || {});

    // AI Analysis state
    const [analysis, setAnalysis] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);

    const resolvedStats = stats || EMPTY_STATS;
    const hasData = resolvedStats.totalSolved > 0;

    useEffect(() => {
        dispatch(fetchStats());
    }, [dispatch]);

    // Fetch AI analysis when component mounts and has data
    useEffect(() => {
        if (hasData) {
            fetchAIAnalysis();
        }
    }, [hasData]);

    const fetchAIAnalysis = async () => {
        setAiLoading(true);
        setAiError(null);
        try {
            const response = await getPerformanceAnalysis();
            if (response.success) {
                setAnalysis(response.data);
            } else {
                setAiError(response.message);
            }
        } catch (err) {
            setAiError(err.message || 'Failed to fetch AI analysis');
        } finally {
            setAiLoading(false);
        }
    };

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

            <div className="bg-surface border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-textMain mb-1">🤖 AI Performance Analysis</h3>
                        <p className="text-xs text-textMuted">Powered by Google Gemini - Personalized insights based on your problem-solving patterns</p>
                    </div>
                    <button
                        onClick={fetchAIAnalysis}
                        disabled={aiLoading}
                        className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {aiLoading ? '⏳ Analyzing...' : '🔄 Refresh'}
                    </button>
                </div>

                {aiLoading && (
                    <div className="flex justify-center py-8">
                        <LoadingSpinner />
                    </div>
                )}

                {aiError && (
                    <div className="p-4 bg-red-50 text-red-700 rounded text-sm mb-4">
                        ⚠️ {aiError}
                    </div>
                )}

                {analysis && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* HERO CARD: Readiness & Key Metrics */}
                        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                {/* Left side: Readiness Score gauge */}
                                <div className="md:col-span-5 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-border pb-6 md:pb-0 md:pr-6">
                                    <div className="relative flex items-center justify-center">
                                        <svg className="w-36 h-36 transform -rotate-90">
                                            <circle
                                                cx="72"
                                                cy="72"
                                                r="58"
                                                className="stroke-border"
                                                strokeWidth="8"
                                                fill="transparent"
                                            />
                                            <circle
                                                cx="72"
                                                cy="72"
                                                r="58"
                                                stroke="var(--primary)"
                                                strokeWidth="10"
                                                fill="transparent"
                                                strokeDasharray={2 * Math.PI * 58}
                                                strokeDashoffset={2 * Math.PI * 58 - (2 * Math.PI * 58 * (analysis.readinessScore || 0)) / 100}
                                                strokeLinecap="round"
                                                className="transition-all duration-1000 ease-out"
                                            />
                                        </svg>
                                        <div className="absolute flex flex-col items-center">
                                            <span className="text-4xl font-extrabold text-textMain tracking-tight">
                                                {analysis.readinessScore || 0}%
                                            </span>
                                            <span className="text-[10px] text-textMuted uppercase font-bold tracking-wider mt-0.5">Readiness</span>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                                            (analysis.readinessScore || 0) < 50 
                                                ? 'text-leetcodeHard bg-leetcodeHard/10 border-leetcodeHard/20' 
                                                : (analysis.readinessScore || 0) < 75 
                                                    ? 'text-leetcodeMedium bg-leetcodeMedium/10 border-leetcodeMedium/20' 
                                                    : 'text-leetcodeEasy bg-leetcodeEasy/10 border-leetcodeEasy/20'
                                        }`}>
                                            {(analysis.readinessScore || 0) < 50 
                                                ? 'Needs Practice' 
                                                : (analysis.readinessScore || 0) < 75 
                                                    ? 'Getting Ready' 
                                                    : 'Interview Ready'}
                                        </span>
                                        <p className="text-xs text-textMuted mt-2 max-w-[240px]">
                                            Estimated likelihood of clearing a technical interview based on current performance.
                                        </p>
                                    </div>
                                </div>

                                {/* Right side: Key Metrics Grid */}
                                <div className="md:col-span-7 space-y-4">
                                    <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider">Analysis Metrics</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-background border border-border rounded-lg p-3">
                                            <div className="text-[10px] text-textMuted uppercase font-bold tracking-wider">Consistency Score</div>
                                            <div className="text-xl font-bold text-primary mt-1">
                                                {analysis.metrics?.consistencyScore || 0}%
                                            </div>
                                            <div className="w-full bg-border rounded-full h-1.5 mt-2 overflow-hidden">
                                                <div 
                                                    className="bg-primary h-1.5 rounded-full transition-all duration-1000" 
                                                    style={{ width: `${analysis.metrics?.consistencyScore || 0}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-background border border-border rounded-lg p-3">
                                            <div className="text-[10px] text-textMuted uppercase font-bold tracking-wider">Topics Covered</div>
                                            <div className="text-xl font-bold text-textMain mt-1">
                                                {analysis.metrics?.topicsCovered || 0}
                                            </div>
                                            <div className="text-xs text-textMuted mt-1">unique concepts</div>
                                        </div>

                                        <div className="bg-background border border-border rounded-lg p-3 col-span-2">
                                            <div className="text-[10px] text-textMuted uppercase font-bold tracking-wider mb-1.5">Problem Mix</div>
                                            <div className="flex items-center gap-4 text-xs font-semibold">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-sm bg-leetcodeEasy inline-block" />
                                                    <span className="text-textMain">{analysis.metrics?.easySolved || 0} Easy</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-sm bg-leetcodeMedium inline-block" />
                                                    <span className="text-textMain">{analysis.metrics?.mediumSolved || 0} Medium</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-sm bg-leetcodeHard inline-block" />
                                                    <span className="text-textMain">{analysis.metrics?.hardSolved || 0} Hard</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2x2 GRID FOR DETAILS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top 3 Strengths */}
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-2 flex items-center gap-2">
                                    <span className="text-leetcodeEasy text-base">💪</span> Top Strengths
                                </h4>
                                <p className="text-xs text-textMuted mb-4">Areas where you display strong problem-solving proficiency.</p>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.strengths && analysis.strengths.length > 0 ? (
                                        analysis.strengths.map((strength, idx) => (
                                            <span key={idx} className="px-3 py-1.5 bg-leetcodeEasy/10 border border-leetcodeEasy/30 text-leetcodeEasy text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm">
                                                <span className="w-1.5 h-1.5 rounded-full bg-leetcodeEasy" />
                                                {strength}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-textMuted text-xs italic">No strengths identified yet.</p>
                                    )}
                                </div>
                            </div>

                            {/* Areas for Improvement (Weaknesses) */}
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-2 flex items-center gap-2">
                                    <span className="text-leetcodeHard text-base">⚠️</span> Weakness Areas
                                </h4>
                                <p className="text-xs text-textMuted mb-4">Topics or habits requiring additional focus and practice.</p>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.weaknesses && analysis.weaknesses.length > 0 ? (
                                        analysis.weaknesses.map((weakness, idx) => (
                                            <span key={idx} className="px-3 py-1.5 bg-leetcodeHard/10 border border-leetcodeHard/30 text-leetcodeHard text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm">
                                                <span className="w-1.5 h-1.5 rounded-full bg-leetcodeHard" />
                                                {weakness}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-textMuted text-xs italic">No critical weaknesses identified.</p>
                                    )}
                                </div>
                            </div>

                            {/* This Week's Focus */}
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-2 flex items-center gap-2">
                                    <span className="text-primary text-base">🎯</span> This Week's Focus
                                </h4>
                                <p className="text-xs text-textMuted mb-4">Targeted action items to optimize your preparation.</p>
                                <div className="space-y-2">
                                    {analysis.weeklyFocus && analysis.weeklyFocus.length > 0 ? (
                                        analysis.weeklyFocus.map((focus, i) => (
                                            <div key={i} className="flex items-center gap-3 p-2.5 bg-background border border-border rounded-lg hover:border-primary/30 transition-colors">
                                                <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                                                    {i + 1}
                                                </div>
                                                <span className="text-xs font-semibold text-textMain">{focus}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-textMuted text-xs italic">No weekly focus items compiled.</p>
                                    )}
                                </div>
                            </div>

                            {/* AI Insight */}
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-2 flex items-center gap-2">
                                    <span className="text-base">🤖</span> AI Performance Insight
                                </h4>
                                <p className="text-xs text-textMuted mb-4">Synthesized evaluation of your learning trajectory.</p>
                                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-3 items-start relative overflow-hidden">
                                    <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 opacity-5 text-primary text-7xl select-none font-serif">“</div>
                                    <div className="text-xl mt-0.5">💡</div>
                                    <div>
                                        <p className="text-xs text-textMain leading-relaxed italic">
                                            "{analysis.aiInsight}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM SECTION: Recommended Problems */}
                        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-textMain text-sm mb-1 flex items-center gap-2">
                                <span className="text-primary text-base">🚀</span> Recommended LeetCode Problems
                            </h4>
                            <p className="text-xs text-textMuted mb-4">Handpicked challenges tailored to bridge your skills gaps.</p>
                            <div className="divide-y divide-border border-t border-border mt-2">
                                {analysis.recommendedProblems && analysis.recommendedProblems.length > 0 ? (
                                    analysis.recommendedProblems.map((prob, i) => (
                                        <div key={i} className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-primary/5 px-2 rounded-lg transition-colors">
                                            <div className="flex items-center gap-2">
                                                <span className="text-primary font-bold">▶</span>
                                                <span className="text-xs font-semibold text-textMain">{prob.title}</span>
                                            </div>
                                            <span className="text-xs px-2.5 py-1 bg-surface border border-border rounded-md text-textMuted max-w-xs truncate">
                                                {prob.reason}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-textMuted text-xs italic py-2">No recommended problems available.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!analysis && !aiLoading && hasData && (
                    <div className="text-center py-8">
                        <p className="text-textMuted mb-4">Ready to get personalized AI insights?</p>
                        <button
                            onClick={fetchAIAnalysis}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold"
                        >
                            Generate AI Analysis
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsPage;
