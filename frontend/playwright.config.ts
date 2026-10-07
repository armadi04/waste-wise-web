import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://localhost:32012',
    timezoneId: 'America/New_York',
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (process.env.CI ? undefined : '/usr/bin/google-chrome'),
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bun run dev -- --port 32012 --host 127.0.0.1 --strictPort',
    url: 'http://localhost:32012',
    env: { VITE_API_URL: '' },
    reuseExistingServer: false,
  },
})
