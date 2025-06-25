// src/components/ProjectDetail.tsx
import React, { useState, useEffect } from 'react';
import { ArrowPathIcon, DocumentTextIcon, XMarkIcon, BeakerIcon } from '@heroicons/react/24/solid';

// --- INTERFACE DEFINITIONS ---
interface Project {
  id: number;
  name: string;
  nft_id: number | null;
}

interface DataItem {
  cid: string;
  title: string;
  created_at: string;
}

interface StoryStep {
  stepNumber: number;
  agent: string;
  action: string;
  resultCID: string;
  timestamp: string;
}

interface ProjectDetailProps {
  project: Project;
  onClose: () => void; // A function to close the detail view, passed from the parent
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onClose }) => {
  // --- STATE ---
  const [papers, setPapers] = useState<DataItem[]>([]);
  const [experiments, setExperiments] = useState<DataItem[]>([]);
  const [analyses, setAnalyses] = useState<DataItem[]>([]); // State for the new category
  const [story, setStory] = useState<StoryStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- DATA FETCHING EFFECT ---
  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch all data in parallel for efficiency
        const [papersRes, experimentsRes, analysesRes, storyRes] = await Promise.all([
          fetch(`http://localhost:3001/api/data/paper?projectId=${project.id}`),
          fetch(`http://localhost:3001/api/data/experiment?projectId=${project.id}`),
          fetch(`http://localhost:3001/api/data/analysis?projectId=${project.id}`),
          project.nft_id ? fetch(`http://localhost:3001/api/nfts/${project.nft_id}/story`) : Promise.resolve(null)
        ]);
        
        // Check responses and parse JSON
        if (!papersRes.ok) throw new Error('Failed to fetch papers.');
        const papersData = await papersRes.json();
        
        if (!experimentsRes.ok) throw new Error('Failed to fetch experiments.');
        const experimentsData = await experimentsRes.json();

        if (!analysesRes.ok) throw new Error('Failed to fetch analyses.');
        const analysesData = await analysesRes.json();
        
        setPapers(papersData.data || []);
        setExperiments(experimentsData.data || []);
        setAnalyses(analysesData.data || []);

        if (storyRes && storyRes.ok) {
          const storyData = await storyRes.json();
          setStory(storyData || []);
        }

      } catch (err: any) {
        setError("Failed to load project details. Please try again.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDetails();
  }, [project.id, project.nft_id]);

  // --- RENDER ---
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-start pt-16 md:pt-24 p-4"
      onClick={onClose}
    >
      <div 
        className="relative bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold flex items-center">
            <BeakerIcon className="h-7 w-7 mr-3 text-cyan-400"/>
            {project.name}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white">
            <XMarkIcon className="h-6 w-6"/>
          </button>
        </div>
        
        {/* Modal Body */}
        {isLoading && (
          <div className="flex-grow flex justify-center items-center p-10">
            <ArrowPathIcon className="h-10 w-10 text-blue-400 animate-spin"/>
          </div>
        )}

        {error && <div className="p-10 text-center text-red-400">{error}</div>}
        
        {!isLoading && !error && (
          <div className="flex-grow overflow-y-auto p-6 space-y-8">
            {/* Project Data Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-white">Project Data</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h4 className="font-bold mb-2">Papers ({papers.length})</h4>
                  <ul className="text-sm space-y-2 text-gray-300 max-h-48 overflow-y-auto pr-2">
                    {papers.length > 0 ? papers.map(p => (
                        <li key={p.cid} className="flex items-start gap-2 truncate" title={p.title}>
                            <DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500"/>
                            <span>{p.title}</span>
                        </li>
                    )) : <li className="text-gray-500">No papers found.</li>}
                  </ul>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h4 className="font-bold mb-2">Experiment Data ({experiments.length})</h4>
                  <ul className="text-sm space-y-2 text-gray-300 max-h-48 overflow-y-auto pr-2">
                     {experiments.length > 0 ? experiments.map(e => (
                         <li key={e.cid} className="flex items-start gap-2 truncate" title={e.title}>
                            <DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500"/>
                            <span>{e.title}</span>
                         </li>
                     )) : <li className="text-gray-500">No experiments found.</li>}
                  </ul>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h4 className="font-bold mb-2">Analyses ({analyses.length})</h4>
                  <ul className="text-sm space-y-2 text-gray-300 max-h-48 overflow-y-auto pr-2">
                     {analyses.length > 0 ? analyses.map(a => (
                         <li key={a.cid} className="flex items-start gap-2 truncate" title={a.title}>
                            <DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500"/>
                            <span>{a.title}</span>
                         </li>
                     )) : <li className="text-gray-500">No analyses found.</li>}
                  </ul>
                </div>
              </div>
            </div>

            {/* On-Chain Log Section - Only shows if the project is minted */}
            {project.nft_id && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-white">On-Chain Audit Log (NFT #{project.nft_id})</h3>
                <div className="bg-gray-900/50 p-4 rounded-lg max-h-64 overflow-y-auto">
                  {story.length > 0 ? (
                    <ul className="space-y-4">
                      {story.map(step => (
                        <li key={step.stepNumber} className="text-sm border-l-2 border-purple-500 pl-4">
                          <p className="font-bold text-white">{step.action}</p>
                          <p className="text-gray-400">Agent: {step.agent}</p>
                          <p className="text-xs text-gray-500 font-mono truncate" title={step.resultCID}>Result CID: {step.resultCID}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No log entries found for this NFT.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;