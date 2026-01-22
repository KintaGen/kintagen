/**
 * Encrypts large binary data using the NIP-44 derived shared key + AES-GCM.
 * This bypasses the NIP-44 size limit (approx 65kb) by using native browser Crypto.
 */
export async function encryptLargeFile(fileBuffer: ArrayBuffer, conversationKey: Uint8Array): Promise<Blob> {
    const key = await window.crypto.subtle.importKey(
        'raw', 
        conversationKey, 
        { name: 'AES-GCM' }, 
        false, 
        ['encrypt']
    );

    // 12-byte IV is standard for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv }, 
        key, 
        fileBuffer
    );

    // Pack IV + Encrypted Data
    const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedContent), iv.length);

    return new Blob([combined], { type: 'application/octet-stream' });
}