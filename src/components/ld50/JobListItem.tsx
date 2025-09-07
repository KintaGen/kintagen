import React from 'react';
import { EyeIcon, InformationCircleIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

// Assuming your DisplayJob and Project types are in a shared file, e.g., src/types.ts
// For now, we'll define them here.
interface DisplayJob {
    id: string;
    label: string;
    state: 'completed' | 'failed' | 'processing' | 'logged';
    failedReason?: string;
    returnvalue?: any;
    logData?: any;
}

interface JobListItemProps {
  job: DisplayJob;
  onViewResults: (job: DisplayJob) => void;
  onViewLogDetails: (job: DisplayJob) => void;
}

export const JobListItem: React.FC<JobListItemProps> = ({ job, onViewResults, onViewLogDetails }) => {
  const badge = 
    job.state === 'logged' ? <span className="inline-flex items-center gap-1 text-xs bg-green-800/20 text-green-300 px-2 py-0.5 rounded"><CheckCircleIcon className="h-4 w-4"/>On-Chain</span> :
    job.state === 'completed' ? <span className="inline-flex items-center gap-1 text-xs bg-emerald-600/20 text-emerald-300 px-2 py-0.5 rounded"><CheckCircleIcon className="h-4 w-4"/>Completed</span> :
    job.state === 'failed' ? <span className="inline-flex items-center gap-1 text-xs bg-red-600/20 text-red-300 px-2 py-0.5 rounded"><XCircleIcon className="h-4 w-4"/>failed</span> :
    <span className="inline-flex items-center gap-1 text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded"><ArrowPathIcon className="h-4 w-4 animate-spin"/>{job.state}</span>;

  return (
    <li className="bg-gray-800 border border-gray-700 rounded p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="text-white font-medium">{job.label}</div>
        </div>
        <div className="flex items-center gap-2">{badge}</div>
      </div>
      {job.state === 'failed' && job.failedReason && (<div className="mt-2 text-xs text-red-300">Reason: {job.failedReason}</div>)}
      <div className="mt-3 flex gap-2">
        {job.state === 'completed' && (
          <button onClick={() => onViewResults(job)} className="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5"><EyeIcon className="h-4 w-4"/> View Results</button>
        )}
        {job.state === 'logged' && (
          <button onClick={() => onViewLogDetails(job)} className="px-3 py-1.5 text-xs rounded bg-gray-600 hover:bg-gray-500 text-white font-semibold flex items-center gap-1.5"><InformationCircleIcon className="h-4 w-4"/> View Log Details</button>
        )}
      </div>
    </li>
  );
};