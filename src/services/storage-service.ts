import { Storage } from '@ionic/storage';

// Create a new Storage instance. This will use IndexedDB by default.
export const storage = new Storage();

// Initialize the storage engine. This is an async operation
// that the library handles automatically before the first `get` or `set`.
storage.create();