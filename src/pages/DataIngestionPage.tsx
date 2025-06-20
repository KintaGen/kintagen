// src/pages/DataIngestionPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowUpTrayIcon, 
  DocumentTextIcon, 
  MagnifyingGlassIcon, 
  ArrowPathIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  BeakerIcon
} from '@heroicons/react/24/solid';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useLitFlow } from '../lit/useLitFlow';
import { accessKeyAbi } from '../lit/accessKeyAbi';
import { parseEventLogs } from 'viem';

// --- TYPE DEFINITIONS ---
interface ProcessedFile {
  originalFileName: string;
  uploadCid: string;
  litTokenId: string;
  encryptedJsonString: string;
}
interface CidInfo {
  cid: string;
  title: string;
  year: string;
  authors: string[];
  doi: string;
  keywords: string[];
}
interface SuccessInfo {
  message: string;
  cid: string;
  title: string;
}
// --- NEW Project Type Definition ---
interface Project {
  id: number;
  name: string;
}

const ACCESS_MANAGER_CONTRACT_ADDRESS = "0x5bc5A6E3dD358b67A752C9Dd58df49E863eA95F2";

const DataIngestionPage: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [encryptFile, setEncryptFile] = useState<boolean>(true);
  const [status, setStatus] = useState("Select a file to begin.");
  
  // High-level state for UI flow
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

  // Wallet & Contract State
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({ hash });
  const { encryptFileAndPackage, loading: isLitLoading, base64ToUint8Array } = useLitFlow();
  
  // Data display state
  const [cids, setCids] = useState<CidInfo[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- NEW STATE FOR PROJECTS ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(''); // Store the ID of the selected project
  const [areProjectsLoading, setAreProjectsLoading] = useState(true);

  // --- DATA HANDLING ---
  const fetchCIDs = async () => {
    setIsDataLoading(true);
    try {
      const resp = await fetch(`http://localhost:3001/api/data/paper`); 
      if (!resp.ok) throw new Error('Failed to fetch CID list');
      const jsonResponse = await resp.json();
      setCids(jsonResponse.data || []);
    } catch (err: any) {
      setError(`Failed to fetch history: ${err.message}`);
    } finally {
      setIsDataLoading(false);
    }
  };

  const processAndUploadPdf = async () => {
    if (!selectedFile) {
        alert("Please select a file.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccessInfo(null);
    setStatus('Preparing to upload...');

    const formData = new FormData();
    formData.append('pdfFile', selectedFile);

    // --- NEW: Append the selected project ID if it exists ---
    if (selectedProjectId) {
      formData.append('projectId', selectedProjectId);
    }

    try {
        setStatus('Extracting text & generating metadata...');
        const response = await fetch('http://localhost:3001/api/process-and-upload-paper', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        
        if (!response.ok || !result.rootCID) {
            throw new Error(result.error || 'Failed to process the PDF on the server.');
        }

        setStatus('Upload Complete!');
        setSuccessInfo({
            message: "Successfully processed and stored the paper!",
            cid: result.rootCID,
            title: result.title,
        });

        fetchCIDs();

    } catch (err: any) {
        console.error("Error processing PDF:", err);
        setError(err.message);
        setStatus('An error occurred during processing.');
    } finally {
        setIsLoading(false);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProcessFileClick = () => {
    if (!selectedFile) {
        alert("Please select a file first.");
        return;
    }

    if (encryptFile) {
        if (!isConnected) {
            alert("Please connect your wallet to encrypt a file.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessInfo(null);
        setStatus("Please approve transaction in your wallet...");
        writeContract({
            address: ACCESS_MANAGER_CONTRACT_ADDRESS,
            abi: accessKeyAbi,
            functionName: 'createKey',
            args: [selectedFile.name]
        });
    } else {
        processAndUploadPdf();
    }
  };

  // --- EFFECTS ---
  // Effect for the encryption flow
  useEffect(() => {
    // ... This effect can also be updated to pass projectId to its upload handler
  }, [receipt, selectedFile]);

  // Combined effect to fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      setAreProjectsLoading(true);
      try {
        const projectsResponse = await fetch('http://localhost:3001/api/projects');
        if (!projectsResponse.ok) console.error('Could not fetch projects');
        const projectsData: Project[] = await projectsResponse.json();
        setProjects(projectsData);
      } catch (err) {
        console.error("Failed to fetch projects for dropdown:", err);
      } finally {
        setAreProjectsLoading(false);
      }
      // Fetch CIDs after projects
      fetchCIDs();
    };
    
    fetchInitialData();
  }, [filter]); // Re-fetch CIDs when filter changes

  // --- UI HANDLERS ---
  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setStatus(`Selected: "${files[0].name}". Ready to process.`);
      setError(null);
      setSuccessInfo(null);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files);
  };

  // --- RENDER ---
  const isProcessing = isPending || isConfirming || isLitLoading || isLoading;

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

      <p className="text-gray-400 mb-8">Upload documents to the knowledge base. Select a project to categorize your data or leave it as "General".</p>
      
      {/* Uploader Section with Project Dropdown */}
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
        
        {/* Project Selection Dropdown */}
        <div className="mt-6">
          <label htmlFor="project-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
            <BeakerIcon className="h-5 w-5 mr-2 text-cyan-400" />
            Associate with Project
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={areProjectsLoading || isProcessing}
            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-700/50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <option value="">General (No Project)</option>
            {projects.map(project => (
              <option key={project.id} value={project.id.toString()}>
                {project.name}
              </option>
            ))}
          </select>
          {projects.length === 0 && !areProjectsLoading && (
            <p className="text-xs text-amber-400 mt-2">
              No projects found. This upload will be categorized as "General". You can create new research projects on the Projects page.
            </p>
          )}
        </div>
      </div>
      
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
      
      <button
        onClick={handleProcessFileClick}
        disabled={!selectedFile || isProcessing}
        className="w-full mt-4 bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
      >
        <ArrowUpTrayIcon className="h-6 w-6 mr-2" />
        {isProcessing ? status : (encryptFile ? 'Create Key, Encrypt & Upload' : 'Process & Upload Paper')}
      </button>

      {/* Dynamic Status/Result Area */}
      <div className="mt-6 text-center min-h-[100px] flex items-center justify-center">
        {isProcessing && (
          <div className="flex flex-col items-center text-blue-300">
            <ArrowPathIcon className="h-12 w-12 text-blue-400 animate-spin mb-3" />
            <p className="text-lg font-medium">{status}</p>
          </div>
        )}
        
        {!isProcessing && error && (
          <div className="w-full bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg flex items-start space-x-3">
            <XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold">Processing Failed</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {!isProcessing && successInfo && (
          <div className="w-full bg-green-900/50 border border-green-700 text-green-200 p-4 rounded-lg flex items-start space-x-3">
            <CheckCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold">Success!</h3>
              <p className="text-sm">{successInfo.message}</p>
              <p className="text-xs text-gray-400 mt-1 truncate" title={successInfo.cid}>
                CID: {successInfo.cid}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* History Sections */}
      <div className="mt-10 gap-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Total Ingestion History</h2>
            <div className="relative">
              <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by title..."
                className="bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none"/>
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow">
            <ul className="divide-y divide-gray-700">
              {cids.length > 0 ? (
                cids.map((item) => (
                  <li key={item.cid} className="p-4 flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <DocumentTextIcon className="h-8 w-8 text-gray-400 mt-1" />
                    </div>
                    <div className="flex-grow overflow-hidden">
                      <p className="text-lg font-semibold text-white truncate" title={item.title}>
                        {item.title || 'Untitled Document'}
                      </p>
                      {item.authors && item.authors.length > 0 && (
                        <p className="text-sm text-gray-400 mt-1 truncate" title={item.authors.join(', ')}>
                          by {item.authors.join(', ')}
                        </p>
                      )}
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
                    <div className="flex-shrink-0 text-right">
                      <p className="text-base font-medium text-white">{item.year}</p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="p-4 text-center text-gray-500">
                  {isDataLoading ? 'Loading history...' : 'No files found.'}
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