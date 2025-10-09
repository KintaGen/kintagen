import React, { useRef, useState, useMemo,useEffect } from 'react';
import JSZip from 'jszip';
import { ProvenanceAndDownload } from '../ProvenanceAndDownload';
import { FidChromatogramPlot, type PlotRef as ChromatogramPlotRef } from './FidChromatogramPlot'; 
import { MassSpectraDisplay, type MassSpectraPlotRef, type TopSpectrum } from './MassSpectraDisplay';
import { generateDataHash } from '../../../utils/hash';

const R_API = import.meta.env.VITE_API_BASE_URL;
// --- Interfaces ---
interface DisplayJob { 
  projectId: string;
  state: 'completed' | 'failed' | 'processing' | 'logged'; 
  returnvalue?: any;
  logData?: any;
}

interface GcmsAnalysisResultsDisplayProps {
  job: DisplayJob;
}

// --- Component ---
export const GcmsAnalysisResultsDisplay: React.FC<GcmsAnalysisResultsDisplayProps> = ({ job }) => {
  const { returnvalue, logData } = job;
  const initialResults = returnvalue?.results;
  
  const chromatogramPlotRef = useRef<ChromatogramPlotRef>(null);
  const msPlotRef = useRef<MassSpectraPlotRef>(null);

  // Memoized hook to merge results. This runs once and creates the data for the table.
  const quantReportData = useMemo(() => {
    const quantReport = initialResults?.quantitative_report || [];
    const libraryMatches = initialResults?.library_matches || [];
    
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

  // Destructure all other data needed for rendering directly from the initial results.
  const smoothedData = initialResults?.smoothed_chromatogram_data || [];
  const integratedPeaksData = initialResults?.integrated_peaks_details || [];
  const topSpectraData = initialResults?.top_spectra_data || [];
  const topPeakNumbers = topSpectraData.map((spec: any) => spec.peak_number);
  const libraryMatchesData = initialResults?.library_matches || [];

  const metadata = returnvalue ? {
    input_data_hash_sha256: returnvalue.inputDataHash,
    analysis_agent: "KintaGen GC-MS Feature Finder v1.3",
  } : null;

  const handleDownload = async () => {
    if (job.state === 'logged' && logData?.resultCID) {
      window.open(`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${logData.resultCID}?download=true`, '_blank');
      return;
    }

    if (job.state === 'completed' && initialResults && metadata) {
      try {
        const zip = new JSZip();
        const outputs = [];

        // 1. Quantitative Report (JSON) - Now includes merged IDs if available
        if (quantReportData.length > 0) {
          const jsonString = JSON.stringify(quantReportData, null, 2);
          const jsonHash = await generateDataHash(jsonString);
          outputs.push({ filename: "quantitative_report_with_ids.json", hash_sha256: jsonHash });
          zip.file("quantitative_report_with_ids.json", jsonString);
        }
        
        // 2. Top Spectra Data (JSON)
        if (topSpectraData.length > 0) {
          const jsonString = JSON.stringify(topSpectraData, null, 2);
          const jsonHash = await generateDataHash(jsonString);
          outputs.push({ filename: "top_spectra_data.json", hash_sha256: jsonHash });
          zip.file("top_spectra_data.json", jsonString);
        }

        // 3. Exported Interactive Chromatogram (PNG)
        if (chromatogramPlotRef.current) {
          const imageDataUrl = await chromatogramPlotRef.current.exportPlotImage();
          if (imageDataUrl) {
            const base64 = imageDataUrl.split(',')[1];
            const hash = await generateDataHash(base64);
            outputs.push({ filename: "interactive_chromatogram.png", hash_sha256: hash });
            zip.file("interactive_chromatogram.png", base64, { base64: true });
          }
        }
        
        // 4. BATCH Export all Mass Spectrum Plots (PNGs)
        if (msPlotRef.current) {
          const imageList = await msPlotRef.current.exportAllSpectraAsImages();
          if (imageList && imageList.length > 0) {
            const spectraFolder = zip.folder("mass_spectra_plots");
            for (const image of imageList) {
              const hash = await generateDataHash(image.base64);
              outputs.push({ filename: `mass_spectra_plots/${image.filename}`, hash_sha256: hash });
              spectraFolder?.file(image.filename, image.base64, { base64: true });
            }
          }
        }

        if (outputs.length === 0) throw new Error("No output data available to download.");

        const fullMetadata = {
            schema_version: "1.8.0",
            analysis_agent: "KintaGen GC-MS Feature Finder & Identifier v1.0 (Local Run)",
            timestamp_utc: new Date().toISOString(),
            input_data_hash_sha256: metadata.input_data_hash_sha256,
            outputs: outputs
        };
        zip.file("metadata.json", JSON.stringify(fullMetadata, null, 2));

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `KintaGen_GCMS_Analysis_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

      } catch (error) {
        console.error("Failed to create or download ZIP file:", error);
        alert("An error occurred while creating the download file.");
      }
      return;
    }
    alert("Download artifact is not available for this job.");
  };  
  return (
    <>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-white">GC-MS Analysis Results</h2>
        
        {/* Quantitative Report Table - This now dynamically updates */}
        <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Quantitative Report & Identification</h3>
            {quantReportData.length > 0 ? (
                <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-700 max-h-96">
                    <table className="min-w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3">Peak #</th>
                                <th scope="col" className="px-6 py-3">RT (min)</th>
                                <th scope="col" className="px-6 py-3">Area %</th>
                                <th scope="col" className="px-6 py-3">Putative ID</th>
                                <th scope="col" className="px-6 py-3">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quantReportData.map((peak: any) => (
                                <tr key={peak.peak_number} className="border-b border-gray-700 hover:bg-gray-600">
                                    <td className="px-6 py-4 font-medium text-white">{peak.peak_number}</td>
                                    <td className="px-6 py-4">{peak.rt_minutes.toFixed(3)}</td>
                                    <td className="px-6 py-4">{peak.area_percent.toFixed(2)}%</td>
                                    <td className="px-6 py-4 font-semibold text-cyan-400">{peak.match_name}</td>
                                    <td className="px-6 py-4">{peak.similarity_score?.toFixed(3) || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (<p className="text-gray-400">No quantitative data available.</p>)}
        </div>

        {/* Interactive Chromatogram */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Interactive Chromatogram</h3>
          <FidChromatogramPlot 
            ref={chromatogramPlotRef}
            smoothedChromatogramData={smoothedData}
            integratedPeaks={integratedPeaksData}
            quantReportData={quantReportData}
            topPeakNumbers={topPeakNumbers}
          />
        </div>
        
        {/* Interactive Mass Spectra Display with the on-demand callback prop */}
        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Top 50 Mass Spectra</h3>
          <MassSpectraDisplay 
            ref={msPlotRef}
            spectraData={topSpectraData}
            libraryMatches={libraryMatchesData}
          />
        </div>
      </div>

      <ProvenanceAndDownload 
        job={job}
        metadata={metadata}
        onDownload={handleDownload}
      />
    </>
  );
};