import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
// 1. UPDATED IMPORTS based on documentation
import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import * as fcl from "@onflow/fcl";
fcl.config()
   .put("accessNode.api", "https://rest-testnet.onflow.org")
   .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn");
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.snort.social'
];
export interface NostrLink {
    title: string;
    url: string;
  }
interface NostrProfile {
  name?: string;
  about?: string;
  picture?: string;
  flowWalletAddress?: string; // Added flowWalletAddress
  links?: NostrLink[]; // Ensure links are part of the profile interface
}

interface NostrContextType {
    pubkey: string | null;
    privKey: Uint8Array | null;
    profile: NostrProfile | null;
    // UPDATE: Return the keys on success, or null on failure
    connect: () => Promise<{ pubkey: string; privKey: Uint8Array } | null>; 
    updateProfile: (name: string, about: string, links: NostrLink[], flowWalletAddress?: string, picture?: string) => Promise<void>;
    fetchProfileByFlowWalletAddress: (flowAddr: string) => Promise<NostrProfile | null>;
    isLoading: boolean;
  }

const NostrContext = createContext<NostrContextType | null>(null);

export const NostrProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: flowUser } = useFlowCurrentUser();
  
  // Initialize pool. Doc says: "Doesn't matter what you do, you always should be using a SimplePool"
  const [pool] = useState(() => new SimplePool());
  
  // Sk must be Uint8Array for finalizeEvent
  const [privKey, setPrivKey] = useState<Uint8Array | null>(null);
  
  // Pk is a hex string
  const [pubkey, setPubkey] = useState<string | null>(null);
  
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Helper: Convert Flow Signature to Nostr Private Key (Uint8Array)
  const deriveNostrKey = async (signatureHex: string): Promise<Uint8Array> => {
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    const hash = await crypto.subtle.digest('SHA-256', signatureBytes);
    return new Uint8Array(hash);
  };

  // 2. Fetch Profile from Relays using pool.get
  const fetchProfile = useCallback(async (pkHex: string) => {
    setIsLoading(true);
    try {
      // Kind 0 = Metadata
      const event = await pool.get(RELAYS, {
        kinds: [0],
        authors: [pkHex],
      });

      if (event) {
        try {
          const content = JSON.parse(event.content);
          setProfile(content);
        } catch (e) {
          console.error("Failed to parse profile JSON", e);
        }
      }
    } catch (error) {
      console.error("Error fetching Nostr profile:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pool]);

  // 3. Connect (Login logic)
  const connect = useCallback(async () => {
    if (!flowUser?.loggedIn || !flowUser?.addr) return null;
    setIsLoading(true);

    try {
      const messageToSign = "Sign this message to login to KintaGen via Nostr. This generates your deterministic keys.";
      
      const hexMessage = Array.from(new TextEncoder().encode(messageToSign))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const signatures = await fcl.currentUser.signUserMessage(hexMessage);
      const userSignature = signatures.find((s: any) => s.addr === flowUser.addr);

      if (!userSignature) throw new Error("No signature found.");

      const sk = await deriveNostrKey(userSignature.signature);
      const pk = getPublicKey(sk);

      setPrivKey(sk);
      setPubkey(pk);

      // Fetch existing data (non-blocking)
      fetchProfile(pk);

      // RETURN THE KEYS IMMEDIATELY
      return { pubkey: pk, privKey: sk };

    } catch (error) {
      console.error("Nostr Login Error:", error);
      // Don't alert here, let the caller decide how to handle the cancellation
      return null; 
    } finally {
      setIsLoading(false);
    }
  }, [flowUser, fetchProfile]);

  // 4. Update Profile (Write to Relays)
  const updateProfile = async (name: string, about: string, links: NostrLink[], flowWalletAddress?: string, picture?: string) => {
    if (!privKey || !pubkey) return;

    // We save the links array directly into the content JSON
    const content = JSON.stringify({ 
        name, 
        about, 
        picture,
        links, // <--- Included in JSON
        flowWalletAddress // Included flowWalletAddress in the JSON
    });
    const tags: string[][] = [];
    if (flowWalletAddress) {
      tags.push(["f", flowWalletAddress]); // Add the custom tag
    }
    tags.push(["A","kintagendemo-v0"]);
    const eventTemplate = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: content,
    };

    const signedEvent = finalizeEvent(eventTemplate, privKey);

    try {
      await Promise.any(pool.publish(RELAYS, signedEvent));
      // Optimistic update
      setProfile({ name, about, picture, links, flowWalletAddress }); // Update local state with flowWalletAddress
    } catch (error) {
      console.error("Failed to publish to any relay", error);
      throw new Error("Could not save profile to the network.");
    }
  };
  const fetchProfileByFlowWalletAddress = useCallback(async (flowAddr: string): Promise<NostrProfile | null> => {
    try {
      // Query for kind 0 events that have a ["f", flowAddr] tag
      const event = await pool.get(RELAYS, {
        kinds: [0],
        "#f": [flowAddr], // Filter by the custom "f" tag
      });
      console.log(event)
      if (event) {
        try {
          const content = JSON.parse(event.content);
          return content as NostrProfile;
        } catch (e) {
          console.error("Failed to parse profile JSON from event found by Flow address", e);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching Nostr profile by Flow wallet address:", error);
      return null;
    }
  }, [pool]);
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // In v2, we can close connections if needed, though SimplePool manages them fairly well.
      // pool.close(RELAYS); 
    };
  }, [pool]);

  return (
    <NostrContext.Provider value={
      { 
        pubkey,
        privKey,
        profile,
        connect,
        updateProfile,
        fetchProfileByFlowWalletAddress,
        isLoading
      }
    }>
      {children}
    </NostrContext.Provider>
  );
};

export const useNostr = () => {
  const context = useContext(NostrContext);
  if (!context) throw new Error('useNostr must be used within NostrProvider');
  return context;
};