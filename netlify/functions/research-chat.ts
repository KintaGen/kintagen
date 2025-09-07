import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { simpleLLMCall } from '@services/ai.service'; 

interface RequestBody {
  topic: string;
  knowledgeBase?: string;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { topic, knowledgeBase = '' } = JSON.parse(event.body || '{}') as RequestBody;

    if (!topic) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: "topic"' }),
      };
    }

    const systemPrompt = `You are an expert research assistant. Answer the user's topic comprehensively. If a "Knowledge Base" is provided, you MUST base your answer primarily on that information.`;
    const userPrompt = `Topic: "${topic}"\n\nKnowledge Base:\n---\n${knowledgeBase || 'No context provided.'}\n---`;

    const reply = await simpleLLMCall({
      system: systemPrompt,
      user: userPrompt,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: reply || 'The AI returned an empty response.',
        meta: {
          topic,
          knowledgeBaseProvided: !!knowledgeBase,
          timestamp: new Date().toISOString(),
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err) {
    const error = err as Error;
    console.error('[research-chat] ERROR:', error.stack || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An internal server error occurred.' }),
    };
  }
};

export { handler };