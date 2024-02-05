import config from './playwright.config';

import { ResultFolder } from '@/src/testData';
import { workspaceRoot } from '@nx/devkit';
import { ReporterDescription } from '@playwright/test';
import dotenv from 'dotenv';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
dotenv.config({ path: './.env.development' });
dotenv.config({ path: './.env.local' });
/**
 * Config used for a local run
 */
config.workers = 2;
config.retries = 0;
config.use!.headless = true;
config.use!.video = 'on';
config.use!.trace = 'on';
(config.reporter as ReporterDescription[]).push([
  'html',
  { outputFolder: `../${ResultFolder.htmlReport}`, open: 'never' },
]);

/* Run local dev server before starting the tests */
config.webServer = {
  cwd: workspaceRoot,
  command: 'npx nx serve chat',
  url: 'http://localhost:3000',
  timeout: 180000,
  reuseExistingServer: true,
};

export default config;
