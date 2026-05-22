import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
        hasTouch: false,
      },
    },
  ],
  webServer: {
    command: `PORT=${PORT} npm run dev`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
