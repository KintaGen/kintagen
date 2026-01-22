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
import { fetchAndUnzipIpfsArtifact, readZipJson } from '../utils/ipfsHelpers';
import { SecureModeBanner } from '../components/SecureModeBanner';
import { generateDataHash } from '../utils/hash';

// --- Flow & Services ---
import { useFlowCurrentUser, useFlowConfig, TransactionDialog } from '@onflow/react-sdk';
import { getAddToLogTransaction } from '../flow/cadence';
import { logEvent } from "firebase/analytics";
import { analytics } from '../services/firebase';
import { type DisplayJob, DEMO_PROJECT_ID, type Job } from '../types';

// --- Components ---
import { GcmsAnalysisSetupPanel } from '../components/analysis/xcms/GcmsAnalysisSetupPanel';
import { GcmsAnalysisResultsDisplay } from '../components/analysis/xcms/GcmsAnalysisResultsDisplay';
import { AnalysisJobsList } from '../components/analysis/AnalysisJobsList';

const GCMSAnalysisPage: React.FC = () => {
  usePageTitle('GC-MS Feature Analysis - KintaGen');
  
  // 1. Data Contexts
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();
  const { uploadFile, error: uploadError } = useLighthouse();
  const { user } = useFlowCurrentUser();
  const flowConfig = useFlowConfig();

  // 2. Local State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);
  
  // GCMS Specific: Multiple Files
  const [mzmlFiles, setMzmlFiles] = useState<File[]>([]);
  
  // 3. Status Flags
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [jobIdBeingLogged, setJobIdBeingLogged] = useState<string | null>(null);

  // 4. Custom Hooks
  
  // A. Job Polling & Display List
  const { displayJobs, setJobs } = useAnalysisJobs('gcms', 'GC-MS analysis', selectedProjectId);

  // B. Transaction Lifecycle
  const { 
      executeTransaction, isTxPending, dialogTxId, 
      isDialogOpen, setIsDialogOpen, txError, setTxError 
  } = useTransactionLifecycle(() => {
      setIsLogging(false);
      setJobIdBeingLogged(null);
  });

  // C. Secure Log Logic
  const { includeSecureData, setIncludeSecureData, processSecureLog, hasNostrIdentity } = 
      useSecureLog(mzmlFiles.length > 0);

  // --- Handlers ---

  const handleRunAnalysis = async () => {
    if (mzmlFiles.length === 0) { setPageError("Please select at least one mzML file to analyze."); return; }
    
    setPageError(null); 
    setViewedJob(null); 
    setIsAnalysisRunning(true);
    
    try {
        const isDemo = !selectedProjectId || selectedProjectId === DEMO_PROJECT_ID;
        
        // Generate composite hash
        let combinedHashString = "";
        for (const file of mzmlFiles) {
             const buffer = await file.arrayBuffer();
             const fileHash = await generateDataHash(buffer);
             combinedHashString += fileHash;
        }
        const inputDataHash = await generateDataHash(combinedHashString);
        
        // Determine Label
        const jobLabel = mzmlFiles.length === 1 
            ? `GC-MS analysis of ${mzmlFiles[0].name}`
            : `GC-MS comparison (${mzmlFiles.length} files)`;

        const tempId = `temp_job_${Date.now()}`;
        
        logEvent(analytics, 'run_analysis', { analysis_type: 'gcms_full_workflow', data_source_hash: inputDataHash, is_demo: isDemo, file_count: mzmlFiles.length });
        
        const newJob: Job = { id: tempId, kind: 'gcms', label: jobLabel, projectId: selectedProjectId || DEMO_PROJECT_ID, createdAt: Date.now(), state: 'waiting', inputDataHash: inputDataHash };
        setJobs(prev => [newJob, ...prev]);

        // Upload files
        const uploadPromises = mzmlFiles.map(file => 
            upload(file.name, file, { access: 'public', handleUploadUrl: '/api/jobs/upload-token' })
        );
        const uploadResults = await Promise.all(uploadPromises);
        
        const fileUrls = uploadResults.map(r => r.url).join(',');
        const originalFilenames = mzmlFiles.map(f => f.name).join(',');

        const response = await fetch('/api/jobs/create', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                fileUrl: fileUrls, 
                originalFilename: originalFilenames, 
                analysisType: 'xcms', 
                inputDataHash: inputDataHash 
            }) 
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to create job on the server.');
        setJobs(prevJobs => prevJobs.map(j => j.id === tempId ? { ...j, id: result.jobId, state: 'processing' } : j));

    } catch (e: any) {
        setJobs(prevJobs => prevJobs.map(j => (j.id && j.label.includes(mzmlFiles[0]?.name || 'GC-MS') ? { ...j, state: 'failed', failedReason: e.message } : j)));
        setPageError(`Analysis failed: ${e.message}`);
    } finally {
        setIsAnalysisRunning(false);
    }
  };
  
  const handleViewAndLogResults = async (job: DisplayJob) => {
    setPageError(null); setTxError(null); setViewedJob(null);

    // CASE 1: View Logged Job
    if (job.state === 'logged') {
      setIsFetchingLog(true); setJobIdBeingLogged(job.id);
      try {
        const zip = await fetchAndUnzipIpfsArtifact(job.logData!.ipfsHash);
        
        // Metadata
        const metadata = await readZipJson(zip, "metadata.json");
        const secureDataInfo = metadata?.secure_data || null;

        // Results
        const [
            quantitative_report, top_spectra_data, raw_chromatogram_data,
            smoothed_chromatogram_data, integrated_peaks_details, library_matches
        ] = await Promise.all([ 
            readZipJson(zip, "quantitative_report.json"), 
            readZipJson(zip, "top_spectra_data.json"), 
            readZipJson(zip, "raw_chromatogram.json"), 
            readZipJson(zip, "smoothed_chromatogram.json"), 
            readZipJson(zip, "integrated_peaks.json"), 
            readZipJson(zip, "library_matches.json") 
        ]);

        setViewedJob({ 
            ...job, 
            returnvalue: { 
                results: { 
                    quantitative_report, top_spectra_data, raw_chromatogram_data,
                    smoothed_chromatogram_data, integrated_peaks_details, library_matches 
                }, 
                status: 'success',
                secureDataInfo 
            } 
        });
      } catch (error: any) {
        setPageError(`Failed to load on-chain data: ${error.message}`);
      } finally {
        setIsFetchingLog(false); setJobIdBeingLogged(null);
      }
      return;
    }
    
    // CASE 2: Log Completed Job
    if (job.state === 'completed') {
      
      // 2A. Demo Project
      if (job.projectId === DEMO_PROJECT_ID) {
        setViewedJob(job);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // 2B. Real Project
      if (job.projectId !== DEMO_PROJECT_ID && user?.addr) {
        setIsLogging(true); setJobIdBeingLogged(job.id);
        try {
          const project = projects.find(p => p.id === job.projectId);
          if (!project) throw new Error("Project not found.");
          
          const results = job.returnvalue.results;
          const inputHash = job.inputDataHash!;

          // 1. Secure Data Process
          let secureDataMeta = null;
          if (includeSecureData && mzmlFiles.length > 0) {
              // Re-calculate composite hash to verify files haven't changed
              let combinedHashString = "";
              for (const file of mzmlFiles) {
                   const buffer = await file.arrayBuffer();
                   combinedHashString += await generateDataHash(buffer);
              }
              const currentHash = await generateDataHash(combinedHashString);

              if (currentHash === inputHash) {
                  // For GC-MS, we might have multiple files. 
                  // Zip them into a single archive before encryption.
                  const rawDataZip = new JSZip();
                  mzmlFiles.forEach(f => rawDataZip.file(f.name, f));
                  const zipBlob = await rawDataZip.generateAsync({type: 'blob'});
                  const zipBuffer = await zipBlob.arrayBuffer();

                  secureDataMeta = await processSecureLog(
                      zipBuffer,
                      inputHash,
                      { name: project.name, nft_id: project.nft_id },
                      'gcms'
                  );

                  if (!secureDataMeta) { // Cancelled
                      setIsLogging(false); setJobIdBeingLogged(null); return;
                  }
              } else {
                  console.warn("Hash mismatch. Files changed since analysis run?");
              }
          }

          // 2. IPFS Artifact
          const outputs = [];
          const addAndHash = async (filename: string, content: any) => {
              if (content) {
                  const contentString = JSON.stringify(content);
                  const hash = await generateDataHash(contentString);
                  outputs.push({ filename, hash_sha256: hash });
              }
          };

          await addAndHash("quantitative_report.json", results.quantitative_report);
          await addAndHash("top_spectra_data.json", results.top_spectra_data);
          await addAndHash("raw_chromatogram.json", results.raw_chromatogram_data);
          await addAndHash("smoothed_chromatogram.json", results.smoothed_chromatogram_data);
          await addAndHash("integrated_peaks.json", results.integrated_peaks_details);
          await addAndHash("library_matches.json", results.library_matches);

          const metadata = {
            schema_version: "1.0.0",
            analysis_agent: "KintaGen GC-MS Agent v1.0",
            timestamp_utc: new Date().toISOString(),
            input_data_hash_sha256: inputHash,
            secure_data: secureDataMeta,
            outputs: outputs
          };

          const zip = new JSZip();
          const addJsonToZip = (name: string, data: any) => data && zip.file(name, JSON.stringify(data, null, 2));
          
          zip.file("metadata.json", JSON.stringify(metadata, null, 2));
          addJsonToZip("quantitative_report.json", results.quantitative_report);
          addJsonToZip("top_spectra_data.json", results.top_spectra_data);
          addJsonToZip("raw_chromatogram.json", results.raw_chromatogram_data);
          addJsonToZip("smoothed_chromatogram.json", results.smoothed_chromatogram_data);
          addJsonToZip("integrated_peaks.json", results.integrated_peaks_details);
          addJsonToZip("library_matches.json", results.library_matches);

          const zipFile = new File([await zip.generateAsync({ type: 'blob' })], `artifact.zip`);
          const cid = await uploadFile(zipFile);
          if (!cid) throw new Error(uploadError || "Failed to get CID from IPFS upload.");
          
          // 3. Transaction
          let desc = `Analysis results for input hash: ${inputHash}`;
          if (secureDataMeta) desc += ` | 🔒 Encrypted Data Linked`;

          const cadence = getAddToLogTransaction({ KintaGenNFT: flowConfig.addresses["KintaGenNFT"], ...flowConfig.addresses });
          
          executeTransaction({ 
            cadence, 
            args: (arg, t) => [
                arg(project.nft_id, t.UInt64), 
                arg("KintaGen GC-MS Agent", t.String), 
                arg(job.label, t.String), 
                arg(desc, t.String), 
                arg(cid, t.String)
            ], 
            limit: 9999 
          });

        } catch (error: any) {
          setPageError(`Failed to log results: ${error.message}`);
          setIsLogging(false);
          setJobIdBeingLogged(null);
        }
      }
    }
  };
  
  const overallIsLogging = isLogging || isTxPending || isFetchingLog;

  return (
    <>
      <Helmet>
        <title>GC-MS Feature Analysis - KintaGen</title>
        <meta name="description" content="Perform GC-MS feature detection and quantification from mzML files." />
      </Helmet>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-4">GC-MS Feature Analysis</h1>
        <p className="text-gray-400 mb-8">Select a project and upload mzML files (1 or 2) to perform feature detection and alignment.</p>
        
        {/* Secure Banner */}
        <SecureModeBanner 
            visible={mzmlFiles.length > 0 && selectedProjectId !== DEMO_PROJECT_ID}
            checked={includeSecureData}
            onChange={setIncludeSecureData}
            hasIdentity={hasNostrIdentity}
            label="Secure Mode: Encrypt all mzML files (ZIP) and link to your Nostr App Profile."
        />

        <GcmsAnalysisSetupPanel
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={(id) => { setSelectedProjectId(id); setViewedJob(null); }}
          onRunAnalysis={handleRunAnalysis}
          isLoadingProjects={isLoadingProjects}
          projectsError={projectsError}
          isAnalysisRunning={isAnalysisRunning}
          onFilesSelected={setMzmlFiles} 
          selectedFileNames={mzmlFiles.map(f => f.name)}
        />
        
        {(pageError || txError) && ( 
            <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4 flex items-start space-x-3">
                <XCircleIcon className="h-6 w-6 mt-0.5" />
                <p>{pageError || txError}</p>
            </div> 
        )}
        
        {/* Fix: Safety Check */}
        {viewedJob && <GcmsAnalysisResultsDisplay job={viewedJob} />}
        
        <AnalysisJobsList
          jobs={displayJobs}
          onClearJobs={() => {
            const idToClear = selectedProjectId || DEMO_PROJECT_ID;
            setJobs(prev => prev.filter(j => j.projectId !== idToClear));
          }}
          onViewAndLogResults={handleViewAndLogResults}
          jobIdBeingLogged={jobIdBeingLogged}
          isLoggingAnyJob={overallIsLogging}
        />
      </div>

      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => { 
            setIsDialogOpen(isOpen); 
            if (!isOpen) { setIsLogging(false); setJobIdBeingLogged(null); }
        }}
        txId={dialogTxId || undefined}
        onSuccess={async () => {
          await refetchProjects();
          const justLoggedJob = jobs.find(j => j.id === jobIdBeingLogged);
          if (justLoggedJob) {
            setViewedJob({ ...justLoggedJob, state: 'logged', returnvalue: justLoggedJob.returnvalue });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          setIsLogging(false);
          setJobIdBeingLogged(null);
        }}
        pendingTitle="Logging Analysis to the Chain"
        successTitle="Log Entry Confirmed!"
        successDescription="Your GC-MS analysis results have been permanently recorded."
      />
    </>
  );
};

export default GCMSAnalysisPage;