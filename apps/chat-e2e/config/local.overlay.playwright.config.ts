import config from './overlay.playwright.config';

import { workspaceRoot } from '@nx/devkit';

/**
 * Config used for overlay local run
 */
config.retries = 0;
config.timeout = 300000;
config.use!.video = 'on';
config.use!.trace = 'on';

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
    },
  },
  {
    cwd: workspaceRoot,
    command: 'npx nx serve:sandbox overlay-sandbox',
    url: 'http://localhost:4200',
    timeout: 180000,
    reuseExistingServer: true,
  },
];

export default config;
