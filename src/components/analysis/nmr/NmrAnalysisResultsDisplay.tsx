// components/nmr/NmrAnalysisResultsDisplay.tsx
import React, { useMemo, useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { Layout } from 'plotly.js';
import JSZip from 'jszip';

import { ProvenanceAndDownload } from '../ProvenanceAndDownload';
import { generateDataHash } from '../../../utils/hash';

// --- Updated interfaces to match the new backend response ---
interface SpectrumPoint {
  PPM: number;
  Intensity: number;
}

interface ReferencingInfo {
  status: 'success' | 'failed';
  calibration_standard?: string;
  detected_solvent?: string;
  expected_ppm?: number;
  found_peak_at_ppm?: number;
  ppm_correction_applied?: number;
  message?: string;
}

// NEW interfaces for the new data structures
interface Peak {
  PPM: number;
  Intensity: number;
}

interface SummaryBand {
  Band: string;
  count: number;
  examples_ppm: string;
}

interface NmrResults {
  spectrum_data: SpectrumPoint[];
  plot_b64: string;
  referencing_info?: ReferencingInfo;
  // NEW fields from the R script
  residual_zoom_plot_b64?: string;
  peaks?: Peak[];
  summary_table?: SummaryBand[];
  summary_text?: string;
}

interface DisplayJob {
  projectId: string;
  state: 'completed' | 'failed' | 'processing' | 'logged';
  returnvalue?: {
    results: NmrResults;
    status: 'success' | 'error';
  };
  inputDataHash: string;
  logData?: any;
}

interface NmrAnalysisResultsDisplayProps {
  job: DisplayJob;
}


// --- NEW: A component for the high-level text summary ---
const AnalysisSummary: React.FC<{ summaryText?: string }> = ({ summaryText }) => {
  if (!summaryText) return null;
  return (
    <div className="bg-gray-700/50 border border-gray-600 p-4 rounded-md mb-6">
      <h3 className="text-lg font-semibold mb-2 text-gray-200">Analysis Summary</h3>
      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
        {summaryText}
      </pre>
    </div>
  );
};

// --- MODIFIED: Component to display referencing details AND the zoom plot ---
const ReferencingDetails: React.FC<{ info?: ReferencingInfo; zoomPlotB64?: string }> = ({ info, zoomPlotB64 }) => {
  if (!info || info.status === 'failed') {
    return (
      <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-md mb-6">
        <h3 className="font-semibold text-lg mb-1">Automatic Referencing Failed</h3>
        <p className="text-sm">{info?.message || "Could not identify a confident calibration standard."}</p>
      </div>
    );
  }

  const isSolventSameAsStandard = info.calibration_standard === info.detected_solvent;

  return (
    <div className="bg-gray-700/50 border border-gray-600 p-4 rounded-md mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-200">Analysis Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left side: Calibration and Solvent data */}
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-300 mb-2">Calibration</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <p className="text-gray-400">Calibrated Using</p>
                <p className="font-mono text-cyan-400 text-base">{info.calibration_standard}</p>
              </div>
              <div>
                <p className="text-gray-400">Expected (ppm)</p>
                <p className="font-mono text-white text-base">{info.expected_ppm?.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-gray-400">Found (ppm)</p>
                <p className="font-mono text-white text-base">{info.found_peak_at_ppm?.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-gray-400">Correction</p>
                <p className="font-mono text-green-400 text-base">
                  {info.ppm_correction_applied! > 0 ? '+' : ''}
                  {info.ppm_correction_applied?.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
          
          {/* Only show this section if the detected solvent is different from the calibration standard */}
          {!isSolventSameAsStandard && info.detected_solvent !== 'Unknown' && (
             <div>
                <h4 className="font-semibold text-gray-300 mb-1">Solvent Detection</h4>
                <div className="text-sm">
                    <p className="text-gray-400">Detected Bulk Solvent</p>
                    <p className="font-mono text-cyan-400 text-base">{info.detected_solvent}</p>
                </div>
            </div>
          )}
        </div>
        
        {/* Right side: The visual proof of calibration */}
        {zoomPlotB64 ? (
            <div>
              <p className="text-gray-400 text-sm mb-1 text-center font-semibold">Calibration Alignment</p>
              <img src={zoomPlotB64} alt="Zoomed view of calibration standard peak" className="rounded-md bg-white p-1 w-full" />
            </div>
          ) : (
            <div className="aspect-video bg-gray-900/50 rounded-md flex items-center justify-center">
              <p className="text-gray-500 text-sm">Alignment plot not available</p>
            </div>
          )
        }
      </div>
    </div>
  );
};

// --- NEW: A component to display the peak and summary tables ---
const PeakTables: React.FC<{ peaks?: Peak[]; summary?: SummaryBand[] }> = ({ peaks, summary }) => {
  if (!peaks?.length && !summary?.length) return null;
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4 text-gray-300">Detailed Peak Analysis</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prominent Peaks Table */}
        {peaks && peaks.length > 0 && (
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-300 mb-2">Prominent Peaks</h4>
            <div className="max-h-80 overflow-y-auto pr-2">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700/50 sticky top-0">
                  <tr>
                    <th scope="col" className="px-4 py-2">PPM</th>
                    <th scope="col" className="px-4 py-2 text-right">Relative Intensity</th>
                  </tr>
                </thead>
                <tbody>
                  {peaks.map((peak, index) => (
                    <tr key={index} className="border-b border-gray-700 hover:bg-gray-800/50">
                      <td className="px-4 py-1.5 font-mono text-white">{peak.PPM.toFixed(4)}</td>
                      <td className="px-4 py-1.5 font-mono text-gray-300 text-right">{peak.Intensity.toExponential(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Band Summary Table */}
        {summary && summary.length > 0 && (
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-300 mb-2">Functional Group Band Summary</h4>
             <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                  <tr>
                    <th scope="col" className="px-4 py-2">Region</th>
                    <th scope="col" className="px-4 py-2 text-center">Peak Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((band, index) => (
                    <tr key={index} className="border-b border-gray-700 hover:bg-gray-800/50">
                      <td className="px-4 py-2 text-gray-300">{band.Band}</td>
                      <td className="px-4 py-2 font-mono text-white text-center">{band.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </div>
    </div>
  );
};


export const NmrAnalysisResultsDisplay: React.FC<NmrAnalysisResultsDisplayProps> = ({ job }) => {
  const { returnvalue, logData } = job;
  const [metadata, setMetadata] = useState<any | null>(null);
  if (!job) {
    return null; // or return a loading spinner, e.g., <p>Loading results...</p>
  }
  console.log(job)
  const results = useMemo(() => returnvalue?.results, [returnvalue]);

  useEffect(() => {
    setMetadata(null);
    if (job.state === 'completed' && job.returnvalue?.status === 'success') {
      setMetadata({
        input_data_hash_sha256: job.inputDataHash,
        analysis_agent: "KintaGen NMR Agent v1.2 (Local Run)", // Version bump
      });
    } else if (job.state === 'logged') {
        setMetadata({
            input_data_hash_sha256: job.inputDataHash,
            analysis_agent: "KintaGen NMR Agent v1.2",
        });
    }
  }, [job]);

  const handleDownload = async () => {
    if (job.state === 'logged' && logData?.ipfsHash) {
      window.open(`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${logData.ipfsHash}?download=true`, '_blank');
      return;
    }

    if (job.state === 'completed' && results && metadata) {
      try {
        const zip = new JSZip();
        // The full results object now contains everything, including tables
        const resultsJsonString = JSON.stringify(results, null, 2);
        const resultsHash = await generateDataHash(resultsJsonString);

        const outputs = [{ filename: "analysis_results.json", hash_sha256: resultsHash }];
        zip.file("analysis_results.json", resultsJsonString);

        // Add main plot
        if (results.plot_b64) {
            const plotBase64 = results.plot_b64.split(',')[1];
            const plotHash = await generateDataHash(plotBase64);
            outputs.push({ filename: "nmr_plot.png", hash_sha256: plotHash });
            zip.file("nmr_plot.png", plotBase64, { base64: true });
        }
        
        // Add residual zoom plot
        if (results.residual_zoom_plot_b64) {
            const zoomPlotBase64 = results.residual_zoom_plot_b64.split(',')[1];
            const zoomPlotHash = await generateDataHash(zoomPlotBase64);
            outputs.push({ filename: "residual_zoom_plot.png", hash_sha256: zoomPlotHash });
            zip.file("residual_zoom_plot.png", zoomPlotBase64, { base64: true });
        }
        
        const fullMetadata = {
            schema_version: "1.2.0", // Version bump
            analysis_agent: "KintaGen NMR Agent v1.2 (Local Run)",
            timestamp_utc: new Date().toISOString(),
            input_data_hash_sha256: metadata.input_data_hash_sha256,
            outputs: outputs
        };

        zip.file("metadata.json", JSON.stringify(fullMetadata, null, 2));

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
    alert("Download artifact is not available for this job.");
  };

  const plotData = useMemo(() => {
    if (!results?.spectrum_data) return [];
    const x = results.spectrum_data.map((p: SpectrumPoint) => p.PPM);
    const y = results.spectrum_data.map((p: SpectrumPoint) => p.Intensity);
    return [{
      x, y, type: 'scatter' as const, mode: 'lines' as const,
      line: { color: 'rgb(59, 130, 246)', width: 1.5 }, hoverinfo: 'x+y' as const,
    }];
  }, [results?.spectrum_data]);

  const plotLayout = useMemo((): Partial<Layout> => {
    const referencingInfo = results?.referencing_info;
    let titleText = 'Interactive NMR Spectrum';
    let subtitleText = 'Automatic referencing failed or was not performed.';

    if (referencingInfo?.status === 'success') {
      titleText = 'Interactive, Calibrated NMR Spectrum';
      subtitleText = `Calibrated to ${referencingInfo.calibration_standard} @ ${referencingInfo.expected_ppm?.toFixed(2)} ppm. Detected Solvent: ${referencingInfo.detected_solvent || 'Unknown'}.`;
    }

    return {
      title: { text: `${titleText}<br><span style="font-size: 0.8em; color: #cbd5e1;">${subtitleText}</span>`, font: { size: 16, color: '#f3f4f6' } },
      xaxis: { title: { text: 'Chemical Shift (ppm)', font: { color: '#cbd5e1' } }, autorange: 'reversed', color: '#9ca3af', gridcolor: '#4b5563', zeroline: false, },
      yaxis: { title: { text: 'Intensity', font: { color: '#cbd5e1' } }, color: '#9ca3af', gridcolor: '#4b5563', zeroline: false, fixedrange: false, showspikes: true, spikemode: 'across', spikesnap: 'cursor', spikethickness: 1, spikecolor: '#9ca3af', },
      paper_bgcolor: 'transparent', plot_bgcolor: 'rgba(17, 24, 39, 0.8)',
      showlegend: false, margin: { l: 60, r: 30, t: 70, b: 50 }, dragmode: 'zoom',
    };
  }, [results?.referencing_info]);
  const plotConfig = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines', 'zoomIn2d', 'zoomOut2d'] };

  return (
    <>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-white">NMR Analysis Results</h2>
        
        <AnalysisSummary summaryText={results?.summary_text} />

        <ReferencingDetails info={results?.referencing_info} zoomPlotB64={results?.residual_zoom_plot_b64} />
        
        <PeakTables peaks={results?.peaks} summary={results?.summary_table} />
        
        {plotData.length > 0 ? (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Interactive Spectrum</h3>
            <div className="relative h-96 w-full bg-gray-900/70 p-4 rounded-lg">
              <Plot data={plotData} layout={plotLayout} config={plotConfig} style={{ width: '100%', height: '100%' }} />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">Hover for controls. Use mouse wheel or pinch to zoom. Click and drag to pan.</p>
          </div>
        ) : (
          <div className="aspect-video bg-gray-700 rounded-md flex items-center justify-center mb-8">
            <p className="text-gray-400">Interactive plot not available.</p>
          </div>
        )}
      </div>
      <ProvenanceAndDownload 
        job={job}
        metadata={metadata}
        onDownload={handleDownload}
      />
    </>
  );
};