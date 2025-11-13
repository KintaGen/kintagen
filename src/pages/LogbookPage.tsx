import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNftStory } from '../flow/kintagen-nft';
// 1. Import the necessary hook and icon
import { useFlowConfig } from '@onflow/react-sdk';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle'; 
import { ArrowLeftIcon, ClockIcon, BeakerIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import { LogbookAnalysisEntry } from '../components/LogbookAnalysisEntry'; // Import our new wrapper

const LogbookPage = () => {
  const { ownerAddress, nftId } = useParams();
  const numericNftId = nftId ? parseInt(nftId, 10) : undefined;

  // 2. Get the flow configuration which contains network and contract addresses
  const flowConfig = useFlowConfig();

  const { projectName, story, isLoading, error } = useNftStory({
    nftId: numericNftId,
    ownerAddress: ownerAddress,
  });

  // Update page title when projectName is available
  const pageTitle = projectName ? `${projectName} - KintaGen` : 'Logbook - KintaGen';
  usePageTitle(pageTitle);

  // 3. Create a robust function to generate the explorer URL
  const flowscanURL = (nftId: string) => {
    const contractAddr = flowConfig.addresses["KintaGenNFT"];
    const network = flowConfig.flowNetwork;
    if (network === 'testnet' && contractAddr) {
      return `https://testnet.flowscan.io/nft/A.${contractAddr.replace("0x", "")}.PublicKintaGenNFTv6.NFT/token/A.${contractAddr.replace("0x", "")}.PublicKintaGenNFTv6.NFT-${nftId}`;
    }
    return `#`; 
  };
  

  // Render loading state
  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Loading Logbook...</title>
        </Helmet>
        <div className="text-white text-center p-10">Loading NFT Logbook...</div>
      </>
    );
  }

  // Render error state
  if (error) {
    return (
       <>
        <Helmet>
          <title>Error</title>
        </Helmet>
        <div className="text-red-400 text-center p-10">Error fetching NFT data: {error.message}</div>
      </>
    );
  }

  // Render empty state
  if (!story || story.length === 0) {
    return (
      <>
        <Helmet>
          <title>Logbook Not Found</title>
        </Helmet>
        <div className="text-gray-400 text-center p-10">No log history found for this NFT.</div>
      </>
    );
  }
  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <Helmet>
        <title>{`${projectName || 'Logbook'} - KintaGen`}</title>
        <meta name="description" content={`On-chain logbook for ${projectName || 'this project'}. View the complete history of data registrations, analyses, and results with verifiable timestamps.`} />
        <meta property="og:title" content={`${projectName || 'Logbook'} - KintaGen`} />
        <meta property="og:description" content={`On-chain logbook showing the complete research history for ${projectName || 'this project'}.`} />
      </Helmet>
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
            if (index === 0) {
              return (
                <div key={index} className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                  <img
                    src={`https://ipfs.io/ipfs/${step.ipfsHash}`}
                    alt={step.title}
                    className="w-full h-auto max-h-80 object-cover"
                  />
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <h1 className="text-xl font-bold flex items-center gap-3">
                        <BeakerIcon className="h-6 w-6 text-cyan-400" />
                        {projectName}
                      </h1>
                      
                      <a 
                        href={flowscanURL(nftId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                        title="View on Flowscan"
                      >
                        View on Explorer
                        <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                      </a>
                    </div>

                    <p className="text-gray-300 mt-2 text-sm">{step.description}</p>
                    <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                      <ClockIcon className="h-3 w-3" />
                      {new Date(parseFloat(step.timestamp) * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            }

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