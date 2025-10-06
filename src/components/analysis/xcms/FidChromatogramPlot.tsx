import React, { useMemo, useImperativeHandle, useRef, forwardRef } from 'react';
import BasePlot from 'react-plotly.js';
import Plotly from 'plotly.js';
import { Layout, Data } from 'plotly.js';

// --- Interfaces ---
interface ChromatogramPoint { rt_min: number; intensity: number; }
interface IntegratedPeak { rt_apex_min: number; rt_start_min: number; rt_end_min: number; peak_height: number; }
interface QuantReportEntry { peak_number: number; rt_minutes: number; }
export interface PlotRef { exportPlotImage: () => Promise<string | null>; }

// --- Component Props ---
interface FidChromatogramPlotProps {
  smoothedChromatogramData: ChromatogramPoint[];
  integratedPeaks: IntegratedPeak[];
  quantReportData: QuantReportEntry[];
  topPeakNumbers: number[];
}

export const FidChromatogramPlot = forwardRef<PlotRef, FidChromatogramPlotProps>(({ 
  smoothedChromatogramData, 
  integratedPeaks, 
  quantReportData,
  topPeakNumbers
}, ref) => {
  
  const plotComponentRef = useRef<BasePlot>(null);

  const { plotData, maxIntensity } = useMemo(() => {
    const chromatogramData = smoothedChromatogramData;
    if (!chromatogramData || chromatogramData.length === 0) return { plotData: [], maxIntensity: 0 };
    
    const maxIntensityValue = Math.max(...chromatogramData.map(p => p.intensity), 0);

    // Create a map for quick lookup of peak details by its retention time
    const peakDetailsMap = new Map(integratedPeaks.map(p => [p.rt_apex_min, p]));
    // Create a map for quick lookup of quant report entries by peak number
    const quantReportMap = new Map(quantReportData.map(q => [q.peak_number, q]));
    
    const smoothedTrace: Data = {
      x: chromatogramData.map(p => p.rt_min), y: chromatogramData.map(p => p.intensity), type: 'scatter', mode: 'lines', name: 'Smoothed Signal', line: { color: '#2563eb', width: 2 }, hovertemplate: 'Intensity: %{y:.0f}<extra></extra>'
    };
    
    const peakAreaTraces: Data[] = integratedPeaks.map((peak) => {
      const peakPoints = chromatogramData.filter(p => p.rt_min >= peak.rt_start_min && p.rt_min <= peak.rt_end_min);
      return { x: peakPoints.map(p => p.rt_min), y: peakPoints.map(p => p.intensity), type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: 'rgba(59, 130, 246, 0.3)', line: { color: 'transparent' }, name: `Peak Area ${peak.rt_apex_min}`, hoverinfo: 'none' };
    });

    // Get the full details for the top peaks using the maps
    const topPeaks = topPeakNumbers.map(num => quantReportMap.get(num)).filter(Boolean) as QuantReportEntry[];
    
    const topFeaturesTrace: Data = {
      x: topPeaks.map(p => p.rt_minutes),
      y: topPeaks.map(p => peakDetailsMap.get(p.rt_minutes)?.peak_height || 0),
      type: 'scatter', mode: 'markers', name: 'Top Peaks',
      marker: { symbol: 'circle', color: 'crimson', size: 9, line: { color: 'white', width: 1.5 } },
      hovertemplate: '<b>Top Peak</b><br>RT: %{x:.2f} min<extra></extra>'
    };
    
    // Use the definitive integratedPeaks data for label positions
    const peakLabelsTrace: Data = {
      x: integratedPeaks.map(p => p.rt_apex_min), 
      y: integratedPeaks.map(p => p.peak_height), 
      text: quantReportData.map(p => `#${p.peak_number}`), 
      type: 'scatter', mode: 'text', name: 'Peak Labels', textposition: 'top center', textfont: { family: 'Arial, sans-serif', size: 12, color: '#1f2937', weight: 'bold' }, hoverinfo: 'none'
    };

    const data = [...peakAreaTraces, smoothedTrace, topFeaturesTrace, peakLabelsTrace];
    return { plotData: data, maxIntensity: maxIntensityValue };
  }, [smoothedChromatogramData, integratedPeaks, quantReportData, topPeakNumbers]);
  
  const plotLayout = useMemo((): Partial<Layout> => ({
      title: 'Interactive Chromatogram', xaxis: { title: 'Retention Time (minutes)' }, yaxis: { title: 'Intensity (AU)', range: [0, maxIntensity * 1.15] }, showlegend: false, paper_bgcolor: 'white', plot_bgcolor: 'white', margin: { l: 60, r: 20, t: 50, b: 50 }, hovermode: 'x unified', dragmode: 'zoom',
  }), [maxIntensity]);

  const plotConfig = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'toggleSpikelines'] };

  useImperativeHandle(ref, () => ({
    exportPlotImage: async () => {
      const plotElement = plotComponentRef.current?.el;
      if (plotElement) {
        try { return await Plotly.toImage(plotElement, { format: 'png', width: 1200, height: 700, scale: 1 }); } 
        catch (error) { console.error("Failed to export plot image:", error); return null; }
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