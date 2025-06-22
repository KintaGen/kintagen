// src/pages/ProjectsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { BeakerIcon, PlusCircleIcon, ArrowPathIcon, FingerPrintIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';

// FLOW INTEGRATION: Import FCL and the KintaGen viewer component
import * as fcl from '@onflow/fcl';
import KintaGenWorkflowViewer from '../components/KintaGenWorkflowViewer'; // Make sure this path is correct

// FLOW INTEGRATION: Import the FCL configuration file.
// This sets up FCL to connect to the correct Flow network (e.g., emulator, testnet).
import '../flow/config'; // Make sure this path is correct

// FLOW INTEGRATION: Update the Project interface to include an optional NFT ID.
interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  nft_id: number | null; // This will store the ID of the minted NFT
}

// FLOW INTEGRATION: Cadence transaction to mint a new KintaGenNFT
const MINT_PROJECT_NFT_TRANSACTION = `
  import NonFungibleToken from 0xNonFungibleToken
  import KintaGenNFT from 0xKintaGenNFT
  import ViewResolver from 0xViewResolver

  transaction(projectName: String, projectDescription: String) {

      let recipientCollection: &KintaGenNFT.Collection

      prepare(signer: auth(BorrowValue) &Account) {
          // --- Setup Collection ---
          // If the account doesn't have a collection, create and store one.
          if signer.storage.borrow<&KintaGenNFT.Collection>(from: KintaGenNFT.CollectionStoragePath) == nil {
              let collection <- KintaGenNFT.createEmptyCollection()
              signer.storage.save(<-collection, to: KintaGenNFT.CollectionStoragePath)
          }
          
          // Create a public capability for the collection if it doesn't exist so others can see the NFTs.
          if signer.capabilities.get<&{NonFungibleToken.CollectionPublic, KintaGenNFT.KintaGenNFTCollectionPublic, ViewResolver.ResolverCollection}>(KintaGenNFT.CollectionPublicPath).borrow() == nil {
              signer.capabilities.publish(
                  signer.capabilities.storage.issue<&KintaGenNFT.Collection>(KintaGenNFT.CollectionStoragePath)!,
                  at: KintaGenNFT.CollectionPublicPath
              )
          }
          
          self.recipientCollection = signer.storage.borrow<&KintaGenNFT.Collection>(from: KintaGenNFT.CollectionStoragePath)
              ?? panic("Could not borrow a reference to the KintaGenNFT collection")
      }

      execute {
          // The first step of the workflow is creating the project.
          let firstStep = KintaGenNFT.WorkflowStep(
              action: "Project Created",
              agent: signer.address.toString(),
              resultCID: projectDescription, // Using the description as a placeholder for a real IPFS CID
              timestamp: getCurrentBlock().timestamp
          )

          // Mint the NFT with the project's details as the first workflow step.
          let nft <- KintaGenNFT.mintNFT(
              initialWorkflow: [firstStep]
          )
          
          self.recipientCollection.deposit(token: <-nft)

          log("Successfully minted a KintaGenNFT for the project.")
      }
  }
`;


