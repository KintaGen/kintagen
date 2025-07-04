// src/pages/GcmsAnalysisPage.tsx
import React, { useState, useEffect } from 'react';
import {
  BeakerIcon, ArrowPathIcon, TableCellsIcon, ChartPieIcon, PresentationChartLineIcon,
  SparklesIcon, DocumentTextIcon, MapIcon, PresentationChartBarIcon, DocumentMagnifyingGlassIcon,
  InboxArrowDownIcon, CheckCircleIcon, XCircleIcon, ScaleIcon, DocumentChartBarIcon as ProfilingIcon,
} from '@heroicons/react/24/solid';
import InfoPopover from '../components/InfoPopover';
import JSZip from 'jszip'; // <-- Import the new library

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const FILECOIN_GATEWAY = 'https://ipfs.io/ipfs';

// --- TYPE DEFINITIONS ---
interface StatsTableEntry { feature: string; mzmed: number; rtmed: number; log2FC?: number; p_value?: number; p_adj?: number; [sample: string]: any; }
interface FeaturePlots { eic_plot_b64: string | null; spectrum_plot_b64: string | null; }
interface ResultData {
  stats_table?: StatsTableEntry[];
  pca_plot_b64?: string;
  volcano_plot_b64?: string;
  feature_table?: StatsTableEntry[];
  bpc_plot_b64?: string;
  top_spectra_plot_b64?: string;
  metabolite_map_b64?: string;
  top_feature_plots?: { [featureId: string]: FeaturePlots; };
}
interface ApiResponse { status: 'success' | 'error' | 'processing'; error: string | null; log: string[]; results: ResultData; }
interface Project { id: number; name: string; nft_id: number | null; }
interface ExperimentFile { cid: string; title: string; }

type AnalysisType = 'differential' | 'profiling' | null;

