import React, { useState, useMemo } from 'react';
import * as nip19 from 'nostr-tools/nip19';
import { 
    QuestionMarkCircleIcon, 
    EyeIcon, 
    EyeSlashIcon, 
    ClipboardDocumentIcon, 
    CheckIcon,
    ArrowTopRightOnSquareIcon,
    ShieldCheckIcon,
    PuzzlePieceIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';

interface NostrInfoProps {
    pubkey: string;          // Hex Public Key
    privKey: Uint8Array;     // Raw Private Key
}

const NostrEphemeralKeyInfo: React.FC<NostrInfoProps> = ({ pubkey, privKey }) => {
    const [showSecret, setShowSecret] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // 1. Encode Keys to standard Nostr formats (npub / nsec)
    const { npub, nsec } = useMemo(() => {
        try {
            // Ensure privKey is a Uint8Array before encoding
            const privateKeyToEncode = typeof privKey === 'string' 
                ? Uint8Array.from(Buffer.from(privKey, 'hex')) 
                : privKey;

            return {
                npub: nip19.npubEncode(pubkey),
                nsec: nip19.nsecEncode(privateKeyToEncode)
            };
        } catch (e) {
            console.error("Error encoding Nostr keys:", e);
            return { npub: 'Error encoding public key', nsec: 'Error encoding private key' };
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
                        <InformationCircleIcon className="h-6 w-6 text-blue-300" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">Your Ephemeral Nostr Identity is Ready!</h3>
                        <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                            We've just generated a temporary Nostr identity for you. This key pair is unique to you and allows you to participate in the Nostr network right away! 
                            While it's "ephemeral" for this session, you can actually keep and reuse it across many other Nostr apps.
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

            {/* --- VIEW EXTERNAL --- */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                <p className="text-gray-400 text-sm">
                    Your generated identity is live on Nostr! See your public profile:
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

            {/* --- KEY DETAILS SECTION --- */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                    <ShieldCheckIcon className="h-5 w-5 text-green-400"/>
                    Your Nostr Keys
                </h4>

                {/* PUBLIC KEY */}
                <div className="mb-6">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Public ID (npub)
                    </label>
                    <div className="flex gap-2">
                        <code className="flex-1 bg-gray-900 p-3 rounded text-green-400 font-mono text-sm break-all border border-gray-700">
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
                        This is your public identity. Share it with others.
                    </p>
                </div>

                {/* PRIVATE KEY */}
                <div className="border-t border-gray-700 pt-6">
                    <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                        Private Key (nsec) - HANDLE WITH EXTREME CARE!
                    </label>
                    
                    <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-lg mb-4">
                        <p className="text-red-300 text-xs mb-3">
                            <strong>Warning:</strong> This key grants full control over this identity. 
                            Copy and save it securely if you wish to reuse this identity in other Nostr applications. 
                            <strong>Do not share it publicly.</strong>
                        </p>
                        
                        <div className="flex gap-2 items-center">
                            <div className="flex-1 bg-gray-900 p-3 rounded font-mono text-sm break-all border border-gray-700 relative">
                                <span className={showSecret ? "text-yellow-400" : "text-gray-500 blur-sm select-none"}>
                                    {showSecret ? nsec : "nsec1..................................................."}
                                </span>
                            </div>
                            
                            <button 
                                onClick={() => setShowSecret(!showSecret)}
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                                title={showSecret ? "Hide Private Key" : "Show Private Key"}
                            >
                                {showSecret ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                            
                            <button 
                                onClick={() => handleCopy(nsec, 'nsec')}
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                                title="Copy Private Key"
                                disabled={!showSecret} // Can only copy if shown
                            >
                                {copiedField === 'nsec' ? <CheckIcon className="h-5 w-5" /> : <ClipboardDocumentIcon className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- IMPORT INSTRUCTIONS --- */}
            <div className="mt-8 bg-purple-900/30 border border-purple-800 rounded-lg p-6">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                    <PuzzlePieceIcon className="h-5 w-5 text-purple-300"/>
                    Reuse Your Identity: Import into a Nostr Extension
                </h4>
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                    Want to use this exact Nostr identity on other apps like Damus, Snort, or Primal? 
                    Simply import your private key into a browser extension. We recommend:
                </p>
                <ul className="list-disc list-inside text-gray-300 text-sm space-y-2 mb-4">
                    <li>
                        <strong>Nos2x:</strong> A popular Nostr browser extension.
                        <a 
                            href="https://github.com/fiatjaf/nos2x" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center text-blue-400 hover:text-blue-300 ml-2"
                        >
                            Install Nos2x <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
                        </a>
                    </li>
                    <li>
                        <strong>Alby:</strong> Another great option that also integrates with Bitcoin Lightning.
                        <a 
                            href="https://getalby.com/" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center text-blue-400 hover:text-blue-300 ml-2"
                        >
                            Install Alby <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
                        </a>
                    </li>
                </ul>
                <p className="text-gray-300 text-sm leading-relaxed">
                    <strong>How to Import:</strong>
                    <ol className="list-decimal list-inside ml-4 mt-2 space-y-1">
                        <li>Install either Nos2x or Alby from their respective links above.</li>
                        <li>Open the extension and look for an "Import Key" or "Add Account" option.</li>
                        <li>Paste your <strong>Private Key (nsec)</strong>, which you can copy from above, into the extension.</li>
                        <li>You're all set! You can now use this identity on any Nostr website that integrates with the extension.</li>
                    </ol>
                </p>
            </div>
        </div>
    );
};

export default NostrEphemeralKeyInfo;