import React from 'react';
import { Link } from 'react-router-dom';
import { useFlowConfig } from '@onflow/react-sdk';
import { PhotoIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import type { NftProject } from '../../types'; 

interface ProjectCardProps {
  nft: NftProject;
  onClick: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ nft, onClick }) => {
  const flowConfig = useFlowConfig();
  const imageUrl = nft.thumbnailCid ? `https://ipfs.io/ipfs/${nft.thumbnailCid}` : null;

  const flowscanURL = (nftId: string) => {
    const contractAddr = flowConfig.addresses["KintaGenNFT"];
    const network = flowConfig.flowNetwork;
    if (network === 'testnet' && contractAddr) {
      return `https://testnet.flowscan.io/nft/A.${contractAddr.replace("0x", "")}.PublicKintaGenNFTv6.NFT/token/A.${contractAddr.replace("0x", "")}.PublicKintaGenNFTv6.NFT-${nftId}`;
    }
    return `#`;
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 group relative transition-all duration-300 ease-in-out hover:border-purple-500 hover:scale-[1.03] hover:bg-gray-800">
      <div onClick={onClick} className="cursor-pointer">
        <div className="aspect-video w-full bg-gray-900 flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={nft.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
          ) : (
            <PhotoIcon className="h-12 w-12 text-gray-600" />
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-white truncate" title={nft.name}>{nft.name}</h3>
          <p className="text-sm text-gray-400 mt-1 h-10 overflow-hidden">{nft.description || "No description provided."}</p>
        </div>
      </div>
      <div className="border-t border-gray-600 p-2 flex justify-between items-center bg-gray-800/40">
        <Link to={`/logbook/${nft.owner}/${nft.id}`} className="text-xs text-purple-300 hover:text-purple-200 font-semibold transition-colors">
          View Logbook
        </Link>
        <a href={flowscanURL(nft.id)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors" title="View on Flowscan">
          ID: {nft.id}
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
};

export default ProjectCard;