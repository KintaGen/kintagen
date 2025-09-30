import React,{useState,useMemo,useEffect} from 'react';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { useJobs, type Job } from '../contexts/JobContext';
import { useFlowCurrentUser, useFlowConfig, TransactionDialog, useFlowMutate } from '@onflow/react-sdk';
import JSZip from 'jszip';

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

// --- Type Definitions ---
interface Project { 
    id: string; 
    name: string; 
    description: string; 
    nft_id: string; 
    story?: any[];
}

export interface DisplayJob { 
    id: string; 
    label: string; 
    projectId: string; 
    state: 'completed' | 'failed' | 'processing' | 'logged'; 
    failedReason?: string; 
    returnvalue?: any; 
    logData?: any; 
}

export const DEMO_PROJECT_ID = 'demo-project';
const R_API = import.meta.env.VITE_API_BASE_URL;
const LD50AnalysisPage: React.FC = () => {
  // --- State Hooks ---
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { jobs, setJobs } = useJobs();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile, isLoading: isUploading, error: uploadError } = useLighthouse();
  const [validatedCsvData, setValidatedCsvData] = useState<string | null>(null);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);
  const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();
  
  // --- Memoized Job Display Logic (unchanged) ---
  const displayJobs = useMemo(() => {

    if(selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID){
      if (!selectedProjectId) return [];
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project?.story) return [];
      const onChainLogs: DisplayJob[] = project.story.filter(step => step.agent === "Analysis").map((step, index) => ({ id: `log-${project.id}-${index}`, label: step.action, projectId: project.id, state: 'logged', logData: step }));
      const onChainLabels = new Set(onChainLogs.map(log => log.label));
      const localJobs: DisplayJob[] = jobs
        .filter(job => 
          job.kind === 'ld50' && 
          job.projectId === selectedProjectId && 
          !onChainLabels.has(job.label)
        )
        .map(job => ({ ...job, id: job.id, projectId: job.projectId as string }));
              return [...onChainLogs, ...localJobs];
    }
    return jobs.filter(job => job.kind === 'ld50' && job.projectId === DEMO_PROJECT_ID)
    .map(job => ({ id: job.id, label: job.label, projectId: job.projectId as string, state: job.state, failedReason: job.failedReason, returnvalue: job.returnvalue, logData: job.logData }));
  }, [selectedProjectId, projects, jobs]);

  // --- Main Analysis Handler (Corrected) ---
  const handleRunAnalysis = async () => {
    setPageError(null);
    setViewedJob(null);
    setIsAnalysisRunning(true);

    const isDemo = !selectedProjectId || selectedProjectId === DEMO_PROJECT_ID;
    
    const inputDataString = validatedCsvData || "";
    const inputDataHash = await generateDataHash(isDemo ? "sample_data" : inputDataString);

    const jobLabel = validatedCsvData
      ? `LD50 analysis with custom data`
      : `LD50 analysis with sample data`;

    // --- FIREBASE ANALYTICS: Log the start of an analysis ---
    logEvent(analytics, 'run_analysis', {
      analysis_type: 'ld50', // Good for future-proofing if you add more analysis types
      data_source_hash: inputDataHash,
      is_demo: isDemo,
    });

    const newJob: Job = {
      id: `${isDemo ? 'demo' : 'netlify'}_job_${Date.now()}`,
      kind: 'ld50',
      label: jobLabel,
      projectId: selectedProjectId || DEMO_PROJECT_ID,
      createdAt: Date.now(),
      state: 'processing'
    };
    setJobs(prev => [newJob, ...prev]);

    try {

      //const response = await fetch('/.netlify/functions/run-ld50', {
      //const response = await fetch('/api/run-ld50', {
      const response = await fetch(`${R_API}/analyze/drc`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: inputDataString,
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
        throw new Error(errorBody.error || `Request failed with status ${response.status}`);
      }
      const result = await response.json();
      // --- FIREBASE ANALYTICS: Log the successful result of the analysis ---
      logEvent(analytics, 'analysis_result', {
        status: 'success',
        analysis_type: 'ld50',
        data_source_hash: inputDataHash,
        is_demo: isDemo,
      });
      setJobs(prevJobs => {
        return prevJobs.map(j => {
          if (j.id === newJob.id) {
            // Found the job, update it with the results
            return { 
              ...j, 
              state: result.status === 'success' ? 'completed' : 'failed', 
              returnvalue: { 
                ...result,
                inputDataHash: inputDataHash
              }, 
              failedReason: result.error,
            };
          }
          // Not the job we're looking for, return it unchanged
          return j;
        });
      });

    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => (j.id === newJob.id ? { ...j, state: 'failed', failedReason: e.message } : j)));
      setPageError(`Analysis failed: ${e.message}`);
      // --- FIREBASE ANALYTICS: Log the failed result of the analysis ---
      logEvent(analytics, 'analysis_result', {
        status: 'failed',
        analysis_type: 'ld50',
        is_demo: isDemo,
        data_source_hash: inputDataHash,
        error_message: e.message, // Capture the error for debugging
      });
    } finally {
      setIsAnalysisRunning(false);
    }
  };


  // --- Logging and Transaction Logic (unchanged) ---
  const handleViewAndLogResults = async (job: DisplayJob) => {
    console.log(job)
    setViewedJob(job);
    setPageError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Case 1: Job is a demo job. Just display results, DO NOT log.
    if (job.projectId === DEMO_PROJECT_ID) {
      console.log("Displaying results for a demo job. Logging is disabled.");
      return;
    }
    // Case 2: Job is already logged on-chain. Just display it.
    if (job.state === 'logged') {
      console.log("Displaying already logged results.");
      return; 
    }
    if (job.state === 'completed' && job.projectId && user?.addr) {
      setIsLogging(true);
      setJobIdBeingLogged(job.id);
      try {
        const project = projects.find(p => p.id === job.projectId);
        if (!project?.nft_id) throw new Error("Project NFT ID not found.");
        const results = job.returnvalue;
        const plotBase64 = results?.results?.plot_b64?.split(',')[1];
        if (!plotBase64) throw new Error("No plot found to save.");
        const metricsJsonString = JSON.stringify(results.results, null, 2);
        const plotHash = await generateDataHash(plotBase64);
        const metricsHash = await generateDataHash(metricsJsonString);

        const metadata = {
          schema_version: "1.0.0",
          analysis_agent: "KintaGen LD50 v1 (Netlify)",
          timestamp_utc: new Date().toISOString(),
          input_data_hash_sha256: results.inputDataHash,
          outputs: [{ filename: "ld50_plot.png", hash_sha256: plotHash }, { filename: "ld50_metrics.json", hash_sha256: metricsHash }]
        };
        const zip = new JSZip();
        zip.file("metadata.json", JSON.stringify(metadata, null, 2));
        zip.file("ld50_plot.png", plotBase64, { base64: true });
        zip.file("ld50_metrics.json", metricsJsonString);
        const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact.zip`);
        const cid = await uploadFile(zipFile);
        if (!cid) throw new Error(uploadError || "Failed to get CID.");

        const addresses = { KintaGenNFT: flowConfig.addresses["KintaGenNFT"], NonFungibleToken: flowConfig.addresses["NonFungibleToken"] };
        const cadence = getAddToLogTransaction(addresses);
        const args = (arg, t) => [arg(project.nft_id, t.UInt64), arg("Analysis", t.String), arg(job.label, t.String), arg(cid, t.String)];
        executeTransaction({ cadence, args, limit: 9999 });
      } catch (error: any) {
        setPageError(`Failed to log results: ${error.message.includes("User rejected") ? "Transaction cancelled by user." : error.message}`);
        setViewedJob(null);
      } finally {
        setIsLogging(false);
        setJobIdBeingLogged(null);
      }
    }
  };
  console.log(viewedJob)
  useEffect(() => {
    if (isTxSuccess && txId) {
      setDialogTxId(txId);
      setIsDialogOpen(true);
      setIsLogging(false);
    }
    if (isTxError && txError) {
      const errorMessage = txError.message || "An unknown transaction error occurred.";
      setPageError(`Transaction failed: ${errorMessage.includes("User rejected") ? "Transaction cancelled by user." : errorMessage}`);
      setViewedJob(null);
      setIsLogging(false);
      setJobIdBeingLogged(null);
    }
  }, [isTxSuccess, isTxError, txId, txError]);
  const overallIsLogging = isLogging || isTxPending;
  
  return (
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-4">LD50 Dose-Response Analysis</h1>
        <p className="text-gray-400 mb-8">Select the Demo Project or one of your on-chain projects to run an analysis.</p>
        
        <AnalysisSetupPanel
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={(id) => { setSelectedProjectId(id); setViewedJob(null); }}
          onRunAnalysis={handleRunAnalysis}
          isLoadingProjects={isLoadingProjects}
          projectsError={projectsError}
          isWebRReady={true}
          webRInitMessage={'Server Ready'}
          isAnalysisRunning={isAnalysisRunning}
          onDataValidated={(csvString) => setValidatedCsvData(csvString)}
          onDataCleared={() => setValidatedCsvData(null)}
        />
        
        {pageError && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4 flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{pageError}</p></div></div> )}
        
        {viewedJob && (viewedJob.state === "logged" || viewedJob.projectId === DEMO_PROJECT_ID) && (
          <AnalysisResultsDisplay
            job={viewedJob}
            isLoading={overallIsLogging && jobIdBeingLogged === viewedJob.id}
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
        />
      </div>

      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) setJobIdBeingLogged(null); }}
        txId={dialogTxId || undefined}
        onSuccess={refetchProjects}
        pendingTitle="Logging Analysis to the Chain"
        pendingDescription="Please wait while the transaction is being processed..."
        successTitle="Log Entry Confirmed!"
        successDescription="Your analysis results have been permanently recorded."
        closeOnSuccess={false}
      />
    </>
  );
};

export default LD50AnalysisPage;