import React, { useState } from 'react'; // 1. Import useState
import { useAccount, useSwitchChain } from 'wagmi';
import { flowEvmTestnet } from '../config/chain';

const TARGET_CHAIN = flowEvmTestnet;

const NetworkGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  // 2. Add state to track which network ID has been dismissed
  const [dismissedForChainId, setDismissedForChainId] = useState<number | null>(null);

  // 3. Update the visibility logic
  const isWrongNetwork = isConnected && chainId !== TARGET_CHAIN.id;
  const showModal = isWrongNetwork && chainId !== dismissedForChainId;

  const handleSwitchNetwork = () => {
    switchChain({ chainId: TARGET_CHAIN.id });
  };

  // 4. Create a handler to dismiss the modal for the current chain
  const handleDismiss = () => {
    if (chainId) {
      setDismissedForChainId(chainId);
    }
  };

  return (
    <>
      {children}

      {/* Use the new 'showModal' variable to control rendering */}
      {showModal && (
        // 5. Add onClick to the backdrop to allow closing the modal
        <div
          onClick={handleDismiss} // Click on the background dismisses the modal
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80 backdrop-blur-sm"
        >
          {/* This prevents a click inside the modal from closing it (event propagation) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg bg-gray-800 p-8 shadow-2xl border border-gray-700 text-center max-w-sm mx-4"
          >
            <h2 className="text-2xl font-bold text-white mb-4">Wrong Network Detected</h2>
            <p className="text-gray-400 mb-6">
              To interact with this application, please switch your wallet to the{' '}
              <strong className="text-cyan-400">{TARGET_CHAIN.name}</strong> network.
            </p>
            <button
              onClick={handleSwitchNetwork}
              disabled={isPending}
              className="w-full px-6 py-3 font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Requesting Switch...' : `Switch to ${TARGET_CHAIN.name}`}
            </button>

            {/* 6. Add a visible "Cancel" button */}
            <button
              onClick={handleDismiss}
              className="mt-4 w-full text-sm text-gray-400 hover:text-white py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NetworkGuard;