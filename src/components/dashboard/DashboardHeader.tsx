import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/solid';

interface DashboardHeaderProps {
  loading: boolean;
  error: string | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ loading, error }) => (
  <>
    <h1 className="text-3xl font-bold mb-6">Network Cortex Overview</h1>
    {loading && (
      <div className="flex items-center gap-2 text-gray-400 mb-6">
        <ArrowPathIcon className="h-5 w-5 animate-spin" />
        Loading network data...
      </div>
    )}
    {error && <p className="text-red-400 mb-6">Error: {error}</p>}
  </>
);

export default DashboardHeader;