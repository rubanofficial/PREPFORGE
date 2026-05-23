import React from 'react';
import { ExternalLink } from 'lucide-react';

const ProblemTable = ({ problems, loading }) => {
    if (loading) {
        return <div className="p-8 text-center text-textMuted">Loading problems...</div>;
    }

    if (!problems || problems.length === 0) {
        return <div className="p-8 text-center text-textMuted border border-dashed border-border rounded-lg">No problems found. Start a sync!</div>;
    }

    const getDifficultyColor = (difficulty) => {
        switch (difficulty?.toLowerCase()) {
            case 'easy': return 'text-leetcodeEasy bg-leetcodeEasy/10';
            case 'medium': return 'text-leetcodeMedium bg-leetcodeMedium/10';
            case 'hard': return 'text-leetcodeHard bg-leetcodeHard/10';
            default: return 'text-textMuted bg-surfaceHover';
        }
    };

    return (
        <div className="w-full overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-background border-b border-border text-textMuted uppercase tracking-wider text-xs">
                    <tr>
                        <th className="px-6 py-4 font-medium">Problem</th>
                        <th className="px-6 py-4 font-medium">Difficulty</th>
                        <th className="px-6 py-4 font-medium">Topics</th>
                        <th className="px-6 py-4 font-medium text-right">Solved At</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {problems.map((problem) => (
                        <tr key={problem._id} className="hover:bg-surfaceHover/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-textMain flex items-center gap-2">
                                {problem.title}
                                <a href={problem.url} target="_blank" rel="noopener noreferrer" className="text-textMuted hover:text-primary transition-colors">
                                    <ExternalLink size={14} />
                                </a>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(problem.difficulty)}`}>
                                    {problem.difficulty}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex gap-1 flex-wrap max-w-xs overflow-hidden">
                                    {problem.topics?.slice(0, 3).map((topic, i) => (
                                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-background border border-border text-textMuted">
                                            {topic}
                                        </span>
                                    ))}
                                    {problem.topics?.length > 3 && (
                                        <span className="text-xs px-1 py-0.5 text-textMuted">+{problem.topics.length - 3}</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right text-textMuted font-mono text-xs">
                                {new Date(problem.solvedAt).toLocaleDateString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ProblemTable;
