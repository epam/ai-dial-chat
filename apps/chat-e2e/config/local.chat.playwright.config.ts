import config from './chat.playwright.config';

import { ResultFolder } from '@/src/testData';
import { workspaceRoot } from '@nx/devkit';
import { ReporterDescription } from '@playwright/test';
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
config.retries = 0;
config.timeout = 300000;
config.use!.headless = true;
config.use!.video = 'on';
config.use!.trace = 'on';
(config.reporter as ReporterDescription[]).push([
  'html',
  { outputFolder: `../${ResultFolder.chatHtmlReport}`, open: 'never' },
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
