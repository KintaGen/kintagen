// components/profile/DataShareRequests.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  useNostr,
  NOSTR_APP_TAG,
  NOSTR_SHARE_DATA_OP_TAG, // Tag for incoming requests from others to us
  NOSTR_SHARING_DATA_OP_TAG // Tag for outgoing shares from us to others
} from '../../contexts/NostrContext';
import { EnvelopeIcon, ExclamationCircleIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { useSecureLog } from '../../hooks/useSecureLog';

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
    encryptedMessages,
    pool,
    RELAYS
  } = useNostr();
  const { shareSecureData } = useSecureLog(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processedRequests, setProcessedRequests] = useState<DecryptedDM[]>([]);
  const [sharingRequestId, setSharingRequestId] = useState<string | null>(null);
  // This set will store strings like "cidValue|recipientPubkey" for quick lookup
  const [alreadySharedCIDs, setAlreadySharedCIDs] = useState<Set<string>>(new Set());

  useEffect(() => {
     subscribeToDMs(NOSTR_SHARE_DATA_OP_TAG);
  }, [subscribeToDMs]);


  useEffect(() => {
    if (!currentUserPubkey) {
      setProcessedRequests([]);
      setLoading(false);
      setError("Please log in to Nostr to view data share requests.");
      return;
    }

    // Process all encrypted messages to find both incoming requests AND our outgoing shares
    const processAllMessages = async () => {
      const newIncomingRequests: DecryptedDM[] = [];
      const newAlreadySharedCIDs = new Set<string>(); // Temporarily store new shared CIDs found

      const existingRequestIds = new Set(processedRequests.map(req => req.id));
      const existingSharedCIDs = new Set(alreadySharedCIDs); // Take a snapshot of current state

      for (const event of encryptedMessages) {
        const hasAppTag = event.tags.some(tag => tag[0] === 'A' && tag[1] === NOSTR_APP_TAG);
        const dataCidTag = event.tags.find(tag => tag[0] === 'C');
        const dataCid = dataCidTag ? dataCidTag[1] : null;
        // 1. Process outgoing shares by us
        const eventShare = await pool.get(
          RELAYS,
          {
            kinds: [4],
            authors: [currentUserPubkey],
            '#I': [dataCid as string],
            '#O': [NOSTR_SHARING_DATA_OP_TAG]
          },
        )
        console.log(eventShare)
        if (eventShare) {
          const recipientTag = eventShare.tags.find(tag => tag[0] === 'p'); // Recipient of the DM
          const recipientPubkey = recipientTag ? recipientTag[1] : null;

          if (recipientPubkey) {
            const key = `${dataCid}|${recipientPubkey}`;
            if (!existingSharedCIDs.has(key)) {
                newAlreadySharedCIDs.add(key);
            }
          }
        }

        // 2. Process incoming share requests to us
        const isIncomingRequest = event.pubkey !== currentUserPubkey && // Someone else sent it to us
                                  event.tags.some(tag => tag[0] === 'O' && tag[1] === NOSTR_SHARE_DATA_OP_TAG);
        if (isIncomingRequest && !existingRequestIds.has(event.id)) {
          let decryptedMessage: string | null = null;
          let decryptionError: string | undefined;

          try {
            decryptedMessage = await decryptDM(event);
          } catch (e: any) {
            console.error("Failed to decrypt incoming DM:", e);
            decryptionError = e.message || "Failed to decrypt message.";
          }

          const senderProfile = getProfileForMessage(event.pubkey);

          newIncomingRequests.push({
            id: event.id,
            senderPubkey: event.pubkey,
            recipientPubkey: currentUserPubkey, // We are the recipient of this request
            message: decryptedMessage || event.content,
            dataCid: dataCid,
            timestamp: event.created_at,
            decryptionError: decryptionError,
            senderProfile: senderProfile || undefined,
          });
        }
      }

      // Update processed requests
      if (newIncomingRequests.length > 0) {
        setProcessedRequests(prev => {
          const combined = [...prev, ...newIncomingRequests];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique.sort((a, b) => b.timestamp - a.timestamp);
        });
      }

      // Update already shared CIDs set
      if (newAlreadySharedCIDs.size > 0) {
        setAlreadySharedCIDs(prev => new Set([...Array.from(prev), ...Array.from(newAlreadySharedCIDs)]));
      }

      setLoading(false);
    };

    // Trigger processing
    if (encryptedMessages.length > 0 || !loading) {
      processAllMessages();
    } else if (encryptedMessages.length === 0 && loading) {
        // If no messages at all and still loading, rely on timeout below
    }

    // Timeout for initial empty state
    const loadingTimeout = setTimeout(() => {
      if (loading && encryptedMessages.length === 0) {
        setLoading(false);
      }
    }, 3000); // 3 seconds timeout

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, [encryptedMessages, currentUserPubkey, decryptDM, getProfileForMessage, alreadySharedCIDs]);


  const handleAcceptRequest = useCallback(async (request: DecryptedDM) => {
    if (!request.dataCid) {
      console.error("Cannot share: No data CID found in the request.");
      return;
    }

    setSharingRequestId(request.id);

    try {
      console.log(`Sharing data with ${request.senderPubkey}...`);
      const { sharedCid, dmEventId } = await shareSecureData(
        request.dataCid,
        request.senderPubkey,
        `kintagen-shared-data-${request.id.substring(0, 6)}.enc`
      );

      // Manually add to alreadySharedCIDs so the UI updates immediately
      setAlreadySharedCIDs(prev => new Set(prev).add(`${request.dataCid}|${request.senderPubkey}`));

      console.log("Data shared successfully! New CID:", sharedCid, "DM Event ID:", dmEventId);

    } catch (err: any) {
      console.error("Failed to share data:", err);
    } finally {
      setSharingRequestId(null);
    }
  }, [shareSecureData]);

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
          const currentSenderProfile = getProfileForMessage(request.senderPubkey);
          const isCurrentlySharing = sharingRequestId === request.id;
          const hasThisDataBeenShared = request.dataCid ? alreadySharedCIDs.has(`${request.dataCid}|${request.senderPubkey}`) : false;
          const isDisabled = !request.dataCid || isCurrentlySharing || hasThisDataBeenShared;

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
                <button
                  className={`flex items-center gap-1 px-4 py-2 text-sm rounded-md transition-colors
                    ${hasThisDataBeenShared
                      ? 'bg-green-800 text-white cursor-not-allowed' // Already shared style
                      : isCurrentlySharing
                        ? 'bg-blue-700 text-white cursor-not-allowed' // Sharing in progress style
                        : 'bg-green-700 hover:bg-green-600 text-white' // Accept button style
                    }`}
                  onClick={() => handleAcceptRequest(request)}
                  disabled={isDisabled}
                  title={!request.dataCid ? "No data CID to share" : hasThisDataBeenShared ? "Data already shared" : isCurrentlySharing ? "Sharing in progress..." : "Accept this request"}
                >
                  {isCurrentlySharing ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : hasThisDataBeenShared ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <CheckCircleIcon className="h-4 w-4" />
                  )}
                  {isCurrentlySharing ? 'Sharing...' : hasThisDataBeenShared ? 'Shared' : 'Accept'}
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