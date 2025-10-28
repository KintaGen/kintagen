import React from 'react';
import { XMarkIcon, ClockIcon, BeakerIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';

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
  
  // This hook correctly fetches an array of objects with `title`, `agent`, `ipfsHash`, etc.
  const { story, isLoading, error } = useNftStory({
    // nftId expects a number, but project.nft_id is a string. We need to parse it.
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
          <p className="text-gray-300 mb-6">{project.description}</p>

          <h3 className="text-lg font-semibold text-white mb-4">On-Chain Log History</h3>
          
          {isLoading && <p className="text-gray-400">Loading log history...</p>}
          {error && <p className="text-red-400">Error fetching history: {error.message}</p>}
          
          {story && (
            <div className="space-y-4">
              {story.map((step, index) => (
                <div key={index} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  {/* FIX: The data from the contract has a 'title', not an 'action' */}
                  <p className="font-semibold text-white">{step.title}</p>
                  
                  <p className="text-sm text-gray-400 mt-2">Agent: <span className="font-mono text-xs bg-gray-700 px-1.5 py-0.5 rounded">{step.agent}</span></p>
                  
                  {/* FIX: The data from the contract has an 'ipfsHash', not a 'resultCID' */}
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
                    {/* The timestamp is a fixed-point number string, so parseFloat is correct */}
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