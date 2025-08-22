// src/pages/GcmsAnalysisPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  BeakerIcon, ArrowPathIcon, XCircleIcon, ScaleIcon,
  DocumentChartBarIcon as ProfilingIcon, CheckCircleIcon, TrashIcon, ArrowDownTrayIcon,
  EyeIcon, DocumentTextIcon, PresentationChartBarIcon, InboxArrowDownIcon,
} from '@heroicons/react/24/solid';
import JSZip from 'jszip';
import { fetchWithBypass } from '../utils/fetchWithBypass';
import { queueWorkerJob, type Job, type JobState } from '../utils/jobs';
import { useJobs } from '../contexts/JobContext';
import GcmsResultsDisplay from '../components/GcmsResultsDisplay';
import InfoPopover from '../components/InfoPopover';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// --- TYPE DEFINITIONS ---
interface ApiResponse { status: 'success' | 'error'; error: string | null; log: string[]; results: any; }
interface Project { id: number; name: string; nft_id: number | null; }
interface ExperimentFile { cid: string; title: string; }
type AnalysisType = 'differential' | 'profiling' | null;

const GCMSAnalysisPage: React.FC = () => {
  const { jobs, setJobs } = useJobs();

  const [analysisType, setAnalysisType] = useState<AnalysisType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [experimentFiles, setExperimentFiles] = useState<ExperimentFile[]>([]);
  const [selectedDataCid, setSelectedDataCid] = useState<string>('');
  const [selectedPhenoCid, setSelectedPhenoCid] = useState<string>('');
  const [areProjectsLoading, setAreProjectsLoading] = useState(true);
  const [areFilesLoading, setAreFilesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const projectIdNum = selectedProjectId ? Number(selectedProjectId) : null;
  const projectGcmsJobs = useMemo(
    () => jobs.filter(j => j.projectId === projectIdNum && (j.kind === 'gcms-differential' || j.kind === 'gcms-profiling')),
    [jobs, projectIdNum]
  );
  
  const anyJobRunning = useMemo(() => projectGcmsJobs.some(j => j.state !== 'completed' && j.state !== 'failed'), [projectGcmsJobs]);

  useEffect(() => {
    (async () => {
      setAreProjectsLoading(true);
      try {
        const response = await fetchWithBypass(`${API_BASE}/projects`);
        if (!response.ok) throw new Error("Could not fetch projects");
        setProjects(await response.json());
      } catch (err: any) { setError("Could not load project list."); }
      finally { setAreProjectsLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setExperimentFiles([]); setSelectedDataCid(''); setSelectedPhenoCid(''); return;
    }
    (async () => {
      setAreFilesLoading(true); setExperimentFiles([]); setSelectedDataCid(''); setSelectedPhenoCid('');
      try {
        const [expRes, anaRes] = await Promise.all([
          fetchWithBypass(`${API_BASE}/data/experiment?projectId=${selectedProjectId}`),
          fetchWithBypass(`${API_BASE}/data/analysis?projectId=${selectedProjectId}`)
        ]);
        if (!expRes.ok || !anaRes.ok) throw new Error("Could not load files for this project.");
        setExperimentFiles([...(await expRes.json()).data || [], ...(await anaRes.json()).data || []]);
      } catch (err: any) { setError(err.message); }
      finally { setAreFilesLoading(false); }
    })();
  }, [selectedProjectId]);

  const resetState = () => {
    setIsLoading(false); setError(null); setResults(null); setSaveSuccess(false);
  };

  const handleAnalysis = async (useSampleData: boolean) => {
    if (!analysisType) return setError("Please select an analysis type first.");
    resetState();
    setIsLoading(true);

    const kind = analysisType === 'differential' ? 'gcms-differential' : 'gcms-profiling';
    const endpoint = analysisType === 'differential' ? '/analyze/gcms-differential' : '/analyze/gcms-profiling';
    
    const body: Record<string, any> = { projectId: projectIdNum };
    if(useSampleData) {
      body.sample = true;
    } else {
      if (!selectedDataCid) { setIsLoading(false); return setError("Please select a project data file (ZIP)."); }
      body.dataCid = selectedDataCid;
      if (analysisType === 'differential') {
        if (!selectedPhenoCid) { setIsLoading(false); return setError("Please select a phenotype/metadata file (.csv)."); }
        body.phenoCid = selectedPhenoCid;
      }
    }

    try {
      const sourceFile = experimentFiles.find(f => f.cid === selectedDataCid);
      const label = useSampleData ? `Sample ${kind}` : `${kind} on ${sourceFile?.title || 'selected file'}`;
      body.label = label;
      
      const { job } = await queueWorkerJob({ apiBase: API_BASE, endpoint, body, kind, label, projectId: projectIdNum });
      setJobs(prev => [job, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewResults = (job: Job) => {
    if (job.returnvalue?.status === 'success') {
      setAnalysisType(job.kind === 'gcms-profiling' ? 'profiling' : 'differential');
      setResults(job.returnvalue as ApiResponse);
      setSelectedProjectId(String(job.projectId));
      setError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setResults(null);
      setError(`Job ${job.id} has no results to display or was pruned. Please re-run if needed.`);
    }
  };

  const handleSaveAndLog = async () => {
    if (!results || !selectedProjectId) { setError("Cannot save: results or project context is missing."); return; }
    setIsSaving(true); setError(null);
    try {
      // Step 1: Prepare the data and ZIP file
      const zip = new JSZip();
      const sourceFile = experimentFiles.find(f => f.cid === selectedDataCid);
      const baseTitle = sourceFile ? `${analysisType === 'differential' ? 'Diff' : 'Prof'}_on_${sourceFile.title.replace(/ /g, '_')}` : `${analysisType} Analysis Results`;
      const plotsToUpload = Object.entries(results.results).filter(([key, value]) => key.endsWith('_b64') && typeof value === 'string');
      for (const [key, base64Data] of plotsToUpload) {
        const plotName = key.replace('_b64', '.png');
        const plotBlob = await (await fetch(base64Data as string)).blob();
        zip.file(plotName, plotBlob);
      }
      const tableData = results.results.stats_table || results.results.feature_table;
      if (tableData && tableData.length > 0) {
        const header = Object.keys(tableData[0]).join(',');
        const rows = tableData.map((row: any) => Object.values(row).join(','));
        const csvContent = [header, ...rows].join('\n');
        zip.file('results_table.csv', csvContent);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const formData = new FormData();
      const zipFileName = `${baseTitle}_results.zip`;
      formData.append('file', zipBlob, zipFileName);
      formData.append('dataType', 'analysis');
      formData.append('title', `${baseTitle} Results`);
      formData.append('projectId', selectedProjectId);
      
      // Step 2: Call the upload endpoint directly
      const uploadResponse = await fetchWithBypass(`${API_BASE}/upload?async=1`, { method: 'POST', body: formData });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadResult.error || "Failed to upload results ZIP.");

      // Step 3: Create the job object with the "meta" tag for the follow-up action
      const project = projects.find(p => p.id === Number(selectedProjectId));
      const actionDescription = `Saved analysis results for "${baseTitle}"`;

      const newJob: Job = {
        id: uploadResult.jobId,
        kind: 'upload-file',
        label: `Uploading: ${zipFileName}`,
        projectId: projectIdNum,
        createdAt: Date.now(),
        state: 'waiting',
        meta: {
          logAfterUpload: project?.nft_id ? {
            action: actionDescription,
            cid: uploadResult.rootCID,
          } : undefined,
        },
      };
      
      setJobs(prev => [newJob, ...prev]);
      setSaveSuccess(true);
    } catch (err: any) { setError(err.message); } finally { setIsSaving(false); }
  };


  const downloadBundle = async (job: Job) => {
    const zip = new JSZip();
    zip.file('meta.json', JSON.stringify({ id: job.id, label: job.label, kind: job.kind, projectId: job.projectId, createdAt: job.createdAt, finishedOn: job.finishedOn ?? null, state: job.state ?? null, }, null, 2));
    if (job.returnvalue) zip.file('result.json', JSON.stringify(job.returnvalue, null, 2));
    if (Array.isArray(job.logs)) zip.file('logs.txt', job.logs.join('\n'));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${job.kind}_${job.id}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const canAnalyze = useMemo(() => {
    if (!selectedProjectId) return false;
    if (analysisType === 'differential') return !!selectedDataCid && !!selectedPhenoCid;
    return !!selectedDataCid;
  }, [analysisType, selectedProjectId, selectedDataCid, selectedPhenoCid]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4">Metabolomics Analysis</h1>
      <p className="text-gray-400 mb-8">Choose a pipeline, select your project data, and run a complete GC-MS analysis workflow.</p>

      {/* --- Section 1 & 2: Forms --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Choose Analysis Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => { setAnalysisType('differential'); resetState(); }} className={`p-4 rounded-lg text-left transition-all ${analysisType === 'differential' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
            <div className="flex items-start"><ScaleIcon className="h-7 w-7 mr-3 mt-1 flex-shrink-0"/><div><h3 className="font-bold text-white">Differential Analysis</h3><p className="text-sm text-gray-300">Compare two groups to find statistically significant differences.</p></div></div>
          </button>
          <button onClick={() => { setAnalysisType('profiling'); resetState(); }} className={`p-4 rounded-lg text-left transition-all ${analysisType === 'profiling' ? 'bg-teal-600 ring-2 ring-teal-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
            <div className="flex items-start"><ProfilingIcon className="h-7 w-7 mr-3 mt-1 flex-shrink-0"/><div><h3 className="font-bold text-white">Chemical Profiling</h3><p className="text-sm text-gray-300">Identify all chemical features present in a set of samples.</p></div></div>
          </button>
        </div>
      </div>
      {analysisType && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">2. Select Input Data</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2"><div className="flex items-center gap-2"><BeakerIcon className="h-5 w-5 inline mr-2"/>Project</div></label>
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={areProjectsLoading || isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
                <option value="">-- Select a Project --</option>
                {projects.map(p => <option key={p.id} value={p.id.toString()}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="data-file-select" className="block text-sm font-medium text-gray-300 mb-2"><div className="flex items-center gap-2"><span>Data File (ZIP)</span><InfoPopover title="Data File (ZIP)"><p>A single ZIP file containing all your raw data files (`.CDF`, `.mzML`, etc.).</p></InfoPopover></div></label>
              <select id="data-file-select" value={selectedDataCid} onChange={(e) => setSelectedDataCid(e.target.value)} disabled={!selectedProjectId || areFilesLoading || isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
                <option value="">-- Select Data File --</option>
                {areFilesLoading && <option disabled>Loading...</option>}
                {experimentFiles.map(f => <option key={f.cid} value={f.cid}>{f.title}</option>)}
              </select>
            </div>
            {analysisType === 'differential' && (
              <div className="md:col-span-2">
                <label htmlFor="pheno-file-select" className="block text-sm font-medium text-gray-300 mb-2"><div className="flex items-center gap-2"><DocumentTextIcon className="h-5 w-5 inline mr-2"/><span>Phenotype/Metadata File (.csv)</span><InfoPopover title="Metadata File"><p>A CSV file with sample names and their corresponding groups. The sample names must match the raw data filenames (without extension).</p></InfoPopover></div></label>
                <select id="pheno-file-select" value={selectedPhenoCid} onChange={(e) => setSelectedPhenoCid(e.target.value)} disabled={!selectedProjectId || areFilesLoading || isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select Metadata File --</option>
                  {areFilesLoading && <option disabled>Loading...</option>}
                  {experimentFiles.map(f => <option key={f.cid} value={f.cid}>{f.title}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="pt-6 border-t border-gray-700/50 flex justify-between items-center">
            <button onClick={() => handleAnalysis(true)} disabled={isLoading || anyJobRunning} className="text-indigo-400 hover:underline text-xs disabled:text-gray-500">Run with sample data</button>
            <button onClick={() => handleAnalysis(false)} disabled={isLoading || anyJobRunning || !canAnalyze} className="flex items-center justify-center bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-500 disabled:bg-gray-600">
              <BeakerIcon className="h-5 w-5 mr-2" />{isLoading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>
      )}

      {(isLoading || (anyJobRunning && !results)) && ( <div className="text-center p-10 flex flex-col items-center"><ArrowPathIcon className="h-12 w-12 text-indigo-400 animate-spin mb-4" /><p className="text-lg text-indigo-300">Running full XCMS pipeline... This can take several minutes.</p><p className="text-sm text-gray-400">Please be patient.</p></div> )}
      {error && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Analysis Failed</h3><p>{error}</p></div></div> )}
      
      {/* --- Section 3: Render the new Results Component --- */}
      <GcmsResultsDisplay
        results={results}
        analysisType={analysisType}
        selectedProjectId={selectedProjectId}
        onSaveAndLog={handleSaveAndLog}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
      />
      
      {/* --- Section 4: Job Tray --- */}
      <div className="mt-10">
        <div className="bg-gray-800 rounded border border-gray-700 p-4">
          <div className="flex items-center justify-between"><div className="text-gray-300 flex items-center gap-2"><PresentationChartBarIcon className="h-5 w-5" /><span className="font-semibold">Recent Jobs for this Project</span></div><button onClick={() => setJobs(prev => prev.filter(j =>!((j.kind === 'gcms-differential' || j.kind === 'gcms-profiling') && j.projectId === projectIdNum)))} className="ml-4 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center gap-1" title="Clear completed/failed"><TrashIcon className="h-4 w-4" />Clear done</button></div>
          <ul className="mt-4 space-y-2">
            {projectGcmsJobs.length === 0 && (<li className="text-sm text-gray-500">No jobs yet for this project.</li>)}
            {projectGcmsJobs.map(job => {
              const state: JobState = (job.state ?? 'waiting') as JobState;
              const badge = state === 'completed' ? <span className="inline-flex items-center gap-1 text-xs bg-emerald-600/20 text-emerald-300 px-2 py-0.5 rounded"><CheckCircleIcon className="h-4 w-4" />completed</span> : state === 'failed' ? <span className="inline-flex items-center gap-1 text-xs bg-red-600/20 text-red-300 px-2 py-0.5 rounded"><XCircleIcon className="h-4 w-4" />failed</span> : <span className="inline-flex items-center gap-1 text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded"><ArrowPathIcon className="h-4 w-4 animate-spin" />{state}</span>;
              return (
                <li key={job.id} className="bg-gray-900 border border-gray-700 rounded p-3">
                  <div className="flex items-center justify-between"><div className="text-sm"><div className="text-white font-medium">{job.label} <span className="text-gray-400">({job.kind})</span></div><div className="text-gray-400">jobId: <span className="font-mono">{job.id}</span></div><div className="text-gray-500 text-xs mt-1">{new Date(job.createdAt).toLocaleString()}</div></div><div className="flex items-center gap-2">{badge}</div></div>
                  {typeof job.progress === 'number' && state === 'active' && (<div className="mt-2"><div className="w-full bg-gray-700 h-2 rounded"><div className="bg-blue-500 h-2 rounded" style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} /></div><div className="text-xs text-gray-400 mt-1">{job.progress}%</div></div>)}
                  {state === 'failed' && job.failedReason && (<div className="mt-2 text-xs text-red-300">Reason: {job.failedReason}</div>)}
                  {state === 'completed' && job.returnvalue && (<div className="mt-3 flex gap-2"><button onClick={() => handleViewResults(job)} className="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5"><EyeIcon className="h-4 w-4" /> View Results</button><button onClick={() => downloadBundle(job)} className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-100 flex items-center gap-1"><ArrowDownTrayIcon className="h-4 w-4" /> Download bundle</button></div>)}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GCMSAnalysisPage;