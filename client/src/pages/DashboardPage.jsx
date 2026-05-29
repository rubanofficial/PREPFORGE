import React, { useEffect, useState } from 'react';
import StatCard from '../components/UI/StatCard';
import SyncProgressCard from '../components/UI/SyncProgressCard';
import { Target, CheckCircle, Code, Flame } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
    const [activity, setActivity] = useState(defaultActivity);

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
                const problems = (problemsPayload && problemsPayload.data) ? problemsPayload.data : [];

                // Build last-7-days buckets (oldest -> newest)
                const days = [];
                const labels = [];
                const now = new Date();
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(now.getDate() - i);
                    days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
                    labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
                }

                const counts = new Array(7).fill(0);
                problems.forEach((p) => {
                    const solved = p.solvedAt ? new Date(p.solvedAt) : null;
                    if (!solved) return;
                    for (let i = 0; i < days.length; i++) {
                        const day = days[i];
                        if (
                            solved.getFullYear() === day.getFullYear() &&
                            solved.getMonth() === day.getMonth() &&
                            solved.getDate() === day.getDate()
                        ) {
                            counts[i]++;
                            break;
                        }
                    }
                });

                const activityData = labels.map((name, idx) => ({ name, problems: counts[idx] }));
                setActivity(activityData);

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
                {/* SECTION 4: Analytics Placeholder */}
                <div className="lg:col-span-2 bg-surface border border-border rounded-lg p-6">
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider">Weekly Consistency</h3>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activity} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorProblems" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="var(--text-muted)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={5}
                                />
                                <YAxis
                                    stroke="var(--text-muted)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                    domain={[0, (dataMax) => Math.max(dataMax + 1, 5)]}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--surface)',
                                        borderColor: 'var(--border)',
                                        color: 'var(--text-main)',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                        padding: '8px 12px',
                                    }}
                                    itemStyle={{ color: 'var(--primary)' }}
                                    labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}
                                    cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="problems"
                                    stroke="var(--primary)"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#colorProblems)"
                                    dot={{ r: 4, fill: 'var(--surface)', stroke: 'var(--primary)', strokeWidth: 2 }}
                                    activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'var(--surface)', strokeWidth: 2 }}
                                    animationDuration={800}
                                    animationEasing="ease-in-out"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* SECTION 3: Sync Status Overview */}
                <div className="lg:col-span-1 space-y-6">
                    <SyncProgressCard
                        status="completed"
                        progressPercent={100}
                        metadata={{ fetchedFromProvider: 342, insertedToDatabase: 0 }}
                    />

                    {/* SECTION 2: Recent Activity Placeholder */}
                    <div className="bg-surface border border-border rounded-lg p-6 flex flex-col h-[calc(100%-144px)]">
                        <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider mb-4">Recent Solved</h3>
                        <div className="flex-1 flex items-center justify-center text-textMuted text-sm border border-dashed border-border rounded bg-background/50">
                            No recent activity found.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
