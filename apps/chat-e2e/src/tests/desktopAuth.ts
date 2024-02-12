import config from '../../config/playwright.config';
import test, { stateFilePath } from '../core/fixtures';

import { API } from '@/src/testData';

const usernames = process.env
  .E2E_USERNAME!.split(',')
  .slice(0, +config.workers!);

for (const username of usernames) {
  test(`Authenticate user: ${username}`, async ({
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
      username,
      options,
    );
    if (options?.setEntitiesEnvVars) {
      process.env.MODELS = retrievedResponses.get(API.modelsHost);
      process.env.ADDONS = retrievedResponses.get(API.addonsHost);
      process.env.RECENT_ADDONS = await localStorageManager.getRecentAddons();
      process.env.RECENT_MODELS = await localStorageManager.getRecentModels();
    }
    process.env['BUCKET' + testInfo.parallelIndex] = retrievedResponses.get(
      API.bucketHost,
    );
    await page.context().storageState({ path: stateFilePath });
  });
}
