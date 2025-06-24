// src/components/ProjectDetail.tsx
import React, { useState, useEffect } from 'react';
import { ArrowPathIcon, DocumentTextIcon, XMarkIcon, BeakerIcon } from '@heroicons/react/24/solid';

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
  onClose: () => void; // Function to close the detail view
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onClose }) => {
  const [papers, setPapers] = useState<DataItem[]>([]);
  const [experiments, setExperiments] = useState<DataItem[]>([]);
  const [story, setStory] = useState<StoryStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch all data in parallel
        const [papersRes, experimentsRes, storyRes] = await Promise.all([
          fetch(`http://localhost:3001/api/data/paper?projectId=${project.id}`),
          fetch(`http://localhost:3001/api/data/experiment?projectId=${project.id}`),
          project.nft_id ? fetch(`http://localhost:3001/api/nfts/${project.nft_id}/story`) : Promise.resolve(null)
        ]);
        
        const papersData = await papersRes.json();
        const experimentsData = await experimentsRes.json();
        
        setPapers(papersData.data || []);
        setExperiments(experimentsData.data || []);

        if (storyRes && storyRes.ok) {
          const storyData = await storyRes.json();
          setStory(storyData || []);
        }

      } catch (err: any) {
        setError("Failed to load project details.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDetails();
  }, [project.id, project.nft_id]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-center p-4">
      <div className="relative bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold flex items-center">
            <BeakerIcon className="h-7 w-7 mr-3 text-cyan-400"/>
            {project.name}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
            <XMarkIcon className="h-6 w-6"/>
          </button>
        </div>
        
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
              <h3 className="text-lg font-semibold mb-3">Project Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 p-3 rounded-lg">
                  <h4 className="font-bold mb-2">Papers ({papers.length})</h4>
                  <ul className="text-sm space-y-1 text-gray-300">
                    {papers.length > 0 ? papers.map(p => <li key={p.cid} className="truncate" title={p.title}>{p.title}</li>) : <li>No papers found.</li>}
                  </ul>
                </div>
                <div className="bg-gray-900/50 p-3 rounded-lg">
                  <h4 className="font-bold mb-2">Experiments ({experiments.length})</h4>
                  <ul className="text-sm space-y-1 text-gray-300">
                     {experiments.length > 0 ? experiments.map(e => <li key={e.cid} className="truncate" title={e.title}>{e.title}</li>) : <li>No experiments found.</li>}
                  </ul>
                </div>
              </div>
            </div>

            {/* On-Chain Log Section */}
            {project.nft_id && (
              <div>
                <h3 className="text-lg font-semibold mb-3">On-Chain Audit Log (NFT #{project.nft_id})</h3>
                <div className="bg-gray-900/50 p-3 rounded-lg">
                  {story.length > 0 ? (
                    <ul className="space-y-3">
                      {story.map(step => (
                        <li key={step.stepNumber} className="text-sm border-l-2 border-purple-500 pl-3">
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