// Place this file in your project's `api` directory.
// For example: /api/research-chat.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { simpleLLMCall } from './services/ai.service'; 

interface RequestBody {
  topic: string;
  knowledgeBase?: string;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Check if the HTTP method is POST
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Vercel automatically parses the JSON body
    const { topic, knowledgeBase = '' } = request.body as RequestBody;

    if (!topic) {
      return response.status(400).json({ 
        error: 'Missing required field: "topic"' 
      });
    }

    // Core logic remains unchanged
    const systemPrompt = `You are an expert research assistant. Answer the user's topic comprehensively. If a "Knowledge Base" is provided, you MUST base your answer primarily on that information.`;
    const userPrompt = `Topic: "${topic}"\n\nKnowledge Base:\n---\n${knowledgeBase || 'No context provided.'}\n---`;

    const reply = await simpleLLMCall({
      system: systemPrompt,
      user: userPrompt,
    });

    // Send a successful response using the response object's .json() method
    return response.status(200).json({
      reply: reply || 'The AI returned an empty response.',
      meta: {
        topic,
        knowledgeBaseProvided: !!knowledgeBase,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (err) {
    const error = err as Error;
    console.error('[research-chat] ERROR:', error.stack || error.message);
    
    // Send an error response
    return response.status(500).json({ 
      error: 'An internal server error occurred.' 
    });
  }
}