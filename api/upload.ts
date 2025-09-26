import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PinataSDK } from "pinata";
import { Readable } from 'stream';

// This is the Vercel function signature
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // 1. Check if the method is POST
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  // 2. Securely access environment variables
  const PINATA_JWT = process.env.PINATA_JWT;
  const PINATA_GATEWAY = process.env.PINATA_GATEWAY;

  if (!PINATA_JWT || !PINATA_GATEWAY) {
    console.error("Server configuration error: Pinata environment variables not set.");
    return response.status(500).json({ error: "Server configuration error." });
  }

  try {
    // 3. Initialize the Pinata SDK
    const pinata = new PinataSDK({
      pinataJwt: PINATA_JWT,
      pinataGateway: PINATA_GATEWAY,
    });

    // 4. Access the auto-parsed JSON body
    // We expect the file content as a base64 string and a filename
    const { fileData, fileName } = request.body;
    
    if (!fileData || !fileName) {
      return response.status(400).json({ error: "Bad Request: 'fileData' (base64) and 'fileName' are required." });
    }

    // --- YOUR CORE PINATA LOGIC ---
    // The documentation shows `new File(...)`, which is for browser environments.
    // In a Node.js serverless function, we work with Buffers and Streams.
    
    // Convert base64 string to a Buffer
    const fileBuffer = Buffer.from(fileData, 'base64');
    const fileBlob = new Blob([fileBuffer]);
    

    // The SDK's upload method can take a stream and options, including the name
    const uploadResult = await pinata.upload.public.file(fileBlob, { name: fileName });
    // --- END OF CORE LOGIC ---

    // 5. Send the successful upload response back to the client
    return response.status(200).json(uploadResult);

  } catch (error: any) {
    console.error("Pinata upload failed:", error);
    // Send a generic error response
    return response.status(500).json({ 
      error: "An unknown error occurred during upload.",
      details: error.message,
    });
  }
}