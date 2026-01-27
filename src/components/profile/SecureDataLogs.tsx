// src/components/profile/SecureDataLogs.tsx
import React, { useEffect, useState } from 'react';
import { useNostr } from '../../contexts/NostrContext';
import { useSecureLog, type SecureDataMeta } from '../../hooks/useSecureLog'; // Import SecureDataMeta
import { ArrowPathIcon, DocumentTextIcon, LinkIcon, FolderOpenIcon } from '@heroicons/react/24/outline'; // Outline icons for a softer look

interface SecureDataLogsProps {
    // Add any props if needed, e.g., to filter data
}

const SecureDataLogs: React.FC<SecureDataLogsProps> = () => {
    const { pubkey } = useNostr();
    const { getAllSecureDataForPubkey } = useSecureLog(false); // Pass false as we're not uploading here

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [secureLogs, setSecureLogs] = useState<SecureDataMeta[]>([]);

    const fetchSecureLogs = async () => {
        if (!pubkey) {
            setError("Nostr public key not available. Cannot fetch secure data logs.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await getAllSecureDataForPubkey(pubkey);
            setSecureLogs(data);
        } catch (err) {
            console.error("Error fetching secure data logs:", err);
            setError("Failed to fetch secure data logs. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSecureLogs();
    }, [pubkey]); // Re-fetch if pubkey changes

    if (!pubkey) {
        return (
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center text-gray-400 border border-gray-700">
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                <p className="text-lg font-semibold mb-2">Nostr Identity Required</p>
                <p>Please connect your Nostr identity to view your secure data logs.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-48 bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-purple-400 mr-3" />
                <p className="text-lg text-gray-300">Loading secure data logs...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/30 border border-red-700 p-6 rounded-lg shadow-lg text-center text-red-300">
                <p className="text-lg font-semibold mb-2">Error</p>
                <p>{error}</p>
                <button
                    onClick={fetchSecureLogs}
                    className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-md text-white flex items-center mx-auto"
                >
                    <ArrowPathIcon className="h-5 w-5 mr-2" /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FolderOpenIcon className="h-7 w-7 text-purple-400" /> My Secure Data Logs
            </h2>

            {secureLogs.length === 0 ? (
                <div className="text-center p-8 bg-gray-900 rounded-md border border-gray-700">
                    <DocumentTextIcon className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                    <p className="text-lg text-gray-400 font-medium mb-2">No Secure Data Uploaded Yet</p>
                    <p className="text-gray-500">
                        Once you process data with secure logging enabled, it will appear here.
                    </p>
                </div>
            ) : (
                <ul className="space-y-4">
                    {secureLogs.map((log, index) => (
                        <li key={log.inputHash || index} className="bg-gray-900 p-4 rounded-md border border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex-1">
                                <p className="text-lg font-semibold text-white truncate">
                                    {log.project || 'Unknown Project'} - {log.type?.toUpperCase() || 'DATA'}
                                </p>
                                <p className="text-sm text-gray-400 font-mono break-all mt-1">
                                    Input Hash: {log.inputHash?.substring(0, 12)}...
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Uploaded on: {new Date(log.timestamp || '').toLocaleString()}
                                </p>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2 mt-2 sm:mt-0">
                                {log.ipfs_cid && (
                                    <a
                                        href={`https://dweb.link/ipfs/${log.ipfs_cid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-3 py-1.5 border border-purple-500 text-purple-300 text-sm font-medium rounded-md hover:bg-purple-900 hover:text-white transition-colors"
                                        title="View Encrypted Data on IPFS"
                                    >
                                        <LinkIcon className="h-4 w-4 mr-2" /> IPFS
                                    </a>
                                )}
                                {log.nft_id && (
                                    <span className="inline-flex items-center px-3 py-1.5 text-gray-300 text-sm font-medium rounded-md bg-gray-700/50">
                                        NFT: {log.nft_id}
                                    </span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-sm text-gray-600 mt-8 text-center">
                Note: The data displayed here is metadata. The actual content is encrypted and stored on IPFS.
            </p>
        </div>
    );
};

export default SecureDataLogs;