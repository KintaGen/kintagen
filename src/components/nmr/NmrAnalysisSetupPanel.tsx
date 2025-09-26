// components/nmr/NmrAnalysisSetupPanel.tsx
import React from 'react';
import { VarianDataInput } from './VarianDataInput';
import { DEMO_PROJECT_ID } from '../../pages/NMRAnalysisPage'; // We will create this page next

interface Project { id: string; name: string; }

interface NmrAnalysisSetupPanelProps {
    projects: Project[];
    selectedProjectId: string;
    onProjectChange: (id: string) => void;
    onRunAnalysis: () => void;
    isLoadingProjects: boolean;
    projectsError: Error | null;
    isAnalysisRunning: boolean;
    onFileSelected: (file: File | null) => void;
    selectedFileName: string;
}

export const NmrAnalysisSetupPanel: React.FC<NmrAnalysisSetupPanelProps> = ({
  projects,
  selectedProjectId,
  onProjectChange,
  onRunAnalysis,
  isLoadingProjects,
  projectsError,
  isAnalysisRunning,
  onFileSelected,
  selectedFileName
}) => {
    const canRunAnalysis = !!selectedFileName;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Project Selection Panel */}
      <div className="bg-gray-700/50 p-4 rounded-lg">
        <h4 className="text-gray-200 font-semibold mb-3">1. Select Project</h4>
        <select
          value={selectedProjectId}
          onChange={(e) => onProjectChange(e.target.value)}
          className="w-full p-2 bg-gray-900/70 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value={DEMO_PROJECT_ID}>Demo Project (Logging Disabled)</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {isLoadingProjects && <p className="text-sm text-gray-400 mt-2">Loading projects...</p>}
        {projectsError && <p className="text-sm text-red-400 mt-2">Error loading projects.</p>}
      </div>

      {/* Data Input Panel */}
      <VarianDataInput 
        onFileSelected={onFileSelected}
        selectedFileName={selectedFileName}
      />

      {/* Action Panel */}
      <div className="md:col-span-2 text-center">
        <button
          onClick={onRunAnalysis}
          disabled={!canRunAnalysis || isAnalysisRunning}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
        >
          {isAnalysisRunning ? 'Processing...' : 'Run NMR Analysis'}
        </button>
      </div>
    </div>
  );
};