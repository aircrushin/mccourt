import { defineConfig, devices } from '@playwright/test';
const port = process.env.PLAYWRIGHT_PORT || '3000';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL, channel: 'chrome', ...devices['Desktop Chrome'] },
  webServer: { command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`, url: baseURL, reuseExistingServer: !process.env.PLAYWRIGHT_PORT, timeout: 120000 },
});