const GCMSAnalysisPage: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [analysisType, setAnalysisType] = useState<AnalysisType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ApiResponse | null>(null);

  // Input State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [experimentFiles, setExperimentFiles] = useState<ExperimentFile[]>([]);
  const [selectedDataCid, setSelectedDataCid] = useState<string>('');
  const [selectedPhenoCid, setSelectedPhenoCid] = useState<string>('');
  const [areProjectsLoading, setAreProjectsLoading] = useState(true);
  const [areFilesLoading, setAreFilesLoading] = useState(false);

  // Post-analysis State
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
      } catch (err) { console.error("Failed to fetch projects", err); setError("Could not load project list."); }
      finally { setAreProjectsLoading(false); }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setExperimentFiles([]);
      setSelectedDataCid('');
      setSelectedPhenoCid('');
      return;
    }
    const fetchExperimentFiles = async () => {
      setAreFilesLoading(true);
      setExperimentFiles([]);
      setSelectedDataCid('');
      setSelectedPhenoCid('');
      try {
        // Fetch both experiment and analysis files to populate dropdowns
        const [expRes, anaRes] = await Promise.all([
          fetch(`${API_BASE}/data/experiment?projectId=${selectedProjectId}`),
          fetch(`${API_BASE}/data/analysis?projectId=${selectedProjectId}`)
        ]);
        if (!expRes.ok || !anaRes.ok) throw new Error("Could not load files for this project.");
        const expData = (await expRes.json()).data || [];
        const anaData = (await anaRes.json()).data || [];
        setExperimentFiles([...expData, ...anaData]);
      } catch (err: any) { console.error(err); setError(err.message); }
      finally { setAreFilesLoading(false); }
    };
    fetchExperimentFiles();
  }, [selectedProjectId]);

  const resetState = () => {
    setIsLoading(false);
    setError(null);
    setResults(null);
    setSaveSuccess(false);
  };

  // --- API HANDLERS ---
  const handleAnalysis = async (useSampleData = false) => {
    if (!analysisType) return setError("Please select an analysis type first.");
    
    resetState();
    setIsLoading(true);

    let endpoint = '';
    let requestBody = {};

    if (useSampleData) {
      requestBody = { dataPath: '' };
    } else {
      if (!selectedDataCid) {
        setError("Please select a project data file (ZIP).");
        setIsLoading(false);
        return;
      }
      const dataUrl = `${FILECOIN_GATEWAY}/${selectedDataCid}`;
      const phenoUrl = selectedPhenoCid ? `${FILECOIN_GATEWAY}/${selectedPhenoCid}` : dataUrl;
      requestBody = { dataPath: dataUrl };
    }

    if (analysisType === 'differential') {
      endpoint = `${API_BASE}/analyze/gcms-differential`;
    } else {
      endpoint = `${API_BASE}/analyze/gcms-profiling`;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data: ApiResponse = await response.json();
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
      const zip = new JSZip();
      const sourceData = experimentFiles.find(f => f.cid === selectedDataCid)?.title || `Sample ${analysisType} Analysis`;
      const baseTitle = `${analysisType === 'differential' ? 'XCMS_Diff' : 'Profiling'}_on_${sourceData.replace(/ /g, '_')}`;

      // 1. Add all plots to the zip
      const plotsToUpload = Object.entries(results.results).filter(([key, value]) => key.endsWith('_b64') && typeof value === 'string');
      for (const [key, base64Data] of plotsToUpload) {
        const plotName = key.replace('_b64', '.png');
        const plotBlob = await (await fetch(base64Data as string)).blob();
        zip.file(plotName, plotBlob);
      }
      
      // 2. Add the data table as a CSV file to the zip
      const tableData = results.results.stats_table || results.results.feature_table;
      if (tableData && tableData.length > 0) {
        const header = Object.keys(tableData[0]).join(',');
        const rows = tableData.map(row => Object.values(row).join(','));
        const csvContent = [header, ...rows].join('\n');
        zip.file('results_table.csv', csvContent);
      }

      // 3. Generate the final ZIP file as a Blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // 4. Upload the single ZIP file
      const formData = new FormData();
      formData.append('file', zipBlob, `${baseTitle}_results.zip`);
      formData.append('dataType', 'analysis'); // Always an 'analysis' type
      formData.append('title', `${baseTitle} Results`);
      formData.append('projectId', selectedProjectId);

      const uploadResponse = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadResult.error || "Failed to upload results ZIP.");

      // 5. If the project has an NFT, add the log entry
      const project = projects.find(p => p.id === Number(selectedProjectId));
      if (project?.nft_id) {
          const actionDescription = `Saved analysis results for "${baseTitle}"`;
          const logResponse = await fetch(`${API_BASE}/projects/${selectedProjectId}/log`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: actionDescription, outputCID: uploadResult.rootCID })
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

  const canAnalyze = analysisType === 'differential' ? (selectedDataCid && selectedPhenoCid) : !!selectedDataCid;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4">Metabolomics Analysis</h1>
      <p className="text-gray-400 mb-8">Choose a pipeline, select your project data, and run a complete GC-MS analysis workflow.</p>

      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Choose Analysis Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => { setAnalysisType('differential'); resetState(); }} className={`p-4 rounded-lg text-left transition-all ${analysisType === 'differential' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <div className="flex items-start"><ScaleIcon className="h-7 w-7 mr-3 mt-1 flex-shrink-0"/><div><h3 className="font-bold text-white">Differential Analysis</h3><p className="text-sm text-gray-300">Compare two groups (e.g., WT vs KO) to find statistically significant differences.</p></div></div>
            </button>
            <button onClick={() => { setAnalysisType('profiling'); resetState(); }} className={`p-4 rounded-lg text-left transition-all ${analysisType === 'profiling' ? 'bg-teal-600 ring-2 ring-teal-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <div className="flex items-start"><ProfilingIcon className="h-7 w-7 mr-3 mt-1 flex-shrink-0"/><div><h3 className="font-bold text-white">Chemical Profiling</h3><p className="text-sm text-gray-300">Identify all chemical features present in a set of samples without group comparison.</p></div></div>
            </button>
        </div>
      </div>
      
      {analysisType && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">2. Select Input Data</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <div className="flex items-center gap-2"> {/* <-- THE FIX: Flex container */}
                        <BeakerIcon className="h-5 w-5 inline mr-2"/>Project  
                        <InfoPopover title="Project">
                              <p>Vinculate analysis with specific Project</p>
                        </InfoPopover>
                      </div>
                    </label>
                    <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={areProjectsLoading || isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Select a Project --</option>
                        {projects.map(p => <option key={p.id} value={p.id.toString()}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="data-file-select" className="block text-sm font-medium text-gray-300 mb-2">
                        <div className="flex items-center gap-2"> {/* <-- THE FIX: Flex container */}
                            <span>Data File (ZIP)</span>
                            <InfoPopover title="Data File (ZIP)">
                              <p>A single ZIP file containing all your raw data files (`.CDF`, `.mzML`, etc.). For differential analysis, this ZIP must also contain your metadata `.csv` file.</p>
                            </InfoPopover>
                        </div>
                    </label>
                    <select id="data-file-select" value={selectedDataCid} onChange={(e) => setSelectedDataCid(e.target.value)} disabled={!selectedProjectId || areFilesLoading || isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Select Data File --</option>
                        {areFilesLoading && <option disabled>Loading...</option>}
                        {experimentFiles.map(f => <option key={f.cid} value={f.cid}>{f.title}</option>)}
                    </select>
                </div>
            </div>
          </div>
          <div className="pt-6 mt-6 border-t border-gray-700/50 flex justify-between items-center">
              <button onClick={() => handleAnalysis(true)} disabled={isLoading} className="text-indigo-400 hover:underline text-xs">Run with sample data</button>
              <button onClick={() => handleAnalysis(false)} disabled={isLoading || !canAnalyze} className="flex items-center justify-center bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-500 disabled:bg-gray-600">
                  <BeakerIcon className="h-5 w-5 mr-2" />{isLoading ? 'Analyzing...' : 'Run Analysis'}
              </button>
          </div>
        </div>
      )}

      {isLoading && ( <div className="text-center p-10 flex flex-col items-center"><ArrowPathIcon className="h-12 w-12 text-indigo-400 animate-spin mb-4" /><p className="text-lg text-indigo-300">Running full XCMS pipeline... This can take several minutes.</p><p className="text-sm text-gray-400">Please be patient.</p></div> )}
      {error && ( <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg flex items-start space-x-3"><XCircleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold">Analysis Failed</h3><p>{error}</p></div></div> )}
      
      {results && results.status === 'success' && (
        <div className="space-y-12">
            <div className="bg-gray-800 p-4 rounded-lg text-center"><h2 className="text-2xl font-bold text-green-400">Analysis Complete!</h2></div>
            
            {analysisType === 'differential' && results.results.stats_table && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><ChartPieIcon className="h-6 w-6 mr-2 text-indigo-400"/>PCA Plot <InfoPopover title="PCA Plot"><p><strong>Principal Component Analysis (PCA)</strong> shows the overall variance in your dataset. Each point represents a sample. Samples that cluster together are metabolically similar.</p></InfoPopover></h3><img src={results.results.pca_plot_b64} alt="PCA Plot" className="w-full h-auto rounded-md bg-white p-1" /></div>
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><PresentationChartLineIcon className="h-6 w-6 mr-2 text-indigo-400"/>Volcano Plot <InfoPopover title="Volcano Plot"><p>The <strong>Volcano Plot</strong> visualizes statistical significance vs. magnitude of change. Features in the top corners are the most significant and have the largest change between groups.</p></InfoPopover></h3><img src={results.results.volcano_plot_b64} alt="Volcano Plot" className="w-full h-auto rounded-md bg-white p-1" /></div>
                </div>
                {results.results.metabolite_map_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><MapIcon className="h-6 w-6 mr-2 text-gray-400"/>Metabolite Feature Map <InfoPopover title="Metabolite Map"><p>This plot shows every detected feature by its <strong>retention time (RT)</strong> and <strong>mass-to-charge ratio (m/z)</strong>, providing a fingerprint of the sample's chemical complexity.</p></InfoPopover></h3><img src={results.results.metabolite_map_b64} alt="Metabolite Map" className="w-full h-auto rounded-md bg-white p-1" /></div>}
                
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><TableCellsIcon className="h-6 w-6 mr-2 text-indigo-400"/>Statistical Results</h3><div className="overflow-x-auto max-h-[500px] border border-gray-700 rounded-lg"><table className="min-w-full divide-y divide-gray-700"><thead className="bg-gray-700 sticky top-0"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Feature</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">m/z</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">RT (sec)</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">log2 Fold Change</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">p-value</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Adj. p-value</th></tr></thead><tbody className="bg-gray-800 divide-y divide-gray-700">{results.results.stats_table.map((row) => (<tr key={row.feature} className="hover:bg-gray-700/50"><td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-300">{row.feature}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.mzmed.toFixed(4)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.rtmed.toFixed(2)}</td><td className={`px-4 py-2 whitespace-nowrap text-sm font-bold ${row.log2FC && row.log2FC > 0 ? 'text-green-400' : 'text-red-400'}`}>{row.log2FC?.toFixed(2)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.p_value?.toExponential(2)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.p_adj?.toExponential(2)}</td></tr>))}</tbody></table></div></div>
              </div>
            )}

            {analysisType === 'profiling' && results.results.feature_table && (
                <div className="space-y-8">
                    <div className="bg-gray-800 p-6 rounded-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><PresentationChartBarIcon className="h-6 w-6 mr-2 text-teal-400"/>Base Peak Chromatogram <InfoPopover title="BPC"><p>A <strong>Base Peak Chromatogram (BPC)</strong> shows the intensity of the most abundant ion at each point in time for every sample, useful for checking run consistency.</p></InfoPopover></h3><img src={results.results.bpc_plot_b64} alt="BPC Plot" className="w-full h-auto rounded-md bg-white p-1"/></div>
                    {results.results.metabolite_map_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><MapIcon className="h-6 w-6 mr-2 text-gray-400"/>Metabolite Feature Map <InfoPopover title="Metabolite Map"><p>This plot shows every detected feature by its <strong>retention time (RT)</strong> and <strong>mass-to-charge ratio (m/z)</strong>, providing a fingerprint of the sample's chemical complexity.</p></InfoPopover></h3><img src={results.results.metabolite_map_b64} alt="Metabolite Map" className="w-full h-auto rounded-md bg-white p-1" /></div>}
                    {results.results.top_spectra_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><SparklesIcon className="h-6 w-6 mr-2 text-teal-400"/>Top 5 Feature Spectra <InfoPopover title="Mass Spectra"><p>This shows the fragmentation pattern (Intensity vs. m/z) for the 5 most intense features detected across all samples.</p></InfoPopover></h3><img src={results.results.top_spectra_plot_b64} alt="Top 5 Feature Spectra" className="w-full h-auto rounded-md bg-white p-1" /></div>}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><TableCellsIcon className="h-6 w-6 mr-2 text-teal-400"/>Feature Table</h3><div className="overflow-x-auto max-h-[500px] border border-gray-700 rounded-lg"><table className="min-w-full divide-y divide-gray-700"><thead className="bg-gray-700 sticky top-0"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Feature ID</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">m/z</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">RT (sec)</th></tr></thead><tbody className="bg-gray-800 divide-y divide-gray-700">{results.results.feature_table.map((row) => (<tr key={row.feature_id} className="hover:bg-gray-700/50"><td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-300">{row.feature_id}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.mz.toFixed(4)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.rt.toFixed(2)}</td></tr>))}</tbody></table></div></div>
                </div>
            )}
            
            {selectedProjectId && (<div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center"><h3 className="text-lg font-semibold mb-4">Save & Log Results</h3>{saveSuccess ? (<div className="text-green-400 flex items-center justify-center"><CheckCircleIcon className="h-6 w-6 mr-2"/>Results saved and logged successfully!</div>) : (<><p className="text-gray-400 mb-4 text-sm">Save all plots and tables as new analysis files and add an entry to the project's on-chain log (if available).</p><button onClick={handleSaveAndLog} disabled={isSaving} className="flex items-center justify-center mx-auto bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600">{isSaving ? <ArrowPathIcon className="h-5 w-5 animate-spin"/> : <><InboxArrowDownIcon className="h-5 w-5 mr-2"/>Save Results & Log</>}</button></>)}</div>)}
        </div>
      )}
    </div>
  );
};

export default GCMSAnalysisPage;