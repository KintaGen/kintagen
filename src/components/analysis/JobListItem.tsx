// src/components/ld50/JobListItem.tsx

import React from 'react';
import { ClockIcon, CheckCircleIcon, XCircleIcon, DocumentTextIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { type DisplayJob } from '../../types';

interface JobListItemProps {
  job: DisplayJob & { projectId: string };
  onViewAndLogResults: (job: DisplayJob) => void;
  isBeingLogged: boolean;
}

// --- CHANGE #2: Add a configuration for the 'waiting' state ---
const stateConfig = {
    logged: { icon: CheckCircleIcon, color: 'text-green-400', label: 'Logged On-Chain' },
    completed: { icon: CheckCircleIcon, color: 'text-blue-400', label: 'Completed' },
    processing: { icon: ArrowPathIcon, color: 'text-yellow-400 animate-spin', label: 'Processing' }, // Added a label for consistency
    failed: { icon: XCircleIcon, color: 'text-red-400', label: 'Failed' },
    waiting: { icon: ClockIcon, color: 'text-gray-400', label: 'Queued' }, // The new state config
};

export const JobListItem: React.FC<JobListItemProps> = ({ job, onViewAndLogResults, isBeingLogged }) => {
  // This line will now work for all possible job states, including 'waiting'.
  const { icon: Icon, color, label } = stateConfig[job.state];

  const renderActionButton = () => {
    if (isBeingLogged) {
        return (
            <button className="text-sm px-3 py-1 rounded bg-purple-600 text-white flex items-center justify-center w-36" disabled>
                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                Logging...
            </button>
        );
    }

    switch (job.state) {
        case 'logged':
            return (
                <button 
                    onClick={() => onViewAndLogResults(job)}
                    className="text-sm px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white flex items-center justify-center w-36"
                >
                    <DocumentTextIcon className="h-4 w-4 mr-2"/>
                    View Log
                </button>
            );
        case 'completed':
            if (job.projectId === 'demo-project') {
                return (
                    <button 
                        onClick={() => onViewAndLogResults(job)}
                        className="text-sm px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white flex items-center justify-center w-36"
                    >
                        View Results
                    </button>
                );
            }
            return (
                <button 
                    onClick={() => onViewAndLogResults(job)}
                    className="text-sm px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center w-36"
                >
                    View & Log Results
                </button>
            );
        case 'failed':
            return (
                <div className="text-sm text-gray-500 truncate w-36" title={job.failedReason}>
                    {job.failedReason}
                </div>
            );
        default:
            // This now correctly handles 'waiting' and 'processing' states
            return <div className="w-36"></div>; // Placeholder
    }
  };

  return (
    <li className="bg-gray-800/70 p-3 rounded-lg flex items-center justify-between space-x-4">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <Icon className={`h-6 w-6 flex-shrink-0 ${color}`} />
        <div className="min-w-0">
          <p className="text-white font-medium truncate">{job.label}</p>
          <p className={`text-xs text-opacity-80}`}>{label}</p>
        </div>
      </div>
      <div className="flex-shrink-0">
        {renderActionButton()}
      </div>
    </li>
  );
};