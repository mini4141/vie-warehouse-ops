import { defineConfig } from '@playwright/test'

// BASE_URL points at a deployed stack; otherwise a local mock-mode preview is served.
const baseURL = process.env.BASE_URL ?? 'http://localhost:4173'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 1,
  reporter: [['list']],
  use: { baseURL, viewport: { width: 1440, height: 900 }, launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'pnpm build:mock && pnpm exec vite preview --port 4173', port: 4173, reuseExistingServer: true, timeout: 180_000 },
})
