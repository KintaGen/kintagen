// components/SecureDataDisplay.tsx
import React from 'react';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useState } from 'react'; // Import useState for clipboard functionality



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
  console.log(secureDataInfo)
  const nostrEventUrl = `https://iris.to/event/${secureDataInfo.nostr_event_id}`; // Example for Iris.to
  return (
    <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mt-4 text-sm text-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <LockClosedIcon className="h-5 w-5 text-blue-400" />
        <span className="font-semibold text-blue-100">Encrypted Data Linked (Nostr)</span>
      </div>

      <p className="mb-2">
        Raw input data for this log entry was encrypted and linked to a Nostr event.
      </p>

      <div className="space-y-2">

        <div className="flex items-center gap-2">
          <span className="font-medium">Encryption:</span>
          <span>{secureDataInfo.encryption_algo}</span>
        </div>

      </div>
    </div>
  );
};

export default SecureDataDisplay;