import { useEffect } from 'react';

/**
 * Custom hook to ensure page title is set reliably
 * This works alongside Helmet to ensure the title updates even if Helmet has timing issues
 */
export const usePageTitle = (title: string) => {
  useEffect(() => {
    // Set title immediately on mount
    document.title = title;
    
    // Also set it after a small delay to catch any race conditions
    const timeoutId = setTimeout(() => {
      if (document.title !== title) {
        document.title = title;
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [title]);
};

