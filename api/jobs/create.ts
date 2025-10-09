import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client as QStashClient } from '@upstash/qstash';
import { put } from '@vercel/blob';
import { createClient, RedisClientType } from 'redis'; // Import from 'redis'
import { IncomingForm, Fields, Files } from 'formidable';
import fs from 'fs';

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

interface ParsedForm { fields: Fields; files: Files; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fields, files } = await new Promise<ParsedForm>((resolve, reject) => {
      new IncomingForm().parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const analysisType = Array.isArray(fields.type) ? fields.type[0] : fields.type;
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const inputDataHash = Array.isArray(fields.inputDataHash) ? fields.inputDataHash[0] : fields.inputDataHash;

    if (!analysisType || !file || file.size === 0) {
      return res.status(400).json({ error: 'Missing or empty file, or analysis type.' });
    }

    const jobId = `job_${Date.now()}`;
    const jobData = { 
      status: 'queued', 
      analysisType: analysisType,
      originalFilename: file.originalFilename,
      inputDataHash: inputDataHash,
      createdAt: new Date().toISOString() 
    };

    // --- USING REDIS CLIENT TO SET DATA ---
    const redis = await getRedisClient();
    // Redis stores strings, so we must stringify our JSON object
    await redis.set(jobId, JSON.stringify(jobData));

    const blob = await put(file.originalFilename!, fs.createReadStream(file.filepath), { access: 'public',allowOverwrite: true });

    await qstashClient.queue({ queueName: 'r-script-jobs' }).enqueueJSON({
      url: `${process.env.NODE_WORKER_URL!}/process-job`,
      body: { 
        jobId,
        analysisType,
        fileUrl: blob.url,
        originalFilename: file.originalFilename,
     },
      headers: { 'x-worker-secret': process.env.WORKER_SECRET! },
    });

    return res.status(202).json({ message: 'Job accepted.', jobId: jobId });
  } catch (error: any) {
    console.error('Error in /api/jobs/create:', error);
    const statusCode = error.httpCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
  }
}