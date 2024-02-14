import { LocalStorageManager } from '@/src/core/localStorageManager';
import { LoginPage } from '@/src/ui/pages';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { test as base } from '@playwright/test';

export const skipReason = 'Execute test on CI env only';

const test = base.extend<{
  loginPage: LoginPage;
  auth0Page: Auth0Page;
  localStorageManager: LocalStorageManager;
}>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
  auth0Page: async ({ page }, use) => {
    const auth0Page = new Auth0Page(page);
    await use(auth0Page);
  },
  localStorageManager: async ({ page }, use) => {
    const localStorageManager = new LocalStorageManager(page);
    await use(localStorageManager);
  },
});

export default test;
