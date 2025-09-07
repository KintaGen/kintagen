import OpenAI from 'openai';

// Ensure your API key is set in your Netlify environment variables.
const openai = new OpenAI({
  baseURL: 'https://api.mosaia.ai/v1/agent',
  apiKey: process.env.MOSAIA_HTTP_API_KEY,
});

/**
 * A robust, low-level LLM call to an OpenAI-compatible endpoint.
 * This is the core function used by other services.
 */
export async function simpleLLMCall({
  system,
  user,
  temperature = 0.7,
  model = '6845cac0d8955e09bf51f446',
}) {
  if (!process.env.MOSAIA_HTTP_API_KEY) {
    throw new Error('MOSAIA_HTTP_API_KEY environment variable not set.');
  }

  const completion = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return completion.choices?.[0]?.message?.content ?? '';
}

/**
 * Extract structured bibliographic metadata from a string of text.
 * @param {string} text - The raw text of a paper.
 * @returns {Promise<object>} A JSON object with the extracted metadata.
 */
export async function extractMetadataFromText(text) {
  const schema = `{
  "title": string,
  "journal": string,
  "year": string,
  "keywords": string[],
  "doi": string,
  "authors": string[]
}`;

  const content = await simpleLLMCall({
    system: `Extract bibliographic metadata from the user's text. Return a strict JSON object matching this schema, with no other text: ${schema}`,
    user: text?.slice(0, 8000) ?? '', // Guard against excessively long input
    temperature: 0,
  });

  try {
    return JSON.parse(content);
  } catch {
    return { title: '', journal: '', year: '', keywords: [], doi: '', authors: [] };
  }
}