import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, getPublicKey, type Event as NostrEvent } from 'nostr-tools/pure';
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

export interface NostrProfile {
    name?: string;
    about?: string;
    picture?: string;
    flowWalletAddress?: string;
    links?: NostrLink[];
    pubkey?: string;
    // Add created_at to NostrProfile for local sorting if needed, though typically it's on the Event
    created_at?: number;
}

// Extend NostrEvent type to include `id` and `pubkey` as mandatory for easier use
export interface AppNostrEvent extends NostrEvent {
  id: string;
  pubkey: string;
}

interface NostrContextType {
    pubkey: string | null;
    privKey: Uint8Array | null;
    profile: NostrProfile | null;
    connect: () => Promise<{ pubkey: string; privKey: Uint8Array } | null>;
    updateProfile: (name: string, about: string, links: NostrLink[], flowWalletAddress?: string, picture?: string) => Promise<void>;
    fetchProfileByFlowWalletAddress: (flowAddr: string) => Promise<NostrProfile | null>;
    fetchAllProfiles: () => Promise<NostrProfile[]>;
    fetchProfileByPubkey: (pubkey: string) => Promise<NostrProfile | null>;
    isLoading: boolean;
    // NEW: Feedback message related state and functions
    feedbackMessages: AppNostrEvent[];
    isLoadingFeedbackMessages: boolean;
    sendFeedback: (message: string, groupChatId: string) => Promise<void>;
    getNostrTime: (timestamp: number) => string; // Expose time formatter
    // profiles for messages, managed within context
    getProfileForMessage: (pubkey: string) => NostrProfile | undefined;
}

const NostrContext = createContext<NostrContextType | null>(null);

// Hardcoded Group Chat ID for feedback
const FEEDBACK_GROUP_CHAT_ID = '3cf3df85c1ee58b712e7296c0d2ec66a68f9b9ccc846b63d2f830d974aa447cd';

