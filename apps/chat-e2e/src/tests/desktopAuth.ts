import config from '../../config/chat.playwright.config';
import { stateFilePath } from '../core/dialFixtures';

import test from '@/src/core/baseFixtures';
import { API } from '@/src/testData';

const usernames = process.env
  .E2E_USERNAME!.split(',')
  .slice(0, +config.workers! + 2);

for (let i = 0; i < usernames.length; i++) {
  // eslint-disable-next-line playwright/expect-expect
  test(`Authenticate user: ${usernames[i]}`, async ({
    page,
    loginPage,
    auth0Page,
    localStorageManager,
  }, testInfo) => {
    await loginPage.navigateToBaseUrl();
    await loginPage.ssoSignInButton.click();
    let options;
    if (testInfo.parallelIndex == 0) {
      options = { setEntitiesEnvVars: true };
    }
    const retrievedResponses = await auth0Page.loginToChatBot(
      usernames[i],
      options,
    );
    if (options?.setEntitiesEnvVars) {
      process.env.MODELS = retrievedResponses.get(API.modelsHost);
      process.env.ADDONS = retrievedResponses.get(API.addonsHost);
      process.env.RECENT_ADDONS = await localStorageManager.getRecentAddons();
      process.env.RECENT_MODELS = await localStorageManager.getRecentModels();
    }
    process.env['BUCKET' + i] = retrievedResponses.get(API.bucketHost);
    await page.context().storageState({ path: stateFilePath(i) });
  });
}
