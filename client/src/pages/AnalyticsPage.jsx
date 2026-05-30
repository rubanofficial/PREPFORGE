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

/* ── helper: extract leading percentage from a readiness string like "85% — Ready…" ── */
const extractPercent = (str) => {
    if (!str) return 0;
    const m = str.match(/(\d+)%/);
    return m ? parseInt(m[1], 10) : 0;
};

/* ── helper: color classes by rating ─────────────────────────────────── */
const ratingColor = (r) => {
    if (r >= 7) return { text: 'text-leetcodeEasy', bg: 'bg-leetcodeEasy', bgFaint: 'bg-leetcodeEasy/15', border: 'border-leetcodeEasy/30' };
    if (r >= 4) return { text: 'text-leetcodeMedium', bg: 'bg-leetcodeMedium', bgFaint: 'bg-leetcodeMedium/15', border: 'border-leetcodeMedium/30' };
    return { text: 'text-leetcodeHard', bg: 'bg-leetcodeHard', bgFaint: 'bg-leetcodeHard/15', border: 'border-leetcodeHard/30' };
};

/* ── helper: difficulty badge classes ────────────────────────────────── */
const diffBadge = (d) => {
    const dl = (d || '').toLowerCase();
    if (dl === 'easy') return 'text-leetcodeEasy bg-leetcodeEasy/10 border-leetcodeEasy/30';
    if (dl === 'medium') return 'text-leetcodeMedium bg-leetcodeMedium/10 border-leetcodeMedium/30';
    return 'text-leetcodeHard bg-leetcodeHard/10 border-leetcodeHard/30';
};

/* ── helper: importance badge ────────────────────────────────────────── */
const importanceBadge = (imp) => {
    const il = (imp || '').toLowerCase();
    if (il === 'high') return 'text-leetcodeHard bg-leetcodeHard/10 border-leetcodeHard/30';
    if (il === 'medium') return 'text-leetcodeMedium bg-leetcodeMedium/10 border-leetcodeMedium/30';
    return 'text-leetcodeEasy bg-leetcodeEasy/10 border-leetcodeEasy/30';
};

const AnalyticsPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { stats, loading, error } = useSelector((s) => s.analytics || {});

    // AI Analysis state
    const [analysis, setAnalysis] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [activeWeek, setActiveWeek] = useState('week1');

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

    // ── Derived data from analysis ─────────────────────────────────────
    const sortedTopicRatings = analysis?.topicStrengthRatings
        ? Object.entries(analysis.topicStrengthRatings)
            .map(([topic, rating]) => ({ topic, rating }))
            .sort((a, b) => b.rating - a.rating)
        : [];

    const roadmap = analysis?.placementAssessment?.fourWeekRoadmap || {};
    const weeks = ['week1', 'week2', 'week3', 'week4'];

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

            {/* ════════════════════════════════════════════════════════════════
                AI PERFORMANCE ANALYSIS — COMPREHENSIVE SECTION
               ════════════════════════════════════════════════════════════════ */}
            <div className="bg-surface border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-textMain mb-1">🤖 AI Performance Analysis</h3>
                        <p className="text-xs text-textMuted">Powered by Google Gemini — Brutally honest, evidence-based insights</p>
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

                        {/* ─── 1. HERO CARD: Readiness Score + Metrics ─────────── */}
                        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                {/* Left: Readiness gauge */}
                                <div className="md:col-span-5 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-border pb-6 md:pb-0 md:pr-6">
                                    <div className="relative flex items-center justify-center">
                                        <svg className="w-36 h-36 transform -rotate-90">
                                            <circle cx="72" cy="72" r="58" className="stroke-border" strokeWidth="8" fill="transparent" />
                                            <circle
                                                cx="72" cy="72" r="58"
                                                stroke="var(--primary)" strokeWidth="10" fill="transparent"
                                                strokeDasharray={2 * Math.PI * 58}
                                                strokeDashoffset={2 * Math.PI * 58 - (2 * Math.PI * 58 * (analysis.overallReadinessScore || 0)) / 100}
                                                strokeLinecap="round"
                                                className="transition-all duration-1000 ease-out"
                                            />
                                        </svg>
                                        <div className="absolute flex flex-col items-center">
                                            <span className="text-4xl font-extrabold text-textMain tracking-tight">
                                                {analysis.overallReadinessScore || 0}%
                                            </span>
                                            <span className="text-[10px] text-textMuted uppercase font-bold tracking-wider mt-0.5">Readiness</span>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                                            (analysis.overallReadinessScore || 0) < 50
                                                ? 'text-leetcodeHard bg-leetcodeHard/10 border-leetcodeHard/20'
                                                : (analysis.overallReadinessScore || 0) < 75
                                                    ? 'text-leetcodeMedium bg-leetcodeMedium/10 border-leetcodeMedium/20'
                                                    : 'text-leetcodeEasy bg-leetcodeEasy/10 border-leetcodeEasy/20'
                                        }`}>
                                            {(analysis.overallReadinessScore || 0) < 50
                                                ? 'Needs Practice'
                                                : (analysis.overallReadinessScore || 0) < 75
                                                    ? 'Getting Ready'
                                                    : 'Interview Ready'}
                                        </span>
                                    </div>
                                </div>

                                {/* Right: Key Metrics */}
                                <div className="md:col-span-7 space-y-4">
                                    <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider">Analysis Metrics</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-background border border-border rounded-lg p-3">
                                            <div className="text-[10px] text-textMuted uppercase font-bold tracking-wider">Consistency Score</div>
                                            <div className="text-xl font-bold text-primary mt-1">{analysis.metrics?.consistencyScore || 0}%</div>
                                            <div className="w-full bg-border rounded-full h-1.5 mt-2 overflow-hidden">
                                                <div className="bg-primary h-1.5 rounded-full transition-all duration-1000" style={{ width: `${analysis.metrics?.consistencyScore || 0}%` }} />
                                            </div>
                                        </div>
                                        <div className="bg-background border border-border rounded-lg p-3">
                                            <div className="text-[10px] text-textMuted uppercase font-bold tracking-wider">Weighted Score</div>
                                            <div className="text-xl font-bold text-textMain mt-1">{analysis.metrics?.weightedScore || 0}</div>
                                            <div className="text-xs text-textMuted mt-1">E×1 + M×2 + H×3</div>
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

                        {/* ─── 2. TOPIC STRENGTH RATINGS (0-10 bars) ──────────── */}
                        {sortedTopicRatings.length > 0 && (
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-1 flex items-center gap-2">
                                    <span className="text-base">📊</span> Topic Strength Ratings
                                </h4>
                                <p className="text-xs text-textMuted mb-4">Each topic rated 0-10 based on problems solved, difficulty, and coverage.</p>
                                <div className="space-y-2.5">
                                    {sortedTopicRatings.map(({ topic, rating }) => {
                                        const c = ratingColor(rating);
                                        return (
                                            <div key={topic} className="flex items-center gap-3">
                                                <span className="text-xs font-semibold text-textMain w-44 truncate shrink-0">{topic}</span>
                                                <div className="flex-1 bg-border/40 rounded-full h-2.5 overflow-hidden">
                                                    <div
                                                        className={`${c.bg} h-2.5 rounded-full transition-all duration-700 ease-out`}
                                                        style={{ width: `${(rating / 10) * 100}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-bold ${c.text} w-12 text-right shrink-0`}>{rating}/10</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ─── 3 & 4. STRONGEST + WEAKEST AREAS ──────────────── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Strongest */}
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-2 flex items-center gap-2">
                                    <span className="text-leetcodeEasy text-base">💪</span> Strongest Areas
                                </h4>
                                <p className="text-xs text-textMuted mb-4">Evidence-based strengths from your solved problems.</p>
                                <div className="space-y-3">
                                    {analysis.strongestAreas && analysis.strongestAreas.length > 0 ? (
                                        analysis.strongestAreas.map((item, idx) => (
                                            <div key={idx} className="p-3 bg-leetcodeEasy/5 border border-leetcodeEasy/20 rounded-lg">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-textMain">{item.topic}</span>
                                                    <span className="text-[10px] font-bold text-leetcodeEasy bg-leetcodeEasy/10 border border-leetcodeEasy/30 px-2 py-0.5 rounded-full">
                                                        {item.rating}/10
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-textMuted leading-relaxed">{item.evidence}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-textMuted text-xs italic">No strengths identified yet.</p>
                                    )}
                                </div>
                            </div>

                            {/* Weakest */}
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-2 flex items-center gap-2">
                                    <span className="text-leetcodeHard text-base">⚠️</span> Weakest Areas
                                </h4>
                                <p className="text-xs text-textMuted mb-4">Critical gaps identified from your problem history.</p>
                                <div className="space-y-3">
                                    {analysis.weakestAreas && analysis.weakestAreas.length > 0 ? (
                                        analysis.weakestAreas.map((item, idx) => (
                                            <div key={idx} className="p-3 bg-leetcodeHard/5 border border-leetcodeHard/20 rounded-lg">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-textMain">{item.topic}</span>
                                                    <span className="text-[10px] font-bold text-leetcodeHard bg-leetcodeHard/10 border border-leetcodeHard/30 px-2 py-0.5 rounded-full">
                                                        {item.rating}/10
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-textMuted leading-relaxed">{item.evidence}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-textMuted text-xs italic">No critical weaknesses identified.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ─── 5. MISSING INTERVIEW PATTERNS ─────────────────── */}
                        {analysis.missingInterviewPatterns && analysis.missingInterviewPatterns.length > 0 && (
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-1 flex items-center gap-2">
                                    <span className="text-primary text-base">🧩</span> Missing Interview Patterns
                                </h4>
                                <p className="text-xs text-textMuted mb-4">Key algorithmic patterns you haven't practiced yet.</p>
                                <div className="space-y-2">
                                    {analysis.missingInterviewPatterns.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg hover:border-primary/30 transition-colors">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${importanceBadge(item.importance)}`}>
                                                {item.importance}
                                            </span>
                                            <div>
                                                <span className="text-xs font-bold text-textMain">{item.pattern}</span>
                                                <p className="text-[11px] text-textMuted mt-0.5">{item.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ─── 6. NEXT 10 PROBLEMS TO SOLVE ──────────────────── */}
                        {analysis.next10Problems && analysis.next10Problems.length > 0 && (
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-1 flex items-center gap-2">
                                    <span className="text-primary text-base">🚀</span> Next 10 Problems to Solve
                                </h4>
                                <p className="text-xs text-textMuted mb-4">Handpicked unsolved problems to fill your skill gaps.</p>

                                {/* Desktop table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left py-2 px-2 text-textMuted font-bold uppercase tracking-wider">#</th>
                                                <th className="text-left py-2 px-2 text-textMuted font-bold uppercase tracking-wider">Problem</th>
                                                <th className="text-left py-2 px-2 text-textMuted font-bold uppercase tracking-wider">Difficulty</th>
                                                <th className="text-left py-2 px-2 text-textMuted font-bold uppercase tracking-wider">Topic</th>
                                                <th className="text-left py-2 px-2 text-textMuted font-bold uppercase tracking-wider">Why</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {analysis.next10Problems.map((prob, i) => {
                                                const slug = prob.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                                                return (
                                                    <tr key={i} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                                                        <td className="py-2.5 px-2 text-textMuted font-bold">{i + 1}</td>
                                                        <td className="py-2.5 px-2">
                                                            <a
                                                                href={`https://leetcode.com/problems/${slug}/`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-semibold text-primary hover:underline"
                                                            >
                                                                {prob.title}
                                                            </a>
                                                        </td>
                                                        <td className="py-2.5 px-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${diffBadge(prob.difficulty)}`}>
                                                                {prob.difficulty}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-2">
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                                                {prob.topic}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-2 text-textMuted max-w-xs">{prob.reason}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile cards */}
                                <div className="md:hidden space-y-2">
                                    {analysis.next10Problems.map((prob, i) => {
                                        const slug = prob.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                                        return (
                                            <div key={i} className="p-3 bg-background border border-border rounded-lg">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-textMuted font-bold text-xs">#{i + 1}</span>
                                                    <a
                                                        href={`https://leetcode.com/problems/${slug}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-semibold text-xs text-primary hover:underline"
                                                    >
                                                        {prob.title}
                                                    </a>
                                                </div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${diffBadge(prob.difficulty)}`}>
                                                        {prob.difficulty}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                                        {prob.topic}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-textMuted">{prob.reason}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ─── 7. PLACEMENT ASSESSMENT ───────────────────────── */}
                        {analysis.placementAssessment && (
                            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-textMain text-sm mb-1 flex items-center gap-2">
                                    <span className="text-base">🎯</span> Placement Assessment
                                </h4>
                                <p className="text-xs text-textMuted mb-5">Where you stand and how to level up.</p>

                                {/* Current Level Badge */}
                                <div className="flex items-center gap-3 mb-5">
                                    <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Current Level:</span>
                                    <span className="px-4 py-1.5 rounded-full text-sm font-extrabold bg-primary/10 text-primary border border-primary/20">
                                        {analysis.placementAssessment.currentLevel || 'N/A'}
                                    </span>
                                </div>

                                {/* Readiness Bars */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="bg-background border border-border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-textMain">🏢 Service Company</span>
                                            <span className="text-xs font-bold text-leetcodeEasy">{extractPercent(analysis.placementAssessment.serviceCompanyReadiness)}%</span>
                                        </div>
                                        <div className="w-full bg-border/40 rounded-full h-3 overflow-hidden mb-2">
                                            <div
                                                className="bg-leetcodeEasy h-3 rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: `${extractPercent(analysis.placementAssessment.serviceCompanyReadiness)}%` }}
                                            />
                                        </div>
                                        <p className="text-[11px] text-textMuted">{analysis.placementAssessment.serviceCompanyReadiness}</p>
                                    </div>
                                    <div className="bg-background border border-border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-textMain">🚀 Product Company</span>
                                            <span className="text-xs font-bold text-leetcodeMedium">{extractPercent(analysis.placementAssessment.productCompanyReadiness)}%</span>
                                        </div>
                                        <div className="w-full bg-border/40 rounded-full h-3 overflow-hidden mb-2">
                                            <div
                                                className="bg-leetcodeMedium h-3 rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: `${extractPercent(analysis.placementAssessment.productCompanyReadiness)}%` }}
                                            />
                                        </div>
                                        <p className="text-[11px] text-textMuted">{analysis.placementAssessment.productCompanyReadiness}</p>
                                    </div>
                                </div>

                                {/* 4-Week Roadmap */}
                                <div>
                                    <h5 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-3">📅 4-Week Improvement Roadmap</h5>

                                    {/* Week tabs */}
                                    <div className="flex gap-1.5 mb-4 border-b border-border pb-0">
                                        {weeks.map((wk, i) => (
                                            <button
                                                key={wk}
                                                onClick={() => setActiveWeek(wk)}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors border border-b-0 ${
                                                    activeWeek === wk
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-background text-textMuted border-transparent hover:text-textMain hover:bg-background'
                                                }`}
                                            >
                                                Week {i + 1}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Active week content */}
                                    {roadmap[activeWeek] && (
                                        <div className="bg-background border border-border rounded-lg p-4 animate-fadeIn">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                                                    {weeks.indexOf(activeWeek) + 1}
                                                </span>
                                                <span className="text-sm font-bold text-textMain">{roadmap[activeWeek].focus}</span>
                                            </div>
                                            <div className="mb-3">
                                                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Problems to Solve:</span>
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                    {(roadmap[activeWeek].problems || []).map((prob, pi) => (
                                                        <span key={pi} className="px-2.5 py-1 text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-md">
                                                            {prob}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider shrink-0">Goal:</span>
                                                <p className="text-xs text-textMain">{roadmap[activeWeek].goal}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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
