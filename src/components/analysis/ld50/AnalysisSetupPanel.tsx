import React from 'react';
import { BeakerIcon, ChartBarIcon,ClipboardDocumentListIcon,ArrowPathIcon } from '@heroicons/react/24/solid';
import { DataInput } from './DataInput'; 

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
  // New props for data handling and loading state
  isAnalysisRunning: boolean;
  onDataValidated: (csvString: string) => void;
  onDataCleared: () => void;
  validatedCsvData: string | null
}

export const AnalysisSetupPanel: React.FC<AnalysisSetupPanelProps> = ({
  projects,
  selectedProjectId,
  onProjectChange,
  onRunAnalysis,
  isLoadingProjects,
  projectsError,
  isWebRReady,
  webRInitMessage,
  // Destructure new props
  isAnalysisRunning,
  onDataValidated,
  onDataCleared,
  validatedCsvData
}) => {
  const isDemoMode = !selectedProjectId;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 space-y-6">
      {/* --- Section 1: Project Selection (No changes here) --- */}
      <div>
        <label htmlFor="project-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
          <BeakerIcon className="h-5 w-5 inline mr-2"/>
          Project
        </label>
        <select 
          id="project-select" 
          value={selectedProjectId} 
          onChange={(e) => onProjectChange(e.target.value)} 
          className="w-full bg-gray-700 border border-gray-600 rounded-md py-2.5 px-3 text-white focus:ring-2 focus:ring-blue-500" 
          disabled={isLoadingProjects || isAnalysisRunning}
        >
          <option value="">-- Run in Demo Mode --</option> 
          {projects.map(p => <option key={p.id} value={p.id}>{p.name} (NFT #{p.nft_id})</option>)}
        </select>
        {isLoadingProjects && <p className="text-xs text-gray-400 mt-1">Loading projects...</p>}
        {projectsError && <p className="text-xs text-red-400 mt-1">Error: {projectsError.message}</p>}
        {isDemoMode && (
          <div className="mt-3 p-3 bg-blue-900/50 border border-blue-700 rounded-lg text-sm text-blue-200">
            <p><strong>You are in Demo Mode.</strong> Analysis results will be temporary and cannot be logged to the blockchain.</p>
          </div>
        )}
      </div>

      {/* --- Section 2: NEW Data Input Section --- */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
            <ClipboardDocumentListIcon className="h-5 w-5 inline mr-2"/>
            Analysis Data
        </label>
        <DataInput
            onDataValidated={onDataValidated}
            onDataCleared={onDataCleared}
        />
      </div>

      {/* --- Section 3: Action Bar (Button updated) --- */}
      <div className="pt-4 border-t border-gray-700/50 flex flex-col sm:flex-row justify-end items-center gap-4">
        <span className={`text-sm font-mono px-2 py-1 rounded ${isWebRReady ? 'bg-green-800/50 text-green-300' : 'bg-yellow-800/50 text-yellow-300'}`}>
            {webRInitMessage}
        </span>
        <button 
            onClick={onRunAnalysis} 
            // Update disabled logic to include isAnalysisRunning
            disabled={!isWebRReady || isAnalysisRunning || !validatedCsvData} 
            className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
            {isAnalysisRunning ? (
                <>
                    <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                    Running...
                </>
            ) : (
                <>
                    <ChartBarIcon className="h-5 w-5 mr-2" />
                    Run Analysis
                </>
            )}
        </button>
      </div>
    </div>
  );
};