import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// --- WAGMI AND QUERY CLIENT IMPORTS ---
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';

// --- LIT PROTOCOL PROVIDER IMPORT ---
import { LitProvider } from './lit/LitProvider';

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
        {/* By placing LitProvider here, it wraps the entire App and all its routes */}
        <LitProvider>
          <App />
        </LitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);