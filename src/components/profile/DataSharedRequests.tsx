// components/profile/DataSharedRequests.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  useNostr,
  NOSTR_APP_TAG,
  NOSTR_SHARING_DATA_OP_TAG // Correct tag for received shares
} from '../../contexts/NostrContext';
import { EnvelopeIcon, ExclamationCircleIcon, DocumentIcon } from '@heroicons/react/24/outline';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon // Icon for download
} from '@heroicons/react/24/solid';
import { useSecureLog } from '../../hooks/useSecureLog'; // Import useSecureLog

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

const DataSharedRequests: React.FC = () => {
  const {
    pubkey: currentUserPubkey,
    decryptDM,
    subscribeToDMs,
    getProfileForMessage,
    encryptedMessages
  } = useNostr();

  // Get the new decryptAndDownloadSharedData function from the hook
  const { decryptAndDownloadSharedData } = useSecureLog(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processedRequests, setProcessedRequests] = useState<DecryptedDM[]>([]);
  // State to track which request is currently being decrypted/downloaded
  const [downloadingRequestId, setDownloadingRequestId] = useState<string | null>(null);
  // State to track successfully downloaded requests (optional, for visual feedback)
  const [successfullyDownloaded, setSuccessfullyDownloaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Subscribe to DMs relevant to sharing operations
    subscribeToDMs(NOSTR_SHARING_DATA_OP_TAG);
  }, [subscribeToDMs]);

  useEffect(() => {
    if (!currentUserPubkey) {
      setProcessedRequests([]);
      setLoading(false);
      setError("Please log in to Nostr to view received data shares.");
      return;
    }

    if (encryptedMessages.length > 0) {
      setLoading(true);
      setError(null);
    } else if (!loading && encryptedMessages.length === 0) {
      return;
    }

    const processMessages = async () => {
      const newProcessed: DecryptedDM[] = [];
      const existingRequestIds = new Set(processedRequests.map(req => req.id));

      for (const event of encryptedMessages) {
        if (existingRequestIds.has(event.id)) {
          continue;
        }

        const hasAppTag = event.tags.some(tag => tag[0] === 'A' && tag[1] === NOSTR_APP_TAG);
        const hasOpTag = event.tags.some(tag => tag[0] === 'O' && tag[1] === NOSTR_SHARING_DATA_OP_TAG);

        // Crucially, for *received* data shares, the event's pubkey should be the SENDER,
        // and it should be a data sharing operation.
        // If event.pubkey === currentUserPubkey, it means *we* sent it, which might be a 'share request'
        // but here we are looking for data shared *to* us.
        // The `useNostr` context should ensure `encryptedMessages` are DMs where we are the recipient
        // or messages from us where we are also a recipient.
        // We're specifically looking for DMs *from* someone else *to* us, with the sharing tag.
        if (event.pubkey === currentUserPubkey || !hasAppTag || !hasOpTag) {
          continue;
        }

        const dataCidTag = event.tags.find(tag => tag[0] === 'C');
        const dataCid = dataCidTag ? dataCidTag[1] : null;

        let decryptedMessage: string | null = null;
        let decryptionError: string | undefined;

        try {
          decryptedMessage = await decryptDM(event);
        } catch (e: any) {
          console.error("Failed to decrypt incoming data share DM:", e);
          decryptionError = e.message || "Failed to decrypt message.";
        }

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

      if (newProcessed.length > 0) {
        setProcessedRequests(prev => {
          const combined = [...prev, ...newProcessed];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique.sort((a, b) => b.timestamp - a.timestamp);
        });
      }

      setLoading(false);
    };

    const loadingTimeout = setTimeout(() => {
      if (loading && encryptedMessages.length === 0) {
        setLoading(false);
      }
    }, 3000);

    processMessages();

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, [encryptedMessages, currentUserPubkey, decryptDM, getProfileForMessage]);

  const handleDecryptAndDownload = useCallback(async (request: DecryptedDM) => {
    if (!request.dataCid) {
      console.error("Cannot decrypt: No data CID found in the shared data request.");
      return;
    }

    setDownloadingRequestId(request.id); // Indicate that this request is being processed

    try {
      // Determine a more descriptive filename if possible, or use a generic one
      const filename = request.senderProfile?.name
        ? `${request.senderProfile.name}_shared_data_${request.dataCid.substring(0, 6)}.bin`
        : `shared_data_from_${request.senderPubkey.substring(0, 6)}_${request.dataCid.substring(0, 6)}.bin`;

      await decryptAndDownloadSharedData(request.dataCid, request.senderPubkey, filename);
      setSuccessfullyDownloaded(prev => new Set(prev).add(request.id));
      console.log(`Data from ${request.senderPubkey} with CID ${request.dataCid} decrypted and downloaded.`);
    } catch (err: any) {
      console.error("Failed to decrypt and download data:", err);
      alert(`Failed to decrypt and download data: ${err.message || 'Unknown error'}`);
      // Optionally handle specific error states for the button here
    } finally {
      setDownloadingRequestId(null); // Clear the processing indicator
    }
  }, [decryptAndDownloadSharedData]);

  const defaultProfilePicture = "https://via.placeholder.com/40/4B5563/D1D5DB?text=👤";

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <h3 className="text-xl font-bold mb-4 text-gray-200 flex items-center gap-2">
        <EnvelopeIcon className="h-6 w-6 text-purple-400" /> Received Data Shares
      </h3>

      {loading && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />
          Loading received data shares...
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
          No secure data has been shared with you yet.
        </div>
      )}

      <div className="space-y-4">
        {processedRequests.map((request) => {
          const currentSenderProfile = getProfileForMessage(request.senderPubkey);
          const isCurrentlyDownloading = downloadingRequestId === request.id;
          const hasBeenSuccessfullyDownloaded = successfullyDownloaded.has(request.id);
          const isDisabled = !request.dataCid || isCurrentlyDownloading || hasBeenSuccessfullyDownloaded;

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
                  <span className="font-medium">Data CID:</span>
                  <span className="font-mono break-all">{request.dataCid}</span>
                </div>
              )}

              {request.decryptionError && (
                <p className="text-red-400 text-xs mt-2 italic">
                  Decryption Error: {request.decryptionError} (Showing encrypted DM content)
                </p>
              )}

              <div className="flex justify-end gap-3 mt-4 border-t border-gray-700 pt-3">
                <button
                  className={`flex items-center gap-1 px-4 py-2 text-sm rounded-md transition-colors
                    ${hasBeenSuccessfullyDownloaded
                      ? 'bg-green-800 text-white cursor-not-allowed'
                      : isCurrentlyDownloading
                        ? 'bg-blue-700 text-white cursor-not-allowed'
                        : 'bg-purple-700 hover:bg-purple-600 text-white'
                    }`}
                  onClick={() => handleDecryptAndDownload(request)}
                  disabled={isDisabled}
                  title={!request.dataCid ? "No data CID to decrypt" : hasBeenSuccessfullyDownloaded ? "Data already downloaded" : isCurrentlyDownloading ? "Downloading..." : "Decrypt and Download"}
                >
                  {isCurrentlyDownloading ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : hasBeenSuccessfullyDownloaded ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  )}
                  {isCurrentlyDownloading ? 'Downloading...' : hasBeenSuccessfullyDownloaded ? 'Downloaded' : 'Decrypt & Download'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DataSharedRequests;