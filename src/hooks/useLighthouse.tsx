import { useState } from 'react';

// Helper function to convert a File to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // The result includes a prefix like "data:image/png;base64,"
        // We need to remove it.
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

export function useLighthouse() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const fileData = await fileToBase64(file);

      // Call our secure serverless function, now with the filename included
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            fileData,
            fileName: file.name // <-- ADDED
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Upload failed with a server error.');
      }

      const result = await response.json();
      return result.cid;

    } catch (e: any) {
      console.error("Upload process failed:", e);
      setError(e.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { uploadFile, isLoading, error };
}