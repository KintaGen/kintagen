import React from 'react';
import { BeakerIcon, ChartBarIcon } from '@heroicons/react/24/solid';

// Assuming types are shared
interface Project { id: string; name: string; nft_id: string; }

interface AnalysisSetupPanelProps {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  onRunAnalysis: () => void;
  isLoadingProjects: boolean;
  projectsError: Error | null;
  isWebRReady: boolean;
  webRInitMessage: string;
}

export const AnalysisSetupPanel: React.FC<AnalysisSetupPanelProps> = ({
  projects,
  selectedProjectId,
  onProjectChange,
  onRunAnalysis,
  isLoadingProjects,
  projectsError,
  isWebRReady,
  webRInitMessage
}) => {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 space-y-6">
      <div>
        <label htmlFor="project-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center"><BeakerIcon className="h-5 w-5 inline mr-2"/>Project</label>
        <select id="project-select" value={selectedProjectId} onChange={(e) => onProjectChange(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500" disabled={isLoadingProjects}>
          <option value="">-- Select a Project --</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name} (NFT #{p.nft_id})</option>)}
        </select>
        {isLoadingProjects && <p className="text-xs text-gray-400 mt-1">Loading projects from the blockchain...</p>}
        {projectsError && <p className="text-xs text-red-400 mt-1">Error: {projectsError.message}</p>}
      </div>
      <div className="pt-4 border-t border-gray-700/50 flex flex-col sm:flex-row justify-end items-center gap-4">
        <span className={`text-sm font-mono px-2 py-1 rounded ${isWebRReady ? 'bg-green-800/50 text-green-300' : 'bg-yellow-800/50 text-yellow-300'}`}>{webRInitMessage}</span>
        <button onClick={onRunAnalysis} disabled={!selectedProjectId || !isWebRReady} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed">
          <ChartBarIcon className="h-5 w-5 mr-2" /> Run Analysis
        </button>
      </div>
    </div>
  );
};