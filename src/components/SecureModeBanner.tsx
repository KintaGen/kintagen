import React from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';

interface Props {
    visible: boolean;
    checked: boolean;
    onChange: (checked: boolean) => void;
    hasIdentity: boolean;
    label?: string;
}

export const SecureModeBanner: React.FC<Props> = ({ 
    visible, checked, onChange, hasIdentity, 
    label = "Secure Mode: Encrypt raw data and link to your Nostr App Profile." 
}) => {
    if (!visible) return null;

    return (
        <div className="mb-4 flex items-center gap-3 bg-blue-900/20 border border-blue-800 p-3 rounded-lg animate-fade-in-up">
            <ShieldCheckIcon className={`h-5 w-5 ${hasIdentity ? 'text-green-400' : 'text-gray-400'}`} />
            <div className="flex-1">
                <p className="text-sm text-gray-200">
                    <strong>{label}</strong>
                    {!hasIdentity && <span className="text-xs text-blue-300 block"> (Will prompt for signature)</span>}
                </p>
            </div>
            <div className="flex items-center">
                <input 
                    type="checkbox" 
                    checked={checked} 
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
            </div>
        </div>
    );
};