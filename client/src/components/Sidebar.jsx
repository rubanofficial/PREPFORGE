import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, Code2, BarChart3, Settings, LogOut } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { logout } from '../features/auth/authSlice';
import authService from '../services/authService';
import clsx from 'clsx';

const Sidebar = () => {
    const dispatch = useDispatch();

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Sync', path: '/sync', icon: RefreshCw },
        { name: 'Problems', path: '/problems', icon: Code2 },
        { name: 'Analytics', path: '/analytics', icon: BarChart3 },
        { name: 'Settings', path: '/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        try {
            await authService.logout();
        } finally {
            dispatch(logout());
        }
    };

    return (
        <aside className="w-64 h-screen bg-surface border-r border-border hidden md:flex flex-col sticky top-0">
            <div className="h-16 flex items-center px-6 border-b border-border">
                <div className="flex items-center gap-2 text-primary">
                    <Code2 size={24} />
                    <span className="text-lg font-bold text-textMain tracking-tight">PrepForge <span className="text-primary font-mono text-sm">PRO</span></span>
                </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                <div className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-4 px-2">Menu</div>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={({ isActive }) => clsx(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isActive 
                                    ? "bg-primary/10 text-primary" 
                                    : "text-textMuted hover:bg-surfaceHover hover:text-textMain"
                            )}
                        >
                            <Icon size={18} />
                            {item.name}
                        </NavLink>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-border">
                <button 
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-textMuted hover:bg-surfaceHover hover:text-danger transition-colors"
                >
                    <LogOut size={18} />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
