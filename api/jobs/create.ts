import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client as QStashClient } from '@upstash/qstash';
import { createClient, RedisClientType } from 'redis'; // Import from 'redis'


export const config = { api: { bodyParser: false } };

const qstashClient = new QStashClient({ 
    baseUrl: process.env.QSTASH_URL,
    token: process.env.QSTASH_TOKEN!
});

// --- REDIS CLIENT SETUP ---
let redisClient: RedisClientType | null = null;
async function getRedisClient() {
  if (!redisClient) {
    // Vercel provides the connection string in the KV_URL environment variable
    redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fileUrl, originalFilename, analysisType, inputDataHash } = req.body;

    if (!fileUrl || !originalFilename || !analysisType || !inputDataHash) {
      return res.status(400).json({ error: 'Missing required job parameters in request body.' });
    }

    const jobId = `job_${Date.now()}`;
    await getRedisClient().then(redis => redis.set(jobId, JSON.stringify({ 
      status: 'queued', 
      analysisType,
      originalFilename,
      inputDataHash,
      createdAt: new Date().toISOString() 
    })));

    await qstashClient.queue({ queueName: 'r-script-jobs' }).enqueueJSON({
      url: `${process.env.NODE_WORKER_URL!}/process-job`,
      body: { jobId, analysisType, fileUrl, originalFilename, inputDataHash },
      headers: { 'X-Worker-Secret': process.env.WORKER_SECRET! },
    });

    return res.status(202).json({ message: 'Job accepted.', jobId: jobId });
  } catch (error: any) {
    console.error('Error in /api/jobs/create:', error);
    const statusCode = error.httpCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
  }
}