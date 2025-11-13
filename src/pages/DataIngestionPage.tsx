// src/pages/DataIngestionPage.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { flowEvmTestnet } from '../config/chain';
import {
  ArrowUpTrayIcon, DocumentTextIcon,
  ArrowPathIcon, CheckCircleIcon, XCircleIcon,
  SparklesIcon, KeyIcon, LockClosedIcon
} from '@heroicons/react/24/solid';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
// MODIFIED: Added useFlowTransactionStatus import
import { useFlowCurrentUser, useFlowMutate, useFlowTransactionStatus } from '@onflow/react-sdk';
import { tx } from "@onflow/fcl";
import { addToLog } from '../flow/kintagen-nft'; 

import { useLitFlow } from '../lit/useLitFlow';
import { accessKeyAbi } from '../lit/accessKeyAbi';
import { parseEventLogs } from 'viem';
import FileViewer from '../components/FileViewer';
import { useJobs } from '../contexts/JobContext'; // Import the global job context hook
import { type Job } from '../utils/jobs'; // We only need the Job type
import { type GenericDataInfo, type SuccessInfo, type ProjectWithNumberId } from '../types';

// Use ProjectWithNumberId for API responses
type Project = ProjectWithNumberId;

const ACCESS_MANAGER_CONTRACT_ADDRESS = "0x5bc5A6E3dD358b67A752C9Dd58df49E863eA95F2";
const TARGET_CHAIN = flowEvmTestnet;

