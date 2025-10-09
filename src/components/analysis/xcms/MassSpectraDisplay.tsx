import React, { useState, useMemo, useImperativeHandle, useRef, forwardRef } from 'react';
import BasePlot from 'react-plotly.js';
import Plotly from 'plotly.js';
import { Data, Layout } from 'plotly.js';

// --- Interfaces ---
interface SpectrumPoint { 
  mz: number; 
  relative_intensity: number; 
}

export interface TopSpectrum { 
  peak_number: number; 
  spectrum_data: SpectrumPoint[]; 
}

// Props now include the callback for on-demand identification
interface MassSpectraDisplayProps {
  spectraData: TopSpectrum[];
  onIdentifyPeak: (peakData: TopSpectrum) => Promise<any>;
}

// The ref handle for batch exporting
export interface MassSpectraPlotRef {
  exportAllSpectraAsImages: () => Promise<{ filename: string; base64: string; }[]>;
}

// --- Component ---
export const MassSpectraDisplay = forwardRef<MassSpectraPlotRef, MassSpectraDisplayProps>(
  ({ spectraData, onIdentifyPeak }, ref) => {
    
  const [selectedPeak, setSelectedPeak] = useState<TopSpectrum | null>(
    spectraData.length > 0 ? spectraData[0] : null
  );

  const [identifyStatus, setIdentifyStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [identifyError, setIdentifyError] = useState<string | null>(null);

  const plotComponentRef = useRef<BasePlot>(null);

  const { plotData, plotLayout } = useMemo(() => {
    if (!selectedPeak) return { plotData: [], plotLayout: {} };
    const data: Data[] = [{ x: selectedPeak.spectrum_data.map(p => p.mz), y: selectedPeak.spectrum_data.map(p => p.relative_intensity), type: 'bar', width: 0.1, marker: { color: 'steelblue' }, hovertemplate: 'm/z: %{x:.4f}<br>Intensity: %{y:.2f}%<extra></extra>' }];
    const layout: Partial<Layout> = { title: `Mass Spectrum for Peak #${selectedPeak.peak_number}`, xaxis: { title: 'm/z' }, yaxis: { title: 'Relative Intensity (%)', range: [0, 110] }, font: { family: 'Arial, sans-serif' }, paper_bgcolor: 'white', plot_bgcolor: 'white', showlegend: false };
    return { plotData: data, plotLayout: layout };
  }, [selectedPeak]);

  const handleIdentifyClick = async () => {
    if (!selectedPeak) return;
    setIdentifyStatus('loading');
    setIdentifyError(null);
    try {
      await onIdentifyPeak(selectedPeak);
      setIdentifyStatus('idle');
    } catch (error: any) {
      setIdentifyStatus('failed');
      setIdentifyError(error.message || 'Identification failed.');
    }
  };
  
  React.useEffect(() => {
    setIdentifyStatus('idle');
    setIdentifyError(null);
  }, [selectedPeak]);

  // --- BATCH EXPORT FUNCTIONALITY (FULLY INCLUDED) ---
  useImperativeHandle(ref, () => ({
    exportAllSpectraAsImages: async () => {
      console.log('Starting batch export of all mass spectra...');
      const imageList: { filename: string; base64: string; }[] = [];

      const hiddenDiv = document.createElement('div');
      hiddenDiv.style.position = 'absolute';
      hiddenDiv.style.left = '-9999px';
      document.body.appendChild(hiddenDiv);

      try {
        for (const spec of spectraData) {
          const data: Data[] = [{ x: spec.spectrum_data.map(p => p.mz), y: spec.spectrum_data.map(p => p.relative_intensity), type: 'bar', width: 0.1, marker: { color: 'steelblue' } }];
          const layout: Partial<Layout> = { title: `Mass Spectrum for Peak #${spec.peak_number}`, xaxis: { title: 'm/z' }, yaxis: { title: 'Relative Intensity (%)', range: [0, 110] } };
          
          await Plotly.newPlot(hiddenDiv, data, layout);
          const dataUrl = await Plotly.toImage(hiddenDiv, { format: 'png', width: 900, height: 500, scale: 1 });
          
          imageList.push({
            filename: `mass_spectrum_peak_${spec.peak_number}.png`,
            base64: dataUrl.split(',')[1]
          });
        }
      } catch (error) {
        console.error('Error during batch plot export:', error);
      } finally {
        Plotly.purge(hiddenDiv);
        document.body.removeChild(hiddenDiv);
      }

      console.log(`Batch export complete. ${imageList.length} images generated.`);
      return imageList;
    }
  }), [spectraData]);
  // --- END OF BATCH EXPORT FUNCTIONALITY ---

  if (!spectraData || spectraData.length === 0) {
    return <div className="bg-gray-700 rounded-md p-4 text-center text-gray-400">No mass spectra data available.</div>;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Sidebar with clickable peak numbers */}
      <div className="w-full md:w-1/4 bg-gray-900 border border-gray-700 rounded-lg p-3 overflow-y-auto max-h-96">
        <h4 className="text-md font-bold text-white mb-2">Top Peaks by Intensity</h4>
        <div className="flex flex-col space-y-1">
          {spectraData.map(spec => (
            <button 
              key={spec.peak_number} 
              onClick={() => setSelectedPeak(spec)} 
              className={`text-left p-2 rounded-md text-sm transition-colors ${
                selectedPeak?.peak_number === spec.peak_number 
                  ? 'bg-blue-600 text-white font-bold' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Peak #{spec.peak_number}
            </button>
          ))}
        </div>
      </div>

      {/* Main plot area with new identification button */}
      <div className="w-full md:w-3/4 bg-white rounded-lg shadow-md p-4">
        {selectedPeak ? (
          <>
            <BasePlot ref={plotComponentRef} data={plotData} layout={plotLayout} config={{ responsive: true, displaylogo: false }} className="w-full h-80" />
            <div className="mt-4 border-t pt-4 flex items-center gap-4">
              <button
                onClick={handleIdentifyClick}
                disabled={identifyStatus === 'loading'}
                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {identifyStatus === 'loading' && (
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {identifyStatus === 'loading' ? 'Identifying...' : 'Identify this Peak (Online)'}
              </button>
              {identifyStatus === 'failed' && <p className="text-sm text-red-500 font-semibold">✖ {identifyError}</p>}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-gray-500">Select a peak to view its spectrum.</p>
          </div>
        )}
      </div>
    </div>
  );
});