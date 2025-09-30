// components/analysis/gcms/GcmsAnalysisResultsDisplay.tsx

import React from 'react';
import { ProvenanceAndDownload } from '../ProvenanceAndDownload';
import { TicPlotDisplay } from './TicPlotDisplay'; // The component from our previous conversation
import JSZip from 'jszip';
import { generateDataHash } from '../../../utils/hash'; // Adjust this path to your project structure

interface DisplayJob { 
  projectId: string;
  state: 'completed' | 'failed' | 'processing' | 'logged'; 
  returnvalue?: any;
  logData?: any;
}

interface GcmsAnalysisResultsDisplayProps {
  job: DisplayJob;
}

export const GcmsAnalysisResultsDisplay: React.FC<GcmsAnalysisResultsDisplayProps> = ({ job }) => {
  const { returnvalue, logData } = job;
  const results = returnvalue?.results;
  const ticData = results?.tic_data || [];
  const metadata = returnvalue ? {
    input_data_hash_sha256: returnvalue.inputDataHash,
    analysis_agent: "KintaGen GCMS Agent v1",
  } : null;

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
        // Use the correct plot from the results object
        const plotBase64WithPrefix = results.top_5_spectra_plot_b64;
        if (!plotBase64WithPrefix) {
          throw new Error("Plot data is missing from the results.");
        }
        
        const zip = new JSZip();

        // 1. Prepare raw data files
        const plotBase64 = plotBase64WithPrefix.split(',')[1]; // Remove data:image/png;base64, prefix
        const ticDataJsonString = JSON.stringify(results.tic_data, null, 2);

        // 2. Generate SHA256 hashes of the output files
        const plotHash = await generateDataHash(plotBase64);
        const ticDataHash = await generateDataHash(ticDataJsonString);
        
        // 3. Construct the complete metadata object for provenance
        const fullMetadata = {
            schema_version: "1.0.0",
            analysis_agent: "KintaGen GCMS Agent v1 (Local Run)",
            timestamp_utc: new Date().toISOString(),
            input_data_hash_sha256: metadata.input_data_hash_sha256,
            outputs: [
                {
                    filename: "gcms_tic_plot.png",
                    hash_sha256: plotHash
                },
                {
                    filename: "gcms_tic_data.json",
                    hash_sha256: ticDataHash
                }
            ]
        };

        // 4. Add all files to the ZIP archive
        zip.file("metadata.json", JSON.stringify(fullMetadata, null, 2));
        zip.file("gcms_tic_data.json", ticDataJsonString);
        zip.file("gcms_tic_plot.png", plotBase64, { base64: true });

        // 5. Generate the ZIP blob and trigger the download
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

    // --- Fallback Case ---
    alert("Download artifact is not available for this job.");
  };

  return (
    <>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-white">Analysis Results</h2>
        
        {/* Use the dedicated TicPlotDisplay for the interactive chart */}
        {ticData.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md p-4">
            <TicPlotDisplay ticData={ticData} topN={10} />
          </div>
        ) : (
          <div className="aspect-video bg-gray-700 rounded-md flex items-center justify-center mb-8">
            <p className="text-gray-400">Interactive plot not available.</p>
          </div>
        )}
        
        {/* Static Image Section */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Static Image (from R)</h3>
          {results?.top_5_spectra_plot_b64 ? (
            <img src={results.top_5_spectra_plot_b64} alt="GCMS TIC Plot" className="rounded-md bg-white p-1" />
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