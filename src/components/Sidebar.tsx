import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  FolderIcon,
  ChatBubbleLeftRightIcon,
  ArrowUpTrayIcon,
  BeakerIcon,
  UsersIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
// 1. Import the new FeedbackButton component
import FeedbackButton from './FeedbackButton'; 

// --- No changes to interfaces ---
interface SubNavLinkInfo {
  name: string;
  to: string;
}
interface NavLinkInfo {
  name: string;
  to?: string;
  icon: React.ElementType;
  subLinks?: SubNavLinkInfo[];
}

const Sidebar: React.FC = () => {
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    Analysis: true,
  });

  const location = useLocation();
  const feedbackFormUrl = 'https://forms.gle/your-feedback-form-link';

  const toggleMenu = (name: string) => {
    setOpenMenus((prevOpenMenus) => ({
      ...prevOpenMenus,
      [name]: !prevOpenMenus[name],
    }));
  };
  
  const navLinks: NavLinkInfo[] = [
    { name: 'Home', to: '/', icon: HomeIcon },
    { name: 'Projects', to: '/projects', icon: FolderIcon },
    { name: 'Research Chat', to: '/chat', icon: ChatBubbleLeftRightIcon },
    //{ name: 'Ingest Data', to: '/ingest', icon: ArrowUpTrayIcon },
    {
      name: 'Analysis',
      icon: BeakerIcon,
      subLinks: [
        { name: 'LD50', to: '/analysis' },
        //{ name: 'GCMS', to: '/analyze-gcms' },
      ],
    },
    //{ name: 'Lab Network', to: '/network', icon: UsersIcon },
  ];

  return (
    <div className="w-64 bg-gray-800 text-gray-200 flex flex-col fixed h-full">
      <div className="bg-gray-900 p-4 flex items-center justify-center border-b border-gray-700">
        <h1 className="text-xl font-bold">KintaGen - Demo</h1>
      </div>
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul>
          {/* --- No changes to the navigation link mapping logic --- */}
          {navLinks.map((link) => {
            if (link.subLinks) {
              const isMenuOpen = !!openMenus[link.name];
              const isParentActive = link.subLinks.some(
                (sub) => location.pathname === sub.to
              );
              return (
                <li key={link.name}>
                  <button
                    onClick={() => toggleMenu(link.name)}
                    className={`flex items-center justify-between w-full p-3 my-1 rounded-lg transition-colors duration-200 ${
                      isParentActive
                        ? 'bg-blue-600 text-white'
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
            return (
              <li key={link.name}>
                <NavLink
                  to={link.to!}
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

      {/* 2. Use the new component here, passing the URL as a prop */}
      <FeedbackButton feedbackFormUrl={feedbackFormUrl} />
    </div>
  );
};

export default Sidebar;