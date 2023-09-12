import { ReporterDescription } from '@playwright/test/types/test';

import config from './playwright.config';

/**
 * Config used for a local run
 */
config.workers = 2;
config.use!.headless = false;
config.use!.video = 'on';
config.use!.trace = 'on';
(config.reporter as ReporterDescription[]).push([
  'html',
  { outputFolder: '../html-report', open: 'never' },
]);

/* Run local dev server before starting the tests */
config.webServer = {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  timeout: 180000,
};

export default config;
