// src/components/home/LatestMintsSection.tsx
import React from 'react';
import { CubeIcon, PhotoIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import { useLatestNfts } from '../../flow/kintagen-nft';
import { useFlowConfig } from '@onflow/react-sdk';
import { Link } from 'react-router-dom';

// This type now includes the thumbnail's IPFS CID
interface LatestNftInfo {
  id: string;
  name: string;
  description: string;
  owner: string;
  thumbnailCid: string; // Added field
}

// A dedicated component for the NFT card for better organization
const NftCard: React.FC<{ nft: LatestNftInfo }> = ({ nft }) => {
  const flowConfig = useFlowConfig();

  // Helper to build a full IPFS URL from a CID
  const constructIpfsUrl = (cid: string) => {
    if (!cid) return null;
    return `https://ipfs.io/ipfs/${cid}`;
  };

  const imageUrl = constructIpfsUrl(nft.thumbnailCid);

  // Helper to generate the correct Flowscan link
  const flowscanURL = (nftId: string) => {
    const contractAddr = flowConfig.addresses["KintaGenNFT"];
    const network = flowConfig.flowNetwork;
    if (network === 'testnet' && contractAddr) {
      return `https://testnet.flowscan.io/nft/A.${contractAddr.replace("0x", "")}.PublicKintaGenNFTv6.NFT/token/A.${contractAddr.replace("0x", "")}.PublicKintaGenNFTv6.NFT-${nftId}`;
    }
    return `#`; 
  };

  return (
    <Link
      to={`/logbook/${nft.owner}/${nft.id}`}
      className="block bg-gray-800/50 rounded-lg border border-gray-700 group relative overflow-hidden
                 transition-all duration-300 ease-in-out hover:border-purple-500 hover:scale-[1.03] hover:bg-gray-800"
    >
      <div className="aspect-video w-full bg-gray-900 flex items-center justify-center">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={nft.name} 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
          />
        ) : (
          <PhotoIcon className="h-12 w-12 text-gray-600" />
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <CubeIcon className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <h3 className="font-semibold text-white" title={nft.name}>
            {nft.name}
          </h3>
        </div>
        
        <p className="text-sm text-gray-400 mb-3 h-10 overflow-hidden" title={nft.description}>
          {nft.description || "No description provided."}
        </p>

        <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">
          <p>
            <span className="font-medium text-gray-400">Owner:</span> {nft.owner.substring(0, 6)}...{nft.owner.substring(nft.owner.length - 4)}
          </p>
        </div>
      </div>

      <ArrowTopRightOnSquareIcon 
        className="h-5 w-5 text-white/70 absolute top-3 right-3
                   transition-opacity duration-300 opacity-0 group-hover:opacity-100" 
      />
    </Link>
  );
};

// Main section component remains the orchestrator
const LatestMintsSection: React.FC = () => {
  const { latestNfts, isLoading, error } = useLatestNfts();
  console.log(latestNfts)
  console.log(error)
  const renderSkeletons = () => (
    Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse overflow-hidden">
        <div className="aspect-video w-full bg-gray-700"></div>
        <div className="p-4">
          <div className="h-5 bg-gray-700 rounded w-3/4 mb-3"></div>
          <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-full mb-4"></div>
          <div className="h-3 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    ))
  );

  return (
    <div className="py-12">
      <h2 className="text-2xl font-bold text-center mb-8">Latest On-Chain Activity</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isLoading && renderSkeletons()}
        
        {!isLoading && error && (
          <div className="md:col-span-3 text-center text-red-400 bg-red-900/50 p-4 rounded-lg">
            {error.message}
          </div>
        )}

        {!isLoading && !error && latestNfts?.length === 0 && (
           <div className="md:col-span-3 text-center text-gray-400 bg-gray-800/50 p-6 rounded-lg">
            No recent minting activity found. Be the first to mint a project!
          </div>
        )}

        {!isLoading && !error && latestNfts?.map((nft: LatestNftInfo) => (
          <NftCard key={nft.id} nft={nft} />
        ))}
      </div>
    </div>
  );
};

export default LatestMintsSection;