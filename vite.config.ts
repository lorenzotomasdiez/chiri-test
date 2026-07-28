import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  test: {
    // The pure core is the only thing Vitest runs. Anything touching an
    // EditorView goes to Playwright: probe 4 established that CM6 under jsdom
    // needs hand-written polyfills and still has no layout engine, so
    // coordinate and keybinding assertions there would be false confidence.
    include: ['src/core/**/*.test.ts'],
    environment: 'node',
  },
})
