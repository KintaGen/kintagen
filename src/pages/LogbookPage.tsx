import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import { useNftStory } from '../flow/kintagen-nft';
import { ArrowLeftIcon, ClockIcon, BeakerIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';

const LogbookPage = () => {
  const { nftId } = useParams();
  const { user } = useFlowCurrentUser();

  const numericNftId = nftId ? parseInt(nftId, 10) : undefined;

  const { story, isLoading, error } = useNftStory({
    nftId: numericNftId,
    ownerAddress: user?.addr,
  });

  if (isLoading) {
    return <div className="text-white text-center p-10">Loading NFT Logbook...</div>;
  }

  if (error) {
    return <div className="text-red-400 text-center p-10">Error fetching NFT data: {error.message}</div>;
  }

  if (!story || story.length === 0) {
    return <div className="text-gray-400 text-center p-10">No log history found for this NFT.</div>;
  }

  // The first step of the story contains the project's core info and image CID.
  const projectInfo = story[0];

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/projects" className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to All Projects
          </Link>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
          {/* NFT Image Display */}
          <img
            src={`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${projectInfo.ipfsHash}`}
            alt={projectInfo.title}
            className="w-full h-auto max-h-80 object-cover"
          />

          <div className="p-6 border-b border-gray-700">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <BeakerIcon className="h-7 w-7 text-cyan-400" />
              {projectInfo.title}
            </h1>
            <p className="text-gray-300 mt-2">{projectInfo.description}</p>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">On-Chain Log History</h3>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogbookPage;