import { defineConfig } from '@playwright/test'

// Screenshot run (make shots). Uses the system Chrome (GPU-backed WebGL) when available.
const baseURL = process.env.BASE_URL ?? 'http://localhost:4173'

export default defineConfig({
  testDir: 'e2e',
  testMatch: /shots\.spec\.ts/,
  timeout: 240_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
    channel: process.env.SHOTS_CHANNEL ?? 'chrome',
    launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] },
  },
})
