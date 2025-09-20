/*
 * webr-service.ts — OPFS-backed persistence for WebR packages + robust logging
 *
 * What you get:
 *  - No IDBFS/syncfs (avoids timeouts/corruption). Uses OPFS (Origin Private File System).
 *  - Restores cached R packages on refresh (no re-downloads).
 *  - Verbose, timestamped logs for every phase with durations.
 *  - Script sanitizer + pre-parse to avoid “unexpected invalid token” errors.
 *  - Utilities: forcePersistStorage(), nukeAllWebRDatabases() for cleanup.
 */

import { WebR } from "webr";

// ────────────────────────────────────────────────────────────────────────────────
// Types & Globals
// ────────────────────────────────────────────────────────────────────────────────

export type LogFn = (msg: string) => void;

let webRInstance: WebR | null = null;
let initPromise: Promise<void> | null = null;

// Bump this when changing R version, package set, or layout
const CACHE_TAG = "v12"; // shows up as /webr/memlib-v12 and OPFS root webr-library-v12
const MEMLIB = `/webr/memlib-${CACHE_TAG}`;          // primary writable, first in .libPaths()
const OPFS_ROOT = `webr-library-${CACHE_TAG}`;       // OPFS directory that mirrors MEMLIB
const OPFS_MARKER = ".ok";                           // existence = cache is valid

// Required packages your app needs
const R_PACKAGES = ["drc", "jsonlite", "ggplot2", "base64enc"];

// ────────────────────────────────────────────────────────────────────────────────
// Logging helpers
// ────────────────────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const defaultLogger: LogFn = (m) => console.log(`[${ts()}] ${m}`);

