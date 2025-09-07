import { Handler, HandlerEvent } from "@netlify/functions";
import pdf from 'pdf-parse';
// Import the specific service function we need, using our TS path alias
import { extractMetadataFromText } from '@services/ai.service';

interface RequestBody {
  pdf_base64: string;
}

/**
 * A serverless function that accepts a Base64 encoded PDF, extracts its text,
 * and then calls an AI service to extract structured bibliographic metadata from the text.
 */
const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { pdf_base64 } = JSON.parse(event.body || '{}') as RequestBody;

    if (!pdf_base64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: "pdf_base64"' }),
      };
    }

    // --- Step 1: Parse the PDF to get raw text ---
    const pdfBuffer = Buffer.from(pdf_base64, 'base64');
    const pdfData = await pdf(pdfBuffer);

    if (!pdfData.text) {
      return {
        statusCode: 422, // Unprocessable Entity
        body: JSON.stringify({ error: 'Could not extract any text from the provided PDF.' }),
      };
    }
    console.log(`[extract-pdf-metadata] Extracted ${pdfData.text.length} characters from PDF.`);

    // --- Step 2: Call the AI service with the extracted text ---
    console.log('[extract-pdf-metadata] Calling AI service to extract metadata...');
    const metadata = await extractMetadataFromText(pdfData.text);
    console.log('[extract-pdf-metadata] Successfully extracted metadata.');


    // --- Step 3: Return the structured metadata to the client ---
    return {
      statusCode: 200,
      body: JSON.stringify(metadata),
      headers: { 'Content-Type': 'application/json' },
    };

  } catch (err) {
    const error = err as Error;
    console.error('[extract-pdf-metadata] ERROR:', error.stack || error.message);
    
    // Provide a more specific error for bad PDF data
    const errorMessage = error.message?.includes('Invalid PDF')
      ? 'Failed to parse the provided PDF. It may be corrupted or in an invalid format.'
      : 'An internal server error occurred.';

    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};

export { handler };