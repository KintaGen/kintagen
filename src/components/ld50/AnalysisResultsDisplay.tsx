import React from 'react';
import { ArrowDownTrayIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { TransactionButton } from '@onflow/react-sdk';

// Assuming types are shared
interface DisplayJob { state: 'completed' | 'failed' | 'processing' | 'logged'; returnvalue?: any; logData?: any; }

interface AnalysisResultsDisplayProps {
  job: DisplayJob;
  transaction: any; // The transaction object for the button
  onLogSuccess: (txId: string) => void;
  onLogError: (error: Error) => void;
}

export const AnalysisResultsDisplay: React.FC<AnalysisResultsDisplayProps> = ({ job, transaction, onLogSuccess, onLogError }) => {
  return (
    <div className="space-y-8 my-8">
      {job.state !== 'logged' && job.returnvalue?.status === 'success' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-6 border-b border-gray-700 pb-3">Key Metrics</h2>
            <div className="space-y-4">{(['ld50_estimate', 'standard_error', 'confidence_interval_lower', 'confidence_interval_upper'] as const).map(key => (<div key={key} className="flex justify-between items-baseline"><span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span><span className="font-mono text-lg text-white">{(job.returnvalue as any).results[key]?.toFixed(4)}</span></div>))}</div>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[300px]">
            <h2 className="text-xl font-semibold mb-4 text-center">Dose-Response Plot</h2>
            <img src={(job.returnvalue as any).results.plot_b64} alt="LD50 Dose-Response Curve" className="w-full h-auto rounded-lg bg-white p-1" />
          </div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
        {job.state === 'logged' ? (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-300 flex items-center justify-center gap-2"><CheckCircleIcon className="h-6 w-6" />Analysis Logged On-Chain</h3>
            <div className="text-left bg-gray-900/50 p-4 rounded-lg text-sm space-y-2">
              <p><strong className="text-gray-400">Agent Type:</strong> <span className="font-mono">{job.logData.agent}</span></p>
              <p><strong className="text-gray-400">Result CID:</strong> <span className="font-mono text-xs">{job.logData.resultCID}</span></p>
              <p className="flex items-center gap-1"><strong className="text-gray-400">Timestamp:</strong> <span className="font-mono text-xs">{new Date(parseFloat(job.logData.timestamp) * 1000).toLocaleString()}</span></p>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-4">Log Results to Blockchain</h3>
            <p className="text-gray-400 mb-4 text-sm">Add a permanent, on-chain record of this analysis to the project's NFT.</p>
            <TransactionButton
              transaction={transaction}
              className="flex items-center justify-center mx-auto bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
              mutation={{
                onSuccess: onLogSuccess,
                onError: onLogError,
              }}
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2"/>
              <span>Log Results</span>
            </TransactionButton>
          </div>
        )}
      </div>
    </div>
  );
};