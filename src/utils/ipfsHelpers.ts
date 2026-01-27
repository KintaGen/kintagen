import JSZip from 'jszip';

export const fetchAndUnzipIpfsArtifact = async (cid: string) => {
    const gatewayUrl = `https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${cid}`;
    const response = await fetch(gatewayUrl);
    if (!response.ok) throw new Error(`Failed to fetch artifact from IPFS.`);
    const zipBlob = await response.blob();
    return await JSZip.loadAsync(zipBlob);
};
export const fetchIpfsData = async (cid: string): Promise<ArrayBuffer> => { 
    const gatewayUrl = `https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${cid}`;
    const response = await fetch(gatewayUrl);
    if (!response.ok) throw new Error(`Failed to fetch data from IPFS. Status: ${response.status}`);
    
    // Read the response body as an ArrayBuffer directly
    const arrayBuffer = await response.arrayBuffer(); 
    return arrayBuffer;
};
export const readZipJson = async (zip: JSZip, filename: string) => {
    const file = zip.file(filename);
    return file ? JSON.parse(await file.async("string")) : undefined;
};

export const readZipText = async (zip: JSZip, filename: string) => {
    const file = zip.file(filename);
    return file ? await file.async("string") : undefined;
};

export const readZipImageB64 = async (zip: JSZip, filename: string) => {
    const file = zip.file(filename);
    if (!file) return undefined;
    const blob = await file.async("blob");
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};