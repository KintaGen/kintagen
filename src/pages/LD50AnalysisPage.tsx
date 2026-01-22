import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { XCircleIcon } from '@heroicons/react/24/solid';
import JSZip from 'jszip';
import { upload } from '@vercel/blob/client'; 

// --- Custom Hooks & Utils ---
import { useOwnedNftProjects } from '../flow/kintagen-nft';
import { useLighthouse } from '../hooks/useLighthouse';
import { useSecureLog } from '../hooks/useSecureLog';
import { useAnalysisJobs } from '../hooks/useAnalysisJobs';
import { useTransactionLifecycle } from '../hooks/useTransactionLifecycle';
import { fetchAndUnzipIpfsArtifact, readZipJson, readZipImageB64 } from '../utils/ipfsHelpers';
import { SecureModeBanner } from '../components/SecureModeBanner';
import { generateDataHash } from '../utils/hash';

// --- Flow & Services ---
import { useFlowCurrentUser, useFlowConfig, TransactionDialog } from '@onflow/react-sdk';
import { getAddToLogTransaction } from '../flow/cadence';
import { logEvent } from "firebase/analytics";
import { analytics } from '../services/firebase';
import { type DisplayJob, DEMO_PROJECT_ID, type Job } from '../types';

// --- Components ---
import { AnalysisSetupPanel } from '../components/analysis/ld50/AnalysisSetupPanel';
import { AnalysisResultsDisplay } from '../components/analysis/ld50/AnalysisResultsDisplay';
import { AnalysisJobsList } from '../components/analysis/AnalysisJobsList';

