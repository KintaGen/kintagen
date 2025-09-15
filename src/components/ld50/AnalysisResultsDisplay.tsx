import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  FingerPrintIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/solid';
import JSZip from 'jszip';
import { DEMO_PROJECT_ID } from '../../pages/LD50AnalysisPage'; // Adjust the import path as needed
import { generateDataHash } from '../../utils/hash'; // Adjust path if needed

// Type definition for the job prop this component receives.
// It includes all possible data sources.
interface DisplayJob { 
    state: 'completed' | 'failed' | 'processing' | 'logged'; 
    returnvalue?: any; // For local/demo jobs that are 'completed'
    logData?: any;     // For jobs that are 'logged' on-chain
}

// Props interface for the component.
interface AnalysisResultsDisplayProps {
  job: DisplayJob;
  isLoading?: boolean; // True when the parent is logging the job to IPFS/blockchain
}

export const AnalysisResultsDisplay: React.FC<AnalysisResultsDisplayProps> = ({ job, isLoading }) => {
  // State for the data that will be displayed
  const [plotUrl, setPlotUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [metadata, setMetadata] = useState<any | null>(null);
  
  // State for the component's internal operations
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetchingFromIPFS, setIsFetchingFromIPFS] = useState(false);

  useEffect(() => {
    // Reset all state whenever a new job is passed in.
    // This prevents showing stale data from a previous job.
    setPlotUrl(null);
    setMetrics(null);
    setMetadata(null);
    setFetchError(null);
    setIsFetchingFromIPFS(false);

    // --- Data Loading Logic ---

    // Case 1: The job is 'completed' (a local or demo job).
    // The results are directly available in the `returnvalue` prop.
    if (job.state === 'completed' && job.returnvalue?.status === 'success') {
      setPlotUrl(job.returnvalue.results.plot_b64);
      setMetrics(job.returnvalue.results);
      // Create the metadata object for display from the job's return value.
      setMetadata({
        input_data_hash_sha256: job.returnvalue.inputDataHash,
        analysis_agent: "KintaGen LD50 Agent v1 (Local Run)",
      });
    }
    
    // Case 2: The job is 'logged' on-chain.
    // We must fetch the results artifact from IPFS using the CID.
    else if (job.state === 'logged' && job.logData?.resultCID) {
      const fetchAndParseZip = async () => {
        setIsFetchingFromIPFS(true);
        setFetchError(null);
        try {
          const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${job.logData.resultCID}`);
          if (!response.ok) throw new Error(`Failed to fetch from IPFS (status: ${response.status})`);
          
          const zipBlob = await response.blob();
          const zip = await JSZip.loadAsync(zipBlob);
          
          // Extract metadata.json, which contains the provenance info
          const metadataFile = zip.file("metadata.json");
          if (metadataFile) {
            const metadataContent = await metadataFile.async("string");
            setMetadata(JSON.parse(metadataContent));
          } else {
            // Provide a fallback for older jobs that might not have metadata
            setMetadata({ input_data_hash_sha256: 'N/A (legacy format)' });
          }
          
          // Extract metrics
          const metricsFile = zip.file("ld50_metrics.json");
          if (metricsFile) {
            const metricsContent = await metricsFile.async("string");
            setMetrics(JSON.parse(metricsContent));
          } else {
            throw new Error("'ld50_metrics.json' not found in the ZIP archive.");
          }
          
          // Extract plot image
          const plotFile = zip.file("ld50_plot.png");
          if (plotFile) {
            const plotBase64 = await plotFile.async("base64");
            setPlotUrl(`data:image/png;base64,${plotBase64}`);
          } else {
            throw new Error("'ld50_plot.png' not found in the ZIP archive.");
          }

        } catch (error: any) {
          console.error("Error fetching/parsing IPFS data:", error);
          setFetchError(error.message);
        } finally {
          setIsFetchingFromIPFS(false);
        }
      };
      fetchAndParseZip();
    }
  }, [job]); // This effect re-runs whenever the `job` prop changes.

  const handleDownload = async () => {
    if (!metrics || !plotUrl || !metadata?.input_data_hash_sha256) {
      console.error("Cannot download: result data or input hash is missing.");
      return;
    }

    try {
      const zip = new JSZip();

      // --- 1. Prepare raw data for hashing and zipping ---
      const plotBase64 = plotUrl.split(',')[1];
      const metricsJsonString = JSON.stringify(metrics, null, 2);

      // --- 2. Generate hashes of the outputs, just like the parent page does ---
      const plotHash = await generateDataHash(plotBase64);
      const metricsHash = await generateDataHash(metricsJsonString);

      // --- 3. Construct the complete metadata object ---
      // This will now be identical in structure to the one uploaded to IPFS.
      const fullMetadata = {
          schema_version: "1.0.0",
          analysis_agent: "KintaGen LD50 v1 (Demo Run)",
          timestamp_utc: new Date().toISOString(),
          input_data_hash_sha256: metadata.input_data_hash_sha256, // Use the hash from the state
          outputs: [
              {
                  filename: "ld50_plot.png",
                  hash_sha256: plotHash
              },
              {
                  filename: "ld50_metrics.json",
                  hash_sha256: metricsHash
              }
          ]
      };

      // --- 4. Add all files to the ZIP archive ---
      zip.file("metadata.json", JSON.stringify(fullMetadata, null, 2));
      zip.file("ld50_metrics.json", metricsJsonString);
      zip.file("ld50_plot.png", plotBase64, { base64: true });

      // --- 5. Generate and trigger the download (this part is the same) ---
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `KintaGen_Demo_Artifact_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (error) {
      console.error("Failed to create or download ZIP file:", error);
    }
  };

  // --- Render States ---

  // Render a loading spinner if the parent is logging OR if we are fetching from IPFS.
  if (isLoading || isFetchingFromIPFS) {
    return (
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center my-8">
        <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin text-blue-400 mb-4" />
        <p className="text-lg text-gray-300">
          {isLoading ? "Logging results to the blockchain..." : "Fetching results from IPFS..."}
        </p>
      </div>
    );
  }

  // Render an error message if fetching from IPFS failed.
  if (fetchError) {
    return (
        <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg my-8 flex items-start space-x-3">
            <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" />
            <div>
                <h3 className="font-bold">Could not load results from IPFS</h3>
                <p className="text-sm">{fetchError}</p>
            </div>
        </div>
    );
  }

  // If there are no metrics or plot after all loading is done, render nothing.
  // This handles failed local jobs or other edge cases.
  if (!metrics || !plotUrl) {
    return null;
  }

  // --- Main Success Render ---
  // This is displayed for both completed local jobs and successfully fetched logged jobs.
  return (
    <div className="space-y-8 my-8">
      {/* Metrics and Plot Display Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-6 border-b border-gray-700 pb-3">Key Metrics</h2>
          <div className="space-y-4">
            {(['ld50_estimate', 'standard_error', 'confidence_interval_lower', 'confidence_interval_upper'] as const).map(key => (
              <div key={key} className="flex justify-between items-baseline">
                <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                <span className="font-mono text-lg text-white">{metrics[key]?.toFixed(4) ?? 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[300px]">
          <h2 className="text-xl font-semibold mb-4 text-center">Dose-Response Plot</h2>
          <img src={plotUrl} alt="LD50 Dose-Response Curve" className="w-full h-auto rounded-lg bg-white p-1" />
        </div>
      </div>

      {/* Verifiability & Provenance Section */}
      {metadata && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
            <FingerPrintIcon className="h-6 w-6 text-cyan-400" />
            Verifiability & Provenance
          </h3>
          <div className="text-left bg-gray-900/50 p-4 rounded-lg text-sm space-y-2">
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
      {job.state === 'logged' && job.logData && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
              <CheckCircleIcon className="h-6 w-6" />
              Analysis Logged On-Chain
            </h3>
            <div className="text-left bg-gray-900/50 p-4 rounded-lg text-sm space-y-2">
              <p><strong className="text-gray-400">Agent Type:</strong> <span className="font-mono">{job.logData.agent}</span></p>
              <p><strong className="text-gray-400">Result CID:</strong> <span className="text-cyan-300 font-mono text-xs break-all"><a href={`https://gateway.lighthouse.storage/ipfs/${job.logData.resultCID}`} target="_blank" rel="noopener noreferrer">{job.logData.resultCID}</a></span></p>
              <p className="flex items-center gap-1"><strong className="text-gray-400">Timestamp:</strong> <span className="font-mono text-xs">{new Date(parseFloat(job.logData.timestamp) * 1000).toLocaleString()}</span></p>
            </div>
          </div>
        </div>
      )}
      {/* --- Conditional Download Button for Demo Mode --- */}
      {job.projectId === DEMO_PROJECT_ID && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
          <h3 className="text-lg font-semibold mb-4">Download Demo Results</h3>
          <p className="text-gray-400 mb-4 text-sm">
            Download a verifiable artifact of this demo analysis, including the data hash, metrics, and plot.
          </p>
          <button
            onClick={handleDownload}
            className="flex items-center justify-center mx-auto bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2"/>
            <span>Download Artifact (.zip)</span>
          </button>
        </div>
      )}
    </div>
  );
};