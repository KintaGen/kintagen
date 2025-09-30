import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Layout } from 'plotly.js';

// --- Define the shape of a single data point
interface TicPoint {
  rt_sec: number;
  tic: number;
}

// --- NEW: Helper function to find the top N peaks ---
// This function is defined outside the component to avoid re-creation on every render.
const findTopPeaks = (data: TicPoint[], count: number): TicPoint[] => {
  if (data.length < 3) return [];

  const localMaxima: TicPoint[] = [];
  // Find all local maxima (points higher than their immediate neighbors)
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i].tic > data[i - 1].tic && data[i].tic > data[i + 1].tic) {
      localMaxima.push(data[i]);
    }
  }

  // Sort the found peaks by intensity (TIC) in descending order
  localMaxima.sort((a, b) => b.tic - a.tic);

  // Return the top 'count' peaks
  return localMaxima.slice(0, count);
};


// --- Define the props for our component
interface TicPlotDisplayProps {
  ticData: TicPoint[];
  topN?: number; // Make the number of peaks to show configurable
}

export const TicPlotDisplay: React.FC<TicPlotDisplayProps> = ({ ticData, topN = 5 }) => {
  
  // Memoize the plot data calculation. This runs only when ticData or topN changes.
  const plotData = useMemo(() => {
    if (!ticData || ticData.length === 0) {
      return [];
    }
    
    // 1. Main line trace (unchanged)
    const lineTrace = {
      x: ticData.map(p => p.rt_sec / 60), // Convert seconds to minutes
      y: ticData.map(p => p.tic),
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: 'TIC',
      line: {
        color: 'steelblue',
        width: 1.5,
      },
      hoverinfo: 'x+y' as const,
    };

    // 2. NEW: Find the top peaks using our helper function
    const topPeaks = findTopPeaks(ticData, topN);

    // 3. NEW: Create a second trace just for the peak markers
    const peaksTrace = {
      x: topPeaks.map(p => p.rt_sec / 60),
      y: topPeaks.map(p => p.tic),
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: 'Top Peaks',
      marker: {
        symbol: 'x',
        color: 'crimson', // A contrasting color
        size: 8,
        line: { width: 2 },
      },
      // Create custom hover text for each peak
      hoverinfo: 'text' as const,
      text: topPeaks.map(p => 
        `<b>Peak</b><br>` +
        `RT: ${(p.rt_sec / 60).toFixed(2)} min<br>` +
        `TIC: ${p.tic.toLocaleString()}`
      ),
    };
    
    // Return both traces to be rendered on the same plot
    return [lineTrace, peaksTrace];
    
  }, [ticData, topN]);
  
  // Memoize the layout object (unchanged).
  const plotLayout = useMemo((): Partial<Layout> => {
    return {
      title: {
        text: 'Interactive MS2 TIC',
        font: { size: 16, color: '#333' },
      },
      xaxis: {
        title: { text: 'Retention Time (minutes)', font: { color: '#666' } },
        gridcolor: '#e0e0e0',
      },
      yaxis: {
        title: { text: 'Total Ion Count (TIC)', font: { color: '#666' } },
        gridcolor: '#e0e0e0',
      },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      showlegend: false, // You could set this to true to see "TIC" and "Top Peaks"
      margin: { l: 70, r: 30, t: 50, b: 50 },
      dragmode: 'zoom',
      hovermode: 'x unified',
    };
  }, []);

  const plotConfig = {
    responsive: true,
    displaylogo: false,
  };

  // Render logic (unchanged)
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
      <h3 className="text-lg font-semibold mb-2 text-gray-700">Total Ion Chromatogram</h3>
      
      {plotData.length > 0 ? (
        <div className="relative h-96 w-full">
          <Plot
            data={plotData}
            layout={plotLayout}
            config={plotConfig}
            style={{ width: '100%', height: '100%' }}
          />
          <p className="text-xs text-gray-500 mt-2 text-center">
            Click and drag to zoom. Double-click to reset view.
          </p>
        </div>
      ) : (
        <div className="h-96 bg-gray-100 rounded-md flex items-center justify-center">
          <p className="text-gray-500">TIC data not available.</p>
        </div>
      )}
    </div>
  );
};