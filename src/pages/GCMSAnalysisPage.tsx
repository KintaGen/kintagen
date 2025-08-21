// src/pages/GcmsAnalysisPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  BeakerIcon, ArrowPathIcon, TableCellsIcon, ChartPieIcon, PresentationChartLineIcon,
  SparklesIcon, MapIcon, PresentationChartBarIcon, XCircleIcon, ScaleIcon,
  DocumentChartBarIcon as ProfilingIcon, CheckCircleIcon, TrashIcon, ArrowDownTrayIcon,
  EyeIcon, DocumentTextIcon,
} from '@heroicons/react/24/solid';
import JSZip from 'jszip';
import { fetchWithBypass } from '../utils/fetchWithBypass';
import { queueWorkerJob, type Job, type JobState } from '../utils/jobs';
import { useJobs } from '../contexts/JobContext'; // Import the global job context hook

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// --- TYPE DEFINITIONS ---
interface StatsTableEntry {
  feature: string; mzmed: number; rtmed: number; log2FC?: number; p_value?: number;
  p_adj?: number; feature_id?: string; mz?: number; rt?: number; [sample: string]: any;
}
interface ResultData {
  stats_table?: StatsTableEntry[]; pca_plot_b64?: string; volcano_plot_b64?: string;
  feature_table?: StatsTableEntry[]; bpc_plot_b64?: string; top_spectra_plot_b64?: string;
  metabolite_map_b64?: string;
}
interface ApiResponse { status: 'success' | 'error'; error: string | null; log: string[]; results: ResultData; }
interface Project { id: number; name: string; nft_id: number | null; }
interface ExperimentFile { cid: string; title: string; }
type AnalysisType = 'differential' | 'profiling' | null;

