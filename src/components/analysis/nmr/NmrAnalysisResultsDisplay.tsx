// components/nmr/NmrAnalysisResultsDisplay.tsx
import React, { useMemo,useState,useEffect } from 'react';
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

import { ProvenanceAndDownload } from '../ProvenanceAndDownload';


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
  projectId: string;
  state: 'completed' | 'failed' | 'processing' | 'logged'; 
  returnvalue?: any; // For local/demo jobs that are 'completed'
  logData?: any;     // For jobs that are 'logged' on-chain
}

interface NmrAnalysisResultsDisplayProps {
  job: DisplayJob;
}

export const NmrAnalysisResultsDisplay: React.FC<NmrAnalysisResultsDisplayProps> = ({ job }) => {
  const { returnvalue, logData, state, projectId } = job;
  const [metadata, setMetadata] = useState<any | null>(null);
  
  const results = returnvalue?.results;


  useEffect(() => {
    // Reset all state whenever a new job is passed in.
    // This prevents showing stale data from a previous job.

    setMetadata(null);

    // --- Data Loading Logic ---

    // Case 1: The job is 'completed' (a local or demo job).
    // The results are directly available in the `returnvalue` prop.
    if (job.state === 'completed' && job.returnvalue?.status === 'success') {

      // Create the metadata object for display from the job's return value.
      setMetadata({
        input_data_hash_sha256: job.returnvalue.inputDataHash,
        analysis_agent: "KintaGen LD50 Agent v1",
      });
    }
    
  }, [job]); // This effect re-runs whenever the `job` prop changes.

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
    <>
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
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2 text-gray-300">Static Image (from R)</h3>
        {results?.plot_b64 ? (
          <img src={results.plot_b64} alt="NMR Spectrum Plot" className="rounded-md bg-white p-1" />
        ) : (
          <div className="aspect-video bg-gray-700 rounded-md flex items-center justify-center">
            <p className="text-gray-400">Static plot not available.</p>
          </div>
        )}
      </div>

    </div>
    <ProvenanceAndDownload 
      job={job}
      metadata={metadata}
      onDownload={handleDownload}
    />
    </>
  );
};