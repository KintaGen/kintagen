import React, { useState, useMemo, useEffect } from 'react';
import { XCircleIcon } from '@heroicons/react/24/solid';
import JSZip from 'jszip';
import { upload } from '@vercel/blob/client'; 

// Contexts and Hooks
import { useJobs, type Job } from '../contexts/JobContext';
import { useFlowCurrentUser, useFlowConfig, TransactionDialog, useFlowMutate } from '@onflow/react-sdk';
import { useOwnedNftProjects } from '../flow/kintagen-nft';
import { useLighthouse } from '../hooks/useLighthouse';
import { generateDataHash } from '../utils/hash';
import { getAddToLogTransaction } from '../flow/cadence';

// NMR specific components
import { NmrAnalysisSetupPanel } from '../components/analysis/nmr/NmrAnalysisSetupPanel';
import { NmrAnalysisResultsDisplay } from '../components/analysis/nmr/NmrAnalysisResultsDisplay';
import { AnalysisJobsList } from '../components/analysis/AnalysisJobsList';

// Firebase
import { logEvent } from "firebase/analytics";
import { analytics } from '../services/firebase';

// --- Type Definitions ---
interface Project { id: string; name: string; description: string; nft_id: string; story?: any[]; }

export interface DisplayJob {
  id: string;
  label: string;
  projectId: string;
  state: 'completed' | 'failed' | 'processing' | 'logged' | 'waiting';
  failedReason?: string;
  returnvalue?: any;
  logData?: any;
  inputDataHash?: string;
}

export const DEMO_PROJECT_ID = 'demo-project';

