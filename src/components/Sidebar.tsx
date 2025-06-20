import React, { useState } from 'react';
// Import NavLink and useLocation for checking the active route
import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  FolderIcon,
  ChatBubbleLeftRightIcon,
  ArrowUpTrayIcon,
  BeakerIcon,
  UsersIcon,
  ChevronDownIcon, // Icon for the dropdown arrow
} from '@heroicons/react/24/outline';

// Define the structure for sub-links
interface SubNavLinkInfo {
  name: string;
  to: string;
}

// Update the main NavLinkInfo to optionally include sub-links
interface NavLinkInfo {
  name: string;
  to?: string; // Becomes optional for parent items that don't link anywhere
  icon: React.ElementType;
  subLinks?: SubNavLinkInfo[]; // Array of sub-links
}

const Sidebar: React.FC = () => {
  // State to manage which dropdown menus are open
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    Analysis: true, // Let's have it open by default
  });

  const location = useLocation(); // Hook to get the current path

  // Toggle function for the dropdown menus
  const toggleMenu = (name: string) => {
    setOpenMenus((prevOpenMenus) => ({
      ...prevOpenMenus, // Keep the state of other menus
      [name]: !prevOpenMenus[name], // Toggle the clicked one
    }));
  };
  
  // Updated navigation structure
  const navLinks: NavLinkInfo[] = [
    { name: 'Dashboard', to: '/', icon: HomeIcon },
    { name: 'Projects', to: '/projects', icon: FolderIcon },
    { name: 'Research Chat', to: '/chat', icon: ChatBubbleLeftRightIcon },
    { name: 'Ingest Data', to: '/ingest', icon: ArrowUpTrayIcon },
    // This is now a parent menu item
    {
      name: 'Analysis',
      icon: BeakerIcon,
      subLinks: [
        { name: 'LD50', to: '/analysis' },
        { name: 'GCMS', to: '/analyze-gcms' },
      ],
    },
    { name: 'Lab Network', to: '/network', icon: UsersIcon },
  ];

  return (
    <div className="w-64 bg-gray-800 text-gray-200 flex flex-col fixed h-full">
      <div className="bg-gray-900 p-4 flex items-center justify-center border-b border-gray-700">
        <h1 className="text-xl font-bold">Project Cortex</h1>
      </div>
      <nav className="flex-1 p-4">
        <ul>
          {navLinks.map((link) => {
            // Check if the current link is a parent with sub-links
            if (link.subLinks) {
              const isMenuOpen = !!openMenus[link.name];
              // A parent is active if one of its children is the current page
              const isParentActive = link.subLinks.some(
                (sub) => location.pathname === sub.to
              );

              return (
                <li key={link.name}>
                  <button
                    onClick={() => toggleMenu(link.name)}
                    className={`flex items-center justify-between w-full p-3 my-1 rounded-lg transition-colors duration-200 ${
                      isParentActive
                        ? 'bg-blue-600 text-white' // Style for active parent
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <link.icon className="h-6 w-6 mr-3" />
                      {link.name}
                    </div>
                    <ChevronDownIcon
                      className={`h-5 w-5 transition-transform duration-200 ${
                        isMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {/* Conditionally render the sub-menu with a sliding animation */}
                  {isMenuOpen && (
                    <ul className="pl-6 mt-1">
                      {link.subLinks.map((subLink) => (
                        <li key={subLink.name}>
                          <NavLink
                            to={subLink.to}
                            className={({ isActive }) =>
                              `flex items-center p-2 my-1 rounded-lg transition-colors duration-200 text-sm ${
                                isActive
                                  ? 'bg-gray-700 text-white'
                                  : 'text-gray-400 hover:bg-gray-700'
                              }`
                            }
                          >
                            {subLink.name}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            }

            // Render a regular NavLink if there are no sub-links
            return (
              <li key={link.name}>
                <NavLink
                  to={link.to!} // 'to' will exist for these links
                  className={({ isActive }) =>
                    `flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`
                  }
                >
                  <link.icon className="h-6 w-6 mr-3" />
                  {link.name}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;