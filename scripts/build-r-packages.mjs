import { WebR } from "webr";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// --- Configuration ---
const PACKAGES_TO_INSTALL = ["drc", "jsonlite", "ggplot2", "base64enc"];
const OUTPUT_DIR = path.resolve(process.cwd(), "r_packages");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const DIRECTORIES_TO_STRIP = new Set([
  "doc",
  "examples",
  "help",
  "html",
  "include",
  "tests",
  "testthat",
]);
// --- End Configuration ---

async function readManifest() {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Invalid manifest structure");
  }
  return parsed;
}

async function checkIfPackagesExist() {
  console.log("Checking for existing R packages...");
  try {
    const packages = await readManifest();
    if (!packages.length) throw new Error("Empty manifest");
    for (const pkg of packages) {
      await access(path.join(OUTPUT_DIR, pkg));
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function listInstalledPackages(webR) {
  const csv = await webR.evalRRaw(
    'paste(installed.packages(lib.loc="/usr/lib/R/library")[,"Package"], collapse=",")',
    "string"
  );
  if (!csv) return [];
  return csv
    .split(",")
    .map((pkg) => pkg.trim())
    .filter(Boolean);
}

async function buildAndCopyPackages() {
  console.log("R packages not found or incomplete. Starting fresh build...");
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  let webR;
  try {
    console.log("Initialising WebR and installing packages...");
    webR = new WebR();
    await webR.init();

    const beforeInstall = new Set(await listInstalledPackages(webR));

    await webR.installPackages(PACKAGES_TO_INSTALL);
    console.log("Packages installed in WebR memory.");

    const afterInstall = await listInstalledPackages(webR);
    const packagesToCopy = new Set(
      afterInstall.filter((pkg) => !beforeInstall.has(pkg))
    );
    for (const pkg of PACKAGES_TO_INSTALL) {
      packagesToCopy.add(pkg);
    }

    let packagesArray = [...packagesToCopy];
    if (!packagesArray.length) {
      console.warn("No new packages detected; copying requested packages only.");
      packagesArray = [...new Set(PACKAGES_TO_INSTALL)];
    }

    console.log(`Copying ${packagesArray.length} packages into ${OUTPUT_DIR}`);

    const virtualLibPath = "/usr/lib/R/library";

    const copyDir = async (vfsSource, nodeDest, node) => {
      await mkdir(nodeDest, { recursive: true });
      const entries = node.contents ?? {};

      for (const [entryName, entryNode] of Object.entries(entries)) {
        if (entryName === "." || entryName === "..") continue;

        const vfsPath = `${vfsSource}/${entryName}`;
        const destPath = path.join(nodeDest, entryName);

        if (entryNode.isFolder) {
          const childNode = entryNode.contents
            ? entryNode
            : await webR.FS.lookupPath(vfsPath);
          await copyDir(vfsPath, destPath, childNode);
        } else {
          const fileData = await webR.FS.readFile(vfsPath);
          await writeFile(destPath, fileData);
        }
      }
    };

    for (const pkg of packagesArray) {
      const sourcePath = `${virtualLibPath}/${pkg}`;
      let node;
      try {
        node = await webR.FS.lookupPath(sourcePath);
      } catch (error) {
        console.warn(`Skipping copy for '${pkg}': package directory not found in WebR library.`);
        continue;
      }

      if (!node || !node.isFolder) {
        console.warn(`Skipping copy for '${pkg}': unexpected filesystem node.`);
        continue;
      }

      await copyDir(sourcePath, path.join(OUTPUT_DIR, pkg), node);
    }

    await writeFile(MANIFEST_PATH, JSON.stringify(packagesArray, null, 2));
  } finally {
    if (webR) {
      console.log("Shutting down WebR instance.");
      await webR.close();
    }
  }
}

async function stripUnnecessaryFiles() {
  console.log("Stripping unnecessary files to reduce size...");
  let removed = 0;
  let packages;

  try {
    packages = await readManifest();
  } catch (error) {
    console.warn("No manifest found; skipping file stripping step.");
    return;
  }

  const visit = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (DIRECTORIES_TO_STRIP.has(entry.name)) {
          await rm(fullPath, { recursive: true, force: true });
          removed += 1;
        } else {
          await visit(fullPath);
        }
      }
    }
  };

  for (const pkg of packages) {
    const pkgDir = path.join(OUTPUT_DIR, pkg);
    try {
      await visit(pkgDir);
    } catch (error) {
      console.warn(`Skipping directory cleanup for '${pkg}':`, error.message);
    }
  }

  console.log(`Removed ${removed} unnecessary directories.`);
}

async function main() {
  console.log("--- R Package Directory Builder ---");

  if (await checkIfPackagesExist()) {
    console.log("All required R packages already exist. Skipping build.");
    return;
  }

  await buildAndCopyPackages();
  await stripUnnecessaryFiles();

  console.log("Success! Lean 'r_packages' directory is ready.");
}

main().catch((err) => {
  console.error("Build script failed:", err);
  process.exit(1);
});
