import test from '../core/fixtures';

import { STORAGE_STATE } from '@/config/playwright.config';
import { API } from '@/src/testData';

test('Authenticate', async ({
  page,
  loginPage,
  auth0Page,
  localStorageManager,
}) => {
  await loginPage.navigateToBaseUrl();
  await loginPage.ssoSignInButton.click();
  const retrievedResponses = await auth0Page.loginToChatBot();
  process.env.MODELS = retrievedResponses.get(API.modelsHost);
  process.env.ADDONS = retrievedResponses.get(API.addonsHost);
  process.env.RECENT_ADDONS = await localStorageManager.getRecentAddons();
  process.env.RECENT_MODELS = await localStorageManager.getRecentModels();
  await page.context().storageState({ path: STORAGE_STATE });
});
