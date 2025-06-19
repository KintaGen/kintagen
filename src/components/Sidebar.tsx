// src/components/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom'; // Import NavLink
import {
  HomeIcon,
  FolderIcon,
  ChatBubbleLeftRightIcon,
  ArrowUpTrayIcon, // Icon for uploading
  BeakerIcon,     // Icon for analysis
  UsersIcon,      // Icon for collaboration
} from '@heroicons/react/24/outline';

interface NavLinkInfo {
  name: string;
  to: string; // The route path
  icon: React.ElementType;
}

const Sidebar: React.FC = () => {
  const navLinks: NavLinkInfo[] = [
    { name: 'Dashboard', to: '/', icon: HomeIcon },
    { name: 'Projects', to: '/projects', icon: FolderIcon },
    { name: 'Research Chat', to: '/chat', icon: ChatBubbleLeftRightIcon },
    { name: 'Ingest Data', to: '/ingest', icon: ArrowUpTrayIcon },
    { name: 'Analysis Workbench', to: '/analysis', icon: BeakerIcon },
    { name: 'Analysis GCMS', to: '/analyze-gcms', icon: BeakerIcon },
    { name: 'Lab Network', to: '/network', icon: UsersIcon },
  ];

  return (
    <div className="w-64 bg-gray-800 text-gray-200 flex flex-col fixed h-full">
      <div className="bg-gray-900 p-4 flex items-center justify-center border-b border-gray-700">
        <h1 className="text-xl font-bold">Project Cortex</h1>
      </div>
      <nav className="flex-1 p-4">
        <ul>
          {navLinks.map((link) => (
            <li key={link.name}>
              <NavLink
                to={link.to}
                // This function gets called by NavLink to determine the class
                className={({ isActive }) =>
                  `flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white' // Style for the active link
                      : 'text-gray-300 hover:bg-gray-700' // Style for inactive links
                  }`
                }
              >
                <link.icon className="h-6 w-6 mr-3" />
                {link.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;