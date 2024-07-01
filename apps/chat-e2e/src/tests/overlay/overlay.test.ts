import { LoginPage } from '@/src/ui/pages';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { OverlayHomePage } from '@/src/ui/pages/overlayHomePage';
import { OverlayLoginPage } from '@/src/ui/pages/overlayLoginPage';
import test, { expect } from '@playwright/test';

const usernames = process.env.E2E_USERNAME!.split(',');

test('Overlay test', async ({ page }) => {
  const overlayLoginPage = new OverlayLoginPage(page);
  await overlayLoginPage.navigateToUrl('/cases/overlay');
  const newPage = await overlayLoginPage.clickLoginButton();

  const loginPage = new LoginPage(newPage);
  await newPage.waitForLoadState();
  await loginPage.ssoSignInButton.click();

  const auth0Page = new Auth0Page(newPage);
  await newPage.waitForLoadState();
  const auth0Form = auth0Page.getAuth0();
  await auth0Form.setCredentials(usernames[0], process.env.E2E_PASSWORD!);
  await auth0Form.loginButton.click();

  const overlayHomePage = new OverlayHomePage(page);
  const overlayContainer = overlayHomePage.getOverlayContainer();
  const overlayChat = overlayContainer.getChat();

  await expect.soft(overlayChat.getElementLocator()).toBeVisible();
  await expect
    .soft(overlayContainer.getBanner().getElementLocator())
    .toBeVisible();

  await overlayChat.sendRequestWithButton('1+2');
});
