import React, { useState, useMemo, useEffect } from 'react';
import { XCircleIcon } from '@heroicons/react/24/solid';
import JSZip from 'jszip';

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
  state: 'completed' | 'failed' | 'processing' | 'logged';
  failedReason?: string;
  returnvalue?: any;
  logData?: any;
  inputDataHash?: string;
}

export const DEMO_PROJECT_ID = 'demo-project';

const GCMSAnalysisPage: React.FC = () => {
  // --- State Hooks (unchanged) ---
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { jobs, setJobs } = useJobs();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  const [mzmlFile, setMzmlFile] = useState<File | null>(null);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Flow/Transaction state
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile } = useLighthouse();
  const { mutate: executeTransaction, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();

  // ====================================================================
  // NEW: Polling `useEffect` Hook (Identical to other pages)
  // ====================================================================
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
            if (response.status === 404 && job.state !== 'waiting') {
              jobsWereUpdated = true;
              return { ...job, state: 'failed', failedReason: 'Job not found on server.' };
            }
            return job;
          }
          const serverJob = await response.json();
          const newClientState = serverJob.status === 'completed' || serverJob.status === 'failed' ? serverJob.status : 'processing';

          if (newClientState !== job.state) {
            jobsWereUpdated = true;
            return {
              ...job,
              state: newClientState,
              returnvalue: serverJob.result || job.returnvalue,
              failedReason: serverJob.error || job.failedReason,
              inputDataHash: serverJob.inputDataHash || job.inputDataHash,
            };
          }
        } catch (e) { console.error("Polling error for job", job.id, e); }
        return job;
      }));

      if (jobsWereUpdated) {
        setJobs(updatedJobs);
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [jobs, setJobs]);

  // --- Memoized Job Display Logic (adapted for GCMS kind) ---
  const displayJobs = useMemo(() => {
    const jobFilter = (job: Job) => job.kind === 'gcms';
    if (selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project?.story) return [];
      const onChainLogs: DisplayJob[] = project.story.filter(step => step.agent === "Analysis").map((step, index) => ({ id: `log-${project.id}-${index}`, label: step.action, projectId: project.id, state: 'logged', logData: step }));
      const onChainLabels = new Set(onChainLogs.map(log => log.label));
      const localJobs: DisplayJob[] = jobs.filter(j => jobFilter(j) && j.projectId === selectedProjectId && !onChainLabels.has(j.label)).map(job => ({ ...job, projectId: job.projectId as string }));
      return [...onChainLogs, ...localJobs];
    }
    return jobs.filter(job => jobFilter(job) && job.projectId === DEMO_PROJECT_ID).map(job => ({ ...job, projectId: job.projectId as string }));
  }, [selectedProjectId, projects, jobs]);

  // ====================================================================
  // MODIFIED: Trigger the Job Asynchronously
  // ====================================================================
  const handleRunAnalysis = async () => {
    if (!mzmlFile) {
      setPageError("Please select an mzML file to analyze.");
      return;
    }

    setPageError(null);
    setViewedJob(null);
    setIsAnalysisRunning(true);

    const isDemo = !selectedProjectId || selectedProjectId === DEMO_PROJECT_ID;
    const inputDataHash = await generateDataHash(await mzmlFile.arrayBuffer());
    const jobLabel = `GC-MS analysis of ${mzmlFile.name}`;
    const tempId = `temp_job_${Date.now()}`;
    
    logEvent(analytics, 'run_analysis', { analysis_type: 'gcms_full_workflow', data_source_hash: inputDataHash, is_demo: isDemo });
    
    const newJob: Job = {
      id: tempId,
      kind: 'gcms',
      label: jobLabel,
      projectId: selectedProjectId || DEMO_PROJECT_ID,
      createdAt: Date.now(),
      state: 'waiting',
      inputDataHash: inputDataHash,
    };
    setJobs(prev => [newJob, ...prev]);

    try {
      const formData = new FormData();
      formData.append('file', mzmlFile);
      formData.append('type', 'xcms'); // Corresponds to worker's R script
      formData.append('inputDataHash', inputDataHash);

      const response = await fetch('/api/jobs/create', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create job on the server.');
      }

      setJobs(prevJobs => prevJobs.map(j =>
        j.id === tempId ? { ...j, id: result.jobId, state: 'processing' } : j
      ));
      
    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => (j.id === tempId ? { ...j, state: 'failed', failedReason: e.message } : j)));
      setPageError(`Analysis failed: ${e.message}`);
      logEvent(analytics, 'analysis_result', { status: 'failed', analysis_type: 'gcms_full_workflow', error_message: e.message });
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  // ====================================================================
  // MODIFIED: Logging and Transaction Logic (adapted for async hash)
  // ====================================================================
  const handleViewAndLogResults = async (job: DisplayJob) => {
    setViewedJob(job);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (job.projectId === DEMO_PROJECT_ID || job.state === 'logged') return;
    
    if (job.state === 'completed' && job.projectId && user?.addr) {
      setIsLogging(true);
      setJobIdBeingLogged(job.id);
      try {
        const project = projects.find(p => p.id === job.projectId);
        if (!project?.nft_id) throw new Error("Project NFT ID not found.");

        const results = job.returnvalue;
        const rScriptResults = results?.r_script_results; // Use the nested results
        const inputDataHash = results?.inputDataHash; // Use the reliable hash
        if (!inputDataHash) throw new Error("Input data hash not found in job results.");

        const plotBase64 = rScriptResults?.results?.plot_b64?.split(',')[1];
        if (!plotBase64) throw new Error("No plot found to save.");

        const ticDataJsonString = JSON.stringify(rScriptResults.results.tic_data, null, 2);
        const plotHash = await generateDataHash(plotBase64);
        const ticDataHash = await generateDataHash(ticDataJsonString);

        const metadata = {
          schema_version: "1.0.0",
          analysis_agent: "KintaGen GCMS v1 (Server)",
          timestamp_utc: new Date().toISOString(),
          input_data_hash_sha256: inputDataHash,
          outputs: [{ filename: "gcms_tic_plot.png", hash_sha256: plotHash }, { filename: "gcms_tic_data.json", hash_sha256: ticDataHash }]
        };
        
        const zip = new JSZip();
        zip.file("metadata.json", JSON.stringify(metadata, null, 2));
        zip.file("gcms_tic_plot.png", plotBase64, { base64: true });
        zip.file("gcms_tic_data.json", ticDataJsonString);
        
        const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact.zip`);
        const cid = await uploadFile(zipFile);
        if (!cid) throw new Error("Failed to upload artifact to Lighthouse.");

        const addresses = { KintaGenNFT: flowConfig.addresses["KintaGenNFT"], NonFungibleToken: flowConfig.addresses["NonFungibleToken"] };
        const cadence = getAddToLogTransaction(addresses);
        const args = (arg, t) => [arg(project.nft_id, t.UInt64), arg("Analysis", t.String), arg(job.label, t.String), arg(cid, t.String)];
        executeTransaction({ cadence, args, limit: 9999 });

      } catch (error: any) {
        setPageError(`Failed to log results: ${error.message}`);
        setViewedJob(null);
      } finally {
        setIsLogging(false);
        setJobIdBeingLogged(null);
      }
    }
  };
  
  // This useEffect is unchanged
  useEffect(() => {
    if (isTxSuccess && txId) {
      setDialogTxId(txId);
      setIsDialogOpen(true);
    }
    if (isTxError && txError) {
      setPageError(`Transaction failed: ${txError.message}`);
    }
  }, [isTxSuccess, isTxError, txId, txError]);
  
  return (
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-4">GC-MS Data Processing</h1>
        <p className="text-gray-400 mb-8">Select a project and upload an mzML file. The analysis will automatically find peaks and attempt to identify them using the MoNA online database.</p>
        
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
        onOpenChange={setIsDialogOpen}
        txId={dialogTxId || undefined}
        onSuccess={refetchProjects}
        pendingTitle="Logging Analysis to the Chain"
        successTitle="Log Entry Confirmed!"
        successDescription="Your GC-MS analysis results have been permanently recorded."
      />
    </>
  );
};

export default GCMSAnalysisPage;