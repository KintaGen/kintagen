// src/hooks/useSecureLog.tsx
import { useState, useEffect } from 'react';
import { useNostr } from '../contexts/NostrContext';
import { useLighthouse } from './useLighthouse';
import { encryptLargeFile, decryptLargeFile } from '../utils/encryption';
import { fetchIpfsData } from '../utils/ipfsHelpers';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent } from 'nostr-tools/pure';

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
    const { pubkey, privKey, pool, RELAYS, sendEncryptedDM } = useNostr();
    const { uploadFile } = useLighthouse();
    const [includeSecureData, setIncludeSecureData] = useState(true);

    useEffect(() => {
        if (pubkey && privKey) setIncludeSecureData(true);
    }, [pubkey, privKey]);

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

        // 2. Encrypt with owner's key
        const ownerConversationKey = nip44.v2.utils.getConversationKey(userPrivKey, userPubkey);
        const encryptedBlob = await encryptLargeFile(dataBuffer, ownerConversationKey);

        // 3. Upload to IPFS
        const encFile = new File([encryptedBlob], `${dataType}_data_${inputHash.substring(0, 6)}.enc`);
        const encCid = await uploadFile(encFile);

        if (!encCid) throw new Error("Failed to upload encrypted data to IPFS");

        // 4. Update Nostr App Data (Kind 30078)
        console.log("📝 Updating Nostr App Data...");

        let currentData: StoredSecureData = {};
        try {
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

    const getAllSecureDataForPubkey = async (targetPubkey: string): Promise<SecureDataMeta[]> => {
        if (!targetPubkey) {
            console.error("No public key provided to retrieve secure data.");
            return [];
        }

        console.log(`📡 Fetching secure data for public key: ${targetPubkey}...`);
        let allSecureData: SecureDataMeta[] = [];

        try {
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
                    nostr_event_id: events[0]?.id || 'N/A',
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

    /**
     * Handles the sharing of secure data with a recipient.
     * @param originalCid The IPFS CID of the original encrypted data.
     * @param recipientPubkey The Nostr public key of the user to share the data with.
     * @param fileName The original filename or a descriptive name for the re-encrypted file.
     * @returns The IPFS CID of the newly encrypted file and the Nostr event ID of the DM, or null if failure.
     */
    const shareSecureData = async (
        originalCid: string,
        recipientPubkey: string,
        fileName: string = "shared_data.enc"
    ): Promise<{ sharedCid: string; dmEventId: string } | null> => {
        if (!pubkey || !privKey) {
            console.error("Owner not logged in or private key not available to share data.");
            throw new Error("You must be logged in with your private key to share data.");
        }
        if (pubkey === recipientPubkey) {
            throw new Error("Cannot share data with yourself directly via this method.");
        }

        try {
            console.log(`🔑 Decrypting data from original CID: ${originalCid}`);
            // 1. Fetch original encrypted data from IPFS
            const encryptedDataBuffer = await fetchIpfsData(originalCid);

            // 2. Decrypt the data using the owner's keys (owner -> owner conversation key)
            const ownerConversationKey = nip44.v2.utils.getConversationKey(privKey, pubkey);
            const decryptedDataBuffer = await decryptLargeFile(encryptedDataBuffer, ownerConversationKey);
            console.log("🔓 Data decrypted successfully.");

            // 3. Re-encrypt the decrypted data using owner's privKey and recipient's pubkey
            console.log(`🔒 Re-encrypting data for recipient: ${recipientPubkey}`);
            const recipientConversationKey = nip44.v2.utils.getConversationKey(privKey, recipientPubkey);
            const reEncryptedBlob = await encryptLargeFile(decryptedDataBuffer, recipientConversationKey);
            console.log("✨ Data re-encrypted for recipient.");

            // 4. Upload the newly encrypted data to IPFS
            const reEncryptedFile = new File([reEncryptedBlob], fileName);
            const sharedCid = await uploadFile(reEncryptedFile);

            if (!sharedCid) {
                throw new Error("Failed to upload re-encrypted data to IPFS.");
            }
            console.log(`⬆️ Re-encrypted data uploaded to new CID: ${sharedCid}`);

            // 5. Send an encrypted Nostr DM to the recipient
            const dmMessage = `Here is the secure data you requested. You can access it via IPFS CID: ${sharedCid}`;
            const dmEventId = await sendEncryptedDM(recipientPubkey, dmMessage, sharedCid, true, originalCid);

            if (!dmEventId) {
                throw new Error("Failed to send encrypted DM to recipient.");
            }
            console.log(`✉️ Encrypted DM sent to ${recipientPubkey} with event ID: ${dmEventId}`);

            return { sharedCid, dmEventId };

        } catch (error) {
            console.error("Error sharing secure data:", error);
            throw error;
        }
    };

    /**
     * Decrypts shared data received from another user and allows downloading it.
     * @param cid The IPFS CID of the encrypted shared data.
     * @param senderPubkey The public key of the user who shared the data with us.
     * @param suggestedFileName A suggested filename for the downloaded file.
     * @returns Promise that resolves when the file is downloaded, or rejects on error.
     */
    const decryptAndDownloadSharedData = async (
        cid: string,
        senderPubkey: string,
        suggestedFileName: string = "decrypted_shared_data.bin"
    ): Promise<void> => {
        if (!pubkey || !privKey) {
            console.error("User not logged in or private key not available to decrypt data.");
            throw new Error("You must be logged in with your private key to decrypt data.");
        }
        if (pubkey === senderPubkey) {
             console.warn("Attempting to decrypt data sent by self. This method expects data shared by another party.");
             // Potentially handle this case differently or still allow if it was re-encrypted for self.
        }

        try {
            console.log(`⬇️ Fetching encrypted shared data from CID: ${cid}`);
            // 1. Fetch the encrypted data from IPFS
            const encryptedDataBuffer = await fetchIpfsData(cid);

            console.log(`🔑 Decrypting shared data using conversation key with ${senderPubkey}`);
            // 2. Decrypt the data using our private key and the sender's public key
            // This is the conversation key used to decrypt messages *from* the sender.
            const conversationKey = nip44.v2.utils.getConversationKey(privKey, senderPubkey);
            const decryptedDataBuffer = await decryptLargeFile(encryptedDataBuffer, conversationKey);
            console.log("🔓 Shared data decrypted successfully.");

            // 3. Create a Blob from the decrypted ArrayBuffer
            const blob = new Blob([decryptedDataBuffer], { type: 'application/octet-stream' });

            // 4. Create a download link and trigger the download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = suggestedFileName;
            document.body.appendChild(a); // Append to body to make it clickable
            a.click(); // Programmatically click the link to trigger download
            document.body.removeChild(a); // Clean up the DOM
            URL.revokeObjectURL(url); // Revoke the object URL to free up memory

            console.log(`✅ Decrypted data downloaded as ${suggestedFileName}`);

        } catch (error) {
            console.error("Error decrypting and downloading shared data:", error);
            throw error; // Re-throw to be handled by the calling component
        }
    };


    return {
        includeSecureData,
        setIncludeSecureData,
        processSecureLog,
        getAllSecureDataForPubkey,
        shareSecureData,
        decryptAndDownloadSharedData, // Expose the new decryption and download method
        hasNostrIdentity: !!pubkey
    };
};