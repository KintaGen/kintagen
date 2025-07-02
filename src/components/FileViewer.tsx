// src/components/FileViewer.tsx
import React, { useState, useEffect } from 'react';
import { ArrowPathIcon, XMarkIcon, DocumentTextIcon, KeyIcon } from '@heroicons/react/24/solid';
import { useLitFlow } from '../lit/useLitFlow';

// These types should match what is passed from the parent page
interface GenericDataInfo {
  cid: string;
  title: string;
  is_encrypted: boolean; // Using snake_case to match the database column name
  lit_token_id?: string;
}

interface FileViewerProps {
  item: GenericDataInfo;
  onClose: () => void;
}

const ACCESS_MANAGER_CONTRACT_ADDRESS = "0x5bc5A6E3dD358b67A752C9Dd58df49E863eA95F2";
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const FileViewer: React.FC<FileViewerProps> = ({ item, onClose }) => {
  const [displayText, setDisplayText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { checkAndDecryptFile, loading: isLitLoading } = useLitFlow();

  useEffect(() => {
    const fetchAndProcessContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/document-content/${item.cid}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch content from API.');

        // --- Client-Side Smart Logic ---
        if (item.is_encrypted) {
          if (!item.lit_token_id) throw new Error("File is encrypted, but no Lit Token ID is available.");
          if (!data.isRaw) throw new Error("Backend returned parsed text for a file marked as encrypted.");
          
          setDisplayText("Decrypting file with your wallet key...");

          // The 'content' is the encrypted JSON package as a Base64 string
          // The Lit hook needs the raw (not-parsed) JSON string for decryption
          const decryptedFileBytes = await checkAndDecryptFile(data.content, ACCESS_MANAGER_CONTRACT_ADDRESS, item.lit_token_id);
          
          const decodedString = new TextDecoder().decode(decryptedFileBytes);
          setDisplayText(decodedString);

        } else {
          // If not encrypted, the backend already parsed it for us.
          if (data.isRaw) throw new Error("Backend returned raw data for an unencrypted file.");
          setDisplayText(data.content);
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndProcessContent();
  }, [item.cid, item.is_encrypted, item.lit_token_id, checkAndDecryptFile]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="relative bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-3">
            <DocumentTextIcon className="h-6 w-6 text-gray-400" />
            <span className="truncate" title={item.title}>{item.title}</span>
            {item.is_encrypted && <KeyIcon className="h-5 w-5 text-amber-400" title="Encrypted" />}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700"><XMarkIcon className="h-6 w-6" /></button>
        </div>
        <div className="flex-grow p-6 overflow-y-auto">
          {(isLoading || isLitLoading) && (
            <div className="flex justify-center items-center h-full">
              <div className="flex flex-col items-center">
                <ArrowPathIcon className="h-10 w-10 text-blue-400 animate-spin" />
                <p className="mt-4 text-blue-300">{isLitLoading ? 'Awaiting wallet approval for decryption...' : 'Fetching content...'}</p>
              </div>
            </div>
          )}
          {error && <div className="text-red-400">Error: {error}</div>}
          {!(isLoading || isLitLoading) && !error && (
            <pre className="text-gray-300 whitespace-pre-wrap font-sans text-sm">
              {displayText || "No text content could be extracted."}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileViewer;