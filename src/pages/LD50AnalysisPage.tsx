import React, { useEffect, useMemo, useState } from 'react';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { useJobs, type Job } from '../contexts/JobContext';
import { useFlowCurrentUser, useFlowConfig, TransactionDialog } from '@onflow/react-sdk';

import { getAddToLogTransaction } from '../flow/cadence';
import { useOwnedNftProjects } from '../flow/kintagen-nft';
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
    if (!selectedProjectId) return;
    setPageError(null);
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    if (!selectedProject) return;

    const jobLabel = `Saved LD50 analysis results for "${selectedProject.name}"`;
    const newJob: Job = { id: `webr_job_${Date.now()}`, kind: 'ld50', label: jobLabel, projectId: selectedProjectId, createdAt: Date.now(), state: 'processing' };
    setJobs(prev => [newJob, ...prev]);

    try {
      const result = await runLd50Analysis(rScriptContent);
      setJobs(prevJobs => prevJobs.map(j => 
        j.id === newJob.id 
        ? { ...j, state: result.status === 'success' ? 'completed' : 'failed', returnvalue: result, failedReason: result.error }
        : j
      ));
    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => 
        j.id === newJob.id 
        ? { ...j, state: 'failed', failedReason: e.message }
        : j
      ));
      setPageError(`Analysis failed: ${e.message}`);
    }
  };

  const handleViewResults = (job: DisplayJob) => {
    setViewedJob(job);
    setPageError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const getLogResultsTransaction = () => {
    if (!viewedJob || viewedJob.state !== 'completed' || !viewedJob.projectId || !user?.addr) return null;

    const project = projects.find(p => p.id === viewedJob.projectId);
    if (!project?.nft_id) return null;

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
    const outputCID = `bafy_demo_cid_${Math.random().toString(36).substring(7)}`;

    return {
      cadence,
      args: (arg, t) => [
        arg(project.nft_id, t.UInt64),
        arg("Analysis", t.String),
        arg(viewedJob.label, t.String),
        arg(outputCID, t.String)
      ],
      limit: 9999,
    };
  };

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
        />
        
        {pageError && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4 flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{pageError}</p></div></div> )}
        
        {viewedJob && (
          <AnalysisResultsDisplay
            job={viewedJob}
            transaction={getLogResultsTransaction()}
            onLogSuccess={(txId) => {
              setDialogTxId(txId);
              setIsDialogOpen(true);
            }}
            onLogError={(error) => {
              if (error.message.includes("User rejected")) {
                console.log("User rejected the transaction.");
              } else {
                setPageError(`Transaction failed to send: ${error.message}`);
              }
            }}
          />
        )}
        
        <AnalysisJobsList
          jobs={displayJobs}
          onClearJobs={() => setJobs(prev => prev.filter(j => j.projectId !== selectedProjectId))}
          onViewResults={handleViewResults}
          onViewLogDetails={setViewedJob}
        />
      </div>

      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
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