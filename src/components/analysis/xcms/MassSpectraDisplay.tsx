import React, { useState, useMemo, useImperativeHandle, useRef, forwardRef } from 'react';
import BasePlot from 'react-plotly.js';
import Plotly from 'plotly.js';
import { Data, Layout } from 'plotly.js';

// --- Interfaces ---
interface SpectrumPoint { 
  mz: number; 
  intensity?: number; // Raw intensity from library
  relative_intensity?: number; // Normalized intensity from R script
}

export interface TopSpectrum { 
  peak_number: number; 
  spectrum_data: SpectrumPoint[]; 
}

export interface LibraryMatch {
  peak_number: number;
  match_name: string;
  similarity_score: number;
  library_spectrum?: SpectrumPoint[]; 
}

interface MassSpectraDisplayProps {
  spectraData: TopSpectrum[];
  libraryMatches: LibraryMatch[];
}

export interface MassSpectraPlotRef {
  exportAllSpectraAsImages: () => Promise<{ filename: string; base64: string; }[]>;
}

// Helper to normalize a spectrum's intensity to 0-100
const normalizeSpectrum = (spectrum: SpectrumPoint[]): {mz: number; intensity: number}[] => {
  if (!spectrum || spectrum.length === 0) return [];
  // Handles both `intensity` from library and `relative_intensity` from initial script
  const maxIntensity = Math.max(...spectrum.map(p => p.intensity || p.relative_intensity || 0), 0);
  if (maxIntensity === 0) return spectrum.map(p => ({ mz: p.mz, intensity: 0 }));
  return spectrum.map(p => ({
    mz: p.mz,
    intensity: ((p.intensity || p.relative_intensity || 0) / maxIntensity) * 100,
  }));
};

