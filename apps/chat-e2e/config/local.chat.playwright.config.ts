import config from './chat.playwright.config';

import { ResultFolder } from '@/src/testData';
import { workspaceRoot } from '@nx/devkit';
import { ReporterDescription, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
dotenv.config({ path: path.resolve(__dirname, '../../chat/.env.local') });
dotenv.config({ path: './.env.local' });
/**
 * Config used for a local run
 */
config.retries = 1;
config.timeout = 3000000;
config.use!.headless = false;
config.use!.video = 'on';
config.use!.trace = 'on';
(config.reporter as ReporterDescription[]).push([
  'html',
  { outputFolder: `../${ResultFolder.chatHtmlReport}`, open: 'never' },
]);

/* Run local dev server before starting the tests if the E2E_HOST is not defined*/
if (!process.env.E2E_HOST) {
  config.webServer = {
    cwd: workspaceRoot,
    command: 'npx nx serve chat',
    url: 'http://localhost:3000',
    timeout: 180000,
    reuseExistingServer: true,
  };
}

config.projects = [
  // {
  //   name: 'auth',
  //   fullyParallel: true,
  //   testMatch: /desktopAuth\.ts/,
  // },
  {
    name: 'debug_auth',
    fullyParallel: true,
    testMatch: /debugAuth\.ts/,
  },
  {
    name: 'cleanup',
    testMatch: /cleanup\.ts/,
    dependencies: ['debug_auth'],
  },
  // {
  //   name: 'api listing',
  //   testMatch: /listing\.test\.ts/,
  //   dependencies: ['cleanup'],
  //   fullyParallel: true,
  // },
  // {
  //   name: 'chat api',
  //   testMatch: /\/chatApi\/.*\.test\.ts/,
  //   dependencies: ['cleanup'],
  //   fullyParallel: true,
  // },
  {
    name: 'chat e2e',
    testIgnore: /\/chatApi|listingApi|monitoring|\/overlay\/.*\.test\.ts/,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1536, height: 864 },
    },
    dependencies: ['cleanup'],
  },
];
export default config;
