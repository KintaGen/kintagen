import React, { useEffect, useMemo, useState } from 'react';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { useJobs, type Job } from '../contexts/JobContext';
import { useFlowCurrentUser, useFlowConfig, TransactionDialog,useFlowMutate } from '@onflow/react-sdk';
import JSZip from 'jszip'; 

import { getAddToLogTransaction } from '../flow/cadence';
import { useOwnedNftProjects } from '../flow/kintagen-nft';
import { useLighthouse } from '../hooks/useLighthouse';
import { initWebR, runLd50Analysis } from '../services/webr-service';
import rScriptContent from '../R/ld50_script.R?raw';

// Import our new, smaller child components
import { AnalysisSetupPanel } from '../components/ld50/AnalysisSetupPanel';
import { AnalysisResultsDisplay } from '../components/ld50/AnalysisResultsDisplay';
import { AnalysisJobsList } from '../components/ld50/AnalysisJobsList';

// Define types in a shared location (e.g., src/types.ts) if you use them elsewhere
interface Project { 
    id: string; 
    name: string; 
    description: string; 
    nft_id: string; 
    story?: any[];
}

interface DisplayJob { 
    id: string; 
    label: string; 
    projectId: string; 
    state: 'completed' | 'failed' | 'processing' | 'logged'; 
    failedReason?: string; 
    returnvalue?: any; 
    logData?: any; 
}

