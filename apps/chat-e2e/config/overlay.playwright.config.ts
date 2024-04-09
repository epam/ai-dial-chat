import config from './playwright.config';

import { ResultFolder } from '@/src/testData';
import { workspaceRoot } from '@nx/devkit';
import { devices } from '@playwright/test';

/**
 * Config used for overlay run
 */
config.testDir = '../src/tests/overlay';
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
config.use!.baseURL = 'http://127.0.0.1:4200';

config.webServer = {
  cwd: workspaceRoot,
  command: 'npx nx serve:sandbox overlay-sandbox',
  url: 'http://127.0.0.1:4200',
  timeout: 180000,
  reuseExistingServer: true,
};

config.projects = [
  {
    name: 'overlay',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1536, height: 864 },
    },
  },
];

export default config;
