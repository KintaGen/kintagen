import React from 'react';
import { Link } from 'react-router-dom';
import { XMarkIcon, ClockIcon, BeakerIcon, ArrowTopRightOnSquareIcon, BookOpenIcon } from '@heroicons/react/24/solid';

import { useNftStory } from '../flow/kintagen-nft';
import { useFlowCurrentUser } from '@onflow/react-sdk';

interface Project {
  id: string;
  name: string;
  description: string;
  nft_id: string;
}

interface ProjectDetailProps {
  project: Project;
  onClose: () => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onClose }) => {
  const { user } = useFlowCurrentUser();
  
  const { story, isLoading, error } = useNftStory({
    nftId: parseInt(project.nft_id, 10),
    ownerAddress: user?.addr,
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BeakerIcon className="h-6 w-6 text-cyan-400" />
            {project.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Body with Log History */}
        <div className="p-6 overflow-y-auto">
          {/* Conditionally render image when story data is available */}
          {story && story.length > 0 && (
            <div className="mb-6">
              <img
                src={`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${story[0].ipfsHash}`}
                alt={project.name}
                className="w-full h-auto max-h-60 object-cover rounded-lg shadow-md"
              />
            </div>
          )}
          
          <div className="flex justify-between items-start mb-6">
            <p className="text-gray-300 flex-1 pr-4">{project.description}</p>
            <Link
              to={`/logbook/${project.nft_id}`}
              className="flex-shrink-0 inline-flex items-center gap-2 bg-cyan-500 text-white px-3 py-1.5 rounded-md hover:bg-cyan-600 transition-colors text-sm font-semibold"
            >
              <BookOpenIcon className="h-4 w-4" />
              View Full Logbook
            </Link>
          </div>

          <h3 className="text-lg font-semibold text-white mb-4">On-Chain Log History</h3>
          
          {isLoading && <p className="text-gray-400">Loading log history...</p>}
          {error && <p className="text-red-400">Error fetching history: {error.message}</p>}
          
          {story && (
            <div className="space-y-4">
              {story.map((step, index) => (
                <div key={index} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <p className="font-semibold text-white">{step.title}</p>
                  <p className="text-sm text-gray-400 mt-2">Agent: <span className="font-mono text-xs bg-gray-700 px-1.5 py-0.5 rounded">{step.agent}</span></p>
                  <p className="text-sm text-gray-400 mt-1">
                    Result CID: 
                    <a 
                      href={`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${step.ipfsHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-cyan-400 hover:underline ml-2 inline-flex items-center gap-1"
                    >
                      {step.ipfsHash}
                      <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                    </a>
                  </p>
                  <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                    <ClockIcon className="h-3 w-3" />
                    {new Date(parseFloat(step.timestamp) * 1000).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;