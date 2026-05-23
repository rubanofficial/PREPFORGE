import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const mockTopicData = [
    { subject: 'Array', A: 120, fullMark: 150 },
    { subject: 'String', A: 98, fullMark: 150 },
    { subject: 'DP', A: 45, fullMark: 150 },
    { subject: 'Trees', A: 85, fullMark: 150 },
    { subject: 'Graphs', A: 65, fullMark: 150 },
    { subject: 'Math', A: 70, fullMark: 150 },
];

const mockDifficultyData = [
    { name: 'Jan', Easy: 40, Medium: 24, Hard: 4 },
    { name: 'Feb', Easy: 30, Medium: 35, Hard: 8 },
    { name: 'Mar', Easy: 20, Medium: 45, Hard: 15 },
    { name: 'Apr', Easy: 27, Medium: 39, Hard: 10 },
];

const AnalyticsPage = () => {
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-textMain">Intelligence Analytics</h1>
                <p className="text-sm text-textMuted mt-1">Deep insights into your learning patterns and mastery.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface border border-border rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider mb-6">Topic Mastery Radar</h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={mockTopicData}>
                                <PolarGrid stroke="var(--border)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                                <Radar name="Mastery" dataKey="A" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider mb-6">Difficulty Progression</h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mockDifficultyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
                                />
                                <Bar dataKey="Easy" stackId="a" fill="var(--leetcode-easy)" />
                                <Bar dataKey="Medium" stackId="a" fill="var(--leetcode-medium)" />
                                <Bar dataKey="Hard" stackId="a" fill="var(--leetcode-hard)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
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
