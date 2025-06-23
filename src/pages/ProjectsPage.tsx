// src/pages/ProjectsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { BeakerIcon, PlusCircleIcon, ArrowPathIcon, CubeTransparentIcon, SparklesIcon } from '@heroicons/react/24/solid';

// Updated Project interface to handle nullable nft_id
interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  nft_id: number | null; // Can be null now
}

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for creating a new project
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // --- NEW: State to track which project is currently minting ---
  const [mintingProjectId, setMintingProjectId] = useState<number | null>(null);
  const [mintingError, setMintingError] = useState<string | null>(null);

  const hasFetched = useRef(false);

  // --- DATA FETCHING ---
  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3001/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects.');
      const data: Project[] = await response.json();
      setProjects(data);
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

  // --- HANDLERS ---
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      // The request body is now simpler, no 'mintNft' flag needed
      const response = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDescription }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create project.');
      
      setProjects(prev => [data, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewDescription('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- NEW: Handler for minting an NFT for an existing project ---
  const handleMintClick = async (projectId: number) => {
    setMintingProjectId(projectId); // Set loading state for this specific project
    setMintingError(null);
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/mint`, {
        method: 'POST',
      });
      const updatedProject = await response.json();
      if (!response.ok) {
        throw new Error(updatedProject.error || 'Minting failed on the server.');
      }

      // Update the specific project in our state with the new NFT ID
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));

    } catch (err: any) {
      console.error("Minting failed:", err);
      setMintingError(err.message);
    } finally {
      setMintingProjectId(null); // Reset loading state
    }
  };


  // --- RENDER ---
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-8">Research Projects</h1>

      {/* --- Create New Project Form (now simpler) --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-10">
        <h2 className="text-xl font-semibold mb-4">Create a New Project</h2>
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-1">Project Name</label>
            <input id="projectName" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., E. coli K-12 Antibiotic Resistance" className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none" required />
          </div>
          <div>
            <label htmlFor="projectDesc" className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
            <textarea id="projectDesc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} placeholder="A brief summary of the research goals." className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none" />
          </div>
          {/* The mint checkbox is now removed */}
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <button type="submit" disabled={isSubmitting || !newName} className="flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 disabled:bg-gray-600">
            {isSubmitting ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PlusCircleIcon className="h-5 w-5 mr-2" />}
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>

      {/* --- List of Existing Projects (with conditional Mint button) --- */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Existing Projects</h2>
        {isLoading && <p className="text-gray-400">Loading projects...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {mintingError && <p className="text-red-400 mb-4">Minting Error: {mintingError}</p>}
        {!isLoading && projects.length === 0 && <p className="text-gray-500">No projects created yet.</p>}
        
        <ul className="space-y-4">
          {projects.map(project => (
            <li key={project.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {/* Left Side: Project Info */}
              <div className="flex-grow">
                <h3 className="text-lg font-bold text-white flex items-center"><BeakerIcon className="h-5 w-5 mr-2 text-cyan-400" />{project.name}</h3>
                <p className="text-gray-400 mt-1 text-sm">{project.description}</p>
                <p className="text-xs text-gray-500 mt-2">Created: {new Date(project.created_at).toLocaleDateString()}</p>
              </div>
              
              {/* Right Side: NFT Status and Mint Button */}
              <div className="flex-shrink-0 w-full sm:w-auto text-right">
                {project.nft_id ? (
                  <div className="flex items-center justify-end font-mono bg-purple-900/50 text-purple-300 px-3 py-1.5 rounded-md text-sm">
                    <CubeTransparentIcon className="h-5 w-5 mr-2" />
                    <span>NFT ID: {project.nft_id.toString()}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleMintClick(project.id)}
                    disabled={mintingProjectId === project.id}
                    className="flex items-center justify-center bg-purple-600 text-white font-bold py-1.5 px-4 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-wait"
                  >
                    {mintingProjectId === project.id ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <SparklesIcon className="h-5 w-5 mr-2" />
                        <span>Mint NFT</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ProjectsPage;