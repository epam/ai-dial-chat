import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { apiTimeout } from '@/src/ui/pages';

dialTest(
  'Favicon is shown when user is logged in',
  async ({ dialHomePage, baseAssertion, favicon, setTestIds }) => {
    setTestIds('EPMDIAL-2385');
    const imageContentType = /^image\//;

    await dialTest.step(
      'Open DIAL home page and verify favicon request is triggered, icon is set in DOM',
      async () => {
        const { responses } = await dialHomePage.waitForExpectedResponses(
          () => dialHomePage.openHomePage(),
          [{ apiMethod: 'GET', urlPattern: API.faviconHost }],
          200,
          apiTimeout * 2,
        );
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        baseAssertion.assertValueMatchPattern(
          responses[0].headers()['content-type'],
          imageContentType,
          ExpectedMessages.responseContentTypeIsImage,
        );
        baseAssertion.assertNumberIsGreaterThan(
          (await responses[0].text()).length,
          0,
        );
        await baseAssertion.assertElementAttribute(
          favicon,
          Attributes.href,
          API.faviconHost,
          ExpectedMessages.faviconUrlIsValid,
        );
      },
    );
  },
);
