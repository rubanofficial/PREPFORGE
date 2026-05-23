import React, { useState } from 'react';
import ProblemTable from '../components/UI/ProblemTable';
import { Filter, Search } from 'lucide-react';

const mockProblems = [
    { _id: '1', title: 'Two Sum', url: '#', difficulty: 'Easy', topics: ['Array', 'Hash Table'], solvedAt: new Date().toISOString() },
    { _id: '2', title: 'Add Two Numbers', url: '#', difficulty: 'Medium', topics: ['Linked List', 'Math'], solvedAt: new Date(Date.now() - 86400000).toISOString() },
    { _id: '3', title: 'Median of Two Sorted Arrays', url: '#', difficulty: 'Hard', topics: ['Array', 'Binary Search', 'Divide and Conquer'], solvedAt: new Date(Date.now() - 86400000*2).toISOString() },
];

const ProblemsPage = () => {
    const [difficulty, setDifficulty] = useState('All');

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-textMain">Problem Repository</h1>
                    <p className="text-sm text-textMuted mt-1">Explore and filter your normalized problem database.</p>
                </div>
            </header>

            <div className="bg-surface border border-border rounded-lg flex flex-col">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search by title or topic..." 
                            className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-1.5 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter size={16} className="text-textMuted" />
                        <select 
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            className="bg-background border border-border rounded-md px-3 py-1.5 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                        >
                            <option value="All">All Difficulties</option>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>
                    </div>
                </div>

                <div className="p-4">
                    <ProblemTable problems={mockProblems} loading={false} />
                </div>
                
                <div className="p-4 border-t border-border flex items-center justify-between text-sm text-textMuted">
                    <span>Showing 1 to 3 of 342 results</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 bg-background border border-border rounded hover:bg-surfaceHover transition-colors disabled:opacity-50" disabled>Previous</button>
                        <button className="px-3 py-1 bg-background border border-border rounded hover:bg-surfaceHover transition-colors">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProblemsPage;
