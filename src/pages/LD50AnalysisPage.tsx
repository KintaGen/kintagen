import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { XCircleIcon, ShieldCheckIcon, LockClosedIcon } from '@heroicons/react/24/solid'; // Added Icons
import { useJobs, type Job } from '../contexts/JobContext';
import { useFlowCurrentUser, useFlowConfig, TransactionDialog, useFlowMutate } from '@onflow/react-sdk';
import JSZip from 'jszip';
import { upload } from '@vercel/blob/client'; 

// --- Nostr Imports ---
import { useNostr } from '../contexts/NostrContext';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';

import { getAddToLogTransaction } from '../flow/cadence';
import { useOwnedNftProjects } from '../flow/kintagen-nft';
import { useLighthouse } from '../hooks/useLighthouse';
import { AnalysisSetupPanel } from '../components/analysis/ld50/AnalysisSetupPanel';
import { AnalysisResultsDisplay } from '../components/analysis/ld50/AnalysisResultsDisplay';
import { AnalysisJobsList } from '../components/analysis/AnalysisJobsList';
import { generateDataHash } from '../utils/hash';

// Firebase
import { logEvent } from "firebase/analytics";
import { analytics } from '../services/firebase';
import { type ProjectWithStringId, type DisplayJob } from '../types';

export type { DisplayJob } from '../types';
type Project = ProjectWithStringId;
export const DEMO_PROJECT_ID = 'demo-project';
const KINTAGEN_APP_DATA_TAG = 'kintagen_science_data';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol'
];

