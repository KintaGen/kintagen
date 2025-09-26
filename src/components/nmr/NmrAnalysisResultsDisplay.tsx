// components/nmr/NmrAnalysisResultsDisplay.tsx
import React from 'react';

interface DisplayJob {
  returnvalue?: {
    results?: {
      plot_b64?: string;
    };
    log?: string[];
  };
  logData?: any;
}

interface NmrAnalysisResultsDisplayProps {
  job: DisplayJob;
}

export const NmrAnalysisResultsDisplay: React.FC<NmrAnalysisResultsDisplayProps> = ({ job }) => {
  const results = job.returnvalue?.results;
  const logs = job.returnvalue?.log || [];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4 text-white">Analysis Results</h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Plot Section */}
        <div className="lg:col-span-3">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Processed Spectrum</h3>
          {results?.plot_b64 ? (
            <img src={results.plot_b64} alt="NMR Spectrum Plot" className="rounded-md bg-white p-1" />
          ) : (
            <div className="aspect-video bg-gray-700 rounded-md flex items-center justify-center">
              <p className="text-gray-400">Plot not available.</p>
            </div>
          )}
        </div>
        
        {/* Log Section */}
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
    </div>
  );
};