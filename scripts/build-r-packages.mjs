// scripts/build-r-packages.js

import { WebR } from 'webr';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

// --- Configuration ---
const PACKAGES_TO_INSTALL = ["drc", "jsonlite", "ggplot2", "base64enc"];
const OUTPUT_DIR = path.resolve(process.cwd(), 'r_packages');
// --- End Configuration ---

/**
 * Checks if the target directory exists and contains all required packages.
 * This allows us to skip the build process if it's already complete.
 * @returns {Promise<boolean>} True if packages exist, false otherwise.
 */
async function checkIfPackagesExist() {
  console.log('🔎 Checking for existing R packages...');
  try {
    for (const pkg of PACKAGES_TO_INSTALL) {
      // Check if the main directory for each package exists.
      await access(path.join(OUTPUT_DIR, pkg));
    }
    // If we get here, all packages were found.
    return true;
  } catch (error) {
    // If access throws an error, a directory is missing.
    return false;
  }
}

/**
 * Performs the core build process: initializes WebR, installs packages,
 * and copies them from the virtual file system to the local disk.
 */
async function buildAndCopyPackages() {
  console.log(' R packages not found or incomplete. Starting fresh build...');

  // Ensure we start from a clean slate if a build is necessary.
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  let webR = null;
  try {
    console.log('📦 Initializing WebR and installing packages...');
    webR = new WebR();
    await webR.init();
    await webR.installPackages(PACKAGES_TO_INSTALL);
    console.log('✅ Packages installed in WebR memory.');

    console.log('📁 Copying packages from WebR to local filesystem...');
    const virtualLibPath = '/usr/lib/R/library';

    async function copyDir(vfsSource, nodeDest) {
      await mkdir(nodeDest, { recursive: true });
      const entries = await webR.FS.readdir(vfsSource);
      for (const entry of entries) {
        if (entry === '.' || entry === '..') continue;
        
        const vfsPath = `${vfsSource}/${entry}`;
        const nodePath = path.join(nodeDest, entry);
        const stats = await webR.FS.stat(vfsPath);

        if (webR.FS.isDir(stats.mode)) {
          await copyDir(vfsPath, nodePath);
        } else {
          await writeFile(nodePath, await webR.FS.readFile(vfsPath));
        }
      }
    }

    // Only copy packages we explicitly installed to keep it lean.
    for (const pkg of PACKAGES_TO_INSTALL) {
       await copyDir(`${virtualLibPath}/${pkg}`, path.join(OUTPUT_DIR, pkg));
    }

  } finally {
    if (webR) {
      console.log(' shutting down WebR instance.');
      await webR.close();
    }
  }
}

/**
 * Aggressively removes files and directories that are not needed at runtime
 * to reduce the final serverless function size.
 */
async function stripUnnecessaryFiles() {
  console.log('🧹 Stripping unnecessary files to reduce size...');
  const patterns = ['**/doc', '**/examples', '**/help', '**/html', '**/include', '**/tests', '**/testthat'];
  let totalRemoved = 0;
  for (const pattern of patterns) {
    const fullPattern = path.join(OUTPUT_DIR, pattern).replace(/\\/g, '/'); // Ensure forward slashes for glob
    const dirsToDelete = await glob(fullPattern, { nodir: false }); // `nodir: false` is default but explicit
    for (const dir of dirsToDelete) {
      await rm(dir, { recursive: true, force: true });
      totalRemoved++;
    }
  }
  console.log(`🗑️ Removed ${totalRemoved} unnecessary directories.`);
}

/**
 * Main execution function
 */
async function main() {
  console.log('--- R Package Directory Builder ---');

  if (await checkIfPackagesExist()) {
    console.log('⏩ All required R packages already exist. Skipping build.');
    return; // Exit successfully
  }

  await buildAndCopyPackages();
  await stripUnnecessaryFiles();

  console.log(`✅ Success! Lean 'r_packages' directory is ready.`);
}

main().catch(err => {
  console.error('🔥 Build script failed:', err);
  process.exit(1);
});