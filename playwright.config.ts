import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'npx serve . -l 4173 --no-clipboard',
    port: 4173,
    reuseExistingServer: true,
  },
});
