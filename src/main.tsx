import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { HelmetProvider } from 'react-helmet-async'; 

// --- WAGMI AND QUERY CLIENT IMPORTS ---
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


// --- SETUP ---
const queryClient = new QueryClient();

// --- RENDER THE APPLICATION WITH ALL PROVIDERS ---
// Create a context for HelmetProvider to ensure proper isolation
const helmetContext = {};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <QueryClientProvider client={queryClient}>
          <HelmetProvider context={helmetContext}> 
            <App />
          </HelmetProvider> 
      </QueryClientProvider>
  </React.StrictMode>
);