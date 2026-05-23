import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ text = "Loading..." }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-12 text-textMuted">
            <Loader2 size={32} className="animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">{text}</p>
        </div>
    );
};

export default LoadingSpinner;
