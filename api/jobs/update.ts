import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, RedisClientType } from 'redis';

// --- REDIS CLIENT SETUP ---
let redisClient: RedisClientType | null = null;
async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }


  const { jobId, status, result, error } = req.body;
  if (!jobId || !status) {
    return res.status(400).json({ error: 'jobId and status are required.' });
  }

  try {
    const redis = await getRedisClient();

    // GET the existing job string from Redis
    const currentJobString = await redis.get(jobId);
    if (!currentJobString) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    // PARSE the string back to a JSON object
    const currentJobData = JSON.parse(currentJobString as string);
    const updatedJobData = {
      ...currentJobData,
      status: status,
      result: result || null,
      error: error || null,
      completedAt: new Date().toISOString(),
    };

    // SET the updated job back to Redis, making sure to STRINGIFY it
    await redis.set(jobId, JSON.stringify(updatedJobData as string));
    
    res.status(200).json({ message: 'Status updated successfully.' });
  } catch (e: any) {
    console.error('Failed to update job status:', e);
    res.status(500).json({ error: 'Internal server error.' });
  }
}