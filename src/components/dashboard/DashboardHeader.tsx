import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/solid';

interface DashboardHeaderProps {
  loading: boolean;
  error: string | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ loading, error }) => (
  <div className="mb-8">
    <h1 className="text-3xl font-extrabold gradient-text mb-1">Network Cortex Overview</h1>
    <p className="text-gray-500 text-sm">Your research network at a glance</p>
    {loading && (
      <div className="flex items-center gap-2 text-gray-400 mt-4 text-sm">
        <ArrowPathIcon className="h-4 w-4 animate-spin text-purple-400" />
        Loading network data...
      </div>
    )}
    {error && (
      <p className="text-red-400 mt-4 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2.5">
        Error: {error}
      </p>
    )}
  </div>
);

export default DashboardHeader;