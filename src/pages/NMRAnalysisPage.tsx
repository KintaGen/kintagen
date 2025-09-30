import React, { useState, useMemo, useEffect } from 'react';
import { XCircleIcon } from '@heroicons/react/24/solid';
import JSZip from 'jszip';

// Contexts and Hooks (assuming they are generic enough)
import { useJobs, type Job } from '../contexts/JobContext';
import { useFlowCurrentUser, useFlowConfig, TransactionDialog, useFlowMutate } from '@onflow/react-sdk';
import { useOwnedNftProjects } from '../flow/kintagen-nft';
import { useLighthouse } from '../hooks/useLighthouse';
import { generateDataHash } from '../utils/hash';
import { getAddToLogTransaction } from '../flow/cadence';

// New NMR specific components
import { NmrAnalysisSetupPanel } from '../components/analysis/nmr/NmrAnalysisSetupPanel';
import { NmrAnalysisResultsDisplay } from '../components/analysis/nmr/NmrAnalysisResultsDisplay';
import { AnalysisJobsList } from '../components/analysis/AnalysisJobsList'; // Can be reused if generic

// Firebase
import { logEvent } from "firebase/analytics";
import { analytics } from '../services/firebase'; 
// --- Type Definitions ---
interface Project { id: string; name: string; description: string; nft_id: string; story?: any[]; }
interface DisplayJob { id: string; label: string; projectId: string; state: 'completed' | 'failed' | 'processing' | 'logged'; failedReason?: string; returnvalue?: any; logData?: any; }
const R_API = import.meta.env.VITE_API_BASE_URL;

