import { WebR } from 'webr';
import path from "node:path";
import fs from "node:fs";

const {ld50ScriptContent} =  require('./scripts/ld50-script.cjs')

// This global variable will persist between "warm" invocations.
let webRInstance = null;

// This is the Vercel function signature.
export default async function handler(request, response) {
  // 1. Check the HTTP method using `request.method`
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }
  const currentWorkingDirectory = process.cwd();
  console.log(`[DEBUG] Current Working Directory: ${currentWorkingDirectory}`);
  const filesInCwd = fs.readdirSync(currentWorkingDirectory);
  console.log('[DEBUG] Files in CWD:', filesInCwd);
  try {
    if (!webRInstance) {
      console.log('🚀 Cold start: Initializing WebR with bundled packages...');
      const webR = new WebR({
        baseUrl: `${currentWorkingDirectory}/.vercel/output/static/webr-assets/`,
        channelType: 3
      });
      await webR.init();

      console.log("Copying bundled packages into WebR's memory...");
      
      const sourceDir = path.resolve(process.cwd(), 'r_packages');
      const destDir = '/packages';
      await webR.FS.mkdir(destDir);

      const copyDirectoryRecursive = async (source, destination) => {
        const entries = fs.readdirSync(source, { withFileTypes: true });
        for (const entry of entries) {
          const sourcePath = path.join(source, entry.name);
          const destPath = path.join(destination, entry.name);
          if (entry.isDirectory()) {
            await webR.FS.mkdir(destPath);
            await copyDirectoryRecursive(sourcePath, destPath);
          } else {
            const fileContent = fs.readFileSync(sourcePath);
            await webR.FS.writeFile(destPath, fileContent);
          }
        }
      };
      
      await copyDirectoryRecursive(sourceDir, destDir);
      console.log('Package copy complete.');

      await webR.evalRVoid(`.libPaths('${destDir}')`);
      webRInstance = webR;
      console.log('✅ WebR is ready. Cold start finished!');
    } else {
      console.log('⚡️ Warm start: Reusing existing WebR instance.');
    }

    // 2. Get the request body from `request.body`. Vercel automatically parses JSON.
    if (!request.body) throw new Error('Request body is missing.');
    const { dataCsv } = request.body;

    // --- YOUR CORE WEBR LOGIC (UNCHANGED) ---
    const shelter = await new webRInstance.Shelter();
    try {
      await shelter.evalR(`inputData <- ${JSON.stringify(dataCsv || "")}`);
      const resultProxy = await shelter.evalR(ld50ScriptContent);
      const outputJson = await resultProxy.toString(); // This is a JSON string
      if (!outputJson) throw new Error('R script returned no value.');
      
      // 3. Send a successful response using the `response` object.
      // We set the header and send the raw JSON string from R.
      response.status(200).setHeader('Content-Type', 'application/json').send(outputJson);

    } finally {
      await shelter.purge();
    }

  } catch (error) {
    console.error('🔥 Error in Vercel function:', error);
    // 4. Send an error response using the `response` object.
    response.status(500).json({ error: error.message });
  }
}