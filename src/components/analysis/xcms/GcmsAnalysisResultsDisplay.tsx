// src/components/analysis/gc-ms/GcmsAnalysisResultsDisplay.tsx

import React, { useRef } from 'react';
import JSZip from 'jszip';
import { ProvenanceAndDownload } from '../ProvenanceAndDownload'; // Adjust path as needed
import { FidChromatogramPlot, type PlotRef } from './FidChromatogramPlot'; 
import { generateDataHash } from '../../../utils/hash'; // Adjust path as needed

// --- Interfaces ---
interface DisplayJob { 
  projectId: string;
  state: 'completed' | 'failed' | 'processing' | 'logged'; 
  returnvalue?: any;
  logData?: any;
}

interface GcmsAnalysisResultsDisplayProps {
  job: DisplayJob;
}

// --- Component ---
export const GcmsAnalysisResultsDisplay: React.FC<GcmsAnalysisResultsDisplayProps> = ({ job }) => {
  const { returnvalue, logData } = job;
  const results = returnvalue?.results;
  
  // Create a ref to hold the imperative handle of the plot component
  const plotRef = useRef<PlotRef>(null);

  // Extract all data structures with safe fallbacks to empty arrays
  const quantReportData = results?.quantitative_report || [];
  const chromatogramData = results?.chromatogram_data || [];
  const integratedPeaksData = results?.integrated_peaks_details || [];
  const topFeatures = results?.top_features || [];

  const metadata = returnvalue ? {
    input_data_hash_sha256: returnvalue.inputDataHash,
    analysis_agent: "KintaGen GC-MS Agent v1.3",
  } : null;

  const handleDownload = async () => {
    if (job.state === 'logged' && logData?.resultCID) {
      window.open(`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${logData.resultCID}?download=true`, '_blank');
      return;
    }

    if (job.state === 'completed' && results && metadata) {
      try {
        const zip = new JSZip();
        const outputs = [];

        // 1. Handle Quantitative Report (JSON)
        if (results.quantitative_report) {
          const jsonString = JSON.stringify(results.quantitative_report, null, 2);
          const jsonHash = await generateDataHash(jsonString);
          outputs.push({ filename: "quantitative_report.json", hash_sha256: jsonHash });
          zip.file("quantitative_report.json", jsonString);
        }
        
        // 2. Handle Top 5 Spectra Plot (PNG)
        if (results.top_5_spectra_plot_b64) {
          const staticPlotBase64 = results.top_5_spectra_plot_b64.split(',')[1];
          const staticPlotHash = await generateDataHash(staticPlotBase64);
          outputs.push({ filename: "top_5_spectra_plot.png", hash_sha256: staticPlotHash });
          zip.file("top_5_spectra_plot.png", staticPlotBase64, { base64: true });
        }

        // 3. Handle Exported Interactive Plot (PNG)
        if (plotRef.current) {
          const plotImageDataUrl = await plotRef.current.exportPlotImage();
          if (plotImageDataUrl) {
            const interactivePlotBase64 = plotImageDataUrl.split(',')[1];
            const interactivePlotHash = await generateDataHash(interactivePlotBase64);
            outputs.push({ filename: "interactive_plot.png", hash_sha256: interactivePlotHash });
            zip.file("interactive_plot.png", interactivePlotBase64, { base64: true });
          }
        }

        if (outputs.length === 0) {
            throw new Error("No output data available to download.");
        }

        const fullMetadata = {
            schema_version: "1.4.0",
            analysis_agent: "KintaGen GC-MS Agent v1.3 (Local Run)",
            timestamp_utc: new Date().toISOString(),
            input_data_hash_sha256: metadata.input_data_hash_sha256,
            outputs: outputs
        };

        zip.file("metadata.json", JSON.stringify(fullMetadata, null, 2));

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `KintaGen_GCMS_Artifact_${new Date().toISOString().split('T')[0]}.zip`;
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
  
  return (
    <>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-white">GC-MS Analysis Results</h2>
        
        <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Quantitative Report</h3>
            {quantReportData.length > 0 ? (
                <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-700">
                    <table className="min-w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">Peak #</th>
                                <th scope="col" className="px-6 py-3">Retention Time (min)</th>
                                <th scope="col" className="px-6 py-3">Peak Area (AU)</th>
                                <th scope="col" className="px-6 py-3">Area %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quantReportData.map((peak: any) => (
                                <tr key={peak.peak_number} className="border-b border-gray-700 hover:bg-gray-600">
                                    <td className="px-6 py-4 font-medium text-white">{peak.peak_number}</td>
                                    <td className="px-6 py-4">{peak.rt_minutes.toFixed(3)}</td>
                                    <td className="px-6 py-4">{peak.peak_area.toLocaleString()}</td>
                                    <td className="px-6 py-4">{peak.area_percent.toFixed(2)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (<p className="text-gray-400">No quantitative data available.</p>)}
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Interactive Chromatogram</h3>
          <FidChromatogramPlot 
            ref={plotRef}
            chromatogramData={chromatogramData}
            integratedPeaks={integratedPeaksData}
            topFeatures={topFeatures}
            quantReportData={quantReportData}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Top 5 Spectra for Identification</h3>
          {results?.top_5_spectra_plot_b64 ? (
            <img 
              src={results.top_5_spectra_plot_b64} 
              alt="Top 5 Mass Spectra Plot" 
              className="rounded-md bg-white p-1" 
            />
          ) : (
            <div className="aspect-video bg-gray-700 rounded-md flex items-center justify-center">
              <p className="text-gray-400">Spectra plot not available.</p>
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