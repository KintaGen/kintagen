import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { injected } from "wagmi/connectors";
import type { Chain } from "wagmi/chains";

// ... other page imports

// --- 1. Wagmi and Lit Imports ---
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LitProvider } from './lit/litProvider';

export const flowEvmTestnet = {
  id: 7001,
  name: "Flow EVM Testnet",
  nativeCurrency: { name: "Flow", symbol: "FLOW", decimals: 18 },
  rpcUrls: {
    // --- THIS IS THE KEY CHANGE ---
    // Instead of the direct URL, we point to our local proxy path.
    default: { http: ["/flow-rpc"] },
  },
  blockExplorers: {
    default: { name: "Flowscan", url: "https://testnet.flowscan.org" },
  },
} as const satisfies Chain;

const queryClient = new QueryClient();

export const config = createConfig({
  chains: [flowEvmTestnet],
  connectors: [injected()],
  transports: {
    [flowEvmTestnet.id]: http(),
  },
});

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <LitProvider>
          <App />
        </LitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
