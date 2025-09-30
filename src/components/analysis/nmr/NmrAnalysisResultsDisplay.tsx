// components/nmr/NmrAnalysisResultsDisplay.tsx
import React, { useMemo, useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { Layout } from 'plotly.js';
import JSZip from 'jszip';

import { ProvenanceAndDownload } from '../ProvenanceAndDownload';
import { generateDataHash } from '../../../utils/hash'; // Adjust this path to your project structure

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
  const { returnvalue, logData } = job;
  const [metadata, setMetadata] = useState<any | null>(null);
  
  // Use a stable reference for results to avoid re-running memoized hooks unnecessarily
  const results = useMemo(() => returnvalue?.results, [returnvalue]);

  useEffect(() => {
    // Reset all state whenever a new job is passed in.
    setMetadata(null);

    // --- Data Loading Logic ---
    if (job.state === 'completed' && job.returnvalue?.status === 'success') {
      // Create the metadata object for display from the job's return value.
      setMetadata({
        input_data_hash_sha256: job.returnvalue.inputDataHash,
        analysis_agent: "KintaGen NMR Agent v1 (Local Run)",
      });
    } else if (job.state === 'logged') {
        // For logged jobs, the full metadata is in the IPFS artifact.
        // We'll show what we know from the smart contract log.
        setMetadata({
            input_data_hash_sha256: job.logData.inputDataHash,
            analysis_agent: "KintaGen NMR Agent v1", // Assuming this from context
        });
    }
    
  }, [job]); // This effect re-runs whenever the `job` prop changes.

  const handleDownload = async () => {
    // --- Case 1: Job is logged on-chain. Download the artifact directly from IPFS. ---
    if (job.state === 'logged' && logData?.resultCID) {
      console.log("Downloading existing artifact for job:", job.projectId);
      window.open(`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${logData.resultCID}?download=true`, '_blank');
      return;
    }

    // --- Case 2: Job was a local run. Dynamically create and download the artifact. ---
    if (job.state === 'completed' && results && metadata) {
      console.log("Creating and downloading artifact for local job:", job.projectId);
      try {
        const zip = new JSZip();

        // 1. Prepare raw data files
        const plotBase64 = results.plot_b64.split(',')[1]; // Remove data:image/png;base64, prefix
        const resultsJsonString = JSON.stringify(results, null, 2);

        // 2. Generate SHA256 hashes of the output files
        const plotHash = await generateDataHash(plotBase64);
        const resultsHash = await generateDataHash(resultsJsonString);
        
        // 3. Construct the complete metadata object for provenance
        const fullMetadata = {
            schema_version: "1.0.0",
            analysis_agent: "KintaGen NMR Agent v1 (Local Run)",
            timestamp_utc: new Date().toISOString(),
            input_data_hash_sha256: metadata.input_data_hash_sha256,
            outputs: [
                {
                    filename: "nmr_plot.png",
                    hash_sha256: plotHash
                },
                {
                    filename: "analysis_results.json",
                    hash_sha256: resultsHash
                }
            ]
        };

        // 4. Add all files to the ZIP archive
        zip.file("metadata.json", JSON.stringify(fullMetadata, null, 2));
        zip.file("analysis_results.json", resultsJsonString);
        zip.file("nmr_plot.png", plotBase64, { base64: true });

        // 5. Generate the ZIP blob and trigger the download
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `KintaGen_NMR_Artifact_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

      } catch (error) {
        console.error("Failed to create or download ZIP file:", error);
        alert("An error occurred while creating the download file.");
      }
      return;
    }

    // --- Fallback Case ---
    alert("Download artifact is not available for this job.");
  };

  // --- Plotly Chart Data and Layout ---

  // Prepare the data for the Plotly chart
  const plotData = useMemo(() => {
    if (!results?.spectrum_data) return [];
    
    const x = results.spectrum_data.map((p: SpectrumPoint) => p.PPM);
    const y = results.spectrum_data.map((p: SpectrumPoint) => p.Intensity);

    return [{
      x,
      y,
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: {
        color: 'rgb(59, 130, 246)',
        width: 1.5,
      },
      hoverinfo: 'x+y' as const,
    }];
  }, [results?.spectrum_data]);

  // Configure the layout and styling for the Plotly chart to match the dark theme
  const plotLayout = useMemo((): Partial<Layout> => ({
    title: {
      text: 'Interactive NMR Spectrum',
      font: { size: 16, color: '#f3f4f6' },
    },
    xaxis: {
      title: { text: 'Chemical Shift (ppm)', font: { color: '#cbd5e1' } },
      autorange: 'reversed',
      color: '#9ca3af',
      gridcolor: '#4b5563',
      zeroline: false,
    },
    yaxis: {
      title: { text: 'Intensity', font: { color: '#cbd5e1' } },
      color: '#9ca3af',
      gridcolor: '#4b5563',
      zeroline: false,
      fixedrange: false, 
      showspikes: true,
      spikemode: 'across',
      spikesnap: 'cursor',
      spikethickness: 1,
      spikecolor: '#9ca3af',
    },
    paper_bgcolor: 'rgb(0, 0, 0)', 
    plot_bgcolor: 'rgb(255, 255, 255)',  
    showlegend: false,
    margin: { l: 60, r: 30, t: 50, b: 50 },
    dragmode: 'zoom', // Default to zoom for interactivity
  }), []);

  // Configure Plotly behavior
  const plotConfig = {
    responsive: true,
    displaylogo: false,
    // Customize the mode bar buttons
    modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines', 'zoomIn2d', 'zoomOut2d'],
  };

  return (
    <>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-white">Analysis Results</h2>
        
        {/* Interactive Chart Section (Now using Plotly) */}
        {plotData.length > 0 ? (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Interactive Spectrum</h3>
            <div className="relative h-96 w-full bg-gray-900/70 p-4 rounded-lg">
              <Plot
                data={plotData}
                layout={plotLayout}
                config={plotConfig}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Hover for controls. Use mouse wheel or pinch to zoom. Click and drag to pan.
            </p>
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