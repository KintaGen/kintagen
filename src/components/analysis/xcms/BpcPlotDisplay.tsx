// components/analysis/gcms/BpcPlotDisplay.tsx

import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Layout } from 'plotly.js';

// Interfaces (no changes needed)
interface BpcPoint {
  rt_sec: number;
  relative_tic: number;
}
interface FeaturePoint {
  spectrum_index: number;
  precursor_mz: number;
  retention_time_sec: number;
  relative_tic_percent: number;
}
interface BpcPlotDisplayProps {
  bpcData: BpcPoint[];
  topFeatures: FeaturePoint[];
}

export const BpcPlotDisplay: React.FC<BpcPlotDisplayProps> = ({ bpcData, topFeatures }) => {
  
  const plotData = useMemo(() => {
    if (!bpcData || bpcData.length === 0) return [];
    
    // 1. Main chromatogram line trace
    const lineTrace = {
      x: bpcData.map(p => p.rt_sec / 60),
      y: bpcData.map(p => p.relative_tic),
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: 'BPC',
      // VISUAL TWEAK: Use a spline for smooth curves instead of sharp angles
      line: {
        color: 'steelblue',
        width: 2,
        shape: 'spline', 
        smoothing: 0.7
      },
      // VISUAL TWEAK: A cleaner hover template
      hovertemplate: 'Intensity: %{y:.2f}%<extra></extra>',
    };

    // 2. Marker trace for top features
    const peaksTrace = {
      x: topFeatures.map(p => p.retention_time_sec / 60),
      y: topFeatures.map(p => p.relative_tic_percent),
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: 'Top Features',
      // VISUAL TWEAK: A more distinct marker style
      marker: {
        symbol: 'circle',
        color: 'crimson',
        size: 9,
        line: { color: 'white', width: 1.5 },
      },
      // VISUAL TWEAK: Better hover text, including a header
      hovertemplate: '<b>Top Feature</b><br>RT: %{x:.2f} min<br>Intensity: %{y:.2f}%<extra></extra>',
    };
    
    return [lineTrace, peaksTrace];
    
  }, [bpcData, topFeatures]);
  
  // VISUAL TWEAK: A much more polished layout object
  const plotLayout = useMemo((): Partial<Layout> => {
    return {
      title: {
        text: 'Base Peak Chromatogram (BPC)',
        font: { size: 18, color: '#333', family: 'Arial, sans-serif' },
        x: 0.05, // Align left
        xanchor: 'left'
      },
      xaxis: {
        title: { text: 'Retention Time (minutes)', font: { size: 12 } },
        gridcolor: '#e0e0e0',
        zeroline: false,
      },
      yaxis: {
        title: { text: 'Relative Intensity (%)', font: { size: 12 } },
        gridcolor: '#e0e0e0',
        zeroline: false,
        range: [0, 110], // Give 10% headroom above the 100% peak
        fixedrange: true, // Prevent user from panning/zooming the y-axis
      },
      font: {
        family: 'Arial, sans-serif'
      },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      showlegend: false,
      margin: { l: 60, r: 20, t: 50, b: 50 },
      dragmode: 'zoom',
      // This is a key improvement for user experience!
      hovermode: 'x unified', 
      hoverlabel: {
        bgcolor: "#FFF",
        font: { size: 12, color: '#333' }
      },
    };
  }, []);

  const plotConfig = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['select2d', 'lasso2d', 'toggleSpikelines']
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
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
          <p className="text-gray-500">Chromatogram data not available or below threshold.</p>
        </div>
      )}
    </div>
  );
};