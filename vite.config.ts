import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path' 
import vercel from 'vite-plugin-vercel';

export default defineConfig({
  plugins: [
    react(),
    vercel(),
    nodePolyfills({
      globals: true,
      buffer: true,
      process: true,
    }),
  ],
  server: {
    port: Number(process.env.PORT) || 3000,
    watch: {
      // Exclude the entire r_packages directory from being watched
      ignored: [
        path.resolve(__dirname, './r_packages/**'),
      ]
    }
  }
});