import { useState } from 'react';

// Helper function to convert a File to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
};

// This can now be thought of as `usePinataUpload`
export function useLighthouse() { 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const fileData = await fileToBase64(file);

      // This call now correctly targets your Vercel function
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            fileData,          // The base64 content
            fileName: file.name // The original filename (e.g., "artifact.zip")
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Upload failed with a server error.');
      }

      const result = await response.json(); // Gets the full { cid, name, ... } object
      return result.cid; // Returns just the CID string as intended

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