/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/ — Vitest config is merged here (no separate vitest.config.ts).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    // Unit tests live next to source; Playwright e2e specs live in ./e2e and are excluded.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      // The shared, environment-agnostic logic modules are what we hold to a coverage bar.
      include: ['src/data/**/*.ts'],
    },
  },
})
