import { WebR } from 'webr';

// Singleton pattern to ensure WebR is initialized only once.
let webRInstance: WebR | null = null;
let initPromise: Promise<void> | null = null;

// A centralized list of required R packages for easy management.
const R_PACKAGES = ["drc", "jsonlite", "ggplot2", "base64enc"];
const PERSISTENT_LIBRARY_PATH = '/webr/library';

type LogFn = (msg: string) => void;

const ensureDir = (FS: any, path: string) => {
  try {
    FS.mkdir(path);
  } catch (error: any) {
    if (error?.code !== 'EEXIST') {
      throw error;
    }
  }
};

const syncFS = async (webR: WebR, populate: boolean) => {
  const FS = (webR as any).FS;

  if (!FS?.syncfs) return;

  await new Promise<void>((resolve, reject) => {
    FS.syncfs(populate, (err: unknown) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const evalRVoid = async (webR: WebR, code: string) => {
  const anyWebR = webR as any;

  if (typeof anyWebR.evalRVoid === 'function') {
    await anyWebR.evalRVoid(code);
    return;
  }

  const result = await webR.evalR(code);

  if (typeof (result as any)?.destroy === 'function') {
    await (result as any).destroy();
  }
};

const setupPersistentLibrary = async (webR: WebR, onLog: LogFn): Promise<boolean> => {
  const FS = (webR as any).FS;
  const idbfs = FS?.filesystems?.IDBFS;

  if (!FS || !idbfs) {
    onLog('Browser persistence unavailable; using ephemeral R packages.');
    return false;
  }

  try {
    onLog('Preparing browser cache for R packages...');

    ensureDir(FS, '/webr');
    ensureDir(FS, PERSISTENT_LIBRARY_PATH);

    const alreadyMounted = (() => {
      try {
        const lookup = FS.lookupPath(PERSISTENT_LIBRARY_PATH);
        return Boolean(lookup?.node?.mounted);
      } catch {
        return false;
      }
    })();

    if (!alreadyMounted) {
      FS.mount(idbfs, {}, PERSISTENT_LIBRARY_PATH);
    }

    await syncFS(webR, true);

    const escapedPath = PERSISTENT_LIBRARY_PATH.replace(/"/g, '\\"');

    await evalRVoid(
      webR,
      `
        dir.create("${escapedPath}", showWarnings = FALSE, recursive = TRUE)
        .libPaths(unique(c("${escapedPath}", .libPaths())))
        Sys.setenv(R_LIBS_USER = "${escapedPath}")
      `.trim()
    );

    return true;
  } catch (error) {
    console.warn('Failed to prepare persistent package cache:', error);
    onLog('Failed to prepare package cache; continuing without persistence.');
    return false;
  }
};

const getMissingPackages = async (webR: WebR, packages: string[]): Promise<string[]> => {
  if (!packages.length) {
    return [];
  }

  const packagesVector = `c(${packages.map((pkg) => `"${pkg}"`).join(',')})`;
  const result = await webR.evalR(
    `
      missing <- setdiff(${packagesVector}, rownames(installed.packages()))
      paste(missing, collapse = ',')
    `.trim()
  );

  const missingCsv = (await result.toString()).trim();

  if (typeof (result as any)?.destroy === 'function') {
    await (result as any).destroy();
  }

  if (!missingCsv) {
    return [];
  }

  return missingCsv.split(',').map((pkg) => pkg.trim()).filter(Boolean);
};

/**
 * Initializes WebR and installs all required packages.
 */
export async function initWebR(onLog: LogFn = () => {}) {
  if (webRInstance) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      onLog('Initializing WebR Engine...');
      const webR = new WebR();
      await webR.init();
      onLog('WebR Engine Initialized.');

      const persistenceEnabled = await setupPersistentLibrary(webR, onLog);
      const missingPackages = await getMissingPackages(webR, R_PACKAGES);

      if (missingPackages.length > 0) {
        onLog(`Installing R packages... ${missingPackages.join(', ')}`);
        await webR.installPackages(missingPackages);

        if (persistenceEnabled) {
          await syncFS(webR, false);
        }

        onLog('All packages installed.');
      } else {
        onLog('R packages loaded from cache.');
      }

      webRInstance = webR;
    } catch (error) {
      console.error('Failed to initialize WebR or install packages:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Runs the analysis script by passing the script content directly to evalR.
 * This is the most robust method, avoiding VFS race conditions for the script itself.
 */
export async function runLd50Analysis(rScriptContent: string, dataCsv?: string): Promise<any> {
  if (!webRInstance) {
    throw new Error('WebR is not initialized. Call initWebR() before running analysis.');
  }

  const shelter = await new webRInstance.Shelter();

  try {
    // Determine the value to pass to R. If dataCsv is null or undefined,
    // pass an empty string. The R script is designed to handle this.
    const dataForR = dataCsv || "";

    // Step 1: Create the 'inputData' variable directly in the R environment.
    // This is the only step needed to provide the data.
    await shelter.evalR(`inputData <- ${JSON.stringify(dataForR)}`);
    // --- THIS IS THE DEFINITIVE FIX ---
    // Instead of writing the script to a file and sourcing it,
    // we pass the entire script content directly to `evalR`.
    // The R script must end with `toJSON(...)` for this to work.
    const resultProxy = await shelter.evalR(rScriptContent);
    // --- END OF FIX ---

    // The resultProxy holds the last value from the R script (the JSON string).
    const outputJson = await resultProxy.toString();

    if (!outputJson) {
      throw new Error(`R script returned no value.`);
    }

    return JSON.parse(outputJson);

  } catch (e) {
    console.error("Error during R script execution:", e);
    throw e;
  } finally {
    await shelter.purge();
  }
}