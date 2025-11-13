import React from 'react';
import ProjectCard from './ProjectCard';
import type { NftProject } from '../../types'; 

interface ProjectGridProps {
  projects: NftProject[];
  isLoading: boolean;
  onCardClick: (project: NftProject) => void;
  emptyMessage?: string;
}

const ProjectGrid: React.FC<ProjectGridProps> = ({ projects, isLoading, onCardClick, emptyMessage }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse">
            <div className="aspect-video w-full bg-gray-700"></div>
            <div className="p-4"><div className="h-5 bg-gray-700 rounded w-3/4"></div></div>
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return <p className="text-gray-500 text-center py-8">{emptyMessage || "No projects found."}</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map(p => <ProjectCard key={p.id} nft={p} onClick={() => onCardClick(p)} />)}
    </div>
  );
};

export default ProjectGrid;