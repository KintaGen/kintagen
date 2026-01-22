import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { XCircleIcon } from '@heroicons/react/24/solid';
import JSZip from 'jszip';
import { upload } from '@vercel/blob/client'; 

// --- Custom Hooks & Components ---
import { useOwnedNftProjects } from '../flow/kintagen-nft';
import { useLighthouse } from '../hooks/useLighthouse';
import { useSecureLog } from '../hooks/useSecureLog'; 
import { SecureModeBanner } from '../components/SecureModeBanner'; 
import { generateDataHash } from '../utils/hash';
import { fetchAndUnzipIpfsArtifact, readZipJson, readZipImageB64, readZipText } from '../utils/ipfsHelpers';

// --- Contexts ---
import { useJobs, type Job } from '../contexts/JobContext';
import { useFlowCurrentUser, useFlowConfig, TransactionDialog, useFlowMutate } from '@onflow/react-sdk';
import { getAddToLogTransaction } from '../flow/cadence';

// --- Components ---
import { NmrAnalysisSetupPanel } from '../components/analysis/nmr/NmrAnalysisSetupPanel';
import { NmrAnalysisResultsDisplay } from '../components/analysis/nmr/NmrAnalysisResultsDisplay';
import { AnalysisJobsList } from '../components/analysis/AnalysisJobsList';

// --- Types & Services ---
import { logEvent } from "firebase/analytics";
import { analytics } from '../services/firebase';
import { type ProjectWithStringId, type DisplayJob } from '../types';

export type { DisplayJob } from '../types';
export const DEMO_PROJECT_ID = 'demo-project';

