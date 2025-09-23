// Place this file in your project's `api` directory.
// For example: /api/extract-pdf-metadata.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import pdf from 'pdf-parse';
// Import the specific service function we need, using our TS path alias
import { extractMetadataFromText } from './services/ai.service';

interface RequestBody {
  pdf_base64: string;
}

/**
 * A Vercel serverless function that accepts a Base64 encoded PDF, extracts its text,
 * and then calls an AI service to extract structured bibliographic metadata from the text.
 */
export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // 1. Check if the HTTP method is POST
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Get the body. Vercel automatically parses JSON, so no need for JSON.parse
    const { pdf_base64 } = request.body as RequestBody;

    if (!pdf_base64) {
      return response.status(400).json({
        error: 'Missing required field: "pdf_base64"',
      });
    }

    // --- Step 1: Parse the PDF to get raw text ---
    const pdfBuffer = Buffer.from(pdf_base64, 'base64');
    const pdfData = await pdf(pdfBuffer);

    if (!pdfData.text) {
      return response.status(422).json({ // Unprocessable Entity
        error: 'Could not extract any text from the provided PDF.',
      });
    }
    console.log(`[extract-pdf-metadata] Extracted ${pdfData.text.length} characters from PDF.`);

    // --- Step 2: Call the AI service with the extracted text ---
    console.log('[extract-pdf-metadata] Calling AI service to extract metadata...');
    const metadata = await extractMetadataFromText(pdfData.text);
    console.log('[extract-pdf-metadata] Successfully extracted metadata.');

    // --- Step 3: Return the structured metadata to the client ---
    // 3. Send a successful response using the response object
    return response.status(200).json(metadata);

  } catch (err) {
    const error = err as Error;
    console.error('[extract-pdf-metadata] ERROR:', error.stack || error.message);
    
    // Provide a more specific error for bad PDF data
    const errorMessage = error.message?.includes('Invalid PDF')
      ? 'Failed to parse the provided PDF. It may be corrupted or in an invalid format.'
      : 'An internal server error occurred.';

    // 4. Send an error response using the response object
    return response.status(500).json({ error: errorMessage });
  }
}