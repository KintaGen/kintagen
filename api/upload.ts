import type { VercelRequest, VercelResponse } from '@vercel/node';
import lighthouse from '@lighthouse-web3/sdk';

// This is the Vercel function signature
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // 1. Check the method on the `request` object
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  // 2. Accessing environment variables is IDENTICAL
  const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY;

  if (!LIGHTHOUSE_API_KEY) {
    console.error("Server configuration error: LIGHTHOUSE_API_KEY not found.");
    // 3. Send errors using the `response` object
    return response.status(500).json({ error: "Server configuration error." });
  }

  try {
    // 4. Access the auto-parsed JSON body from `request.body`
    const { fileData } = request.body;
    
    if (!fileData) {
      return response.status(400).json({ error: "Bad Request: fileData is missing." });
    }

    // --- YOUR CORE LOGIC (UNCHANGED) ---
    const fileBuffer = Buffer.from(fileData, 'base64');

    const lighthouseResponse = await lighthouse.uploadBuffer(
        fileBuffer,
        LIGHTHOUSE_API_KEY,
    );
    
    const cid = lighthouseResponse.data.Hash;
    // --- END OF CORE LOGIC ---

    // 5. Send a successful response using the `response` object's helpers
    return response.status(200).json({ cid });

  } catch (error: any) {
    console.error("Lighthouse upload failed:", error);
    return response.status(500).json({ 
      error: "An unknown error occurred during upload." 
    });
  }
}