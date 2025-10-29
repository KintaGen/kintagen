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

// GCMS specific components
import { GcmsAnalysisSetupPanel } from '../components/analysis/xcms/GcmsAnalysisSetupPanel';
import { GcmsAnalysisResultsDisplay } from '../components/analysis/xcms/GcmsAnalysisResultsDisplay';
import { AnalysisJobsList } from '../components/analysis/AnalysisJobsList';

// Firebase
import { logEvent } from "firebase/analytics";
import { analytics } from '../services/firebase';

// Type Definitions
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

const GCMSAnalysisPage: React.FC = () => {
  // --- State Hooks ---
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { jobs, setJobs } = useJobs();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  const [mzmlFile, setMzmlFile] = useState<File | null>(null);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Flow/Transaction state
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile, error: uploadError } = useLighthouse();
  const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();

  // Polling `useEffect` Hook to monitor job status
  useEffect(() => {
    const activeJobs = jobs.filter(job => (job.state === 'waiting' || job.state === 'processing') && job.kind === 'gcms');
    if (activeJobs.length === 0) return;

    const intervalId = setInterval(async () => {
      let jobsWereUpdated = false;
      const updatedJobs = await Promise.all(jobs.map(async (job) => {
        if (job.kind !== 'gcms' || (job.state !== 'waiting' && job.state !== 'processing')) return job;
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
            return { ...job, state: newClientState, returnvalue: serverJob.result || job.returnvalue, failedReason: serverJob.error || job.failedReason, inputDataHash: serverJob.inputDataHash || job.inputDataHash };
          }
        } catch (e) { console.error("Polling error for job", job.id, e); }
        return job;
      }));
      if (jobsWereUpdated) setJobs(updatedJobs);
    }, 4000);
    return () => clearInterval(intervalId);
  }, [jobs, setJobs]);

  // Memoized Job Display Logic
  const displayJobs = useMemo((): DisplayJob[] => {
    if (selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project) return [];
      const onChainLogs: DisplayJob[] = (project.story || []).filter(step => step.title.startsWith("GC-MS analysis")).map((step, index) => ({ id: `log-${project.id}-${index}`, label: step.title, projectId: project.id, state: 'logged', logData: step, inputDataHash: step.description.split('input hash: ')[1] || '' }));
      const loggedInputHashes = new Set(onChainLogs.map(log => log.inputDataHash).filter(Boolean));
      const localJobs: DisplayJob[] = jobs.filter(job => job.kind === 'gcms' && job.projectId === selectedProjectId && !loggedInputHashes.has(job.inputDataHash!)).map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any }));
      return [...onChainLogs, ...localJobs];
    }
    return jobs.filter(job => job.kind === 'gcms' && job.projectId === DEMO_PROJECT_ID).map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any }));
  }, [selectedProjectId, projects, jobs]);

  // Function to start a new analysis job
  const handleRunAnalysis = async () => {
    if (!mzmlFile) { setPageError("Please select an mzML file to analyze."); return; }
    setPageError(null); setViewedJob(null); setIsAnalysisRunning(true);
    const isDemo = !selectedProjectId || selectedProjectId === DEMO_PROJECT_ID;
    const inputDataHash = await generateDataHash(await mzmlFile.arrayBuffer());
    const jobLabel = `GC-MS analysis of ${mzmlFile.name}`;
    const tempId = `temp_job_${Date.now()}`;
    logEvent(analytics, 'run_analysis', { analysis_type: 'gcms_full_workflow', data_source_hash: inputDataHash, is_demo: isDemo });
    const newJob: Job = { id: tempId, kind: 'gcms', label: jobLabel, projectId: selectedProjectId || DEMO_PROJECT_ID, createdAt: Date.now(), state: 'waiting', inputDataHash: inputDataHash };
    setJobs(prev => [newJob, ...prev]);
    try {
      const blob = await upload(mzmlFile.name, mzmlFile, { access: 'public', handleUploadUrl: '/api/jobs/upload-token' });
      const response = await fetch('/api/jobs/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileUrl: blob.url, originalFilename: mzmlFile.name, analysisType: 'xcms', inputDataHash: inputDataHash }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create job on the server.');
      setJobs(prevJobs => prevJobs.map(j => j.id === tempId ? { ...j, id: result.jobId, state: 'processing' } : j));
    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => (j.id === tempId ? { ...j, state: 'failed', failedReason: e.message } : j)));
      setPageError(`Analysis failed: ${e.message}`);
      logEvent(analytics, 'analysis_result', { status: 'failed', analysis_type: 'gcms_full_workflow', error_message: e.message });
    } finally {
      setIsAnalysisRunning(false);
    }
  };
  
  // Helper to convert Blob to base64 data URL
  const toBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Function to handle viewing and logging results
  const handleViewAndLogResults = async (job: DisplayJob) => {
    setPageError(null);
    setViewedJob(null); // Always clear previous results when an action is taken

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
        
        [
          reconstructedResults.quantitative_report, reconstructedResults.top_spectra_data,
          reconstructedResults.raw_chromatogram_data, reconstructedResults.smoothed_chromatogram_data,
          reconstructedResults.integrated_peaks_details, reconstructedResults.library_matches
        ] = await Promise.all([
          readJson("quantitative_report.json"), readJson("top_spectra_data.json"),
          readJson("raw_chromatogram.json"), readJson("smoothed_chromatogram.json"),
          readJson("integrated_peaks.json"), readJson("library_matches.json")
        ]);

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
        console.log(job)
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

          // Step 1: Upload to IPFS
          const zip = new JSZip();
          const addJsonToZip = (name: string, data: any) => data && zip.file(name, JSON.stringify(data, null, 2));
          addJsonToZip("quantitative_report.json", results.quantitative_report);
          addJsonToZip("top_spectra_data.json", results.top_spectra_data);
          addJsonToZip("raw_chromatogram.json", results.raw_chromatogram_data);
          addJsonToZip("smoothed_chromatogram.json", results.smoothed_chromatogram_data);
          addJsonToZip("integrated_peaks.json", results.integrated_peaks_details);
          addJsonToZip("library_matches.json", results.library_matches); // Include MoNA results
          const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact_${inputDataHash.substring(0,8)}.zip`);
          const cid = await uploadFile(zipFile);
          if (!cid) throw new Error(uploadError || "Failed to get CID from IPFS upload.");
          
          // Step 2: Add log to the blockchain
          const addresses = { KintaGenNFT: flowConfig.addresses["KintaGenNFT"], NonFungibleToken: "", ViewResolver: "", MetadataViews: "" };
          const cadence = getAddToLogTransaction(addresses);
          const logDescription = `Analysis results for input hash: ${inputDataHash}`;
          
          await executeTransaction({ 
            cadence, 
            args: (arg, t) => [arg(project.nft_id, t.UInt64), arg("KintaGen GC-MS Agent", t.String), arg(job.label, t.String), arg(logDescription, t.String), arg(cid, t.String)], 
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
  
  // Transaction state monitoring
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
        <h1 className="text-3xl font-bold mb-4">GC-MS Feature Analysis</h1>
        <p className="text-gray-400 mb-8">Select a project and upload an mzML file to perform feature detection and quantification.</p>
        
        <GcmsAnalysisSetupPanel
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={(id) => { setSelectedProjectId(id); setViewedJob(null); }}
          onRunAnalysis={handleRunAnalysis}
          isLoadingProjects={isLoadingProjects}
          projectsError={projectsError}
          isAnalysisRunning={isAnalysisRunning}
          onFileSelected={setMzmlFile}
          selectedFileName={mzmlFile?.name || ''}
        />
        
        {pageError && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4 flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{pageError}</p></div></div> )}
        
        {viewedJob && <GcmsAnalysisResultsDisplay job={viewedJob} />}
        
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
        onOpenChange={setIsDialogOpen}
        txId={dialogTxId || undefined}
        onSuccess={async () => {
          await refetchProjects();
          const justLoggedJob = jobs.find(j => j.id === jobIdBeingLogged);
          if (justLoggedJob) {
            setViewedJob({ ...justLoggedJob, state: 'logged', returnvalue: justLoggedJob.returnvalue });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          setIsLogging(false);
          setJobIdBeingLogged(null);
        }}
        pendingTitle="Logging Analysis to the Chain"
        successTitle="Log Entry Confirmed!"
        successDescription="Your GC-MS analysis results have been permanently recorded."
      />
    </>
  );
};

export default GCMSAnalysisPage;