import { WebR, ChannelType } from "webr";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const { ld50ScriptContent } = require("./scripts/ld50-script.cjs");
const WEBR_VERSION = process.env.WEBR_VERSION ?? "0.5.5";

let webRInstance: any = null;
let cachedBaseUrl: string | null = null;

const CHANNEL_LABEL: Record<number, string> = {
  [ChannelType.SharedArrayBuffer]: "SharedArrayBuffer",
  [ChannelType.PostMessage]: "PostMessage",
};

function ensureTrailingSlash(value: string): string {
  if (!value) return value;
  if (value.endsWith("/") || value.endsWith("\\")) return value;
  return value.includes("://") ? `${value}/` : `${value}${path.sep}`;
}

function normalizeBasePath(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("file://")) {
    return ensureTrailingSlash(fileURLToPath(trimmed));
  }
  return ensureTrailingSlash(trimmed);
}

function resolveBaseUrl(request: any): string {
  const envBase = normalizeBasePath(process.env.WEBR_BASE_URL);
  if (envBase) return envBase;

  try {
    const workerPath = require.resolve("webr/package.json");
    const distDir = path.resolve(path.dirname(workerPath), "dist");
    if (fs.existsSync(path.join(distDir, "webr-worker.js"))) {
      return ensureTrailingSlash(distDir);
    }
  } catch (error) {
    console.warn("[webR] Failed to resolve local webr assets via package.json", error);
  }

  const candidates = [
    ".vercel/output/static/webr-assets",
    ".output/static/webr-assets",
    "static/webr-assets",
    "webr-assets",
  ];

  for (const candidate of candidates) {
    const abs = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(path.join(abs, "webr-worker.js"))) {
      return ensureTrailingSlash(abs);
    }
  }

  if (process.env.VERCEL_URL) {
    return ensureTrailingSlash(`https://${process.env.VERCEL_URL}/webr-assets/`);
  }

  const host = request?.headers?.host;
  if (host) {
    return ensureTrailingSlash(`https://${host}/webr-assets/`);
  }

  return ensureTrailingSlash(`https://webr.r-wasm.org/${WEBR_VERSION}/`);
}

async function startWebR(baseUrl: string) {
  const attempt = async (channelType: number) => {
    const instance = new WebR({ baseUrl, channelType });
    const label = CHANNEL_LABEL[channelType] ?? `channel ${channelType}`;

    try {
      await instance.init();
      console.log(`[webR] init succeeded using ${label} channel.`);
      return instance;
    } catch (error) {
      console.error(`[webR] init failed using ${label} channel.`, error);
      try {
        await instance.close();
      } catch {
        // ignore errors when closing a failed instance
      }
      throw error;
    }
  };

  try {
    return await attempt(ChannelType.SharedArrayBuffer);
  } catch (error) {
    console.warn("[webR] Falling back to PostMessage channel after SharedArrayBuffer failure.");
    return await attempt(ChannelType.PostMessage);
  }
}

async function copyBundledPackages(webR: any) {
  const sourceDir = path.resolve(process.cwd(), "r_packages");
  if (!fs.existsSync(sourceDir)) {
    console.warn(`[webR] Skipping package copy. Source directory missing: ${sourceDir}`);
    return;
  }

  const destDir = "/packages";

  try {
    await webR.FS.mkdir(destDir);
  } catch (err: any) {
    if (!/EEXIST/i.test(err?.message || "")) {
      throw err;
    }
  }

  const stack: Array<{ source: string; dest: string }> = [{ source: sourceDir, dest: destDir }];

  while (stack.length) {
    const { source, dest } = stack.pop()!;
    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.posix.join(dest, entry.name);

      if (entry.isDirectory()) {
        try {
          await webR.FS.mkdir(destPath);
        } catch (err: any) {
          if (!/EEXIST/i.test(err?.message || "")) {
            throw err;
          }
        }
        stack.push({ source: sourcePath, dest: destPath });
      } else {
        const fileContent = fs.readFileSync(sourcePath);
        await webR.FS.writeFile(destPath, fileContent);
      }
    }
  }

  await webR.evalRVoid(`.libPaths("${destDir}")`);
  console.log("[webR] Bundled packages mounted at .libPaths().");
}

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    if (!webRInstance) {
      console.log("[webR] Cold start: initializing WebR with bundled packages...");
      cachedBaseUrl = resolveBaseUrl(request);
      console.log(`[webR] Using asset base URL: ${cachedBaseUrl}`);
      const webR = await startWebR(cachedBaseUrl);
      await copyBundledPackages(webR);
      webRInstance = webR;
      console.log("[webR] WebR is ready. Cold start finished!");
    } else {
      console.log("[webR] Warm start: reusing existing WebR instance.");
    }

    if (!request.body) throw new Error("Request body is missing.");
    const { dataCsv } = request.body;

    const shelter = await new webRInstance.Shelter();
    try {
      await shelter.evalR(`inputData <- ${JSON.stringify(dataCsv || "")}`);
      const resultProxy = await shelter.evalR(ld50ScriptContent);
      const outputJson = await resultProxy.toString();
      if (!outputJson) throw new Error("R script returned no value.");

      response.status(200).setHeader("Content-Type", "application/json").send(outputJson);
    } finally {
      await shelter.purge();
    }
  } catch (error: any) {
    console.error("[webR] Error in Vercel function:", error);
    response.status(500).json({ error: error?.message || String(error) });
  }
}
