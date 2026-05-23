import React from 'react';
import StatCard from '../components/UI/StatCard';
import SyncProgressCard from '../components/UI/SyncProgressCard';
import { Target, CheckCircle, Code, Flame } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for initial UI scaffolding
const mockStats = {
    totalSolved: 342,
    easy: 125,
    medium: 180,
    hard: 37,
};

const mockActivityData = [
    { name: 'Mon', problems: 4 },
    { name: 'Tue', problems: 7 },
    { name: 'Wed', problems: 2 },
    { name: 'Thu', problems: 12 },
    { name: 'Fri', problems: 5 },
    { name: 'Sat', problems: 8 },
    { name: 'Sun', problems: 3 },
];

const DashboardPage = () => {
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-textMain">Dashboard</h1>
                <p className="text-sm text-textMuted mt-1">Your preparation intelligence overview.</p>
            </header>

            {/* SECTION 1: User Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Total Solved" 
                    value={mockStats.totalSolved} 
                    icon={Target} 
                    trend={12} 
                />
                <StatCard 
                    title="Easy Mastery" 
                    value={mockStats.easy} 
                    icon={CheckCircle} 
                    colorClass="text-leetcodeEasy"
                />
                <StatCard 
                    title="Medium Focus" 
                    value={mockStats.medium} 
                    icon={Code} 
                    colorClass="text-leetcodeMedium"
                />
                <StatCard 
                    title="Hard Challenges" 
                    value={mockStats.hard} 
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
                            <AreaChart data={mockActivityData}>
                                <defs>
                                    <linearGradient id="colorProblems" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
                                    itemStyle={{ color: 'var(--primary)' }}
                                />
                                <Area type="monotone" dataKey="problems" stroke="var(--primary)" fillOpacity={1} fill="url(#colorProblems)" />
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
