import React, { useRef, useMemo } from 'react';
import JSZip from 'jszip';
import BasePlot from 'react-plotly.js';
import { Layout, Data } from 'plotly.js';
import { ProvenanceAndDownload } from '../ProvenanceAndDownload';
import { FidChromatogramPlot, type PlotRef as ChromatogramPlotRef } from './FidChromatogramPlot'; 
import { MassSpectraDisplay, type MassSpectraPlotRef } from './MassSpectraDisplay';
import { generateDataHash } from '../../../utils/hash';

import { type DisplayJob } from '../../../types';

type ResultsDisplayJob = Pick<DisplayJob, 'projectId' | 'state' | 'returnvalue' | 'logData' | 'inputDataHash'>;

interface GcmsAnalysisResultsDisplayProps {
  job: ResultsDisplayJob;
}

export const GcmsAnalysisResultsDisplay: React.FC<GcmsAnalysisResultsDisplayProps> = ({ job }) => {
  const { returnvalue, logData, inputDataHash } = job;
  const initialResults = returnvalue?.results;
  
  const chromatogramPlotRef = useRef<ChromatogramPlotRef>(null);
  const msPlotRef = useRef<MassSpectraPlotRef>(null);

  // --- 1. Data Parsing ---

  // A. FULL Quantitative Report (Keep this COMPLETE for Downloads)
  const fullQuantReportData = useMemo(() => {
    const quantReport = initialResults?.quantitative_report || [];
    const libraryMatches = initialResults?.library_matches || [];
    
    // Map library matches to the full list
    if (libraryMatches.length > 0) {
      const matchMap = new Map(libraryMatches.map((item: any) => [item.peak_number, item]));
      return quantReport.map((peak: any) => ({
        ...peak,
        match_name: matchMap.get(peak.peak_number)?.match_name || 'N/A',
        similarity_score: matchMap.get(peak.peak_number)?.similarity_score,
      }));
    }
    return quantReport.map((p: any) => ({ ...p, match_name: 'N/A' }));
  }, [initialResults]);

  // B. DISPLAY Data (Top 50 Sorted by Intensity for UI Table & Plot Labels)
  const displayData = useMemo(() => {
    // 1. Sort by Area Percent (Descending)
    // 2. Slice top 50
    // 3. (Optional) Sort back by RT for the table if you prefer time-order, 
    //    but usually "Top 50" implies rank order. We will keep Rank Order here.
    return [...fullQuantReportData]
        .sort((a, b) => b.area_percent - a.area_percent)
        .slice(0, 50);
  }, [fullQuantReportData]);

  const smoothedData = initialResults?.smoothed_chromatogram_data || [];
  const integratedPeaksData = initialResults?.integrated_peaks_details || [];
  const multiFileChromatograms = initialResults?.chromatograms_after_alignment || [];
  const topSpectraData = initialResults?.top_spectra_data || [];
  
  // Only highlight peaks that are in our Top 50 display list
  const topPeakNumbers = displayData.map((p) => p.peak_number);
  const libraryMatchesData = initialResults?.library_matches || [];
  
  const alignmentData = initialResults?.retention_time_deviation || [];

  const metadata = inputDataHash ? {
    input_data_hash_sha256: inputDataHash,
    analysis_agent: "KintaGen GC-MS Feature Finder v2.0",
  } : null;

  // --- 2. Alignment Plot Config ---
  const alignmentPlotData: Data[] = useMemo(() => {
     if (!alignmentData || alignmentData.length === 0) return [];
     return alignmentData.map((fileObj: any) => ({
         x: fileObj.data.map((d: any) => d.rt_min),
         y: fileObj.data.map((d: any) => d.deviation_seconds),
         type: 'scatter',
         mode: 'lines',
         name: fileObj.filename,
         line: { width: 2 },
         opacity: 0.8
     }));
  }, [alignmentData]);

  const alignmentLayout: Partial<Layout> = {
      title: 'Retention Time Deviation (Alignment)',
      xaxis: { title: 'Retention Time (min)', showgrid: true, gridcolor: '#f3f4f6' },
      yaxis: { title: 'Deviation (seconds)', showgrid: true, gridcolor: '#f3f4f6' },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      height: 350,
      margin: { l: 50, r: 20, t: 40, b: 40 },
      showlegend: true,
      legend: { orientation: 'h', y: -0.2 }
  };

  // --- 3. Download Logic ---
  const handleDownload = async () => {
    if (job.state === 'logged' && logData?.resultCID) {
      window.open(`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${logData.resultCID}?download=true`, '_blank');
      return;
    }

    if (job.state === 'completed' && initialResults && metadata) {
      try {
        const zip = new JSZip();
        const outputs = [];

        const addJsonToZip = async (filename: string, data: any) => {
             if (data && (Array.isArray(data) ? data.length > 0 : true)) {
                 const jsonString = JSON.stringify(data, null, 2);
                 const jsonHash = await generateDataHash(jsonString);
                 outputs.push({ filename, hash_sha256: jsonHash });
                 zip.file(filename, jsonString);
             }
        };

        // NOTE: We download fullQuantReportData (ALL peaks), not just the top 50
        await addJsonToZip("quantitative_report_with_ids.json", fullQuantReportData);
        await addJsonToZip("top_spectra_data.json", topSpectraData);
        await addJsonToZip("alignment_data.json", alignmentData); 
        await addJsonToZip("chromatograms_aligned.json", multiFileChromatograms); 

        if (chromatogramPlotRef.current) {
          const imageDataUrl = await chromatogramPlotRef.current.exportPlotImage();
          if (imageDataUrl) {
            const base64 = imageDataUrl.split(',')[1];
            const hash = await generateDataHash(base64);
            outputs.push({ filename: "chromatogram_plot.png", hash_sha256: hash });
            zip.file("chromatogram_plot.png", base64, { base64: true });
          }
        }
        
        if (msPlotRef.current && topSpectraData.length > 0) {
            const imageList = await msPlotRef.current.exportAllSpectraAsImages();
            const spectraFolder = zip.folder("mass_spectra_plots");
            for (const image of imageList) {
               const hash = await generateDataHash(image.base64);
               outputs.push({ filename: `mass_spectra_plots/${image.filename}`, hash_sha256: hash });
               spectraFolder?.file(image.filename, image.base64, { base64: true });
            }
        }

        if (outputs.length === 0) throw new Error("No output data available.");

        const fullMetadata = {
            ...metadata,
            timestamp_utc: new Date().toISOString(),
            outputs: outputs
        };
        zip.file("metadata.json", JSON.stringify(fullMetadata, null, 2));

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `KintaGen_GCMS_Result.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } catch (error) {
        console.error("ZIP Error:", error);
        alert("Failed to generate download. Check console.");
      }
    }
  };

  return (
    <>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-white">GC-MS Analysis Results</h2>
        
        {/* --- 1. Alignment Plot --- */}
        {alignmentData.length > 0 && (
            <div className="mb-8 bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-2 text-gray-800">File Alignment (Deviation)</h3>
                <BasePlot 
                    data={alignmentPlotData} 
                    layout={alignmentLayout} 
                    config={{ responsive: true, displaylogo: false }} 
                    style={{ width: '100%' }} 
                />
            </div>
        )}

        {/* --- 2. Interactive Chromatogram --- */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">
              {multiFileChromatograms.length > 1 ? "Aligned Chromatograms (Overlay)" : "Chromatogram Analysis"}
          </h3>
          <FidChromatogramPlot 
            ref={chromatogramPlotRef}
            smoothedChromatogramData={smoothedData} 
            integratedPeaks={integratedPeaksData}
            // CHANGED: Pass displayData instead of fullQuantReportData
            // This ensures only Top 50 labels are shown on the plot
            quantReportData={displayData}
            topPeakNumbers={topPeakNumbers}
            multiFileChromatograms={multiFileChromatograms} 
          />
        </div>

        {/* --- 3. Quantitative Table (LIMITED TO TOP 50) --- */}
        <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">
                Top 50 Peaks (by Intensity)
                <span className="text-sm font-normal text-gray-400 ml-2">
                    (Download full report for all {fullQuantReportData.length} peaks)
                </span>
            </h3>
            
            {displayData.length > 0 ? (
                <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-700 max-h-96 custom-scrollbar">
                    <table className="min-w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3">Peak #</th>
                                <th className="px-6 py-3">RT (min)</th>
                                <th className="px-6 py-3">Area %</th>
                                <th className="px-6 py-3">Putative ID (MoNA)</th>
                                <th className="px-6 py-3">Score</th>
                            </tr>
                        </thead>
                        {/* CHANGED: Map over displayData, not fullQuantReportData */}
                        <tbody>
                            {displayData.map((peak: any) => (
                                <tr key={peak.peak_number} className="border-b border-gray-700 hover:bg-gray-600 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{peak.peak_number}</td>
                                    <td className="px-6 py-4">{peak.rt_minutes?.toFixed(3)}</td>
                                    <td className="px-6 py-4">{peak.area_percent?.toFixed(2)}%</td>
                                    <td className="px-6 py-4 font-semibold text-cyan-400">
                                        {peak.match_name !== 'N/A' ? peak.match_name : <span className="text-gray-500 italic">Unknown</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {peak.similarity_score ? peak.similarity_score.toFixed(2) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-gray-700 p-4 rounded-md text-gray-300">
                    No peaks detected.
                </div>
            )}
        </div>
        
        {/* --- 4. Mass Spectra Grid --- */}
        {topSpectraData.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-300">Top 50 Mass Spectra</h3>
              <MassSpectraDisplay 
                ref={msPlotRef}
                spectraData={topSpectraData}
                libraryMatches={libraryMatchesData}
              />
            </div>
        )}
      </div>

      <ProvenanceAndDownload 
        job={job}
        metadata={metadata}
        onDownload={handleDownload}
      />
    </>
  );
};