import { useState, useEffect } from 'react';
import { useNostr } from '../contexts/NostrContext';
import { useLighthouse } from './useLighthouse';
import { encryptLargeFile } from '../utils/encryption';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';

const RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];
const KINTAGEN_APP_DATA_TAG = 'kintagen_science_data';

export interface SecureDataMeta {
    ipfs_cid: string;
    nostr_event_id: string;
    nostr_pubkey: string;
    encryption_algo: string;
    storage_type: string;
}

export const useSecureLog = (hasInputData: boolean) => {
    const { pubkey, privKey, connect } = useNostr();
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

        // 1. JIT Login Logic
        let userPubkey = pubkey;
        let userPrivKey = privKey;

        if (!userPubkey || !userPrivKey) {
            
            const keys = await connect();
            if (!keys) return null; // Login failed/cancelled
            userPubkey = keys.pubkey;
            userPrivKey = keys.privKey;
        }

        if (!userPubkey || !userPrivKey) return null;

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
        const pool = new SimplePool();
        
        let currentData: any = {};
        try {
            const existingEvent = await pool.get(RELAYS, { 
                kinds: [30078], 
                authors: [userPubkey], 
                '#d': [KINTAGEN_APP_DATA_TAG] 
            });
            if (existingEvent) currentData = JSON.parse(existingEvent.content);
        } catch (e) { /* Ignore parsing error on fresh start */ }

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

        return {
            ipfs_cid: encCid,
            nostr_event_id: signedEvent.id,
            nostr_pubkey: userPubkey,
            encryption_algo: "aes-gcm-nip44",
            storage_type: "kind:30078"
        };
    };

    return {
        includeSecureData,
        setIncludeSecureData,
        processSecureLog,
        hasNostrIdentity: !!pubkey
    };
};