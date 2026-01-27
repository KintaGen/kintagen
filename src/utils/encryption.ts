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
/**
 * Decrypts large binary data previously encrypted with AES-GCM (IV prepended).
 */
export async function decryptLargeFile(encryptedBlob: ArrayBuffer, conversationKey: Uint8Array): Promise<ArrayBuffer> {
    // Import the raw conversation key for AES-GCM
    const key = await window.crypto.subtle.importKey(
        'raw', 
        conversationKey, // This is the shared secret
        { name: 'AES-GCM' }, 
        false, 
        ['decrypt']
    );

    // Extract IV (12 bytes) and ciphertext
    const iv = new Uint8Array(encryptedBlob.slice(0, 12));
    const ciphertext = encryptedBlob.slice(12);

    const decryptedContent = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv }, 
        key, 
        ciphertext
    );

    return decryptedContent;
}