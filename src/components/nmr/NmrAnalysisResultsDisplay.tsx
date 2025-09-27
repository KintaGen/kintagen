// components/nmr/NmrAnalysisResultsDisplay.tsx
import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'hammerjs'; // Import hammerjs for touch gesture support
import { FingerPrintIcon, CheckCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/solid';

// Register Chart.js components and the zoom plugin
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, zoomPlugin
);

// --- Define the new interfaces for the additional data ---
interface Metadata {
  analysis_agent: string;
  input_data_hash_sha256: string;
}

interface LogData {
  agent: string;
  resultCID: string;
  timestamp: string; // Assuming it's a string representing a Unix timestamp
}

// --- Updated main interfaces ---
interface SpectrumPoint {
  PPM: number;
  Intensity: number;
}

interface DisplayJob {
  returnvalue?: {
    results?: {
      plot_b64?: string;
      spectrum_data?: SpectrumPoint[];
    };
    log?: string[];
  };
  // Add all the new optional fields to the job object
  metadata?: Metadata;
  logData?: LogData;
  state?: 'completed' | 'failed' | 'processing' | 'logged';
  projectId?: string;
}

interface NmrAnalysisResultsDisplayProps {
  job: DisplayJob;
}

export const NmrAnalysisResultsDisplay: React.FC<NmrAnalysisResultsDisplayProps> = ({ job }) => {
  const { returnvalue, metadata, logData, state, projectId } = job;
  const results = returnvalue?.results;
  const logs = returnvalue?.log || [];

  // --- Placeholder for the Demo Project ID ---
  // In a real app, this would likely come from a config file or environment variable
  const DEMO_PROJECT_ID = 'demo-project-12345';

  // --- Handler function for the download button ---
  const handleDownload = () => {
    // In a real app, you would trigger a download of a verifiable artifact.
    // This could be a link to an IPFS CID or a call to another API endpoint.
    console.log("Download artifact for job:", job);
    if (logData?.resultCID) {
      window.open(`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${logData.resultCID}?download=true`, '_blank');
    } else {
      alert("Download artifact is not available for this job.");
    }
  };

  const chartData = useMemo(() => {
    // ... (your existing chartData logic is unchanged)
    if (!results?.spectrum_data) return null;
    const labels = results.spectrum_data.map(p => p.PPM);
    const dataPoints = results.spectrum_data.map(p => p.Intensity);
    return {
      labels,
      datasets: [{
        label: 'Intensity', data: dataPoints, borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)', borderWidth: 1, pointRadius: 0, tension: 0.1,
      }],
    };
  }, [results?.spectrum_data]);

  const chartOptions = {
    // ... (your existing chartOptions logic is unchanged)
    responsive: true, maintainAspectRatio: false,
    scales: { x: { reverse: true, title: { display: true, text: 'Chemical Shift (ppm)', color: '#cbd5e1' }, ticks: { color: '#9ca3af' }, grid: { color: '#4b5563' } }, y: { title: { display: true, text: 'Intensity', color: '#cbd5e1' }, ticks: { color: '#9ca3af' }, grid: { color: '#4b5563' } } },
    plugins: { legend: { display: false }, title: { display: true, text: 'Interactive NMR Spectrum', color: '#f3f4f6', font: { size: 16 } }, zoom: { pan: { enabled: true, mode: 'x' as const }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' as const } } },
    animation: false as const,
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4 text-white">Analysis Results</h2>
      
      {/* Interactive Chart Section (Unchanged) */}
      {chartData ? (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Interactive Spectrum</h3>
          <div className="relative h-96 w-full bg-gray-900/70 p-4 rounded-lg">
            <Line options={chartOptions} data={chartData} />
          </div>
           <p className="text-xs text-gray-500 mt-2 text-center">Use mouse wheel or pinch to zoom. Click and drag to pan.</p>
        </div>
      ) : (
         <div className="aspect-video bg-gray-700 rounded-md flex items-center justify-center mb-8">
            <p className="text-gray-400">Interactive plot not available.</p>
         </div>
      )}
      
      {/* Static Image and Logs Grid (Unchanged) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Static Image (from R)</h3>
          {results?.plot_b64 ? (
            <img src={results.plot_b64} alt="NMR Spectrum Plot" className="rounded-md bg-white p-1" />
          ) : (
            <div className="aspect-video bg-gray-700 rounded-md flex items-center justify-center">
              <p className="text-gray-400">Static plot not available.</p>
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Processing Log</h3>
          <div className="bg-gray-900/70 p-3 rounded-md max-h-96 overflow-y-auto font-mono text-xs text-gray-300">
            {logs.map((line, index) => (
              <p key={index} className="whitespace-pre-wrap">{line}</p>
            ))}
            {logs.length === 0 && <p>No log messages.</p>}
          </div>
        </div>
      </div>

      {/* --- NEW: Wrapper for additional sections --- */}
      <div className="mt-8 space-y-8">
        {/* Verifiability & Provenance Section */}
        {metadata && (
          <div className="bg-gray-900/50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
              <FingerPrintIcon className="h-6 w-6 text-cyan-400" />
              Verifiability & Provenance
            </h3>
            <div className="text-left bg-gray-800/60 p-4 rounded-lg text-sm space-y-2">
              <p><strong className="text-gray-400">Analysis Agent:</strong> <span className="font-mono">{metadata.analysis_agent}</span></p>
              <div className="flex items-start">
                <strong className="text-gray-400 flex-shrink-0">Input Dataset Hash (SHA-256):</strong>
                <span className="font-mono text-xs text-cyan-300 break-all ml-2">{metadata.input_data_hash_sha256}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              To verify this result, a third party can re-calculate the SHA-256 hash of the original private dataset and confirm it matches the value above.
            </p>
          </div>
        )}

        {/* On-Chain Log Information Box (only shown for logged jobs) */}
        {state === 'logged' && logData && (
          <div className="bg-gray-900/50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-200 flex items-center justify-center gap-2">
              <CheckCircleIcon className="h-6 w-6 text-green-400" />
              Analysis Logged On-Chain
            </h3>
            <div className="text-left bg-gray-800/60 p-4 rounded-lg text-sm space-y-2">
              <p><strong className="text-gray-400">Agent Type:</strong> <span className="font-mono">{logData.agent}</span></p>
              <p><strong className="text-gray-400">Result CID:</strong> <span className="text-cyan-300 font-mono text-xs break-all"><a href={`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${logData.resultCID}`} target="_blank" rel="noopener noreferrer">{logData.resultCID}</a></span></p>
              <p className="flex items-center gap-1"><strong className="text-gray-400">Timestamp:</strong> <span className="font-mono text-xs">{new Date(parseFloat(logData.timestamp) * 1000).toLocaleString()}</span></p>
            </div>
          </div>
        )}
        
        {/* Conditional Download Button for Demo Mode */}
        {projectId === DEMO_PROJECT_ID && (
          <div className="bg-gray-900/50 p-6 rounded-lg text-center">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Download Demo Results</h3>
            <p className="text-gray-400 mb-4 text-sm">
              Download a verifiable artifact of this demo analysis, including the data hash, metrics, and plot.
            </p>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center mx-auto bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
              disabled={!logData?.resultCID}
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2"/>
              <span>Download Artifact (.zip)</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};