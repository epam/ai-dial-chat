import { LoginPage } from '@/src/ui/pages';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { ChatSelectors, HeaderSelectors } from '@/src/ui/selectors';
import test, { expect } from '@playwright/test';

const usernames = process.env.E2E_OVERLAY_USERNAME!.split(',');

test('Overlay test', async ({ page, context }) => {
  await page.goto('/cases/overlay');
  await page.waitForLoadState();

  const frame = page.frameLocator('[name="overlay"]');
  await frame.getByText('Login').waitFor();

  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    await frame.getByText('Login').click(),
  ]);

  const loginPage = new LoginPage(newPage);
  await newPage.waitForLoadState();
  await loginPage.ssoSignInButton.click();

  const auth0Page = new Auth0Page(newPage);
  await newPage.waitForLoadState();
  const auth0Form = auth0Page.getAuth0();
  await auth0Form.setCredentials(usernames[0], process.env.E2E_PASSWORD!);
  await auth0Form.loginButton.click();

  await expect.soft(frame.locator(ChatSelectors.chat)).toBeVisible();
  await expect.soft(frame.locator(HeaderSelectors.banner)).toBeVisible();
});
