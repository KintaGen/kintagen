// components/profile/DataRequestedStatus.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  useNostr,
  NOSTR_APP_TAG,
  NOSTR_SHARE_DATA_OP_TAG, // Tag for outgoing requests from us to others
  NOSTR_SHARING_DATA_OP_TAG, // Tag for incoming shares from others to us
  type NostrProfile
} from '../../contexts/NostrContext';
import {
  PaperAirplaneIcon, // Icon for sent requests
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  ExclamationCircleIcon,
  CubeTransparentIcon
} from '@heroicons/react/24/outline';
import { useSecureLog } from '../../hooks/useSecureLog';

interface RequestedDataItem {
  id: string; // Event ID of our original request DM
  recipientPubkey: string; // The person we requested data from
  requestedCid: string; // The original CID we requested
  message: string; // Our request message
  timestamp: number;
  recipientProfile?: NostrProfile;
  // Status of the request
  hasBeenShared: boolean;
  sharedDmEventId?: string; // Event ID of the DM where data was shared *to us*
  sharedCid?: string; // The CID of the re-encrypted data we received
  sharedTimestamp?: number;
  decryptionError?: string; // If the shared DM couldn't be decrypted
  downloading: boolean; // State for download button
  downloadError: string | null; // Error during download
}

const DataRequestedStatus: React.FC = () => {
  const {
    pubkey: currentUserPubkey,
    decryptDM,
    subscribeToDMs,
    getProfileForMessage,
    encryptedMessages, // All DMs involving us
    pool,
    RELAYS
  } = useNostr();
  const { decryptAndDownloadSharedData } = useSecureLog(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestedDataItems, setRequestedDataItems] = useState<RequestedDataItem[]>([]);

  useEffect(() => {
    if (!currentUserPubkey) {
      setRequestedDataItems([]);
      setLoading(false);
      setError("Please log in to Nostr to view your data access requests.");
      return;
    }

    // Subscribe to all DMs involving the current user.
    // We need both outgoing requests (kind 4 from us) and incoming shares (kind 4 to us).
    // The `encryptedMessages` array in `useNostr` should already contain all DMs we're involved in.
    // If it only filters for specific tags, we might need a broader subscription here.
    // Assuming `encryptedMessages` gives us all DMs.
    subscribeToDMs(NOSTR_SHARING_DATA_OP_TAG); // Subscribe to all DMs if it's not already doing so broadly
  }, [currentUserPubkey, subscribeToDMs]);


  useEffect(() => {
    if (!currentUserPubkey) {
      return;
    }

    const processAllDMs = async () => {
      setLoading(true);
      const newRequestedItems: RequestedDataItem[] = [];
      const existingRequestedIds = new Set(requestedDataItems.map(item => item.id));

      // Map to quickly look up incoming shares by original CID and sender
      const incomingSharesMap = new Map<string, { event: any; decryptedMessage: string | null; decryptionError?: string; sharedCid: string; originalCid: string | null; }>();

      // First, identify all incoming data shares *to us*
      for (const event of encryptedMessages) {
        if (event.pubkey === currentUserPubkey) continue; // Skip messages from us

        const hasSharingOpTag = event.tags.some(tag => tag[0] === 'O' && tag[1] === NOSTR_SHARING_DATA_OP_TAG);
        const sharedCidTag = event.tags.find(tag => tag[0] === 'C');
        const originalCidTag = event.tags.find(tag => tag[0] === 'I'); // This is the CID *we requested*

        if (event.kind === 4 && hasSharingOpTag && sharedCidTag && originalCidTag) {
          let decryptedMessage: string | null = null;
          let decryptionError: string | undefined;
          try {
            decryptedMessage = await decryptDM(event);
          } catch (e: any) {
            console.error("Failed to decrypt incoming shared data DM:", e);
            decryptionError = e.message || "Failed to decrypt message.";
          }
          const key = `${originalCidTag[1]}|${event.pubkey}`; // Use original CID + sender pubkey as key
          incomingSharesMap.set(key, {
            event,
            decryptedMessage,
            decryptionError,
            sharedCid: sharedCidTag[1],
            originalCid: originalCidTag[1]
          });
        }
      }

      // Then, identify all outgoing data requests *from us*
      for (const event of encryptedMessages) {
        if (event.pubkey !== currentUserPubkey) continue; // Skip messages not from us

        const hasRequestOpTag = event.tags.some(tag => tag[0] === 'O' && tag[1] === NOSTR_SHARE_DATA_OP_TAG);
        const requestedCidTag = event.tags.find(tag => tag[0] === 'C'); // This is the CID we're asking for
        const recipientTag = event.tags.find(tag => tag[0] === 'p');

        if (event.kind === 4 && hasRequestOpTag && requestedCidTag && recipientTag && !existingRequestedIds.has(event.id)) {
          const recipientPubkey = recipientTag[1];
          const requestedCid = requestedCidTag[1];

          let decryptedMessage: string | null = null;
          let decryptionError: string | undefined;
          try {
            decryptedMessage = await decryptDM(event);
          } catch (e: any) {
            console.error("Failed to decrypt outgoing request DM (might not be needed):", e);
            // Decryption error for outgoing requests is less critical for display, but good to log
            decryptionError = e.message || "Failed to decrypt message.";
          }

          const recipientProfile = getProfileForMessage(recipientPubkey);
          const keyForShareLookup = `${requestedCid}|${recipientPubkey}`;
          const correspondingShare = incomingSharesMap.get(keyForShareLookup);

          newRequestedItems.push({
            id: event.id,
            recipientPubkey: recipientPubkey,
            requestedCid: requestedCid,
            message: decryptedMessage || event.content,
            timestamp: event.created_at,
            recipientProfile: recipientProfile || undefined,
            hasBeenShared: !!correspondingShare,
            sharedDmEventId: correspondingShare?.event.id,
            sharedCid: correspondingShare?.sharedCid,
            sharedTimestamp: correspondingShare?.event.created_at,
            decryptionError: correspondingShare?.decryptionError,
            downloading: false,
            downloadError: null
          });
        }
      }

      if (newRequestedItems.length > 0) {
        setRequestedDataItems(prev => {
          const combined = [...prev, ...newRequestedItems];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique.sort((a, b) => b.timestamp - a.timestamp);
        });
      }
      setLoading(false);
    };

    if (encryptedMessages.length > 0 || !loading) {
      processAllDMs();
    } else if (encryptedMessages.length === 0 && loading) {
        // Fallback for initial empty state
    }

    const loadingTimeout = setTimeout(() => {
        if (loading && encryptedMessages.length === 0) {
            setLoading(false);
        }
    }, 3000);

    return () => {
        clearTimeout(loadingTimeout);
    };
  }, [encryptedMessages, currentUserPubkey, decryptDM, getProfileForMessage, requestedDataItems]);


  const handleDownloadSharedData = useCallback(async (item: RequestedDataItem) => {
    if (!item.sharedCid || !item.hasBeenShared) {
      console.error("Cannot download: Data has not been shared or CID is missing.");
      return;
    }

    setRequestedDataItems(prev => prev.map(data =>
      data.id === item.id ? { ...data, downloading: true, downloadError: null } : data
    ));

    try {
      // The `recipientPubkey` here is the `senderPubkey` for the `decryptAndDownloadSharedData` function
      // because they are the one who sent *us* the re-encrypted data.
      await decryptAndDownloadSharedData(item.sharedCid, item.recipientPubkey, `requested_data_from_${item.recipientPubkey.slice(0, 6)}_${item.sharedCid.slice(0, 6)}.bin`);
      setRequestedDataItems(prev => prev.map(data =>
        data.id === item.id ? { ...data, downloading: false, downloadError: null } : data
      ));
    } catch (err: any) {
      console.error("Failed to download shared data:", err);
      setRequestedDataItems(prev => prev.map(data =>
        data.id === item.id ? { ...data, downloading: false, downloadError: err.message || "Failed to download." } : data
      ));
    }
  }, [decryptAndDownloadSharedData]);

  const defaultProfilePicture = "https://via.placeholder.com/40/4B5563/D1D5DB?text=👤";

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <h3 className="text-xl font-bold mb-4 text-gray-200 flex items-center gap-2">
        <PaperAirplaneIcon className="h-6 w-6 text-cyan-400" /> My Data Access Requests
      </h3>

      {loading && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />
          Loading your data access requests...
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 text-red-300 p-4 rounded-md flex items-center gap-2">
          <ExclamationCircleIcon className="h-5 w-5" />
          {error}
        </div>
      )}

      {!loading && !error && requestedDataItems.length === 0 && (
        <div className="text-center py-8 text-gray-500 italic">
          You haven't requested access to any secure data yet.
        </div>
      )}

      <div className="space-y-4">
        {requestedDataItems.map((item) => {
          const currentRecipientProfile = getProfileForMessage(item.recipientPubkey);
          const isCurrentlyDownloading = item.downloading; // State is now on the item itself

          return (
            <div key={item.id} className="bg-gray-900 p-4 rounded-md border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={currentRecipientProfile?.picture || defaultProfilePicture}
                  alt={currentRecipientProfile?.name || item.recipientPubkey}
                  className="h-10 w-10 rounded-full object-cover border border-cyan-500"
                  onError={(e) => { (e.target as HTMLImageElement).src = defaultProfilePicture; }}
                />
                <div>
                  <p className="font-semibold text-white">
                    {currentRecipientProfile?.name || "Unknown User"}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    Requested from: {item.recipientPubkey.slice(0, 8)}...{item.recipientPubkey.slice(-8)}
                  </p>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-3">
                <span className="font-medium text-gray-400">Your Request:</span> {item.message}
              </p>

              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <CubeTransparentIcon className="h-4 w-4" />
                <span className="font-medium">Original Data CID:</span>
                <span className="font-mono break-all">{item.requestedCid}</span>
              </div>

              {item.hasBeenShared ? (
                <>
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-2">
                    <CheckCircleIcon className="h-5 w-5" />
                    Access Granted!
                  </div>
                  {item.sharedCid && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                      <DocumentArrowDownIcon className="h-4 w-4" />
                      <span className="font-medium">Shared Data CID:</span>
                      <span className="font-mono break-all">{item.sharedCid}</span>
                    </div>
                  )}
                   {item.decryptionError && (
                    <p className="text-red-400 text-xs mt-2 italic">
                      Error receiving shared data: {item.decryptionError}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-2">
                  <ArrowPathIcon className="h-5 w-5 animate-pulse" />
                  Pending Access...
                </div>
              )}

              {item.downloadError && (
                <p className="text-red-400 text-xs mt-2 italic">
                  Download Error: {item.downloadError}
                </p>
              )}

              <div className="flex justify-end gap-3 mt-4 border-t border-gray-700 pt-3">
                {item.hasBeenShared && item.sharedCid ? (
                  <button
                    className={`flex items-center gap-1 px-4 py-2 text-sm rounded-md transition-colors
                      ${isCurrentlyDownloading
                        ? 'bg-blue-700 text-white cursor-not-allowed'
                        : 'bg-indigo-700 hover:bg-indigo-600 text-white'
                      }`}
                    onClick={() => handleDownloadSharedData(item)}
                    disabled={isCurrentlyDownloading || !item.sharedCid}
                    title={!item.sharedCid ? "No shared CID available" : isCurrentlyDownloading ? "Downloading..." : "Download Shared Data"}
                  >
                    {isCurrentlyDownloading ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <DocumentArrowDownIcon className="h-4 w-4" />
                    )}
                    {isCurrentlyDownloading ? 'Downloading...' : 'Download'}
                  </button>
                ) : (
                  <button
                    className="flex items-center gap-1 px-4 py-2 text-sm rounded-md bg-gray-700 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    <DocumentArrowDownIcon className="h-4 w-4" />
                    Waiting for Access
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DataRequestedStatus;