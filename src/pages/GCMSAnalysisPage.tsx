import React, { useState } from 'react';
import {
  BeakerIcon,
  ArrowPathIcon,
  TableCellsIcon,
  ChartPieIcon,
  PresentationChartLineIcon,
  SparklesIcon,
  DocumentTextIcon,
  MapIcon,
  PresentationChartBarIcon
} from '@heroicons/react/24/solid';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'; // Example backend URL

// --- 1. Type Definitions for the GC-MS API Response ---
// These interfaces match the final JSON structure our R script produces.
interface StatsTableEntry {
  feature: string;
  mzmed: number;
  rtmed: number;
  log2FC: number;
  p_value: number;
  p_adj: number;
}

// Represents the plot pair for a single significant feature
interface FeaturePlots {
  eic_plot_b64: string | null;
  spectrum_plot_b64: string | null;
}

// The main `results` object structure
interface GcmsResultData {
  stats_table: StatsTableEntry[];
  pca_plot_b64: string;
  volcano_plot_b64: string;
  metabolite_map_b64: string; // The new RT vs m/z plot
  top_feature_plots?: {         // Now an object where keys are feature IDs
    [featureId: string]: FeaturePlots;
  };
}

// The top-level API response structure
interface GcmsApiResponse {
  status: 'success' | 'error' | 'processing';
  error: string | null;
  log: string[];
  results: GcmsResultData;
}

