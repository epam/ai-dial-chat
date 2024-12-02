import config from '@/config/chat.playwright.config';
import test from '@/src/core/baseFixtures';
import { overlayStateFilePath } from '@/src/core/dialOverlayFixtures';
import { API } from '@/src/testData';
import { LoginPage } from '@/src/ui/pages';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { OverlayLoginPage } from '@/src/ui/pages/overlayLoginPage';

const overlayUsernames = process.env
  .E2E_OVERLAY_USERNAME!.split(',')
  .slice(0, +config.workers!);

for (let i = 0; i < overlayUsernames.length; i++) {
  // eslint-disable-next-line playwright/expect-expect
  test(`Authenticate overlay user: ${overlayUsernames[i]}`, async ({
    page,
  }, testInfo) => {
    const overlayLoginPage = new OverlayLoginPage(page);
    await overlayLoginPage.navigateToUrl('/cases/overlay');
    const newPage = await overlayLoginPage.clickLoginButton();

    const loginPage = new LoginPage(newPage);
    await newPage.waitForLoadState();
    if (await loginPage.auth0SignInButton.isVisible()) {
      await loginPage.auth0SignInButton.click();
    }
    const auth0Page = new Auth0Page(newPage);
    await newPage.waitForLoadState();
    const auth0Form = auth0Page.getAuth0();
    await auth0Form.setCredentials(
      overlayUsernames[i],
      process.env.E2E_PASSWORD!,
    );

    let options;
    if (testInfo.parallelIndex == 0) {
      options = { setEntitiesEnvVars: true };
    }
    const retrievedResponses =
      await overlayLoginPage.waitForApiResponsesReceived(
        () => auth0Form.loginButton.click(),
        options,
      );
    if (options?.setEntitiesEnvVars) {
      process.env.MODELS = retrievedResponses.get(API.modelsHost);
      process.env.ADDONS = retrievedResponses.get(API.addonsHost);
    }
    process.env['BUCKET' + i] = retrievedResponses.get(API.bucketHost);

    await page.context().storageState({
      path: overlayStateFilePath(i),
    });
  });
}
