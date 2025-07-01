// src/pages/DataIngestionPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowUpTrayIcon, DocumentTextIcon, MagnifyingGlassIcon, 
  ArrowPathIcon, CheckCircleIcon, XCircleIcon,
  BeakerIcon, SparklesIcon, KeyIcon
} from '@heroicons/react/24/solid';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useLitFlow } from '../lit/useLitFlow';
import { accessKeyAbi } from '../lit/accessKeyAbi';
import { parseEventLogs } from 'viem';

// --- TYPE DEFINITIONS ---
interface GenericDataInfo {
  cid: string;
  title: string;
  year?: string;
  authors?: string[];
  doi?: string;
  keywords?: string[];
  description?: string;
  instrument?: string;
  isEncrypted?: boolean; // Flag to denote encrypted files
}

interface SuccessInfo {
  message: string;
  cid: string;
  title: string;
  projectId: number | null;
  isEncrypted: boolean;
  litTokenId?: string; // For post-upload actions
}

interface Project {
  id: number;
  name: string;
  nft_id: number | null;
}

const ACCESS_MANAGER_CONTRACT_ADDRESS = "0x5bc5A6E3dD358b67A752C9Dd58df49E863eA95F2";

const DataIngestionPage: React.FC = () => {
  // --- STATE MANAGEMENT (Combined from both versions) ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dataType, setDataType] = useState<'paper' | 'experiment'>('paper');
  const [experimentTitle, setExperimentTitle] = useState('');
  const [status, setStatus] = useState("Select a file to begin.");
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

  const [logAdded, setLogAdded] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  
  // Wallet, Contract & Lit Protocol State
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({ hash });
  const { encryptFileAndPackage, checkAndDecryptFile, loading: isLitLoading, base64ToUint8Array } = useLitFlow();
  
  // UI & History State
  const [historyData, setHistoryData] = useState<GenericDataInfo[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Project & Encryption Toggle State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [areProjectsLoading, setAreProjectsLoading] = useState(true);
  const [encryptFile, setEncryptFile] = useState(false); // Default to false for simplicity


  const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'https://salty-eyes-visit.loca.lt/api';

  // --- DATA HANDLING ---
  const fetchHistory = async () => {
    setIsDataLoading(true);
    setHistoryData([]);
    let queryParams = new URLSearchParams();
    if (selectedProjectId) queryParams.append('projectId', selectedProjectId);
    const url = `${API_BASE}/data/${dataType}?${queryParams.toString()}`;
    try {
      const resp = await fetch(url); 
      if (!resp.ok) throw new Error(`Failed to fetch ${dataType} list from server.`);
      const jsonResponse = await resp.json();
      setHistoryData(jsonResponse.data || []);
    } catch (err: any) {
      console.error(`Failed to fetch history: ${err.message}`);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleUnencryptedUpload = async () => {
    if (!selectedFile) return alert("Please select a file.");
    if (dataType === 'experiment' && !experimentTitle.trim()) return alert("Please provide a title for the experiment.");

    setIsLoading(true);
    setError(null);
    setSuccessInfo(null);
    setLogAdded(false); 

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('dataType', dataType);
    if (selectedProjectId) formData.append('projectId', selectedProjectId);
    if (dataType === 'experiment') formData.append('title', experimentTitle);

    try {
      setStatus(dataType === 'paper' ? 'AI processing paper...' : 'Uploading experiment data...');
      const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed.');

      setStatus('Upload Complete!');
      setSuccessInfo({
        message: result.message,
        cid: result.rootCID,
        title: result.title,
        projectId: result.projectId,
        isEncrypted: false,
      });
      fetchHistory();
    } catch (err: any) {
      setError(err.message);
      setStatus('An error occurred.');
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
      setExperimentTitle('');
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEncryptedUpload = async (fileName: string, encryptedJsonString: string, litTokenId: string) => {
    setStatus(`Uploading encrypted file...`);
    setIsLoading(true);
    setError(null);
    setSuccessInfo(null);
    setLogAdded(false); 
    
    try {
        const encryptedPackage = JSON.parse(encryptedJsonString);
        const rawCiphertextBytes = base64ToUint8Array(encryptedPackage.ciphertext);
        const encryptedBlob = new Blob([rawCiphertextBytes], { type: 'application/octet-stream' });
        const newFileName = fileName.toLowerCase() + '.enc';

        const formData = new FormData();
        formData.append('file', encryptedBlob, newFileName);
        formData.append('dataType', dataType);
        formData.append('isEncrypted',encryptFile.toString())
        formData.append('title', dataType === 'paper' ? fileName : experimentTitle);
        if (selectedProjectId) formData.append('projectId', selectedProjectId);

        const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Encrypted upload failed.');

        setStatus('Encrypted Upload Complete!');
        setSuccessInfo({
            message: `Encrypted ${dataType} uploaded successfully!`,
            cid: result.rootCID,
            title: result.title,
            projectId: result.projectId,
            isEncrypted: true,
            litTokenId: litTokenId,
        });
        fetchHistory();

    } catch(err: any) {
        setError(err.message);
        setStatus('An error occurred during encrypted upload.');
    } finally {
        setIsLoading(false);
        setSelectedFile(null);
        setExperimentTitle('');
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  
  const handleProcessFileClick = () => {
    if (!selectedFile) return alert("Please select a file first.");
    if (dataType === 'experiment' && !experimentTitle.trim()) return alert("Please provide a title for the experiment.");

    if (encryptFile) {
        if (!isConnected) return alert("Please connect your wallet to encrypt files.");
        setIsLoading(true);
        setError(null);
        setSuccessInfo(null);
        setStatus("Please approve transaction in your wallet to create an access key...");
        writeContract({
            address: ACCESS_MANAGER_CONTRACT_ADDRESS,
            abi: accessKeyAbi,
            functionName: 'createKey',
            args: [selectedFile.name]
        });
    } else {
        handleUnencryptedUpload();
    }
  };
  
  const handleAddToLog = async () => {
    if (!successInfo || !successInfo.projectId) return;
    setIsLogging(true);
    setError(null);
    try {
        const actionDescription = `Ingested ${dataType}: "${successInfo.title}"`;
        const response = await fetch(`${API_BASE}/projects/${successInfo.projectId}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: actionDescription,
                outputCID: successInfo.cid
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to add log entry.');
        setLogAdded(true);
    } catch(err: any) {
        setError(`Failed to add to on-chain log: ${err.message}`);
    } finally {
        setIsLogging(false);
    }
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (!receipt || !selectedFile) return;
    const processTransactionAndEncrypt = async () => {
      if (receipt.status !== 'success') {
        setStatus("Transaction failed.");
        setError("The on-chain key creation transaction failed or was reverted.");
        setIsLoading(false);
        return;
      }
      setStatus("Key created. Encrypting file with Lit Protocol...");
      try {
        const logs = parseEventLogs({ abi: accessKeyAbi, logs: receipt.logs, eventName: 'KeyCreated' });
        if (logs.length === 0 || !logs[0].args.tokenId) throw new Error("Could not find KeyCreated event in transaction logs.");
        const tokenId = (logs[0].args as { tokenId: bigint }).tokenId.toString();
        const encryptedJsonString = await encryptFileAndPackage(selectedFile);
        if (!encryptedJsonString) throw new Error("Lit encryption returned an empty result.");
        await handleEncryptedUpload(selectedFile.name, encryptedJsonString, tokenId);
      } catch (e: any) {
        console.error("Error during encryption process:", e);
        setStatus(`Process failed: ${e.message}`);
        setError(`Process failed: ${e.message}`);
        setIsLoading(false);
      }
    };
    processTransactionAndEncrypt();
  }, [receipt]);

  useEffect(() => {
    const fetchProjects = async () => {
      setAreProjectsLoading(true);
      try {
        const projectsResponse = await fetch(`${API_BASE}/projects`);
        setProjects(await projectsResponse.json());
      } catch (err) { console.error("Failed to fetch projects", err); }
      finally { setAreProjectsLoading(false); }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [dataType, selectedProjectId]);
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setStatus(`Selected: "${files[0].name}". Ready to process.`);
      setError(null);
      setSuccessInfo(null);
      setLogAdded(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files);
  };
  
  // --- RENDER ---
  const isProcessing = isPending || isConfirming || isLitLoading || isLoading;
  const selectedProjectObject = projects.find(p => p.id === Number(selectedProjectId));
  const canLogToNft = selectedProjectObject && selectedProjectObject.nft_id && successInfo?.projectId === selectedProjectObject.id;
  const historyTitle = `${selectedProjectObject ? selectedProjectObject.name : 'General'} - ${dataType.charAt(0).toUpperCase() + dataType.slice(1)} History`;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Ingest Data</h1>
        {isConnected ? (
          <div className="text-right">
            <p className="text-sm text-green-400">Connected: {`${address?.substring(0, 6)}...`}</p>
            <button onClick={() => disconnect()} className="text-xs text-gray-400 hover:text-white">Disconnect</button>
          </div>
        ) : (
          <button onClick={() => connect({ connector: connectors[0] })} className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-500">Connect Wallet</button>
        )}
      </div>

      <p className="text-gray-400 mb-8">Upload documents or experiment data. Associate with a project and optionally encrypt with an on-chain key.</p>
      
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <div
          className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors duration-300 relative cursor-pointer ${isDragging ? 'border-blue-500 bg-gray-800/50' : 'border-gray-600 hover:border-gray-500'}`}
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
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">1. Select Data Type</label>
            <div className="flex gap-4 p-1 bg-gray-900/50 rounded-lg">
              <button onClick={() => setDataType('paper')} className={`flex-1 text-sm py-2 rounded-md transition-colors ${dataType === 'paper' ? 'bg-blue-600 shadow' : 'bg-transparent text-gray-400 hover:bg-gray-700'}`}>Article / Paper</button>
              <button onClick={() => setDataType('experiment')} className={`flex-1 text-sm py-2 rounded-md transition-colors ${dataType === 'experiment' ? 'bg-blue-600 shadow' : 'bg-transparent text-gray-400 hover:bg-gray-700'}`}>Experiment Data</button>
            </div>
          </div>
          <div>
            <label htmlFor="project-select" className="block text-sm font-medium text-gray-300 mb-2">2. Associate with Project</label>
            <select id="project-select" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={areProjectsLoading || isProcessing} className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
              <option value="">General (No Project)</option>
              {projects.map(project => (<option key={project.id} value={project.id.toString()}>{project.name}</option>))}
            </select>
          </div>
        </div>
        
        {dataType === 'experiment' && (
          <div className="mt-4">
            <label htmlFor="expTitle" className="block text-sm font-medium text-gray-300 mb-1">Experiment Title</label>
            <input id="expTitle" type="text" value={experimentTitle} onChange={(e) => setExperimentTitle(e.target.value)} placeholder="e.g., Compound XYZ Synthesis, Run 1" className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
          </div>
        )}
      </div>
      
      <div className="mt-4 flex items-center justify-center p-3 bg-gray-900/50 rounded-lg">
        <input id="encrypt-toggle" type="checkbox" checked={encryptFile} onChange={(e) => setEncryptFile(e.target.checked)} className="h-4 w-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"/>
        <label htmlFor="encrypt-toggle" className="ml-3 block text-sm font-medium text-gray-300">Encrypt this file with an on-chain key via Lit Protocol</label>
        <KeyIcon className="h-5 w-5 ml-2 text-amber-400"/>
      </div>

      <button
        onClick={handleProcessFileClick}
        disabled={!selectedFile || isProcessing || (dataType === 'experiment' && !experimentTitle.trim())}
        className="w-full mt-6 bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
      >
        <ArrowUpTrayIcon className="h-6 w-6 mr-2" />
        {isProcessing ? status : `Process & Upload ${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`}
      </button>

      {contractError && <p className="text-red-400 mt-2 text-center text-sm">Wallet Error: {contractError.shortMessage}</p>}

      <div className="mt-6 text-center min-h-[100px] flex items-center justify-center">
        {isProcessing && (<div className="flex flex-col items-center text-blue-300"><ArrowPathIcon className="h-12 w-12 text-blue-400 animate-spin mb-3" /><p className="text-lg font-medium">{status}</p></div>)}
        {!isProcessing && error && (<div className="w-full bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">An Error Occurred</h3><p className="text-sm">{error}</p></div></div>)}
        {!isProcessing && successInfo && (
          <div className="w-full text-left bg-green-900/50 border border-green-700 text-green-200 p-4 rounded-lg space-y-3">
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold">Success!</h3>
                <p className="text-sm">{successInfo.message}</p>
                <p className="text-xs text-gray-400 mt-1 truncate" title={successInfo.cid}>CID: {successInfo.cid}</p>
              </div>
            </div>
            {canLogToNft && (
                <div className="pt-3 border-t border-green-700/50">
                    {logAdded ? (
                        <p className="text-sm text-center text-purple-300 font-semibold flex items-center justify-center"><CheckCircleIcon className="h-5 w-5 mr-2"/>Added to on-chain log!</p>
                    ) : (
                        <button onClick={handleAddToLog} disabled={isLogging} className="w-full flex items-center justify-center bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-wait">
                            {isLogging ? <ArrowPathIcon className="h-5 w-5 animate-spin"/> : <><SparklesIcon className="h-5 w-5 mr-2" /><span>Add to On-Chain Log</span></>}
                        </button>
                    )}
                </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-10 gap-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{historyTitle}</h2>
          </div>
          <div className="bg-gray-800 rounded-lg shadow">
            <ul className="divide-y divide-gray-700">
              {historyData.length > 0 ? (historyData.map((item) => (<li key={item.cid} className="p-4 flex items-start space-x-4"><div className="flex-shrink-0"><DocumentTextIcon className="h-8 w-8 text-gray-400 mt-1" /></div><div className="flex-grow overflow-hidden"><p className="text-lg font-semibold text-white truncate" title={item.title}>{item.title || 'Untitled Document'}</p>{item.authors && item.authors.length > 0 && (<p className="text-sm text-gray-400 mt-1 truncate" title={item.authors.join(', ')}>by {item.authors.join(', ')}</p>)}<div className="text-xs text-gray-500 mt-2 space-x-4">{item.doi && (<a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">DOI: {item.doi}</a>)}<span className="truncate" title={item.cid}>CID: {item.cid}</span></div>{item.keywords && item.keywords.length > 0 && (<div className="mt-3 flex flex-wrap gap-2">{item.keywords.map((keyword, index) => (<span key={index} className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-full">{keyword}</span>))}</div>)}</div>{item.year && (<div className="flex-shrink-0 text-right"><p className="text-base font-medium text-white">{item.year}</p></div>)}</li>))) : (<li className="p-4 text-center text-gray-500">{isDataLoading ? 'Loading history...' : 'No items found for this selection.'}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataIngestionPage;