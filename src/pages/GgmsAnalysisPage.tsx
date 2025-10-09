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
import type { TopSpectrum } from '../components/analysis/xcms/MassSpectraDisplay';

// Firebase
import { logEvent } from "firebase/analytics";
import { analytics } from '../services/firebase'; 

// Type Definitions
interface Project { id: string; name: string; description: string; nft_id: string; story?: any[]; }
interface DisplayJob { id: string; label: string; projectId: string; state: 'completed' | 'failed' | 'processing' | 'logged'; failedReason?: string; returnvalue?: any; logData?: any; }

const R_API = import.meta.env.VITE_API_BASE_URL;
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
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [noiseThreshold, setNoiseThreshold] = useState(2.5); 
  
  // Flow/Transaction state
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile } = useLighthouse();
  const { mutate: executeTransaction, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();

  // --- Memoized Job Display Logic ---
  const displayJobs = useMemo(() => {
    if (selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project?.story) return [];
      const onChainLogs: DisplayJob[] = project.story
        .filter(step => step.agent === "Analysis")
        .map((step, index) => ({ id: `log-${project.id}-${index}`, label: step.action, projectId: project.id, state: 'logged', logData: step }));
      const onChainLabels = new Set(onChainLogs.map(log => log.label));
      const localJobs: DisplayJob[] = jobs.filter(j => j.projectId === selectedProjectId && !onChainLabels.has(j.label) && j.kind === 'gcms');
      return [...onChainLogs, ...localJobs];
    }
    return jobs.filter(job => job.kind === 'gcms' && job.projectId === DEMO_PROJECT_ID).map(job => ({ ...job, id: job.id, projectId: job.projectId as string }));
  }, [selectedProjectId, projects, jobs]);

  // --- Helper function for MoNA API call ---
  const identifySinglePeak = async (peakData: TopSpectrum) => {
    try {
      const spectrumString = peakData.spectrum_data.map(p => `${p.mz.toFixed(4)}:${(p.relative_intensity || 0).toFixed(0)}`).join(" ");
      const payload = { spectrum: spectrumString, minSimilarity: 500, algorithm: "default" };
      
      const response = await fetch("https://mona.fiehnlab.ucdavis.edu/rest/similarity/search", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) return null;
      const apiResults = await response.json();
      
      if (apiResults && apiResults.length > 0) {
        const bestHit = apiResults[0];
        const compoundName = bestHit.hit?.compound?.[0]?.names?.[0]?.name || "Unknown";
        // Parse the library spectrum string into the format our UI expects
        const librarySpectrum = bestHit.hit?.spectrum ? bestHit.hit.spectrum.split(' ').map((p:string) => {
            const parts = p.split(':');
            return { mz: parseFloat(parts[0]), intensity: parseFloat(parts[1]) };
        }) : [];

        return { 
          peak_number: peakData.peak_number, 
          match_name: compoundName, 
          similarity_score: bestHit.score,
          library_spectrum: librarySpectrum
        };
      }
    } catch (error) {
      console.error(`Failed to identify peak #${peakData.peak_number}:`, error);
    }
    // Return a "no match" object on failure or if no hits are found
    return { peak_number: peakData.peak_number, match_name: "No Match Found", similarity_score: 0, library_spectrum: [] };
  };

  // --- Main GCMS Analysis Handler (Two-Stage Workflow) ---
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
    
    logEvent(analytics, 'run_analysis', { analysis_type: 'gcms_full_workflow', data_source_hash: inputDataHash, is_demo: isDemo });
    
    const newJob: Job = {
      id: `${isDemo ? 'demo' : 'local'}_job_${Date.now()}`,
      kind: 'gcms',
      label: jobLabel,
      projectId: selectedProjectId || DEMO_PROJECT_ID,
      createdAt: Date.now(),
      state: 'processing'
    };
    setJobs(prev => [newJob, ...prev]);

    try {
      // --- STAGE 1: Run Feature Finder ---
      console.log('Stage 1: Running feature finder...');
      const formData = new FormData();
      formData.append('file', mzmlFile);
      formData.append('noiseThreshold', noiseThreshold.toString());

      const response = await fetch(`${R_API}/analyze/xcms`, { method: 'POST', body: formData });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to parse error.' }));
        throw new Error(errorBody.error || `Request failed with status ${response.status}`);
      }
      const initialResult = await response.json();
      if (initialResult.status !== 'success') {
        throw new Error(initialResult.error || 'Feature finder script failed.');
      }
      
      // --- STAGE 2: Run Automatic Identification ---
      console.log('Stage 2: Running automatic online identification...');
      const topSpectra = initialResult.results?.top_spectra_data || [];
      
      if (topSpectra.length > 0) {
        const allMatches = await Promise.all(
          topSpectra.map((spec: TopSpectrum) => identifySinglePeak(spec))
        );
        initialResult.results.library_matches = allMatches.filter(Boolean);
      } else {
        initialResult.results.library_matches = [];
      }

      console.log('Analysis and identification complete.');

      // --- FINALIZE: Update job state with combined results ---
      setJobs(prevJobs => prevJobs.map(j => 
        j.id === newJob.id 
          ? { ...j, state: 'completed', returnvalue: { ...initialResult, inputDataHash } } 
          : j
      ));
      
      logEvent(analytics, 'analysis_result', { status: 'success', analysis_type: 'gcms_full_workflow' });

    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => (j.id === newJob.id ? { ...j, state: 'failed', failedReason: e.message } : j)));
      setPageError(`Analysis failed: ${e.message}`);
      logEvent(analytics, 'analysis_result', { status: 'failed', analysis_type: 'gcms_full_workflow', error_message: e.message });
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  // --- Logging and Transaction Logic ---
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

        // Prepare GCMS specific files for the artifact zip
        const ticDataJsonString = JSON.stringify(results.results.tic_data, null, 2);
        const plotHash = await generateDataHash(plotBase64);
        const ticDataHash = await generateDataHash(ticDataJsonString);

        const metadata = {
          schema_version: "1.0.0",
          analysis_agent: "KintaGen GCMS v1 (Vercel)", // [CHANGED]
          timestamp_utc: new Date().toISOString(),
          datahash: ticDataHash,
          plothash: plotHash,
          returnvalue: results
        };
        
        const zip = new JSZip();
        zip.file("metadata.json", JSON.stringify(metadata, null, 2));
        zip.file("gcms_tic_plot.png", plotBase64, { base64: true }); // [CHANGED]
        zip.file("gcms_tic_data.json", ticDataJsonString); // [CHANGED]
        
        const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact.zip`);
        const cid = await uploadFile(zipFile);
        if (!cid) throw new Error(uploadError || "Failed to get CID.");

        // Cadence transaction logic is unchanged
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