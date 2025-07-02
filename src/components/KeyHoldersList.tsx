import React, { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';
import { ArrowPathIcon, UserCircleIcon } from '@heroicons/react/24/solid';

interface KeyHoldersListProps {
  contractAddress: `0x${string}`;
  tokenId: string;
}

export const KeyHoldersList: React.FC<KeyHoldersListProps> = ({ contractAddress, tokenId }) => {
  const { address: connectedAddress } = useAccount();
  // Get the correctly configured public client from wagmi's context
  const publicClient = usePublicClient();
  
  const [holders, setHolders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHolders = async () => {
      // Don't run if the wagmi client isn't ready yet.
      if (!tokenId || !publicClient) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        // This getLogs call will now correctly use the proxied connection.
        const logs = await publicClient.getLogs({
          address: contractAddress,
          event: parseAbiItem('event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'),
          args: { id: BigInt(tokenId) },
          fromBlock: 0n,
          toBlock: 'latest'
        });

        const balances: { [address: string]: number } = {};
        const zeroAddress = '0x0000000000000000000000000000000000000000';

        for (const log of logs) {
          const { from, to } = log.args;
          if (from && from !== zeroAddress) balances[from] = (balances[from] || 0) - 1;
          if (to && to !== zeroAddress) balances[to] = (balances[to] || 0) + 1;
        }

        const currentHolders = Object.keys(balances).filter(address => balances[address] > 0);
        setHolders(currentHolders);

      } catch (err: any) {
        console.error("Failed to fetch key holders:", err);
        setError("Could not fetch key holder information.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHolders();
  }, [contractAddress, tokenId, publicClient]);

  if (isLoading) {
    return <div className="text-sm text-gray-400 flex items-center gap-2"><ArrowPathIcon className="h-4 w-4 animate-spin" />Loading key holders...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-2">
      {holders.length > 0 ? (
        holders.map(holderAddress => (
          <div key={holderAddress} className="flex items-center gap-2 text-sm bg-gray-700/50 p-2 rounded-md">
            <UserCircleIcon className="h-5 w-5 text-gray-400" />
            <span className="font-mono">{holderAddress}</span>
            {holderAddress.toLowerCase() === connectedAddress?.toLowerCase() && (
              <span className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full ml-auto">You</span>
            )}
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-500">No one currently holds this key.</p>
      )}
    </div>
  );
};