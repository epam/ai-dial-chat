import { STORAGE_STATE } from '../../playwright.config';
import test from '../core/fixtures';

test('Authenticate', async ({ page, loginPage }) => {
  await loginPage.openHomePage();
  await loginPage.loginToChatBot();
  await page.context().storageState({ path: STORAGE_STATE });
});
