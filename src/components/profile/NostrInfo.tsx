import React, { useState, useMemo } from 'react';
import * as nip19 from 'nostr-tools/nip19';
import { 
    QuestionMarkCircleIcon, 
    EyeIcon, 
    EyeSlashIcon, 
    ClipboardDocumentIcon, 
    CheckIcon,
    ArrowTopRightOnSquareIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';

interface NostrInfoProps {
    pubkey: string;          // Hex Public Key
    privKey: Uint8Array;     // Raw Private Key
}

const NostrInfo: React.FC<NostrInfoProps> = ({ pubkey, privKey }) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // 1. Encode Keys to standard Nostr formats (npub / nsec)
    const { npub, nsec } = useMemo(() => {
        try {
            return {
                npub: nip19.npubEncode(pubkey),
                nsec: nip19.nsecEncode(privKey)
            };
        } catch (e) {
            return { npub: '', nsec: '' };
        }
    }, [pubkey, privKey]);

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <div className="mt-8 border-t border-gray-700 pt-8">
            {/* --- EDUCATIONAL HEADER --- */}
            <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-6 mb-6">
                <div className="flex items-start gap-4">
                    <div className="bg-blue-900 p-2 rounded-full hidden md:block">
                        <QuestionMarkCircleIcon className="h-6 w-6 text-blue-300" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">Powered by Nostr Protocol</h3>
                        <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                            Your profile isn't stored on our servers. It lives on the <strong>Nostr</strong> network—a censorship-resistant, open protocol. 
                            This means you own your data, and you can use this same identity on hundreds of other apps.
                        </p>
                        <a 
                            href="https://nostr.com/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-semibold text-blue-400 hover:text-blue-300"
                        >
                            Learn more about Nostr <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
                        </a>
                    </div>
                </div>
            </div>

            {/* --- SIMPLE VIEW: VIEW EXTERNAL --- */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                <p className="text-gray-400 text-sm">
                    Want to see how your profile looks to the rest of the world?
                </p>
                <a 
                    href={`https://snort.social/p/${npub}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors text-sm"
                >
                    View on Snort.social <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
            </div>

            {/* --- ADVANCED TOGGLE --- */}
            <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-gray-500 text-sm hover:text-gray-300 underline mb-4"
            >
                {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options & Private Keys"}
            </button>

            {/* --- ADVANCED SECTION --- */}
            {showAdvanced && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 animate-fade-in-down">
                    <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                        <ShieldCheckIcon className="h-5 w-5 text-green-400"/>
                        Your Identity Keys
                    </h4>

                    {/* PUBLIC KEY */}
                    <div className="mb-6">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Public ID (npub)
                        </label>
                        <div className="flex gap-2">
                            <code className="flex-1 bg-gray-900 p-3 rounded text-green-400 font-mono text-sm truncate border border-gray-700">
                                {npub}
                            </code>
                            <button 
                                onClick={() => handleCopy(npub, 'npub')}
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                                title="Copy Public Key"
                            >
                                {copiedField === 'npub' ? <CheckIcon className="h-5 w-5" /> : <ClipboardDocumentIcon className="h-5 w-5" />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Share this with others so they can follow you. It's like your username.
                        </p>
                    </div>

                    {/* PRIVATE KEY */}
                    <div className="border-t border-gray-700 pt-6">
                        <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                            Private Key (nsec) - DO NOT SHARE
                        </label>
                        
                        <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-lg mb-4">
                            <p className="text-red-300 text-xs mb-3">
                                <strong>Warning:</strong> This key controls your account. If you lose it, you lose access. 
                                If you share it, others can impersonate you. 
                                You can use this key to log in to other Nostr clients (like Damus, Snort, or Primal).
                            </p>
                            
                            <div className="flex gap-2 items-center">
                                <div className="flex-1 bg-gray-900 p-3 rounded font-mono text-sm truncate border border-gray-700 relative">
                                    <span className={showSecret ? "text-yellow-400" : "text-gray-500 blur-sm select-none"}>
                                        {showSecret ? nsec : "nsec1..................................................."}
                                    </span>
                                </div>
                                
                                <button 
                                    onClick={() => setShowSecret(!showSecret)}
                                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                                    title={showSecret ? "Hide" : "Show"}
                                >
                                    {showSecret ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                </button>
                                
                                <button 
                                    onClick={() => handleCopy(nsec, 'nsec')}
                                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                                    title="Copy Private Key"
                                    disabled={!showSecret}
                                >
                                    {copiedField === 'nsec' ? <CheckIcon className="h-5 w-5" /> : <ClipboardDocumentIcon className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NostrInfo;