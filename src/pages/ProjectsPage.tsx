import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import { useOwnedNftProjects, useAllNfts } from '../flow/kintagen-nft';
import type { NftProject } from '../types';
import { FolderIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

import ProjectDetail from '../components/projects/ProjectDetail';
import ProjectGrid from '../components/projects/ProjectGrid';
import ConnectWalletPrompt from '../components/projects/ConnectWalletPrompt';
import CreateProjectForm from '../components/projects/CreateProjectForm';

const ProjectsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  const { user } = useFlowCurrentUser();

  const { refetchProjects } = useOwnedNftProjects();
  const { allNfts, isLoading: isLoadingAllProjects, error: allProjectsError } = useAllNfts();

  const myProjects = useMemo((): NftProject[] => {
    if (!user?.addr || !allNfts) return [];
    return allNfts.filter(nft => nft.owner === user.addr);
  }, [allNfts, user?.addr]);

  const allProjects = useMemo((): NftProject[] => allNfts || [], [allNfts]);

  usePageTitle('Projects - KintaGen');

  const openProjectModal = (project: NftProject) => {
    setSelectedProject({
      id: project.id,
      nft_id: project.id,
      name: project.name,
      description: project.description,
      owner: project.owner,
    });
  };

  const tabs = [
    { id: 'my' as const, label: 'Your Projects', icon: <FolderIcon className="h-4 w-4" /> },
    { id: 'all' as const, label: 'All Projects', icon: <GlobeAltIcon className="h-4 w-4" /> },
  ];

  return (
    <>
      <Helmet>
        <title>Projects - KintaGen</title>
        <meta name="description" content="Manage your research projects and create immutable logbooks on the blockchain." />
        <meta name="keywords" content="research projects, blockchain, NFT, logbook, data provenance" />
        <meta property="og:title" content="Projects - KintaGen" />
        <meta property="og:description" content="Manage your research projects and create immutable logbooks on the blockchain." />
      </Helmet>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold gradient-text mb-1">Projects</h1>
          <p className="text-gray-500 text-sm">Create and manage your on-chain research logbooks</p>
        </div>

        {user?.loggedIn ? (
          <CreateProjectForm onMintSuccess={refetchProjects} />
        ) : (
          <ConnectWalletPrompt />
        )}

        <div>
          {user?.loggedIn ? (
            <div>
              {/* Pill-style tab bar */}
              <div className="mb-6">
                <div className="flex gap-1 bg-gray-900/70 p-1 rounded-xl border border-gray-700/50 w-fit">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 whitespace-nowrap py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                          ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-900/30'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                        }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'my' && (
                <ProjectGrid projects={myProjects} isLoading={isLoadingAllProjects} onCardClick={openProjectModal} emptyMessage="You haven't minted any projects yet." />
              )}
              {activeTab === 'all' && (
                <ProjectGrid projects={allProjects} isLoading={isLoadingAllProjects} onCardClick={openProjectModal} />
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-white">All On-Chain Projects</h2>
              {allProjectsError && (
                <p className="text-red-400 p-4 bg-red-900/20 border border-red-800/40 rounded-xl mb-4 text-sm">
                  Error loading projects: {(allProjectsError as Error).message}
                </p>
              )}
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