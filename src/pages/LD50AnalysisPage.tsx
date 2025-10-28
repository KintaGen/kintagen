import React, { useState, useMemo, useEffect } from 'react';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { useJobs, type Job } from '../contexts/JobContext';
// CORRECT: Import the correctly named hook
import { useFlowCurrentUser, useFlowConfig, TransactionDialog, useFlowMutate } from '@onflow/react-sdk';
import JSZip from 'jszip';
import { upload } from '@vercel/blob/client'; 

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
  state: 'completed' | 'failed' | 'processing' | 'logged' | 'waiting';
  failedReason?: string;
  returnvalue?: any;
  logData?: any;
  inputDataHash: string;
}

export const DEMO_PROJECT_ID = 'demo-project';

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


  // ====================================================================
  // Job Polling `useEffect` Hook
  // ====================================================================
  useEffect(() => {
    const activeJobs = jobs.filter(job => job.state === 'waiting' || job.state === 'processing');
    if (activeJobs.length === 0) return;

    const intervalId = setInterval(async () => {
      let jobsWereUpdated = false;
      const updatedJobs = await Promise.all(jobs.map(async (job) => {
        if (job.state !== 'waiting' && job.state !== 'processing') {
          return job;
        }
        try {
          const response = await fetch(`/api/jobs/status/${job.id}`);
          if (!response.ok) {
            if (response.status === 404 && job.state !== 'waiting') {
              jobsWereUpdated = true;
              return { ...job, state: 'failed', failedReason: 'Job not found on server.' };
            }
            return job;
          }

          const serverJob = await response.json();
          const serverStatus = serverJob.status;
          const newClientState = serverStatus === 'completed' || serverStatus === 'failed' ? serverStatus : 'processing';
          if (newClientState !== job.state) {
            jobsWereUpdated = true;
            return {
              ...job,
              state: newClientState,
              returnvalue: serverJob.result || job.returnvalue,
              failedReason: serverJob.error || job.failedReason,
            };
          }
        } catch (e) {
          console.error("Polling error for job", job.id, e);
        }
        return job;
      }));

      if (jobsWereUpdated) {
        setJobs(updatedJobs);
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [jobs, setJobs]);


  // --- Memoized Job Display Logic ---
  const displayJobs = useMemo((): DisplayJob[] => {
    if (selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID) {
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) return [];

        const onChainLogs: DisplayJob[] = (project.story || [])
            .filter(step => step.agent === "Analysis")
            .map((step, index) => ({
                id: `log-${project.id}-${index}`,
                label: step.title,
                projectId: project.id,
                state: 'logged',
                logData: step,
                inputDataHash: step.description,
            }));

        const loggedInputHashes = new Set(
          (project.story || []).map(step => step.description.split('input hash: ')[1]).filter(Boolean)
        );

        const localJobs: DisplayJob[] = jobs
            .filter(job => 
                job.kind === 'ld50' && 
                job.projectId === selectedProjectId &&
                !loggedInputHashes.has(job.inputDataHash)
            )
            .map(job => ({
                ...job,
                id: job.id,
                state: job.state,
                projectId: job.projectId as string,
                inputDataHash: job.inputDataHash,
            }));
            
        return [...onChainLogs, ...localJobs];
    }
    
    return jobs.filter(job => job.kind === 'ld50' && job.projectId === DEMO_PROJECT_ID)
    .map(job => ({ 
      id: job.id,
      label: job.label,
      projectId: job.projectId as string,
      state: job.state,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
      logData: job.logData,
      inputDataHash: job.inputDataHash
     }));
  }, [selectedProjectId, projects, jobs]);


  // --- Run Analysis Logic ---
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

    const newJob: Job = {
      id: tempId,
      kind: 'ld50',
      label: jobLabel,
      projectId: selectedProjectId || DEMO_PROJECT_ID,
      createdAt: Date.now(),
      state: 'waiting',
      inputDataHash: inputDataHash
    };
    setJobs(prev => [newJob, ...prev]);

    try {
      const dataFile = new File([inputDataString], `${inputDataHash}_ld50.csv`, { type: "text/csv" });
      const blob = await upload(dataFile.name, dataFile, { access: 'public', handleUploadUrl: '/api/jobs/upload-token' });

      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: blob.url,
          originalFilename: dataFile.name,
          analysisType: 'drc',
          inputDataHash: inputDataHash,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create job on the server.');

      setJobs(prevJobs => prevJobs.map(j =>
        j.id === tempId ? { ...j, id: result.jobId, state: 'processing' } : j
      ));

    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j =>
        j.id === tempId ? { ...j, state: 'failed', failedReason: e.message } : j
      ));
      setPageError(`Failed to start analysis: ${e.message}`);
      logEvent(analytics, 'analysis_result', { status: 'failed', analysis_type: 'ld50', error_message: e.message });
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  // --- Transaction Logic ---
  const handleViewAndLogResults = async (job: DisplayJob) => {
    setViewedJob(job);
    setPageError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (job.projectId === DEMO_PROJECT_ID || job.state !== 'completed' || !user?.addr) {
      return;
    }

    setIsLogging(true);
    setJobIdBeingLogged(job.id);

    try {
      const project = projects.find(p => p.id === job.projectId);
      if (!project?.nft_id) throw new Error("Project NFT ID not found.");

      const results = job.returnvalue;
      const plotBase64 = results?.results?.plot_b64?.split(',')[1];
      if (!plotBase64) throw new Error("No plot found to save.");

      const metricsJsonString = JSON.stringify(results.results, null, 2);
      const metadata = {
        schema_version: "1.0.0",
        analysis_agent: "KintaGen LD50 v1 (Server)",
        timestamp_utc: new Date().toISOString(),
        input_data_hash_sha256: job.inputDataHash,
        outputs: [{ filename: "ld50_plot.png", hash_sha256: await generateDataHash(plotBase64) }, { filename: "ld50_metrics.json", hash_sha256: await generateDataHash(metricsJsonString) }]
      };

      const zip = new JSZip();
      zip.file("metadata.json", JSON.stringify(metadata, null, 2));
      zip.file("ld50_plot.png", plotBase64, { base64: true });
      zip.file("ld50_metrics.json", metricsJsonString);
      const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact_${job.inputDataHash.substring(0,8)}.zip`);
      
      const cid = await uploadFile(zipFile);
      if (!cid) throw new Error(uploadError || "Failed to get CID from Lighthouse.");
      
      const addresses = { 
        KintaGenNFT: flowConfig.addresses["KintaGenNFT"],
        NonFungibleToken: flowConfig.addresses["NonFungibleToken"],
        ViewResolver: flowConfig.addresses["ViewResolver"],
        MetadataViews: flowConfig.addresses["MetadataViews"],
      };
      const cadence = getAddToLogTransaction(addresses);
      
      const logDescription = `Analysis results for input hash: ${job.inputDataHash}`;
      const args = (arg, t) => [
          arg(project.nft_id, t.UInt64),
          arg("Analysis", t.String),
          arg(job.label, t.String),
          arg(logDescription, t.String),
          arg(cid, t.String)
      ];

      // Use the aliased function from the hook
      executeTransaction({ cadence, args, limit: 9999 });

    } catch (error: any) {
      const errorMsg = error.message.includes("User rejected") ? "Transaction cancelled by user." : error.message;
      setPageError(`Failed to log results: ${errorMsg}`);
      setIsLogging(false);
      setJobIdBeingLogged(null);
    }
  };
  
  // This useEffect now correctly monitors the state from the hook
  useEffect(() => {
    if (isTxSuccess && txId) {
      setDialogTxId(txId as string);
      setIsDialogOpen(true);
    }
    if (isTxError && txError) {
      const errorMessage = (txError as Error).message || "An unknown transaction error occurred.";
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
        
        {pageError && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg my-4 flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{pageError}</p></div></div> )}
        
        {viewedJob && (
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
        pendingDescription="Please wait while the transaction is being processed..."
        successTitle="Log Entry Confirmed!"
        successDescription="Your analysis results have been permanently recorded on the blockchain."
        closeOnSuccess={true}
      />
    </>
  );
};

export default LD50AnalysisPage;