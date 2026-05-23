import React from 'react';
import { Database } from 'lucide-react';

const EmptyState = ({ title, description, action }) => {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-xl bg-surface/50">
            <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mb-6 border border-border">
                <Database size={28} className="text-textMuted" />
            </div>
            <h3 className="text-lg font-bold text-textMain mb-2">{title}</h3>
            <p className="text-sm text-textMuted max-w-sm mb-6">{description}</p>
            {action && (
                <div>{action}</div>
            )}
        </div>
    );
};

export default EmptyState;
