// src/components/Header.js
import React from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';

const Header = ({ toggleSidebar }) => {
  return (
    // This header is only visible on screens smaller than `md` (768px by default)
    <header className="bg-gray-800 p-4 md:hidden flex items-center">
      <button onClick={toggleSidebar} className="text-gray-200 hover:text-white">
        <Bars3Icon className="h-6 w-6" />
      </button>
      <h1 className="text-lg font-bold ml-4">KintaGen - Demo</h1>
    </header>
  );
};

export default Header;