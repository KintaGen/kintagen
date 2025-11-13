// src/components/ld50/AnalysisJobsList.tsx

import React from 'react';
import { TrashIcon } from '@heroicons/react/24/solid';
import { JobListItem } from './JobListItem';
import { type DisplayJob } from '../../types';

// --- UPDATE THE PROPS INTERFACE ---
interface AnalysisJobsListProps {
  jobs: DisplayJob[];
  onClearJobs: () => void;
  // We'll rename this prop for clarity, as it now does both viewing and logging.
  onViewAndLogResults: (job: DisplayJob) => void;
  // NEW PROP: To indicate which job is currently in the logging process.
  jobIdBeingLogged: string | null; 
}

export const AnalysisJobsList: React.FC<AnalysisJobsListProps> = ({ 
    jobs, 
    onClearJobs, 
    onViewAndLogResults, 
    jobIdBeingLogged 
}) => {
  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-white">Analysis History & Jobs</h3>
        <button 
            onClick={onClearJobs} 
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center gap-1" 
            title="Clear all local jobs for this project">
            <TrashIcon className="h-4 w-4" /> Clear Local Jobs
        </button>
      </div>
      <ul className="space-y-2">
        {jobs.length === 0 && (
            <li className="text-sm text-gray-500 bg-gray-800/50 p-4 rounded-md text-center">
                No analysis history for this project.
            </li>
        )}
        {jobs.map(job => (
          <JobListItem
            key={job.id}
            job={job}
            // Pass the single handler down
            onViewAndLogResults={onViewAndLogResults}
            // Pass the logging status down
            isBeingLogged={job.id === jobIdBeingLogged}
          />
        ))}
      </ul>
    </div>
  );
};