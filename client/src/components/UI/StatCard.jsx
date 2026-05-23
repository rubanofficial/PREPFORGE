import React from 'react';

const StatCard = ({ title, value, icon: Icon, trend, colorClass = "text-primary" }) => {
    return (
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col hover:border-textMuted transition-colors group">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-textMuted group-hover:text-textMain transition-colors">{title}</h3>
                {Icon && <Icon size={18} className={colorClass} />}
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-textMain tracking-tight">{value}</span>
                {trend && (
                    <span className={`text-xs font-medium ${trend > 0 ? 'text-success' : 'text-danger'}`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
        </div>
    );
};

export default StatCard;
