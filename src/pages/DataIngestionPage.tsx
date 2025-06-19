// src/pages/DataIngestionPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpTrayIcon, DocumentTextIcon, MagnifyingGlassIcon, KeyIcon } from '@heroicons/react/24/solid';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useLitFlow } from '../lit/useLitFlow';
import { accessKeyAbi } from '../lit/accessKeyAbi';
import { parseEventLogs } from 'viem';

// --- TYPE DEFINITIONS ---
// For the encrypted file history (session only)
interface ProcessedFile {
  originalFileName: string;
  uploadCid: string;
  litTokenId: string;
  encryptedJsonString: string;
}
// For the general file history fetched from the server
interface CidInfo {
  cid: string;
  title: string;
  year: string;
  authors: string[]; // An array of author names
  doi: string;
  keywords: string[]; // An array of keywords/tags
}



const ACCESS_MANAGER_CONTRACT_ADDRESS = "0x5bc5A6E3dD358b67A752C9Dd58df49E863eA95F2";




const DataIngestionPage: React.FC = () => {
  // --- MERGE: Unified State from Both Components ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [encryptFile, setEncryptFile] = useState<boolean>(true); // <-- The new toggle state!
  const [status, setStatus] = useState("Select a file to begin.");
  
  // State for wallet & contract interactions
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({ hash });
  const { encryptFileAndPackage, checkAndDecryptFile, loading: isLitLoading } = useLitFlow();
  
  // State for UI and data display
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]); // For encrypted session history
  const [cids, setCids] = useState<CidInfo[]>([]); // For general server history
  const [filter, setFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- MERGE: Combined Data Handling Functions ---

  // 1. Fetch the overall CID list from the server (used by both flows)
  const fetchCIDs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = filter ? `?filename=${encodeURIComponent(filter)}` : '';
      const resp = await fetch(`https://salty-eyes-visit.loca.lt/api/data/paper`); 
      if (!resp.ok) throw new Error('Failed to fetch CID list');
      const json: CidInfo[] = await resp.json();
      setCids(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handler for UPLOADING UNENCRYPTED files
  const handleUnencryptedUpload = async (file: File) => {
    setStatus(`Uploading "${file.name}"...`);
    setIsLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('serviceUrl', 'https://caliberation-pdp.infrafolio.com');
      form.append('serviceName', 'pdpricardo');
      form.append('proofSetID', '318'); // Or your dynamic proofSetID
      form.append('file', file, file.name);

      const resp = await fetch('https://salty-eyes-visit.loca.lt/api/proofset/upload-and-add-root', {
        method: 'POST', body: form,
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || 'Upload failed');

      setStatus(`Successfully uploaded "${file.name}"!`);
      setSelectedFile(null);
      fetchCIDs(); // Refresh the list
    } catch (err: any) {
      console.error("Unencrypted upload failed:", err);
      setError(err.message);
      setStatus(`Error during upload: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  const processAndUploadPdf = async () => {
    console.log(selectedFile)
    if (!selectedFile) {
        alert("Please select a file.");
        return;
    }

    // This is a simple FormData upload, just like any other file upload.
    const formData = new FormData();
    // The key 'pdfFile' must match `upload.single('pdfFile')` on the server
    formData.append('pdfFile', selectedFile); 

    // We can add other metadata fields here if needed, and they'll be available in `req.body`
    // formData.append('tags', 'biochemistry, review');

    try {
        const response = await fetch('http://localhost:3001/api/process-and-upload-paper', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        if (!response.ok || !result) {
            throw new Error(result.error || 'Failed to process the PDF.');
        }

        console.log("Successfully processed and stored the PDF!");
        console.log("Final Manifest:", result.data);
        
        // Now you can update your UI, maybe by re-fetching the list of all documents.
        fetchCIDs(); // or whatever your function to refresh the list is called

    } catch (error) {
        console.error("Error processing PDF:", error);
        alert(error.message);
    }
};
  // 3. Handler for UPLOADING ENCRYPTED files
  const handleEncryptedUpload = async (fileName: string, tokenId: string, encryptedJsonString: string) => {
    setStatus(`Uploading encrypted data for "${fileName}"...`);
    setIsLoading(true);
    setError(null);
    try {
      // CORRECTLY process the encrypted data
      const encryptedPackage = JSON.parse(encryptedJsonString);
      const rawCiphertextBytes = base64ToUint8Array(encryptedPackage.ciphertext);
      const encryptedBlob = new Blob([rawCiphertextBytes], { type: 'application/octet-stream' });
      const newFileName = fileName.toLowerCase() + '.enc';

      const form = new FormData();
      form.append('serviceUrl', 'https://caliberation-pdp.infrafolio.com');
      form.append('serviceName', 'pdpricardo');
      form.append('proofSetID', '318');
      form.append('file', encryptedBlob, newFileName);

      const resp = await fetch('https://salty-eyes-visit.loca.lt/api/proofset/upload-and-add-root', {
        method: 'POST', body: form
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || 'Backend upload failed');

      setProcessedFiles(prev => [...prev, {
        originalFileName: fileName, uploadCid: json.cid, litTokenId: tokenId, encryptedJsonString
      }]);
      setStatus(`Successfully encrypted and uploaded "${fileName}"!`);
      setSelectedFile(null);
      fetchCIDs(); // Refresh the list
    } catch (err: any) {
      console.error("Encrypted upload failed:", err);
      setError(err.message);
      setStatus(`Error during upload: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- MERGE: Main click handler that decides which path to take ---
  const handleProcessFileClick = () => {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }

    if (encryptFile) {
      // ENCRYPTION PATH
      if (!isConnected) {
        alert("Please connect your wallet to encrypt a file.");
        return;
      }
      setStatus("Please approve transaction in your wallet to create an access key...");
      writeContract({
        address: ACCESS_MANAGER_CONTRACT_ADDRESS,
        abi: accessKeyAbi,
        functionName: 'createKey',
        args: [selectedFile.name]
      });
    } else {
      // UNENCRYPTED PATH
      handleUnencryptedUpload(selectedFile);
    }
  };

  // --- Effects ---

  // Effect for the encryption flow (unchanged, but now calls the correct upload handler)
  useEffect(() => {
    if (!receipt || !selectedFile) return;

    const processTransactionAndEncrypt = async () => {
      if (receipt.status !== 'success') {
        setStatus("Transaction failed or was reverted."); return;
      }
      setStatus("Transaction confirmed. Parsing event logs for Token ID...");
      try {
        const logs = parseEventLogs({ abi: accessKeyAbi, logs: receipt.logs, eventName: 'KeyCreated' });
        if (logs.length === 0 || !logs[0].args.tokenId) {
          throw new Error("Could not find KeyCreated event in transaction logs.");
        }
        const tokenId = (logs[0].args as { tokenId: bigint }).tokenId.toString();
        setStatus(`Key #${tokenId} created. Encrypting file...`);
        
        const encryptedJsonString = await encryptFileAndPackage(selectedFile);
        if (!encryptedJsonString) throw new Error("Lit encryption returned empty.");

        // Call the dedicated handler for encrypted uploads
        await handleEncryptedUpload(selectedFile.name, tokenId, encryptedJsonString);
      } catch (e: any) {
        console.error("Error during encryption/upload process:", e);
        setStatus(`Process failed: ${e.message}`);
        setError(`Process failed: ${e.message}`);
      }
    };
    processTransactionAndEncrypt();
  }, [receipt, selectedFile]); // Dependency array is correct

  // Fetch history on mount and when filter changes
  useEffect(() => {
    fetchCIDs();
  }, [filter]);

  // --- UI Event Handlers ---
  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setStatus(`Selected file: "${files[0].name}". Ready to process.`);
      setError(null);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files);
  };

  const handleDecryptClick = async (file: ProcessedFile) => { /* ... no change needed here ... */ };

  // --- RENDER ---
  const isProcessing = isPending || isConfirming || isLitLoading || isLoading;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Ingest Data</h1>
        {/* Wallet connection is now optional, but shown if encryption is desired */}
        {isConnected ? (
          <div className="text-right">
            <p className="text-sm text-green-400">Connected: {`${address?.substring(0, 6)}...`}</p>
            <button onClick={() => disconnect()} className="text-xs text-gray-400 hover:text-white">Disconnect</button>
          </div>
        ) : (
          <button onClick={() => connect({ connector: connectors[0] })} className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-500">Connect Wallet</button>
        )}
      </div>

      <p className="text-gray-400 mb-2">Upload documents to the knowledge base. You can choose to encrypt them with an on-chain key first.</p>
      <div className="bg-gray-800 p-2 rounded-lg text-center text-amber-300 text-sm mb-8 h-10 flex items-center justify-center">
        <p>{status}</p>
      </div>

      {/* Uploader Component */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors duration-300 relative cursor-pointer`}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
      >
        <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-white">{selectedFile ? selectedFile.name : 'Drag & drop or click to select a file'}</h3>
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
      </div>

      {/* --- MERGE: The Encryption Toggle --- */}
      <div className="flex items-center justify-center mt-4">
        <input
          type="checkbox"
          id="encrypt-toggle"
          checked={encryptFile}
          onChange={(e) => setEncryptFile(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="encrypt-toggle" className="ml-2 block text-sm text-gray-300">
          Encrypt file with wallet key
        </label>
      </div>

      {/* --- MERGE: The Unified Action Button --- */}
      <button
        onClick={processAndUploadPdf}
        disabled={!selectedFile || isProcessing || (encryptFile && !isConnected)}
        className="w-full mt-4 bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : (encryptFile ? 'Create Key, Encrypt & Upload' : 'Upload File')}
      </button>

      {/* Error Displays */}
      {error && <div className="mt-4 bg-red-900 border border-red-700 text-red-200 p-3 rounded-lg">{`Error: ${error}`}</div>}
      {contractError && <p className="text-red-400 mt-2">Contract Error: {contractError.shortMessage}</p>}

      {/* History Sections */}
      <div className="mt-10 gap-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Total Ingestion History</h2>
            <div className="relative">
              <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by filename..."
                className="bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none"/>
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow">
          <ul className="divide-y divide-gray-700">
          {cids.length > 0 ? (
      // We'll rename the map variable to `item` for clarity, to avoid confusion with `item.cid`
      cids.map((item) => (
        <li key={item.cid} className="p-4 flex items-start space-x-4">
          {/* Left side: Icon */}
          <div className="flex-shrink-0">
            <DocumentTextIcon className="h-8 w-8 text-gray-400 mt-1" />
          </div>

          {/* Middle: Main Content Block */}
          <div className="flex-grow overflow-hidden">
            {/* Title */}
            <p className="text-lg font-semibold text-white truncate" title={item.title}>
              {item.title || 'Untitled Document'}
            </p>

            {/* Authors */}
            {item.authors && item.authors.length > 0 && (
              <p className="text-sm text-gray-400 mt-1 truncate" title={item.authors.join(', ')}>
                by {item.authors.join(', ')}
              </p>
            )}

                      {/* DOI and CID */}
                      <div className="text-xs text-gray-500 mt-2 space-x-4">
                        {item.doi && (
                          <a 
                            href={`https://doi.org/${item.doi}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-400 hover:underline"
                          >
                            DOI: {item.doi}
                          </a>
                        )}
                        <span className="truncate" title={item.cid}>CID: {item.cid}</span>
                      </div>

                      {/* Keywords/Tags */}
                      {item.keywords && item.keywords.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.keywords.map((keyword, index) => (
                            <span key={index} className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-full">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right side: Year */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-base font-medium text-white">{item.year}</p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="p-4 text-center text-gray-500">
                  {isLoading ? 'Loading...' : 'No files found.'}
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataIngestionPage;