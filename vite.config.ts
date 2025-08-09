import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Remove base path for Cloudflare Pages (they handle root path correctly)
  // base: '/zed-ai/',
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  }
})
