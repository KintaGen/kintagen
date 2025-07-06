import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: true,
      buffer: true,
      process: true,
    }),
  ],
  // --- ADD THIS SERVER CONFIGURATION ---
  server: {
    proxy: {
      // Any request to /flow-rpc will be proxied
      '/flow-rpc': {
        // The target is the real Flow RPC endpoint
        target: 'https://testnet.evm.nodes.onflow.org',
        // This is necessary for the target server to accept the request
        changeOrigin: true,
        // This removes the '/flow-rpc' prefix before sending to the target
        rewrite: (path) => path.replace(/^\/flow-rpc/, ''),
      },
    },
  },
});