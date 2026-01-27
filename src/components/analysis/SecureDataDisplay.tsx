// components/SecureDataDisplay.tsx
import React, { useState,useEffect } from 'react';
import { LockClosedIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { useNostr,NOSTR_SHARING_DATA_OP_TAG } from '../../contexts/NostrContext'; // Adjust path as needed

export interface SecureDataInfo {
  nostr_event_id: string; // The event ID of the original data event
  ipfs_cid: string;
  nostr_pubkey: string; // This is the owner's pubkey from your provided data structure
  encryption_algo: string;
  storage_type: string; // Added storage_type as it's in your example
}

interface SecureDataDisplayProps {
  secureDataInfo: SecureDataInfo;
}

const SecureDataDisplay: React.FC<SecureDataDisplayProps> = ({ secureDataInfo }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [permissionRequested, setPermissionRequested] = useState<boolean>(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shared,setShared] = useState<any>()
  const {
    pubkey: currentUserPubkey,
    sendEncryptedDM,
    openNostrLoginModal,
    pool,
    RELAYS,
  } = useNostr();

  useEffect(() => {
    checkShared()
  },[])

  const checkShared = async () => {
    if(!currentUserPubkey){
      return;
    }
    const eventShare = await pool.get(
      RELAYS,
      {
        kinds: [4],
        authors: [secureDataInfo.nostr_pubkey],
        '#p': [currentUserPubkey],
        '#I': [secureDataInfo.ipfs_cid],
        '#O': [NOSTR_SHARING_DATA_OP_TAG]
      },
    )
    if(eventShare){
      setShared(eventShare);
      setPermissionRequested(true);
    }
  }
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onRequestPermission = async () => {
    if (!currentUserPubkey) {
      openNostrLoginModal(); // Open the Nostr login modal
      return;
    }

    // Use secureDataInfo.nostr_pubkey directly as the owner's pubkey
    const ownerPubkey = secureDataInfo.nostr_pubkey;

    if (!ownerPubkey) {
      setErrorMessage("Owner's Nostr public key is not available to request access.");
      setRequestStatus('error');
      return;
    }

    setRequestStatus('pending');
    setErrorMessage(null);

    try {
      const dataCid = secureDataInfo.ipfs_cid;
      const message = `Hello, I would like to request access to the encrypted data linked by IPFS CID: ${secureDataInfo.ipfs_cid} (Nostr event ID: ${secureDataInfo.nostr_event_id}). Please grant me access.`;
      const dmId = await sendEncryptedDM(ownerPubkey, message,dataCid); // Use ownerPubkey here
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
        {!permissionRequested ? (
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
        ) : (
          <>
          {
            shared ? 
            <p className="text-green-400 font-semibold">
              Data already shared
            </p>
            : 
            <p className="text-green-400 font-semibold">
              Permission request sent! The owner has been notified.
            </p>
          }
          </>
        )}
        {errorMessage && (
          <p className="text-red-400 mt-2 text-sm">{errorMessage}</p>
        )}
      </div>
    </div>
  );
};

export default SecureDataDisplay;