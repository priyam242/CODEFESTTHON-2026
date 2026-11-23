import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: '../server',
      port: 4000,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'node ./patch-tw.cjs && npx vite --port 5173',
      port: 5173,
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