const GCMSAnalysisPage: React.FC = () => {
  // Use the global job state instead of local state
  const { jobs, setJobs } = useJobs();

  // Page-specific state for UI and results
  const [analysisType, setAnalysisType] = useState<AnalysisType>(null);
  const [isQueuing, setIsQueuing] = useState<boolean>(false);
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
  const [viewedJobId, setViewedJobId] = useState<string | null>(null);

  const projectIdNum = selectedProjectId ? Number(selectedProjectId) : null;
  const projectGcmsJobs = useMemo(
    () => jobs.filter(j => j.projectId === projectIdNum && (j.kind === 'gcms-differential' || j.kind === 'gcms-profiling')),
    [jobs, projectIdNum]
  );

  const tableData = useMemo(() => results?.results?.stats_table || results?.results?.feature_table, [results]);
  
  const profilingSampleColumns = useMemo(() => {
    if (analysisType === 'profiling' && tableData?.length) {
      const firstRow = tableData[0];
      const fixedColumns = ['feature_id', 'mz', 'rt', '_row', 'feature', 'mzmed', 'rtmed', 'log2FC', 'p_value', 'p_adj'];
      return Object.keys(firstRow).filter(key => !fixedColumns.includes(key));
    }
    return [];
  }, [analysisType, tableData]);

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
    setIsQueuing(false); setError(null); setResults(null); setSaveSuccess(false); setViewedJobId(null);
  };

  const queueGcmsJob = async (useSampleData: boolean) => {
    if (!analysisType) { setError("Please select an analysis type first."); return; }
    resetState();
    setIsQueuing(true);
    try {
      const kind = analysisType === 'differential' ? 'gcms-differential' : 'gcms-profiling';
      const endpoint = analysisType === 'differential' ? '/analyze/gcms-differential' : '/analyze/gcms-profiling';
      const sourceFile = experimentFiles.find(f => f.cid === selectedDataCid);
      const label = useSampleData ? `Sample ${kind}` : `${kind} on ${sourceFile?.title || 'selected file'}`;
      
      const body: Record<string, any> = { projectId: projectIdNum, label };

      if (useSampleData) {
        body.sample = true;
      } else {
        if (!selectedDataCid) throw new Error("Please select a project data file (ZIP).");
        body.dataCid = selectedDataCid;
        if (analysisType === 'differential') {
            if (!selectedPhenoCid) throw new Error("Please select a phenotype/metadata file (.csv) for differential analysis.");
            body.phenoCid = selectedPhenoCid;
        }
      }
      const { job } = await queueWorkerJob({ apiBase: API_BASE, endpoint, body, kind, label, projectId: projectIdNum });
      setJobs(prev => [job, ...prev]);
    } catch (err: any) { setError(err.message || 'Failed to queue GCMS job'); }
    finally { setIsQueuing(false); }
  };

  const handleViewResults = (job: Job) => {
    if (job.returnvalue?.status === 'success') {
      setAnalysisType(job.kind === 'gcms-profiling' ? 'profiling' : 'differential');
      setResults(job.returnvalue as ApiResponse);
      setSelectedProjectId(String(job.projectId));
      setViewedJobId(job.id);
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
      const zip = new JSZip();
      const sourceFile = experimentFiles.find(f => f.cid === selectedDataCid);
      const baseTitle = sourceFile ? `${analysisType === 'differential' ? 'Diff' : 'Prof'}_on_${sourceFile.title.replace(/ /g, '_')}` : `${analysisType} Analysis Results`;
      const plotsToUpload = Object.entries(results.results).filter(([key, value]) => key.endsWith('_b64') && typeof value === 'string');
      for (const [key, base64Data] of plotsToUpload) {
        const plotName = key.replace('_b64', '.png');
        const plotBlob = await (await fetch(base64Data as string)).blob();
        zip.file(plotName, plotBlob);
      }
      const currentTableData = results.results.stats_table || results.results.feature_table;
      if (currentTableData && currentTableData.length > 0) {
        const header = Object.keys(currentTableData[0]).join(',');
        const rows = currentTableData.map((row: any) => Object.values(row).join(','));
        const csvContent = [header, ...rows].join('\n');
        zip.file('results_table.csv', csvContent);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const formData = new FormData();
      formData.append('file', zipBlob, `${baseTitle}_results.zip`);
      formData.append('dataType', 'analysis');
      formData.append('title', `${baseTitle} Results`);
      formData.append('projectId', selectedProjectId);
      const uploadResponse = await fetchWithBypass(`${API_BASE}/upload?async=1`, { method: 'POST', body: formData });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadResult.error || "Failed to upload results ZIP.");
      const project = projects.find(p => p.id === Number(selectedProjectId));
      if (project?.nft_id) {
        const actionDescription = `Saved analysis results for "${baseTitle}"`;
        const logResponse = await fetchWithBypass(`${API_BASE}/projects/${selectedProjectId}/log`, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionDescription, outputCID: uploadResult.rootCID }) 
        });
        if (!logResponse.ok) { throw new Error((await logResponse.json()).error || 'Result files were saved, but failed to add log to NFT.'); }
      }
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
    a.click();
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
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={areProjectsLoading || isQueuing} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
                <option value="">-- Select a Project --</option>
                {projects.map(p => <option key={p.id} value={p.id.toString()}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="data-file-select" className="block text-sm font-medium text-gray-300 mb-2"><div className="flex items-center gap-2"><span>Data File (ZIP)</span></div></label>
              <select id="data-file-select" value={selectedDataCid} onChange={(e) => setSelectedDataCid(e.target.value)} disabled={!selectedProjectId || areFilesLoading || isQueuing} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
                <option value="">-- Select Data File --</option>
                {areFilesLoading && <option disabled>Loading...</option>}
                {experimentFiles.map(f => <option key={f.cid} value={f.cid}>{f.title}</option>)}
              </select>
            </div>
            {analysisType === 'differential' && (
              <div className="md:col-span-2">
                <label htmlFor="pheno-file-select" className="block text-sm font-medium text-gray-300 mb-2"><div className="flex items-center gap-2"><DocumentTextIcon className="h-5 w-5 inline mr-2"/><span>Phenotype/Metadata File (.csv)</span></div></label>
                <select id="pheno-file-select" value={selectedPhenoCid} onChange={(e) => setSelectedPhenoCid(e.target.value)} disabled={!selectedProjectId || areFilesLoading || isQueuing} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select Metadata File --</option>
                  {areFilesLoading && <option disabled>Loading...</option>}
                  {experimentFiles.map(f => <option key={f.cid} value={f.cid}>{f.title}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="pt-6 border-t border-gray-700/50 flex justify-between items-center">
            <button onClick={() => queueGcmsJob(true)} disabled={isQueuing || !selectedProjectId} className="text-indigo-400 hover:underline text-xs disabled:text-gray-500 disabled:no-underline">Run with sample data</button>
            <button onClick={() => queueGcmsJob(false)} disabled={isQueuing || !canAnalyze} className="flex items-center justify-center bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed">
              <BeakerIcon className="h-5 w-5 mr-2" /> {isQueuing ? 'Queuing…' : 'Run Analysis'}
            </button>
          </div>
        </div>
      )}
      {error && (<div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg flex items-start space-x-3 my-8"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Error</h3><p>{error}</p></div></div>)}
      {results && results.status === 'success' && (
        <div className="space-y-12">
            <div className="bg-gray-800 p-4 rounded-lg text-center"><h2 className="text-2xl font-bold text-green-400">Analysis Complete!</h2></div>
            {analysisType === 'differential' && tableData && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {results.results.pca_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><ChartPieIcon className="h-6 w-6 mr-2 text-indigo-400"/>PCA Plot</h3><img src={results.results.pca_plot_b64} alt="PCA Plot" className="w-full h-auto rounded-md bg-white p-1" /></div>}
                    {results.results.volcano_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><PresentationChartLineIcon className="h-6 w-6 mr-2 text-indigo-400"/>Volcano Plot</h3><img src={results.results.volcano_plot_b64} alt="Volcano Plot" className="w-full h-auto rounded-md bg-white p-1" /></div>}
                </div>
                {results.results.bpc_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><PresentationChartBarIcon className="h-6 w-6 mr-2 text-gray-400"/>Base Peak Chromatogram</h3><img src={results.results.bpc_plot_b64} alt="BPC Plot" className="w-full h-auto rounded-md bg-white p-1"/></div>}
                {results.results.metabolite_map_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><MapIcon className="h-6 w-6 mr-2 text-gray-400"/>Metabolite Feature Map</h3><img src={results.results.metabolite_map_b64} alt="Metabolite Map" className="w-full h-auto rounded-md bg-white p-1" /></div>}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><TableCellsIcon className="h-6 w-6 mr-2 text-indigo-400"/>Statistical Results</h3><div className="overflow-x-auto max-h-[500px] border border-gray-700 rounded-lg"><table className="min-w-full divide-y divide-gray-700"><thead className="bg-gray-700 sticky top-0"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Feature</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">m/z</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">RT (sec)</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">log2 FC</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">p-value</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Adj. p-value</th></tr></thead><tbody className="bg-gray-800 divide-y divide-gray-700">{tableData.map((row, i) => (<tr key={row.feature || row.feature_id || i} className="hover:bg-gray-700/50"><td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-300">{row.feature || row.feature_id}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{(row.mz || row.mzmed)?.toFixed(4)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{(row.rt || row.rtmed)?.toFixed(2)}</td><td className={`px-4 py-2 whitespace-nowrap text-sm font-bold ${row.log2FC && row.log2FC > 0 ? 'text-green-400' : 'text-red-400'}`}>{row.log2FC?.toFixed(2)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.p_value?.toExponential(2)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.p_adj?.toExponential(2)}</td></tr>))}</tbody></table></div></div>
              </div>
            )}
            {analysisType === 'profiling' && tableData && (
                <div className="space-y-8">
                    {results.results.bpc_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><PresentationChartBarIcon className="h-6 w-6 mr-2 text-teal-400"/>Base Peak Chromatogram</h3><img src={results.results.bpc_plot_b64} alt="BPC Plot" className="w-full h-auto rounded-md bg-white p-1"/></div>}
                    {results.results.metabolite_map_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><MapIcon className="h-6 w-6 mr-2 text-gray-400"/>Metabolite Feature Map</h3><img src={results.results.metabolite_map_b64} alt="Metabolite Map" className="w-full h-auto rounded-md bg-white p-1" /></div>}
                    {results.results.top_spectra_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><SparklesIcon className="h-6 w-6 mr-2 text-teal-400"/>Top Feature Spectra</h3><img src={results.results.top_spectra_plot_b64} alt="Top Feature Spectra" className="w-full h-auto rounded-md bg-white p-1" /></div>}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><TableCellsIcon className="h-6 w-6 mr-2 text-teal-400"/>Feature Table</h3><div className="overflow-x-auto max-h-[500px] border border-gray-700 rounded-lg"><table className="min-w-full divide-y divide-gray-700"><thead className="bg-gray-700 sticky top-0"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Feature ID</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">m/z</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">RT (sec)</th>{profilingSampleColumns.map(colName => (<th key={colName} className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{colName}</th>))}</tr></thead><tbody className="bg-gray-800 divide-y divide-gray-700">{tableData.map((row, i) => (<tr key={row.feature_id || i} className="hover:bg-gray-700/50"><td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-300">{row.feature_id}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{(row.mz ?? row.mzmed)?.toFixed(4)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{(row.rt ?? row.rtmed)?.toFixed(2)}</td>{profilingSampleColumns.map(colName => (<td key={colName} className="px-4 py-2 whitespace-nowrap text-sm text-white">{typeof row[colName] === 'number' ? (row[colName] as number).toExponential(2) : row[colName]}</td>))}</tr>))}</tbody></table></div></div>
                </div>
            )}
            {selectedProjectId && (<div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center"><h3 className="text-lg font-semibold mb-4">Save & Log Results</h3>{saveSuccess ? (<div className="text-green-400 flex items-center justify-center"><CheckCircleIcon className="h-6 w-6 mr-2"/>Results saved and logged successfully!</div>) : (<><p className="text-gray-400 mb-4 text-sm">Save all plots and tables as new analysis files and add an entry to the project's on-chain log (if available).</p><button onClick={handleSaveAndLog} disabled={isSaving} className="flex items-center justify-center mx-auto bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600">{isSaving ? <ArrowPathIcon className="h-5 w-5 animate-spin"/> : (<><ArrowDownTrayIcon className="h-5 w-5 mr-2"/>Save Results & Log</>)}</button></>)}</div>)}
        </div>
      )}
      <div className="mt-10">
        <div className="bg-gray-800 rounded border border-gray-700 p-4">
          <div className="flex items-center justify-between"><div className="text-gray-300 flex items-center gap-2"><PresentationChartBarIcon className="h-5 w-5" /><span className="font-semibold">Recent GCMS Jobs</span></div><button onClick={() => setJobs(prev => prev.filter(j =>!((j.kind === 'gcms-differential' || j.kind === 'gcms-profiling') && j.projectId === projectIdNum)))} className="ml-4 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center gap-1" title="Clear completed/failed"><TrashIcon className="h-4 w-4" />Clear done</button></div>
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