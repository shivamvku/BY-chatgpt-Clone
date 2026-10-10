import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.APP_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // This project is a desktop web application. Keep browser coverage focused
  // on desktop Chromium instead of running a separate iPhone/mobile viewport.
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  reporter: 'list',
});
