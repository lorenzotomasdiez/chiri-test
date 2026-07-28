import { defineConfig, devices } from '@playwright/test'

// Everything that touches the EditorView runs here, against a real dev server.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    // FR-9's clipboard specs read navigator.clipboard.readText() back in the
    // page to assert what Copy wrote; Chromium's clipboard-read permission is
    // not granted to a context by default, so it is granted here rather than
    // in each spec (Firefox and WebKit do not support granting it the same
    // way, so it is scoped to this project only).
    { name: 'chromium', use: { ...devices['Desktop Chrome'], permissions: ['clipboard-read', 'clipboard-write'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
