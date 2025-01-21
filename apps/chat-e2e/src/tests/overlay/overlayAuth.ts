import config from '@/config/chat.playwright.config';
import test from '@/src/core/baseFixtures';
import { overlayStateFilePath } from '@/src/core/dialOverlayFixtures';
import { API, OverlaySandboxUrls } from '@/src/testData';
import { LoginPage } from '@/src/ui/pages';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { OverlayLoginPage } from '@/src/ui/pages/overlay/overlayLoginPage';

const overlayUsernames = process.env
  .E2E_OVERLAY_USERNAME!.split(',')
  .slice(0, +config.workers!);

if (process.env.E2E_ADMIN) {
  overlayUsernames.push(process.env.E2E_ADMIN);
}

for (let i = 0; i < overlayUsernames.length; i++) {
  // eslint-disable-next-line playwright/expect-expect
  test(`[Overlay] Login: ${overlayUsernames[i]}`, async ({
    page,
    setTestIds,
  }, testInfo) => {
    setTestIds('EPMRTC-3785');
    const overlayLoginPage = new OverlayLoginPage(page);
    await overlayLoginPage.navigateToUrl(
      OverlaySandboxUrls.modelIdSetSandboxUrl,
    );
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

    const storage = await page.context().storageState({
      path: overlayStateFilePath(i),
    });
    const frameOriginLocalStorage = storage.origins[0].localStorage;
    process.env.RECENT_MODELS = frameOriginLocalStorage.find(
      (s) => s.name === 'recentModelsIds',
    )?.value;
    process.env.RECENT_ADDONS = frameOriginLocalStorage.find(
      (s) => s.name === 'recentAddonsIds',
    )?.value;
  });
}
