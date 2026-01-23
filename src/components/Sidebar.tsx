import React, { useState } from 'react';
import { NavLink,Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  FolderIcon,
  UserIcon,
  UsersIcon,
  BeakerIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  ChatBubbleBottomCenterTextIcon
} from '@heroicons/react/24/outline';
import { Connect } from "@onflow/react-sdk";
import clsx from 'clsx';
import { useNostr } from '../contexts/NostrContext'; // Import useNostr

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

const Sidebar: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    Analysis: true,
  });

  const location = useLocation();
  const { pubkey,logoutNostr } = useNostr(); // Get logoutNostr from context

  const toggleMenu = (name: string) => {
    setOpenMenus((prevOpenMenus) => ({
      ...prevOpenMenus,
      [name]: !prevOpenMenus[name],
    }));
  };

  // NEW: Handler for Flow connection success
  const handleFlowConnect = async () => {
    // When Flow connects, ensure any other Nostr session is logged out
    if(pubkey) await logoutNostr();
    console.log("Flow Wallet Connected!"); // Original log
  };

  // NEW: Handler for Flow disconnection
  const handleFlowDisconnect = async () => {
    if(pubkey) await logoutNostr();
    console.log("Flow Wallet Logged out"); 
  };
  
  const navLinks: NavLinkInfo[] = [
    { name: 'Home', to: '/', icon: HomeIcon },
    { name: 'My Profile', to: '/my-profile', icon: UserIcon },
    { name: 'Profiles', to: '/profiles', icon: UsersIcon },

    { name: 'Projects', to: '/projects', icon: FolderIcon },

    {
      name: 'Analysis',
      icon: BeakerIcon,
      subLinks: [
        { name: 'LD50', to: '/analysis' },
        { name: 'NMR', to: '/analysis-nmr' },
        { name: 'XCMS', to: '/analysis-xcms' },
        { name: 'Custom Observation', to: '/custom' },

      ],
    },
    { name: 'Verify', to: '/verify', icon: ShieldCheckIcon },

  ];

  return (
    <div
      className={clsx(
        "w-64 bg-gray-800 text-gray-200 flex flex-col fixed h-full z-30",
        "transition-transform duration-300 ease-in-out",
        isOpen ? 'transform translate-x-0' : 'transform -translate-x-full',
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
            onConnect={handleFlowConnect} // Use the new handler
            onDisconnect={handleFlowDisconnect} // Use the new handler
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

      <div className="p-4 border-t border-gray-700">
        <Link
          to="feedback"
          className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
        >
          <ChatBubbleBottomCenterTextIcon className="h-5 w-5" />
          <span>Provide Feedback</span>
        </Link>
      </div>

    </div>
  );
};

export default Sidebar;