import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // The body will contain the filename, e.g., { filename: "data.mzml" }
  const body = req.body as HandleUploadBody;

  try {
    // Use the Vercel Blob SDK to generate a unique upload URL and token
    const jsonResponse = await handleUpload({
      body,
      request: req,
      // Allow any public file to be uploaded.
      // You can add more security here, e.g., by checking for a user session.
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: [
            'application/octet-stream',
            'application/zip',
            'text/plain',
            'text/csv'
          ], // Add any other types you expect
          tokenPayload: JSON.stringify({
            // You can add any custom metadata here if needed
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This is a server-side callback that runs after the upload is complete.
        // You could, for example, write to your database here.
        console.log('Blob upload completed', blob, tokenPayload);
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
}