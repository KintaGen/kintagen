import React, { useState, useMemo } from 'react';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import { useOwnedNftProjects, useAllNfts } from '../flow/kintagen-nft';
import type { NftProject } from '../types';

import ProjectDetail from '../components/projects/ProjectDetail';
import ProjectGrid from '../components/projects/ProjectGrid';
import ConnectWalletPrompt from '../components/projects/ConnectWalletPrompt';
import CreateProjectForm from '../components/projects/CreateProjectForm';

const ProjectsPage: React.FC = () => {
  // FIX: Default tab is now 'my'
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  
  const { user } = useFlowCurrentUser();

  const { refetchProjects } = useOwnedNftProjects();
  const { allNfts, isLoading: isLoadingAllProjects, error: allProjectsError } = useAllNfts();

  // FIX: The `myProjects` array is now derived by filtering the `allNfts` data.
  // This ensures that all data, including the thumbnailCid, is present.
  const myProjects = useMemo((): NftProject[] => {
    if (!user?.addr || !allNfts) {
      return [];
    }
    return allNfts.filter(nft => nft.owner === user.addr);
  }, [allNfts, user?.addr]);

  const allProjects = useMemo((): NftProject[] => allNfts || [], [allNfts]);

  const openProjectModal = (project: NftProject) => {
    setSelectedProject({
      id: project.id,
      nft_id: project.id,
      name: project.name,
      description: project.description,
      owner: project.owner,
    });
  };

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-8">Projects</h1>

        {user?.loggedIn ? (
          <CreateProjectForm onMintSuccess={refetchProjects} />
        ) : (
          <ConnectWalletPrompt />
        )}
        
        <div>
          {user?.loggedIn ? (
            <div>
              <div className="border-b border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                  {/* FIX: "Your Projects" tab now appears first */}
                  <button 
                    onClick={() => setActiveTab('my')} 
                    className={`${activeTab === 'my' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                  >
                    Your Projects
                  </button>
                  <button 
                    onClick={() => setActiveTab('all')} 
                    className={`${activeTab === 'all' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                  >
                    All Projects
                  </button>
                </nav>
              </div>

              {/* The active tab content is rendered based on the state */}
              {activeTab === 'my' && <ProjectGrid projects={myProjects} isLoading={isLoadingAllProjects} onCardClick={openProjectModal} emptyMessage="You haven't minted any projects yet." />}
              {activeTab === 'all' && <ProjectGrid projects={allProjects} isLoading={isLoadingAllProjects} onCardClick={openProjectModal} />}
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold mb-4">All On-Chain Projects</h2>
              {allProjectsError && <p className="text-red-400 p-4 bg-red-900/50 rounded-lg mb-4">Error loading projects: {(allProjectsError as Error).message}</p>}
              <ProjectGrid projects={allProjects} isLoading={isLoadingAllProjects} onCardClick={openProjectModal} />
            </div>
          )}
        </div>
      </div>
      
      {selectedProject && <ProjectDetail project={selectedProject} onClose={() => setSelectedProject(null)} />}
    </>
  );
};

export default ProjectsPage;