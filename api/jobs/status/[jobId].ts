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
  // Get the dynamic jobId from the URL path (req.query).
  const { jobId } = req.query;
  // Ensure jobId is a string
  const jobIdString = Array.isArray(jobId) ? jobId[0] : jobId;

  if (!jobIdString) {
    return res.status(400).json({ error: 'Job ID is required.' });
  }

  try {
    const redis = await getRedisClient();

    // GET the job string from Redis
    const jobString = await redis.get(jobIdString);

    if (!jobString) {
      return res.status(404).json({ status: 'not_found', error: 'Job not found.' });
    }

    // PARSE the string back to JSON before sending the response
    const jobData = JSON.parse(jobString as string);
    res.status(200).json(jobData);
  } catch (error: any) {
    console.error('Failed to get job status:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}