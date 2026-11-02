import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Set by scripts/admin-sandbox.sh, which runs the Worker locally so /admin has an API to talk to.
const localApi = process.env.LOCAL_API_ORIGIN

export default defineConfig({
  plugins: [react()],
  server: localApi ? { proxy: { '/api': localApi } } : undefined,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
