import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { ArrowPathIcon, ExclamationTriangleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

// 1. Import all of your existing, specialized display components
import { NmrAnalysisResultsDisplay } from './analysis/nmr/NmrAnalysisResultsDisplay';
import { GcmsAnalysisResultsDisplay } from './analysis/xcms/GcmsAnalysisResultsDisplay';
import { AnalysisResultsDisplay as Ld50AnalysisResultsDisplay } from './analysis/ld50/AnalysisResultsDisplay';

// Helper to convert a Blob to a base64 data URL
const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

export const LogbookAnalysisEntry = ({ step }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [jobForDisplay, setJobForDisplay] = useState(null);

    useEffect(() => {
        if (isExpanded && !jobForDisplay && !isLoading) {
            const fetchAndPrepareData = async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const gatewayUrl = `https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${step.ipfsHash}`;
                    const response = await fetch(gatewayUrl);
                    if (!response.ok) throw new Error(`IPFS fetch failed (status: ${response.status})`);

                    const zipBlob = await response.blob();
                    const zip = await JSZip.loadAsync(zipBlob);
                    
                    const results = {};
                    
                    // CORRECTED HELPERS that take a string filename
                    const readJson = async (filename) => {
                        const file = zip.file(filename);
                        return file ? JSON.parse(await file.async("string")) : undefined;
                    };
                    const readText = async (filename) => {
                        const file = zip.file(filename);
                        return file ? file.async("string") : undefined;
                    };
                    const readImage = async (filename) => {
                        const file = zip.file(filename);
                        return file ? await toBase64(await file.async("blob")) : undefined;
                    };

                    const [
                        nmrPlot, ld50Plot, zoomPlot, summaryText,
                        spectrumData, peaks, summaryTable, refInfo,
                        quantReport, topSpectra, rawChroma, smoothedChroma,
                        integratedPeaks, libMatches, ld50Metrics
                    ] = await Promise.all([
                        readImage("nmr_plot.png"), readImage("ld50_plot.png"), readImage("calibration_zoom_plot.png"), readText("summary_text.txt"),
                        readJson("spectrum_data.json"), readJson("peaks.json"), readJson("summary_table.json"), readJson("referencing_info.json"),
                        readJson("quantitative_report.json"), readJson("top_spectra_data.json"), readJson("raw_chromatogram.json"),
                        readJson("smoothed_chromatogram.json"), readJson("integrated_peaks.json"), readJson("library_matches.json"),
                        readJson("ld50_metrics.json")
                    ]);

                    // Assemble the results object correctly
                    results.plot_b64 = nmrPlot || ld50Plot; // Prioritize NMR plot if both somehow exist
                    results.residual_zoom_plot_b64 = zoomPlot;
                    results.summary_text = summaryText;
                    results.spectrum_data = spectrumData;
                    results.peaks = peaks;
                    results.summary_table = summaryTable;
                    results.referencing_info = refInfo;
                    results.quantitative_report = quantReport;
                    results.top_spectra_data = topSpectra;
                    results.raw_chromatogram_data = rawChroma;
                    results.smoothed_chromatogram_data = smoothedChroma;
                    results.integrated_peaks_details = integratedPeaks;
                    results.library_matches = libMatches;

                    // The LD50 metrics are at the top level of the `results` object
                    if (ld50Metrics) {
                        Object.assign(results, ld50Metrics);
                    }

                    // Reconstruct the 'job' object that the display components expect
                    const reconstructedJob = {
                        state: 'logged',
                        logData: { ...step, resultCID: step.ipfsHash },
                        inputDataHash: step.description.split('input hash: ')[1] || 'N/A',
                        returnvalue: {
                            results: results,
                            status: 'success'
                        }
                    };
                    setJobForDisplay(reconstructedJob);

                } catch (e) {
                    setError(e.message);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchAndPrepareData();
        }
    }, [isExpanded, step, jobForDisplay, isLoading]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="p-4 text-gray-400 text-center"><ArrowPathIcon className="h-5 w-5 animate-spin inline mr-2" />Loading on-chain data...</div>;
        }
        if (error) {
            return <div className="p-4 bg-red-900/50 text-red-300 rounded-b-lg"><ExclamationTriangleIcon className="h-5 w-5 inline mr-2"/>Error: {error}</div>;
        }
        if (jobForDisplay) {
            // This dispatcher logic is correct and will now work
            const agent = step.agent.toLowerCase();
            return (
                <div className="p-4 border-t border-gray-700">
                    {agent.includes('nmr') && <NmrAnalysisResultsDisplay job={jobForDisplay} />}
                    {agent.includes('gc-ms') && <GcmsAnalysisResultsDisplay job={jobForDisplay} />}
                    {agent.includes('ld50') && <Ld50AnalysisResultsDisplay job={jobForDisplay} />}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-gray-900/50 rounded-lg border border-gray-700">
            <div 
                className="p-4 flex justify-between items-center cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div>
                    <p className="font-semibold text-white">{step.title}</p>
                    <p className="text-sm text-gray-400 mt-2">Agent: <span className="font-mono text-xs bg-gray-700 px-1.5 py-0.5 rounded">{step.agent}</span></p>
                </div>
                {isExpanded ? <ChevronUpIcon className="h-6 w-6 text-gray-400"/> : <ChevronDownIcon className="h-6 w-6 text-gray-400"/>}
            </div>
            {isExpanded && renderContent()}
        </div>
    );
};