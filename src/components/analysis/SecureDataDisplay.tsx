// components/SecureDataDisplay.tsx
import React, { useState } from 'react';
import { LockClosedIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline'; // Added DocumentDuplicateIcon for copy

export interface SecureDataInfo {
  nostr_event_id: string;
  ipfs_cid: string;
  encryption_algo: string;
}

interface SecureDataDisplayProps {
  secureDataInfo: SecureDataInfo;
}

const SecureDataDisplay: React.FC<SecureDataDisplayProps> = ({ secureDataInfo }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset copied state after 2 seconds
  };

  const nostrEventUrl = `https://iris.to/event/${secureDataInfo.nostr_event_id}`; // Example for Iris.to

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
        </div>
      </div>

      {/* Button to ask permission (future implementation) */}
      <div className="mt-6 text-center">
        <button
          // onClick={onRequestPermission} // This will be implemented later
          className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 transition-colors"
        >
          Request Access to Encrypted Data
        </button>
      </div>
    </div>
  );
};

export default SecureDataDisplay;