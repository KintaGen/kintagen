import { WebR } from 'webr';

// Singleton pattern to ensure WebR is initialized only once.
let webRInstance: WebR | null = null;
let initPromise: Promise<void> | null = null;

// A centralized list of required R packages for easy management.
const R_PACKAGES = ["drc", "jsonlite", "ggplot2", "base64enc"];

/**
 * Initializes WebR and installs all required packages.
 */
export async function initWebR(onLog: (msg: string) => void = () => {}) {
  if (webRInstance) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      onLog('Initializing WebR Engine...');
      const webR = new WebR();
      await webR.init();
      onLog('WebR Engine Initialized.');

      onLog('Installing R packages... (this can take a moment)');
      await webR.installPackages(R_PACKAGES);
      onLog('All packages installed.');
      
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
    // We still write the DATA to the VFS, as this is a reliable method.
    if (dataCsv) {
      await webRInstance.FS.writeFile('/tmp/input.csv', dataCsv);
    }
    
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
    // Clean up the temporary data file.
    if (dataCsv) {
        await webRInstance.FS.unlink('/tmp/input.csv').catch(() => {});
    }
    await shelter.purge();
  }
}