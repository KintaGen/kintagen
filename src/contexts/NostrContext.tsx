import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, getPublicKey, type Event as NostrEvent, generateSecretKey } from 'nostr-tools/pure';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import * as fcl from "@onflow/fcl";
import { nip19 } from 'nostr-tools';
import { Buffer } from 'buffer'; // Required for Buffer.from(hexString, 'hex') if not polyfilled

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
    sendEncryptedDM: (recipientPubkey: string, message: string, dataCid: string,sharing: boolean | null, originalCID: string | null) => Promise<string | null>; 
    getNostrTime: (timestamp: number) => string;
    getProfileForMessage: (pubkey: string) => NostrProfile | undefined;
    showNostrLoginModal: boolean;
    openNostrLoginModal: () => void;
    closeNostrLoginModal: () => void;
    logoutFlow: () => Promise<void>;
    logoutNostr: () => void;
    subscribeToDMs: () => void;
    decryptDM: (event: AppNostrEvent) => Promise<string | null>; 
    encryptedMessages: NostrEvent[];
    pool: SimplePool;
    RELAYS: string[];
}

const NostrContext = createContext<NostrContextType | null>(null);

export const FEEDBACK_GROUP_CHAT_ID = '3cf3df85c1ee58b712e7296c0d2ec66a68f9b9ccc846b63d2f830d974aa447cd';
export const NOSTR_APP_TAG = 'kintagendemo-v0';
export const NOSTR_SHARE_DATA_OP_TAG = `${NOSTR_APP_TAG}-datashare`;
export const NOSTR_SHARING_DATA_OP_TAG = `${NOSTR_APP_TAG}-datasharing`
export const NostrProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: flowUser, logOut: flowLogOut } = useFlowCurrentUser(); // Corrected destructuring for flowLogOut

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

  const [encryptedMessages,setEncryptedMessages] = useState([]);

  const logoutNostr = useCallback(() => {
    if (pubkey) { // Only log out if there's an active Nostr pubkey
      console.log("Logging out of Nostr session...");
      setPubkey(null);
      setPrivKey(null);
      setProfile(null);
      setEncryptedMessages([]);
      setFeedbackMessages([]); // Clear feedback messages on Nostr logout
      setCachedProfiles({}); // Clear cached profiles on Nostr logout
    }
  }, [pubkey]);

  const logoutFlow = useCallback(async () => {
    if (flowUser?.loggedIn) {
      console.log("Logging out of Flow wallet...");
      await flowLogOut();
      // It's crucial here to also logout Nostr if it was tied to Flow
      // For simplicity and to prevent stale state, we'll call logoutNostr()
      // This ensures that if Flow was providing the identity, that identity is cleared.
      logoutNostr();
    }
  }, [flowUser?.loggedIn, flowLogOut, logoutNostr]);


  // --- Helper Functions ---
  const deriveNostrKey = async (signatureHex: string): Promise<Uint8Array> => {
    // Use Buffer for hex string to byte array conversion as in your original `deriveNostrKey`
    const signatureBytes = Buffer.from(signatureHex, 'hex');
    const hash = await crypto.subtle.digest('SHA-256', signatureBytes);
    return new Uint8Array(hash);
  };

  const fetchProfile = useCallback(async (pkHex: string) => {
    // Only set isLoading for the actual fetching of the current user's profile
    setIsLoading(true);
    try {
      const event = await pool.get(RELAYS, {
        kinds: [0],
        authors: [pkHex],
      });

      if (event) {
        try {
          const content = JSON.parse(event.content);
          const fetchedProfile: NostrProfile = { ...content, pubkey: event.pubkey, created_at: event.created_at };
          setProfile(fetchedProfile); // Set the main profile state
          setCachedProfiles(prev => ({ ...prev, [pkHex]: fetchedProfile })); // Cache it
        } catch (e) {
          console.error("Failed to parse profile JSON", e);
          setProfile(null);
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
  }, [pool]); // Only pool is a dependency, cachedProfiles updates setProfile directly

  // --- Login Functions ---

  const connectWithFlow = useCallback(async () => {
    if (!flowUser?.loggedIn || !flowUser?.addr) {
      alert("Please log in to your Flow wallet first.");
      return null;
    }
    setIsLoading(true);
    try {
      await logoutNostr(); // NEW: Clear any previous Nostr identity before connecting with Flow

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
      await fetchProfile(pk); // Ensure profile is fetched after setting pubkey
      closeNostrLoginModal();
      return { pubkey: pk, privKey: sk };

    } catch (error: any) { // Corrected error typing to `any` for robustness
      console.error("Nostr Login (Flow) Error:", error);
      alert(error.message || "Failed to derive Nostr identity from Flow.");
      logoutNostr(); // NEW: Reset Nostr if Flow connection fails
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
      await logoutFlow(); // NEW: Logout Flow if it was active
      await logoutNostr(); // NEW: Clear any previous Nostr identity

      const pk = await window.nostr.getPublicKey();
      setPrivKey(null); // Extensions do not expose private keys
      setPubkey(pk);
      await fetchProfile(pk); // Ensure profile is fetched after setting pubkey
      closeNostrLoginModal();
      return { pubkey: pk, privKey: null as any }; // Explicitly return null for privKey
    } catch (error: any) { // Corrected error typing to `any`
      console.error("Nostr Login (Extension) Error:", error);
      alert(error.message || "Failed to connect with Nostr extension. Please ensure it's unlocked and permitted.");
      logoutNostr(); // NEW: Reset Nostr if extension connection fails
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile, closeNostrLoginModal, logoutFlow, logoutNostr]);

  const generateAndConnectKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutFlow(); // NEW: Logout Flow if it was active
      await logoutNostr(); // NEW: Clear any previous Nostr identity

      const newPrivKey = generateSecretKey();
      const newPubKey = getPublicKey(newPrivKey);

      setPrivKey(newPrivKey);
      setPubkey(newPubKey);
      await fetchProfile(newPubKey); // Ensure profile is fetched after setting pubkey
      closeNostrLoginModal();

      const nsec = nip19.nsecEncode(newPrivKey);
      console.log("Generated NSEC:", nsec);
      console.log("Generated NPUB:", nip19.npubEncode(newPubKey));

      return { pubkey: newPubKey, privKey: newPrivKey };
    } catch (error: any) { // Corrected error typing to `any`
      console.error("Nostr Key Generation Error:", error);
      alert(error.message || "Failed to generate new Nostr keys.");
      logoutNostr(); // NEW: Reset Nostr if key generation fails
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile, closeNostrLoginModal, logoutFlow, logoutNostr]);


  // --- Profile Management ---
  const updateProfile = useCallback(async (name: string, about: string, links: NostrLink[], flowWalletAddress?: string, picture?: string) => {
    if (!pubkey) throw new Error("Not logged in to Nostr.");

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
    tags.push(["A",NOSTR_APP_TAG]);

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
      // Update local profile state immediately after successful publish
      setProfile({ name, about, picture, links, flowWalletAddress, pubkey, created_at: eventTemplate.created_at });
      setCachedProfiles(prev => ({
        ...prev,
        [pubkey]: { name, about, picture, links, flowWalletAddress, pubkey, created_at: eventTemplate.created_at }
      }));
    } catch (error) {
      console.error("Failed to publish to any relay or sign event", error);
      throw new Error("Could not save profile to the network.");
    }
  }, [pubkey, privKey, pool, setProfile, setCachedProfiles]); // Added privKey to dependencies

  const fetchProfileByFlowWalletAddress = useCallback(async (flowAddr: string): Promise<NostrProfile | null> => {
    try {
      const event = await pool.get(RELAYS, {
        kinds: [0],
        "#f": [flowAddr],
      });
      if (event) {
        try {
          const content = JSON.parse(event.content);
          return { ...content, pubkey: event.pubkey, created_at: event.created_at } as NostrProfile;
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
          const fullProfile: NostrProfile = { ...content, pubkey: event.pubkey, created_at: event.created_at };
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
        "#A": [NOSTR_APP_TAG],
      });

      const profilesMap = new Map<string, NostrProfile>();

      for (const event of events) {
        try {
          const content = JSON.parse(event.content);
          const currentProfile: NostrProfile = { ...content, pubkey: event.pubkey };

          // Safely access created_at and ensure it's a number for comparison
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


  // --- Feedback Specific Logic ---

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

    pool.subscribe(RELAYS, filter, {
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

    // Keeping pool.close([]) as requested, assuming it effectively unsubscribes this specific filter.
    // However, in nostr-tools v2, `sub.unsub()` is the idiomatic way to stop a specific subscription.
    // If you experience memory leaks or continued event processing after this effect cleanup,
    // consider re-evaluating the subscription management or updating nostr-tools usage.
    return () => {
      pool.close([]);
    };
  }, [pool, fetchProfileByPubkey, cachedProfiles]);

  const getProfileForMessage = useCallback((targetPubkey: string): NostrProfile | undefined => {
    if (cachedProfiles[targetPubkey]) {
      return cachedProfiles[targetPubkey];
    }
    // Asynchronously fetch if not in cache, but return undefined for now
    fetchProfileByPubkey(targetPubkey);
    return undefined;
  }, [cachedProfiles, fetchProfileByPubkey]);

  // Cleanup for the entire pool when the provider unmounts
  useEffect(() => {
    return () => {
      pool.close(RELAYS);
    };
  }, [pool]);


  // --- Encrypted Direct Messages (NIP-04) ---
  const sendEncryptedDM = useCallback(async (
    recipientPubkey: string,
    message: string,
    dataCid: string,
    sharing: boolean | null,
    originalCID: string | null
  ): Promise<string | null> => {
    if (!pubkey) {
      throw new Error("You must be logged in to Nostr to send encrypted messages.");
    }
    if (!privKey && !window.nostr) {
      throw new Error("No private key or Nostr extension available to sign and encrypt event.");
    }
    if (pubkey === recipientPubkey) {
        throw new Error("Cannot send an encrypted message to yourself.");
    }

    try {
      let encryptedContent: string;

      if (privKey) {
        const { nip04 } = await import('nostr-tools');
        encryptedContent = await nip04.encrypt(privKey, recipientPubkey, message);
      } else if (window.nostr) {
        encryptedContent = await window.nostr.nip04.encrypt(recipientPubkey, message);
      } else {
        throw new Error("Neither private key nor Nostr extension available for encryption.");
      }
      let OP_TAG;
      
      if(!sharing){
        OP_TAG = NOSTR_SHARE_DATA_OP_TAG
      } else {
        OP_TAG = NOSTR_SHARING_DATA_OP_TAG
      }
      const tags = [
        ['p', recipientPubkey],
        ['A',NOSTR_APP_TAG], // Tag App
        ['O',OP_TAG], // Operation
        ['C', dataCid] // Data CID
      ]
      if(sharing){
        tags.push(['I',originalCID as string]);
      }
      const eventTemplate: Omit<NostrEvent, 'id' | 'sig' | 'pubkey'> = {
        kind: 4, // NIP-04 Encrypted Direct Message
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: encryptedContent,
      };

      let signedEvent: NostrEvent;
      if (privKey) {
        signedEvent = finalizeEvent({ ...eventTemplate, pubkey }, privKey);
      } else if (window.nostr) {
        signedEvent = await window.nostr.signEvent(eventTemplate);
      } else {
        throw new Error("Could not sign event.");
      }

      await Promise.any(pool.publish(RELAYS, signedEvent));
      return signedEvent.id;
    } catch (error: any) {
      console.error("Failed to send encrypted DM:", error);
      throw new Error(`Failed to send encrypted message: ${error.message || 'Unknown error'}`);
    }
  }, [pubkey, privKey, pool]);

  // Cleanup for the entire pool when the provider unmounts
  useEffect(() => {
    return () => {
      pool.close(RELAYS);
    };
  }, [pool]);
  // New: Function to decrypt a NIP-04 DM event
  const decryptDM = useCallback(async (event: AppNostrEvent): Promise<string | null> => {
    if (!privKey && !window.nostr) {
      console.error("Cannot decrypt DM: No private key or Nostr extension available.");
      return null;
    }
    if (event.kind !== 4) {
      console.warn("Attempted to decrypt non-DM event.");
      return event.content; // Return as is if not kind 4
    }

    try {
      if (privKey) {
        const { nip04 } = await import('nostr-tools');
        // Determine the sender's pubkey based on who sent the event
        const otherPubkey = event.pubkey === pubkey ? event.tags.find(t => t[0] === 'p' && t[1] !== pubkey)?.[1] || event.pubkey : event.pubkey;

        if (!otherPubkey) {
          console.error("Could not determine other party's pubkey for decryption.");
          return null;
        }
        return await nip04.decrypt(privKey, otherPubkey, event.content);
      } else if (window.nostr) {
        return await window.nostr.nip04.decrypt(event.pubkey, event.content);
      }
      return null;
    } catch (error) {
      console.error("Error decrypting DM:", error);
      return null;
    }
  }, [privKey, pubkey]);


  // New: Subscribe to incoming DMs
  const subscribeToDMs = useCallback(async (OP_TAG: string,originalCID: string | null) => {
    if (!pubkey) {
      console.warn("Not logged in to Nostr, cannot subscribe to DMs.");
      return () => {}; // Return a no-op unsubscribe function
    }
    let filter = {};
    if(originalCID){
      filter = {
        kinds: [4],
        authors: [pubkey],
        '#A': [NOSTR_APP_TAG],
        '#O': [OP_TAG],
        '#I': [originalCID]
      };
    } else {
      filter = {
        kinds: [4],
        '#p': [pubkey],
        '#A': [NOSTR_APP_TAG],
        '#O': [OP_TAG]
      };
    }

    const events = await pool.querySync(RELAYS, filter);
    setEncryptedMessages(events);

    for(const event of events){

      if (!cachedProfiles[event.pubkey]) {
        fetchProfileByPubkey(event.pubkey);
      }
    }

    return () => {
      pool.close([]);
      console.log(`Unsubscribed from DMs for ${pubkey}`);
    };
  }, [pubkey, pool, fetchProfileByPubkey, cachedProfiles]);


  // Cleanup for the entire pool when the provider unmounts
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
        sendEncryptedDM,
        getNostrTime,
        getProfileForMessage,
        showNostrLoginModal,
        openNostrLoginModal,
        closeNostrLoginModal,
        logoutFlow,
        logoutNostr,
        decryptDM,
        subscribeToDMs,
        encryptedMessages,
        pool, 
        RELAYS 
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