const DataIngestionPage: React.FC = () => {
  usePageTitle('Data Ingestion - KintaGen');
  
  // Use the global job state, removing all local job management
  const { jobs, setJobs } = useJobs();

  // Page-specific state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dataType, setDataType] = useState<'paper' | 'experiment'>('paper');
  const [experimentTitle, setExperimentTitle] = useState('');
  const [viewingItem, setViewingItem] = useState<GenericDataInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [areProjectsLoading, setAreProjectsLoading] = useState(true);
  const [encryptFile, setEncryptFile] = useState(false);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<GenericDataInfo[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  
  const [latestJobId, setLatestJobId] = useState<string | null>(null);
  const [loggingCid, setLoggingCid] = useState<string | null>(null);

  // Web3 state
  const { isConnected, address, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: hash, writeContract, isPending: isWalletPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({ hash });
  const { encryptFileAndPackage, loading: isLitLoading } = useLitFlow();
  const { user, authenticate } = useFlowCurrentUser();
  const { mutate: sendAddToLogTx, isPending: isSubmittingToChain, data: logTxId, reset: resetLogMutate } = useFlowMutate();
  
  // ADDED: Hook to get detailed transaction status for the logging action
  const { transactionStatus } = useFlowTransactionStatus({ id: logTxId || '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

  // --- DERIVED STATE FROM GLOBAL JOBS ---
  const latestJob = useMemo(() => jobs.find(j => j.id === latestJobId), [jobs, latestJobId]);
  const isProcessing = useMemo(() => {
    if (isWalletPending || isConfirming || isLitLoading) return true;
    if (latestJob) return latestJob.state !== 'completed' && latestJob.state !== 'failed';
    return false;
  }, [isWalletPending, isConfirming, isLitLoading, latestJob]);
  
  const successInfo = useMemo(() => (latestJob?.state === 'completed' ? latestJob.returnvalue as SuccessInfo : null), [latestJob]);
  const processError = useMemo(() => (latestJob?.state === 'failed' ? latestJob.failedReason : null), [latestJob]);

  // --- DATA HANDLING & EFFECTS ---
  const fetchHistory = async () => {
    setIsDataLoading(true);
    setHistoryData([]);
    let queryParams = new URLSearchParams();
    queryParams.append('projectId', selectedProjectId);
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

  const addJobToGlobalState = (jobId: string, label: string) => {
    const newJob: Job = {
      id: jobId,
      kind: 'upload-file',
      label,
      projectId: selectedProjectId ? Number(selectedProjectId) : null,
      createdAt: Date.now(),
      state: 'waiting',
      progress: 0,
    };
    setJobs(prev => [newJob, ...prev]);
    setLatestJobId(jobId);
  };
  
  const handleUpload = async (formData: FormData, originalFileName: string) => {
    try {
      const response = await fetch(`${API_BASE}/upload?async=1`, { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload initiation failed.');
      addJobToGlobalState(result.jobId, originalFileName);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleProcessFileClick = () => {
    if (!selectedFile) return;
    setLatestJobId(null);
    if (encryptFile) {
      if (!isConnected) return alert("Please connect your wallet to encrypt files.");
      writeContract({ address: ACCESS_MANAGER_CONTRACT_ADDRESS, abi: accessKeyAbi, functionName: 'createKey', args: [selectedFile.name] });
    } else {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('dataType', dataType);
      formData.append('isEncrypted', 'false');
      if (selectedProjectId) formData.append('projectId', selectedProjectId);
      if (dataType === 'experiment') formData.append('title', experimentTitle);
      handleUpload(formData, selectedFile.name);
    }
  };

  const handleAddToLog = async (itemToLog: GenericDataInfo) => {
    const projectForLog = projects.find(p => p.id === itemToLog.project_id);
    if (!projectForLog || !projectForLog.nft_id || !user?.loggedIn) {
      if (!user?.loggedIn) authenticate();
      console.error("Cannot log: Missing info or user not authenticated.", { itemToLog, projectForLog, user });
      return;
    }
    setLoggingCid(itemToLog.cid);
    resetLogMutate();
    const actionDescription = `Ingested data: "${itemToLog.title}"`;
    try {
      await addToLog(sendAddToLogTx, {
        nftId: projectForLog.nft_id,
        agent: user.addr,
        actionDescription: actionDescription,
        outputCID: itemToLog.cid
      });
    } catch (err: any) {
      console.error(`Failed to submit 'add to log' transaction: ${err.message}`);
      setLoggingCid(null);
    }
  };

  const handleEncryptToggle = (isChecked: boolean) => {
    setEncryptFile(isChecked);
    if (isChecked && isConnected && chainId !== TARGET_CHAIN.id) {
      setNetworkWarning("Please ensure your wallet is on the Flow EVM Testnet to encrypt files.");
    } else {
      setNetworkWarning(null);
    }
  };

  useEffect(() => {
    if (logTxId) {
      const pollForResult = async () => {
        try {
          const sealedResult = await tx(logTxId).onceSealed();
          console.log("Add to Log TX Sealed:", sealedResult);
          if (sealedResult.status === 4 && sealedResult.errorMessage === "") {
            await fetchHistory();
          } else {
            throw new Error(sealedResult.errorMessage || "Transaction failed");
          }
        } catch (err: any) {
          console.error(`Failed to confirm log entry on-chain: ${err.message}`);
        } finally {
          setLoggingCid(null);
          resetLogMutate();
        }
      };
      pollForResult();
    }
  }, [logTxId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!receipt || !selectedFile) return;
    (async () => {
      if (receipt.status !== 'success') { return; }
      try {
        const logs = parseEventLogs({ abi: accessKeyAbi, logs: receipt.logs, eventName: 'KeyCreated' });
        const tokenId = ((logs[0] as any).args as { tokenId: bigint }).tokenId.toString();
        const encryptedJsonString = await encryptFileAndPackage(selectedFile);
        if (!encryptedJsonString) throw new Error("Lit encryption returned an empty result.");
        const encryptedBlob = new Blob([encryptedJsonString], { type: 'application/json' });
        const newFileName = selectedFile.name.toLowerCase() + '.enc.json';
        const formData = new FormData();
        formData.append('file', encryptedBlob, newFileName);
        formData.append('dataType', dataType);
        formData.append('isEncrypted', 'true');
        formData.append('litTokenId', tokenId);
        formData.append('title', dataType === 'paper' ? selectedFile.name : experimentTitle);
        if (selectedProjectId) formData.append('projectId', selectedProjectId);
        await handleUpload(formData, newFileName);
      } catch (e: any) { console.error("Error during encryption process:", e); }
    })();
  }, [receipt]); // eslint-disable-line react-hooks/exhaustive-deps
  
  useEffect(() => {
    (async () => {
      setAreProjectsLoading(true);
      try {
        const projectsResponse = await fetch(`${API_BASE}/projects`);
        setProjects(await projectsResponse.json());
      } catch (err) { console.error("Failed to fetch projects", err); }
      finally { setAreProjectsLoading(false); }
    })();
  }, []);
  
  useEffect(() => { fetchHistory(); }, [dataType, selectedProjectId]);
  useEffect(() => { if (successInfo) fetchHistory(); }, [successInfo]);

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setLatestJobId(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files); };

  return (
    <>
      <Helmet>
        <title>Data Ingestion - KintaGen</title>
        <meta name="description" content="Upload and register your research data files (papers, experiments) to create verifiable fingerprints. Optionally encrypt files for controlled access using Lit Protocol." />
        <meta name="keywords" content="data ingestion, file upload, data registration, encryption, Lit Protocol, research data" />
        <meta property="og:title" content="Data Ingestion - KintaGen" />
        <meta property="og:description" content="Upload and register your research data files with verifiable fingerprints." />
      </Helmet>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Ingest Data</h1>
          {isConnected ? (<div><p className="text-sm text-green-400">Connected: {`${address?.substring(0, 6)}...`}</p><button onClick={() => disconnect()} className="text-xs text-gray-400 hover:text-white">Disconnect</button></div>) : (<button onClick={() => connect({ connector: connectors[0] })} className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-500">Connect Wallet</button>)}
        </div>
        <p className="text-gray-400 mb-8">Upload documents or experiment data. Associate with a project and optionally encrypt with an on-chain key.</p>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors duration-300 relative cursor-pointer ${isDragging ? 'border-blue-500 bg-gray-800/50' : 'border-gray-600 hover:border-gray-500'}`} onClick={() => fileInputRef.current?.click()} onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDrop={handleDrop}>
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
          {dataType === 'experiment' && (<div className="mt-4"><label htmlFor="expTitle" className="block text-sm font-medium text-gray-300 mb-1">Experiment Title</label><input id="expTitle" type="text" value={experimentTitle} onChange={(e) => setExperimentTitle(e.target.value)} placeholder="e.g., Compound XYZ Synthesis, Run 1" className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" /></div>)}
        </div>
        <div className="mt-4 flex items-center justify-center p-3 bg-gray-900/50 rounded-lg">
          <input id="encrypt-toggle" type="checkbox" checked={encryptFile} onChange={(e) => handleEncryptToggle(e.target.checked)} className="h-4 w-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"/>
          <label htmlFor="encrypt-toggle" className="ml-3 block text-sm font-medium text-gray-300">Encrypt this file with an on-chain key via Lit Protocol</label>
          <KeyIcon className="h-5 w-5 ml-2 text-amber-400" />
        </div>
        {networkWarning && (<div className="mt-3 text-center text-amber-300 bg-amber-900/50 border border-amber-800 p-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-opacity duration-300"><LockClosedIcon className="h-5 w-5 flex-shrink-0" /><p>{networkWarning}</p></div>)}
        
        <button onClick={handleProcessFileClick} disabled={!selectedFile || isProcessing || (dataType === 'experiment' && !experimentTitle.trim())} className="w-full mt-6 bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center">
          <ArrowUpTrayIcon className="h-6 w-6 mr-2" />
          {isProcessing ? 'Processing...' : `Process & Upload ${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`}
        </button>
        {contractError && <p className="text-red-400 mt-2 text-center text-sm">Wallet Error: {contractError.message}</p>}
        
        <div className="mt-6 text-center min-h-[100px] flex items-center justify-center">
          {isProcessing && ( <div className="flex flex-col items-center text-blue-300"> <ArrowPathIcon className="h-12 w-12 text-blue-400 animate-spin mb-3" /> <p className="text-lg font-medium"> {isWalletPending ? 'Waiting for wallet confirmation...' : isConfirming ? 'Confirming transaction on-chain...' : isLitLoading ? 'Encrypting file...' : latestJob?.state === 'active' ? `Processing... (${latestJob.progress ?? 0}%)` : 'Job is queued...'} </p> </div> )}
          {processError && ( <div className="w-full bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg flex items-start space-x-3"> <XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /> <div><h3 className="font-bold">An Error Occurred</h3><p className="text-sm">{processError}</p></div> </div> )}
          {successInfo && ( <div className="w-full text-left bg-green-900/50 border border-green-700 text-green-200 p-4 rounded-lg space-y-3"> <div className="flex items-start space-x-3"><CheckCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /> <div><h3 className="font-bold">Success!</h3><p className="text-sm">{`File "${successInfo.title}" processed successfully.`}</p><p className="text-xs text-gray-400 mt-1 truncate" title={successInfo.cid}>CID: {successInfo.cid}</p></div> </div> </div> )}
        </div>
        <div className="mt-10 gap-8">
          <div>
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold">{dataType.charAt(0).toUpperCase() + dataType.slice(1)} History</h2></div>
            <div className="bg-gray-800 rounded-lg shadow">
              <ul className="divide-y divide-gray-700">
                {historyData.length > 0 ? (historyData.map((item) => {
                  const projectForItem = projects.find(p => p.id === item.project_id);
                  const canLogItem = projectForItem && projectForItem.nft_id && user?.loggedIn;

                  return (
                    <li key={item.cid} className="p-4 flex flex-col hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start space-x-4 w-full cursor-pointer" onClick={() => setViewingItem(item)}>
                        <div className="flex-shrink-0"><DocumentTextIcon className="h-8 w-8 text-gray-400 mt-1" /></div>
                        <div className="flex-grow overflow-hidden">
                          <p className="text-lg font-semibold text-white truncate flex items-center" title={item.title}>{item.is_encrypted && <LockClosedIcon className="h-4 w-4 mr-2 text-amber-400 flex-shrink-0" />}{item.title || 'Untitled Document'}</p>
                          {item.authors && item.authors.length > 0 && (<p className="text-sm text-gray-400 mt-1 truncate" title={item.authors.join(', ')}>by {item.authors.join(', ')}</p>)}
                          <div className="text-xs text-gray-500 mt-2 space-x-4">{item.doi && (<a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">DOI: {item.doi}</a>)}<span className="truncate" title={item.cid}>CID: {item.cid}</span></div>
                          {item.keywords && item.keywords.length > 0 && (<div className="mt-3 flex flex-wrap gap-2">{item.keywords.map((keyword, index) => (<span key={index} className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-full">{keyword}</span>))}</div>)}
                        </div>
                        {item.year && (<div className="flex-shrink-0 text-right"><p className="text-base font-medium text-white">{item.year}</p></div>)}
                      </div>

                      {/* --- NEW PER-ITEM LOGGING UI --- */}
                      {canLogItem && (
                        <div className="mt-3 pt-3 border-t border-gray-700/60 ml-12">
                          {item.is_logged ? (
                            <p className="text-sm text-center text-purple-300 font-semibold flex items-center justify-center">
                              <CheckCircleIcon className="h-5 w-5 mr-2" />
                              Added to on-chain log
                            </p>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddToLog(item); }}
                              disabled={isSubmittingToChain && loggingCid === item.cid}
                              className="w-full flex items-center justify-center bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-wait"
                            >
                              {/* --- MODIFIED: Dynamic Button Content --- */}
                              {(isSubmittingToChain && loggingCid === item.cid) ? (
                                <>
                                  <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                                  <span>{transactionStatus?.statusString || 'Submitting...'}</span>
                                </>
                              ) : (
                                <>
                                  <SparklesIcon className="h-5 w-5 mr-2" />
                                  <span>Add to On-Chain Log</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })) : (<li className="p-4 text-center text-gray-500">{isDataLoading ? 'Loading history...' : 'No items found for this selection.'}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
      {viewingItem && (<FileViewer item={viewingItem} onClose={() => setViewingItem(null)} />)}
    </>
  );
};

export default DataIngestionPage;