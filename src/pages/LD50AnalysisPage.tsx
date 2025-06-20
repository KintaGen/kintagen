import React, { useState } from 'react';
import { ChartBarIcon, LinkIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/solid';

// --- 1. Type Definitions for the New API Response ---
interface Ld50ResultData {
  ld50_estimate: number;
  standard_error: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  model_coefficients: number[][];
  plot_b64: string; // The Base64 encoded plot image
}

interface Ld50ApiResponse {
  status: 'success' | 'error';
  error: string | null;
  log: string[];
  results: Ld50ResultData;
}

// --- 2. The React Component ---
const Ld50AnalysisPage: React.FC = () => {
  // --- State Management ---
  const [dataUrl, setDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Ld50ApiResponse | null>(null);

  // A sample URL for easy testing (can be removed if not needed)
  const sampleUrl = 'https://0xcb9e86945ca31e6c3120725bf0385cbad684040c.calibration.filcdn.io/baga6ea4seaqchyykmwuxza4ddrvm6s3kxpkoaviy6arjlgnn77r4obnvnf4tkgq';

  // --- API Call Handler ---
  const handleAnalysis = async (useSampleData = false) => {
    // Reset state for a new analysis
    setIsLoading(true);
    setError(null);
    setResults(null);

    // If using real data, a URL must be provided
    if (!useSampleData && !dataUrl) {
      setError('Please provide a URL to a raw CSV file.');
      setIsLoading(false);
      return;
    }

    // The request body contains the URL, or is empty for a sample run
    const requestBody = useSampleData ? {} : { dataUrl };

    try {
      const response = await fetch('http://localhost:3001/api/analyze-ld50', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data: Ld50ApiResponse = await response.json();

      if (!response.ok || data.status === 'error') {
        // Use the error message from the R script's JSON response
        throw new Error(data.error || 'Analysis failed on the server.');
      }
      
      setResults(data);

    } catch (err: any) {
      console.error("Error during LD50 analysis:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. JSX Rendering ---
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4">LD50 Dose-Response Analysis</h1>
      <p className="text-gray-400 mb-8">
        Enter the public URL of a raw CSV file or use the sample data to calculate the LD50 and generate a plot.
      </p>

      {/* --- Input Section --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <label htmlFor="dataUrl" className="block text-sm font-medium text-gray-300 mb-2">
          CSV File URL
        </label>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <LinkIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="dataUrl"
              type="url"
              value={dataUrl}
              onChange={(e) => setDataUrl(e.target.value)}
              placeholder="https://.../data.csv"
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={() => handleAnalysis(false)}
            disabled={isLoading || !dataUrl}
            className="flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <ChartBarIcon className="h-5 w-5 mr-2" />
            {isLoading ? 'Analyzing...' : 'Analyze from URL'}
          </button>
        </div>
        <div className="text-center mt-4">
            <button onClick={() => handleAnalysis(true)} className="text-blue-400 hover:underline text-xs">Run with sample</button>
        </div>
      </div>

      {/* --- Loading & Error Section --- */}
      {isLoading && (
        <div className="text-center p-10 flex flex-col items-center">
          <ArrowPathIcon className="h-12 w-12 text-blue-400 animate-spin mb-4" />
          <p className="text-lg text-blue-300">Running dose-response analysis...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 p-4 rounded-lg">
          <h3 className="font-bold mb-2">Analysis Failed</h3>
          <p>{error}</p>
        </div>
      )}

      {/* --- Results Section --- */}
      {results && results.status === 'success' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Key Metrics */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-6 border-b border-gray-700 pb-3">Key Metrics</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">LD50 Estimate:</span>
                <span className="text-2xl font-bold text-green-400">{results.results.ld50_estimate.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">Standard Error:</span>
                <span className="font-mono text-lg text-white">{results.results.standard_error.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">95% Confidence Interval:</span>
                <span className="font-mono text-lg text-white">
                  [{results.results.confidence_interval_lower.toFixed(4)}, {results.results.confidence_interval_upper.toFixed(4)}]
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Plot */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex items-center justify-center min-h-[300px]">
              <div>
                <h2 className="text-xl font-semibold mb-4 text-center">Dose-Response Plot</h2>
                <img 
                   src={results.results.plot_b64} // Directly use the Base64 string
                   alt="LD50 Dose-Response Curve"
                   className="w-full h-auto rounded-lg bg-white p-1" // bg-white helps if image has transparency
                />
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ld50AnalysisPage;