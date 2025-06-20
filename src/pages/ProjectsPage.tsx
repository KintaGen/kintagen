// src/pages/ProjectsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { BeakerIcon, PlusCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
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

  const hasFetched = useRef(false);

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
      
      setProjects(prev => [data, ...prev]); // Add new project to the top of the list
      setNewName(''); // Reset form
      setNewDescription('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-8">Research Projects</h1>

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
        <ul className="space-y-4">
          {projects.map(project => (
            <li key={project.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <h3 className="text-lg font-bold text-white flex items-center"><BeakerIcon className="h-5 w-5 mr-2 text-cyan-400" />{project.name}</h3>
              <p className="text-gray-400 mt-1">{project.description}</p>
              <p className="text-xs text-gray-500 mt-2">Created: {new Date(project.created_at).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ProjectsPage;