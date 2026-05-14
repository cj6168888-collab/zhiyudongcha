import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: [
    // Legacy suites that assert pre-conversation-home routes or controls.
    '**/auth.spec.ts',
    '**/comprehensive-pages.spec.ts',
    '**/error-handling.spec.ts',
    '**/jilin-insight.spec.ts',
    '**/jilin-mega-test.spec.ts',
    '**/mobile-button-comprehensive.spec.ts',
    '**/mobile-button-e2e.spec.ts',
    '**/performance.spec.ts',
    '**/ui-consistency.spec.ts',
    '**/user-journeys.spec.ts',
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npx vite dev --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  timeout: 60000,
  expect: {
    timeout: 5000,
  },
});
