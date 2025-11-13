import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { HelmetProvider } from 'react-helmet-async'; 

// --- WAGMI AND QUERY CLIENT IMPORTS ---
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';

// --- LIT PROTOCOL PROVIDER IMPORT ---
import { LitProvider } from './lit/litProvider';

// --- SHARED CONFIGURATION IMPORTS ---
import { flowEvmTestnet } from './config/chain';

// --- SETUP ---
const queryClient = new QueryClient();

export const config = createConfig({
  chains: [flowEvmTestnet],
  connectors: [injected()],
  transports: {
    [flowEvmTestnet.id]: http(),
  },
});

// --- RENDER THE APPLICATION WITH ALL PROVIDERS ---
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <LitProvider>
          <HelmetProvider> 
            <App />
          </HelmetProvider> 
        </LitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);