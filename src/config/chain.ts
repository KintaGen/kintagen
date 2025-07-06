import type { Chain } from 'wagmi/chains';

// This is our shared, isolated chain definition.
export const flowEvmTestnet = {
  id: 545,
  name: "Flow EVM Testnet",
  nativeCurrency: { name: "Flow", symbol: "FLOW", decimals: 18 },
  rpcUrls: {
    // We still use the proxy for local development
    default: { http: ["/flow-rpc"] },
  },
  blockExplorers: {
    default: { name: "Flowscan", url: "https://testnet.flowscan.org" },
  },
} as const satisfies Chain;