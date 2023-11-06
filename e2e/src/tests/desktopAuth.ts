import { STORAGE_STATE } from '../../config/playwright.config';
import test from '../core/fixtures';

import { API } from '@/e2e/src/testData';

test('Authenticate', async ({ page, loginPage, localStorageManager }) => {
  await loginPage.navigateToBaseUrl();
  const retrievedResponses = await loginPage.loginToChatBot();
  process.env.MODELS = retrievedResponses.get(API.modelsHost);
  process.env.ADDONS = retrievedResponses.get(API.addonsHost);
  process.env.RECENT_ADDONS = await localStorageManager.getRecentAddons();
  process.env.RECENT_MODELS = await localStorageManager.getRecentModels();
  await page.context().storageState({ path: STORAGE_STATE });
});
