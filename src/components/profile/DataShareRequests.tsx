// components/profile/DataShareRequests.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  useNostr,
  type AppNostrEvent,
  NOSTR_APP_TAG,
  NOSTR_SHARE_DATA_OP_TAG
} from '../../contexts/NostrContext';
import { EnvelopeIcon, UserCircleIcon, ExclamationCircleIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface DecryptedDM {
  id: string;
  senderPubkey: string;
  recipientPubkey: string;
  message: string;
  dataCid: string | null;
  timestamp: number;
  decryptionError?: string;
  senderProfile?: {
    name?: string;
    picture?: string;
  };
}

const DataShareRequests: React.FC = () => {
  const {
    pubkey: currentUserPubkey,
    decryptDM,
    subscribeToDMs,
    getProfileForMessage,
    encryptedMessages // <--- Now consuming directly from context
  } = useNostr();
  console.log(encryptedMessages)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processedRequests, setProcessedRequests] = useState<DecryptedDM[]>([]);

  useEffect(() => {
    subscribeToDMs();
  },[]);
  // Effect to process the encryptedMessages from the context
  useEffect(() => {
    if (!currentUserPubkey) {
      setProcessedRequests([]);
      setLoading(false);
      setError("Please log in to Nostr to view data share requests.");
      return;
    }

    setLoading(true);
    setError(null);

    const processMessages = async () => {
      const newProcessed: DecryptedDM[] = [];
      for (const event of encryptedMessages) {
        // Ensure we only process relevant DMs if the context somehow provides others
        const hasAppTag = event.tags.some(tag => tag[0] === 'A' && tag[1] === NOSTR_APP_TAG);
        const hasOpTag = event.tags.some(tag => tag[0] === 'O' && tag[1] === NOSTR_SHARE_DATA_OP_TAG);

        if (!hasAppTag || !hasOpTag) {
          continue; // Skip irrelevant messages
        }

        // Avoid reprocessing already processed messages, though `encryptedMessages` should ideally not contain duplicates
        if (processedRequests.some(req => req.id === event.id)) {
            continue;
        }

        const dataCidTag = event.tags.find(tag => tag[0] === 'C');
        const dataCid = dataCidTag ? dataCidTag[1] : null;

        let decryptedMessage: string | null = null;
        let decryptionError: string | undefined;

        try {
          decryptedMessage = await decryptDM(event);
        } catch (e: any) {
          console.error("Failed to decrypt incoming DM:", e);
          decryptionError = e.message || "Failed to decrypt message.";
        }

        // getProfileForMessage will return what's in cache or undefined and trigger a fetch
        const senderProfile = getProfileForMessage(event.pubkey);

        newProcessed.push({
          id: event.id,
          senderPubkey: event.pubkey,
          recipientPubkey: currentUserPubkey,
          message: decryptedMessage || event.content,
          dataCid: dataCid,
          timestamp: event.created_at,
          decryptionError: decryptionError,
          senderProfile: senderProfile || undefined,
        });
      }

      setProcessedRequests(prev => {
        // Combine previous processed requests with new ones, filter duplicates, and sort
        const combined = [...prev, ...newProcessed];
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        return unique.sort((a, b) => b.timestamp - a.timestamp);
      });
      setLoading(false);
    };

    const timeoutId = setTimeout(() => {
        if (encryptedMessages.length === 0) { // If no messages after timeout, stop loading
            setLoading(false);
        }
    }, 3000); // 3 seconds timeout

    // Only process if encryptedMessages actually contains new events
    if (encryptedMessages.length > 0 || !loading) { // Run immediately if messages exist or if not loading (for the initial empty state)
        processMessages();
    } else if (encryptedMessages.length === 0 && loading) {
        // If no messages at all and still loading, rely on timeout
    }


    return () => {
        clearTimeout(timeoutId);
    };
  }, [encryptedMessages, currentUserPubkey, decryptDM, getProfileForMessage]); // Dependencies for processing messages

  const defaultProfilePicture = "https://via.placeholder.com/40/4B5563/D1D5DB?text=👤";

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <h3 className="text-xl font-bold mb-4 text-gray-200 flex items-center gap-2">
        <EnvelopeIcon className="h-6 w-6 text-purple-400" /> Data Share Requests
      </h3>

      {loading && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />
          Loading requests...
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 text-red-300 p-4 rounded-md flex items-center gap-2">
          <ExclamationCircleIcon className="h-5 w-5" />
          {error}
        </div>
      )}

      {!loading && !error && processedRequests.length === 0 && (
        <div className="text-center py-8 text-gray-500 italic">
          No new data sharing requests.
        </div>
      )}

      <div className="space-y-4">
        {processedRequests.map((request) => {
          // Dynamically get the latest profile from the cache on each render
          const currentSenderProfile = getProfileForMessage(request.senderPubkey);

          return (
            <div key={request.id} className="bg-gray-900 p-4 rounded-md border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={currentSenderProfile?.picture || defaultProfilePicture}
                  alt={currentSenderProfile?.name || request.senderPubkey}
                  className="h-10 w-10 rounded-full object-cover border border-purple-500"
                  onError={(e) => { (e.target as HTMLImageElement).src = defaultProfilePicture; }}
                />
                <div>
                  <p className="font-semibold text-white">
                    {currentSenderProfile?.name || "Unknown User"}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    From: {request.senderPubkey.slice(0, 8)}...{request.senderPubkey.slice(-8)}
                  </p>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-3">
                <span className="font-medium text-gray-400">Message:</span> {request.message}
              </p>

              {request.dataCid && (
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <DocumentIcon className="h-4 w-4" />
                  <span className="font-medium">Requested Data CID:</span>
                  <span className="font-mono break-all">{request.dataCid}</span>
                </div>
              )}

              {request.decryptionError && (
                <p className="text-red-400 text-xs mt-2 italic">
                  Decryption Error: {request.decryptionError} (Showing encrypted content)
                </p>
              )}

              <div className="flex justify-end gap-3 mt-4 border-t border-gray-700 pt-3">
                {/* These buttons are placeholders for future implementation */}
                <button
                  className="flex items-center gap-1 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded-md transition-colors"
                  title="Accept this request (Not yet implemented)"
                  disabled
                >
                  <CheckCircleIcon className="h-4 w-4" /> Accept
                </button>
                <button
                  className="flex items-center gap-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-md transition-colors"
                  title="Decline this request (Not yet implemented)"
                  disabled
                >
                  <XCircleIcon className="h-4 w-4" /> Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DataShareRequests;