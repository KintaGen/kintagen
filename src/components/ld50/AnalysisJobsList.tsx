import React from 'react';
import { TrashIcon } from '@heroicons/react/24/solid';
import { JobListItem } from './JobListItem';

// Assuming types are shared
interface DisplayJob { id: string; label: string; state: 'completed' | 'failed' | 'processing' | 'logged'; failedReason?: string; returnvalue?: any; logData?: any; }

interface AnalysisJobsListProps {
  jobs: DisplayJob[];
  onClearJobs: () => void;
  onViewResults: (job: DisplayJob) => void;
  onViewLogDetails: (job: DisplayJob) => void;
}

export const AnalysisJobsList: React.FC<AnalysisJobsListProps> = ({ jobs, onClearJobs, onViewResults, onViewLogDetails }) => {
  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-white">Analysis History & Jobs</h3>
        <button onClick={onClearJobs} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center gap-1" title="Clear all local jobs for this project"><TrashIcon className="h-4 w-4" /> Clear Local Jobs</button>
      </div>
      <ul className="space-y-2">
        {jobs.length === 0 && <li className="text-sm text-gray-500">No analysis history for this project.</li>}
        {jobs.map(job => (
          <JobListItem
            key={job.id}
            job={job}
            onViewResults={onViewResults}
            onViewLogDetails={onViewLogDetails}
          />
        ))}
      </ul>
    </div>
  );
};