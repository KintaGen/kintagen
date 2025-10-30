import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNftStory } from '../flow/kintagen-nft';
import { ArrowLeftIcon, ClockIcon, BeakerIcon } from '@heroicons/react/24/solid';
import { LogbookAnalysisEntry } from '../components/LogbookAnalysisEntry'; // Import our new wrapper

const LogbookPage = () => {
  const { ownerAddress, nftId } = useParams();
  const numericNftId = nftId ? parseInt(nftId, 10) : undefined;

  const { story, isLoading, error } = useNftStory({
    nftId: numericNftId,
    ownerAddress: ownerAddress,
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
  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/projects" className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to All Projects
          </Link>
        </div>

        <h3 className="text-2xl font-semibold text-white mb-4">On-Chain Logbook</h3>
        
        <div className="space-y-6">
          {story.map((step, index) => {
            // Case 1: The first entry is always the project registration card.
            if (index === 0) {
              return (
                <div key={index} className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                  <img
                    src={`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${step.ipfsHash}`}
                    alt={step.title}
                    className="w-full h-auto max-h-80 object-cover"
                  />
                  <div className="p-6">
                    <h1 className="text-xl font-bold flex items-center gap-3">
                      <BeakerIcon className="h-6 w-6 text-cyan-400" />
                      {step.name}
                    </h1>
                    <p className="text-gray-300 mt-2 text-sm">{step.description}</p>
                    <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                      <ClockIcon className="h-3 w-3" />
                      {new Date(parseFloat(step.timestamp) * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            }

            // Case 2: All other entries are analyses. Use our smart wrapper component.
            return (
              <LogbookAnalysisEntry key={index} step={step} />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LogbookPage;