// src/flow/kintagen-nft.ts
import { useMemo,useEffect,useState } from 'react';
import { useFlowConfig, useFlowQuery, useFlowCurrentUser } from '@onflow/react-sdk';
import {
  getNftLogbookScript,
  getOwnedNftsScript,
  getNftStoriesScript
} from './cadence';

// --- Custom Hook for Fetching a Single NFT Story ---

interface UseNftStoryProps {
  nftId: number;
  ownerAddress?: string;
}

export const useNftStory = ({ nftId, ownerAddress }: UseNftStoryProps) => {
  const flowConfig = useFlowConfig(); 

  // Memoize the script generation to prevent re-running on every render
  const cadenceScript = useMemo(() => { 
    const addresses = flowConfig.addresses;
    if (!addresses?.ViewResolver || !addresses?.KintaGenNFT || !addresses?.NonFungibleToken) {
      return null;
    }
    return getNftLogbookScript(addresses as any);
  }, [flowConfig.addresses]);

  // Use the data-fetching hook provided by the SDK
  const { data, isLoading, error } = useFlowQuery({ 
    cadence: cadenceScript,
    args: (arg, t) => {
      // This guard prevents the arg() function from ever being called with undefined values.
      if (!ownerAddress || nftId === undefined) {
        return []; 
      }
      
      // Only when the values are valid do we build the arguments array.
      return [
        arg(ownerAddress, t.Address), // No "!" needed because of the guard
        arg(String(nftId), t.UInt64)   // No "!" needed
      ];
    },
    query: {
      enabled: !!cadenceScript && !!ownerAddress && typeof nftId === 'number',
    }
  });

  // Return the final data structure
  return {
    projectName: data?.projectName,
    story: data?.story,
    isLoading,
    error,
  };
};



// --- Helper Function for Adding a Log Entry ---

interface AddToLogProps {
  nftId: number;
  agent: string;
  title: string;
  details: string;
  cid: string;
}

export const addToLog = async (
  mutateFn: Function,
  cadence: string,
  props: AddToLogProps
) => {
  return mutateFn({
    cadence,
    args: (arg, t) => [
      arg(String(props.nftId), t.UInt64),
      arg(props.agent, t.String),
      arg(props.title, t.String),
      arg(props.details, t.String),
      arg(props.cid, t.String)
    ],
    limit: 9999, 
  });
};

// --- Helper Function for Minting an NFT ---

interface MintNftProps {
    recipient: string;
    project: string;
    summary: string;
    cid: string;
    investigator: string;
    runHash: string;
}
  
export const mintNft = (
  sendTx: (options: any) => void,
  cadence: string,
  props: MintNftProps
) => {
  sendTx({
    cadence,
    args: (arg, t) => [
      arg(props.recipient, t.Address),
      arg(props.project, t.String),
      arg(props.summary, t.String),
      arg(props.cid, t.String),
      arg(props.investigator, t.String),
      arg(props.runHash, t.String),
    ],
    limit: 9999,
  });
};

// --- Custom Hook for Fetching Owned NFTs ---

interface UseOwnedNftsProps {
  address?: string;
}

export const useOwnedNfts = ({ address }: UseOwnedNftsProps) => {
  const flowConfig = useFlowConfig();

  const cadenceScript = useMemo(() => {
    const addresses = flowConfig.addresses;
    // Use "KintaGenNFT" from config
    if (!addresses?.NonFungibleToken || !addresses?.KintaGenNFT) {
      return null;
    }
    return getOwnedNftsScript({
      NonFungibleToken: addresses.NonFungibleToken,
      KintaGenNFT: addresses.KintaGenNFT, // Pass address using config key
      ViewResolver: '',
      MetadataViews: '',
    });
  }, [flowConfig.addresses]);

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
    refetchNfts: refetch,
  };
};

// --- Custom Hook for Aggregating Owned Projects ---

interface StoryStep {
  stepNumber: number;
  agent: string;
  title: string;
  description: string;
  ipfsHash: string;
  timestamp: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  nft_id: string;
  story: StoryStep[];
}

export const useOwnedNftProjects = () => {
  const { user } = useFlowCurrentUser();
  const flowConfig = useFlowConfig();

  // Step 1: Get NFT IDs (this part is unchanged)
  const { nftIDs, isLoading: isLoadingIDs, error: idsError, refetchNfts } = useOwnedNfts({ address: user?.addr });

  // Step 2: Generate the bulk project info script (this uses our updated script)
  const storiesScript = useMemo(() => {
    const addresses = flowConfig.addresses;
    if (!addresses?.ViewResolver || !addresses?.KintaGenNFT) return null;
    return getNftStoriesScript({
      ViewResolver: addresses.ViewResolver,
      KintaGenNFT: addresses.KintaGenNFT,
      NonFungibleToken: addresses.NonFungibleToken, // Add other needed addresses
      MetadataViews: addresses.MetadataViews,
    });
  }, [flowConfig.addresses]);

  // Step 3: Fetch the project data (this part is unchanged)
  const { data: rawProjects, isLoading: isLoadingStories, error: storiesError, refetch: refetchStories } = useFlowQuery({
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

  const refetchProjects = async () => {
    await refetchNfts();
    await refetchStories();
  };
  
  // Step 4: Transform the data (this is now much simpler and correct)
  const projects = useMemo(() => {
    if (!rawProjects) return [];
    
    // The script now returns exactly the data we need. We just map it.
    return (rawProjects as any[])
      .map((p) => {
        if (!p) return null;
        
        return {
          id: p.id,
          name: p.name,           // CORRECT: Using the real name from the NFT
          description: p.description, // CORRECT: Using the real summary from the NFT
          nft_id: p.id,         // Keep for consistency
          story: p.story,
        };
      })
      .filter((p): p is Project => p !== null);
      
  }, [rawProjects]);

  return {
    projects,
    isLoading: isLoadingIDs || isLoadingStories,
    error: idsError || storiesError,
    refetchProjects,
  };
};