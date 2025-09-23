import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path' // Make sure to import path

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: true,
      buffer: true,
      process: true,
    }),
  ],
  server: {
    watch: {
      // Exclude the entire r_packages directory from being watched
      ignored: [
        path.resolve(__dirname, './r_packages/**'),
        path.resolve(__dirname, '.netlify/**/r_packages/**')
      ]
    }
  }
});