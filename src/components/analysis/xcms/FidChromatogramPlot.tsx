import React, { useMemo, useImperativeHandle, useRef, forwardRef } from 'react';
import BasePlot from 'react-plotly.js';
import Plotly from 'plotly.js';
import { Layout, Data } from 'plotly.js';

// --- Interfaces ---
interface ChromatogramPoint { rt_min: number; intensity: number; }
interface IntegratedPeak { rt_apex_min: number; rt_start_min: number; rt_end_min: number; peak_height: number; }
interface QuantReportEntry { peak_number: number; rt_minutes: number; }
interface MultiChromatogramEntry { filename: string; data: ChromatogramPoint[]; }

export interface PlotRef { exportPlotImage: () => Promise<string | null>; }

// --- Component Props ---
interface FidChromatogramPlotProps {
  smoothedChromatogramData: ChromatogramPoint[];
  integratedPeaks: IntegratedPeak[];
  quantReportData: QuantReportEntry[];
  topPeakNumbers: number[];
  multiFileChromatograms?: MultiChromatogramEntry[];
}

export const FidChromatogramPlot = forwardRef<PlotRef, FidChromatogramPlotProps>(({ 
  smoothedChromatogramData, 
  integratedPeaks, 
  quantReportData,
  topPeakNumbers,
  multiFileChromatograms
}, ref) => {
  
  const plotComponentRef = useRef<BasePlot>(null);

  const { plotData, maxIntensity } = useMemo(() => {
    
    // ==================================================================================
    // MODE 1: MULTI-FILE OVERLAY
    // ==================================================================================
    if (multiFileChromatograms && multiFileChromatograms.length > 0) {
        const traces: Data[] = [];
        let globalMax = 0;
        
        const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];

        multiFileChromatograms.forEach((file, index) => {
            const fileMax = Math.max(...file.data.map(p => p.intensity), 0);
            if (fileMax > globalMax) globalMax = fileMax;

            traces.push({
                x: file.data.map(p => p.rt_min),
                y: file.data.map(p => p.intensity),
                type: 'scatter',
                mode: 'lines', 
                name: file.filename, 
                line: { 
                    color: colors[index % colors.length], 
                    width: 2, 
                    shape: 'spline', 
                    smoothing: 1.0
                },
                opacity: 0.8,
                connectgaps: true, 
                hovertemplate: `<b>${file.filename}</b><br>Int: %{y:.0f}<br>RT: %{x:.2f} min<extra></extra>`
            });
        });
        
        return { plotData: traces, maxIntensity: globalMax };
    }

    // ==================================================================================
    // MODE 2: SINGLE FILE
    // ==================================================================================
    const chromatogramData = smoothedChromatogramData;
    if (!chromatogramData || chromatogramData.length === 0) return { plotData: [], maxIntensity: 0 };
    
    const maxIntensityValue = Math.max(...chromatogramData.map(p => p.intensity), 0);
    
    // Map RT to Peak Details to find height for the dots
    const peakDetailsMap = new Map(integratedPeaks.map(p => [p.rt_apex_min, p]));
    const quantReportMap = new Map(quantReportData.map(q => [q.peak_number, q]));
    
    // 1. The Blue Line (Chromatogram)
    const smoothedTrace: Data = {
      x: chromatogramData.map(p => p.rt_min), 
      y: chromatogramData.map(p => p.intensity), 
      type: 'scatter', 
      mode: 'lines', 
      name: 'Signal', 
      line: { color: '#2563eb', width: 2, shape: 'spline' }, 
      hovertemplate: 'Intensity: %{y:.0f}<extra></extra>'
    };
    
    // 2. The Filled Areas (Under peaks)
    const peakAreaTraces: Data[] = integratedPeaks.map((peak) => {
      const peakPoints = chromatogramData.filter(p => p.rt_min >= peak.rt_start_min && p.rt_min <= peak.rt_end_min);
      return { 
          x: peakPoints.map(p => p.rt_min), 
          y: peakPoints.map(p => p.intensity), 
          type: 'scatter', 
          mode: 'lines', 
          fill: 'tozeroy', 
          fillcolor: 'rgba(59, 130, 246, 0.3)', 
          line: { width: 0 }, 
          name: `Peak Area`, 
          hoverinfo: 'none', 
          showlegend: false 
      };
    });

    // 3. The Red Dots AND Labels (Combined)
    // We filter quantReportData to find the entries matching topPeakNumbers
    const topPeaks = topPeakNumbers.map(num => quantReportMap.get(num)).filter(Boolean) as QuantReportEntry[];
    
    const topFeaturesTrace: Data = {
      x: topPeaks.map(p => p.rt_minutes),
      y: topPeaks.map(p => peakDetailsMap.get(p.rt_minutes)?.peak_height || 0),
      text: topPeaks.map(p => `#${p.peak_number}`), // Label Text
      type: 'scatter', 
      mode: 'markers+text', // Show Dot AND Text
      name: 'Top Peaks',
      textposition: 'top center', // Position text above the dot
      textfont: {
          family: 'Arial, sans-serif',
          size: 10,
          color: '#b91c1c' // Dark Red
      },
      marker: { 
          symbol: 'circle', 
          color: 'crimson', 
          size: 9, 
          line: { color: 'white', width: 1.5 } 
      },
      hovertemplate: '<b>Peak #%{text}</b><br>RT: %{x:.2f} min<extra></extra>'
    };
    
    // Removed: peakLabelsTrace (which was labeling everything)

    return { plotData: [...peakAreaTraces, smoothedTrace, topFeaturesTrace], maxIntensity: maxIntensityValue };
  }, [smoothedChromatogramData, integratedPeaks, quantReportData, topPeakNumbers, multiFileChromatograms]);
  
  const plotLayout = useMemo((): Partial<Layout> => ({
      title: multiFileChromatograms && multiFileChromatograms.length > 1 ? 'Alignment Verification (TIC Overlay)' : 'Chromatogram Analysis', 
      xaxis: { 
          title: 'Retention Time (minutes)',
          showgrid: true,
          gridcolor: '#e5e7eb',
          zeroline: false
      }, 
      yaxis: { 
          title: 'Intensity', 
          range: [0, maxIntensity * 1.1],
          showgrid: true,
          gridcolor: '#e5e7eb',
      }, 
      showlegend: true, 
      legend: { orientation: 'h', y: 1.1, x: 0 },
      paper_bgcolor: 'white', 
      plot_bgcolor: 'white', 
      margin: { l: 60, r: 20, t: 50, b: 50 }, 
      hovermode: 'closest', // Changed to closest so hovering a dot highlights it specifically
      dragmode: 'zoom',
  }), [maxIntensity, multiFileChromatograms]);

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
          <p className="text-xs text-gray-500 mt-2 text-center"> 
             {multiFileChromatograms && multiFileChromatograms.length > 1 
              ? "Overlay of aligned samples. Use legend to toggle files." 
              : "Click and drag to zoom. Double-click to reset view."}
          </p>
        </div>
      ) : (
        <div className="h-96 bg-gray-100 rounded-md flex items-center justify-center">
          <p className="text-gray-500">Chromatogram data not available.</p>
        </div>
      )}
    </div>
  );
});