// src/components/analysis/gc-ms/FidChromatogramPlot.tsx

import React, { useMemo, useImperativeHandle, useRef, forwardRef } from 'react';
import BasePlot from 'react-plotly.js';
import Plotly from 'plotly.js';
import { Layout, Data } from 'plotly.js';

// --- Interfaces ---
interface ChromatogramPoint {
  rt_min: number;
  intensity: number;
}
interface IntegratedPeak {
  rt_apex_min: number;
  rt_start_min: number;
  rt_end_min: number;
  peak_height: number;
}
interface TopFeature {
  retention_time_sec: number;
  relative_tic_percent: number;
}
interface QuantReportEntry {
  peak_number: number;
  rt_minutes: number;
}
interface FidChromatogramPlotProps {
  chromatogramData: ChromatogramPoint[];
  integratedPeaks: IntegratedPeak[];
  topFeatures: TopFeature[];
  quantReportData: QuantReportEntry[];
}
export interface PlotRef {
  exportPlotImage: () => Promise<string | null>;
}

// --- Component ---
export const FidChromatogramPlot = forwardRef<PlotRef, FidChromatogramPlotProps>(({ 
  chromatogramData, 
  integratedPeaks, 
  topFeatures,
  quantReportData 
}, ref) => {
  
  const plotComponentRef = useRef<BasePlot>(null);

  const { plotData, maxIntensity } = useMemo(() => {
    if (!chromatogramData || chromatogramData.length === 0) {
      return { plotData: [], maxIntensity: 0 };
    }
    const maxIntensityValue = Math.max(...chromatogramData.map(p => p.intensity), 0);
    const chromatogramTrace: Data = {
      x: chromatogramData.map(p => p.rt_min), y: chromatogramData.map(p => p.intensity), type: 'scatter', mode: 'lines', name: 'Signal', line: { color: 'gray', width: 1.5 }, hovertemplate: 'Intensity: %{y:.0f}<extra></extra>',
    };
    const peakAreaTraces: Data[] = integratedPeaks.map((peak, index) => {
      const peakPoints = chromatogramData.filter(p => p.rt_min >= peak.rt_start_min && p.rt_min <= peak.rt_end_min);
      return { x: peakPoints.map(p => p.rt_min), y: peakPoints.map(p => p.intensity), type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: 'rgba(70, 130, 180, 0.4)', line: { color: 'steelblue', width: 2.5 }, name: `Peak ${index + 1}`, hovertemplate: `<b>Integrated Peak</b><br>RT: ${peak.rt_apex_min.toFixed(2)} min<br>Intensity: %{y:.0f}<extra></extra>`, };
    });
    const topFeaturesTrace: Data = {
      x: topFeatures.map(p => p.retention_time_sec / 60), y: topFeatures.map(p => (p.relative_tic_percent / 100) * maxIntensityValue), type: 'scatter', mode: 'markers', name: 'Top 5 Scans', marker: { symbol: 'circle', color: 'crimson', size: 9, line: { color: 'white', width: 1.5 }, }, hovertemplate: '<b>Most Intense Scan</b><br>RT: %{x:.2f} min<extra></extra>',
    };
    const peakLabelsTrace: Data = {
      x: quantReportData.map(p => p.rt_minutes), y: integratedPeaks.map(p => p.peak_height), text: quantReportData.map(p => `#${p.peak_number}`), type: 'scatter', mode: 'text', name: 'Peak Labels', textposition: 'top center', textfont: { family: 'Arial, sans-serif', size: 12, color: '#1f2937', weight: 'bold' }, hovertemplate: '', hoverinfo: 'none'
    };
    const data = [chromatogramTrace, ...peakAreaTraces, topFeaturesTrace, peakLabelsTrace];
    return { plotData: data, maxIntensity: maxIntensityValue };
  }, [chromatogramData, integratedPeaks, topFeatures, quantReportData]);
  
  const plotLayout = useMemo((): Partial<Layout> => ({
      title: 'Interactive Chromatogram with Peak Integration', xaxis: { title: 'Retention Time (minutes)' }, yaxis: { title: 'Intensity (AU)', range: [0, maxIntensity * 1.15] }, showlegend: false, paper_bgcolor: 'white', plot_bgcolor: 'white', margin: { l: 60, r: 20, t: 50, b: 50 }, hovermode: 'x unified', dragmode: 'zoom',
  }), [maxIntensity]);

  const plotConfig = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'toggleSpikelines'] };

  useImperativeHandle(ref, () => ({
    exportPlotImage: async () => {
      const plotElement = plotComponentRef.current?.el;
      if (plotElement) {
        try {
          const dataUrl = await Plotly.toImage(plotElement, { format: 'png', width: 1200, height: 700, scale: 1 });
          return dataUrl;
        } catch (error) {
          console.error("Failed to export plot image:", error);
          return null;
        }
      }
      return null;
    }
  }), []);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {plotData.length > 0 ? (
        <div className="relative h-96 w-full">
          <BasePlot ref={plotComponentRef} data={plotData} layout={plotLayout} config={plotConfig} style={{ width: '100%', height: '100%' }} />
          <p className="text-xs text-gray-500 mt-2 text-center"> Click and drag to zoom. Double-click to reset view. </p>
        </div>
      ) : (
        <div className="h-96 bg-gray-100 rounded-md flex items-center justify-center">
          <p className="text-gray-500">Chromatogram data not available.</p>
        </div>
      )}
    </div>
  );
});