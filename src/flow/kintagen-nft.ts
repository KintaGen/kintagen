// src/flow/kintagen-nft.ts
import { useMemo,useState,useEffect } from 'react';
import { useFlowConfig, useFlowQuery,useFlowCurrentUser } from '@onflow/react-sdk';

// Import our new Cadence generators
import {
  getNftStoryScript,
  getOwnedNftsScript,
  getNftDisplaysScript,
  getNftStoriesScript
} from './cadence';

// --- REFACTORED Custom Hook for Fetching the Story ---

interface UseNftStoryProps {
  nftId: number;
  ownerAddress?: string;
}

/**
 * A hook to fetch the entire log history (the "story") for a single NFT.
 */
export const useNftStory = ({ nftId, ownerAddress }: UseNftStoryProps) => {
  const flowConfig = useFlowConfig();

  const cadenceScript = useMemo(() => {
    const contracts = flowConfig.addresses;
    if (!contracts?.ViewResolver || !contracts?.KintaGenNFT) {
      return null;
    }
    return getNftStoryScript({
      ViewResolver: contracts.ViewResolver,
      KintaGenNFT: contracts.KintaGenNFT,
      // Other addresses are not needed for this script
      NonFungibleToken: '',
      MetadataViews: '',
    });
  }, [flowConfig.addresses]);

  const { data: story, isLoading, error } = useFlowQuery({
    cadence: cadenceScript,
    args: (arg, t) => {
      if (!ownerAddress) return [];
      return [
        arg(ownerAddress, t.Address),
        arg(String(nftId), t.UInt64)
      ];
    },
    query: {
      enabled: !!cadenceScript && !!nftId && !!ownerAddress,
    }
  });

  return { story: story as any[] | null, isLoading, error };
};


// --- REFACTORED Helper Function for Adding a Log Entry ---

interface AddToLogProps {
  nftId: number;
  agent: string;
  actionDescription: string;
  outputCID: string;
}

// This function now takes the generated Cadence string as a parameter
export const addToLog = async (
  mutateFn: Function,
  cadence: string, // The dynamically generated transaction string
  props: AddToLogProps
) => {
  return mutateFn({
    cadence, // Use the passed-in string
    args: (arg, t) => [
      arg(String(props.nftId), t.UInt64),
      arg(props.agent, t.String),
      arg(props.actionDescription, t.String),
      arg(props.outputCID, t.String)
    ],
    // It's good practice to set a reasonable limit
    limit: 9999, 
  });
};


// --- Custom Hook for Fetching the Story ---

interface UseNftStoryProps {
  nftId: number;
  ownerAddress?: string;
}

// This interface defines the shape of all the contract addresses your app needs.
interface ContractAddresses {
  NonFungibleToken: string;
  KintaGenNFT: string;
  ViewResolver: string;
}


// --- Helper Function for Adding a Log Entry ---



  interface MintNftProps {
      agent: string;
      outputCID: string;
      runHash: string;
  }
  
  export const mintNft = (
    sendTx: (options: any) => void,
    cadence: string, // <-- ADDED: Now accepts the transaction string
    { agent, outputCID, runHash }: MintNftProps
  ) => {
    sendTx({
      cadence, // <-- CHANGED: Use the passed-in cadence string
      args: (arg, t) => [
        arg(agent, t.String),
        arg(outputCID, t.String),
        arg(runHash, t.String),
      ],
      limit: 9999,
    });
  };



interface UseOwnedNftsProps {
  address?: string; // The address of the user whose NFTs we want to fetch
}

/**
 * A custom hook to fetch all KintaGenNFT IDs owned by a specific address.
 */
export const useOwnedNfts = ({ address }: UseOwnedNftsProps) => {
  const flowConfig = useFlowConfig();

  const cadenceScript = useMemo(() => {
    const addresses = flowConfig.addresses;
    if (!addresses?.NonFungibleToken || !addresses?.KintaGenNFT) {
      return null;
    }
    return getOwnedNftsScript({
      NonFungibleToken: addresses.NonFungibleToken,
      KintaGenNFT: addresses.KintaGenNFT,
      ViewResolver: addresses.ViewResolver || '', 
    });
  }, [flowConfig.addresses]);

  // Destructure the `refetch` function from the query result
  const { data: nftIDs, isLoading, error, refetch } = useFlowQuery({
    cadence: cadenceScript,
    args: (arg, t) => {
      if (!address) return [];
      return [ arg(address, t.Address) ];
    },
    query: {
      enabled: !!address && !!cadenceScript,
      refetchInterval: 30000, 
    }
  });

  return { 
    nftIDs: nftIDs as string[] | null,
    isLoading, 
    error,
    refetchNfts: refetch, // Return the refetch function with a clear name
  };
};

// Define the shape of the Display struct from Cadence
interface NftDisplay {
  name: string;
  description: string;
  thumbnail: { url: string }; // and other properties
}
interface StoryStep {
  agent: string;
  action: string;
  resultCID: string;
  timestamp: string;
  name?: string; // Add name if it's part of the mint event data
}
export const useOwnedNftProjects = () => {
  const { user } = useFlowCurrentUser();
  const flowConfig = useFlowConfig();

  // Step 1: Get IDs and the refetch function for the IDs.
  const { nftIDs, isLoading: isLoadingIDs, error: idsError, refetchNfts } = useOwnedNfts({ address: user?.addr });

  // Step 2: Generate the bulk story script.
  const storiesScript = useMemo(() => {
    const addresses = flowConfig.addresses;
    if (!addresses?.ViewResolver || !addresses?.KintaGenNFT) {
      return null;
    }
    return getNftStoriesScript({
      ViewResolver: addresses.ViewResolver,
      KintaGenNFT: addresses.KintaGenNFT,
      NonFungibleToken: '',
    });
  }, [flowConfig.addresses]);

  // Step 3: Get stories and the refetch function for the stories.
  const { data: stories, isLoading: isLoadingStories, error: storiesError, refetch: refetchStories } = useFlowQuery({
    cadence: storiesScript,
    args: (arg, t) => {
      if (!user?.addr || !nftIDs) return [];
      return [
        arg(user.addr, t.Address),
        arg(nftIDs.map(id => String(id)), t.Array(t.UInt64))
      ];
    },
    query: {
      enabled: !!storiesScript && !!user?.addr && !!nftIDs && nftIDs.length > 0,
    }
  });

  // This new function will refetch both queries in sequence for a full refresh.
  const refetchProjects = async () => {
    // First, refetch the list of IDs.
    await refetchNfts();
    // Then, refetch the stories for those IDs.
    await refetchStories();
  };
  
  // Step 4: Transform the raw on-chain data into the `Project[]` array.
  const projects = useMemo(() => {
    if (!stories || !nftIDs || stories.length !== nftIDs.length) return [];
    
    return (stories as (StoryStep[] | null)[])
      .map((story, index) => {
        if (!story || story.length === 0) return null;
        
        const creationStep = story[0];
        const nftId = nftIDs[index];
        
        return {
          id: nftId,
          name: creationStep.name || `Project by ${creationStep.agent}`,
          description: creationStep.action,
          nft_id: nftId,
          story: story,
        };
      })
      .filter((p): p is Project => p !== null);
      
  }, [stories, nftIDs]);

  return {
    projects,
    isLoading: isLoadingIDs || isLoadingStories,
    error: idsError || storiesError,
    refetchProjects, // Return our combined refetch function
  };
};

// Define the Project type here or import it if it's in a shared types file
interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  nft_id: number;
  story?: any[]; 
}