const LD50AnalysisPage: React.FC = () => {
  usePageTitle('LD50 Dose-Response Analysis - KintaGen');
  
  // --- Contexts ---
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { jobs, setJobs } = useJobs();
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile, error: uploadError } = useLighthouse();
  
  // --- Nostr Context ---
  const { pubkey, privKey, connect } = useNostr(); 

  // --- State ---
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [validatedCsvData, setValidatedCsvData] = useState<string | null>(null);
  
  // Loading States
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);

  // New State for Secure Options
  const [includeSecureData, setIncludeSecureData] = useState(true);

  const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();

  // --- Effect: Auto-enable secure data if Nostr is connected ---
  useEffect(() => {
    if (pubkey && privKey) {
        setIncludeSecureData(true);
    }
  }, [pubkey, privKey]);

  // --- Job Polling useEffect (Existing) ---
  useEffect(() => {
    const activeJobs = jobs.filter(job => (job.state === 'waiting' || job.state === 'processing') && job.kind === 'ld50');
    if (activeJobs.length === 0) return;
    const intervalId = setInterval(async () => {
      let jobsWereUpdated = false;
      const updatedJobs = await Promise.all(jobs.map(async (job) => {
        if (job.kind !== 'ld50' || (job.state !== 'waiting' && job.state !== 'processing')) return job;
        try {
          const response = await fetch(`/api/jobs/status/${job.id}`);
          if (!response.ok) {
            if (response.status === 404 && job.state !== 'waiting') { jobsWereUpdated = true; return { ...job, state: 'failed', failedReason: 'Job not found on server.' }; }
            return job;
          }
          const serverJob = await response.json();
          const newClientState = serverJob.status === 'completed' || serverJob.status === 'failed' ? serverJob.status : 'processing';
          if (newClientState !== job.state) {
            jobsWereUpdated = true;
            return { ...job, state: newClientState, returnvalue: serverJob.result || job.returnvalue, failedReason: serverJob.error || job.failedReason };
          }
        } catch (e) { console.error("Polling error for job", job.id, e); }
        return job;
      }));
      if (jobsWereUpdated) setJobs(updatedJobs);
    }, 4000);
    return () => clearInterval(intervalId);
  }, [jobs, setJobs]);

  // --- Memoized Job Display Logic (Existing) ---
  const displayJobs = useMemo((): DisplayJob[] => {
    if (selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project) return [];
      
      const onChainLogs: DisplayJob[] = (project.story || [])
        .filter(step => step.title.startsWith("LD50 Analysis"))
        .map((step, index) => {
            // FIX: Clean the hash extraction
            // 1. Get everything after "input hash: "
            const rawSegment = step.description.split('input hash: ')[1] || '';
            // 2. Take only the first part before any spaces or pipes (removes "| 🔒 Encrypted...")
            const cleanHash = rawSegment.split(' ')[0].trim();

            return { 
                id: `log-${project.id}-${index}`, 
                label: step.title, 
                projectId: project.id, 
                state: 'logged', 
                logData: step, 
                inputDataHash: cleanHash 
            };
        });
      
      // Create a Set of hashes that are already logged
      const loggedInputHashes = new Set(onChainLogs.map(log => log.inputDataHash).filter(Boolean));
      
      const localJobs: DisplayJob[] = jobs
        .filter(job => job.kind === 'ld50' && job.projectId === selectedProjectId)
        // FIX: Now this comparison works because both hashes are clean
        .filter(job => !loggedInputHashes.has(job.inputDataHash!))
        .map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any, inputDataHash: job.inputDataHash! }));
        
      return [...onChainLogs, ...localJobs];
    }
    
    // Demo Project Logic (Unchanged)
    return jobs.filter(job => job.kind === 'ld50' && job.projectId === DEMO_PROJECT_ID).map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any, inputDataHash: job.inputDataHash! }));
  }, [selectedProjectId, projects, jobs]);
  
  // --- Run Analysis Logic (Existing) ---
  const handleRunAnalysis = async () => {
    setPageError(null);
    setViewedJob(null);
    setIsAnalysisRunning(true);
    const isDemo = !selectedProjectId || selectedProjectId === DEMO_PROJECT_ID;
    const inputDataString = validatedCsvData || "";
    const inputDataHash = await generateDataHash(inputDataString);
    const jobLabel = `LD50 Analysis (${inputDataHash.substring(0, 8)})`;
    const tempId = `temp_job_${Date.now()}`;
    logEvent(analytics, 'run_analysis', { analysis_type: 'ld50', data_source_hash: inputDataHash, is_demo: isDemo });
    const newJob: Job = { id: tempId, kind: 'ld50', label: jobLabel, projectId: selectedProjectId || DEMO_PROJECT_ID, createdAt: Date.now(), state: 'waiting', inputDataHash: inputDataHash };
    setJobs(prev => [newJob, ...prev]);
    try {
      const dataFile = new File([inputDataString], `${inputDataHash}_ld50.csv`, { type: "text/csv" });
      const blob = await upload(dataFile.name, dataFile, { access: 'public', handleUploadUrl: '/api/jobs/upload-token' });
      const response = await fetch('/api/jobs/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: blob.url, originalFilename: dataFile.name, analysisType: 'drc', inputDataHash: inputDataHash, }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create job on the server.');
      setJobs(prevJobs => prevJobs.map(j => j.id === tempId ? { ...j, id: result.jobId, state: 'processing' } : j));
    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => j.id === tempId ? { ...j, state: 'failed', failedReason: e.message } : j));
      setPageError(`Failed to start analysis: ${e.message}`);
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  const toBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // --- MAIN LOGIC: LOG TO CHAIN + NOSTR APP DATA ---
  const handleViewAndLogResults = async (job: DisplayJob) => {
    setPageError(null);
    setViewedJob(null);

    // Case 1: View Results
    if (job.state === 'logged') {
        // ... (existing view logic) ...
        setIsFetchingLog(true);
        setJobIdBeingLogged(job.id);
        try {
          const cid = job.logData?.ipfsHash;
          if (!cid) throw new Error("No IPFS CID found for this on-chain log.");
          const gatewayUrl = `https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${cid}`;
          const response = await fetch(gatewayUrl);
          if (!response.ok) throw new Error(`Failed to fetch artifact from IPFS.`);
          const zipBlob = await response.blob();
          const zip = await JSZip.loadAsync(zipBlob);
          
          const metricsFile = zip.file("ld50_metrics.json");
          const plotFile = zip.file("ld50_plot.png");
          
          const metadataFile = zip.file("metadata.json");
          let secureDataInfo = null;
          if (metadataFile) {
              const meta = JSON.parse(await metadataFile.async("string"));
              if (meta.secure_data) secureDataInfo = meta.secure_data;
          }

          if (!metricsFile || !plotFile) throw new Error("Artifact is missing required files.");
          
          const metrics = JSON.parse(await metricsFile.async("string"));
          const plotBase64 = await toBase64(await plotFile.async("blob"));
          
          const reconstructedReturnvalue = {
              results: { ...metrics, plot_b64: plotBase64 },
              status: 'success',
              secureDataInfo
          };
          
          setViewedJob({ ...job, returnvalue: reconstructedReturnvalue, inputDataHash: job.inputDataHash });
        } catch (error: any) {
          setPageError(`Failed to load on-chain data: ${error.message}`);
        } finally {
          setIsFetchingLog(false);
          setJobIdBeingLogged(null);
        }
        return;
    }
    
    // Case 2: Log to Chain
    if (job.state === 'completed') {
      if (job.projectId === DEMO_PROJECT_ID) {
        setViewedJob(job);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (job.projectId !== DEMO_PROJECT_ID && user?.addr) {
        setIsLogging(true);
        setJobIdBeingLogged(job.id);
        
        try {
          const project = projects.find(p => p.id === job.projectId);
          if (!project?.nft_id) throw new Error("Project NFT ID not found.");
          const results = job.returnvalue;
          const plotBase64 = results?.results?.plot_b64?.split(',')[1];
          if (!plotBase64) throw new Error("No plot found to save.");
          
          let secureDataMeta = null;

          // --- NOSTR: KIND 30078 (APP DATA) ---
          if (includeSecureData && validatedCsvData) {
              const currentHash = await generateDataHash(validatedCsvData);
              if (currentHash !== job.inputDataHash) {
                  console.warn("Hash mismatch, skipping secure upload.");
              } else {
                  // JIT Login
                  let userPubkey = pubkey;
                  let userPrivKey = privKey;

                  if (!userPubkey || !userPrivKey) {
                      const confirmLogin = window.confirm("To encrypt this data securely and add it to your profile, you need to sign. Proceed?");
                      if (confirmLogin) {
                          const keys = await connect();
                          if (keys) {
                              userPubkey = keys.pubkey;
                              userPrivKey = keys.privKey;
                          } else {
                              if (!window.confirm("Secure login failed. Log to blockchain WITHOUT secure data?")) {
                                  setIsLogging(false);
                                  setJobIdBeingLogged(null);
                                  return;
                              }
                          }
                      }
                  }

                  if (userPubkey && userPrivKey) {
                      console.log("🔒 Encrypting Raw Data with Nostr Keys...");
                      
                      // 1. Encrypt
                      const conversationKey = nip44.v2.utils.getConversationKey(userPrivKey, userPubkey);
                      const encryptedCsv = nip44.v2.encrypt(validatedCsvData, conversationKey);
                      
                      // 2. Upload
                      const blob = new Blob([encryptedCsv], { type: 'text/plain' });
                      const encFile = new File([blob], `data_${job.inputDataHash.substring(0,6)}.enc`);
                      const encCid = await uploadFile(encFile);
                      
                      if (encCid) {
                          console.log("📝 Updating Nostr App Data (Kind 30078)...");
                          
                          const pool = new SimplePool();
                          
                          // 3. FETCH EXISTING DATA (Read)
                          // We check if the user already has a KintaGen data list
                          let currentData = {};
                          try {
                              const existingEvent = await pool.get(RELAYS, {
                                  kinds: [30078],
                                  authors: [userPubkey],
                                  '#d': [KINTAGEN_APP_DATA_TAG]
                              });
                              if (existingEvent) {
                                  currentData = JSON.parse(existingEvent.content);
                              }
                          } catch (e) {
                              console.log("No existing data found, creating new.", e);
                          }

                          // 4. APPEND NEW DATA (Modify)
                          // We use the input hash as the key
                          currentData[job.inputDataHash] = {
                              type: 'ld50',
                              project: project.name,
                              nft_id: project.nft_id,
                              ipfs_cid: encCid,
                              timestamp: new Date().toISOString()
                          };

                          // 5. PUBLISH UPDATE (Write)
                          const eventTemplate = {
                              kind: 30078, // Application Specific Data (Replaceable)
                              created_at: Math.floor(Date.now() / 1000),
                              tags: [
                                  ['d', KINTAGEN_APP_DATA_TAG], // Identifier tag
                                  ['t', 'scientific-data']
                              ],
                              content: JSON.stringify(currentData)
                          };

                          const signedEvent = finalizeEvent(eventTemplate, userPrivKey);
                          await Promise.any(pool.publish(RELAYS, signedEvent));

                          secureDataMeta = {
                              ipfs_cid: encCid,
                              nostr_event_id: signedEvent.id, // ID of the update event
                              nostr_pubkey: userPubkey,
                              encryption_algo: "nip44",
                              storage_type: "kind:30078"
                          };
                      }
                  }
              }
          }

          // --- PREPARE ZIP & MINT (Existing) ---
          const metricsJsonString = JSON.stringify(results.results, null, 2);
          const metadata = {
            schema_version: "1.1.0",
            analysis_agent: "KintaGen LD50 Agent v1.0",
            timestamp_utc: new Date().toISOString(),
            input_data_hash_sha256: job.inputDataHash,
            secure_data: secureDataMeta,
            outputs: [
              { filename: "ld50_plot.png", hash_sha256: await generateDataHash(plotBase64) }, 
              { filename: "ld50_metrics.json", hash_sha256: await generateDataHash(metricsJsonString) }
            ]
          };

          const zip = new JSZip();
          zip.file("metadata.json", JSON.stringify(metadata, null, 2));
          zip.file("ld50_plot.png", plotBase64, { base64: true });
          zip.file("ld50_metrics.json", metricsJsonString);
          
          const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact_${job.inputDataHash.substring(0,8)}.zip`);
          const cid = await uploadFile(zipFile);
          
          if (!cid) throw new Error(uploadError || "Failed to get CID from IPFS upload.");
          
          const addresses = { KintaGenNFT: flowConfig.addresses["KintaGenNFT"], NonFungibleToken: "", ViewResolver: "", MetadataViews: "" };
          const cadence = getAddToLogTransaction(addresses);
          
          let logDescription = `Analysis results for input hash: ${job.inputDataHash}`;
          if (secureDataMeta) {
              logDescription += ` | 🔒 Encrypted Data Linked`;
          }

          await executeTransaction({ 
            cadence, 
            args: (arg, t) => [arg(project.nft_id, t.UInt64), arg("KintaGen LD50 Agent", t.String), arg(job.label, t.String), arg(logDescription, t.String), arg(cid, t.String)], 
            limit: 9999 
          });
        } catch (error: any) {
          setPageError(`Failed to log results: ${error.message}`);
          setIsLogging(false);
          setJobIdBeingLogged(null);
        }
      }
    }
  };
  
  // --- Transaction Results (Existing) ---
  useEffect(() => {
    if (isTxSuccess && txId) {
      setDialogTxId(txId as string);
      setIsDialogOpen(true);
    }
    if (isTxError && txError) {
      const errorMessage = (txError as Error).message.includes("User rejected") ? "Transaction cancelled by user." : (txError as Error).message;
      setPageError(`Transaction failed: ${errorMessage}`);
      setIsLogging(false);
      setJobIdBeingLogged(null);
    }
  }, [isTxSuccess, isTxError, txId, txError]);

  const overallIsLogging = isLogging || isTxPending || isFetchingLog;

  return (
    <>
      <Helmet>
        <title>LD50 Dose-Response Analysis - KintaGen</title>
      </Helmet>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-4">LD50 Dose-Response Analysis</h1>
        <p className="text-gray-400 mb-8">Select the Demo Project or one of your on-chain projects to run an analysis.</p>
        

        <AnalysisSetupPanel
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={(id) => { setSelectedProjectId(id); setViewedJob(null); setPageError(null); }}
          onRunAnalysis={handleRunAnalysis}
          isLoadingProjects={isLoadingProjects}
          projectsError={projectsError}
          isWebRReady={true}
          webRInitMessage={'Server Ready'}
          isAnalysisRunning={isAnalysisRunning}
          onDataValidated={(csvString) => setValidatedCsvData(csvString)}
          onDataCleared={() => setValidatedCsvData(null)}
          validatedCsvData={validatedCsvData}
        />
        {/* --- Secure Data Indicator --- */}
        {validatedCsvData && selectedProjectId !== DEMO_PROJECT_ID && (
            <div className="mb-4 flex items-center gap-3 bg-blue-900/20 border border-blue-800 p-3 rounded-lg">
                <ShieldCheckIcon className={`h-5 w-5 ${pubkey ? 'text-green-400' : 'text-gray-400'}`} />
                <div className="flex-1">
                    <p className="text-sm text-gray-200">
                        <strong>Secure Raw Data:</strong> Encrypt and attach raw CSV to the blockchain log.
                        {!pubkey && <span className="text-xs text-blue-300 block"> (Will prompt for Nostr signature)</span>}
                    </p>
                </div>
                <div className="flex items-center">
                    <input 
                        type="checkbox" 
                        checked={includeSecureData} 
                        onChange={(e) => setIncludeSecureData(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                </div>
            </div>
        )}
        {pageError && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg my-4 flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{pageError}</p></div></div> )}
        
        {viewedJob && (
          <AnalysisResultsDisplay
            job={viewedJob}
            isLoading={isFetchingLog && jobIdBeingLogged === viewedJob.id}
          />
        )}
        
        <AnalysisJobsList
          jobs={displayJobs}
          onClearJobs={() => {
            const idToClear = selectedProjectId || DEMO_PROJECT_ID;
            setJobs(prev => prev.filter(j => j.projectId !== idToClear));
          }}
          onViewAndLogResults={handleViewAndLogResults}
          jobIdBeingLogged={jobIdBeingLogged}
          isLoggingAnyJob={overallIsLogging}
        />
      </div>
      
      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => { 
          setIsDialogOpen(isOpen); 
          if (!isOpen) {
            setJobIdBeingLogged(null);
            setIsLogging(false);
          }
        }}
        txId={dialogTxId || undefined}
        onSuccess={refetchProjects}
        pendingTitle="Logging Analysis to the Chain"
        successTitle="Log Entry Confirmed!"
        successDescription="Your analysis results have been permanently recorded. If you enabled Secure Mode, your encrypted raw data is also linked via Nostr."
      />
    </>
  );
};

export default LD50AnalysisPage;