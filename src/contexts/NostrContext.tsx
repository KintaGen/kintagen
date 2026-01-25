import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, getPublicKey, type Event as NostrEvent, generateSecretKey } from 'nostr-tools/pure';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import * as fcl from "@onflow/fcl";
import { nip19 } from 'nostr-tools';

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
    created_at?: number; // Keep as optional for consistency with parsed data
}

export interface AppNostrEvent extends NostrEvent {
  id: string;
  pubkey: string;
}

interface NostrContextType {
    pubkey: string | null;
    privKey: Uint8Array | null;
    profile: NostrProfile | null;
    connectWithFlow: () => Promise<{ pubkey: string; privKey: Uint8Array } | null>;
    connectWithExtension: () => Promise<{ pubkey: string; privKey: Uint8Array } | null>;
    generateAndConnectKeys: () => Promise<{ pubkey: string; privKey: Uint8Array } | null>;
    updateProfile: (name: string, about: string, links: NostrLink[], flowWalletAddress?: string, picture?: string) => Promise<void>;
    fetchProfileByFlowWalletAddress: (flowAddr: string) => Promise<NostrProfile | null>;
    fetchAllProfiles: () => Promise<NostrProfile[]>;
    fetchProfileByPubkey: (pubkey: string) => Promise<NostrProfile | null>;
    isLoading: boolean;
    feedbackMessages: AppNostrEvent[];
    isLoadingFeedbackMessages: boolean;
    sendFeedback: (message: string, groupChatId: string) => Promise<void>;
    getNostrTime: (timestamp: number) => string;
    getProfileForMessage: (pubkey: string) => NostrProfile | undefined;
    showNostrLoginModal: boolean;
    openNostrLoginModal: () => void;
    closeNostrLoginModal: () => void;
    logoutFlow: () => Promise<void>;
    logoutNostr: () => void;
}

const NostrContext = createContext<NostrContextType | null>(null);

const FEEDBACK_GROUP_CHAT_ID = '3cf3df85c1ee58b712e7296c0d2ec66a68f9b9ccc846b63d2f830d974aa447cd';

