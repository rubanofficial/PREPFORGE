import React, { useState } from 'react';
import { Save, Key } from 'lucide-react';

const SettingsPage = () => {
    const [username, setUsername] = useState('S_RUBAN');
    const [sessionCookie, setSessionCookie] = useState('');

    const handleSave = (e) => {
        e.preventDefault();
        // Setup API call to save session
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-textMain">Settings</h1>
                <p className="text-sm text-textMuted mt-1">Manage your platform integrations and preferences.</p>
            </header>

            <div className="bg-surface border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold text-textMain mb-6 flex items-center gap-2">
                    <Key size={18} className="text-primary" />
                    LeetCode Integration
                </h2>
                
                <form onSubmit={handleSave} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">LeetCode Username</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. S_RUBAN"
                            className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors font-mono"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">LEETCODE_SESSION Cookie (JWT)</label>
                        <textarea 
                            value={sessionCookie}
                            onChange={(e) => setSessionCookie(e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1NiIs..."
                            rows={4}
                            className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors font-mono resize-none"
                        />
                        <p className="text-xs text-textMuted mt-2">
                            This token is encrypted before being stored in the database and is required for Deep Sync functionality.
                        </p>
                    </div>

                    <div className="pt-2">
                        <button 
                            type="submit"
                            className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
                        >
                            <Save size={16} />
                            Save Credentials
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsPage;
