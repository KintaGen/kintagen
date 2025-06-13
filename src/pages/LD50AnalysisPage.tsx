import React, { useState, useEffect } from 'react';
import { ChartBarIcon, LinkIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

// --- 1. Type Definition for the API Response (No Change) ---
interface Ld50Result {
  success: boolean;
  message: string;
  analysis: {
    ld50_estimate: number;
    standard_error: number;
    confidence_interval_lower: number;
    confidence_interval_upper: number;
    model_details: {
      coefficients: number[][];
    };
    plot_file: string;
  };
  plotUrl: string; // The full public URL to the plot image
}

const Ld50AnalysisPage: React.FC = () => {
  // --- 2. State Management (with a new state for the plot) ---
  const [dataUrl, setDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Ld50Result | null>(null);
  
  // NEW: State to control plot visibility
  const [showPlot, setShowPlot] = useState<boolean>(false);

  // A sample URL for easy testing
  const sampleUrl = 'https://0xcb9e86945ca31e6c3120725bf0385cbad684040c.calibration.filcdn.io/baga6ea4seaqchyykmwuxza4ddrvm6s3kxpkoaviy6arjlgnn77r4obnvnf4tkgq';

  // --- 3. API Call Handler (Modified to reset plot visibility) ---
  const handleAnalysis = async () => {
    // Reset state for a new analysis
    setIsLoading(true);
    setError(null);
    setResults(null);
    setShowPlot(false); // <-- Reset plot visibility for new runs

    if (!dataUrl) {
      setError('Please provide a URL to a raw CSV file.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/analyze-ld50', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataUrl }),
      });

      const data: Ld50Result = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Analysis failed on the server.');
      }
      
      // We have the results! Set them in state. The useEffect will handle the delay.
      setResults(data);

    } catch (err: any) {
      console.error("Error during LD50 analysis:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 4. NEW: Effect to trigger the plot display after a delay ---
  useEffect(() => {
    // This effect runs only when the 'results' state gets new data.
    if (results) {
      // Wait 10 seconds after numerical results are available, then show the plot.
      const timer = setTimeout(() => {
        setShowPlot(true);
      }, 10000); // 10-second delay

      // This is a cleanup function. It runs if the component unmounts
      // or if `results` changes again before the timer finishes.
      return () => clearTimeout(timer);
    }
  }, [results]); // The dependency array ensures this effect only runs when `results` changes.

  // --- 5. JSX Rendering ---
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4">LD50 Dose-Response Analysis</h1>
      <p className="text-gray-400 mb-8">
        Enter the public URL of a raw CSV file containing dose-response data to calculate the LD50 and generate a plot.
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
            onClick={handleAnalysis}
            disabled={isLoading || !dataUrl}
            className="flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <ChartBarIcon className="h-5 w-5 mr-2" />
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
            Need an example? <button onClick={() => setDataUrl(sampleUrl)} className="text-blue-400 hover:underline">Use sample data URL</button>
        </p>
      </div>

      {/* --- Loading & Error Section --- */}
      {isLoading && (
        <div className="text-center p-10 flex flex-col items-center">
          <ArrowPathIcon className="h-12 w-12 text-blue-400 animate-spin mb-4" />
          <p className="text-lg text-blue-300">Running analysis & storing plot on FilCDN... This may take a minute.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 p-4 rounded-lg">
          <h3 className="font-bold mb-2">Analysis Failed</h3>
          <p>{error}</p>
        </div>
      )}

      {/* --- Results Section (Modified for delayed plot) --- */}
      {results && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Key Metrics (always shows when results are ready) */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-6 border-b border-gray-700 pb-3">Key Metrics</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">LD50 Estimate:</span>
                <span className="text-2xl font-bold text-green-400">{results.analysis.ld50_estimate.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">Standard Error:</span>
                <span className="font-mono text-lg text-white">{results.analysis.standard_error.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">95% Confidence Interval:</span>
                <span className="font-mono text-lg text-white">
                  [{results.analysis.confidence_interval_lower.toFixed(4)}, {results.analysis.confidence_interval_upper.toFixed(4)}]
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Plot (conditionally rendered) */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex items-center justify-center min-h-[300px]">
            {showPlot ? (
              // If showPlot is true, display the image
              <div>
                <h2 className="text-xl font-semibold mb-4 text-center">Dose-Response Plot</h2>
                <img 
                   src={results.plotUrl}
                   alt="LD50 Dose-Response Curve"
                   className="w-full h-auto rounded-lg bg-white" // bg-white helps with transparent SVG backgrounds
                />
              </div>
            ) : (
              // If showPlot is false, display the "processing" message
              <div className="text-center">
                <ArrowPathIcon className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-300">Plot is being prepared...</p>
                <p className="text-xs text-gray-500">Image will appear shortly.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Ld50AnalysisPage;