import React from 'react';
import { 
  FingerPrintIcon, 
  CheckCircleIcon, 
  ArrowDownTrayIcon 
} from '@heroicons/react/24/solid';
import { type DisplayJob, DEMO_PROJECT_ID } from '../../pages/LD50AnalysisPage';

// --- Type Definitions ---
// Define a specific type for the metadata prop for clarity and safety.
interface Metadata {
  analysis_agent?: string;
  input_data_hash_sha256?: string;
}

// Props interface for the new component.
interface ProvenanceAndDownloadProps {
  job: DisplayJob;
  metadata: Metadata | null;
  onDownload: () => void; // The download logic stays in the parent, so we pass the handler down.
}

export const ProvenanceAndDownload: React.FC<ProvenanceAndDownloadProps> = ({ job, metadata, onDownload }) => {
    const logs = job.returnvalue?.log || [];

    return (
    // This container manages the spacing between the sections.
    <div className="space-y-8">
      {/* Section 1: Verifiability & Provenance */}
      {metadata && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
            <FingerPrintIcon className="h-6 w-6 text-cyan-400" /> Verifiability & Provenance
          </h3>
          <div className="bg-gray-900/50 p-4 rounded-lg text-sm space-y-2">
            <p><strong className="text-gray-400">Analysis Agent:</strong> <span className="font-mono">{metadata.analysis_agent || 'N/A'}</span></p>
            <div className="flex items-start">
              <strong className="text-gray-400 flex-shrink-0">Input Dataset Hash (SHA-256):</strong>
              <span className="font-mono text-xs text-cyan-300 break-all ml-2">{metadata.input_data_hash_sha256 || 'N/A'}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            To verify this result, a third party can re-calculate the SHA-256 hash of the original private dataset and confirm it matches the value above.
          </p>
        </div>
      )}

      {/* Section 2: On-Chain Log Information */}
      {job.state === 'logged' && job.logData && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
              <CheckCircleIcon className="h-6 w-6 text-green-400" /> Analysis Logged On-Chain
            </h3>
            <div className="bg-gray-900/50 p-4 rounded-lg text-sm space-y-2">
              <p><strong className="text-gray-400">Agent Type:</strong> <span className="font-mono">{job.logData.agent}</span></p>
              <p><strong className="text-gray-400">Result CID:</strong> <a href={`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${job.logData.resultCID}`} target="_blank" rel="noopener noreferrer" className="text-cyan-300 font-mono text-xs break-all hover:underline">{job.logData.resultCID}</a></p>
              <p><strong className="text-gray-400">Timestamp:</strong> <span className="font-mono text-xs">{new Date(parseFloat(job.logData.timestamp) * 1000).toLocaleString()}</span></p>
            </div>
        </div>
      )}
      
      {/* Section 3: Download Button for Demo Projects */}
      {job.projectId === DEMO_PROJECT_ID && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
          <h3 className="text-lg font-semibold mb-4">Download Demo Results</h3>
          <p className="text-gray-400 mb-4 text-sm">
            Download a verifiable artifact of this demo analysis, including the data hash, metrics, and plot.
          </p>
          <button
            onClick={onDownload}
            className="flex items-center justify-center mx-auto bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-cyan-500"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2"/>
            <span>Download Artifact (.zip)</span>
          </button>
        </div>
      )}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Processing Log</h3>
            <div className="bg-gray-900/70 p-3 rounded-md max-h-96 overflow-y-auto font-mono text-xs text-gray-300">
            {logs.map((line, index) => (
                <p key={index} className="whitespace-pre-wrap">{line}</p>
            ))}
            {logs.length === 0 && <p>No log messages.</p>}
            </div>
        </div>
    </div>
  );
};