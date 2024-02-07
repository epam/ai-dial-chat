import { ResultFolder } from '@/src/testData';
import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: '../src/tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Opt out of parallel tests on CI. */
  workers: process.env.E2E_WORKERS ? +process.env.E2E_WORKERS : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: `apps/chat-e2e/${ResultFolder.allureReport}`,
      },
    ],
  ],
  outputDir: `../${ResultFolder.testResults}`,
  timeout: 60000,
  retries: 1,
  maxFailures: 10,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    browserName: 'chromium',
    headless: true,
    navigationTimeout: 20000,
    actionTimeout: 20000,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_HOST ?? 'http://localhost:3000',
    video: 'off',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'off',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  expect: {
    timeout: 20000,
  },
  globalSetup: require.resolve('../src/hooks/global-setup'),
  globalTeardown: require.resolve('../src/hooks/global-teardown'),

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'auth',
      fullyParallel: true,
      testMatch: /desktopAuth\.ts/,
    },
    {
      name: 'api listing',
      testMatch: /listing\.test\.ts/,
      dependencies: ['auth'],
      fullyParallel: true,
    },
    {
      name: 'chat api',
      testMatch: /\/chatApi\/.*\.test\.ts/,
      dependencies: ['api listing'],
      fullyParallel: true,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1536, height: 864 },
      },
      dependencies: ['chat api'],
    },
  ],
});
