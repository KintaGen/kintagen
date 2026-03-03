// components/SecureDataDisplay.tsx
import React, { useState, useEffect } from 'react';
import {
  LockClosedIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,     // For loading state
  ArrowDownTrayIcon, // For download button
  CheckCircleIcon,   // For downloaded state
  ExclamationCircleIcon // For error state
} from '@heroicons/react/24/outline';
import { useNostr, NOSTR_APP_TAG, NOSTR_SHARING_DATA_OP_TAG } from '../../contexts/NostrContext';
import { useSecureLog } from '../../hooks/useSecureLog'; // Import useSecureLog
import { useFlowCurrentUser } from '@onflow/react-sdk';

export interface SecureDataInfo {
  nostr_event_id: string; // The event ID of the original data event
  ipfs_cid: string;
  nostr_pubkey: string; // This is the owner's pubkey from your provided data structure
  encryption_algo: string;
  storage_type: string; // Added storage_type as it's in your example
  type?: 'ld50' | 'nmr' | 'gcms'; // Add type for better filename suggestion
  project?: string; // Add project for better filename suggestion
}

interface SecureDataDisplayProps {
  secureDataInfo: SecureDataInfo;
}

const SecureDataDisplay: React.FC<SecureDataDisplayProps> = ({ secureDataInfo }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [permissionRequested, setPermissionRequested] = useState<boolean>(false); // Our request for access
  const [requestStatus, setRequestStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New states for handling received shares and download
  const [hasReceivedShare, setHasReceivedShare] = useState<boolean>(false);
  const [receivedSharedCid, setReceivedSharedCid] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const {
    pubkey: currentUserPubkey,
    sendEncryptedDM,
    connectWithFlow,
    isLoading: isNostrConnecting,
    subscribeToDMs,
    pool,
    RELAYS,
    encryptedMessages // Use encryptedMessages from context
  } = useNostr();
  const { user: flowUser } = useFlowCurrentUser();

  // Use useSecureLog to get decryptAndDownloadSharedData
  const { decryptAndDownloadSharedData } = useSecureLog(false); // No input data here

  useEffect(() => {
    if (currentUserPubkey) {
      subscribeToDMs(NOSTR_SHARING_DATA_OP_TAG);
    }
  }, [currentUserPubkey, subscribeToDMs]);

  // Effect to check if data has been shared with us
  useEffect(() => {
    let cancelled = false;

    if (!currentUserPubkey) {
      setHasReceivedShare(false);
      setReceivedSharedCid(null);
      return () => {
        cancelled = true;
      };
    }

    if (!secureDataInfo.nostr_pubkey || !secureDataInfo.ipfs_cid) {
      setHasReceivedShare(false);
      setReceivedSharedCid(null);
      return () => {
        cancelled = true;
      };
    }

    const findShareInEvents = (events: Array<{ pubkey: string; tags: string[][] }>) =>
      events.find((event) => {
        const isFromOwnerToUs = event.pubkey === secureDataInfo.nostr_pubkey;
        const isToUs = event.tags.some((tag) => tag[0] === 'p' && tag[1] === currentUserPubkey);
        const isSharingOp = event.tags.some(
          (tag) => tag[0] === 'O' && tag[1] === NOSTR_SHARING_DATA_OP_TAG
        );
        const sharedCidTag = event.tags.find((tag) => tag[0] === 'C');
        const originalCidTag = event.tags.find((tag) => tag[0] === 'I');
        return (
          isFromOwnerToUs &&
          isToUs &&
          isSharingOp &&
          !!sharedCidTag &&
          !!originalCidTag &&
          originalCidTag[1] === secureDataInfo.ipfs_cid
        );
      });

    const cachedShare = findShareInEvents(encryptedMessages);
    if (cachedShare) {
      const sharedCid = cachedShare.tags.find((tag) => tag[0] === 'C')?.[1];
      if (sharedCid) {
        if (!cancelled) {
          setHasReceivedShare(true);
          setReceivedSharedCid(sharedCid);
        }
        return;
      }
    }

    const checkRelays = async () => {
      try {
        const events = await pool.querySync(RELAYS, {
          kinds: [4],
          '#p': [currentUserPubkey],
          '#A': [NOSTR_APP_TAG],
          '#O': [NOSTR_SHARING_DATA_OP_TAG],
          '#I': [secureDataInfo.ipfs_cid],
        });
        const relayShare = findShareInEvents(events);
        const sharedCid = relayShare?.tags.find((tag) => tag[0] === 'C')?.[1];
        if (sharedCid) {
          if (!cancelled) {
            setHasReceivedShare(true);
            setReceivedSharedCid(sharedCid);
          }
          return;
        }
      } catch (error) {
        console.error('Failed to query relay shares for this CID:', error);
      }
      if (!cancelled) {
        setHasReceivedShare(false);
        setReceivedSharedCid(null);
      }
    };

    checkRelays();
    return () => {
      cancelled = true;
    };
  }, [
    encryptedMessages,
    currentUserPubkey,
    pool,
    RELAYS,
    secureDataInfo.ipfs_cid,
    secureDataInfo.nostr_pubkey
  ]);


  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onRequestPermission = async () => {
    if (!currentUserPubkey) {
      if (!flowUser?.loggedIn) {
        setErrorMessage("Connect your Flow wallet first to initialize Nostr ID.");
        setRequestStatus('error');
        return;
      }
      await connectWithFlow();
      return;
    }

    const ownerPubkey = secureDataInfo.nostr_pubkey;

    if (!ownerPubkey) {
      setErrorMessage("Owner's Nostr public key is not available to request access.");
      setRequestStatus('error');
      return;
    }

    if (currentUserPubkey === ownerPubkey) {
      setErrorMessage("You own this data, no request needed. You can access it directly from your 'Secure Data Logs'.");
      setRequestStatus('error');
      return;
    }

    setRequestStatus('pending');
    setErrorMessage(null);

    try {
      const dataCid = secureDataInfo.ipfs_cid;
      const message = `Hello, I would like to request access to your encrypted data with IPFS CID: ${secureDataInfo.ipfs_cid} (Nostr event ID: ${secureDataInfo.nostr_event_id}). Please grant me access.`;
      // 'sharing' parameter is false/null because WE are REQUESTING
      const dmId = await sendEncryptedDM(ownerPubkey, message, dataCid, false, null);
      if (dmId) {
        setPermissionRequested(true);
        setRequestStatus('success');
        console.log("Permission request DM sent with ID:", dmId);
      } else {
        throw new Error("Failed to get DM ID after sending.");
      }
    } catch (error: any) {
      console.error("Error sending permission request:", error);
      setErrorMessage(error.message || "Failed to send access request. Please try again.");
      setRequestStatus('error');
    }
  };

  const handleInitializeNostr = async () => {
    if (!flowUser?.loggedIn) return;
    try {
      setErrorMessage(null);
      await connectWithFlow();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to initialize Nostr ID with Flow wallet.');
    }
  };

  const handleDecryptAndDownload = async () => {
    if (!currentUserPubkey || !receivedSharedCid || !secureDataInfo.nostr_pubkey) {
      setDownloadError("Cannot download: Missing current user pubkey, shared CID, or owner pubkey.");
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      // Create a more descriptive filename
      const label = secureDataInfo.project || secureDataInfo.type || 'shared_data';
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'shared_data';
      const datePart = new Date().toISOString().slice(0, 10);
      const suggestedFileName = `kintagen_${safeLabel}_${datePart}.zip`;

      await decryptAndDownloadSharedData(
        receivedSharedCid,
        secureDataInfo.nostr_pubkey, // The owner is the sender of the re-encrypted data
        suggestedFileName
      );
      setDownloadSuccess(true);
      console.log("Data decrypted and downloaded successfully.");
    } catch (error: any) {
      console.error("Error decrypting and downloading shared data:", error);
      setDownloadError(error.message || "Failed to decrypt and download data.");
      setDownloadSuccess(false);
    } finally {
      setIsDownloading(false);
    }
  };


  const isOwner = currentUserPubkey === secureDataInfo.nostr_pubkey;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
        <LockClosedIcon className="h-6 w-6 text-blue-400" /> Encrypted Data Linked (Nostr)
      </h3>

      <div className="bg-gray-900/50 p-4 rounded-lg text-sm space-y-3">
        <p className="text-gray-300">
          Raw input data for this log entry was encrypted and linked to a Nostr event.
        </p>

        <div className="space-y-2">
          <div className="flex items-center">
            <strong className="text-gray-400 w-28 flex-shrink-0">Encryption:</strong>
            <span className="font-mono text-cyan-300">{secureDataInfo.encryption_algo}</span>
          </div>

          <div className="flex items-start">
            <strong className="text-gray-400 w-28 flex-shrink-0">IPFS CID:</strong>
            <span className="font-mono text-xs text-cyan-300 break-all ml-2 flex-grow">
              {secureDataInfo.ipfs_cid || 'N/A'}
            </span>
            <button
              onClick={() => handleCopy(secureDataInfo.ipfs_cid)}
              className="ml-2 p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Copy IPFS CID"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-start">
            <strong className="text-gray-400 w-28 flex-shrink-0">Owner Pubkey:</strong>
            <span className="font-mono text-xs text-cyan-300 break-all ml-2 flex-grow">
              {secureDataInfo.nostr_pubkey || 'N/A'}
            </span>
            <button
              onClick={() => handleCopy(secureDataInfo.nostr_pubkey)}
              className="ml-2 p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Copy Owner Pubkey"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
            </button>
          </div>

          {secureDataInfo.storage_type && (
            <div className="flex items-start">
              <strong className="text-gray-400 w-28 flex-shrink-0">Storage Type:</strong>
              <span className="font-mono text-xs text-cyan-300 break-all ml-2 flex-grow">
                {secureDataInfo.storage_type}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        {isOwner ? (
          <p className="text-blue-400 font-semibold">
            You own this data. Access it via 'Secure Data Logs'.
          </p>
        ) : !currentUserPubkey ? (
          <>
            <p className="text-amber-300 text-sm mb-3">
              Initialize your Nostr ID with your Flow wallet to check if this data was already shared with you.
            </p>
            {flowUser?.loggedIn ? (
              <button
                onClick={handleInitializeNostr}
                className={`font-bold py-2 px-6 rounded-lg transition-colors text-white ${isNostrConnecting
                  ? 'bg-amber-700 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                disabled={isNostrConnecting}
              >
                {isNostrConnecting ? 'Initializing...' : 'Initialize Nostr ID'}
              </button>
            ) : (
              <p className="text-xs text-gray-400">
                Connect your Flow wallet first. The Nostr ID is derived from your wallet signature.
              </p>
            )}
          </>
        ) : hasReceivedShare && receivedSharedCid ? (
          <>
            <p className="text-green-400 font-semibold mb-3 flex items-center justify-center gap-2">
              <CheckCircleIcon className="h-5 w-5" /> Access Granted!
            </p>
            <button
              onClick={handleDecryptAndDownload}
              className={`font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center mx-auto
                ${isDownloading ? 'bg-indigo-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}
                text-white`}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <> <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> Downloading... </>
              ) : (
                <> <ArrowDownTrayIcon className="h-5 w-5 mr-2" /> Decrypt & Download Data </>
              )}
            </button>
            {downloadSuccess && (
              <p className="text-green-400 mt-2 text-sm">Download successful!</p>
            )}
            {downloadError && (
              <p className="text-red-400 mt-2 text-sm flex items-center justify-center gap-1">
                <ExclamationCircleIcon className="h-4 w-4" /> {downloadError}
              </p>
            )}
          </>
        ) : (
          <button
            onClick={onRequestPermission}
            className={`font-bold py-2 px-6 rounded-lg transition-colors
              ${requestStatus === 'pending' ? 'bg-blue-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}
              ${requestStatus === 'error' ? 'bg-red-600 hover:bg-red-500' : ''}
              ${requestStatus === 'success' ? 'bg-green-600 hover:bg-green-500' : ''}
              text-white`}
            disabled={requestStatus === 'pending'}
          >
            {requestStatus === 'pending' ? 'Requesting Access...' : 'Request Access to Encrypted Data'}
          </button>
        )}
        {errorMessage && (
          <p className="text-red-400 mt-2 text-sm">{errorMessage}</p>
        )}
      </div>
    </div>
  );
};

export default SecureDataDisplay;
