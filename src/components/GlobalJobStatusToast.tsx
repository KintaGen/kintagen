// src/components/GlobalJobStatusToast.tsx
import React, { useMemo } from 'react';
import { ArrowPathIcon, BeakerIcon } from '@heroicons/react/24/solid';
import { type Job } from '../utils/jobs';

interface Props {
  jobs: Job[];
}

const GlobalJobStatusToast: React.FC<Props> = ({ jobs }) => {
  // Find the most recent job that is not in a terminal state.
  // We use find() because we only want to show one at a time.
  const activeJob = useMemo(() => {
    return jobs.find(j => j.state === 'active' || j.state === 'waiting');
  }, [jobs]);

  // If there's no active or waiting job, render nothing.
  if (!activeJob) {
    return null;
  }

  const progress = typeof activeJob.progress === 'number' 
    ? Math.max(0, Math.min(100, activeJob.progress)) 
    : null;
  
  const statusText = activeJob.state === 'waiting' ? 'Queued' : `Active (${progress ?? 0}%)`;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 w-full max-w-sm p-4 bg-gray-800 border border-blue-500/50 rounded-lg shadow-2xl animate-pulse-border"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-blue-400" />
          Analysis in Progress
        </h3>
        <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-1 rounded-md font-medium">
          {statusText}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-white font-bold truncate" title={activeJob.label}>
          {activeJob.label}
        </p>
        <p className="text-sm text-gray-400 font-mono" title={activeJob.id}>
          Job ID: {activeJob.id}
        </p>
      </div>

      {progress !== null && (
        <div className="mt-3">
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalJobStatusToast;