// src/services/webr-service.ts (v12.2)
// Persistence via OPFS (Origin Private File System). No IDBFS syncfs.
// - First run: install pkgs into MEMFS (/webr/memlib-v12), then mirror to OPFS
// - Refresh: restore OPFS → MEMFS before using R, so no re-downloads
// - Ultra-verbose logs; helpers exposed on window

import { WebR } from "webr";

/* =============================== Settings =============================== */

const R_PACKAGES = ["drc", "jsonlite", "ggplot2", "base64enc"] as const;
const MEM_LIB = "/webr/memlib-v12";            // runtime lib path in MEMFS
const OPFS_ROOT_DIR = "webr-library-v12";      // OPFS mirror root dir
const OPFS_MARKER_FILE = ".ok";                // signals a complete mirror
const FILE_BATCH_FLUSH_COUNT = 50;

/* ============================== Logging ================================= */

export type LogFn = (msg: string) => void;

declare global {
  interface Window {
    WEBR_LOGS?: string[];
    getWebRLogs?: () => string[];
    startAnalysisEngine?: () => Promise<void>;
    initWebR?: (onLog?: LogFn) => Promise<void>;
    getWebR?: () => WebR | null;
    forcePersistStorage?: () => Promise<boolean | undefined>;
    opfsWipe?: (onLog?: LogFn) => Promise<void>;
  }
}

const ts = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const GLOBAL_LOG_SINK: LogFn = (msg: string) => {
  try {
    if (typeof window !== "undefined") {
      window.WEBR_LOGS = window.WEBR_LOGS || [];
      window.WEBR_LOGS.push(msg);
      window.dispatchEvent?.(new CustomEvent("webr-log", { detail: msg }));
      window.getWebRLogs = () => window.WEBR_LOGS!;
    }
  } catch {}
  try { console.log(msg); } catch {}
};
const L = (onLog: LogFn) => (m: string) => onLog?.(`[${ts()}] ${m}`);

async function timed<T>(label: string, onLog: LogFn, fn: () => Promise<T>): Promise<T> {
  const log = L(onLog);
  const t0 = performance?.now?.() ?? Date.now();
  log(`⏱️ start: ${label}`);
  try {
    const r = await fn();
    const t1 = performance?.now?.() ?? Date.now();
    log(`✅ done:  ${label} (${(t1 - t0).toFixed(1)} ms)`);
    return r;
  } catch (e) {
    const t1 = performance?.now?.() ?? Date.now();
    log(`❌ fail:  ${label} (${(t1 - t0).toFixed(1)} ms): ${String(e)}`);
    throw e;
  }
}

/* ============================== Singletons ============================== */

let webRInstance: WebR | null = null;
let initPromise: Promise<void> | null = null;

/* ============================== WebR helpers ============================ */

function hasFS(webR: WebR, m: string) {
  // @ts-ignore
  return !!(webR as any)?.FS && typeof (webR as any).FS[m] === "function";
}
async function FSCall<T = any>(webR: WebR, m: string, ...args: any[]): Promise<T> {
  // @ts-ignore
  return (webR as any).FS[m](...args);
}
async function ensureDirFS(webR: WebR, path: string) {
  const parts = path.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur += `/${p}`;
    try { await FSCall(webR, "mkdir", cur); } catch {}
  }
}
async function evalRVoid(webR: WebR, code: string, onLog: LogFn = GLOBAL_LOG_SINK) {
  try {
    // @ts-ignore
    if (typeof (webR as any).evalRVoid === "function") return (webR as any).evalRVoid(code);
    const res = await webR.evalR(code);
    // @ts-ignore
    await res?.destroy?.();
  } catch (e) { L(onLog)(`[R ERR] ${String(e)}`); throw e; }
}
async function evalRString(webR: WebR, code: string, onLog: LogFn = GLOBAL_LOG_SINK): Promise<string> {
  try {
    const res = await webR.evalR(code);
    const out = await (res as any)?.toString?.();
    // @ts-ignore
    await (res as any)?.destroy?.();
    return `${out ?? ""}`;
  } catch (e) { L(onLog)(`[R ERR] ${String(e)}`); throw e; }
}

/* ============================== OPFS helpers ============================ */

function haveOPFS(): boolean {
  // @ts-ignore
  return !!(navigator?.storage?.getDirectory);
}

async function getOPFSRootDir(onLog: LogFn): Promise<FileSystemDirectoryHandle> {
  // @ts-ignore
  const root: FileSystemDirectoryHandle = await navigator.storage.getDirectory();
  const log = L(onLog);
  let dir = root;
  for (const p of OPFS_ROOT_DIR.split("/").filter(Boolean)) {
    dir = await dir.getDirectoryHandle(p, { create: true });
  }
  log(`OPFS: root=${OPFS_ROOT_DIR}`);
  return dir;
}

async function opfsRemoveAll(onLog: LogFn) {
  const dir = await getOPFSRootDir(onLog);
  // @ts-ignore
  if (!(dir as any).removeEntry) return;
  for await (const [name] of (dir as any).entries()) {
    try { await (dir as any).removeEntry(name, { recursive: true }); } catch {}
  }
}

async function opfsStat(dir: FileSystemDirectoryHandle, name: string): Promise<"none"|"file"|"dir"> {
  try { await dir.getFileHandle(name); return "file"; } catch {}
  try { await dir.getDirectoryHandle(name); return "dir"; } catch {}
  return "none";
}

async function ensureOPFSPath(root: FileSystemDirectoryHandle, relDir: string): Promise<FileSystemDirectoryHandle> {
  let d = root;
  for (const part of relDir.split("/").filter(Boolean)) {
    d = await d.getDirectoryHandle(part, { create: true });
  }
  return d;
}

async function opfsToFS(webR: WebR, opfsDir: FileSystemDirectoryHandle, fsPath: string, onLog: LogFn) {
  const log = L(onLog);
  await ensureDirFS(webR, fsPath);
  let processed = 0;

  async function recur(curOPFS: FileSystemDirectoryHandle, curFS: string) {
    // @ts-ignore
    for await (const [name, handle] of (curOPFS as any).entries()) {
      // @ts-ignore
      if ((handle as any).kind === "directory") {
        const nextFS = `${curFS}/${name}`;
        await ensureDirFS(webR, nextFS);
        await recur(await curOPFS.getDirectoryHandle(name), nextFS);
      } else {
        const file = await curOPFS.getFileHandle(name).then(h => h.getFile());
        const buf = await file.arrayBuffer();
        await FSCall(webR, "writeFile", `${curFS}/${name}`, new Uint8Array(buf));
        processed++;
        if (processed % FILE_BATCH_FLUSH_COUNT === 0) {
          log(`OPFS restore: ${processed} files…`);
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }
  }

  await recur(opfsDir, fsPath);
  log(`OPFS restore complete: ${processed} files`);
}

async function opfsFileExists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  const kind = await opfsStat(dir, name);
  return kind === "file";
}

async function opfsWriteText(dir: FileSystemDirectoryHandle, name: string, text: string) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(new TextEncoder().encode(text));
  await w.close();
}

/* --------- NEW: Mirror using R to enumerate files (no FS.readdir) ------ */

async function listFilesViaR(webR: WebR, root: string, onLog: LogFn): Promise<string[]> {
  const log = L(onLog);
  const code = `
    root <- ${JSON.stringify(root)}
    if (!dir.exists(root)) "" else
      paste(list.files(root, recursive=TRUE, all.files=TRUE, include.dirs=FALSE), collapse="\\n")
  `.trim();
  const out = await evalRString(webR, code, onLog);
  const files = out.split("\n").map(s => s.trim()).filter(Boolean);
  log(`R listed ${files.length} files under ${root}`);
  return files;
}

