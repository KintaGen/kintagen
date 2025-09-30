import React, { useState, useEffect, useMemo } from 'react';
import { BeakerIcon, ArrowPathIcon, CubeTransparentIcon, SparklesIcon, WalletIcon, CheckBadgeIcon } from '@heroicons/react/24/solid';
import ProjectDetail from '../components/ProjectDetail';
import {
  useFlowCurrentUser,
  useFlowConfig,
  TransactionButton,
  TransactionDialog,
} from '@onflow/react-sdk';

import { useOwnedNftProjects } from '../flow/kintagen-nft'; 
import { getMintNftTransaction } from '../flow/cadence'; 
import { useIonicStorage } from '../hooks/useIonicStorage';


interface Project {
  id: string;
  name: string;
  description: string;
  nft_id: string;
  story?: any[];
}

const ProjectsPage: React.FC = () => {
  const { projects, isLoading: isLoadingProjects, error: projectsError,refetchProjects } = useOwnedNftProjects();

  const [newName, setNewName] = useIonicStorage<string>('form_project_name', '');
  const [newDescription, setNewDescription] = useIonicStorage<string>('form_project_desc', '');
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const flowConfig = useFlowConfig();
  const { user, authenticate } = useFlowCurrentUser();

  const flowscanURL = (nftId: string) => {
    const contractAddr = flowConfig.contracts?.["KintaGenNFT"]?.address;
    const network = flowConfig.flowNetwork;
    if (network === 'testnet' && contractAddr) {
      return `https://testnet.flowscan.org/nft/A.${contractAddr.replace("0x", "")}.KintaGenNFT/${nftId}`;
    }
    return `javascript:alert('This would link to a block explorer for NFT #${nftId}.')`; 
  };
  
  const mintTransaction = useMemo(() => {
    if (!user?.loggedIn || !newName) return null;

    const addresses = {
      NonFungibleToken: flowConfig.addresses["NonFungibleToken"],
      KintaGenNFT: flowConfig.addresses["KintaGenNFT"],
      ViewResolver: flowConfig.addresses["ViewResolver"],
    };

    if (!addresses.NonFungibleToken || !addresses.KintaGenNFT) {
        // We set a form error which will be displayed, rather than just returning null.
        setFormError("Contract addresses are not configured for the current network.");
        return null;
    }
    
    const cadence = getMintNftTransaction(addresses);
    
    return {
        cadence,
        args: (arg, t) => [
            arg(newName, t.String),
            arg(newDescription || `Project created by agent: ${user.addr}`, t.String),
            arg(`initial-cid-for-${newName.replace(/\s+/g, '-')}`, t.String),
        ],
        limit: 9999
    };
  }, [newName, newDescription, user, flowConfig]);

  return (
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-8">Research Projects</h1>

        {/* Form Section */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-10">
          <h2 className="text-xl font-semibold mb-4">Create & Mint New Project</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-1">Project Name</label>
              <input id="projectName" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., E. coli Antibiotic Resistance" className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none" required />
            </div>
            <div>
              <label htmlFor="projectDesc" className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
              <textarea id="projectDesc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} placeholder="A brief summary of the research goals." className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none" />
            </div>
            {formError && <p className="text-red-400 text-sm">{formError}</p>}
            
            {!user?.loggedIn ? (
                <button onClick={authenticate} className="flex items-center justify-center bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500">
                    <WalletIcon className="h-5 w-5 mr-2" />
                    <span>Connect Wallet to Create</span>
                </button>
            ) : (
                <TransactionButton
                    transaction={mintTransaction}
                    className="flex items-center justify-center bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-wait"
                    mutation={{
                        onSuccess: (txId) => {
                            setDialogTxId(txId);
                            setIsDialogOpen(true);
                            setNewName('');
                            setNewDescription('');
                        },
                        onError: (error) => {
                            if (error.message.includes("User rejected")) {
                                console.log("User rejected the transaction.");
                            } else {
                                setFormError(`Transaction failed: ${error.message}`);
                            }
                        }
                    }}
                >
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    <span>Create & Mint Project</span>
                </TransactionButton>
            )}
          </div>
        </div>
        
        {/* Existing Projects Section */}
        {user?.loggedIn && 
          <div>
          <h2 className="text-xl font-semibold mb-4">Your On-Chain Projects</h2>
          {isLoadingProjects && <p className="text-gray-400">Loading your projects from the blockchain...</p>}
          {projectsError && <p className="text-red-400 p-4 bg-red-900/50 rounded-lg mb-4">Error loading projects: {projectsError.message}</p>}
          
          {(!isLoadingProjects && projects.length === 0) && (
            <p className="text-gray-500">You do not own any on-chain projects yet. Use the form above to mint your first one!</p>
          )}

          <ul className="space-y-4">
            {projects.map((project) => (
              <li key={project.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-200 hover:bg-gray-800 hover:border-blue-500 cursor-pointer" onClick={() => setSelectedProject(project)}>
                <div className="flex-grow">
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <BeakerIcon className="h-5 w-5 mr-2 text-cyan-400" />
                    {project.name}
                  </h3>
                  <p className="text-gray-400 mt-1 text-sm">{project.description}</p>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto flex flex-col items-end gap-2">
                  <div className="flex items-center text-xs bg-green-800/50 text-green-300 px-2 py-1 rounded-full font-semibold">
                    <CheckBadgeIcon className="h-4 w-4 mr-1.5" />
                    On-Chain Asset
                  </div>
                  <a href={flowscanURL(project.nft_id)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center justify-end font-mono bg-purple-900/50 text-purple-300 px-3 py-1.5 rounded-md text-sm hover:underline">
                    <CubeTransparentIcon className="h-5 w-5 mr-2" />
                    <span>Block Explorer LOG: {project.nft_id}</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
        }
      </div>
      
      {selectedProject && <ProjectDetail project={selectedProject} onClose={() => setSelectedProject(null)} />}

      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        txId={dialogTxId || undefined}
        onSuccess={() => {
            refetchProjects();
            console.log("Mint transaction successful! The project list will refresh automatically.")
          }
        }
        pendingTitle="Minting Your Project NFT"
        pendingDescription="Please wait while your new project is being created on the Flow blockchain."
        successTitle="Project Minted!"
        successDescription="Your new project NFT has been created and will appear in your list shortly."
        closeOnSuccess={false}
      />
    </>
  );
};

export default ProjectsPage;