import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';

dialTest(
  'Favicon is shown when user is logged in',
  async ({
    dialHomePage,
    apiAssertion,
    baseAssertion,
    favicon,
    iconApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2385');
    const imageContentType = /^image\//;

    await dialTest.step('Log in DIAL', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ skipSidebars: true });
    });

    await dialTest.step('Check favicon is set in DOM', async () => {
      await baseAssertion.assertElementAttribute(
        favicon,
        Attributes.href,
        API.faviconHost,
        ExpectedMessages.faviconUrlIsValid,
      );
    });

    await dialTest.step(
      'Check favicon endpoint serves a valid image',
      async () => {
        // Headless Chromium doesn't reliably fetch the <link rel="icon"> resource on its own.
        // Favicon fetching is tied to browser tab/history UI, not the page's normal resource loading,
        // so it's not guaranteed to fire without a real tab to render an icon
        const response = await iconApiHelper.getFavicon();
        await apiAssertion.assertResponseCode(response, 'favicon', 200);
        baseAssertion.assertValueMatchPattern(
          response.headers()['content-type'],
          imageContentType,
          ExpectedMessages.responseContentTypeIsImage,
        );
        baseAssertion.assertNumberIsGreaterThan(
          (await response.body()).length,
          0,
        );
      },
    );
  },
);