export const DEMO_PROJECT_ID = 'demo-project';
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // This reads the file and encodes it as a Data URL (e.g., "data:application/zip;base64,UEsDB...")
    reader.readAsDataURL(file);
    reader.onload = () => {
      // We only want the base64 content, so we split on the comma and take the second part.
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};
const NMRAnalysisPage: React.FC = () => {
  // --- State Hooks ---
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { jobs, setJobs } = useJobs();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  
  // New state for handling Varian files
  const [varianFile, setVarianFile] = useState<File | null>(null);
  
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);
  
  // Flow/Transaction state (mostly unchanged)
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile, isLoading: isUploading, error: uploadError } = useLighthouse();
  const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();

  // --- Memoized Job Display Logic (adapted for NMR kind) ---
  const displayJobs = useMemo(() => {
    const filterAndMapJobs = (jobFilter: (job: Job) => boolean): DisplayJob[] => {
      return jobs.filter(jobFilter).map(job => ({ ...job, id: job.id, projectId: job.projectId as string }));
    };

    if (selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project?.story) return [];

      const onChainLogs: DisplayJob[] = project.story
        .filter(step => step.agent === "Analysis") // This might need to be more specific if you have multiple analysis types
        .map((step, index) => ({ id: `log-${project.id}-${index}`, label: step.action, projectId: project.id, state: 'logged', logData: step }));
      
      const onChainLabels = new Set(onChainLogs.map(log => log.label));
      const localJobs: DisplayJobs[] = jobs.filter(j => j.projectId === selectedProjectId && !onChainLabels.has(j.label));
      
      return [...onChainLogs, ...localJobs];
    }
    return filterAndMapJobs(job => job.kind === 'nmr' && job.projectId === DEMO_PROJECT_ID);
  }, [selectedProjectId, projects, jobs]);

  // --- Main NMR Analysis Handler ---
  const handleRunAnalysis = async () => {
    // This check is now correct because it uses 'varianFile'
    if (!varianFile) {
      setPageError("Please select a Varian ZIP file to analyze.");
      return;
    }

    setPageError(null);
    setViewedJob(null);
    setIsAnalysisRunning(true);

    const isDemo = !selectedProjectId || selectedProjectId === DEMO_PROJECT_ID;
    
    // --- START: CORRECTED LOGIC ---
    let zipDataB64: string;
    try {
      // We no longer need JSZip. We just read the file the user gave us.
      zipDataB64 = await fileToBase64(varianFile);
      if (!zipDataB64) {
        throw new Error("Could not read the content of the selected file.");
      }
    } catch (e: any) {
      setPageError(`Failed to prepare data file: ${e.message}`);
      setIsAnalysisRunning(false);
      return;
    }
    // --- END: CORRECTED LOGIC ---

    // The rest of the function remains largely the same
    const inputDataHash = await generateDataHash(zipDataB64);
    
    // Use the actual file name for a better label
    const jobLabel = `NMR analysis of ${varianFile.name}`;
    // --- FIREBASE ANALYTICS: Log the start of an analysis ---
    logEvent(analytics, 'run_analysis', {
      analysis_type: 'nmr1DH', // Good for future-proofing if you add more analysis types
      data_source_hash: inputDataHash,
      is_demo: isDemo,
    });
    const newJob: Job = {
      id: `${isDemo ? 'demo' : 'netlify'}_job_${Date.now()}`,
      kind: 'nmr',
      label: jobLabel,
      projectId: selectedProjectId || DEMO_PROJECT_ID,
      createdAt: Date.now(),
      state: 'processing'
    };
    setJobs(prev => [newJob, ...prev]);

    try {
      // This is the standard way to prepare a file for an HTTP request.
      const formData = new FormData();

      // --- 3. Append the file to the FormData object ---
      // The key 'file' MUST match the name in your curl command (-F "file=@...")
      // and what the Plumber endpoint expects.
      formData.append('file', varianFile);
      const response = await fetch(`${R_API}/analyze/nmr`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
        throw new Error(errorBody.error || `Request failed with status ${response.status}`);
      }
      const result = await response.json();
      // --- FIREBASE ANALYTICS: Log the successful result of the analysis ---
      logEvent(analytics, 'analysis_result', {
        status: 'success',
        analysis_type: 'nmr1DH',
        data_source_hash: inputDataHash,
        is_demo: isDemo,
      });
      setJobs(prevJobs => prevJobs.map(j => 
        j.id === newJob.id 
          ? { 
              ...j, 
              state: result.status === 'success' ? 'completed' : 'failed', 
              returnvalue: { ...result, inputDataHash }, 
              failedReason: result.error,
            } 
          : j
      ));
    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => (j.id === newJob.id ? { ...j, state: 'failed', failedReason: e.message } : j)));
      setPageError(`Analysis failed: ${e.message}`);
      // --- FIREBASE ANALYTICS: Log the failed result of the analysis ---
      logEvent(analytics, 'analysis_result', {
        status: 'failed',
        analysis_type: 'nmr1DH',
        is_demo: isDemo,
        data_source_hash: inputDataHash,
        error_message: e.message, // Capture the error for debugging
      });
    } finally {
      setIsAnalysisRunning(false);
    }
  };


  // --- Logging and Transaction Logic (adapted for NMR) ---
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
        const plotBase64 = results?.results?.plot_b64?.split(',')[1];
        if (!plotBase64) throw new Error("No plot found to save.");

        // Prepare NMR specific files for the artifact zip
        const spectrumJsonString = JSON.stringify(results.results.spectrum_data, null, 2);
        const plotHash = await generateDataHash(plotBase64);
        const spectrumHash = await generateDataHash(spectrumJsonString);

        const metadata = {
          schema_version: "1.0.0",
          analysis_agent: "KintaGen NMR v1 (Vercel)",
          timestamp_utc: new Date().toISOString(),
          datahash: spectrumHash,
          plothash: plotHash,
          returnvalue: results
        };
        console.log(metadata)
        const zip = new JSZip();
        zip.file("metadata.json", JSON.stringify(metadata, null, 2));
        zip.file("nmr_plot.png", plotBase64, { base64: true });
        zip.file("nmr_spectrum.json", spectrumJsonString);
        const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact.zip`);
        const cid = await uploadFile(zipFile);
        if (!cid) throw new Error(uploadError || "Failed to get CID.");

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
  
  // This useEffect and the overallIsLogging const are unchanged and correct
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
        <h1 className="text-3xl font-bold mb-4">1D NMR Spectrum Processing</h1>
        <p className="text-gray-400 mb-8">Select a project and upload a Varian data folder to process a 1D NMR spectrum.</p>
        
        <NmrAnalysisSetupPanel
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={(id) => { setSelectedProjectId(id); setViewedJob(null); }}
          onRunAnalysis={handleRunAnalysis}
          isLoadingProjects={isLoadingProjects}
          projectsError={projectsError}
          isAnalysisRunning={isAnalysisRunning}
          onFileSelected={setVarianFile}
          selectedFileName={varianFile?.name || ''}
        />
        
        {pageError && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4 flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{pageError}</p></div></div> )}
        
        {viewedJob && <NmrAnalysisResultsDisplay job={viewedJob} />}
        
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
        successDescription="Your NMR analysis results have been permanently recorded."
      />
    </>
  );
};

export default NMRAnalysisPage;