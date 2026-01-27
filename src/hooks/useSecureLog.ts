// src/hooks/useSecureLog.tsx
import { useState, useEffect } from 'react';
import { useNostr } from '../contexts/NostrContext'; // Import useNostr
import { useLighthouse } from './useLighthouse';
import { encryptLargeFile } from '../utils/encryption';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent } from 'nostr-tools/pure';
// We no longer need to import SimplePool directly here
// import { SimplePool } from 'nostr-tools/pool';

// RELAYS will now come from NostrContext, but we can keep it local for specific needs if different
// const RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];
const KINTAGEN_APP_DATA_TAG = 'kintagen_science_data';

export interface SecureDataMeta {
    ipfs_cid: string;
    nostr_event_id: string;
    nostr_pubkey: string;
    encryption_algo: string;
    storage_type: string;
    type?: 'ld50' | 'nmr' | 'gcms';
    project?: string;
    nft_id?: string;
    timestamp?: string;
    inputHash?: string;
}

export interface StoredSecureData {
    [inputHash: string]: {
        type: 'ld50' | 'nmr' | 'gcms';
        project: string;
        nft_id: string;
        ipfs_cid: string;
        timestamp: string;
        algo: 'aes-gcm-nip44';
    };
}

export const useSecureLog = (hasInputData: boolean) => {
    // Destructure `pool` and `RELAYS` from useNostr context
    const { pubkey, privKey, pool, RELAYS } = useNostr(); // Assuming RELAYS is also exposed from NostrContext
    const { uploadFile } = useLighthouse();
    const [includeSecureData, setIncludeSecureData] = useState(true);

    // Auto-enable if connected
    useEffect(() => {
        if (pubkey && privKey) setIncludeSecureData(true);
    }, [pubkey, privKey]);

    /**
     * Handles the full secure flow: Login -> Encrypt -> Upload -> Publish Nostr Event
     */
    const processSecureLog = async (
        dataBuffer: ArrayBuffer, 
        inputHash: string, 
        project: { name: string; nft_id: string },
        dataType: 'ld50' | 'nmr' | 'gcms'
    ): Promise<SecureDataMeta | null> => {
        
        if (!includeSecureData || !hasInputData) return null;

        let userPubkey = pubkey;
        let userPrivKey = privKey;

        if (!userPubkey || !userPrivKey) {         
            console.warn("User not logged in or private key not available for secure logging.");
            return null;
        }

        console.log("🔒 Encrypting Binary Data with Nostr Keys (AES-GCM)...");

        // 2. Encrypt
        const conversationKey = nip44.v2.utils.getConversationKey(userPrivKey, userPubkey);
        const encryptedBlob = await encryptLargeFile(dataBuffer, conversationKey);

        // 3. Upload to IPFS
        const encFile = new File([encryptedBlob], `${dataType}_data_${inputHash.substring(0, 6)}.enc`);
        const encCid = await uploadFile(encFile);

        if (!encCid) throw new Error("Failed to upload encrypted data to IPFS");

        // 4. Update Nostr App Data (Kind 30078)
        console.log("📝 Updating Nostr App Data...");
        
        let currentData: StoredSecureData = {};
        try {
            // Use the shared pool instance
            const existingEvent = await pool.get(RELAYS, { 
                kinds: [30078], 
                authors: [userPubkey], 
                '#d': [KINTAGEN_APP_DATA_TAG] 
            });
            if (existingEvent) currentData = JSON.parse(existingEvent.content);
        } catch (e) { 
            console.warn("Could not retrieve or parse existing app data, starting fresh.", e);
        }

        currentData[inputHash] = {
            type: dataType,
            project: project.name,
            nft_id: project.nft_id,
            ipfs_cid: encCid,
            timestamp: new Date().toISOString(),
            algo: 'aes-gcm-nip44'
        };

        const eventTemplate = {
            kind: 30078,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['d', KINTAGEN_APP_DATA_TAG], ['t', 'scientific-data']],
            content: JSON.stringify(currentData)
        };

        const signedEvent = finalizeEvent(eventTemplate, userPrivKey);
        await Promise.any(pool.publish(RELAYS, signedEvent));
        // No need to call pool.close() here as the pool is managed by NostrContext
        // and should remain open for other parts of the application.

        return {
            ipfs_cid: encCid,
            nostr_event_id: signedEvent.id,
            nostr_pubkey: userPubkey,
            encryption_algo: "aes-gcm-nip44",
            storage_type: "kind:30078",
            type: dataType,
            project: project.name,
            nft_id: project.nft_id,
            timestamp: new Date().toISOString(),
            inputHash: inputHash
        };
    };

    /**
     * Retrieves all secure data uploaded by a specific public key.
     */
    const getAllSecureDataForPubkey = async (targetPubkey: string): Promise<SecureDataMeta[]> => {
        if (!targetPubkey) {
            console.error("No public key provided to retrieve secure data.");
            return [];
        }

        console.log(`📡 Fetching secure data for public key: ${targetPubkey}...`);
        let allSecureData: SecureDataMeta[] = [];

        try {
            // Use the shared pool instance
            const events = await pool.querySync(RELAYS, {
                kinds: [30078],
                authors: [targetPubkey],
                '#d': [KINTAGEN_APP_DATA_TAG]
            });

            if (events.length === 0) {
                console.log(`No secure data events found for public key: ${targetPubkey}`);
                return [];
            }

            events.sort((a, b) => a.created_at - b.created_at);

            let aggregatedData: StoredSecureData = {};

            for (const event of events) {
                try {
                    const eventData = JSON.parse(event.content) as StoredSecureData;
                    aggregatedData = { ...aggregatedData, ...eventData };
                } catch (e) {
                    console.error(`Error parsing secure data content from event ${event.id}:`, e);
                }
            }
            
            for (const inputHash in aggregatedData) {
                const dataEntry = aggregatedData[inputHash];
                allSecureData.push({
                    ipfs_cid: dataEntry.ipfs_cid,
                    nostr_event_id: events[0]?.id || 'N/A', // This might not be precise, but points to one relevant event
                    nostr_pubkey: targetPubkey,
                    encryption_algo: dataEntry.algo,
                    storage_type: "kind:30078",
                    type: dataEntry.type,
                    project: dataEntry.project,
                    nft_id: dataEntry.nft_id,
                    timestamp: dataEntry.timestamp,
                    inputHash: inputHash
                });
            }

        } catch (error) {
            console.error("Error fetching secure data from Nostr relays:", error);
        } finally {
            // No need to call pool.close() here as the pool is managed by NostrContext
        }

        return allSecureData;
    };

    return {
        includeSecureData,
        setIncludeSecureData,
        processSecureLog,
        getAllSecureDataForPubkey,
        hasNostrIdentity: !!pubkey
    };
};