import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  FolderIcon,
  UserIcon,
  UsersIcon,
  BeakerIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';
import { Connect } from "@onflow/react-sdk";
import clsx from 'clsx';
import { useNostr } from '../contexts/NostrContext';

interface SubNavLinkInfo {
  name: string;
  to: string;
}
interface NavLinkInfo {
  name: string;
  to?: string;
  icon: React.ElementType;
  iconColor: string;
  activeGlow: string;
  subLinks?: SubNavLinkInfo[];
}

const Sidebar: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    Analysis: true,
  });

  const location = useLocation();
  const { pubkey, logoutNostr } = useNostr();

  const toggleMenu = (name: string) => {
    setOpenMenus((prevOpenMenus) => ({
      ...prevOpenMenus,
      [name]: !prevOpenMenus[name],
    }));
  };

  const handleFlowConnect = async () => {
    if (pubkey) await logoutNostr();
  };

  const handleFlowDisconnect = async () => {
    if (pubkey) await logoutNostr();
  };

  const navLinks: NavLinkInfo[] = [
    { name: 'Home', to: '/', icon: HomeIcon, iconColor: 'text-purple-400', activeGlow: 'shadow-glow-purple' },
    { name: 'My Profile', to: '/my-profile', icon: UserIcon, iconColor: 'text-violet-400', activeGlow: 'shadow-glow-purple' },
    { name: 'Profiles', to: '/profiles', icon: UsersIcon, iconColor: 'text-cyan-400', activeGlow: 'shadow-glow-cyan' },
    { name: 'Projects', to: '/projects', icon: FolderIcon, iconColor: 'text-teal-400', activeGlow: 'shadow-glow-cyan' },
    {
      name: 'Analysis',
      icon: BeakerIcon,
      iconColor: 'text-blue-400',
      activeGlow: 'shadow-glow-purple',
      subLinks: [
        { name: 'LD50', to: '/analysis' },
        { name: 'NMR', to: '/analysis-nmr' },
        { name: 'XCMS', to: '/analysis-xcms' },
        { name: 'Custom Observation', to: '/custom' },
      ],
    },
    { name: 'Verify', to: '/verify', icon: ShieldCheckIcon, iconColor: 'text-green-400', activeGlow: 'shadow-glow-cyan' },
  ];

  return (
    <div
      className={clsx(
        "w-64 flex flex-col fixed h-full z-30",
        "transition-transform duration-300 ease-in-out",
        "bg-gray-900 border-r border-gray-700/50",
        isOpen ? 'transform translate-x-0' : 'transform -translate-x-full',
        "md:translate-x-0"
      )}
    >
      {/* Logo Area */}
      <div className="relative overflow-hidden p-5 border-b border-gray-700/50">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-cyan-900/20 pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-glow-purple">
              <span className="text-white font-black text-sm">K</span>
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold gradient-text leading-tight">KintaGen</h1>
            <p className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">Research Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">
        {/* Connect wallet */}
        <div className="px-2 py-2 mb-2">
          <Connect
            onConnect={handleFlowConnect}
            onDisconnect={handleFlowDisconnect}
          />
        </div>

        {/* Nav links */}
        {navLinks.map((link) => {
          if (link.subLinks) {
            const isMenuOpen = !!openMenus[link.name];
            const isParentActive = link.subLinks.some(
              (sub) => location.pathname === sub.to
            );
            return (
              <div key={link.name}>
                <button
                  onClick={() => toggleMenu(link.name)}
                  className={clsx(
                    'flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium',
                    isParentActive
                      ? 'bg-gradient-to-r from-purple-600/80 to-violet-600/80 text-white shadow-glow-purple'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/70'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <link.icon className={clsx('h-5 w-5', isParentActive ? 'text-white' : link.iconColor)} />
                    <span>{link.name}</span>
                  </div>
                  <ChevronDownIcon
                    className={clsx('h-4 w-4 transition-transform duration-200 text-gray-500', isMenuOpen && 'rotate-180')}
                  />
                </button>
                {isMenuOpen && (
                  <div className="ml-4 mt-1 pl-4 border-l border-gray-700/50 space-y-0.5">
                    {link.subLinks.map((subLink) => (
                      <NavLink
                        key={subLink.name}
                        to={subLink.to}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center px-3 py-2 rounded-lg transition-all duration-200 text-xs font-medium',
                            isActive
                              ? 'bg-gray-700/60 text-white'
                              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                          )
                        }
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-600 mr-2.5 flex-shrink-0" />
                        {subLink.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <NavLink
              key={link.name}
              to={link.to!}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium',
                  isActive
                    ? 'bg-gradient-to-r from-purple-600/80 to-violet-600/80 text-white shadow-glow-purple'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/70'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <link.icon className={clsx('h-5 w-5 flex-shrink-0', isActive ? 'text-white' : link.iconColor)} />
                  <span>{link.name}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700/50">
        <Link
          to="feedback"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 bg-purple-900/20 border border-purple-700/30 text-purple-300 hover:bg-purple-900/40 hover:border-purple-600/50 hover:text-purple-200"
        >
          <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
          <span>Provide Feedback</span>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;