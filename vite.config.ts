import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    // Add this block
    allowedHosts: [
      'product.airawat.org',
      // '.airawat.org',     // ← optional: allow all subdomains if you want
      // 'localhost',        // usually already allowed, but harmless to add
    ],
    // Optional: if you're also accessing preview via non-localhost IP/domain
    host: '0.0.0.0',
    // port: 4173,          // default is 4173 — change only if needed
  },
  base: '/dss/'
})