const LD50AnalysisPage: React.FC = () => {
  usePageTitle('LD50 Dose-Response Analysis - KintaGen');
  
  // 1. Data Contexts
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { uploadFile, error: uploadError } = useLighthouse();
  const { user } = useFlowCurrentUser();
  const flowConfig = useFlowConfig();

  // 2. Local State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  const [validatedCsvData, setValidatedCsvData] = useState<string | null>(null);
  
  // 3. Status Flags
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);

  // 4. Custom Hooks (Refactored Logic)
  const { displayJobs, setJobs } = useAnalysisJobs('ld50', 'LD50 Analysis', selectedProjectId);

  const { 
      executeTransaction, isTxPending, dialogTxId, 
      isDialogOpen, setIsDialogOpen, txError, setTxError 
  } = useTransactionLifecycle(() => {
      setIsLogging(false);
      setJobIdBeingLogged(null);
  });

  const { includeSecureData, setIncludeSecureData, processSecureLog, hasNostrIdentity } = 
      useSecureLog(!!validatedCsvData);

  // --- Handlers ---

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
    
    const newJob: Job = { id: tempId, kind: 'ld50', label: jobLabel, projectId: selectedProjectId || DEMO_PROJECT_ID, createdAt: Date.now(), state: 'waiting', inputDataHash: inputDataHash };
    setJobs(prev => [newJob, ...prev]);
    
    try {
      const dataFile = new File([inputDataString], `${inputDataHash}_ld50.csv`, { type: "text/csv" });
      const blob = await upload(dataFile.name, dataFile, { access: 'public', handleUploadUrl: '/api/jobs/upload-token' });
      const response = await fetch('/api/jobs/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: blob.url, originalFilename: dataFile.name, analysisType: 'drc', inputDataHash: inputDataHash, }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create job on the server.');
      setJobs(prevJobs => prevJobs.map(j => j.id === tempId ? { ...j, id: result.jobId, state: 'processing' } : j));
    } catch (e: any) {
      setJobs(prevJobs => prevJobs.map(j => j.id === tempId ? { ...j, state: 'failed', failedReason: e.message } : j));
      setPageError(`Failed to start analysis: ${e.message}`);
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  const handleViewAndLogResults = async (job: DisplayJob) => {
    setPageError(null); setTxError(null); setViewedJob(null);

    // CASE 1: View Logged Job (On-Chain)
    if (job.state === 'logged') {
        setIsFetchingLog(true); setJobIdBeingLogged(job.id);
        try {
            const zip = await fetchAndUnzipIpfsArtifact(job.logData!.ipfsHash);
            
            const metrics = await readZipJson(zip, "ld50_metrics.json");
            const plotBase64 = await readZipImageB64(zip, "ld50_plot.png");
            
            // Check for secure metadata
            const metadata = await readZipJson(zip, "metadata.json");
            const secureDataInfo = metadata?.secure_data || null;

            if (!metrics || !plotBase64) throw new Error("Artifact missing files.");

            setViewedJob({ 
                ...job, 
                returnvalue: { 
                    results: { ...metrics, plot_b64: plotBase64 }, 
                    status: 'success', 
                    secureDataInfo 
                } 
            });
        } catch (e: any) {
            setPageError(`Failed to load log: ${e.message}`);
        } finally {
            setIsFetchingLog(false); setJobIdBeingLogged(null);
        }
        return;
    }

    // CASE 2: Handle Completed Local Jobs
    if (job.state === 'completed') {
        
        // --- 2A: DEMO PROJECT (Fix: Restore this block) ---
        if (job.projectId === DEMO_PROJECT_ID) {
            setViewedJob(job);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // --- 2B: REAL PROJECT -> Log to Chain ---
        if (job.projectId !== DEMO_PROJECT_ID && user?.addr) {
            setIsLogging(true); setJobIdBeingLogged(job.id);
            try {
                const project = projects.find(p => p.id === job.projectId);
                if (!project) throw new Error("Project not found.");

                const results = job.returnvalue.results;
                const inputHash = job.inputDataHash!;
                // Handle potentially different structure of plot data
                const plotBase64 = results?.results?.plot_b64?.split(',')[1] || results?.plot_b64?.split(',')[1]; 

                // 1. Secure Data Process (Using Hook)
                let secureDataMeta = null;
                if (includeSecureData && validatedCsvData) {
                    const encoder = new TextEncoder();
                    const currentHash = await generateDataHash(validatedCsvData);
                    
                    if (currentHash === inputHash) {
                        secureDataMeta = await processSecureLog(
                            encoder.encode(validatedCsvData).buffer, 
                            inputHash, 
                            { name: project.name, nft_id: project.nft_id }, 
                            'ld50'
                        );
                        if (!secureDataMeta) { // Cancelled
                            setIsLogging(false); setJobIdBeingLogged(null); return;
                        }
                    }
                }

                // 2. Create IPFS Artifact (Specific to LD50 files)
                const metricsJsonString = JSON.stringify(results.results || results, null, 2);
                const metadata = {
                    schema_version: "1.1.0",
                    analysis_agent: "KintaGen LD50 Agent v1.0",
                    timestamp_utc: new Date().toISOString(),
                    input_data_hash_sha256: inputHash,
                    secure_data: secureDataMeta,
                    outputs: [
                    { filename: "ld50_plot.png", hash_sha256: await generateDataHash(plotBase64) }, 
                    { filename: "ld50_metrics.json", hash_sha256: await generateDataHash(metricsJsonString) }
                    ]
                };

                const zip = new JSZip();
                zip.file("metadata.json", JSON.stringify(metadata, null, 2));
                zip.file("ld50_plot.png", plotBase64, { base64: true });
                zip.file("ld50_metrics.json", metricsJsonString);
                
                const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact.zip`);
                const cid = await uploadFile(zipFile);
                if (!cid) throw new Error("Upload failed.");

                // 3. Mint Transaction (Using Hook)
                let desc = `Analysis results for input hash: ${inputHash}`;
                if (secureDataMeta) desc += ` | 🔒 Encrypted Data Linked`;

                const cadence = getAddToLogTransaction({ KintaGenNFT: flowConfig.addresses["KintaGenNFT"], ...flowConfig.addresses });
                
                executeTransaction({
                    cadence,
                    args: (arg, t) => [
                        arg(project.nft_id, t.UInt64), 
                        arg("KintaGen LD50 Agent", t.String), 
                        arg(job.label, t.String), 
                        arg(desc, t.String), 
                        arg(cid, t.String)
                    ],
                    limit: 9999 
                });

            } catch (e: any) {
                setPageError(e.message);
                setIsLogging(false);
                setJobIdBeingLogged(null);
            }
        }
    }
  };

  const overallIsLogging = isLogging || isTxPending || isFetchingLog;

  return (
    <>
      <Helmet><title>LD50 Analysis - KintaGen</title></Helmet>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-4">LD50 Dose-Response Analysis</h1>
        <p className="text-gray-400 mb-8">Select the Demo Project or one of your on-chain projects to run an analysis.</p>
        
        <SecureModeBanner 
            visible={!!validatedCsvData && selectedProjectId !== DEMO_PROJECT_ID}
            checked={includeSecureData}
            onChange={setIncludeSecureData}
            hasIdentity={hasNostrIdentity}
            label="Secure Mode: Encrypt raw CSV data and link to your Nostr App Profile."
        />

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
            onDataValidated={setValidatedCsvData}
            onDataCleared={() => setValidatedCsvData(null)}
            validatedCsvData={validatedCsvData}
        />
        
        {(pageError || txError) && ( 
            <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg my-4 flex items-start space-x-3">
                <XCircleIcon className="h-6 w-6 mt-0.5" />
                <p>{pageError || txError}</p>
            </div> 
        )}
        
        {viewedJob && (
          <AnalysisResultsDisplay
            job={viewedJob}
            isLoading={isFetchingLog && jobIdBeingLogged === viewedJob.id}
          />
        )}
        
        <AnalysisJobsList
            jobs={displayJobs} 
            onViewAndLogResults={handleViewAndLogResults}
            jobIdBeingLogged={jobIdBeingLogged}
            isLoggingAnyJob={overallIsLogging}
            onClearJobs={() => {
                const id = selectedProjectId || DEMO_PROJECT_ID;
                setJobs(prev => prev.filter(j => j.projectId !== id));
            }}
        />
      </div>
      
      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => { 
            setIsDialogOpen(isOpen); 
            if (!isOpen) { setIsLogging(false); setJobIdBeingLogged(null); }
        }}
        txId={dialogTxId || undefined}
        onSuccess={refetchProjects}
        pendingTitle="Logging Analysis to the Chain"
        successTitle="Log Entry Confirmed!"
        successDescription="Your analysis results have been permanently recorded. If enabled, secure data was updated in your Nostr profile."
      />
    </>
  );
};

export default LD50AnalysisPage;