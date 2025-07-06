import React from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { flowEvmTestnet } from '../config/chain';

const TARGET_CHAIN = flowEvmTestnet;

const NetworkGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  const isWrongNetwork = isConnected && chainId !== TARGET_CHAIN.id;

  const handleSwitchNetwork = () => {
    switchChain({ chainId: TARGET_CHAIN.id });
  };

  return (
    <>
      {/* 1. The main application is now ALWAYS rendered */}
      {children}

      {/* 2. The modal is conditionally rendered ON TOP of the application */}
      {isWrongNetwork && (
        // This outer div creates the dark, blurred background overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80 backdrop-blur-sm">
          
          {/* This is the actual modal content box */}
          <div className="rounded-lg bg-gray-800 p-8 shadow-2xl border border-gray-700 text-center max-w-sm mx-4">
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
          </div>

        </div>
      )}
    </>
  );
};

export default NetworkGuard;