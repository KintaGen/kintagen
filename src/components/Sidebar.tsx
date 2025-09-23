import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  FolderIcon,
  ChatBubbleLeftRightIcon,
  BeakerIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import FeedbackButton from './FeedbackButton'; 
import { Connect } from "@onflow/react-sdk";
import clsx from 'clsx'; // A tiny utility for constructing `className` strings conditionally

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

// The Sidebar now accepts an `isOpen` prop to control its visibility on mobile
const Sidebar: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    Analysis: true,
  });

  const location = useLocation();
  const feedbackFormUrl = 'https://forms.gle/link_here';

  const toggleMenu = (name: string) => {
    setOpenMenus((prevOpenMenus) => ({
      ...prevOpenMenus,
      [name]: !prevOpenMenus[name],
    }));
  };
  
  const navLinks: NavLinkInfo[] = [
    { name: 'Home', to: '/', icon: HomeIcon },
    { name: 'Projects', to: '/projects', icon: FolderIcon },
    //{ name: 'Research Chat', to: '/chat', icon: ChatBubbleLeftRightIcon },
    {
      name: 'Analysis',
      icon: BeakerIcon,
      subLinks: [
        { name: 'LD50', to: '/analysis' },
      ],
    },
  ];

  return (
    <div
      className={clsx(
        // Base styles for all screen sizes
        "w-64 bg-gray-800 text-gray-200 flex flex-col fixed h-full z-30",
        "transition-transform duration-300 ease-in-out",

        // Mobile state: Controlled by the `isOpen` prop
        isOpen ? 'transform translate-x-0' : 'transform -translate-x-full',
        
        // Desktop override: Always visible, regardless of `isOpen` state
        "md:translate-x-0"
      )}
    >
      <div className="bg-gray-900 p-4 flex items-center justify-center border-b border-gray-700">
        <h1 className="text-xl font-bold">KintaGen - Demo</h1>
      </div>
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul>
          <li className={`flex items-center justify-between w-full p-3 my-1 rounded-lg transition-colors duration-200`}>
          <Connect
            onConnect={() => console.log("Connected!")}
            onDisconnect={() => console.log("Logged out")}
          />
          </li>
          
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

      <FeedbackButton feedbackFormUrl={feedbackFormUrl} />
    </div>
  );
};

export default Sidebar;