import { Handler, HandlerEvent } from "@netlify/functions";
import lighthouse from '@lighthouse-web3/sdk';

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // --- THIS IS THE FIX ---
  // Access the private, server-side environment variable.
  // It has no "VITE_" prefix.
  const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY;

  if (!LIGHTHOUSE_API_KEY) {
    // This error message is for you, the developer, in the function logs.
    console.error("Server configuration error: LIGHTHOUSE_API_KEY not found.");
    return { statusCode: 500, body: "Server configuration error." };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const fileData = body.fileData;
    
    if (!fileData) {
      return { statusCode: 400, body: "Bad Request: fileData is missing." };
    }

    const fileBuffer = Buffer.from(fileData, 'base64');

    const response = await lighthouse.uploadBuffer(
        fileBuffer,
        LIGHTHOUSE_API_KEY,
    );
    
    const cid = response.data.Hash;

    return {
      statusCode: 200,
      body: JSON.stringify({ cid }),
      headers: { 'Content-Type': 'application/json' },
    };

  } catch (error: any) {
    console.error("Lighthouse upload failed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An unknown error occurred during upload." }),
    };
  }
};

export { handler };