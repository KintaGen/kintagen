import React from 'react';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import { WalletIcon } from '@heroicons/react/24/solid';
import { useNostr } from '../../contexts/NostrContext'; // Import useNostr

const ConnectWalletPrompt = () => {
  const { authenticate } = useFlowCurrentUser();
  const { logoutNostr } = useNostr(); // Get logoutNostr from context

  const handleConnectFlowWallet = async () => {
    // Before authenticating with Flow, log out any existing Nostr session
    await logoutNostr();
    // Then proceed with Flow authentication
    authenticate();
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg mb-10 text-center">
      <h2 className="text-xl font-semibold mb-4">Ready to Start Your On-Chain Research?</h2>
      <p className="text-gray-400 mb-6">Connect your wallet to create a new project and begin logging your findings immutably.</p>
      <button
        onClick={handleConnectFlowWallet} // Use the new handler
        className="inline-flex items-center justify-center bg-purple-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-purple-500 transition-transform hover:scale-105"
      >
        <WalletIcon className="h-5 w-5 mr-2" />
        Connect Wallet to Create
      </button>
    </div>
  );
};

export default ConnectWalletPrompt;