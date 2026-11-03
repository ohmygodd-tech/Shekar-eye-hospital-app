import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, /api is proxied to the backend. In production, serve the built
// files from the same domain as the API (see docs/DEPLOYMENT.md) or set VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4000' } },
  preview: { proxy: { '/api': 'http://localhost:4000' } },
})