const NMRAnalysisPage: React.FC = () => {
  usePageTitle('1D NMR Spectrum Processing - KintaGen');
  
  // --- Contexts ---
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { jobs, setJobs } = useJobs();
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile, error: uploadError } = useLighthouse();
  
  // --- State ---
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  const [varianFile, setVarianFile] = useState<File | null>(null);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  
  // Logging State
  const [isLogging, setIsLogging] = useState(false);
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();

  // --- Secure Log Hook ---
  // Only enable secure mode availability if we have the file
  const { includeSecureData, setIncludeSecureData, processSecureLog, hasNostrIdentity } = 
    useSecureLog(!!varianFile);

  // --- Polling ---
  useEffect(() => {
    const activeJobs = jobs.filter(job => (job.state === 'waiting' || job.state === 'processing') && job.kind === 'nmr');
    if (activeJobs.length === 0) return;

    const intervalId = setInterval(async () => {
      let jobsWereUpdated = false;
      const updatedJobs = await Promise.all(jobs.map(async (job) => {
        if (job.kind !== 'nmr' || (job.state !== 'waiting' && job.state !== 'processing')) return job;
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

  // --- Display Jobs Logic ---
  const displayJobs = useMemo((): DisplayJob[] => {
    if (selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project) return [];
      
      const onChainLogs: DisplayJob[] = (project.story || [])
        .filter(step => step.title.startsWith("NMR analysis"))
        .map((step, index) => {
            // FIX: Clean hash extraction
            const rawSegment = step.description.split('input hash: ')[1] || '';
            const cleanHash = rawSegment.split(' ')[0].trim();
            
            return { 
                id: `log-${project.id}-${index}`, 
                label: step.title, 
                projectId: project.id, 
                state: 'logged', 
                logData: step, 
                inputDataHash: cleanHash 
            };
        });

      const loggedInputHashes = new Set(onChainLogs.map(log => log.inputDataHash).filter(Boolean));
      
      const localJobs: DisplayJob[] = jobs
        .filter(job => job.kind === 'nmr' && job.projectId === selectedProjectId)
        .filter(job => !loggedInputHashes.has(job.inputDataHash!))
        .map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any, }));
      
      return [...onChainLogs, ...localJobs];
    }
    return jobs.filter(job => job.kind === 'nmr' && job.projectId === DEMO_PROJECT_ID).map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any, }));
  }, [selectedProjectId, projects, jobs]);

  // --- Run Analysis ---
  const handleRunAnalysis = async () => {
    if (!varianFile) { setPageError("Please select a Varian ZIP file to analyze."); return; }
    setPageError(null); setViewedJob(null); setIsAnalysisRunning(true);
    const isDemo = !selectedProjectId || selectedProjectId === DEMO_PROJECT_ID;
    
    // Hash Generation for File
    const fileBuffer = await varianFile.arrayBuffer(); 
    const inputDataHash = await generateDataHash(fileBuffer); 
    
    const jobLabel = `NMR analysis of ${varianFile.name}`; 
    const tempId = `temp_job_${Date.now()}`;
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
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  const toBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // --- LOGGING LOGIC ---
  const handleViewAndLogResults = async (job: DisplayJob) => {
    setPageError(null); setViewedJob(null);

    // CASE 1: View Logged Job (Using Utils)
    if (job.state === 'logged') {
      setIsFetchingLog(true); setJobIdBeingLogged(job.id);
      try {
        const zip = await fetchAndUnzipIpfsArtifact(job.logData!.ipfsHash);
        
        // Read Metadata
        const metadata = await readZipJson(zip, "metadata.json");
        const secureDataInfo = metadata?.secure_data || null;

        // Read Results
        const [spectrum_data, peaks, summary_table, referencing_info, summary_text, plot_b64, residual_zoom_plot_b64] = await Promise.all([
            readZipJson(zip, "spectrum_data.json"),
            readZipJson(zip, "peaks.json"),
            readZipJson(zip, "summary_table.json"),
            readZipJson(zip, "referencing_info.json"),
            readZipText(zip, "summary_text.txt"),
            readZipImageB64(zip, "nmr_plot.png"),
            readZipImageB64(zip, "calibration_zoom_plot.png")
        ]);

        setViewedJob({ 
            ...job, 
            returnvalue: { 
                results: { spectrum_data, peaks, summary_table, referencing_info, summary_text, plot_b64, residual_zoom_plot_b64 }, 
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
        
      // --- 2A: DEMO PROJECT ---
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

          // 1. Secure Data (Using Hook)
          let secureDataMeta = null;
          if (includeSecureData && varianFile) {
              const fileBuffer = await varianFile.arrayBuffer();
              const currentHash = await generateDataHash(fileBuffer);
              
              if (currentHash === inputHash) {
                  // Pass binary buffer directly
                  secureDataMeta = await processSecureLog(
                      fileBuffer,
                      inputHash,
                      { name: project.name, nft_id: project.nft_id },
                      'nmr'
                  );
                  if (!secureDataMeta) {
                      setIsLogging(false); setJobIdBeingLogged(null); return;
                  }
              } else {
                  console.warn("Hash mismatch.");
              }
          }

          // 2. IPFS Artifact
          const outputs = [];
          const zip = new JSZip();
          
          const addAndHash = async (name: string, content: any, isBase64 = false) => {
              if (!content) return;
              const strContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
              zip.file(name, strContent, isBase64 ? { base64: true } : undefined);
              
              const raw = isBase64 ? strContent : strContent; // Hash the content that is written
              const hash = await generateDataHash(raw); 
              outputs.push({ filename: name, hash_sha256: hash });
          };

          await addAndHash("spectrum_data.json", results.spectrum_data);
          await addAndHash("peaks.json", results.peaks);
          await addAndHash("summary_table.json", results.summary_table);
          await addAndHash("referencing_info.json", results.referencing_info);
          await addAndHash("summary_text.txt", results.summary_text);
          if(results.plot_b64) await addAndHash("nmr_plot.png", results.plot_b64.split(',')[1], true);
          if(results.residual_zoom_plot_b64) await addAndHash("calibration_zoom_plot.png", results.residual_zoom_plot_b64.split(',')[1], true);

          const metadata = {
              schema_version: "1.0.0",
              analysis_agent: "KintaGen NMR Agent v1.0",
              timestamp_utc: new Date().toISOString(),
              input_data_hash_sha256: inputHash,
              secure_data: secureDataMeta,
              outputs: outputs.filter(Boolean)
          };
          zip.file("metadata.json", JSON.stringify(metadata, null, 2));

          const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact.zip`);
          const cid = await uploadFile(zipFile);
          if (!cid) throw new Error("Upload failed.");
          
          // 3. Transaction
          let desc = `Analysis results for input hash: ${inputHash}`;
          if (secureDataMeta) desc += ` | 🔒 Encrypted Data Linked`;
          
          const cadence = getAddToLogTransaction({ KintaGenNFT: flowConfig.addresses["KintaGenNFT"], ...flowConfig.addresses });
          
          executeTransaction({ 
              cadence, 
              args: (arg, t) => [
                  arg(project.nft_id, t.UInt64), 
                  arg("KintaGen NMR Agent", t.String), 
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
  
  // --- Transaction result handling ---
  useEffect(() => {
    if (isTxSuccess && txId) {
      setDialogTxId(txId as string);
      setIsDialogOpen(true);
    }
    if (isTxError && txError) {
      const errorMessage = (txError as Error)?.message?.includes("User rejected") ? "Transaction cancelled by user." : (txError as Error).message;
      setPageError(`Transaction failed: ${errorMessage}`);
      setIsLogging(false);
      setJobIdBeingLogged(null);
    }
  }, [isTxSuccess, isTxError, txId, txError]);
  
  const overallIsLogging = isLogging || isTxPending || isFetchingLog;

  return (
    <>
      <Helmet>
        <title>1D NMR Spectrum Processing - KintaGen</title>
      </Helmet>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-4">1D NMR Spectrum Processing</h1>
        <p className="text-gray-400 mb-8">Select a project and upload a Varian data folder to process a 1D NMR spectrum.</p>
        
        {/* REUSABLE SECURE BANNER */}
        <SecureModeBanner 
            visible={!!varianFile && selectedProjectId !== DEMO_PROJECT_ID}
            checked={includeSecureData}
            onChange={setIncludeSecureData}
            hasIdentity={hasNostrIdentity}
            label="Secure Mode: Encrypt raw Varian ZIP and link to your Nostr App Profile."
        />

        <NmrAnalysisSetupPanel projects={projects} selectedProjectId={selectedProjectId} onProjectChange={(id) => { setSelectedProjectId(id); setViewedJob(null); }} onRunAnalysis={handleRunAnalysis} isLoadingProjects={isLoadingProjects} projectsError={projectsError} isAnalysisRunning={isAnalysisRunning} onFileSelected={setVarianFile} selectedFileName={varianFile?.name || ''} />
        
        {pageError && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg my-4 flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{pageError}</p></div></div> )}
        
        {viewedJob && <NmrAnalysisResultsDisplay job={viewedJob} />}
        
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
        onOpenChange={(isOpen) => { 
          setIsDialogOpen(isOpen); 
          if (!isOpen) {
            setIsLogging(false);
            setJobIdBeingLogged(null);
          }
        }}
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