function withTimer<T>(onLog: LogFn, label: string, fn: () => Promise<T>): Promise<T> {
  onLog(`⏱️ start: ${label}`);
  const t0 = performance.now();
  return fn().then((v) => {
    const dt = (performance.now() - t0).toFixed(1);
    onLog(`✅ done:  ${label} (${dt} ms)`);
    return v;
  }).catch((e) => {
    const dt = (performance.now() - t0).toFixed(1);
    onLog(`❌ fail:  ${label} (${dt} ms): ${e instanceof Error ? e.stack || e.message : String(e)}`);
    throw e;
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// OPFS (Origin Private File System) utilities
// ────────────────────────────────────────────────────────────────────────────────

async function getOPFSDir(name: string): Promise<FileSystemDirectoryHandle> {
  const root = await (navigator as any).storage.getDirectory();
  return await root.getDirectoryHandle(name, { create: true });
}

async function opfsGetHandle(dir: FileSystemDirectoryHandle, relPath: string, create: boolean): Promise<FileSystemFileHandle | FileSystemDirectoryHandle> {
  const parts = relPath.split("/").filter(Boolean);
  let cur: FileSystemDirectoryHandle = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(parts[i], { create });
  }
  const leaf = parts[parts.length - 1];
  return await cur.getFileHandle(leaf, { create });
}

async function opfsWriteFile(dir: FileSystemDirectoryHandle, relPath: string, data: Uint8Array) {
  const fileHandle = await opfsGetHandle(dir, relPath, true) as FileSystemFileHandle;
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

async function opfsReadFile(dir: FileSystemDirectoryHandle, relPath: string): Promise<Uint8Array | null> {
  try {
    const h = await opfsGetHandle(dir, relPath, false) as FileSystemFileHandle;
    const f = await h.getFile();
    const ab = await f.arrayBuffer();
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

async function opfsFileExists(dir: FileSystemDirectoryHandle, relPath: string): Promise<boolean> {
  try {
    await opfsGetHandle(dir, relPath, false);
    return true;
  } catch {
    return false;
  }
}

async function opfsRemoveRecursive(dir: FileSystemDirectoryHandle, relPath: string) {
  // Remove a child entry recursively
  try {
    await dir.removeEntry(relPath, { recursive: true } as any);
  } catch {
    // ignore
  }
}

async function opfsListRecursive(dir: FileSystemDirectoryHandle, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for await (const [name, handle] of (dir as any).entries()) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "file") {
      files.push(rel);
    } else if (handle.kind === "directory") {
      const child = await dir.getDirectoryHandle(name);
      const sub = await opfsListRecursive(child, rel);
      files.push(...sub);
    }
  }
  return files;
}

// ────────────────────────────────────────────────────────────────────────────────
// Emscripten FS helpers
// ────────────────────────────────────────────────────────────────────────────────

function fsEnsureDirTree(FS: any, absPath: string) {
  const parts = absPath.split("/").filter(Boolean);
  let cur = "";
  for (let i = 0; i < parts.length - 1; i++) {
    cur += "/" + parts[i];
    try { FS.mkdir(cur); } catch { /* exists */ }
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// R helpers
// ────────────────────────────────────────────────────────────────────────────────

async function evalRVoid(webR: WebR, code: string) {
  const anyWebR: any = webR as any;
  if (typeof anyWebR.evalRVoid === "function") {
    await anyWebR.evalRVoid(code);
    return;
  }
  const res: any = await webR.evalR(code);
  if (typeof res?.destroy === "function") await res.destroy();
}

function jsonForR(val: any): string {
  return JSON.stringify(val).replace(/\\u2028|\\u2029/g, (m) => ({"\u2028":"\\u2028","\u2029":"\\u2029"} as any)[m]);
}

// ────────────────────────────────────────────────────────────────────────────────
// Script sanitation (fixes “unexpected invalid token” from stray BOM/ZWSP/NUL)
// ────────────────────────────────────────────────────────────────────────────────

function sanitizeRScript(src: string): string {
  // Strip BOM
  src = src.replace(/^\uFEFF/, "");
  // Normalize line endings
  src = src.replace(/\r\n?/g, "\n");
  // Replace weird spaces with normal spaces
  src = src.replace(/[\u00A0\u2007\u202F\u2000-\u200B\u2060]/g, " ");
  // Drop control chars (except tab/newline)
  src = src.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return src;
}

async function rPreparse(webR: WebR, rScript: string): Promise<string | null> {
  const js = jsonForR(rScript);
  const code = `tryCatch({ parse(text=${js}, keep.source=TRUE); "OK" }, error=function(e) paste("PARSE_ERROR:", conditionMessage(e)))`;
  const res: any = await webR.evalR(code);
  const out = (await res.toString()).trim();
  if (typeof res?.destroy === "function") await res.destroy();
  return out === "OK" ? null : out;
}

// ────────────────────────────────────────────────────────────────────────────────
// OPFS ↔ MEMFS: restore & mirror
// ────────────────────────────────────────────────────────────────────────────────

async function restoreFromOPFSToMemFS(webR: WebR, onLog: LogFn) {
  const FS: any = (webR as any).FS;
  const opfsDir = await getOPFSDir(OPFS_ROOT);
  const markerExists = await opfsFileExists(opfsDir, OPFS_MARKER);
  onLog(`OPFS marker exists: ${markerExists}`);
  if (!markerExists) return false;

  let count = 0;
  await withTimer(onLog, `OPFS → MEMFS restore (${OPFS_ROOT} → ${MEMLIB})`, async () => {
    const all = await opfsListRecursive(opfsDir);
    for (const rel of all) {
      if (rel === OPFS_MARKER) continue;
      const data = await opfsReadFile(opfsDir, rel);
      if (!data) continue;
      const dst = `${MEMLIB}/${rel}`;
      fsEnsureDirTree(FS, dst);
      FS.writeFile(dst, data);
      count++;
      if (count % 50 === 0) onLog(`OPFS restore: ${count} files…`);
    }
    onLog(`OPFS restore complete: ${count} files`);
  });
  return count > 0;
}

async function mirrorMemFSToOPFS(webR: WebR, onLog: LogFn) {
  const FS: any = (webR as any).FS;
  const opfsDir = await getOPFSDir(OPFS_ROOT);

  // Wipe prior content in OPFS root (cheap on small trees)
  onLog(`OPFS: root=${OPFS_ROOT}`);
  await withTimer(onLog, "OPFS wipe old mirror", async () => {
    // Remove everything by recreating the directory
    try { await opfsRemoveRecursive(await getOPFSDir("" as any), OPFS_ROOT); } catch {}
    // Recreate root
    await getOPFSDir(OPFS_ROOT);
  });

  // Build manifest of files in MEMLIB using R (portable & robust)
  const listR: any = await webR.evalR(`paste(list.files(${jsonForR(MEMLIB)}, recursive=TRUE, all.files=TRUE), collapse="\n")`);
  const listStr = (await listR.toString()) || "";
  if (typeof listR?.destroy === "function") await listR.destroy();
  const relFiles = listStr.split("\n").filter(Boolean);

  let count = 0;
  await withTimer(onLog, `MEMFS → OPFS mirror (${MEMLIB} → ${OPFS_ROOT})`, async () => {
    for (const rel of relFiles) {
      const src = `${MEMLIB}/${rel}`;
      const data: Uint8Array = FS.readFile(src);
      await opfsWriteFile(opfsDir, rel, data);
      count++;
      if (count % 100 === 0) onLog(`OPFS mirror: ${count}/${relFiles.length} files…`);
    }
    // Write marker last
    await opfsWriteFile(opfsDir, OPFS_MARKER, new TextEncoder().encode(CACHE_TAG));
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────────

export async function initWebR(onLog: LogFn = defaultLogger) {
  if (webRInstance) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    onLog("======== initWebR() begin ========");
    try {
      // Env diagnostics
      try {
        const est = await (navigator as any).storage?.estimate?.();
        const quotaMB = est?.quota ? Math.round(est.quota / (1024 * 1024)) : "?";
        const usageMB = est?.usage ? Math.round(est.usage / (1024 * 1024)) : "?";
        onLog(`ENV origin: ${location.origin}`);
        onLog(`ENV userAgent: ${navigator.userAgent}`);
        onLog(`ENV storage: quota=${quotaMB}MB usage=${usageMB}MB`);
        const persisted = await (navigator as any).storage?.persisted?.();
        onLog(`ENV storage.persisted(): ${!!persisted}`);
        if ((indexedDB as any).databases) {
          const dbs = await (indexedDB as any).databases();
          onLog(`ENV indexedDB: ${dbs.map((d: any) => `${d.name}@${d.version}`).join(" | ")}`);
        }
      } catch {}

      // Start WebR
      const webR = await withTimer(onLog, "webR.init()", async () => {
        const w = new WebR();
        await w.init();
        return w;
      });

      const FS: any = (webR as any).FS;
      onLog(`FS capability: mkdir, mount, unmount, writeFile, unlink, rmdir, analyzePath, lookupPath, syncfs, readFile`);

      // Configure R library paths to use MEMLIB first
      await withTimer(onLog, `mkdir ${MEMLIB}`, async () => { try { FS.mkdir(MEMLIB); } catch {} });
      onLog(`.libPaths() pre: /usr/lib/R/library`);
      await withTimer(onLog, "configure .libPaths() and R_LIBS_USER", async () => {
        await evalRVoid(webR, `
          dir.create(${jsonForR(MEMLIB)}, showWarnings=FALSE, recursive=TRUE)
          .libPaths(unique(c(${jsonForR(MEMLIB)}, .libPaths())))
          Sys.setenv(R_LIBS_USER=${jsonForR(MEMLIB)})
        `.trim());
      });

      // Try restoring from OPFS
      await restoreFromOPFSToMemFS(webR, onLog);
      onLog(`.libPaths() post: ${MEMLIB} | /usr/lib/R/library`);

      // Detect missing packages (simple dir check)
      const listDirRes: any = await webR.evalR(`paste(list.dirs(${jsonForR(MEMLIB)}, full.names=FALSE, recursive=FALSE), collapse=",")`);
      const dirList = ((await listDirRes.toString()) || "").split(",").filter(Boolean);
      if (typeof listDirRes?.destroy === "function") await listDirRes.destroy();
      onLog(`packages in lib (dir count): ${dirList.length}`);

      const present = R_PACKAGES.filter((p) => dirList.includes(p));
      const missing = R_PACKAGES.filter((p) => !dirList.includes(p));
      onLog(`present (dir check): ${present.join(", ") || "(none)"}`);
      onLog(`missing: ${missing.join(", ") || "(none)"}`);

      if (missing.length) {
        await withTimer(onLog, `webR.installPackages: ${missing.join(", ")}`, async () => {
          await (webR as any).installPackages(missing, { mount: false });
        });
        await mirrorMemFSToOPFS(webR, onLog); // persist freshly installed pkgs
      } else {
        onLog("packages loaded from OPFS cache");
      }

      webRInstance = webR;
      onLog("======== initWebR() end =========");
    } catch (e) {
      initPromise = null;
      onLog(`FATAL: initWebR failed: ${e instanceof Error ? e.stack || e.message : String(e)}`);
      throw e;
    }
  })();

  return initPromise;
}

export function getWebR(): WebR | null { return webRInstance; }

// Run analysis script. The script's *last* expression must print JSON (via jsonlite::toJSON)
export async function runLd50Analysis(rScriptContent: string, dataCsv?: string): Promise<any> {
  if (!webRInstance) throw new Error("WebR is not initialized. Call initWebR() first.");
  const webR = webRInstance as any;

  const script = sanitizeRScript(rScriptContent);
  const parseErr = await rPreparse(webRInstance!, script);
  if (parseErr) {
    console.error("R script pre-parse failed:", parseErr);
    throw new Error(parseErr);
  }

  const shelter = await new webR.Shelter();
  try {
    defaultLogger("⏱️ start: R: create inputData");
    await evalRVoid(webRInstance!, `inputData <- ${jsonForR(dataCsv ?? "")}`);
    defaultLogger("✅ done:  R: create inputData (instant)");

    defaultLogger("⏱️ start: R: eval analysis script");
    const res: any = await shelter.evalR(script);
    const out = (await res.toString())?.trim();
    if (typeof res?.destroy === "function") await res.destroy();
    if (!out) throw new Error("R script returned no value.");
    defaultLogger("✅ done:  R: eval analysis script");
    return JSON.parse(out);
  } catch (e: any) {
    defaultLogger(`❌ fail:  R: eval analysis script: ${e?.message || e}`);
    throw e;
  } finally {
    defaultLogger("⏱️ start: Shelter.purge()");
    await shelter.purge();
    defaultLogger("✅ done:  Shelter.purge()");
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Utilities: persistence + cleanup
// ────────────────────────────────────────────────────────────────────────────────

export async function forcePersistStorage(onLog: LogFn = defaultLogger): Promise<boolean> {
  if (!(navigator as any).storage?.persist) return false;
  const already = await (navigator as any).storage.persisted();
  onLog(`storage.persisted(): ${!!already}`);
  if (already) return true;
  const ok = await (navigator as any).storage.persist();
  onLog(`storage.persist(): ${!!ok}`);
  return !!ok;
}

export async function nukeAllWebRDatabases(): Promise<void> {
  // Delete OPFS mirrors
  try {
    const root = await (navigator as any).storage.getDirectory();
    for await (const [name] of (root as any).entries()) {
      if (String(name).startsWith("webr-library-")) {
        try { await root.removeEntry(name, { recursive: true } as any); } catch {}
      }
    }
  } catch {}

  // Delete IndexedDB caches commonly used by old approaches
  try {
    const dbs = (indexedDB as any).databases ? await (indexedDB as any).databases() : [];
    for (const db of dbs) {
      const name = db?.name as string | undefined;
      if (!name) continue;
      if (name.startsWith("/webr/library") || name === "emscripten_filesystem") {
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
      }
    }
  } catch {}
}

// Make cleanup helpers reachable from DevTools
;(window as any).nukeAllWebRDatabases = nukeAllWebRDatabases;
;(window as any).forcePersistStorage = forcePersistStorage;
