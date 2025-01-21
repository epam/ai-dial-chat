import config, { overlayHost } from './chat.playwright.config';

import { ResultFolder } from '@/src/testData';
import { workspaceRoot } from '@nx/devkit';
import { devices } from '@playwright/test';

/**
 * Config used for overlay run
 */
config.testDir = '../src/tests/overlay';
config.workers = process.env.E2E_OVERLAY_WORKERS
  ? +process.env.E2E_OVERLAY_WORKERS
  : 1;
config.reporter = [
  ['list'],
  [
    'allure-playwright',
    {
      detail: true,
      outputFolder: `apps/chat-e2e/${ResultFolder.allureOverlayReport}`,
    },
  ],
];
config.use!.baseURL = overlayHost;
config.use!.navigationTimeout = 60000;
config.use!.actionTimeout = 60000;

config.webServer = {
  cwd: workspaceRoot,
  command: 'npx nx serve:sandbox:production overlay-sandbox',
  url: overlayHost,
  timeout: 300000,
  reuseExistingServer: true,
  stdout: 'pipe',
  stderr: 'pipe',
};

config.projects = [
  {
    name: 'auth',
    fullyParallel: true,
    testMatch: /overlayAuth\.ts/,
  },
  {
    name: 'overlay',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1536, height: 864 },
    },
    dependencies: ['auth'],
  },
];

export default config;
