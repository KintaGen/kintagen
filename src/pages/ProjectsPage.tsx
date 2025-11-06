import React, { useState, useEffect } from 'react';
import { BeakerIcon, CubeTransparentIcon, SparklesIcon, WalletIcon, CheckBadgeIcon, PhotoIcon, ArrowUpOnSquareIcon, XCircleIcon } from '@heroicons/react/24/solid';
import ProjectDetail from '../components/ProjectDetail';
import {
  useFlowCurrentUser,
  useFlowConfig,
  useFlowMutate, 
  TransactionDialog,
} from '@onflow/react-sdk';

import { useOwnedNftProjects } from '../flow/kintagen-nft'; 
import { getMintNftTransaction } from '../flow/cadence'; 
import { useIonicStorage } from '../hooks/useIonicStorage';
import { useLighthouse } from '../hooks/useLighthouse';

interface Project {
  id: string;
  name: string;
  description: string;
  nft_id: string;
  story?: any[];
}

const ProjectsPage: React.FC = () => {
  const { projects, isLoading: isLoadingProjects, error: projectsError, refetchProjects } = useOwnedNftProjects();

  const [newName, setNewName] = useIonicStorage<string>('form_project_name', '');
  const [newDescription, setNewDescription] = useIonicStorage<string>('form_project_desc', '');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const flowConfig = useFlowConfig();
  const { user, authenticate } = useFlowCurrentUser();
  const { uploadFile, isLoading: isUploading, error: uploadError } = useLighthouse();
  
  const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const flowscanURL = (nftId: string) => {
    const contractAddr = flowConfig.addresses["KintaGenNFT"];
    const network = flowConfig.flowNetwork;
    if (network === 'testnet' && contractAddr) {
      return `https://testnet.flowscan.io/nft/A.${contractAddr.replace("0x", "")}.PublicKintaGenNFTv5.NFT/token/A.${contractAddr.replace("0x", "")}.PublicKintaGenNFTv5.NFT-${nftId}`;
    }
    return `#`; 
  };
  
  const handleCreateAndMint = async () => {
    setFormError(null);
    if (!newName || !newImageFile || !user?.addr) {
      setFormError("Project Name, Image, and a connected wallet are required.");
      return;
    }
  
    setIsMinting(true);
  
    try {
      const imageCid = await uploadFile(newImageFile);
      if (!imageCid) {
        throw new Error(uploadError || "Failed to upload image to IPFS.");
      }
  
      const addresses = {
        NonFungibleToken: flowConfig.addresses["NonFungibleToken"],
        KintaGenNFT: flowConfig.addresses["KintaGenNFT"],
        ViewResolver: flowConfig.addresses["ViewResolver"],
        MetadataViews: flowConfig.addresses["MetadataViews"],
      };
      const cadence = getMintNftTransaction(addresses);
      
      await executeTransaction({
        cadence,
        args: (arg, t) => [
          arg(newName, t.String),
          arg(newDescription.substring(0, 200), t.String),
          arg(imageCid, t.String),
          arg(user.addr, t.String),
          arg(`run-hash-${Date.now()}`, t.String)
        ],
        limit: 9999
      });
  
    } catch (error: any) {
      if (!error.message.includes("User rejected")) {
        setFormError(`Minting failed: ${error.message}`);
      }
      setIsMinting(false);
    } 
  };

  useEffect(() => {
    if (isTxSuccess && txId) {
      setDialogTxId(txId as string);
      setIsDialogOpen(true);
      setIsMinting(false); 
    }
    if (isTxError && txError) {
      const errorMessage = (txError as Error).message.includes("User rejected") 
        ? "Transaction cancelled by user." 
        : (txError as Error).message;
      setFormError(`Transaction failed: ${errorMessage}`);
      setIsMinting(false);
    }
  }, [isTxSuccess, isTxError, txId, txError]);


  const isButtonDisabled = !newName || !newImageFile || isMinting || isTxPending;
  const buttonText = (isMinting || isTxPending)
    ? (isUploading ? 'Uploading to IPFS...' : 'Waiting for transaction...') 
    : 'Create & Mint Project';

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
              <input id="projectName" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., E. coli Antibiotic Resistance" className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus-outline-none" required />
            </div>
            <div>
              <label htmlFor="projectDesc" className="block text-sm font-medium text-gray-300 mb-1">Full Description</label>
              <textarea id="projectDesc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={4} placeholder="A detailed summary of the research goals, methods, and expected outcomes." className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none" />
            </div>
            
            {/* Image Uploader */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Project Image</label>
              <div className="mt-2 flex items-center gap-x-3">
                {imagePreview ? (
                   <img src={imagePreview} alt="Preview" className="h-24 w-24 rounded-lg object-cover" />
                ) : (
                   <PhotoIcon className="h-24 w-24 text-gray-500" aria-hidden="true" />
                )}
                <div className="flex flex-col gap-2">
                  <label htmlFor="file-upload" className="cursor-pointer rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-600 flex items-center justify-center">
                    <ArrowUpOnSquareIcon className="h-5 w-5 mr-2" />
                    <span>Change Image</span>
                  </label>
                   <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/gif" onChange={handleImageChange} />
                  {imagePreview && (
                    <button type="button" onClick={() => { setNewImageFile(null); setImagePreview(null); }} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  )}
                </div>
              </div>
            </div>

            {formError && <p className="text-red-400 text-sm flex items-center gap-2"><XCircleIcon className="h-5 w-5" />{formError}</p>}
            
            {!user?.loggedIn ? (
                <button onClick={authenticate} className="flex items-center justify-center bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500">
                    <WalletIcon className="h-5 w-5 mr-2" />
                    <span>Connect Wallet to Create</span>
                </button>
            ) : (
                <button
                    onClick={handleCreateAndMint}
                    disabled={isButtonDisabled}
                    className="flex items-center justify-center bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-wait"
                >
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    <span>{buttonText}</span>
                </button>
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
                      <span>NFT ID: {project.nft_id}</span>
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
          setNewName('');
          setNewDescription('');
          setNewImageFile(null);
          setImagePreview(null);
        }}
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