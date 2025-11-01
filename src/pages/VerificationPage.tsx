import React, { useState, useCallback } from 'react';
import { 
    ArrowUpTrayIcon, 
    DocumentTextIcon, 
    CheckCircleIcon, 
    XCircleIcon,
    ShieldCheckIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

import { generateDataHash } from '../utils/hash';

// --- Type Definitions ---
interface AnalysisMetadata {
  analysis_agent: string; // We need this to determine the file type
  input_data_hash_sha256: string;
  [key: string]: any;
}

type AnalysisType = 'ld50' | 'nmr' | 'gcms' | 'unknown';
type VerificationStatus = 'success' | 'failure';

interface VerificationResult {
  filename: string;
  expectedHash: string;
  calculatedHash: string;
  status: VerificationStatus;
}

// --- The Main Component, Corrected to Handle All Analysis Types ---
export default function VerificationPage() {
  const [metadata, setMetadata] = useState<AnalysisMetadata | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>('unknown');
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setMetadata(null);
    setAnalysisType('unknown');
    setInputFile(null);
    setResult(null);
    setError(null);
    const metaInput = document.getElementById('metadata-input') as HTMLInputElement;
    if (metaInput) metaInput.value = '';
    const dataInput = document.getElementById('data-input') as HTMLInputElement;
    if (dataInput) dataInput.value = '';
  };

  const handleMetadataUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    handleReset(); 

    if (file.type !== 'application/json') {
      setError('Metadata must be a .json file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsedJson = JSON.parse(e.target?.result as string);
        if (typeof parsedJson.input_data_hash_sha256 !== 'string' || typeof parsedJson.analysis_agent !== 'string') {
          throw new Error("Metadata must contain 'input_data_hash_sha256' and 'analysis_agent' strings.");
        }
        setMetadata(parsedJson);
        
        // --- Automatically determine analysis type from metadata ---
        const agent = parsedJson.analysis_agent.toLowerCase();
        if (agent.includes('ld50')) setAnalysisType('ld50');
        else if (agent.includes('nmr')) setAnalysisType('nmr');
        else if (agent.includes('gc-ms')) setAnalysisType('gcms');
        else setAnalysisType('unknown');

      } catch (err: any) {
        setError(`Failed to parse metadata: ${err.message}`);
        setMetadata(null);
        setAnalysisType('unknown');
      }
    };
    reader.readAsText(file);
  };

  const handleInputFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        setInputFile(file);
        setResult(null);
    }
  };

  const handleVerify = useCallback(async () => {
    if (!metadata || !inputFile || analysisType === 'unknown') {
      setError('A valid metadata file and an input data file must be provided.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
        let calculatedHash: string;
        
        // Case 1: LD50 uses a hash of the TEXT content.
        if (analysisType === 'ld50') {
            const fileText = await inputFile.text();
            calculatedHash = await generateDataHash(fileText);
        } 
        // Case 2: NMR and GCMS use a hash of the raw FILE BUFFER.
        else {
            const fileBuffer = await inputFile.arrayBuffer();
            calculatedHash = await generateDataHash(fileBuffer);
        }

        const expectedHash = metadata.input_data_hash_sha256;
        const isMatch = calculatedHash === expectedHash;

        setResult({
            filename: inputFile.name,
            expectedHash,
            calculatedHash,
            status: isMatch ? 'success' : 'failure',
        });
    } catch (e: any) {
        setError(`An error occurred during verification: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  }, [metadata, inputFile, analysisType]);
  
  const ResultDisplay = () => {
    if (!result) return null;
    const isSuccess = result.status === 'success';

    return (
        <div className={clsx("mt-6 bg-white shadow-md rounded-lg border-l-4 p-6", {
            'border-green-500': isSuccess,
            'border-red-500': !isSuccess,
        })}>
            <div className="flex items-center gap-4">
                {isSuccess ? 
                    <CheckCircleIcon className="h-12 w-12 text-green-500" /> :
                    <XCircleIcon className="h-12 w-12 text-red-500" />
                }
                <div>
                    <h2 className={clsx("text-xl font-bold", {
                        'text-green-700': isSuccess,
                        'text-red-700': !isSuccess,
                    })}>
                        {isSuccess ? 'Verification Successful' : 'Verification Failed: Hash Mismatch'}
                    </h2>
                    <p className="text-gray-600">The provided file <strong>{result.filename}</strong> {isSuccess ? 'matches' : 'does not match'} the expected hash.</p>
                </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-500">Expected Hash:</span>
                    <span className="font-mono text-gray-800 break-all">{result.expectedHash}</span>
                </div>
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-500">Calculated Hash:</span>
                    <span className={clsx("font-mono break-all", {
                        'text-green-600': isSuccess,
                        'text-red-600': !isSuccess,
                    })}>{result.calculatedHash}</span>
                </div>
            </div>
        </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Input Data Verification</h1>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Start Over
        </button>
      </div>
      <p className="text-gray-600">
        Verify the authenticity of an original input data file by comparing its cryptographic hash against the one recorded in a trusted `metadata.json` report.
      </p>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Step 1: Upload Metadata</h3>
            <p className="text-gray-600 text-sm mb-4">Select the `metadata.json` file from a downloaded artifact.</p>
            <div className="mt-auto">
                <label htmlFor="metadata-input" className="cursor-pointer inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 border border-gray-300 rounded-lg shadow-sm">
                    <DocumentTextIcon className="h-5 w-5" /> Select Metadata
                </label>
                <input id="metadata-input" type="file" accept=".json" onChange={handleMetadataUpload} className="hidden" />
                {metadata && (
                    <div className="text-green-600 font-semibold mt-3 flex flex-col gap-1 text-sm">
                        <p className="flex items-center gap-2"><CheckCircleIcon className="h-5 w-5" /> Metadata Loaded</p>
                        <p className="text-gray-500 font-normal ml-7">Type Detected: <span className="font-semibold uppercase text-blue-600">{analysisType}</span></p>
                    </div>
                )}
            </div>
        </div>
        
        <div className={clsx("bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col transition-opacity", { 'opacity-50': !metadata })}>
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Step 2: Upload Input Data</h3>
            <p className="text-gray-600 text-sm mb-4">Select the original data file (e.g., `.csv`, `.zip`, `.mzML`) that was analyzed.</p>
            <div className="mt-auto">
                <label htmlFor="data-input" className={clsx("cursor-pointer inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 border border-gray-300 rounded-lg shadow-sm", { 'cursor-not-allowed': !metadata })}>
                    <ArrowUpTrayIcon className="h-5 w-5" /> Select Input File
                </label>
                <input id="data-input" type="file" onChange={handleInputFileUpload} className="hidden" disabled={!metadata} />
                {inputFile && <p className="text-blue-600 font-semibold mt-3 flex items-center gap-2 text-sm"><CheckCircleIcon className="h-5 w-5 text-blue-500" /> Selected: {inputFile.name}</p>}
            </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleVerify}
          disabled={isLoading || !metadata || !inputFile}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-3"
        >
          <ShieldCheckIcon className="h-6 w-6" />
          {isLoading ? 'Verifying...' : 'Verify Input File'}
        </button>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">
        <strong className="font-bold">Error: </strong>
        <span>{error}</span>
      </div>}
      
      <ResultDisplay />
    </div>
  );
}