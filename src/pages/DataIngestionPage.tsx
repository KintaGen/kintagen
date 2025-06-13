// src/pages/DataIngestionPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpTrayIcon, DocumentTextIcon, MagnifyingGlassIcon, KeyIcon } from '@heroicons/react/24/solid';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useLitFlow } from '../lit/useLitFlow';
import { accessKeyAbi } from '../lit/accessKeyAbi';
import { parseEventLogs } from 'viem';

// --- Unified State for Processed Files ---
interface ProcessedFile {
  originalFileName: string;
  uploadCid: string; // CID from your backend
  litTokenId: string; // Token ID from the smart contract
  encryptedJsonString: string; // The encrypted package
}
// Define a type for the data we expect from the /cids endpoint
interface CidInfo {
  filename: string;
  cid: string;
  uploaded_at: string;
}
const ACCESS_MANAGER_CONTRACT_ADDRESS = "0x5bc5A6E3dD358b67A752C9Dd58df49E863eA95F2";

const DataIngestionPage: React.FC = () => {
  // --- Wallet State ---
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // --- UI & File State ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [status, setStatus] = useState("Connect wallet to begin.");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cids, setCids] = useState<CidInfo[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Lit & Contract Hooks ---
  const { encryptFileAndPackage, checkAndDecryptFile, loading: isLitLoading } = useLitFlow();
  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({ hash });

  // --- Main Effect: The Core Workflow ---
  // This effect runs when a transaction receipt is received.
  useEffect(() => {
    if (!receipt || !selectedFile) return;

    const processTransactionAndEncrypt = async () => {
      // 1. Check transaction status
      if (receipt.status !== 'success') {
        setStatus("Transaction failed or was reverted.");
        return;
      }
      setStatus("Transaction confirmed. Parsing event logs for Token ID...");
      
      try {
        // 2. Parse Token ID from logs
        const logs = parseEventLogs({ abi: accessKeyAbi, logs: receipt.logs, eventName: 'KeyCreated' });
        if (logs.length === 0 || !logs[0].args.tokenId) {
          setStatus("Error: Could not find KeyCreated event in transaction logs.");
          return;
        }
        const tokenId = (logs[0].args as { tokenId: bigint }).tokenId.toString();
        setStatus(`Key #${tokenId} created on-chain. Encrypting file...`);

        // 3. Encrypt the file using Lit Protocol
        const encryptedJsonString = await encryptFileAndPackage(selectedFile);
        if (!encryptedJsonString) throw new Error("Lit encryption returned empty.");

        setStatus(`File encrypted with key #${tokenId}. Uploading to backend...`);
        
        // 4. Upload the ENCRYPTED data to your backend
        await handleUpload(selectedFile.name, tokenId, encryptedJsonString);

      } catch (e: any) {
        console.error("Error during encryption/upload process:", e);
        setStatus(`Process failed: ${e.message}`);
      }
    };

    processTransactionAndEncrypt();
  }, [receipt]);

  // Automatically fetch CIDs on component mount and when the filter changes
  useEffect(() => {
    fetchCIDs();
  }, [filter]);
  // --- Data Handling Functions ---
  // 1. Function to fetch the list of CIDs from the API
  const fetchCIDs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = filter ? `?filename=${encodeURIComponent(filter)}` : '';
      // IMPORTANT: Replace with your actual API URL
      const resp = await fetch(`https://salty-eyes-visit.loca.lt/api/cids${params}`);
      if (!resp.ok) throw new Error('Failed to fetch CID list');
      const json: CidInfo[] = await resp.json();
      setCids(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Modified upload function: now takes encrypted data and uploads it as a Blob
  const handleUpload = async (fileName: string, tokenId: string, encryptedJson: string) => {
    try {
      const form = new FormData();
      // Your backend expects a file, so we convert the JSON string into a Blob
      const encryptedBlob = new Blob([encryptedJson], { type: 'application/json' });
      console.log(new File([encryptedBlob],fileName.toLowerCase()))
      form.append('serviceUrl', 'https://caliberation-pdp.infrafolio.com');
      form.append('serviceName', 'pdpricardo');
      form.append('proofSetID', '318'); // This can be dynamic if needed
      form.append('file', new File([encryptedBlob],fileName.toLowerCase())); // Send blob as a file
      const resp = await fetch('https://salty-eyes-visit.loca.lt/api/proofset/upload-and-add-root', {
        method: 'POST', body: form
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || 'Backend upload failed');

      // Add to our UI list
      setProcessedFiles(prev => [...prev, {
        originalFileName: fileName,
        uploadCid: json.cid, // Assuming your backend returns a CID
        litTokenId: tokenId,
        encryptedJsonString: encryptedJson
      }]);

      setStatus(`Successfully encrypted and uploaded "${fileName}"!`);
      setSelectedFile(null); // Clear selection after success
    } catch (err: any) {
      console.error("Backend upload failed:", err);
      setStatus(`Error during upload: ${err.message}`);
    }
  };
  
  const handleDecryptClick = async (file: ProcessedFile) => {
    setStatus(`Decrypting "${file.originalFileName}"...`);
    try {
      const decryptedFileBytes = await checkAndDecryptFile(file.encryptedJsonString, ACCESS_MANAGER_CONTRACT_ADDRESS, file.litTokenId);
      const url = URL.createObjectURL(new Blob([decryptedFileBytes]));
      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus(`Successfully decrypted and downloaded "${file.originalFileName}".`);
    } catch (e: any) {
      console.error("Decryption error:", e);
      setStatus(`Decryption failed: ${e.message}`);
    }
  };


  // --- UI Event Handlers ---

  const handleEncryptAndUploadClick = () => {
    if (!selectedFile) return alert("Please select a file first.");
    setStatus("Please approve transaction in your wallet to create an access key...");
    writeContract({
      address: ACCESS_MANAGER_CONTRACT_ADDRESS,
      abi: accessKeyAbi,
      functionName: 'createKey',
      args: [selectedFile.name]
    });
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setStatus(`Selected file: "${files[0].name}". Ready to encrypt.`);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files);
  };

  // --- RENDER ---
  const isProcessing = isPending || isConfirming || isLitLoading;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Ingest & Encrypt Data</h1>
        {isConnected ? (
          <div className="text-right">
            <p className="text-sm text-green-400">Connected: {`${address?.substring(0, 6)}...${address?.substring(address.length - 4)}`}</p>
            <button onClick={() => disconnect()} className="text-xs text-gray-400 hover:text-white">Disconnect</button>
          </div>
        ) : (
          <button onClick={() => connect({ connector: connectors[0] })} className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-500">Connect Wallet</button>
        )}
      </div>

      <p className="text-gray-400 mb-2">Upload and encrypt documents on-chain using Lit Protocol before storing them.</p>
      <div className="bg-gray-800 p-2 rounded-lg text-center text-amber-300 text-sm mb-8 h-10 flex items-center justify-center">
        <p>{status}</p>
      </div>

      {/* --- Uploader Component --- */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors duration-300 relative ${!isConnected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        onClick={() => isConnected && fileInputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); isConnected && setIsDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
      >
        <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-white">{selectedFile ? selectedFile.name : 'Drag & drop or click to select a file'}</h3>
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} disabled={!isConnected} />
      </div>

      <button
        onClick={handleEncryptAndUploadClick}
        disabled={!isConnected || !selectedFile || isProcessing}
        className="w-full mt-4 bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Create Key, Encrypt & Upload'}
      </button>
      {contractError && <p className="text-red-400 mt-2">Error: {contractError.shortMessage}</p>}

      {/* --- Ingestion History --- */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Encrypted File History</h2>
        <div className="bg-gray-800 rounded-lg shadow">
          {processedFiles.length > 0 ? (
            <ul className="divide-y divide-gray-700">
              {processedFiles.map((file) => (
                <li key={file.litTokenId} className="flex items-center justify-between p-4">
                  <div className="flex items-center overflow-hidden">
                    <DocumentTextIcon className="h-6 w-6 text-gray-400 mr-4 flex-shrink-0" />
                    <div className="overflow-hidden">
                      <p className="font-medium text-white truncate" title={file.originalFileName}>{file.originalFileName}</p>
                      <p className="text-sm text-gray-500 truncate" title={file.uploadCid}>Upload CID: {file.uploadCid}</p>
                      <p className="text-sm text-gray-500 truncate" title={file.litTokenId}>Lit Key ID: {file.litTokenId}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDecryptClick(file)} disabled={isLitLoading} className="bg-blue-600 text-sm px-3 py-1 rounded-md hover:bg-blue-500 disabled:bg-gray-600">
                    <KeyIcon className="h-4 w-4 inline-block mr-1"/> Decrypt
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="p-4 text-center text-gray-500">No files processed in this session.</p>}
        </div>
        <div className="bg-gray-800 rounded-lg shadow">
          <ul className="divide-y divide-gray-700">
            {cids.length > 0 ? (
              cids.map((cid) => (
                <li key={cid.cid} className="flex items-center justify-between p-4">
                  <div className="flex items-center overflow-hidden">
                    <DocumentTextIcon className="h-6 w-6 text-gray-400 mr-4 flex-shrink-0" />
                    <div className="overflow-hidden">
                      <p className="font-medium text-white truncate" title={cid.filename}>{cid.filename}</p>
                      <p className="text-sm text-gray-500 truncate" title={cid.cid}>CID: {cid.cid}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 text-right flex-shrink-0 ml-4">
                    {new Date(cid.uploaded_at).toLocaleString()}
                  </div>
                </li>
              ))
            ) : (
                <li className="p-4 text-center text-gray-500">
                    {isLoading ? 'Loading history...' : 'No files found.'}
                </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DataIngestionPage;