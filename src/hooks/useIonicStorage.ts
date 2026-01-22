import { useState, useEffect, useCallback } from 'react'; // 1. Import useCallback
import { storage } from '../services/storage-service'; 

/**
 * A React hook to manage state that persists in Ionic Storage (IndexedDB).
 * @param key The key to store the value under.
 * @param initialValue The default value to use if nothing is in storage.
 * @returns A state tuple: [storedValue, setValue]
 */
export function useIonicStorage<T>(key: string, initialValue: T): [T, (value: T) => Promise<void>] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // useEffect to load the value from storage (this part is fine)
  useEffect(() => {
    const loadStoredValue = async () => {
      try {
        const value = await storage.get(key);
        if (value !== null && value !== undefined) {
          setStoredValue(value);
        }
      } catch (err) {
        console.error(`Error getting value for key "${key}" from storage:`, err);
      }
    };
    loadStoredValue();
  }, [key]);

  // --- THIS IS THE FIX ---
  // 2. Wrap the `setValue` function in a `useCallback` hook.
  //    This memoizes the function, so its identity is stable across renders.
  const setValue = useCallback(async (value: T) => {
    try {
      setStoredValue(value);
      await storage.set(key, value);
    } catch (err) {
      console.error(`Error setting value for key "${key}" in storage:`, err);
    }
  // 3. Provide the dependency array for useCallback itself.
  //    The function will only be recreated if `key` changes.
  }, [key]);

  return [storedValue, setValue];
}