async function fsToOPFS_viaRListing(
  webR: WebR,
  fsRoot: string,
  opfsDir: FileSystemDirectoryHandle,
  onLog: LogFn
) {
  const log = L(onLog);
  if (!hasFS(webR, "readFile")) throw new Error("webR.FS.readFile is not available");
  const files = await listFilesViaR(webR, fsRoot, onLog);
  let processed = 0;
  for (const rel of files) {
    const srcPath = `${fsRoot}/${rel}`;
    const dirPath = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    const targetDir = await ensureOPFSPath(opfsDir, dirPath);
    const fh = await targetDir.getFileHandle(rel.split("/").pop()!, { create: true });
    const w = await fh.createWritable();
    const data: Uint8Array = await FSCall(webR, "readFile", srcPath, { encoding: "binary" });
    await w.write(data);
    await w.close();
    processed++;
    if (processed % FILE_BATCH_FLUSH_COUNT === 0) {
      log(`OPFS mirror: ${processed} files…`);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  log(`OPFS mirror complete: ${processed} files`);
}

/* ============================== Environment ============================= */

async function logEnvironment(onLog: LogFn) {
  const log = L(onLog);
  try {
    if (typeof location !== "undefined") log(`ENV origin: ${location.protocol}//${location.host}`);
    if (typeof navigator !== "undefined") {
      log(`ENV userAgent: ${navigator.userAgent}`);
      const st: any = (navigator as any).storage;
      if (st?.estimate) {
        try {
          const est = await st.estimate();
          log(`ENV storage: quota=${Math.round((est.quota ?? 0)/1048576)}MB usage=${Math.round((est.usage ?? 0)/1048576)}MB`);
        } catch (e) { log(`ENV storage.estimate error: ${String(e)}`); }
      }
      if (st?.persisted) {
        try { log(`ENV storage.persisted(): ${await st.persisted()}`); } catch (e) { log(`ENV storage.persisted error: ${String(e)}`); }
      }
    }
    if ((indexedDB as any)?.databases) {
      try {
        const dbs = await (indexedDB as any).databases();
        log(`ENV indexedDB: ${dbs.map((d: any) => `${d?.name||"unnamed"}${d?.version?`@${d.version}`:""}`).join(" | ") || "(none)"}`);
      } catch (e) { log(`ENV indexedDB.databases error: ${String(e)}`); }
    }
    log(`ENV OPFS available: ${haveOPFS()}`);
  } catch (e) { log(`ENV logging error: ${String(e)}`); }
}

export async function forcePersistStorage(): Promise<boolean | undefined> {
  try {
    // @ts-ignore
    const ok = await (navigator as any)?.storage?.persist?.();
    console.log(`[${ts()}] storage.persist():`, ok);
    return ok as any;
  } catch (e) {
    console.log(`[${ts()}] storage.persist() error:`, e);
  }
}

/* ============================== Core init =============================== */

async function setLibPaths(webR: WebR, lib: string, onLog: LogFn) {
  const esc = lib.replace(/"/g, '\\"');
  await evalRVoid(webR, `
    dir.create("${esc}", showWarnings=FALSE, recursive=TRUE)
    .libPaths(unique(c("${esc}", .libPaths())))
    Sys.setenv(R_LIBS_USER="${esc}")
  `.trim(), onLog);
}

async function detectMissingPackages(webR: WebR, pkgs: readonly string[], onLog: LogFn): Promise<string[]> {
  if (!pkgs.length) return [];
  const esc = MEM_LIB.replace(/"/g, '\\"');
  const dirs = await evalRString(webR, `
    if (!dir.exists("${esc}")) "" else paste(list.dirs("${esc}", recursive=FALSE, full.names=FALSE), collapse="\\n")
  `.trim(), onLog);
  const have = new Set(dirs.split("\n").map(s => s.trim()).filter(Boolean));
  L(onLog)(`packages in lib (dir count): ${have.size}`);
  const missing = pkgs.filter(p => !have.has(p));
  const present = pkgs.filter(p => have.has(p));
  L(onLog)(`present (dir check): ${present.join(", ") || "(none)"}`);
  return missing;
}

function logFSStatus(webR: WebR, onLog: LogFn) {
  const names = ["mkdir","mount","unmount","writeFile","unlink","rmdir","analyzePath","lookupPath","syncfs","readFile"];
  const have = names.filter(n => hasFS(webR, n));
  L(onLog)(`FS capability: ${have.join(", ") || "(none)"}`);
}

export async function initWebR(onLog: LogFn = GLOBAL_LOG_SINK): Promise<void> {
  if (webRInstance) return;
  if (initPromise) return initPromise;

  const log = L(onLog);

  initPromise = (async () => {
    log("======== initWebR() begin ========");
    await logEnvironment(onLog);

    try {
      // @ts-ignore
      const ok = await (navigator as any)?.storage?.persist?.();
      log(`storage.persist(): ${ok === true ? "true" : String(ok)}`);
    } catch (e) { log(`storage.persist() error: ${String(e)}`); }

    const webR = new WebR({} as any);

    await timed("webR.init()", onLog, async () => { await webR.init(); });

    logFSStatus(webR, onLog);
    try {
      log(`R version: ${await evalRString(webR, "paste(R.version$major, R.version$minor, sep='.')", onLog)}`);
      log(`.libPaths() pre: ${await evalRString(webR, `paste(.libPaths(), collapse=" | ")`, onLog)}`);
    } catch (e) { log(`R pre info error: ${String(e)}`); }

    // Prepare MEMFS path for R
    await timed(`mkdir ${MEM_LIB}`, onLog, async () => { await ensureDirFS(webR, MEM_LIB); });
    await timed("configure .libPaths() and R_LIBS_USER", onLog, async () => { await setLibPaths(webR, MEM_LIB, onLog); });

    // Restore library from OPFS if present
    if (haveOPFS()) {
      const opfsDir = await getOPFSRootDir(onLog);
      const hasMarker = await opfsFileExists(opfsDir, OPFS_MARKER_FILE);
      log(`OPFS marker exists: ${hasMarker}`);
      if (hasMarker) {
        await timed(`OPFS → MEMFS restore (${OPFS_ROOT_DIR} → ${MEM_LIB})`, onLog, async () => {
          await opfsToFS(webR, opfsDir, MEM_LIB, onLog);
        });
      } else {
        log("OPFS marker missing: cold start");
      }
    } else {
      log("OPFS unavailable → running ephemeral (no persistence).");
    }

    log(`.libPaths() post: ${await evalRString(webR, `paste(.libPaths(), collapse=" | ")`, onLog)}`);

    // Install missing packages (into MEM_LIB)
    const missing = await detectMissingPackages(webR, R_PACKAGES, onLog);
    log(missing.length ? `missing: ${missing.join(", ")}` : "missing: (none)");

    if (missing.length) {
      await timed(`webR.installPackages: ${missing.join(", ")}`, onLog, async () => {
        // @ts-ignore
        await (webR as any).installPackages(missing);
      });
      // Ensure MEMFS has a marker for self-consistency
      try {
        await FSCall(webR, "writeFile", `${MEM_LIB}/${OPFS_MARKER_FILE}`, new TextEncoder().encode("ok v12\n"));
      } catch {}

      // Mirror into OPFS if available
      if (haveOPFS()) {
        const opfsDir = await getOPFSRootDir(onLog);
        await timed(`OPFS wipe old mirror`, onLog, async () => { await opfsRemoveAll(onLog); });
        await timed(`MEMFS → OPFS mirror (${MEM_LIB} → ${OPFS_ROOT_DIR})`, onLog, async () => {
          await fsToOPFS_viaRListing(webR, MEM_LIB, opfsDir, onLog);
        });
        await timed(`OPFS marker write`, onLog, async () => {
          await opfsWriteText(opfsDir, OPFS_MARKER_FILE, "ok v12\n");
        });
      }
      log("post-install: library mirrored & marked");
    } else {
      log(haveOPFS() ? "packages loaded from OPFS cache" : "packages available in memory (ephemeral)");
    }

    webRInstance = webR;
    log("======== initWebR() end =========");
  })();

  return initPromise;
}

/* ============================== Engine start ============================ */

async function preflight(onLog: LogFn) {
  const log = (m: string) => onLog(`[preflight] ${m}`);
  try {
    if (typeof location !== "undefined") log(`origin=${location.protocol}//${location.host}`);
    const ok = await new Promise<boolean>((resolve) => {
      try {
        const req = indexedDB.open("webr-preflight", 1);
        req.onupgradeneeded = () => {};
        req.onsuccess = () => { try { req.result.close(); indexedDB.deleteDatabase("webr-preflight"); } catch {} ; resolve(true); };
        req.onerror = () => resolve(false);
      } catch { resolve(false); }
    });
    log(`indexedDB: ${ok ? "ok" : "unavailable"}`);
  } catch (e) { log(`error: ${String(e)}`); }
}

export async function startAnalysisEngine(): Promise<void> {
  await preflight(GLOBAL_LOG_SINK);
  await initWebR(GLOBAL_LOG_SINK);
  // quick R ping
  const webR = getWebR();
  if (!webR) throw new Error("WebR not initialized");
  // @ts-ignore
  const res = await (webR as any).evalR(`paste(R.version$major, R.version$minor, sep='.')`);
  const s = await res.toString?.(); await res?.destroy?.();
  GLOBAL_LOG_SINK(`[health] R ok (v${(s||"").trim()})`);
}

/* ============================== Run analysis ============================ */

export async function runLd50Analysis(
  rScriptContent: string,
  dataCsv?: string,
  onLog: LogFn = GLOBAL_LOG_SINK
): Promise<any> {
  if (!webRInstance) throw new Error("WebR is not initialized. Call initWebR()/startAnalysisEngine() first.");
  // @ts-ignore
  const shelter = await new (webRInstance as any).Shelter();
  try {
    const dataForR = dataCsv ?? "";
    await timed("R: create inputData", onLog, async () => {
      await shelter.evalR(`inputData <- ${JSON.stringify(dataForR)}`);
    });
    const resultProxy = await timed("R: eval analysis script", onLog, async () => shelter.evalR(rScriptContent));
    const outputJson = await timed("R: toString() result", onLog, async () => resultProxy.toString());
    // @ts-ignore
    await resultProxy?.destroy?.();
    if (!outputJson) throw new Error("R script returned no value.");
    return JSON.parse(outputJson);
  } finally {
    await timed("Shelter.purge()", onLog, async () => { await shelter.purge(); });
  }
}

/* ============================== Utilities =============================== */

export function getWebR(): WebR | null { return webRInstance; }

export async function opfsWipe(onLog: LogFn = GLOBAL_LOG_SINK) {
  if (!haveOPFS()) return;
  await timed("OPFS wipe", onLog, async () => { await opfsRemoveAll(onLog); });
}

/* ============================ Window exports ============================ */

if (typeof window !== "undefined") {
  Object.assign(window, {
    startAnalysisEngine,
    initWebR,
    getWebR,
    forcePersistStorage,
    opfsWipe,
    getWebRLogs: () => window.WEBR_LOGS || [],
  });
}
