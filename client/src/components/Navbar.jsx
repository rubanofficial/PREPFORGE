import React from 'react';
import { Bell, Search, UserCircle } from 'lucide-react';
import { useSelector } from 'react-redux';

const Navbar = () => {
    const { user } = useSelector(state => state.auth);

    return (
        <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-border sticky top-0 z-10 flex items-center justify-between px-6">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative max-w-md w-full hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search problems, topics..." 
                        className="w-full bg-background border border-border rounded-md pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-textMain placeholder:text-textMuted"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button className="text-textMuted hover:text-textMain transition-colors relative">
                    <Bell size={20} />
                    <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full border border-surface"></span>
                </button>
                <div className="h-6 w-px bg-border"></div>
                <div className="flex items-center gap-2 cursor-pointer">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium text-textMain">{user?.username || 'User'}</div>
                        <div className="text-xs text-textMuted">Pro Member</div>
                    </div>
                    <UserCircle size={32} className="text-textMuted" />
                </div>
            </div>
        </header>
    );
};

export default Navbar;
