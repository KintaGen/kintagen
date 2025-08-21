// src/pages/LD50AnalysisPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ChartBarIcon, ArrowPathIcon, EyeIcon,
  BeakerIcon, CheckCircleIcon, XCircleIcon, TrashIcon, ArrowDownTrayIcon,
} from '@heroicons/react/24/solid';
import JSZip from 'jszip';
import { fetchWithBypass } from '../utils/fetchWithBypass';
import { queueWorkerJob, type Job } from '../utils/jobs';
import { useJobs } from '../contexts/JobContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// --- TYPE DEFINITIONS ---
interface Ld50ResultData {
  ld50_estimate: number;
  standard_error: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  plot_b64: string;
}
interface Ld50ApiResponse {
  status: 'success' | 'error';
  error: string | null;
  log: string[];
  results: Ld50ResultData;
}
interface Project { id: number; name: string; nft_id: number | null; }
interface ExperimentFile { cid: string; title: string; }

const LD50AnalysisPage: React.FC = () => {
  // Use the global job state
  const { jobs, setJobs } = useJobs();

  // Page-specific state for UI and results display
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [experimentFiles, setExperimentFiles] = useState<ExperimentFile[]>([]);
  const [selectedFileCid, setSelectedFileCid] = useState<string>('');
  
  const [areProjectsLoading, setAreProjectsLoading] = useState(true);
  const [areFilesLoading, setAreFilesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [results, setResults] = useState<Ld50ApiResponse | null>(null);
  const [viewedJob, setViewedJob] = useState<Job | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const ld50Jobs = useMemo(() => jobs.filter(j => j.kind === 'ld50'), [jobs]);
  
  useEffect(() => {
    (async () => {
      setAreProjectsLoading(true);
      try {
        const res = await fetchWithBypass(`${API_BASE}/projects`);
        if (!res.ok) throw new Error('Could not fetch projects');
        setProjects(await res.json());
      } catch (e: any) { setError(e.message); }
      finally { setAreProjectsLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setExperimentFiles([]);
      setSelectedFileCid('');
      return;
    }
    (async () => {
      setAreFilesLoading(true);
      try {
        const res = await fetchWithBypass(`${API_BASE}/data/experiment?projectId=${selectedProjectId}`);
        setExperimentFiles((await res.json()).data || []);
      } catch (e: any) { setError(e.message || 'Failed to load experiment files.'); }
      finally { setAreFilesLoading(false); }
    })();
  }, [selectedProjectId]);

  const resetState = () => {
    setError(null);
    setResults(null);
    setViewedJob(null);
    setSaveSuccess(false);
  };

  const queueJob = async () => {
    resetState();
    try {
      const label = `LD50 Analysis on ${selectedFileCid ? experimentFiles.find(f => f.cid === selectedFileCid)?.title : 'Sample Data'}`;
      const body: Record<string, any> = {
        label,
        projectId: selectedProjectId ? Number(selectedProjectId) : null,
      };
      if (selectedFileCid) body.dataCid = selectedFileCid;
      else body.sample = true;
      
      const { job } = await queueWorkerJob({
        apiBase: API_BASE, endpoint: '/analyze/ld50', body, kind: 'ld50', label, projectId: body.projectId,
      });
      setJobs(prev => [job, ...prev]);
    } catch (e: any) {
      setError(e.message || 'Failed to queue job');
    }
  };

  const handleViewResults = (job: Job) => {
    if (!job.returnvalue || job.returnvalue.status !== 'success') {
      setError("Job has no successful results to display.");
      return;
    }
    // This function is now very simple: just copy the data to local state for rendering.
    // No pruning logic is needed here anymore.
    setResults(job.returnvalue as Ld50ApiResponse);
    setViewedJob(job);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveAndLog = async () => {
    if (!results || !viewedJob || !viewedJob.projectId) {
        setError("Cannot save: results or project context is missing.");
        return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const zip = new JSZip();
      const baseTitle = viewedJob.label || `LD50_Analysis_${viewedJob.id}`;
      if (results.results.plot_b64) {
        const plotBlob = await (await fetch(results.results.plot_b64)).blob();
        zip.file('ld50_plot.png', plotBlob);
      }
      const metrics = { ...results.results };
      delete (metrics as any).plot_b64;
      zip.file('metrics.json', JSON.stringify(metrics, null, 2));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const formData = new FormData();
      formData.append('file', zipBlob, `${baseTitle}_results.zip`);
      formData.append('dataType', 'analysis');
      formData.append('title', `${baseTitle} Results`);
      formData.append('projectId', String(viewedJob.projectId));
      const uploadResponse = await fetchWithBypass(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadResult.error || "Failed to upload results ZIP.");
      const project = projects.find(p => p.id === viewedJob.projectId);
      if (project?.nft_id) {
        const actionDescription = `Saved LD50 analysis results for "${baseTitle}"`;
        const logResponse = await fetchWithBypass(`${API_BASE}/projects/${viewedJob.projectId}/log`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionDescription, outputCID: uploadResult.rootCID })
        });
        if (!logResponse.ok) throw new Error('Result files were saved, but failed to add log to NFT.');
      }
      setSaveSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  const projectIdNum = selectedProjectId ? Number(selectedProjectId) : null;
  const projectJobs = ld50Jobs.filter(j => j.projectId === projectIdNum);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4">LD50 Dose-Response Analysis</h1>
      <p className="text-gray-400 mb-8">Select a project and an existing experiment file, or run with sample data to calculate the LD50.</p>
      
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="project-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center"><BeakerIcon className="h-5 w-5 inline mr-2"/>Project</label>
            <select id="project-select" value={selectedProjectId} onChange={(e) => { setSelectedProjectId(e.target.value); resetState(); }} disabled={areProjectsLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select a Project --</option>
              {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="file-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center">Experiment File</label>
            <select id="file-select" value={selectedFileCid} onChange={(e) => setSelectedFileCid(e.target.value)} disabled={!selectedProjectId || areFilesLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
              <option value="">-- Use Sample Data --</option>
              {areFilesLoading && <option disabled>Loading files...</option>}
              {experimentFiles.map(f => <option key={f.cid} value={f.cid}>{f.title}</option>)}
            </select>
          </div>
        </div>
        <div className="pt-4 border-t border-gray-700/50 flex flex-col sm:flex-row justify-end items-center gap-4">
          <button onClick={queueJob} disabled={!selectedProjectId} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed">
            <ChartBarIcon className="h-5 w-5 mr-2" /> Run Analysis
          </button>
        </div>
      </div>
      
      {error && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{error}</p></div></div> )}
      
      {results && (
        <div className="space-y-8 my-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold mb-6 border-b border-gray-700 pb-3">Key Metrics</h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-baseline"><span className="text-gray-400">LD50 Estimate:</span><span className="text-2xl font-bold text-green-400">{results.results.ld50_estimate.toFixed(4)}</span></div>
                        <div className="flex justify-between items-baseline"><span className="text-gray-400">Standard Error:</span><span className="font-mono text-lg text-white">{results.results.standard_error.toFixed(4)}</span></div>
                        <div className="flex justify-between items-baseline"><span className="text-gray-400">95% CI:</span><span className="font-mono text-lg text-white">[{results.results.confidence_interval_lower.toFixed(4)}, {results.results.confidence_interval_upper.toFixed(4)}]</span></div>
                    </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[300px]">
                    <h2 className="text-xl font-semibold mb-4 text-center">Dose-Response Plot</h2>
                    {results.results.plot_b64 ? (
                      <img src={results.results.plot_b64} alt="LD50 Dose-Response Curve" className="w-full h-auto rounded-lg bg-white p-1" />
                    ) : (
                      <p className="text-gray-400">Plot data is not available.</p>
                    )}
                </div>
            </div>
            {viewedJob?.projectId && (
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-lg font-semibold mb-4">Save & Log Results</h3>
                {saveSuccess ? (
                  <div className="text-green-400 flex items-center justify-center"><CheckCircleIcon className="h-6 w-6 mr-2"/>Results saved and logged!</div>
                ) : (
                  <>
                    <p className="text-gray-400 mb-4 text-sm">Save plot and metrics as a new analysis file and add to the project's on-chain log.</p>
                    <button onClick={handleSaveAndLog} disabled={isSaving} className="flex items-center justify-center mx-auto bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600">
                      {isSaving ? <ArrowPathIcon className="h-5 w-5 animate-spin"/> : <><ArrowDownTrayIcon className="h-5 w-5 mr-2"/>Save Results & Log</>}
                    </button>
                  </>
                )}
              </div>
            )}
        </div>
      )}
      
      <div className="mt-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">Recent Jobs for this Project</h3>
          <button onClick={() => setJobs(prev => prev.filter(j => !(j.kind === 'ld50' && j.projectId === projectIdNum)))} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center gap-1" title="Clear all LD50 jobs for this project"><TrashIcon className="h-4 w-4" /> Clear All</button>
        </div>
        <ul className="space-y-2">
          {projectJobs.length === 0 && <li className="text-sm text-gray-500">No jobs yet for this project.</li>}
          {projectJobs.map(job => {
            const state = job.state ?? 'waiting';
            const badge = state === 'completed' ? <span className="inline-flex items-center gap-1 text-xs bg-emerald-600/20 text-emerald-300 px-2 py-0.5 rounded"><CheckCircleIcon className="h-4 w-4"/>completed</span>
              : state === 'failed' ? <span className="inline-flex items-center gap-1 text-xs bg-red-600/20 text-red-300 px-2 py-0.5 rounded"><XCircleIcon className="h-4 w-4"/>failed</span>
              : <span className="inline-flex items-center gap-1 text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded"><ArrowPathIcon className="h-4 w-4 animate-spin"/>{state}</span>;
            return (
              <li key={job.id} className="bg-gray-800 border border-gray-700 rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="text-white font-medium">{job.label}</div>
                    <div className="text-gray-400">jobId: <span className="font-mono">{job.id}</span></div>
                    <div className="text-gray-500 text-xs mt-1">{new Date(job.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">{badge}</div>
                </div>
                {state === 'failed' && job.failedReason && (<div className="mt-2 text-xs text-red-300">Reason: {job.failedReason}</div>)}
                {/* The button now correctly checks for the full plot data in the in-memory state */}
                {state === 'completed' && job.returnvalue?.results?.plot_b64 && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleViewResults(job)} className="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5"><EyeIcon className="h-4 w-4"/> View Results</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default LD50AnalysisPage;