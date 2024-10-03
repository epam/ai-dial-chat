import config from './chat.playwright.config';

import { devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
config.use!.headless = false;

config.projects = [
  {
    name: 'auth',
    fullyParallel: true,
    testMatch: /desktopAuth\.ts/,
  },
  {
    name: 'monitoring',
    testMatch: /\/monitoring\/.*\.test\.ts/,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1536, height: 864 },
    },
    dependencies: ['auth'],
  },
];

export default config;
