// src/components/ld50/AnalysisResultsDisplay.tsx

import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import JSZip from 'jszip';

// Updated type definitions
interface DisplayJob { 
    state: 'completed' | 'failed' | 'processing' | 'logged'; 
    returnvalue?: any; 
    logData?: any; 
}

// Updated props interface
interface AnalysisResultsDisplayProps {
  job: DisplayJob;
  isLoading?: boolean; // For showing the "Logging..." state
}

export const AnalysisResultsDisplay: React.FC<AnalysisResultsDisplayProps> = ({ job, isLoading }) => {
  const [plotUrl, setPlotUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetchingFromIPFS, setIsFetchingFromIPFS] = useState(false);

  useEffect(() => {
    // Reset state whenever the job prop changes
    setPlotUrl(null);
    setMetrics(null);
    setFetchError(null);
    setIsFetchingFromIPFS(false);

    // Case 1: Job is a completed local job. Data is readily available.
    if (job.state === 'completed' && job.returnvalue?.status === 'success') {
      setPlotUrl(job.returnvalue.results.plot_b64);
      setMetrics(job.returnvalue.results);
    }
    
    // Case 2: Job is logged on-chain. We need to fetch data from IPFS.
    else if (job.state === 'logged' && job.logData?.resultCID) {
      const fetchAndParseZip = async () => {
        setIsFetchingFromIPFS(true);
        setFetchError(null);
        try {
          const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${job.logData.resultCID}`);
          if (!response.ok) throw new Error(`Failed to fetch from IPFS (status: ${response.status})`);
          
          const zipBlob = await response.blob();
          const zip = await JSZip.loadAsync(zipBlob);
          
          let parsedMetrics = null;
          let parsedPlotUrl = null;

          // Extract metrics from JSON file
          const metricsFile = zip.file("ld50_metrics.json");
          if (metricsFile) {
            const metricsContent = await metricsFile.async("string");
            parsedMetrics = JSON.parse(metricsContent);
            setMetrics(parsedMetrics);
          } else {
            throw new Error("'ld50_metrics.json' not found in the ZIP archive.");
          }
          
          // Extract plot image from PNG file
          const plotFile = zip.file("ld50_plot.png");
          if (plotFile) {
            const plotBase64 = await plotFile.async("base64");
            parsedPlotUrl = `data:image/png;base64,${plotBase64}`;
            setPlotUrl(parsedPlotUrl);
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
  }, [job]);

  // --- Render Loading State ---
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

  // --- Render Fetch Error State ---
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

  // --- Render No Data State ---
  // This handles cases like a failed local job or if fetching somehow completes with no data.
  if (!metrics || !plotUrl) {
    return null;
  }

  // --- Render Main Success State ---
  return (
    <div className="space-y-8 my-8">
      {/* Metrics and Plot Display */}
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

      {/* On-Chain Log Information Box */}
      {job.state === 'logged' && job.logData && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-300 flex items-center justify-center gap-2">
              <CheckCircleIcon className="h-6 w-6" />
              Analysis Logged On-Chain
            </h3>
            <div className="text-left bg-gray-900/50 p-4 rounded-lg text-sm space-y-2 max-w-lg mx-auto">
              <p><strong className="text-gray-400">Agent Type:</strong> <span className="font-mono">{job.logData.agent}</span></p>
              <p><strong className="text-gray-400">Result CID:</strong> <span className="font-mono text-xs break-all"><a href={`https://gateway.lighthouse.storage/ipfs/${job.logData.resultCID}`} target="_blank" rel="noopener noreferrer">{job.logData.resultCID}</a></span></p>
              <p className="flex items-center gap-1"><strong className="text-gray-400">Timestamp:</strong> <span className="font-mono text-xs">{new Date(parseFloat(job.logData.timestamp) * 1000).toLocaleString()}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};