const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for creating a new project
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- FLOW INTEGRATION: State for Flow user, minting process, and viewing NFTs ---
  const [currentUser, setCurrentUser] = useState<{ loggedIn: boolean; addr?: string }>({ loggedIn: false });
  const [mintingProjectId, setMintingProjectId] = useState<number | null>(null);
  const [mintingError, setMintingError] = useState<string | null>(null);
  const [viewingNftId, setViewingNftId] = useState<number | null>(null);

  const hasFetched = useRef(false);

  // FLOW INTEGRATION: Subscribe to FCL's currentUser on mount
  useEffect(() => {
    fcl.currentUser.subscribe(setCurrentUser);
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3001/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects.');
      const data: Project[] = await response.json();
      // Ensure every project has an nft_id, defaulting to null
      const projectsWithNftId = data.map(p => ({ ...p, nft_id: p.nft_id || null }));
      setProjects(projectsWithNftId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasFetched.current) {
      fetchProjects();
      hasFetched.current = true;
    }
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDescription }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create project.');
      
      // Ensure the new project object matches the interface
      const newProject: Project = { ...data, nft_id: null };
      setProjects(prev => [newProject, ...prev]);
      setNewName('');
      setNewDescription('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // FLOW INTEGRATION: Function to handle minting a project as an NFT
  const handleMintProject = async (project: Project) => {
    setMintingProjectId(project.id);
    setMintingError(null);
    setViewingNftId(null); // Close viewer if open

    try {
      const transactionId = await fcl.mutate({
        cadence: MINT_PROJECT_NFT_TRANSACTION,
        args: (arg, t) => [
          arg(project.name, t.String),
          arg(project.description, t.String),
        ],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 999,
      });

      console.log('Transaction submitted:', transactionId);
      const result = await fcl.tx(transactionId).onceSealed();
      console.log('Transaction sealed:', result);

      if (result.status === 4) { // 4 is the status code for a sealed transaction
        // Find the newly minted NFT ID from the transaction events
        const depositEvent = result.events.find((e: any) => e.type.includes('KintaGenNFT.Deposit'));
        if (!depositEvent) throw new Error("Could not find Deposit event to get NFT ID.");
        const newNftId = depositEvent.data.id;

        // --- IMPORTANT ---
        // In a real application, you would now call your backend to permanently
        // associate the nft_id with your project in the database.
        // e.g., await fetch(`/api/projects/${project.id}/mint`, { method: 'POST', body: JSON.stringify({ nftId: newNftId }) });
        
        // Optimistically update the UI state
        setProjects(prevProjects =>
          prevProjects.map(p =>
            p.id === project.id ? { ...p, nft_id: newNftId } : p
          )
        );

      } else {
        throw new Error('Flow transaction failed.');
      }
    } catch (err: any) {
      console.error('Minting failed:', err);
      setMintingError(err.message || 'An unknown error occurred during minting.');
    } finally {
      setMintingProjectId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* FLOW INTEGRATION: Authentication Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Research Projects</h1>
        <div>
          {currentUser.loggedIn ? (
            <div className="flex items-center space-x-4">
              <span className="text-gray-300 font-mono text-sm">{currentUser.addr}</span>
              <button onClick={fcl.unauthenticate} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-500">
                Log Out
              </button>
            </div>
          ) : (
            <button onClick={fcl.logIn} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-500">
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Create New Project Form */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-10">
        <h2 className="text-xl font-semibold mb-4">Create a New Project</h2>
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-1">Project Name</label>
            <input
              id="projectName"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., E. coli K-12 Antibiotic Resistance"
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="projectDesc" className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
            <textarea
              id="projectDesc"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              placeholder="A brief summary of the research goals."
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none"
            />
          </div>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <button
            type="submit"
            disabled={isSubmitting || !newName}
            className="flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 disabled:bg-gray-600"
          >
            {isSubmitting ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PlusCircleIcon className="h-5 w-5 mr-2" />}
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>

      {/* List of Existing Projects */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Existing Projects</h2>
        {isLoading && <p className="text-gray-400">Loading projects...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!isLoading && projects.length === 0 && <p className="text-gray-500">No projects created yet.</p>}
        {mintingError && <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-md mb-4">{mintingError}</div>}
        <ul className="space-y-4">
          {projects.map(project => (
            <li key={project.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 transition-all">
              <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center"><BeakerIcon className="h-5 w-5 mr-2 text-cyan-400" />{project.name}</h3>
                    <p className="text-gray-400 mt-1">{project.description}</p>
                    <p className="text-xs text-gray-500 mt-2">Created: {new Date(project.created_at).toLocaleDateString()}</p>
                  </div>
                  {/* FLOW INTEGRATION: Minting and Viewing Controls */}
                  <div className="flex-shrink-0 ml-4">
                    {project.nft_id !== null ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-green-400 bg-green-900/50 px-3 py-1 rounded-full">
                          Minted as NFT #{project.nft_id}
                        </span>
                        <button
                          onClick={() => setViewingNftId(viewingNftId === project.nft_id ? null : project.nft_id)}
                          className="p-2 rounded-full hover:bg-gray-700"
                          title={viewingNftId === project.nft_id ? "Hide Workflow" : "View Workflow"}
                        >
                          {viewingNftId === project.nft_id ? <EyeSlashIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5"/>}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleMintProject(project)}
                        disabled={!currentUser.loggedIn || mintingProjectId !== null}
                        className="flex items-center justify-center bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        {mintingProjectId === project.id ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <FingerPrintIcon className="h-5 w-5 mr-2" />
                        )}
                        {mintingProjectId === project.id ? 'Minting...' : 'Mint as NFT'}
                      </button>
                    )}
                  </div>
              </div>
              {/* FLOW INTEGRATION: Conditionally render the workflow viewer */}
              {viewingNftId === project.nft_id && currentUser.addr && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <KintaGenWorkflowViewer nftId={project.nft_id} ownerAddress={currentUser.addr} />
                  </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ProjectsPage;