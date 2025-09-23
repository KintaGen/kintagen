// scripts/copy-webr-assets.js

import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const vercelOutputDir = path.resolve(process.cwd(), '.vercel/output');
  const staticDir = path.join(vercelOutputDir, 'static/webr-assets');
  const sourceDir = path.resolve(process.cwd(), 'node_modules/webr/dist');

  console.log('--- Copying WebR assets for Vercel deployment ---');

  try {
    // Ensure the destination directory exists
    await mkdir(staticDir, { recursive: true });

    // Copy the entire contents of node_modules/webr/dist
    await cp(sourceDir, staticDir, { recursive: true });

    console.log(`✅ Successfully copied WebR assets to ${staticDir}`);
  } catch (err) {
    console.error('🔥 Failed to copy WebR assets:', err);
    process.exit(1);
  }
}

main();