export const NostrProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: flowUser, flowLogOut } = useFlowCurrentUser();

  const [pool] = useState(() => new SimplePool());
  const [privKey, setPrivKey] = useState<Uint8Array | null>(null);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [feedbackMessages, setFeedbackMessages] = useState<AppNostrEvent[]>([]);
  const [isLoadingFeedbackMessages, setIsLoadingFeedbackMessages] = useState(true);
  const [cachedProfiles, setCachedProfiles] = useState<{[pubkey: string]: NostrProfile}>({});

  const [showNostrLoginModal, setShowNostrLoginModal] = useState(false);
  const openNostrLoginModal = useCallback(() => setShowNostrLoginModal(true), []);
  const closeNostrLoginModal = useCallback(() => setShowNostrLoginModal(false), []);

  const logoutNostr = useCallback(() => {
    if (pubkey) {
      console.log("Logging out of Nostr session...");
      setPubkey(null);
      setPrivKey(null);
      setProfile(null);
      setFeedbackMessages([]);
      setCachedProfiles({});
    }
  }, [pubkey]);

  const logoutFlow = useCallback(async () => {
    if (flowUser?.loggedIn) {
      console.log("Logging out of Flow wallet...");
      await flowLogOut();
    }
  }, [flowUser?.loggedIn]);


  // --- Helper Functions (unchanged) ---
  const deriveNostrKey = async (signatureHex: string): Promise<Uint8Array> => {
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    const hash = await crypto.subtle.digest('SHA-256', signatureBytes);
    return new Uint8Array(hash);
  };

  const fetchProfile = useCallback(async (pkHex: string) => {
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
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error fetching Nostr profile:", error);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [pool]);

  // --- Login Functions ---

  const connectWithFlow = useCallback(async () => {
    if (!flowUser?.loggedIn || !flowUser?.addr) {
      alert("Please log in to your Flow wallet first.");
      return null;
    }
    setIsLoading(true);
    try {
      await logoutNostr();

      const messageToSign = "Sign this message to login to KintaGen via Nostr. This generates your deterministic keys.";

      const hexMessage = Array.from(new TextEncoder().encode(messageToSign))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const signatures = await fcl.currentUser.signUserMessage(hexMessage);
      const userSignature = signatures.find((s: any) => s.addr === flowUser.addr);

      if (!userSignature) throw new Error("No signature found or signature cancelled.");

      const sk = await deriveNostrKey(userSignature.signature);
      const pk = getPublicKey(sk);

      setPrivKey(sk);
      setPubkey(pk);
      fetchProfile(pk);
      closeNostrLoginModal();
      return { pubkey: pk, privKey: sk };

    } catch (error) {
      console.error("Nostr Login (Flow) Error:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [flowUser, fetchProfile, closeNostrLoginModal, logoutNostr]);

  const connectWithExtension = useCallback(async () => {
    if (!window.nostr) {
      alert("Nostr extension (e.g., Alby, Nos2x) not found. Please install one.");
      return null;
    }
    setIsLoading(true);
    try {
      await logoutFlow();
      await logoutNostr();

      const pk = await window.nostr.getPublicKey();
      setPrivKey(null);
      setPubkey(pk);
      fetchProfile(pk);
      closeNostrLoginModal();
      return { pubkey: pk, privKey: null as any };
    } catch (error) {
      console.error("Nostr Login (Extension) Error:", error);
      alert("Failed to connect with Nostr extension. Please ensure it's unlocked and permitted.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile, closeNostrLoginModal, logoutFlow, logoutNostr]);

  const generateAndConnectKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutFlow();
      await logoutNostr();

      const newPrivKey = generateSecretKey();
      const newPubKey = getPublicKey(newPrivKey);

      setPrivKey(newPrivKey);
      setPubkey(newPubKey);
      fetchProfile(newPubKey);
      closeNostrLoginModal();

      const nsec = nip19.nsecEncode(newPrivKey);
      console.log("Generated NSEC:", nsec);
      console.log("Generated NPUB:", nip19.npubEncode(newPubKey));

      return { pubkey: newPubKey, privKey: newPrivKey };
    } catch (error) {
      console.error("Nostr Key Generation Error:", error);
      alert("Failed to generate new Nostr keys.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile, closeNostrLoginModal, logoutFlow, logoutNostr]);


  // --- Profile Management ---
  const updateProfile = async (name: string, about: string, links: NostrLink[], flowWalletAddress?: string, picture?: string) => {
    if (!pubkey) return;

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

    const eventTemplate: Omit<NostrEvent, 'id' | 'sig' | 'pubkey'> = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: content,
    };

    let signedEvent: NostrEvent;

    try {
      if (privKey) {
        signedEvent = finalizeEvent({ ...eventTemplate, pubkey }, privKey);
      } else if (window.nostr) {
        signedEvent = await window.nostr.signEvent(eventTemplate);
      } else {
        throw new Error("No private key or Nostr extension available to sign event.");
      }

      await Promise.any(pool.publish(RELAYS, signedEvent));
      setProfile({ name, about, picture, links, flowWalletAddress, pubkey });
      setCachedProfiles(prev => ({
        ...prev,
        [pubkey]: { name, about, picture, links, flowWalletAddress, pubkey }
      }));
    } catch (error) {
      console.error("Failed to publish to any relay or sign event", error);
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
          setCachedProfiles(prev => ({ ...prev, [targetPubkey]: fullProfile }));
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
  }, [pool, cachedProfiles]);

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

          // CORRECTED: Safely access created_at and ensure it's a number for comparison
          const existingProfile = profilesMap.get(event.pubkey);
          if (
            !existingProfile ||
            (existingProfile.created_at !== undefined && event.created_at > existingProfile.created_at)
          ) {
            currentProfile.created_at = event.created_at; // Ensure created_at is on currentProfile
            profilesMap.set(event.pubkey, currentProfile);
          }
        } catch (e) {
          console.error(`Error parsing profile from event ${event.id}:`, e);
        }
      }
      const fetchedProfiles = Array.from(profilesMap.values());
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


  // --- Feedback Specific Logic (unchanged) ---

  const getNostrTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp * 1000);
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

  const sendFeedback = useCallback(async (message: string, groupChatId: string) => {
    if (!pubkey) {
      throw new Error("User not logged in to Nostr.");
    }

    const tags = [
      ['e', groupChatId, '', 'root'],
      ['p', pubkey, ''],
      ['t', 'feedback'],
    ];

    const eventTemplate: Omit<NostrEvent, 'id' | 'sig' | 'pubkey'> = {
      kind: 42,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: message.trim(),
    };

    let signedEvent: NostrEvent;

    try {
      if (privKey) {
        signedEvent = finalizeEvent({ ...eventTemplate, pubkey }, privKey);
      } else if (window.nostr) {
        signedEvent = await window.nostr.signEvent(eventTemplate);
      } else {
        throw new Error("No private key or Nostr extension available to sign event.");
      }

      await Promise.any(pool.publish(RELAYS, signedEvent));
      setFeedbackMessages(prevMessages => [...prevMessages, signedEvent as AppNostrEvent].sort((a, b) => a.created_at - b.created_at));
      if (!cachedProfiles[pubkey]) {
        fetchProfileByPubkey(pubkey);
      }
    } catch (err) {
      console.error("Failed to publish feedback:", err);
      throw new Error("Failed to send feedback. Please try again.");
    }
  }, [privKey, pubkey, pool, fetchProfileByPubkey, cachedProfiles]);

  useEffect(() => {
    const filter = {
      kinds: [42],
      '#e': [FEEDBACK_GROUP_CHAT_ID],
      limit: 50,
    };

    const sub = pool.subscribe(RELAYS, filter, {
        onevent: (event: NostrEvent) => {
            const appEvent = event as AppNostrEvent;
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
    };
  }, [pool, fetchProfileByPubkey, cachedProfiles]);

  const getProfileForMessage = useCallback((targetPubkey: string): NostrProfile | undefined => {
    if (cachedProfiles[targetPubkey]) {
      return cachedProfiles[targetPubkey];
    }
    fetchProfileByPubkey(targetPubkey);
    return undefined;
  }, [cachedProfiles, fetchProfileByPubkey]);

  useEffect(() => {
    return () => {
      pool.close(RELAYS);
    };
  }, [pool]);

  return (
    <NostrContext.Provider value={
      {
        pubkey,
        privKey,
        profile,
        connectWithFlow,
        connectWithExtension,
        generateAndConnectKeys,
        updateProfile,
        fetchProfileByFlowWalletAddress,
        fetchAllProfiles,
        fetchProfileByPubkey,
        isLoading,
        feedbackMessages,
        isLoadingFeedbackMessages,
        sendFeedback,
        getNostrTime,
        getProfileForMessage,
        showNostrLoginModal,
        openNostrLoginModal,
        closeNostrLoginModal,
        logoutFlow,
        logoutNostr,
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