import React, { useState, useEffect } from 'react';
import { 
  KeyIcon, 
  LockClosedIcon, 
  UserPlusIcon, 
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
// We need the imperative 'readContract' action from wagmi
import { readContract } from 'wagmi/actions';
import { accessKeyAbi } from '../lit/accessKeyAbi';
// We need the wagmi config object from main.tsx to use actions
import { config } from '../main';

// --- TYPE DEFINITIONS ---
interface EncryptedFileRecord {
  cid: string;
  title: string;
  is_encrypted: boolean;
  lit_token_id: string;
  uploaded_at: string;
}

// --- CONSTANTS ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ACCESS_MANAGER_CONTRACT_ADDRESS = "0x5bc5A6E3dD358b67A752C9Dd58df49E863eA95F2";

const AccessControlPage: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [ownedFiles, setOwnedFiles] = useState<EncryptedFileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<EncryptedFileRecord | null>(null);
  const [grantToAddress, setGrantToAddress] = useState('');

  // --- WAGMI HOOKS ---
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // --- DATA FETCHING & OWNERSHIP CHECKING ---
  useEffect(() => {
    const fetchAndFilterFiles = async () => {
      // Don't do anything if the wallet is not connected.
      if (!address) {
        setOwnedFiles([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch the complete list of ALL encrypted files from the backend.
        const [papersRes, experimentsRes] = await Promise.all([
          fetch(`${API_BASE}/data/paper?is_encrypted=true`),
          fetch(`${API_BASE}/data/experiment?is_encrypted=true`)
        ]);
        if (!papersRes.ok || !experimentsRes.ok) throw new Error('Failed to fetch data from the server.');
        
        const allEncryptedFiles = [
          ...(await papersRes.json()).data || [],
          ...(await experimentsRes.json()).data || []
        ].filter(item => item.is_encrypted && item.lit_token_id);

        if (allEncryptedFiles.length === 0) {
          setOwnedFiles([]); // No files to check
          return;
        }

        // 2. Prepare the arguments for the 'balanceOfBatch' call.
        const tokenIds = allEncryptedFiles.map(file => BigInt(file.lit_token_id));
        const ownerAddresses = allEncryptedFiles.map(() => address as `0x${string}`); // Repeat user's address for each token

        // 3. Use the 'readContract' action to check all balances in a single RPC call.
        const balances = await readContract(config, {
            address: ACCESS_MANAGER_CONTRACT_ADDRESS,
            abi: accessKeyAbi,
            functionName: 'balanceOfBatch',
            args: [ownerAddresses, tokenIds],
        });

        // 4. Filter the files based on the balances returned from the contract.
        const userOwnedFiles = allEncryptedFiles.filter((_file, index) => {
          const balance = balances[index];
          return balance > 0;
        });

        setOwnedFiles(userOwnedFiles);

      } catch (err: any) {
        setError(err.message);
        console.error("Failed to fetch or filter files:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndFilterFiles();
  }, [address]); // This effect re-runs whenever the connected wallet address changes.

  // Effect to close modal after a successful grant transaction.
  useEffect(() => {
    if (isConfirmed) {
      setSelectedFile(null);
      setGrantToAddress('');
      // Optional: you could show a success toast here
    }
  }, [isConfirmed]);

  // --- HANDLERS ---
  const handleGrantAccessClick = () => {
    if (!selectedFile || !grantToAddress.trim()) return;
    writeContract({
      address: ACCESS_MANAGER_CONTRACT_ADDRESS,
      abi: accessKeyAbi,
      functionName: 'grantAccess',
      args: [grantToAddress as `0x${string}`, BigInt(selectedFile.lit_token_id)],
    });
  };

  // --- RENDER LOGIC ---
  const renderContent = () => {
    if (!isConnected) {
      return <div className="p-6 text-center text-yellow-400 bg-yellow-900/50 border border-yellow-700 rounded-lg flex items-center justify-center gap-3"><ExclamationTriangleIcon className="h-6 w-6"/>Please connect your wallet to view your encrypted files.</div>;
    }
    if (isLoading) {
      return <div className="p-6 text-center text-gray-400 flex items-center justify-center"><ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />Loading your encrypted files...</div>;
    }
    if (error) {
      return <p className="p-6 text-red-400">Error: {error}</p>;
    }
    if (ownedFiles.length > 0) {
      return ownedFiles.map((item) => (
        <li key={item.cid} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-grow overflow-hidden">
            <p className="text-lg font-semibold text-white truncate flex items-center" title={item.title}>
              <LockClosedIcon className="h-4 w-4 mr-2 text-amber-400 flex-shrink-0" />
              {item.title}
            </p>
            <div className="text-xs text-gray-500 mt-2 space-x-4">
              <span className="font-mono" title={`Token ID: ${item.lit_token_id}`}>Token ID: {item.lit_token_id}</span>
              <span className="truncate" title={`CID: ${item.cid}`}>CID: {item.cid}</span>
            </div>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <button onClick={() => setSelectedFile(item)} className="w-full flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-500">
              <UserPlusIcon className="h-5 w-5 mr-2" />
              Grant Access
            </button>
          </div>
        </li>
      ));
    }
    return <li className="p-6 text-center text-gray-500">You do not hold any access keys for existing encrypted files.</li>;
  };

  return (
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Access Control Management</h1>
          {isConnected ? ( <div className="text-right"><p className="text-sm text-green-400">Connected: {`${address?.substring(0, 6)}...`}</p><button onClick={() => disconnect()} className="text-xs text-gray-400 hover:text-white">Disconnect</button></div>) : (<button onClick={() => connect({ connector: connectors[0] })} className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-500">Connect Wallet</button>)}
        </div>
        <p className="text-gray-400 mb-8">
          View encrypted files for which you hold an access key and grant access to other users.
        </p>
        <div className="bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-xl font-semibold">Your Gated Files</h2>
          </div>
          <ul className="divide-y divide-gray-700">{renderContent()}</ul>
        </div>
      </div>

      {selectedFile && (
        <div className="modal-backdrop">
          <div className="modal-content card">
            <h2 className="text-xl font-bold mb-2">Grant Access Key</h2>
            <p className="text-sm text-gray-400 mb-4">You are issuing a key for "<span className="font-semibold text-white">{selectedFile.title}</span>" (Token ID: {selectedFile.lit_token_id}).</p>
            <div>
              <label htmlFor="grantAddress" className="block text-sm font-medium text-gray-300 mb-2 flex items-center"><UserCircleIcon className="h-5 w-5 mr-2" />Recipient Address</label>
              <input id="grantAddress" type="text" placeholder="Enter user address (0x...)" value={grantToAddress} onChange={e => setGrantToAddress(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none" />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={handleGrantAccessClick} disabled={!grantToAddress || isPending || isConfirming} className="flex-1 flex items-center justify-center bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-500 disabled:bg-gray-600">
                {isPending || isConfirming ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <KeyIcon className="h-5 w-5 mr-2" />}
                {isPending ? 'Sending...' : isConfirming ? 'Confirming...' : 'Confirm & Grant'}
              </button>
              <button onClick={() => setSelectedFile(null)} className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 px-4 rounded-lg">Cancel</button>
            </div>
            <div className="mt-4 min-h-[40px]">
              {isConfirming && <p className="text-sm text-center text-blue-300">Waiting for transaction confirmation...</p>}
              {isConfirmed && <div className="text-green-400 flex items-center justify-center"><CheckCircleIcon className="h-5 w-5 mr-2"/>Access granted successfully!</div>}
              {contractError && <div className="text-red-300 flex items-start space-x-2 text-sm"><XCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" /><span>Error: {contractError.shortMessage}</span></div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AccessControlPage;