import { Bars3Icon } from '@heroicons/react/24/outline';


const Header = ({ toggleSidebar }: { toggleSidebar: () => void }) => {
  return (
    <header className="bg-gray-900/95 backdrop-blur border-b border-gray-700/50 px-4 py-3 md:hidden flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {/* Brand icon */}
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-glow-purple flex-shrink-0">
          <span className="text-white font-black text-xs">K</span>
        </div>
        <h1 className="text-base font-bold gradient-text">KintaGen</h1>
      </div>
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        aria-label="Open menu"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>
    </header>
  );
};

export default Header;