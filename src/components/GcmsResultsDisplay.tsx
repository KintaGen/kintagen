// src/components/GcmsResultsDisplay.tsx
import React from 'react';
import {
  ArrowPathIcon, TableCellsIcon, ChartPieIcon, PresentationChartLineIcon,
  SparklesIcon, MapIcon, PresentationChartBarIcon, CheckCircleIcon, InboxArrowDownIcon,
} from '@heroicons/react/24/solid';
import InfoPopover from './InfoPopover';

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
type AnalysisType = 'differential' | 'profiling' | null;

// --- COMPONENT PROPS ---
interface GcmsResultsDisplayProps {
  results: ApiResponse | null;
  analysisType: AnalysisType;
  selectedProjectId: string;
  onSaveAndLog: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

const GcmsResultsDisplay: React.FC<GcmsResultsDisplayProps> = ({
  results,
  analysisType,
  selectedProjectId,
  onSaveAndLog,
  isSaving,
  saveSuccess,
}) => {
  if (!results || results.status !== 'success') {
    return null;
  }
  
  return (
    <div className="space-y-12 my-8">
      <div className="bg-gray-800 p-4 rounded-lg text-center"><h2 className="text-2xl font-bold text-green-400">Analysis Complete!</h2></div>
      
      {analysisType === 'differential' && results.results.stats_table && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {results.results.pca_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><ChartPieIcon className="h-6 w-6 mr-2 text-indigo-400"/>PCA Plot <InfoPopover title="PCA Plot"><p><strong>Principal Component Analysis (PCA)</strong> shows the overall variance in your dataset. Each point represents a sample. Samples that cluster together are metabolically similar.</p></InfoPopover></h3><img src={results.results.pca_plot_b64} alt="PCA Plot" className="w-full h-auto rounded-md bg-white p-1" /></div>}
            {results.results.volcano_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><PresentationChartLineIcon className="h-6 w-6 mr-2 text-indigo-400"/>Volcano Plot <InfoPopover title="Volcano Plot"><p>The <strong>Volcano Plot</strong> visualizes statistical significance vs. magnitude of change. Features in the top corners are the most significant and have the largest change between groups.</p></InfoPopover></h3><img src={results.results.volcano_plot_b64} alt="Volcano Plot" className="w-full h-auto rounded-md bg-white p-1" /></div>}
          </div>
          {results.results.metabolite_map_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><MapIcon className="h-6 w-6 mr-2 text-gray-400"/>Metabolite Feature Map <InfoPopover title="Metabolite Map"><p>This plot shows every detected feature by its <strong>retention time (RT)</strong> and <strong>mass-to-charge ratio (m/z)</strong>, providing a fingerprint of the sample's chemical complexity.</p></InfoPopover></h3><img src={results.results.metabolite_map_b64} alt="Metabolite Map" className="w-full h-auto rounded-md bg-white p-1" /></div>}
          
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><TableCellsIcon className="h-6 w-6 mr-2 text-indigo-400"/>Statistical Results</h3><div className="overflow-x-auto max-h-[500px] border border-gray-700 rounded-lg"><table className="min-w-full divide-y divide-gray-700"><thead className="bg-gray-700 sticky top-0"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Feature</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">m/z</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">RT (sec)</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">log2 Fold Change</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">p-value</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Adj. p-value</th></tr></thead><tbody className="bg-gray-800 divide-y divide-gray-700">{results.results.stats_table.map((row) => (<tr key={row.feature} className="hover:bg-gray-700/50"><td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-300">{row.feature}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.mzmed.toFixed(4)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.rtmed.toFixed(2)}</td><td className={`px-4 py-2 whitespace-nowrap text-sm font-bold ${row.log2FC && row.log2FC > 0 ? 'text-green-400' : 'text-red-400'}`}>{row.log2FC?.toFixed(2)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.p_value?.toExponential(2)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.p_adj?.toExponential(2)}</td></tr>))}</tbody></table></div></div>
        </div>
      )}

      {analysisType === 'profiling' && results.results.feature_table && (
          <div className="space-y-8">
              {results.results.bpc_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><PresentationChartBarIcon className="h-6 w-6 mr-2 text-teal-400"/>Base Peak Chromatogram <InfoPopover title="BPC"><p>A <strong>Base Peak Chromatogram (BPC)</strong> shows the intensity of the most abundant ion at each point in time for every sample, useful for checking run consistency.</p></InfoPopover></h3><img src={results.results.bpc_plot_b64} alt="BPC Plot" className="w-full h-auto rounded-md bg-white p-1"/></div>}
              {results.results.metabolite_map_b64 && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><MapIcon className="h-6 w-6 mr-2 text-gray-400"/>Metabolite Feature Map <InfoPopover title="Metabolite Map"><p>This plot shows every detected feature by its <strong>retention time (RT)</strong> and <strong>mass-to-charge ratio (m/z)</strong>, providing a fingerprint of the sample's chemical complexity.</p></InfoPopover></h3><img src={results.results.metabolite_map_b64} alt="Metabolite Map" className="w-full h-auto rounded-md bg-white p-1" /></div>}
              {results.results.top_spectra_plot_b64 && <div className="bg-gray-800 p-6 rounded-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><SparklesIcon className="h-6 w-6 mr-2 text-teal-400"/>Top 5 Feature Spectra <InfoPopover title="Mass Spectra"><p>This shows the fragmentation pattern (Intensity vs. m/z) for the 5 most intense features detected across all samples.</p></InfoPopover></h3><img src={results.results.top_spectra_plot_b64} alt="Top 5 Feature Spectra" className="w-full h-auto rounded-md bg-white p-1" /></div>}
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold mb-4 flex items-center"><TableCellsIcon className="h-6 w-6 mr-2 text-teal-400"/>Feature Table</h3><div className="overflow-x-auto max-h-[500px] border border-gray-700 rounded-lg"><table className="min-w-full divide-y divide-gray-700"><thead className="bg-gray-700 sticky top-0"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Feature ID</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">m/z</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">RT (sec)</th></tr></thead><tbody className="bg-gray-800 divide-y divide-gray-700">{results.results.feature_table.map((row) => (<tr key={row.feature_id} className="hover:bg-gray-700/50"><td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-300">{row.feature_id}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.mz.toFixed(4)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-white">{row.rt.toFixed(2)}</td></tr>))}</tbody></table></div></div>
          </div>
      )}
      
      {selectedProjectId && (<div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center"><h3 className="text-lg font-semibold mb-4">Save & Log Results</h3>{saveSuccess ? (<div className="text-green-400 flex items-center justify-center"><CheckCircleIcon className="h-6 w-6 mr-2"/>Results saved and logged successfully!</div>) : (<><p className="text-gray-400 mb-4 text-sm">Save all plots and tables as new analysis files and add an entry to the project's on-chain log (if available).</p><button onClick={onSaveAndLog} disabled={isSaving} className="flex items-center justify-center mx-auto bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600">{isSaving ? <ArrowPathIcon className="h-5 w-5 animate-spin"/> : <><InboxArrowDownIcon className="h-5 w-5 mr-2"/>Save Results & Log</>}</button></>)}</div>)}
    </div>
  );
};

export default GcmsResultsDisplay;