// --- Component ---
export const MassSpectraDisplay = forwardRef<MassSpectraPlotRef, MassSpectraDisplayProps>(
  ({ spectraData, libraryMatches }, ref) => {
    
  const [selectedPeak, setSelectedPeak] = useState<TopSpectrum | null>(
    spectraData.length > 0 ? spectraData[0] : null
  );

  // Create a fast lookup map for match results
  const matchesMap = useMemo(() => new Map(libraryMatches.map(m => [m.peak_number, m])), [libraryMatches]);

  // This memo now generates data for TWO plots if a match exists
  const { queryPlot, libraryPlot } = useMemo(() => {
    if (!selectedPeak) return { queryPlot: null, libraryPlot: null };

    // Find the match for the currently selected peak
    const currentMatch = matchesMap.get(selectedPeak.peak_number);
    
    // --- Query Plot (Always shows) ---
    const normalizedQuery = normalizeSpectrum(selectedPeak.spectrum_data);
      // --- START: X-AXIS ALIGNMENT LOGIC ---
      let sharedXAxisRange: [number, number] | undefined = undefined;
      let normalizedLibrary: {mz: number; intensity: number}[] = [];
  
      if (currentMatch && currentMatch.similarity_score > 0.7 && currentMatch.library_spectrum) {
        normalizedLibrary = normalizeSpectrum(currentMatch.library_spectrum);
        
        // Calculate the min and max m/z across BOTH spectra
        const allMzs = [...normalizedQuery.map(p => p.mz), ...normalizedLibrary.map(p => p.mz)];
        if (allMzs.length > 0) {
          const minMz = Math.min(...allMzs);
          const maxMz = Math.max(...allMzs);
          const padding = (maxMz - minMz) * 0.05; // 5% padding
          sharedXAxisRange = [minMz - padding, maxMz + padding];
        }
      }
      // --- END: X-AXIS ALIGNMENT LOGIC ---
      const queryData: Data[] = [{ x: normalizedQuery.map(p => p.mz), y: normalizedQuery.map(p => p.intensity), type: 'bar', width: 0.1, name: 'Query', marker: { color: 'steelblue' }, hovertemplate: 'm/z: %{x:.4f}<br>Intensity: %{y:.2f}%<extra></extra>' }];
      const queryLayout: Partial<Layout> = {
        title: `Experimental Spectrum (Peak #${selectedPeak.peak_number})`,
        xaxis: { title: 'm/z', range: sharedXAxisRange }, 
        yaxis: { title: 'Rel. Intensity (%)', range: [0, 110] },
        font: { family: 'Arial, sans-serif' }, paper_bgcolor: 'white', plot_bgcolor: 'white', showlegend: false,
        margin: { l: 50, r: 20, t: 40, b: 40 }
      };
  
      let libraryPlotData: {data: Data[], layout: Partial<Layout>} | null = null;
      if (currentMatch && currentMatch.similarity_score > 0.7 && currentMatch.library_spectrum) {
        const libraryData: Data[] = [{ x: normalizedLibrary.map(p => p.mz), y: normalizedLibrary.map(p => p.intensity), type: 'bar', width: 0.1, name: 'Library', marker: { color: 'darkred' }, hovertemplate: 'm/z: %{x:.4f}<br>Intensity: %{y:.2f}%<extra></extra>' }];
        const libraryLayout: Partial<Layout> = {
          title: { text: `<b>Library Match:</b> ${currentMatch.match_name}<br><i>Score: ${currentMatch.similarity_score.toFixed(3)}</i>`, font: {size: 14} },
          xaxis: { title: 'm/z', range: sharedXAxisRange }, 
          yaxis: { title: 'Rel. Intensity (%)', range: [0, 110] },
          font: { family: 'Arial, sans-serif' }, paper_bgcolor: 'white', plot_bgcolor: 'white', showlegend: false,
          margin: { l: 50, r: 20, t: 60, b: 40 }
        };
        libraryPlotData = { data: libraryData, layout: libraryLayout };
      }

    return { queryPlot: { data: queryData, layout: queryLayout }, libraryPlot: libraryPlotData };
  }, [selectedPeak, matchesMap]);

  // Batch export functionality
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
            const normalizedSpec = normalizeSpectrum(spec.spectrum_data);
            const data: Data[] = [{ x: normalizedSpec.map(p => p.mz), y: normalizedSpec.map(p => p.intensity), type: 'bar', width: 0.1, marker: { color: 'steelblue' } }];
            const layout: Partial<Layout> = { title: `Mass Spectrum for Peak #${spec.peak_number}`, xaxis: { title: 'm/z' }, yaxis: { title: 'Relative Intensity (%)', range: [0, 110] } };
            await Plotly.newPlot(hiddenDiv, data, layout);
            const dataUrl = await Plotly.toImage(hiddenDiv, { format: 'png', width: 900, height: 500, scale: 1 });
            imageList.push({ filename: `mass_spectrum_peak_${spec.peak_number}.png`, base64: dataUrl.split(',')[1] });
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
  }));

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

      {/* Main plot area - now shows one or two plots */}
      <div className="w-full md:w-3/4 flex flex-col gap-2">
        {selectedPeak && queryPlot ? (
          <>
            {/* Top Plot: Experimental Spectrum */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <BasePlot data={queryPlot.data} layout={queryPlot.layout} config={{ responsive: true, displaylogo: false }} className="w-full h-80" />
            </div>

            {/* Bottom Plot: Library Match (Conditional) */}
            {libraryPlot ? (
              <div className="bg-white rounded-lg shadow-md p-4">
                <BasePlot data={libraryPlot.data} layout={libraryPlot.layout} config={{ responsive: true, displaylogo: false }} className="w-full h-80" />
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg shadow-inner p-4 h-80 flex items-center justify-center">
                <p className="text-gray-500 font-medium">No confident library match found for this peak.</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
            <p className="text-gray-500">Select a peak to view its spectrum.</p>
          </div>
        )}
      </div>
    </div>
  );
});