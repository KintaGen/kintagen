import { Handler } from '@netlify/functions';
import { WebR } from 'webr';
import { ld50ScriptContent } from '../scripts/ld50-script';
import path from "node:path";
import fs from "node:fs";

let webRInstance: WebR | null = null;

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    if (!webRInstance) {
      console.log('🚀 Cold start: Initializing WebR with bundled packages...');
      const webR = new WebR();
      await webR.init();

      console.log("Copying bundled packages into WebR's memory...");
      
      // The source directory bundled with the function
      const sourceDir = path.resolve(__dirname,'..','..', 'r_packages');
      // The destination directory inside WebR's in-memory filesystem
      const destDir = '/packages';

      await webR.FS.mkdir(destDir);

      // --- THIS IS THE CRITICAL FIX ---
      // A recursive function to copy directories and their contents.
      const copyDirectoryRecursive = async (source: string, destination: string) => {
        const entries = fs.readdirSync(source, { withFileTypes: true });

        for (const entry of entries) {
          const sourcePath = path.join(source, entry.name);
          const destPath = path.join(destination, entry.name);

          if (entry.isDirectory()) {
            // If it's a directory, create it in WebR and recurse
            await webR.FS.mkdir(destPath);
            await copyDirectoryRecursive(sourcePath, destPath);
          } else {
            // If it's a file, read it and write it to WebR's VFS
            const fileContent = fs.readFileSync(sourcePath);
            await webR.FS.writeFile(destPath, fileContent);
          }
        }
      };
      
      // Start the recursive copy process
      await copyDirectoryRecursive(sourceDir, destDir);
      console.log('Package copy complete.');
      // --- END OF FIX ---

      await webR.evalRVoid(`.libPaths('${destDir}')`);
      webRInstance = webR;
      console.log('✅ WebR is ready. Cold start finished!');
    } else {
      console.log('⚡️ Warm start: Reusing existing WebR instance.');
    }

    if (!event.body) throw new Error('Request body is missing.');
    const { dataCsv } = JSON.parse(event.body);

    const shelter = await new webRInstance.Shelter();
    try {
      await shelter.evalR(`inputData <- ${JSON.stringify(dataCsv || "")}`);
      const resultProxy = await shelter.evalR(ld50ScriptContent);
      const outputJson = await resultProxy.toString();
      if (!outputJson) throw new Error('R script returned no value.');
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: outputJson,
      };
    } finally {
      await shelter.purge();
    }

  } catch (error: any) {
    console.error('🔥 Error in Netlify function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export { handler };