const NMRAnalysisPage: React.FC = () => {
  // --- State Hooks ---
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { jobs, setJobs } = useJobs();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  const [varianFile, setVarianFile] = useState<File | null>(null);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile, error: uploadError } = useLighthouse();
  const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();

  // Polling useEffect to monitor job status from the backend
  useEffect(() => {
    const activeJobs = jobs.filter(job => (job.state === 'waiting' || job.state === 'processing') && job.kind === 'nmr');
    if (activeJobs.length === 0) return;

    const intervalId = setInterval(async () => {
      let jobsWereUpdated = false;
      const updatedJobs = await Promise.all(jobs.map(async (job) => {
        if (job.kind !== 'nmr' || (job.state !== 'waiting' && job.state !== 'processing')) return job;
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

  // Memoized function to prepare jobs for display
  const displayJobs = useMemo((): DisplayJob[] => {
    if (selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project) return [];
      const onChainLogs: DisplayJob[] = (project.story || []).filter(step => step.title.startsWith("NMR analysis")).map((step, index) => ({ id: `log-${project.id}-${index}`, label: step.title, projectId: project.id, state: 'logged', logData: step, inputDataHash: step.description.split('input hash: ')[1] || '' }));
      const loggedInputHashes = new Set(onChainLogs.map(log => log.inputDataHash).filter(Boolean));
      const localJobs: DisplayJob[] = jobs.filter(job => job.kind === 'nmr' && job.projectId === selectedProjectId && !loggedInputHashes.has(job.inputDataHash!)).map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any, }));
      return [...onChainLogs, ...localJobs];
    }
    return jobs.filter(job => job.kind === 'nmr' && job.projectId === DEMO_PROJECT_ID).map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any, }));
  }, [selectedProjectId, projects, jobs]);

  // Function to start a new analysis job
  const handleRunAnalysis = async () => {
    if (!varianFile) { setPageError("Please select a Varian ZIP file to analyze."); return; }
    setPageError(null); setViewedJob(null); setIsAnalysisRunning(true);
    const isDemo = !selectedProjectId || selectedProjectId === DEMO_PROJECT_ID;
    const fileBuffer = await varianFile.arrayBuffer(); const inputDataHash = await generateDataHash(fileBuffer); const jobLabel = `NMR analysis of ${varianFile.name}`; const tempId = `temp_job_${Date.now()}`;
    logEvent(analytics, 'run_analysis', { analysis_type: 'nmr1DH', data_source_hash: inputDataHash, is_demo: isDemo });
    const newJob: Job = { id: tempId, kind: 'nmr', label: jobLabel, projectId: selectedProjectId || DEMO_PROJECT_ID, createdAt: Date.now(), state: 'waiting', inputDataHash };
    setJobs(prev => [newJob, ...prev]);
    try {
      const blob = await upload(varianFile.name, varianFile, { access: 'public', handleUploadUrl: '/api/jobs/upload-token' });
      const response = await fetch('/api/jobs/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileUrl: blob.url, originalFilename: varianFile.name, analysisType: 'nmr', inputDataHash }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create job on the server.');
      setJobs(prevJobs => prevJobs.map(j => j.id === tempId ? { ...j, id: result.jobId, state: 'processing' } : j));
    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => j.id === tempId ? { ...j, state: 'failed', failedReason: e.message } : j));
      setPageError(`Analysis failed: ${e.message}`);
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  // Helper to convert a Blob to a base64 data URL
  const toBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Function to handle viewing results and logging them to the blockchain
  const handleViewAndLogResults = async (job: DisplayJob) => {
    setPageError(null);
    setViewedJob(null);

    // --- CASE 1: User clicks on a LOGGED job. Action: VIEW RESULTS ---
    if (job.state === 'logged') {
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
        const reconstructedResults: { [key: string]: any } = {};
        const readJson = async (filename: string) => zip.file(filename) ? JSON.parse(await zip.file(filename)!.async("string")) : undefined;
        const readText = async (filename: string) => zip.file(filename) ? zip.file(filename)!.async("string") : undefined;
        const readImageB64 = async (filename: string) => zip.file(filename) ? toBase64(await zip.file(filename)!.async("blob")) : undefined;
        [ reconstructedResults.spectrum_data, reconstructedResults.peaks, reconstructedResults.summary_table, reconstructedResults.referencing_info, reconstructedResults.summary_text, reconstructedResults.plot_b64, reconstructedResults.residual_zoom_plot_b64 ] = await Promise.all([ readJson("spectrum_data.json"), readJson("peaks.json"), readJson("summary_table.json"), readJson("referencing_info.json"), readText("summary_text.txt"), readImageB64("nmr_plot.png"), readImageB64("calibration_zoom_plot.png") ]);
        setViewedJob({ ...job, returnvalue: { results: reconstructedResults, status: 'success' } });
      } catch (error: any) {
        setPageError(`Failed to load on-chain data: ${error.message}`);
      } finally {
        setIsFetchingLog(false);
        setJobIdBeingLogged(null);
      }
      return;
    }
    
    // --- CASE 2: User clicks on a COMPLETED job. ---
    if (job.state === 'completed') {
      // Sub-case 2.1: It's the DEMO project. Action: SHOW RESULTS.
      if (job.projectId === DEMO_PROJECT_ID) {
        setViewedJob(job);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Sub-case 2.2: It's a REAL project. Action: LOG TO CHAIN.
      if (job.projectId !== DEMO_PROJECT_ID && user?.addr) {
        setIsLogging(true);
        setJobIdBeingLogged(job.id);
        try {
          const project = projects.find(p => p.id === job.projectId);
          if (!project?.nft_id) throw new Error("Project NFT ID not found.");
          if (job.returnvalue.status !== 'success') throw new Error(`Analysis script failed.`);
          
          const results = job.returnvalue.results;
          const inputDataHash = job.inputDataHash;
          if (!inputDataHash) throw new Error("Input data hash missing from job.");

          // --- Step 1: Create artifact with METADATA and upload to IPFS ---
          const outputs = [];
          const addAndHash = async (filename: string, content: string | Blob, isBase64 = false) => {
              if (content) {
                  // For base64, hash the decoded data; for others, hash the raw string
                  const dataToHash = isBase64 ? content.split(',')[1] : content;
                  const hash = await generateDataHash(dataToHash);
                  outputs.push({ filename, hash_sha256: hash });
              }
          };
          
          await addAndHash("spectrum_data.json", JSON.stringify(results.spectrum_data));
          await addAndHash("peaks.json", JSON.stringify(results.peaks));
          await addAndHash("summary_table.json", JSON.stringify(results.summary_table));
          await addAndHash("referencing_info.json", JSON.stringify(results.referencing_info));
          await addAndHash("summary_text.txt", results.summary_text);
          await addAndHash("nmr_plot.png", results.plot_b64, true);
          await addAndHash("calibration_zoom_plot.png", results.residual_zoom_plot_b64, true);

          const metadata = {
            schema_version: "1.0.0",
            analysis_agent: "KintaGen NMR Agent v1.0",
            timestamp_utc: new Date().toISOString(),
            input_data_hash_sha256: inputDataHash,
            outputs: outputs.filter(Boolean)
          };

          const zip = new JSZip();
          const addJsonToZip = (name: string, data: any) => data && zip.file(name, JSON.stringify(data, null, 2));
          const addTextToZip = (name: string, data: any) => data && zip.file(name, data);
          const addImageToZip = (name: string, b64: string) => b64 && zip.file(name, b64.split(',')[1], { base64: true });
          
          zip.file("metadata.json", JSON.stringify(metadata, null, 2));
          addJsonToZip("spectrum_data.json", results.spectrum_data);
          addJsonToZip("peaks.json", results.peaks);
          addJsonToZip("summary_table.json", results.summary_table);
          addJsonToZip("referencing_info.json", results.referencing_info);
          addTextToZip("summary_text.txt", results.summary_text);
          addImageToZip("nmr_plot.png", results.plot_b64);
          addImageToZip("calibration_zoom_plot.png", results.residual_zoom_plot_b64);

          const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact_${inputDataHash.substring(0,8)}.zip`);
          const cid = await uploadFile(zipFile);
          if (!cid) throw new Error(uploadError || "Failed to get CID from IPFS upload.");
          
          // Step 2: Add log to the blockchain
          const addresses = { KintaGenNFT: flowConfig.addresses["KintaGenNFT"], NonFungibleToken: "", ViewResolver: "", MetadataViews: "" };
          const cadence = getAddToLogTransaction(addresses);
          const logDescription = `Analysis results for input hash: ${inputDataHash}`;
          
          await executeTransaction({ 
            cadence, 
            args: (arg, t) => [arg(project.nft_id, t.UInt64), arg("KintaGen NMR Agent", t.String), arg(job.label, t.String), arg(logDescription, t.String), arg(cid, t.String)], 
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
  
  // --- Transaction result handling useEffect (unchanged) ---
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
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-4">1D NMR Spectrum Processing</h1>
        <p className="text-gray-400 mb-8">Select a project and upload a Varian data folder to process a 1D NMR spectrum.</p>
        
        <NmrAnalysisSetupPanel projects={projects} selectedProjectId={selectedProjectId} onProjectChange={(id) => { setSelectedProjectId(id); setViewedJob(null); }} onRunAnalysis={handleRunAnalysis} isLoadingProjects={isLoadingProjects} projectsError={projectsError} isAnalysisRunning={isAnalysisRunning} onFileSelected={setVarianFile} selectedFileName={varianFile?.name || ''} />
        
        {pageError && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg my-4 flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{pageError}</p></div></div> )}
        
        {viewedJob && <NmrAnalysisResultsDisplay job={viewedJob} />}
        
        <AnalysisJobsList
          jobs={displayJobs}
          onClearJobs={() => { const idToClear = selectedProjectId || DEMO_PROJECT_ID; setJobs(prev => prev.filter(j => j.projectId !== idToClear)); }}
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
            setIsLogging(false);
            setJobIdBeingLogged(null);
          }
        }}
        txId={dialogTxId || undefined}
        onSuccess={refetchProjects}
        pendingTitle="Logging Analysis to the Chain"
        successTitle="Log Entry Confirmed!"
        successDescription="Your NMR analysis results have been permanently recorded."
      />
    </>
  );
};

export default NMRAnalysisPage;