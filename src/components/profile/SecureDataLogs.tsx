// src/components/profile/SecureDataLogs.tsx
import React, { useEffect, useState } from 'react';
import { useNostr } from '../../contexts/NostrContext';
import { useSecureLog, type SecureDataMeta } from '../../hooks/useSecureLog';
import {
    ArrowPathIcon,
    DocumentTextIcon,
    LinkIcon,
    FolderOpenIcon,
    ExclamationCircleIcon,
    BeakerIcon,
    CubeTransparentIcon,
    ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
    ld50: { label: 'LD50', color: 'bg-red-500/15 text-red-400 border-red-500/25' },
    nmr: { label: 'NMR', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    gcms: { label: 'GC-MS', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
};

const Skeleton = () => (
    <div className="space-y-3 animate-pulse">
        {[0, 1, 2].map((i) => (
            <div key={i} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-gray-700 flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                        <div className="h-3 w-36 bg-gray-700 rounded" />
                        <div className="h-2.5 w-24 bg-gray-700 rounded" />
                    </div>
                    <div className="h-6 w-14 bg-gray-700 rounded-full" />
                </div>
                <div className="h-2.5 w-full bg-gray-700 rounded mb-2" />
                <div className="h-2.5 w-2/3 bg-gray-700 rounded" />
            </div>
        ))}
    </div>
);

const SecureDataLogs: React.FC = () => {
    const { pubkey } = useNostr();
    const { getAllSecureDataForPubkey } = useSecureLog(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<SecureDataMeta[]>([]);

    const fetch = async () => {
        if (!pubkey) {
            setError('Nostr public key not available.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await getAllSecureDataForPubkey(pubkey);
            setLogs(data);
        } catch {
            setError('Failed to fetch secure data logs. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetch();
    }, [pubkey]);

    if (!pubkey) {
        return (
            <div className="flex flex-col items-center justify-center py-14 text-center">
                <DocumentTextIcon className="h-12 w-12 text-gray-700 mb-4" />
                <p className="text-gray-400 font-semibold text-sm">Nostr Identity Required</p>
                <p className="text-gray-600 text-xs mt-1">Connect your Nostr identity to view your secure data logs.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <FolderOpenIcon className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Secure Data Logs</h2>
                        <p className="text-xs text-gray-500">Encrypted datasets linked to your Nostr identity</p>
                    </div>
                </div>
                {!loading && (
                    <button
                        onClick={fetch}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        title="Refresh"
                    >
                        <ArrowPathIcon className="h-4 w-4" /> Refresh
                    </button>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 bg-red-900/30 text-red-300 border border-red-700/40 p-3 rounded-lg text-sm">
                    <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button
                        onClick={fetch}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-red-700/40 hover:bg-red-700/60 text-xs"
                    >
                        <ArrowPathIcon className="h-3 w-3" /> Retry
                    </button>
                </div>
            )}

            {/* Body */}
            {loading ? (
                <Skeleton />
            ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                    <CubeTransparentIcon className="h-12 w-12 text-gray-700 mb-4" />
                    <p className="text-gray-400 font-semibold text-sm">No Secure Data Uploaded Yet</p>
                    <p className="text-gray-600 text-xs mt-1 max-w-xs">
                        Process data with secure logging enabled and it will appear here, encrypted and linked to your identity.
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        {logs.map((log, idx) => {
                            const badge = log.type ? TYPE_BADGE[log.type.toLowerCase()] : undefined;
                            const ts = log.timestamp ? new Date(log.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

                            return (
                                <div
                                    key={log.inputHash || idx}
                                    className="group bg-gray-900/60 border border-gray-700/60 hover:border-indigo-500/30 rounded-xl p-4 transition-all duration-200"
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Icon */}
                                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex-shrink-0 mt-0.5">
                                            <BeakerIcon className="h-4 w-4 text-indigo-400" />
                                        </div>

                                        {/* Main info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="text-sm font-semibold text-white truncate">
                                                    {log.project || 'Unknown Project'}
                                                </p>
                                                {badge && (
                                                    <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                                                        {badge.label}
                                                    </span>
                                                )}
                                                <CheckCircleIcon className="h-4 w-4 text-emerald-400 ml-auto flex-shrink-0" title="Encrypted & stored" />
                                            </div>

                                            <p className="text-xs text-gray-600 mb-2">{ts}</p>

                                            {/* Input hash */}
                                            {log.inputHash && (
                                                <div className="bg-gray-800/80 rounded-lg px-2.5 py-1.5 mb-2 flex items-center gap-2">
                                                    <CubeTransparentIcon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                                    <p className="text-xs font-mono text-gray-500 truncate">
                                                        Hash: <span className="text-gray-400">{log.inputHash.slice(0, 20)}…</span>
                                                    </p>
                                                </div>
                                            )}

                                            {/* CID */}
                                            {log.ipfs_cid && (
                                                <div className="bg-gray-800/80 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                                                    <LinkIcon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                                    <p className="text-xs font-mono text-cyan-400 truncate flex-1">{log.ipfs_cid}</p>
                                                    <a
                                                        href={`https://dweb.link/ipfs/${log.ipfs_cid}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-shrink-0 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-indigo-400 transition-colors"
                                                        title="View on IPFS"
                                                    >
                                                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                                                    </a>
                                                </div>
                                            )}

                                            {/* NFT link */}
                                            {log.nft_id && (
                                                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
                                                    <LinkIcon className="h-3 w-3" />
                                                    NFT #{log.nft_id}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer note */}
                    <p className="text-center text-xs text-gray-700 pt-2">
                        Content is encrypted on IPFS — only metadata is shown here.
                    </p>
                </>
            )}
        </div>
    );
};

export default SecureDataLogs;