export const NostrProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: flowUser } = useFlowCurrentUser();

  const [pool] = useState(() => new SimplePool());
  const [privKey, setPrivKey] = useState<Uint8Array | null>(null);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // NEW: Feedback specific state
  const [feedbackMessages, setFeedbackMessages] = useState<AppNostrEvent[]>([]);
  const [isLoadingFeedbackMessages, setIsLoadingFeedbackMessages] = useState(true);
  const [cachedProfiles, setCachedProfiles] = useState<{[pubkey: string]: NostrProfile}>({}); // Cache profiles for messages

  // Helper: Convert Flow Signature to Nostr Private Key (Uint8Array)
  const deriveNostrKey = async (signatureHex: string): Promise<Uint8Array> => {
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    const hash = await crypto.subtle.digest('SHA-256', signatureBytes);
    return new Uint8Array(hash);
  };

  // Helper: Fetch Profile from Relays using pool.get
  const fetchProfile = useCallback(async (pkHex: string) => {
    // This is for the *current user's* profile when connecting.
    // The `fetchProfileByPubkey` below is for arbitrary profiles.
    setIsLoading(true);
    try {
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

      fetchProfile(pk); // Fetch current user's profile

      return { pubkey: pk, privKey: sk };

    } catch (error) {
      console.error("Nostr Login Error:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [flowUser, fetchProfile]);

  const updateProfile = async (name: string, about: string, links: NostrLink[], flowWalletAddress?: string, picture?: string) => {
    if (!privKey || !pubkey) return;

    const content = JSON.stringify({
        name,
        about,
        picture,
        links,
        flowWalletAddress
    });
    const tags: string[][] = [];
    if (flowWalletAddress) {
      tags.push(["f", flowWalletAddress]);
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
      setProfile({ name, about, picture, links, flowWalletAddress, pubkey }); // Update local state with pubkey
      // Also update cachedProfiles for this pubkey if it exists
      setCachedProfiles(prev => ({
        ...prev,
        [pubkey]: { name, about, picture, links, flowWalletAddress, pubkey }
      }));
    } catch (error) {
      console.error("Failed to publish to any relay", error);
      throw new Error("Could not save profile to the network.");
    }
  };

  const fetchProfileByFlowWalletAddress = useCallback(async (flowAddr: string): Promise<NostrProfile | null> => {
    try {
      const event = await pool.get(RELAYS, {
        kinds: [0],
        "#f": [flowAddr],
      });
      if (event) {
        try {
          const content = JSON.parse(event.content);
          return { ...content, pubkey: event.pubkey } as NostrProfile;
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

  const fetchProfileByPubkey = useCallback(async (targetPubkey: string): Promise<NostrProfile | null> => {
    if (!targetPubkey) return null;
    // Check cache first
    if (cachedProfiles[targetPubkey]) {
        return cachedProfiles[targetPubkey];
    }
    try {
      const event = await pool.get(RELAYS, {
        kinds: [0],
        authors: [targetPubkey],
      });

      if (event) {
        try {
          const content = JSON.parse(event.content);
          const fullProfile: NostrProfile = { ...content, pubkey: event.pubkey };
          setCachedProfiles(prev => ({ ...prev, [targetPubkey]: fullProfile })); // Cache it
          return fullProfile;
        } catch (e) {
          console.error(`Failed to parse profile JSON for pubkey ${targetPubkey}:`, e);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error(`Error fetching Nostr profile for pubkey ${targetPubkey}:`, error);
      return null;
    }
  }, [pool, cachedProfiles]); // Add cachedProfiles to dependencies

  const fetchAllProfiles = useCallback(async (): Promise<NostrProfile[]> => {
    try {
      const events = await pool.querySync(RELAYS, {
        kinds: [0],
        "#A": ["kintagendemo-v0"],
      });

      const profilesMap = new Map<string, NostrProfile>();

      for (const event of events) {
        try {
          const content = JSON.parse(event.content);
          const currentProfile: NostrProfile = { ...content, pubkey: event.pubkey };

          const existingProfile = profilesMap.get(event.pubkey);
          if (!existingProfile || event.created_at > (existingProfile as any).created_at) {
            (currentProfile as any).created_at = event.created_at;
            profilesMap.set(event.pubkey, currentProfile);
          }
        } catch (e) {
          console.error(`Error parsing profile from event ${event.id}:`, e);
        }
      }
      const fetchedProfiles = Array.from(profilesMap.values());
      // Update the general cached profiles as well
      setCachedProfiles(prev => {
        const newCache = { ...prev };
        fetchedProfiles.forEach(p => {
            if (p.pubkey) newCache[p.pubkey] = p;
        });
        return newCache;
      });
      return fetchedProfiles;
    } catch (error) {
      console.error("Error fetching all Nostr profiles:", error);
      return [];
    }
  }, [pool]);

  // NEW: Helper for time formatting
  const getNostrTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp * 1000); // Nostr timestamps are in seconds
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  // NEW: Send Feedback function
  const sendFeedback = useCallback(async (message: string, groupChatId: string) => {
    if (!privKey || !pubkey) {
      throw new Error("User not logged in.");
    }

    const tags = [
      ['e', groupChatId, '', 'root'],
      ['p', pubkey, ''],
      ['t', 'feedback'],
    ];

    const eventTemplate: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: 42, // Regular text note
      pubkey: pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: message.trim(),
    };

    const signedEvent = finalizeEvent(eventTemplate, privKey);

    try {
      await Promise.any(pool.publish(RELAYS, signedEvent));
      // Optimistically add own message to display
      setFeedbackMessages(prevMessages => [...prevMessages, signedEvent as AppNostrEvent].sort((a, b) => a.created_at - b.created_at));
      // Ensure current user's profile is in cache for immediate display
      if (!cachedProfiles[pubkey]) {
        fetchProfileByPubkey(pubkey); // this will also update cachedProfiles
      }
    } catch (err) {
      console.error("Failed to publish feedback:", err);
      throw new Error("Failed to send feedback. Please try again.");
    }
  }, [privKey, pubkey, pool, fetchProfileByPubkey, cachedProfiles]);


  // NEW: Effect to subscribe to feedback messages
  useEffect(() => {
    const filter = {
      kinds: [42], // Regular text notes
      '#e': [FEEDBACK_GROUP_CHAT_ID], // Events that reply to or reference the group chat's root event
      limit: 50, // Fetch up to 50 recent messages
    };

    pool.subscribe(RELAYS, filter, {
        onevent: (event: NostrEvent) => {
            const appEvent = event as AppNostrEvent;
            // Trigger profile fetch for the sender if not already in cache
            if (!cachedProfiles[appEvent.pubkey]) {
                fetchProfileByPubkey(appEvent.pubkey);
            }

            setFeedbackMessages(prevMessages => {
                if (!prevMessages.some(msg => msg.id === appEvent.id)) {
                    return [...prevMessages, appEvent].sort((a, b) => a.created_at - b.created_at);
                }
                return prevMessages;
            });
            setIsLoadingFeedbackMessages(false);
        },
        oneose: () => {
          setIsLoadingFeedbackMessages(false);
        }
    });

    return () => {
      pool.close([]);
      // Keep pool open as it's used elsewhere, but clean up this specific subscription
    };
  }, [pool, fetchProfileByPubkey, cachedProfiles]); // Dependencies for useEffect

  // Helper to get profile from context's cache
  const getProfileForMessage = useCallback((targetPubkey: string): NostrProfile | undefined => {
    // Attempt to get from cache immediately
    if (cachedProfiles[targetPubkey]) {
      return cachedProfiles[targetPubkey];
    }
    // If not in cache, trigger an async fetch but return undefined for now
    fetchProfileByPubkey(targetPubkey);
    return undefined;
  }, [cachedProfiles, fetchProfileByPubkey]);


  // Cleanup on unmount (for the overall pool, not just feedback subscription)
  useEffect(() => {
    return () => {
      pool.close(RELAYS); // Close all connections when provider unmounts
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
        fetchAllProfiles,
        fetchProfileByPubkey,
        isLoading,
        // NEW: Feedback related values
        feedbackMessages,
        isLoadingFeedbackMessages,
        sendFeedback,
        getNostrTime,
        getProfileForMessage,
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