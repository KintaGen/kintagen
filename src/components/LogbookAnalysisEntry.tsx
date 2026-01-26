import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { ArrowPathIcon, ExclamationTriangleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';
import { ProvenanceAndDownload } from './analysis/ProvenanceAndDownload'; // Assuming this path is correct

// 1. Import all of your existing, specialized display components
import { NmrAnalysisResultsDisplay } from './analysis/nmr/NmrAnalysisResultsDisplay';
import { GcmsAnalysisResultsDisplay } from './analysis/xcms/GcmsAnalysisResultsDisplay';
import { AnalysisResultsDisplay as Ld50AnalysisResultsDisplay } from './analysis/ld50/AnalysisResultsDisplay';
import SecureDataDisplay from './analysis/SecureDataDisplay';

// Helper to convert a Blob to a base64 data URL
const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

// Helper for data hashing (re-using from AnalysisResultsDisplay's download logic)
const generateDataHash = async (data) => {
    const textEncoder = new TextEncoder();
    const dataBuffer = textEncoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hexHash;
};


export const LogbookAnalysisEntry = ({ step }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [jobForDisplay, setJobForDisplay] = useState(null);
    const [extractedMetadata, setExtractedMetadata] = useState(null); // State for metadata
    const [downloadableFiles, setDownloadableFiles] = useState({}); // To store file contents for download

    const agentType = step.agent.toLowerCase(); // Determine agent type once

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
                    const currentDownloadableFiles = {}; // Temporarily store files for download

                    // CORRECTED HELPERS that take a string filename
                    const readJson = async (filename) => {
                        const file = zip.file(filename);
                        if (file) {
                            const content = await file.async("string");
                            currentDownloadableFiles[filename] = content; // Store string content
                            return JSON.parse(content);
                        }
                        return undefined;
                    };
                    const readText = async (filename) => {
                        const file = zip.file(filename);
                        if (file) {
                            const content = await file.async("string");
                            currentDownloadableFiles[filename] = content; // Store string content
                            return content;
                        }
                        return undefined;
                    };
                    const readImage = async (filename) => {
                        const file = zip.file(filename);
                        if (file) {
                            const blob = await file.async("blob");
                            const base64 = await toBase64(blob);
                            currentDownloadableFiles[filename] = base64; // Store base64 content
                            return base64;
                        }
                        return undefined;
                    };

                    const [
                        nmrPlot, ld50Plot, zoomPlot, summaryText,
                        spectrumData, peaks, summaryTable, refInfo,
                        quantReport, topSpectra, rawChroma, smoothedChroma,
                        integratedPeaks, libMatches, ld50Metrics, metadata
                    ] = await Promise.all([
                        readImage("nmr_plot.png"), readImage("ld50_plot.png"), readImage("calibration_zoom_plot.png"), readText("summary_text.txt"),
                        readJson("spectrum_data.json"), readJson("peaks.json"), readJson("summary_table.json"), readJson("referencing_info.json"),
                        readJson("quantitative_report.json"), readJson("top_spectra_data.json"), readJson("raw_chromatogram.json"),
                        readJson("smoothed_chromatogram.json"), readJson("integrated_peaks.json"), readJson("library_matches.json"),
                        readJson("ld50_metrics.json"), readJson("metadata.json")
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
                    
                    if (ld50Metrics) {
                        Object.assign(results, ld50Metrics);
                    }

                    // Reconstruct the 'job' object that the display components expect
                    const reconstructedJob = {
                        state: 'logged',
                        logData: { ...step, resultCID: step.ipfsHash },
                        metadata: metadata, // Pass the extracted metadata here
                        inputDataHash: step.description.split('input hash: ')[1] || 'N/A',
                        returnvalue: {
                            results: results,
                            status: 'success'
                        }
                    };
                    setJobForDisplay(reconstructedJob);
                    setExtractedMetadata(metadata); // Set metadata for ProvenanceAndDownload
                    setDownloadableFiles(currentDownloadableFiles); // Store files for generic download

                } catch (e) {
                    setError(e.message);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchAndPrepareData();
        }
    }, [isExpanded, step, jobForDisplay, isLoading]);

    // Generic download handler for the LogbookAnalysisEntry
    const handleDownload = useCallback(async () => {
        if (!extractedMetadata || Object.keys(downloadableFiles).length === 0) {
            console.error("No data to download.");
            return;
        }

        try {
            const zip = new JSZip();
            const outputs = [];

            // Add all collected files to the zip and build outputs array for metadata
            for (const filename in downloadableFiles) {
                const content = downloadableFiles[filename];
                let fileHash;

                if (filename.endsWith('.png') || filename.endsWith('.jpg')) {
                    // For images, assume base64 content after 'data:image/png;base64,' prefix if present
                    const base64Content = content.split(',')[1] || content;
                    zip.file(filename, base64Content, { base64: true });
                    fileHash = await generateDataHash(base64Content);
                } else {
                    // For JSON/Text, treat as string
                    zip.file(filename, content);
                    fileHash = await generateDataHash(content);
                }
                outputs.push({ filename, hash_sha256: fileHash });
            }

            // Create or update the metadata.json for the download
            const downloadMetadata = {
                schema_version: "1.0.0",
                analysis_agent: extractedMetadata?.analysis_agent || step.agent,
                timestamp_utc: new Date().toISOString(),
                input_data_hash_sha256: jobForDisplay?.inputDataHash || 'N/A',
                outputs: outputs
            };
            zip.file("metadata.json", JSON.stringify(downloadMetadata, null, 2));


            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `Analysis_Artifact_${step.title.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (error) {
            console.error("Failed to create or download ZIP file:", error);
            setError(`Download failed: ${error.message}`);
        }
    }, [extractedMetadata, downloadableFiles, jobForDisplay, step]);


    const renderContent = () => {
        if (isLoading) {
            return <div className="p-4 text-gray-400 text-center"><ArrowPathIcon className="h-5 w-5 animate-spin inline mr-2" />Loading on-chain data...</div>;
        }
        if (error) {
            return <div className="p-4 bg-red-900/50 text-red-300 rounded-b-lg"><ExclamationTriangleIcon className="h-5 w-5 inline mr-2"/>Error: {error}</div>;
        }
        if (jobForDisplay) {
            const secureDataInfo = jobForDisplay.metadata?.secure_data;
            return (
                <div className="p-4 border-t border-gray-700">
                    {/* Render specialized display components */}
                    {agentType.includes('nmr') && <NmrAnalysisResultsDisplay job={jobForDisplay} />}
                    {agentType.includes('gc-ms') && <GcmsAnalysisResultsDisplay job={jobForDisplay} />}
                    {agentType.includes('ld50') && <Ld50AnalysisResultsDisplay job={jobForDisplay} />}
                    <div className='space-y-8'>
                        {secureDataInfo && <SecureDataDisplay secureDataInfo={secureDataInfo} />}

                        {/* Render ProvenanceAndDownload once, at the end of the content */}
                        {extractedMetadata && (
                            <ProvenanceAndDownload 
                                job={jobForDisplay}
                                metadata={extractedMetadata}
                                onDownload={handleDownload}
                            />
                        )}
                    </div>

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