// --- 2. The React Component ---
const GcmsAnalysisPage: React.FC = () => {
  // --- State Management ---
  const [dataPath, setDataPath] = useState<string>('');
  const [phenoFile, setPhenoFile] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GcmsApiResponse | null>(null);

  // --- API Call Handler ---
  const handleAnalysis = async (useSampleData = false) => {
    // Reset state for a new analysis
    setIsLoading(true);
    setError(null);
    setResults(null);

    // If using real data, basic validation
    if (!useSampleData && (!dataPath || !phenoFile)) {
      setError('Please provide absolute paths for both the data directory and metadata file.');
      setIsLoading(false);
      return;
    }
    
    // The request body will be empty for sample data, or contain the paths
    const requestBody = useSampleData ? {} : { dataPath, phenoFile };

    try {
      const response = await fetch(`${API_BASE}/analyze-gcms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data: GcmsApiResponse = await response.json();

      if (!response.ok || data.status === 'error') {
        throw new Error(data.error || 'Analysis failed on the server.');
      }
      
      setResults(data);

    } catch (err: any) {
      console.error("Error during GC-MS analysis:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- JSX Rendering ---
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-4">GC-MS Untargeted Metabolomics Analysis</h1>
      <p className="text-gray-400 mb-8">
        Provide absolute paths to your data folder and metadata file, or use the sample data to run a complete XCMS analysis pipeline.
      </p>

      {/* --- Input Section --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 space-y-4">
        <div>
          <label htmlFor="dataPath" className="block text-sm font-medium text-gray-300 mb-2">
            Absolute Path to Data Directory
          </label>
          <input
            id="dataPath"
            type="text"
            value={dataPath}
            onChange={(e) => setDataPath(e.target.value)}
            placeholder="/Users/yourname/path/to/gcms_files"
            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
        </div>
        <div>
          <label htmlFor="phenoFile" className="block text-sm font-medium text-gray-300 mb-2">
            Absolute Path to Metadata CSV File
          </label>
          <input
            id="phenoFile"
            type="text"
            value={phenoFile}
            onChange={(e) => setPhenoFile(e.target.value)}
            placeholder="/Users/yourname/path/to/metadata.csv"
            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button
            onClick={() => handleAnalysis(false)}
            disabled={isLoading || !dataPath || !phenoFile}
            className="flex-1 flex items-center justify-center bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <BeakerIcon className="h-5 w-5 mr-2" />
            {isLoading ? 'Analyzing...' : 'Analyze Custom Data'}
          </button>
          <button
            onClick={() => handleAnalysis(true)}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center bg-gray-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-gray-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <SparklesIcon className="h-5 w-5 mr-2" />
            Run with Sample Data
          </button>
        </div>
      </div>

      {/* --- Loading & Error Section --- */}
      {isLoading && (
        <div className="text-center p-10 flex flex-col items-center">
          <ArrowPathIcon className="h-12 w-12 text-indigo-400 animate-spin mb-4" />
          <p className="text-lg text-indigo-300">Running full XCMS pipeline... This can take several minutes.</p>
          <p className="text-sm text-gray-400">Please be patient.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 p-4 rounded-lg">
          <h3 className="font-bold mb-2">Analysis Failed</h3>
          <p>{error}</p>
        </div>
      )}

      {/* --- Results Section --- */}
      {results && results.status === 'success' && (
        <div className="space-y-12">
            {/* Summary Header */}
            <div className="bg-gray-800 p-4 rounded-lg text-center">
                <h2 className="text-2xl font-bold text-green-400">Analysis Complete!</h2>
                <p className="text-gray-300">Found {results.results.stats_table.length} total features.</p>
            </div>

            {/* --- Global Summary Plots --- */}
            <div>
              <h2 className="text-2xl font-semibold mb-6 border-b-2 border-gray-700 pb-2">Global Summary Plots</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                      <h3 className="text-xl font-semibold mb-4 flex items-center"><ChartPieIcon className="h-6 w-6 mr-2 text-indigo-400"/>PCA Plot</h3>
                      <img src={results.results.pca_plot_b64} alt="PCA Plot" className="w-full h-auto rounded-md bg-white p-1" />
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                      <h3 className="text-xl font-semibold mb-4 flex items-center"><PresentationChartLineIcon className="h-6 w-6 mr-2 text-indigo-400"/>Volcano Plot</h3>
                      <img src={results.results.volcano_plot_b64} alt="Volcano Plot" className="w-full h-auto rounded-md bg-white p-1" />
                  </div>
              </div>
              {/* New Metabolite Map plot takes full width */}
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-8">
                  <h3 className="text-xl font-semibold mb-4 flex items-center"><MapIcon className="h-6 w-6 mr-2 text-indigo-400"/>Metabolite Map (RT vs. m/z)</h3>
                  <img src={results.results.metabolite_map_b64} alt="Metabolite Map" className="w-full h-auto rounded-md bg-white p-1" />
              </div>
            </div>
            
            {/* --- Detailed Feature Plots Section --- */}
            {results.results.top_feature_plots && Object.keys(results.results.top_feature_plots).length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6 border-b-2 border-gray-700 pb-2">Top Significant Features</h2>
                <div className="space-y-10">
                  {/* Iterate over the top_feature_plots object */}
                  {Object.entries(results.results.top_feature_plots).map(([featureId, plots]) => (
                    <div key={featureId} className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
                      <h3 className="text-xl font-bold mb-6 text-cyan-400">
                        Detailed Plots for Feature: <span className="font-mono">{featureId}</span>
                      </h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* EIC Grid Plot */}
                        {plots.eic_plot_b64 && (
                          <div className="bg-gray-800 p-4 rounded-lg">
                            <h4 className="font-semibold mb-3 flex items-center"><PresentationChartBarIcon className="h-5 w-5 mr-2"/>EIC Grid</h4>
                            <img src={plots.eic_plot_b64} alt={`EIC plot for ${featureId}`} className="w-full h-auto rounded-md bg-white p-1" />
                          </div>
                        )}
                        {/* Spectrum Grid Plot */}
                        {plots.spectrum_plot_b64 && (
                          <div className="bg-gray-800 p-4 rounded-lg">
                            <h4 className="font-semibold mb-3 flex items-center"><DocumentTextIcon className="h-5 w-5 mr-2"/>Mass Spectrum Grid</h4>
                            <img src={plots.spectrum_plot_b64} alt={`Spectrum plot for ${featureId}`} className="w-full h-auto rounded-md bg-white p-1" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* --- Statistics Table --- */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                 <h3 className="text-xl font-semibold mb-4 flex items-center"><TableCellsIcon className="h-6 w-6 mr-2 text-indigo-400"/>Statistical Results</h3>
                 <div className="overflow-x-auto max-h-[500px] border border-gray-700 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Feature</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">m/z</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">RT (sec)</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">log2FC</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">p-value</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">p-adj</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {results.results.stats_table.map((row) => (
                                <tr key={row.feature} className="hover:bg-gray-700/50">
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-300">{row.feature}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.mzmed.toFixed(4)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.rtmed.toFixed(2)}</td>
                                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-bold ${row.log2FC > 0 ? 'text-green-400' : 'text-red-400'}`}>{row.log2FC.toFixed(2)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.p_value.toExponential(2)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.p_adj.toExponential(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default GcmsAnalysisPage;