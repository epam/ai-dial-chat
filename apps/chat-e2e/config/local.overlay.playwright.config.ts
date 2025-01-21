import config from './overlay.playwright.config';

import { overlayHost } from '@/config/chat.playwright.config';
import { ResultFolder } from '@/src/testData';
import { workspaceRoot } from '@nx/devkit';
import { ReporterDescription } from '@playwright/test';

/**
 * Config used for overlay local run
 */
config.use!.headless = false;
config.retries = 0;
config.timeout = 300000;
config.use!.video = 'on';
config.use!.trace = 'on';
config.use!.navigationTimeout = 100000;
(config.reporter as ReporterDescription[]).push([
  'html',
  { outputFolder: `../${ResultFolder.overlayHtmlReport}`, open: 'never' },
]);

config.webServer = [
  {
    cwd: workspaceRoot,
    command: 'npx nx serve chat',
    url: 'http://localhost:3000',
    timeout: 180000,
    reuseExistingServer: true,
    env: {
      IS_IFRAME: 'true',
      ALLOWED_IFRAME_ORIGINS: '*',
      NEXTAUTH_URL: 'http://localhost:3000',
      ENABLED_FEATURES: 'top-settings,top-chat-info,top-clear-conversation',
    },
  },
  {
    cwd: workspaceRoot,
    command: 'npx nx serve:sandbox overlay-sandbox',
    url: overlayHost,
    timeout: 180000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_OVERLAY_HOST: 'http://localhost:3000',
    },
  },
];

export default config;
