import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { WalletIcon, KeyIcon, PuzzlePieceIcon } from '@heroicons/react/24/outline';
import { XMarkIcon } from '@heroicons/react/20/solid';

interface NostrLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginWithFlow: () => void;
  onLoginWithExtension: () => void;
  onGenerateNewKeys: () => void;
  isConnecting: boolean;
  flowUserLoggedIn: boolean; // To disable Flow option if not logged into Flow
}

const NostrLoginModal: React.FC<NostrLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginWithFlow,
  onLoginWithExtension,
  onGenerateNewKeys,
  isConnecting,
  flowUserLoggedIn,
}) => {
  const isOtherOptionsDisabled = isConnecting || flowUserLoggedIn;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-700">
                <Dialog.Title
                  as="h3"
                  className="text-2xl font-bold leading-6 text-white text-center flex justify-between items-center pb-4 border-b border-gray-700"
                >
                  <span>Connect to Nostr</span>
                  <button
                    type="button"
                    className="rounded-md p-1 inline-flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close menu</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </Dialog.Title>
                <div className="mt-6 space-y-4">
                  <p className="text-gray-300 text-center mb-6">Choose how you want to connect to Nostr for KintaGen:</p>

                  <button
                    className={`w-full flex items-center justify-center gap-3 px-5 py-3 border border-transparent text-base font-medium rounded-md text-white ${
                      flowUserLoggedIn ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 cursor-not-allowed opacity-70'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    onClick={onLoginWithFlow}
                    disabled={isConnecting}
                  >
                    <WalletIcon className="h-6 w-6" />
                    {isConnecting && flowUserLoggedIn ? 'Connecting...' : 'Login with Flow Wallet'}
                  </button>
                  {!flowUserLoggedIn && (
                    <p className="text-sm text-red-400 text-center">You must be logged into Flow to use this option.</p>
                  )}

                  {flowUserLoggedIn && (
                    <p className="text-sm text-yellow-400 text-center">
                      Please log out of Flow to use other Nostr connection options.
                    </p>
                  )}

                  <button
                    className={`w-full flex items-center justify-center gap-3 px-5 py-3 border border-transparent text-base font-medium rounded-md text-white ${
                      isOtherOptionsDisabled ? 'bg-gray-600 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    onClick={onLoginWithExtension}
                    disabled={isOtherOptionsDisabled}
                  >
                    <PuzzlePieceIcon className="h-6 w-6" />
                    {isConnecting ? 'Connecting...' : 'Login with Nostr Extension (e.g., Nos2x, Alby)'}
                  </button>

                  <button
                    className={`w-full flex items-center justify-center gap-3 px-5 py-3 border border-transparent text-base font-medium rounded-md text-white ${
                      isOtherOptionsDisabled ? 'bg-gray-600 cursor-not-allowed opacity-70' : 'bg-green-600 hover:bg-green-700'
                    }`}
                    onClick={onGenerateNewKeys}
                    disabled={isOtherOptionsDisabled}
                  >
                    <KeyIcon className="h-6 w-6" />
                    {isConnecting ? 'Generating...' : 'Generate New Nostr Keys'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default NostrLoginModal;