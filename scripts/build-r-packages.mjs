import { WebR } from 'webr';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

// We will use the FULL package set, as this is the version that worked for you.
const PACKAGES_TO_INSTALL = ["drc", "jsonlite", "ggplot2", "base64enc"];
// This script will create a directory named `r_packages` at the project root.
const OUTPUT_DIR = path.resolve(process.cwd(), 'r_packages');

async function main() {
  console.log('--- R Package Directory Builder (for Netlify Function) ---');

  // To ensure the leanest build, we always start from scratch.
  if (await access(OUTPUT_DIR).then(() => true).catch(() => false)) {
    console.log('Found existing r_packages directory. Removing for a clean build...');
    await rm(OUTPUT_DIR, { recursive: true, force: true });
  }

  console.log('📦 Starting fresh package installation...');
  let webR = null;
  try {
    webR = new WebR();
    await mkdir(OUTPUT_DIR, { recursive: true });
    await webR.init();
    await webR.installPackages(PACKAGES_TO_INSTALL);
    
    console.log('Copying packages from WebR memory to local filesystem...');
    const virtualLibPath = '/usr/lib/R/library';
    async function copyDir(vfsSource, nodeDest) {
      await mkdir(nodeDest, { recursive: true });
      const entries = Object.keys((await webR.FS.lookupPath(vfsSource)).contents);
      for (const entry of entries) {
        const vfsPath = `${vfsSource}/${entry}`;
        const nodePath = path.join(nodeDest, entry);
        const vfsEntry = await webR.FS.lookupPath(vfsPath);
        if (vfsEntry.isFolder) await copyDir(vfsPath, nodePath);
        else await writeFile(nodePath, await webR.FS.readFile(vfsPath));
      }
    }
    const allPkgs = Object.keys((await webR.FS.lookupPath(virtualLibPath)).contents);
    for (const pkg of allPkgs) {
      if (pkg.startsWith('.')) continue;
      await copyDir(`${virtualLibPath}/${pkg}`, path.join(OUTPUT_DIR, pkg));
    }
  } finally {
    if (webR) await webR.close();
  }

  // AGGRESSIVE STRIPPING: This is the most important step to reduce size.
  console.log('🧹 Aggressively stripping unnecessary files from packages...');
  const patterns = ['**/doc', '**/examples', '**/help', '**/html', '**/include', '**/tests', '**/testthat'];
  for (const pattern of patterns) {
    const dirsToDelete = await glob(path.join(OUTPUT_DIR, pattern));
    for (const dir of dirsToDelete) {
      await rm(dir, { recursive: true, force: true });
    }
  }

  console.log(`✅ Success! Created lean r_packages directory.`);
}

main().catch(err => {
  console.error('🔥 Build script failed:', err);
  process.exit(1);
});