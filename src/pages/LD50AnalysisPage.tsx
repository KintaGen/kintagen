// src/pages/Ld50AnalysisPage.tsx
import React, { useState, useEffect } from 'react';
import { ChartBarIcon, LinkIcon, ArrowPathIcon, SparklesIcon, BeakerIcon, DocumentMagnifyingGlassIcon, InboxArrowDownIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://salty-eyes-visit.loca.lt/api';
const FILECOIN_GATEWAY = 'https://0xcdb8cc9323852ab3bed33f6c54a7e0c15d555353.calibration.filcdn.io';

// --- TYPE DEFINITIONS ---
interface Ld50ResultData {
  ld50_estimate: number;
  standard_error: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  model_coefficients: number[][];
  plot_b64: string;
}

interface Ld50ApiResponse {
  status: 'success' | 'error';
  error: string | null;
  log: string[];
  results: Ld50ResultData;
}

interface Project {
  id: number;
  name: string;
  nft_id: number | null;
}

interface ExperimentFile {
  cid: string;
  title: string;
}

const Ld50AnalysisPage: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [dataUrl, setDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Ld50ApiResponse | null>(null);

  // Project and File Selection State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [experimentFiles, setExperimentFiles] = useState<ExperimentFile[]>([]);
  const [selectedFileCid, setSelectedFileCid] = useState<string>('');
  const [areProjectsLoading, setAreProjectsLoading] = useState(true);
  const [areFilesLoading, setAreFilesLoading] = useState(false);

  // Post-analysis state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- DATA FETCHING & EFFECTS ---
  useEffect(() => {
    const fetchProjects = async () => {
      setAreProjectsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/projects`);
        if (!response.ok) throw new Error("Could not fetch projects");
        setProjects(await response.json());
      } catch (err) {
        console.error("Failed to fetch projects", err);
        setError("Could not load project list.");
      } finally {
        setAreProjectsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setExperimentFiles([]);
      setSelectedFileCid('');
      return;
    }
    const fetchExperimentFiles = async () => {
      setAreFilesLoading(true);
      setExperimentFiles([]);
      setSelectedFileCid('');
      try {
        const response = await fetch(`${API_BASE}/data/experiment?projectId=${selectedProjectId}`);
        const data = await response.json();
        setExperimentFiles(data.data || []);
      } catch (err) {
        console.error("Failed to fetch experiment files", err);
        setError("Could not load experiment files for this project.");
      } finally {
        setAreFilesLoading(false);
      }
    };
    fetchExperimentFiles();
  }, [selectedProjectId]);

  // --- API CALL HANDLERS ---
  const handleAnalysis = async (useSampleData = false) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setSaveSuccess(false);

    let requestBody = {};
    if (useSampleData) {
      // Body remains empty for sample data
    } else if (selectedFileCid) {
      requestBody = { dataUrl: `${FILECOIN_GATEWAY}/${selectedFileCid}` };
    } else if (dataUrl) {
      requestBody = { dataUrl };
    } else {
        setError("Please select a project file or provide a URL.");
        setIsLoading(false);
        return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/analyze-ld50`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data: Ld50ApiResponse = await response.json();
      if (!response.ok || data.status === 'error') throw new Error(data.error || 'Analysis failed on the server.');
      setResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveAndLog = async () => {
    if (!results || !selectedProjectId) return;
    setIsSaving(true);
    setError(null);

    try {
      const plotBase64 = results.results.plot_b64.split(',')[1];
      const plotBlob = await (await fetch(`data:image/png;base64,${plotBase64}`)).blob();
      const metricsBlob = new Blob([JSON.stringify(results.results, null, 2)], { type: 'application/json' });
      
      const sourceFile = experimentFiles.find(f => f.cid === selectedFileCid);
      const baseTitle = sourceFile ? `LD50 from ${sourceFile.title}` : "LD50 Analysis";

      // --- THE KEY CHANGE: AWAIT each upload sequentially ---
      
      console.log("Step 1: Uploading plot result...");
      const plotFormData = new FormData();
      plotFormData.append('file', plotBlob, `${baseTitle}_plot.png`);
      plotFormData.append('dataType', 'analysis');
      plotFormData.append('title', `${baseTitle} - Plot`);
      plotFormData.append('projectId', selectedProjectId);
      const plotResponse = await fetch('http://localhost:3001/api/upload', { method: 'POST', body: plotFormData });
      const plotResult = await plotResponse.json();
      if (!plotResponse.ok) throw new Error('Failed to upload plot result.');
      console.log("Step 1 Complete. Plot CID:", plotResult.rootCID);
      
      console.log("Step 2: Uploading metrics result...");
      const metricsFormData = new FormData();
      metricsFormData.append('file', metricsBlob, `${baseTitle}_metrics.json`);
      metricsFormData.append('dataType', 'analysis');
      metricsFormData.append('title', `${baseTitle} - Metrics`);
      metricsFormData.append('projectId', selectedProjectId);
      const metricsResponse = await fetch('http://localhost:3001/api/upload', { method: 'POST', body: metricsFormData });
      const metricsResult = await metricsResponse.json();
      if (!metricsResponse.ok) throw new Error('Failed to upload metrics result.');
      console.log("Step 2 Complete. Metrics CID:", metricsResult.rootCID);

      // --- The rest of the logic remains the same ---
      const project = projects.find(p => p.id === Number(selectedProjectId));
      if (project?.nft_id) {
        console.log("Step 3: Adding entry to on-chain log...");
        const actionDescription = `Performed LD50 Analysis on "${baseTitle}". Results stored as Plot (CID: ${plotResult.rootCID}) and Metrics (CID: ${metricsResult.rootCID}).`;
        const logResponse = await fetch(`http://localhost:3001/api/projects/${selectedProjectId}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: actionDescription, outputCID: plotResult.rootCID })
        });
        if (!logResponse.ok) throw new Error('Result files were saved, but failed to add log to NFT.');
        console.log("Step 3 Complete.");
      }
      setSaveSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };
  const canAnalyze = selectedFileCid || dataUrl;

  // --- RENDER ---
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4">LD50 Dose-Response Analysis</h1>
      <p className="text-gray-400 mb-8">
        Select a project and an existing experiment file, or provide a public URL to a raw CSV to calculate the LD50.
      </p>

      {/* --- Input Section --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="project-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center"><BeakerIcon className="h-5 w-5 inline mr-2"/>Project</label>
            <select id="project-select" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={areProjectsLoading || isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select a Project --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="file-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center"><DocumentMagnifyingGlassIcon className="h-5 w-5 inline mr-2"/>Experiment File (from Project)</label>
            <select id="file-select" value={selectedFileCid} onChange={(e) => setSelectedFileCid(e.target.value)} disabled={!selectedProjectId || areFilesLoading || isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select a File --</option>
              {areFilesLoading && <option disabled>Loading files...</option>}
              {experimentFiles.map(f => <option key={f.cid} value={f.cid}>{f.title}</option>)}
            </select>
          </div>
        </div>

        <div className="text-center text-gray-500 text-sm flex items-center gap-4"><hr className="flex-grow border-gray-700"/><p>OR</p><hr className="flex-grow border-gray-700"/></div>

        <div>
          <label htmlFor="dataUrl" className="block text-sm font-medium text-gray-300 mb-2">Provide a Public CSV URL</label>
          <div className="relative">
            <LinkIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input id="dataUrl" type="url" value={dataUrl} onChange={(e) => setDataUrl(e.target.value)} placeholder="https://.../data.csv" className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500" disabled={isLoading}/>
          </div>
        </div>
        
        <div className="pt-4 border-t border-gray-700/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button onClick={() => handleAnalysis(true)} disabled={isLoading} className="text-blue-400 hover:underline text-xs order-last sm:order-first">Run with sample data</button>
            <button onClick={() => handleAnalysis(false)} disabled={isLoading || !canAnalyze} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 disabled:bg-gray-600">
                <ChartBarIcon className="h-5 w-5 mr-2" />
                {isLoading ? 'Analyzing...' : 'Run Analysis'}
            </button>
        </div>
      </div>

      {isLoading && ( <div className="text-center p-10 flex flex-col items-center"><ArrowPathIcon className="h-12 w-12 text-blue-400 animate-spin mb-4" /><p className="text-lg text-blue-300">Running dose-response analysis...</p></div> )}
      {error && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Analysis Failed</h3><p>{error}</p></div></div> )}
      
      {results && results.status === 'success' && (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold mb-6 border-b border-gray-700 pb-3">Key Metrics</h2>
                    <div className="space-y-4">
                    <div className="flex justify-between items-baseline">
                        <span className="text-gray-400">LD50 Estimate:</span>
                        <span className="text-2xl font-bold text-green-400">{results.results.ld50_estimate.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-gray-400">Standard Error:</span>
                        <span className="font-mono text-lg text-white">{results.results.standard_error.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-gray-400">95% Confidence Interval:</span>
                        <span className="font-mono text-lg text-white">
                        [{results.results.confidence_interval_lower.toFixed(4)}, {results.results.confidence_interval_upper.toFixed(4)}]
                        </span>
                    </div>
                    </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[300px]">
                    <h2 className="text-xl font-semibold mb-4 text-center">Dose-Response Plot</h2>
                    <img 
                    src={results.results.plot_b64}
                    alt="LD50 Dose-Response Curve"
                    className="w-full h-auto rounded-lg bg-white p-1"
                    />
                </div>
            </div>
            {selectedProjectId && (
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-lg font-semibold mb-4">Save & Log Results</h3>
                {saveSuccess ? (
                  <div className="text-green-400 flex items-center justify-center"><CheckCircleIcon className="h-6 w-6 mr-2"/>Results saved and logged successfully!</div>
                ) : (
                  <>
                    <p className="text-gray-400 mb-4 text-sm">Save the plot and metrics as new experiment files and add an entry to the project's on-chain log (if available).</p>
                    <button onClick={handleSaveAndLog} disabled={isSaving} className="flex items-center justify-center mx-auto bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600">
                      {isSaving ? <ArrowPathIcon className="h-5 w-5 animate-spin"/> : <><InboxArrowDownIcon className="h-5 w-5 mr-2"/>Save Results & Add to Log</>}
                    </button>
                  </>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default Ld50AnalysisPage;