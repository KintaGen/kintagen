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
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile, error: uploadError } = useLighthouse();
  const { mutate: executeTransaction, isPending: isTxPending } = useFlowMutate({
    onSuccess: (txId) => {
      setDialogTxId(txId);
      setIsDialogOpen(true);
    },
    onError: (error) => {
      const errorMsg = error.message.includes("User rejected") ? "Transaction cancelled by user." : error.message;
      setPageError(`Transaction failed: ${errorMsg}`);
      setIsLogging(false);
      setJobIdBeingLogged(null);
    }
  });

  // Polling useEffect to monitor job status from the backend
  useEffect(() => {
    const activeJobs = jobs.filter(job => job.state === 'waiting' || job.state === 'processing');
    if (activeJobs.length === 0) return;

    const intervalId = setInterval(async () => {
      let jobsWereUpdated = false;
      const updatedJobs = await Promise.all(jobs.map(async (job) => {
        if (job.state !== 'waiting' && job.state !== 'processing') return job;
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
      logEvent(analytics, 'analysis_result', { status: 'failed', analysis_type: 'nmr1DH', error_message: e.message });
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  // Function to handle viewing results and logging them to the blockchain
  const handleViewAndLogResults = async (job: DisplayJob) => {
    // If the job is already logged, we can just display its historical data.
    if (job.state === 'logged') {
      setViewedJob(job);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (job.projectId === DEMO_PROJECT_ID || job.state !== 'completed' || !user?.addr) return;

    setIsLogging(true);
    setJobIdBeingLogged(job.id);
    
    try {
      const project = projects.find(p => p.id === job.projectId);
      if (!project?.nft_id) throw new Error("Project NFT ID not found.");

      const workerResponse = job.returnvalue;
      if (workerResponse.status !== 'success') throw new Error(`Analysis script failed: ${workerResponse.error || 'Unknown error'}`);

      const results = workerResponse.results; 
      const inputDataHash = job.inputDataHash;
      if(!inputDataHash) throw new Error("Input data hash not found in job results.");

      const mainPlotB64 = results?.plot_b64?.split(',')[1];
      if (!mainPlotB64) throw new Error("No plot found to save.");

      // Create the artifact ZIP file
      const zip = new JSZip();
      // ... (add all plots and data files to the zip) ...
      const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact_${inputDataHash.substring(0,8)}.zip`);
      
      const cid = await uploadFile(zipFile);
      if (!cid) throw new Error(uploadError || "Failed to get CID.");

      const addresses = { KintaGenNFT: flowConfig.addresses["KintaGenNFT"], NonFungibleToken: "", ViewResolver: "", MetadataViews: "" };
      const cadence = getAddToLogTransaction(addresses);
      
      const logDescription = `Analysis results for input hash: ${inputDataHash}`;
      
      // FIX: Ensure all 5 arguments are correctly wrapped with arg()
      const args = (arg, t) => [
        arg(project.nft_id, t.UInt64),
        arg("Analysis", t.String),
        arg(job.label, t.String),
        arg(logDescription, t.String),
        arg(cid, t.String)
      ];
      
      await executeTransaction({ cadence, args, limit: 9999 });

    } catch (error: any) {
      setPageError(`Failed to log results: ${error.message}`);
      setIsLogging(false);
      setJobIdBeingLogged(null);
    }
  };
  
  const overallIsLogging = isLogging || isTxPending;

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
        />
      </div>

      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        txId={dialogTxId || undefined}
        onSuccess={async () => {
          await refetchProjects(); // Refresh the list from the blockchain
          
          // FIX: Find the job we were logging and set it as the one to view
          const justLoggedJob = jobs.find(j => j.id === jobIdBeingLogged);
          if (justLoggedJob) {
            // Create a temporary "logged" version to pass to the results display
            setViewedJob({ ...justLoggedJob, state: 'logged', logData: justLoggedJob.returnvalue.results });
          }
          
          setIsLogging(false);
          setJobIdBeingLogged(null);
        }}
        pendingTitle="Logging Analysis to the Chain"
        successTitle="Log Entry Confirmed!"
        successDescription="Your NMR analysis results have been permanently recorded."
      />
    </>
  );
};

export default NMRAnalysisPage;