const LD50AnalysisPage: React.FC = () => {
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { jobs, setJobs } = useJobs();
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  const [isWebRReady, setIsWebRReady] = useState(false);
  const [webRInitMessage, setWebRInitMessage] = useState('Initializing Analysis Engine (WebR)...');
  
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();

  const { uploadFile, isLoading: isUploading, error: uploadError } = useLighthouse();
  const [cid,setCID] = useState();


  const [validatedCsvData, setValidatedCsvData] = useState<string | null>(null);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);

  // --- NEW STATE for the logging process ---
  const [isLogging, setIsLogging] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);

  // --- useTransaction HOOK for programmatic control ---
  const { 
    mutate: executeTransaction, 
    isPending: isTxPending, 
    isSuccess: isTxSuccess, 
    isError: isTxError, 
    error: txError, 
    data: txId 
  } = useFlowMutate();
  
  const displayJobs = useMemo(() => {
    if (!selectedProjectId) return [];
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project?.story) return [];

    const onChainLogs: DisplayJob[] = project.story
      .filter(step => step.agent === "Analysis")
      .map((step, index) => ({
        id: `log-${project.id}-${index}`,
        label: step.action,
        projectId: project.id,
        state: 'logged',
        logData: step,
      }));

    const onChainLabels = new Set(onChainLogs.map(log => log.label));

    const localJobs: DisplayJob[] = jobs
      .filter(job => job.projectId === selectedProjectId && !onChainLabels.has(job.label))
      .map(job => ({ ...job, id: job.id, projectId: job.projectId as string }));

    return [...onChainLogs, ...localJobs];
  }, [selectedProjectId, projects, jobs]);

  useEffect(() => {
    initWebR().then(() => {
      setIsWebRReady(true);
      setWebRInitMessage('Engine Ready');
    }).catch(e => {
      setPageError('Could not start the analysis engine. Please refresh the page.');
    });
  }, []);
  
  const runRealAnalysis = async () => {
    // This function can be simplified. No need for handleUpload() here anymore.
    if (!selectedProjectId) return;
    setPageError(null);
    setViewedJob(null); // Clear any job that might be currently displayed
    setIsAnalysisRunning(true); // Added this
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    if (!selectedProject) { setIsAnalysisRunning(false); return; }

    const jobLabel = validatedCsvData
      ? `LD50 analysis with custom data`
      : `LD50 analysis with sample data`;

    const newJob: Job = { id: `webr_job_${Date.now()}`, kind: 'ld50', label: jobLabel, projectId: selectedProjectId, createdAt: Date.now(), state: 'processing' };
    setJobs(prev => [newJob, ...prev]);

    try {
      const result = await runLd50Analysis(rScriptContent, validatedCsvData || undefined);
      setJobs(prevJobs => {
        return prevJobs.map(j => {
          if (j.id === newJob.id) {
            // Found the job, update it with the results
            return { 
              ...j, 
              state: result.status === 'success' ? 'completed' : 'failed', 
              returnvalue: result, 
              failedReason: result.error 
            };
          }
          // Not the job we're looking for, return it unchanged
          return j;
        });
      });
    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => 
        j.id === newJob.id 
        ? { ...j, state: 'failed', failedReason: e.message }
        : j
      ));
      setPageError(`Analysis failed: ${e.message}`);
    } finally {
      setIsAnalysisRunning(false); // Added this
    }
  };


  // --- THE NEW, CENTRAL LOGIC HUB ---
  const handleViewAndLogResults = async (job: DisplayJob) => {
    setViewedJob(job);
    setPageError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Case 1: Job is already logged on-chain. Just display it.
    if (job.state === 'logged') {
      console.log("Displaying already logged results.");
      return; 
    }
    
    // Case 2: Job is local and completed. Start the logging process.
    if (job.state === 'completed' && job.projectId && user?.addr) {
      setIsLogging(true);
      setJobIdBeingLogged(job.id);
      
      try {
        // Step A: Upload results to IPFS
        const project = projects.find(p => p.id === job.projectId);
        if (!project?.nft_id) throw new Error("Project NFT ID not found.");
        
        const results = job.returnvalue;
        if (!results?.results) throw new Error("No results found in the job to save.");

        const zip = new JSZip();
        const baseTitle = project.name.replace(/[^a-zA-Z0-9]/g, '_');
        const plotBase64 = results.results.plot_b64.split(',')[1];
        zip.file("ld50_plot.png", plotBase64, { base64: true });
        zip.file("ld50_metrics.json", JSON.stringify(results.results, null, 2));
        const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `${baseTitle}_results.zip`);
        
        const cid = await uploadFile(zipFile);
        if (!cid) throw new Error(uploadError || "Failed to get CID from IPFS upload.");
        console.log("Results ZIP uploaded to IPFS with CID:", cid);

        // Step B: Prepare and execute the blockchain transaction
        const addresses = {
          NonFungibleToken: flowConfig.addresses["NonFungibleToken"],
          KintaGenNFT: flowConfig.addresses["KintaGenNFT"],
          ViewResolver: flowConfig.addresses["ViewResolver"],
        };
        if (!addresses.KintaGenNFT || !addresses.NonFungibleToken) {
            setPageError("Contract addresses not configured for this network.");
            return null;
        }
        const cadence = getAddToLogTransaction(addresses);
        const args = (arg, t) => [
            arg(project.nft_id, t.UInt64),
            arg("Analysis", t.String),
            arg(job.label, t.String),
            arg(cid, t.String)
        ];

        // Execute the transaction by calling the `mutate` function (which we renamed to `executeTransaction`)
        executeTransaction({
            cadence,
            args, // The variable name is `args`, not `txArgs`
            limit: 9999
        });
        
        return;
      } catch (error: any) {
        if (error.message.includes("User rejected")) {
            console.log("User rejected the transaction.");
            setPageError("Transaction cancelled by user.");
        } else {
            console.error("Logging failed:", error);
            setPageError(`Failed to log results: ${error.message}`);
        }
        // If logging fails, clear the viewed job so the results don't show
        setViewedJob(null);
      } finally {
        setIsLogging(false);
        setJobIdBeingLogged(null);
      }
    }
  };


  useEffect(() => {
    // When the transaction is successful
    if (isTxSuccess && txId) {
        setDialogTxId(txId);
        setIsDialogOpen(true);
        setIsLogging(false); // Stop the initial logging state
        // `jobIdBeingLogged` will be cleared in the dialog's success/close
    }

    // When the transaction fails
    if (isTxError && txError) {
        const errorMessage = txError.message || "An unknown transaction error occurred.";
        if (errorMessage.includes("User rejected")) {
            console.log("User rejected the transaction.");
            setPageError("Transaction cancelled by user.");
        } else {
            setPageError(`Transaction failed: ${errorMessage}`);
        }
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
        <p className="text-gray-400 mb-8">Select one of your on-chain projects to run a real, client-side analysis using WebR.</p>
        
        <AnalysisSetupPanel
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={(id) => { setSelectedProjectId(id); setViewedJob(null); }}
          onRunAnalysis={runRealAnalysis}
          isLoadingProjects={isLoadingProjects}
          projectsError={projectsError}
          isWebRReady={isWebRReady}
          webRInitMessage={webRInitMessage}

          // Pass down the new state and handlers
          isAnalysisRunning={isAnalysisRunning}
          onDataValidated={(csvString) => setValidatedCsvData(csvString)}
          onDataCleared={() => setValidatedCsvData(null)}
        />
        
        {pageError && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4 flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{pageError}</p></div></div> )}
        
        {viewedJob && cid && (
          <AnalysisJobsList
            jobs={displayJobs}
            onClearJobs={() => setJobs(prev => prev.filter(j => j.projectId !== selectedProjectId))}
            // Use the new prop name here
            onViewAndLogResults={handleViewAndLogResults} 
            // Pass the state down
            jobIdBeingLogged={jobIdBeingLogged}
        />
        )}
        {viewedJob && viewedJob.state === "logged" && (
          <AnalysisResultsDisplay
            job={viewedJob}
            isLoading={overallIsLogging && jobIdBeingLogged === viewedJob.id}
            />
        )}
        <AnalysisJobsList
          jobs={displayJobs}
          onClearJobs={() => setJobs(prev => prev.filter(j => j.projectId !== selectedProjectId))}
          // The single, powerful handler for viewing/logging
          onViewAndLogResults={handleViewAndLogResults}
          // The state to show a spinner on the correct job item
          jobIdBeingLogged={jobIdBeingLogged}
        />
      </div>

      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          // When the dialog closes, we can clear the job ID
          if (!isOpen) {
              setJobIdBeingLogged(null);
          }
        }}
        txId={dialogTxId || undefined}
        onSuccess={() => {
            console.log("Successfully logged to the blockchain! Refetching projects to update the story.");
            refetchProjects();
        }}
        pendingTitle="Logging Analysis to the Chain"
        pendingDescription="Please wait while the transaction is being processed by the Flow network. This may take a moment."
        successTitle="Log Entry Confirmed!"
        successDescription="Your analysis results have been permanently recorded on the blockchain."
        closeOnSuccess={false}
      />
    </>
  );
};

export default LD50AnalysisPage;